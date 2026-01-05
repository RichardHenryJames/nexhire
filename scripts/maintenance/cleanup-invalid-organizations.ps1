# ============================================================================
# CLEANUP INVALID ORGANIZATIONS - PowerShell Script
# ============================================================================
# This script identifies and removes invalid organization entries
# 
# USAGE:
#   .\scripts\cleanup-invalid-organizations.ps1                    # DRY RUN (default)
#   .\scripts\cleanup-invalid-organizations.ps1 -Execute           # EXECUTE (actually delete)
# ============================================================================

param(
    [switch]$Execute = $false,
    [string]$KeyVaultName = "refopen-keyvault-prod"
)

# Connection string from environment or Key Vault
$ConnectionString = $env:DB_CONNECTION_STRING

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

# Colors for output
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

# Execute SQL query
function Invoke-SqlQuery {
    param([string]$Query)
    
    try {
        $connection = New-Object System.Data.SqlClient.SqlConnection($ConnectionString)
        $connection.Open()
        
        $command = $connection.CreateCommand()
        $command.CommandText = $Query
        $command.CommandTimeout = 120
        
        $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($command)
        $dataset = New-Object System.Data.DataSet
        $adapter.Fill($dataset) | Out-Null
        
        $connection.Close()
        
        return $dataset.Tables[0]
    }
    catch {
        Write-ColorOutput "? SQL Error: $_" "Red"
        throw
    }
}

# Execute SQL non-query (UPDATE, DELETE, etc.)
function Invoke-SqlNonQuery {
    param([string]$Query)
    
    try {
        $connection = New-Object System.Data.SqlClient.SqlConnection($ConnectionString)
        $connection.Open()
        
        $command = $connection.CreateCommand()
        $command.CommandText = $Query
        $command.CommandTimeout = 120
        
        $rowsAffected = $command.ExecuteNonQuery()
        
        $connection.Close()
        
        return $rowsAffected
    }
    catch {
        Write-ColorOutput "? SQL Error: $_" "Red"
        throw
    }
}

# Main script
Write-ColorOutput "================================================================" "Cyan"
Write-ColorOutput "?? INVALID ORGANIZATION CLEANUP SCRIPT" "Cyan"
Write-ColorOutput "================================================================" "Cyan"

if ($Execute) {
    Write-ColorOutput "Mode: ??  EXECUTE (will make changes)" "Yellow"
} else {
    Write-ColorOutput "Mode: ?? DRY RUN (no changes)" "Green"
}

Write-ColorOutput "================================================================" "Cyan"
Write-Host ""

# Step 1: Identify invalid organizations
Write-ColorOutput "?? Analyzing Organizations..." "Cyan"
Write-Host ""

# Excel Errors
Write-ColorOutput "1?? EXCEL ERRORS:" "Yellow"
$excelErrors = Invoke-SqlQuery @"
SELECT 
    OrganizationID,
    Name,
    (SELECT COUNT(*) FROM Jobs WHERE Jobs.OrganizationID = Organizations.OrganizationID) as JobCount
FROM Organizations
WHERE IsActive = 1
  AND (Name LIKE '#REF%' 
    OR Name LIKE '#NAME%' 
    OR Name LIKE '#VALUE%'
    OR Name LIKE '#DIV%'
    OR Name LIKE '#N/A%'
    OR Name LIKE '#NULL%'
    OR Name LIKE '#NUM%')
ORDER BY Name
"@

if ($excelErrors.Rows.Count -gt 0) {
    foreach ($org in $excelErrors.Rows) {
        Write-Host "   - [ID: $($org.OrganizationID)] `"$($org.Name)`" | Jobs: $($org.JobCount)"
    }
    Write-ColorOutput "   Total: $($excelErrors.Rows.Count) organizations" "Gray"
} else {
    Write-ColorOutput "   ? No Excel errors found" "Green"
}
Write-Host ""

# Test/Placeholder Data
Write-ColorOutput "2?? TEST/PLACEHOLDER DATA:" "Yellow"
$testData = Invoke-SqlQuery @"
SELECT 
    OrganizationID,
    Name,
    (SELECT COUNT(*) FROM Jobs WHERE Jobs.OrganizationID = Organizations.OrganizationID) as JobCount
FROM Organizations
WHERE IsActive = 1
  AND (Name LIKE '%test%company%'
    OR Name LIKE '%sample%company%'
    OR Name LIKE '%demo%company%'
    OR Name LIKE '%webdesigner%'
    OR Name LIKE '%placeholder%'
    OR Name LIKE '%example%company%'
    OR Name = 'test'
    OR Name = 'sample'
    OR Name = 'demo')
ORDER BY Name
"@

if ($testData.Rows.Count -gt 0) {
    foreach ($org in $testData.Rows) {
        Write-Host "   - [ID: $($org.OrganizationID)] `"$($org.Name)`" | Jobs: $($org.JobCount)"
    }
    Write-ColorOutput "   Total: $($testData.Rows.Count) organizations" "Gray"
} else {
    Write-ColorOutput "   ? No test data found" "Green"
}
Write-Host ""

# Malformed Names
Write-ColorOutput "3?? MALFORMED NAMES:" "Yellow"
$malformed = Invoke-SqlQuery @"
SELECT 
    OrganizationID,
    Name,
    (SELECT COUNT(*) FROM Jobs WHERE Jobs.OrganizationID = Organizations.OrganizationID) as JobCount
FROM Organizations
WHERE IsActive = 1
  AND (Name LIKE '*%'
    OR Name LIKE '. %'
    OR Name LIKE '% .'
    OR Name IN ('0x', '10x', '2x', '3x', '5x')
    OR (Name LIKE '[0-9][0-9][0-9]%' AND LEN(Name) = 3)
    OR Name LIKE '%Main Street Operator'
    OR Name LIKE '[0-9][0-9][0-9] Main Street%'
    OR Name LIKE '[0-9][0-9][0-9] Washington Street%'
    OR Name = 'MyOperator')
ORDER BY Name
"@

if ($malformed.Rows.Count -gt 0) {
    foreach ($org in $malformed.Rows) {
        Write-Host "   - [ID: $($org.OrganizationID)] `"$($org.Name)`" | Jobs: $($org.JobCount)"
    }
    Write-ColorOutput "   Total: $($malformed.Rows.Count) organizations" "Gray"
} else {
    Write-ColorOutput "   ? No malformed names found" "Green"
}
Write-Host ""

# Too Short
Write-ColorOutput "4?? TOO SHORT (excluding known companies):" "Yellow"
$tooShort = Invoke-SqlQuery @"
SELECT 
    OrganizationID,
    Name,
    (SELECT COUNT(*) FROM Jobs WHERE Jobs.OrganizationID = Organizations.OrganizationID) as JobCount
FROM Organizations
WHERE IsActive = 1
  AND LEN(Name) <= 3
  AND Name NOT IN ('3M', 'HP', 'IBM', 'AMD', 'GE', 'SAP', 'EA')
ORDER BY Name
"@

if ($tooShort.Rows.Count -gt 0) {
    foreach ($org in $tooShort.Rows) {
        Write-Host "   - [ID: $($org.OrganizationID)] `"$($org.Name)`" | Jobs: $($org.JobCount)"
    }
    Write-ColorOutput "   Total: $($tooShort.Rows.Count) organizations" "Gray"
} else {
    Write-ColorOutput "   ? No too-short names found" "Green"
}
Write-Host ""

# Generic Terms
Write-ColorOutput "5?? GENERIC BUSINESS TERMS:" "Yellow"
$generic = Invoke-SqlQuery @"
SELECT 
    OrganizationID,
    Name,
    (SELECT COUNT(*) FROM Jobs WHERE Jobs.OrganizationID = Organizations.OrganizationID) as JobCount
FROM Organizations
WHERE IsActive = 1
  AND Name IN ('Company', 'Inc', 'LLC', 'Ltd', 'Organization', 'Business', 'Enterprise', 'Firm')
ORDER BY Name
"@

if ($generic.Rows.Count -gt 0) {
    foreach ($org in $generic.Rows) {
        Write-Host "   - [ID: $($org.OrganizationID)] `"$($org.Name)`" | Jobs: $($org.JobCount)"
    }
    Write-ColorOutput "   Total: $($generic.Rows.Count) organizations" "Gray"
} else {
    Write-ColorOutput "   ? No generic terms found" "Green"
}
Write-Host ""

# Calculate totals
$totalInvalid = $excelErrors.Rows.Count + $testData.Rows.Count + $malformed.Rows.Count + $tooShort.Rows.Count + $generic.Rows.Count

if ($totalInvalid -eq 0) {
    Write-ColorOutput "================================================================" "Green"
    Write-ColorOutput "? NO INVALID ORGANIZATIONS FOUND! Database is clean." "Green"
    Write-ColorOutput "================================================================" "Green"
    exit 0
}

# Summary
Write-ColorOutput "================================================================" "Cyan"
Write-ColorOutput "?? CLEANUP IMPACT SUMMARY:" "Cyan"
Write-ColorOutput "================================================================" "Cyan"

$totalJobs = ($excelErrors.Rows | ForEach-Object { $_.JobCount } | Measure-Object -Sum).Sum + 
             ($testData.Rows | ForEach-Object { $_.JobCount } | Measure-Object -Sum).Sum +
             ($malformed.Rows | ForEach-Object { $_.JobCount } | Measure-Object -Sum).Sum +
             ($tooShort.Rows | ForEach-Object { $_.JobCount } | Measure-Object -Sum).Sum +
             ($generic.Rows | ForEach-Object { $_.JobCount } | Measure-Object -Sum).Sum

Write-Host "Organizations to deactivate: $totalInvalid"
Write-Host "Jobs to delete: $totalJobs"
Write-Host ""

if (-not $Execute) {
    Write-ColorOutput "?? DRY RUN MODE - No changes made" "Green"
    Write-ColorOutput "?? To execute cleanup, run: .\scripts\cleanup-invalid-organizations.ps1 -Execute" "Yellow"
    Write-Host ""
    exit 0
}

# EXECUTE MODE
Write-ColorOutput "??  EXECUTE MODE - Making changes to database..." "Yellow"
Write-Host ""

$confirmation = Read-Host "Are you sure you want to delete $totalJobs jobs and deactivate $totalInvalid organizations? (yes/no)"

if ($confirmation -ne "yes") {
    Write-ColorOutput "? Cleanup cancelled by user" "Red"
    exit 1
}

Write-Host ""
Write-ColorOutput "?? Starting cleanup..." "Cyan"

try {
    # Delete Jobs
    Write-ColorOutput "???  Deleting jobs..." "Yellow"
    $deleteJobsQuery = @"
DELETE FROM Jobs
WHERE OrganizationID IN (
    SELECT OrganizationID FROM Organizations
    WHERE IsActive = 1
      AND (
        Name LIKE '#REF%' OR Name LIKE '#NAME%' OR Name LIKE '#VALUE%'
        OR Name LIKE '#DIV%' OR Name LIKE '#N/A%' OR Name LIKE '#NULL%' OR Name LIKE '#NUM%'
        OR Name LIKE '%test%company%' OR Name LIKE '%sample%company%' OR Name LIKE '%demo%company%'
        OR Name LIKE '%webdesigner%' OR Name LIKE '%placeholder%' OR Name LIKE '%example%company%'
        OR Name IN ('test', 'sample', 'demo')
        OR Name LIKE '*%' OR Name LIKE '. %' OR Name LIKE '% .'
        OR Name IN ('0x', '10x', '2x', '3x', '5x')
        OR (Name LIKE '[0-9][0-9][0-9]%' AND LEN(Name) = 3)
        OR Name LIKE '%Main Street Operator' OR Name LIKE '[0-9][0-9][0-9] Main Street%' OR Name LIKE '[0-9][0-9][0-9] Washington Street%'
        OR Name = 'MyOperator'
        OR (LEN(Name) <= 3 AND Name NOT IN ('3M', 'HP', 'IBM', 'AMD', 'GE', 'SAP', 'EA'))
        OR Name IN ('Company', 'Inc', 'LLC', 'Ltd', 'Organization', 'Business', 'Enterprise', 'Firm')
      )
)
"@
    $deletedJobs = Invoke-SqlNonQuery -Query $deleteJobsQuery
    Write-ColorOutput "   ? Deleted $deletedJobs jobs" "Green"

    # Deactivate Organizations
    Write-ColorOutput "???  Deactivating invalid organizations..." "Yellow"
    $deactivateOrgsQuery = @"
UPDATE Organizations
SET IsActive = 0
WHERE IsActive = 1
  AND (
    Name LIKE '#REF%' OR Name LIKE '#NAME%' OR Name LIKE '#VALUE%'
    OR Name LIKE '#DIV%' OR Name LIKE '#N/A%' OR Name LIKE '#NULL%' OR Name LIKE '#NUM%'
    OR Name LIKE '%test%company%' OR Name LIKE '%sample%company%' OR Name LIKE '%demo%company%'
    OR Name LIKE '%webdesigner%' OR Name LIKE '%placeholder%' OR Name LIKE '%example%company%'
    OR Name IN ('test', 'sample', 'demo')
    OR Name LIKE '*%' OR Name LIKE '. %' OR Name LIKE '% .'
    OR Name IN ('0x', '10x', '2x', '3x', '5x')
    OR (Name LIKE '[0-9][0-9][0-9]%' AND LEN(Name) = 3)
    OR Name LIKE '%Main Street Operator' OR Name LIKE '[0-9][0-9][0-9] Main Street%' OR Name LIKE '[0-9][0-9][0-9] Washington Street%'
    OR Name = 'MyOperator'
    OR (LEN(Name) <= 3 AND Name NOT IN ('3M', 'HP', 'IBM', 'AMD', 'GE', 'SAP', 'EA'))
    OR Name IN ('Company', 'Inc', 'LLC', 'Ltd', 'Organization', 'Business', 'Enterprise', 'Firm')
  )
"@
    $deactivatedOrgs = Invoke-SqlNonQuery -Query $deactivateOrgsQuery
    Write-ColorOutput "   ? Deactivated $deactivatedOrgs organizations" "Green"

    Write-Host ""
    Write-ColorOutput "================================================================" "Green"
    Write-ColorOutput "? CLEANUP COMPLETED SUCCESSFULLY!" "Green"
    Write-ColorOutput "================================================================" "Green"
    Write-Host "Organizations deactivated: $deactivatedOrgs"
    Write-Host "Jobs deleted: $deletedJobs"
    Write-Host ""

} catch {
    Write-ColorOutput "================================================================" "Red"
    Write-ColorOutput "? ERROR OCCURRED DURING CLEANUP" "Red"
    Write-ColorOutput "================================================================" "Red"
    Write-ColorOutput "Error: $_" "Red"
    Write-Host ""
    exit 1
}
