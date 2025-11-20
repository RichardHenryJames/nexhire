# ?? RefOpen Deployment Manager
# Unified deployment script for both frontend and backend

param(
    [string]$Component = "both",      # frontend, backend, both
    [string]$Environment = "dev", # dev, staging, production
    [switch]$SkipBuild,
    [switch]$SkipTest,
    [switch]$Status
)

$ErrorActionPreference = "Stop"

Write-Host "?? RefOpen Deployment Manager" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

function Show-Usage {
    Write-Host "?? Usage Examples:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  # Deploy both frontend and backend to production"
    Write-Host "  .\deploy.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "  # Deploy only frontend to staging"
    Write-Host "  .\deploy.ps1 -Component frontend -Environment staging" -ForegroundColor White
    Write-Host ""
    Write-Host "  # Deploy backend to development (skip build)"
    Write-Host "  .\deploy.ps1 -Component backend -Environment dev -SkipBuild" -ForegroundColor White
    Write-Host ""
    Write-Host "  # Show deployment status"
    Write-Host "  .\deploy.ps1 -Status" -ForegroundColor White
    Write-Host ""
    Write-Host "?? Valid Components: frontend, backend, both" -ForegroundColor Cyan
    Write-Host "?? Valid Environments: dev, staging, prod" -ForegroundColor Cyan
}

function Show-DeploymentStatus {
    Write-Host "?? Current Deployment Status:" -ForegroundColor Cyan
    Write-Host ""
    
    # Check current environment files
    Write-Host "?? Environment Status:" -ForegroundColor Yellow
    
    $frontendEnv = if (Test-Path "frontend/.env") {
        $content = Get-Content "frontend/.env" -Raw
        if ($content -match "EXPO_PUBLIC_APP_ENV=(.+)") { $matches[1].Trim() } else { "unknown" }
    } else { "no .env file" }
    
    $backendEnv = if (Test-Path ".env") {
        $content = Get-Content ".env" -Raw  
        if ($content -match "RefOpen_ENV=(.+)") { $matches[1].Trim() } else { "unknown" }
    } else { "no .env file" }
    
    Write-Host "  Frontend: $frontendEnv" -ForegroundColor White
    Write-Host "  Backend: $backendEnv" -ForegroundColor White
    Write-Host ""
    
    # Test deployed endpoints
    Write-Host "?? Live Endpoint Status:" -ForegroundColor Yellow
    
    # Test backend health
    try {
        $healthResponse = Invoke-RestMethod -Uri "https://refopen-api-func.azurewebsites.net/api/health" -Method Get -TimeoutSec 15
        if ($healthResponse.success) {
            Write-Host "  ? Backend API: $($healthResponse.environment) environment" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ? Backend API: Not responding" -ForegroundColor Red
    }
    
    # Test frontend
    try {
        $frontendResponse = Invoke-WebRequest -Uri "https://refopen-frontend-web.azurestaticapps.net" -Method Get -TimeoutSec 15 -UseBasicParsing
        if ($frontendResponse.StatusCode -eq 200) {
            Write-Host "  ? Frontend App: Live and responding" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ? Frontend App: Not responding" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "?? Live URLs:" -ForegroundColor Cyan
    Write-Host "  Frontend: https://refopen-frontend-web.azurestaticapps.net" -ForegroundColor White
    Write-Host "  Backend API: https://refopen-api-func.azurewebsites.net/api" -ForegroundColor White
}

function Deploy-Component {
    param(
        [string]$ComponentName,
        [string]$TargetEnvironment
    )
    
    $deploymentStart = Get-Date
    
    switch ($ComponentName) {
        "frontend" {
            Write-Host "??? Deploying Frontend..." -ForegroundColor Green
            Write-Host "Environment: $TargetEnvironment" -ForegroundColor Gray
            
            Set-Location "frontend"
            
            $deployArgs = @(
                ".\deployfe.ps1"
                "-Environment", $TargetEnvironment
            )
            
            if ($SkipBuild) { $deployArgs += "-SkipBuild" }
            
            & powershell @deployArgs
            $frontendResult = $LASTEXITCODE
            
            Set-Location ".."
            
            if ($frontendResult -eq 0) {
                Write-Host "? Frontend deployment successful!" -ForegroundColor Green
            } else {
                Write-Host "? Frontend deployment failed!" -ForegroundColor Red
                return $false
            }
        }
        
        "backend" {
            Write-Host "?? Deploying Backend..." -ForegroundColor Green
            Write-Host "Environment: $TargetEnvironment" -ForegroundColor Gray
            
            $deployArgs = @(
                ".\deploy-backend.ps1"
                "-Environment", $TargetEnvironment
            )
            
            if ($SkipBuild) { $deployArgs += "-SkipBuild" }
            if ($SkipTest) { $deployArgs += "-SkipTest" }
            
            & powershell @deployArgs
            $backendResult = $LASTEXITCODE
            
            if ($backendResult -eq 0) {
                Write-Host "? Backend deployment successful!" -ForegroundColor Green
            } else {
                Write-Host "? Backend deployment failed!" -ForegroundColor Red
                return $false
            }
        }
    }
    
    $deploymentEnd = Get-Date
    $duration = $deploymentEnd - $deploymentStart
    Write-Host "?? $ComponentName deployment took: $($duration.ToString('mm\:ss'))" -ForegroundColor Cyan
    
    return $true
}

# First install required extension if not already installed
az extension add --name application-insights --yes --only-show-errors

# Create Resource Group
$RG_NAME="refopen-dev-rg"
# Changed to West US 2 which supports all services we need
$LOCATION="westus2"
az group create --name $RG_NAME --location $LOCATION

# 1. Create Static Web App (Free tier)
az staticwebapp create `
  --name "refopen-frontend-web" `
  --resource-group $RG_NAME ``
  --location $LOCATION ``
  --sku "Free"

# 2. Create Storage Account for Function App and Blob
$STORAGE_NAME="refopenfuncdevst"
az storage account create ``
  --name $STORAGE_NAME ``
  --resource-group $RG_NAME ``
  --location $LOCATION ``
  --sku "Standard_LRS"

# Wait for storage account to be ready
Write-Host "Waiting for storage account to be fully provisioned..."
Start-Sleep -Seconds 30

# 3. Create Function App (Consumption Plan)
az functionapp create ``
  --name "refopen-api-func" ``
  --resource-group $RG_NAME ``
  --storage-account $STORAGE_NAME ``
  --consumption-plan-location $LOCATION ``
  --runtime "node" ``
  --runtime-version "20" ``
  --functions-version "4"

# 4. Create SQL Server
az sql server create ``
  --name "refopen-sql-srv" ``
  --resource-group $RG_NAME ``
  --location $LOCATION ``
  --admin-user "sqladmin" ``
  --admin-password "P@ssw0rd1234!"

# Wait for SQL Server to be ready
Write-Host "Waiting for SQL Server to be fully provisioned..."
Start-Sleep -Seconds 30

# 5. Create SQL Database (Basic tier)
az sql db create ``
  --name "refopen-sql-db" ``
  --resource-group $RG_NAME ``
  --server "refopen-sql-srv" ``
  --service-objective "Basic"

# 6. Create Blob Storage
$BLOB_STORAGE="refopenblobdev"
az storage account create ``
  --name $BLOB_STORAGE ``
  --resource-group $RG_NAME ``
  --location $LOCATION ``
  --sku "Standard_LRS" ``
  --kind "StorageV2"

# 7. Create Cognitive Search (Free tier)
az search service create ``
  --name "refopen-search" ``
  --resource-group $RG_NAME ``
  --location $LOCATION ``
  --sku "free"

# 8. Create Application Insights
az config set extension.dynamic_install_allow_preview=true
az monitor app-insights component create ``
  --app "refopen-monitor" ``
  --location $LOCATION ``
  --resource-group $RG_NAME ``
  --application-type "web"

Write-Host "Deployment completed! Please create Azure AD B2C tenant manually through Azure Portal"
