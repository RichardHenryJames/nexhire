# Super Fast GitHub Deploy Script
param(
    [string]$Branch = "main",
    [switch]$Force
)

Write-Host "?? Super Fast GitHub Deploy to Azure Functions" -ForegroundColor Green

# Quick build and deploy
Write-Host "?? Installing production dependencies..." -ForegroundColor Yellow
npm ci --omit=dev

Write-Host "?? Building TypeScript..." -ForegroundColor Yellow  
npm run build

Write-Host "?? Creating deployment package..." -ForegroundColor Yellow
$tempDir = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }
Copy-Item -Path "dist/*" -Destination $tempDir -Recurse
Copy-Item -Path "node_modules" -Destination $tempDir -Recurse
Copy-Item -Path "host.json" -Destination $tempDir
Copy-Item -Path "package.json" -Destination $tempDir

$zipPath = "deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force

Write-Host "?? Deploying to Azure Functions..." -ForegroundColor Green
az functionapp deployment source config-zip `
  --resource-group nexhire-dev-rg `
  --name nexhire-api-func `
  --src $zipPath

Write-Host "? Deployment complete!" -ForegroundColor Green
Write-Host "?? API: https://nexhire-api-func.azurewebsites.net/api" -ForegroundColor Cyan

# Cleanup
Remove-Item $zipPath
Remove-Item $tempDir -Recurse