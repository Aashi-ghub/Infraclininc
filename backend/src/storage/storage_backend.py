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
