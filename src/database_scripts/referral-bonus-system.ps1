# RefOpen Referral Bonus System Deployment Script
# Adds wallet bonuses for new users and referrals

param(
    [string]$ConnectionString = "Server=refopen-sqlserver-ci.database.windows.net;Database=refopen-sql-db;User ID=sqladmin;Password=RefOpen@2024!Secure;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
)

Write-Host "?? Setting up RefOpen Referral Bonus System..." -ForegroundColor Green

# Install SqlServer module if not present
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "?? Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}

Import-Module SqlServer -Force

# Referral Bonus Schema SQL
$referralBonusSchemaSQL = @"
-- ================================================================
-- REFERRAL BONUS SYSTEM - Database Schema Updates
-- ================================================================
-- This script adds support for referral tracking and wallet bonuses
-- Uses UserID prefix (before first hyphen) as referral code
-- ================================================================

-- 1. Add ReferredBy column to Users table (stores UserID of referrer)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Users') AND name = 'ReferredBy')
BEGIN
    ALTER TABLE Users ADD ReferredBy UNIQUEIDENTIFIER NULL;
    PRINT '? Added ReferredBy column to Users table';
END
ELSE
BEGIN
    PRINT '?? ReferredBy column already exists in Users table';
END

-- 2. Add WalletBonusGiven column to track if welcome bonus was given
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Users') AND name = 'WalletBonusGiven')
BEGIN
    ALTER TABLE Users ADD WalletBonusGiven BIT DEFAULT 0;
    PRINT '? Added WalletBonusGiven column to Users table';
END
ELSE
BEGIN
    PRINT '?? WalletBonusGiven column already exists in Users table';
END
"@

# Referral Indexes SQL
$referralIndexesSQL = @"
-- ================================================================
-- REFERRAL BONUS SYSTEM - Indexes
-- ================================================================

-- Create index on ReferredBy for referral statistics
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_ReferredBy' AND object_id = OBJECT_ID('Users'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Users_ReferredBy
    ON Users(ReferredBy)
    WHERE ReferredBy IS NOT NULL;
    PRINT '? Created index on ReferredBy';
END
ELSE
BEGIN
    PRINT '?? Index IX_Users_ReferredBy already exists';
END
"@

# Foreign Key Constraints SQL
$referralConstraintsSQL = @"
-- ================================================================
-- REFERRAL BONUS SYSTEM - Foreign Key Constraints
-- ================================================================

-- Add foreign key constraint for ReferredBy
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Users_ReferredBy')
BEGIN
    ALTER TABLE Users
    ADD CONSTRAINT FK_Users_ReferredBy
    FOREIGN KEY (ReferredBy) REFERENCES Users(UserID);
    PRINT '? Added foreign key constraint for ReferredBy';
END
ELSE
BEGIN
    PRINT '?? Foreign key FK_Users_ReferredBy already exists';
END
"@

# Referral Functions SQL
$referralFunctionsSQL = @"
-- ================================================================
-- REFERRAL BONUS SYSTEM - Functions
-- ================================================================

-- Function to get referral code from UserID
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'FN' AND name = 'fn_GetReferralCode')
BEGIN
    DROP FUNCTION fn_GetReferralCode;
END
GO

CREATE FUNCTION fn_GetReferralCode(@UserID UNIQUEIDENTIFIER)
RETURNS NVARCHAR(20)
AS
BEGIN
    DECLARE @ReferralCode NVARCHAR(20);
    
    -- Extract prefix from UserID (first part before first hyphen)
    -- Example: 1DC4CC1D-8A2E-4713-B123-456789ABCDEF -> 1DC4CC1D
    SET @ReferralCode = LEFT(CAST(@UserID AS NVARCHAR(50)), CHARINDEX('-', CAST(@UserID AS NVARCHAR(50))) - 1);
    
    RETURN @ReferralCode;
END
GO

PRINT '? Created function fn_GetReferralCode';
GO

-- Function to find user by referral code
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'FN' AND name = 'fn_FindUserByReferralCode')
BEGIN
    DROP FUNCTION fn_FindUserByReferralCode;
END
GO

CREATE FUNCTION fn_FindUserByReferralCode(@ReferralCode NVARCHAR(20))
RETURNS UNIQUEIDENTIFIER
AS
BEGIN
    DECLARE @UserID UNIQUEIDENTIFIER;
    
    -- Find user whose UserID starts with the referral code
    SELECT TOP 1 @UserID = UserID
    FROM Users
    WHERE CAST(UserID AS NVARCHAR(50)) LIKE @ReferralCode + '-%'
    AND IsActive = 1;
    
    RETURN @UserID;
END
GO

PRINT '? Created function fn_FindUserByReferralCode';
GO
"@

# Referral Views SQL
$referralViewsSQL = @"
-- ================================================================
-- REFERRAL BONUS SYSTEM - Views
-- ================================================================

-- Create view for referral statistics
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_UserReferralStats')
BEGIN
    DROP VIEW vw_UserReferralStats;
END
GO

CREATE VIEW vw_UserReferralStats AS
SELECT 
    u.UserID,
    u.Email,
    u.FirstName,
    u.LastName,
    -- Generate referral code from UserID
    dbo.fn_GetReferralCode(u.UserID) as ReferralCode,
    COUNT(DISTINCT r.UserID) as TotalReferrals,
    SUM(CASE WHEN r.CreatedAt >= DATEADD(MONTH, -1, GETUTCDATE()) THEN 1 ELSE 0 END) as ReferralsLast30Days,
    SUM(CASE WHEN r.IsActive = 1 THEN 1 ELSE 0 END) as ActiveReferrals,
    -- Calculate total bonuses earned (?50 per referral)
    COUNT(DISTINCT r.UserID) * 50 as TotalBonusEarned,
    -- Get latest referral date
    MAX(r.CreatedAt) as LastReferralDate
FROM Users u
LEFT JOIN Users r ON r.ReferredBy = u.UserID
WHERE u.IsActive = 1
GROUP BY u.UserID, u.Email, u.FirstName, u.LastName;
GO

PRINT '? Created view vw_UserReferralStats';
GO
"@

try {
    Write-Host "?? Adding referral tracking columns..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $referralBonusSchemaSQL -QueryTimeout 120
    Write-Host "? Referral columns added successfully" -ForegroundColor Green

    Write-Host "?? Creating referral indexes..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $referralIndexesSQL -QueryTimeout 120
    Write-Host "? Referral indexes created successfully" -ForegroundColor Green

    Write-Host "?? Adding foreign key constraints..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $referralConstraintsSQL -QueryTimeout 120
    Write-Host "? Foreign key constraints added successfully" -ForegroundColor Green

    Write-Host "?? Creating referral functions..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $referralFunctionsSQL -QueryTimeout 60
    Write-Host "? Referral functions created successfully" -ForegroundColor Green

    Write-Host "?? Creating referral views..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $referralViewsSQL -QueryTimeout 60
    Write-Host "? Referral views created successfully" -ForegroundColor Green

    Write-Host ""
    Write-Host "?? REFERRAL BONUS SYSTEM SETUP COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host ""
    Write-Host "?? REFERRAL SYSTEM SUMMARY:" -ForegroundColor Cyan
    Write-Host "- ? ReferredBy column added to track referrals" -ForegroundColor White
    Write-Host "- ? WalletBonusGiven column added to track welcome bonus" -ForegroundColor White
    Write-Host "- ? Functions: fn_GetReferralCode, fn_FindUserByReferralCode" -ForegroundColor White
    Write-Host "- ? View: vw_UserReferralStats" -ForegroundColor White
    Write-Host "- ? Indexes and constraints for performance" -ForegroundColor White
    Write-Host ""
    Write-Host "?? HOW IT WORKS:" -ForegroundColor Cyan
    Write-Host "- Referral Code: First part of UserID (before first hyphen)" -ForegroundColor White
    Write-Host "- Example: UserID '1DC4CC1D-8A2E-...' ? Referral Code '1DC4CC1D'" -ForegroundColor White
    Write-Host ""
    Write-Host "?? BONUS STRUCTURE:" -ForegroundColor Cyan
    Write-Host "- New user welcome bonus: ?100" -ForegroundColor White
    Write-Host "- Referral bonus (both parties): ?50 each" -ForegroundColor White
    Write-Host "- Transaction sources: 'NEW_USER_BONUS' and 'REFERRAL_BONUS'" -ForegroundColor White
    Write-Host ""
    Write-Host "?? NEXT STEPS:" -ForegroundColor Cyan
    Write-Host "1. Deploy updated backend code to Azure Functions" -ForegroundColor White
    Write-Host "2. Update frontend registration form with referral code input" -ForegroundColor White
    Write-Host "3. Test registration with and without referral codes" -ForegroundColor White
    Write-Host "4. Monitor wallet transactions in Application Insights" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Error "? Referral bonus system setup failed: $($_.Exception.Message)"
    exit 1
}
