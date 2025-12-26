import boto3
import os
import logging
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

# Read bucket name from environment variable S3_BUCKET_NAME
BUCKET = os.getenv('S3_BUCKET_NAME', '')

# Read region from environment variable AWS_REGION, default to us-east-1
region = os.getenv('AWS_REGION', 'us-east-1')

# Create S3 client (credentials are automatically handled by boto3)
s3 = boto3.client('s3', region_name=region)

# Import verification module to trigger connectivity check
try:
    from . import s3_verification  # noqa: F401
except ImportError:
    # If import fails, continue without verification (non-critical)
    pass


def check_key_exists(s3_key: str) -> bool:
    """
    Check if an S3 key exists.
    
    Args:
        s3_key: S3 key to check
        
    Returns:
        True if key exists, False otherwise
    """
    try:
        s3.head_object(Bucket=BUCKET, Key=s3_key)
        return True
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', '')
        if error_code == '404' or error_code == 'NoSuchKey':
            return False
        # Re-raise other errors
        raise
    except Exception as e:
        logger.error(f"Error checking S3 key existence for {s3_key}: {e}")
        raise


def guard_against_overwrite(s3_key: str, operation: str = "upload") -> None:
    """
    Safety guard: Check if S3 key exists before write operation.
    Aborts if key exists to prevent overwrites.
    
    Args:
        s3_key: S3 key to check
        operation: Description of the operation (for logging)
        
    Raises:
        ValueError: If key already exists
    """
    if check_key_exists(s3_key):
        error_msg = (
            f"[SAFETY GUARD] Cannot {operation} - S3 key already exists: {s3_key}. "
            "Overwrites are not allowed. This indicates a potential data integrity issue."
        )
        logger.error(error_msg)
        raise ValueError(error_msg)
    logger.debug(f"[SAFETY GUARD] Key does not exist, proceeding with {operation}: {s3_key}")
