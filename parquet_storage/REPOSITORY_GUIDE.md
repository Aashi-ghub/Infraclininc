# Repository Interface Guide

## Overview

The `ParquetRepository` provides a high-level, DB-like interface on top of the versioned Parquet storage engine. It organizes data by `project_id` and `entity_type` for easy querying and management.

## Key Features

- ✅ **DB-like methods** - `create()`, `update()`, `get_latest()`, `list_by_project()`, `approve()`
- ✅ **Project-based organization** - All entities organized by project
- ✅ **Entity type support** - `borelog`, `geological_log`, `lab_test`
- ✅ **JSON-serializable** - Returns plain dictionaries
- ✅ **Consistent paths** - Automatic folder structure derivation

## Entity Types

| Entity Type | Table Name | Description |
|-------------|------------|-------------|
| `borelog` | `borelog_versions` | Borelog version records |
| `geological_log` | `geological_log` | Geological log entries |
| `lab_test` | `unified_lab_reports` | Lab test reports |

## Folder Structure

```
records/
  {project_id}/
    {entity_type}/
      {entity_id}/
        versions/
          v1.parquet
          v2.parquet
        metadata.json
```

Example:
```
records/
  project-001/
    borelog/
      borelog-001/
        versions/v1.parquet
        metadata.json
```

## API Reference

### `ParquetRepository`

#### Constructor

```python
from parquet_storage import (
    ParquetStorageEngine,
    VersionedParquetStorage,
    ParquetRepository
)

base_storage = ParquetStorageEngine(mode="local", base_path="./data")
versioned_storage = VersionedParquetStorage(base_storage)
repo = ParquetRepository(versioned_storage)
```

#### Methods

##### `create(entity_type, project_id, entity_id, payload, user, comment=None)`

Create a new entity record.

**Parameters:**
- `entity_type` (str): Type of entity (`borelog`, `geological_log`, `lab_test`)
- `project_id` (str): Project identifier
- `entity_id` (str): Entity identifier
- `payload` (dict): Entity data dictionary
- `user` (str): User ID who created the record
- `comment` (str, optional): Comment for history

**Returns:**
```python
{
    "entity_type": "borelog",
    "project_id": "project-001",
    "entity_id": "borelog-001",
    "data": {...},  # Entity data
    "metadata": {
        "current_version": 1,
        "status": "draft",
        "created_by": "user-123",
        "created_at": "2024-01-27T10:00:00Z"
    }
}
```

**Example:**
```python
payload = {
    "borelog_id": "uuid-001",
    "version_no": 1,
    "status": "draft",
    "created_at": datetime.now(),
    "created_by_user_id": "user-123",
}

result = repo.create(
    entity_type=EntityType.BORELOG,
    project_id="project-001",
    entity_id="borelog-001",
    payload=payload,
    user="user-123"
)
```

##### `update(entity_type, project_id, entity_id, payload, user, comment=None)`

Update an existing entity (creates new version).

**Parameters:**
- Same as `create()`, except entity must already exist

**Returns:**
- Same format as `create()`, with incremented version

**Example:**
```python
updated_payload = {
    "borelog_id": "uuid-001",
    "version_no": 2,
    "status": "submitted",
    ...
}

result = repo.update(
    EntityType.BORELOG,
    "project-001",
    "borelog-001",
    updated_payload,
    "user-123"
)
```

##### `get_latest(entity_type, project_id, entity_id)`

Get the latest version of an entity.

**Parameters:**
- `entity_type` (str): Type of entity
- `project_id` (str): Project identifier
- `entity_id` (str): Entity identifier

**Returns:**
- Dictionary with data and metadata, or `None` if not found

**Example:**
```python
result = repo.get_latest(
    EntityType.BORELOG,
    "project-001",
    "borelog-001"
)

if result:
    print(f"Version: {result['metadata']['current_version']}")
    print(f"Status: {result['metadata']['status']}")
```

##### `list_by_project(entity_type, project_id, status=None)`

List all entities of a type in a project.

**Parameters:**
- `entity_type` (str): Type of entity
- `project_id` (str): Project identifier
- `status` (str, optional): Filter by status (`draft`, `approved`, `rejected`)

**Returns:**
- List of dictionaries (same format as `get_latest()`)

**Example:**
```python
# List all borelogs in project
all_borelogs = repo.list_by_project(
    EntityType.BORELOG,
    "project-001"
)

# List only approved borelogs
approved = repo.list_by_project(
    EntityType.BORELOG,
    "project-001",
    status=RecordStatus.APPROVED
)
```

##### `approve(entity_type, project_id, entity_id, approver, comment=None)`

Approve an entity (updates metadata only).

**Parameters:**
- `entity_type` (str): Type of entity
- `project_id` (str): Project identifier
- `entity_id` (str): Entity identifier
- `approver` (str): User ID who approved
- `comment` (str, optional): Approval comment

**Returns:**
- Dictionary with updated metadata

**Example:**
```python
result = repo.approve(
    EntityType.BORELOG,
    "project-001",
    "borelog-001",
    "approver-456",
    comment="All checks passed"
)
```

##### `reject(entity_type, project_id, entity_id, rejector, comment=None)`

Reject an entity (updates metadata only).

**Parameters:**
- Same as `approve()`, but with `rejector` instead of `approver`

**Returns:**
- Dictionary with updated metadata

##### `get_version(entity_type, project_id, entity_id, version)`

Get a specific version of an entity.

**Parameters:**
- `entity_type` (str): Type of entity
- `project_id` (str): Project identifier
- `entity_id` (str): Entity identifier
- `version` (int): Version number

**Returns:**
- Dictionary with version data, or `None` if version doesn't exist

**Example:**
```python
v1 = repo.get_version(EntityType.BORELOG, "project-001", "borelog-001", 1)
v2 = repo.get_version(EntityType.BORELOG, "project-001", "borelog-001", 2)
```

##### `get_history(entity_type, project_id, entity_id)`

Get complete history of an entity.

**Parameters:**
- `entity_type` (str): Type of entity
- `project_id` (str): Project identifier
- `entity_id` (str): Entity identifier

**Returns:**
- List of history entries, or `None` if entity doesn't exist

**Example:**
```python
history = repo.get_history(EntityType.BORELOG, "project-001", "borelog-001")
for entry in history:
    print(f"Version {entry['version']}: {entry['status']}")
```

## Complete Example

```python
from parquet_storage import (
    ParquetStorageEngine,
    VersionedParquetStorage,
    ParquetRepository,
    EntityType
)
from datetime import datetime

# Initialize
base_storage = ParquetStorageEngine(mode="local", base_path="./data")
versioned_storage = VersionedParquetStorage(base_storage)
repo = ParquetRepository(versioned_storage)

# 1. Create borelog
payload = {
    "borelog_id": "uuid-001",
    "version_no": 1,
    "status": "draft",
    "created_at": datetime.now(),
    "created_by_user_id": "user-123",
}

result = repo.create(
    EntityType.BORELOG,
    "project-001",
    "borelog-001",
    payload,
    "user-123"
)
print(f"Created: {result['entity_id']} v{result['metadata']['current_version']}")

# 2. Update borelog
payload_v2 = {
    "borelog_id": "uuid-001",
    "version_no": 2,
    "status": "submitted",
    "created_at": datetime.now(),
    "created_by_user_id": "user-123",
}

result = repo.update(
    EntityType.BORELOG,
    "project-001",
    "borelog-001",
    payload_v2,
    "user-123"
)
print(f"Updated: v{result['metadata']['current_version']}")

# 3. Approve
result = repo.approve(
    EntityType.BORELOG,
    "project-001",
    "borelog-001",
    "approver-456"
)
print(f"Approved: {result['metadata']['status']}")

# 4. List project entities
entities = repo.list_by_project(EntityType.BORELOG, "project-001")
print(f"Found {len(entities)} borelogs")

# 5. Get latest
latest = repo.get_latest(EntityType.BORELOG, "project-001", "borelog-001")
print(f"Latest version: {latest['metadata']['current_version']}")
```

## Return Format

All methods return JSON-serializable dictionaries:

```python
{
    "entity_type": "borelog",
    "project_id": "project-001",
    "entity_id": "borelog-001",
    "data": {
        # Entity fields from Parquet schema
        "borelog_id": "uuid-001",
        "version_no": 1,
        "status": "draft",
        ...
    },
    "metadata": {
        "current_version": 1,
        "status": "draft",
        "created_by": "user-123",
        "created_at": "2024-01-27T10:00:00Z",
        "approved_by": null,
        "approved_at": null,
        ...
    }
}
```

## Error Handling

Common errors:

| Error | Cause | Solution |
|-------|-------|----------|
| `Entity already exists` | Trying to create existing entity | Use `update()` instead |
| `Entity not found` | Reading non-existent entity | Check with `get_latest()` first |
| `Unknown entity type` | Invalid entity_type | Use `EntityType.BORELOG`, etc. |
| `Cannot approve` | Wrong status | Check current status first |

## Integration Notes

- **No AWS Lambda handler** - Pure Python library
- **No Node.js changes** - Python only
- **JSON-serializable** - Easy to convert to JSON for APIs
- **Project-based** - Natural organization by project
- **Type-safe** - Entity types validated

## Best Practices

1. **Always check existence before creating**
   ```python
   existing = repo.get_latest(entity_type, project_id, entity_id)
   if not existing:
       repo.create(...)
   ```

2. **Use entity type constants**
   ```python
   from parquet_storage import EntityType
   repo.create(EntityType.BORELOG, ...)  # ✅ Good
   repo.create("borelog", ...)  # ✅ Also works, but less type-safe
   ```

3. **Handle None returns**
   ```python
   result = repo.get_latest(...)
   if result:
       # Process result
   ```

4. **Use status filters**
   ```python
   # Only get approved entities
   approved = repo.list_by_project(
       EntityType.BORELOG,
       project_id,
       status=RecordStatus.APPROVED
   )
   ```

## Performance Considerations

- **List operations** - Scans all records (consider pagination for large projects)
- **Metadata reads** - Fast (small JSON files)
- **Parquet reads** - Efficient (columnar format)
- **Project filtering** - O(n) where n is total records (consider indexing for large scale)

## Next Steps

- Add pagination for `list_by_project()`
- Add batch operations (create/update multiple)
- Add query filters (date ranges, etc.)
- Add export functionality




