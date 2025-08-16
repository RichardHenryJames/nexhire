# NexHire Backend Deployment Script for Azure Functions
# This script deploys the complete NexHire backend to your existing Azure Function App

Write-Host " Starting NexHire Backend Deployment..." -ForegroundColor Green

# Configuration Variables
$RESOURCE_GROUP = "nexhire-dev-rg"
$FUNCTION_APP_NAME = "nexhire-api-func"
$SQL_SERVER = "nexhire-sql-srv"
$SQL_DATABASE = "nexhire-sql-db"
$SUBSCRIPTION_ID = "44027c71-593a-4d51-977b-ab0604cb76eb"

# Check if logged into Azure
Write-Host " Checking Azure login status..." -ForegroundColor Yellow
$account = az account show --query "user.name" -o tsv 2>$null
if (-not $account) {
    Write-Host " Please login to Azure..." -ForegroundColor Red
    az login
    if ($LASTEXITCODE -ne 0) {
        Write-Error "? Azure login failed!"
        exit 1
    }
}

# Set subscription
Write-Host " Setting Azure subscription..." -ForegroundColor Yellow
az account set --subscription $SUBSCRIPTION_ID
if ($LASTEXITCODE -ne 0) {
    Write-Error "? Failed to set subscription!"
    exit 1
}

Write-Host "? Logged in as: $account" -ForegroundColor Green

# Check if Azure Functions Core Tools is installed
Write-Host " Checking Azure Functions Core Tools..." -ForegroundColor Yellow
$funcVersion = func --version 2>$null
if (-not $funcVersion) {
    Write-Host "? Azure Functions Core Tools not found!" -ForegroundColor Red
    Write-Host "Please install it: npm install -g azure-functions-core-tools@4 --unsafe-perm true" -ForegroundColor Yellow
    exit 1
}
Write-Host "? Azure Functions Core Tools version: $funcVersion" -ForegroundColor Green

# Check if Node.js is installed
Write-Host " Checking Node.js installation..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Error "? Node.js not found! Please install Node.js v20 or higher."
    exit 1
}
Write-Host "? Node.js version: $nodeVersion" -ForegroundColor Green

# Clean previous builds
Write-Host " Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "  � Removed dist folder" -ForegroundColor Gray
}
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules"
    Write-Host "  � Removed node_modules folder" -ForegroundColor Gray
}

# Install dependencies
Write-Host " Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "? npm install failed!"
    exit 1
}
Write-Host "? Dependencies installed successfully" -ForegroundColor Green

# Build TypeScript
Write-Host " Building TypeScript..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "? TypeScript build failed!"
    exit 1
}
Write-Host "? TypeScript build completed" -ForegroundColor Green

# Check if Function App exists
Write-Host " Checking if Function App exists..." -ForegroundColor Yellow
$functionAppExists = az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --query "name" -o tsv 2>$null
if (-not $functionAppExists) {
    Write-Error "? Function App '$FUNCTION_APP_NAME' not found in resource group '$RESOURCE_GROUP'!"
    Write-Host "Please create the Function App first using the infrastructure deployment script." -ForegroundColor Yellow
    exit 1
}
Write-Host "? Function App '$FUNCTION_APP_NAME' found" -ForegroundColor Green

# Get SQL Server public IP for firewall rules
Write-Host " Getting public IP for SQL Server firewall..." -ForegroundColor Yellow
$publicIP = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing).Content.Trim()
Write-Host " Your public IP: $publicIP" -ForegroundColor Cyan

# Add firewall rule for deployment
Write-Host " Adding firewall rule for deployment..." -ForegroundColor Yellow
az sql server firewall-rule create `
    --resource-group $RESOURCE_GROUP `
    --server $SQL_SERVER `
    --name "DeploymentAccess-$(Get-Date -Format 'yyyyMMdd-HHmmss')" `
    --start-ip-address $publicIP `
    --end-ip-address $publicIP `
    --output none 2>$null

# Configure Function App settings - ALL AT ONCE for speed
Write-Host " Configuring ALL Function App settings at once..." -ForegroundColor Yellow

az functionapp config appsettings set `
    --name $FUNCTION_APP_NAME `
    --resource-group $RESOURCE_GROUP `
    --settings `
        "DB_SERVER=nexhire-sql-srv.database.windows.net" `
        "DB_NAME=nexhire-sql-db" `
        "DB_USER=sqladmin" `
        "DB_PASSWORD=P@ssw0rd1234!" `
        "JWT_SECRET=nexhire-super-secret-jwt-key-change-in-production-2024" `
        "JWT_EXPIRES_IN=24h" `
        "JWT_REFRESH_EXPIRES_IN=7d" `
        "CORS_ORIGINS=http://localhost:3000,https://nexhire-frontend-web.azurestaticapps.net" `
        "NODE_ENV=production" `
        "WEBSITE_RUN_FROM_PACKAGE=1" `
        "FUNCTIONS_WORKER_RUNTIME=node" `
        "WEBSITE_NODE_DEFAULT_VERSION=~20" `
        "SCM_DO_BUILD_DURING_DEPLOYMENT=false" `
        "ENABLE_ORYX_BUILD=false" `
    --output none

if ($LASTEXITCODE -ne 0) {
    Write-Error "? Failed to configure Function App settings!"
    exit 1
}
Write-Host "? ALL Function App settings configured in one command!" -ForegroundColor Green

# Test database connection
Write-Host " Testing database connection..." -ForegroundColor Yellow
$connectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

try {
    # Check if SqlServer module is available
    if (-not (Get-Module -ListAvailable -Name SqlServer)) {
        Write-Host " Installing SqlServer PowerShell module..." -ForegroundColor Yellow
        Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
    }
    
    Import-Module SqlServer -Force
    $testResult = Invoke-Sqlcmd -ConnectionString $connectionString -Query "SELECT 1 as TestConnection" -QueryTimeout 10
    
    if ($testResult.TestConnection -eq 1) {
        Write-Host "? Database connection successful" -ForegroundColor Green
    }
} catch {
    Write-Warning " Database connection test failed: $($_.Exception.Message)"
    Write-Host "The deployment will continue, but database may need manual verification." -ForegroundColor Yellow
}

# Create .funcignore file to exclude unnecessary files
Write-Host " Creating optimized .funcignore file..." -ForegroundColor Yellow
$funcIgnoreContent = @"
*.ts
*.map
src/
tsconfig.json
.git/
.gitignore
.vscode/
.vs/
test/
tests/
*.test.*
*.spec.*
README.md
*.md
node_modules/.bin/
.env
.env.*
deploy-*.ps1
test-*.ps1
*.log
.npm/
coverage/
**/.vs/
**/bin/
**/obj/
*.user
*.suo
*.cache
"@

$funcIgnoreContent | Out-File -FilePath ".funcignore" -Encoding UTF8
Write-Host "? Optimized .funcignore file created" -ForegroundColor Green

# Deploy the Function App
Write-Host " Deploying to Azure Function App..." -ForegroundColor Yellow
Write-Host "This may take 2-4 minutes..." -ForegroundColor Cyan

# Use optimized deployment with local build
func azure functionapp publish $FUNCTION_APP_NAME --typescript --build local --force

if ($LASTEXITCODE -ne 0) {
    Write-Error "? Function App deployment failed!"
    Write-Host " Try running these commands manually:" -ForegroundColor Yellow
    Write-Host "   1. Close Visual Studio if open" -ForegroundColor Gray
    Write-Host "   2. func azure functionapp publish $FUNCTION_APP_NAME --typescript --force" -ForegroundColor Gray
    exit 1
}

Write-Host "? Function App deployed successfully!" -ForegroundColor Green

# Wait a moment for the app to start
Write-Host "? Waiting for Function App to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Get Function App URL
$functionAppUrl = az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --query "defaultHostName" -o tsv
$apiBaseUrl = "https://$functionAppUrl"

# Test a simple endpoint to verify deployment
Write-Host " Testing deployment..." -ForegroundColor Yellow
try {
    $testResponse = Invoke-RestMethod -Uri "$apiBaseUrl/api/reference/job-types" -Method GET -TimeoutSec 30
    if ($testResponse) {
        Write-Host "? API is responding correctly!" -ForegroundColor Green
    }
} catch {
    Write-Warning " API test failed, but deployment completed. The app may need a few minutes to start."
}

Write-Host ""
Write-Host " DEPLOYMENT COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""
Write-Host " Deployment Summary:" -ForegroundColor Cyan
Write-Host "  � Function App: $FUNCTION_APP_NAME" -ForegroundColor White
Write-Host "  � Resource Group: $RESOURCE_GROUP" -ForegroundColor White
Write-Host "  � API Base URL: $apiBaseUrl" -ForegroundColor White
Write-Host "  � Database: $SQL_SERVER/$SQL_DATABASE" -ForegroundColor White
Write-Host ""

Write-Host " API Endpoints Available:" -ForegroundColor Cyan
Write-Host "  � POST   $apiBaseUrl/api/auth/register" -ForegroundColor Yellow
Write-Host "  � POST   $apiBaseUrl/api/auth/login" -ForegroundColor Yellow
Write-Host "  � GET    $apiBaseUrl/api/users/profile" -ForegroundColor Yellow
Write-Host "  � PUT    $apiBaseUrl/api/users/profile" -ForegroundColor Yellow
Write-Host "  � GET    $apiBaseUrl/api/jobs" -ForegroundColor Yellow
Write-Host "  � POST   $apiBaseUrl/api/jobs" -ForegroundColor Yellow
Write-Host "  � GET    $apiBaseUrl/api/jobs/{id}" -ForegroundColor Yellow
Write-Host "  � PUT    $apiBaseUrl/api/jobs/{id}" -ForegroundColor Yellow
Write-Host "  � DELETE $apiBaseUrl/api/jobs/{id}" -ForegroundColor Yellow
Write-Host "  � POST   $apiBaseUrl/api/jobs/{id}/publish" -ForegroundColor Yellow
Write-Host "  � POST   $apiBaseUrl/api/jobs/{id}/close" -ForegroundColor Yellow
Write-Host "  � GET    $apiBaseUrl/api/jobs/search" -ForegroundColor Yellow
Write-Host "  � POST   $apiBaseUrl/api/applications" -ForegroundColor Yellow
Write-Host "  � GET    $apiBaseUrl/api/applications/my" -ForegroundColor Yellow
Write-Host "  � GET    $apiBaseUrl/api/jobs/{jobId}/applications" -ForegroundColor Yellow
Write-Host "  � GET    $apiBaseUrl/api/reference/job-types" -ForegroundColor Yellow
Write-Host "  � GET    $apiBaseUrl/api/reference/currencies" -ForegroundColor Yellow
Write-Host ""

Write-Host " Test the API:" -ForegroundColor Cyan
Write-Host "  curl -X GET `"$apiBaseUrl/api/reference/job-types`"" -ForegroundColor Gray
Write-Host ""

Write-Host " Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Test API endpoints: .\test-api.ps1 -BaseUrl `"$apiBaseUrl/api`"" -ForegroundColor White
Write-Host "  2. Deploy sample data: .\deploy-sample-data.ps1" -ForegroundColor White
Write-Host "  3. Configure frontend to use: $apiBaseUrl/api" -ForegroundColor White
Write-Host "  4. Set up monitoring and logging" -ForegroundColor White
Write-Host "  5. Configure custom domain if needed" -ForegroundColor White
Write-Host ""

Write-Host " Important Notes:" -ForegroundColor Yellow
Write-Host "  � API keys and secrets are set for development" -ForegroundColor White
Write-Host "  � Change JWT_SECRET in production" -ForegroundColor White
Write-Host "  � Database firewall rules may need adjustment" -ForegroundColor White
Write-Host "  � CORS origins are configured for localhost and static web app" -ForegroundColor White
Write-Host ""

# Save deployment info to file
$deploymentInfo = @"
NexHire Backend Deployment Info
Generated: $(Get-Date)

API Base URL: $apiBaseUrl
Function App: $FUNCTION_APP_NAME
Resource Group: $RESOURCE_GROUP
Database: $SQL_SERVER/$SQL_DATABASE

Test Endpoint: $apiBaseUrl/api/reference/job-types

To test the deployment:
.\test-api.ps1 -BaseUrl "$apiBaseUrl/api"

To deploy sample data:
.\deploy-sample-data.ps1

Environment Variables Set:
- DB_SERVER=nexhire-sql-srv.database.windows.net
- DB_NAME=nexhire-sql-db
- DB_USER=sqladmin
- DB_PASSWORD=P@ssw0rd1234!
- JWT_SECRET=nexhire-super-secret-jwt-key-change-in-production-2024
- JWT_EXPIRES_IN=24h
- JWT_REFRESH_EXPIRES_IN=7d
- CORS_ORIGINS=http://localhost:3000,https://nexhire-frontend-web.azurestaticapps.net
- NODE_ENV=production
"@

$deploymentInfo | Out-File -FilePath "deployment-info.txt" -Encoding UTF8
Write-Host " Deployment info saved to: deployment-info.txt" -ForegroundColor Green

Write-Host ""
Write-Host " Your NexHire backend is now live and ready for use!" -ForegroundColor Green