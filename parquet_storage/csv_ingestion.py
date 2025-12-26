"""
CSV Ingestion Module for Parquet Storage

Handles bulk CSV uploads with:
- Pandas CSV parsing
- Row-by-row schema validation
- Valid/invalid row separation
- Parquet conversion with versioning
- Detailed error reporting

Key Principles:
- No data loss - All rows processed
- No overwrite - Creates new versions
- Existing approved data remains intact
"""

import pandas as pd
import pyarrow as pa
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import logging

from .versioned_storage import VersionedParquetStorage
from .schemas import get_schema
from .storage_engine import ParquetStorageEngine

logger = logging.getLogger(__name__)


class ValidationError:
    """Represents a validation error for a single row."""
    
    def __init__(self, row_index: int, field: str, value: Any, error: str):
        self.row_index = row_index  # 0-based index (excluding header)
        self.field = field
        self.value = value
        self.error = error
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "row": self.row_index + 1,  # 1-based for user display
            "field": self.field,
            "value": str(self.value) if self.value is not None else None,
            "error": self.error
        }


class CSVIngestionResult:
    """Result of CSV ingestion operation."""
    
    def __init__(
        self,
        total_rows: int,
        valid_rows: int,
        invalid_rows: int,
        errors: List[ValidationError],
        record_id: Optional[str] = None,
        version: Optional[int] = None,
        file_path: Optional[str] = None
    ):
        self.total_rows = total_rows
        self.valid_rows = valid_rows
        self.invalid_rows = invalid_rows
        self.errors = errors
        self.record_id = record_id
        self.version = version
        self.file_path = file_path
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "success": self.invalid_rows == 0,
            "total_rows": self.total_rows,
            "valid_rows": self.valid_rows,
            "invalid_rows": self.invalid_rows,
            "record_id": self.record_id,
            "version": self.version,
            "file_path": self.file_path,
            "errors": [error.to_dict() for error in self.errors],
            "error_summary": self._generate_error_summary()
        }
    
    def _generate_error_summary(self) -> Dict[str, Any]:
        """Generate summary of errors by field."""
        summary = {}
        for error in self.errors:
            if error.field not in summary:
                summary[error.field] = {
                    "count": 0,
                    "errors": []
                }
            summary[error.field]["count"] += 1
            summary[error.field]["errors"].append({
                "row": error.row_index + 1,
                "error": error.error
            })
        return summary


class CSVIngestionEngine:
    """
    CSV Ingestion Engine for bulk data uploads.
    
    Features:
    - CSV parsing with pandas
    - Schema validation
    - Valid/invalid row separation
    - Parquet conversion with versioning
    - Detailed error reporting
    """
    
    def __init__(self, versioned_storage: VersionedParquetStorage):
        """
        Initialize CSV ingestion engine.
        
        Args:
            versioned_storage: VersionedParquetStorage instance
        """
        self.storage = versioned_storage
    
    def ingest_csv(
        self,
        csv_file_path: str,
        table_name: str,
        project_id: str,
        entity_type: str,
        entity_id: str,
        user_id: str,
        comment: Optional[str] = None,
        skip_errors: bool = True,
        chunk_size: Optional[int] = None
    ) -> CSVIngestionResult:
        """
        Ingest CSV file into Parquet storage.
        
        Args:
            csv_file_path: Path to CSV file
            table_name: Table name for schema validation
            project_id: Project identifier
            entity_type: Entity type (e.g., 'borelog', 'geological_log', 'lab_test')
            entity_id: Entity identifier
            user_id: User ID performing the upload
            comment: Optional comment for history
            skip_errors: If True, continue processing after errors (default: True)
            chunk_size: Process in chunks of this size (None = process all at once)
            
        Returns:
            CSVIngestionResult with validation results and errors
        """
        logger.info(f"Starting CSV ingestion: {csv_file_path}, table: {table_name}")
        
        # Construct record_id using repository format: {project_id}/{entity_type}/{entity_id}
        record_id = f"{project_id}/{entity_type}/{entity_id}"
        
        # Get schema
        schema = get_schema(table_name)
        if not schema:
            raise ValueError(f"No schema found for table: {table_name}")
        
        # Read CSV file
        try:
            df = pd.read_csv(csv_file_path)
        except Exception as e:
            raise ValueError(f"Failed to read CSV file: {e}")
        
        total_rows = len(df)
        logger.info(f"CSV file contains {total_rows} rows")
        
        if total_rows == 0:
            return CSVIngestionResult(
                total_rows=0,
                valid_rows=0,
                invalid_rows=0,
                errors=[],
                record_id=record_id
            )
        
        # Validate and separate rows
        valid_rows, invalid_rows, errors = self._validate_and_separate_rows(
            df, schema, skip_errors
        )
        
        logger.info(f"Validation complete: {len(valid_rows)} valid, {len(invalid_rows)} invalid")
        
        # If no valid rows, return error result
        if len(valid_rows) == 0:
            return CSVIngestionResult(
                total_rows=total_rows,
                valid_rows=0,
                invalid_rows=len(invalid_rows),
                errors=errors,
                record_id=record_id
            )
        
        # Convert valid rows to DataFrame
        valid_df = pd.DataFrame(valid_rows)
        
        # Check if record exists
        existing_metadata = self.storage.get_metadata(record_id)
        
        if existing_metadata:
            # Update existing record (creates new version)
            metadata = self.storage.update_record(
                record_id=record_id,
                dataframe=valid_df,
                updated_by=user_id,
                comment=comment or f"Bulk CSV upload: {len(valid_rows)} rows, {len(invalid_rows)} errors"
            )
            version = metadata["current_version"]
        else:
            # Create new record
            metadata = self.storage.create_record(
                record_id=record_id,
                dataframe=valid_df,
                table_name=table_name,
                created_by=user_id,
                comment=comment or f"Bulk CSV upload: {len(valid_rows)} rows, {len(invalid_rows)} errors"
            )
            version = metadata["current_version"]
        
        # Get file path
        file_path = self.storage._get_version_file_path(record_id, version)
        
        return CSVIngestionResult(
            total_rows=total_rows,
            valid_rows=len(valid_rows),
            invalid_rows=len(invalid_rows),
            errors=errors,
            record_id=record_id,
            version=version,
            file_path=file_path
        )
    
    def _validate_and_separate_rows(
        self,
        df: pd.DataFrame,
        schema: pa.Schema,
        skip_errors: bool
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[ValidationError]]:
        """
        Validate rows and separate into valid and invalid.
        
        Args:
            df: pandas DataFrame
            schema: PyArrow schema for validation
            skip_errors: If True, continue after errors
            
        Returns:
            Tuple of (valid_rows, invalid_rows, errors)
        """
        valid_rows = []
        invalid_rows = []
        errors = []
        
        schema_fields = {field.name: field for field in schema}
        
        for idx, row in df.iterrows():
            row_dict = row.to_dict()
            row_errors = []
            
            # Validate each field
            for field_name, field in schema_fields.items():
                value = row_dict.get(field_name)
                
                # Check required fields
                if not field.nullable and (value is None or pd.isna(value)):
                    row_errors.append(ValidationError(
                        row_index=idx,
                        field=field_name,
                        value=value,
                        error=f"Required field is missing or null"
                    ))
                    continue
                
                # Skip validation if value is None/nullable
                if value is None or pd.isna(value):
                    continue
                
                # Type validation
                type_error = self._validate_field_type(field_name, field.type, value)
                if type_error:
                    row_errors.append(ValidationError(
                        row_index=idx,
                        field=field_name,
                        value=value,
                        error=type_error
                    ))
            
            # Handle row based on errors
            if row_errors:
                invalid_rows.append(row_dict)
                errors.extend(row_errors)
                
                if not skip_errors:
                    # Stop processing on first error
                    break
            else:
                # Transform row for Parquet (handle types, nulls, etc.)
                transformed_row = self._transform_row_for_parquet(row_dict, schema_fields)
                valid_rows.append(transformed_row)
        
        return valid_rows, invalid_rows, errors
    
    def _validate_field_type(self, field_name: str, field_type: pa.DataType, value: Any) -> Optional[str]:
        """
        Validate field type.
        
        Args:
            field_name: Field name
            field_type: PyArrow field type
            value: Value to validate
            
        Returns:
            Error message if invalid, None if valid
        """
        # Handle pandas NaN
        if pd.isna(value):
            return None  # Handled by nullable check
        
        # String types
        if pa.types.is_string(field_type):
            if not isinstance(value, (str, int, float)):
                return f"Expected string, got {type(value).__name__}"
            return None
        
        # Integer types
        if pa.types.is_integer(field_type):
            try:
                int(value)
                return None
            except (ValueError, TypeError):
                return f"Expected integer, got {type(value).__name__}: {value}"
        
        # Floating point types
        if pa.types.is_floating(field_type):
            try:
                float(value)
                return None
            except (ValueError, TypeError):
                return f"Expected float, got {type(value).__name__}: {value}"
        
        # Boolean types
        if pa.types.is_boolean(field_type):
            if isinstance(value, bool):
                return None
            if str(value).lower() in ['true', 'false', '1', '0', 'yes', 'no']:
                return None
            return f"Expected boolean, got {type(value).__name__}: {value}"
        
        # Timestamp types
        if pa.types.is_timestamp(field_type):
            if isinstance(value, (datetime, pd.Timestamp)):
                return None
            # Try to parse as ISO string
            try:
                pd.to_datetime(value)
                return None
            except (ValueError, TypeError):
                return f"Expected timestamp, got {type(value).__name__}: {value}"
        
        # List types
        if pa.types.is_list(field_type):
            if isinstance(value, (list, tuple)):
                return None
            # Try to parse as JSON string
            try:
                import json
                parsed = json.loads(value) if isinstance(value, str) else value
                if isinstance(parsed, list):
                    return None
            except:
                pass
            return f"Expected list, got {type(value).__name__}: {value}"
        
        # Default: allow if no specific validation
        return None
    
    def _transform_row_for_parquet(
        self,
        row_dict: Dict[str, Any],
        schema_fields: Dict[str, pa.Field]
    ) -> Dict[str, Any]:
        """
        Transform row dictionary for Parquet storage.
        
        Args:
            row_dict: Row dictionary from CSV
            schema_fields: Schema fields dictionary
            
        Returns:
            Transformed row dictionary
        """
        transformed = {}
        
        for field_name, field in schema_fields.items():
            value = row_dict.get(field_name)
            
            # Handle None/NaN
            if value is None or pd.isna(value):
                transformed[field_name] = None
                continue
            
            # Type conversions
            if pa.types.is_integer(field.type):
                try:
                    transformed[field_name] = int(value)
                except (ValueError, TypeError):
                    transformed[field_name] = None
            
            elif pa.types.is_floating(field.type):
                try:
                    transformed[field_name] = float(value)
                except (ValueError, TypeError):
                    transformed[field_name] = None
            
            elif pa.types.is_boolean(field.type):
                if isinstance(value, bool):
                    transformed[field_name] = value
                else:
                    str_val = str(value).lower()
                    transformed[field_name] = str_val in ['true', '1', 'yes']
            
            elif pa.types.is_timestamp(field.type):
                if isinstance(value, (datetime, pd.Timestamp)):
                    transformed[field_name] = value
                else:
                    try:
                        transformed[field_name] = pd.to_datetime(value)
                    except:
                        transformed[field_name] = None
            
            elif pa.types.is_list(field.type):
                if isinstance(value, (list, tuple)):
                    transformed[field_name] = list(value)
                elif isinstance(value, str):
                    try:
                        import json
                        transformed[field_name] = json.loads(value)
                    except:
                        transformed[field_name] = [value]
                else:
                    transformed[field_name] = [value]
            
            elif pa.types.is_string(field.type):
                # Convert to string
                transformed[field_name] = str(value) if value is not None else None
            
            else:
                # Default: keep as-is
                transformed[field_name] = value
        
        return transformed
    
    def ingest_csv_from_string(
        self,
        csv_content: str,
        table_name: str,
        project_id: str,
        entity_type: str,
        entity_id: str,
        user_id: str,
        comment: Optional[str] = None,
        skip_errors: bool = True
    ) -> CSVIngestionResult:
        """
        Ingest CSV from string content.
        
        Args:
            csv_content: CSV content as string
            table_name: Table name for schema validation
            project_id: Project identifier
            entity_type: Entity type (e.g., 'borelog', 'geological_log', 'lab_test')
            entity_id: Entity identifier
            user_id: User ID performing the upload
            comment: Optional comment for history
            skip_errors: If True, continue processing after errors
            
        Returns:
            CSVIngestionResult with validation results and errors
        """
        import io
        
        # Construct record_id using repository format: {project_id}/{entity_type}/{entity_id}
        record_id = f"{project_id}/{entity_type}/{entity_id}"
        
        # Read CSV from string
        try:
            df = pd.read_csv(io.StringIO(csv_content))
        except Exception as e:
            raise ValueError(f"Failed to parse CSV content: {e}")
        
        # Get schema
        schema = get_schema(table_name)
        if not schema:
            raise ValueError(f"No schema found for table: {table_name}")
        
        total_rows = len(df)
        
        if total_rows == 0:
            return CSVIngestionResult(
                total_rows=0,
                valid_rows=0,
                invalid_rows=0,
                errors=[],
                record_id=record_id
            )
        
        # Validate and separate rows
        valid_rows, invalid_rows, errors = self._validate_and_separate_rows(
            df, schema, skip_errors
        )
        
        # If no valid rows, return error result
        if len(valid_rows) == 0:
            return CSVIngestionResult(
                total_rows=total_rows,
                valid_rows=0,
                invalid_rows=len(invalid_rows),
                errors=errors,
                record_id=record_id
            )
        
        # Convert valid rows to DataFrame
        valid_df = pd.DataFrame(valid_rows)
        
        # Check if record exists
        existing_metadata = self.storage.get_metadata(record_id)
        
        if existing_metadata:
            # Update existing record (creates new version)
            metadata = self.storage.update_record(
                record_id=record_id,
                dataframe=valid_df,
                updated_by=user_id,
                comment=comment or f"Bulk CSV upload: {len(valid_rows)} rows, {len(invalid_rows)} errors"
            )
            version = metadata["current_version"]
        else:
            # Create new record
            metadata = self.storage.create_record(
                record_id=record_id,
                dataframe=valid_df,
                table_name=table_name,
                created_by=user_id,
                comment=comment or f"Bulk CSV upload: {len(valid_rows)} rows, {len(invalid_rows)} errors"
            )
            version = metadata["current_version"]
        
        # Get file path
        file_path = self.storage._get_version_file_path(record_id, version)
        
        return CSVIngestionResult(
            total_rows=total_rows,
            valid_rows=len(valid_rows),
            invalid_rows=len(invalid_rows),
            errors=errors,
            record_id=record_id,
            version=version,
            file_path=file_path
        )

