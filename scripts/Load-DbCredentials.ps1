# ================================================================
# Load Database Credentials from Azure Key Vault
# ================================================================
# Usage: . .\scripts\Load-DbCredentials.ps1
# Then run your script: .\setup-database.ps1
# ================================================================

param(
    [string]$KeyVaultName = "refopen-keyvault-prod",
    [switch]$Verbose
)

Write-Host "🔐 Loading credentials from Azure Key Vault..." -ForegroundColor Cyan

# Check if logged into Azure
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "⚠️ Not logged into Azure. Running 'az login'..." -ForegroundColor Yellow
    az login
}

# Fetch secrets from Key Vault
try {
    Write-Host "📥 Fetching DB_PASSWORD from Key Vault..." -ForegroundColor Gray
    $env:DB_PASSWORD = az keyvault secret show --vault-name $KeyVaultName --name "SqlPassword" --query "value" -o tsv
    
    Write-Host "📥 Fetching DB_CONNECTION_STRING from Key Vault..." -ForegroundColor Gray
    $env:DB_CONNECTION_STRING = az keyvault secret show --vault-name $KeyVaultName --name "DbConnectionString" --query "value" -o tsv
    
    # Also set individual DB components
    $env:DB_SERVER = "refopen-sqlserver-ci.database.windows.net"
    $env:DB_NAME = "refopen-sql-db"
    $env:DB_USER = "sqladmin"
    
    Write-Host "✅ Credentials loaded successfully!" -ForegroundColor Green
    
    if ($Verbose) {
        Write-Host ""
        Write-Host "Environment variables set:" -ForegroundColor Cyan
        Write-Host "  DB_SERVER: $env:DB_SERVER"
        Write-Host "  DB_NAME: $env:DB_NAME"
        Write-Host "  DB_USER: $env:DB_USER"
        Write-Host "  DB_PASSWORD: ****" 
        Write-Host "  DB_CONNECTION_STRING: [SET]"
    }
    
    Write-Host ""
    Write-Host "You can now run database scripts, e.g.:" -ForegroundColor Yellow
    Write-Host "  .\src\database_scripts\setup-database.ps1" -ForegroundColor White
    Write-Host "  .\generate-indian-users.ps1" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Error "❌ Failed to load credentials from Key Vault: $_"
    Write-Host "Make sure you have access to Key Vault: $KeyVaultName" -ForegroundColor Yellow
    exit 1
}
