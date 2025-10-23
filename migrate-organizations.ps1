# ================================================================
# Data Migration Script: NexHire ? RefOpen Organizations
# ================================================================
# Migrates organization data from NexHire database to RefOpen database
# ================================================================

param(
    [string]$SourceConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;",
    [string]$TargetConnectionString = "Server=refopen-sqlserver-ci.database.windows.net;Database=refopen-sql-db;User ID=sqladmin;Password=RefOpen@2024!Secure;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;",
    [switch]$DryRun,
    [switch]$SkipDuplicates
)

$ErrorActionPreference = "Stop"

Write-Host "??????????????????????????????????????????????????????????????????" -ForegroundColor Cyan
Write-Host "?  DATA MIGRATION: NexHire ? RefOpen Organizations              ?" -ForegroundColor Cyan
Write-Host "??????????????????????????????????????????????????????????????????" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "?? DRY RUN MODE - No data will be modified" -ForegroundColor Yellow
    Write-Host ""
}

# Install SqlServer module if needed
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "?? Installing SqlServer module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}

Import-Module SqlServer -Force

# ================================================================
# Step 1: Verify Source Database
# ================================================================
Write-Host "?? Step 1: Checking Source Database (NexHire)" -ForegroundColor Cyan

try {
    $sourceCheck = Invoke-Sqlcmd -ConnectionString $SourceConnectionString -Query "SELECT COUNT(*) as OrgCount FROM Organizations WHERE IsActive = 1" -QueryTimeout 30
    Write-Host "   ? Source database accessible" -ForegroundColor Green
    Write-Host "   ?? Found $($sourceCheck.OrgCount) active organizations in NexHire" -ForegroundColor White
} catch {
    Write-Error "? Cannot connect to source database: $($_.Exception.Message)"
    exit 1
}

# ================================================================
# Step 2: Verify Target Database
# ================================================================
Write-Host ""
Write-Host "?? Step 2: Checking Target Database (RefOpen)" -ForegroundColor Cyan

try {
    $targetCheck = Invoke-Sqlcmd -ConnectionString $TargetConnectionString -Query "SELECT COUNT(*) as OrgCount FROM Organizations" -QueryTimeout 30
    Write-Host "   ? Target database accessible" -ForegroundColor Green
    Write-Host "   ?? Current organizations in RefOpen: $($targetCheck.OrgCount)" -ForegroundColor White
} catch {
    Write-Error "? Cannot connect to target database: $($_.Exception.Message)"
    exit 1
}

# ================================================================
# Step 3: Extract Organizations from Source
# ================================================================
Write-Host ""
Write-Host "?? Step 3: Extracting Organizations from NexHire" -ForegroundColor Cyan

$extractQuery = @"
SELECT 
    OrganizationID,
    Name,
    Type,
    Industry,
    Size,
    Website,
    LinkedInProfile,
    Description,
    LogoURL,
    VerificationStatus,
    VerifiedAt,
    VerifiedBy,
    EstablishedDate,
    Headquarters,
    ContactEmail,
    ContactPhone,
    Rating,
    CreatedAt,
    UpdatedAt,
    CreatedBy,
    UpdatedBy,
    IsActive
FROM Organizations
WHERE IsActive = 1
ORDER BY CreatedAt ASC
"@

try {
    $sourceOrganizations = Invoke-Sqlcmd -ConnectionString $SourceConnectionString -Query $extractQuery -QueryTimeout 60
    Write-Host "   ? Extracted $($sourceOrganizations.Count) organizations" -ForegroundColor Green
    
    if ($sourceOrganizations.Count -eq 0) {
        Write-Host ""
        Write-Host "??  No organizations found in source database. Nothing to migrate." -ForegroundColor Yellow
        exit 0
    }
} catch {
    Write-Error "? Failed to extract organizations: $($_.Exception.Message)"
    exit 1
}

# ================================================================
# Step 4: Check for Duplicates
# ================================================================
Write-Host ""
Write-Host "?? Step 4: Checking for Duplicate Organizations" -ForegroundColor Cyan

$duplicateCheckQuery = @"
SELECT Name 
FROM Organizations 
WHERE Name IN ({0})
"@

$orgNames = $sourceOrganizations | ForEach-Object { "'$($_.Name.Replace("'", "''"))'" }
$orgNamesString = $orgNames -join ","

try {
    $duplicates = Invoke-Sqlcmd -ConnectionString $TargetConnectionString -Query ($duplicateCheckQuery -f $orgNamesString) -QueryTimeout 30
    
    if ($duplicates.Count -gt 0) {
        Write-Host "   ??  Found $($duplicates.Count) duplicate organizations in target" -ForegroundColor Yellow
        
        if ($SkipDuplicates) {
            Write-Host "   ?? Duplicates will be skipped" -ForegroundColor Yellow
        } else {
            Write-Host "   ??  Duplicates will cause errors. Use -SkipDuplicates to skip them" -ForegroundColor Yellow
        }
        
        $duplicates | ForEach-Object {
            Write-Host "      • $($_.Name)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ? No duplicates found" -ForegroundColor Green
    }
} catch {
    Write-Warning "Could not check for duplicates: $($_.Exception.Message)"
}

# ================================================================
# Step 5: Migrate Organizations
# ================================================================
Write-Host ""
Write-Host "?? Step 5: Migrating Organizations to RefOpen" -ForegroundColor Cyan

if ($DryRun) {
    Write-Host "   ?? DRY RUN - Showing what would be migrated:" -ForegroundColor Yellow
    Write-Host ""
    
    $sourceOrganizations | Select-Object -First 5 | ForEach-Object {
        Write-Host "      • $($_.Name) (Type: $($_.Type), Industry: $($_.Industry))" -ForegroundColor Gray
    }
    
    if ($sourceOrganizations.Count -gt 5) {
        Write-Host "      ... and $($sourceOrganizations.Count - 5) more" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "   ??  Run without -DryRun to perform actual migration" -ForegroundColor Cyan
    exit 0
}

$migratedCount = 0
$skippedCount = 0
$errorCount = 0
$errors = @()

foreach ($org in $sourceOrganizations) {
    try {
        # Skip if duplicate and SkipDuplicates is enabled
        if ($SkipDuplicates -and $duplicates.Name -contains $org.Name) {
            Write-Host "   ??  Skipping duplicate: $($org.Name)" -ForegroundColor Yellow
            $skippedCount++
            continue
        }
        
        # Build parameterized query
        $insertQuery = @"
INSERT INTO Organizations (
    Name, Type, Industry, Size, Website, LinkedInProfile,
    Description, LogoURL, VerificationStatus, VerifiedAt, VerifiedBy,
    EstablishedDate, Headquarters, ContactEmail, ContactPhone, Rating,
    CreatedAt, UpdatedAt, CreatedBy, UpdatedBy, IsActive
) VALUES (
    @Name, @Type, @Industry, @Size, @Website, @LinkedInProfile,
    @Description, @LogoURL, @VerificationStatus, @VerifiedAt, @VerifiedBy,
    @EstablishedDate, @Headquarters, @ContactEmail, @ContactPhone, @Rating,
    @CreatedAt, @UpdatedAt, @CreatedBy, @UpdatedBy, @IsActive
)
"@
        
        # Create SQL connection
        $connection = New-Object System.Data.SqlClient.SqlConnection($TargetConnectionString)
        $command = $connection.CreateCommand()
        $command.CommandText = $insertQuery
        $command.CommandTimeout = 30
        
        # Add parameters
        $command.Parameters.AddWithValue("@Name", $org.Name) | Out-Null
        $command.Parameters.AddWithValue("@Type", $(if ($org.Type) { $org.Type } else { [DBNull]::Value })) | Out-Null
        $command.Parameters.AddWithValue("@Industry", $(if ($org.Industry) { $org.Industry } else { [DBNull]::Value })) | Out-Null
        $command.Parameters.AddWithValue("@Size", $(if ($org.Size) { $org.Size } else { [DBNull]::Value })) | Out-Null
        $command.Parameters.AddWithValue("@Website", $(if ($org.Website) { $org.Website } else { [DBNull]::Value })) | Out-Null
        $command.Parameters.AddWithValue("@LinkedInProfile", $(if ($org.LinkedInProfile) { $org.LinkedInProfile } else { [DBNull]::Value })) | Out-Null
        $command.Parameters.AddWithValue("@Description", $(if ($org.Description) { $org.Description } else { [DBNull]::Value })) | Out-Null
        $command.Parameters.AddWithValue("@LogoURL", $(if ($org.LogoURL) { $org.LogoURL } else { [DBNull]::Value })) | Out-Null
        $command.Parameters.AddWithValue("@VerificationStatus", $(if ($null -ne $org.VerificationStatus) { $org.VerificationStatus } else { 0 })) | Out-Null
        $command.Parameters.AddWithValue("@VerifiedAt", $(if ($org.VerifiedAt) { $org.VerifiedAt } else { [DBNull]::Value })) | Out-Null
        $command.Parameters.AddWithValue("@VerifiedBy", $(if ($org.VerifiedBy) { $org.VerifiedBy } else { [DBNull]::Value })) | Out-Null
        $command.Parameters.AddWithValue("@EstablishedDate", $(if ($org.EstablishedDate) { $org.EstablishedDate } else { [DBNull]::Value })) | Out-Null
        $command.Parameters.AddWithValue("@Headquarters", $(if ($org.Headquarters) { $org.Headquarters } else { [DBNull]::Value })) | Out-Null
        $command.Parameters.AddWithValue("@ContactEmail", $(if ($org.ContactEmail) { $org.ContactEmail } else { [DBNull]::Value })) | Out-Null
        $command.Parameters.AddWithValue("@ContactPhone", $(if ($org.ContactPhone) { $org.ContactPhone } else { [DBNull]::Value })) | Out-Null
        $command.Parameters.AddWithValue("@Rating", $(if ($org.Rating) { $org.Rating } else { [DBNull]::Value })) | Out-Null
        $command.Parameters.AddWithValue("@CreatedAt", $(if ($org.CreatedAt) { $org.CreatedAt } else { Get-Date })) | Out-Null
        $command.Parameters.AddWithValue("@UpdatedAt", $(if ($org.UpdatedAt) { $org.UpdatedAt } else { Get-Date })) | Out-Null
        $command.Parameters.AddWithValue("@CreatedBy", $(if ($org.CreatedBy) { $org.CreatedBy } else { [DBNull]::Value })) | Out-Null
        $command.Parameters.AddWithValue("@UpdatedBy", $(if ($org.UpdatedBy) { $org.UpdatedBy } else { [DBNull]::Value })) | Out-Null
        $command.Parameters.AddWithValue("@IsActive", $(if ($null -ne $org.IsActive) { $org.IsActive } else { 1 })) | Out-Null
        
        # Execute
        $connection.Open()
        $command.ExecuteNonQuery() | Out-Null
        $connection.Close()
        
        Write-Host "   ? Migrated: $($org.Name)" -ForegroundColor Green
        $migratedCount++
        
    } catch {
        Write-Host "   ? Error migrating $($org.Name): $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
        $errors += @{
            Organization = $org.Name
            Error = $_.Exception.Message
        }
    } finally {
        if ($connection -and $connection.State -eq 'Open') {
            $connection.Close()
        }
    }
}

# ================================================================
# Step 6: Verification
# ================================================================
Write-Host ""
Write-Host "?? Step 6: Verifying Migration" -ForegroundColor Cyan

try {
    $finalCount = Invoke-Sqlcmd -ConnectionString $TargetConnectionString -Query "SELECT COUNT(*) as OrgCount FROM Organizations" -QueryTimeout 30
    Write-Host "   ? Total organizations in RefOpen: $($finalCount.OrgCount)" -ForegroundColor Green
} catch {
    Write-Warning "Could not verify final count"
}

# ================================================================
# Summary
# ================================================================
Write-Host ""
Write-Host "??????????????????????????????????????????????????????????????????" -ForegroundColor $(if ($errorCount -eq 0) { "Green" } else { "Yellow" })
Write-Host "?  MIGRATION SUMMARY                                             ?" -ForegroundColor $(if ($errorCount -eq 0) { "Green" } else { "Yellow" })
Write-Host "??????????????????????????????????????????????????????????????????" -ForegroundColor $(if ($errorCount -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

Write-Host "?? Migration Statistics:" -ForegroundColor Cyan
Write-Host "   ? Successfully migrated: $migratedCount" -ForegroundColor Green
if ($skippedCount -gt 0) {
    Write-Host "   ??  Skipped (duplicates): $skippedCount" -ForegroundColor Yellow
}
if ($errorCount -gt 0) {
    Write-Host "   ? Errors: $errorCount" -ForegroundColor Red
}
Write-Host "   ?? Total processed: $($sourceOrganizations.Count)" -ForegroundColor White

if ($errors.Count -gt 0) {
    Write-Host ""
    Write-Host "? Errors encountered:" -ForegroundColor Red
    foreach ($err in $errors) {
        Write-Host "   • $($err.Organization): $($err.Error)" -ForegroundColor Red
    }
}

Write-Host ""
if ($errorCount -eq 0) {
    Write-Host "?? Migration completed successfully!" -ForegroundColor Green
} else {
    Write-Host "??  Migration completed with errors. Review the error list above." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "?? Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Verify data: SELECT * FROM Organizations WHERE IsActive = 1" -ForegroundColor White
Write-Host "   2. Test API: Invoke-RestMethod https://refopen-api-func.azurewebsites.net/api/reference/organizations" -ForegroundColor White
Write-Host "   3. Migrate related data (WorkExperiences, Jobs, etc.)" -ForegroundColor White
Write-Host ""

# Return exit code based on errors
if ($errorCount -gt 0) {
    exit 1
} else {
    exit 0
}
