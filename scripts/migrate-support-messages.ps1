# ================================================================
# Support Messages Table Migration Script
# ================================================================
# Creates SupportMessages table for conversation threads
# Migrates existing data from SupportTickets
# ================================================================

param(
    [string]$ConnectionString = $env:DB_CONNECTION_STRING,
    [string]$KeyVaultName = "refopen-keyvault-prod",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " SUPPORT MESSAGES TABLE MIGRATION" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

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

if ($DryRun) {
    Write-Host "DRY RUN MODE - No database changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

# ================================================================
# Install Required Modules
# ================================================================
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "Installing SqlServer module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}
Import-Module SqlServer -Force

# ================================================================
# MIGRATION FUNCTIONS
# ================================================================

function Execute-SqlCommand {
    param(
        [string]$Query,
        [string]$Description
    )
    
    Write-Host "  📝 $Description..." -ForegroundColor White
    
    if ($DryRun) {
        Write-Host "     [DRY RUN] Would execute: $($Query.Substring(0, [Math]::Min(100, $Query.Length)))..." -ForegroundColor Gray
        return
    }
    
    try {
        $result = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $Query -QueryTimeout 120
        Write-Host "     ✅ Success" -ForegroundColor Green
        return $result
    } catch {
        Write-Host "     ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

# ================================================================
# MAIN MIGRATION
# ================================================================

Write-Host ""
Write-Host "Step 1: Creating SupportMessages table..." -ForegroundColor Yellow
Write-Host ""

$createTableQuery = @"
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'SupportMessages') AND type in (N'U'))
BEGIN
    CREATE TABLE SupportMessages (
        MessageID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        TicketID UNIQUEIDENTIFIER NOT NULL,
        SenderID UNIQUEIDENTIFIER NOT NULL,
        SenderType NVARCHAR(10) NOT NULL,
        Message NVARCHAR(MAX) NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        IsDeleted BIT NOT NULL DEFAULT 0,
        CONSTRAINT PK_SupportMessages PRIMARY KEY CLUSTERED (MessageID),
        CONSTRAINT FK_SupportMessages_Ticket FOREIGN KEY (TicketID) REFERENCES SupportTickets(TicketID),
        CONSTRAINT FK_SupportMessages_Sender FOREIGN KEY (SenderID) REFERENCES Users(UserID),
        CONSTRAINT CK_SupportMessages_SenderType CHECK (SenderType IN ('User', 'Admin'))
    );
    SELECT 'Table created' AS Result;
END
ELSE
BEGIN
    SELECT 'Table already exists' AS Result;
END
"@

Execute-SqlCommand -Query $createTableQuery -Description "Creating SupportMessages table"

Write-Host ""
Write-Host "Step 2: Creating index on TicketID..." -ForegroundColor Yellow
Write-Host ""

$createIndexQuery = @"
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SupportMessages_TicketID' AND object_id = OBJECT_ID('SupportMessages'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_SupportMessages_TicketID ON SupportMessages (TicketID, CreatedAt ASC);
    SELECT 'Index created' AS Result;
END
ELSE
BEGIN
    SELECT 'Index already exists' AS Result;
END
"@

Execute-SqlCommand -Query $createIndexQuery -Description "Creating index IX_SupportMessages_TicketID"

Write-Host ""
Write-Host "Step 3: Migrating existing user messages..." -ForegroundColor Yellow
Write-Host ""

$migrateUserMessagesQuery = @"
INSERT INTO SupportMessages (TicketID, SenderID, SenderType, Message, CreatedAt)
SELECT TicketID, UserID, 'User', Message, CreatedAt
FROM SupportTickets
WHERE IsDeleted = 0
AND NOT EXISTS (
    SELECT 1 FROM SupportMessages sm 
    WHERE sm.TicketID = SupportTickets.TicketID 
    AND sm.SenderType = 'User' 
    AND sm.Message = SupportTickets.Message
);
SELECT @@ROWCOUNT AS MigratedCount;
"@

$userResult = Execute-SqlCommand -Query $migrateUserMessagesQuery -Description "Migrating user messages"
if ($userResult) {
    Write-Host "     📊 Migrated $($userResult.MigratedCount) user messages" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Step 4: Migrating existing admin responses..." -ForegroundColor Yellow
Write-Host ""

$migrateAdminMessagesQuery = @"
INSERT INTO SupportMessages (TicketID, SenderID, SenderType, Message, CreatedAt)
SELECT TicketID, AdminUserID, 'Admin', AdminResponse, ISNULL(ResolvedAt, UpdatedAt)
FROM SupportTickets
WHERE IsDeleted = 0 
AND AdminResponse IS NOT NULL 
AND AdminUserID IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM SupportMessages sm 
    WHERE sm.TicketID = SupportTickets.TicketID 
    AND sm.SenderType = 'Admin'
);
SELECT @@ROWCOUNT AS MigratedCount;
"@

$adminResult = Execute-SqlCommand -Query $migrateAdminMessagesQuery -Description "Migrating admin responses"
if ($adminResult) {
    Write-Host "     📊 Migrated $($adminResult.MigratedCount) admin responses" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Step 5: Verifying migration..." -ForegroundColor Yellow
Write-Host ""

$verifyQuery = @"
SELECT 
    (SELECT COUNT(*) FROM SupportMessages WHERE SenderType = 'User') AS UserMessages,
    (SELECT COUNT(*) FROM SupportMessages WHERE SenderType = 'Admin') AS AdminMessages,
    (SELECT COUNT(*) FROM SupportMessages) AS TotalMessages,
    (SELECT COUNT(*) FROM SupportTickets WHERE IsDeleted = 0) AS TotalTickets
"@

$stats = Execute-SqlCommand -Query $verifyQuery -Description "Getting migration stats"
if ($stats) {
    Write-Host ""
    Write-Host "📊 Migration Statistics:" -ForegroundColor Cyan
    Write-Host "   • Total Tickets: $($stats.TotalTickets)" -ForegroundColor White
    Write-Host "   • User Messages: $($stats.UserMessages)" -ForegroundColor White
    Write-Host "   • Admin Messages: $($stats.AdminMessages)" -ForegroundColor White
    Write-Host "   • Total Messages: $($stats.TotalMessages)" -ForegroundColor White
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " ✅ MIGRATION COMPLETED SUCCESSFULLY" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
