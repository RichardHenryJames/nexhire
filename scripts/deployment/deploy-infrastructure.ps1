# ================================================================
# RefOpen Multi-Environment Infrastructure Deployment Script
# ================================================================
# Version: 3.0
# Author: RefOpen Team
# Last Updated: January 2026
#
# This script creates complete Azure infrastructure for any environment.
# Supports: dev, staging, prod (and any custom environment)
#
# Usage:
#   .\deploy-infrastructure.ps1 -Environment dev
#   .\deploy-infrastructure.ps1 -Environment prod
#   .\deploy-infrastructure.ps1 -Environment staging
#   .\deploy-infrastructure.ps1 -Environment dev -DryRun
#   .\deploy-infrastructure.ps1 -Environment prod -SkipConfirmation
# ================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "staging", "prod", "uat", "test")]
    [string]$Environment,

    [Parameter(Mandatory=$false)]
    [string]$SubscriptionId = "44027c71-593a-4d51-977b-ab0604cb76eb",

    [Parameter(Mandatory=$false)]
    [string]$TenantId = "b197fdbb-0630-4a71-9626-ec81c3355204",

    [Parameter(Mandatory=$false)]
    [string]$UserEmail = "parimalkumar@outlook.com",

    [Parameter(Mandatory=$false)]
    [switch]$SkipConfirmation,

    [Parameter(Mandatory=$false)]
    [switch]$DryRun,

    [Parameter(Mandatory=$false)]
    [switch]$SkipSecrets,

    [Parameter(Mandatory=$false)]
    [string]$SqlAdminPassword = ""  # If empty, will auto-generate
)

$ErrorActionPreference = "Stop"
$scriptStartTime = Get-Date

# ================================================================
# HELPER FUNCTIONS
# ================================================================
function Write-Success { param([string]$Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Info { param([string]$Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Warn { param([string]$Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Err { param([string]$Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Step { param([string]$Message) Write-Host "`n═══ $Message ═══" -ForegroundColor Magenta }
function Write-SubStep { param([string]$Message) Write-Host "   → $Message" -ForegroundColor Gray }

function Generate-SecurePassword {
    param([int]$Length = 24)
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%"
    $password = "RefOpen" + $Environment.Substring(0,1).ToUpper() + $Environment.Substring(1) + "@2026!"
    $random = -join ((1..8) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    return $password + $random
}

function Test-ResourceExists {
    param([string]$ResourceType, [string]$Name, [string]$ResourceGroup)
    try {
        switch ($ResourceType) {
            "SqlServer" { $null = az sql server show --name $Name --resource-group $ResourceGroup 2>$null; return $? }
            "Storage" { $null = az storage account show --name $Name --resource-group $ResourceGroup 2>$null; return $? }
            "FunctionApp" { $null = az functionapp show --name $Name --resource-group $ResourceGroup 2>$null; return $? }
            "StaticWebApp" { $null = az staticwebapp show --name $Name --resource-group $ResourceGroup 2>$null; return $? }
            "SignalR" { $null = az signalr show --name $Name --resource-group $ResourceGroup 2>$null; return $? }
            "KeyVault" { $null = az keyvault show --name $Name --resource-group $ResourceGroup 2>$null; return $? }
            "AppInsights" { $null = az monitor app-insights component show --app $Name --resource-group $ResourceGroup 2>$null; return $? }
            "ACS" { $null = az communication show --name $Name --resource-group $ResourceGroup 2>$null; return $? }
            default { return $false }
        }
    } catch { return $false }
}

# ================================================================
# ENVIRONMENT CONFIGURATION
# ================================================================
# This section defines all environment-specific settings

$config = switch ($Environment) {
    "prod" {
        @{
            ResourceGroup = "refopen-prod-rg"
            Suffix = ""  # No suffix for prod
            DisplayName = "Production"
            
            # Resource Names
            SqlServer = "refopen-sqlserver-ci"
            SqlDatabase = "refopen-sql-db"
            StorageAccount = "refopenstoragesi"
            FunctionApp = "refopen-api-func"
            StaticWebApp = "refopen-frontend-web"
            AppInsights = "refopen-monitor"
            AppServicePlan = "CentralIndiaPlan"
            SignalR = "refopen-signalr"
            ACS = "refopen-acs"
            EmailService = "refopen-email"
            KeyVault = "refopen-keyvault-prod"
            
            # SKUs (Production - higher performance)
            SqlSku = "S0"              # Standard S0 ~$15/month
            StorageSku = "Standard_GRS" # Geo-redundant
            AppServiceSku = "B1"       # Basic
            SignalRSku = "Standard_S1" # Standard ~$50/month
            StaticWebAppSku = "Free"   # Free tier sufficient
            
            # Locations
            PrimaryLocation = "southindia"
            SqlLocation = "centralindia"      # SQL requires Central India
            FunctionLocation = "centralindia"
            StaticWebAppLocation = "eastasia" # Limited regions
            SignalRLocation = "eastus"        # Limited regions
            StorageLocation = "southindia"
            
            # Feature flags
            EnableGeoReplication = $true
            EnableAdvancedThreatProtection = $true
        }
    }
    "staging" {
        @{
            ResourceGroup = "refopen-staging-rg"
            Suffix = "-staging"
            DisplayName = "Staging"
            
            SqlServer = "refopen-sqlserver-staging"
            SqlDatabase = "refopen-sql-db-staging"
            StorageAccount = "refopenstoragestaging"
            FunctionApp = "refopen-api-func-staging"
            StaticWebApp = "refopen-frontend-staging"
            AppInsights = "refopen-monitor-staging"
            AppServicePlan = "StagingIndiaPlan"
            SignalR = "refopen-signalr-staging"
            ACS = "refopen-acs-staging"
            EmailService = "refopen-email-staging"
            KeyVault = "refopen-kv-staging"
            
            SqlSku = "Basic"
            StorageSku = "Standard_LRS"
            AppServiceSku = "B1"
            SignalRSku = "Free_F1"
            StaticWebAppSku = "Free"
            
            PrimaryLocation = "southindia"
            SqlLocation = "centralindia"
            FunctionLocation = "centralindia"
            StaticWebAppLocation = "eastasia"
            SignalRLocation = "eastus"
            StorageLocation = "southindia"
            
            EnableGeoReplication = $false
            EnableAdvancedThreatProtection = $false
        }
    }
    default {
        # dev, test, uat - all use cost-optimized settings
        @{
            ResourceGroup = "refopen-$Environment-rg"
            Suffix = "-$Environment"
            DisplayName = $Environment.ToUpper()
            
            SqlServer = "refopen-sqlserver-$Environment"
            SqlDatabase = "refopen-sql-db-$Environment"
            StorageAccount = "refopenstorage$Environment"
            FunctionApp = "refopen-api-func-$Environment"
            StaticWebApp = "refopen-frontend-$Environment"
            AppInsights = "refopen-monitor-$Environment"
            AppServicePlan = "$($Environment.Substring(0,1).ToUpper() + $Environment.Substring(1))IndiaPlan"
            SignalR = "refopen-signalr-$Environment"
            ACS = "refopen-acs-$Environment"
            EmailService = "refopen-email-$Environment"
            KeyVault = "refopen-kv-$Environment"
            
            # Cost-optimized SKUs
            SqlSku = "Basic"           # ~$5/month
            StorageSku = "Standard_LRS" # Cheapest
            AppServiceSku = "B1"       # Basic ~$13/month
            SignalRSku = "Free_F1"     # Free tier
            StaticWebAppSku = "Free"   # Free tier
            
            PrimaryLocation = "southindia"
            SqlLocation = "centralindia"
            FunctionLocation = "centralindia"
            StaticWebAppLocation = "eastasia"
            SignalRLocation = "eastus"
            StorageLocation = "southindia"
            
            EnableGeoReplication = $false
            EnableAdvancedThreatProtection = $false
        }
    }
}

# Storage containers to create
$storageContainers = @(
    "refopen-files",
    "documents",
    "profile-images",
    "resumes",
    "referral-proofs",
    "company-logos",
    "archived-jobs"
)

# ================================================================
# HEADER
# ================================================================
Clear-Host
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     RefOpen Infrastructure Deployment - $($config.DisplayName.PadRight(20))      ║" -ForegroundColor Cyan
Write-Host "╠════════════════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║  Environment:    $($Environment.PadRight(49)) ║" -ForegroundColor White
Write-Host "║  Resource Group: $($config.ResourceGroup.PadRight(49)) ║" -ForegroundColor White
Write-Host "║  Subscription:   $($SubscriptionId.Substring(0,36).PadRight(49)) ║" -ForegroundColor White
Write-Host "╚════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

if ($DryRun) {
    Write-Host ""
    Write-Host "   🧪 DRY RUN MODE - No resources will be created" -ForegroundColor Yellow
    Write-Host ""
}

# ================================================================
# RESOURCES TO CREATE
# ================================================================
Write-Host ""
Write-Host "┌────────────────────────────────────────────────────────────────────┐" -ForegroundColor Gray
Write-Host "│  Resources to Create                                               │" -ForegroundColor Gray
Write-Host "├────────────────────────────────────────────────────────────────────┤" -ForegroundColor Gray
Write-Host "│  1. Resource Group         $($config.ResourceGroup.PadRight(40)) │" -ForegroundColor White
Write-Host "│  2. SQL Server             $($config.SqlServer.PadRight(40)) │" -ForegroundColor White
Write-Host "│  3. SQL Database           $($config.SqlDatabase.PadRight(40)) │" -ForegroundColor White
Write-Host "│  4. Storage Account        $($config.StorageAccount.PadRight(40)) │" -ForegroundColor White
Write-Host "│  5. App Service Plan       $($config.AppServicePlan.PadRight(40)) │" -ForegroundColor White
Write-Host "│  6. Function App           $($config.FunctionApp.PadRight(40)) │" -ForegroundColor White
Write-Host "│  7. Application Insights   $($config.AppInsights.PadRight(40)) │" -ForegroundColor White
Write-Host "│  8. Static Web App         $($config.StaticWebApp.PadRight(40)) │" -ForegroundColor White
Write-Host "│  9. SignalR Service        $($config.SignalR.PadRight(40)) │" -ForegroundColor White
Write-Host "│ 10. Communication Services $($config.ACS.PadRight(40)) │" -ForegroundColor White
Write-Host "│ 11. Email Service          $($config.EmailService.PadRight(40)) │" -ForegroundColor White
Write-Host "│ 12. Key Vault              $($config.KeyVault.PadRight(40)) │" -ForegroundColor White
Write-Host "└────────────────────────────────────────────────────────────────────┘" -ForegroundColor Gray

# ================================================================
# ESTIMATED COSTS
# ================================================================
$estimatedCost = switch ($Environment) {
    "prod" { "~$100-150/month" }
    "staging" { "~$25-35/month" }
    default { "~$20-30/month" }
}

Write-Host ""
Write-Host "💰 Estimated Monthly Cost: $estimatedCost" -ForegroundColor Yellow
Write-Host ""

# ================================================================
# CONFIRMATION
# ================================================================
if (-not $SkipConfirmation -and -not $DryRun) {
    $response = Read-Host "Continue with deployment? (Y/N)"
    if ($response -notin @("Y", "y", "Yes", "yes")) {
        Write-Warn "Deployment cancelled by user"
        exit 0
    }
}

if ($DryRun) {
    Write-Host ""
    Write-Success "Dry run complete. Configuration validated."
    Write-Host ""
    Write-Host "To deploy, run:" -ForegroundColor Gray
    Write-Host "  .\deploy-infrastructure.ps1 -Environment $Environment" -ForegroundColor White
    exit 0
}

# ================================================================
# AZURE LOGIN CHECK
# ================================================================
Write-Step "Checking Azure Login"

try {
    $account = az account show 2>$null | ConvertFrom-Json
    if ($account.id -ne $SubscriptionId) {
        Write-Warn "Wrong subscription. Setting correct subscription..."
        az account set --subscription $SubscriptionId
    }
    Write-Success "Logged in as: $($account.user.name)"
    Write-Success "Subscription: $($account.name)"
} catch {
    Write-Err "Not logged into Azure. Please run: az login"
    exit 1
}

# ================================================================
# 1. CREATE RESOURCE GROUP
# ================================================================
Write-Step "1. Creating Resource Group"

$rgExists = az group exists --name $config.ResourceGroup 2>$null
if ($rgExists -eq "true") {
    Write-Warn "Resource group already exists: $($config.ResourceGroup)"
} else {
    az group create --name $config.ResourceGroup --location $config.PrimaryLocation --output none
    Write-Success "Resource group created: $($config.ResourceGroup)"
}

# ================================================================
# 2. CREATE SQL SERVER
# ================================================================
Write-Step "2. Creating SQL Server"

$sqlAdmin = "sqladmin"
if ([string]::IsNullOrEmpty($SqlAdminPassword)) {
    $SqlAdminPassword = Generate-SecurePassword
    Write-Info "Generated SQL Admin Password"
}

if (Test-ResourceExists -ResourceType "SqlServer" -Name $config.SqlServer -ResourceGroup $config.ResourceGroup) {
    Write-Warn "SQL Server already exists: $($config.SqlServer)"
} else {
    Write-SubStep "Creating SQL Server '$($config.SqlServer)' in $($config.SqlLocation)..."
    
    az sql server create `
        --name $config.SqlServer `
        --resource-group $config.ResourceGroup `
        --location $config.SqlLocation `
        --admin-user $sqlAdmin `
        --admin-password $SqlAdminPassword `
        --output none
    
    Write-Success "SQL Server created: $($config.SqlServer).database.windows.net"
}

# Configure firewall rules
Write-SubStep "Configuring firewall rules..."
az sql server firewall-rule create `
    --server $config.SqlServer `
    --resource-group $config.ResourceGroup `
    --name AllowAzureServices `
    --start-ip-address 0.0.0.0 `
    --end-ip-address 0.0.0.0 `
    --output none 2>$null

if ($Environment -ne "prod") {
    az sql server firewall-rule create `
        --server $config.SqlServer `
        --resource-group $config.ResourceGroup `
        --name AllowAllForDev `
        --start-ip-address 0.0.0.0 `
        --end-ip-address 255.255.255.255 `
        --output none 2>$null
    Write-Warn "Dev firewall rule added (all IPs) - Remove for production!"
}
Write-Success "Firewall rules configured"

# ================================================================
# 3. CREATE SQL DATABASE
# ================================================================
Write-Step "3. Creating SQL Database"

$dbExists = az sql db show --name $config.SqlDatabase --server $config.SqlServer --resource-group $config.ResourceGroup 2>$null
if ($dbExists) {
    Write-Warn "SQL Database already exists: $($config.SqlDatabase)"
} else {
    Write-SubStep "Creating SQL Database '$($config.SqlDatabase)' ($($config.SqlSku) tier)..."
    
    az sql db create `
        --name $config.SqlDatabase `
        --server $config.SqlServer `
        --resource-group $config.ResourceGroup `
        --edition $config.SqlSku `
        --output none
    
    Write-Success "SQL Database created: $($config.SqlDatabase)"
}

# ================================================================
# 4. CREATE STORAGE ACCOUNT
# ================================================================
Write-Step "4. Creating Storage Account"

if (Test-ResourceExists -ResourceType "Storage" -Name $config.StorageAccount -ResourceGroup $config.ResourceGroup) {
    Write-Warn "Storage account already exists: $($config.StorageAccount)"
} else {
    Write-SubStep "Creating Storage Account '$($config.StorageAccount)'..."
    
    az storage account create `
        --name $config.StorageAccount `
        --resource-group $config.ResourceGroup `
        --location $config.StorageLocation `
        --sku $config.StorageSku `
        --kind StorageV2 `
        --access-tier Hot `
        --output none
    
    Write-Success "Storage account created: $($config.StorageAccount)"
}

# Get storage key for container creation
$storageKey = az storage account keys list --account-name $config.StorageAccount --resource-group $config.ResourceGroup --query "[0].value" -o tsv

# Create containers
Write-SubStep "Creating storage containers..."
foreach ($container in $storageContainers) {
    az storage container create `
        --name $container `
        --account-name $config.StorageAccount `
        --account-key $storageKey `
        --output none 2>$null
    Write-SubStep "  Container: $container"
}
Write-Success "Storage containers created"

# ================================================================
# 5. CREATE APPLICATION INSIGHTS
# ================================================================
Write-Step "5. Creating Application Insights"

if (Test-ResourceExists -ResourceType "AppInsights" -Name $config.AppInsights -ResourceGroup $config.ResourceGroup) {
    Write-Warn "Application Insights already exists: $($config.AppInsights)"
} else {
    Write-SubStep "Creating Application Insights '$($config.AppInsights)'..."
    
    az monitor app-insights component create `
        --app $config.AppInsights `
        --resource-group $config.ResourceGroup `
        --location $config.FunctionLocation `
        --kind web `
        --output none
    
    Write-Success "Application Insights created"
}

$appInsightsKey = az monitor app-insights component show --app $config.AppInsights --resource-group $config.ResourceGroup --query "instrumentationKey" -o tsv

# ================================================================
# 6. CREATE APP SERVICE PLAN
# ================================================================
Write-Step "6. Creating App Service Plan"

$planExists = az appservice plan show --name $config.AppServicePlan --resource-group $config.ResourceGroup 2>$null
if ($planExists) {
    Write-Warn "App Service Plan already exists: $($config.AppServicePlan)"
} else {
    Write-SubStep "Creating App Service Plan '$($config.AppServicePlan)' ($($config.AppServiceSku))..."
    
    az appservice plan create `
        --name $config.AppServicePlan `
        --resource-group $config.ResourceGroup `
        --location $config.FunctionLocation `
        --sku $config.AppServiceSku `
        --output none
    
    Write-Success "App Service Plan created"
}

# ================================================================
# 7. CREATE FUNCTION APP
# ================================================================
Write-Step "7. Creating Function App"

if (Test-ResourceExists -ResourceType "FunctionApp" -Name $config.FunctionApp -ResourceGroup $config.ResourceGroup) {
    Write-Warn "Function App already exists: $($config.FunctionApp)"
} else {
    Write-SubStep "Creating Function App '$($config.FunctionApp)'..."
    
    az functionapp create `
        --name $config.FunctionApp `
        --resource-group $config.ResourceGroup `
        --storage-account $config.StorageAccount `
        --plan $config.AppServicePlan `
        --runtime node `
        --runtime-version 20 `
        --functions-version 4 `
        --os-type Windows `
        --output none
    
    Write-Success "Function App created: https://$($config.FunctionApp).azurewebsites.net"
}

# Enable managed identity
Write-SubStep "Enabling managed identity..."
$principalId = az functionapp identity assign --name $config.FunctionApp --resource-group $config.ResourceGroup --query "principalId" -o tsv
Write-Success "Managed identity enabled"

# ================================================================
# 8. CREATE STATIC WEB APP
# ================================================================
Write-Step "8. Creating Static Web App"

if (Test-ResourceExists -ResourceType "StaticWebApp" -Name $config.StaticWebApp -ResourceGroup $config.ResourceGroup) {
    Write-Warn "Static Web App already exists: $($config.StaticWebApp)"
} else {
    Write-SubStep "Creating Static Web App '$($config.StaticWebApp)'..."
    
    $swaResult = az staticwebapp create `
        --name $config.StaticWebApp `
        --resource-group $config.ResourceGroup `
        --location $config.StaticWebAppLocation `
        --sku $config.StaticWebAppSku `
        --output json | ConvertFrom-Json
    
    Write-Success "Static Web App created: $($swaResult.defaultHostname)"
}

# ================================================================
# 9. CREATE SIGNALR SERVICE
# ================================================================
Write-Step "9. Creating SignalR Service"

if (Test-ResourceExists -ResourceType "SignalR" -Name $config.SignalR -ResourceGroup $config.ResourceGroup) {
    Write-Warn "SignalR Service already exists: $($config.SignalR)"
} else {
    Write-SubStep "Creating SignalR Service '$($config.SignalR)' ($($config.SignalRSku))..."
    
    az signalr create `
        --name $config.SignalR `
        --resource-group $config.ResourceGroup `
        --location $config.SignalRLocation `
        --sku $config.SignalRSku `
        --service-mode Default `
        --output none
    
    Write-Success "SignalR Service created"
}

# ================================================================
# 10. CREATE COMMUNICATION SERVICES
# ================================================================
Write-Step "10. Creating Communication Services"

if (Test-ResourceExists -ResourceType "ACS" -Name $config.ACS -ResourceGroup $config.ResourceGroup) {
    Write-Warn "Communication Services already exists: $($config.ACS)"
} else {
    Write-SubStep "Creating Communication Services '$($config.ACS)'..."
    
    az communication create `
        --name $config.ACS `
        --resource-group $config.ResourceGroup `
        --location global `
        --data-location India `
        --output none
    
    Write-Success "Communication Services created"
}

# ================================================================
# 11. CREATE EMAIL SERVICE
# ================================================================
Write-Step "11. Creating Email Service"

$emailExists = az communication email show --name $config.EmailService --resource-group $config.ResourceGroup 2>$null
if ($emailExists) {
    Write-Warn "Email Service already exists: $($config.EmailService)"
} else {
    Write-SubStep "Creating Email Service '$($config.EmailService)'..."
    
    az communication email create `
        --name $config.EmailService `
        --resource-group $config.ResourceGroup `
        --location global `
        --data-location India `
        --output none
    
    Write-Success "Email Service created"
}

# Create Azure Managed Domain
Write-SubStep "Creating Azure Managed Domain..."
az communication email domain create `
    --domain-name AzureManagedDomain `
    --email-service-name $config.EmailService `
    --resource-group $config.ResourceGroup `
    --location global `
    --domain-management AzureManaged `
    --output none 2>$null
Write-Success "Email domain created"

# ================================================================
# 12. CREATE KEY VAULT
# ================================================================
Write-Step "12. Creating Key Vault"

if (Test-ResourceExists -ResourceType "KeyVault" -Name $config.KeyVault -ResourceGroup $config.ResourceGroup) {
    Write-Warn "Key Vault already exists: $($config.KeyVault)"
} else {
    Write-SubStep "Creating Key Vault '$($config.KeyVault)'..."
    
    az keyvault create `
        --name $config.KeyVault `
        --resource-group $config.ResourceGroup `
        --location $config.FunctionLocation `
        --enable-rbac-authorization false `
        --output none
    
    Write-Success "Key Vault created"
}

# Grant Function App access to Key Vault
if ($principalId) {
    Write-SubStep "Granting Function App access to Key Vault..."
    az keyvault set-policy `
        --name $config.KeyVault `
        --object-id $principalId `
        --secret-permissions get list `
        --output none
    Write-Success "Key Vault access granted to Function App"
}

# ================================================================
# 13. STORE SECRETS IN KEY VAULT
# ================================================================
if (-not $SkipSecrets) {
    Write-Step "13. Storing Secrets in Key Vault"
    
    # Get connection strings
    $storageConnectionString = az storage account show-connection-string --name $config.StorageAccount --resource-group $config.ResourceGroup --query "connectionString" -o tsv
    $acsConnectionString = az communication list-key --name $config.ACS --resource-group $config.ResourceGroup --query "primaryConnectionString" -o tsv 2>$null
    $sqlConnectionString = "Server=tcp:$($config.SqlServer).database.windows.net,1433;Initial Catalog=$($config.SqlDatabase);Persist Security Info=False;User ID=$sqlAdmin;Password=$SqlAdminPassword;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
    
    # Store secrets
    $secrets = @{
        "SqlPassword" = $SqlAdminPassword
        "AzureStorageAccountKey" = $storageKey
        "AzureStorageConnectionString" = $storageConnectionString
        "DbConnectionString" = $sqlConnectionString
        "JwtSecret" = "$Environment-jwt-secret-refopen-$(Get-Date -Format 'yyyy')-secure"
        "AdminPassword" = "Admin@$(Get-Date -Format 'yyyy')!"
        "AdzunaAppKey" = "placeholder-configure-in-portal"
        "RazorpayKeySecret" = "placeholder-configure-in-portal"
        "RazorpayWebhookSecret" = "placeholder-configure-in-portal"
    }
    
    if ($acsConnectionString) {
        $secrets["AcsConnectionString"] = $acsConnectionString
    }
    
    foreach ($secret in $secrets.GetEnumerator()) {
        az keyvault secret set --vault-name $config.KeyVault --name $secret.Key --value $secret.Value --output none 2>$null
        Write-SubStep "Stored: $($secret.Key)"
    }
    Write-Success "All secrets stored in Key Vault"
}

# ================================================================
# OUTPUT SUMMARY
# ================================================================
$scriptEndTime = Get-Date
$duration = $scriptEndTime - $scriptStartTime

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║           🎉 DEPLOYMENT COMPLETE - $($config.DisplayName.PadRight(25))         ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "⏱️  Duration: $($duration.ToString('mm\:ss'))" -ForegroundColor Gray
Write-Host ""

# Connection info table
Write-Host "┌────────────────────────────────────────────────────────────────────┐" -ForegroundColor Cyan
Write-Host "│  CONNECTION INFORMATION (Save these!)                              │" -ForegroundColor Cyan
Write-Host "└────────────────────────────────────────────────────────────────────┘" -ForegroundColor Cyan
Write-Host ""
Write-Host "SQL Server:" -ForegroundColor Yellow
Write-Host "   Server:   $($config.SqlServer).database.windows.net" -ForegroundColor White
Write-Host "   Database: $($config.SqlDatabase)" -ForegroundColor White
Write-Host "   User:     $sqlAdmin" -ForegroundColor White
Write-Host "   Password: $SqlAdminPassword" -ForegroundColor White
Write-Host ""
Write-Host "Storage Account:" -ForegroundColor Yellow
Write-Host "   Name: $($config.StorageAccount)" -ForegroundColor White
Write-Host ""
Write-Host "Function App:" -ForegroundColor Yellow
Write-Host "   URL: https://$($config.FunctionApp).azurewebsites.net" -ForegroundColor White
Write-Host ""
Write-Host "Static Web App:" -ForegroundColor Yellow
Write-Host "   Name: $($config.StaticWebApp)" -ForegroundColor White
Write-Host ""
Write-Host "Key Vault:" -ForegroundColor Yellow
Write-Host "   Name: $($config.KeyVault)" -ForegroundColor White
Write-Host "   URI:  https://$($config.KeyVault).vault.azure.net/" -ForegroundColor White
Write-Host ""

# Save config to file
$outputFile = ".\env-config.$Environment-infrastructure.json"
$outputConfig = @{
    Environment = $Environment
    CreatedAt = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    ResourceGroup = $config.ResourceGroup
    Resources = @{
        SqlServer = "$($config.SqlServer).database.windows.net"
        SqlDatabase = $config.SqlDatabase
        SqlUser = $sqlAdmin
        StorageAccount = $config.StorageAccount
        FunctionApp = "https://$($config.FunctionApp).azurewebsites.net"
        StaticWebApp = $config.StaticWebApp
        AppInsights = $config.AppInsights
        AppInsightsKey = $appInsightsKey
        SignalR = $config.SignalR
        ACS = $config.ACS
        EmailService = $config.EmailService
        KeyVault = $config.KeyVault
    }
}
$outputConfig | ConvertTo-Json -Depth 5 | Out-File $outputFile -Encoding UTF8
Write-Success "Configuration saved to: $outputFile"

Write-Host ""
Write-Host "┌────────────────────────────────────────────────────────────────────┐" -ForegroundColor Cyan
Write-Host "│  NEXT STEPS                                                        │" -ForegroundColor Cyan
Write-Host "└────────────────────────────────────────────────────────────────────┘" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Run database migrations:" -ForegroundColor White
Write-Host "   sqlcmd -S $($config.SqlServer).database.windows.net -d $($config.SqlDatabase) -U $sqlAdmin -P '$SqlAdminPassword' -i database/migrations/*.sql" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Update .env.$Environment with Key Vault references" -ForegroundColor White
Write-Host ""
Write-Host "3. Deploy backend:" -ForegroundColor White
Write-Host "   .\deploy-backend.ps1 -Environment $Environment" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Deploy frontend:" -ForegroundColor White
Write-Host "   .\deployfe.ps1 -Environment $Environment" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Sync environment variables:" -ForegroundColor White
Write-Host "   .\scripts\deployment\sync-env-variables.ps1 -Environment $Environment" -ForegroundColor Gray
Write-Host ""
