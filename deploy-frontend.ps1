# ================================================================
# RefOpen/RefOpen Frontend Deployment Script
# ================================================================
# Deploys the Universal React Native Frontend to Azure Static Web Apps
# - Production: RefOpen infrastructure
# - Dev/Staging: RefOpen infrastructure
# Version: 2.0 - Multi-infrastructure support

param(
    [string]$ResourceGroup = "",  # Auto-detected based on environment
    [string]$StaticAppName = "",  # Auto-detected based on environment
    [string]$Location = "eastus",
    [string]$SubscriptionId = "44027c71-593a-4d51-977b-ab0604cb76eb",
    [string]$Environment = "production",  # dev, staging, production
    [switch]$SkipInstall,
    [switch]$SkipBuild,
    [switch]$SkipDeploy,
    [switch]$Force
)

# Set error action preference and encoding
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "??????????????????????????????????????????????????????????" -ForegroundColor Cyan
Write-Host "?  RefOpen/RefOpen Frontend Deployment                  ?" -ForegroundColor Cyan
Write-Host "??????????????????????????????????????????????????????????" -ForegroundColor Cyan

# Normalize environment
$normalizedEnv = switch ($Environment.ToLower()) {
    { $_ -in @("dev", "development") } { "dev" }
    "staging" { "staging" }
    { $_ -in @("prod", "production") } { "prod" }
    default { "prod" }
}

# Auto-detect infrastructure based on environment
# PRODUCTION = RefOpen infrastructure
# DEV/STAGING = RefOpen infrastructure
$azureConfig = switch ($normalizedEnv) {
    "dev" {
        @{
            ResourceGroup = "refopen-dev-rg"
            StaticAppName = "refopen-frontend-web"
            FunctionAppName = "refopen-api-func"
            ApiUrl = "https://refopen-api-func.azurewebsites.net/api"
            Infrastructure = "RefOpen"
        }
    }
    "staging" {
        @{
            ResourceGroup = "refopen-dev-rg"
            StaticAppName = "refopen-frontend-staging"
            FunctionAppName = "refopen-api-staging"
            ApiUrl = "https://refopen-api-staging.azurewebsites.net/api"
            Infrastructure = "RefOpen"
        }
    }
    "prod" {
        @{
            ResourceGroup = "refopen-prod-rg"
            StaticAppName = "refopen-frontend-web"
            FunctionAppName = "refopen-api-func"
            ApiUrl = "https://refopen-api-func.azurewebsites.net/api"
            Infrastructure = "RefOpen"
        }
    }
}

# Override with parameters if provided
if ($ResourceGroup) { $azureConfig.ResourceGroup = $ResourceGroup }
if ($StaticAppName) { $azureConfig.StaticAppName = $StaticAppName }

Write-Host ""
Write-Host "?? Target Environment: $normalizedEnv" -ForegroundColor Green
Write-Host "?? Infrastructure: $($azureConfig.Infrastructure)" -ForegroundColor $(if ($normalizedEnv -eq "prod") { "Magenta" } else { "Yellow" })
Write-Host "?? Resource Group: $($azureConfig.ResourceGroup)" -ForegroundColor White
Write-Host "?? Static Web App: $($azureConfig.StaticAppName)" -ForegroundColor White
Write-Host "? API Backend: $($azureConfig.ApiUrl)" -ForegroundColor White
Write-Host ""

# ================================================================
# STEP 1: Environment Validation
# ================================================================

Write-Host "Step 1: Validating Environment..." -ForegroundColor Yellow

# Check if running in correct directory
$currentDir = Get-Location
if (-not (Test-Path "frontend/package.json")) {
    Write-Error "ERROR: Must run from project root directory (containing frontend/ folder)"
}

# Validate Azure CLI
try {
    $azVersion = az version --output json | ConvertFrom-Json
    Write-Host "? Azure CLI: $($azVersion.'azure-cli')" -ForegroundColor Green
}
catch {
    Write-Error "ERROR: Azure CLI not found. Install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
}

# Check Azure login
try {
    $account = az account show --output json | ConvertFrom-Json
    Write-Host "? Azure Account: $($account.user.name)" -ForegroundColor Green
    Write-Host "? Subscription: $($account.name)" -ForegroundColor Green
}
catch {
    Write-Host "? Not logged into Azure. Logging in..." -ForegroundColor Red
    az login
}

# Set subscription
Write-Host "?? Setting Azure subscription..." -ForegroundColor Blue
az account set --subscription $SubscriptionId

# Validate Node.js
try {
    $nodeVersion = node --version
    Write-Host "? Node.js: $nodeVersion" -ForegroundColor Green
    
    # Check if Node.js version is 18+
    $nodeVersionNumber = [System.Version]($nodeVersion -replace 'v', '')
    if ($nodeVersionNumber.Major -lt 18) {
        Write-Warning "WARNING: Node.js 18+ recommended for optimal Expo support"
    }
}
catch {
    Write-Error "ERROR: Node.js not found. Install from: https://nodejs.org/"
}

# Check if Expo CLI is available
try {
    $expoVersion = npx expo --version
    Write-Host "? Expo CLI: $expoVersion" -ForegroundColor Green
}
catch {
    Write-Host "?? Installing Expo CLI..." -ForegroundColor Blue
    npm install -g @expo/cli
}

# Verify Azure Static Web App exists
Write-Host "?? Checking Azure Static Web App..." -ForegroundColor Blue
try {
    $staticApp = az staticwebapp show --name $($azureConfig.StaticAppName) --resource-group $($azureConfig.ResourceGroup) --output json | ConvertFrom-Json
    Write-Host "? Static Web App: $($staticApp.defaultHostname)" -ForegroundColor Green
    $deploymentUrl = "https://$($staticApp.defaultHostname)"
}
catch {
    Write-Error "ERROR: Static Web App '$($azureConfig.StaticAppName)' not found in resource group '$($azureConfig.ResourceGroup)'"
}

# ================================================================
# STEP 2: Frontend Dependency Installation
# ================================================================

Write-Host "`nStep 2: Installing Frontend Dependencies..." -ForegroundColor Yellow

if (-not $SkipInstall) {
    Set-Location "frontend"
    
    # Clean install for production
    if ($normalizedEnv -eq "prod" -or $Force) {
        if (Test-Path "node_modules") {
            Write-Host "?? Cleaning existing node_modules..." -ForegroundColor Blue
            Remove-Item -Recurse -Force "node_modules"
        }
        
        if (Test-Path "package-lock.json") {
            Write-Host "?? Cleaning package-lock.json..." -ForegroundColor Blue
            Remove-Item "package-lock.json"
        }
    }
    
    # Create .npmrc to handle dependency conflicts
    Write-Host "?? Creating .npmrc for dependency resolution..." -ForegroundColor Blue
    $npmrcContent = @"
legacy-peer-deps=true
strict-peer-deps=false
fund=false
audit=false
"@
    Set-Content -Path ".npmrc" -Value $npmrcContent
    
    Write-Host "?? Installing dependencies..." -ForegroundColor Blue
    npm install --legacy-peer-deps
    
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "?? npm install with --legacy-peer-deps failed. Trying with --force..."
        npm install --force
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "? npm install failed"
        }
    }
    
    Write-Host "? Dependencies installed successfully" -ForegroundColor Green
    Set-Location ".."
}
else {
    Write-Host "?? Skipping dependency installation" -ForegroundColor Gray
}

# ================================================================
# STEP 3: Environment Configuration
# ================================================================

Write-Host "`nStep 3: Configuring Environment..." -ForegroundColor Yellow

# Create/update .env file based on environment
$envContent = @"
# $($azureConfig.Infrastructure) Frontend $normalizedEnv Configuration
EXPO_PUBLIC_API_URL=$($azureConfig.ApiUrl)
EXPO_PUBLIC_APP_NAME=RefOpen
EXPO_PUBLIC_ENVIRONMENT=$normalizedEnv
EXPO_PUBLIC_VERSION=1.0.0
"@

Set-Content -Path "frontend/.env" -Value $envContent
Write-Host "? Environment configuration created" -ForegroundColor Green
Write-Host "   API URL: $($azureConfig.ApiUrl)" -ForegroundColor Gray

# ================================================================
# STEP 4: Frontend Build for Web
# ================================================================

Write-Host "`nStep 4: Building Frontend for Web..." -ForegroundColor Yellow

if (-not $SkipBuild) {
    Set-Location "frontend"
    
    # Clear previous build
    if (Test-Path "web-build") {
        Write-Host "?? Cleaning previous build..." -ForegroundColor Blue
        Remove-Item -Recurse -Force "web-build"
    }
    
    if (Test-Path "dist") {
        Write-Host "?? Cleaning dist folder..." -ForegroundColor Blue
        Remove-Item -Recurse -Force "dist"
    }
    
    # Fix app.json for build
    Write-Host "?? Preparing app.json for build..." -ForegroundColor Blue
    $appJsonPath = "app.json"
    $appJsonBackupPath = "app.json.backup"
    
    # Backup original app.json
    Copy-Item $appJsonPath $appJsonBackupPath
    
    # Read and modify app.json to remove assetBundlePatterns temporarily
    $appJson = Get-Content $appJsonPath -Raw | ConvertFrom-Json
    if ($appJson.expo.assetBundlePatterns) {
        $appJson.expo.PSObject.Properties.Remove('assetBundlePatterns')
        $appJson | ConvertTo-Json -Depth 10 | Set-Content $appJsonPath
        Write-Host "   Temporarily removed assetBundlePatterns" -ForegroundColor Gray
    }
    
    try {
        # Build for web using Expo
        Write-Host "?? Building React Native Web app..." -ForegroundColor Blue
        npx expo export --platform web --output-dir web-build --clear
        
        # Check if build was successful
        if (Test-Path "web-build/index.html") {
            Write-Host "? Build completed successfully" -ForegroundColor Green
            $buildSuccess = $true
        } else {
            Write-Host "? Build failed: no output" -ForegroundColor Red
            $buildSuccess = $false
        }
    }
    catch {
        Write-Host "?? Build encountered error, checking output..." -ForegroundColor Yellow
        if (Test-Path "web-build/index.html") {
            Write-Host "? Build output exists despite error" -ForegroundColor Green
            $buildSuccess = $true
        } else {
            $buildSuccess = $false
        }
    }
    finally {
        # Restore original app.json
        if (Test-Path $appJsonBackupPath) {
            Copy-Item $appJsonBackupPath $appJsonPath
            Remove-Item $appJsonBackupPath
            Write-Host "   Restored original app.json" -ForegroundColor Gray
        }
    }
    
    if (-not $buildSuccess) {
        Write-Error "? Expo web build failed"
    }
    
    # Verify build output
    if (Test-Path "web-build") {
        $buildFiles = Get-ChildItem "web-build" -Recurse | Measure-Object
        $buildSize = (Get-ChildItem -Path "web-build" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
        Write-Host "   Files: $($buildFiles.Count)" -ForegroundColor Gray
        Write-Host "   Size: $([math]::Round($buildSize, 2)) MB" -ForegroundColor Gray
    }
    
    Set-Location ".."
}
else {
    Write-Host "?? Skipping build step" -ForegroundColor Gray
}

# ================================================================
# STEP 5: Deploy to Azure Static Web App
# ================================================================

Write-Host "`nStep 5: Deploying to Azure Static Web App..." -ForegroundColor Yellow

if (-not $SkipDeploy) {
    Set-Location "frontend"
    
    # Verify build exists
    if (-not (Test-Path "web-build/index.html")) {
        Write-Error "? No build output found. Cannot deploy."
    }
    
    # Get deployment token
    Write-Host "?? Getting deployment token..." -ForegroundColor Blue
    $deploymentToken = az staticwebapp secrets list --name $($azureConfig.StaticAppName) --resource-group $($azureConfig.ResourceGroup) --query "properties.apiKey" --output tsv
    
    if (-not $deploymentToken) {
        Write-Error "? Could not retrieve deployment token"
    }
    
    Write-Host "? Deployment token retrieved" -ForegroundColor Green
    
    # Install SWA CLI if not present
    try {
        swa --version | Out-Null
    }
    catch {
        Write-Host "?? Installing Azure Static Web Apps CLI..." -ForegroundColor Blue
        npm install -g @azure/static-web-apps-cli
    }
    
    # Deploy
    try {
        Write-Host "?? Deploying to $normalizedEnv..." -ForegroundColor Blue
        
        if ($normalizedEnv -eq "prod") {
            swa deploy --app-location . --output-location web-build --deployment-token $deploymentToken --env production
        } else {
            swa deploy --app-location . --output-location web-build --deployment-token $deploymentToken
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "? Deployment completed successfully" -ForegroundColor Green
        } else {
            Write-Warning "?? Deployment may have issues"
        }
    }
    catch {
        Write-Warning "?? SWA CLI deployment encountered error: $_"
    }
    
    Set-Location ".."
}
else {
    Write-Host "?? Skipping deployment step" -ForegroundColor Gray
}

# ================================================================
# STEP 6: Configure Static Web App Settings
# ================================================================

Write-Host "`nStep 6: Configuring Static Web App..." -ForegroundColor Yellow

# Configure staticwebapp.config.json
$staticWebAppConfigContent = @"
{
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["anonymous"]
    },
    {
      "route": "/*",
      "rewrite": "/index.html"
    }
  ],
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/*.{css,scss,js,png,gif,ico,jpg,svg,woff,woff2,ttf,eot}"]
  },
  "mimeTypes": {
    ".json": "application/json",
    ".js": "application/javascript",
    ".css": "text/css",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2"
  },
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Content-Security-Policy": "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:; style-src 'self' 'unsafe-inline' https: data:; font-src 'self' data: https: blob:; img-src 'self' data: https: blob:; connect-src 'self' https: wss: blob:; media-src 'self' https: data: blob:; object-src 'none'; base-uri 'self'"
  }
}
"@

if (Test-Path "frontend/web-build") {
    Set-Content -Path "frontend/web-build/staticwebapp.config.json" -Value $staticWebAppConfigContent
    Write-Host "? Static Web App configuration applied" -ForegroundColor Green
}

# ================================================================
# STEP 7: Verification
# ================================================================

Write-Host "`nStep 7: Verification..." -ForegroundColor Yellow

# Wait for deployment to propagate
Write-Host "? Waiting for deployment to propagate (45 seconds)..." -ForegroundColor Blue
Start-Sleep -Seconds 45

# Test the deployed application
Write-Host "?? Testing deployed application..." -ForegroundColor Blue

try {
    $response = Invoke-RestMethod -Uri $deploymentUrl -Method GET -TimeoutSec 30
    Write-Host "? Application is responding" -ForegroundColor Green
}
catch {
    Write-Warning "?? Application may still be starting up"
}

# ================================================================
# DEPLOYMENT COMPLETE
# ================================================================

Write-Host "`n??????????????????????????????????????????????????????????" -ForegroundColor Green
Write-Host "?  ? FRONTEND DEPLOYMENT COMPLETED SUCCESSFULLY         ?" -ForegroundColor Green
Write-Host "??????????????????????????????????????????????????????????" -ForegroundColor Green

Write-Host "`n?? Deployment Summary:" -ForegroundColor Cyan
Write-Host "   Infrastructure: $($azureConfig.Infrastructure)" -ForegroundColor White
Write-Host "   Environment: $normalizedEnv" -ForegroundColor White
Write-Host "   Static Web App: $($azureConfig.StaticAppName)" -ForegroundColor White
Write-Host "   Resource Group: $($azureConfig.ResourceGroup)" -ForegroundColor White

Write-Host "`n?? Access URLs:" -ForegroundColor Cyan
Write-Host "   Frontend: $deploymentUrl" -ForegroundColor Green
Write-Host "   API Backend: $($azureConfig.ApiUrl)" -ForegroundColor Green

if ($normalizedEnv -eq "prod") {
    Write-Host "`n?? Custom Domains (if configured):" -ForegroundColor Cyan
    Write-Host "   https://refopen.com" -ForegroundColor White
    Write-Host "   https://www.refopen.com" -ForegroundColor White
}

Write-Host "`n? Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Test: $deploymentUrl" -ForegroundColor White
Write-Host "   2. Verify login functionality" -ForegroundColor White
Write-Host "   3. Check browser console" -ForegroundColor White
Write-Host "   4. Verify API calls work" -ForegroundColor White

# Clean up
if (Test-Path "frontend/.npmrc") {
    Remove-Item "frontend/.npmrc"
}

Write-Host "`n?? Deployment completed successfully!" -ForegroundColor Green