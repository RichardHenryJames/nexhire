# ?? NexHire Environment Sync & Backup Script
# Safely syncs current Azure Function App settings with local environment files
# Ensures no data loss during environment updates

param(
    [string]$FunctionAppName = "nexhire-api-func",
    [string]$ResourceGroup = "nexhire-dev-rg",
    [string]$SubscriptionId = "44027c71-593a-4d51-977b-ab0604cb76eb",
    [switch]$BackupOnly,
    [switch]$RestoreFromBackup,
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"

Write-Host "?? NexHire Environment Sync & Backup" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Set subscription
az account set --subscription $SubscriptionId

# Step 1: Backup current Azure Function App settings
Write-Host "?? Backing up current Azure Function App settings..." -ForegroundColor Yellow

$currentDateTime = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"
$backupPath = "backups"
if (-not (Test-Path $backupPath)) {
    New-Item -Path $backupPath -ItemType Directory | Out-Null
}

$backupFileName = if ($BackupFile) { $BackupFile } else { "$backupPath/azure-function-env-backup-$currentDateTime.json" }

# Get all current app settings
$currentSettings = az functionapp config appsettings list --name $FunctionAppName --resource-group $ResourceGroup --output json | ConvertFrom-Json

# Save to backup file
$currentSettings | ConvertTo-Json -Depth 10 | Out-File -FilePath $backupFileName -Encoding UTF8

Write-Host "? Backed up $($currentSettings.Count) environment variables to: $backupFileName" -ForegroundColor Green

# Step 2: Create comprehensive environment file from current Azure settings
Write-Host "?? Creating comprehensive .env file from current Azure settings..." -ForegroundColor Yellow

$envContent = @()
$envContent += "# ?? NexHire Backend - Current Production Environment"
$envContent += "# Generated from Azure Function App: $FunctionAppName"
$envContent += "# Backup date: $currentDateTime"
$envContent += "# Total variables: $($currentSettings.Count)"
$envContent += ""

# Group settings by category
$categories = @{
    "ENVIRONMENT" = @("NEXHIRE_ENV", "NEXHIRE_VERSION", "NEXHIRE_DEBUG", "NODE_ENV")
    "AZURE_FUNCTION" = @("FUNCTIONS_WORKER_RUNTIME", "WEBSITE_NODE_DEFAULT_VERSION", "FUNCTIONS_EXTENSION_VERSION", "AzureWebJobsStorage", "WEBSITE_CONTENTAZUREFILECONNECTIONSTRING", "WEBSITE_CONTENTSHARE", "WEBSITE_RUN_FROM_PACKAGE", "ENABLE_ORYX_BUILD", "SCM_DO_BUILD_DURING_DEPLOYMENT")
    "DATABASE" = @("DB_SERVER", "DB_NAME", "DB_USER", "DB_PASSWORD", "DB_ENCRYPT", "DB_TRUST_SERVER_CERTIFICATE", "DB_CONNECTION_TIMEOUT")
    "AUTHENTICATION" = @("JWT_SECRET", "JWT_EXPIRES_IN", "JWT_REFRESH_EXPIRES_IN", "JWT_ACCESS_TOKEN_EXPIRY", "JWT_REFRESH_TOKEN_EXPIRY", "BCRYPT_SALT_ROUNDS")
    "GOOGLE_OAUTH" = @("GOOGLE_CLIENT_ID_WEB", "GOOGLE_CLIENT_ID_ANDROID", "GOOGLE_CLIENT_ID_IOS", "EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB", "EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID", "EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS")
    "RAZORPAY" = @("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET")
    "AZURE_SERVICES" = @("AZURE_STORAGE_CONNECTION_STRING", "AZURE_STORAGE_CONTAINER_NAME", "AZURE_STORAGE_ACCOUNT_NAME", "AZURE_STORAGE_ACCOUNT_KEY", "APPLICATIONINSIGHTS_CONNECTION_STRING")
    "API_CORS" = @("CORS_ORIGINS", "CORS_ALLOWED_ORIGINS", "RATE_LIMIT_MAX_REQUESTS", "RATE_LIMIT_WINDOW_MS")
    "FEATURE_FLAGS" = @("FEATURE_FLAG_REFERRAL_SYSTEM", "FEATURE_FLAG_GOOGLE_SIGNIN", "FEATURE_FLAG_PAYMENT_SYSTEM", "FEATURE_FLAG_JOB_SCRAPING")
    "JOB_SCRAPING" = @("ADZUNA_APP_ID", "ADZUNA_APP_KEY", "SCHEDULER_ENABLED", "SCRAPING_INTERVAL_HOURS", "AUTO_START_SCHEDULER", "INIT_SCHEDULER")
    "LOGGING" = @("DETAILED_LOGGING", "DEBUG_LEVEL", "LOG_LEVEL")
}

foreach ($categoryName in $categories.Keys) {
    $categoryVars = @()
    foreach ($varName in $categories[$categoryName]) {
        $setting = $currentSettings | Where-Object { $_.name -eq $varName }
        if ($setting) {
            $categoryVars += $setting
        }
    }
    
    if ($categoryVars.Count -gt 0) {
        $envContent += "# ========================================================================"
        $envContent += "# ?? $categoryName"
        $envContent += "# ========================================================================"
        
        foreach ($var in $categoryVars) {
            $envContent += "$($var.name)=$($var.value)"
        }
        $envContent += ""
    }
}

# Add any uncategorized variables
$categorizedVars = $categories.Values | ForEach-Object { $_ } | Sort-Object -Unique
$uncategorizedVars = $currentSettings | Where-Object { $_.name -notin $categorizedVars }

if ($uncategorizedVars.Count -gt 0) {
    $envContent += "# ========================================================================"
    $envContent += "# ?? OTHER SETTINGS"
    $envContent += "# ========================================================================"
    foreach ($var in $uncategorizedVars) {
        $envContent += "$($var.name)=$($var.value)"
    }
}

# Step 3: Save to current production environment file
$currentEnvFile = ".env.current-azure-backup"
$envContent | Out-File -FilePath $currentEnvFile -Encoding UTF8

Write-Host "? Created current environment file: $currentEnvFile" -ForegroundColor Green

if ($BackupOnly) {
    Write-Host "?? Backup completed!" -ForegroundColor Green
    Write-Host "   JSON Backup: $backupFileName" -ForegroundColor White
    Write-Host "   ENV Backup: $currentEnvFile" -ForegroundColor White
    exit 0
}

# Step 4: Compare with existing .env.prod
Write-Host "?? Comparing with existing .env.prod..." -ForegroundColor Yellow

if (Test-Path ".env.prod") {
    Write-Host "?? Analysis of differences:" -ForegroundColor Cyan
    
    $prodContent = Get-Content ".env.prod" -Raw
    $currentContent = Get-Content $currentEnvFile -Raw
    
    # Extract variables from both files
    $prodVars = @{}
    $currentVars = @{}
    
    foreach ($line in ($prodContent -split "`n")) {
        if ($line -match "^([^#][^=]+)=(.*)$") {
            $prodVars[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
    
    foreach ($line in ($currentContent -split "`n")) {
        if ($line -match "^([^#][^=]+)=(.*)$") {
            $currentVars[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
    
    # Variables only in Azure (missing from .env.prod)
    $onlyInAzure = @()
    foreach ($varName in $currentVars.Keys) {
        if (-not $prodVars.ContainsKey($varName)) {
            $onlyInAzure += $varName
        }
    }
    
    # Variables only in .env.prod (missing from Azure)
    $onlyInProd = @()
    foreach ($varName in $prodVars.Keys) {
        if (-not $currentVars.ContainsKey($varName)) {
            $onlyInProd += $varName
        }
    }
    
    # Different values
    $differentValues = @()
    foreach ($varName in $prodVars.Keys) {
        if ($currentVars.ContainsKey($varName) -and $prodVars[$varName] -ne $currentVars[$varName]) {
            $differentValues += @{
                Name = $varName
                ProdValue = $prodVars[$varName]
                AzureValue = $currentVars[$varName]
            }
        }
    }
    
    if ($onlyInAzure.Count -gt 0) {
        Write-Host "? Variables only in Azure (will be preserved):" -ForegroundColor Green
        foreach ($var in $onlyInAzure) {
            Write-Host "   + $var" -ForegroundColor Green
        }
    }
    
    if ($onlyInProd.Count -gt 0) {
        Write-Host "?? Variables only in .env.prod (will be added to Azure):" -ForegroundColor Blue
        foreach ($var in $onlyInProd) {
            Write-Host "   + $var" -ForegroundColor Blue
        }
    }
    
    if ($differentValues.Count -gt 0) {
        Write-Host "?? Variables with different values:" -ForegroundColor Yellow
        foreach ($var in $differentValues) {
            Write-Host "   ~ $($var.Name)" -ForegroundColor Yellow
            Write-Host "     Azure: $($var.AzureValue)" -ForegroundColor Gray
            Write-Host "     .env.prod: $($var.ProdValue)" -ForegroundColor Gray
        }
    }
}

# Step 5: Create merged environment file
Write-Host "?? Creating merged environment file..." -ForegroundColor Yellow

$mergedEnvFile = ".env.prod.merged"
$mergedContent = @()
$mergedContent += "# ?? NexHire Backend - Merged Production Environment"
$mergedContent += "# Combined from current Azure Function App + .env.prod"
$mergedContent += "# Generated: $currentDateTime"
$mergedContent += ""

# Start with current Azure settings (to preserve everything working)
$allVars = @{}
foreach ($setting in $currentSettings) {
    $allVars[$setting.name] = $setting.value
}

# Add/override with .env.prod settings (for new configurations)
if (Test-Path ".env.prod") {
    $prodContent = Get-Content ".env.prod"
    foreach ($line in $prodContent) {
        if ($line -match "^([^#][^=]+)=(.*)$") {
            $varName = $matches[1].Trim()
            $varValue = $matches[2].Trim()
            $allVars[$varName] = $varValue
        }
    }
}

# Write merged content with categories
foreach ($categoryName in $categories.Keys) {
    $categoryVars = @()
    foreach ($varName in $categories[$categoryName]) {
        if ($allVars.ContainsKey($varName)) {
            $categoryVars += @{ Name = $varName; Value = $allVars[$varName] }
        }
    }
    
    if ($categoryVars.Count -gt 0) {
        $mergedContent += "# ========================================================================"
        $mergedContent += "# ?? $categoryName"
        $mergedContent += "# ========================================================================"
        
        foreach ($var in $categoryVars) {
            $mergedContent += "$($var.Name)=$($var.Value)"
        }
        $mergedContent += ""
    }
}

# Add uncategorized variables
$categorizedVars = $categories.Values | ForEach-Object { $_ } | Sort-Object -Unique
$uncategorizedVars = $allVars.Keys | Where-Object { $_ -notin $categorizedVars }

if ($uncategorizedVars.Count -gt 0) {
    $mergedContent += "# ========================================================================"
    $mergedContent += "# ?? OTHER SETTINGS"
    $mergedContent += "# ========================================================================"
    foreach ($varName in ($uncategorizedVars | Sort-Object)) {
        $mergedContent += "$varName=$($allVars[$varName])"
    }
}

$mergedContent | Out-File -FilePath $mergedEnvFile -Encoding UTF8

Write-Host "? Created merged environment file: $mergedEnvFile" -ForegroundColor Green
Write-Host "   Total variables: $($allVars.Count)" -ForegroundColor White

# Step 6: Recommendations
Write-Host "?? Recommendations:" -ForegroundColor Cyan
Write-Host "   1. Review merged file: $mergedEnvFile" -ForegroundColor White
Write-Host "   2. Copy to .env.prod if satisfied: Copy-Item $mergedEnvFile .env.prod" -ForegroundColor White
Write-Host "   3. Deploy safely: .\deploy-backend.ps1 prod" -ForegroundColor White

Write-Host "`n? Environment sync completed safely!" -ForegroundColor Green
Write-Host "   ??? All current Azure settings preserved" -ForegroundColor Green
Write-Host "   ?? Backups created for safety" -ForegroundColor Green
Write-Host "   ?? Ready for safe deployment" -ForegroundColor Green