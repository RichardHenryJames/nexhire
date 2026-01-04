<#
.SYNOPSIS
    RefOpen Job Scraper Management Script

.DESCRIPTION
    Provides management functions for the RefOpen job scraping system.
    It can trigger scraping, check status, configure settings, and view statistics.

.PARAMETER Action
    The action to perform: trigger, status, config, stats, cleanup, setup, test

.PARAMETER ConnectionString
    SQL Server connection string for the RefOpen database.

.PARAMETER ApiBaseUrl
    Base URL for the RefOpen API (default: https://refopen-api-func.azurewebsites.net/api)

.PARAMETER AdminToken
    Admin JWT token for API authentication.

.EXAMPLE
    .\job-scraper-manager.ps1 -Action trigger -ConnectionString $connectionString -AdminToken $token

.EXAMPLE
    .\job-scraper-manager.ps1 -Action setup -ConnectionString $connectionString

.EXAMPLE
    .\job-scraper-manager.ps1 -Action stats -ApiBaseUrl "https://refopen-api-func.azurewebsites.net/api" -AdminToken $token
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("trigger", "status", "config", "stats", "cleanup", "setup", "test")]
    [string]$Action,

    [Parameter(Mandatory = $false)]
    [string]$ConnectionString,

    [Parameter(Mandatory = $false)]
    [string]$ApiBaseUrl = "https://refopen-api-func.azurewebsites.net/api",

    [Parameter(Mandatory = $false)]
    [string]$AdminToken,

    [Parameter(Mandatory = $false)]
    [string]$AdminEmail = "admin@refopen.com",

    [Parameter(Mandatory = $false)]
    [string]$AdminPassword,  # Will be fetched from Key Vault if not provided

    [Parameter(Mandatory = $false)]
    [int]$CleanupDays = 90,

    [Parameter(Mandatory = $false)]
    [string]$Source
)

# Import required modules
try {
    Import-Module SqlServer -ErrorAction SilentlyContinue
} catch {
    Write-Warning "SQL Server module not available. Some functions may not work."
}

# ============================
# Helper Functions
# ============================

function Write-Header {
    param([string]$Title)
    Write-Host "`n=== $Title ===" -ForegroundColor Cyan
}

function Get-AdminToken {
    if ($script:AdminToken) { return $script:AdminToken }
    if ($AdminToken) { $script:AdminToken = $AdminToken; return $AdminToken }

    Write-Host "🔐 Logging in as admin ($AdminEmail)..." -ForegroundColor Yellow

    # Fetch password from Key Vault if not provided
    $pwd = $AdminPassword
    if (-not $pwd) {
        $pwd = az keyvault secret show --vault-name "refopen-keyvault-prod" --name "AdminPassword" --query "value" -o tsv 2>$null
        if (-not $pwd) {
            Write-Error "❌ AdminPassword not provided and failed to fetch from Key Vault"
            return $null
        }
    }

    $loginBody = @{
        email    = $AdminEmail
        password = $pwd
    } | ConvertTo-Json

    try {
        $loginUrl = $ApiBaseUrl.Replace("/api", "") + "/api/auth/login"
        $response = Invoke-RestMethod -Uri $loginUrl -Method POST -Body $loginBody -ContentType "application/json"

        if ($response.success) {
            $script:AdminToken = $response.data.tokens.accessToken
            Write-Host "✔ Login successful!" -ForegroundColor Green
            return $script:AdminToken
        } else {
            Write-Error "Login failed: $($response.error)"
            return $null
        }
    } catch {
        Write-Error "Login error: $($_.Exception.Message)"
        return $null
    }
}

function Invoke-ApiCall {
    param(
        [string]$Endpoint,
        [string]$Method = "GET",
        [hashtable]$Body = $null,
        [hashtable]$Headers = @{}
    )

    # Get token if needed
    if (-not $Headers.ContainsKey("Authorization") -and ($Endpoint -notlike "*health*" -and $Endpoint -notlike "*ping*")) {
        $token = Get-AdminToken
        if ($token) { $Headers["Authorization"] = "Bearer $token" }
    }

    $Headers["Content-Type"] = "application/json"
    $uri = "$ApiBaseUrl/$Endpoint"

    try {
        $params = @{
            Uri     = $uri
            Method  = $Method
            Headers = $Headers
        }
        if ($Body) { $params.Body = $Body | ConvertTo-Json -Depth 10 }

        return Invoke-RestMethod @params
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

# ============================
# Validation and Setup
# ============================

function Test-Prerequisites {
    Write-Header "Testing Prerequisites"
    $checks = @()

    # Database connection
    if ($ConnectionString) {
        try {
            $testQuery = "SELECT COUNT(*) as JobCount FROM Jobs"
            $result = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $testQuery -ErrorAction Stop
            $checks += @{ Name = "Database Connection"; Status = "✔ OK"; Details = "$($result.JobCount) jobs found" }
        } catch {
            $checks += @{ Name = "Database Connection"; Status = "✖ Failed"; Details = $_.Exception.Message }
        }
    } else {
        $checks += @{ Name = "Database Connection"; Status = "⚠ Skipped"; Details = "No connection string provided" }
    }

    # API connection
    try {
        $health = Invoke-ApiCall -Endpoint "jobs/scrape/health"
        if ($health) {
            $checks += @{ Name = "API Connection"; Status = "✔ OK"; Details = "Scraper service healthy" }
        }
    } catch {
        $checks += @{ Name = "API Connection"; Status = "✖ Failed"; Details = "Cannot reach API endpoint" }
    }

    # Tables existence
    if ($ConnectionString) {
        $tables = @("Jobs", "Organizations", "JobTypes", "WorkplaceTypes", "Currencies")
        foreach ($table in $tables) {
            try {
                $checkQuery = "SELECT COUNT(*) as Count FROM $table"
                $result = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $checkQuery -ErrorAction Stop
                $checks += @{ Name = "$table Table"; Status = "✔ OK"; Details = "$($result.Count) records" }
            } catch {
                $checks += @{ Name = "$table Table"; Status = "⚠ Missing"; Details = "Table not found or empty" }
            }
        }
    }

    # Print summary
    foreach ($check in $checks) {
        $color = switch -regex ($check.Status) {
            "✔" { "Green" }
            "✖" { "Red" }
            "⚠" { "Yellow" }
        }
        Write-Host "  $($check.Name): $($check.Status) - $($check.Details)" -ForegroundColor $color
    }
}

function Set-DatabaseTables {
    if (-not $ConnectionString) {
        Write-Error "ConnectionString is required for database setup"
        return
    }

    Write-Header "Setting Up Database Tables"
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
        CreatedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
    );
END
"@
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
        CreatedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
    );
END
"@
    try {
        Write-Host "Creating SchedulerLogs table..." -ForegroundColor Yellow
        Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $schedulerLogsTable
        Write-Host "Creating DailyJobStats table..." -ForegroundColor Yellow
        Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $dailyJobStatsTable
        Write-Host "✔ Database tables setup completed successfully" -ForegroundColor Green
    } catch {
        Write-Error "Failed to create tables: $($_.Exception.Message)"
    }
}

# ============================
# Scraping Actions
# ============================

function Start-JobScraping {
    Write-Header "Triggering Job Scraping"
    Write-Host "Starting job scraping..." -ForegroundColor Yellow
    $result = Invoke-ApiCall -Endpoint "jobs/scrape/trigger" -Method "POST"
    if ($result -and $result.success) {
        Write-Host "✔ Job scraping completed successfully!" -ForegroundColor Green
        Write-Host "Jobs Added: $($result.data.jobsAdded)"
        Write-Host "Total Scraped: $($result.data.totalJobsScraped)"
    } else {
        Write-Error "Job scraping failed or returned no results."
    }
}

function Get-ScrapingStatus {
    Write-Header "Scraper Status"
    $health = Invoke-ApiCall -Endpoint "jobs/scrape/health"
    if ($health -and $health.success) {
        $s = $health.data
        Write-Host "✔ Status: $($s.status)"
        Write-Host "Scraping Enabled: $($s.scrapingEnabled)"
        Write-Host "Database Connected: $($s.databaseConnected)"
        Write-Host "Total Scraped Jobs: $($s.totalScrapedJobs)"
        Write-Host "Jobs Last 24h: $($s.jobsLast24h)"
        Write-Host "Last Updated: $($s.timestamp)"
    } else {
        Write-Host "✖ Unable to get scraper status" -ForegroundColor Red
    }
}

function Get-ScrapingConfig {
    Write-Header "Scraping Configuration"
    $config = Invoke-ApiCall -Endpoint "jobs/scrape/config"
    if ($config -and $config.success) {
        $cfg = $config.data
        Write-Host "Enabled: $($cfg.enabled)"
        Write-Host "Max Jobs Per Run: $($cfg.maxJobsPerRun)"
        Write-Host "India Focus: $($cfg.indiaFocus)"
    } else {
        Write-Error "Failed to retrieve configuration"
    }
}

function Get-ScrapingStats {
    Write-Header "Scraping Statistics"
    $stats = Invoke-ApiCall -Endpoint "jobs/scrape/stats"
    if ($stats -and $stats.success) {
        $summary = $stats.data.summary
        Write-Host "✔ Total Scraped Jobs: $($summary.TotalScrapedJobs)"
        Write-Host "Jobs Last 24h: $($summary.JobsLast24h)"
    } else {
        Write-Error "Failed to retrieve statistics"
    }
}

function Start-Cleanup {
    Write-Header "Database Cleanup"
    $params = @{ daysOld = $CleanupDays }
    if ($Source) { $params.source = $Source }
    $query = ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "&"
    $endpoint = "jobs/scrape/cleanup?$query"
    $result = Invoke-ApiCall -Endpoint $endpoint -Method "DELETE"
    if ($result -and $result.success) {
        Write-Host "✔ Cleanup completed successfully!" -ForegroundColor Green
        Write-Host "Deleted Jobs: $($result.data.deletedCount)"
    } else {
        Write-Error "Cleanup failed."
    }
}

# ============================
# Main Execution
# ============================

switch ($Action) {
    "setup"   { Test-Prerequisites; Set-DatabaseTables }
    "trigger" { Start-JobScraping }
    "status"  { Get-ScrapingStatus }
    "config"  { Get-ScrapingConfig }
    "stats"   { Get-ScrapingStats }
    "cleanup" { Start-Cleanup }
    "test"    { Test-Prerequisites }
}

Write-Host "`n✔ Job scraper management completed!" -ForegroundColor Cyan
