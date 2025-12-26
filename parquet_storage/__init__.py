"""
Parquet Storage Engine for Infrastructure Logging System

A pure data layer for storing borelogs, geological logs, and lab tests
in Parquet format on S3 or local filesystem.

This module provides:
- Immutable Parquet write operations (no overwrite)
- Schema validation before writing
- Support for S3 (production) and local filesystem (testing)
- Versioning and approval metadata support
- Clean separation from Node.js API layer
"""

from .storage_engine import ParquetStorageEngine
from .schemas import SchemaRegistry, get_schema
from .versioned_storage import VersionedParquetStorage, RecordStatus
from .repository import ParquetRepository, EntityType
from .lambda_handler import lambda_handler, LambdaHandler
from .csv_ingestion import CSVIngestionEngine, CSVIngestionResult, ValidationError

__version__ = "1.4.0"
__all__ = [
    "ParquetStorageEngine",
    "VersionedParquetStorage",
    "ParquetRepository",
    "LambdaHandler",
    "lambda_handler",
    "CSVIngestionEngine",
    "CSVIngestionResult",
    "ValidationError",
    "SchemaRegistry",
    "get_schema",
    "RecordStatus",
    "EntityType",
]

