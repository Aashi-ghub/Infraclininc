"""
Example usage of Parquet Repository Interface

Demonstrates DB-like methods for managing entities:
- create(), update(), get_latest()
- list_by_project(), approve()
"""

import pandas as pd
from datetime import datetime
from parquet_storage import (
    ParquetStorageEngine,
    VersionedParquetStorage,
    ParquetRepository,
    EntityType,
    RecordStatus
)


def example_create_borelog():
    """Example: Create a borelog entity"""
    print("=" * 60)
    print("Example 1: Create Borelog")
    print("=" * 60)
    
    # Initialize repository
    base_storage = ParquetStorageEngine(mode="local", base_path="./repo-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    repo = ParquetRepository(versioned_storage)
    
    # Create borelog payload
    payload = {
        "borelog_id": "uuid-borelog-001",
        "version_no": 1,
        "status": "draft",
        "created_at": datetime.now(),
        "created_by_user_id": "user-123",
        "number": "BH-001",
        "msl": "100.5",
        "boring_method": "Rotary Drilling",
    }
    
    result = repo.create(
        entity_type=EntityType.BORELOG,
        project_id="project-001",
        entity_id="borelog-001",
        payload=payload,
        user="user-123",
        comment="Initial borelog creation"
    )
    
    print(f"✅ Created: {result['entity_type']}")
    print(f"   Project: {result['project_id']}")
    print(f"   Entity ID: {result['entity_id']}")
    print(f"   Version: {result['metadata']['current_version']}")
    print(f"   Status: {result['metadata']['status']}")
    print(f"   Data keys: {list(result['data'].keys())[:5]}...")


def example_update_borelog():
    """Example: Update a borelog entity"""
    print("\n" + "=" * 60)
    print("Example 2: Update Borelog")
    print("=" * 60)
    
    base_storage = ParquetStorageEngine(mode="local", base_path="./repo-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    repo = ParquetRepository(versioned_storage)
    
    project_id = "project-001"
    entity_id = "borelog-001"
    
    # Ensure record exists
    existing = repo.get_latest(EntityType.BORELOG, project_id, entity_id)
    if not existing:
        payload = {
            "borelog_id": "uuid-borelog-001",
            "version_no": 1,
            "status": "draft",
            "created_at": datetime.now(),
            "created_by_user_id": "user-123",
        }
        repo.create(EntityType.BORELOG, project_id, entity_id, payload, "user-123")
    
    # Update payload
    updated_payload = {
        "borelog_id": "uuid-borelog-001",
        "version_no": 2,
        "status": "submitted",
        "created_at": datetime.now(),
        "created_by_user_id": "user-123",
        "number": "BH-001",
        "msl": "100.5",
        "boring_method": "Rotary Drilling",
        "hole_diameter": 150.0,
    }
    
    result = repo.update(
        entity_type=EntityType.BORELOG,
        project_id=project_id,
        entity_id=entity_id,
        payload=updated_payload,
        user="user-123",
        comment="Updated with additional details"
    )
    
    print(f"✅ Updated: {result['entity_id']}")
    print(f"   New version: {result['metadata']['current_version']}")
    print(f"   Status: {result['metadata']['status']}")


def example_get_latest():
    """Example: Get latest version of an entity"""
    print("\n" + "=" * 60)
    print("Example 3: Get Latest Version")
    print("=" * 60)
    
    base_storage = ParquetStorageEngine(mode="local", base_path="./repo-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    repo = ParquetRepository(versioned_storage)
    
    project_id = "project-001"
    entity_id = "borelog-001"
    
    result = repo.get_latest(
        entity_type=EntityType.BORELOG,
        project_id=project_id,
        entity_id=entity_id
    )
    
    if result:
        print(f"✅ Found: {result['entity_id']}")
        print(f"   Version: {result['metadata']['current_version']}")
        print(f"   Status: {result['metadata']['status']}")
        print(f"   Created by: {result['metadata'].get('created_by')}")
        print(f"   Data fields: {len(result['data'])}")
    else:
        print("❌ Entity not found")


def example_list_by_project():
    """Example: List all entities in a project"""
    print("\n" + "=" * 60)
    print("Example 4: List by Project")
    print("=" * 60)
    
    base_storage = ParquetStorageEngine(mode="local", base_path="./repo-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    repo = ParquetRepository(versioned_storage)
    
    project_id = "project-001"
    
    # Create a few test records
    for i in range(1, 4):
        payload = {
            "borelog_id": f"uuid-borelog-{i:03d}",
            "version_no": 1,
            "status": "draft" if i % 2 == 1 else "approved",
            "created_at": datetime.now(),
            "created_by_user_id": "user-123",
        }
        try:
            repo.create(
                EntityType.BORELOG,
                project_id,
                f"borelog-{i:03d}",
                payload,
                "user-123"
            )
        except ValueError:
            pass  # Already exists
    
    # List all borelogs in project
    all_borelogs = repo.list_by_project(
        entity_type=EntityType.BORELOG,
        project_id=project_id
    )
    
    print(f"✅ Found {len(all_borelogs)} borelogs in project {project_id}")
    for borelog in all_borelogs:
        print(f"   - {borelog['entity_id']}: v{borelog['metadata']['current_version']} "
              f"({borelog['metadata']['status']})")
    
    # List only approved
    approved = repo.list_by_project(
        entity_type=EntityType.BORELOG,
        project_id=project_id,
        status=RecordStatus.APPROVED
    )
    print(f"\n✅ Approved borelogs: {len(approved)}")


def example_approve():
    """Example: Approve an entity"""
    print("\n" + "=" * 60)
    print("Example 5: Approve Entity")
    print("=" * 60)
    
    base_storage = ParquetStorageEngine(mode="local", base_path="./repo-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    repo = ParquetRepository(versioned_storage)
    
    project_id = "project-001"
    entity_id = "borelog-001"
    
    # Ensure record exists and is draft
    existing = repo.get_latest(EntityType.BORELOG, project_id, entity_id)
    if not existing:
        payload = {
            "borelog_id": "uuid-borelog-001",
            "version_no": 1,
            "status": "draft",
            "created_at": datetime.now(),
            "created_by_user_id": "user-123",
        }
        repo.create(EntityType.BORELOG, project_id, entity_id, payload, "user-123")
    
    # Approve
    result = repo.approve(
        entity_type=EntityType.BORELOG,
        project_id=project_id,
        entity_id=entity_id,
        approver="approver-456",
        comment="All checks passed, approved for production"
    )
    
    print(f"✅ Approved: {result['entity_id']}")
    print(f"   Status: {result['metadata']['status']}")
    print(f"   Approved by: {result['metadata']['approved_by']}")
    print(f"   Approved at: {result['metadata']['approved_at']}")


def example_get_version():
    """Example: Get specific version"""
    print("\n" + "=" * 60)
    print("Example 6: Get Specific Version")
    print("=" * 60)
    
    base_storage = ParquetStorageEngine(mode="local", base_path="./repo-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    repo = ParquetRepository(versioned_storage)
    
    project_id = "project-001"
    entity_id = "borelog-001"
    
    # Get version 1
    v1 = repo.get_version(EntityType.BORELOG, project_id, entity_id, 1)
    if v1:
        print(f"✅ Version 1:")
        print(f"   Status: {v1['metadata']['status']}")
        print(f"   Data fields: {len(v1['data'])}")
    
    # Get latest version
    latest = repo.get_latest(EntityType.BORELOG, project_id, entity_id)
    if latest:
        print(f"\n✅ Latest version ({latest['metadata']['current_version']}):")
        print(f"   Status: {latest['metadata']['status']}")


def example_get_history():
    """Example: Get entity history"""
    print("\n" + "=" * 60)
    print("Example 7: Get History")
    print("=" * 60)
    
    base_storage = ParquetStorageEngine(mode="local", base_path="./repo-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    repo = ParquetRepository(versioned_storage)
    
    project_id = "project-001"
    entity_id = "borelog-001"
    
    history = repo.get_history(EntityType.BORELOG, project_id, entity_id)
    
    if history:
        print(f"✅ History entries: {len(history)}")
        for i, entry in enumerate(history, 1):
            print(f"\n   Entry {i}:")
            print(f"     Version: {entry['version']}")
            print(f"     Status: {entry['status']}")
            print(f"     Created by: {entry['created_by']}")
            print(f"     Comment: {entry.get('comment', 'N/A')}")
    else:
        print("❌ No history found")


def example_complete_workflow():
    """Example: Complete workflow"""
    print("\n" + "=" * 60)
    print("Example 8: Complete Workflow")
    print("=" * 60)
    
    base_storage = ParquetStorageEngine(mode="local", base_path="./repo-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    repo = ParquetRepository(versioned_storage)
    
    project_id = "project-workflow"
    entity_id = "borelog-workflow-001"
    
    # Step 1: Create
    print("\n1. Creating borelog...")
    payload_v1 = {
        "borelog_id": "uuid-workflow",
        "version_no": 1,
        "status": "draft",
        "created_at": datetime.now(),
        "created_by_user_id": "user-123",
    }
    result = repo.create(
        EntityType.BORELOG, project_id, entity_id, payload_v1, "user-123"
    )
    print(f"   ✅ Created v{result['metadata']['current_version']}")
    
    # Step 2: Update
    print("\n2. Updating borelog...")
    payload_v2 = {
        "borelog_id": "uuid-workflow",
        "version_no": 2,
        "status": "submitted",
        "created_at": datetime.now(),
        "created_by_user_id": "user-123",
    }
    result = repo.update(
        EntityType.BORELOG, project_id, entity_id, payload_v2, "user-123"
    )
    print(f"   ✅ Updated to v{result['metadata']['current_version']}")
    
    # Step 3: Approve
    print("\n3. Approving borelog...")
    result = repo.approve(
        EntityType.BORELOG, project_id, entity_id, "approver-456"
    )
    print(f"   ✅ Approved by {result['metadata']['approved_by']}")
    
    # Step 4: List project
    print("\n4. Listing project entities...")
    entities = repo.list_by_project(EntityType.BORELOG, project_id)
    print(f"   ✅ Found {len(entities)} entities")
    
    # Step 5: View history
    print("\n5. Viewing history...")
    history = repo.get_history(EntityType.BORELOG, project_id, entity_id)
    print(f"   ✅ {len(history)} history entries")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Parquet Repository Interface - Usage Examples")
    print("=" * 60 + "\n")
    
    try:
        example_create_borelog()
        example_update_borelog()
        example_get_latest()
        example_list_by_project()
        example_approve()
        example_get_version()
        example_get_history()
        example_complete_workflow()
        
        print("\n" + "=" * 60)
        print("✅ All examples completed!")
        print("=" * 60)
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()




