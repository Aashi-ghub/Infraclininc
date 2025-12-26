"""
Borelog Approval Logic

Handles approval of borelog versions by updating metadata only.
Approval does NOT create, move, copy, or delete any Parquet files.
"""

import json
from datetime import datetime
from typing import Dict, Any
import logging

from botocore.exceptions import ClientError

from .s3_client import s3, BUCKET, guard_against_overwrite

logger = logging.getLogger(__name__)


class BorelogApproval:
    """Handles approval of borelog versions."""

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
        Read metadata.json from S3.

        Returns:
            Metadata dictionary

        Raises:
            ValueError: If metadata doesn't exist
        """
        metadata_key = BorelogApproval._get_metadata_key(project_id, borelog_id)

        try:
            response = s3.get_object(Bucket=BUCKET, Key=metadata_key)
            metadata = json.loads(response['Body'].read().decode('utf-8'))
            logger.debug(f"Read metadata for borelog {borelog_id}: {metadata}")
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
    def _write_metadata(project_id: str, borelog_id: str, metadata: Dict[str, Any], allow_overwrite: bool = True) -> None:
        """
        Write metadata.json to S3.
        
        Args:
            project_id: Project identifier
            borelog_id: Borelog identifier
            metadata: Metadata dictionary to write
            allow_overwrite: If True, allows overwriting existing metadata (default: True)
                           Metadata updates are expected for approval tracking
        """
        metadata_key = BorelogApproval._get_metadata_key(project_id, borelog_id)

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
    def _validate_version_exists(project_id: str, borelog_id: str, version: int) -> None:
        """
        Validate that the Parquet file for the given version exists.

        Args:
            project_id: Project identifier
            borelog_id: Borelog identifier
            version: Version number to validate

        Raises:
            ValueError: If Parquet file doesn't exist
        """
        parquet_key = BorelogApproval._get_parquet_key(project_id, borelog_id, version)

        try:
            s3.head_object(Bucket=BUCKET, Key=parquet_key)
            logger.debug(f"Verified Parquet file exists for version {version}")
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            if error_code == '404' or error_code == 'NoSuchKey':
                raise ValueError(
                    f"Version {version} does not exist for borelog {borelog_id} in project {project_id}. "
                    f"Parquet file not found: {parquet_key}"
                )
            else:
                logger.error(f"Error checking Parquet file existence: {e}")
                raise
        except Exception as e:
            logger.error(f"Error validating version {version}: {e}")
            raise

    @staticmethod
    def approve_version(
        project_id: str,
        borelog_id: str,
        version: int,
        approved_by: str
    ) -> Dict[str, Any]:
        """
        Approve a borelog version by updating metadata only.

        This method does NOT:
        - Create new Parquet files
        - Move or copy objects
        - Delete any data

        It only updates the metadata.json file.

        Args:
            project_id: Project identifier
            borelog_id: Borelog identifier
            version: Version number to approve
            approved_by: User ID who is approving this version

        Returns:
            Updated metadata dictionary

        Raises:
            ValueError: If version doesn't exist or metadata is invalid
        """
        logger.info(f"[APPROVAL] Starting approval process for version {version} of borelog {borelog_id} in project {project_id}")

        # Step 1: Load metadata.json
        logger.info(f"[APPROVAL] Reading metadata for borelog {borelog_id}")
        metadata = BorelogApproval._read_metadata(project_id, borelog_id)

        # Step 2: Validate version exists (check Parquet file exists)
        logger.info(f"[APPROVAL] Validating version {version} exists")
        BorelogApproval._validate_version_exists(project_id, borelog_id, version)
        logger.info(f"[APPROVAL] Version {version} validated successfully")

        # Validate version exists in metadata versions array
        versions = metadata.get('versions', [])
        version_entry = None
        for v in versions:
            if v.get('version') == version:
                version_entry = v
                break

        if not version_entry:
            raise ValueError(
                f"Version {version} not found in metadata for borelog {borelog_id} in project {project_id}"
            )

        # Step 3: Update that version's status to APPROVED
        old_status = version_entry.get('status', 'UNKNOWN')
        version_entry['status'] = 'APPROVED'
        logger.info(f"[APPROVAL] Version {version} status changed: {old_status} → APPROVED")

        # Step 4: Set latest_approved = version
        old_latest_approved = metadata.get('latest_approved')
        metadata['latest_approved'] = version
        if old_latest_approved:
            logger.info(f"[APPROVAL] latest_approved changed: {old_latest_approved} → {version}")
        else:
            logger.info(f"[APPROVAL] latest_approved set to: {version} (first approval)")

        # Step 5: Add approved_by and approved_at
        now = datetime.utcnow().isoformat() + 'Z'
        version_entry['approved_by'] = approved_by
        version_entry['approved_at'] = now

        # Also add to top-level metadata for easy access
        metadata['approved_by'] = approved_by
        metadata['approved_at'] = now

        # Step 6: Write metadata.json back to S3 (metadata updates are allowed)
        metadata_key = BorelogApproval._get_metadata_key(project_id, borelog_id)
        logger.info(f"[APPROVAL] Updating metadata with approval information: {metadata_key}")
        logger.info(f"[METADATA UPDATE] borelog_{borelog_id} latest_approved={version}")
        BorelogApproval._write_metadata(project_id, borelog_id, metadata, allow_overwrite=True)
        logger.info(f"[METADATA UPDATE] Successfully updated metadata for borelog_{borelog_id}")

        logger.info(f"[APPROVAL] Successfully approved version {version} for borelog {borelog_id} (approved by: {approved_by})")
        return metadata

