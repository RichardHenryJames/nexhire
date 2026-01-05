# Ensures ReferenceMetadata seed data exists for employer/jobseeker dropdowns.
# Runs the idempotent seed script only if required.

param(
    [Parameter(Mandatory = $true)]
    [string]$ConnectionString,

    [string[]]$RequiredRefTypes = @('Department', 'JobRole')
)

Write-Host "Ensuring ReferenceMetadata seed data..." -ForegroundColor Green

if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}

Import-Module SqlServer -Force

$seedSqlPath = Join-Path $PSScriptRoot 'reference-metadata-setup-v2.sql'
if (-not (Test-Path $seedSqlPath)) {
    throw "Seed SQL file not found: $seedSqlPath"
}

$tableExistsQuery = "SELECT COUNT(1) AS Cnt FROM sys.tables WHERE name = 'ReferenceMetadata';"
$tableExists = (Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $tableExistsQuery -ErrorAction Stop | Select-Object -First 1).Cnt

$shouldSeed = $false

if (-not $tableExists -or [int]$tableExists -eq 0) {
    Write-Host "ReferenceMetadata table missing; will seed." -ForegroundColor Yellow
    $shouldSeed = $true
} else {
    $refTypesCsv = ($RequiredRefTypes | ForEach-Object { "'$_'" }) -join ','
    $countQuery = @"
SELECT RefType, COUNT(1) AS Cnt
FROM dbo.ReferenceMetadata
WHERE IsActive = 1
  AND RefType IN ($refTypesCsv)
GROUP BY RefType;
"@

    $rows = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $countQuery -ErrorAction Stop

    foreach ($required in $RequiredRefTypes) {
        $row = $rows | Where-Object { $_.RefType -eq $required } | Select-Object -First 1
        $cnt = if ($null -ne $row) { [int]$row.Cnt } else { 0 }

        if ($cnt -le 0) {
            Write-Host "Missing RefType '$required'; will seed." -ForegroundColor Yellow
            $shouldSeed = $true
        } else {
            Write-Host "RefType '$required' exists: $cnt rows" -ForegroundColor DarkGreen
        }
    }
}

if (-not $shouldSeed) {
    Write-Host "ReferenceMetadata already seeded; nothing to do." -ForegroundColor Green
    return
}

Write-Host "Running seed script: $seedSqlPath" -ForegroundColor Yellow
Invoke-Sqlcmd -ConnectionString $ConnectionString -InputFile $seedSqlPath -ErrorAction Stop

Write-Host "ReferenceMetadata seed complete." -ForegroundColor Green
