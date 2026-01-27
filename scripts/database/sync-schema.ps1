# ============================================================
# Sync Database Schema to complete-schema.sql
# Run this script to export the current database schema
# Usage: .\scripts\database\sync-schema.ps1
# ============================================================

$ErrorActionPreference = "Stop"

# Get script directory and project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)

Write-Host "=== RefOpen Database Schema Sync ===" -ForegroundColor Cyan
Write-Host "Project Root: $projectRoot"

# Database connection settings
$server = "refopen-sqlserver-ci.database.windows.net"
$database = "refopen-sql-db"
$user = "sqladmin"
$password = "SecureRef2026#Prod!Kv"

$connectionString = "Server=$server;Database=$database;User Id=$user;Password=$password;TrustServerCertificate=True"

try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $conn.Open()
    Write-Host "Connected to database: $database" -ForegroundColor Green
} catch {
    Write-Host "Failed to connect to database: $_" -ForegroundColor Red
    exit 1
}

# Step 1: Export Columns
Write-Host "`nStep 1: Exporting columns..." -ForegroundColor Yellow
$colQuery = @"
SELECT 
    t.name AS TableName,
    c.name AS ColumnName,
    ty.name AS DataType,
    c.max_length,
    c.precision,
    c.scale,
    c.is_nullable,
    c.is_identity,
    dc.definition AS DefaultValue,
    cc.definition AS ComputedDefinition,
    cc.is_persisted
FROM sys.tables t
JOIN sys.columns c ON t.object_id = c.object_id
JOIN sys.types ty ON c.user_type_id = ty.user_type_id
LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
LEFT JOIN sys.computed_columns cc ON c.object_id = cc.object_id AND c.column_id = cc.column_id
ORDER BY t.name, c.column_id
"@

$colCmd = New-Object System.Data.SqlClient.SqlCommand($colQuery, $conn)
$colAdapter = New-Object System.Data.SqlClient.SqlDataAdapter($colCmd)
$colTable = New-Object System.Data.DataTable
$colAdapter.Fill($colTable) | Out-Null
Write-Host "  Exported $($colTable.Rows.Count) columns"

# Step 2: Export Indexes
Write-Host "Step 2: Exporting indexes..." -ForegroundColor Yellow
$idxQuery = @"
SELECT 
    i.name AS IndexName,
    t.name AS TableName,
    i.type_desc AS IndexType,
    i.is_unique,
    i.is_primary_key,
    i.filter_definition,
    STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS Columns
FROM sys.indexes i
JOIN sys.tables t ON i.object_id = t.object_id
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.name IS NOT NULL
GROUP BY i.name, t.name, i.type_desc, i.is_unique, i.is_primary_key, i.filter_definition
ORDER BY t.name, i.name
"@

$idxCmd = New-Object System.Data.SqlClient.SqlCommand($idxQuery, $conn)
$idxAdapter = New-Object System.Data.SqlClient.SqlDataAdapter($idxCmd)
$idxTable = New-Object System.Data.DataTable
$idxAdapter.Fill($idxTable) | Out-Null
Write-Host "  Exported $($idxTable.Rows.Count) indexes"

# Step 3: Export Foreign Keys
Write-Host "Step 3: Exporting foreign keys..." -ForegroundColor Yellow
$fkQuery = @"
SELECT 
    fk.name AS FKName,
    tp.name AS ParentTable,
    cp.name AS ParentColumn,
    tr.name AS ReferencedTable,
    cr.name AS ReferencedColumn
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
ORDER BY tp.name, fk.name
"@

$fkCmd = New-Object System.Data.SqlClient.SqlCommand($fkQuery, $conn)
$fkAdapter = New-Object System.Data.SqlClient.SqlDataAdapter($fkCmd)
$fkTable = New-Object System.Data.DataTable
$fkAdapter.Fill($fkTable) | Out-Null
Write-Host "  Exported $($fkTable.Rows.Count) foreign keys"

$conn.Close()
Write-Host "Database connection closed" -ForegroundColor Green

# Step 4: Generate SQL Schema
Write-Host "`nStep 4: Generating SQL schema..." -ForegroundColor Yellow

# Group by table
$tables = @{}

foreach ($row in $colTable.Rows) {
    $tableName = $row.TableName
    if (-not $tables.ContainsKey($tableName)) {
        $tables[$tableName] = @{
            columns = @()
            indexes = @()
            fks = @()
        }
    }
    $tables[$tableName].columns += $row
}

foreach ($row in $idxTable.Rows) {
    $tableName = $row.TableName
    if ($tables.ContainsKey($tableName)) {
        $tables[$tableName].indexes += $row
    }
}

foreach ($row in $fkTable.Rows) {
    $tableName = $row.ParentTable
    if ($tables.ContainsKey($tableName)) {
        $tables[$tableName].fks += $row
    }
}

# Helper function to get data type
function Get-DataType($col) {
    if ($col.ComputedDefinition) { return $null }
    
    $t = $col.DataType
    switch ($t) {
        { $_ -in 'nvarchar', 'varchar' } {
            $len = [int]$col.max_length
            if ($len -eq -1) { return "$($t.ToUpper())(MAX)" }
            if ($t -eq 'nvarchar') { $len = $len / 2 }
            return "$($t.ToUpper())($len)"
        }
        { $_ -in 'decimal', 'numeric' } {
            return "$($t.ToUpper())($($col.precision), $($col.scale))"
        }
        'datetime2' { return "DATETIME2($($col.scale))" }
        'time' { return "TIME($($col.scale))" }
        default { return $t.ToUpper() }
    }
}

# Generate SQL
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$sql = @"
-- ============================================================
-- RefOpen Database Schema Export
-- Generated: $timestamp
-- This script creates all tables with correct columns and indexes
-- ============================================================


"@

foreach ($tableName in ($tables.Keys | Sort-Object)) {
    $table = $tables[$tableName]
    $pk = $table.indexes | Where-Object { $_.is_primary_key -eq $true } | Select-Object -First 1
    
    $sql += @"
-- ============================================================
-- Table: $tableName
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '$tableName')
BEGIN
    CREATE TABLE $tableName (

"@

    $colDefs = @()
    foreach ($col in $table.columns) {
        if ($col.ComputedDefinition) {
            $persisted = if ($col.is_persisted) { " PERSISTED" } else { "" }
            $colDefs += "        $($col.ColumnName) AS $($col.ComputedDefinition)$persisted"
        } else {
            $dtype = Get-DataType $col
            $nullable = if ($col.is_nullable) { " NULL" } else { " NOT NULL" }
            $default = if ($col.DefaultValue) { " DEFAULT $($col.DefaultValue)" } else { "" }
            $identity = if ($col.is_identity) { " IDENTITY(1,1)" } else { "" }
            $colDefs += "        $($col.ColumnName) $dtype$nullable$default$identity"
        }
    }
    
    if ($pk) {
        $colDefs += "        CONSTRAINT $($pk.IndexName) PRIMARY KEY ($($pk.Columns))"
    }
    
    $sql += ($colDefs -join ",`n")
    $sql += @"

    );
    PRINT 'Created table $tableName';
END
GO


"@

    # Foreign keys
    foreach ($fk in $table.fks) {
        $sql += @"
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = '$($fk.FKName)')
BEGIN
    ALTER TABLE $tableName ADD CONSTRAINT $($fk.FKName)
        FOREIGN KEY ($($fk.ParentColumn)) REFERENCES $($fk.ReferencedTable)($($fk.ReferencedColumn))
;
END
GO

"@
    }

    # Indexes (non-PK)
    foreach ($idx in ($table.indexes | Where-Object { $_.is_primary_key -eq $false })) {
        $unique = if ($idx.is_unique) { "UNIQUE " } else { "" }
        $filter = if ($idx.filter_definition) { " WHERE $($idx.filter_definition)" } else { "" }
        $sql += @"
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = '$($idx.IndexName)')
BEGIN
    CREATE $($unique)NONCLUSTERED INDEX $($idx.IndexName) ON $tableName($($idx.Columns))$filter;
END
GO

"@
    }

    $sql += "`n"
}

# Step 5: Write to file
$outputPath = Join-Path $projectRoot "database\schema\complete-schema.sql"
$sql | Out-File -FilePath $outputPath -Encoding utf8
Write-Host "  Written to: $outputPath" -ForegroundColor Green

# Summary
Write-Host "`n=== Schema Sync Complete ===" -ForegroundColor Cyan
Write-Host "Tables: $($tables.Count)"
Write-Host "Columns: $($colTable.Rows.Count)"
Write-Host "Indexes: $($idxTable.Rows.Count)"
Write-Host "Foreign Keys: $($fkTable.Rows.Count)"
Write-Host "`nOutput: $outputPath" -ForegroundColor Green
