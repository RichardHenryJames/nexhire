# ================================================================
# Environment Variables Sync Script - Multi-Environment Support
# ================================================================
# Syncs environment variables from .env file to Azure Function App
# - Production: Uses RefOpen infrastructure (refopen-api-func, refopen-prod-rg)
# - Dev/Staging: Uses RefOpen infrastructure (refopen-api-func, refopen-dev-rg)
# ================================================================

param(
    [string]$Environment = "production",  # dev, staging, production
    [string]$FunctionAppName = "",  # Auto-detected based on environment
    [string]$ResourceGroup = "",  # Auto-detected based on environment
    [string]$SubscriptionId = "44027c71-593a-4d51-977b-ab0604cb76eb",
    [switch]$DryRun,
    [switch]$Force,
    [switch]$Restart = $true  # Default: restart after sync
)

Write-Host "🚀 Environment Variables Sync - RefOpen/RefOpen" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# -------------------------
# Validate environment
# -------------------------
$validEnvs = @("dev", "development", "staging", "prod", "production")
$normalizedEnv = switch ($Environment.ToLower()) {
    { $_ -in @("dev", "development") } { "dev" }
    "staging" { "staging" }
    { $_ -in @("prod", "production") } { "prod" }
    default { $Environment }
}

if ($normalizedEnv -notin @("dev", "staging", "prod")) {
    Write-Host "❌ Invalid environment: $Environment" -ForegroundColor Red
    Write-Host "ℹ️ Valid environments: dev, staging, prod" -ForegroundColor Yellow
    exit 1
}

# -------------------------
# Auto-detect infrastructure based on environment
# -------------------------
# PRODUCTION = RefOpen infrastructure
# DEV/STAGING = RefOpen infrastructure
if ([string]::IsNullOrEmpty($FunctionAppName) -or [string]::IsNullOrEmpty($ResourceGroup)) {
    switch ($normalizedEnv) {
        "prod" {
            # RefOpen Production Infrastructure
            $FunctionAppName = "refopen-api-func"
            $ResourceGroup = "refopen-prod-rg"
            $InfrastructureName = "RefOpen"
            Write-Host "🎯 Using RefOpen Production Infrastructure" -ForegroundColor Magenta
        }
        "staging" {
            # RefOpen Staging Infrastructure
            $FunctionAppName = "refopen-api-func-staging"
            $ResourceGroup = "refopen-dev-rg"
            $InfrastructureName = "RefOpen"
            Write-Host "🎯 Using RefOpen Staging Infrastructure" -ForegroundColor Yellow
        }
        "dev" {
            # RefOpen Development Infrastructure
            $FunctionAppName = "refopen-api-func-dev"
            $ResourceGroup = "refopen-dev-rg"
            $InfrastructureName = "RefOpen"
            Write-Host "🎯 Using RefOpen Development Infrastructure" -ForegroundColor Cyan
        }
    }
}

Write-Host "🌍 Environment: $normalizedEnv" -ForegroundColor Green
Write-Host "🏢 Infrastructure: $InfrastructureName" -ForegroundColor White
Write-Host "⚡ Target Function App: $FunctionAppName" -ForegroundColor Cyan
Write-Host "📦 Resource Group: $ResourceGroup" -ForegroundColor Gray

# -------------------------
# Check .env file
# -------------------------
$envFile = ".env.$normalizedEnv"
if (-not (Test-Path $envFile)) {
    Write-Host "❌ Environment file not found: $envFile" -ForegroundColor Red
    Write-Host "📂 Available environment files:" -ForegroundColor Yellow
    Get-ChildItem -Path . -Filter ".env.*" | ForEach-Object { Write-Host "   - $($_.Name)" -ForegroundColor Gray }
    exit 1
}

Write-Host "✅ Found environment file: $envFile" -ForegroundColor Green

# -------------------------
# Set Azure subscription
# -------------------------
Write-Host "`n🔑 Setting Azure subscription..." -ForegroundColor Yellow
az account set --subscription $SubscriptionId
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Subscription set successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to set subscription" -ForegroundColor Red
    exit 1
}

# -------------------------
# Verify Function App
# -------------------------
Write-Host "🔍 Verifying Function App exists..." -ForegroundColor Yellow
$appExists = az functionapp show --name $FunctionAppName --resource-group $ResourceGroup 2>$null
if (-not $appExists) {
    Write-Host "❌ Function App not found: $FunctionAppName in $ResourceGroup" -ForegroundColor Red
    Write-Host "💡 Available Function Apps:" -ForegroundColor Yellow
    az functionapp list --resource-group $ResourceGroup --query "[].name" -o tsv 2>$null | ForEach-Object {
        Write-Host "   - $_" -ForegroundColor Gray
    }
    exit 1
}
Write-Host "✅ Function App verified: $FunctionAppName" -ForegroundColor Green

# -------------------------
# Read and parse environment variables
# -------------------------
Write-Host "`n📖 Reading environment variables from: $envFile" -ForegroundColor Yellow
$envVars = @{}
$envLines = Get-Content $envFile | Where-Object { $_ -and -not $_.StartsWith("#") -and $_.Contains("=") }

# Variables Azure manages automatically - DO NOT SYNC
$excludeVars = @(
    "AzureWebJobsStorage",
    "WEBSITE_CONTENTAZUREFILECONNECTIONSTRING",
    "WEBSITE_CONTENTSHARE",
    "WEBSITE_NODE_DEFAULT_VERSION",
    "WEBSITE_RUN_FROM_PACKAGE",
    "SCM_DO_BUILD_DURING_DEPLOYMENT",
    "AzureWebJobsDashboard"
)

Write-Host "⚙️ Processing environment variables..." -ForegroundColor Yellow
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

Write-Host "`n📊 Variable Processing Summary:" -ForegroundColor Cyan
Write-Host "   ✅ Will sync: $includedCount variables" -ForegroundColor Green
Write-Host "   ⏭️ Excluded: $excludedCount variables (Azure managed)" -ForegroundColor Yellow
Write-Host "   📦 Total in .env: $($includedCount + $excludedCount)" -ForegroundColor White

# -------------------------
# Critical variables validation
# -------------------------
Write-Host "`n🔒 Validating critical variables..." -ForegroundColor Yellow
$criticalVars = @(
    @{ Name = "DB_SERVER"; Description = "Database Server" },
    @{ Name = "DB_NAME"; Description = "Database Name" },
    @{ Name = "DB_PASSWORD"; Description = "Database Password" },
    @{ Name = "JWT_SECRET"; Description = "JWT Authentication Secret" },
    @{ Name = "AZURE_STORAGE_ACCOUNT_NAME"; Description = "Storage Account" },
    @{ Name = "RAZORPAY_KEY_ID"; Description = "Razorpay Payment Key" },
    @{ Name = "GOOGLE_CLIENT_ID_WEB"; Description = "Google OAuth Web Client" },
    @{ Name = "NODE_ENV"; Description = "Environment Name" }
)

$missingCritical = @()
$presentCritical = @()

foreach ($criticalVar in $criticalVars) {
    $varName = $criticalVar.Name
    $varDesc = $criticalVar.Description

    if (-not $envVars.ContainsKey($varName) -or [string]::IsNullOrWhiteSpace($envVars[$varName])) {
        $missingCritical += $criticalVar
        Write-Host "   ❌ ${varDesc}: NOT SET" -ForegroundColor Red
    } else {
        $presentCritical += $criticalVar
        $value = $envVars[$varName]
        
        # Special display for infrastructure-specific variables
        if ($normalizedEnv -eq "prod") {
            $displayValue = switch ($varName) {
                "DB_SERVER" { 
                    if ($value -like "*refopen*") { 
                        "✅ $value (RefOpen)" 
                    } else { 
                        "⚠️ $value (Should be RefOpen!)" 
                    }
                }
                "AZURE_STORAGE_ACCOUNT_NAME" { 
                    if ($value -like "*refopen*") { 
                        "✅ $value (RefOpen)" 
                    } else { 
                        "⚠️ $value (Should be RefOpen!)" 
                    }
                }
                "RAZORPAY_KEY_ID" { 
                    if ($value -like "rzp_live_*") { 
                        "✅ LIVE mode" 
                    } else { 
                        "⚠️ TEST mode (Should be LIVE!)" 
                    }
                }
                default { 
                    if ($value.Length -gt 30) { $value.Substring(0, 30) + "..." } else { $value }
                }
            }
        } else {
            $displayValue = if ($value.Length -gt 30) { $value.Substring(0, 30) + "..." } else { $value }
        }
        
        Write-Host "   ✅ ${varDesc}: $displayValue" -ForegroundColor Green
    }
}

if ($missingCritical.Count -gt 0 -and -not $Force) {
    Write-Host "`n⚠️ WARNING: $($missingCritical.Count) critical variables are missing!" -ForegroundColor Yellow
    $response = Read-Host "Continue anyway? (y/N)"
    if ($response -notin @("y","Y")) {
        Write-Host "❌ Sync cancelled" -ForegroundColor Red
        exit 1
    }
}

# -------------------------
# Show variables to sync (grouped)
# -------------------------
Write-Host "`n📌 Variables to sync (grouped by category):" -ForegroundColor Cyan

$categories = @{
    "Database" = @("DB_SERVER", "DB_NAME", "DB_USER", "DB_PASSWORD", "DB_ENCRYPT", "DB_TRUST_SERVER_CERTIFICATE", "DB_CONNECTION_TIMEOUT", "DB_CONNECTION_STRING")
    "Authentication" = @("JWT_SECRET", "JWT_EXPIRES_IN", "JWT_REFRESH_EXPIRES_IN", "JWT_ACCESS_TOKEN_EXPIRY", "JWT_REFRESH_TOKEN_EXPIRY", "BCRYPT_SALT_ROUNDS")
    "Storage" = @("AZURE_STORAGE_ACCOUNT_NAME", "AZURE_STORAGE_ACCOUNT_KEY", "AZURE_STORAGE_CONNECTION_STRING", "AZURE_STORAGE_CONTAINER_NAME", "AZURE_STORAGE_CONTAINER_RESUMES", "AZURE_STORAGE_CONTAINER_PROFILE_IMAGES", "AZURE_STORAGE_CONTAINER_DOCUMENTS", "AZURE_STORAGE_CONTAINER_COMPANY_LOGOS", "AZURE_STORAGE_CONTAINER_REFERRAL_PROOFS")
    "Monitoring" = @("APPLICATIONINSIGHTS_CONNECTION_STRING", "APPINSIGHTS_INSTRUMENTATIONKEY")
    "Payment" = @("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET")
    "OAuth" = @("GOOGLE_CLIENT_ID_WEB", "GOOGLE_CLIENT_ID_ANDROID", "GOOGLE_CLIENT_ID_IOS")
    "Job Scraping" = @("ADZUNA_APP_ID", "ADZUNA_APP_KEY", "SCHEDULER_ENABLED", "SCRAPING_INTERVAL_HOURS", "AUTO_START_SCHEDULER", "INIT_SCHEDULER")
    "Features" = @("FEATURE_FLAG_REFERRAL_SYSTEM", "FEATURE_FLAG_GOOGLE_SIGNIN", "FEATURE_FLAG_PAYMENT_SYSTEM", "FEATURE_FLAG_JOB_SCRAPING")
    "API" = @("CORS_ORIGINS", "CORS_ALLOWED_ORIGINS", "RATE_LIMIT_MAX_REQUESTS", "RATE_LIMIT_WINDOW_MS")
    "Logging" = @("DEBUG_LEVEL", "LOG_LEVEL", "DETAILED_LOGGING")
    "Environment" = @("NODE_ENV", "RefOpen_ENV", "RefOpen_VERSION", "RefOpen_DEBUG")
    "Functions" = @("FUNCTIONS_WORKER_RUNTIME", "FUNCTIONS_EXTENSION_VERSION", "ENABLE_ARYX_BUILD")
}

foreach ($category in $categories.Keys | Sort-Object) {
    $categoryVars = $categories[$category] | Where-Object { $envVars.ContainsKey($_) }
    if ($categoryVars.Count -gt 0) {
        Write-Host "`n   📂 $category ($($categoryVars.Count) vars)" -ForegroundColor Yellow
        foreach ($varName in $categoryVars) {
            $value = $envVars[$varName]
            $displayValue = if ($value.Length -gt 60) { $value.Substring(0, 60) + "..." } else { $value }
            Write-Host "      🔑 $varName = $displayValue" -ForegroundColor Gray
        }
    }
}

# Show uncategorized variables
$categorizedVars = $categories.Values | ForEach-Object { $_ } | Select-Object -Unique
$uncategorizedVars = $envVars.Keys | Where-Object { $_ -notin $categorizedVars } | Sort-Object
if ($uncategorizedVars.Count -gt 0) {
    Write-Host "`n   📂 Other ($($uncategorizedVars.Count) vars)" -ForegroundColor Yellow
    foreach ($varName in $uncategorizedVars) {
        $value = $envVars[$varName]
        $displayValue = if ($value.Length -gt 60) { $value.Substring(0, 60) + "..." } else { $value }
        Write-Host "      🔑 $varName = $displayValue" -ForegroundColor Gray
    }
}

# -------------------------
# Dry run check
# -------------------------
if ($DryRun) {
    Write-Host "`n🧪 DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host "✅ Validation complete. Run without -DryRun to apply changes." -ForegroundColor Green
    Write-Host $(if ($Restart) { "🔄 Would restart Function App after sync" } else { "⏸️ Would NOT restart Function App" }) -ForegroundColor Yellow
    exit 0
}

# -------------------------
# Confirm sync if not forced
# -------------------------
if (-not $Force) {
    Write-Host "`n⚠️ This will update $($envVars.Count) environment variables in Azure" -ForegroundColor Yellow
    Write-Host "   Infrastructure: $InfrastructureName" -ForegroundColor White
    Write-Host "   Function App: $FunctionAppName" -ForegroundColor White
    Write-Host "   Resource Group: $ResourceGroup" -ForegroundColor White
    Write-Host "   Environment: $normalizedEnv" -ForegroundColor White
    if ($Restart) { Write-Host "   🔄 Will RESTART Function App after sync" -ForegroundColor Red }
    $response = Read-Host "Proceed with sync? (y/N)"
    if ($response -notin @("y","Y")) {
        Write-Host "❌ Sync cancelled" -ForegroundColor Red
        exit 0
    }
}

# -------------------------
# Sync environment variables in batches
# -------------------------
Write-Host "`n⚡ Syncing environment variables to Azure..." -ForegroundColor Yellow

if ($envVars.Count -gt 0) {
    $batchSize = 25
    $varNames = $envVars.Keys | Sort-Object
    $successCount = 0
    $failCount = 0

    for ($i = 0; $i -lt $varNames.Count; $i += $batchSize) {
        $batchEnd = [Math]::Min($i + $batchSize - 1, $varNames.Count - 1)
        $currentBatch = $varNames[$i..$batchEnd]

        $batchNumber = [Math]::Floor($i / $batchSize) + 1
        $totalBatches = [Math]::Ceiling($varNames.Count / $batchSize)

        Write-Host "   🔹 Batch ${batchNumber}/${totalBatches}: Setting $($currentBatch.Count) variables..." -ForegroundColor Gray

        # Create a temporary JSON file for this batch to handle special characters
        $tempJsonPath = Join-Path $env:TEMP "env-batch-$batchNumber.json"
        $batchJson = @{}
        foreach ($varName in $currentBatch) {
            $batchJson[$varName] = $envVars[$varName]
        }
        $batchJson | ConvertTo-Json -Depth 1 | Set-Content -Path $tempJsonPath -Encoding UTF8

        try {
            # Use --settings @file.json syntax for proper escaping
            $result = az functionapp config appsettings set `
                --name $FunctionAppName `
                --resource-group $ResourceGroup `
                --settings "@$tempJsonPath" `
                --output none 2>&1

            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Batch ${batchNumber} completed" -ForegroundColor Green
                $successCount += $currentBatch.Count
            } else {
                # Fallback: try one-by-one for this batch
                Write-Host "   ⚠️ Batch failed, trying individual settings..." -ForegroundColor Yellow
                foreach ($varName in $currentBatch) {
                    $value = $envVars[$varName]
                    # Use proper quoting for complex values
                    $settingArg = "${varName}=${value}"
                    
                    $singleResult = az functionapp config appsettings set `
                        --name $FunctionAppName `
                        --resource-group $ResourceGroup `
                        --settings $settingArg `
                        --output none 2>&1

                    if ($LASTEXITCODE -eq 0) {
                        $successCount++
                    } else {
                        Write-Host "      ❌ Failed: $varName" -ForegroundColor Red
                        $failCount++
                    }
                }
            }
        } catch {
            Write-Host "   ❌ Batch ${batchNumber} failed: $($_.Exception.Message)" -ForegroundColor Red
            $failCount += $currentBatch.Count
        } finally {
            # Clean up temp file
            if (Test-Path $tempJsonPath) {
                Remove-Item $tempJsonPath -Force -ErrorAction SilentlyContinue
            }
        }
        
        # Small delay between batches
        Start-Sleep -Seconds 2
    }

    Write-Host "`n📊 Sync Results:" -ForegroundColor Cyan
    Write-Host "   ✅ Success: $successCount variables" -ForegroundColor Green
    if ($failCount -gt 0) { Write-Host "   ❌ Failed: $failCount variables" -ForegroundColor Red }
} else {
    Write-Host "⚠️ No environment variables found to sync" -ForegroundColor Yellow
    exit 1
}

# -------------------------
# Wait for propagation
# -------------------------
Write-Host "`n⏳ Waiting for settings to propagate (15 seconds)..." -ForegroundColor Yellow
for ($i = 15; $i -gt 0; $i--) {
    Write-Progress -Activity "Waiting for propagation" -Status "$i seconds remaining..." -PercentComplete ((15 - $i) / 15 * 100)
    Start-Sleep -Seconds 1
}
Write-Progress -Activity "Waiting for propagation" -Completed

# -------------------------
# Verify critical variables in Azure
# -------------------------
Write-Host "🔍 Verifying critical variables in Azure..." -ForegroundColor Yellow
$verifiedCount = 0
$failedVerify = 0

foreach ($criticalVar in $presentCritical) {
    $varName = $criticalVar.Name
    $varDesc = $criticalVar.Description

    try {
        $azureValue = az functionapp config appsettings list `
            --name $FunctionAppName `
            --resource-group $ResourceGroup `
            --query "[?name=='$varName'].value" `
            -o tsv 2>$null

        if ($azureValue) {
            $displayValue = if ($azureValue.Length -gt 30) { $azureValue.Substring(0, 30) + "..." } else { $azureValue }
            Write-Host "   ✅ ${varDesc}: $displayValue" -ForegroundColor Green
            $verifiedCount++
        } else {
            Write-Host "   ❌ ${varDesc}: NOT FOUND in Azure" -ForegroundColor Red
            $failedVerify++
        }
    } catch {
        Write-Host "   ⚠️ ${varDesc}: Could not verify" -ForegroundColor Yellow
        $failedVerify++
    }
}

Write-Host "`n   Verified: $verifiedCount / $($presentCritical.Count)" -ForegroundColor $(if ($failedVerify -eq 0) { "Green" } else { "Yellow" })

# -------------------------
# Count total variables in Azure
# -------------------------
Write-Host "`n📊 Counting total variables in Azure..." -ForegroundColor Yellow
try {
    $azureVarCount = (az functionapp config appsettings list `
        --name $FunctionAppName `
        --resource-group $ResourceGroup 2>$null | ConvertFrom-Json).Count
    Write-Host "✅ Total environment variables in Azure: $azureVarCount" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Could not count variables" -ForegroundColor Yellow
}

# -------------------------
# Restart Function App if requested
# -------------------------
if ($Restart) {
    Write-Host "`n🔄 Restarting Function App to apply changes..." -ForegroundColor Yellow
    try {
        az functionapp restart `
            --name $FunctionAppName `
            --resource-group $ResourceGroup `
            --output none 2>$null

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Function App restart initiated" -ForegroundColor Green
            Write-Host "⏳ Waiting 45 seconds for restart..." -ForegroundColor Gray
            
            for ($i = 45; $i -gt 0; $i--) {
                Write-Progress -Activity "Restarting Function App" -Status "$i seconds remaining..." -PercentComplete ((45 - $i) / 45 * 100)
                Start-Sleep -Seconds 1
            }
            Write-Progress -Activity "Restarting Function App" -Completed
            
            Write-Host "✅ Function App should be running with new variables" -ForegroundColor Green
        } else {
            Write-Host "❌ Function App restart failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Function App restart failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "`n⏸️ Function App NOT restarted" -ForegroundColor Yellow
    Write-Host "   ⚠️ Variables are synced but may not be active until restart" -ForegroundColor Gray
}

# -------------------------
# Final summary
# -------------------------
Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ ENVIRONMENT VARIABLES SYNC COMPLETED              ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host "`n📊 Summary:" -ForegroundColor Cyan
Write-Host "   Infrastructure: $InfrastructureName" -ForegroundColor White
Write-Host "   Environment: $normalizedEnv" -ForegroundColor White
Write-Host "   Function App: $FunctionAppName" -ForegroundColor White
Write-Host "   Resource Group: $ResourceGroup" -ForegroundColor White
Write-Host "   Variables Synced: $successCount / $($envVars.Count)" -ForegroundColor White
Write-Host "   Total in Azure: $azureVarCount" -ForegroundColor White
Write-Host "   Critical Variables Verified: $verifiedCount / $($presentCritical.Count)" -ForegroundColor White
Write-Host "   Function App Restarted: $(if ($Restart) { 'YES ✅' } else { 'NO ⏸️' })" -ForegroundColor $(if ($Restart) { "Green" } else { "Yellow" })

if ($failCount -eq 0 -and $failedVerify -eq 0) {
    Write-Host "`n📌 Next steps:" -ForegroundColor Cyan
    if (-not $Restart) {
        Write-Host "   🔄 Restart Function App: az functionapp restart --name $FunctionAppName --resource-group $ResourceGroup" -ForegroundColor White
    }
    Write-Host "   🚀 Deploy function code: .\deploy-backend.ps1 -Environment $normalizedEnv" -ForegroundColor White
    Write-Host "   🌐 Test health endpoint: https://$FunctionAppName.azurewebsites.net/api/health" -ForegroundColor White
    Write-Host "   📊 Monitor logs in Azure Portal" -ForegroundColor White
} else {
    Write-Host "`n⚠️ Some variables failed to sync or verify. Review errors above." -ForegroundColor Yellow
    exit 1
}

Write-Host "`n💡 Quick Test:" -ForegroundColor Yellow
Write-Host "   Invoke-RestMethod https://$FunctionAppName.azurewebsites.net/api/health" -ForegroundColor Cyan
