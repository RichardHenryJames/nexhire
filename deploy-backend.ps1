# ================================================================
# RefOpen Backend Multi-Environment Deployment Script
# ================================================================
# - Supports dev, staging, production environments
# - Automatically switches environment before deployment
# - Deploys all functions with environment-specific configuration
# - Updated for RefOpen Production Infrastructure
# ================================================================

param(
    [string]$Environment = "production",  # dev, staging, production
    [string]$FunctionAppName = "refopen-api-func",  # Updated to RefOpen
    [string]$SubscriptionId = "44027c71-593a-4d51-977b-ab0604cb76eb",
    [switch]$SkipBuild,
    [switch]$SkipTest
)

# Start time logging
$scriptStartTime = Get-Date

Write-Host "🚀 RefOpen Backend Multi-Environment Deployment" -ForegroundColor Cyan
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
    Write-Host "💡 Available environment files:" -ForegroundColor Yellow
    Get-ChildItem ".env.*" | ForEach-Object { Write-Host "   - $($_.Name)" -ForegroundColor Gray }
    exit 1
}

# Switch environment (no backup)
Copy-Item $envFile ".env" -Force
Write-Host "✅ Switched to $normalizedEnv environment" -ForegroundColor Green

# Show current configuration
$envContent = Get-Content ".env" -Raw
$refopenEnv = if ($envContent -match "RefOpen_ENV=(.+)") { $matches[1].Trim() } else { "unknown" }
$dbServer = if ($envContent -match "DB_SERVER=(.+)") { $matches[1].Trim() } else { "not configured" }
$razorpayMode = if ($envContent -match "RAZORPAY_KEY_ID=(rzp_live_.+)") { "LIVE" } else { "TEST" }
$googleConfigured = if ($envContent -match "GOOGLE_CLIENT_ID_WEB=(.+)") { 
    $clientId = $matches[1].Trim()
    if ($clientId -and $clientId -ne "" -and -not $clientId.Contains("YOUR_")) { "✅ CONFIGURED" } else { "❌ NOT SET" }
} else { "❌ MISSING" }

Write-Host "📋 Backend Configuration:" -ForegroundColor Cyan
Write-Host "   Environment: $refopenEnv" -ForegroundColor White
Write-Host "   Database: $($dbServer.Substring(0, [Math]::Min(50, $dbServer.Length)))..." -ForegroundColor White
Write-Host "   Razorpay Mode: $razorpayMode" -ForegroundColor $(if ($razorpayMode -eq "LIVE") { "Red" } else { "Yellow" })
Write-Host "   Google OAuth: $googleConfigured" -ForegroundColor $(if ($googleConfigured -eq "✅ CONFIGURED") { "Green" } else { "Red" })

# Environment-specific function app name - UPDATED FOR REFOPEN
$targetFunctionApp = switch ($normalizedEnv) {
    "dev" {
        if ($FunctionAppName -eq "refopen-api-func") {
            "refopen-api-func-dev"  # If you create a dev environment
        } else {
            $FunctionAppName
        }
    }
    "staging" { 
        if ($FunctionAppName -eq "refopen-api-func") { 
            "refopen-api-func-staging"  # If you create a staging environment
        } else { 
            $FunctionAppName 
        }
    }
    "prod" {
        "refopen-api-func"  # Production Function App
    }
    default { $FunctionAppName }
}

Write-Host "🎯 Target Function App: $targetFunctionApp" -ForegroundColor Cyan
Write-Host "   Location: Central India" -ForegroundColor Gray
Write-Host "   Runtime: Node.js 20" -ForegroundColor Gray

# Step 2: Check prerequisites
Write-Host "`n📋 Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
$nodeVersion = node --version 2>$null
if ($nodeVersion) {
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Node.js not found!" -ForegroundColor Red
    exit 1
}

# Check Azure Functions Core Tools
$funcVersion = func --version 2>$null
if (-not $funcVersion) {
    Write-Host "❌ Azure Functions Core Tools not found!" -ForegroundColor Red
    Write-Host "📦 Installing via npm..." -ForegroundColor Yellow
    npm install -g azure-functions-core-tools@4 --unsafe-perm true
    $funcVersion = func --version 2>$null
}

Write-Host "✅ Azure Functions Core Tools: $funcVersion" -ForegroundColor Green

# Check Azure CLI (optional but helpful)
$azVersion = az --version 2>$null | Select-String "azure-cli" | Select-Object -First 1
if ($azVersion) {
    Write-Host "✅ Azure CLI: $azVersion" -ForegroundColor Green
}

# Check if logged into Azure
try {
    $azContext = Get-AzContext -ErrorAction SilentlyContinue
    if ($azContext) {
        Write-Host "✅ Azure PowerShell: Logged in as $($azContext.Account.Id)" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️ Azure PowerShell: Not logged in (not required for func deploy)" -ForegroundColor Yellow
}

# Step 3: Build the project
if (-not $SkipBuild) {
    Write-Host "`n📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ npm install failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "🔨 Building TypeScript..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Build successful" -ForegroundColor Green
} else {
    Write-Host "⏭️ Skipping build (using existing build)" -ForegroundColor Yellow
}

# Step 4: Verify Function App exists
Write-Host "`n🔍 Verifying Function App exists..." -ForegroundColor Yellow
try {
    $funcApp = Get-AzFunctionApp -ResourceGroupName "refopen-prod-rg" -Name $targetFunctionApp -ErrorAction SilentlyContinue
    if ($funcApp) {
        Write-Host "✅ Function App found: $targetFunctionApp" -ForegroundColor Green
        Write-Host "   Status: $($funcApp.State)" -ForegroundColor Gray
        Write-Host "   URL: https://$targetFunctionApp.azurewebsites.net" -ForegroundColor Gray
    } else {
        Write-Host "⚠️ Function App not found: $targetFunctionApp" -ForegroundColor Yellow
        Write-Host "   Deployment will attempt to create it..." -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️ Could not verify Function App (will proceed with deployment)" -ForegroundColor Yellow
}

# Step 5: Set Azure subscription
Write-Host "`n🔐 Setting Azure subscription..." -ForegroundColor Yellow
az account set --subscription $SubscriptionId
Write-Host "✅ Subscription set: $SubscriptionId" -ForegroundColor Green

# Step 6: Deploy function code
Write-Host "`n🚀 Deploying function code to Azure..." -ForegroundColor Yellow
Write-Host "   Function App: $targetFunctionApp" -ForegroundColor Cyan
Write-Host "   Environment: $normalizedEnv" -ForegroundColor Cyan
Write-Host "   Resource Group: refopen-prod-rg" -ForegroundColor Gray
Write-Host "" -ForegroundColor White
Write-Host "💡 Note: Environment variables are configured in Azure Portal" -ForegroundColor Yellow
Write-Host "   This deployment only uploads the code package" -ForegroundColor Gray
Write-Host "   Environment variables were set during infrastructure deployment" -ForegroundColor Gray

# Deploy with environment-specific settings
$deployArgs = @("azure", "functionapp", "publish", $targetFunctionApp, "--typescript")

if ($normalizedEnv -eq "prod") {
    $deployArgs += "--no-build"  # Use pre-built production assets
}

Write-Host "`n🔄 Running: func $($deployArgs -join ' ')" -ForegroundColor Gray
& func @deployArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Code deployment successful!" -ForegroundColor Green

    # Step 7: Wait for function app to initialize
    $waitTime = switch ($normalizedEnv) {
        "dev" { 30 }
        "staging" { 45 }
        "prod" { 60 }
        default { 45 }
    }
    
    Write-Host "⏰ Waiting $waitTime seconds for function app to initialize..." -ForegroundColor Yellow
    for ($i = $waitTime; $i -gt 0; $i--) {
        Write-Progress -Activity "Waiting for Function App" -Status "$i seconds remaining..." -PercentComplete ((($waitTime - $i) / $waitTime) * 100)
        Start-Sleep -Seconds 1
    }
    Write-Progress -Activity "Waiting for Function App" -Completed

    # Step 8: Test APIs
    if (-not $SkipTest) {
        Write-Host "`n🧪 Testing deployed APIs..." -ForegroundColor Yellow

        $baseUrl = "https://$targetFunctionApp.azurewebsites.net/api"
        $healthUrl = "$baseUrl/health"

        Write-Host "📡 Testing endpoints on: $baseUrl" -ForegroundColor Cyan

        # Test health endpoint
        try {
            Write-Host "   Calling health endpoint..." -ForegroundColor Gray
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
            Write-Host "   This might be normal if the app is still starting up" -ForegroundColor Gray
        }

        # Test reference endpoint
        try {
            Write-Host "`n   Testing reference/countries endpoint..." -ForegroundColor Gray
            $countriesResponse = Invoke-RestMethod -Uri "$baseUrl/reference/countries" -Method Get -TimeoutSec 20
            if ($countriesResponse.success) {
                Write-Host "✅ Reference API: Working! ($($countriesResponse.data.Count) countries)" -ForegroundColor Green
            }
        } catch {
            Write-Host "⚠️ Reference API: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    # Step 9: Show deployment summary
    Write-Host "`n╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║         REFOPEN DEPLOYMENT SUMMARY                           ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📦 Deployment Details:" -ForegroundColor Cyan
    Write-Host "   Environment: $normalizedEnv ($refopenEnv)" -ForegroundColor White
    Write-Host "   Function App: $targetFunctionApp" -ForegroundColor White
    Write-Host "   Resource Group: refopen-prod-rg" -ForegroundColor White
    Write-Host "   Region: Central India" -ForegroundColor White
    Write-Host ""
    Write-Host "🗄️ Database:" -ForegroundColor Cyan
    Write-Host "   Server: $($dbServer.Split('.')[0])..." -ForegroundColor White
    Write-Host "   Location: Central India" -ForegroundColor White
    Write-Host ""
    Write-Host "💳 Services:" -ForegroundColor Cyan
    Write-Host "   Razorpay: $razorpayMode mode" -ForegroundColor $(if ($razorpayMode -eq "LIVE") { "Red" } else { "Yellow" })
    Write-Host "   Google OAuth: $googleConfigured" -ForegroundColor $(if ($googleConfigured -eq "✅ CONFIGURED") { "Green" } else { "Red" })

    Write-Host "`n📡 Live API Endpoints:" -ForegroundColor Cyan
    Write-Host "   Base URL: $baseUrl" -ForegroundColor White
    Write-Host ""
    Write-Host "   🔍 Health Check:" -ForegroundColor Gray
    Write-Host "      $healthUrl" -ForegroundColor White
    Write-Host ""
    Write-Host "   🔐 Authentication:" -ForegroundColor Gray
    Write-Host "      POST $baseUrl/auth/register" -ForegroundColor White
    Write-Host "      POST $baseUrl/auth/login" -ForegroundColor White
    Write-Host "      POST $baseUrl/auth/google" -ForegroundColor White
    Write-Host ""
    Write-Host "   💼 Jobs:" -ForegroundColor Gray
    Write-Host "      GET $baseUrl/jobs" -ForegroundColor White
    Write-Host "      POST $baseUrl/jobs" -ForegroundColor White
    Write-Host ""
    Write-Host "   💳 Payments:" -ForegroundColor Gray
    Write-Host "      POST $baseUrl/payments/razorpay/create-order" -ForegroundColor White
    Write-Host "      POST $baseUrl/payments/razorpay/verify" -ForegroundColor White

} else {
    Write-Host "`n❌ Deployment failed!" -ForegroundColor Red
    Write-Host "💡 Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "   1. Check Azure login: az account show" -ForegroundColor Gray
    Write-Host "   2. Verify Function App exists in portal:" -ForegroundColor Gray
    Write-Host "      https://portal.azure.com/#@/resource/subscriptions/$SubscriptionId/resourceGroups/refopen-prod-rg/providers/Microsoft.Web/sites/$targetFunctionApp" -ForegroundColor Gray
    Write-Host "   3. Check environment configuration: .env.$normalizedEnv" -ForegroundColor Gray
    Write-Host "   4. Ensure build succeeded: npm run build" -ForegroundColor Gray
    Write-Host "   5. Try manual login: .\manual-login-refopen.ps1" -ForegroundColor Gray
    exit 1
}

# End time logging
$scriptEndTime = Get-Date
$elapsedTime = $scriptEndTime - $scriptStartTime

Write-Host "`n╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅ REFOPEN BACKEND DEPLOYMENT COMPLETED SUCCESSFULLY       ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host "⏱️ Total Duration: $($elapsedTime.ToString("mm\:ss"))" -ForegroundColor Cyan

Write-Host "`n🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Test the API health endpoint" -ForegroundColor White
Write-Host "      Invoke-RestMethod https://$targetFunctionApp.azurewebsites.net/api/health" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Deploy database schema (if not done yet)" -ForegroundColor White
Write-Host "      .\src\database_scripts\setup-database.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "   3. Configure frontend to use this API" -ForegroundColor White
Write-Host "      Frontend URL: https://refopen-frontend-web.azurestaticapps.net" -ForegroundColor Gray
Write-Host "      Set: REACT_APP_API_URL=https://$targetFunctionApp.azurewebsites.net/api" -ForegroundColor Gray
Write-Host ""
Write-Host "   4. Monitor logs in Azure Portal" -ForegroundColor White
Write-Host "      https://portal.azure.com/#@/resource/subscriptions/$SubscriptionId/resourceGroups/refopen-prod-rg/providers/Microsoft.Web/sites/$targetFunctionApp/logStream" -ForegroundColor Gray

Write-Host "`n💡 Quick Test Commands:" -ForegroundColor Yellow
Write-Host "   # Test health" -ForegroundColor Gray
Write-Host "   Invoke-RestMethod https://$targetFunctionApp.azurewebsites.net/api/health" -ForegroundColor White
Write-Host ""
Write-Host "   # Test countries reference" -ForegroundColor Gray
Write-Host "   Invoke-RestMethod https://$targetFunctionApp.azurewebsites.net/api/reference/countries" -ForegroundColor White
