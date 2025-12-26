#!/bin/bash

# Test script to verify login endpoint
# Usage: ./test-login.sh

echo "=== Testing Login Endpoint ==="
echo ""

# Test 1: Check if backend is running
echo "1. Checking if backend is running on port 3000..."
if curl -s http://localhost:3000/dev/auth/login > /dev/null 2>&1; then
    echo "   ✓ Backend is reachable"
else
    echo "   ✗ Backend is NOT reachable"
    echo "   Please start the backend with: cd backendbore/backend && npm run dev"
    exit 1
fi

echo ""
echo "2. Testing login with admin credentials..."
echo "   Email: admin@backendbore.com"
echo "   Password: admin123"
echo ""

response=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@backendbore.com","password":"admin123"}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "   HTTP Status: $http_code"
echo "   Response:"
echo "$body" | jq '.' 2>/dev/null || echo "$body"

if [ "$http_code" = "200" ]; then
    echo ""
    echo "   ✓ Login successful!"
    token=$(echo "$body" | jq -r '.data.token' 2>/dev/null)
    if [ -n "$token" ] && [ "$token" != "null" ]; then
        echo "   ✓ Token received: ${token:0:50}..."
    fi
else
    echo ""
    echo "   ✗ Login failed"
    echo "   Check backend logs for more details"
fi

