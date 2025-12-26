"""
S3 Connectivity Verification

Read-only verification utility to confirm backend → S3 connectivity.
Executes once at module import (lazy initialization).
Does NOT fail the application if check fails - logs warning only.
"""

import logging
from botocore.exceptions import ClientError

from .s3_client import s3, BUCKET

logger = logging.getLogger(__name__)

# Track if verification has been performed
_verification_performed = False
_verification_result = None


def verify_s3_connectivity() -> bool:
    """
    Verify S3 bucket connectivity (read-only check).
    
    This function:
    - Performs a lightweight S3 operation (ListBucket or HeadBucket)
    - Logs connectivity status
    - Does NOT fail the application if check fails
    - Can be called multiple times (cached after first call)
    
    Returns:
        True if bucket is reachable, False otherwise
    """
    global _verification_performed, _verification_result
    
    # Return cached result if already verified
    if _verification_performed:
        return _verification_result
    
    _verification_performed = True
    
    if not BUCKET:
        logger.warning("[S3 CHECK] S3_BUCKET_NAME not configured - skipping connectivity check")
        _verification_result = False
        return False
    
    try:
        # Perform lightweight read-only check: HeadBucket
        # This is safer than ListBucket as it doesn't require ListBucket permission
        s3.head_bucket(Bucket=BUCKET)
        logger.info(f"[S3 CHECK] Bucket reachable: {BUCKET}")
        _verification_result = True
        return True
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', '')
        if error_code == '404':
            logger.warning(f"[S3 CHECK] Bucket not found: {BUCKET} (may not exist or no access)")
        elif error_code == '403':
            logger.warning(f"[S3 CHECK] Bucket access denied: {BUCKET} (check permissions)")
        else:
            logger.warning(f"[S3 CHECK] Bucket connectivity check failed: {BUCKET} - {error_code}")
        _verification_result = False
        return False
    except Exception as e:
        # Don't fail the application - just log warning
        logger.warning(f"[S3 CHECK] Bucket connectivity check failed: {BUCKET} - {str(e)}")
        _verification_result = False
        return False


# Auto-verify on module import (lazy, non-blocking)
def _lazy_verify():
    """Perform verification on first import (non-blocking)"""
    try:
        verify_s3_connectivity()
    except Exception:
        # Silently catch any errors during auto-verification
        pass

# Perform lazy verification
_lazy_verify()





