# Deployment & Infrastructure

## Overview

NexHire uses a fully cloud-based infrastructure on Microsoft Azure, leveraging serverless architecture for scalability and cost-effectiveness. The deployment process is automated using PowerShell scripts and Azure CLI.

## Azure Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Azure Cloud Platform                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐      ┌─────────────────────┐         │
│  │   Static Web     │◄─────┤    Azure CDN        │         │
│  │   Apps (Frontend)│      │  (Content Delivery) │         │
│  └──────────────────┘      └─────────────────────┘         │
│           │                                                  │
│           │ API Calls                                        │
│           ▼                                                  │
│  ┌──────────────────┐      ┌─────────────────────┐         │
│  │  Azure Functions │◄─────┤  Application        │         │
│  │    (Backend API) │      │  Insights           │         │
│  └──────────────────┘      │  (Monitoring)       │         │
│           │                └─────────────────────┘         │
│           │                                                  │
│           ├──────────┬─────────────┬───────────────┐       │
│           ▼          ▼             ▼               ▼       │
│  ┌─────────────┐ ┌────────┐  ┌─────────┐   ┌─────────┐   │
│  │   Azure SQL │ │ Blob   │  │ Service │   │Firebase │   │
│  │   Database  │ │Storage │  │  Bus    │   │  Auth   │   │
│  └─────────────┘ └────────┘  └─────────┘   └─────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Scripts

### 1. Main Deployment Script (`deploy.ps1`)

Orchestrates the complete deployment process.

```powershell
# deploy.ps1
param(
    [string]$Environment = "dev",
    [switch]$SkipBuild,
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

# Load configuration
$config = Get-Content "env-config.$Environment.json" | ConvertFrom-Json

# Set Azure context
az account set --subscription $config.subscriptionId

# Deploy backend
if (-not $FrontendOnly) {
    Write-Host "Deploying backend..." -ForegroundColor Green
    & ./deploy-backend.ps1 -Environment $Environment -SkipBuild:$SkipBuild
}

# Deploy frontend
if (-not $BackendOnly) {
    Write-Host "Deploying frontend..." -ForegroundColor Green
    & ./deployfe.ps1 -Environment $Environment
}

# Sync environment variables
Write-Host "Syncing environment variables..." -ForegroundColor Green
& ./sync-env-variables.ps1 -Environment $Environment

Write-Host "Deployment completed successfully!" -ForegroundColor Green
```

### 2. Backend Deployment (`deploy-backend.ps1`)

Deploys Azure Functions backend.

```powershell
# deploy-backend.ps1
param(
    [string]$Environment = "dev",
    [switch]$SkipBuild
)

$config = Get-Content "env-config.$Environment.json" | ConvertFrom-Json

# Build TypeScript
if (-not $SkipBuild) {
    Write-Host "Building TypeScript..." -ForegroundColor Yellow
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed"
        exit 1
    }
}

# Install production dependencies
Write-Host "Installing production dependencies..." -ForegroundColor Yellow
npm ci --production

# Create deployment package
Write-Host "Creating deployment package..." -ForegroundColor Yellow
$packagePath = "deploy-package.zip"
Compress-Archive -Path "dist/*", "node_modules", "host.json", "package.json" `
    -DestinationPath $packagePath -Force

# Deploy to Azure Functions
Write-Host "Deploying to Azure Functions..." -ForegroundColor Yellow
az functionapp deployment source config-zip `
    --resource-group $config.resourceGroup `
    --name $config.functionAppName `
    --src $packagePath

# Update function app settings
Write-Host "Updating application settings..." -ForegroundColor Yellow
az functionapp config appsettings set `
    --resource-group $config.resourceGroup `
    --name $config.functionAppName `
    --settings @env-settings.json

# Restart function app
Write-Host "Restarting function app..." -ForegroundColor Yellow
az functionapp restart `
    --resource-group $config.resourceGroup `
    --name $config.functionAppName

Write-Host "Backend deployment completed!" -ForegroundColor Green
```

### 3. Frontend Deployment (`deployfe.ps1`)

Deploys React Native web build to Azure Static Web Apps.

```powershell
# deployfe.ps1
param(
    [string]$Environment = "dev"
)

$config = Get-Content "env-config.$Environment.json" | ConvertFrom-Json

# Navigate to frontend directory
Set-Location frontend

# Build for web
Write-Host "Building frontend for web..." -ForegroundColor Yellow
npx expo export:web

# Deploy to Azure Static Web Apps
Write-Host "Deploying to Azure Static Web Apps..." -ForegroundColor Yellow
az staticwebapp upload `
    --name $config.staticWebAppName `
    --resource-group $config.resourceGroup `
    --source web-build

# Update configuration
Write-Host "Updating static web app configuration..." -ForegroundColor Yellow
az staticwebapp appsettings set `
    --name $config.staticWebAppName `
    --resource-group $config.resourceGroup `
    --setting-names API_URL=$config.apiUrl

Set-Location ..

Write-Host "Frontend deployment completed!" -ForegroundColor Green
```

### 4. Infrastructure Deployment (`deploy-refopen-infrastructure.ps1`)

Creates and configures all Azure resources.

```powershell
# deploy-refopen-infrastructure.ps1
param(
    [string]$Environment = "dev",
    [string]$Location = "eastus"
)

$config = Get-Content "env-config.$Environment.json" | ConvertFrom-Json

# Create resource group
Write-Host "Creating resource group..." -ForegroundColor Yellow
az group create `
    --name $config.resourceGroup `
    --location $Location

# Create Azure SQL Database
Write-Host "Creating Azure SQL Database..." -ForegroundColor Yellow
az sql server create `
    --name $config.sqlServerName `
    --resource-group $config.resourceGroup `
    --location $Location `
    --admin-user $config.sqlAdminUser `
    --admin-password $config.sqlAdminPassword

az sql db create `
    --name $config.databaseName `
    --resource-group $config.resourceGroup `
    --server $config.sqlServerName `
    --service-objective S1

# Configure firewall rules
az sql server firewall-rule create `
    --resource-group $config.resourceGroup `
    --server $config.sqlServerName `
    --name AllowAzureServices `
    --start-ip-address 0.0.0.0 `
    --end-ip-address 0.0.0.0

# Create Storage Account
Write-Host "Creating Storage Account..." -ForegroundColor Yellow
az storage account create `
    --name $config.storageAccountName `
    --resource-group $config.resourceGroup `
    --location $Location `
    --sku Standard_LRS

# Create Blob containers
az storage container create `
    --name resumes `
    --account-name $config.storageAccountName

az storage container create `
    --name avatars `
    --account-name $config.storageAccountName

# Create Function App
Write-Host "Creating Function App..." -ForegroundColor Yellow
az functionapp create `
    --name $config.functionAppName `
    --resource-group $config.resourceGroup `
    --storage-account $config.storageAccountName `
    --consumption-plan-location $Location `
    --runtime node `
    --runtime-version 18 `
    --functions-version 4

# Create Application Insights
Write-Host "Creating Application Insights..." -ForegroundColor Yellow
az monitor app-insights component create `
    --app $config.appInsightsName `
    --location $Location `
    --resource-group $config.resourceGroup

# Create Static Web App
Write-Host "Creating Static Web App..." -ForegroundColor Yellow
az staticwebapp create `
    --name $config.staticWebAppName `
    --resource-group $config.resourceGroup `
    --location $Location

Write-Host "Infrastructure deployment completed!" -ForegroundColor Green
```

## Environment Configuration

### Development (`env-config.dev.json`)

```json
{
  "environment": "dev",
  "subscriptionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "resourceGroup": "nexhire-dev-rg",
  "location": "eastus",
  "functionAppName": "nexhire-dev-api",
  "staticWebAppName": "nexhire-dev-web",
  "sqlServerName": "nexhire-dev-sql",
  "databaseName": "nexhire-dev-db",
  "storageAccountName": "nexhiredevstorage",
  "appInsightsName": "nexhire-dev-insights",
  "apiUrl": "https://nexhire-dev-api.azurewebsites.net",
  "sqlAdminUser": "nexhire-admin",
  "sqlAdminPassword": "${KEYVAULT_SECRET}"
}
```

### Production (`env-config.prod.json`)

```json
{
  "environment": "prod",
  "subscriptionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "resourceGroup": "nexhire-prod-rg",
  "location": "eastus",
  "functionAppName": "nexhire-prod-api",
  "staticWebAppName": "nexhire-prod-web",
  "sqlServerName": "nexhire-prod-sql",
  "databaseName": "nexhire-prod-db",
  "storageAccountName": "nexhireprodstorage",
  "appInsightsName": "nexhire-prod-insights",
  "apiUrl": "https://api.nexhire.com",
  "sqlAdminUser": "nexhire-admin",
  "sqlAdminPassword": "${KEYVAULT_SECRET}",
  "customDomain": "nexhire.com"
}
```

## Environment Variables Sync

### `sync-env-variables.ps1`

Synchronizes environment variables across services.

```powershell
# sync-env-variables.ps1
param(
    [string]$Environment = "dev"
)

$config = Get-Content "env-config.$Environment.json" | ConvertFrom-Json

# Load local settings
$localSettings = Get-Content "local.settings.json" | ConvertFrom-Json

# Convert to Azure format
$appSettings = @{}
$localSettings.Values.PSObject.Properties | ForEach-Object {
    $appSettings[$_.Name] = $_.Value
}

# Add environment-specific settings
$appSettings["ENVIRONMENT"] = $Environment
$appSettings["DATABASE_CONNECTION_STRING"] = "Server=$($config.sqlServerName).database.windows.net;Database=$($config.databaseName);..."
$appSettings["STORAGE_CONNECTION_STRING"] = "DefaultEndpointsProtocol=https;AccountName=$($config.storageAccountName);..."

# Update Function App settings
Write-Host "Updating Function App settings..." -ForegroundColor Yellow
$settingsJson = $appSettings | ConvertTo-Json
Set-Content -Path "temp-settings.json" -Value $settingsJson

az functionapp config appsettings set `
    --resource-group $config.resourceGroup `
    --name $config.functionAppName `
    --settings @temp-settings.json

Remove-Item "temp-settings.json"

Write-Host "Environment variables synced successfully!" -ForegroundColor Green
```

## Database Migrations

### Migration Script Structure

```
database/
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_add_referrals.sql
│   ├── 003_add_messaging.sql
│   ├── 004_add_payments.sql
│   └── 005_add_external_job_fields.sql
└── run-migrations.ps1
```

### Migration Runner

```powershell
# database/run-migrations.ps1
param(
    [string]$Environment = "dev",
    [string]$MigrationsPath = "./migrations"
)

$config = Get-Content "../env-config.$Environment.json" | ConvertFrom-Json

# Get connection string
$connectionString = "Server=$($config.sqlServerName).database.windows.net;..."

# Get all migration files
$migrations = Get-ChildItem -Path $MigrationsPath -Filter "*.sql" | Sort-Object Name

foreach ($migration in $migrations) {
    Write-Host "Running migration: $($migration.Name)" -ForegroundColor Yellow
    
    $sql = Get-Content $migration.FullName -Raw
    
    # Execute migration
    Invoke-Sqlcmd `
        -ServerInstance "$($config.sqlServerName).database.windows.net" `
        -Database $config.databaseName `
        -Username $config.sqlAdminUser `
        -Password $config.sqlAdminPassword `
        -Query $sql `
        -ErrorAction Stop
    
    Write-Host "Migration completed: $($migration.Name)" -ForegroundColor Green
}

Write-Host "All migrations completed successfully!" -ForegroundColor Green
```

## Azure Function Configuration

### `host.json`

```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "maxTelemetryItemsPerSecond": 20
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[3.*, 4.0.0)"
  },
  "functionTimeout": "00:05:00",
  "healthMonitor": {
    "enabled": true,
    "healthCheckInterval": "00:00:10",
    "healthCheckWindow": "00:02:00",
    "healthCheckThreshold": 6,
    "counterThreshold": 0.80
  },
  "http": {
    "routePrefix": "api",
    "maxOutstandingRequests": 200,
    "maxConcurrentRequests": 100,
    "dynamicThrottlesEnabled": true
  }
}
```

### `local.settings.json`

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "DATABASE_HOST": "localhost",
    "DATABASE_NAME": "nexhire_dev",
    "DATABASE_USER": "sa",
    "DATABASE_PASSWORD": "YourPassword123!",
    "FIREBASE_PROJECT_ID": "nexhire-dev",
    "FIREBASE_CLIENT_EMAIL": "...",
    "FIREBASE_PRIVATE_KEY": "...",
    "STRIPE_SECRET_KEY": "sk_test_...",
    "BLOB_STORAGE_CONNECTION_STRING": "...",
    "APPLICATION_INSIGHTS_KEY": "..."
  },
  "Host": {
    "LocalHttpPort": 7071,
    "CORS": "*"
  }
}
```

## Static Web App Configuration

### `staticwebapp.config.json`

```json
{
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["authenticated"]
    },
    {
      "route": "/login",
      "rewrite": "/index.html"
    },
    {
      "route": "/*",
      "rewrite": "/index.html"
    }
  ],
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/images/*.{png,jpg,gif}", "/css/*"]
  },
  "responseOverrides": {
    "404": {
      "rewrite": "/index.html",
      "statusCode": 200
    }
  },
  "globalHeaders": {
    "content-security-policy": "default-src 'self' https://*.nexhire.com",
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff"
  },
  "mimeTypes": {
    ".json": "application/json",
    ".js": "application/javascript"
  }
}
```

## CI/CD Pipeline (GitHub Actions)

### `.github/workflows/deploy.yml`

```yaml
name: Deploy to Azure

on:
  push:
    branches:
      - main
      - develop

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
      
      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Deploy Backend
        run: |
          pwsh -File deploy-backend.ps1 -Environment prod
      
      - name: Deploy Frontend
        run: |
          pwsh -File deployfe.ps1 -Environment prod
      
      - name: Run Database Migrations
        run: |
          pwsh -File database/run-migrations.ps1 -Environment prod
```

## Monitoring & Logging

### Application Insights Setup

```typescript
// src/config/appInsights.ts
import { TelemetryClient } from 'applicationinsights'

const client = new TelemetryClient(process.env.APPLICATION_INSIGHTS_KEY)

client.trackEvent({ name: 'JobScraped', properties: { source: 'LinkedIn' } })
client.trackMetric({ name: 'JobsProcessed', value: 150 })
client.trackException({ exception: new Error('Scraping failed') })
client.trackDependency({
  target: 'database',
  name: 'query',
  data: 'SELECT * FROM jobs',
  duration: 45,
  resultCode: 0,
  success: true
})
```

### Log Queries (Kusto)

```kusto
// Failed requests
requests
| where success == false
| where timestamp > ago(1h)
| project timestamp, name, resultCode, duration
| order by timestamp desc

// Performance metrics
requests
| where timestamp > ago(24h)
| summarize avg(duration), percentile(duration, 95) by bin(timestamp, 1h)
| render timechart

// Custom events
customEvents
| where name == "JobScraped"
| summarize count() by tostring(customDimensions.source)
| render piechart
```

## Backup & Disaster Recovery

### Database Backup Script

```powershell
# backup-database.ps1
param(
    [string]$Environment = "prod"
)

$config = Get-Content "env-config.$Environment.json" | ConvertFrom-Json
$backupName = "nexhire-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

# Create database backup
az sql db export `
    --resource-group $config.resourceGroup `
    --server $config.sqlServerName `
    --name $config.databaseName `
    --admin-user $config.sqlAdminUser `
    --admin-password $config.sqlAdminPassword `
    --storage-key-type StorageAccessKey `
    --storage-key $storageKey `
    --storage-uri "https://$($config.storageAccountName).blob.core.windows.net/backups/$backupName.bacpac"

Write-Host "Database backup created: $backupName" -ForegroundColor Green
```

### Automated Backup Schedule

```powershell
# Schedule daily backups via Azure Automation
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
$action = New-ScheduledTaskAction -Execute 'PowerShell.exe' `
    -Argument '-File C:\Scripts\backup-database.ps1 -Environment prod'
Register-ScheduledTask -TaskName "NexHire-DailyBackup" `
    -Trigger $trigger -Action $action
```

## Performance Optimization

### CDN Configuration

```powershell
# Create CDN profile and endpoint
az cdn profile create `
    --name nexhire-cdn `
    --resource-group $config.resourceGroup `
    --sku Standard_Microsoft

az cdn endpoint create `
    --name nexhire-cdn-endpoint `
    --profile-name nexhire-cdn `
    --resource-group $config.resourceGroup `
    --origin $config.staticWebAppName.azurestaticapps.net `
    --origin-host-header $config.staticWebAppName.azurestaticapps.net
```

### Caching Strategy

- **Static Assets**: Cache for 1 year
- **API Responses**: Cache for 5-60 minutes based on endpoint
- **User Data**: No caching or very short TTL

## Security

### Key Vault Integration

```powershell
# Create Key Vault
az keyvault create `
    --name nexhire-keyvault `
    --resource-group $config.resourceGroup `
    --location $Location

# Store secrets
az keyvault secret set `
    --vault-name nexhire-keyvault `
    --name "DatabasePassword" `
    --value $config.sqlAdminPassword

# Grant Function App access
az keyvault set-policy `
    --name nexhire-keyvault `
    --object-id $(az functionapp identity show --name $config.functionAppName --resource-group $config.resourceGroup --query principalId -o tsv) `
    --secret-permissions get list
```

### Reference Secrets in Function App

```json
{
  "DATABASE_PASSWORD": "@Microsoft.KeyVault(SecretUri=https://nexhire-keyvault.vault.azure.net/secrets/DatabasePassword/)"
}
```

## Cost Optimization

### Resource Monitoring

```powershell
# Get cost estimate
az consumption usage list `
    --start-date 2025-11-01 `
    --end-date 2025-12-01 `
    --query "[?contains(instanceName, 'nexhire')]" `
    --output table
```

### Budget Alerts

```powershell
# Create budget alert
az consumption budget create `
    --resource-group $config.resourceGroup `
    --budget-name nexhire-monthly-budget `
    --amount 500 `
    --time-grain Monthly `
    --start-date 2025-01-01 `
    --end-date 2026-01-01
```

---

**Last Updated**: December 5, 2025
