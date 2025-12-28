# Quick Start Guide

## Installation

```bash
cd backendbore/parquet_storage
pip install -r requirements.txt
```

## Basic Usage

### 1. Local Mode (Testing)

```python
from parquet_storage import ParquetStorageEngine, get_schema
import pandas as pd

# Initialize
storage = ParquetStorageEngine(mode="local", base_path="./data")

# Create data
df = pd.DataFrame({
    "borelog_id": ["uuid-1"],
    "version_no": [1],
    "status": ["draft"],
    "created_at": [pd.Timestamp.now()],
})

# Get schema and write
schema = get_schema("borelog_versions")
path = storage.write_parquet("boreholes/borelog_versions", df, schema)

# Read back
df_read = storage.read_parquet(path)
```

### 2. S3 Mode (Production)

```python
storage = ParquetStorageEngine(
    mode="s3",
    bucket_name="my-bucket",
    base_path="parquet-data",
    aws_region="us-east-1"
)
```

## Key Features

- ✅ **Immutable writes** - Files never overwritten (unique timestamps)
- ✅ **Schema validation** - Validates before writing
- ✅ **Dual mode** - S3 or local filesystem

## Available Functions

- `write_parquet(path, dataframe, expected_schema=None)` - Write Parquet file
- `read_parquet(path)` - Read Parquet file
- `validate_schema(dataframe, expected_schema)` - Validate schema
- `get_schema(table_name)` - Get schema for table

## Run Examples

```bash
python example_usage.py
```













