# ================================================================
# Deploy Environment Variables from JSON Configuration
# ================================================================
# This script reads environment variables from JSON files and deploys
# them to Azure Function Apps
# ================================================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("dev", "development", "prod", "production", "staging")]
    [string]$Environment = "production",
  
    [Parameter(Mandatory=$false)]
    [string]$ConfigFile = "",
    
  [Parameter(Mandatory=$false)]
    [string]$SubscriptionId = "44027c71-593a-4d51-977b-ab0604cb76eb",
    
    [switch]$DryRun,
    [switch]$Force,
    [switch]$Restart = $true,
    [switch]$SkipValidation,
    [switch]$ShowConfig
)

# ================================================================
# HEADER
# ================================================================
Write-Host "??????????????????????????????????????????????????????????" -ForegroundColor Cyan
Write-Host "?   RefOpen Environment Variables Deployment (JSON) ?" -ForegroundColor Cyan
Write-Host "??????????????????????????????????????????????????????????" -ForegroundColor Cyan
Write-Host ""

# ================================================================
# NORMALIZE ENVIRONMENT
# ================================================================
$normalizedEnv = switch ($Environment.ToLower()) {
    { $_ -in @("dev", "development") } { "dev" }
    "staging" { "staging" }
    { $_ -in @("prod", "production") } { "prod" }
    default { $Environment }
}

if ($normalizedEnv -notin @("dev", "staging", "prod")) {
    Write-Host "? Invalid environment: $Environment" -ForegroundColor Red
    Write-Host "??  Valid environments: dev, staging, prod" -ForegroundColor Yellow
    exit 1
}

# ================================================================
# LOAD JSON CONFIGURATION
# ================================================================
if ([string]::IsNullOrEmpty($ConfigFile)) {
    $ConfigFile = "env-config.$normalizedEnv.json"
}

if (-not (Test-Path $ConfigFile)) {
    Write-Host "? Configuration file not found: $ConfigFile" -ForegroundColor Red
    Write-Host "?? Available configuration files:" -ForegroundColor Yellow
    Get-ChildItem -Path . -Filter "env-config.*.json" | ForEach-Object {
     Write-Host "   - $($_.Name)" -ForegroundColor Gray
    }
    exit 1
}

Write-Host "?? Loading configuration from: $ConfigFile" -ForegroundColor Cyan

try {
  $config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
} catch {
    Write-Host "? Failed to parse JSON configuration: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# ================================================================
# EXTRACT CONFIGURATION
# ================================================================
$envName = $config.environment
$infrastructure = $config.infrastructure
$functionAppName = $config.functionApp
$resourceGroup = $config.resourceGroup
$description = $config.description
$lastUpdated = $config.lastUpdated
$variables = $config.variables
$excludeVars = $config.excludeVariables
$criticalVars = $config.criticalVariables

# ================================================================
# DISPLAY CONFIGURATION
# ================================================================
Write-Host "?? Configuration Summary:" -ForegroundColor Yellow
Write-Host "   Environment: $envName" -ForegroundColor White
Write-Host "   Infrastructure: $infrastructure" -ForegroundColor White
Write-Host "   Function App: $functionAppName" -ForegroundColor White
Write-Host "   Resource Group: $resourceGroup" -ForegroundColor White
Write-Host "   Description: $description" -ForegroundColor Gray
Write-Host "   Last Updated: $lastUpdated" -ForegroundColor Gray
Write-Host ""

if ($ShowConfig) {
    Write-Host "?? Environment Variables:" -ForegroundColor Cyan
    $variables.PSObject.Properties | Sort-Object Name | ForEach-Object {
   $value = if ($_.Value.Length -gt 60) { $_.Value.Substring(0, 60) + "..." } else { $_.Value }
        Write-Host "   $($_.Name) = $value" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "?? Excluded Variables:" -ForegroundColor Yellow
    $excludeVars | ForEach-Object {
        Write-Host "   - $_" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "?? Critical Variables:" -ForegroundColor Red
    $criticalVars | ForEach-Object {
        Write-Host "   - $_" -ForegroundColor Gray
    }
    exit 0
}

# ================================================================
# VALIDATE AZURE CLI
# ================================================================
Write-Host "?? Validating prerequisites..." -ForegroundColor Yellow

try {
    $azVersion = az version 2>$null | ConvertFrom-Json
    Write-Host "? Azure CLI: $($azVersion.'azure-cli')" -ForegroundColor Green
} catch {
    Write-Host "? Azure CLI not found or not logged in" -ForegroundColor Red
    Write-Host "   Run: az login" -ForegroundColor Yellow
    exit 1
}

# ================================================================
# SET SUBSCRIPTION
# ================================================================
Write-Host "?? Setting Azure subscription..." -ForegroundColor Yellow
az account set --subscription $SubscriptionId 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "? Failed to set subscription: $SubscriptionId" -ForegroundColor Red
    Write-Host "?? Available subscriptions:" -ForegroundColor Yellow
    az account list --query "[].{Name:name, ID:id}" -o table
    exit 1
}

$currentSub = az account show 2>$null | ConvertFrom-Json
Write-Host "? Subscription: $($currentSub.name)" -ForegroundColor Green

# ================================================================
# VERIFY FUNCTION APP EXISTS
# ================================================================
Write-Host "?? Verifying Function App..." -ForegroundColor Yellow

$appInfo = az functionapp show `
    --name $functionAppName `
    --resource-group $resourceGroup `
    2>$null | ConvertFrom-Json

if (-not $appInfo) {
    Write-Host "? Function App not found: $functionAppName in $resourceGroup" -ForegroundColor Red
    Write-Host "?? Available Function Apps in $resourceGroup`:" -ForegroundColor Yellow
    az functionapp list --resource-group $resourceGroup --query "[].name" -o table
    exit 1
}

Write-Host "? Function App: $functionAppName" -ForegroundColor Green
Write-Host "   Location: $($appInfo.location)" -ForegroundColor Gray
Write-Host "   State: $($appInfo.state)" -ForegroundColor Gray
Write-Host "   Runtime: $($appInfo.kind)" -ForegroundColor Gray

# ================================================================
# VALIDATE CRITICAL VARIABLES
# ================================================================
if (-not $SkipValidation) {
    Write-Host ""
    Write-Host "?? Validating critical variables..." -ForegroundColor Yellow
    
    $missingCritical = @()
    $presentCritical = @()
    
    foreach ($criticalVar in $criticalVars) {
        $varValue = $variables.$criticalVar
        
        if ([string]::IsNullOrWhiteSpace($varValue)) {
     $missingCritical += $criticalVar
 Write-Host "   ? $criticalVar`: NOT SET" -ForegroundColor Red
        } else {
   $presentCritical += $criticalVar
            $displayValue = if ($varValue.Length -gt 40) { $varValue.Substring(0, 40) + "..." } else { $varValue }
      
    # Infrastructure-specific validation
            if ($normalizedEnv -eq "prod") {
 switch ($criticalVar) {
      "DB_SERVER" {
              if ($varValue -like "*refopen-sqlserver-ci*") {
           Write-Host "   ? $criticalVar`: $displayValue (RefOpen ?)" -ForegroundColor Green
} else {
    Write-Host "   ??  $criticalVar`: $displayValue (Should be refopen-sqlserver-ci!)" -ForegroundColor Yellow
                     }
  }
     "AZURE_STORAGE_ACCOUNT_NAME" {
         if ($varValue -like "*refopenstoragesi*") {
   Write-Host "   ? $criticalVar`: $displayValue (RefOpen ?)" -ForegroundColor Green
            } else {
                  Write-Host "   ??  $criticalVar`: $displayValue (Should be refopenstoragesi!)" -ForegroundColor Yellow
     }
  }
          "RAZORPAY_KEY_ID" {
     if ($varValue -like "rzp_live_*") {
          Write-Host "   ? $criticalVar`: LIVE mode ?" -ForegroundColor Green
        } else {
         Write-Host "   ??  $criticalVar`: TEST mode (Should be LIVE in production!)" -ForegroundColor Yellow
 }
   }
          default {
         Write-Host "   ? $criticalVar`: $displayValue" -ForegroundColor Green
       }
            }
     } else {
          Write-Host "   ? $criticalVar`: $displayValue" -ForegroundColor Green
            }
        }
    }
    
    if ($missingCritical.Count -gt 0 -and -not $Force) {
 Write-Host ""
  Write-Host "??  WARNING: $($missingCritical.Count) critical variables are missing!" -ForegroundColor Yellow
        Write-Host "   Missing: $($missingCritical -join ', ')" -ForegroundColor Red
        $response = Read-Host "Continue anyway? (y/N)"
        if ($response -notin @("y", "Y")) {
      Write-Host "? Deployment cancelled" -ForegroundColor Red
        exit 1
    }
    }
}

# ================================================================
# PREPARE VARIABLES FOR DEPLOYMENT
# ================================================================
Write-Host ""
Write-Host "?? Preparing variables for deployment..." -ForegroundColor Yellow

$envVars = @{}
$excludedCount = 0
$includedCount = 0

$variables.PSObject.Properties | ForEach-Object {
    $varName = $_.Name
 $varValue = $_.Value
    
    if ($varName -in $excludeVars) {
        Write-Host "   ??  Skipping: $varName (excluded)" -ForegroundColor DarkGray
        $excludedCount++
    } else {
        $envVars[$varName] = $varValue
        $includedCount++
    }
}

Write-Host ""
Write-Host "?? Variable Summary:" -ForegroundColor Cyan
Write-Host "   ? Will deploy: $includedCount variables" -ForegroundColor Green
Write-Host "   ??  Excluded: $excludedCount variables" -ForegroundColor Yellow
Write-Host "   ?? Total in config: $($includedCount + $excludedCount)" -ForegroundColor White

# ================================================================
# GROUP VARIABLES BY CATEGORY
# ================================================================
Write-Host ""
Write-Host "?? Variables grouped by category:" -ForegroundColor Cyan

$categories = @{
    "???  Database" = @("DB_SERVER", "DB_NAME", "DB_USER", "DB_PASSWORD", "DB_ENCRYPT", "DB_TRUST_SERVER_CERTIFICATE", "DB_CONNECTION_TIMEOUT", "DB_CONNECTION_STRING")
    "?? Authentication" = @("JWT_SECRET", "JWT_EXPIRES_IN", "JWT_REFRESH_EXPIRES_IN", "JWT_ACCESS_TOKEN_EXPIRY", "JWT_REFRESH_TOKEN_EXPIRY", "BCRYPT_SALT_ROUNDS")
    "??  Storage" = @("AZURE_STORAGE_ACCOUNT_NAME", "AZURE_STORAGE_ACCOUNT_KEY", "AZURE_STORAGE_CONNECTION_STRING", "AZURE_STORAGE_CONTAINER_NAME", "AZURE_STORAGE_CONTAINER_RESUMES", "AZURE_STORAGE_CONTAINER_PROFILE_IMAGES", "AZURE_STORAGE_CONTAINER_DOCUMENTS", "AZURE_STORAGE_CONTAINER_COMPANY_LOGOS", "AZURE_STORAGE_CONTAINER_REFERRAL_PROOFS")
    "?? Payment" = @("PAYMENT_GATEWAY", "CASHFREE_APP_ID", "CASHFREE_SECRET_KEY", "CASHFREE_API_VERSION", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET")
  "?? OAuth" = @("GOOGLE_CLIENT_ID_WEB", "GOOGLE_CLIENT_ID_ANDROID", "GOOGLE_CLIENT_ID_IOS")
    "?? Job Scraping" = @("ADZUNA_APP_ID", "ADZUNA_APP_KEY", "SCHEDULER_ENABLED", "SCRAPING_INTERVAL_HOURS", "AUTO_START_SCHEDULER", "INIT_SCHEDULER")
    "?? Features" = @("FEATURE_FLAG_REFERRAL_SYSTEM", "FEATURE_FLAG_GOOGLE_SIGNIN", "FEATURE_FLAG_PAYMENT_SYSTEM", "FEATURE_FLAG_JOB_SCRAPING")
    "?? API/CORS" = @("CORS_ORIGINS", "CORS_ALLOWED_ORIGINS", "RATE_LIMIT_MAX_REQUESTS", "RATE_LIMIT_WINDOW_MS")
    "?? Monitoring" = @("APPLICATIONINSIGHTS_CONNECTION_STRING")
    "?? Logging" = @("DEBUG_LEVEL", "LOG_LEVEL", "DETAILED_LOGGING", "NEXHIRE_DEBUG")
    "?? Environment" = @("NODE_ENV", "NEXHIRE_ENV", "NEXHIRE_VERSION")
    "? Functions" = @("FUNCTIONS_WORKER_RUNTIME", "FUNCTIONS_EXTENSION_VERSION", "WEBSITE_NODE_DEFAULT_VERSION", "ENABLE_ORYX_BUILD", "SCM_DO_BUILD_DURING_DEPLOYMENT")
}

foreach ($category in $categories.Keys | Sort-Object) {
    $categoryVars = $categories[$category] | Where-Object { $envVars.ContainsKey($_) }
    if ($categoryVars.Count -gt 0) {
     Write-Host "   $category ($($categoryVars.Count))" -ForegroundColor Yellow
    }
}

# ================================================================
# DRY RUN CHECK
# ================================================================
if ($DryRun) {
    Write-Host ""
    Write-Host "?? DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host "? Validation complete. Run without -DryRun to deploy." -ForegroundColor Green
    exit 0
}

# ================================================================
# CONFIRM DEPLOYMENT
# ================================================================
if (-not $Force) {
    Write-Host ""
    Write-Host "??  Ready to deploy $($envVars.Count) variables to Azure" -ForegroundColor Yellow
    Write-Host "   Environment: $normalizedEnv" -ForegroundColor White
    Write-Host "   Function App: $functionAppName" -ForegroundColor White
    Write-Host "   Resource Group: $resourceGroup" -ForegroundColor White
  if ($Restart) {
   Write-Host "   ?? Will RESTART Function App after deployment" -ForegroundColor Red
    }
    Write-Host ""
    $response = Read-Host "Proceed with deployment? (y/N)"
    if ($response -notin @("y", "Y")) {
        Write-Host "? Deployment cancelled" -ForegroundColor Red
        exit 0
    }
}

# ================================================================
# DEPLOY VARIABLES IN BATCHES
# ================================================================
Write-Host ""
Write-Host "? Deploying environment variables to Azure..." -ForegroundColor Cyan

$batchSize = 25
$varNames = $envVars.Keys | Sort-Object
$successCount = 0
$failCount = 0
$totalBatches = [Math]::Ceiling($varNames.Count / $batchSize)

for ($i = 0; $i -lt $varNames.Count; $i += $batchSize) {
    $batchEnd = [Math]::Min($i + $batchSize - 1, $varNames.Count - 1)
    $currentBatch = $varNames[$i..$batchEnd]
    
    $batchSettings = @()
    foreach ($varName in $currentBatch) {
        $escapedValue = $envVars[$varName] -replace '"', '\"'
      $batchSettings += "$varName=$escapedValue"
  }
    
  $batchNumber = [Math]::Floor($i / $batchSize) + 1
    
    Write-Host "   ?? Batch ${batchNumber}/${totalBatches}: Deploying $($currentBatch.Count) variables..." -ForegroundColor Gray
    
  try {
      az functionapp config appsettings set `
      --name $functionAppName `
    --resource-group $resourceGroup `
       --settings @batchSettings `
            --output none 2>$null
        
        if ($LASTEXITCODE -eq 0) {
   Write-Host "   ? Batch ${batchNumber} completed" -ForegroundColor Green
            $successCount += $currentBatch.Count
        } else {
         Write-Host "   ? Batch ${batchNumber} failed" -ForegroundColor Red
       $failCount += $currentBatch.Count
        }
    } catch {
        Write-Host "   ? Batch ${batchNumber} failed: $($_.Exception.Message)" -ForegroundColor Red
        $failCount += $currentBatch.Count
    }
    
    Start-Sleep -Seconds 2
}

# ================================================================
# DEPLOYMENT RESULTS
# ================================================================
Write-Host ""
Write-Host "?? Deployment Results:" -ForegroundColor Cyan
Write-Host "   ? Success: $successCount variables" -ForegroundColor Green
if ($failCount -gt 0) {
    Write-Host "   ? Failed: $failCount variables" -ForegroundColor Red
}

if ($failCount -gt 0) {
    Write-Host ""
    Write-Host "??  Some variables failed to deploy. Check errors above." -ForegroundColor Yellow
    exit 1
}

# ================================================================
# WAIT FOR PROPAGATION
# ================================================================
Write-Host ""
Write-Host "? Waiting for settings to propagate (15 seconds)..." -ForegroundColor Yellow
for ($i = 15; $i -gt 0; $i--) {
    Write-Progress -Activity "Waiting for propagation" -Status "$i seconds remaining..." -PercentComplete ((15 - $i) / 15 * 100)
    Start-Sleep -Seconds 1
}
Write-Progress -Activity "Waiting for propagation" -Completed

# ================================================================
# VERIFY DEPLOYMENT
# ================================================================
Write-Host "?? Verifying deployment..." -ForegroundColor Yellow

$verifiedCount = 0
$failedVerify = 0

foreach ($criticalVar in $presentCritical) {
    try {
        $azureValue = az functionapp config appsettings list `
    --name $functionAppName `
            --resource-group $resourceGroup `
--query "[?name=='$criticalVar'].value" `
     -o tsv 2>$null
        
        if ($azureValue) {
      $displayValue = if ($azureValue.Length -gt 30) { $azureValue.Substring(0, 30) + "..." } else { $azureValue }
    Write-Host "   ? $criticalVar`: $displayValue" -ForegroundColor Green
       $verifiedCount++
        } else {
        Write-Host "   ? $criticalVar`: NOT FOUND" -ForegroundColor Red
   $failedVerify++
        }
    } catch {
        Write-Host "   ??  $criticalVar`: Could not verify" -ForegroundColor Yellow
    $failedVerify++
    }
}

Write-Host ""
Write-Host "   Verified: $verifiedCount / $($presentCritical.Count)" -ForegroundColor $(if ($failedVerify -eq 0) { "Green" } else { "Yellow" })

# ================================================================
# RESTART FUNCTION APP
# ================================================================
if ($Restart) {
    Write-Host ""
    Write-Host "?? Restarting Function App..." -ForegroundColor Yellow
    
    az functionapp restart `
    --name $functionAppName `
      --resource-group $resourceGroup `
        --output none 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "? Restart initiated" -ForegroundColor Green
        Write-Host "? Waiting 45 seconds for restart..." -ForegroundColor Gray
  
        for ($i = 45; $i -gt 0; $i--) {
            Write-Progress -Activity "Restarting Function App" -Status "$i seconds remaining..." -PercentComplete ((45 - $i) / 45 * 100)
     Start-Sleep -Seconds 1
        }
        Write-Progress -Activity "Restarting Function App" -Completed
        
  Write-Host "? Function App restarted" -ForegroundColor Green
    } else {
        Write-Host "? Restart failed" -ForegroundColor Red
    }
} else {
  Write-Host ""
    Write-Host "??  Function App NOT restarted" -ForegroundColor Yellow
    Write-Host "   ??  Variables are deployed but may not be active until restart" -ForegroundColor Gray
}

# ================================================================
# FINAL SUMMARY
# ================================================================
Write-Host ""
Write-Host "??????????????????????????????????????????????????????????" -ForegroundColor Green
Write-Host "?       ? DEPLOYMENT COMPLETED SUCCESSFULLY          ?" -ForegroundColor Green
Write-Host "??????????????????????????????????????????????????????????" -ForegroundColor Green

Write-Host ""
Write-Host "?? Summary:" -ForegroundColor Cyan
Write-Host "   Environment: $normalizedEnv" -ForegroundColor White
Write-Host "   Function App: $functionAppName" -ForegroundColor White
Write-Host "   Resource Group: $resourceGroup" -ForegroundColor White
Write-Host "   Variables Deployed: $successCount" -ForegroundColor White
Write-Host "   Critical Variables Verified: $verifiedCount" -ForegroundColor White
Write-Host " Function App Restarted: $(if ($Restart) { 'YES ?' } else { 'NO ??' })" -ForegroundColor $(if ($Restart) { "Green" } else { "Yellow" })

Write-Host ""
Write-Host "?? Next Steps:" -ForegroundColor Cyan
if (-not $Restart) {
    Write-Host "   ?? Restart: az functionapp restart --name $functionAppName --resource-group $resourceGroup" -ForegroundColor White
}
Write-Host "   ?? Test: https://$functionAppName.azurewebsites.net/api/health" -ForegroundColor White
Write-Host "   ?? Monitor: Azure Portal > $functionAppName > Logs" -ForegroundColor White

Write-Host ""
Write-Host "?? Quick Test:" -ForegroundColor Yellow
Write-Host "   Invoke-RestMethod https://$functionAppName.azurewebsites.net/api/health" -ForegroundColor Cyan
Write-Host ""
