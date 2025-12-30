"""
AWS Lambda entrypoint for the borelog parser.

This function is triggered asynchronously from the Node.js upload
handler. It downloads the raw CSV/XLSX from S3, parses it into a
hierarchical structure, and persists the parsed output plus a light
index back to S3.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List

import boto3
from botocore.exceptions import ClientError

from . import parser

logger = logging.getLogger()
logger.setLevel(os.getenv("LOG_LEVEL", "INFO"))

s3 = boto3.client("s3")
DEFAULT_BUCKET = os.getenv("S3_BUCKET_NAME") or ""


def handler(event: Dict[str, Any], _context) -> Dict[str, Any]:
    """
    Lambda entrypoint.
    """
    logger.info("Borelog parser invoked with event: %s", _redact_event(event))

    records = event.get("Records")
    if records:
        processed = 0
        for record in records:
            _process_sqs_record(record)
            processed += 1
        return {"status": "OK", "processed": processed}

    result = _process_payload(event)
    return {"status": "OK", "processed": 1, **result}


def _process_sqs_record(record: Dict[str, Any]) -> Dict[str, Any]:
    body = record.get("body")
    if not body:
        raise ValueError("SQS record missing body")
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        logger.error("Failed to decode SQS body: %s", body)
        raise exc
    return _process_payload(payload)


def _process_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    bucket = payload.get("bucket") or DEFAULT_BUCKET
    if not bucket:
        raise ValueError("Bucket is required to process borelog payload")

    key = payload.get("csvKey") or payload.get("key")
    if not key:
        raise ValueError("CSV key is required to process borelog payload")

    project_id = payload.get("project_id")
    borelog_id = payload.get("borelog_id")
    upload_id = payload.get("upload_id")
    if not all([project_id, borelog_id, upload_id]):
        raise ValueError(
            "project_id, borelog_id, and upload_id are required in payload"
        )

    try:
        version_no = int(payload.get("version_no") or 1)
    except (TypeError, ValueError):
        version_no = 1

    file_type = (payload.get("fileType") or payload.get("file_type") or "csv").lower()

    base_prefix = (
        f"projects/{project_id}/borelogs/{borelog_id}/parsed/v{version_no}"
    )
    strata_key = f"{base_prefix}/strata.json"
    index_key = f"{base_prefix}/index.json"

    if _s3_object_exists(bucket, strata_key):
        logger.info(
            "Parsed output already exists. Skipping.",
            extra={"borelog_id": borelog_id, "version": version_no},
        )
        return {
            "status": "SKIPPED",
            "strata_key": strata_key,
            "index_key": index_key,
        }

    body_stream = _download_object(bucket, key)
    if file_type in {"xlsx", "xls"}:
        rows = parser.iter_xlsx_rows(body_stream)
    else:
        rows = parser.iter_csv_rows(body_stream)

    metadata, strata = parser.parse_borelog_document(rows)
    logger.info("Parsed %s strata from %s", len(strata), key)

    borehole = {
        "project_id": project_id,
        "structure_id": payload.get("structure_id"),
        "substructure_id": payload.get("substructure_id"),
        "borelog_id": borelog_id,
        "version_no": version_no,
        "upload_id": upload_id,
        "file_type": file_type,
        "requested_by": payload.get("requestedBy") or payload.get("requested_by"),
        "job_code": metadata.get("job_code"),
        "metadata": metadata,
        "parsed_at": datetime.now(timezone.utc).isoformat(),
    }

    payload_body = {"borehole": borehole, "strata": strata}
    _put_json(bucket, strata_key, payload_body)

    depth_index = _build_depth_index(strata)
    _put_json(bucket, index_key, depth_index)

    logger.info(
        "Stored parsed output at %s and index at %s", strata_key, index_key
    )

    return {
        "status": "PARSED",
        "strata_count": len(strata),
        "strata_key": strata_key,
        "index_key": index_key,
    }


def _download_object(bucket: str, key: str):
    try:
        response = s3.get_object(Bucket=bucket, Key=key)
        return response["Body"]
    except ClientError as exc:  # pragma: no cover - AWS integration
        logger.error("Failed to download %s/%s: %s", bucket, key, exc)
        raise


def _put_json(bucket: str, key: str, data: Any) -> None:
    try:
        body = json.dumps(data, separators=(",", ":"), default=str).encode("utf-8")
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=body,
            ContentType="application/json",
        )
    except ClientError as exc:  # pragma: no cover - AWS integration
        logger.error("Failed to write %s/%s: %s", bucket, key, exc)
        raise


def _build_depth_index(strata: List[Dict[str, Any]]) -> Dict[str, int]:
    index: Dict[str, int] = {}
    for idx, stratum in enumerate(strata):
        depth_from = stratum.get("depth_from")
        depth_to = stratum.get("depth_to")
        if depth_from is None or depth_to is None:
            continue
        range_key = f"{depth_from:.3f}-{depth_to:.3f}"
        index[range_key] = idx
    return index


def _s3_object_exists(bucket: str, key: str) -> bool:
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code")
        if error_code in ("404", "NoSuchKey"):
            return False
        raise


def _redact_event(event: Dict[str, Any]) -> Dict[str, Any]:
    if "Records" in event:
        return {"recordCount": len(event.get("Records", []))}
    redacted = dict(event)
    if "csv_data" in redacted:
        redacted["csv_data"] = "***"
    return redacted

