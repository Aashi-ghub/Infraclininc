# Versioning and Approval Guide

## Overview

The Versioned Parquet Storage extends the base storage engine with versioning and approval metadata. It implements an immutable, append-only system where:

- **Parquet files are never overwritten** - Each version creates a new file
- **Metadata tracks approval status** - Stored separately in `metadata.json`
- **History is append-only** - All changes are recorded, never deleted

## File Structure

```
records/
  {record_id}/
    versions/
      v1.parquet          # Version 1 data (immutable)
      v2.parquet          # Version 2 data (immutable)
      v3.parquet          # Version 3 data (immutable)
    metadata.json         # Version and approval metadata
```

## Metadata Structure

```json
{
  "record_id": "borelog-001",
  "table_name": "borelog_versions",
  "current_version": 3,
  "status": "approved",
  "created_by": "user-123",
  "created_at": "2024-01-27T10:00:00Z",
  "approved_by": "approver-456",
  "approved_at": "2024-01-27T11:00:00Z",
  "rejected_by": null,
  "rejected_at": null,
  "history": [
    {
      "version": 1,
      "status": "draft",
      "created_by": "user-123",
      "created_at": "2024-01-27T10:00:00Z",
      "comment": "Initial creation"
    },
    {
      "version": 2,
      "status": "draft",
      "created_by": "user-123",
      "created_at": "2024-01-27T10:30:00Z",
      "comment": "Updated status to submitted"
    },
    {
      "version": 3,
      "status": "approved",
      "created_by": "approver-456",
      "created_at": "2024-01-27T11:00:00Z",
      "comment": "Approved for production"
    }
  ]
}
```

## Lifecycle

### 1. Create Record (`create_record()`)

Creates the first version (v1) of a record.

**What happens:**
- Creates `versions/v1.parquet` with the data
- Creates `metadata.json` with initial metadata
- Sets status to `draft`
- Adds first history entry

**Example:**
```python
metadata = versioned_storage.create_record(
    record_id="borelog-001",
    dataframe=df,
    table_name="borelog_versions",
    created_by="user-123",
    comment="Initial creation"
)
```

**Result:**
- ✅ `versions/v1.parquet` created
- ✅ `metadata.json` created
- ✅ Status: `draft`
- ✅ Current version: `1`

### 2. Update Record (`update_record()`)

Creates a new version (v2, v3, ...) of an existing record.

**What happens:**
- Creates new `versions/vN.parquet` file (never overwrites old versions)
- Updates `metadata.json` with new current_version
- Resets status to `draft` (new version needs approval)
- Adds history entry

**Example:**
```python
metadata = versioned_storage.update_record(
    record_id="borelog-001",
    dataframe=df_v2,
    updated_by="user-123",
    comment="Updated status to submitted"
)
```

**Result:**
- ✅ `versions/v2.parquet` created (v1 still exists)
- ✅ `metadata.json` updated
- ✅ Status: `draft` (was `approved`, now reset)
- ✅ Current version: `2`

**Important:** Updating an approved record creates a new draft version. The old approved version remains immutable.

### 3. Approve Record (`approve_record()`)

Approves the current version (updates metadata only, no Parquet changes).

**What happens:**
- Updates `metadata.json` status to `approved`
- Sets `approved_by` and `approved_at`
- Adds history entry
- **No Parquet files are modified**

**Example:**
```python
metadata = versioned_storage.approve_record(
    record_id="borelog-001",
    approved_by="approver-456",
    comment="All checks passed"
)
```

**Result:**
- ✅ `metadata.json` updated
- ✅ Status: `approved`
- ✅ Approved by: `approver-456`
- ✅ Parquet files unchanged (immutable)

**Rules:**
- Can only approve `draft` records
- Cannot approve `rejected` records (must update first)
- Cannot approve already `approved` records

### 4. Reject Record (`reject_record()`)

Rejects the current version (updates metadata only, no Parquet changes).

**What happens:**
- Updates `metadata.json` status to `rejected`
- Sets `rejected_by` and `rejected_at`
- Adds history entry
- **No Parquet files are modified**

**Example:**
```python
metadata = versioned_storage.reject_record(
    record_id="borelog-001",
    rejected_by="approver-456",
    comment="Data quality issues found"
)
```

**Result:**
- ✅ `metadata.json` updated
- ✅ Status: `rejected`
- ✅ Rejected by: `approver-456`
- ✅ Parquet files unchanged (immutable)

**Rules:**
- Can only reject `draft` records
- Cannot reject `approved` records (must update first)
- Cannot reject already `rejected` records

## Reading Versions

### Get Latest Version

```python
df = versioned_storage.get_latest_version("borelog-001")
```

Returns the DataFrame for the current version (from `metadata.json`).

### Get Specific Version

```python
df_v1 = versioned_storage.get_specific_version("borelog-001", version=1)
df_v2 = versioned_storage.get_specific_version("borelog-001", version=2)
```

Returns the DataFrame for a specific version number.

### Get All Versions

```python
versions = versioned_storage.get_all_versions("borelog-001")
# Returns: [1, 2, 3]
```

Returns list of all available version numbers.

### Get Metadata

```python
metadata = versioned_storage.get_metadata("borelog-001")
```

Returns the complete metadata dictionary including history.

## Status Transitions

```
┌─────────┐
│  draft  │ ← create_record()
└────┬────┘
     │
     ├─→ update_record() ─→ ┌─────────┐
     │                       │  draft  │ (new version)
     │                       └────┬────┘
     │                            │
     ├─→ approve_record() ──→ ┌──────────┐
     │                        │ approved │
     └─→ reject_record() ──→ └──────────┘
                              │ rejected │
                              └──────────┘
```

**Key Rules:**
1. `create_record()` → Always creates `draft`
2. `update_record()` → Always creates new `draft` version
3. `approve_record()` → Only works on `draft` → `approved`
4. `reject_record()` → Only works on `draft` → `rejected`
5. Approved/rejected records must be updated to create new draft

## Immutability Guarantees

### Parquet Files
- ✅ Never overwritten
- ✅ Each version stored separately
- ✅ Can read any historical version
- ✅ Deletion not supported (data integrity)

### Metadata
- ✅ History is append-only
- ✅ Old history entries never deleted
- ✅ Status changes tracked in history
- ✅ Timestamps preserved

## Example: Complete Workflow

```python
from parquet_storage import (
    ParquetStorageEngine,
    VersionedParquetStorage,
    get_schema
)
import pandas as pd

# Initialize
base_storage = ParquetStorageEngine(mode="local", base_path="./data")
versioned_storage = VersionedParquetStorage(base_storage)

record_id = "borelog-001"

# 1. Create v1 (draft)
df_v1 = pd.DataFrame({...})
metadata = versioned_storage.create_record(
    record_id=record_id,
    dataframe=df_v1,
    table_name="borelog_versions",
    created_by="user-123"
)
# Status: draft, Version: 1

# 2. Update to v2 (draft)
df_v2 = pd.DataFrame({...})
metadata = versioned_storage.update_record(
    record_id=record_id,
    dataframe=df_v2,
    updated_by="user-123"
)
# Status: draft, Version: 2

# 3. Approve v2
metadata = versioned_storage.approve_record(
    record_id=record_id,
    approved_by="approver-456"
)
# Status: approved, Version: 2

# 4. Update to v3 (creates new draft)
df_v3 = pd.DataFrame({...})
metadata = versioned_storage.update_record(
    record_id=record_id,
    dataframe=df_v3,
    updated_by="user-123"
)
# Status: draft, Version: 3
# Note: v2 is still approved, v3 is new draft

# 5. Read versions
df_v1 = versioned_storage.get_specific_version(record_id, 1)  # v1
df_v2 = versioned_storage.get_specific_version(record_id, 2)  # v2 (approved)
df_v3 = versioned_storage.get_latest_version(record_id)        # v3 (current)
```

## Best Practices

1. **Always validate before creating/updating**
   ```python
   schema = get_schema("borelog_versions")
   # Schema validation happens automatically
   ```

2. **Use descriptive comments**
   ```python
   versioned_storage.create_record(
       ...,
       comment="Initial creation from CSV upload"
   )
   ```

3. **Check status before operations**
   ```python
   metadata = versioned_storage.get_metadata(record_id)
   if metadata["status"] == "approved":
       # Handle approved record
   ```

4. **Preserve history**
   - Never delete history entries
   - Always add comments for important changes
   - Use history to track changes over time

5. **Handle errors gracefully**
   ```python
   try:
       versioned_storage.approve_record(record_id, approver)
   except ValueError as e:
       # Handle: already approved, rejected, etc.
   ```

## Integration Notes

- **No API endpoints** - Pure data layer
- **No role logic** - Approval/rejection by user ID only
- **No Node.js code** - Python only
- **S3 compatible** - Works with S3 or local filesystem
- **Schema validation** - Uses existing schema registry

## Error Handling

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| `Record already exists` | Trying to create existing record | Use `update_record()` instead |
| `Record does not exist` | Reading non-existent record | Check `get_metadata()` first |
| `Already approved` | Approving approved record | Update first, then approve |
| `Already rejected` | Rejecting rejected record | Update first, then reject |
| `Cannot approve rejected` | Approving rejected record | Update first, then approve |

## Performance Considerations

- **Metadata reads**: Fast (small JSON files)
- **Parquet reads**: Efficient (columnar format)
- **Version history**: Grows over time, but append-only is fast
- **S3 mode**: Uses boto3 with retries and connection pooling

## Security Notes

- **No authentication** - User IDs are strings (implement auth in calling code)
- **No authorization** - Any user can approve/reject (implement in calling code)
- **Immutable data** - Prevents accidental data loss
- **Audit trail** - Complete history in metadata.json













