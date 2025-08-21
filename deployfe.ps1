param(
    [string]$ResourceGroup = "nexhire-dev-rg",
    [string]$StaticAppName = "nexhire-frontend-web",
    [string]$Environment = "production",  # production | preview
    [string]$SubscriptionId = "44027c71-593a-4d51-977b-ab0604cb76eb"
)

# Stop on error
$ErrorActionPreference = "Stop"

Write-Host "=== NexHire Frontend Build & Deploy ===" -ForegroundColor Cyan

# Set subscription
az account set --subscription $SubscriptionId

# Step 1: Build frontend
Set-Location "frontend"

Write-Host "Cleaning old build..." -ForegroundColor Yellow
if (Test-Path "web-build") { Remove-Item -Recurse -Force "web-build" }

Write-Host "Building frontend for web..." -ForegroundColor Yellow
npx expo export --platform web --output-dir web-build --clear

if (-not (Test-Path "web-build/index.html")) {
    Write-Error "Build failed! No index.html found."
    exit 1
}

# Step 2: Get deployment token
Write-Host "Fetching deployment token..." -ForegroundColor Yellow
$deploymentToken = az staticwebapp secrets list `
    --name $StaticAppName `
    --resource-group $ResourceGroup `
    --query "properties.apiKey" -o tsv

if (-not $deploymentToken) {
    Write-Error "Failed to fetch deployment token."
    exit 1
}

# Step 3: Deploy
Write-Host "Deploying to Azure Static Web App ($Environment)..." -ForegroundColor Yellow

try {
    swa --version | Out-Null
} catch {
    Write-Host "Installing SWA CLI..." -ForegroundColor Blue
    npm install -g @azure/static-web-apps-cli
}

if ($Environment -eq "production") {
    swa deploy --app-location . --output-location web-build --deployment-token $deploymentToken --env production
} else {
    swa deploy --app-location . --output-location web-build --deployment-token $deploymentToken
}

Write-Host "=== Deployment Completed Successfully ===" -ForegroundColor Green
