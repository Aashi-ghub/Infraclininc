"""
Repository Interface for Parquet Storage

Provides a high-level, DB-like interface on top of the versioned Parquet storage engine.
Organizes data by project_id and entity_type for easy querying.

Entity Types:
- borelog: Borelog versions (borelog_versions table)
- geological_log: Geological log entries (geological_log table)
- lab_test: Lab test reports (unified_lab_reports or lab_report_versions table)

Folder Structure:
records/{project_id}/{entity_type}/{entity_id}/
  versions/v1.parquet, v2.parquet...
  metadata.json
"""

import json
from datetime import datetime
from typing import Optional, Dict, Any, List
import logging

import pandas as pd
import pyarrow as pa

from .versioned_storage import VersionedParquetStorage, RecordStatus
from .schemas import get_schema

logger = logging.getLogger(__name__)


class EntityType:
    """Entity type constants"""
    BORELOG = "borelog"
    GEOLOGICAL_LOG = "geological_log"
    LAB_TEST = "lab_test"


class ParquetRepository:
    """
    Repository interface for Parquet storage with project-based organization.
    
    Provides DB-like methods:
    - create(entity_type, project_id, entity_id, payload, user)
    - update(entity_type, project_id, entity_id, payload, user)
    - get_latest(entity_type, project_id, entity_id)
    - list_by_project(entity_type, project_id)
    - approve(entity_type, project_id, entity_id, approver)
    
    Args:
        versioned_storage: VersionedParquetStorage instance
    """
    
    # Entity type to table name mapping
    ENTITY_TABLE_MAP = {
        EntityType.BORELOG: "borelog_versions",
        EntityType.GEOLOGICAL_LOG: "geological_log",
        EntityType.LAB_TEST: "unified_lab_reports",
    }
    
    def __init__(self, versioned_storage: VersionedParquetStorage):
        self.storage = versioned_storage
    
    def _get_record_id(self, project_id: str, entity_type: str, entity_id: str) -> str:
        """
        Generate consistent record ID from project_id, entity_type, and entity_id.
        
        Format: {project_id}/{entity_type}/{entity_id}
        This maps to folder structure: records/{project_id}/{entity_type}/{entity_id}/
        """
        return f"{project_id}/{entity_type}/{entity_id}"
    
    def _get_table_name(self, entity_type: str) -> str:
        """Get table name for entity type."""
        table_name = self.ENTITY_TABLE_MAP.get(entity_type)
        if not table_name:
            raise ValueError(f"Unknown entity type: {entity_type}")
        return table_name
    
    def _payload_to_dataframe(self, payload: Dict[str, Any], table_name: str) -> pd.DataFrame:
        """
        Convert payload dict to pandas DataFrame.
        
        Args:
            payload: Dictionary with entity data
            table_name: Table name for schema validation
            
        Returns:
            pandas DataFrame
        """
        # Get schema to ensure correct column order and types
        schema = get_schema(table_name)
        if not schema:
            raise ValueError(f"No schema found for table: {table_name}")
        
        # Create DataFrame from payload (single row)
        df = pd.DataFrame([payload])
        
        # Ensure all schema columns exist (fill missing with None)
        schema_columns = [field.name for field in schema]
        for col in schema_columns:
            if col not in df.columns:
                df[col] = None
        
        # Reorder columns to match schema
        df = df[schema_columns]
        
        return df
    
    def _dataframe_to_dict(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Convert DataFrame to JSON-serializable dict.
        
        Args:
            df: pandas DataFrame (should be single row)
            
        Returns:
            Dictionary representation
        """
        if df.empty:
            return {}
        
        # Convert to dict (first row)
        record = df.iloc[0].to_dict()
        
        # Convert non-serializable types
        result = {}
        for key, value in record.items():
            if pd.isna(value):
                result[key] = None
            elif isinstance(value, pd.Timestamp):
                result[key] = value.isoformat() + "Z"
            elif isinstance(value, (pd.Int64Dtype, pd.Float64Dtype)):
                result[key] = float(value) if pd.notna(value) else None
            else:
                result[key] = value
        
        return result
    
    def create(
        self,
        entity_type: str,
        project_id: str,
        entity_id: str,
        payload: Dict[str, Any],
        user: str,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new entity record.
        
        Args:
            entity_type: Type of entity (borelog, geological_log, lab_test)
            project_id: Project identifier
            entity_id: Entity identifier
            payload: Entity data dictionary
            user: User ID who created the record
            comment: Optional comment for history
            
        Returns:
            Dictionary with created record data and metadata
            
        Raises:
            ValueError: If entity_type is invalid or record already exists
        """
        # Validate entity type
        table_name = self._get_table_name(entity_type)
        
        # Generate record ID
        record_id = self._get_record_id(project_id, entity_type, entity_id)
        
        # Check if record already exists
        existing_metadata = self.storage.get_metadata(record_id)
        if existing_metadata:
            raise ValueError(
                f"Entity {entity_type} with id {entity_id} already exists "
                f"in project {project_id}"
            )
        
        # Ensure project_id and entity_id are in payload
        payload = payload.copy()
        payload.setdefault("project_id", project_id)
        
        # Convert payload to DataFrame
        df = self._payload_to_dataframe(payload, table_name)
        
        # Create record using versioned storage
        metadata = self.storage.create_record(
            record_id=record_id,
            dataframe=df,
            table_name=table_name,
            created_by=user,
            comment=comment or f"Created {entity_type} {entity_id} in project {project_id}"
        )
        
        # Get the created data
        df_created = self.storage.get_latest_version(record_id)
        record_data = self._dataframe_to_dict(df_created)
        
        # Return combined result
        return {
            "entity_type": entity_type,
            "project_id": project_id,
            "entity_id": entity_id,
            "data": record_data,
            "metadata": {
                "current_version": metadata["current_version"],
                "status": metadata["status"],
                "created_by": metadata["created_by"],
                "created_at": metadata["created_at"],
            }
        }
    
    def update(
        self,
        entity_type: str,
        project_id: str,
        entity_id: str,
        payload: Dict[str, Any],
        user: str,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update an existing entity record (creates new version).
        
        Args:
            entity_type: Type of entity
            project_id: Project identifier
            entity_id: Entity identifier
            payload: Updated entity data dictionary
            user: User ID who updated the record
            comment: Optional comment for history
            
        Returns:
            Dictionary with updated record data and metadata
            
        Raises:
            ValueError: If entity doesn't exist
        """
        # Validate entity type
        table_name = self._get_table_name(entity_type)
        
        # Generate record ID
        record_id = self._get_record_id(project_id, entity_type, entity_id)
        
        # Check if record exists
        existing_metadata = self.storage.get_metadata(record_id)
        if not existing_metadata:
            raise ValueError(
                f"Entity {entity_type} with id {entity_id} not found "
                f"in project {project_id}"
            )
        
        # Ensure project_id and entity_id are in payload
        payload = payload.copy()
        payload.setdefault("project_id", project_id)
        
        # Convert payload to DataFrame
        df = self._payload_to_dataframe(payload, table_name)
        
        # Update record (creates new version)
        metadata = self.storage.update_record(
            record_id=record_id,
            dataframe=df,
            updated_by=user,
            comment=comment or f"Updated {entity_type} {entity_id} to version {metadata['current_version'] + 1}"
        )
        
        # Get the updated data
        df_updated = self.storage.get_latest_version(record_id)
        record_data = self._dataframe_to_dict(df_updated)
        
        # Return combined result
        return {
            "entity_type": entity_type,
            "project_id": project_id,
            "entity_id": entity_id,
            "data": record_data,
            "metadata": {
                "current_version": metadata["current_version"],
                "status": metadata["status"],
                "created_by": metadata.get("created_by"),
                "created_at": metadata.get("created_at"),
            }
        }
    
    def get_latest(
        self,
        entity_type: str,
        project_id: str,
        entity_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get the latest version of an entity.
        
        Args:
            entity_type: Type of entity
            project_id: Project identifier
            entity_id: Entity identifier
            
        Returns:
            Dictionary with record data and metadata, or None if not found
        """
        # Generate record ID
        record_id = self._get_record_id(project_id, entity_type, entity_id)
        
        # Get metadata
        metadata = self.storage.get_metadata(record_id)
        if not metadata:
            return None
        
        # Get latest version data
        df = self.storage.get_latest_version(record_id)
        if df is None:
            return None
        
        record_data = self._dataframe_to_dict(df)
        
        return {
            "entity_type": entity_type,
            "project_id": project_id,
            "entity_id": entity_id,
            "data": record_data,
            "metadata": {
                "current_version": metadata["current_version"],
                "status": metadata["status"],
                "created_by": metadata.get("created_by"),
                "created_at": metadata.get("created_at"),
                "approved_by": metadata.get("approved_by"),
                "approved_at": metadata.get("approved_at"),
                "rejected_by": metadata.get("rejected_by"),
                "rejected_at": metadata.get("rejected_at"),
            }
        }
    
    def list_by_project(
        self,
        entity_type: str,
        project_id: str,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        List all entities of a type in a project.
        
        Args:
            entity_type: Type of entity
            project_id: Project identifier
            status: Optional status filter (draft, approved, rejected)
            
        Returns:
            List of dictionaries with entity data and metadata
        """
        records = []
        
        # Expected prefix for records in this project/entity_type
        project_prefix = f"{project_id}/{entity_type}/"
        
        # List all records (without filters first to get all)
        all_record_ids = self.storage.list_records()
        
        # Filter by project_id, entity_type, and optionally status
        for record_id in all_record_ids:
            if not record_id.startswith(project_prefix):
                continue
            
            # Extract entity_id from record_id
            entity_id = record_id[len(project_prefix):]
            
            # Get metadata to check status if filter is applied
            if status:
                metadata = self.storage.get_metadata(record_id)
                if not metadata or metadata.get("status") != status:
                    continue
            
            # Get latest version
            entity_data = self.get_latest(entity_type, project_id, entity_id)
            if entity_data:
                records.append(entity_data)
        
        return records
    
    def approve(
        self,
        entity_type: str,
        project_id: str,
        entity_id: str,
        approver: str,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Approve an entity record (updates metadata only).
        
        Args:
            entity_type: Type of entity
            project_id: Project identifier
            entity_id: Entity identifier
            approver: User ID who approved the record
            comment: Optional approval comment
            
        Returns:
            Dictionary with updated metadata
            
        Raises:
            ValueError: If entity doesn't exist or cannot be approved
        """
        # Generate record ID
        record_id = self._get_record_id(project_id, entity_type, entity_id)
        
        # Approve using versioned storage
        metadata = self.storage.approve_record(
            record_id=record_id,
            approved_by=approver,
            comment=comment or f"Approved {entity_type} {entity_id}"
        )
        
        # Get latest data
        df = self.storage.get_latest_version(record_id)
        record_data = self._dataframe_to_dict(df) if df is not None else {}
        
        return {
            "entity_type": entity_type,
            "project_id": project_id,
            "entity_id": entity_id,
            "data": record_data,
            "metadata": {
                "current_version": metadata["current_version"],
                "status": metadata["status"],
                "approved_by": metadata["approved_by"],
                "approved_at": metadata["approved_at"],
            }
        }
    
    def reject(
        self,
        entity_type: str,
        project_id: str,
        entity_id: str,
        rejector: str,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Reject an entity record (updates metadata only).
        
        Args:
            entity_type: Type of entity
            project_id: Project identifier
            entity_id: Entity identifier
            rejector: User ID who rejected the record
            comment: Optional rejection reason
            
        Returns:
            Dictionary with updated metadata
            
        Raises:
            ValueError: If entity doesn't exist or cannot be rejected
        """
        # Generate record ID
        record_id = self._get_record_id(project_id, entity_type, entity_id)
        
        # Reject using versioned storage
        metadata = self.storage.reject_record(
            record_id=record_id,
            rejected_by=rejector,
            comment=comment or f"Rejected {entity_type} {entity_id}"
        )
        
        # Get latest data
        df = self.storage.get_latest_version(record_id)
        record_data = self._dataframe_to_dict(df) if df is not None else {}
        
        return {
            "entity_type": entity_type,
            "project_id": project_id,
            "entity_id": entity_id,
            "data": record_data,
            "metadata": {
                "current_version": metadata["current_version"],
                "status": metadata["status"],
                "rejected_by": metadata["rejected_by"],
                "rejected_at": metadata["rejected_at"],
            }
        }
    
    def get_version(
        self,
        entity_type: str,
        project_id: str,
        entity_id: str,
        version: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get a specific version of an entity.
        
        Args:
            entity_type: Type of entity
            project_id: Project identifier
            entity_id: Entity identifier
            version: Version number
            
        Returns:
            Dictionary with record data, or None if version doesn't exist
        """
        # Generate record ID
        record_id = self._get_record_id(project_id, entity_type, entity_id)
        
        # Get specific version
        df = self.storage.get_specific_version(record_id, version)
        if df is None:
            return None
        
        record_data = self._dataframe_to_dict(df)
        
        # Get metadata for context
        metadata = self.storage.get_metadata(record_id)
        
        return {
            "entity_type": entity_type,
            "project_id": project_id,
            "entity_id": entity_id,
            "version": version,
            "data": record_data,
            "metadata": {
                "current_version": metadata["current_version"] if metadata else None,
                "status": metadata["status"] if metadata else None,
            }
        }
    
    def get_history(
        self,
        entity_type: str,
        project_id: str,
        entity_id: str
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Get complete history of an entity.
        
        Args:
            entity_type: Type of entity
            project_id: Project identifier
            entity_id: Entity identifier
            
        Returns:
            List of history entries, or None if entity doesn't exist
        """
        # Generate record ID
        record_id = self._get_record_id(project_id, entity_type, entity_id)
        
        # Get metadata
        metadata = self.storage.get_metadata(record_id)
        if not metadata:
            return None
        
        return metadata.get("history", [])

