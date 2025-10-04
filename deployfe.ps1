param(
    [string]$ResourceGroup = "nexhire-dev-rg",
    [string]$StaticAppName = "nexhire-frontend-web",
    [string]$Environment = "production",  # dev, staging, production
    [string]$SubscriptionId = "44027c71-593a-4d51-977b-ab0604cb76eb"
)

$ErrorActionPreference = "Stop"

Write-Host "=== NexHire Frontend Build & Deploy ===" -ForegroundColor Cyan

# Normalize environment
$normalizedEnv = switch ($Environment.ToLower()) {
    { $_ -in @("dev", "development") } { "dev" }
    "staging" { "staging" }
    { $_ -in @("prod", "production") } { "prod" }
    default { "prod" }
}

# Env-specific resources
$azureResources = switch ($normalizedEnv) {
    "dev" {
        @{ ResourceGroup = "nexhire-dev-rg"; StaticAppName = "nexhire-frontend-dev"; FunctionAppName = "nexhire-api-dev" }
    }
    "staging" {
        @{ ResourceGroup = "nexhire-dev-rg"; StaticAppName = "nexhire-frontend-staging"; FunctionAppName = "nexhire-api-staging" }
    }
    "prod" {
        @{ ResourceGroup = $ResourceGroup; StaticAppName = $StaticAppName; FunctionAppName = "nexhire-api-func" }
    }
}

Write-Host "Target Environment: $normalizedEnv" -ForegroundColor Green

az account set --subscription $SubscriptionId

# Step 1: Switch environment
Set-Location "frontend"
$envFile = ".env.$normalizedEnv"
if (Test-Path $envFile) {
    Copy-Item $envFile ".env" -Force
    Write-Host "Environment file switched to $envFile"
} else {
    Write-Host "Warning: $envFile not found, using existing .env" -ForegroundColor Yellow
}

npm install
if (Test-Path "web-build") { Remove-Item -Recurse -Force "web-build" }

Write-Host "Building frontend..."
npx expo export --platform web --output-dir web-build --clear

if (-not (Test-Path "web-build/index.html")) {
    Write-Error "Build failed! No index.html found."
    exit 1
}

# Step 2: Deployment
$targetStaticApp = $azureResources.StaticAppName
$targetResourceGroup = $azureResources.ResourceGroup

$deploymentToken = az staticwebapp secrets list `
    --name $targetStaticApp `
    --resource-group $targetResourceGroup `
    --query "properties.apiKey" -o tsv

if (-not $deploymentToken) {
    Write-Error "Failed to fetch deployment token for $targetStaticApp"
    exit 1
}

Write-Host "Deploying to Azure Static Web App..."
if ($normalizedEnv -eq "prod") {
    swa deploy --app-location . --output-location web-build --deployment-token $deploymentToken --env production
} else {
    swa deploy --app-location . --output-location web-build --deployment-token $deploymentToken
}

Write-Host "=== Deployment Completed ===" -ForegroundColor Green
Write-Host "URL: https://$targetStaticApp.azurestaticapps.net" -ForegroundColor Cyan

Set-Location ..
