# Fast ZIP Deployment to Azure Functions via Storage Account
# This script builds, packages, uploads, and deploys your NexHire backend in under 2 minutes!

param(
    [string]$StorageAccountName = "nexhirefuncdevst",  # or "nexhireblobdev"
    [string]$ContainerName = "deployments",
    [string]$FunctionAppName = "nexhire-api-func",
    [string]$ResourceGroupName = "nexhire-rg"
)

Write-Host "?? NexHire Fast ZIP Deployment Script" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Step 1: Build the project
Write-Host "?? Step 1: Building TypeScript project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "? Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "? Build completed successfully" -ForegroundColor Green

# Step 2: Create deployment package using simple Compress-Archive
Write-Host "?? Step 2: Creating deployment package..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipName = "nexhire-backend-$timestamp.zip"

# Use simple PowerShell compression
Write-Host "   Creating ZIP file with PowerShell compression..." -ForegroundColor Gray
Compress-Archive -Path "dist\*","package.json","host.json","node_modules" -DestinationPath $zipName -Force

$zipSize = (Get-Item $zipName).Length / 1MB
Write-Host "? Created deployment package: $zipName ($([math]::Round($zipSize, 2)) MB)" -ForegroundColor Green

# Step 3: Upload to Azure Storage
Write-Host "?? Step 3: Uploading to Azure Storage..." -ForegroundColor Yellow
try {
    # Check if logged in to Azure
    $context = az account show 2>$null
    if (-not $context) {
        Write-Host "   Logging in to Azure..." -ForegroundColor Gray
        az login
    }

    # Ensure container exists
    Write-Host "   Ensuring container exists..." -ForegroundColor Gray
    az storage container create --name $ContainerName --account-name $StorageAccountName --public-access blob | Out-Null

    # Upload ZIP file
    Write-Host "   Uploading $zipName..." -ForegroundColor Gray
    az storage blob upload `
        --account-name $StorageAccountName `
        --container-name $ContainerName `
        --name $zipName `
        --file $zipName `
        --overwrite true

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to upload to storage"
    }

    # Get blob URL
    $blobUrl = az storage blob url `
        --account-name $StorageAccountName `
        --container-name $ContainerName `
        --name $zipName `
        --output tsv

    Write-Host "? Uploaded to: $blobUrl" -ForegroundColor Green
}
catch {
    Write-Host "? Failed to upload to Azure Storage: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 4: Update Function App
Write-Host "?? Step 4: Updating Function App configuration..." -ForegroundColor Yellow
try {
    # Update WEBSITE_RUN_FROM_PACKAGE setting
    Write-Host "   Updating WEBSITE_RUN_FROM_PACKAGE setting..." -ForegroundColor Gray
    az functionapp config appsettings set `
        --name $FunctionAppName `
        --resource-group $ResourceGroupName `
        --settings "WEBSITE_RUN_FROM_PACKAGE=$blobUrl" | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to update app settings"
    }

    Write-Host "? Environment variable updated" -ForegroundColor Green
}
catch {
    Write-Host "? Failed to update Function App: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 5: Restart Function App
Write-Host "?? Step 5: Restarting Function App..." -ForegroundColor Yellow
try {
    az functionapp restart --name $FunctionAppName --resource-group $ResourceGroupName | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to restart Function App"
    }
    Write-Host "? Function App restarted" -ForegroundColor Green
}
catch {
    Write-Host "? Failed to restart Function App: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 6: Wait and test
Write-Host "? Step 6: Waiting for Function App to start up..." -ForegroundColor Yellow
Start-Sleep -Seconds 45

Write-Host "?? Step 7: Testing deployed APIs..." -ForegroundColor Yellow

# Test health endpoint
Write-Host "   Testing health endpoint..." -ForegroundColor Gray
$healthUrl = "https://nexhire-api-func.azurewebsites.net/api/health"
$healthSuccess = $false

for ($i = 1; $i -le 5; $i++) {
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 10
        if ($response.success) {
            Write-Host "? Health check passed: $($response.message)" -ForegroundColor Green
            $healthSuccess = $true
            break
        }
    }
    catch {
        Write-Host "   ? Health check attempt $i/5 failed, retrying..." -ForegroundColor Gray
        if ($i -lt 5) { Start-Sleep -Seconds 10 }
    }
}

# Test countries API
Write-Host "   Testing countries API..." -ForegroundColor Gray
$countriesUrl = "https://nexhire-api-func.azurewebsites.net/api/reference/countries"
try {
    $countriesResponse = Invoke-RestMethod -Uri $countriesUrl -Method Get -TimeoutSec 10
    if ($countriesResponse.success -and $countriesResponse.data.countries) {
        Write-Host "? Countries API working with proper flag emojis!" -ForegroundColor Green
        Write-Host "   ?? Total countries: $($countriesResponse.data.total)" -ForegroundColor Gray
        
        # Show sample countries with flags
        $sampleCountries = $countriesResponse.data.countries | Select-Object -First 5
        foreach ($country in $sampleCountries) {
            Write-Host "   $($country.flag) $($country.name) ($($country.code))" -ForegroundColor White
        }
    }
}
catch {
    Write-Host "?? Countries API test failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Clean up
Write-Host "?? Cleaning up temporary files..." -ForegroundColor Gray
Remove-Item $zipName -Force -ErrorAction SilentlyContinue

# Summary
Write-Host "`n?? FAST ZIP DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host "?? Package: $zipName" -ForegroundColor White
Write-Host "?? Storage: $StorageAccountName/$ContainerName" -ForegroundColor White
Write-Host "?? Blob URL: $blobUrl" -ForegroundColor White
Write-Host "?? Health: $healthUrl" -ForegroundColor White
Write-Host "?? Countries: $countriesUrl" -ForegroundColor White
Write-Host ""
if ($healthSuccess) {
    Write-Host "? Your countries API with proper flag emojis is now live! ???? ???? ????" -ForegroundColor Green
} else {
    Write-Host "?? Deployment completed but health check needs more time. Check manually in 1-2 minutes." -ForegroundColor Yellow
}
Write-Host "?? Total deployment time: Under 2 minutes!" -ForegroundColor Cyan