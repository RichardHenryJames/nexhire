# ============================================================
# Deploy Azure Communication Services for Email Notifications
# ============================================================
# This script creates:
# 1. Azure Communication Services resource
# 2. Email Communication Service with Azure-managed domain
# 3. Links them together
# 4. Updates your local.settings.json with connection string
# ============================================================

param(
    [string]$ResourceGroup = "refopen-prod-rg",
    [string]$Location = "Global",
    [string]$AcsName = "refopen-acs",
    [string]$EmailName = "refopen-email",
    [string]$SubscriptionId = "44027c71-593a-4d51-977b-ab0604cb76eb",
    [string]$FunctionAppName = "refopen-api-func"
)

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Azure Communication Services - Email Setup" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Gray
Write-Host "  Resource Group: $ResourceGroup" -ForegroundColor Gray
Write-Host "  Subscription:   $SubscriptionId" -ForegroundColor Gray
Write-Host "  Function App:   $FunctionAppName" -ForegroundColor Gray
Write-Host ""

# Check if logged in to Azure
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Not logged in to Azure. Please login..." -ForegroundColor Yellow
    az login
    $account = az account show | ConvertFrom-Json
}

# Set subscription
az account set --subscription $SubscriptionId

Write-Host "Using subscription: $($account.name)" -ForegroundColor Green
Write-Host ""

# Step 1: Create Azure Communication Services
Write-Host "[1/5] Creating Azure Communication Services..." -ForegroundColor Yellow
$acsResult = az communication create `
    --name $AcsName `
    --resource-group $ResourceGroup `
    --location $Location `
    --data-location "United States" `
    --output json 2>$null | ConvertFrom-Json

if (-not $acsResult) {
    Write-Host "  ACS may already exist, fetching..." -ForegroundColor Gray
    $acsResult = az communication show --name $AcsName --resource-group $ResourceGroup --output json | ConvertFrom-Json
}
Write-Host "  ✓ ACS Resource: $($acsResult.name)" -ForegroundColor Green

# Step 2: Get connection string
Write-Host "[2/5] Getting connection string..." -ForegroundColor Yellow
$keys = az communication list-key --name $AcsName --resource-group $ResourceGroup --output json | ConvertFrom-Json
$connectionString = $keys.primaryConnectionString
Write-Host "  ✓ Connection string retrieved" -ForegroundColor Green

# Step 3: Create Email Communication Service
Write-Host "[3/5] Creating Email Communication Service..." -ForegroundColor Yellow
$emailResult = az communication email create `
    --name $EmailName `
    --resource-group $ResourceGroup `
    --location $Location `
    --data-location "United States" `
    --output json 2>$null | ConvertFrom-Json

if (-not $emailResult) {
    Write-Host "  Email service may already exist, fetching..." -ForegroundColor Gray
}
Write-Host "  ✓ Email Service created/exists" -ForegroundColor Green

# Step 4: Create Azure-managed domain (free subdomain)
Write-Host "[4/5] Creating Azure-managed email domain..." -ForegroundColor Yellow
$domainResult = az communication email domain create `
    --domain-name "AzureManagedDomain" `
    --email-service-name $EmailName `
    --resource-group $ResourceGroup `
    --location $Location `
    --domain-management "AzureManaged" `
    --output json 2>$null | ConvertFrom-Json

# Get the domain info
$domainInfo = az communication email domain show `
    --domain-name "AzureManagedDomain" `
    --email-service-name $EmailName `
    --resource-group $ResourceGroup `
    --output json | ConvertFrom-Json

$senderDomain = $domainInfo.mailFromSenderDomain
$senderAddress = "DoNotReply@$senderDomain"
Write-Host "  ✓ Email domain: $senderDomain" -ForegroundColor Green
Write-Host "  ✓ Sender address: $senderAddress" -ForegroundColor Green

# Step 5: Link Email domain to ACS
Write-Host "[5/5] Linking email domain to ACS..." -ForegroundColor Yellow
$domainResourceId = $domainInfo.id
az communication update `
    --name $AcsName `
    --resource-group $ResourceGroup `
    --linked-domains $domainResourceId `
    --output none 2>$null

Write-Host "  ✓ Domain linked to ACS" -ForegroundColor Green

# Update local.settings.json
Write-Host ""
Write-Host "Updating local.settings.json..." -ForegroundColor Yellow
$settingsPath = "$PSScriptRoot\local.settings.json"
if (Test-Path $settingsPath) {
    $settings = Get-Content $settingsPath | ConvertFrom-Json
    $settings.Values | Add-Member -NotePropertyName "ACS_CONNECTION_STRING" -NotePropertyValue $connectionString -Force
    $settings.Values | Add-Member -NotePropertyName "EMAIL_SENDER_ADDRESS" -NotePropertyValue $senderAddress -Force
    $settings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath
    Write-Host "  ✓ local.settings.json updated" -ForegroundColor Green
}

# Summary
Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  ✓ SETUP COMPLETE!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Environment Variables to set in Azure:" -ForegroundColor Cyan
Write-Host ""
Write-Host "ACS_CONNECTION_STRING=" -ForegroundColor Yellow -NoNewline
Write-Host "$connectionString" -ForegroundColor White
Write-Host ""
Write-Host "EMAIL_SENDER_ADDRESS=" -ForegroundColor Yellow -NoNewline
Write-Host "$senderAddress" -ForegroundColor White
Write-Host ""
Write-Host "To update Azure Function App settings, run:" -ForegroundColor Cyan
Write-Host "az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroup --settings ACS_CONNECTION_STRING=`"$connectionString`" EMAIL_SENDER_ADDRESS=`"$senderAddress`"" -ForegroundColor Gray
Write-Host ""

# Automatically update Function App settings
Write-Host "Updating Function App settings automatically..." -ForegroundColor Yellow
try {
    az functionapp config appsettings set `
        --name $FunctionAppName `
        --resource-group $ResourceGroup `
        --settings "ACS_CONNECTION_STRING=$connectionString" "EMAIL_SENDER_ADDRESS=$senderAddress" `
        --output none
    Write-Host "  ✓ Function App settings updated!" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Could not auto-update Function App. Run the command above manually." -ForegroundColor Yellow
}

# Save to a temp file for easy copy
$envFile = "$PSScriptRoot\.env.email"
@"
# Azure Communication Services - Email Configuration
# Generated on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

ACS_CONNECTION_STRING=$connectionString
EMAIL_SENDER_ADDRESS=$senderAddress
"@ | Set-Content $envFile

Write-Host "Settings also saved to: .env.email" -ForegroundColor Gray
Write-Host ""
