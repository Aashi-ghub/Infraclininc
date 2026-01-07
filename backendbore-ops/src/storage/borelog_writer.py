"""
Borelog Writer - Immutable Draft Save Logic

Handles saving borelog records with immutable versioning.
Each save creates a new version directory (v1, v2, v3...) with Parquet data.
"""

import json
import os
import tempfile
from datetime import datetime
from typing import Dict, Any, List
import logging

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from botocore.exceptions import ClientError

from .s3_client import s3, BUCKET, guard_against_overwrite

logger = logging.getLogger(__name__)


class BorelogWriter:
    """Handles immutable draft saves of borelog records."""

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
        Read metadata.json from S3. Returns empty dict if file doesn't exist.
        """
        metadata_key = BorelogWriter._get_metadata_key(project_id, borelog_id)

        try:
            response = s3.get_object(Bucket=BUCKET, Key=metadata_key)
            metadata = json.loads(response['Body'].read().decode('utf-8'))
            logger.debug(f"Read metadata for borelog {borelog_id}: {metadata}")
            return metadata
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            if error_code == 'NoSuchKey':
                logger.debug(f"No metadata found for borelog {borelog_id}, initializing empty")
                return {}
            else:
                logger.error(f"Error reading metadata for borelog {borelog_id}: {e}")
                raise
        except Exception as e:
            logger.error(f"Error reading metadata for borelog {borelog_id}: {e}")
            raise

    @staticmethod
    def _write_metadata(project_id: str, borelog_id: str, metadata: Dict[str, Any], allow_overwrite: bool = True) -> None:
        """
        Write metadata.json to S3.
        
        Args:
            project_id: Project identifier
            borelog_id: Borelog identifier
            metadata: Metadata dictionary to write
            allow_overwrite: If True, allows overwriting existing metadata (default: True)
                           Metadata updates are expected for version tracking
        """
        metadata_key = BorelogWriter._get_metadata_key(project_id, borelog_id)

        # Safety guard: Only check for overwrite if not allowed
        # Metadata updates are expected, so we allow overwrites by default
        if not allow_overwrite:
            guard_against_overwrite(metadata_key, operation="write metadata")

        try:
            logger.info(f"Writing metadata for borelog {borelog_id} to S3: {metadata_key}")
            metadata_json = json.dumps(metadata, indent=2, default=str)
            s3.put_object(
                Bucket=BUCKET,
                Key=metadata_key,
                Body=metadata_json,
                ContentType='application/json'
            )
            logger.info(f"Successfully wrote metadata for borelog {borelog_id}")
        except Exception as e:
            logger.error(f"Error writing metadata for borelog {borelog_id}: {e}")
            raise

    @staticmethod
    def _write_parquet_to_temp(records: List[Dict[str, Any]]) -> str:
        """
        Write records to a temporary Parquet file in /tmp.

        Args:
            records: List of record dictionaries

        Returns:
            Path to temporary Parquet file
        """
        # Convert records to pandas DataFrame
        df = pd.DataFrame(records)

        # Create temporary file in /tmp (or system temp dir if /tmp doesn't exist)
        # On Lambda, /tmp is available; on Windows, use system temp dir
        temp_dir = '/tmp' if os.path.exists('/tmp') else tempfile.gettempdir()
        temp_fd, temp_path = tempfile.mkstemp(suffix='.parquet', dir=temp_dir)
        os.close(temp_fd)  # Close the file descriptor, we'll use the path

        try:
            # Write to Parquet with Snappy compression
            df.to_parquet(
                temp_path,
                engine='pyarrow',
                compression='snappy',
                index=False
            )
            logger.debug(f"Wrote {len(records)} records to temporary Parquet file: {temp_path}")
            return temp_path
        except Exception as e:
            # Clean up temp file on error
            try:
                os.unlink(temp_path)
            except:
                pass
            logger.error(f"Error writing Parquet to temp file: {e}")
            raise

    @staticmethod
    def _upload_parquet_from_temp(temp_path: str, s3_key: str) -> None:
        """
        Upload Parquet file from temp location to S3.
        Includes safety guard to prevent overwrites.

        Args:
            temp_path: Path to temporary Parquet file
            s3_key: S3 key to upload to
        """
        # Safety guard: Check if key exists before upload
        guard_against_overwrite(s3_key, operation="upload Parquet file")
        
        try:
            logger.info(f"[S3 WRITE] Uploading Parquet file to S3: {s3_key}")
            with open(temp_path, 'rb') as f:
                s3.put_object(
                    Bucket=BUCKET,
                    Key=s3_key,
                    Body=f,
                    ContentType='application/parquet'
                )
            logger.info(f"[S3 WRITE] Successfully uploaded Parquet file to S3: {s3_key}")
        except Exception as e:
            logger.error(f"Error uploading Parquet to S3 {s3_key}: {e}")
            raise
        finally:
            # Clean up temp file
            try:
                os.unlink(temp_path)
            except:
                pass

    @staticmethod
    def save_draft(
        project_id: str,
        borelog_id: str,
        records: List[Dict[str, Any]],
        created_by: str
    ) -> Dict[str, Any]:
        """
        Save borelog records as an immutable draft version.

        Args:
            project_id: Project identifier
            borelog_id: Borelog identifier
            records: List of record dictionaries to save
            created_by: User ID who is creating this version

        Returns:
            Updated metadata dictionary

        Raises:
            ValueError: If target Parquet key already exists
        """
        logger.info(f"[VERSION CREATION] Starting draft save for borelog {borelog_id} in project {project_id}")

        # Read existing metadata or initialize empty
        metadata = BorelogWriter._read_metadata(project_id, borelog_id)

        # Compute next version
        latest_version = metadata.get('latest_version', 0)
        next_version = latest_version + 1

        logger.info(f"[VERSION CREATION] Creating version {next_version} for borelog {borelog_id} (previous: {latest_version})")

        # Safety guard: Ensure target Parquet key doesn't exist
        # This is handled by guard_against_overwrite in _upload_parquet_from_temp
        parquet_key = BorelogWriter._get_parquet_key(project_id, borelog_id, next_version)

        # Write records to Parquet locally (/tmp)
        temp_parquet_path = None
        try:
            temp_parquet_path = BorelogWriter._write_parquet_to_temp(records)

            # Upload Parquet to versioned S3 path
            logger.info(f"[S3 WRITE] Writing Parquet file: {parquet_key}")
            BorelogWriter._upload_parquet_from_temp(temp_parquet_path, parquet_key)
            temp_parquet_path = None  # Mark as cleaned up
            logger.info(f"[S3 WRITE] Successfully wrote: {parquet_key}")

            # Update metadata
            now = datetime.utcnow().isoformat() + 'Z'

            # Initialize metadata if this is the first version
            if not metadata:
                metadata = {
                    'project_id': project_id,
                    'borelog_id': borelog_id,
                    'latest_version': 0,
                    'versions': []
                }

            # Update latest_version
            metadata['latest_version'] = next_version
            logger.info(f"[METADATA UPDATE] borelog_{borelog_id} latest_version={next_version}")

            # Add version entry to versions array
            version_entry = {
                'version': next_version,
                'status': 'DRAFT',
                'created_by': created_by,
                'created_at': now
            }
            metadata['versions'].append(version_entry)

            # Write updated metadata (metadata updates are allowed)
            metadata_key = BorelogWriter._get_metadata_key(project_id, borelog_id)
            logger.info(f"[METADATA UPDATE] Writing metadata.json: {metadata_key}")
            BorelogWriter._write_metadata(project_id, borelog_id, metadata, allow_overwrite=True)
            logger.info(f"[METADATA UPDATE] Successfully updated metadata for borelog_{borelog_id}")

            logger.info(f"[VERSION CREATION] Successfully saved draft version {next_version} for borelog {borelog_id}")
            return metadata

        except Exception as e:
            # If anything fails after creating the temp file, clean up and re-raise
            logger.error(f"Failed to save draft version {next_version} for borelog {borelog_id}: {e}")
            if temp_parquet_path:
                try:
                    os.unlink(temp_parquet_path)
                except:
                    pass
            raise
