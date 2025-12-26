"""
Example usage of Parquet Storage Engine

This script demonstrates how to use the storage engine for various scenarios.
"""

import pandas as pd
from datetime import datetime
from parquet_storage import ParquetStorageEngine, get_schema, SchemaRegistry


def example_local_mode():
    """Example: Using local filesystem mode"""
    print("=" * 60)
    print("Example 1: Local Filesystem Mode")
    print("=" * 60)
    
    # Initialize storage engine
    storage = ParquetStorageEngine(
        mode="local",
        base_path="./example-data"
    )
    
    # Create sample data
    df = pd.DataFrame({
        "borelog_id": ["uuid-001", "uuid-002", "uuid-003"],
        "version_no": [1, 1, 2],
        "status": ["draft", "submitted", "approved"],
        "created_at": [datetime.now()] * 3,
        "created_by_user_id": ["user-1", "user-2", "user-1"],
    })
    
    # Get schema
    schema = get_schema("borelog_versions")
    print(f"Schema fields: {len(schema)}")
    
    # Write Parquet file
    try:
        file_path = storage.write_parquet(
            path="boreholes/borelog_versions",
            dataframe=df,
            expected_schema=schema
        )
        print(f"✅ Written to: {file_path}")
    except ValueError as e:
        print(f"❌ Schema validation failed: {e}")
        return
    
    # Read Parquet file
    df_read = storage.read_parquet(file_path)
    print(f"✅ Read {len(df_read)} rows")
    print(df_read.head())


def example_schema_validation():
    """Example: Schema validation"""
    print("\n" + "=" * 60)
    print("Example 2: Schema Validation")
    print("=" * 60)
    
    storage = ParquetStorageEngine(mode="local", base_path="./example-data")
    
    # Create data with missing required field
    df_invalid = pd.DataFrame({
        "borelog_id": ["uuid-001"],  # Missing version_no (required)
        "status": ["draft"],
    })
    
    schema = get_schema("borelog_versions")
    
    try:
        storage.write_parquet(
            path="test/invalid",
            dataframe=df_invalid,
            expected_schema=schema
        )
    except ValueError as e:
        print(f"✅ Caught validation error: {e}")


def example_immutable_writes():
    """Example: Immutable writes (no overwrite)"""
    print("\n" + "=" * 60)
    print("Example 3: Immutable Writes")
    print("=" * 60)
    
    storage = ParquetStorageEngine(mode="local", base_path="./example-data")
    
    df = pd.DataFrame({
        "borelog_id": ["uuid-001"],
        "version_no": [1],
        "status": ["draft"],
        "created_at": [datetime.now()],
    })
    
    schema = get_schema("borelog_versions")
    
    # First write - succeeds
    path1 = storage.write_parquet("test/immutable", df, schema)
    print(f"✅ First write: {path1}")
    
    # Second write with same path - generates new unique filename
    path2 = storage.write_parquet("test/immutable", df, schema)
    print(f"✅ Second write: {path2}")
    print(f"   Different files: {path1 != path2}")


def example_partitioned_write():
    """Example: Partitioned Parquet writes"""
    print("\n" + "=" * 60)
    print("Example 4: Partitioned Writes")
    print("=" * 60)
    
    storage = ParquetStorageEngine(mode="local", base_path="./example-data")
    
    df = pd.DataFrame({
        "borelog_id": ["uuid-001", "uuid-002", "uuid-003"],
        "project_id": ["proj-1", "proj-1", "proj-2"],
        "status": ["draft", "approved", "draft"],
        "created_at": [datetime.now()] * 3,
    })
    
    # Write partitioned by project_id
    path = storage.write_parquet(
        path="boreholes/partitioned",
        dataframe=df,
        partition_cols=["project_id"]
    )
    print(f"✅ Partitioned write to: {path}")
    print("   Files organized by project_id")


def example_list_schemas():
    """Example: List available schemas"""
    print("\n" + "=" * 60)
    print("Example 5: List Available Schemas")
    print("=" * 60)
    
    tables = SchemaRegistry.list_tables()
    print(f"✅ Available schemas: {len(tables)}")
    print("\nTables:")
    for table in sorted(tables)[:10]:  # Show first 10
        print(f"  - {table}")
    if len(tables) > 10:
        print(f"  ... and {len(tables) - 10} more")


def example_read_with_filters():
    """Example: Read with filters (predicate pushdown)"""
    print("\n" + "=" * 60)
    print("Example 6: Read with Filters")
    print("=" * 60)
    
    storage = ParquetStorageEngine(mode="local", base_path="./example-data")
    
    # Create data with different statuses
    df = pd.DataFrame({
        "borelog_id": ["uuid-001", "uuid-002", "uuid-003", "uuid-004"],
        "version_no": [1, 1, 2, 1],
        "status": ["draft", "approved", "approved", "rejected"],
        "created_at": [datetime.now()] * 4,
    })
    
    schema = get_schema("borelog_versions")
    path = storage.write_parquet("test/filtered", df, schema)
    
    # Read with filter (only approved)
    # Note: This is a simplified example - actual filters use PyArrow expressions
    df_all = storage.read_parquet(path)
    df_filtered = df_all[df_all["status"] == "approved"]
    
    print(f"✅ Total rows: {len(df_all)}")
    print(f"✅ Filtered rows (approved): {len(df_filtered)}")


def example_s3_mode():
    """Example: S3 mode (commented out - requires AWS credentials)"""
    print("\n" + "=" * 60)
    print("Example 7: S3 Mode (Example - Not Executed)")
    print("=" * 60)
    
    print("""
    # S3 mode example (requires AWS credentials):
    
    storage = ParquetStorageEngine(
        mode="s3",
        bucket_name="my-parquet-bucket",
        base_path="parquet-data",
        aws_region="us-east-1"
        # Credentials from environment or IAM role
    )
    
    df = pd.DataFrame({...})
    schema = get_schema("borelog_versions")
    
    # Write to S3
    s3_path = storage.write_parquet(
        path="boreholes/borelog_versions",
        dataframe=df,
        expected_schema=schema
    )
    
    # Read from S3
    df_read = storage.read_parquet(s3_path)
    """)


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Parquet Storage Engine - Usage Examples")
    print("=" * 60 + "\n")
    
    try:
        example_local_mode()
        example_schema_validation()
        example_immutable_writes()
        example_partitioned_write()
        example_list_schemas()
        example_read_with_filters()
        example_s3_mode()
        
        print("\n" + "=" * 60)
        print("✅ All examples completed!")
        print("=" * 60)
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()







