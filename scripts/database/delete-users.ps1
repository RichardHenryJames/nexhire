# ================================================================
# Delete Users Script
# ================================================================
# Deletes specified users from the database by disabling FK 
# constraints, deleting users, then re-enabling constraints.
# Fetches credentials from Azure Key Vault.
# ================================================================

param(
    [string]$EmailsFile = "$PSScriptRoot\users-to-delete.txt",
    [string]$ConnectionString = $env:DB_CONNECTION_STRING,
    [string]$KeyVaultName = "refopen-keyvault-prod",
    [switch]$DryRun
)

# Read emails from file
if (-not (Test-Path $EmailsFile)) {
    Write-Error "Emails file not found: $EmailsFile"
    Write-Host "Create the file with one email per line (lines starting with # are ignored)" -ForegroundColor Yellow
    exit 1
}

$Emails = Get-Content $EmailsFile | Where-Object { $_ -and $_.Trim() -and -not $_.StartsWith("#") } | ForEach-Object { $_.Trim() }

if ($Emails.Count -eq 0) {
    Write-Host "❌ No emails found in $EmailsFile" -ForegroundColor Red
    Write-Host "Add emails to delete (one per line, lines starting with # are ignored)" -ForegroundColor Yellow
    exit 0
}

$ErrorActionPreference = "Stop"

# Auto-load credentials from Key Vault if not provided
if (-not $ConnectionString) {
    Write-Host "🔐 Loading credentials from Azure Key Vault..." -ForegroundColor Cyan
    $ConnectionString = az keyvault secret show --vault-name $KeyVaultName --name "DbConnectionString" --query "value" -o tsv 2>$null
    if (-not $ConnectionString) {
        Write-Error "Failed to load credentials. Ensure you're logged in: az login"
        exit 1
    }
    Write-Host "✅ Credentials loaded from Key Vault" -ForegroundColor Green
}

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " DELETE USERS FROM DATABASE" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "⚠️  DRY RUN MODE - No database changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Users to delete:" -ForegroundColor Yellow
foreach ($email in $Emails) {
    Write-Host "  - $email" -ForegroundColor White
}
Write-Host ""

# ================================================================
# Install Required Modules
# ================================================================
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "Installing SqlServer module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}
Import-Module SqlServer -Force

# ================================================================
# Tables with FK constraints to Users
# ================================================================
$tablesWithFK = @(
    "UserProfileViews",
    "WalletTransactions",
    "Wallets",
    "ReferralRequests",
    "JobApplications",
    "SavedJobs",
    "ManualPaymentSubmissions",
    "SupportTickets",
    "SupportMessages",
    "Messages",
    "Conversations",
    "UserDevices",
    "UserSessions"
)

# ================================================================
# First, verify users exist
# ================================================================
$emailList = "'" + ($Emails -join "','") + "'"
$checkQuery = "SELECT UserID, Email, FirstName, LastName FROM Users WHERE Email IN ($emailList)"

Write-Host "🔍 Checking for users in database..." -ForegroundColor Cyan
$usersToDelete = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $checkQuery -TrustServerCertificate

if ($usersToDelete.Count -eq 0) {
    Write-Host "❌ No users found with the specified emails." -ForegroundColor Red
    exit 0
}

Write-Host "Found $($usersToDelete.Count) user(s) to delete:" -ForegroundColor Green
foreach ($user in $usersToDelete) {
    Write-Host "  - $($user.Email) (ID: $($user.UserID), Name: $($user.FirstName) $($user.LastName))" -ForegroundColor White
}
Write-Host ""

if ($DryRun) {
    Write-Host "✅ DRY RUN complete. No changes made." -ForegroundColor Yellow
    exit 0
}

# ================================================================
# Disable FK Constraints
# ================================================================
Write-Host "🔓 Disabling foreign key constraints..." -ForegroundColor Cyan
foreach ($table in $tablesWithFK) {
    try {
        $disableQuery = "ALTER TABLE [$table] NOCHECK CONSTRAINT ALL"
        Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $disableQuery -TrustServerCertificate -ErrorAction SilentlyContinue
        Write-Host "  ✓ Disabled constraints on $table" -ForegroundColor DarkGray
    } catch {
        # Table might not exist, skip silently
    }
}
Write-Host ""

# ================================================================
# Delete Users
# ================================================================
Write-Host "🗑️  Deleting users..." -ForegroundColor Cyan
$deleteQuery = "DELETE FROM Users WHERE Email IN ($emailList)"

try {
    $result = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $deleteQuery -TrustServerCertificate
    Write-Host "✅ Deleted users successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Error deleting users: $_" -ForegroundColor Red
}
Write-Host ""

# ================================================================
# Re-enable FK Constraints
# ================================================================
Write-Host "🔒 Re-enabling foreign key constraints..." -ForegroundColor Cyan
foreach ($table in $tablesWithFK) {
    try {
        $enableQuery = "ALTER TABLE [$table] CHECK CONSTRAINT ALL"
        Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $enableQuery -TrustServerCertificate -ErrorAction SilentlyContinue
        Write-Host "  ✓ Enabled constraints on $table" -ForegroundColor DarkGray
    } catch {
        # Table might not exist, skip silently
    }
}
Write-Host ""

# ================================================================
# Verify Deletion
# ================================================================
Write-Host "🔍 Verifying deletion..." -ForegroundColor Cyan
$verifyResult = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $checkQuery -TrustServerCertificate

if ($verifyResult.Count -eq 0) {
    Write-Host "✅ All specified users have been deleted." -ForegroundColor Green
} else {
    Write-Host "⚠️  Some users still exist:" -ForegroundColor Yellow
    foreach ($user in $verifyResult) {
        Write-Host "  - $($user.Email)" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " DONE" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
