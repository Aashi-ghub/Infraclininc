"""
Streaming parser utilities for borelog CSV/XLSX documents.

The parser supports two dominant formats:

1. Structured CSV where the header row contains machine friendly field
   names (e.g., ``project_name``, ``stratum_description``).
2. Template-style exports where metadata is scattered across multiple
   rows and the stratum table has human readable headers like
   "Description of Soil Stratum".
"""

from __future__ import annotations

import csv
import io
import logging
import re
import zipfile
from typing import Dict, Iterator, List, Optional, Tuple
from xml.etree import ElementTree as ET

logger = logging.getLogger(__name__)

CSV_TEXT_ENCODING = "utf-8"
SPREADSHEET_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def iter_csv_rows(body) -> Iterator[List[str]]:
    """
    Stream CSV rows from a boto3 StreamingBody without loading the entire file.
    """
    text_stream = io.TextIOWrapper(body, encoding=CSV_TEXT_ENCODING, newline="")
    reader = csv.reader(text_stream)
    try:
        for row in reader:
            yield [cell.strip() for cell in row]
    finally:
        try:
            text_stream.close()
        except Exception as exc:  # pragma: no cover - defensive logging only
            logger.debug("Failed to close CSV text stream: %s", exc)


def iter_xlsx_rows(body) -> Iterator[List[str]]:
    """
    Iterate over rows from the first worksheet of an XLSX file.

    XLSX is a zipped archive, so we must read the full payload once
    before iterating. This is acceptable because Excel files require
    random access; the CSV path remains fully streaming.
    """
    payload = body.read()
    if not payload:
        return

    bytes_io = io.BytesIO(payload)
    with zipfile.ZipFile(bytes_io) as archive:
        shared_strings = _read_shared_strings(archive)
        sheet_name = "xl/worksheets/sheet1.xml"
        if sheet_name not in archive.namelist():
            raise ValueError("XLSX missing xl/worksheets/sheet1.xml")

        sheet_xml = archive.read(sheet_name)
        root = ET.fromstring(sheet_xml)
        for row in root.findall(f".//{SPREADSHEET_NS}row"):
            row_values: List[str] = []
            expected_col = 0
            for cell in row.findall(f"{SPREADSHEET_NS}c"):
                ref = cell.get("r", "")
                col_idx = _column_ref_to_index(ref)
                while expected_col < col_idx:
                    row_values.append("")
                    expected_col += 1

                value = _read_cell_value(cell, shared_strings)
                row_values.append(value.strip())
                expected_col += 1

            yield row_values


def _read_shared_strings(archive: zipfile.ZipFile) -> List[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    raw = archive.read("xl/sharedStrings.xml")
    root = ET.fromstring(raw)
    strings: List[str] = []
    for si in root.findall(f"{SPREADSHEET_NS}si"):
        text_parts = [
            t.text or ""
            for t in si.findall(f".//{SPREADSHEET_NS}t")
        ]
        strings.append("".join(text_parts))
    return strings


def _column_ref_to_index(ref: str) -> int:
    """
    Convert Excel cell reference (e.g., 'B2') to zero-based column index.
    """
    match = re.match(r"([A-Z]+)", ref or "")
    if not match:
        return 0
    letters = match.group(1)
    result = 0
    for char in letters:
        result = result * 26 + (ord(char) - ord("A") + 1)
    return max(result - 1, 0)


def _read_cell_value(cell, shared_strings: List[str]) -> str:
    cell_type = cell.get("t")
    if cell_type == "s":
        idx_text = cell.findtext(f"{SPREADSHEET_NS}v")
        if idx_text is None:
            return ""
        idx = int(idx_text)
        return shared_strings[idx] if idx < len(shared_strings) else ""
    if cell_type == "inlineStr":
        text_parts = [
            t.text or ""
            for t in cell.findall(f".//{SPREADSHEET_NS}t")
        ]
        return "".join(text_parts)
    value = cell.findtext(f"{SPREADSHEET_NS}v")
    return value or ""


def parse_borelog_document(rows: Iterator[List[str]]) -> Tuple[Dict, List[Dict]]:
    """
    Parse rows from CSV/XLSX into metadata + strata representation.
    """
    iterator = iter(rows)
    metadata_rows: List[List[str]] = []

    for row in iterator:
        normalized = _normalize_row(row)
        if not _has_meaningful_data(normalized):
            continue

        if _looks_like_structured_header(normalized):
            metadata, strata = _parse_structured(iterator, normalized)
            return metadata, strata

        metadata_rows.append(normalized)
        if _looks_like_template_header(normalized):
            metadata, strata = _parse_template(metadata_rows, normalized, iterator)
            return metadata, strata

    raise ValueError(
        "Failed to detect borelog header. Expected either structured CSV "
        "headers (project_name, stratum_description, ...) or template headers "
        "containing 'Description of Soil Stratum'."
    )


def _normalize_row(row: List[str]) -> List[str]:
    return [str(cell).strip() for cell in row]


def _has_meaningful_data(row: List[str]) -> bool:
    return any(cell not in ("", None) for cell in row)


def _looks_like_structured_header(row: List[str]) -> bool:
    lowered = [cell.lower() for cell in row if cell]
    return (
        "project_name" in lowered
        and "stratum_description" in lowered
        and "stratum_depth_from" in lowered
    )


def _looks_like_template_header(row: List[str]) -> bool:
    joined = " ".join(cell.lower() for cell in row if cell)
    return "description of soil stratum" in joined and "depth" in joined


def _parse_structured(
    iterator: Iterator[List[str]],
    header_row: List[str],
) -> Tuple[Dict, List[Dict]]:
    logger.info("Structured CSV detected. Header columns: %s", header_row)
    metadata_row: Optional[Dict[str, str]] = None
    strata_rows: List[Dict[str, str]] = []
    header = [col.strip() for col in header_row]

    for row in iterator:
        normalized = _normalize_row(row)
        if not normalized:
            continue
        padded = normalized + [""] * (len(header) - len(normalized))
        record = {header[i]: padded[i] for i in range(len(header))}
        if metadata_row is None:
            metadata_row = record
            continue
        strata_rows.append(record)

    if metadata_row is None:
        raise ValueError("Structured CSV missing metadata row")

    metadata = _build_structured_metadata(metadata_row)
    strata = _build_structured_strata(strata_rows)
    return metadata, strata


def _build_structured_metadata(row: Dict[str, str]) -> Dict:
    logger.debug("Structured metadata row: %s", row)

    def pick(*keys: str) -> Optional[str]:
        for key in keys:
            if key in row and row[key]:
                return row[key].strip()
        return None

    metadata = {
        "project_name": pick("project_name"),
        "job_code": pick("job_code"),
        "chainage_km": _safe_number(pick("chainage_km")),
        "borehole_no": pick("borehole_no"),
        "msl": _safe_number(pick("msl")),
        "method_of_boring": pick("method_of_boring"),
        "diameter_of_hole": pick("diameter_of_hole"),
        "section_name": pick("section_name"),
        "location": pick("location") or "",
        "coordinate_e": pick("coordinate_e"),
        "coordinate_l": pick("coordinate_l"),
        "commencement_date": pick("commencement_date"),
        "completion_date": pick("completion_date"),
        "standing_water_level": pick("standing_water_level"),
        "termination_depth": pick("termination_depth"),
        "permeability_tests_count": _safe_int(pick("permeability_tests_count")),
        "spt_tests_count": _safe_int(pick("spt_tests_count")),
        "vs_tests_count": _safe_int(pick("vs_tests_count")),
        "undisturbed_samples_count": _safe_int(pick("undisturbed_samples_count")),
        "disturbed_samples_count": _safe_int(pick("disturbed_samples_count")),
        "water_samples_count": _safe_int(pick("water_samples_count")),
        "version_number": _safe_int(pick("version_number")),
        "status": pick("status") or "draft",
        "remarks": pick("remarks"),
    }
    return metadata


def _build_structured_strata(rows: List[Dict[str, str]]) -> List[Dict]:
    strata: List[Dict] = []
    strata_index: Dict[Tuple[float, float, str], Dict] = {}

    for row in rows:
        description = (row.get("stratum_description") or "").strip()
        depth_from = _safe_number(row.get("stratum_depth_from"))
        depth_to = _safe_number(row.get("stratum_depth_to"))
        if not description or depth_from is None or depth_to is None:
            # Only log when there is some non-sample data to avoid noise
            if any((description, row.get("sample_event_type"))):
                logger.debug(
                    "Skipping row lacking essential stratum data: %s", row
                )
            continue

        key = (depth_from, depth_to, description)
        stratum = strata_index.get(key)
        if not stratum:
            stratum = {
                "description": description,
                "depth_from": depth_from,
                "depth_to": depth_to,
                "thickness": _safe_number(row.get("stratum_thickness_m"))
                or _calculate_thickness(depth_from, depth_to),
                "colour_of_return_water": _safe_string(row.get("return_water_colour")),
                "water_loss": _safe_string(row.get("water_loss")),
                "diameter_of_borehole": _safe_string(row.get("borehole_diameter")),
                "remarks": _safe_string(row.get("remarks")),
                "tcr_percent": _safe_number(row.get("tcr_percent")),
                "rqd_percent": _safe_number(row.get("rqd_percent")),
                "samples": [],
            }
            strata_index[key] = stratum
            strata.append(stratum)
        else:
            # Merge additional remarks when available
            if not stratum.get("remarks"):
                stratum["remarks"] = _safe_string(row.get("remarks"))

        sample = _build_sample_from_structured_row(row)
        if sample:
            stratum["samples"].append(sample)

    return strata


def _build_sample_from_structured_row(row: Dict[str, str]) -> Optional[Dict]:
    sample_type = (row.get("sample_event_type") or "").strip()
    sample_depth = _safe_number(row.get("sample_event_depth_m"))
    run_length = _safe_number(row.get("run_length_m"))
    blows = [
        _safe_number(row.get("spt_blows_1")),
        _safe_number(row.get("spt_blows_2")),
        _safe_number(row.get("spt_blows_3")),
    ]
    n_value = row.get("n_value_is_2131")
    total_core = _safe_number(row.get("total_core_length_cm"))
    tcr = _safe_number(row.get("tcr_percent"))
    rqd_length = _safe_number(row.get("rqd_length_cm"))
    rqd_percent = _safe_number(row.get("rqd_percent"))
    remarks = _safe_string(row.get("remarks"))

    has_blow_values = any(blow is not None for blow in blows)
    if not any(
        [
            bool(sample_type),
            sample_depth is not None,
            run_length is not None,
            total_core is not None,
            tcr is not None,
            rqd_length is not None,
            rqd_percent is not None,
            has_blow_values,
            bool(remarks),
        ]
    ):
        return None

    return {
        "sample_event_type": sample_type or None,
        "sample_event_depth_m": sample_depth,
        "run_length_m": run_length,
        "penetration_15cm": blows,
        "n_value": n_value if n_value else None,
        "total_core_length_cm": total_core,
        "tcr_percent": tcr,
        "rqd_length_cm": rqd_length,
        "rqd_percent": rqd_percent,
        "remarks": remarks,
    }


def _parse_template(
    metadata_rows: List[List[str]],
    header_row: List[str],
    iterator: Iterator[List[str]],
) -> Tuple[Dict, List[Dict]]:
    logger.info("Template-style CSV detected. Header row: %s", header_row)
    metadata = _build_template_metadata(metadata_rows)
    
    # Check if there's a sub-header row (row after main header with "From", "To", "Thickness")
    # Convert iterator to list to allow peeking
    remaining_rows = list(iterator)
    
    sub_header_row: Optional[List[str]] = None
    data_start_index = 0
    
    if remaining_rows:
        # Check first row to see if it's a sub-header
        first_row = remaining_rows[0]
        normalized_first = _normalize_row(first_row)
        has_from = any("from" in cell.lower() for cell in normalized_first)
        has_to = any("to" in cell.lower() and cell.lower() != "total" for cell in normalized_first)
        
        if has_from and has_to:
            sub_header_row = normalized_first
            data_start_index = 1  # Skip sub-header row
            logger.info("Found sub-header row: %s", sub_header_row)
            # Build column map from sub-header
            column_map = _build_template_column_map(sub_header_row, header_row)
        else:
            # No sub-header, use main header
            column_map = _build_template_column_map(header_row, None)
    else:
        # No more rows, use main header only
        column_map = _build_template_column_map(header_row, None)
    
    # Create iterator from remaining rows (skipping sub-header if found)
    data_iterator = iter(remaining_rows[data_start_index:])
    strata = _build_template_strata(data_iterator, column_map)
    return metadata, strata


def _build_template_metadata(rows: List[List[str]]) -> Dict:
    metadata: Dict[str, Optional[str]] = {
        "project_name": None,
        "job_code": None,
        "section_name": None,
        "chainage_km": None,
        "location": None,
        "borehole_no": None,
        "commencement_date": None,
        "completion_date": None,
        "method_of_boring": None,
        "diameter_of_hole": None,
        "standing_water_level": None,
        "termination_depth": None,
        "mean_sea_level": None,
        "permeability_tests_count": None,
        "spt_tests_count": None,
        "undisturbed_samples_count": None,
        "disturbed_samples_count": None,
        "water_samples_count": None,
    }

    label_map = {
        "project name": "project_name",
        "job code": "job_code",
        "section name": "section_name",
        "chainage": "chainage_km",
        "location": "location",
        "borehole no": "borehole_no",
        "commencement date": "commencement_date",
        "completion date": "completion_date",
        "method of boring": "method_of_boring",
        "diameter of hole": "diameter_of_hole",
        "standing water level": "standing_water_level",
        "termination depth": "termination_depth",
        "mean sea level": "mean_sea_level",
        "no. of permeabilty test": "permeability_tests_count",
        "no. of sp test": "spt_tests_count",
        "no. of undisturbed sample": "undisturbed_samples_count",
        "no. of disturbed sample": "disturbed_samples_count",
        "no. of water sample": "water_samples_count",
    }

    for row in rows:
        for idx, cell in enumerate(row):
            normalized_label = cell.lower()
            if ":" in cell:
                label, value = cell.split(":", 1)
                key = label_map.get(label.strip().lower())
                if key and not metadata.get(key):
                    metadata[key] = value.strip()
                continue

            key = label_map.get(normalized_label)
            if key and idx + 1 < len(row):
                value = row[idx + 1].strip()
                if value and not metadata.get(key):
                    metadata[key] = value

    # Final conversions
    metadata["chainage_km"] = _safe_number(metadata["chainage_km"])
    metadata["standing_water_level"] = _safe_number(metadata["standing_water_level"])
    metadata["termination_depth"] = _safe_number(metadata["termination_depth"])
    metadata["mean_sea_level"] = _safe_number(metadata["mean_sea_level"])
    for key in [
        "permeability_tests_count",
        "spt_tests_count",
        "undisturbed_samples_count",
        "disturbed_samples_count",
        "water_samples_count",
    ]:
        metadata[key] = _safe_int(metadata[key])

    metadata["location"] = metadata["location"] or ""
    return metadata


def _build_template_column_map(
    header_row: List[str], 
    main_header_row: Optional[List[str]] = None
) -> Dict[str, int]:
    """
    Build column mapping from header row(s).
    If sub_header_row is provided, use it for precise mapping (From/To/Thickness).
    Otherwise, use main_header_row for fuzzy matching.
    """
    column_map: Dict[str, int] = {}
    
    # Use sub-header row if provided (more precise), otherwise use main header
    mapping_row = header_row
    
    for idx, header in enumerate(mapping_row):
        lowered = header.lower().strip()
        
        # Description column
        if "description of soil stratum" in lowered:
            column_map["description"] = idx
        # Depth columns - check for exact "From" and "To" in sub-header
        elif lowered == "from" or (lowered.startswith("from") and "depth" not in lowered):
            column_map["depth_from"] = idx
        elif lowered == "to" or (lowered.startswith("to") and "depth" not in lowered and "total" not in lowered):
            column_map["depth_to"] = idx
        elif "depth" in lowered and "from" in lowered:
            if "depth_from" not in column_map:
                column_map["depth_from"] = idx
        elif "depth" in lowered and "to" in lowered and "total" not in lowered:
            if "depth_to" not in column_map:
                column_map["depth_to"] = idx
        # Thickness
        elif "thickness" in lowered:
            column_map["thickness"] = idx
        # Sample/Event columns
        elif "sample" in lowered and "type" in lowered:
            column_map["sample_type"] = idx
        elif "sample" in lowered and ("depth" in lowered or "(m)" in lowered):
            if "sample_depth" not in column_map:
                column_map["sample_depth"] = idx
        # Run Length
        elif "run length" in lowered:
            column_map["run_length"] = idx
        # SPT Blows - handle multiple columns
        elif "15 cm" in lowered:
            if "spt_blows_1" not in column_map:
                column_map["spt_blows_1"] = idx
            elif "spt_blows_2" not in column_map:
                column_map["spt_blows_2"] = idx
            elif "spt_blows_3" not in column_map:
                column_map["spt_blows_3"] = idx
            # Legacy single column support
            if "spt_blows" not in column_map:
                column_map["spt_blows"] = idx
        # N-Value
        elif "n - value" in lowered or "n value" in lowered or "is - 2131" in lowered:
            column_map["n_value"] = idx
        # Core Recovery
        elif "total core length" in lowered:
            column_map["total_core_length"] = idx
        elif "tcr" in lowered and "%" in lowered:
            column_map["tcr_percent"] = idx
        # RQD
        elif "rqd length" in lowered:
            column_map["rqd_length"] = idx
        elif "rqd (%)" in lowered or "rqd %" in lowered:
            column_map["rqd_percent"] = idx
        # Water data
        elif "colour of return water" in lowered or "color of return water" in lowered:
            column_map["return_water_colour"] = idx
        elif "water loss" in lowered:
            column_map["water_loss"] = idx
        # Borehole diameter
        elif "diameter" in lowered and "bore hole" in lowered:
            column_map["borehole_diameter"] = idx
        # Remarks
        elif "remarks" in lowered:
            column_map["remarks"] = idx
    
    logger.info("Column mapping built: %s", column_map)
    return column_map


def _build_template_strata(
    iterator: Iterator[List[str]],
    column_map: Dict[str, int],
) -> List[Dict]:
    """
    Build strata from template rows with RELAXED detection:
    - Row IS a stratum if: description AND (depth_from & depth_to) OR thickness
    - Do NOT require all fields to be present
    - Capture ALL available fields precisely
    """
    strata: List[Dict] = []
    current_stratum: Optional[Dict] = None

    for row in iterator:
        normalized = _normalize_row(row)
        if not _has_meaningful_data(normalized):
            continue

        if _is_template_footer(normalized):
            logger.debug("Encountered footer/end marker row: %s", normalized)
            break

        # Skip sub-header rows (rows that are just "From", "To", "Thickness", etc.)
        if _is_sub_header_row(normalized):
            logger.debug("Skipping sub-header row: %s", normalized)
            continue

        description = _value_from_row(normalized, column_map.get("description"))
        depth_from = _safe_number(
            _value_from_row(normalized, column_map.get("depth_from"))
        )
        depth_to = _safe_number(
            _value_from_row(normalized, column_map.get("depth_to"))
        )
        thickness = _safe_number(
            _value_from_row(normalized, column_map.get("thickness"))
        )

        # Attempt to parse depths from description if missing
        if description and (depth_from is None or depth_to is None):
            match = re.search(
                r"(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*m?",
                description,
                re.IGNORECASE,
            )
            if match:
                if depth_from is None:
                    depth_from = float(match.group(1))
                if depth_to is None:
                    depth_to = float(match.group(2))
                # Clean description if it contains depth range
                desc_clean = description[: match.start()].strip()
                if desc_clean:
                    description = desc_clean

        # RELAXED stratum detection: description AND (from/to OR thickness)
        has_description = bool(description and description.strip())
        has_from_to = depth_from is not None and depth_to is not None
        has_thickness = thickness is not None
        is_stratum_row = has_description and (has_from_to or has_thickness)

        if is_stratum_row:
            # Calculate missing values
            if thickness is None and has_from_to:
                thickness = _calculate_thickness(depth_from, depth_to)
            elif has_from_to is False and thickness is not None:
                # Can't calculate from/to from thickness alone, but accept the row
                depth_from = None
                depth_to = None

            current_stratum = {
                "description": description.strip(),
                "depth_from": depth_from,
                "depth_to": depth_to,
                "thickness": thickness,
                "colour_of_return_water": _safe_string(
                    _value_from_row(normalized, column_map.get("return_water_colour"))
                ),
                "water_loss": _safe_string(
                    _value_from_row(normalized, column_map.get("water_loss"))
                ),
                "diameter_of_borehole": _safe_string(
                    _value_from_row(normalized, column_map.get("borehole_diameter"))
                ),
                "remarks": _safe_string(
                    _value_from_row(normalized, column_map.get("remarks"))
                ),
                "tcr_percent": _safe_number(
                    _value_from_row(normalized, column_map.get("tcr_percent"))
                ),
                "rqd_percent": _safe_number(
                    _value_from_row(normalized, column_map.get("rqd_percent"))
                ),
                "samples": [],
            }
            strata.append(current_stratum)
            logger.debug(
                "Created stratum: %s (%.2f-%.2fm, thickness=%.2f)",
                description[:50],
                depth_from or 0,
                depth_to or 0,
                thickness or 0,
            )
            
            # Try to extract sample data from the same row
            sample = _build_sample_from_template_row(normalized, column_map)
            if sample:
                current_stratum["samples"].append(sample)
            continue

        # If we have a current stratum, this might be a sample/subdivision row
        if current_stratum:
            sample = _build_sample_from_template_row(normalized, column_map)
            if sample:
                current_stratum["samples"].append(sample)

    logger.info("Built %d strata from template", len(strata))
    return strata


def _is_sub_header_row(row: List[str]) -> bool:
    """
    Check if a row is a sub-header row (contains only "From", "To", "Thickness", etc.)
    """
    if not row:
        return False
    
    # Check if row contains only header-like labels
    header_keywords = [
        "from", "to", "thickness", "type", "depth", "sample", "event",
        "run length", "15 cm", "n - value", "total core", "tcr", "rqd",
        "colour", "water", "diameter", "remarks"
    ]
    
    row_lower = " ".join(cell.lower() for cell in row if cell)
    # If row contains only header keywords and no numeric data, it's likely a sub-header
    has_numbers = any(re.search(r"\d", cell) for cell in row if cell)
    has_header_keywords = any(keyword in row_lower for keyword in header_keywords)
    
    # Sub-header if it has header keywords but no meaningful numeric data
    return has_header_keywords and not has_numbers and len([c for c in row if c.strip()]) <= 5


def _build_sample_from_template_row(
    row: List[str],
    column_map: Dict[str, int],
) -> Optional[Dict]:
    """
    Build sample data from template row, capturing ALL available fields.
    Returns None only if row has NO sample-related data at all.
    """
    sample_type = _value_from_row(row, column_map.get("sample_type"))
    sample_depth = _safe_number(_value_from_row(row, column_map.get("sample_depth")))
    run_length = _safe_number(_value_from_row(row, column_map.get("run_length")))
    
    # Handle multiple SPT blows columns
    spt_blows_list = []
    if "spt_blows_1" in column_map:
        spt1 = _safe_number(_value_from_row(row, column_map.get("spt_blows_1")))
        spt_blows_list.append(spt1)
    if "spt_blows_2" in column_map:
        spt2 = _safe_number(_value_from_row(row, column_map.get("spt_blows_2")))
        spt_blows_list.append(spt2)
    if "spt_blows_3" in column_map:
        spt3 = _safe_number(_value_from_row(row, column_map.get("spt_blows_3")))
        spt_blows_list.append(spt3)
    
    # Fallback to single spt_blows column if multiple columns not found
    if not spt_blows_list and "spt_blows" in column_map:
        spt_value = _value_from_row(row, column_map.get("spt_blows"))
        spt_blows_list = _parse_spt_blows(spt_value)
    
    # Pad to 3 values
    while len(spt_blows_list) < 3:
        spt_blows_list.append(None)
    
    n_value = _value_from_row(row, column_map.get("n_value"))
    total_core = _safe_number(_value_from_row(row, column_map.get("total_core_length")))
    tcr = _safe_number(_value_from_row(row, column_map.get("tcr_percent")))
    rqd_length = _safe_number(_value_from_row(row, column_map.get("rqd_length")))
    rqd_percent = _safe_number(_value_from_row(row, column_map.get("rqd_percent")))
    remarks = _value_from_row(row, column_map.get("remarks"))

    # Check if there's ANY sample-related data
    has_blow_values = any(blow is not None for blow in spt_blows_list)
    has_any_data = any(
        [
            bool(sample_type and sample_type.strip() and sample_type.strip() != "-"),
            sample_depth is not None,
            run_length is not None,
            total_core is not None,
            tcr is not None,
            rqd_length is not None,
            rqd_percent is not None,
            has_blow_values,
            bool(n_value and n_value.strip() and n_value.strip() != "-"),
            bool(remarks and remarks.strip() and remarks.strip() != "-"),
        ]
    )
    
    if not has_any_data:
        return None

    return {
        "sample_event_type": _safe_string(sample_type),
        "sample_event_depth_m": sample_depth,
        "run_length_m": run_length,
        "penetration_15cm": spt_blows_list[:3],  # Ensure exactly 3 values
        "n_value": _safe_string(n_value),
        "total_core_length_cm": total_core,
        "tcr_percent": tcr,
        "rqd_length_cm": rqd_length,
        "rqd_percent": rqd_percent,
        "remarks": _safe_string(remarks),
    }


def _parse_spt_blows(value: Optional[str]) -> List[Optional[float]]:
    if not value:
        return []
    parts = re.split(r"[,\s]+", value)
    blows: List[Optional[float]] = []
    for part in parts[:3]:
        blows.append(_safe_number(part))
    while len(blows) < 3:
        blows.append(None)
    return blows


def _value_from_row(row: List[str], index: Optional[int]) -> Optional[str]:
    if index is None or index >= len(row):
        return None
    value = row[index].strip()
    return value or None


def _is_template_footer(row: List[str]) -> bool:
    joined = " ".join(row).lower()
    return any(
        marker in joined
        for marker in [
            "termination depth",
            "total depth",
            "end of log",
        ]
    )


def _safe_number(value: Optional[str]) -> Optional[float]:
    """
    Safely convert value to float, handling:
    - None/empty strings
    - "-" (dash indicating no value)
    - "#VALUE!" (Excel error)
    - "[object Object]" (object stringification)
    - Numeric 0 (valid value, not None)
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        # Numeric 0 is valid, return it
        return float(value)
    value = str(value).strip()
    if not value or value in {"-", "#VALUE!", "[object Object]", ""}:
        return None
    try:
        result = float(value)
        # Return 0 if it's actually 0 (don't treat as missing)
        return result
    except (ValueError, TypeError):
        return None


def _safe_int(value: Optional[str]) -> Optional[int]:
    number = _safe_number(value)
    if number is None:
        return None
    return int(number)


def _safe_string(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def _calculate_thickness(depth_from: float, depth_to: float) -> float:
    return round(depth_to - depth_from, 3)

