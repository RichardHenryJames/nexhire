# RefOpen Infrastructure Deployment Script
# Successfully tested and working version
# Author: RefOpen Team
# Version: 2.0 - WORKING VERSION

param(
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroupName = "refopen-prod-rg",

    [Parameter(Mandatory=$false)]
    [string]$Location = "southindia",

    [Parameter(Mandatory=$false)]
    [string]$UserEmail = "parimalkumar@outlook.com",

    [Parameter(Mandatory=$false)]
    [string]$SubscriptionId = "44027c71-593a-4d51-977b-ab0604cb76eb",

    [Parameter(Mandatory=$false)]
    [string]$TenantId = "b197fdbb-0630-4a71-9626-ec81c3355204"
)

# Color functions for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

Write-Info "=========================================="
Write-Info "RefOpen Infrastructure Deployment"
Write-Info "Resource Group: $ResourceGroupName"
Write-Info "Location: $Location"
Write-Info "User: $UserEmail"
Write-Info "=========================================="

# Check if logged in to Azure with proper MFA authentication
Write-Info "`nChecking Azure login status..."
try {
    $context = Get-AzContext -ErrorAction SilentlyContinue
    
    if (-not $context -or $context.Subscription.Id -ne $SubscriptionId) {
        Write-Warning "Not logged in or wrong subscription. Logging in..."
        Write-Info "Browser will open for MFA authentication..."
        
        # Clear any problematic context
        Clear-AzContext -Force -ErrorAction SilentlyContinue | Out-Null
        
        # Connect with Tenant ID for MFA support
        Connect-AzAccount -TenantId $TenantId -SubscriptionId $SubscriptionId -ErrorAction Stop | Out-Null
        $context = Get-AzContext
    }
    
    Write-Success "`n✓ Successfully logged in!"
    Write-Success "  Account: $($context.Account.Id)"
    Write-Success "  Subscription: $($context.Subscription.Name)"
    Write-Success "  Subscription ID: $($context.Subscription.Id)"
    Write-Success "  Tenant: $($context.Tenant.Id)"
    
} catch {
    Write-Error "Failed to connect to Azure: $_"
    Write-Info "`nPlease run the manual login script first:"
    Write-Info "  .\manual-login-refopen.ps1"
    exit 1
}

# Verify resource group exists
Write-Info "`nVerifying resource group..."
try {
    $rg = Get-AzResourceGroup -Name $ResourceGroupName -ErrorAction Stop
    Write-Success "✓ Resource group '$ResourceGroupName' found"
    Write-Info "  Location: $($rg.Location)"
    Write-Info "  Provisioning State: $($rg.ProvisioningState)"
    
    # Show existing resources
    $existingResources = Get-AzResource -ResourceGroupName $ResourceGroupName
    if ($existingResources.Count -gt 0) {
        Write-Info "  Existing resources: $($existingResources.Count)"
        foreach ($resource in $existingResources) {
            Write-Info "    - $($resource.Name) ($($resource.ResourceType))"
        }
    } else {
        Write-Info "  No existing resources (clean deployment)"
    }
} catch {
    Write-Error "Resource group '$ResourceGroupName' not found!"
    Write-Info "`nCreate it first with:"
    Write-Info "  New-AzResourceGroup -Name '$ResourceGroupName' -Location '$Location'"
    exit 1
}

# Resource names
$sqlServerName = "refopen-sqlserver-ci"  # Changed to unique name
$sqlDatabaseName = "refopen-sql-db"
$storageAccountName = "refopenstoragesi"
$functionAppName = "refopen-api-func"
$staticWebAppName = "refopen-frontend-web"
$appInsightsName = "refopen-monitor"

# IMPORTANT: SQL Server and Functions must use Central India (South India doesn't support SQL)
$sqlLocation = "centralindia"
$functionLocation = "centralindia"
$staticWebAppLocation = "eastasia"  # Static Web Apps have limited regions

Write-Info "`nResource names:"
Write-Info "  SQL Server: $sqlServerName (Location: $sqlLocation)"
Write-Info "  SQL Database: $sqlDatabaseName"
Write-Info "  Storage: $storageAccountName (Location: $Location)"
Write-Info "  Function App: $functionAppName (Location: $functionLocation)"
Write-Info "  Static Web App: $staticWebAppName (Location: $staticWebAppLocation)"
Write-Info "  App Insights: $appInsightsName (Location: $sqlLocation)"

Write-Warning "`n⚠️  IMPORTANT NOTES:"
Write-Warning "  - SQL Server uses Central India (South India doesn't support SQL)"
Write-Warning "  - Function App uses Central India (same region as SQL)"
Write-Warning "  - Static Web App uses East Asia (limited region availability)"
Write-Warning "  - Storage Account uses South India (resource group location)"

# Confirm before proceeding
Write-Warning "`n⚠️  About to create Azure resources that may incur costs!"
$confirm = Read-Host "Continue with deployment? (Y/N)"
if ($confirm -ne 'Y' -and $confirm -ne 'y') {
    Write-Info "Deployment cancelled by user"
    exit 0
}

# SQL Admin credentials
$sqlAdminUser = "sqladmin"
Write-Info "`nSQL Admin Username: $sqlAdminUser"
$sqlAdminPassword = Read-Host "Enter SQL Admin Password (min 8 chars, uppercase, lowercase, number, special char)" -AsSecureString
$sqlAdminPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sqlAdminPassword))

# Validate password strength
if ($sqlAdminPasswordPlain.Length -lt 8) {
    Write-Error "Password must be at least 8 characters long!"
    exit 1
}

# Generate JWT secret for application
$jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})

Write-Info "`n=========================================="
Write-Info "Starting Resource Deployment"
Write-Info "=========================================="

#region SQL Server and Database
Write-Info "`n=== [1/6] Creating SQL Server ==="
try {
    $sqlServer = Get-AzSqlServer -ResourceGroupName $ResourceGroupName -ServerName $sqlServerName -ErrorAction SilentlyContinue
    if ($sqlServer) {
        Write-Warning "SQL Server '$sqlServerName' already exists"
        Write-Info "  FQDN: $($sqlServer.FullyQualifiedDomainName)"
    } else {
        Write-Info "Creating SQL Server '$sqlServerName' in Central India..."
        $sqlServer = New-AzSqlServer `
            -ResourceGroupName $ResourceGroupName `
            -ServerName $sqlServerName `
            -Location $sqlLocation `
            -SqlAdministratorCredentials (New-Object System.Management.Automation.PSCredential($sqlAdminUser, $sqlAdminPassword))
        Write-Success "✓ SQL Server created: $($sqlServer.FullyQualifiedDomainName)"
    }
} catch {
    Write-Error "Failed to create SQL Server: $_"
    exit 1
}

Write-Info "`nConfiguring SQL Server firewall rules..."
try {
    # Allow Azure services
    $azureRule = Get-AzSqlServerFirewallRule -ResourceGroupName $ResourceGroupName -ServerName $sqlServerName -FirewallRuleName "AllowAzureServices" -ErrorAction SilentlyContinue
    if (-not $azureRule) {
        New-AzSqlServerFirewallRule `
            -ResourceGroupName $ResourceGroupName `
            -ServerName $sqlServerName `
            -FirewallRuleName "AllowAzureServices" `
            -StartIpAddress "0.0.0.0" `
            -EndIpAddress "0.0.0.0" | Out-Null
        Write-Success "  ✓ Azure services firewall rule added"
    } else {
        Write-Info "  ✓ Azure services rule already exists"
    }

    # Allow all IPs (for development - REMOVE IN PRODUCTION)
    $allRule = Get-AzSqlServerFirewallRule -ResourceGroupName $ResourceGroupName -ServerName $sqlServerName -FirewallRuleName "AllowAll" -ErrorAction SilentlyContinue
    if (-not $allRule) {
        New-AzSqlServerFirewallRule `
            -ResourceGroupName $ResourceGroupName `
            -ServerName $sqlServerName `
            -FirewallRuleName "AllowAll" `
            -StartIpAddress "0.0.0.0" `
            -EndIpAddress "255.255.255.255" | Out-Null
        Write-Success "  ✓ Development firewall rule added (all IPs)"
        Write-Warning "  ⚠ SECURITY: Remove this rule after initial setup!"
    } else {
        Write-Info "  ✓ Development rule already exists"
    }
} catch {
    Write-Error "Failed to configure firewall: $_"
}

Write-Info "`nCreating SQL Database..."
try {
    $db = Get-AzSqlDatabase -ResourceGroupName $ResourceGroupName -ServerName $sqlServerName -DatabaseName $sqlDatabaseName -ErrorAction SilentlyContinue
    if ($db -and $db.DatabaseName -ne "master") {
        Write-Warning "Database '$sqlDatabaseName' already exists"
    } else {
        Write-Info "Creating database '$sqlDatabaseName' (Basic tier)..."
        $db = New-AzSqlDatabase `
            -ResourceGroupName $ResourceGroupName `
            -ServerName $sqlServerName `
            -DatabaseName $sqlDatabaseName `
            -Edition "Basic" `
            -RequestedServiceObjectiveName "Basic"
        Write-Success "✓ SQL Database created: $sqlDatabaseName"
    }
} catch {
    Write-Error "Failed to create database: $_"
    exit 1
}
#endregion

#region Storage Account
Write-Info "`n=== [2/6] Creating Storage Account ==="
try {
    $storage = Get-AzStorageAccount -ResourceGroupName $ResourceGroupName -Name $storageAccountName -ErrorAction SilentlyContinue
    if ($storage) {
        Write-Warning "Storage account '$storageAccountName' already exists"
    } else {
        Write-Info "Creating storage account '$storageAccountName' in $Location..."
        $storage = New-AzStorageAccount `
            -ResourceGroupName $ResourceGroupName `
            -Name $storageAccountName `
            -Location $Location `
            -SkuName "Standard_LRS" `
            -Kind "StorageV2" `
            -AllowBlobPublicAccess $true
        Write-Success "✓ Storage account created"
    }

    # Create blob containers
    Write-Info "Creating blob containers..."
    $ctx = $storage.Context
    $containers = @(
        @{Name="resumes"; Access="Blob"},
        @{Name="profile-images"; Access="Blob"},
        @{Name="referral-proofs"; Access="Blob"},
        @{Name="documents"; Access="Blob"},
        @{Name="company-logos"; Access="Blob"}
    )
    
    foreach ($container in $containers) {
        $existing = Get-AzStorageContainer -Name $container.Name -Context $ctx -ErrorAction SilentlyContinue
        if (-not $existing) {
            New-AzStorageContainer -Name $container.Name -Context $ctx -Permission $container.Access | Out-Null
            Write-Success "  ✓ Container '$($container.Name)' created"
        } else {
            Write-Info "  ✓ Container '$($container.Name)' already exists"
        }
    }
    
    # Get storage connection string
    $storageKeys = Get-AzStorageAccountKey -ResourceGroupName $ResourceGroupName -Name $storageAccountName
    $storageConnectionString = "DefaultEndpointsProtocol=https;AccountName=$storageAccountName;AccountKey=$($storageKeys[0].Value);EndpointSuffix=core.windows.net"
    
} catch {
    Write-Error "Failed to create storage: $_"
    exit 1
}
#endregion

#region Application Insights
Write-Info "`n=== [3/6] Creating Application Insights ==="
try {
    $appInsights = Get-AzApplicationInsights -ResourceGroupName $ResourceGroupName -Name $appInsightsName -ErrorAction SilentlyContinue
    if ($appInsights) {
        Write-Warning "Application Insights '$appInsightsName' already exists"
    } else {
        Write-Info "Creating Application Insights '$appInsightsName' in Central India..."
        $appInsights = New-AzApplicationInsights `
            -ResourceGroupName $ResourceGroupName `
            -Name $appInsightsName `
            -Location $sqlLocation `
            -Kind "web"
        Write-Success "✓ Application Insights created"
    }
} catch {
    Write-Error "Failed to create Application Insights: $_"
    Write-Warning "Continuing without Application Insights..."
    $appInsights = $null
}
#endregion

#region Function App
Write-Info "`n=== [4/6] Creating Function App ==="
try {
    $funcApp = Get-AzFunctionApp -ResourceGroupName $ResourceGroupName -Name $functionAppName -ErrorAction SilentlyContinue
    if ($funcApp) {
        Write-Warning "Function App '$functionAppName' already exists"
    } else {
        Write-Info "Creating Function App '$functionAppName' in Central India..."
        Write-Info "  Runtime: Node.js 20"
        Write-Info "  Functions Version: 4"

        # Create Function App
        $funcApp = New-AzFunctionApp `
            -ResourceGroupName $ResourceGroupName `
            -Name $functionAppName `
            -StorageAccountName $storageAccountName `
            -Location $functionLocation `
            -Runtime "node" `
            -RuntimeVersion "20" `
            -FunctionsVersion "4" `
            -OSType "Windows"

        Write-Success "✓ Function App created: https://$functionAppName.azurewebsites.net"
    }

    # Configure app settings
    Write-Info "Configuring Function App settings..."
    $connectionString = "Server=tcp:$sqlServerName.database.windows.net,1433;Initial Catalog=$sqlDatabaseName;User ID=$sqlAdminUser;Password=$sqlAdminPasswordPlain;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

    $appSettings = @{
        "DB_SERVER" = "$sqlServerName.database.windows.net"
        "DB_NAME" = $sqlDatabaseName
        "DB_USER" = $sqlAdminUser
        "DB_PASSWORD" = $sqlAdminPasswordPlain
        "DB_CONNECTION_STRING" = $connectionString
        "AZURE_STORAGE_ACCOUNT_NAME" = $storageAccountName
        "AZURE_STORAGE_CONNECTION_STRING" = $storageConnectionString
        "JWT_SECRET" = $jwtSecret
        "JWT_EXPIRES_IN" = "15m"
        "JWT_REFRESH_EXPIRES_IN" = "7d"
        "NODE_ENV" = "production"
        "WEBSITE_NODE_DEFAULT_VERSION" = "~20"
        "FUNCTIONS_WORKER_RUNTIME" = "node"
        "FUNCTIONS_EXTENSION_VERSION" = "~4"
        "WEBSITE_RUN_FROM_PACKAGE" = "1"
    }
    
    # Add Application Insights if available
    if ($appInsights) {
        $appSettings["APPINSIGHTS_INSTRUMENTATIONKEY"] = $appInsights.InstrumentationKey
        $appSettings["APPLICATIONINSIGHTS_CONNECTION_STRING"] = $appInsights.ConnectionString
    }

    Update-AzFunctionAppSetting -ResourceGroupName $ResourceGroupName -Name $functionAppName -AppSetting $appSettings -Force | Out-Null
    Write-Success "  ✓ Function App configured with $($appSettings.Count) settings"

    # Configure CORS (optional - can be done via portal)
    Write-Info "Configuring CORS..."
    try {
        $funcWebApp = Get-AzWebApp -ResourceGroupName $ResourceGroupName -Name $functionAppName
        $funcWebApp.SiteConfig.Cors = @{
            AllowedOrigins = @(
                "http://localhost:3000",
                "https://$staticWebAppName.azurestaticapps.net"
            )
            SupportCredentials = $true
        }
        Set-AzWebApp -ResourceGroupName $ResourceGroupName -Name $functionAppName -WebApp $funcWebApp | Out-Null
        Write-Success "  ✓ CORS enabled for frontend URLs"
    } catch {
        Write-Warning "  ⚠ CORS configuration failed - configure manually in Azure Portal"
    }

} catch {
    Write-Error "Failed to create/configure Function App: $_"
    Write-Error $_.Exception.Message
    exit 1
}
#endregion

#region Static Web App
Write-Info "`n=== [5/6] Creating Static Web App ==="
try {
    $staticApp = Get-AzStaticWebApp -ResourceGroupName $ResourceGroupName -Name $staticWebAppName -ErrorAction SilentlyContinue
    if ($staticApp) {
        Write-Warning "Static Web App '$staticWebAppName' already exists"
        Write-Info "  URL: https://$staticWebAppName.azurestaticapps.net"
    } else {
        Write-Info "Creating Static Web App '$staticWebAppName' in East Asia..."
        Write-Info "  (Static Web Apps have limited region availability)"
        Write-Info "  SKU: Free"
        
        $staticApp = New-AzStaticWebApp `
            -ResourceGroupName $ResourceGroupName `
            -Name $staticWebAppName `
            -Location $staticWebAppLocation `
            -SkuName "Free"
        
        Write-Success "✓ Static Web App created"
        Write-Info "  URL: https://$staticWebAppName.azurestaticapps.net"
        Write-Warning "  ⚠ Configure GitHub deployment token in Azure Portal"
    }
} catch {
    Write-Error "Failed to create Static Web App: $_"
    Write-Warning "You can create this manually in Azure Portal later"
}
#endregion

#region Summary and Verification
Write-Info "`n=== [6/6] Deployment Verification ==="
Write-Info "Verifying all resources..."

$resources = @(
    @{Name="SQL Server"; Check={Get-AzSqlServer -ResourceGroupName $ResourceGroupName -ServerName $sqlServerName -ErrorAction SilentlyContinue}},
    @{Name="SQL Database"; Check={Get-AzSqlDatabase -ResourceGroupName $ResourceGroupName -ServerName $sqlServerName -DatabaseName $sqlDatabaseName -ErrorAction SilentlyContinue}},
    @{Name="Storage Account"; Check={Get-AzStorageAccount -ResourceGroupName $ResourceGroupName -Name $storageAccountName -ErrorAction SilentlyContinue}},
    @{Name="Function App"; Check={Get-AzFunctionApp -ResourceGroupName $ResourceGroupName -Name $functionAppName -ErrorAction SilentlyContinue}},
    @{Name="App Insights"; Check={Get-AzApplicationInsights -ResourceGroupName $ResourceGroupName -Name $appInsightsName -ErrorAction SilentlyContinue}},
    @{Name="Static Web App"; Check={Get-AzStaticWebApp -ResourceGroupName $ResourceGroupName -Name $staticWebAppName -ErrorAction SilentlyContinue}}
)

$allSuccess = $true
foreach ($resource in $resources) {
    $exists = & $resource.Check
    if ($exists) {
        Write-Success "  ✓ $($resource.Name)"
    } else {
        Write-Error "  ✗ $($resource.Name) - NOT FOUND"
        $allSuccess = $false
    }
}

Write-Info "`n=========================================="
if ($allSuccess) {
    Write-Success "✅ Deployment Completed Successfully!"
} else {
    Write-Warning "⚠️ Deployment completed with some issues"
}
Write-Info "=========================================="
#endregion

#region Output Summary
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$summary = @"

╔══════════════════════════════════════════════════════════════════╗
║              REFOPEN INFRASTRUCTURE DEPLOYMENT                   ║
║                    SUCCESSFULLY COMPLETED                        ║
╚══════════════════════════════════════════════════════════════════╝

Deployment Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Deployed By: $UserEmail
Subscription: $($context.Subscription.Name)

═══════════════════════════════════════════════════════════════════

📦 RESOURCE GROUP
   Name: $ResourceGroupName
   Location: $Location

🗄️ SQL DATABASE
   Server: $sqlServerName.database.windows.net
   Database: $sqlDatabaseName
   Location: $sqlLocation
   Admin User: $sqlAdminUser
   Port: 1433
   
   Connection String:
   $connectionString

💾 STORAGE ACCOUNT
   Name: $storageAccountName
   Location: $Location
   Endpoint: https://$storageAccountName.blob.core.windows.net
   Containers: resumes, profile-images, referral-proofs, documents, company-logos

⚡ FUNCTION APP (Backend API)
   Name: $functionAppName
   Location: $functionLocation
   URL: https://$functionAppName.azurewebsites.net
   API Base: https://$functionAppName.azurewebsites.net/api
   Runtime: Node.js 20
   Functions Version: 4

🌐 STATIC WEB APP (Frontend)
   Name: $staticWebAppName
   Location: $staticWebAppLocation
   URL: https://$staticWebAppName.azurestaticapps.net

📊 APPLICATION INSIGHTS
   Name: $appInsightsName
   Location: $sqlLocation
   $(if($appInsights){"Instrumentation Key: $($appInsights.InstrumentationKey)"}else{"Not created"})

🔐 SECURITY KEYS
   JWT Secret: $jwtSecret

═══════════════════════════════════════════════════════════════════

📋 NEXT STEPS:

1. DATABASE SETUP
   .\src\database_scripts\setup-database.ps1 -ConnectionString "$connectionString"
   .\src\database_scripts\referral-schema.ps1 -ConnectionString "$connectionString"

2. BACKEND DEPLOYMENT
   npm run build
   func azure functionapp publish $functionAppName --typescript

3. FRONTEND DEPLOYMENT
   • Get deployment token from Azure Portal: $staticWebAppName
   • Add as GitHub secret: AZURE_STATIC_WEB_APPS_API_TOKEN
   • Push to empflow branch

4. VERIFICATION
   • API Health: https://$functionAppName.azurewebsites.net/api/health
   • Frontend: https://$staticWebAppName.azurestaticapps.net

═══════════════════════════════════════════════════════════════════

⚠️  SECURITY ACTIONS:

1. Restrict SQL Firewall (IMPORTANT!)
   Remove-AzSqlServerFirewallRule -ResourceGroupName "$ResourceGroupName" -ServerName "$sqlServerName" -FirewallRuleName "AllowAll"

2. Store credentials in password manager and delete sensitive files

3. Configure CORS in Azure Portal if automatic configuration failed

═══════════════════════════════════════════════════════════════════

"@

Write-Host $summary -ForegroundColor Cyan

# Save to file
$summaryFile = "deployment-info-refopen-$timestamp.txt"
$summary | Out-File -FilePath $summaryFile -Encoding UTF8
Write-Success "`n✓ Deployment information saved to: $summaryFile"

# Save sensitive info separately
$secretsContent = @"
REFOPEN DEPLOYMENT SECRETS - $(Get-Date)
⚠️  KEEP THIS FILE SECURE AND DO NOT COMMIT TO GIT ⚠️

SQL Server: $sqlServerName.database.windows.net
SQL Admin User: $sqlAdminUser
SQL Admin Password: $sqlAdminPasswordPlain
JWT Secret: $jwtSecret
Storage Connection String: $storageConnectionString
Database Connection String: $connectionString

"@

$secretsFile = "deployment-secrets-refopen-$timestamp.txt"
$secretsContent | Out-File -FilePath $secretsFile -Encoding UTF8
Write-Warning "`n⚠️  Sensitive information saved to: $secretsFile"
Write-Warning "⚠️  Save to password manager, then DELETE this file!"

Write-Info "`n=========================================="
Write-Success "✅ Deployment script completed!"
Write-Info "Files created:"
Write-Info "  • $summaryFile (deployment summary)"
Write-Info "  • $secretsFile (sensitive credentials - DELETE after saving!)"
Write-Info "=========================================="
#endregion