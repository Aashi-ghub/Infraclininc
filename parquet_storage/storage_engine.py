"""
Parquet Storage Engine

Handles reading and writing Parquet files to S3 or local filesystem.
Implements immutable writes (no overwrite) and schema validation.
"""

import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
import logging

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from botocore.exceptions import ClientError

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


class StorageMode:
    """Storage mode constants"""
    MOCK = "mock"  # Always use mock storage backend
    S3 = "s3"
    LOCAL = "local"


class ParquetStorageEngine:
    """
    Parquet storage engine supporting S3 and local filesystem modes.
    
    Features:
    - Immutable writes (no overwrite)
    - Schema validation before writing
    - Automatic path generation with timestamps
    - Support for partitioned writes
    
    Args:
        mode: Storage mode - 's3' or 'local'
        bucket_name: S3 bucket name (required for S3 mode)
        base_path: Base path for local storage or S3 prefix (default: 'parquet-data')
        aws_region: AWS region for S3 (default: 'us-east-1')
        aws_access_key_id: AWS access key (optional, uses credentials chain)
        aws_secret_access_key: AWS secret key (optional, uses credentials chain)
    """
    
    def __init__(
        self,
        mode: str = StorageMode.MOCK,
        bucket_name: Optional[str] = None,
        base_path: str = "parquet-data",
        aws_region: str = "us-east-1",
        aws_access_key_id: Optional[str] = None,
        aws_secret_access_key: Optional[str] = None,
    ):
        # Honor requested mode; default to mock if not s3/local
        normalized_mode = (mode or StorageMode.MOCK).lower()
        if normalized_mode not in {StorageMode.S3, StorageMode.LOCAL, StorageMode.MOCK}:
            normalized_mode = StorageMode.MOCK
        self.mode = normalized_mode
        self.base_path = base_path.rstrip("/")

        if self.mode == StorageMode.S3:
            if not bucket_name:
                raise ValueError("bucket_name is required for S3 mode")
            self.bucket_name = bucket_name
            self.aws_region = aws_region
            self.aws_access_key_id = aws_access_key_id
            self.aws_secret_access_key = aws_secret_access_key
            logger.info("Initialized S3 storage engine", extra={"bucket": bucket_name, "base_path": self.base_path})
        else:
            # LOCAL or MOCK both use local filesystem; keep mock_s3 path for compatibility
            Path(MOCK_S3_ROOT).mkdir(parents=True, exist_ok=True)
            logger.info("Initialized local/mock storage engine using filesystem", extra={"root": MOCK_S3_ROOT})
    
    def _generate_unique_path(self, base_path: str, filename: str) -> str:
        """
        Generate a unique path with timestamp and UUID to prevent overwrites.
        
        Args:
            base_path: Base directory/prefix path
            filename: Desired filename (without extension)
            
        Returns:
            Full path with timestamp and UUID suffix
        """
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        safe_filename = filename.replace("/", "_").replace("\\", "_")
        full_filename = f"{safe_filename}_{timestamp}_{unique_id}.parquet"
        
        if self.mode == StorageMode.S3:
            return f"{base_path}/{full_filename}"
        else:
            return str(Path(base_path) / full_filename)
    
    def _ensure_local_directory(self, file_path: str) -> None:
        """Ensure the directory for a local file path exists."""
        directory = Path(file_path).parent
        directory.mkdir(parents=True, exist_ok=True)
    
    def _mock_path_exists(self, mock_path: str) -> bool:
        """Check if a file exists in mock storage."""
        try:
            read_file(mock_path)
            return True
        except FileNotFoundError:
            return False
    
    def write_parquet(
        self,
        path: str,
        dataframe: pd.DataFrame,
        expected_schema: Optional[pa.Schema] = None,
        partition_cols: Optional[list] = None,
        overwrite: bool = False,
    ) -> str:
        """
        Write a pandas DataFrame to Parquet format.
        
        This function implements immutable writes by default - it will not
        overwrite existing files. Use overwrite=True to allow overwrites.
        
        Args:
            path: Target path (relative to base_path). For partitioned writes,
                  this should be a directory path without filename.
            dataframe: pandas DataFrame to write
            expected_schema: Optional PyArrow schema for validation
            partition_cols: Optional list of column names to partition by
            overwrite: If True, allow overwriting existing files (default: False)
            
        Returns:
            Full path to the written Parquet file(s)
            
        Raises:
            ValueError: If schema validation fails
            FileExistsError: If file exists and overwrite=False
            IOError: If write operation fails
        """
        if dataframe.empty:
            raise ValueError("Cannot write empty DataFrame")
        
        # Validate schema if provided
        if expected_schema:
            self.validate_schema(dataframe, expected_schema)
        
        # Generate full path
        if partition_cols:
            # For partitioned writes, path is a directory
            full_path = f"{self.base_path}/{path.rstrip('/')}"
        else:
            # For single file writes, generate unique filename
            filename = Path(path).stem or "data"
            full_path = self._generate_unique_path(
                f"{self.base_path}/{Path(path).parent}",
                filename
            )
        
        try:
            if self.mode == StorageMode.S3:
                return self._write_to_s3(full_path, dataframe, partition_cols, overwrite)
            elif self.mode == StorageMode.LOCAL:
                return self._write_to_local(full_path, dataframe, partition_cols, overwrite)
            else:
                return self._write_to_mock(
                    full_path, dataframe, partition_cols, overwrite
                )
        
        except Exception as e:
            logger.error(f"Failed to write Parquet file: {e}", exc_info=True)
            raise IOError(f"Failed to write Parquet file: {e}") from e
    
    def _write_to_mock(
        self,
        mock_path: str,
        dataframe: pd.DataFrame,
        partition_cols: Optional[list],
        overwrite: bool,
    ) -> str:
        """Write DataFrame to mock storage as Parquet."""
        # Check if file exists (for non-partitioned writes)
        if not partition_cols and not overwrite:
            if self._mock_path_exists(mock_path):
                raise FileExistsError(
                    f"File already exists at {mock_path}. "
                    "Set overwrite=True to overwrite."
                )

        # Convert to PyArrow table
        table = pa.Table.from_pandas(dataframe)

        # Write to temporary local file first
        temp_file = f"/tmp/parquet_temp_{uuid.uuid4()}.parquet"
        try:
            if partition_cols:
                # Partitioned write
                pq.write_to_dataset(
                    table,
                    temp_file,
                    partition_cols=partition_cols,
                    use_dictionary=True,
                    compression="snappy",
                )

                # Upload directory to mock storage
                self._upload_directory_to_mock(temp_file, mock_path)
                return mock_path

            else:
                # Single file write
                pq.write_table(
                    table,
                    temp_file,
                    use_dictionary=True,
                    compression="snappy",
                )

                # Read the temp file and write to mock storage
                with open(temp_file, "rb") as f:
                    file_data = f.read()
                write_file(mock_path, file_data)
                return mock_path

        finally:
            # Clean up temp file
            if os.path.exists(temp_file):
                if os.path.isdir(temp_file):
                    import shutil
                    shutil.rmtree(temp_file)
                else:
                    os.remove(temp_file)
    
    def _write_to_local(
        self,
        file_path: str,
        dataframe: pd.DataFrame,
        partition_cols: Optional[list],
        overwrite: bool,
    ) -> str:
        """Write DataFrame to local filesystem as Parquet."""
        # Check if file exists (for non-partitioned writes)
        if not partition_cols and not overwrite:
            if self._local_path_exists(file_path):
                raise FileExistsError(
                    f"File already exists at {file_path}. "
                    "Set overwrite=True to overwrite."
                )
        
        # Ensure directory exists
        self._ensure_local_directory(file_path)
        
        # Convert to PyArrow table
        table = pa.Table.from_pandas(dataframe)
        
        # Write Parquet file
        if partition_cols:
            # Partitioned write
            pq.write_to_dataset(
                table,
                file_path,
                partition_cols=partition_cols,
                use_dictionary=True,
                compression="snappy",
            )
        else:
            # Single file write
            pq.write_table(
                table,
                file_path,
                use_dictionary=True,
                compression="snappy",
            )
        
        return file_path

    def _write_to_s3(
        self,
        s3_path: str,
        dataframe: pd.DataFrame,
        partition_cols: Optional[list],
        overwrite: bool,
    ) -> str:
        """Write DataFrame to S3 using pyarrow -> bytes."""
        if partition_cols:
            raise NotImplementedError("Partitioned writes to S3 not implemented")

        table = pa.Table.from_pandas(dataframe)
        output_buffer = pa.BufferOutputStream()
        pq.write_table(table, output_buffer, use_dictionary=True, compression="snappy")
        data = output_buffer.getvalue().to_pybytes()

        import boto3

        s3 = boto3.client(
          "s3",
          region_name=self.aws_region,
          aws_access_key_id=self.aws_access_key_id,
          aws_secret_access_key=self.aws_secret_access_key,
        )

        key = s3_path.lstrip("/")

        if not overwrite:
            try:
                s3.head_object(Bucket=self.bucket_name, Key=key)
                raise FileExistsError(f"File already exists at s3://{self.bucket_name}/{key}")
            except ClientError as e:
                if e.response["Error"]["Code"] != "404":
                    raise

        s3.put_object(
            Bucket=self.bucket_name,
            Key=key,
            Body=data,
            ContentType="application/octet-stream"
        )

        return f"s3://{self.bucket_name}/{key}"
    
    def _upload_directory_to_mock(self, local_dir: str, mock_prefix: str) -> None:
        """Upload a directory tree to mock storage."""
        for root, dirs, files in os.walk(local_dir):
            for file in files:
                local_path = os.path.join(root, file)
                relative_path = os.path.relpath(local_path, local_dir)
                mock_key = f"{mock_prefix}/{relative_path}".replace("\\", "/")

                with open(local_path, "rb") as f:
                    file_data = f.read()
                write_file(mock_key, file_data)
    
    def read_parquet(self, path: str, filters: Optional[list] = None) -> pd.DataFrame:
        """
        Read a Parquet file or directory from storage.
        
        Args:
            path: Path to Parquet file or directory (relative to base_path)
            filters: Optional list of PyArrow filter expressions for predicate pushdown
            
        Returns:
            pandas DataFrame containing the data
            
        Raises:
            FileNotFoundError: If file does not exist
            IOError: If read operation fails
        """
        full_path = f"{self.base_path}/{path.lstrip('/')}"
        
        try:
            if self.mode == StorageMode.S3:
                return self._read_from_s3(full_path, filters)
            else:
                return self._read_from_mock(full_path, filters)
        
        except Exception as e:
            logger.error(f"Failed to read Parquet file: {e}", exc_info=True)
            raise IOError(f"Failed to read Parquet file: {e}") from e
    
    def _read_from_mock(self, mock_path: str, filters: Optional[list]) -> pd.DataFrame:
        """Read Parquet file from mock storage."""
        if not self._mock_path_exists(mock_path):
            raise FileNotFoundError(f"File not found: {mock_path}")

        # Read file data from mock storage
        file_data = read_file(mock_path)

        # Write to temp file and read with pandas
        temp_file = f"/tmp/parquet_read_{uuid.uuid4()}.parquet"
        try:
            with open(temp_file, "wb") as f:
                f.write(file_data)
            return pd.read_parquet(temp_file, filters=filters)
        finally:
            if os.path.exists(temp_file):
                os.remove(temp_file)

    def _read_from_s3(self, s3_path: str, filters: Optional[list]) -> pd.DataFrame:
        """Read Parquet file from S3."""
        import boto3
        from io import BytesIO

        s3 = boto3.client(
            "s3",
            region_name=self.aws_region,
            aws_access_key_id=self.aws_access_key_id,
            aws_secret_access_key=self.aws_secret_access_key,
        )

        key = s3_path.lstrip("/")
        obj = s3.get_object(Bucket=self.bucket_name, Key=key)
        body = obj["Body"].read()

        with BytesIO(body) as bio:
            return pd.read_parquet(bio, filters=filters)
    
    @staticmethod
    def validate_schema(dataframe: pd.DataFrame, expected_schema: pa.Schema) -> None:
        """
        Validate that a DataFrame matches the expected PyArrow schema.
        
        Args:
            dataframe: pandas DataFrame to validate
            expected_schema: PyArrow schema to validate against
            
        Raises:
            ValueError: If schema validation fails
        """
        # Convert DataFrame to PyArrow table
        actual_table = pa.Table.from_pandas(dataframe)
        actual_schema = actual_table.schema
        
        # Check field count
        if len(actual_schema) != len(expected_schema):
            raise ValueError(
                f"Schema field count mismatch: expected {len(expected_schema)} fields, "
                f"got {len(actual_schema)} fields"
            )
        
        # Check each field
        errors = []
        for expected_field, actual_field in zip(expected_schema, actual_schema):
            if expected_field.name != actual_field.name:
                errors.append(
                    f"Field name mismatch: expected '{expected_field.name}', "
                    f"got '{actual_field.name}'"
                )
            
            # Check type compatibility
            if not _types_compatible(expected_field.type, actual_field.type):
                errors.append(
                    f"Field '{expected_field.name}' type mismatch: "
                    f"expected {expected_field.type}, got {actual_field.type}"
                )
            
            # Check nullability
            if expected_field.nullable != actual_field.nullable:
                errors.append(
                    f"Field '{expected_field.name}' nullability mismatch: "
                    f"expected nullable={expected_field.nullable}, "
                    f"got nullable={actual_field.nullable}"
                )
        
        if errors:
            error_msg = "Schema validation failed:\n" + "\n".join(f"  - {e}" for e in errors)
            raise ValueError(error_msg)
        
        logger.debug(f"Schema validation passed for {len(expected_schema)} fields")


def _types_compatible(expected_type: pa.DataType, actual_type: pa.DataType) -> bool:
    """Check if two PyArrow types are compatible."""
    # Exact match
    if expected_type == actual_type:
        return True
    
    # Handle string types (string vs large_string)
    if pa.types.is_string(expected_type) and pa.types.is_string(actual_type):
        return True
    
    # Handle numeric types (int32 vs int64, float32 vs float64)
    if pa.types.is_integer(expected_type) and pa.types.is_integer(actual_type):
        return True
    
    if pa.types.is_floating(expected_type) and pa.types.is_floating(actual_type):
        return True
    
    # Handle timestamp types
    if pa.types.is_timestamp(expected_type) and pa.types.is_timestamp(actual_type):
        return True
    
    return False

