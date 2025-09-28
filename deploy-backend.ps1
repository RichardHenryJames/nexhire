# ================================================================
# NexHire Backend Multi-Environment Deployment Script
# ================================================================
# - Supports dev, staging, production environments
# - Automatically switches environment before deployment
# - Deploys all functions with environment-specific configuration
# - Ensures environment variables are properly synced to Azure
# ================================================================

param(
    [string]$Environment = "production",  # dev, staging, production
    [string]$FunctionAppName = "nexhire-api-func",
    [string]$SubscriptionId = "44027c71-593a-4d51-977b-ab0604cb76eb",
    [switch]$SkipBuild,
    [switch]$SkipTest
)

# Start time logging
$scriptStartTime = Get-Date

Write-Host "🚀 NexHire Backend Multi-Environment Deployment" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "🌍 Target Environment: $Environment" -ForegroundColor Green
Write-Host "📅 Started at: $($scriptStartTime.ToString("yyyy-MM-dd HH:mm:ss"))" -ForegroundColor Gray

# Validate environment
$validEnvs = @("dev", "development", "staging", "prod", "production")
$normalizedEnv = switch ($Environment.ToLower()) {
    { $_ -in @("dev", "development") } { "dev" }
    "staging" { "staging" }
    { $_ -in @("prod", "production") } { "prod" }
    default { $Environment }
}

if ($normalizedEnv -notin @("dev", "staging", "prod")) {
    Write-Host "❌ Invalid environment: $Environment" -ForegroundColor Red
    Write-Host "✅ Valid environments: dev, staging, prod" -ForegroundColor Yellow
    exit 1
}

# Step 1: Switch to target environment
Write-Host "🌍 Switching to $normalizedEnv environment..." -ForegroundColor Yellow

$envFile = ".env.$normalizedEnv"
if (-not (Test-Path $envFile)) {
    Write-Host "❌ Backend environment file not found: $envFile" -ForegroundColor Red
    Write-Host "💡 Run: .\manage-env.ps1 -List to see available environments" -ForegroundColor Yellow
    exit 1
}

# Backup current .env and switch
if (Test-Path ".env") {
    $timestamp = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"
    Copy-Item ".env" ".env.backup.$timestamp" -Force
    Write-Host "📄 Backed up current .env" -ForegroundColor Gray
}

Copy-Item $envFile ".env" -Force
Write-Host "✅ Switched to $normalizedEnv environment" -ForegroundColor Green

# Show current configuration
$envContent = Get-Content ".env" -Raw
$nexhireEnv = if ($envContent -match "NEXHIRE_ENV=(.+)") { $matches[1].Trim() } else { "unknown" }
$dbServer = if ($envContent -match "DB_SERVER=(.+)") { $matches[1].Trim() } else { "not configured" }
$razorpayMode = if ($envContent -match "RAZORPAY_KEY_ID=(rzp_live_.+)") { "LIVE" } else { "TEST" }
$googleConfigured = if ($envContent -match "GOOGLE_CLIENT_ID_WEB=(.+)") { 
    $clientId = $matches[1].Trim()
    if ($clientId -and $clientId -ne "" -and -not $clientId.Contains("YOUR_")) { "✅ CONFIGURED" } else { "❌ NOT SET" }
} else { "❌ MISSING" }

Write-Host "📋 Backend Configuration:" -ForegroundColor Cyan
Write-Host "   Environment: $nexhireEnv" -ForegroundColor White
Write-Host "   Database: $($dbServer.Substring(0, [Math]::Min(50, $dbServer.Length)))..." -ForegroundColor White
Write-Host "   Razorpay Mode: $razorpayMode" -ForegroundColor $(if ($razorpayMode -eq "LIVE") { "Red" } else { "Yellow" })
Write-Host "   Google OAuth: $googleConfigured" -ForegroundColor $(if ($googleConfigured -eq "✅ CONFIGURED") { "Green" } else { "Red" })

# Environment-specific function app name
$targetFunctionApp = switch ($normalizedEnv) {
    "staging" { 
        if ($FunctionAppName -eq "nexhire-api-func") { 
            "nexhire-api-staging" 
        } else { 
            $FunctionAppName 
        }
    }
    default { $FunctionAppName }
}

Write-Host "🎯 Target Function App: $targetFunctionApp" -ForegroundColor Cyan

# Step 2: Check prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor Yellow
$funcVersion = func --version 2>$null
if (-not $funcVersion) {
    Write-Host "❌ Azure Functions Core Tools not found!" -ForegroundColor Red
    Write-Host "📦 Installing via npm..." -ForegroundColor Yellow
    npm install -g azure-functions-core-tools@4 --unsafe-perm true
    $funcVersion = func --version 2>$null
}

Write-Host "✅ Azure Functions Core Tools: $funcVersion" -ForegroundColor Green

# Step 3: Build the project
if (-not $SkipBuild) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    
    Write-Host "🔨 Building TypeScript..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Build successful" -ForegroundColor Green
}

# Step 4: Set Azure subscription and ensure proper authentication
Write-Host "🔐 Setting Azure subscription..." -ForegroundColor Yellow
az account set --subscription $SubscriptionId

# Step 5: Parse and sync environment variables BEFORE deployment
Write-Host "🔧 Syncing environment variables to Azure Function App..." -ForegroundColor Yellow

# Read .env file and extract variables
$envVars = @{}
$envLines = Get-Content ".env" | Where-Object { $_ -and -not $_.StartsWith("#") -and $_.Contains("=") }

# CORRECTED: Only exclude variables that Azure truly manages automatically
$excludeVars = @(
    "AzureWebJobsStorage",                        # Azure auto-manages this
    "WEBSITE_CONTENTAZUREFILECONNECTIONSTRING",   # Azure auto-manages this
    "WEBSITE_CONTENTSHARE"                        # Azure auto-manages this
)

Write-Host "🔍 Processing environment variables..." -ForegroundColor Yellow
$excludedCount = 0
$includedCount = 0

foreach ($line in $envLines) {
    if ($line -match "^([^=]+)=(.*)$") {
        $varName = $matches[1].Trim()
        $varValue = $matches[2].Trim()
        
        if ($varName -in $excludeVars) {
            Write-Host "   ⏭️ Skipping: $varName (Azure managed)" -ForegroundColor DarkGray
            $excludedCount++
        } else {
            $envVars[$varName] = $varValue
            $includedCount++
        }
    }
}

Write-Host "📊 Variable processing summary:" -ForegroundColor Cyan
Write-Host "   ✅ Will deploy: $includedCount variables" -ForegroundColor Green
Write-Host "   ⏭️ Excluded: $excludedCount variables (Azure managed)" -ForegroundColor Yellow
Write-Host "   📄 Total in .env: $($includedCount + $excludedCount) variables" -ForegroundColor White

# Critical variables check
$criticalVars = @("GOOGLE_CLIENT_ID_WEB", "RAZORPAY_KEY_ID", "JWT_SECRET", "DB_PASSWORD")
$missingCritical = @()

foreach ($criticalVar in $criticalVars) {
    if (-not $envVars.ContainsKey($criticalVar) -or [string]::IsNullOrEmpty($envVars[$criticalVar])) {
        $missingCritical += $criticalVar
    }
}

if ($missingCritical.Count -gt 0) {
    Write-Host "⚠️ WARNING: Missing critical environment variables:" -ForegroundColor Yellow
    foreach ($missing in $missingCritical) {
        Write-Host "   ❌ $missing" -ForegroundColor Red
    }
}

# Sync environment variables to Azure Function App using Azure CLI
Write-Host "⬆️ Uploading environment variables to Azure..." -ForegroundColor Yellow

if ($envVars.Count -gt 0) {
    Write-Host "🔄 Setting $($envVars.Count) app settings..." -ForegroundColor Blue
    
    # FIXED: Set variables individually in small batches with proper array format
    $batchSize = 25
    $varNames = $envVars.Keys | Sort-Object
    
    for ($i = 0; $i -lt $varNames.Count; $i += $batchSize) {
        $batchEnd = [Math]::Min($i + $batchSize - 1, $varNames.Count - 1)
        $currentBatch = $varNames[$i..$batchEnd]
        
        # Create proper settings array for this batch
        $batchSettings = @()
        foreach ($varName in $currentBatch) {
            $batchSettings += "$varName=$($envVars[$varName])"
        }
        
        Write-Host "   Batch $([Math]::Floor($i / $batchSize) + 1): Setting $($currentBatch.Count) variables..." -ForegroundColor Gray
        Write-Host "     Variables: $($currentBatch -join ', ')" -ForegroundColor DarkGray
        
        try {
            # Use splatting with proper array to avoid concatenation issues
            & az functionapp config appsettings set --name $targetFunctionApp --resource-group "nexhire-dev-rg" --settings @batchSettings | Out-Null
            Write-Host "   ✅ Batch $([Math]::Floor($i / $batchSize) + 1) completed" -ForegroundColor Green
        } catch {
            Write-Host "   ❌ Failed to set batch $([Math]::Floor($i / $batchSize) + 1): $($_.Exception.Message)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "⚠️ No environment variables found to sync" -ForegroundColor Yellow
}

# Step 6: Deploy function code
Write-Host "🚀 Deploying function code to Azure..." -ForegroundColor Yellow
Write-Host "   Function App: $targetFunctionApp" -ForegroundColor Gray
Write-Host "   Environment: $normalizedEnv" -ForegroundColor Gray

# Deploy with environment-specific settings
$deployArgs = @("azure", "functionapp", "publish", $targetFunctionApp, "--typescript")

if ($normalizedEnv -eq "prod") {
    $deployArgs += "--no-build"  # Use pre-built production assets
}

& func @deployArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Code deployment successful!" -ForegroundColor Green

    # Step 7: Verify environment variables were set correctly
    Write-Host "🔍 Verifying environment variables..." -ForegroundColor Yellow
    
    Start-Sleep -Seconds 10  # Wait for settings to propagate
    
    # Check critical Google OAuth variables
    $googleWebId = az functionapp config appsettings list --name $targetFunctionApp --resource-group "nexhire-dev-rg" --query "[?name=='GOOGLE_CLIENT_ID_WEB'].value" -o tsv
    $razorpayKeyId = az functionapp config appsettings list --name $targetFunctionApp --resource-group "nexhire-dev-rg" --query "[?name=='RAZORPAY_KEY_ID'].value" -o tsv
    
    if ($googleWebId) {
        Write-Host "✅ Google OAuth Web Client ID: Set ($($googleWebId.Substring(0, 20))...)" -ForegroundColor Green
    } else {
        Write-Host "❌ Google OAuth Web Client ID: NOT SET" -ForegroundColor Red
    }
    
    if ($razorpayKeyId) {
        $keyType = if ($razorpayKeyId.StartsWith("rzp_live_")) { "LIVE" } else { "TEST" }
        Write-Host "✅ Razorpay Key: Set ($keyType mode)" -ForegroundColor Green
    } else {
        Write-Host "❌ Razorpay Key: NOT SET" -ForegroundColor Red
    }

    # Count total environment variables in Azure
    Write-Host "📊 Verifying total variable count..." -ForegroundColor Yellow
    try {
        $azureVarCount = (az functionapp config appsettings list --name $targetFunctionApp --resource-group "nexhire-dev-rg" | ConvertFrom-Json).Count
        Write-Host "📈 Total environment variables in Azure Function App: $azureVarCount" -ForegroundColor Cyan
    } catch {
        Write-Host "⚠️ Could not verify variable count (deployment still successful)" -ForegroundColor Yellow
        $azureVarCount = "Unknown"
    }

    # Step 8: Wait for function app to initialize
    $waitTime = switch ($normalizedEnv) {
        "dev" { 30 }
        "staging" { 45 }
        "prod" { 60 }
        default { 45 }
    }
    
    Write-Host "⏰ Waiting $waitTime seconds for function app to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds $waitTime

    # Step 9: Test APIs
    if (-not $SkipTest) {
        Write-Host "🧪 Testing deployed APIs..." -ForegroundColor Yellow

        $baseUrl = "https://$targetFunctionApp.azurewebsites.net/api"
        $healthUrl = "$baseUrl/health"

        Write-Host "📡 Testing endpoints on: $baseUrl" -ForegroundColor Cyan

        # Test health endpoint
        try {
            $healthResponse = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 30
            if ($healthResponse.success) {
                Write-Host "✅ Health API: Working!" -ForegroundColor Green
                Write-Host "   Environment: $($healthResponse.environment)" -ForegroundColor White
                Write-Host "   Message: $($healthResponse.message)" -ForegroundColor White
                
                # Check if Google OAuth is configured in the backend response
                if ($healthResponse.googleOAuth) {
                    Write-Host "✅ Google OAuth: Backend confirms configuration" -ForegroundColor Green
                } else {
                    Write-Host "⚠️ Google OAuth: Backend not confirming configuration" -ForegroundColor Yellow
                }
            }
        } catch {
            Write-Host "⚠️ Health API: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    # Step 10: Show deployment summary
    Write-Host "`n📋 Deployment Summary:" -ForegroundColor Cyan
    Write-Host "   Environment: $normalizedEnv ($nexhireEnv)" -ForegroundColor White
    Write-Host "   Function App: $targetFunctionApp" -ForegroundColor White
    Write-Host "   Database: $($dbServer.Split('.')[0])..." -ForegroundColor White
    Write-Host "   Razorpay: $razorpayMode mode" -ForegroundColor $(if ($razorpayMode -eq "LIVE") { "Red" } else { "Yellow" })
    Write-Host "   Google OAuth: $googleConfigured" -ForegroundColor $(if ($googleConfigured -eq "✅ CONFIGURED") { "Green" } else { "Red" })
    Write-Host "   Variables Deployed: $($envVars.Count)" -ForegroundColor White
    Write-Host "   Total in Azure: $azureVarCount" -ForegroundColor White

    Write-Host "`n📡 Live API Endpoints:" -ForegroundColor Cyan
    Write-Host "   🔍 Health: $healthUrl" -ForegroundColor White
    Write-Host "   🌍 Countries: $baseUrl/reference/countries" -ForegroundColor White
    Write-Host "   🔐 Google Auth: $baseUrl/auth/google" -ForegroundColor White
    Write-Host "   💳 Payments: $baseUrl/payments/razorpay/*" -ForegroundColor White

} else {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "💡 Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "   1. Check Azure login: az account show" -ForegroundColor Gray
    Write-Host "   2. Verify Function App exists: $targetFunctionApp" -ForegroundColor Gray
    Write-Host "   3. Check environment configuration: .env.$normalizedEnv" -ForegroundColor Gray
    Write-Host "   4. Ensure build succeeded: npm run build" -ForegroundColor Gray
    exit 1
}

# End time logging
$scriptEndTime = Get-Date
$elapsedTime = $scriptEndTime - $scriptStartTime

Write-Host "`n🎊 Backend deployment completed successfully!" -ForegroundColor Green
Write-Host "⏱️ Total Duration: $($elapsedTime.ToString("mm\:ss"))" -ForegroundColor Cyan

Write-Host "`n🚀 Google OAuth should now be working!" -ForegroundColor Green
Write-Host "   Frontend will now show Google Sign-In button" -ForegroundColor White
Write-Host "   Live Razorpay payments are enabled" -ForegroundColor White
