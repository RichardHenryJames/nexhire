# ================================================================
# NexHire Environment Variables Sync Script
# ================================================================
# Syncs environment variables from .env file to Azure Function App
# Supports dev, staging, production environments
# ================================================================

param(
    [string]$Environment = "production",  # dev, staging, production
    [string]$FunctionAppName = "nexhire-api-func",
    [string]$ResourceGroup = "nexhire-dev-rg",
    [string]$SubscriptionId = "44027c71-593a-4d51-977b-ab0604cb76eb",
    [switch]$DryRun,
    [switch]$Force,
    [switch]$Restart = $true  # Changed: Now defaults to true
)

Write-Host "?? NexHire Environment Variables Sync" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Validate environment
$validEnvs = @("dev", "development", "staging", "prod", "production")
$normalizedEnv = switch ($Environment.ToLower()) {
    { $_ -in @("dev", "development") } { "dev" }
    "staging" { "staging" }
    { $_ -in @("prod", "production") } { "prod" }
    default { $Environment }
}

if ($normalizedEnv -notin @("dev", "staging", "prod")) {
    Write-Host "? Invalid environment: $Environment" -ForegroundColor Red
    Write-Host "? Valid environments: dev, staging, prod" -ForegroundColor Yellow
    exit 1
}

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

Write-Host "?? Environment: $normalizedEnv" -ForegroundColor Green
Write-Host "?? Target Function App: $targetFunctionApp" -ForegroundColor Cyan
Write-Host "?? Resource Group: $ResourceGroup" -ForegroundColor Gray

# Check if .env file exists
$envFile = ".env.$normalizedEnv"
if (-not (Test-Path $envFile)) {
    Write-Host "? Environment file not found: $envFile" -ForegroundColor Red
    Write-Host "?? Available environment files:" -ForegroundColor Yellow
    Get-ChildItem -Path . -Filter ".env.*" | ForEach-Object { Write-Host "   - $($_.Name)" -ForegroundColor Gray }
    exit 1
}

# Set Azure subscription
Write-Host "?? Setting Azure subscription..." -ForegroundColor Yellow
az account set --subscription $SubscriptionId

# Verify function app exists
Write-Host "?? Verifying Function App exists..." -ForegroundColor Yellow
$appExists = az functionapp show --name $targetFunctionApp --resource-group $ResourceGroup 2>$null
if (-not $appExists) {
    Write-Host "? Function App not found: $targetFunctionApp" -ForegroundColor Red
    exit 1
}
Write-Host "? Function App verified" -ForegroundColor Green

# Read and parse environment variables
Write-Host "?? Reading environment variables from: $envFile" -ForegroundColor Yellow
$envVars = @{}
$envLines = Get-Content $envFile | Where-Object { $_ -and -not $_.StartsWith("#") -and $_.Contains("=") }

# Variables that Azure manages automatically (should NOT be synced)
$excludeVars = @(
    "AzureWebJobsStorage",
    "WEBSITE_CONTENTAZUREFILECONNECTIONSTRING",
    "WEBSITE_CONTENTSHARE",
    "WEBSITE_NODE_DEFAULT_VERSION",    # Azure manages Node version
    "WEBSITE_RUN_FROM_PACKAGE",         # Azure manages deployment mode
    "SCM_DO_BUILD_DURING_DEPLOYMENT"    # Azure manages build settings
)

Write-Host "?? Processing environment variables..." -ForegroundColor Yellow
$excludedCount = 0
$includedCount = 0

foreach ($line in $envLines) {
    if ($line -match "^([^=]+)=(.*)$") {
        $varName = $matches[1].Trim()
        $varValue = $matches[2].Trim()
        
        if ($varName -in $excludeVars) {
            Write-Host "   ?? Skipping: $varName (Azure managed)" -ForegroundColor DarkGray
            $excludedCount++
        } else {
            $envVars[$varName] = $varValue
            $includedCount++
        }
    }
}

Write-Host "`n?? Variable Processing Summary:" -ForegroundColor Cyan
Write-Host "   ? Will sync: $includedCount variables" -ForegroundColor Green
Write-Host "   ?? Excluded: $excludedCount variables (Azure managed)" -ForegroundColor Yellow
Write-Host "   ?? Total in .env: $($includedCount + $excludedCount) variables" -ForegroundColor White

# Critical variables validation
Write-Host "`n?? Validating critical variables..." -ForegroundColor Yellow
$criticalVars = @(
    @{ Name = "GOOGLE_CLIENT_ID_WEB"; Description = "Google OAuth Web Client" },
    @{ Name = "RAZORPAY_KEY_ID"; Description = "Razorpay Payment Key" },
    @{ Name = "JWT_SECRET"; Description = "JWT Authentication Secret" },
    @{ Name = "DB_PASSWORD"; Description = "Database Password" },
    @{ Name = "DB_SERVER"; Description = "Database Server" },
    @{ Name = "NEXHIRE_ENV"; Description = "Environment Name" }
)

$missingCritical = @()
$presentCritical = @()

foreach ($criticalVar in $criticalVars) {
    $varName = $criticalVar.Name
    $varDesc = $criticalVar.Description
    
    if (-not $envVars.ContainsKey($varName) -or [string]::IsNullOrWhiteSpace($envVars[$varName])) {
        $missingCritical += $criticalVar
        Write-Host "   ? $varDesc ($varName): NOT SET" -ForegroundColor Red
    } else {
        $presentCritical += $criticalVar
        # Show partial value for verification
        $value = $envVars[$varName]
        $displayValue = if ($value.Length -gt 20) { $value.Substring(0, 20) + "..." } else { $value }
        Write-Host "   ? $varDesc ($varName): $displayValue" -ForegroundColor Green
    }
}

if ($missingCritical.Count -gt 0 -and -not $Force) {
    Write-Host "`n?? WARNING: $($missingCritical.Count) critical variables are missing!" -ForegroundColor Yellow
    Write-Host "?? Use -Force to proceed anyway, or update your .env file" -ForegroundColor Yellow
    $response = Read-Host "Continue anyway? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "? Sync cancelled" -ForegroundColor Red
        exit 1
    }
}

# Show what will be synced
Write-Host "`n?? Variables to sync:" -ForegroundColor Cyan
$envVars.Keys | Sort-Object | ForEach-Object {
    $value = $envVars[$_]
    $displayValue = if ($value.Length -gt 50) { $value.Substring(0, 50) + "..." } else { $value }
    Write-Host "   • $_ = $displayValue" -ForegroundColor Gray
}

# Dry run check
if ($DryRun) {
    Write-Host "`n?? DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host "? Validation complete. Run without -DryRun to apply changes." -ForegroundColor Green
    if ($Restart) {
        Write-Host "?? Would restart Function App after sync (due to -Restart flag)" -ForegroundColor Yellow
    } else {
        Write-Host "?? Would NOT restart Function App (use -Restart flag to enable)" -ForegroundColor Yellow
    }
    exit 0
}

# Confirm before syncing
if (-not $Force) {
    Write-Host "`n?? This will update $($envVars.Count) environment variables in Azure" -ForegroundColor Yellow
    Write-Host "   Function App: $targetFunctionApp" -ForegroundColor White
    Write-Host "   Environment: $normalizedEnv" -ForegroundColor White
    if ($Restart) {
        Write-Host "   ?? Will RESTART Function App after sync" -ForegroundColor Red
    }
    $response = Read-Host "Proceed with sync? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "? Sync cancelled" -ForegroundColor Red
        exit 0
    }
}

# Sync environment variables to Azure
Write-Host "`n?? Syncing environment variables to Azure..." -ForegroundColor Yellow

if ($envVars.Count -gt 0) {
    Write-Host "?? Setting $($envVars.Count) app settings..." -ForegroundColor Blue
    
    # Set variables in batches to avoid command line length issues
    $batchSize = 25
    $varNames = $envVars.Keys | Sort-Object
    $successCount = 0
    $failCount = 0
    
    for ($i = 0; $i -lt $varNames.Count; $i += $batchSize) {
        $batchEnd = [Math]::Min($i + $batchSize - 1, $varNames.Count - 1)
        $currentBatch = $varNames[$i..$batchEnd]
        
        # Create settings array for this batch
        $batchSettings = @()
        foreach ($varName in $currentBatch) {
            $batchSettings += "$varName=$($envVars[$varName])"
        }
        
        $batchNumber = [Math]::Floor($i / $batchSize) + 1
        $totalBatches = [Math]::Ceiling($varNames.Count / $batchSize)
        
        Write-Host "   ?? Batch $batchNumber/$totalBatches`: Setting $($currentBatch.Count) variables..." -ForegroundColor Gray
        Write-Host "      Variables: $($currentBatch -join ', ')" -ForegroundColor DarkGray
        
        try {
            & az functionapp config appsettings set `
                --name $targetFunctionApp `
                --resource-group $ResourceGroup `
                --settings @batchSettings `
                --output none
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ? Batch $batchNumber completed" -ForegroundColor Green
                $successCount += $currentBatch.Count
            } else {
                Write-Host "   ? Batch $batchNumber failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
                $failCount += $currentBatch.Count
            }
        } catch {
            Write-Host "   ? Batch $batchNumber failed: $($_.Exception.Message)" -ForegroundColor Red
            $failCount += $currentBatch.Count
        }
    }
    
    Write-Host "`n?? Sync Results:" -ForegroundColor Cyan
    Write-Host "   ? Success: $successCount variables" -ForegroundColor Green
    if ($failCount -gt 0) {
        Write-Host "   ? Failed: $failCount variables" -ForegroundColor Red
    }
} else {
    Write-Host "?? No environment variables found to sync" -ForegroundColor Yellow
    exit 1
}

# Wait for propagation
Write-Host "`n? Waiting for settings to propagate..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Verify critical variables
Write-Host "?? Verifying critical variables in Azure..." -ForegroundColor Yellow

foreach ($criticalVar in $presentCritical) {
    $varName = $criticalVar.Name
    $varDesc = $criticalVar.Description
    
    try {
        $azureValue = az functionapp config appsettings list `
            --name $targetFunctionApp `
            --resource-group $ResourceGroup `
            --query "[?name=='$varName'].value" `
            -o tsv
        
        if ($azureValue) {
            $displayValue = if ($azureValue.Length -gt 20) { $azureValue.Substring(0, 20) + "..." } else { $azureValue }
            Write-Host "   ? $varDesc`: $displayValue" -ForegroundColor Green
        } else {
            Write-Host "   ? $varDesc`: NOT FOUND in Azure" -ForegroundColor Red
        }
    } catch {
        Write-Host "   ?? $varDesc`: Could not verify" -ForegroundColor Yellow
    }
}

# Count total variables in Azure
Write-Host "`n?? Counting total variables in Azure..." -ForegroundColor Yellow
try {
    $azureVarCount = (az functionapp config appsettings list `
        --name $targetFunctionApp `
        --resource-group $ResourceGroup | ConvertFrom-Json).Count
    Write-Host "? Total environment variables in Azure: $azureVarCount" -ForegroundColor Green
} catch {
    Write-Host "?? Could not count variables" -ForegroundColor Yellow
}

# Restart Function App if requested
if ($Restart) {
    Write-Host "`n?? Restarting Function App to apply changes..." -ForegroundColor Yellow
    
    try {
        az functionapp restart `
            --name $targetFunctionApp `
            --resource-group $ResourceGroup `
            --output none
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "? Function App restart initiated" -ForegroundColor Green
            Write-Host "? Waiting 30 seconds for restart to complete..." -ForegroundColor Gray
            Start-Sleep -Seconds 30
            Write-Host "? Function App should be running with new environment variables" -ForegroundColor Green
        } else {
            Write-Host "? Function App restart failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
            Write-Host "?? Manually restart: az functionapp restart --name $targetFunctionApp --resource-group $ResourceGroup" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "? Function App restart failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "?? Manually restart: az functionapp restart --name $targetFunctionApp --resource-group $ResourceGroup" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n?? Function App NOT restarted" -ForegroundColor Yellow
    Write-Host "   Environment variables are synced but may not be active yet" -ForegroundColor Gray
    Write-Host "   Use -Restart flag to automatically restart, or run manually:" -ForegroundColor Gray
    Write-Host "   az functionapp restart --name $targetFunctionApp --resource-group $ResourceGroup" -ForegroundColor White
}

# Final summary
Write-Host "`n? Environment variables sync completed!" -ForegroundColor Green
Write-Host "?? Summary:" -ForegroundColor Cyan
Write-Host "   Environment: $normalizedEnv" -ForegroundColor White
Write-Host "   Function App: $targetFunctionApp" -ForegroundColor White
Write-Host "   Variables Synced: $successCount / $($envVars.Count)" -ForegroundColor White
Write-Host "   Total in Azure: $azureVarCount" -ForegroundColor White
Write-Host "   Function App Restarted: $(if ($Restart) { 'YES ?' } else { 'NO ??' })" -ForegroundColor $(if ($Restart) { "Green" } else { "Yellow" })

if ($failCount -eq 0) {
    Write-Host "`n?? Next steps:" -ForegroundColor Cyan
    if (-not $Restart) {
        Write-Host "   • Restart Function App: az functionapp restart --name $targetFunctionApp --resource-group $ResourceGroup" -ForegroundColor White
    }
    Write-Host "   • Deploy function code: .\deploy-backend.ps1 -Environment $normalizedEnv -SkipEnvSync" -ForegroundColor White
    Write-Host "   • Test health endpoint: https://$targetFunctionApp.azurewebsites.net/api/health" -ForegroundColor White
} else {
    Write-Host "`n?? Some variables failed to sync. Review errors above." -ForegroundColor Yellow
    exit 1
}
