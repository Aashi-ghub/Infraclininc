# Fix deployment issues - Clean rebuild (PowerShell)

Write-Host "🧹 Cleaning build cache..." -ForegroundColor Yellow
if (Test-Path .serverless) {
    Remove-Item -Recurse -Force .serverless
    Write-Host "   ✅ Removed .serverless" -ForegroundColor Green
}
if (Test-Path node_modules\.cache) {
    Remove-Item -Recurse -Force node_modules\.cache
    Write-Host "   ✅ Removed node_modules/.cache" -ForegroundColor Green
}

Write-Host "📦 Verifying dependencies..." -ForegroundColor Yellow
npm install

Write-Host "`n✅ Ready to deploy. Run: serverless deploy" -ForegroundColor Green

Write-Host "`n📋 Verification Checklist:" -ForegroundColor Cyan
Write-Host "   [ ] aws-sdk in package.json: " -NoNewline
if ((Get-Content package.json | Select-String "aws-sdk").Count -gt 0) {
    Write-Host "✅" -ForegroundColor Green
} else {
    Write-Host "❌" -ForegroundColor Red
}

Write-Host "   [ ] aws-sdk in node_modules: " -NoNewline
if (Test-Path node_modules\aws-sdk) {
    Write-Host "✅" -ForegroundColor Green
} else {
    Write-Host "❌" -ForegroundColor Red
}

Write-Host "   [ ] aws-sdk NOT in external: " -NoNewline
$serverlessContent = Get-Content serverless.ts -Raw
if ($serverlessContent -match "external:\s*\[[^\]]*'aws-sdk'") {
    Write-Host "❌ (still in external list)" -ForegroundColor Red
} else {
    Write-Host "✅" -ForegroundColor Green
}
