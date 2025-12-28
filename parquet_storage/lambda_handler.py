"""
AWS Lambda Handler for Parquet Repository

Provides HTTP API endpoint that wraps the ParquetRepository layer.
Handles API Gateway events and routes to repository methods.

Actions:
- create: Create new entity
- update: Update existing entity
- get: Get latest version of entity
- approve: Approve entity
- reject: Reject entity
- list: List entities by project
- get_version: Get specific version
- get_history: Get entity history
"""

import json
import logging
import os
from typing import Dict, Any, Optional
from datetime import datetime

from .storage_engine import ParquetStorageEngine
from .storage_engine import StorageMode
from .versioned_storage import VersionedParquetStorage
from .repository import ParquetRepository, EntityType
import boto3
import json

logger = logging.getLogger()
logger.setLevel(logging.INFO)


class LambdaHandler:
    """
    Lambda handler for Parquet Repository API.
    
    Handles API Gateway events and routes to repository methods.
    """
    
    def __init__(self):
        """Initialize repository with storage configuration."""
        # Get configuration from environment variables
        storage_mode = os.environ.get("STORAGE_MODE", "local")
        base_path = os.environ.get("BASE_PATH", "parquet-data")
        bucket_name = os.environ.get("S3_BUCKET_NAME")
        aws_region = os.environ.get("AWS_REGION", "us-east-1")
        
        # Initialize storage engine
        if storage_mode == "s3":
            if not bucket_name:
                raise ValueError("S3_BUCKET_NAME environment variable required for S3 mode")
            base_storage = ParquetStorageEngine(
                mode="s3",
                bucket_name=bucket_name,
                base_path=base_path,
                aws_region=aws_region
            )
        else:
            base_storage = ParquetStorageEngine(
                mode="local",
                base_path=base_path
            )
        
        # Initialize versioned storage and repository
        versioned_storage = VersionedParquetStorage(base_storage)
        self.repository = ParquetRepository(versioned_storage)
        self.storage_engine = base_storage
    
    def _parse_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse API Gateway event to extract request data.
        
        Supports both API Gateway REST API and HTTP API formats.
        
        Args:
            event: Lambda event from API Gateway
            
        Returns:
            Parsed request data
        """
        # Check if it's an API Gateway event
        if "httpMethod" in event or "requestContext" in event:
            # API Gateway REST API or HTTP API
            http_method = event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method", "POST")
            
            # Parse body
            body = event.get("body", "{}")
            if isinstance(body, str):
                try:
                    body = json.loads(body)
                except json.JSONDecodeError:
                    body = {}
            
            # Get path parameters or query parameters
            path_params = event.get("pathParameters") or {}
            query_params = event.get("queryStringParameters") or {}
            
            return {
                "action": body.get("action") or query_params.get("action"),
                "entity_type": body.get("entity_type") or path_params.get("entity_type") or query_params.get("entity_type"),
                "project_id": body.get("project_id") or path_params.get("project_id") or query_params.get("project_id"),
                "entity_id": body.get("entity_id") or path_params.get("entity_id") or query_params.get("entity_id"),
                "payload": body.get("payload") or body.get("data") or {},
                "user": body.get("user") or body.get("created_by") or body.get("updated_by"),
                "approver": body.get("approver") or body.get("approved_by"),
                "rejector": body.get("rejector") or body.get("rejected_by"),
                "comment": body.get("comment"),
                "version": body.get("version") or query_params.get("version"),
                "status": body.get("status") or query_params.get("status"),
            }
        
        else:
            # Direct invocation (for testing)
            return {
                "action": event.get("action"),
                "entity_type": event.get("entity_type"),
                "project_id": event.get("project_id"),
                "entity_id": event.get("entity_id"),
                "payload": event.get("payload") or event.get("data") or {},
                "user": event.get("user") or event.get("created_by") or event.get("updated_by"),
                "approver": event.get("approver") or event.get("approved_by"),
                "rejector": event.get("rejector") or event.get("rejected_by"),
                "comment": event.get("comment"),
                "version": event.get("version"),
                "status": event.get("status"),
                # passthrough fields for save_stratum and other direct invokes
                "borelog_id": event.get("borelog_id"),
                "version_no": event.get("version_no"),
                "stratum_metadata_key": event.get("stratum_metadata_key"),
                "stratum_data_key": event.get("stratum_data_key"),
                "layers": event.get("layers"),
                "user_id": event.get("user_id"),
            }
    
    def _create_response(
        self,
        status_code: int,
        body: Dict[str, Any],
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Create API Gateway response format.
        
        Args:
            status_code: HTTP status code
            body: Response body dictionary
            headers: Optional headers dictionary
            
        Returns:
            API Gateway response format
        """
        default_headers = {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        }
        
        if headers:
            default_headers.update(headers)
        
        return {
            "statusCode": status_code,
            "headers": default_headers,
            "body": json.dumps(body, default=str)
        }
    
    def _handle_create(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle create action."""
        entity_type = request.get("entity_type")
        project_id = request.get("project_id")
        entity_id = request.get("entity_id")
        payload = request.get("payload", {})
        user = request.get("user")
        comment = request.get("comment")
        
        if not all([entity_type, project_id, entity_id, user]):
            return self._create_response(400, {
                "error": "Missing required fields",
                "required": ["entity_type", "project_id", "entity_id", "user"]
            })
        
        try:
            result = self.repository.create(
                entity_type=entity_type,
                project_id=project_id,
                entity_id=entity_id,
                payload=payload,
                user=user,
                comment=comment
            )
            return self._create_response(201, {"success": True, "data": result})
        
        except ValueError as e:
            return self._create_response(400, {"error": str(e)})
        except Exception as e:
            logger.error(f"Error creating entity: {e}", exc_info=True)
            return self._create_response(500, {"error": "Internal server error"})
    
    def _handle_update(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle update action."""
        entity_type = request.get("entity_type")
        project_id = request.get("project_id")
        entity_id = request.get("entity_id")
        payload = request.get("payload", {})
        user = request.get("user")
        comment = request.get("comment")
        
        if not all([entity_type, project_id, entity_id, user]):
            return self._create_response(400, {
                "error": "Missing required fields",
                "required": ["entity_type", "project_id", "entity_id", "user"]
            })
        
        try:
            result = self.repository.update(
                entity_type=entity_type,
                project_id=project_id,
                entity_id=entity_id,
                payload=payload,
                user=user,
                comment=comment
            )
            return self._create_response(200, {"success": True, "data": result})
        
        except ValueError as e:
            return self._create_response(400, {"error": str(e)})
        except Exception as e:
            logger.error(f"Error updating entity: {e}", exc_info=True)
            return self._create_response(500, {"error": "Internal server error"})
    
    def _handle_get(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle get action (get latest version)."""
        entity_type = request.get("entity_type")
        project_id = request.get("project_id")
        entity_id = request.get("entity_id")
        
        if not all([entity_type, project_id, entity_id]):
            return self._create_response(400, {
                "error": "Missing required fields",
                "required": ["entity_type", "project_id", "entity_id"]
            })
        
        try:
            result = self.repository.get_latest(
                entity_type=entity_type,
                project_id=project_id,
                entity_id=entity_id
            )
            
            if result is None:
                return self._create_response(404, {"error": "Entity not found"})
            
            return self._create_response(200, {"success": True, "data": result})
        
        except Exception as e:
            logger.error(f"Error getting entity: {e}", exc_info=True)
            return self._create_response(500, {"error": "Internal server error"})
    
    def _handle_approve(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle approve action."""
        entity_type = request.get("entity_type")
        project_id = request.get("project_id")
        entity_id = request.get("entity_id")
        approver = request.get("approver")
        comment = request.get("comment")
        
        if not all([entity_type, project_id, entity_id, approver]):
            return self._create_response(400, {
                "error": "Missing required fields",
                "required": ["entity_type", "project_id", "entity_id", "approver"]
            })
        
        try:
            result = self.repository.approve(
                entity_type=entity_type,
                project_id=project_id,
                entity_id=entity_id,
                approver=approver,
                comment=comment
            )
            return self._create_response(200, {"success": True, "data": result})
        
        except ValueError as e:
            return self._create_response(400, {"error": str(e)})
        except Exception as e:
            logger.error(f"Error approving entity: {e}", exc_info=True)
            return self._create_response(500, {"error": "Internal server error"})
    
    def _handle_reject(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle reject action."""
        entity_type = request.get("entity_type")
        project_id = request.get("project_id")
        entity_id = request.get("entity_id")
        rejector = request.get("rejector")
        comment = request.get("comment")
        
        if not all([entity_type, project_id, entity_id, rejector]):
            return self._create_response(400, {
                "error": "Missing required fields",
                "required": ["entity_type", "project_id", "entity_id", "rejector"]
            })
        
        try:
            result = self.repository.reject(
                entity_type=entity_type,
                project_id=project_id,
                entity_id=entity_id,
                rejector=rejector,
                comment=comment
            )
            return self._create_response(200, {"success": True, "data": result})
        
        except ValueError as e:
            return self._create_response(400, {"error": str(e)})
        except Exception as e:
            logger.error(f"Error rejecting entity: {e}", exc_info=True)
            return self._create_response(500, {"error": "Internal server error"})
    
    def _handle_list(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle list action (list by project)."""
        entity_type = request.get("entity_type")
        project_id = request.get("project_id")
        status = request.get("status")
        
        if not all([entity_type, project_id]):
            return self._create_response(400, {
                "error": "Missing required fields",
                "required": ["entity_type", "project_id"]
            })
        
        try:
            results = self.repository.list_by_project(
                entity_type=entity_type,
                project_id=project_id,
                status=status
            )
            return self._create_response(200, {
                "success": True,
                "data": results,
                "count": len(results)
            })
        
        except Exception as e:
            logger.error(f"Error listing entities: {e}", exc_info=True)
            return self._create_response(500, {"error": "Internal server error"})
    
    def _handle_get_version(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle get_version action."""
        entity_type = request.get("entity_type")
        project_id = request.get("project_id")
        entity_id = request.get("entity_id")
        version = request.get("version")
        
        if not all([entity_type, project_id, entity_id, version]):
            return self._create_response(400, {
                "error": "Missing required fields",
                "required": ["entity_type", "project_id", "entity_id", "version"]
            })
        
        try:
            result = self.repository.get_version(
                entity_type=entity_type,
                project_id=project_id,
                entity_id=entity_id,
                version=int(version)
            )
            
            if result is None:
                return self._create_response(404, {"error": "Version not found"})
            
            return self._create_response(200, {"success": True, "data": result})
        
        except ValueError as e:
            return self._create_response(400, {"error": str(e)})
        except Exception as e:
            logger.error(f"Error getting version: {e}", exc_info=True)
            return self._create_response(500, {"error": "Internal server error"})
    
    def _handle_get_history(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle get_history action."""
        entity_type = request.get("entity_type")
        project_id = request.get("project_id")
        entity_id = request.get("entity_id")
        
        if not all([entity_type, project_id, entity_id]):
            return self._create_response(400, {
                "error": "Missing required fields",
                "required": ["entity_type", "project_id", "entity_id"]
            })
        
        try:
            result = self.repository.get_history(
                entity_type=entity_type,
                project_id=project_id,
                entity_id=entity_id
            )
            
            if result is None:
                return self._create_response(404, {"error": "Entity not found"})
            
            return self._create_response(200, {
                "success": True,
                "data": result,
                "count": len(result)
            })
        
        except Exception as e:
            logger.error(f"Error getting history: {e}", exc_info=True)
            return self._create_response(500, {"error": "Internal server error"})
    
    def _handle_save_stratum(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle save_stratum action coming from Node handler.
        Writes a minimal metadata file; data parquet is handled elsewhere/placeholder.
        """
        borelog_id = request.get("borelog_id")
        version_no = request.get("version_no")
        user_id = request.get("user_id")
        layers = request.get("layers", [])
        metadata_key = request.get("stratum_metadata_key")
        data_key = request.get("stratum_data_key")

        if not all([borelog_id, version_no, metadata_key]):
            return self._create_response(400, {
                "error": "Missing required fields for save_stratum",
                "required": ["borelog_id", "version_no", "stratum_metadata_key"]
            })

        metadata_payload = {
            "borelog_id": borelog_id,
            "version_no": version_no,
            "layers_count": len(layers),
            "saved_by": user_id,
            "saved_at": datetime.utcnow().isoformat() + "Z",
        }

        try:
            if self.storage_engine.mode == StorageMode.S3:
                if not getattr(self.storage_engine, "bucket_name", None):
                    raise ValueError("bucket_name not configured for S3 mode")
                s3 = boto3.client("s3", region_name=self.storage_engine.aws_region)
                s3.put_object(
                    Bucket=self.storage_engine.bucket_name,
                    Key=metadata_key,
                    Body=json.dumps(metadata_payload, default=str),
                    ContentType="application/json"
                )
                # Optionally store layers JSON alongside metadata for quick reads
                if layers and data_key:
                    s3.put_object(
                        Bucket=self.storage_engine.bucket_name,
                        Key=data_key.replace(".parquet", ".json"),
                        Body=json.dumps({"layers": layers}, default=str),
                        ContentType="application/json"
                    )
            else:
                # Local/mock fallback: write to /tmp
                from pathlib import Path
                Path("/tmp/stratum").mkdir(parents=True, exist_ok=True)
                with open("/tmp/stratum/metadata.json", "w", encoding="utf-8") as f:
                    json.dump(metadata_payload, f)
                if layers and data_key:
                    with open("/tmp/stratum/layers.json", "w", encoding="utf-8") as f:
                        json.dump({"layers": layers}, f)

            return self._create_response(200, {"success": True, "message": "Stratum saved"})
        except Exception as e:
            logger.error(f"Error saving stratum: {e}", exc_info=True)
            return self._create_response(500, {"error": "Failed to save stratum"})
    
    def handle(self, event: Dict[str, Any], context: Any) -> Dict[str, Any]:
        """
        Main Lambda handler entry point.
        
        Args:
            event: Lambda event from API Gateway
            context: Lambda context
            
        Returns:
            API Gateway response format
        """
        try:
            # Parse event
            request = self._parse_event(event)
            action = request.get("action")
            
            if not action:
                return self._create_response(400, {
                    "error": "Missing action field",
                    "supported_actions": [
                        "create", "update", "get", "approve", "reject",
                        "list", "get_version", "get_history"
                    ]
                })
            
            # Route to appropriate handler
            action_handlers = {
                "create": self._handle_create,
                "update": self._handle_update,
                "get": self._handle_get,
                "approve": self._handle_approve,
                "reject": self._handle_reject,
                "list": self._handle_list,
                "get_version": self._handle_get_version,
                "get_history": self._handle_get_history,
                "save_stratum": self._handle_save_stratum,
            }
            
            handler = action_handlers.get(action)
            if not handler:
                return self._create_response(400, {
                    "error": f"Unknown action: {action}",
                    "supported_actions": list(action_handlers.keys())
                })
            
            return handler(request)
        
        except Exception as e:
            logger.error(f"Unexpected error: {e}", exc_info=True)
            return self._create_response(500, {"error": "Internal server error"})


# Global handler instance (reused across invocations)
_handler_instance: Optional[LambdaHandler] = None


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler function.
    
    This is the entry point for AWS Lambda. It creates a handler instance
    (reused across invocations for performance) and processes the event.
    
    Args:
        event: Lambda event from API Gateway
        context: Lambda context (unused)
        
    Returns:
        API Gateway response format
    """
    global _handler_instance
    
    # Reuse handler instance across invocations (Lambda container reuse)
    if _handler_instance is None:
        _handler_instance = LambdaHandler()
    
    return _handler_instance.handle(event, context)












