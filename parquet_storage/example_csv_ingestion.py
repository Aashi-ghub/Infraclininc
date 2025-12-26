"""
Example usage of CSV Ingestion Engine

Demonstrates bulk CSV upload with validation and error reporting.
"""

import pandas as pd
from datetime import datetime
from parquet_storage import (
    ParquetStorageEngine,
    VersionedParquetStorage,
    CSVIngestionEngine
)


def example_ingest_valid_csv():
    """Example: Ingest CSV with all valid rows"""
    print("=" * 60)
    print("Example 1: Ingest Valid CSV")
    print("=" * 60)
    
    # Initialize storage
    base_storage = ParquetStorageEngine(mode="local", base_path="./csv-test-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    ingestion = CSVIngestionEngine(versioned_storage)
    
    # Create sample CSV file
    csv_data = """borelog_id,version_no,status,created_by_user_id,number,msl,boring_method
uuid-001,1,draft,user-123,BH-001,100.5,Rotary Drilling
uuid-002,1,draft,user-123,BH-002,101.0,Rotary Drilling
uuid-003,1,draft,user-123,BH-003,99.5,Rotary Drilling"""
    
    import tempfile
    import os
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write(csv_data)
        csv_path = f.name
    
    try:
        # Ingest CSV
        result = ingestion.ingest_csv(
            csv_file_path=csv_path,
            table_name="borelog_versions",
            project_id="project-001",
            entity_type="borelog",
            entity_id="csv-upload-001",
            user_id="user-123",
            comment="Test CSV upload"
        )
        
        print(f"✅ Ingestion complete:")
        print(f"   Total rows: {result.total_rows}")
        print(f"   Valid rows: {result.valid_rows}")
        print(f"   Invalid rows: {result.invalid_rows}")
        print(f"   Errors: {len(result.errors)}")
        print(f"   Record ID: {result.record_id}")
        print(f"   Version: {result.version}")
        print(f"\n   Result: {result.to_dict()}")
    
    finally:
        os.unlink(csv_path)


def example_ingest_csv_with_errors():
    """Example: Ingest CSV with validation errors"""
    print("\n" + "=" * 60)
    print("Example 2: Ingest CSV with Errors")
    print("=" * 60)
    
    base_storage = ParquetStorageEngine(mode="local", base_path="./csv-test-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    ingestion = CSVIngestionEngine(versioned_storage)
    
    # Create CSV with errors (missing required fields, wrong types)
    csv_data = """borelog_id,version_no,status,created_by_user_id,number,msl,boring_method
uuid-004,1,draft,user-123,BH-004,100.5,Rotary Drilling
uuid-005,,draft,user-123,BH-005,invalid,Rotary Drilling
uuid-006,not-a-number,draft,user-123,BH-006,101.0,Rotary Drilling
uuid-007,1,draft,user-123,BH-007,102.0,Rotary Drilling"""
    
    import tempfile
    import os
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write(csv_data)
        csv_path = f.name
    
    try:
        # Ingest CSV (skip_errors=True to continue after errors)
        result = ingestion.ingest_csv(
            csv_file_path=csv_path,
            table_name="borelog_versions",
            project_id="project-001",
            entity_type="borelog",
            entity_id="csv-upload-002",
            user_id="user-123",
            skip_errors=True
        )
        
        print(f"✅ Ingestion complete:")
        print(f"   Total rows: {result.total_rows}")
        print(f"   Valid rows: {result.valid_rows}")
        print(f"   Invalid rows: {result.invalid_rows}")
        print(f"   Errors: {len(result.errors)}")
        
        print(f"\n   Error Details:")
        for error in result.errors:
            print(f"     Row {error.row_index + 1}, Field '{error.field}': {error.error}")
        
        print(f"\n   Error Summary:")
        summary = result.to_dict()["error_summary"]
        for field, details in summary.items():
            print(f"     {field}: {details['count']} errors")
    
    finally:
        os.unlink(csv_path)


def example_ingest_csv_from_string():
    """Example: Ingest CSV from string content"""
    print("\n" + "=" * 60)
    print("Example 3: Ingest CSV from String")
    print("=" * 60)
    
    base_storage = ParquetStorageEngine(mode="local", base_path="./csv-test-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    ingestion = CSVIngestionEngine(versioned_storage)
    
    # CSV content as string
    csv_content = """borelog_id,version_no,status,created_by_user_id,number,msl
uuid-008,1,draft,user-123,BH-008,100.5
uuid-009,1,draft,user-123,BH-009,101.0"""
    
    result = ingestion.ingest_csv_from_string(
        csv_content=csv_content,
        table_name="borelog_versions",
        project_id="project-001",
        entity_type="borelog",
        entity_id="csv-upload-003",
        user_id="user-123"
    )
    
    print(f"✅ Ingestion complete:")
    print(f"   Valid rows: {result.valid_rows}")
    print(f"   Invalid rows: {result.invalid_rows}")
    print(f"   Version: {result.version}")


def example_update_existing_record():
    """Example: Update existing record with CSV"""
    print("\n" + "=" * 60)
    print("Example 4: Update Existing Record")
    print("=" * 60)
    
    base_storage = ParquetStorageEngine(mode="local", base_path="./csv-test-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    ingestion = CSVIngestionEngine(versioned_storage)
    
    entity_id = "csv-upload-existing"
    
    # First, create initial record
    import pandas as pd
    initial_df = pd.DataFrame({
        "borelog_id": ["uuid-existing"],
        "version_no": [1],
        "status": ["draft"],
        "created_by_user_id": ["user-123"],
    })
    
    versioned_storage.create_record(
        record_id=entity_id,
        dataframe=initial_df,
        table_name="borelog_versions",
        created_by="user-123"
    )
    
    print(f"✅ Created initial record: v1")
    
    # Now upload CSV (creates new version)
    csv_content = """borelog_id,version_no,status,created_by_user_id,number,msl
uuid-existing,2,draft,user-123,BH-EXISTING,100.5"""
    
    result = ingestion.ingest_csv_from_string(
        csv_content=csv_content,
        table_name="borelog_versions",
        project_id="project-001",
        entity_type="borelog",
        entity_id=entity_id,
        user_id="user-123"
    )
    
    print(f"✅ CSV upload complete:")
    print(f"   Record ID: {result.record_id}")
    print(f"   New version: {result.version}")
    print(f"   Valid rows: {result.valid_rows}")
    
    # Verify versioning
    metadata = versioned_storage.get_metadata(entity_id)
    print(f"\n   Metadata:")
    print(f"     Current version: {metadata['current_version']}")
    print(f"     History entries: {len(metadata.get('history', []))}")


def example_detailed_error_report():
    """Example: Generate detailed error report"""
    print("\n" + "=" * 60)
    print("Example 5: Detailed Error Report")
    print("=" * 60)
    
    base_storage = ParquetStorageEngine(mode="local", base_path="./csv-test-data")
    versioned_storage = VersionedParquetStorage(base_storage)
    ingestion = CSVIngestionEngine(versioned_storage)
    
    # CSV with multiple types of errors
    csv_content = """borelog_id,version_no,status,created_by_user_id,number,msl,hole_diameter
uuid-010,1,draft,user-123,BH-010,100.5,150.0
uuid-011,,draft,user-123,BH-011,101.0,invalid
uuid-012,not-a-number,draft,user-123,BH-012,102.0,200.0
uuid-013,1,draft,,BH-013,103.0,250.0
uuid-014,1,draft,user-123,BH-014,104.0,300.0"""
    
    result = ingestion.ingest_csv_from_string(
        csv_content=csv_content,
        table_name="borelog_versions",
        project_id="project-001",
        entity_type="borelog",
        entity_id="csv-upload-errors",
        user_id="user-123",
        skip_errors=True
    )
    
    print(f"✅ Ingestion complete:")
    print(f"   Total rows: {result.total_rows}")
    print(f"   Valid rows: {result.valid_rows}")
    print(f"   Invalid rows: {result.invalid_rows}")
    
    # Detailed error report
    result_dict = result.to_dict()
    print(f"\n   Full Result:")
    import json
    print(json.dumps(result_dict, indent=2, default=str))


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("CSV Ingestion Engine - Usage Examples")
    print("=" * 60 + "\n")
    
    try:
        example_ingest_valid_csv()
        example_ingest_csv_with_errors()
        example_ingest_csv_from_string()
        example_update_existing_record()
        example_detailed_error_report()
        
        print("\n" + "=" * 60)
        print("✅ All examples completed!")
        print("=" * 60)
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

