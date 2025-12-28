"""
Local Testing Script for Lambda Handler

Tests the Lambda handler locally without AWS Lambda runtime.
Useful for development and debugging.
"""

import json
import os
from lambda_handler import LambdaHandler

# Set environment variables for local testing
os.environ.setdefault("STORAGE_MODE", "local")
os.environ.setdefault("BASE_PATH", "./lambda-test-data")


def test_create():
    """Test create action"""
    print("=" * 60)
    print("Test 1: Create Entity")
    print("=" * 60)
    
    handler = LambdaHandler()
    
    event = {
        "action": "create",
        "entity_type": "borelog",
        "project_id": "project-test-001",
        "entity_id": "borelog-test-001",
        "payload": {
            "borelog_id": "uuid-test-001",
            "version_no": 1,
            "status": "draft",
            "created_by_user_id": "user-test-123",
        },
        "user": "user-test-123",
        "comment": "Test creation"
    }
    
    response = handler.handle(event, None)
    print(f"Status Code: {response['statusCode']}")
    print(f"Response: {json.dumps(json.loads(response['body']), indent=2)}")
    print()


def test_get():
    """Test get action"""
    print("=" * 60)
    print("Test 2: Get Entity")
    print("=" * 60)
    
    handler = LambdaHandler()
    
    event = {
        "action": "get",
        "entity_type": "borelog",
        "project_id": "project-test-001",
        "entity_id": "borelog-test-001",
    }
    
    response = handler.handle(event, None)
    print(f"Status Code: {response['statusCode']}")
    print(f"Response: {json.dumps(json.loads(response['body']), indent=2)}")
    print()


def test_update():
    """Test update action"""
    print("=" * 60)
    print("Test 3: Update Entity")
    print("=" * 60)
    
    handler = LambdaHandler()
    
    event = {
        "action": "update",
        "entity_type": "borelog",
        "project_id": "project-test-001",
        "entity_id": "borelog-test-001",
        "payload": {
            "borelog_id": "uuid-test-001",
            "version_no": 2,
            "status": "submitted",
            "created_by_user_id": "user-test-123",
        },
        "user": "user-test-123",
        "comment": "Test update"
    }
    
    response = handler.handle(event, None)
    print(f"Status Code: {response['statusCode']}")
    print(f"Response: {json.dumps(json.loads(response['body']), indent=2)}")
    print()


def test_approve():
    """Test approve action"""
    print("=" * 60)
    print("Test 4: Approve Entity")
    print("=" * 60)
    
    handler = LambdaHandler()
    
    event = {
        "action": "approve",
        "entity_type": "borelog",
        "project_id": "project-test-001",
        "entity_id": "borelog-test-001",
        "approver": "approver-test-456",
        "comment": "Test approval"
    }
    
    response = handler.handle(event, None)
    print(f"Status Code: {response['statusCode']}")
    print(f"Response: {json.dumps(json.loads(response['body']), indent=2)}")
    print()


def test_list():
    """Test list action"""
    print("=" * 60)
    print("Test 5: List Entities")
    print("=" * 60)
    
    handler = LambdaHandler()
    
    event = {
        "action": "list",
        "entity_type": "borelog",
        "project_id": "project-test-001",
    }
    
    response = handler.handle(event, None)
    print(f"Status Code: {response['statusCode']}")
    body = json.loads(response['body'])
    print(f"Count: {body.get('count', 0)}")
    print(f"Response: {json.dumps(body, indent=2)}")
    print()


def test_get_version():
    """Test get_version action"""
    print("=" * 60)
    print("Test 6: Get Specific Version")
    print("=" * 60)
    
    handler = LambdaHandler()
    
    event = {
        "action": "get_version",
        "entity_type": "borelog",
        "project_id": "project-test-001",
        "entity_id": "borelog-test-001",
        "version": 1,
    }
    
    response = handler.handle(event, None)
    print(f"Status Code: {response['statusCode']}")
    print(f"Response: {json.dumps(json.loads(response['body']), indent=2)}")
    print()


def test_get_history():
    """Test get_history action"""
    print("=" * 60)
    print("Test 7: Get History")
    print("=" * 60)
    
    handler = LambdaHandler()
    
    event = {
        "action": "get_history",
        "entity_type": "borelog",
        "project_id": "project-test-001",
        "entity_id": "borelog-test-001",
    }
    
    response = handler.handle(event, None)
    print(f"Status Code: {response['statusCode']}")
    body = json.loads(response['body'])
    print(f"History entries: {body.get('count', 0)}")
    print(f"Response: {json.dumps(body, indent=2)}")
    print()


def test_api_gateway_format():
    """Test API Gateway event format"""
    print("=" * 60)
    print("Test 8: API Gateway Event Format")
    print("=" * 60)
    
    handler = LambdaHandler()
    
    # Simulate API Gateway REST API event
    event = {
        "httpMethod": "POST",
        "path": "/parquet",
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps({
            "action": "get",
            "entity_type": "borelog",
            "project_id": "project-test-001",
            "entity_id": "borelog-test-001",
        }),
        "pathParameters": None,
        "queryStringParameters": None,
    }
    
    response = handler.handle(event, None)
    print(f"Status Code: {response['statusCode']}")
    print(f"Headers: {response['headers']}")
    print(f"Response: {json.dumps(json.loads(response['body']), indent=2)}")
    print()


def test_error_handling():
    """Test error handling"""
    print("=" * 60)
    print("Test 9: Error Handling")
    print("=" * 60)
    
    handler = LambdaHandler()
    
    # Test missing action
    event = {
        "entity_type": "borelog",
        "project_id": "project-test-001",
    }
    
    response = handler.handle(event, None)
    print(f"Missing action - Status Code: {response['statusCode']}")
    print(f"Response: {json.dumps(json.loads(response['body']), indent=2)}")
    print()
    
    # Test unknown action
    event = {
        "action": "unknown_action",
        "entity_type": "borelog",
    }
    
    response = handler.handle(event, None)
    print(f"Unknown action - Status Code: {response['statusCode']}")
    print(f"Response: {json.dumps(json.loads(response['body']), indent=2)}")
    print()
    
    # Test missing required fields
    event = {
        "action": "create",
        "entity_type": "borelog",
        # Missing project_id, entity_id, user
    }
    
    response = handler.handle(event, None)
    print(f"Missing fields - Status Code: {response['statusCode']}")
    print(f"Response: {json.dumps(json.loads(response['body']), indent=2)}")
    print()


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Lambda Handler - Local Testing")
    print("=" * 60 + "\n")
    
    try:
        test_create()
        test_get()
        test_update()
        test_approve()
        test_list()
        test_get_version()
        test_get_history()
        test_api_gateway_format()
        test_error_handling()
        
        print("=" * 60)
        print("✅ All tests completed!")
        print("=" * 60)
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()













