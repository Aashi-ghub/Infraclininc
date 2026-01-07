"""
Borelog Reader - Fetch Latest Approved Data

Reads the latest approved borelog version and returns data as JSON.
Only performs ONE metadata read and ONE Parquet read.
"""

import json
import os
import tempfile
from typing import Dict, Any, List
import logging

import pandas as pd
from botocore.exceptions import ClientError

from .s3_client import s3, BUCKET

logger = logging.getLogger(__name__)


class BorelogReader:
    """Handles reading approved borelog data."""

    @staticmethod
    def _get_metadata_key(project_id: str, borelog_id: str) -> str:
        """Generate S3 key for metadata.json"""
        return f"projects/project_{project_id}/borelogs/borelog_{borelog_id}/metadata.json"

    @staticmethod
    def _get_parquet_key(project_id: str, borelog_id: str, version: int) -> str:
        """Generate S3 key for versioned Parquet file"""
        return f"projects/project_{project_id}/borelogs/borelog_{borelog_id}/v{version}/data.parquet"

    @staticmethod
    def _read_metadata(project_id: str, borelog_id: str) -> Dict[str, Any]:
        """
        Read metadata.json from S3 (ONE read only).

        Returns:
            Metadata dictionary

        Raises:
            ValueError: If metadata doesn't exist
        """
        metadata_key = BorelogReader._get_metadata_key(project_id, borelog_id)

        try:
            response = s3.get_object(Bucket=BUCKET, Key=metadata_key)
            metadata = json.loads(response['Body'].read().decode('utf-8'))
            logger.debug(f"[READ OPERATION] Metadata read from S3: {metadata_key}")
            return metadata
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            if error_code == 'NoSuchKey':
                raise ValueError(f"Metadata not found for borelog {borelog_id} in project {project_id}")
            else:
                logger.error(f"Error reading metadata for borelog {borelog_id}: {e}")
                raise
        except Exception as e:
            logger.error(f"Error reading metadata for borelog {borelog_id}: {e}")
            raise

    @staticmethod
    def _read_parquet_from_s3(project_id: str, borelog_id: str, version: int) -> pd.DataFrame:
        """
        Read Parquet file from S3 (ONE read only).

        Args:
            project_id: Project identifier
            borelog_id: Borelog identifier
            version: Version number

        Returns:
            pandas DataFrame containing the data

        Raises:
            ValueError: If Parquet file doesn't exist
        """
        parquet_key = BorelogReader._get_parquet_key(project_id, borelog_id, version)

        # Download Parquet file from S3 to temporary file
        temp_dir = '/tmp' if os.path.exists('/tmp') else tempfile.gettempdir()
        temp_fd, temp_path = tempfile.mkstemp(suffix='.parquet', dir=temp_dir)
        os.close(temp_fd)

        try:
            # Download from S3
            try:
                response = s3.get_object(Bucket=BUCKET, Key=parquet_key)
                with open(temp_path, 'wb') as f:
                    f.write(response['Body'].read())
                logger.debug(f"[READ OPERATION] Downloaded Parquet file from S3: {parquet_key}")
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', '')
                if error_code == '404' or error_code == 'NoSuchKey':
                    raise ValueError(
                        f"Parquet file not found for version {version} of borelog {borelog_id} "
                        f"in project {project_id}: {parquet_key}"
                    )
                else:
                    logger.error(f"Error downloading Parquet file: {e}")
                    raise
            except Exception as e:
                logger.error(f"Error downloading Parquet file: {e}")
                raise

            # Read Parquet file
            try:
                df = pd.read_parquet(temp_path, engine='pyarrow')
                logger.debug(f"[READ OPERATION] Parsed Parquet file: {len(df)} records")
                return df
            except Exception as e:
                logger.error(f"Error reading Parquet file: {e}")
                raise ValueError(f"Failed to read Parquet file: {e}")

        finally:
            # Clean up temp file
            try:
                os.unlink(temp_path)
            except:
                pass

    @staticmethod
    def _dataframe_to_json(df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Convert pandas DataFrame to JSON-serializable list of dictionaries.

        Args:
            df: pandas DataFrame

        Returns:
            List of dictionaries with JSON-serializable values
        """
        if df.empty:
            return []

        # Convert DataFrame to list of dictionaries
        records = df.to_dict('records')

        # Convert non-serializable types
        result = []
        for record in records:
            json_record = {}
            for key, value in record.items():
                if pd.isna(value):
                    json_record[key] = None
                elif isinstance(value, pd.Timestamp):
                    json_record[key] = value.isoformat() + 'Z'
                elif isinstance(value, (pd.Int64Dtype, pd.Float64Dtype)):
                    json_record[key] = float(value) if pd.notna(value) else None
                elif isinstance(value, (int, float)) and pd.isna(value):
                    json_record[key] = None
                else:
                    json_record[key] = value
            result.append(json_record)

        return result

    @staticmethod
    def get_latest_approved(
        project_id: str,
        borelog_id: str
    ) -> Dict[str, Any]:
        """
        Fetch the latest approved borelog data.

        This method performs:
        - ONE metadata.json read
        - ONE Parquet file read
        - No folder scanning
        - No version listing

        Args:
            project_id: Project identifier
            borelog_id: Borelog identifier

        Returns:
            Dictionary containing:
            - data: List of records (JSON-serializable)
            - version: Approved version number
            - metadata: Metadata information

        Raises:
            ValueError: If no approved version exists or data not found
        """
        logger.info(f"[READ OPERATION] Fetching latest approved data for borelog {borelog_id} in project {project_id}")

        # Step 1: Read metadata.json (ONE read)
        logger.info(f"[READ OPERATION] Reading metadata for borelog {borelog_id}")
        metadata = BorelogReader._read_metadata(project_id, borelog_id)
        logger.info(f"[READ OPERATION] Metadata read successfully")

        # Step 2: Get latest_approved version
        latest_approved = metadata.get('latest_approved')

        if latest_approved is None:
            error_msg = (
                f"No approved version found for borelog {borelog_id} in project {project_id}. "
                "The borelog has no approved versions yet."
            )
            logger.warning(f"[READ OPERATION] {error_msg}")
            raise ValueError(error_msg)

        logger.info(f"[READ OPERATION] Latest approved version: {latest_approved}")

        # Get version status from metadata
        version_status = None
        versions = metadata.get('versions', [])
        for v in versions:
            if v.get('version') == latest_approved:
                version_status = v.get('status', 'UNKNOWN')
                break
        
        logger.info(f"[READ VERIFICATION] Reading version {latest_approved} with status: {version_status}")

        # Step 3: Read corresponding v{n}/data.parquet (ONE read)
        parquet_key = BorelogReader._get_parquet_key(project_id, borelog_id, latest_approved)
        logger.info(f"[READ OPERATION] Reading Parquet file: {parquet_key}")
        df = BorelogReader._read_parquet_from_s3(project_id, borelog_id, latest_approved)
        logger.info(f"[READ OPERATION] Parquet file read successfully ({len(df)} records)")
        logger.info(f"[READ VERIFICATION] Version {latest_approved} ({version_status}) read from: {parquet_key}")

        # Step 4: Return data as JSON
        logger.info(f"[READ OPERATION] Converting data to JSON format")
        data = BorelogReader._dataframe_to_json(df)

        # Get version metadata for the approved version
        version_metadata = None
        versions = metadata.get('versions', [])
        for v in versions:
            if v.get('version') == latest_approved:
                version_metadata = v
                break

        result = {
            'data': data,
            'version': latest_approved,
            'metadata': {
                'project_id': project_id,
                'borelog_id': borelog_id,
                'latest_approved': latest_approved,
                'approved_by': metadata.get('approved_by'),
                'approved_at': metadata.get('approved_at'),
                'version_metadata': version_metadata
            }
        }

        logger.info(f"[READ OPERATION] Successfully fetched latest approved data (version {latest_approved}, {len(data)} records)")
        return result

