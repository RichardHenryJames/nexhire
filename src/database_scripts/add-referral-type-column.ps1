# Minimal Database Schema Update - Reuse JobID for External Referrals
# NexHire Database Schema Update - External Referral Support (Minimal Changes)

param(
    [string]$ConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
)

Write-Host "?? Adding minimal ReferralType column to ReferralRequests table..." -ForegroundColor Green

# Install SqlServer module if not present
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "?? Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}

Import-Module SqlServer -Force

# ?? FIXED: Separate SQL statements to avoid referencing non-existent columns
$addColumnsSQL = @"
-- Add ReferralType column to ReferralRequests table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ReferralRequests' AND COLUMN_NAME = 'ReferralType')
BEGIN
    ALTER TABLE ReferralRequests ADD ReferralType NVARCHAR(50) DEFAULT 'internal';
    PRINT '? Added ReferralType column to ReferralRequests table';
END
ELSE
BEGIN
    PRINT '?? ReferralType column already exists in ReferralRequests table';
END

-- Add OrganizationID column for external referral company matching
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ReferralRequests' AND COLUMN_NAME = 'OrganizationID')
BEGIN
    ALTER TABLE ReferralRequests ADD OrganizationID INT NULL;
    PRINT '? Added OrganizationID column to ReferralRequests table';
END
ELSE
BEGIN
    PRINT '?? OrganizationID column already exists in ReferralRequests table';
END

-- Add ReferralMessage column to ReferralRequests table (OPTIONAL field)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ReferralRequests' AND COLUMN_NAME = 'ReferralMessage')
BEGIN
    ALTER TABLE ReferralRequests ADD ReferralMessage NVARCHAR(1000) NULL;
    PRINT '? Added ReferralMessage column to ReferralRequests table';
END
ELSE
BEGIN
    PRINT '?? ReferralMessage column already exists in ReferralRequests table';
END
"@

$addConstraintsSQL = @"
-- Add foreign key constraint for OrganizationID
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_ReferralRequests_OrganizationID')
BEGIN
    ALTER TABLE ReferralRequests ADD CONSTRAINT FK_ReferralRequests_OrganizationID 
    FOREIGN KEY (OrganizationID) REFERENCES Organizations(OrganizationID);
    PRINT '? Added foreign key constraint for OrganizationID';
END
ELSE
BEGIN
    PRINT '?? Foreign key constraint already exists for OrganizationID';
END
"@

$updateDataSQL = @"
-- Update existing records to have 'internal' referral type (only if column exists)
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ReferralRequests' AND COLUMN_NAME = 'ReferralType')
BEGIN
    UPDATE ReferralRequests SET ReferralType = 'internal' WHERE ReferralType IS NULL;
    PRINT '?? Updated existing records with internal referral type';
END
"@

$createIndexesSQL = @"
-- Create indexes for better performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferralRequests_ReferralType')
BEGIN
    CREATE INDEX IX_ReferralRequests_ReferralType ON ReferralRequests (ReferralType);
    PRINT '?? Created index on ReferralType column';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferralRequests_OrganizationID')
BEGIN
    CREATE INDEX IX_ReferralRequests_OrganizationID ON ReferralRequests (OrganizationID);
    PRINT '?? Created index on OrganizationID column';
END

-- Create index for ReferralMessage (for search/filtering if needed)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferralRequests_ReferralMessage')
BEGIN
    CREATE INDEX IX_ReferralRequests_ReferralMessage ON ReferralRequests (ReferralMessage);
    PRINT '?? Created index on ReferralMessage column';
END

PRINT '?? ReferralRequests table updated with ReferralMessage column for both internal and external referrals!';
"@

try {
    Write-Host "?? Step 1: Adding columns..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $addColumnsSQL -QueryTimeout 60
    
    Write-Host "?? Step 2: Adding constraints..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $addConstraintsSQL -QueryTimeout 60
    
    Write-Host "?? Step 3: Updating existing data..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $updateDataSQL -QueryTimeout 60
    
    Write-Host "?? Step 4: Creating indexes..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $createIndexesSQL -QueryTimeout 60
    
    Write-Host "? Database schema updated successfully!" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "?? REFERRAL TYPES SUPPORTED:" -ForegroundColor Cyan
    Write-Host "- 'internal' : Jobs from NexHire Jobs table (existing functionality)" -ForegroundColor White
    Write-Host "- 'external' : Jobs from external company career portals (new feature)" -ForegroundColor White
    Write-Host ""
    Write-Host "?? COLUMN REUSE STRATEGY:" -ForegroundColor Cyan
    Write-Host "- JobID column: Reused for both internal GUIDs and external job identifiers" -ForegroundColor White
    Write-Host "- ReferralType: Only new column needed - 'internal' or 'external'" -ForegroundColor White
    Write-Host "- OrganizationID: Links external referrals to actual organizations for better matching" -ForegroundColor White
    Write-Host "- Minimal schema impact: Just two new columns + indexes" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Error "? Database schema update failed: $($_.Exception.Message)"
    Write-Host "?? Error details:" -ForegroundColor Red
    Write-Host $_.Exception.ToString() -ForegroundColor Red
    exit 1
}

Write-Host "?? Next steps: Build and deploy backend services" -ForegroundColor Green