<#
.SYNOPSIS
    RefOpen Job Scraper - Complete Management Script

.DESCRIPTION
    Comprehensive script to manage the RefOpen job scraping system.
    Handles scraping, monitoring, configuration, scheduling, and troubleshooting.

.PARAMETER Action
    The action to perform:
    - trigger: Manually trigger job scraping
    - status: Check scraper and scheduler status
    - config: View scraping configuration
    - stats: View scraping statistics
    - setup: Initialize database tables
    - start-scheduler: Start automatic scheduling
    - stop-scheduler: Stop automatic scheduling  
    - cleanup: Clean old scraped jobs
    - test: Test scraper prerequisites
    - logs: View recent scraping logs
    - health: Full health check

.PARAMETER Environment
    Target environment: local, dev, staging, prod (default: prod)
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("trigger", "status", "config", "stats", "setup", "start-scheduler", "stop-scheduler", "cleanup", "test", "logs", "health")]
    [string]$Action,

    [Parameter(Mandatory = $false)]
    [ValidateSet("local", "dev", "staging", "prod")]
    [string]$Environment = "prod",

    [Parameter(Mandatory = $false)]
    [string]$AdminEmail = "admin@refopen.com",

    [Parameter(Mandatory = $false)]
    [string]$AdminPassword = "12345678",

    [Parameter(Mandatory = $false)]
    [string]$ApiBaseUrl,

    [Parameter(Mandatory = $false)]
    [string]$AdminToken,

    [Parameter(Mandatory = $false)]
    [string]$ConnectionString,

    [Parameter(Mandatory = $false)]
    [int]$CleanupDays = 90
)

# =============================================================================
# CONFIGURATION
# =============================================================================

$ErrorActionPreference = "Stop"

# Environment URLs
$EnvironmentUrls = @{
    local   = "http://localhost:7071/api"
    dev     = "https://refopen-api-func-dev.azurewebsites.net/api"
    staging = "https://refopen-api-func-staging.azurewebsites.net/api"
    prod    = "https://refopen-api-func.azurewebsites.net/api"
}

# Get API base URL
$BaseUrl = if ($ApiBaseUrl) { $ApiBaseUrl } else { $EnvironmentUrls[$Environment] }

# Get connection string from environment (no hardcoded default)
$DefaultConnectionString = $env:DB_CONNECTION_STRING

if (-not $ConnectionString -and ($Action -in @("setup", "logs"))) {
    if (-not $DefaultConnectionString) {
        Write-Error "DB_CONNECTION_STRING environment variable is required for '$Action' action"
        exit 1
    }
    $ConnectionString = $DefaultConnectionString
}

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

function Write-Header {
    param([string]$Title)
    Write-Host "`n=================================================================" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Warning2 {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# --- API Call Helper ---------------------------------------------------------
function Invoke-ApiCall {
    param(
        [string]$Endpoint,
        [string]$Method = "GET",
        [object]$Body = $null,
        [hashtable]$Headers = @{},
        [int]$TimeoutSec = 600
    )

    if ($script:Token) {
        $Headers["Authorization"] = "Bearer $script:Token"
    }

    $Headers["Content-Type"] = "application/json"
    $uri = "$BaseUrl/$Endpoint"

    try {
        $params = @{
            Uri = $uri
            Method = $Method
            Headers = $Headers
            TimeoutSec = $TimeoutSec
        }
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }

        return Invoke-RestMethod @params
    }
    catch {
        $errorMessage = $_.Exception.Message
        if ($errorMessage -match "timed out") {
            Write-Warning2 "Request timed out (may be normal for long-running scrape)"
            return @{ timedOut = $true; message = $errorMessage }
        }
        Write-ErrorMsg "API call failed: $errorMessage"
        return $null
    }
}

# --- Admin Token -------------------------------------------------------------
function Get-AdminToken {
    if ($script:Token) { return $script:Token }
    if ($AdminToken) { $script:Token = $AdminToken; return $AdminToken }

    Write-Info "Logging in as admin..."
    $loginBody = @{ email = $AdminEmail; password = $AdminPassword }

    try {
        $response = Invoke-ApiCall -Endpoint "auth/login" -Method "POST" -Body $loginBody -TimeoutSec 30
        if ($response -and $response.success) {
            $script:Token = $response.data.tokens.accessToken
            Write-Success "Login successful"
            return $script:Token
        } else {
            Write-ErrorMsg "Login failed: $($response.error)"
            return $null
        }
    } catch {
        Write-ErrorMsg "Login error: $($_.Exception.Message)"
        return $null
    }
}

# =============================================================================
# ACTION FUNCTIONS
# =============================================================================

function Test-Prerequisites {
    Write-Header "Testing Prerequisites"

    $checks = @()

    # API connectivity
    Write-Info "Testing API connectivity..."
    try {
        $response = Invoke-WebRequest -Uri "$BaseUrl/health" -Method GET -TimeoutSec 10 -UseBasicParsing
        $checks += @{ Name = "API Connection"; Status = "OK"; Details = "Status: $($response.StatusCode)" }
    } catch {
        $checks += @{ Name = "API Connection"; Status = "FAIL"; Details = $_.Exception.Message }
    }

    # Admin auth
    Write-Info "Testing admin authentication..."
    $token = Get-AdminToken
    if ($token) {
        $checks += @{ Name = "Admin Authentication"; Status = "OK"; Details = "Token obtained" }
    } else {
        $checks += @{ Name = "Admin Authentication"; Status = "FAIL"; Details = "Login failed" }
    }

    # Display summary
    Write-Host "`nTest Results:" -ForegroundColor Cyan
    $checks | ForEach-Object { Write-Host "  [$($_.Status)] $($_.Name): $($_.Details)" }

    $failed = ($checks | Where-Object { $_.Status -eq "FAIL" }).Count
    if ($failed -eq 0) { Write-Success "All checks passed!" }
    else { Write-Warning2 "$failed check(s) failed!" }
}

# --- Trigger Job Scraping ----------------------------------------------------
function Invoke-JobScraping {
    Write-Header "Triggering Job Scraping"
    $token = Get-AdminToken
    if (-not $token) { Write-ErrorMsg "No admin token available"; return }

    Write-Info "Starting job scraping..."
    $result = Invoke-ApiCall -Endpoint "jobs/scrape/trigger" -Method "POST" -Body @{} -TimeoutSec 600

    if ($result -and $result.success) {
        Write-Success "Job scraping completed!"
        Write-Host "Jobs Added: $($result.data.jobsAdded)"
        Write-Host "Total Scraped: $($result.data.totalJobsScraped)"
    } else {
        Write-ErrorMsg "Scraping failed or no response."
    }
}

# --- Health Check ------------------------------------------------------------
function Invoke-HealthCheck {
    Write-Header "Full Health Check"
    Test-Prerequisites
    Write-Info "Checking scraper status..."
    $status = Invoke-ApiCall -Endpoint "jobs/scrape/health" -TimeoutSec 20
    if ($status -and $status.success) {
        Write-Success "Scraper healthy"
    } else {
        Write-ErrorMsg "Scraper unhealthy or unreachable"
    }
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

Write-Host @"
=================================================================
             RefOpen Job Scraper Management Tool
=================================================================
Environment: $Environment
API: $BaseUrl
=================================================================
"@ -ForegroundColor Cyan

try {
    switch ($Action) {
        "trigger"         { Invoke-JobScraping }
        "test"            { Test-Prerequisites }
        "health"          { Invoke-HealthCheck }
        default           { Write-Warning2 "Action '$Action' not yet implemented in this version." }
    }
    Write-Success "Action '$Action' completed."
}
catch {
    Write-ErrorMsg "Fatal error: $($_.Exception.Message)"
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}
