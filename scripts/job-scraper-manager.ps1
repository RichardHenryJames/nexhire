<#
.SYNOPSIS
    RefOpen Job Scraper Management Script

.DESCRIPTION
    This script provides management functions for the RefOpen job scraping system.
    It can trigger scraping, check status, configure settings, and view statistics.

.PARAMETER Action
    The action to perform: trigger, status, config, stats, cleanup, setup

.PARAMETER ConnectionString
    SQL Server connection string for the RefOpen database

.PARAMETER ApiBaseUrl
    Base URL for the RefOpen API (default: http://localhost:7071/api)

.PARAMETER AdminToken
    Admin JWT token for API authentication

.EXAMPLE
    .\job-scraper-manager.ps1 -Action trigger -ConnectionString $connectionString -AdminToken $token
    
.EXAMPLE
    .\job-scraper-manager.ps1 -Action setup -ConnectionString $connectionString

.EXAMPLE
    .\job-scraper-manager.ps1 -Action stats -ApiBaseUrl "https://refopen-api-func.azurewebsites.net/api" -AdminToken $token
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("trigger", "status", "config", "stats", "cleanup", "setup", "test")]
    [string]$Action,
    
    [Parameter(Mandatory=$false)]
    [string]$ConnectionString,
    
    [Parameter(Mandatory=$false)]
    [string]$ApiBaseUrl = "http://localhost:7071/api",
    
    [Parameter(Mandatory=$false)]
    [string]$AdminToken,
    
    [Parameter(Mandatory=$false)]
    [int]$CleanupDays = 90,
    
    [Parameter(Mandatory=$false)]
    [string]$Source
)

# Import required modules
try {
    Import-Module SqlServer -ErrorAction SilentlyContinue
} catch {
    Write-Warning "SQL Server module not available. Some functions may not work."
}

function Write-Header {
    param([string]$Title)
    Write-Host "`n?? $Title" -ForegroundColor Cyan
    Write-Host ("=" * ($Title.Length + 3)) -ForegroundColor Cyan
}

function Invoke-ApiCall {
    param(
        [string]$Endpoint,
        [string]$Method = "GET",
        [hashtable]$Body = $null,
        [hashtable]$Headers = @{}
    )
    
    if ($AdminToken) {
        $Headers["Authorization"] = "Bearer $AdminToken"
    }
    
    $Headers["Content-Type"] = "application/json"
    
    $uri = "$ApiBaseUrl/$Endpoint"
    
    try {
        $params = @{
            Uri = $uri
            Method = $Method
            Headers = $Headers
        }
        
        if ($Body) {
            $params.Body = $Body | ConvertTo-Json -Depth 10
        }
        
        $response = Invoke-RestMethod @params
        return $response
        
    } catch {
        Write-Error "API call failed: $($_.Exception.Message)"
        if ($_.Exception.Response) {
            $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            Write-Host "Error details: $errorBody" -ForegroundColor Red
        }
        return $null
    }
}

function Test-Prerequisites {
    Write-Header "Testing Prerequisites"
    
    $checks = @()
    
    # Check database connection
    if ($ConnectionString) {
        try {
            $testQuery = "SELECT COUNT(*) as JobCount FROM Jobs"
            $result = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $testQuery -ErrorAction Stop
            $checks += @{ Name = "Database Connection"; Status = "? OK"; Details = "$($result.JobCount) jobs in database" }
        } catch {
            $checks += @{ Name = "Database Connection"; Status = "? Failed"; Details = $_.Exception.Message }
        }
    } else {
        $checks += @{ Name = "Database Connection"; Status = "?? Skipped"; Details = "No connection string provided" }
    }
    
    # Check API connection
    try {
        $health = Invoke-ApiCall -Endpoint "health/scraper"
        if ($health) {
            $checks += @{ Name = "API Connection"; Status = "? OK"; Details = "Scraper service healthy" }
        }
    } catch {
        $checks += @{ Name = "API Connection"; Status = "? Failed"; Details = "Cannot reach API endpoint" }
    }
    
    # Check required tables
    if ($ConnectionString) {
        $requiredTables = @("Jobs", "Organizations", "JobTypes", "WorkplaceTypes", "Currencies")
        foreach ($table in $requiredTables) {
            try {
                $checkQuery = "SELECT COUNT(*) as count FROM $table"
                $result = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $checkQuery -ErrorAction Stop
                $checks += @{ Name = "$table Table"; Status = "? OK"; Details = "$($result.count) records" }
            } catch {
                $checks += @{ Name = "$table Table"; Status = "? Missing"; Details = "Table not found or empty" }
            }
        }
    }
    
    # Display results
    $checks | ForEach-Object {
        Write-Host "  $($_.Name): $($_.Status) - $($_.Details)" -ForegroundColor $(
            if ($_.Status.StartsWith("?")) { "Green" }
            elseif ($_.Status.StartsWith("?")) { "Red" }
            else { "Yellow" }
        )
    }
    
    return $checks
}

function Set-DatabaseTables {
    if (-not $ConnectionString) {
        Write-Error "ConnectionString is required for database setup"
        return
    }
    
    Write-Header "Setting Up Database Tables"
    
    # Create SchedulerLogs table
    $schedulerLogsTable = @"
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SchedulerLogs')
        BEGIN
            CREATE TABLE SchedulerLogs (
                LogId BIGINT IDENTITY(1,1) PRIMARY KEY,
                TaskId NVARCHAR(100) NOT NULL,
                TaskName NVARCHAR(200) NOT NULL,
                Status NVARCHAR(50) NOT NULL,
                Data NVARCHAR(MAX),
                ErrorMessage NVARCHAR(MAX),
                CreatedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
                INDEX IDX_SchedulerLogs_TaskId_CreatedAt (TaskId, CreatedAt DESC)
            );
            PRINT 'SchedulerLogs table created successfully';
        END
        ELSE
        BEGIN
            PRINT 'SchedulerLogs table already exists';
        END
"@
    
    # Create DailyJobStats table
    $dailyJobStatsTable = @"
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DailyJobStats')
        BEGIN
            CREATE TABLE DailyJobStats (
                StatId BIGINT IDENTITY(1,1) PRIMARY KEY,
                StatDate DATE NOT NULL UNIQUE,
                JobsPosted INT NOT NULL DEFAULT 0,
                ScrapedJobs INT NOT NULL DEFAULT 0,
                UserPostedJobs INT NOT NULL DEFAULT 0,
                UniqueOrganizations INT NOT NULL DEFAULT 0,
                CreatedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
                UpdatedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
                INDEX IDX_DailyJobStats_StatDate (StatDate DESC)
            );
            PRINT 'DailyJobStats table created successfully';
        END
        ELSE
        BEGIN
            PRINT 'DailyJobStats table already exists';
        END
"@
    
    try {
        Write-Host "?? Creating SchedulerLogs table..." -ForegroundColor Yellow
        Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $schedulerLogsTable
        
        Write-Host "?? Creating DailyJobStats table..." -ForegroundColor Yellow
        Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $dailyJobStatsTable
        
        Write-Host "? Database tables setup completed successfully" -ForegroundColor Green
        
    } catch {
        Write-Error "Failed to create tables: $($_.Exception.Message)"
    }
}

function Start-JobScraping {
    Write-Header "Triggering Job Scraping"
    
    if (-not $AdminToken) {
        Write-Error "AdminToken is required to trigger job scraping"
        return
    }
    
    Write-Host "??? Starting job scraping process..." -ForegroundColor Yellow
    
    $result = Invoke-ApiCall -Endpoint "admin/jobs/scrape/trigger" -Method "POST"
    
    if ($result -and $result.success) {
        Write-Host "? Job scraping completed successfully!" -ForegroundColor Green
        Write-Host "   Jobs added: $($result.meta.jobsAdded)" -ForegroundColor Cyan
        
        if ($result.meta.errors -and $result.meta.errors.Count -gt 0) {
            Write-Host "   Errors encountered: $($result.meta.errors.Count)" -ForegroundColor Yellow
            $result.meta.errors | ForEach-Object {
                Write-Host "     - $_" -ForegroundColor Yellow
            }
        }
        
        Write-Host "   Completed at: $($result.meta.timestamp)" -ForegroundColor Cyan
    } else {
        Write-Error "Job scraping failed or returned no results"
    }
}

function Get-ScrapingStatus {
    Write-Header "Job Scraping Status"
    
    $health = Invoke-ApiCall -Endpoint "health/scraper"
    
    if ($health -and $health.success) {
        $status = $health.data
        
        Write-Host "?? Scraper Service Status: $($status.status)" -ForegroundColor Green
        Write-Host "   Scraping Enabled: $($status.scrapingEnabled)" -ForegroundColor Cyan
        Write-Host "   Database Connected: $($status.databaseConnected)" -ForegroundColor Cyan
        Write-Host "   Recent Jobs (24h): $($status.recentJobsLast24h)" -ForegroundColor Cyan
        Write-Host "   Next Scheduled Run: $($status.nextScheduledRun)" -ForegroundColor Cyan
        Write-Host "   Active Sources: $($status.activeSources -join ', ')" -ForegroundColor Cyan
        Write-Host "   Last Updated: $($status.timestamp)" -ForegroundColor Gray
        
    } else {
        Write-Host "? Unable to get scraper status" -ForegroundColor Red
    }
}

function Get-ScrapingConfig {
    Write-Header "Job Scraping Configuration"
    
    if (-not $AdminToken) {
        Write-Error "AdminToken is required to view configuration"
        return
    }
    
    $config = Invoke-ApiCall -Endpoint "admin/jobs/scrape/config"
    
    if ($config -and $config.success) {
        $cfg = $config.data
        
        Write-Host "?? Scraping Configuration:" -ForegroundColor Cyan
        Write-Host "   Enabled: $($cfg.enabled)" -ForegroundColor White
        Write-Host "   Interval (hours): $($cfg.interval)" -ForegroundColor White
        Write-Host "   Max Jobs Per Run: $($cfg.maxJobsPerRun)" -ForegroundColor White
        
        Write-Host "`n?? Target Locations:" -ForegroundColor Cyan
        $cfg.locations | ForEach-Object { Write-Host "     - $_" -ForegroundColor White }
        
        Write-Host "`n?? Active Sources:" -ForegroundColor Cyan
        $cfg.sources.PSObject.Properties | Where-Object { $_.Value.enabled } | ForEach-Object {
            Write-Host "     - $($_.Name)" -ForegroundColor Green
        }
        
        Write-Host "`n?? Disabled Sources:" -ForegroundColor Cyan
        $cfg.sources.PSObject.Properties | Where-Object { -not $_.Value.enabled } | ForEach-Object {
            Write-Host "     - $($_.Name)" -ForegroundColor Red
        }
        
        if ($cfg.excludeKeywords -and $cfg.excludeKeywords.Count -gt 0) {
            Write-Host "`n?? Excluded Keywords:" -ForegroundColor Cyan
            $cfg.excludeKeywords | ForEach-Object { Write-Host "     - $_" -ForegroundColor Yellow }
        }
        
    } else {
        Write-Error "Failed to retrieve configuration"
    }
}

function Get-ScrapingStats {
    Write-Header "Job Scraping Statistics"
    
    if (-not $AdminToken) {
        Write-Error "AdminToken is required to view statistics"
        return
    }
    
    $stats = Invoke-ApiCall -Endpoint "admin/jobs/scrape/stats"
    
    if ($stats -and $stats.success) {
        $overall = $stats.data.overall
        $sources = $stats.data.bySources
        
        Write-Host "?? Overall Statistics:" -ForegroundColor Cyan
        Write-Host "   Total Scraped Jobs: $($overall.TotalScrapedJobs)" -ForegroundColor White
        Write-Host "   System Generated Jobs: $($overall.SystemGeneratedJobs)" -ForegroundColor White
        Write-Host "   Jobs Last 24 Hours: $($overall.JobsLast24Hours)" -ForegroundColor Green
        Write-Host "   Jobs Last 7 Days: $($overall.JobsLast7Days)" -ForegroundColor Green
        Write-Host "   Jobs Last 30 Days: $($overall.JobsLast30Days)" -ForegroundColor Green
        Write-Host "   Unique Sources: $($overall.UniqueSources)" -ForegroundColor White
        
        if ($sources -and $sources.Count -gt 0) {
            Write-Host "`n?? By Source:" -ForegroundColor Cyan
            $sources | ForEach-Object {
                Write-Host "   $($_.Source): $($_.JobCount) jobs (last: $(Get-Date $_.LastScrapedAt -Format 'yyyy-MM-dd HH:mm'))" -ForegroundColor White
            }
        }
        
        Write-Host "`n? Generated at: $($stats.data.generatedAt)" -ForegroundColor Gray
        
    } else {
        Write-Error "Failed to retrieve statistics"
    }
}

function Start-Cleanup {
    Write-Header "Database Cleanup"
    
    if (-not $AdminToken) {
        Write-Error "AdminToken is required to perform cleanup"
        return
    }
    
    $params = @{
        daysOld = $CleanupDays
    }
    
    if ($Source) {
        $params.source = $Source
        Write-Host "?? Cleaning up jobs from source: $Source (older than $CleanupDays days)" -ForegroundColor Yellow
    } else {
        Write-Host "?? Cleaning up all scraped jobs older than $CleanupDays days..." -ForegroundColor Yellow
    }
    
    $queryString = ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "&"
    $endpoint = "admin/jobs/scrape/cleanup?$queryString"
    
    $result = Invoke-ApiCall -Endpoint $endpoint -Method "DELETE"
    
    if ($result -and $result.success) {
        Write-Host "? Cleanup completed successfully!" -ForegroundColor Green
        Write-Host "   Deleted Jobs: $($result.data.deletedCount)" -ForegroundColor Cyan
        Write-Host "   Criteria: $($result.data.criteria.daysOld) days old, source: $($result.data.criteria.source)" -ForegroundColor Cyan
        Write-Host "   Only Zero Applications: $($result.data.criteria.onlyWithZeroApplications)" -ForegroundColor Cyan
    } else {
        Write-Error "Cleanup failed or returned no results"
    }
}

function Test-ScrapingSources {
    Write-Header "Testing Job Scraping Sources"
    
    # Test common job sites
    $sources = @(
        @{ Name = "RemoteOK"; Url = "https://remoteok.io/api"; Type = "API" },
        @{ Name = "WeWorkRemotely"; Url = "https://weworkremotely.com"; Type = "Web" },
        @{ Name = "AngelList"; Url = "https://wellfound.com"; Type = "Web" }
    )
    
    foreach ($source in $sources) {
        try {
            Write-Host "Testing $($source.Name)..." -ForegroundColor Yellow
            
            $response = Invoke-WebRequest -Uri $source.Url -TimeoutSec 10 -UseBasicParsing
            
            if ($response.StatusCode -eq 200) {
                Write-Host "  ? $($source.Name): OK (Status: $($response.StatusCode))" -ForegroundColor Green
            } else {
                Write-Host "  ?? $($source.Name): Warning (Status: $($response.StatusCode))" -ForegroundColor Yellow
            }
            
        } catch {
            Write-Host "  ? $($source.Name): Failed - $($_.Exception.Message)" -ForegroundColor Red
        }
        
        Start-Sleep -Milliseconds 500
    }
}

# Main execution logic
switch ($Action) {
    "setup" {
        Test-Prerequisites
        Set-DatabaseTables
    }
    
    "trigger" {
        Start-JobScraping
    }
    
    "status" {
        Get-ScrapingStatus
    }
    
    "config" {
        Get-ScrapingConfig
    }
    
    "stats" {
        Get-ScrapingStats
    }
    
    "cleanup" {
        Start-Cleanup
    }
    
    "test" {
        Test-Prerequisites
        Test-ScrapingSources
    }
}

Write-Host "`n? Job scraper management completed!" -ForegroundColor Cyan