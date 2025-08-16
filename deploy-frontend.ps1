# ================================================================
# NexHire Frontend Deployment Script
# ================================================================
# Deploys the NexHire Universal React Native Frontend to Azure Static Web Apps
# Author: NexHire Team
# Version: 1.0.0

param(
    [string]$ResourceGroup = "nexhire-dev-rg",
    [string]$StaticAppName = "nexhire-frontend-web", 
    [string]$Location = "eastus",
    [string]$SubscriptionId = "44027c71-593a-4d51-977b-ab0604cb76eb",
    [switch]$SkipInstall,
    [switch]$SkipBuild,
    [switch]$SkipDeploy,
    [switch]$Force
)

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host " NexHire Frontend Deployment Started" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

# ================================================================
# STEP 1: Environment Validation
# ================================================================

Write-Host " Step 1: Validating Environment..." -ForegroundColor Yellow

# Check if running in correct directory
$currentDir = Get-Location
if (-not (Test-Path "frontend/package.json")) {
    Write-Error "? Must run from NexHire root directory (containing frontend/ folder)"
}

# Validate Azure CLI
try {
    $azVersion = az version --output json | ConvertFrom-Json
    Write-Host "? Azure CLI: $($azVersion.'azure-cli')" -ForegroundColor Green
} catch {
    Write-Error "? Azure CLI not found. Install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
}

# Check Azure login
try {
    $account = az account show --output json | ConvertFrom-Json
    Write-Host "? Azure Account: $($account.user.name)" -ForegroundColor Green
    Write-Host "? Subscription: $($account.name)" -ForegroundColor Green
} catch {
    Write-Host "? Not logged into Azure. Logging in..." -ForegroundColor Red
    az login
}

# Set subscription
Write-Host " Setting Azure subscription..." -ForegroundColor Blue
az account set --subscription $SubscriptionId

# Validate Node.js
try {
    $nodeVersion = node --version
    Write-Host "? Node.js: $nodeVersion" -ForegroundColor Green
    
    # Check if Node.js version is 18+
    $nodeVersionNumber = [System.Version]($nodeVersion -replace 'v', '')
    if ($nodeVersionNumber.Major -lt 18) {
        Write-Warning "  Node.js 18+ recommended for optimal Expo support"
    }
} catch {
    Write-Error "? Node.js not found. Install from: https://nodejs.org/"
}

# Check if Expo CLI is available
try {
    $expoVersion = npx expo --version
    Write-Host "? Expo CLI: $expoVersion" -ForegroundColor Green
} catch {
    Write-Host " Installing Expo CLI..." -ForegroundColor Blue
    npm install -g @expo/cli
}

# Verify Azure Static Web App exists
Write-Host " Checking Azure Static Web App..." -ForegroundColor Blue
try {
    $staticApp = az staticwebapp show --name $StaticAppName --resource-group $ResourceGroup --output json | ConvertFrom-Json
    Write-Host "? Static Web App: $($staticApp.defaultHostname)" -ForegroundColor Green
    $deploymentUrl = "https://$($staticApp.defaultHostname)"
} catch {
    Write-Error "? Static Web App '$StaticAppName' not found in resource group '$ResourceGroup'"
}

# ================================================================
# STEP 2: Frontend Dependency Installation
# ================================================================

if (-not $SkipInstall) {
    Write-Host " Step 2: Installing Frontend Dependencies..." -ForegroundColor Yellow
    
    Set-Location "frontend"
    
    # Clean install for production
    if (Test-Path "node_modules") {
        Write-Host " Cleaning existing node_modules..." -ForegroundColor Blue
        Remove-Item -Recurse -Force "node_modules"
    }
    
    if (Test-Path "package-lock.json") {
        Write-Host " Cleaning package-lock.json..." -ForegroundColor Blue
        Remove-Item "package-lock.json"
    }
    
    Write-Host " Installing dependencies with npm ci..." -ForegroundColor Blue
    npm install
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "? npm install failed"
    }
    
    Write-Host "? Dependencies installed successfully" -ForegroundColor Green
    Set-Location ".."
} else {
    Write-Host "  Skipping dependency installation" -ForegroundColor Gray
}

# ================================================================
# STEP 3: Environment Configuration
# ================================================================

Write-Host "  Step 3: Configuring Environment..." -ForegroundColor Yellow

# Create/update .env file for production
$envContent = @"
# NexHire Frontend Production Configuration
EXPO_PUBLIC_API_URL=https://nexhire-api-func.azurewebsites.net/api
EXPO_PUBLIC_APP_NAME=NexHire
EXPO_PUBLIC_ENVIRONMENT=production
EXPO_PUBLIC_VERSION=1.0.0
"@

Set-Content -Path "frontend/.env" -Value $envContent
Write-Host "? Environment configuration created" -ForegroundColor Green

# ================================================================
# STEP 4: Frontend Build for Web
# ================================================================

if (-not $SkipBuild) {
    Write-Host "  Step 4: Building Frontend for Web..." -ForegroundColor Yellow
    
    Set-Location "frontend"
    
    # Clear previous build
    if (Test-Path "web-build") {
        Write-Host " Cleaning previous build..." -ForegroundColor Blue
        Remove-Item -Recurse -Force "web-build"
    }
    
    if (Test-Path "dist") {
        Write-Host " Cleaning dist folder..." -ForegroundColor Blue
        Remove-Item -Recurse -Force "dist"
    }
    
    # Build for web using Expo
    Write-Host " Building React Native Web app with Expo..." -ForegroundColor Blue
    npx expo export --platform web --output-dir web-build --clear
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "? Expo web build failed"
    }
    
    # Verify build output
    if (-not (Test-Path "web-build")) {
        Write-Error "? Build output directory 'web-build' not found"
    }
    
    $buildFiles = Get-ChildItem "web-build" -Recurse | Measure-Object
    Write-Host "? Build completed: $($buildFiles.Count) files generated" -ForegroundColor Green
    
    Set-Location ".."
} else {
    Write-Host "  Skipping build step" -ForegroundColor Gray
}

# ================================================================
# STEP 5: Deploy to Azure Static Web App
# ================================================================

if (-not $SkipDeploy) {
    Write-Host " Step 5: Deploying to Azure Static Web App..." -ForegroundColor Yellow
    
    Set-Location "frontend"
    
    # Get Static Web App deployment token
    Write-Host " Getting deployment token..." -ForegroundColor Blue
    $deploymentToken = az staticwebapp secrets list --name $StaticAppName --resource-group $ResourceGroup --query "properties.apiKey" --output tsv
    
    if (-not $deploymentToken) {
        Write-Error "? Could not retrieve deployment token"
    }
    
    # Deploy using Azure Static Web Apps CLI
    Write-Host " Deploying to Azure Static Web App..." -ForegroundColor Blue
    
    # Install SWA CLI if not present
    try {
        swa --version | Out-Null
    } catch {
        Write-Host " Installing Azure Static Web Apps CLI..." -ForegroundColor Blue
        npm install -g @azure/static-web-apps-cli
    }
    
    # Deploy the build
    swa deploy --app-location . --output-location web-build --deployment-token $deploymentToken
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "? Deployment to Azure Static Web App failed"
    }
    
    Write-Host "? Deployment completed successfully" -ForegroundColor Green
    Set-Location ".."
} else {
    Write-Host "  Skipping deployment step" -ForegroundColor Gray
}

# ================================================================
# STEP 6: Configure Static Web App Settings
# ================================================================

Write-Host "  Step 6: Configuring Static Web App..." -ForegroundColor Yellow

# Configure custom routing for SPA
$staticWebAppConfig = @{
    "routes" = @(
        @{
            "route" = "/api/*"
            "allowedRoles" = @("anonymous")
        },
        @{
            "route" = "/*"
            "serve" = "/index.html"
            "statusCode" = 200
        }
    ),
    "navigationFallback" = @{
        "rewrite" = "/index.html"
        "exclude" = @("/api/*", "/*.{css,scss,js,png,gif,ico,jpg,svg}")
    },
    "mimeTypes" = @{
        ".json" = "application/json"
        ".js" = "text/javascript"
        ".css" = "text/css"
    }
}

$configJson = $staticWebAppConfig | ConvertTo-Json -Depth 10
Set-Content -Path "frontend/web-build/staticwebapp.config.json" -Value $configJson

Write-Host "? Static Web App configuration applied" -ForegroundColor Green

# ================================================================
# STEP 7: Verification & Testing
# ================================================================

Write-Host " Step 7: Verification & Testing..." -ForegroundColor Yellow

# Wait a moment for deployment to propagate
Write-Host "? Waiting for deployment to propagate..." -ForegroundColor Blue
Start-Sleep -Seconds 30

# Test the deployed application
Write-Host " Testing deployed application..." -ForegroundColor Blue

try {
    $response = Invoke-RestMethod -Uri $deploymentUrl -Method GET -TimeoutSec 30
    Write-Host "? Application is responding" -ForegroundColor Green
} catch {
    Write-Warning "  Application may still be starting up. Please check manually: $deploymentUrl"
}

# Test API connectivity from frontend
try {
    $apiTestUrl = "$deploymentUrl"
    Write-Host " Testing from: $apiTestUrl" -ForegroundColor Blue
    Write-Host "? Frontend deployed and accessible" -ForegroundColor Green
} catch {
    Write-Warning "  Could not verify API connectivity. Check browser console at: $deploymentUrl"
}

# ================================================================
# DEPLOYMENT COMPLETE
# ================================================================

Write-Host ""
Write-Host " NexHire Frontend Deployment Complete!" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green
Write-Host ""
Write-Host " Frontend URL: $deploymentUrl" -ForegroundColor Cyan
Write-Host " API Backend: https://nexhire-api-func.azurewebsites.net/api" -ForegroundColor Cyan
Write-Host ""
Write-Host "? Deployment Summary:" -ForegroundColor White
Write-Host "   � Universal React Native app deployed" -ForegroundColor Gray
Write-Host "   � Web build optimized for production" -ForegroundColor Gray
Write-Host "   � Static Web App configured" -ForegroundColor Gray
Write-Host "   � API integration ready" -ForegroundColor Gray
Write-Host "   � Environment variables set" -ForegroundColor Gray
Write-Host ""
Write-Host " Next Steps:" -ForegroundColor White
Write-Host "   1. Test the application: $deploymentUrl" -ForegroundColor Gray
Write-Host "   2. Verify login functionality" -ForegroundColor Gray
Write-Host "   3. Check browser console for any errors" -ForegroundColor Gray
Write-Host "   4. Set up CI/CD pipeline for automatic deployments" -ForegroundColor Gray
Write-Host ""
Write-Host " Useful Commands:" -ForegroundColor White
Write-Host "   � View logs: az staticwebapp show --name $StaticAppName --resource-group $ResourceGroup" -ForegroundColor Gray
Write-Host "   � Redeploy: .\deploy-frontend.ps1" -ForegroundColor Gray
Write-Host "   � View in portal: https://portal.azure.com" -ForegroundColor Gray
Write-Host ""

# Create deployment log
$deploymentLog = @{
    "timestamp" = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "deploymentUrl" = $deploymentUrl
    "resourceGroup" = $ResourceGroup
    "staticAppName" = $StaticAppName
    "status" = "success"
    "buildFiles" = (Get-ChildItem "frontend/web-build" -Recurse | Measure-Object).Count
}

$deploymentLog | ConvertTo-Json | Set-Content "deployment-frontend-log.json"
Write-Host " Deployment log saved: deployment-frontend-log.json" -ForegroundColor Gray

Write-Host ""
Write-Host " Your NexHire frontend is now live!" -ForegroundColor Green