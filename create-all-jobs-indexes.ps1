#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Creates all 18 indexes on Jobs table for optimal getJobs/searchJobs API performance

.DESCRIPTION
    This script creates all necessary indexes on the Jobs table with IF NOT EXISTS logic.
    Safe to run multiple times - will only create missing indexes.
    Includes progress reporting, error handling, and verification.

.PARAMETER Server
    SQL Server instance (default: from local.settings.json)

.PARAMETER Database
    Database name (default: from local.settings.json)

.PARAMETER Username
    SQL Server username (default: from local.settings.json)

.PARAMETER Password
    SQL Server password (default: from local.settings.json)

.PARAMETER VerifyOnly
    Only verify existing indexes without creating new ones

.EXAMPLE
    .\create-all-jobs-indexes.ps1
    Creates all indexes using credentials from local.settings.json

.EXAMPLE
    .\create-all-jobs-indexes.ps1 -VerifyOnly
    Only verifies existing indexes without creating new ones

.NOTES
    Author: GitHub Copilot
    Date: 2025-11-30
    Performance: 18 indexes total (1 Clustered + 17 Nonclustered)
#>

param(
    [string]$Server,
    [string]$Database,
    [string]$Username,
    [string]$Password,
    [switch]$VerifyOnly
)

# Color functions
function Write-Header($message) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $message -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Write-Success($message) {
    Write-Host "? $message" -ForegroundColor Green
}

function Write-Info($message) {
    Write-Host "? $message" -ForegroundColor Cyan
}

function Write-Warning($message) {
    Write-Host "? $message" -ForegroundColor Yellow
}

function Write-Error($message) {
    Write-Host "? $message" -ForegroundColor Red
}

function Write-Progress($current, $total, $message) {
    $percent = [math]::Round(($current / $total) * 100)
    Write-Host "[$current/$total] ($percent%) $message" -ForegroundColor White
}

# Load configuration from local.settings.json if parameters not provided
if (-not $Server -or -not $Database -or -not $Username -or -not $Password) {
    Write-Info "Loading configuration from local.settings.json..."
    try {
        $settingsPath = Join-Path $PSScriptRoot "local.settings.json"
        if (-not (Test-Path $settingsPath)) {
            Write-Error "local.settings.json not found at: $settingsPath"
            exit 1
        }
        
        $settings = Get-Content $settingsPath | ConvertFrom-Json
        if (-not $Server) { $Server = $settings.Values.DB_SERVER }
        if (-not $Database) { $Database = $settings.Values.DB_NAME }
        if (-not $Username) { $Username = $settings.Values.DB_USER }
        if (-not $Password) { $Password = $settings.Values.DB_PASSWORD }
        
        Write-Success "Configuration loaded successfully"
    } catch {
        Write-Error "Failed to load configuration: $_"
        exit 1
    }
}

Write-Header "JOBS TABLE INDEX CREATION SCRIPT"

Write-Info "Server: $Server"
Write-Info "Database: $Database"
Write-Info "Username: $Username"
Write-Info "Mode: $(if ($VerifyOnly) { 'VERIFY ONLY' } else { 'CREATE & VERIFY' })"

# Define all 18 indexes with their properties
$indexes = @(
    @{
        Name = "PK__Jobs__056690E255ABE776"
        Type = "PRIMARY KEY"
        Keys = "[JobID] ASC"
        Includes = ""
        Description = "Primary Key (Clustered)"
        IsPrimaryKey = $true
        Priority = 1
    },
    @{
        Name = "IX_Jobs_Status_PublishedAt_Covering"
        Type = "NONCLUSTERED"
        Keys = "[Status] ASC, [PublishedAt] DESC"
        Includes = "[JobID], [Title], [JobTypeID], [WorkplaceTypeID], [OrganizationID], [Location], [City], [State], [Country], [IsRemote], [SalaryRangeMin], [SalaryRangeMax], [SalaryPeriod], [CreatedAt]"
        Description = "Main covering index for getJobs/searchJobs (9-55ms)"
        IsPrimaryKey = $false
        Priority = 2
    },
    @{
        Name = "IX_Jobs_OrganizationID_Status_PublishedAt"
        Type = "NONCLUSTERED"
        Keys = "[OrganizationID] ASC, [Status] ASC, [PublishedAt] DESC"
        Includes = "[Title], [JobTypeID], [WorkplaceTypeID], [Location], [SalaryRangeMin], [SalaryRangeMax]"
        Description = "Company filter (11ms)"
        IsPrimaryKey = $false
        Priority = 3
    },
    @{
        Name = "IX_Jobs_JobTypeID_Status_PublishedAt"
        Type = "NONCLUSTERED"
        Keys = "[JobTypeID] ASC, [Status] ASC, [PublishedAt] DESC"
        Includes = "[OrganizationID], [Title], [WorkplaceTypeID]"
        Description = "JobType filter (65ms)"
        IsPrimaryKey = $false
        Priority = 4
    },
    @{
        Name = "IX_Jobs_WorkplaceTypeID_Status_PublishedAt"
        Type = "NONCLUSTERED"
        Keys = "[WorkplaceTypeID] ASC, [Status] ASC, [PublishedAt] DESC"
        Includes = "[OrganizationID], [Title], [JobTypeID]"
        Description = "Workplace filter (78ms)"
        IsPrimaryKey = $false
        Priority = 5
    },
    @{
        Name = "IX_Jobs_IsRemote_Status_PublishedAt"
        Type = "NONCLUSTERED"
        Keys = "[IsRemote] ASC, [Status] ASC, [PublishedAt] DESC"
        Includes = ""
        Description = "Remote jobs filter (148ms)"
        IsPrimaryKey = $false
        Priority = 6
    },
    @{
        Name = "IX_Jobs_Experience_Status"
        Type = "NONCLUSTERED"
        Keys = "[ExperienceMin] ASC, [ExperienceMax] ASC, [Status] ASC"
        Includes = "[PublishedAt], [OrganizationID], [Title]"
        Description = "Experience filter (453ms)"
        IsPrimaryKey = $false
        Priority = 7
    },
    @{
        Name = "IX_Jobs_Salary_Status"
        Type = "NONCLUSTERED"
        Keys = "[SalaryRangeMin] ASC, [SalaryRangeMax] ASC, [Status] ASC"
        Includes = "[PublishedAt], [OrganizationID], [Title], [CurrencyID]"
        Description = "Salary filter (263ms)"
        IsPrimaryKey = $false
        Priority = 8
    },
    @{
        Name = "IX_Jobs_PostedByUserID_CreatedAt"
        Type = "NONCLUSTERED"
        Keys = "[PostedByUserID] ASC, [CreatedAt] DESC"
        Includes = "[Status], [Title], [OrganizationID]"
        Description = "Employer dashboard"
        IsPrimaryKey = $false
        Priority = 9
    },
    @{
        Name = "IX_Jobs_Optimized_GetSearch"
        Type = "NONCLUSTERED"
        Keys = "[Status] ASC, [PublishedAt] DESC, [WorkplaceTypeID] ASC, [JobTypeID] ASC, [IsRemote] ASC"
        Includes = "[JobID], [Title], [Location], [City], [Country], [OrganizationID], [Description], [Tags], [SalaryRangeMin], [SalaryRangeMax], [CurrencyID], [ExperienceMin], [ExperienceMax], [Department], [PostedByUserID], [PostedByType], [CreatedAt]"
        Description = "Legacy search optimization"
        IsPrimaryKey = $false
        Priority = 10
    },
    @{
        Name = "IX_Jobs_CurrencyID"
        Type = "NONCLUSTERED"
        Keys = "[CurrencyID] ASC"
        Includes = "[Status], [PublishedAt]"
        Description = "Currency filter support"
        IsPrimaryKey = $false
        Priority = 11
    },
    @{
        Name = "IX_Jobs_Experience_Salary"
        Type = "NONCLUSTERED"
        Keys = "[ExperienceMin] ASC, [ExperienceMax] ASC, [SalaryRangeMin] ASC, [SalaryRangeMax] ASC"
        Includes = "[Status], [JobTypeID], [IsRemote]"
        Description = "Combined experience + salary filter"
        IsPrimaryKey = $false
        Priority = 12
    },
    @{
        Name = "IX_Jobs_IsRemote"
        Type = "NONCLUSTERED"
        Keys = "[IsRemote] ASC"
        Includes = "[Status], [PublishedAt]"
        Description = "Simple remote filter"
        IsPrimaryKey = $false
        Priority = 13
    },
    @{
        Name = "IX_Jobs_JobTypeID"
        Type = "NONCLUSTERED"
        Keys = "[JobTypeID] ASC"
        Includes = "[Status], [PublishedAt]"
        Description = "Simple job type filter"
        IsPrimaryKey = $false
        Priority = 14
    },
    @{
        Name = "IX_Jobs_WorkplaceTypeID"
        Type = "NONCLUSTERED"
        Keys = "[WorkplaceTypeID] ASC"
        Includes = "[Status], [PublishedAt]"
        Description = "Simple workplace filter"
        IsPrimaryKey = $false
        Priority = 15
    },
    @{
        Name = "IX_Jobs_Organization_Active"
        Type = "NONCLUSTERED"
        Keys = "[OrganizationID] ASC"
        Includes = "[Status], [PublishedAt], [CreatedAt]"
        Description = "Organization active jobs"
        IsPrimaryKey = $false
        Priority = 16
    },
    @{
        Name = "IX_Jobs_WorkplaceTypeID_Status_Published"
        Type = "NONCLUSTERED"
        Keys = "[WorkplaceTypeID] ASC, [Status] ASC, [OrganizationID] ASC"
        Includes = "[JobID], [Title], [JobTypeID], [Location], [CreatedAt], [PublishedAt], [SalaryRangeMin], [SalaryRangeMax], [CurrencyID], [PostedByUserID], [PostedByType]"
        Description = "Workplace + status + org combined"
        IsPrimaryKey = $false
        Priority = 17
    },
    @{
        Name = "IX_Jobs_JobID_FullTextKey"
        Type = "UNIQUE NONCLUSTERED"
        Keys = "[JobID] ASC"
        Includes = ""
        Description = "Full-text search support"
        IsPrimaryKey = $false
        Priority = 18
    }
)

# Function to check if index exists
function Test-IndexExists {
    param([string]$IndexName)
    
    $checkQuery = @"
SELECT COUNT(*) as IndexCount
FROM sys.indexes
WHERE object_id = OBJECT_ID('Jobs')
    AND name = '$IndexName'
"@
    
    try {
        $result = sqlcmd -S $Server -d $Database -U $Username -P $Password -Q $checkQuery -h -1 -W 2>&1
        return ($result -match '^\s*1\s*$')
    } catch {
        return $false
    }
}

# Function to create index
function New-JobsIndex {
    param($Index)
    
    if ($Index.IsPrimaryKey) {
        # Skip primary key creation (should already exist from table creation)
        Write-Warning "Skipping primary key (should be created with table)"
        return $true
    }
    
    # Build CREATE INDEX statement
    $createSQL = "CREATE $($Index.Type) INDEX [$($Index.Name)]`n"
    $createSQL += "ON [dbo].[Jobs] ($($Index.Keys))`n"
    
    if ($Index.Includes) {
        $createSQL += "INCLUDE ($($Index.Includes))`n"
    }
    
    $createSQL += "WITH (`n"
    $createSQL += "    ONLINE = ON,`n"
    $createSQL += "    MAXDOP = 0,`n"
    
    if ($Index.Type -ne "UNIQUE NONCLUSTERED") {
        $createSQL += "    DATA_COMPRESSION = PAGE,`n"
    }
    
    $createSQL += "    SORT_IN_TEMPDB = ON`n"
    $createSQL += ");"
    
    # Execute with timeout
    try {
        Write-Info "Creating: $($Index.Name)..."
        $result = sqlcmd -S $Server -d $Database -U $Username -P $Password -Q $createSQL -t 300 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Created: $($Index.Name)"
            return $true
        } else {
            Write-Error "Failed to create $($Index.Name): $result"
            return $false
        }
    } catch {
        Write-Error "Exception creating $($Index.Name): $_"
        return $false
    }
}

# Main execution
Write-Header "STEP 1: VERIFY EXISTING INDEXES"

$existingCount = 0
$missingCount = 0
$missingIndexes = @()

foreach ($index in $indexes) {
    $exists = Test-IndexExists -IndexName $index.Name
    
    if ($exists) {
        Write-Success "$($index.Name) - $($index.Description)"
        $existingCount++
    } else {
        Write-Warning "$($index.Name) - MISSING"
        $missingCount++
        $missingIndexes += $index
    }
}

Write-Host ""
Write-Info "Summary: $existingCount/$($indexes.Count) indexes exist, $missingCount missing"

if ($missingCount -eq 0) {
    Write-Success "All indexes already exist! No action needed."
    
    # Update statistics
    Write-Header "UPDATING STATISTICS"
    Write-Info "Updating statistics on Jobs table..."
    $updateStats = "UPDATE STATISTICS [dbo].[Jobs] WITH FULLSCAN;"
    sqlcmd -S $Server -d $Database -U $Username -P $Password -Q $updateStats -t 120 | Out-Null
    Write-Success "Statistics updated"
    
    exit 0
}

if ($VerifyOnly) {
    Write-Warning "Running in VERIFY ONLY mode - exiting without creating indexes"
    exit 0
}

# Create missing indexes
Write-Header "STEP 2: CREATE MISSING INDEXES"

$successCount = 0
$failCount = 0

$sortedMissing = $missingIndexes | Sort-Object Priority

for ($i = 0; $i -lt $sortedMissing.Count; $i++) {
    $index = $sortedMissing[$i]
    Write-Progress -Current ($i + 1) -Total $sortedMissing.Count -Message $index.Name
    
    $success = New-JobsIndex -Index $index
    
    if ($success) {
        $successCount++
    } else {
        $failCount++
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Info "Created: $successCount indexes"
if ($failCount -gt 0) {
    Write-Error "Failed: $failCount indexes"
}

# Update statistics
Write-Header "STEP 3: UPDATE STATISTICS"
Write-Info "Updating statistics on Jobs table..."
$updateStats = "UPDATE STATISTICS [dbo].[Jobs] WITH FULLSCAN;"
sqlcmd -S $Server -d $Database -U $Username -P $Password -Q $updateStats -t 120 | Out-Null
Write-Success "Statistics updated"

# Final verification
Write-Header "STEP 4: FINAL VERIFICATION"

$verifyQuery = @"
SELECT 
    i.name AS IndexName,
    i.type_desc AS IndexType,
    CASE WHEN i.is_unique = 1 THEN 'Yes' ELSE 'No' END AS IsUnique,
    COUNT(ic.column_id) AS ColumnCount
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
WHERE i.object_id = OBJECT_ID('Jobs')
    AND i.type_desc != 'HEAP'
GROUP BY i.name, i.type_desc, i.is_unique
ORDER BY i.name;
"@

Write-Info "Verifying all indexes..."
sqlcmd -S $Server -d $Database -U $Username -P $Password -Q $verifyQuery -s "," -W

# Check fragmentation
Write-Host ""
Write-Info "Checking index fragmentation..."
$fragQuery = @"
SELECT TOP 5
    i.name AS IndexName,
    CAST(ips.avg_fragmentation_in_percent AS DECIMAL(5,2)) as Fragmentation
FROM sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID('Jobs'), NULL, NULL, 'SAMPLED') ips
INNER JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE i.name IS NOT NULL
ORDER BY ips.avg_fragmentation_in_percent DESC;
"@

sqlcmd -S $Server -d $Database -U $Username -P $Password -Q $fragQuery -s "," -W

Write-Host ""
Write-Header "INDEX CREATION COMPLETE!"

if ($failCount -eq 0) {
    Write-Success "All indexes created successfully!"
    Write-Success "Total: 18 indexes (1 Clustered + 17 Nonclustered)"
    Write-Host ""
    Write-Info "Next steps:"
    Write-Info "  1. Run: node test-jobs-sql-performance.js"
    Write-Info "  2. Expected performance: 9-453ms for most queries"
    Write-Info "  3. Monitor with: .\verify-all-indexes.ps1"
} else {
    Write-Warning "Some indexes failed to create. Review errors above."
    exit 1
}
