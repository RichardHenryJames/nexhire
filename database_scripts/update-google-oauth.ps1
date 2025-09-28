# Google OAuth Database Schema Update Script
# Run this to add Google Sign-In support to your existing NexHire database

param(
    [string]$ConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
)

Write-Host "?? Adding Google OAuth support to NexHire database..." -ForegroundColor Green

# Install SqlServer module if not present
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "?? Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}

Import-Module SqlServer -Force

# Google OAuth Schema Updates
$googleOAuthSQL = @"
-- ?? ADD Google OAuth columns to Users table
PRINT '?? Adding Google OAuth columns to Users table...';

-- Add GoogleId column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'GoogleId')
BEGIN
    ALTER TABLE Users ADD GoogleId NVARCHAR(100) NULL;
    PRINT '? GoogleId column added';
END
ELSE
BEGIN
    PRINT '?? GoogleId column already exists';
END

-- Add LoginMethod column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'LoginMethod')
BEGIN
    ALTER TABLE Users ADD LoginMethod NVARCHAR(50) NULL DEFAULT 'Password';
    PRINT '? LoginMethod column added';
END
ELSE
BEGIN
    PRINT '?? LoginMethod column already exists';
END

-- Add GoogleAccessToken column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'GoogleAccessToken')
BEGIN
    ALTER TABLE Users ADD GoogleAccessToken NVARCHAR(MAX) NULL;
    PRINT '? GoogleAccessToken column added';
END
ELSE
BEGIN
    PRINT '?? GoogleAccessToken column already exists';
END

-- Create performance index for Google ID lookups
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Users_GoogleId')
BEGIN
    CREATE INDEX IX_Users_GoogleId ON Users(GoogleId) WHERE GoogleId IS NOT NULL;
    PRINT '? Performance index IX_Users_GoogleId created';
END
ELSE
BEGIN
    PRINT '?? Performance index IX_Users_GoogleId already exists';
END

-- Update existing users to have LoginMethod = 'Password'
UPDATE Users 
SET LoginMethod = 'Password' 
WHERE LoginMethod IS NULL;

DECLARE @UpdatedUsers INT = @@ROWCOUNT;
PRINT '? Updated ' + CAST(@UpdatedUsers AS NVARCHAR(10)) + ' existing users with LoginMethod = Password';

PRINT '?? Google OAuth schema update completed!';
"@

# Verification Query
$verificationSQL = @"
-- Verification: Check if columns were added successfully
PRINT '?? Verifying Google OAuth schema changes...';

SELECT 
    c.COLUMN_NAME,
    c.DATA_TYPE,
    c.CHARACTER_MAXIMUM_LENGTH,
    c.IS_NULLABLE,
    c.COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS c
WHERE c.TABLE_NAME = 'Users'
AND c.COLUMN_NAME IN ('GoogleId', 'LoginMethod', 'GoogleAccessToken')
ORDER BY c.COLUMN_NAME;

-- Check if index was created
SELECT 
    i.name AS IndexName,
    i.type_desc AS IndexType,
    i.is_unique,
    i.filter_definition
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE t.name = 'Users' 
AND i.name = 'IX_Users_GoogleId';

-- Sample data check
SELECT 
    COUNT(*) AS TotalUsers,
    SUM(CASE WHEN LoginMethod = 'Password' THEN 1 ELSE 0 END) AS PasswordUsers,
    SUM(CASE WHEN LoginMethod = 'Google' THEN 1 ELSE 0 END) AS GoogleUsers,
    SUM(CASE WHEN GoogleId IS NOT NULL THEN 1 ELSE 0 END) AS UsersWithGoogleId
FROM Users;

PRINT '? Verification completed';
"@

try {
    Write-Host "?? Executing Google OAuth schema updates..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $googleOAuthSQL -QueryTimeout 60 -Verbose
    
    Write-Host "?? Running verification checks..." -ForegroundColor Yellow
    $verificationResult = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $verificationSQL -QueryTimeout 30
    
    Write-Host "?? Database Update Results:" -ForegroundColor Cyan
    Write-Host "Columns Added: GoogleId, LoginMethod, GoogleAccessToken" -ForegroundColor Green
    Write-Host "Index Created: IX_Users_GoogleId" -ForegroundColor Green
    
    if ($verificationResult) {
        $verificationResult | Format-Table -AutoSize
    }
    
    Write-Host ""
    Write-Host "?? Google OAuth database update completed successfully!" -ForegroundColor Green
    Write-Host "?? Your database is now ready for Google Sign-In!" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Deploy your updated backend: func azure functionapp publish nexhire-api-func" -ForegroundColor White
    Write-Host "2. Test Google Sign-In in your frontend app" -ForegroundColor White
    
} catch {
    Write-Error "? Google OAuth database update failed: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "?? Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Check your connection string" -ForegroundColor White
    Write-Host "2. Ensure you have permissions to ALTER TABLE" -ForegroundColor White
    Write-Host "3. Verify the database is accessible" -ForegroundColor White
    exit 1
}