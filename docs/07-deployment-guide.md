# 🚀 RefOpen Deployment Guide

## Overview

This guide covers the complete deployment process for RefOpen, including backend Azure Functions, frontend React Native app, and database migrations.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Backend Deployment](#backend-deployment)
- [Frontend Deployment](#frontend-deployment)
- [Database Management](#database-management)
- [Deployment Scripts](#deployment-scripts)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring & Health Checks](#monitoring--health-checks)

---

## Prerequisites

### Required Tools

- **Node.js**: v20.0.0 or higher
- **Azure CLI**: Latest version
- **PowerShell**: 7.0+ (for deployment scripts)
- **Azure Functions Core Tools**: v4.x
- **Git**: For version control

### Azure Resources

The following Azure resources must be provisioned:

1. **Azure SQL Database** (S1 tier or higher)
2. **Azure Function App** (Consumption or Premium plan)
3. **Azure Storage Account** (for Blob storage)
4. **Azure Static Web Apps** (for frontend)
5. **Azure Application Insights** (for monitoring)
6. **Azure Service Bus** (optional, for messaging)

### Access Requirements

- Azure subscription with contributor role
- Database admin credentials
- Razorpay account (for payments)
- SendGrid account (for emails)
- Google OAuth credentials (for social login)

---

## Environment Configuration

### Backend Environment Files

#### Development (`local.settings.json`)

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "RefOpen_ENV": "dev",
    
    // Database
    "SQL_SERVER": "localhost",
    "SQL_DATABASE": "RefOpenDB",
    "SQL_USER": "sa",
    "SQL_PASSWORD": "YourPassword123!",
    
    // Authentication
    "JWT_SECRET": "your-dev-secret-key-min-32-chars",
    "JWT_ACCESS_EXPIRY": "1h",
    "JWT_REFRESH_EXPIRY": "7d",
    
    // Azure Storage
    "AZURE_STORAGE_ACCOUNT": "refopenstorage",
    "AZURE_STORAGE_KEY": "your-storage-key",
    "AZURE_STORAGE_CONNECTION_STRING": "your-connection-string",
    
    // Razorpay (Test Mode)
    "RAZORPAY_KEY_ID": "rzp_test_xxx",
    "RAZORPAY_KEY_SECRET": "your-test-secret",
    "RAZORPAY_WEBHOOK_SECRET": "your-webhook-secret",
    
    // SendGrid
    "SENDGRID_API_KEY": "SG.xxx",
    "SENDGRID_FROM_EMAIL": "noreply@refopen.com",
    
    // Google OAuth
    "GOOGLE_WEB_CLIENT_ID": "your-web-client-id.apps.googleusercontent.com",
    "GOOGLE_ANDROID_CLIENT_ID": "your-android-client-id.apps.googleusercontent.com",
    "GOOGLE_IOS_CLIENT_ID": "your-ios-client-id.apps.googleusercontent.com",
    
    // Feature Flags
    "FEATURE_REFERRAL_SYSTEM": "true",
    "FEATURE_PAYMENT_SYSTEM": "true",
    "FEATURE_JOB_SCRAPING": "true"
  }
}
```

#### Production (`env-config.prod.json`)

```json
{
  "environment": "production",
  "database": {
    "server": "refopen-prod-sql.database.windows.net",
    "database": "RefOpenProdDB",
    "user": "refopenadmin",
    "password": "{{SECURE_PASSWORD}}",
    "encrypt": true,
    "trustServerCertificate": false
  },
  "azure": {
    "storageAccount": "refopenprodsa",
    "functionAppName": "refopen-api-func-prod",
    "staticWebAppName": "refopen-frontend-prod"
  },
  "razorpay": {
    "keyId": "rzp_live_xxx",
    "isProduction": true
  }
}
```

### Frontend Environment Files

#### `.env.dev`
```bash
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_API_BASE_URL=http://localhost:7071/api
EXPO_PUBLIC_WS_URL=ws://localhost:7071/api/signalr
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxx
```

#### `.env.prod`
```bash
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_API_BASE_URL=https://refopen-api-func.azurewebsites.net/api
EXPO_PUBLIC_WS_URL=wss://refopen-api-func.azurewebsites.net/api/signalr
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxx
```

---

## Backend Deployment

### Method 1: PowerShell Script (Recommended)

```powershell
# Deploy backend to production
.\deploy-backend.ps1 -Environment prod

# Deploy to staging
.\deploy-backend.ps1 -Environment staging

# Skip tests during deployment
.\deploy-backend.ps1 -Environment prod -SkipTest
```

### Method 2: Manual Deployment

```powershell
# 1. Install dependencies
npm install

# 2. Build TypeScript
npm run build

# 3. Run tests
npm test

# 4. Deploy to Azure
func azure functionapp publish refopen-api-func --typescript --force

# 5. Sync environment variables
.\sync-env-variables.ps1 -Environment prod
```

### Method 3: Azure CLI

```bash
# Login to Azure
az login

# Set subscription
az account set --subscription "Your-Subscription-ID"

# Deploy function app
az functionapp deployment source config-zip \
  --resource-group refopen-prod-rg \
  --name refopen-api-func \
  --src dist.zip

# Configure app settings
az functionapp config appsettings set \
  --resource-group refopen-prod-rg \
  --name refopen-api-func \
  --settings @app-settings.json
```

### Post-Deployment Verification

```powershell
# Test health endpoint
curl https://refopen-api-func.azurewebsites.net/api/health

# Check function logs
func azure functionapp logstream refopen-api-func

# Verify environment variables
az functionapp config appsettings list \
  --resource-group refopen-prod-rg \
  --name refopen-api-func
```

---

## Frontend Deployment

### Web Deployment (Azure Static Web Apps)

```powershell
# Deploy frontend to production
.\deployfe.ps1 -Environment prod

# Manual steps:
cd frontend

# 1. Set production environment
cp .env.prod .env

# 2. Build web app
npm run build:web

# 3. Deploy to Azure
swa deploy \
  --app-location . \
  --output-location web-build \
  --deployment-token $AZURE_STATICWEBAPP_TOKEN
```

### Mobile App Deployment

#### Android

```bash
cd frontend

# Build APK (development)
npm run build:android

# Build AAB for Play Store
eas build --platform android --profile production
```

#### iOS

```bash
cd frontend

# Build for App Store
eas build --platform ios --profile production

# Test on simulator
npm run ios
```

### Configuration Files

#### `staticwebapp.config.json`
```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "*.{css,scss,js,json,png,jpg,svg}"]
  },
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["anonymous"]
    }
  ],
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'"
  },
  "mimeTypes": {
    ".json": "application/json",
    ".js": "text/javascript"
  }
}
```

---

## Database Management

### Initial Database Setup

```powershell
# 1. Create database schema
.\scripts\create-database.ps1 -Environment prod

# 2. Run migrations
.\database\migrations\run-migrations.ps1

# 3. Populate reference data
npm run populate:all
```

### Migration Execution

```sql
-- Run migrations in order:
-- 001_initial_schema.sql
-- 002_add_referral_system.sql
-- 003_add_wallet_system.sql
-- 004_add_messaging_system.sql
-- 005_add_external_job_fields.sql

-- Example migration script
USE RefOpenDB;
GO

BEGIN TRANSACTION;

-- Check if migration already applied
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Jobs') AND name = 'ExternalJobID')
BEGIN
    -- Add new columns
    ALTER TABLE Jobs ADD ExternalJobID NVARCHAR(255) NULL;
    ALTER TABLE Jobs ADD Source NVARCHAR(50) NULL;
    
    -- Create index
    CREATE INDEX IX_Jobs_ExternalJobID ON Jobs(ExternalJobID);
    
    PRINT 'Migration 005 applied successfully';
END
ELSE
BEGIN
    PRINT 'Migration 005 already applied';
END

COMMIT TRANSACTION;
```

### Database Backup & Restore

```powershell
# Backup production database
.\scripts\backup-database.ps1 -Environment prod

# Restore from backup
.\scripts\restore-database.ps1 -BackupFile backup.bak -Environment staging
```

### Index Management

```powershell
# Create all job-related indexes
.\create-all-jobs-indexes.ps1

# Rebuild fragmented indexes
.\rebuild-all-indexes.ps1

# Optimize specific tables
sqlcmd -S server -d RefOpenDB -i optimize-index.sql
```

---

## Deployment Scripts

### Main Deployment Script (`deploy.ps1`)

```powershell
# Deploy both frontend and backend
.\deploy.ps1 -Component both -Environment prod

# Deploy only backend
.\deploy.ps1 -Component backend -Environment staging

# Skip build step
.\deploy.ps1 -Component frontend -Environment prod -SkipBuild

# Show deployment status
.\deploy.ps1 -Status
```

### Environment Synchronization

```powershell
# Sync environment variables from JSON config
.\sync-env-variables.ps1 -Environment prod

# Deploy infrastructure from JSON
.\deploy-env-from-json.ps1 -ConfigFile env-config.prod.json
```

### Job Scraper Management

```powershell
# Run all job scrapers
.\Run-AllScrapers.ps1

# Manage individual scraper
.\Manage-JobScraper.ps1 -Action start

# Run specific scraper
.\job-scraper.ps1 -Source remoteok
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
name: Deploy RefOpen

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  AZURE_FUNCTIONAPP_NAME: refopen-api-func
  NODE_VERSION: '20.x'

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
      
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: backend
          path: dist

  deploy-backend:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Download artifact
        uses: actions/download-artifact@v3
        with:
          name: backend
      
      - name: Deploy to Azure Functions
        uses: Azure/functions-action@v1
        with:
          app-name: ${{ env.AZURE_FUNCTIONAPP_NAME }}
          package: .
          publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}

  deploy-frontend:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Build frontend
        run: |
          cd frontend
          npm ci
          npm run build:web
      
      - name: Deploy to Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "frontend"
          output_location: "web-build"
```

---

## Monitoring & Health Checks

### Health Endpoints

```bash
# Backend health check
GET /api/health

Response:
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-12-05T10:00:00Z",
  "services": {
    "database": "connected",
    "storage": "available",
    "cache": "operational"
  }
}
```

### Azure Application Insights

```typescript
// Custom telemetry tracking
import { trackEvent, trackException } from './utils/telemetry';

// Track deployment event
trackEvent('Deployment', {
  environment: 'production',
  version: '1.0.0',
  timestamp: new Date()
});

// Track errors
try {
  // Deploy operation
} catch (error) {
  trackException(error, { operation: 'deployment' });
}
```

### Log Monitoring

```powershell
# Stream function logs
func azure functionapp logstream refopen-api-func

# Query Application Insights
az monitor app-insights query \
  --app refopen-insights \
  --analytics-query "traces | where timestamp > ago(1h) | order by timestamp desc"

# Check performance metrics
az monitor metrics list \
  --resource refopen-api-func \
  --metric-names "FunctionExecutionCount,FunctionExecutionUnits"
```

### Performance Diagnostics

```powershell
# Run performance diagnostics
.\diagnose-performance.ps1

# Analyze query performance
.\test-jobs-sql-performance.js

# Check index fragmentation
sqlcmd -S server -d RefOpenDB -Q "EXEC sp_MSforeachtable 'DBCC SHOWCONTIG(''?'')'"
```

---

## Rollback Procedures

### Backend Rollback

```powershell
# Rollback to previous deployment
az functionapp deployment slot swap \
  --resource-group refopen-prod-rg \
  --name refopen-api-func \
  --slot staging \
  --target-slot production

# Restore from specific version
func azure functionapp publish refopen-api-func \
  --build-native-deps \
  --slot staging
```

### Database Rollback

```sql
-- Rollback migration (example)
BEGIN TRANSACTION;

-- Revert schema changes
ALTER TABLE Jobs DROP COLUMN IF EXISTS ExternalJobID;
DROP INDEX IF EXISTS IX_Jobs_ExternalJobID ON Jobs;

-- Log rollback
INSERT INTO MigrationHistory (MigrationName, RolledBackAt)
VALUES ('005_add_external_job_fields', GETDATE());

COMMIT TRANSACTION;
```

### Frontend Rollback

```bash
# Rollback Static Web App deployment
swa deploy --deployment-token $TOKEN --env previous

# Or redeploy specific version
git checkout v1.0.0
npm run build:web
swa deploy
```

---

## Troubleshooting

### Common Issues

#### Database Connection Failures
```powershell
# Test database connectivity
Test-NetConnection -ComputerName refopen-prod-sql.database.windows.net -Port 1433

# Check firewall rules
az sql server firewall-rule list \
  --resource-group refopen-prod-rg \
  --server refopen-prod-sql
```

#### Function App Not Starting
```powershell
# Check function app logs
az functionapp log deployment show \
  --name refopen-api-func \
  --resource-group refopen-prod-rg

# Restart function app
az functionapp restart \
  --name refopen-api-func \
  --resource-group refopen-prod-rg
```

#### Static Web App 404 Errors
- Verify `staticwebapp.config.json` is in web-build folder
- Check route configuration for SPA fallback
- Ensure MIME types are properly configured

---

## Security Checklist

- [ ] All secrets stored in Azure Key Vault
- [ ] Environment variables not committed to Git
- [ ] SSL/TLS enabled on all endpoints
- [ ] CORS configured with specific origins
- [ ] Rate limiting enabled on APIs
- [ ] JWT tokens with appropriate expiry
- [ ] Database firewall rules configured
- [ ] Storage account has private access
- [ ] Application Insights enabled
- [ ] Backup and disaster recovery tested

---

## Performance Optimization

### Database Optimization
- Index all foreign keys
- Partition large tables (Jobs, Applications)
- Enable query store for monitoring
- Configure appropriate service tier

### Function App Optimization
- Use Premium plan for production
- Enable Application Insights sampling
- Configure function timeouts appropriately
- Use Durable Functions for long-running tasks

### Frontend Optimization
- Enable CDN for static assets
- Implement lazy loading
- Use image optimization
- Enable service worker caching

---

## Deployment Schedule

**Recommended deployment windows:**
- **Production**: Sundays 2:00 AM - 4:00 AM UTC (low traffic)
- **Staging**: Anytime during business hours
- **Hotfixes**: As needed with approval

**Deployment frequency:**
- **Major releases**: Monthly
- **Minor updates**: Bi-weekly
- **Bug fixes**: As needed
- **Security patches**: Immediate

---

## Support & Escalation

**Deployment Issues:**
- Level 1: Check deployment logs and retry
- Level 2: Rollback to previous version
- Level 3: Contact Azure support

**Emergency Contacts:**
- DevOps Lead: devops@refopen.com
- Database Admin: dba@refopen.com
- Azure Support: +1-800-AZURE

---

*Last Updated: December 2025*
*Version: 1.0.0*
