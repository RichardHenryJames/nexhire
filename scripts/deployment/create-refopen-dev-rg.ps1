# ================================================================
# RefOpen DEV Environment Infrastructure Deployment Script
# ================================================================
# Creates refopen-dev-rg with the same resources as refopen-prod-rg
# Uses cost-optimized tiers suitable for development
# ================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroupName = "refopen-dev-rg",

    [Parameter(Mandatory=$false)]
    [string]$Location = "southindia",

    [Parameter(Mandatory=$false)]
    [string]$SubscriptionId = "44027c71-593a-4d51-977b-ab0604cb76eb",

    [Parameter(Mandatory=$false)]
    [string]$TenantId = "b197fdbb-0630-4a71-9626-ec81c3355204",

    [Parameter(Mandatory=$false)]
    [switch]$SkipConfirmation
)

# ================================================================
# RESOURCE NAMING (dev suffix)
# ================================================================
$sqlServerName = "refopen-sqlserver-dev"
$sqlDatabaseName = "refopen-sql-db-dev"
$storageAccountName = "refopenstoragedev"  # No hyphens, max 24 chars
$functionAppName = "refopen-api-func-dev"
$staticWebAppName = "refopen-frontend-dev"
$appInsightsName = "refopen-monitor-dev"
$signalRName = "refopen-signalr-dev"
$acsName = "refopen-acs-dev"
$emailServiceName = "refopen-email-dev"
$keyVaultName = "refopen-kv-dev"
$appServicePlanName = "DevIndiaPlan"

# Locations (matching prod constraints)
$sqlLocation = "centralindia"        # SQL must be in Central India
$functionLocation = "centralindia"   # Functions same region as SQL
$staticWebAppLocation = "eastasia"   # Static Web Apps limited regions
$signalRLocation = "eastus"          # SignalR limited regions
$storageLocation = "southindia"      # Storage in resource group region

# ================================================================
# COST-OPTIMIZED SKUs for Development
# ================================================================
$skus = @{
    SqlDatabase = "Basic"             # ~$5/month (vs Standard S0 ~$15)
    Storage = "Standard_LRS"          # Cheapest storage replication
    FunctionApp = "Y1"                # Consumption plan (pay per use)
    AppServicePlan = "B1"             # Basic tier ~$13/month
    SignalR = "Free_F1"               # Free tier (20 connections, 20K msgs/day)
    StaticWebApp = "Free"             # Free tier
    AppInsights = "Basic"             # Basic tier
}

# Color functions
function Write-Success { param([string]$Message) Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Info { param([string]$Message) Write-Host "ℹ $Message" -ForegroundColor Cyan }
function Write-Warning { param([string]$Message) Write-Host "⚠ $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message) Write-Host "✗ $Message" -ForegroundColor Red }
function Write-Step { param([string]$Message) Write-Host "`n=== $Message ===" -ForegroundColor Magenta }

# ================================================================
# HEADER
# ================================================================
Write-Host "`n" -NoNewline
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       RefOpen DEV Environment Infrastructure Deployment      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Info "Resource Group: $ResourceGroupName"
Write-Info "Primary Location: $Location"
Write-Info "Subscription: $SubscriptionId"
Write-Host ""

# ================================================================
# RESOURCE SUMMARY
# ================================================================
Write-Host "┌─────────────────────────────────────────────────────────────────┐" -ForegroundColor Gray
Write-Host "│ Resources to Create (matching refopen-prod-rg)                  │" -ForegroundColor Gray
Write-Host "├─────────────────────────────────────────────────────────────────┤" -ForegroundColor Gray
Write-Host "│ 1. SQL Server + Database      ($sqlLocation)              │" -ForegroundColor White
Write-Host "│ 2. Storage Account            ($storageLocation)              │" -ForegroundColor White
Write-Host "│ 3. Function App + Plan        ($functionLocation)              │" -ForegroundColor White
Write-Host "│ 4. Static Web App             ($staticWebAppLocation)                     │" -ForegroundColor White
Write-Host "│ 5. Application Insights       ($functionLocation)              │" -ForegroundColor White
Write-Host "│ 6. SignalR Service            ($signalRLocation)                       │" -ForegroundColor White
Write-Host "│ 7. Communication Services     (global)                        │" -ForegroundColor White
Write-Host "│ 8. Email Services             (global)                        │" -ForegroundColor White
Write-Host "│ 9. Key Vault                  ($functionLocation)              │" -ForegroundColor White
Write-Host "└─────────────────────────────────────────────────────────────────┘" -ForegroundColor Gray

# ================================================================
# ESTIMATED COSTS
# ================================================================
Write-Host ""
Write-Host "┌─────────────────────────────────────────────────────────────────┐" -ForegroundColor Yellow
Write-Host "│ Estimated Monthly Cost (Dev SKUs)                               │" -ForegroundColor Yellow
Write-Host "├─────────────────────────────────────────────────────────────────┤" -ForegroundColor Yellow
Write-Host "│ SQL Database (Basic 5 DTU)     ≈ `$5/month                      │" -ForegroundColor White
Write-Host "│ Storage (LRS, ~10GB)           ≈ `$1/month                      │" -ForegroundColor White
Write-Host "│ Function App (Consumption)     ≈ `$0-5/month (pay per use)     │" -ForegroundColor White
Write-Host "│ App Service Plan (B1)          ≈ `$13/month                     │" -ForegroundColor White
Write-Host "│ SignalR (Free)                 ≈ `$0/month                      │" -ForegroundColor White
Write-Host "│ Static Web App (Free)          ≈ `$0/month                      │" -ForegroundColor White
Write-Host "│ App Insights (~5GB)            ≈ `$2/month                      │" -ForegroundColor White
Write-Host "│ Communication Services         ≈ Pay per use                   │" -ForegroundColor White
Write-Host "│ Key Vault                      ≈ `$0.03/10K operations          │" -ForegroundColor White
Write-Host "├─────────────────────────────────────────────────────────────────┤" -ForegroundColor Yellow
Write-Host "│ TOTAL ESTIMATED                ≈ `$20-25/month                  │" -ForegroundColor Green
Write-Host "└─────────────────────────────────────────────────────────────────┘" -ForegroundColor Yellow

# ================================================================
# CONFIRMATION
# ================================================================
if (-not $SkipConfirmation) {
    Write-Host ""
    Write-Warning "This will create Azure resources that incur costs!"
    $confirm = Read-Host "Continue with deployment? (Y/N)"
    if ($confirm -notmatch '^[Yy]') {
        Write-Info "Deployment cancelled by user"
        exit 0
    }
}

# ================================================================
# AZURE LOGIN CHECK
# ================================================================
Write-Step "Checking Azure Login"

try {
    $context = Get-AzContext -ErrorAction SilentlyContinue
    
    if (-not $context -or $context.Subscription.Id -ne $SubscriptionId) {
        Write-Warning "Not logged in or wrong subscription. Logging in..."
        Connect-AzAccount -TenantId $TenantId -SubscriptionId $SubscriptionId -ErrorAction Stop | Out-Null
        $context = Get-AzContext
    }
    
    Write-Success "Logged in as: $($context.Account.Id)"
    Write-Success "Subscription: $($context.Subscription.Name)"
} catch {
    Write-Error "Failed to connect to Azure: $_"
    exit 1
}

# ================================================================
# CREATE RESOURCE GROUP
# ================================================================
Write-Step "1. Creating Resource Group"

try {
    $rg = Get-AzResourceGroup -Name $ResourceGroupName -ErrorAction SilentlyContinue
    if ($rg) {
        Write-Warning "Resource group '$ResourceGroupName' already exists"
    } else {
        $rg = New-AzResourceGroup -Name $ResourceGroupName -Location $Location -Tag @{
            Environment = "Development"
            Project = "RefOpen"
            CreatedBy = "Automation"
            CreatedDate = (Get-Date -Format "yyyy-MM-dd")
        }
        Write-Success "Resource group created: $ResourceGroupName"
    }
} catch {
    Write-Error "Failed to create resource group: $_"
    exit 1
}

# ================================================================
# SQL ADMIN CREDENTIALS
# ================================================================
Write-Step "2. SQL Server Credentials"

$sqlAdminUser = "sqladmin"
Write-Info "SQL Admin Username: $sqlAdminUser"

# Generate a secure random password
$passwordChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
$sqlAdminPasswordPlain = -join ((1..16) | ForEach-Object { $passwordChars[(Get-Random -Maximum $passwordChars.Length)] })
# Ensure it meets Azure requirements
$sqlAdminPasswordPlain = "RefOpenDev@2024!" + $sqlAdminPasswordPlain.Substring(0,8)
$sqlAdminPassword = ConvertTo-SecureString $sqlAdminPasswordPlain -AsPlainText -Force

Write-Success "Generated secure SQL password"
Write-Warning "SAVE THIS PASSWORD: $sqlAdminPasswordPlain"

# ================================================================
# CREATE SQL SERVER
# ================================================================
Write-Step "3. Creating SQL Server"

try {
    $sqlServer = Get-AzSqlServer -ResourceGroupName $ResourceGroupName -ServerName $sqlServerName -ErrorAction SilentlyContinue
    if ($sqlServer) {
        Write-Warning "SQL Server '$sqlServerName' already exists"
    } else {
        Write-Info "Creating SQL Server '$sqlServerName' in $sqlLocation..."
        $sqlServer = New-AzSqlServer `
            -ResourceGroupName $ResourceGroupName `
            -ServerName $sqlServerName `
            -Location $sqlLocation `
            -SqlAdministratorCredentials (New-Object PSCredential($sqlAdminUser, $sqlAdminPassword))
        Write-Success "SQL Server created: $($sqlServer.FullyQualifiedDomainName)"
    }

    # Firewall rules
    Write-Info "Configuring firewall rules..."
    
    # Allow Azure services
    $null = New-AzSqlServerFirewallRule -ResourceGroupName $ResourceGroupName -ServerName $sqlServerName `
        -FirewallRuleName "AllowAzureServices" -StartIpAddress "0.0.0.0" -EndIpAddress "0.0.0.0" -ErrorAction SilentlyContinue
    Write-Success "Azure services firewall rule configured"

    # Allow all IPs for dev
    $null = New-AzSqlServerFirewallRule -ResourceGroupName $ResourceGroupName -ServerName $sqlServerName `
        -FirewallRuleName "AllowAllForDev" -StartIpAddress "0.0.0.0" -EndIpAddress "255.255.255.255" -ErrorAction SilentlyContinue
    Write-Warning "Dev firewall rule added (all IPs) - Remove in production!"

} catch {
    Write-Error "Failed to create SQL Server: $_"
}

# ================================================================
# CREATE SQL DATABASE
# ================================================================
Write-Step "4. Creating SQL Database"

try {
    $sqlDb = Get-AzSqlDatabase -ResourceGroupName $ResourceGroupName -ServerName $sqlServerName -DatabaseName $sqlDatabaseName -ErrorAction SilentlyContinue
    if ($sqlDb -and $sqlDb.DatabaseName -ne "master") {
        Write-Warning "SQL Database '$sqlDatabaseName' already exists"
    } else {
        Write-Info "Creating SQL Database '$sqlDatabaseName' (Basic tier)..."
        $sqlDb = New-AzSqlDatabase `
            -ResourceGroupName $ResourceGroupName `
            -ServerName $sqlServerName `
            -DatabaseName $sqlDatabaseName `
            -Edition "Basic" `
            -RequestedServiceObjectiveName "Basic" `
            -MaxSizeBytes 2147483648  # 2GB
        Write-Success "SQL Database created: $sqlDatabaseName"
    }
} catch {
    Write-Error "Failed to create SQL Database: $_"
}

# ================================================================
# CREATE STORAGE ACCOUNT
# ================================================================
Write-Step "5. Creating Storage Account"

try {
    $storage = Get-AzStorageAccount -ResourceGroupName $ResourceGroupName -Name $storageAccountName -ErrorAction SilentlyContinue
    if ($storage) {
        Write-Warning "Storage account '$storageAccountName' already exists"
    } else {
        Write-Info "Creating Storage Account '$storageAccountName'..."
        $storage = New-AzStorageAccount `
            -ResourceGroupName $ResourceGroupName `
            -Name $storageAccountName `
            -Location $storageLocation `
            -SkuName "Standard_LRS" `
            -Kind "StorageV2" `
            -AccessTier "Hot" `
            -AllowBlobPublicAccess $true
        Write-Success "Storage account created: $storageAccountName"
    }

    # Create containers
    $ctx = $storage.Context
    $containers = @("refopen-files", "documents", "profile-images", "resumes", "referral-proofs", "company-logos", "archived-jobs")
    foreach ($container in $containers) {
        $null = New-AzStorageContainer -Name $container -Context $ctx -Permission Off -ErrorAction SilentlyContinue
        Write-Info "  Container: $container"
    }
    Write-Success "Storage containers created"

} catch {
    Write-Error "Failed to create Storage Account: $_"
}

# ================================================================
# CREATE APPLICATION INSIGHTS
# ================================================================
Write-Step "6. Creating Application Insights"

try {
    $appInsights = Get-AzApplicationInsights -ResourceGroupName $ResourceGroupName -Name $appInsightsName -ErrorAction SilentlyContinue
    if ($appInsights) {
        Write-Warning "Application Insights '$appInsightsName' already exists"
    } else {
        Write-Info "Creating Application Insights '$appInsightsName'..."
        $appInsights = New-AzApplicationInsights `
            -ResourceGroupName $ResourceGroupName `
            -Name $appInsightsName `
            -Location $functionLocation `
            -Kind "web"
        Write-Success "Application Insights created"
        Write-Info "  Instrumentation Key: $($appInsights.InstrumentationKey)"
    }
} catch {
    Write-Error "Failed to create Application Insights: $_"
}

# ================================================================
# CREATE APP SERVICE PLAN
# ================================================================
Write-Step "7. Creating App Service Plan"

try {
    $plan = Get-AzAppServicePlan -ResourceGroupName $ResourceGroupName -Name $appServicePlanName -ErrorAction SilentlyContinue
    if ($plan) {
        Write-Warning "App Service Plan '$appServicePlanName' already exists"
    } else {
        Write-Info "Creating App Service Plan '$appServicePlanName' (B1 Basic)..."
        $plan = New-AzAppServicePlan `
            -ResourceGroupName $ResourceGroupName `
            -Name $appServicePlanName `
            -Location $functionLocation `
            -Tier "Basic" `
            -WorkerSize "Small" `
            -NumberofWorkers 1
        Write-Success "App Service Plan created"
    }
} catch {
    Write-Error "Failed to create App Service Plan: $_"
}

# ================================================================
# CREATE FUNCTION APP
# ================================================================
Write-Step "8. Creating Function App"

try {
    $funcApp = Get-AzFunctionApp -ResourceGroupName $ResourceGroupName -Name $functionAppName -ErrorAction SilentlyContinue
    if ($funcApp) {
        Write-Warning "Function App '$functionAppName' already exists"
    } else {
        Write-Info "Creating Function App '$functionAppName'..."
        
        # Get storage connection string
        $storageKeys = Get-AzStorageAccountKey -ResourceGroupName $ResourceGroupName -Name $storageAccountName
        $storageConnectionString = "DefaultEndpointsProtocol=https;AccountName=$storageAccountName;AccountKey=$($storageKeys[0].Value);EndpointSuffix=core.windows.net"
        
        $funcApp = New-AzFunctionApp `
            -ResourceGroupName $ResourceGroupName `
            -Name $functionAppName `
            -Location $functionLocation `
            -StorageAccountName $storageAccountName `
            -Runtime "node" `
            -RuntimeVersion "20" `
            -FunctionsVersion 4 `
            -OSType "Windows" `
            -PlanName $appServicePlanName
        
        Write-Success "Function App created: https://$functionAppName.azurewebsites.net"
    }
} catch {
    Write-Error "Failed to create Function App: $_"
}

# ================================================================
# CREATE STATIC WEB APP
# ================================================================
Write-Step "9. Creating Static Web App"

try {
    # Use Azure CLI for Static Web Apps (better support)
    $staticApp = az staticwebapp show --name $staticWebAppName --resource-group $ResourceGroupName 2>$null | ConvertFrom-Json
    if ($staticApp) {
        Write-Warning "Static Web App '$staticWebAppName' already exists"
    } else {
        Write-Info "Creating Static Web App '$staticWebAppName'..."
        az staticwebapp create `
            --name $staticWebAppName `
            --resource-group $ResourceGroupName `
            --location $staticWebAppLocation `
            --sku Free 2>$null
        Write-Success "Static Web App created"
    }
} catch {
    Write-Warning "Static Web App creation via CLI - check Azure portal if needed"
}

# ================================================================
# CREATE SIGNALR SERVICE
# ================================================================
Write-Step "10. Creating SignalR Service"

try {
    $signalR = az signalr show --name $signalRName --resource-group $ResourceGroupName 2>$null | ConvertFrom-Json
    if ($signalR) {
        Write-Warning "SignalR Service '$signalRName' already exists"
    } else {
        Write-Info "Creating SignalR Service '$signalRName' (Free tier)..."
        az signalr create `
            --name $signalRName `
            --resource-group $ResourceGroupName `
            --location $signalRLocation `
            --sku Free_F1 `
            --service-mode Default 2>$null
        Write-Success "SignalR Service created (Free tier)"
    }
} catch {
    Write-Warning "SignalR creation via CLI - check Azure portal if needed"
}

# ================================================================
# CREATE COMMUNICATION SERVICES
# ================================================================
Write-Step "11. Creating Communication Services"

try {
    $acs = az communication show --name $acsName --resource-group $ResourceGroupName 2>$null | ConvertFrom-Json
    if ($acs) {
        Write-Warning "Communication Services '$acsName' already exists"
    } else {
        Write-Info "Creating Communication Services '$acsName'..."
        az communication create `
            --name $acsName `
            --resource-group $ResourceGroupName `
            --location global `
            --data-location "India" 2>$null
        Write-Success "Communication Services created"
    }
} catch {
    Write-Warning "Communication Services creation via CLI - check Azure portal if needed"
}

# ================================================================
# CREATE EMAIL SERVICE
# ================================================================
Write-Step "12. Creating Email Service"

try {
    # Email services require special handling
    Write-Info "Creating Email Service '$emailServiceName'..."
    az communication email create `
        --name $emailServiceName `
        --resource-group $ResourceGroupName `
        --location global `
        --data-location "India" 2>$null
    Write-Success "Email Service created"
    Write-Warning "NOTE: You'll need to configure email domains in Azure Portal"
} catch {
    Write-Warning "Email Service - configure manually in Azure Portal if needed"
}

# ================================================================
# CREATE KEY VAULT
# ================================================================
Write-Step "13. Creating Key Vault"

try {
    $keyVault = Get-AzKeyVault -ResourceGroupName $ResourceGroupName -VaultName $keyVaultName -ErrorAction SilentlyContinue
    if ($keyVault) {
        Write-Warning "Key Vault '$keyVaultName' already exists"
    } else {
        Write-Info "Creating Key Vault '$keyVaultName'..."
        $keyVault = New-AzKeyVault `
            -ResourceGroupName $ResourceGroupName `
            -VaultName $keyVaultName `
            -Location $functionLocation `
            -Sku "Standard" `
            -EnabledForDeployment `
            -EnabledForTemplateDeployment
        Write-Success "Key Vault created"
    }
} catch {
    Write-Error "Failed to create Key Vault: $_"
}

# ================================================================
# OUTPUT SUMMARY
# ================================================================
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║           DEV Environment Deployment Complete!               ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Get connection strings
$storageKeys = Get-AzStorageAccountKey -ResourceGroupName $ResourceGroupName -Name $storageAccountName -ErrorAction SilentlyContinue
$storageKey = if ($storageKeys) { $storageKeys[0].Value } else { "CHECK_PORTAL" }
$appInsightsKey = if ($appInsights) { $appInsights.InstrumentationKey } else { "CHECK_PORTAL" }
$appInsightsConn = if ($appInsights) { $appInsights.ConnectionString } else { "CHECK_PORTAL" }

Write-Host "┌─────────────────────────────────────────────────────────────────┐" -ForegroundColor Cyan
Write-Host "│ CONNECTION STRINGS (Save these!)                                │" -ForegroundColor Cyan
Write-Host "└─────────────────────────────────────────────────────────────────┘" -ForegroundColor Cyan
Write-Host ""
Write-Host "SQL Server:" -ForegroundColor Yellow
Write-Host "  Server: $sqlServerName.database.windows.net"
Write-Host "  Database: $sqlDatabaseName"
Write-Host "  User: $sqlAdminUser"
Write-Host "  Password: $sqlAdminPasswordPlain"
Write-Host ""
Write-Host "Storage Account:" -ForegroundColor Yellow
Write-Host "  Name: $storageAccountName"
Write-Host "  Key: $storageKey"
Write-Host ""
Write-Host "App Insights:" -ForegroundColor Yellow
Write-Host "  Key: $appInsightsKey"
Write-Host ""
Write-Host "Function App:" -ForegroundColor Yellow
Write-Host "  URL: https://$functionAppName.azurewebsites.net"
Write-Host ""
Write-Host "Static Web App:" -ForegroundColor Yellow
Write-Host "  Name: $staticWebAppName"
Write-Host ""

# Save config to file
$config = @{
    Environment = "development"
    ResourceGroup = $ResourceGroupName
    Location = $Location
    CreatedDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    Resources = @{
        SqlServer = "$sqlServerName.database.windows.net"
        SqlDatabase = $sqlDatabaseName
        SqlUser = $sqlAdminUser
        SqlPassword = $sqlAdminPasswordPlain
        StorageAccount = $storageAccountName
        StorageKey = $storageKey
        FunctionApp = $functionAppName
        StaticWebApp = $staticWebAppName
        AppInsightsKey = $appInsightsKey
        SignalR = $signalRName
        KeyVault = $keyVaultName
    }
}

$configPath = ".\env-config.dev-infrastructure.json"
$config | ConvertTo-Json -Depth 5 | Out-File $configPath -Encoding UTF8
Write-Success "Configuration saved to: $configPath"

Write-Host ""
Write-Host "┌─────────────────────────────────────────────────────────────────┐" -ForegroundColor Yellow
Write-Host "│ NEXT STEPS                                                      │" -ForegroundColor Yellow
Write-Host "└─────────────────────────────────────────────────────────────────┘" -ForegroundColor Yellow
Write-Host "1. Run database migrations against the new SQL Server"
Write-Host "2. Update .env.dev with the new connection strings"
Write-Host "3. Configure email domain in Azure Portal (Communication Services)"
Write-Host "4. Deploy backend: .\deploy-backend.ps1 -Environment dev"
Write-Host "5. Deploy frontend: .\deployfe.ps1 -Environment dev"
Write-Host ""
