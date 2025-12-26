# PowerShell test script to verify login endpoint
# Usage: .\test-login.ps1

Write-Host "=== Testing Login Endpoint ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check if backend is running
Write-Host "1. Checking if backend is running on port 3000..." -ForegroundColor Yellow
try {
    $testResponse = Invoke-WebRequest -Uri "http://localhost:3000/dev/auth/login" -Method GET -TimeoutSec 2 -ErrorAction Stop
    Write-Host "   ✓ Backend is reachable" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Backend is NOT reachable" -ForegroundColor Red
    Write-Host "   Please start the backend with: cd backendbore/backend && npm run dev" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "2. Testing login with admin credentials..." -ForegroundColor Yellow
Write-Host "   Email: admin@backendbore.com"
Write-Host "   Password: admin123"
Write-Host ""

$body = @{
    email = "admin@backendbore.com"
    password = "admin123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/dev/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -ErrorAction Stop
    
    Write-Host "   ✓ Login successful!" -ForegroundColor Green
    Write-Host "   Response:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10
    
    if ($response.data.token) {
        $tokenPreview = $response.data.token.Substring(0, [Math]::Min(50, $response.data.token.Length))
        Write-Host "   ✓ Token received: ${tokenPreview}..." -ForegroundColor Green
    }
} catch {
    Write-Host "   ✗ Login failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   HTTP Status: $statusCode" -ForegroundColor Red
        
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "   Response Body:" -ForegroundColor Yellow
            Write-Host $responseBody
        } catch {
            Write-Host "   Could not read response body" -ForegroundColor Yellow
        }
    }
    Write-Host "   Check backend logs for more details" -ForegroundColor Yellow
}

