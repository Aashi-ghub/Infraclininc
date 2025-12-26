# Parquet Storage Engine - Implementation Summary

## Overview

A pure Python data storage layer for exporting PostgreSQL data to Parquet format on S3 or local filesystem. This module provides immutable writes, schema validation, and clean separation from the Node.js API layer.

## Module Structure

```
parquet_storage/
├── __init__.py              # Module exports
├── storage_engine.py        # Core storage engine (S3 + local modes)
├── schemas.py                # PyArrow schema definitions (29 tables)
├── requirements.txt         # Python dependencies
├── README.md                 # Full documentation
├── QUICK_START.md           # Quick reference guide
├── example_usage.py         # Usage examples
└── IMPLEMENTATION_SUMMARY.md # This file
```

## Key Components

### 1. Storage Engine (`storage_engine.py`)

**Class:** `ParquetStorageEngine`

**Features:**
- ✅ Dual mode: S3 (production) and local filesystem (testing)
- ✅ Immutable writes: Automatic unique filename generation (timestamp + UUID)
- ✅ Schema validation: Validates DataFrame before writing
- ✅ Partitioned writes: Support for partitioned Parquet files
- ✅ Error handling: Comprehensive error handling and logging

**Key Methods:**
- `write_parquet(path, dataframe, expected_schema=None, partition_cols=None, overwrite=False)`
- `read_parquet(path, filters=None)`
- `validate_schema(dataframe, expected_schema)` (static)

### 2. Schema Registry (`schemas.py`)

**Features:**
- ✅ 29 table schemas defined (matching PostgreSQL schema)
- ✅ Automatic schema registration
- ✅ Type mapping: UUID → string, TIMESTAMP → timestamp_ms, JSONB → string
- ✅ Geography types: GEOGRAPHY(POINT) → latitude/longitude columns

**Available Schemas:**
- Core: customers, organisations, users, contacts
- Projects: projects, structure, sub_structures, etc.
- Boreholes: borehole, boreloge, borelog_details, borelog_versions, etc.
- Stratum: stratum_layers, stratum_sample_points
- Lab Reports: unified_lab_reports, lab_report_versions, soil_test_samples, etc.
- Workflow: pending_csv_uploads, substructure_assignments

## Usage Examples

### Basic Write (Local Mode)

```python
from parquet_storage import ParquetStorageEngine, get_schema
import pandas as pd

storage = ParquetStorageEngine(mode="local", base_path="./data")
df = pd.DataFrame({...})
schema = get_schema("borelog_versions")
path = storage.write_parquet("boreholes/borelog_versions", df, schema)
```

### Basic Write (S3 Mode)

```python
storage = ParquetStorageEngine(
    mode="s3",
    bucket_name="my-bucket",
    base_path="parquet-data",
    aws_region="us-east-1"
)
path = storage.write_parquet("boreholes/borelog_versions", df, schema)
```

### Read Parquet

```python
df = storage.read_parquet(path)
```

## Design Decisions

### 1. Immutable Writes
- **Why:** Prevents accidental data loss
- **How:** Automatic unique filename generation with timestamp + UUID
- **Override:** Use `overwrite=True` parameter (not recommended)

### 2. Schema Validation
- **Why:** Ensures data consistency and type safety
- **How:** PyArrow schema validation before write
- **When:** Optional but recommended for production

### 3. Dual Mode Support
- **Why:** Testing locally without S3, production on S3
- **How:** Mode parameter in constructor
- **Benefit:** Same code works in both environments

### 4. JSONB as String
- **Why:** Parquet doesn't natively support JSONB
- **How:** Convert JSONB columns to string before writing
- **Note:** Can be parsed back to JSON when reading

### 5. Geography Types
- **Why:** Parquet doesn't support PostgreSQL GEOGRAPHY
- **How:** Split GEOGRAPHY(POINT) into latitude/longitude columns
- **Benefit:** Standard numeric types, easy to query

## File Naming Convention

Files are automatically named to prevent overwrites:

```
{filename}_{YYYYMMDD}_{HHMMSS}_{uuid8}.parquet
```

Example:
```
borelog_versions_20240127_143022_a1b2c3d4.parquet
```

## Integration with Node.js

This Python module is designed to be called from Node.js:

### Option 1: Child Process
```javascript
const { exec } = require('child_process');
exec('python export_script.py', callback);
```

### Option 2: Microservice
Run as separate HTTP/gRPC service, call from Node.js

### Option 3: AWS Lambda
Deploy as Lambda function, invoke from Node.js

## Constraints (As Requested)

- ✅ **No versioning logic** - Pure write/read operations
- ✅ **No approval workflows** - Just data storage
- ✅ **No authentication** - Pure data layer
- ✅ **No API endpoints** - Library only, not a service

## Testing

Run example script:
```bash
cd backendbore/parquet_storage
python example_usage.py
```

## Dependencies

- `pandas>=2.0.0` - DataFrame operations
- `pyarrow>=12.0.0` - Parquet read/write
- `boto3>=1.28.0` - S3 support (optional, only for S3 mode)

## Next Steps (Future Enhancements)

1. **Versioning** - Track Parquet file versions
2. **Incremental exports** - Only export changed rows
3. **Compression options** - Configurable compression (snappy, gzip, etc.)
4. **Partitioned S3 reads** - Full support for reading partitioned Parquet from S3
5. **Batch operations** - Write multiple tables in one transaction

## Status

✅ **Complete and Ready for Use**

- Core functionality implemented
- Schema definitions complete (29 tables)
- Documentation complete
- Examples provided
- No linting errors

## Support

For questions or issues, refer to:
- `README.md` - Full documentation
- `QUICK_START.md` - Quick reference
- `example_usage.py` - Code examples




