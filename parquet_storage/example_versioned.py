"""
Example usage of Versioned Parquet Storage

Demonstrates the complete lifecycle:
1. Create record (v1)
2. Update record (v2, v3)
3. Approve/reject record
4. Read versions
"""

import pandas as pd
from datetime import datetime
from parquet_storage import (
    ParquetStorageEngine,
    VersionedParquetStorage,
    RecordStatus,
    get_schema
)


def example_create_record():
    """Example: Create a new versioned record"""
    print("=" * 60)
    print("Example 1: Create Record")
    print("=" * 60)
    
    # Initialize base storage
    base_storage = ParquetStorageEngine(
        mode="local",
        base_path="./versioned-data"
    )
    
    # Initialize versioned storage
    versioned_storage = VersionedParquetStorage(base_storage)
    
    # Create sample data
    df = pd.DataFrame({
        "borelog_id": ["uuid-001"],
        "version_no": [1],
        "status": ["draft"],
        "created_at": [datetime.now()],
        "created_by_user_id": ["user-123"],
    })
    
    # Create record
    record_id = "borelog-001"
    metadata = versioned_storage.create_record(
        record_id=record_id,
        dataframe=df,
        table_name="borelog_versions",
        created_by="user-123",
        comment="Initial borelog entry"
    )
    
    print(f"✅ Created record: {record_id}")
    print(f"   Version: {metadata['current_version']}")
    print(f"   Status: {metadata['status']}")
    print(f"   Created by: {metadata['created_by']}")
    print(f"   History entries: {len(metadata['history'])}")


def example_update_record():
    """Example: Update record to create new version"""
    print("\n" + "=" * 60)
    print("Example 2: Update Record (Create New Version)")
    print("=" * 60)
    
    base_storage = ParquetStorageEngine(mode="local", base_path="./versioned-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    
    record_id = "borelog-001"
    
    # Check if record exists, create if not
    if not versioned_storage.get_metadata(record_id):
        df_v1 = pd.DataFrame({
            "borelog_id": ["uuid-001"],
            "version_no": [1],
            "status": ["draft"],
            "created_at": [datetime.now()],
            "created_by_user_id": ["user-123"],
        })
        versioned_storage.create_record(
            record_id=record_id,
            dataframe=df_v1,
            table_name="borelog_versions",
            created_by="user-123"
        )
    
    # Create version 2 with updated data
    df_v2 = pd.DataFrame({
        "borelog_id": ["uuid-001"],
        "version_no": [2],
        "status": ["submitted"],
        "created_at": [datetime.now()],
        "created_by_user_id": ["user-123"],
    })
    
    metadata = versioned_storage.update_record(
        record_id=record_id,
        dataframe=df_v2,
        updated_by="user-123",
        comment="Updated status to submitted"
    )
    
    print(f"✅ Updated record: {record_id}")
    print(f"   New version: {metadata['current_version']}")
    print(f"   Status: {metadata['status']}")
    print(f"   History entries: {len(metadata['history'])}")


def example_approve_record():
    """Example: Approve a record (metadata only)"""
    print("\n" + "=" * 60)
    print("Example 3: Approve Record")
    print("=" * 60)
    
    base_storage = ParquetStorageEngine(mode="local", base_path="./versioned-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    
    record_id = "borelog-001"
    
    # Ensure record exists
    if not versioned_storage.get_metadata(record_id):
        df = pd.DataFrame({
            "borelog_id": ["uuid-001"],
            "version_no": [1],
            "status": ["draft"],
            "created_at": [datetime.now()],
            "created_by_user_id": ["user-123"],
        })
        versioned_storage.create_record(
            record_id=record_id,
            dataframe=df,
            table_name="borelog_versions",
            created_by="user-123"
        )
    
    # Approve record
    metadata = versioned_storage.approve_record(
        record_id=record_id,
        approved_by="approver-456",
        comment="All checks passed, approved for production"
    )
    
    print(f"✅ Approved record: {record_id}")
    print(f"   Status: {metadata['status']}")
    print(f"   Approved by: {metadata['approved_by']}")
    print(f"   Approved at: {metadata['approved_at']}")
    print(f"   Current version: {metadata['current_version']}")
    print(f"   History entries: {len(metadata['history'])}")


def example_reject_record():
    """Example: Reject a record (metadata only)"""
    print("\n" + "=" * 60)
    print("Example 4: Reject Record")
    print("=" * 60)
    
    base_storage = ParquetStorageEngine(mode="local", base_path="./versioned-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    
    record_id = "borelog-002"
    
    # Create a draft record
    df = pd.DataFrame({
        "borelog_id": ["uuid-002"],
        "version_no": [1],
        "status": ["draft"],
        "created_at": [datetime.now()],
        "created_by_user_id": ["user-123"],
    })
    versioned_storage.create_record(
        record_id=record_id,
        dataframe=df,
        table_name="borelog_versions",
        created_by="user-123"
    )
    
    # Reject record
    metadata = versioned_storage.reject_record(
        record_id=record_id,
        rejected_by="approver-456",
        comment="Data quality issues found, needs revision"
    )
    
    print(f"✅ Rejected record: {record_id}")
    print(f"   Status: {metadata['status']}")
    print(f"   Rejected by: {metadata['rejected_by']}")
    print(f"   Rejected at: {metadata['rejected_at']}")
    print(f"   Rejection reason: {metadata['history'][-1]['comment']}")


def example_get_versions():
    """Example: Get different versions of a record"""
    print("\n" + "=" * 60)
    print("Example 5: Get Versions")
    print("=" * 60)
    
    base_storage = ParquetStorageEngine(mode="local", base_path="./versioned-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    
    record_id = "borelog-001"
    
    # Get metadata
    metadata = versioned_storage.get_metadata(record_id)
    if not metadata:
        print(f"❌ Record {record_id} not found")
        return
    
    print(f"Record: {record_id}")
    print(f"Current version: {metadata['current_version']}")
    print(f"Status: {metadata['status']}")
    
    # Get all available versions
    versions = versioned_storage.get_all_versions(record_id)
    print(f"\nAvailable versions: {versions}")
    
    # Get latest version
    df_latest = versioned_storage.get_latest_version(record_id)
    if df_latest is not None:
        print(f"\n✅ Latest version ({metadata['current_version']}):")
        print(df_latest)
    
    # Get specific version
    if len(versions) > 1:
        df_v1 = versioned_storage.get_specific_version(record_id, 1)
        if df_v1 is not None:
            print(f"\n✅ Version 1:")
            print(df_v1)


def example_view_history():
    """Example: View record history"""
    print("\n" + "=" * 60)
    print("Example 6: View History")
    print("=" * 60)
    
    base_storage = ParquetStorageEngine(mode="local", base_path="./versioned-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    
    record_id = "borelog-001"
    metadata = versioned_storage.get_metadata(record_id)
    
    if not metadata:
        print(f"❌ Record {record_id} not found")
        return
    
    print(f"History for record: {record_id}")
    print(f"Total history entries: {len(metadata.get('history', []))}")
    print("\nHistory:")
    for i, entry in enumerate(metadata.get("history", []), 1):
        print(f"\n  Entry {i}:")
        print(f"    Version: {entry['version']}")
        print(f"    Status: {entry['status']}")
        print(f"    Created by: {entry['created_by']}")
        print(f"    Created at: {entry['created_at']}")
        if entry.get("comment"):
            print(f"    Comment: {entry['comment']}")


def example_list_records():
    """Example: List records with filters"""
    print("\n" + "=" * 60)
    print("Example 7: List Records")
    print("=" * 60)
    
    base_storage = ParquetStorageEngine(mode="local", base_path="./versioned-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    
    # List all records
    all_records = versioned_storage.list_records()
    print(f"✅ Total records: {len(all_records)}")
    
    # List approved records
    approved = versioned_storage.list_records(status=RecordStatus.APPROVED)
    print(f"✅ Approved records: {len(approved)}")
    
    # List draft records
    drafts = versioned_storage.list_records(status=RecordStatus.DRAFT)
    print(f"✅ Draft records: {len(drafts)}")
    
    # List records for specific table
    borelog_records = versioned_storage.list_records(table_name="borelog_versions")
    print(f"✅ Borelog records: {len(borelog_records)}")


def example_lifecycle():
    """Example: Complete lifecycle"""
    print("\n" + "=" * 60)
    print("Example 8: Complete Lifecycle")
    print("=" * 60)
    
    base_storage = ParquetStorageEngine(mode="local", base_path="./versioned-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    
    record_id = "borelog-lifecycle-001"
    
    # Step 1: Create record (v1)
    print("\n1. Creating record...")
    df_v1 = pd.DataFrame({
        "borelog_id": ["uuid-lifecycle"],
        "version_no": [1],
        "status": ["draft"],
        "created_at": [datetime.now()],
        "created_by_user_id": ["user-123"],
    })
    metadata = versioned_storage.create_record(
        record_id=record_id,
        dataframe=df_v1,
        table_name="borelog_versions",
        created_by="user-123",
        comment="Initial creation"
    )
    print(f"   ✅ Created v{metadata['current_version']} ({metadata['status']})")
    
    # Step 2: Update record (v2)
    print("\n2. Updating record...")
    df_v2 = pd.DataFrame({
        "borelog_id": ["uuid-lifecycle"],
        "version_no": [2],
        "status": ["submitted"],
        "created_at": [datetime.now()],
        "created_by_user_id": ["user-123"],
    })
    metadata = versioned_storage.update_record(
        record_id=record_id,
        dataframe=df_v2,
        updated_by="user-123",
        comment="Submitted for review"
    )
    print(f"   ✅ Updated to v{metadata['current_version']} ({metadata['status']})")
    
    # Step 3: Approve record
    print("\n3. Approving record...")
    metadata = versioned_storage.approve_record(
        record_id=record_id,
        approved_by="approver-456",
        comment="Approved for production"
    )
    print(f"   ✅ Approved v{metadata['current_version']} by {metadata['approved_by']}")
    
    # Step 4: View final state
    print("\n4. Final state:")
    metadata = versioned_storage.get_metadata(record_id)
    print(f"   Record ID: {metadata['record_id']}")
    print(f"   Current version: {metadata['current_version']}")
    print(f"   Status: {metadata['status']}")
    print(f"   History entries: {len(metadata['history'])}")
    
    # Verify Parquet files are immutable
    print("\n5. Verifying immutability:")
    versions = versioned_storage.get_all_versions(record_id)
    print(f"   Available versions: {versions}")
    for v in versions:
        df = versioned_storage.get_specific_version(record_id, v)
        print(f"   ✅ Version {v}: {len(df)} rows")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Versioned Parquet Storage - Usage Examples")
    print("=" * 60 + "\n")
    
    try:
        example_create_record()
        example_update_record()
        example_approve_record()
        example_reject_record()
        example_get_versions()
        example_view_history()
        example_list_records()
        example_lifecycle()
        
        print("\n" + "=" * 60)
        print("✅ All examples completed!")
        print("=" * 60)
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()












