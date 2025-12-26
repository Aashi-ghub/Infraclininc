# CSV Ingestion Guide

## Overview

The CSV Ingestion Engine provides bulk CSV upload functionality with:
- Pandas CSV parsing
- Row-by-row schema validation
- Valid/invalid row separation
- Parquet conversion with versioning
- Detailed error reporting

## Key Features

✅ **No Data Loss** - All rows processed, errors reported  
✅ **No Overwrite** - Creates new versions, existing data intact  
✅ **Strong Validation** - Schema-based validation with detailed errors  
✅ **Error Reporting** - Row-level error details  
✅ **Versioning** - Each upload creates a new version

## Usage

### Basic CSV Ingestion

```python
from parquet_storage import (
    ParquetStorageEngine,
    VersionedParquetStorage,
    CSVIngestionEngine
)

# Initialize
base_storage = ParquetStorageEngine(mode="local", base_path="./data")
versioned_storage = VersionedParquetStorage(base_storage)
ingestion = CSVIngestionEngine(versioned_storage)

# Ingest CSV file
result = ingestion.ingest_csv(
    csv_file_path="data.csv",
    table_name="borelog_versions",
    project_id="project-001",
    entity_type="borelog",
    entity_id="csv-upload-001",
    user_id="user-123",
    comment="Bulk upload from CSV"
)

print(f"Valid rows: {result.valid_rows}")
print(f"Invalid rows: {result.invalid_rows}")
print(f"Errors: {len(result.errors)}")
```

### Ingest from String

```python
csv_content = """borelog_id,version_no,status,created_by_user_id
uuid-001,1,draft,user-123
uuid-002,1,draft,user-123"""

result = ingestion.ingest_csv_from_string(
    csv_content=csv_content,
    table_name="borelog_versions",
    project_id="project-001",
    entity_type="borelog",
    entity_id="csv-upload-002",
    user_id="user-123"
)
```

## Result Format

### CSVIngestionResult

```python
{
    "success": true,  # True if no errors
    "total_rows": 100,
    "valid_rows": 95,
    "invalid_rows": 5,
    "record_id": "csv-upload-001",
    "version": 2,
    "file_path": "records/project-001/borelog/csv-upload-001/versions/v2.parquet",
    "errors": [
        {
            "row": 3,
            "field": "version_no",
            "value": "invalid",
            "error": "Expected integer, got str: invalid"
        },
        ...
    ],
    "error_summary": {
        "version_no": {
            "count": 2,
            "errors": [
                {"row": 3, "error": "Expected integer..."},
                {"row": 7, "error": "Required field is missing..."}
            ]
        },
        ...
    }
}
```

## Validation Rules

### Required Fields
- Fields marked as `nullable=False` in schema must have values
- Empty strings are treated as missing

### Type Validation
- **String**: Accepts string, int, float (converted to string)
- **Integer**: Must be parseable as integer
- **Float**: Must be parseable as float
- **Boolean**: Accepts true/false, 1/0, yes/no
- **Timestamp**: Accepts datetime objects or ISO strings
- **List**: Accepts list, tuple, or JSON string

### Error Handling

**skip_errors=True (default):**
- Continues processing after errors
- Collects all errors
- Processes all valid rows

**skip_errors=False:**
- Stops on first error
- Returns partial results
- Useful for strict validation

## Versioning Behavior

### New Record
- Creates version 1
- All valid rows stored

### Existing Record
- Creates new version (v2, v3, ...)
- Existing approved data remains intact
- New version contains CSV data

## Example: Complete Workflow

```python
from parquet_storage import (
    ParquetStorageEngine,
    VersionedParquetStorage,
    CSVIngestionEngine
)

# Initialize
base_storage = ParquetStorageEngine(mode="local", base_path="./data")
versioned_storage = VersionedParquetStorage(base_storage)
ingestion = CSVIngestionEngine(versioned_storage)

# CSV content
csv_content = """borelog_id,version_no,status,created_by_user_id,number,msl
uuid-001,1,draft,user-123,BH-001,100.5
uuid-002,1,draft,user-123,BH-002,101.0
uuid-003,invalid,draft,user-123,BH-003,102.0
uuid-004,1,draft,user-123,BH-004,103.0"""

# Ingest
result = ingestion.ingest_csv_from_string(
    csv_content=csv_content,
    table_name="borelog_versions",
    project_id="project-001",
    entity_type="borelog",
    entity_id="bulk-upload-001",
    user_id="user-123",
    skip_errors=True
)

# Check results
if result.valid_rows > 0:
    print(f"✅ Successfully ingested {result.valid_rows} rows")
    print(f"   Version: {result.version}")
    print(f"   File: {result.file_path}")

if result.invalid_rows > 0:
    print(f"\n⚠️  {result.invalid_rows} rows had errors:")
    for error in result.errors:
        print(f"   Row {error.row_index + 1}: {error.field} - {error.error}")

# Get error summary
error_summary = result.to_dict()["error_summary"]
for field, details in error_summary.items():
    print(f"\n   Field '{field}': {details['count']} errors")
```

## Error Types

### Missing Required Field
```
Row 5, Field 'version_no': Required field is missing or null
```

### Type Mismatch
```
Row 3, Field 'version_no': Expected integer, got str: invalid
Row 7, Field 'hole_diameter': Expected float, got str: invalid
```

### Invalid Format
```
Row 2, Field 'created_at': Expected timestamp, got str: invalid-date
```

## Best Practices

1. **Validate CSV before upload**
   ```python
   # Check CSV structure first
   df = pd.read_csv("data.csv")
   print(f"Columns: {df.columns.tolist()}")
   print(f"Rows: {len(df)}")
   ```

2. **Handle errors gracefully**
   ```python
   result = ingestion.ingest_csv(...)
   if result.invalid_rows > 0:
       # Log errors
       # Notify user
       # Optionally retry with corrected CSV
   ```

3. **Use skip_errors=True for bulk uploads**
   - Processes all valid rows
   - Reports all errors
   - Maximizes data ingestion

4. **Review error summary**
   ```python
   error_summary = result.to_dict()["error_summary"]
   # Identify common errors
   # Fix CSV and retry
   ```

5. **Check version after upload**
   ```python
   metadata = versioned_storage.get_metadata(entity_id)
   print(f"Current version: {metadata['current_version']}")
   ```

## Integration with Lambda Handler

Add CSV ingestion action to Lambda handler:

```python
# In lambda_handler.py
def _handle_ingest_csv(self, request: Dict[str, Any]) -> Dict[str, Any]:
    csv_content = request.get("csv_content")
    table_name = request.get("table_name")
    project_id = request.get("project_id")
    entity_type = request.get("entity_type")
    entity_id = request.get("entity_id")
    user = request.get("user")
    
    ingestion = CSVIngestionEngine(self.repository.storage)
    result = ingestion.ingest_csv_from_string(
        csv_content=csv_content,
        table_name=table_name,
        project_id=project_id,
        entity_type=entity_type,
        entity_id=entity_id,
        user_id=user
    )
    
    return self._create_response(200, {
        "success": result.invalid_rows == 0,
        "data": result.to_dict()
    })
```

## Constraints

✅ **No data loss** - All rows processed  
✅ **No overwrite** - Creates new versions  
✅ **Existing data intact** - Approved data remains unchanged  
✅ **Strong validation** - Schema-based validation  
✅ **Detailed errors** - Row-level error reporting

## Performance Considerations

- **Large files**: Process in chunks if needed
- **Memory**: Large CSVs loaded into memory (consider streaming for very large files)
- **Validation**: Row-by-row validation adds overhead
- **Parquet write**: Efficient columnar format

## Troubleshooting

### Common Errors

**"No schema found for table"**
- Check table name spelling
- Ensure schema is registered

**"Failed to read CSV file"**
- Check file path
- Verify CSV format
- Check file permissions

**"Required field is missing"**
- Check CSV headers match schema
- Ensure required fields have values

**"Expected integer, got str"**
- Clean CSV data
- Convert types before upload
- Use proper CSV formatting

## Example CSV Format

### Borelog Versions

```csv
borelog_id,version_no,status,created_by_user_id,number,msl,boring_method,hole_diameter
uuid-001,1,draft,user-123,BH-001,100.5,Rotary Drilling,150.0
uuid-002,1,draft,user-123,BH-002,101.0,Rotary Drilling,150.0
uuid-003,1,draft,user-123,BH-003,99.5,Rotary Drilling,150.0
```

### Geological Log

```csv
borelog_id,project_name,client_name,borehole_number,msl,method_of_boring
uuid-001,Project Alpha,Client XYZ,BH-001,100.5,Rotary Drilling
uuid-002,Project Alpha,Client XYZ,BH-002,101.0,Rotary Drilling
```

## Status

✅ **Complete** - Ready for use

All features implemented, tested, and documented.

