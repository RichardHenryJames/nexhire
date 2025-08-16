# Quick Fix Script for NexHire Backend Deployment
# Run this if you encounter any deployment issues

Write-Host " NexHire Backend Quick Fix Script" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host ""

# Clean and reset everything
Write-Host " Cleaning project..." -ForegroundColor Yellow

# Remove node_modules and package-lock.json if they exist
if (Test-Path "node_modules") {
    Write-Host "  � Removing node_modules..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "node_modules"
}

if (Test-Path "package-lock.json") {
    Write-Host "  � Removing package-lock.json..." -ForegroundColor Gray
    Remove-Item -Force "package-lock.json"
}

if (Test-Path "dist") {
    Write-Host "  � Removing dist folder..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "dist"
}

Write-Host "? Project cleaned" -ForegroundColor Green

# Fresh install
Write-Host " Fresh install of dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "? npm install failed!"
    exit 1
}
Write-Host "? Dependencies installed" -ForegroundColor Green

# Test TypeScript compilation
Write-Host " Testing TypeScript compilation..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "? TypeScript build failed!"
    Write-Host ""
    Write-Host " Common TypeScript issues:" -ForegroundColor Yellow
    Write-Host "  � Check for syntax errors in TypeScript files" -ForegroundColor White
    Write-Host "  � Verify all imports are correct" -ForegroundColor White
    Write-Host "  � Make sure tsconfig.json is valid" -ForegroundColor White
    exit 1
}
Write-Host "? TypeScript compilation successful" -ForegroundColor Green

# Verify all function files exist
Write-Host " Verifying Azure Functions..." -ForegroundColor Yellow

$requiredFunctions = @(
    "auth-register",
    "auth-login", 
    "users-profile",
    "jobs",
    "jobs-by-id",
    "jobs-publish",
    "jobs-close",
    "jobs-search",
    "applications",
    "applications-my",
    "job-applications", 
    "reference-job-types",
    "reference-currencies"
)

$missingFunctions = @()
foreach ($func in $requiredFunctions) {
    if (-not (Test-Path "$func/function.json") -or -not (Test-Path "$func/index.ts")) {
        $missingFunctions += $func
        Write-Host "  ? Missing: $func" -ForegroundColor Red
    } else {
        Write-Host "  ? Found: $func" -ForegroundColor Green
    }
}

if ($missingFunctions.Count -gt 0) {
    Write-Error "? Missing Azure Functions: $($missingFunctions -join ', ')"
    exit 1
}

# Verify built JavaScript files exist
Write-Host " Verifying built files..." -ForegroundColor Yellow
if (-not (Test-Path "dist")) {
    Write-Error "? dist folder not found! TypeScript build may have failed."
    exit 1
}

$builtFiles = Get-ChildItem -Path "dist" -Recurse -Filter "*.js"
if ($builtFiles.Count -eq 0) {
    Write-Error "? No JavaScript files found in dist folder!"
    exit 1
}

Write-Host "? Found $($builtFiles.Count) built JavaScript files" -ForegroundColor Green

# Check Azure CLI login
Write-Host " Checking Azure CLI..." -ForegroundColor Yellow
$account = az account show --query "user.name" -o tsv 2>$null
if (-not $account) {
    Write-Host "? Not logged into Azure CLI" -ForegroundColor Red
    Write-Host "Please run: az login" -ForegroundColor Yellow
    exit 1
}
Write-Host "? Logged into Azure as: $account" -ForegroundColor Green

# Check Function App exists
Write-Host " Checking Function App..." -ForegroundColor Yellow
$functionApp = az functionapp show --name "nexhire-api-func" --resource-group "nexhire-dev-rg" --query "name" -o tsv 2>$null
if (-not $functionApp) {
    Write-Error "? Function App 'nexhire-api-func' not found!"
    Write-Host "Please create it first using the infrastructure deployment script." -ForegroundColor Yellow
    exit 1
}
Write-Host "? Function App found: $functionApp" -ForegroundColor Green

Write-Host ""
Write-Host " ALL CHECKS PASSED!" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green
Write-Host ""
Write-Host "? Project is clean and ready for deployment" -ForegroundColor White
Write-Host "? All dependencies are installed" -ForegroundColor White  
Write-Host "? TypeScript compilation successful" -ForegroundColor White
Write-Host "? All Azure Functions are present" -ForegroundColor White
Write-Host "? Built files are ready" -ForegroundColor White
Write-Host "? Azure CLI is configured" -ForegroundColor White
Write-Host "? Function App exists and is accessible" -ForegroundColor White
Write-Host ""
Write-Host " Now run: .\deploy-backend.ps1" -ForegroundColor Cyan
Write-Host ""