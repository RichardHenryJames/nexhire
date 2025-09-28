param(
    [string]$ResourceGroup = "nexhire-dev-rg",
    [string]$StaticAppName = "nexhire-frontend-web",
    [string]$Environment = "production",  # dev, staging, production
    [string]$SubscriptionId = "44027c71-593a-4d51-977b-ab0604cb76eb"
)

# Stop on error
$ErrorActionPreference = "Stop"

Write-Host "=== NexHire Frontend Build & Deploy ===" -ForegroundColor Cyan

# Normalize environment name for file selection
$normalizedEnv = switch ($Environment.ToLower()) {
    { $_ -in @("dev", "development") } { "dev" }
    "staging" { "staging" }  
    { $_ -in @("prod", "production") } { "prod" }
    default { "prod" }  # Default to production for safety
}

# Environment-specific Azure resources
$azureResources = switch ($normalizedEnv) {
    "dev" {
        @{
            ResourceGroup = "nexhire-dev-rg"
            StaticAppName = "nexhire-frontend-dev"
            FunctionAppName = "nexhire-api-dev"
        }
    }
    "staging" {
        @{
            ResourceGroup = "nexhire-dev-rg"  # Using same RG for now
            StaticAppName = "nexhire-frontend-staging" 
            FunctionAppName = "nexhire-api-staging"
        }
    }
    "prod" {
        @{
            ResourceGroup = $ResourceGroup  # Use provided or default
            StaticAppName = $StaticAppName  # Use provided or default
            FunctionAppName = "nexhire-api-func"
        }
    }
}

Write-Host "?? Target Environment: $normalizedEnv" -ForegroundColor Green
Write-Host "?? Azure Resources:" -ForegroundColor Cyan
Write-Host "   Resource Group: $($azureResources.ResourceGroup)" -ForegroundColor White
Write-Host "   Static Web App: $($azureResources.StaticAppName)" -ForegroundColor White

# Set subscription
az account set --subscription $SubscriptionId

# Step 1: Navigate to frontend and switch environment
Set-Location "frontend"

# Switch to target environment BEFORE building
Write-Host "?? Switching to $normalizedEnv environment..." -ForegroundColor Yellow
$envFile = ".env.$normalizedEnv"
if (Test-Path $envFile) {
    # Backup current .env if it exists
    if (Test-Path ".env") {
        $timestamp = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"
        Copy-Item ".env" ".env.backup.$timestamp" -Force
    }
    
    # Copy target environment file to .env
    Copy-Item $envFile ".env" -Force
    Write-Host "? Switched to $normalizedEnv environment" -ForegroundColor Green
    
    # Show current configuration
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "EXPO_PUBLIC_APP_ENV=(.+)") { 
        Write-Host "   App Environment: $($matches[1].Trim())" -ForegroundColor White
    }
    if ($envContent -match "EXPO_PUBLIC_API_URL=(.+)") {
        Write-Host "   API URL: $($matches[1].Trim())" -ForegroundColor White  
    }
    if ($envContent -match "EXPO_PUBLIC_RAZORPAY_KEY_ID=(.+)") {
        $razorpayKey = $matches[1].Trim()
        $keyType = if ($razorpayKey.StartsWith("rzp_live_")) { "LIVE" } else { "TEST" }
        Write-Host "   Razorpay: $keyType keys" -ForegroundColor $(if ($keyType -eq "LIVE") { "Red" } else { "Yellow" })
    }
} else {
    Write-Host "?? Environment file $envFile not found, using existing .env" -ForegroundColor Yellow
}

Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
npm install

Write-Host "Cleaning old build..." -ForegroundColor Yellow
if (Test-Path "web-build") { Remove-Item -Recurse -Force "web-build" }

Write-Host "Building frontend for web using local Expo CLI..." -ForegroundColor Yellow
# Use the same working command that was working before
npx expo export --platform web --output-dir web-build --clear

if (-not (Test-Path "web-build/index.html")) {
    Write-Error "Build failed! No index.html found."
    exit 1
}

Write-Host "Build successful! Build size:" -ForegroundColor Green
Get-ChildItem -Path "web-build" -Recurse | Measure-Object -Property Length -Sum | ForEach-Object { 
    "{0:N2} MB" -f ($_.Sum / 1MB) 
}

# Step 2: Get deployment token for environment-specific Static Web App
Write-Host "Fetching deployment token..." -ForegroundColor Yellow

$targetStaticApp = $azureResources.StaticAppName
$targetResourceGroup = $azureResources.ResourceGroup

$deploymentToken = az staticwebapp secrets list `
    --name $targetStaticApp `
    --resource-group $targetResourceGroup `
    --query "properties.apiKey" -o tsv

if (-not $deploymentToken) {
    Write-Host "? Failed to fetch deployment token for $targetStaticApp" -ForegroundColor Red
    Write-Host "?? Available Static Web Apps:" -ForegroundColor Yellow
    az staticwebapp list --resource-group $targetResourceGroup --query "[].name" -o table
    exit 1
}

# Step 3: Install SWA CLI if needed
Write-Host "Checking SWA CLI..." -ForegroundColor Yellow
try {
    swa --version | Out-Null
    Write-Host "SWA CLI already installed" -ForegroundColor Green
} catch {
    Write-Host "Installing SWA CLI..." -ForegroundColor Blue
    npm install -g @azure/static-web-apps-cli
}

# Step 4: Deploy
Write-Host "Deploying to Azure Static Web App ($normalizedEnv)..." -ForegroundColor Yellow

if ($normalizedEnv -eq "prod") {
    swa deploy --app-location . --output-location web-build --deployment-token $deploymentToken --env production
} else {
    swa deploy --app-location . --output-location web-build --deployment-token $deploymentToken
}

Write-Host "=== Deployment Completed Successfully ===" -ForegroundColor Green
Write-Host "?? Your app should be available at: https://$targetStaticApp.azurestaticapps.net" -ForegroundColor Cyan
Write-Host "?? Environment: $normalizedEnv" -ForegroundColor Green

# Return to root directory
Set-Location ..

Write-Host ""
Write-Host "? Frontend deployment completed!" -ForegroundColor Green
Write-Host "?? Summary:" -ForegroundColor Cyan
Write-Host "   Environment: $normalizedEnv" -ForegroundColor White
Write-Host "   Resource Group: $targetResourceGroup" -ForegroundColor White
Write-Host "   Static Web App: $targetStaticApp" -ForegroundColor White
Write-Host "   URL: https://$targetStaticApp.azurestaticapps.net" -ForegroundColor White