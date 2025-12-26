"""
Versioned Parquet Storage Engine

Extends the base ParquetStorageEngine with versioning and approval metadata support.

Lifecycle:
1. create_record() - Creates first version (v1) with metadata.json
2. update_record() - Creates new version (v2, v3...) and updates metadata
3. approve_record() - Updates metadata.json only (no Parquet changes)
4. reject_record() - Updates metadata.json only (no Parquet changes)

Key Principles:
- Parquet files are immutable (never overwritten)
- Each version stored as v1.parquet, v2.parquet, etc.
- Metadata stored in metadata.json alongside versions/
- History is append-only (never deleted)
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
import logging

import pandas as pd
import pyarrow as pa

from .storage_engine import ParquetStorageEngine

# Mock storage backend functions
import os

MOCK_S3_ROOT = "./mock_s3"

def write_file(key: str, data: bytes):
    """
    key example:
    projects/project_123/borelogs/borelog_456/v1/data.parquet
    """
    local_path = os.path.join(MOCK_S3_ROOT, key)
    os.makedirs(os.path.dirname(local_path), exist_ok=True)

    with open(local_path, "wb") as f:
        f.write(data)


def read_file(key: str) -> bytes:
    local_path = os.path.join(MOCK_S3_ROOT, key)
    with open(local_path, "rb") as f:
        return f.read()

logger = logging.getLogger(__name__)


class RecordStatus:
    """Record status constants"""
    DRAFT = "draft"
    APPROVED = "approved"
    REJECTED = "rejected"


class VersionedParquetStorage:
    """
    Versioned Parquet storage with approval metadata.
    
    Stores Parquet files in versioned format:
    {record_path}/
      versions/
        v1.parquet
        v2.parquet
        v3.parquet
      metadata.json
    
    Metadata structure:
    {
        "record_id": "uuid",
        "current_version": 3,
        "status": "approved",
        "created_by": "user-id",
        "created_at": "2024-01-27T10:00:00Z",
        "approved_by": "user-id",
        "approved_at": "2024-01-27T11:00:00Z",
        "rejected_by": null,
        "rejected_at": null,
        "history": [
            {
                "version": 1,
                "status": "draft",
                "created_by": "user-id",
                "created_at": "2024-01-27T10:00:00Z",
                "comment": "Initial creation"
            },
            ...
        ]
    }
    
    Args:
        base_storage: ParquetStorageEngine instance (S3 or local)
        metadata_base_path: Base path for metadata files (default: same as base_storage)
    """
    
    def __init__(
        self,
        base_storage: ParquetStorageEngine,
        metadata_base_path: Optional[str] = None
    ):
        self.storage = base_storage
        self.metadata_base_path = metadata_base_path or self.storage.base_path
    
    def _get_record_path(self, record_id: str) -> str:
        """Get base path for a record."""
        return f"records/{record_id}"
    
    def _get_versions_path(self, record_id: str) -> str:
        """Get path to versions directory."""
        return f"{self._get_record_path(record_id)}/versions"
    
    def _get_version_file_path(self, record_id: str, version: int) -> str:
        """Get path to a specific version file."""
        return f"{self._get_versions_path(record_id)}/v{version}.parquet"
    
    def _get_metadata_path(self, record_id: str) -> str:
        """Get path to metadata.json file."""
        return f"{self._get_record_path(record_id)}/metadata.json"
    
    def _read_metadata(self, record_id: str) -> Optional[Dict[str, Any]]:
        """
        Read metadata.json for a record.

        Returns:
            Metadata dict or None if record doesn't exist
        """
        metadata_path = self._get_metadata_path(record_id)

        try:
            # Use mock storage backend
            try:
                metadata_json = read_file(metadata_path)
                return json.loads(metadata_json.decode('utf-8'))
            except FileNotFoundError:
                return None

        except Exception as e:
            logger.error(f"Failed to read metadata for {record_id}: {e}")
            return None
    
    def _write_metadata(self, record_id: str, metadata: Dict[str, Any]) -> None:
        """
        Write metadata.json for a record.

        Args:
            record_id: Record identifier
            metadata: Metadata dictionary to write
        """
        metadata_path = self._get_metadata_path(record_id)

        # Use mock storage backend
        metadata_json = json.dumps(metadata, indent=2, default=str)
        write_file(metadata_path, metadata_json.encode('utf-8'))
    
    def _add_history_entry(
        self,
        metadata: Dict[str, Any],
        version: int,
        status: str,
        user_id: str,
        comment: Optional[str] = None
    ) -> None:
        """
        Add an entry to the history (append-only).
        
        Args:
            metadata: Metadata dictionary (will be modified)
            version: Version number
            status: Status at this point
            user_id: User who made the change
            comment: Optional comment
        """
        if "history" not in metadata:
            metadata["history"] = []
        
        history_entry = {
            "version": version,
            "status": status,
            "created_by": user_id,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "comment": comment or ""
        }
        
        metadata["history"].append(history_entry)
    
    def create_record(
        self,
        record_id: str,
        dataframe: pd.DataFrame,
        table_name: str,
        created_by: str,
        comment: Optional[str] = None,
        expected_schema: Optional[pa.Schema] = None
    ) -> Dict[str, Any]:
        """
        Create a new record with version 1.
        
        Args:
            record_id: Unique record identifier
            dataframe: Data to store
            table_name: Table name (for schema lookup)
            created_by: User ID who created the record
            comment: Optional comment for history
            expected_schema: Optional PyArrow schema (auto-looked up if not provided)
            
        Returns:
            Metadata dictionary
            
        Raises:
            ValueError: If record already exists or validation fails
        """
        # Check if record already exists
        existing_metadata = self._read_metadata(record_id)
        if existing_metadata:
            raise ValueError(f"Record {record_id} already exists")
        
        # Get schema if not provided
        if not expected_schema:
            from .schemas import get_schema
            expected_schema = get_schema(table_name)
            if not expected_schema:
                raise ValueError(f"No schema found for table: {table_name}")
        
        # Validate schema
        self.storage.validate_schema(dataframe, expected_schema)
        
        # Write version 1 Parquet file
        version_path = self._get_version_file_path(record_id, 1)
        self.storage.write_parquet(
            path=version_path,
            dataframe=dataframe,
            expected_schema=expected_schema,
            overwrite=False  # Immutable - should never overwrite
        )
        
        # Create metadata
        now = datetime.utcnow().isoformat() + "Z"
        metadata = {
            "record_id": record_id,
            "table_name": table_name,
            "current_version": 1,
            "status": RecordStatus.DRAFT,
            "created_by": created_by,
            "created_at": now,
            "approved_by": None,
            "approved_at": None,
            "rejected_by": None,
            "rejected_at": None,
            "history": []
        }
        
        # Add history entry
        self._add_history_entry(
            metadata,
            version=1,
            status=RecordStatus.DRAFT,
            user_id=created_by,
            comment=comment or "Initial creation"
        )
        
        # Write metadata
        self._write_metadata(record_id, metadata)
        
        logger.info(f"Created record {record_id} with version 1")
        return metadata
    
    def update_record(
        self,
        record_id: str,
        dataframe: pd.DataFrame,
        updated_by: str,
        comment: Optional[str] = None,
        expected_schema: Optional[pa.Schema] = None
    ) -> Dict[str, Any]:
        """
        Create a new version of an existing record.
        
        Args:
            record_id: Record identifier
            dataframe: New data to store
            updated_by: User ID who updated the record
            comment: Optional comment for history
            expected_schema: Optional PyArrow schema
            
        Returns:
            Updated metadata dictionary
            
        Raises:
            ValueError: If record doesn't exist or validation fails
        """
        # Read existing metadata
        metadata = self._read_metadata(record_id)
        if not metadata:
            raise ValueError(f"Record {record_id} does not exist")
        
        # Get schema if not provided
        if not expected_schema:
            table_name = metadata.get("table_name")
            if not table_name:
                raise ValueError("Cannot determine table name from metadata")
            from .schemas import get_schema
            expected_schema = get_schema(table_name)
            if not expected_schema:
                raise ValueError(f"No schema found for table: {table_name}")
        
        # Validate schema
        self.storage.validate_schema(dataframe, expected_schema)
        
        # Increment version
        new_version = metadata["current_version"] + 1
        
        # Write new version Parquet file (immutable)
        version_path = self._get_version_file_path(record_id, new_version)
        self.storage.write_parquet(
            path=version_path,
            dataframe=dataframe,
            expected_schema=expected_schema,
            overwrite=False
        )
        
        # Update metadata
        metadata["current_version"] = new_version
        metadata["status"] = RecordStatus.DRAFT  # New version starts as draft
        
        # Add history entry
        self._add_history_entry(
            metadata,
            version=new_version,
            status=RecordStatus.DRAFT,
            user_id=updated_by,
            comment=comment or f"Updated to version {new_version}"
        )
        
        # Write metadata
        self._write_metadata(record_id, metadata)
        
        logger.info(f"Updated record {record_id} to version {new_version}")
        return metadata
    
    def get_latest_version(
        self,
        record_id: str
    ) -> Optional[pd.DataFrame]:
        """
        Get the latest version of a record.
        
        Args:
            record_id: Record identifier
            
        Returns:
            pandas DataFrame or None if record doesn't exist
        """
        metadata = self._read_metadata(record_id)
        if not metadata:
            return None
        
        version = metadata["current_version"]
        return self.get_specific_version(record_id, version)
    
    def get_specific_version(
        self,
        record_id: str,
        version: int
    ) -> Optional[pd.DataFrame]:
        """
        Get a specific version of a record.
        
        Args:
            record_id: Record identifier
            version: Version number
            
        Returns:
            pandas DataFrame or None if version doesn't exist
        """
        version_path = self._get_version_file_path(record_id, version)
        
        try:
            return self.storage.read_parquet(version_path)
        except (FileNotFoundError, IOError):
            return None
    
    def get_metadata(self, record_id: str) -> Optional[Dict[str, Any]]:
        """
        Get metadata for a record.
        
        Args:
            record_id: Record identifier
            
        Returns:
            Metadata dictionary or None if record doesn't exist
        """
        return self._read_metadata(record_id)
    
    def approve_record(
        self,
        record_id: str,
        approved_by: str,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Approve a record (updates metadata only, no Parquet changes).
        
        Args:
            record_id: Record identifier
            approved_by: User ID who approved the record
            comment: Optional comment for history
            
        Returns:
            Updated metadata dictionary
            
        Raises:
            ValueError: If record doesn't exist or already approved/rejected
        """
        metadata = self._read_metadata(record_id)
        if not metadata:
            raise ValueError(f"Record {record_id} does not exist")
        
        # Check current status
        if metadata["status"] == RecordStatus.APPROVED:
            raise ValueError(f"Record {record_id} is already approved")
        if metadata["status"] == RecordStatus.REJECTED:
            raise ValueError(f"Record {record_id} is rejected and cannot be approved")
        
        # Update metadata
        now = datetime.utcnow().isoformat() + "Z"
        metadata["status"] = RecordStatus.APPROVED
        metadata["approved_by"] = approved_by
        metadata["approved_at"] = now
        
        # Add history entry
        self._add_history_entry(
            metadata,
            version=metadata["current_version"],
            status=RecordStatus.APPROVED,
            user_id=approved_by,
            comment=comment or "Record approved"
        )
        
        # Write metadata (no Parquet changes)
        self._write_metadata(record_id, metadata)
        
        logger.info(f"Approved record {record_id} (version {metadata['current_version']})")
        return metadata
    
    def reject_record(
        self,
        record_id: str,
        rejected_by: str,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Reject a record (updates metadata only, no Parquet changes).
        
        Args:
            record_id: Record identifier
            rejected_by: User ID who rejected the record
            comment: Optional rejection reason
            
        Returns:
            Updated metadata dictionary
            
        Raises:
            ValueError: If record doesn't exist or already approved/rejected
        """
        metadata = self._read_metadata(record_id)
        if not metadata:
            raise ValueError(f"Record {record_id} does not exist")
        
        # Check current status
        if metadata["status"] == RecordStatus.APPROVED:
            raise ValueError(f"Record {record_id} is approved and cannot be rejected")
        if metadata["status"] == RecordStatus.REJECTED:
            raise ValueError(f"Record {record_id} is already rejected")
        
        # Update metadata
        now = datetime.utcnow().isoformat() + "Z"
        metadata["status"] = RecordStatus.REJECTED
        metadata["rejected_by"] = rejected_by
        metadata["rejected_at"] = now
        
        # Add history entry
        self._add_history_entry(
            metadata,
            version=metadata["current_version"],
            status=RecordStatus.REJECTED,
            user_id=rejected_by,
            comment=comment or "Record rejected"
        )
        
        # Write metadata (no Parquet changes)
        self._write_metadata(record_id, metadata)
        
        logger.info(f"Rejected record {record_id} (version {metadata['current_version']})")
        return metadata
    
    def list_records(
        self,
        table_name: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[str]:
        """
        List all record IDs, optionally filtered by table_name or status.
        
        Args:
            table_name: Filter by table name
            status: Filter by status (draft, approved, rejected)
            
        Returns:
            List of record IDs
        """
        records = []
        records_base = Path(self.metadata_base_path) / "records"
        
        if not records_base.exists():
            return []
        
        for record_dir in records_base.iterdir():
            if not record_dir.is_dir():
                continue
            
            record_id = record_dir.name
            metadata = self._read_metadata(record_id)
            
            if not metadata:
                continue
            
            # Apply filters
            if table_name and metadata.get("table_name") != table_name:
                continue
            
            if status and metadata.get("status") != status:
                continue
            
            records.append(record_id)
        
        return sorted(records)
    
    def get_all_versions(self, record_id: str) -> List[int]:
        """
        Get list of all available versions for a record.
        
        Args:
            record_id: Record identifier
            
        Returns:
            List of version numbers
        """
        metadata = self._read_metadata(record_id)
        if not metadata:
            return []
        
        versions = []
        current_version = metadata["current_version"]
        
        # Check which versions exist
        for version in range(1, current_version + 1):
            version_path = self._get_version_file_path(record_id, version)
            try:
                # Try to read to verify existence
                self.storage.read_parquet(version_path)
                versions.append(version)
            except (FileNotFoundError, IOError):
                continue
        
        return versions

