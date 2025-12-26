# Parquet Storage Engine

A pure Python data layer for storing infrastructure logging data (borelogs, geological logs, lab tests) in Parquet format on S3 or local filesystem.

## Features

- ✅ **Immutable writes** - No overwrite by default (prevents data loss)
- ✅ **Schema validation** - Validates data before writing
- ✅ **Dual mode support** - S3 (production) and local filesystem (testing)
- ✅ **Partitioned writes** - Support for partitioned Parquet files
- ✅ **Versioning support** - Track multiple versions of records
- ✅ **Approval metadata** - Track approval status and history
- ✅ **Clean separation** - Pure data layer, no API dependencies

## Installation

```bash
pip install -r requirements.txt
```

## Quick Start

### Basic Storage (Non-Versioned)

```python
from parquet_storage import ParquetStorageEngine, get_schema
import pandas as pd

# Initialize storage engine (local mode)
storage = ParquetStorageEngine(
    mode="local",
    base_path="./parquet-data"
)

# Create sample data
df = pd.DataFrame({
    "borelog_id": ["uuid-1", "uuid-2"],
    "version_no": [1, 2],
    "status": ["draft", "approved"],
    "created_at": pd.Timestamp.now()
})

# Get schema for validation
schema = get_schema("borelog_versions")

# Write Parquet file (immutable - generates unique filename)
file_path = storage.write_parquet(
    path="boreholes/borelog_versions",
    dataframe=df,
    expected_schema=schema
)

print(f"Written to: {file_path}")

# Read Parquet file
df_read = storage.read_parquet(file_path)
print(df_read)
```

### Versioned Storage with Approval

```python
from parquet_storage import (
    ParquetStorageEngine,
    VersionedParquetStorage,
    RecordStatus
)
import pandas as pd

# Initialize base storage
base_storage = ParquetStorageEngine(mode="local", base_path="./data")

# Initialize versioned storage
versioned_storage = VersionedParquetStorage(base_storage)

# Create record (v1)
df = pd.DataFrame({...})
metadata = versioned_storage.create_record(
    record_id="borelog-001",
    dataframe=df,
    table_name="borelog_versions",
    created_by="user-123"
)

# Update record (v2)
df_v2 = pd.DataFrame({...})
metadata = versioned_storage.update_record(
    record_id="borelog-001",
    dataframe=df_v2,
    updated_by="user-123"
)

# Approve record (metadata only)
metadata = versioned_storage.approve_record(
    record_id="borelog-001",
    approved_by="approver-456"
)

# Read latest version
df_latest = versioned_storage.get_latest_version("borelog-001")
```

### S3 Mode (Production)

```python
from parquet_storage import ParquetStorageEngine, get_schema
import pandas as pd

# Initialize storage engine (S3 mode)
storage = ParquetStorageEngine(
    mode="s3",
    bucket_name="my-parquet-bucket",
    base_path="parquet-data",
    aws_region="us-east-1"
    # AWS credentials from environment variables or IAM role
)

# Write to S3
schema = get_schema("borelog_versions")
file_path = storage.write_parquet(
    path="boreholes/borelog_versions",
    dataframe=df,
    expected_schema=schema
)

# Read from S3
df_read = storage.read_parquet(file_path)
```

## Repository Interface

For DB-like methods organized by project, see [REPOSITORY_GUIDE.md](REPOSITORY_GUIDE.md).

**Quick example:**
```python
from parquet_storage import (
    ParquetStorageEngine,
    VersionedParquetStorage,
    ParquetRepository,
    EntityType
)

base_storage = ParquetStorageEngine(mode="local", base_path="./data")
versioned_storage = VersionedParquetStorage(base_storage)
repo = ParquetRepository(versioned_storage)

# Create entity
result = repo.create(
    EntityType.BORELOG,
    "project-001",
    "borelog-001",
    payload,
    "user-123"
)

# List by project
entities = repo.list_by_project(EntityType.BORELOG, "project-001")

# Approve
repo.approve(EntityType.BORELOG, "project-001", "borelog-001", "approver-456")
```

## Versioning and Approval

For versioned storage with approval metadata, see [VERSIONING_GUIDE.md](VERSIONING_GUIDE.md).

**Key concepts:**
- Each record can have multiple versions (v1, v2, v3...)
- Parquet files are immutable (never overwritten)
- Approval status stored in `metadata.json`
- Complete history tracked in metadata

**Quick example:**
```python
versioned_storage = VersionedParquetStorage(base_storage)

# Create v1
versioned_storage.create_record(record_id, df, table_name, user_id)

# Update to v2
versioned_storage.update_record(record_id, df_v2, user_id)

# Approve v2
versioned_storage.approve_record(record_id, approver_id)
```

## API Reference

### `ParquetStorageEngine`

#### Constructor

```python
ParquetStorageEngine(
    mode: str = "local",  # "s3" or "local"
    bucket_name: Optional[str] = None,  # Required for S3 mode
    base_path: str = "parquet-data",  # Base path/prefix
    aws_region: str = "us-east-1",
    aws_access_key_id: Optional[str] = None,
    aws_secret_access_key: Optional[str] = None,
)
```

#### Methods

##### `write_parquet(path, dataframe, expected_schema=None, partition_cols=None, overwrite=False)`

Write a pandas DataFrame to Parquet format.

**Parameters:**
- `path` (str): Target path (relative to base_path)
- `dataframe` (pd.DataFrame): Data to write
- `expected_schema` (pa.Schema, optional): PyArrow schema for validation
- `partition_cols` (list, optional): Column names for partitioning
- `overwrite` (bool): Allow overwrite (default: False)

**Returns:**
- Full path to written Parquet file(s)

**Raises:**
- `ValueError`: Schema validation fails
- `FileExistsError`: File exists and overwrite=False
- `IOError`: Write operation fails

##### `read_parquet(path, filters=None)`

Read a Parquet file or directory.

**Parameters:**
- `path` (str): Path to Parquet file (relative to base_path)
- `filters` (list, optional): PyArrow filter expressions

**Returns:**
- pandas DataFrame

**Raises:**
- `FileNotFoundError`: File does not exist
- `IOError`: Read operation fails

##### `validate_schema(dataframe, expected_schema)` (static)

Validate DataFrame against PyArrow schema.

**Parameters:**
- `dataframe` (pd.DataFrame): DataFrame to validate
- `expected_schema` (pa.Schema): Expected schema

**Raises:**
- `ValueError`: Schema validation fails

## Schema Management

### Available Schemas

All database tables have corresponding Parquet schemas:

- Core: `customers`, `organisations`, `users`, `contacts`
- Projects: `projects`, `structure`, `sub_structures`, etc.
- Boreholes: `borehole`, `boreloge`, `borelog_details`, `borelog_versions`, etc.
- Stratum: `stratum_layers`, `stratum_sample_points`
- Lab Reports: `unified_lab_reports`, `lab_report_versions`, `soil_test_samples`, etc.
- Workflow: `pending_csv_uploads`, `substructure_assignments`

### Get Schema

```python
from parquet_storage import get_schema

schema = get_schema("borelog_versions")
```

### List Available Schemas

```python
from parquet_storage import SchemaRegistry

tables = SchemaRegistry.list_tables()
print(tables)
```

### `VersionedParquetStorage`

Extended storage engine with versioning and approval support.

**Key Methods:**
- `create_record(record_id, dataframe, table_name, created_by, ...)` - Create v1
- `update_record(record_id, dataframe, updated_by, ...)` - Create new version
- `approve_record(record_id, approved_by, ...)` - Approve current version
- `reject_record(record_id, rejected_by, ...)` - Reject current version
- `get_latest_version(record_id)` - Get current version DataFrame
- `get_specific_version(record_id, version)` - Get specific version DataFrame
- `get_metadata(record_id)` - Get metadata with history
- `get_all_versions(record_id)` - List all version numbers

See [VERSIONING_GUIDE.md](VERSIONING_GUIDE.md) for complete documentation.

## Examples

### Example 1: Write Append-Only Data (Borelog Versions)

```python
from parquet_storage import ParquetStorageEngine, get_schema
import pandas as pd
from datetime import datetime

storage = ParquetStorageEngine(mode="local", base_path="./data")

# New borelog version data
new_versions = pd.DataFrame({
    "borelog_id": ["uuid-1", "uuid-2"],
    "version_no": [1, 1],
    "status": ["submitted", "approved"],
    "created_at": [datetime.now(), datetime.now()],
    # ... other fields
})

schema = get_schema("borelog_versions")
path = storage.write_parquet(
    path="boreholes/borelog_versions",
    dataframe=new_versions,
    expected_schema=schema
)
```

### Example 2: Partitioned Write

```python
# Write partitioned by project_id
storage.write_parquet(
    path="boreholes/borehole",
    dataframe=df,
    partition_cols=["project_id"]
)
```

### Example 3: Read with Filters

```python
# Read with predicate pushdown
filters = [
    ("status", "=", "approved"),
    ("created_at", ">", datetime(2024, 1, 1))
]

df = storage.read_parquet("boreholes/borelog_versions", filters=filters)
```

## File Naming Convention

Files are automatically named with timestamp and UUID to prevent overwrites:

```
{filename}_{YYYYMMDD}_{HHMMSS}_{uuid8}.parquet
```

Example:
```
borelog_versions_20240127_143022_a1b2c3d4.parquet
```

## Error Handling

```python
from parquet_storage import ParquetStorageEngine

storage = ParquetStorageEngine(mode="local")

try:
    storage.write_parquet("test", df)
except FileExistsError as e:
    print(f"File already exists: {e}")
except ValueError as e:
    print(f"Schema validation failed: {e}")
except IOError as e:
    print(f"Write failed: {e}")
```

## Architecture

```
parquet_storage/
├── __init__.py          # Module exports
├── storage_engine.py    # Core storage engine
├── schemas.py           # Schema definitions
├── requirements.txt     # Dependencies
└── README.md           # This file
```

## Constraints

- ✅ No versioning logic (yet)
- ✅ No approval workflows (yet)
- ✅ No authentication/authorization
- ✅ Pure data layer - no API endpoints

## Integration with Node.js

This Python module is designed to be called from Node.js via:

1. **Child process** - Execute Python scripts from Node.js
2. **gRPC/HTTP service** - Run as separate microservice
3. **Lambda function** - AWS Lambda with Python runtime

Example Node.js integration:

```javascript
const { exec } = require('child_process');

exec('python export_to_parquet.py', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  console.log(stdout);
});
```

## Testing

```python
# Test local mode
storage = ParquetStorageEngine(mode="local", base_path="./test-data")
df = pd.DataFrame({"id": [1, 2], "name": ["a", "b"]})
path = storage.write_parquet("test", df)
df_read = storage.read_parquet(path)
assert df.equals(df_read)
```

## License

Internal use only.

