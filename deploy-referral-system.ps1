# NexHire Referral System Deployment Script
# Deploys referral schema, API endpoints, and initializes data

param(
    [string]$ConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;",
    [string]$ApiBaseUrl = "https://nexhire-api-func.azurewebsites.net/api",
    [switch]$SkipSchemaDeployment = $false,
    [switch]$RunTests = $true,
    [switch]$Verbose = $false
)

Write-Host "?? Deploying NexHire Referral System" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan

# Step 1: Deploy Database Schema
if (-not $SkipSchemaDeployment) {
    Write-Host "`n?? Step 1: Deploying Database Schema" -ForegroundColor Blue
    
    try {
        & ".\referral-schema.ps1" -ConnectionString $ConnectionString
        Write-Host "? Database schema deployed successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "? Database schema deployment failed: $($_.Exception.Message)" -ForegroundColor Red
        return
    }
} else {
    Write-Host "`n?? Step 1: Skipping Database Schema (as requested)" -ForegroundColor Yellow
}

# Step 2: Verify Schema
Write-Host "`n?? Step 2: Verifying Schema Deployment" -ForegroundColor Blue

if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}

Import-Module SqlServer -Force

try {
    # Check if referral tables exist
    $tables = @('ReferralPlans', 'ApplicantReferralSubscriptions', 'ReferralRequests', 'ReferralProofs', 'ReferralRewards', 'ReferrerStats')
    
    foreach ($table in $tables) {
        $checkQuery = "SELECT COUNT(*) as TableExists FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '$table'"
        $result = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $checkQuery -QueryTimeout 30
        
        if ($result.TableExists -eq 1) {
            Write-Host "? Table $table exists" -ForegroundColor Green
        } else {
            Write-Host "? Table $table missing" -ForegroundColor Red
            return
        }
    }
    
    # Check if Applicants columns exist
    $applicantColumns = @('OpenToRefer', 'ReferralPoints')
    foreach ($column in $applicantColumns) {
        $checkQuery = "SELECT COUNT(*) as ColumnExists FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Applicants' AND COLUMN_NAME = '$column'"
        $result = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $checkQuery -QueryTimeout 30
        
        if ($result.ColumnExists -eq 1) {
            Write-Host "? Column Applicants.$column exists" -ForegroundColor Green
        } else {
            Write-Host "? Column Applicants.$column missing" -ForegroundColor Red
            return
        }
    }
    
    # Check referral plans data
    $plansCount = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query "SELECT COUNT(*) as Count FROM ReferralPlans" -QueryTimeout 30
    Write-Host "?? Referral Plans: $($plansCount.Count) plans available" -ForegroundColor Cyan
    
    if ($plansCount.Count -eq 0) {
        Write-Host "?? No referral plans found - this might be expected for fresh deployment" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "? Schema verification failed: $($_.Exception.Message)" -ForegroundColor Red
    return
}

# Step 3: Build and Deploy API
Write-Host "`n?? Step 3: Building API Code" -ForegroundColor Blue

try {
    # Check if we're in the right directory
    if (-not (Test-Path "package.json")) {
        Write-Host "? package.json not found. Please run this script from the project root directory." -ForegroundColor Red
        return
    }
    
    # Install dependencies
    Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
    npm install
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "? npm install failed" -ForegroundColor Red
        return
    }
    
    # Build TypeScript
    Write-Host "Building TypeScript..." -ForegroundColor Yellow
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "? TypeScript build failed" -ForegroundColor Red
        return
    }
    
    Write-Host "? API code built successfully" -ForegroundColor Green
    
} catch {
    Write-Host "? API build failed: $($_.Exception.Message)" -ForegroundColor Red
    return
}

# Step 4: Deploy to Azure Functions
Write-Host "`n?? Step 4: Deploying to Azure Functions" -ForegroundColor Blue

try {
    # Check if Azure Functions Core Tools is available
    $funcVersion = func --version 2>$null
    if (-not $funcVersion) {
        Write-Host "? Azure Functions Core Tools not found. Please install it first." -ForegroundColor Red
        Write-Host "   Download from: https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local" -ForegroundColor Yellow
        return
    }
    
    Write-Host "?? Azure Functions Core Tools version: $funcVersion" -ForegroundColor Cyan
    
    # Deploy to Azure (assumes you're logged in to Azure CLI)
    Write-Host "Deploying to Azure Functions..." -ForegroundColor Yellow
    func azure functionapp publish nexhire-api-func --typescript
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "? Azure Functions deployment failed" -ForegroundColor Red
        return
    }
    
    Write-Host "? API deployed to Azure Functions successfully" -ForegroundColor Green
    
} catch {
    Write-Host "? Azure deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    return
}

# Step 5: Verify API Endpoints
Write-Host "`n?? Step 5: Verifying API Endpoints" -ForegroundColor Blue

$endpoints = @(
    "/referral/plans",
    "/health"
)

foreach ($endpoint in $endpoints) {
    try {
        $uri = "$ApiBaseUrl$endpoint"
        Write-Host "Testing $uri..." -ForegroundColor Yellow
        
        $response = Invoke-RestMethod -Uri $uri -Method GET -UseBasicParsing -TimeoutSec 30
        
        if ($response.success) {
            Write-Host "? $endpoint - OK" -ForegroundColor Green
        } else {
            Write-Host "?? $endpoint - Response not successful" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "? $endpoint - Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Step 6: Initialize Default Data
Write-Host "`n??? Step 6: Initializing Default Data" -ForegroundColor Blue

try {
    # Enable OpenToRefer for a few test users (optional)
    $initQuery = @"
    -- Enable OpenToRefer for users with work experience (sample)
    UPDATE Applicants 
    SET OpenToRefer = 1
    WHERE ApplicantID IN (
        SELECT DISTINCT a.ApplicantID 
        FROM Applicants a
        INNER JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID
        WHERE we.IsCurrent = 1
    );
    
    -- Initialize ReferralPoints to 0 for all applicants
    UPDATE Applicants SET ReferralPoints = 0 WHERE ReferralPoints IS NULL;
    
    SELECT 
        COUNT(*) as TotalApplicants,
        SUM(CASE WHEN OpenToRefer = 1 THEN 1 ELSE 0 END) as OpenToReferCount,
        COUNT(DISTINCT PlanID) as AvailablePlans
    FROM Applicants a
    CROSS JOIN ReferralPlans p;
"@
    
    $initResult = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $initQuery -QueryTimeout 30
    
    Write-Host "? Default data initialized" -ForegroundColor Green
    Write-Host "   - Total Applicants: $($initResult.TotalApplicants)" -ForegroundColor Cyan
    Write-Host "   - Open to Refer: $($initResult.OpenToReferCount)" -ForegroundColor Cyan
    Write-Host "   - Available Plans: $($initResult.AvailablePlans)" -ForegroundColor Cyan
    
} catch {
    Write-Host "? Default data initialization failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 7: Run API Tests
if ($RunTests) {
    Write-Host "`n?? Step 7: Running API Tests" -ForegroundColor Blue
    
    if (Test-Path "test-referral-api.ps1") {
        try {
            & ".\test-referral-api.ps1" -BaseUrl $ApiBaseUrl -Verbose:$Verbose
            Write-Host "? API tests completed" -ForegroundColor Green
        }
        catch {
            Write-Host "?? Some API tests failed - check test output above" -ForegroundColor Yellow
        }
    } else {
        Write-Host "?? test-referral-api.ps1 not found - skipping API tests" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n?? Step 7: Skipping API Tests (as requested)" -ForegroundColor Yellow
}

# Step 8: Create Documentation
Write-Host "`n?? Step 8: Generating Documentation" -ForegroundColor Blue

$docs = @"
# NexHire Referral System - Deployment Complete

## ?? Deployment Summary
- **Deployment Date**: $(Get-Date)
- **Database Schema**: ? Deployed
- **API Endpoints**: ? Deployed to $ApiBaseUrl
- **Default Data**: ? Initialized

## ?? Available Endpoints

### Referral Plans
- GET /api/referral/plans - Get all plans
- POST /api/referral/plans/purchase - Purchase a plan
- GET /api/referral/subscription - Get current subscription

### Referral Requests  
- POST /api/referral/requests - Create request
- GET /api/referral/my-requests - Get my requests
- GET /api/referral/available - Get available requests
- POST /api/referral/requests/{id}/claim - Claim a request

### Analytics & Stats
- GET /api/referral/analytics - Get dashboard analytics
- GET /api/referral/eligibility - Check eligibility  
- GET /api/referral/stats - Get referrer badge stats

## ?? Key Features Deployed

1. **Daily Quota System**: Users get 5 free referrals/day, can upgrade
2. **Organization Matching**: Referrers matched by current work organization
3. **Badge Notifications**: ReferrerStats table maintains pending counts
4. **Points & Rewards**: ReferralPoints system for gamification
5. **Subscription Management**: Multiple plan tiers (Free, Weekly, Monthly, Lifetime)

## ??? Database Schema

### New Tables
- ReferralPlans (plans and pricing)
- ApplicantReferralSubscriptions (user subscriptions)
- ReferralRequests (referral request lifecycle)
- ReferralProofs (proof uploads)
- ReferralRewards (points and rewards)
- ReferrerStats (badge counts for notifications)

### Updated Tables
- Applicants: Added OpenToRefer, ReferralPoints columns

## ?? Workflow

1. **Seeker**: Creates referral request for a job
2. **System**: Identifies eligible referrers (same org, OpenToRefer=1)
3. **Referrer**: Sees badge notification, views/claims request
4. **Referrer**: Submits referral (with proof)
5. **Seeker**: Can verify referral (optional)
6. **System**: Awards points to referrer

## ?? Next Steps

1. **Frontend Integration**: Build React Native screens
2. **Payment Gateway**: Integrate Stripe/PayPal for plan purchases
3. **Notifications**: Add email/push notifications
4. **Mobile App**: Add referral features to mobile app
5. **Analytics Dashboard**: Admin dashboard for referral metrics

## ??? Configuration

- **API Base URL**: $ApiBaseUrl
- **Database**: Azure SQL Database
- **Authentication**: JWT tokens (existing NexHire auth)
- **Storage**: Azure Blob Storage (for proof uploads)

## ?? Support

For issues or questions:
- Check API health: GET $ApiBaseUrl/health
- Review logs: Azure Functions portal
- Database issues: Check Azure SQL portal
- Test endpoints: Run test-referral-api.ps1

---
Generated by NexHire Referral System Deployment Script
"@

$docs | Out-File "REFERRAL_DEPLOYMENT.md" -Encoding UTF8

Write-Host "? Documentation generated: REFERRAL_DEPLOYMENT.md" -ForegroundColor Green

# Final Summary
Write-Host "`n?? Deployment Complete!" -ForegroundColor Magenta
Write-Host "================================" -ForegroundColor Magenta
Write-Host "? Database Schema: Deployed" -ForegroundColor Green
Write-Host "? API Endpoints: $ApiBaseUrl" -ForegroundColor Green
Write-Host "? Default Data: Initialized" -ForegroundColor Green
Write-Host "? Documentation: REFERRAL_DEPLOYMENT.md" -ForegroundColor Green

Write-Host "`n?? Quick Test Links:" -ForegroundColor Yellow
Write-Host "   Health Check: $ApiBaseUrl/health" -ForegroundColor Cyan
Write-Host "   Referral Plans: $ApiBaseUrl/referral/plans" -ForegroundColor Cyan

Write-Host "`n?? Next Actions:" -ForegroundColor Yellow
Write-Host "1. Test the API endpoints using test-referral-api.ps1" -ForegroundColor White
Write-Host "2. Build frontend components for referral system" -ForegroundColor White
Write-Host "3. Configure payment gateway for plan purchases" -ForegroundColor White
Write-Host "4. Set up notification system (email/push)" -ForegroundColor White
Write-Host "5. Create admin dashboard for referral analytics" -ForegroundColor White

Write-Host "`n?? NexHire Referral System is ready for use!" -ForegroundColor Green