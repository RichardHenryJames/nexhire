param(
    [string]$ResourceGroup = "",  # Auto-detected based on environment
    [string]$StaticAppName = "",  # Auto-detected based on environment
    [string]$Environment = "production",  # dev, staging, production
    [string]$SubscriptionId = "44027c71-593a-4d51-977b-ab0604cb76eb"
)

$ErrorActionPreference = "Stop"

Write-Host "=== RefOpen/RefOpen Frontend Build & Deploy ===" -ForegroundColor Cyan

# Normalize environment
$normalizedEnv = switch ($Environment.ToLower()) {
    { $_ -in @("dev", "development") } { "dev" }
    "staging" { "staging" }
    { $_ -in @("prod", "production") } { "prod" }
    default { "prod" }
}

# Env-specific resources
# PRODUCTION = RefOpen infrastructure
# DEV/STAGING = RefOpen infrastructure
$azureResources = switch ($normalizedEnv) {
    "dev" {
        @{ 
            ResourceGroup = "refopen-dev-rg"
            StaticAppName = "refopen-frontend-dev"
            FunctionAppName = "refopen-api-dev"
            Infrastructure = "RefOpen"
        }
    }
    "staging" {
        @{ 
            ResourceGroup = "refopen-dev-rg"
            StaticAppName = "refopen-frontend-staging"
            FunctionAppName = "refopen-api-staging"
            Infrastructure = "RefOpen"
        }
    }
    "prod" {
        @{ 
            ResourceGroup = "refopen-prod-rg"
            StaticAppName = "refopen-frontend-web"
            FunctionAppName = "refopen-api-func"
            Infrastructure = "RefOpen"
        }
    }
}

# Override with parameters if provided
if ($ResourceGroup) { $azureResources.ResourceGroup = $ResourceGroup }
if ($StaticAppName) { $azureResources.StaticAppName = $StaticAppName }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "        FRONTEND DEPLOYMENT CONFIGURATION              " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target Environment: $normalizedEnv" -ForegroundColor Green
Write-Host "Infrastructure: $($azureResources.Infrastructure)" -ForegroundColor $(if ($normalizedEnv -eq "prod") { "Magenta" } else { "Yellow" })
Write-Host "Resource Group: $($azureResources.ResourceGroup)" -ForegroundColor White
Write-Host "Static Web App: $($azureResources.StaticAppName)" -ForegroundColor White
Write-Host "Function App: $($azureResources.FunctionAppName)" -ForegroundColor White
Write-Host ""

# Set Azure subscription
Write-Host "Setting Azure subscription..." -ForegroundColor Yellow
az account set --subscription $SubscriptionId
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to set subscription"
    exit 1
}
Write-Host "Subscription set" -ForegroundColor Green

# Step 1: Switch to frontend directory
if (-not (Test-Path "frontend")) {
    Write-Error "Frontend directory not found!"
    exit 1
}

Set-Location "frontend"
Write-Host "`nChanged to frontend directory" -ForegroundColor Cyan

# Step 2: Switch environment file
$envFile = ".env.$normalizedEnv"
Write-Host "`nSwitching to $envFile..." -ForegroundColor Yellow

if (Test-Path $envFile) {
    Copy-Item $envFile ".env" -Force
    Write-Host "Environment file switched to $envFile" -ForegroundColor Green
    
    # Show key configurations
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "REACT_APP_API_URL=(.+)") {
        $apiUrl = $matches[1].Trim()
        Write-Host "   API URL: $apiUrl" -ForegroundColor Gray
    }
} else {
    Write-Host " Warning: $envFile not found, using existing .env" -ForegroundColor Yellow
    if (Test-Path ".env") {
        Write-Host "   Using existing .env file" -ForegroundColor Gray
    } else {
        Write-Error "No .env file found! Please create .env.$normalizedEnv"
        Set-Location ..
        exit 1
    }
}

# Step 3: Install dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "npm install failed!"
    Set-Location ..
    exit 1
}
Write-Host "Dependencies installed" -ForegroundColor Green

# Step 4: Clean previous build
if (Test-Path "web-build") {
    Write-Host "`nCleaning previous build..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "web-build"
    Write-Host "Previous build cleaned" -ForegroundColor Green
}

# Step 5: Build frontend
Write-Host "`nBuilding frontend for $normalizedEnv..." -ForegroundColor Yellow
Write-Host "   Platform: web" -ForegroundColor Gray
Write-Host "   Output: web-build/" -ForegroundColor Gray

npx expo export --platform web --output-dir web-build --clear

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed!"
    Set-Location ..
    exit 1
}

# Verify build
if (-not (Test-Path "web-build/index.html")) {
    Write-Error "Build failed! No index.html found in web-build/"
    Set-Location ..
    exit 1
}

# Ensure Azure Static Web Apps routing config is included in the deployed output
if (Test-Path "staticwebapp.config.json") {
    Copy-Item "staticwebapp.config.json" "web-build/staticwebapp.config.json" -Force
    Write-Host "Azure SWA config copied to web-build/staticwebapp.config.json" -ForegroundColor Green
} else {
    Write-Host "Warning: staticwebapp.config.json not found in frontend/. SPA deep links may 404." -ForegroundColor Yellow
}

# Copy public folder assets (favicon, etc.) to web-build - but NOT index.html
if (Test-Path "public") {
    Get-ChildItem "public" -Exclude "index.html" | ForEach-Object {
        Copy-Item $_.FullName "web-build/" -Force -Recurse
    }
    Write-Host "Public folder assets (excluding index.html) copied to web-build/" -ForegroundColor Green
}

# Update the Expo-generated index.html with SEO meta tags
$indexPath = "web-build/index.html"
if (Test-Path $indexPath) {
    $indexContent = Get-Content $indexPath -Raw
    
    # Replace the title
    $indexContent = $indexContent -replace '<title>.*?</title>', '<title>RefOpen - Your Next Career Opportunity Awaits</title>'
    
    # Add SEO meta tags after <meta charset>
    $seoTags = @"
    <meta name="description" content="RefOpen is a professional job referral platform connecting job seekers with opportunities through trusted referrals. Find your next career opportunity today." />
    <meta name="keywords" content="jobs, careers, referrals, job search, employment, hiring, professional network" />
    <meta name="author" content="RefOpen" />
    <meta name="robots" content="index, follow" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://refopen.com/" />
    <meta property="og:title" content="RefOpen - Your Next Career Opportunity Awaits" />
    <meta property="og:description" content="RefOpen is a professional job referral platform connecting job seekers with opportunities through trusted referrals." />
    <meta property="og:image" content="https://refopen.com/favicon.png" />
    <meta property="og:site_name" content="RefOpen" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:title" content="RefOpen - Your Next Career Opportunity Awaits" />
    <meta property="twitter:description" content="RefOpen is a professional job referral platform connecting job seekers with opportunities through trusted referrals." />
    <meta property="twitter:image" content="https://refopen.com/favicon.png" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/favicon.png" />
    <meta name="theme-color" content="#0F172A" />
    <link rel="canonical" href="https://refopen.com/" />
"@
    
    # Only add SEO tags if not already present
    if ($indexContent -notmatch 'og:title') {
        $indexContent = $indexContent -replace '(<meta charset="utf-8"\s*/?>)', "`$1`n$seoTags"
    }
    
    Set-Content $indexPath $indexContent -NoNewline
    Write-Host "SEO meta tags added to index.html" -ForegroundColor Green
}

$buildSize = (Get-ChildItem -Path "web-build" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "Build completed successfully" -ForegroundColor Green
Write-Host "   Build size: $([math]::Round($buildSize, 2)) MB" -ForegroundColor Gray

# Step 6: Get deployment token
$targetStaticApp = $azureResources.StaticAppName
$targetResourceGroup = $azureResources.ResourceGroup

Write-Host "`nFetching deployment token..." -ForegroundColor Yellow
$deploymentToken = az staticwebapp secrets list `
    --name $targetStaticApp `
    --resource-group $targetResourceGroup `
    --query "properties.apiKey" -o tsv 2>$null

if (-not $deploymentToken) {
    Write-Error "Failed to fetch deployment token for $targetStaticApp in $targetResourceGroup"
    Write-Host "Make sure the Static Web App exists and you have access" -ForegroundColor Yellow
    Set-Location ..
    exit 1
}
Write-Host "Deployment token retrieved" -ForegroundColor Green

# Step 7: Deploy to Azure Static Web App
Write-Host "`nDeploying to Azure Static Web App..." -ForegroundColor Yellow
Write-Host "   Target: $targetStaticApp" -ForegroundColor Gray
Write-Host "   Environment: $normalizedEnv" -ForegroundColor Gray

if ($normalizedEnv -eq "prod") {
    swa deploy --app-location . --output-location web-build --deployment-token $deploymentToken --env production
} else {
    swa deploy --app-location . --output-location web-build --deployment-token $deploymentToken
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "Deployment failed!"
    Set-Location ..
    exit 1
}

# Step 8: Success summary
$deploymentUrl = "https://$targetStaticApp.azurestaticapps.net"

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "    FRONTEND DEPLOYMENT COMPLETED SUCCESSFULLY      " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

Write-Host "`nDeployment Summary:" -ForegroundColor Cyan
Write-Host "   Infrastructure: $($azureResources.Infrastructure)" -ForegroundColor White
Write-Host "   Environment: $normalizedEnv" -ForegroundColor White
Write-Host "   Static Web App: $targetStaticApp" -ForegroundColor White
Write-Host "   Resource Group: $targetResourceGroup" -ForegroundColor White

Write-Host "`nAccess your frontend at:" -ForegroundColor Cyan
Write-Host "   $deploymentUrl" -ForegroundColor Green

if ($normalizedEnv -eq "prod") {
    Write-Host "`nCustom Domains:" -ForegroundColor Cyan
    Write-Host "   https://refopen.com (if configured)" -ForegroundColor White
    Write-Host "   https://www.refopen.com (if configured)" -ForegroundColor White
}

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "   1. Open: $deploymentUrl" -ForegroundColor White
Write-Host "   2. Test all functionality" -ForegroundColor White
Write-Host "   3. Check browser console for errors" -ForegroundColor White
if ($normalizedEnv -eq "prod") {
    Write-Host "   4. Verify API calls to: https://refopen-api-func.azurewebsites.net/api" -ForegroundColor White
}

Set-Location ..

Write-Host "`nFrontend deployment script completed!" -ForegroundColor Green
