# RefOpen Applicant Profile Views Tracking Script (Option 3 - On-Demand Aggregation)
# Creates ApplicantProfileViews table, supporting indexes, and aggregation view (no cached column on Applicants)

param(
    [string]$ConnectionString = "Server=refopen-sqlserver-ci.database.windows.net;Database=refopen-sql-db;User ID=sqladmin;Password=RefOpen@2024!Secure;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;",
    [int]$RetentionDays = 365 # Set 0 to skip retention purge
)

Write-Host "Setting up Applicant Profile Views tracking..." -ForegroundColor Green

# Ensure SqlServer module
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}
Import-Module SqlServer -Force

# Batch 1: table + indexes (no CREATE VIEW here)
$tableAndIndexesSQL = @"
-- TABLE
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ApplicantProfileViews')
BEGIN
    CREATE TABLE dbo.ApplicantProfileViews (
        ViewID UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        ApplicantID UNIQUEIDENTIFIER NOT NULL,
        ViewedByUserID UNIQUEIDENTIFIER NULL,
        ViewedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        Source NVARCHAR(50) NULL,
        ClientIP NVARCHAR(45) NULL,
        UserAgent NVARCHAR(400) NULL,
        SessionID UNIQUEIDENTIFIER NULL,
        FOREIGN KEY (ApplicantID) REFERENCES Applicants(ApplicantID),
        FOREIGN KEY (ViewedByUserID) REFERENCES Users(UserID)
    );
    PRINT 'Created table ApplicantProfileViews';
END
ELSE
    PRINT 'ApplicantProfileViews table already exists';

-- INDEXES
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ApplicantProfileViews_Applicant_ViewedAt')
    CREATE INDEX IX_ApplicantProfileViews_Applicant_ViewedAt
        ON dbo.ApplicantProfileViews (ApplicantID, ViewedAt DESC)
        INCLUDE (ViewedByUserID, Source);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ApplicantProfileViews_ViewedBy_Recent')
    CREATE INDEX IX_ApplicantProfileViews_ViewedBy_Recent
        ON dbo.ApplicantProfileViews (ViewedByUserID, ViewedAt DESC)
        INCLUDE (ApplicantID, Source);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ApplicantProfileViews_Source')
    CREATE INDEX IX_ApplicantProfileViews_Source
        ON dbo.ApplicantProfileViews (Source);
"@

# Batch 2: view only (CREATE VIEW must be first statement)
$viewSQL = @"
IF OBJECT_ID('dbo.vw_ApplicantProfileViewStats','V') IS NOT NULL
    DROP VIEW dbo.vw_ApplicantProfileViewStats;
GO
CREATE VIEW dbo.vw_ApplicantProfileViewStats AS
SELECT 
    apv.ApplicantID,
    COUNT_BIG(*) AS TotalProfileViews,
    SUM(CASE WHEN apv.ViewedAt >= DATEADD(DAY,-30,GETUTCDATE()) THEN 1 ELSE 0 END) AS ProfileViewsLast30Days,
    SUM(CASE WHEN apv.ViewedAt >= DATEADD(DAY,-7,GETUTCDATE()) THEN 1 ELSE 0 END) AS ProfileViewsLast7Days,
    MAX(apv.ViewedAt) AS LastViewedAt
FROM dbo.ApplicantProfileViews apv
GROUP BY apv.ApplicantID;
"@

try {
    Write-Host "Applying table + index batch..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $tableAndIndexesSQL -QueryTimeout 180 | Out-Null

    # Confirm table exists before continuing
    $exists = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query "SELECT 1 AS X FROM sys.tables WHERE name='ApplicantProfileViews'" -QueryTimeout 30
    if (-not $exists) { throw "ApplicantProfileViews table creation failed." }

    Write-Host "Creating / refreshing aggregation view..." -ForegroundColor Yellow
    # Need to split GO manually (Invoke-Sqlcmd handles it if present)
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $viewSQL -QueryTimeout 60 | Out-Null

    if ($RetentionDays -gt 0) {
        Write-Host "Applying retention purge (> $RetentionDays days)..." -ForegroundColor Yellow
        $purgeSql = "DELETE FROM dbo.ApplicantProfileViews WHERE ViewedAt < DATEADD(DAY, -$RetentionDays, GETUTCDATE()); SELECT @@ROWCOUNT AS RowsPurged;"
        $purged = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $purgeSql -QueryTimeout 60
        $count = if ($purged.RowsPurged) { $purged.RowsPurged } else { 0 }
        Write-Host "Retention purge removed $count rows." -ForegroundColor Cyan
    }

    Write-Host "? Applicant profile views setup complete." -ForegroundColor Green
    Write-Host "Use in stats: (SELECT COUNT(*) FROM ApplicantProfileViews apv INNER JOIN Applicants a ON apv.ApplicantID=a.ApplicantID WHERE a.UserID=@param0) AS ProfileViews" -ForegroundColor Cyan
} catch {
    Write-Error "Failed: $($_.Exception.Message)"; exit 1
}
