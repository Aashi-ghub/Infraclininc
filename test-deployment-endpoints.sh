#!/bin/bash

# Comprehensive Endpoint Testing Script (Bash version)
# Tests all endpoints across Frontend, Backend (Main), and Backend-Ops

FRONTEND_URL="https://dwodlititlpa1.cloudfront.net"
BACKEND_MAIN="https://451vcfv074.execute-api.us-east-1.amazonaws.com/dev"
BACKEND_OPS="https://uby3f1n6zi.execute-api.us-east-1.amazonaws.com/dev"

PASSED=0
FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    local data=$4
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data" \
            --max-time 10)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
            -H "Content-Type: application/json" \
            --max-time 10)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 400 ]; then
        echo -e "${GREEN}✅${NC} $name: $http_code"
        ((PASSED++))
        return 0
    elif [ "$http_code" -eq 401 ] || [ "$http_code" -eq 403 ]; then
        echo -e "${YELLOW}⚠️${NC}  $name: $http_code (Auth required - endpoint exists)"
        ((PASSED++))
        return 0
    elif [ "$http_code" -eq 404 ]; then
        echo -e "${RED}❌${NC} $name: $http_code (Not Found)"
        ((FAILED++))
        return 1
    else
        echo -e "${RED}❌${NC} $name: $http_code"
        ((FAILED++))
        return 1
    fi
}

echo "🚀 Starting Deployment Endpoint Tests"
echo "============================================================"
echo "Frontend: $FRONTEND_URL"
echo "Backend (Main): $BACKEND_MAIN"
echo "Backend-Ops: $BACKEND_OPS"
echo ""

# Test Frontend
echo ""
echo "🌐 Testing Frontend (CloudFront)..."
echo "============================================================"
test_endpoint "Frontend - Homepage" "$FRONTEND_URL"
test_endpoint "Frontend - Root Path" "$FRONTEND_URL/"

# Test Backend (Main)
echo ""
echo "🔧 Testing Backend (Main) - 451vcfv074..."
echo "============================================================"

# Auth endpoints
test_endpoint "Auth - Login (POST)" "$BACKEND_MAIN/auth/login" "POST" '{"email":"test@example.com","password":"test"}'
test_endpoint "Auth - Me (GET)" "$BACKEND_MAIN/auth/me" "GET"

# Users endpoints
test_endpoint "Users - List (GET)" "$BACKEND_MAIN/users" "GET"
test_endpoint "Users - Lab Engineers (GET)" "$BACKEND_MAIN/users/lab-engineers" "GET"

# Projects endpoints
test_endpoint "Projects - List (GET)" "$BACKEND_MAIN/projects" "GET"

# Structures endpoints
test_endpoint "Structures - List (GET)" "$BACKEND_MAIN/structures?project_id=test" "GET"

# Substructures endpoints
test_endpoint "Substructures - List (GET)" "$BACKEND_MAIN/substructures?project_id=test" "GET"

# Borelog endpoints
test_endpoint "Borelog - Form Data (GET)" "$BACKEND_MAIN/borelog-form-data" "GET"

# Boreholes endpoints
test_endpoint "Boreholes - List (GET)" "$BACKEND_MAIN/boreholes" "GET"

# Geological Log endpoints
test_endpoint "Geological Log - List (GET)" "$BACKEND_MAIN/geological-log" "GET"

# Borelog Assignments
test_endpoint "Borelog Assignments - Active (GET)" "$BACKEND_MAIN/borelog-assignments/active" "GET"

# Test Backend-Ops
echo ""
echo "⚙️  Testing Backend-Ops - uby3f1n6zi..."
echo "============================================================"

# Lab Reports endpoints
test_endpoint "Lab Reports - List (GET)" "$BACKEND_OPS/lab-reports" "GET"

# Lab Requests endpoints
test_endpoint "Lab Requests - List (GET)" "$BACKEND_OPS/lab-requests" "GET"
test_endpoint "Lab Requests - Final Borelogs (GET)" "$BACKEND_OPS/lab-requests/final-borelogs" "GET"

# Lab Tests endpoints
test_endpoint "Lab Tests - List (GET)" "$BACKEND_OPS/lab-tests" "GET"

# Workflow endpoints
test_endpoint "Workflow - Pending Reviews (GET)" "$BACKEND_OPS/workflow/pending-reviews" "GET"
test_endpoint "Workflow - Lab Assignments (GET)" "$BACKEND_OPS/workflow/lab-assignments" "GET"
test_endpoint "Workflow - Statistics (GET)" "$BACKEND_OPS/workflow/statistics" "GET"
test_endpoint "Workflow - Submitted Borelogs (GET)" "$BACKEND_OPS/workflow/submitted-borelogs" "GET"

# Unified Lab Reports endpoints
test_endpoint "Unified Lab Reports - List (GET)" "$BACKEND_OPS/unified-lab-reports" "GET"

# Pending CSV Uploads endpoints
test_endpoint "Pending CSV Uploads - List (GET)" "$BACKEND_OPS/pending-csv-uploads" "GET"

# Anomalies endpoints
test_endpoint "Anomalies - List (GET)" "$BACKEND_OPS/anomalies" "GET"

# Contacts endpoints
test_endpoint "Contacts - List (GET)" "$BACKEND_OPS/contacts" "GET"

# Summary
echo ""
echo "============================================================"
echo "📊 TEST SUMMARY"
echo "============================================================"
echo ""
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo ""
echo "💡 Note: 401/403 responses are expected for unauthenticated requests"
echo "   These indicate the endpoint exists and is properly secured"
echo "============================================================"
