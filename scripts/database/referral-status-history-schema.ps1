# RefOpen Referral Status History Schema Deployment Script

param(
    [string]$ConnectionString = $env:DB_CONNECTION_STRING,
    [string]$KeyVaultName = "refopen-keyvault-prod"
)

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

Write-Host "📊 Setting up Referral Status History Schema..." -ForegroundColor Green

# Install SqlServer module if not present
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "📦 Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}

Import-Module SqlServer -Force

# Database Schema SQL for Referral Status History
$statusHistorySchemaSQL = @"
-- ===== REFERRAL REQUEST STATUS HISTORY TABLE =====
-- Tracks complete history of status changes for referral tracking screen

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReferralRequestStatusHistory')
BEGIN
    CREATE TABLE ReferralRequestStatusHistory (
        HistoryID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        RequestID UNIQUEIDENTIFIER NOT NULL,
        Status NVARCHAR(50) NOT NULL,
        StatusMessage NVARCHAR(500) NULL,
        ActorID UNIQUEIDENTIFIER NULL,          -- Who triggered this status (referrer for Viewed/Claimed)
        ActorType NVARCHAR(20) NULL,            -- 'system', 'seeker', 'referrer'
        ActorName NVARCHAR(200) NULL,           -- Cached name for display
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (RequestID) REFERENCES ReferralRequests(RequestID) ON DELETE CASCADE
    );
    PRINT 'Created ReferralRequestStatusHistory table';
END
GO

-- ===== INDEXES FOR PERFORMANCE =====

-- Primary lookup: Get history for a specific request
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReferralStatusHistory_RequestID_CreatedAt')
    CREATE INDEX IX_ReferralStatusHistory_RequestID_CreatedAt 
    ON ReferralRequestStatusHistory (RequestID, CreatedAt DESC) 
    INCLUDE (Status, StatusMessage, ActorName, ActorType);
GO

-- Secondary: Get recent activities by actor
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReferralStatusHistory_ActorID_CreatedAt')
    CREATE INDEX IX_ReferralStatusHistory_ActorID_CreatedAt 
    ON ReferralRequestStatusHistory (ActorID, CreatedAt DESC) 
    INCLUDE (RequestID, Status);
GO

PRINT '✅ Referral Status History schema created successfully!';
"@

# Execute the SQL
try {
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $statusHistorySchemaSQL -Verbose
    Write-Host "✅ Referral Status History schema deployed successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Error deploying schema: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n📋 New Status Flow:" -ForegroundColor Cyan
Write-Host "   Pending → NotifiedToReferrers → Viewed → Claimed → ProofUploaded → Completed → Verified" -ForegroundColor White
Write-Host "`n🎯 Use this table to show timeline on job seeker's tracking screen" -ForegroundColor Yellow
