# ================================================================
# NexHire Frontend Quick Deploy Script
# ================================================================
# Simple script for rapid frontend deployments during development

param(
    [switch]$Force
)

Write-Host "? NexHire Frontend Quick Deploy" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Navigate to frontend directory
Set-Location "frontend"

# Quick build and deploy
Write-Host "  Building for web..." -ForegroundColor Yellow
npx expo export --platform web --output-dir web-build --clear

if ($LASTEXITCODE -ne 0) {
    Write-Error "? Build failed"
}

Write-Host " Deploying to Azure..." -ForegroundColor Yellow

# Use the deploy script from package.json
npm run deploy:web

if ($LASTEXITCODE -ne 0) {
    Write-Error "? Deployment failed"
}

Write-Host "? Quick deployment complete!" -ForegroundColor Green
Write-Host " Check: https://nexhire-frontend-web.azurestaticapps.net" -ForegroundColor Cyan

Set-Location ".."