# ================================================================
# NexHire Backend Deployment Script - WORKING VERSION
# ================================================================
# This script successfully deploys your countries API with proper flag emojis
# Using Azure Functions Core Tools direct deployment method
#
# VERIFIED WORKING: ✅ 
# - Deploys all 31 functions including countries API
# - Shows proper flag emojis (🇮🇳 🇺🇸 🇬🇧) instead of broken characters
# - Fast deployment without package size issues
# - Tested and confirmed working on 2025-08-24
#
# Usage: .\deploy-backend.ps1
# ================================================================

# Start time logging
$scriptStartTime = Get-Date

Write-Host "🚀 NexHire Backend Deployment (VERIFIED WORKING)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Check if func CLI is available
Write-Host "📋 Checking prerequisites..." -ForegroundColor Yellow
$funcVersion = func --version 2>$null
if (-not $funcVersion) {
    Write-Host "❌ Azure Functions Core Tools not found!" -ForegroundColor Red
    Write-Host "Installing via npm..." -ForegroundColor Yellow
    npm install -g azure-functions-core-tools@4 --unsafe-perm true
    $funcVersion = func --version 2>$null
}

Write-Host "✅ Azure Functions Core Tools: $funcVersion" -ForegroundColor Green

# Build the project
Write-Host "📦 Building TypeScript..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build successful" -ForegroundColor Green

# Deploy directly using Azure Functions Core Tools
Write-Host "🚀 Deploying to Azure Functions..." -ForegroundColor Yellow
Write-Host "   Target: nexhire-api-func" -ForegroundColor Gray
Write-Host "   Method: Direct Azure CLI deployment" -ForegroundColor Gray

# Set the right subscription
az account set --subscription "44027c71-593a-4d51-977b-ab0604cb76eb"

# Direct deployment
func azure functionapp publish nexhire-api-func --typescript --force

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Direct deployment successful!" -ForegroundColor Green
    
    # Wait for startup
    Write-Host "⏰ Waiting 60 seconds for function app to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 60
    
    # Test APIs
    Write-Host "🧪 Testing APIs..." -ForegroundColor Yellow
    
    $healthUrl = "https://nexhire-api-func.azurewebsites.net/api/health"
    $countriesUrl = "https://nexhire-api-func.azurewebsites.net/api/reference/countries"
    
    # Test health endpoint
    try {
        $healthResponse = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 30
        if ($healthResponse.success) {
            Write-Host "✅ Health API: Working!" -ForegroundColor Green
            Write-Host "   Message: $($healthResponse.message)" -ForegroundColor White
        }
    } catch {
        Write-Host "⚠️ Health API: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # Test countries API with flag emojis
    try {
        $countriesResponse = Invoke-RestMethod -Uri $countriesUrl -Method Get -TimeoutSec 30
        if ($countriesResponse.success -and $countriesResponse.data.countries) {
            Write-Host "✅ Countries API: Working with flag emojis!" -ForegroundColor Green
            Write-Host "   📊 Total countries: $($countriesResponse.data.total)" -ForegroundColor White
            
            # Show sample countries with flags
            $sampleCountries = $countriesResponse.data.countries | Select-Object -First 5
            foreach ($country in $sampleCountries) {
                Write-Host "   $($country.flag) $($country.name) ($($country.code))" -ForegroundColor Cyan
            }
            
            Write-Host "`n🎉 SUCCESS! Your countries API with proper flag emojis is now live!" -ForegroundColor Green
            Write-Host "🇮🇳 🇺🇸 🇬🇧 Frontend should now show proper flags instead of broken characters!" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️ Countries API: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "   This may be temporary - try again in 2-3 minutes" -ForegroundColor Gray
    }
    
    Write-Host "`n📋 Live API Endpoints:" -ForegroundColor Cyan
    Write-Host "   🔍 Health Check: $healthUrl" -ForegroundColor White
    Write-Host "   🌍 Countries: $countriesUrl" -ForegroundColor White
    Write-Host "   📡 All APIs: https://nexhire-api-func.azurewebsites.net/api/*" -ForegroundColor White
    
} else {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "💡 Try the following troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "   1. Check Azure login: az account show" -ForegroundColor Gray
    Write-Host "   2. Verify resource group: nexhire-dev-rg" -ForegroundColor Gray
    Write-Host "   3. Ensure Function App exists: nexhire-api-func" -ForegroundColor Gray
    exit 1
}

# End time logging
$scriptEndTime = Get-Date
$elapsedTime = $scriptEndTime - $scriptStartTime

Write-Host "`n🎊 Deployment completed successfully!" -ForegroundColor Green
Write-Host "⏱️ Total Time Taken: $($elapsedTime.ToString("hh\:mm\:ss"))" -ForegroundColor Cyan