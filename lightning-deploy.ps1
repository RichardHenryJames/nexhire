# Lightning Fast ZIP Deploy - FIXED VERSION
param(
    [string]$ResourceGroup = "nexhire-dev-rg",
    [string]$FunctionApp = "nexhire-api-func"
)

Write-Host "? Lightning Fast ZIP Deployment - FIXED" -ForegroundColor Magenta

# Check if this is the right directory
if (!(Test-Path "index.ts")) {
    Write-Host "? Error: index.ts not found. Are you in the backend directory?" -ForegroundColor Red
    Write-Host "Try: cd to your nexhire backend directory first" -ForegroundColor Yellow
    exit 1
}

# Clean and quick build
Write-Host "Cleaning previous build..." -ForegroundColor Yellow
if (Test-Path "dist") { Remove-Item -Path "dist" -Recurse -Force }

Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm ci --omit=dev --silent

Write-Host "Building TypeScript..." -ForegroundColor Yellow
npm run build

# Verify build succeeded
if (!(Test-Path "dist")) {
    Write-Host "? Build failed: dist directory not created" -ForegroundColor Red
    Write-Host "Try running: npm run build manually to see errors" -ForegroundColor Yellow
    exit 1
}

# Create deployment package with only essential files
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipFile = "deploy-$timestamp.zip"

Write-Host "Creating deployment package..." -ForegroundColor Yellow

# Create temporary deployment directory
$deployDir = "temp-deploy-$timestamp"
New-Item -ItemType Directory -Path $deployDir -Force | Out-Null

# Copy files to deployment directory
Copy-Item -Path "dist" -Destination "$deployDir\dist" -Recurse
Copy-Item -Path "node_modules" -Destination "$deployDir\node_modules" -Recurse
Copy-Item -Path "host.json" -Destination "$deployDir\host.json" -ErrorAction SilentlyContinue
Copy-Item -Path "package.json" -Destination "$deployDir\package.json"

# Create zip from deployment directory
Compress-Archive -Path "$deployDir\*" -DestinationPath $zipFile -CompressionLevel Fastest

# Verify zip was created
if (!(Test-Path $zipFile)) {
    Write-Host "? Failed to create zip file" -ForegroundColor Red
    Remove-Item -Path $deployDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "Deploying via ZIP ($((Get-Item $zipFile).Length / 1MB | ForEach-Object {"{0:N1}" -f $_}) MB)..." -ForegroundColor Green

# Deploy via REST API
try {
    az functionapp deployment source config-zip --resource-group $ResourceGroup --name $FunctionApp --src $zipFile
    Write-Host "? Lightning deployment complete!" -ForegroundColor Green
} catch {
    Write-Host "? Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    # Cleanup
    Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $deployDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "API: https://nexhire-api-func.azurewebsites.net/api" -ForegroundColor Cyan
Write-Host "? Deployment completed!" -ForegroundColor Magenta

# Quick health check
Write-Host "Testing API..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
try {
    $response = Invoke-RestMethod -Uri "https://nexhire-api-func.azurewebsites.net/api/health" -Method GET -TimeoutSec 10
    if ($response.success) {
        Write-Host "? API is responding: $($response.message)" -ForegroundColor Green
    }
} catch {
    Write-Host "API test failed (may need more time to start): $($_.Exception.Message)" -ForegroundColor Yellow
}