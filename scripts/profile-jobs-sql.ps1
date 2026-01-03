param(
  [string]$Email = "admin@refopen.com",
  [int]$DaysBack = 7,
  [int]$PageSize = 20,
  [string]$SearchText = "software",
  [switch]$IncludePlan
)

$ErrorActionPreference = 'Stop'

function Get-ConnectionString {
  $settingsPath = Join-Path $PSScriptRoot "..\local.settings.json"
  if (-not (Test-Path $settingsPath)) {
    throw "local.settings.json not found at $settingsPath"
  }
  $json = Get-Content $settingsPath -Raw | ConvertFrom-Json
  $cs = $json.ConnectionStrings.SQLDatabase
  if (-not $cs) {
    throw "ConnectionStrings.SQLDatabase missing in local.settings.json"
  }
  return [string]$cs
}

function Invoke-Sql {
  param(
    [string]$ConnectionString,
    [string]$Sql,
    [hashtable]$Parameters
  )

  $conn = New-Object System.Data.SqlClient.SqlConnection $ConnectionString
  $messages = New-Object System.Collections.Generic.List[string]

  $handler = [System.Data.SqlClient.SqlInfoMessageEventHandler]{
    param($sender, $event)
    foreach ($e in $event.Errors) {
      $messages.Add($e.Message)
    }
  }

  $conn.add_InfoMessage($handler)
  $conn.FireInfoMessageEventOnUserErrors = $true

  try {
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandTimeout = 120
    $cmd.CommandText = $Sql

    if ($Parameters) {
      foreach ($k in $Parameters.Keys) {
        $p = $cmd.Parameters.Add("@" + $k, [System.Data.SqlDbType]::NVarChar, 4000)
        $p.Value = [string]$Parameters[$k]
      }
    }

    $ds = New-Object System.Data.DataSet
    $da = New-Object System.Data.SqlClient.SqlDataAdapter $cmd

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    [void]$da.Fill($ds)
    $sw.Stop()

    return [pscustomobject]@{
      ElapsedMs = [Math]::Round($sw.Elapsed.TotalMilliseconds, 1)
      DataSet = $ds
      Messages = $messages
    }
  }
  finally {
    $conn.remove_InfoMessage($handler)
    $conn.Dispose()
  }
}

$cs = Get-ConnectionString
Write-Host "Using DB connection from local.settings.json (not echoed)"

# 1) Quick metadata checks
$metaSql = @"
SET NOCOUNT ON;
SELECT @@VERSION AS SqlVersion;
SELECT DB_NAME() AS DatabaseName;

-- Full-text presence
SELECT
  t.name AS TableName,
  CASE WHEN fti.object_id IS NULL THEN 0 ELSE 1 END AS HasFullText,
  ftc.name AS FullTextCatalog
FROM sys.tables t
LEFT JOIN sys.fulltext_indexes fti ON fti.object_id = t.object_id
LEFT JOIN sys.fulltext_catalogs ftc ON ftc.fulltext_catalog_id = fti.fulltext_catalog_id
WHERE t.name IN ('Jobs','Organizations');

-- Key indexes on Jobs
SELECT TOP 50
  i.name AS IndexName,
  i.type_desc AS Type,
  i.is_unique AS IsUnique,
  i.has_filter AS HasFilter,
  i.filter_definition AS FilterDefinition
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('dbo.Jobs')
ORDER BY i.index_id;

-- Missing index recommendations (best-effort; may require permissions)
BEGIN TRY
  SELECT TOP 10
    OBJECT_NAME(mid.object_id) AS TableName,
    migs.user_seeks,
    migs.user_scans,
    migs.avg_total_user_cost,
    migs.avg_user_impact,
    mid.equality_columns,
    mid.inequality_columns,
    mid.included_columns
  FROM sys.dm_db_missing_index_group_stats migs
  INNER JOIN sys.dm_db_missing_index_groups mig
    ON migs.group_handle = mig.index_group_handle
  INNER JOIN sys.dm_db_missing_index_details mid
    ON mig.index_handle = mid.index_handle
  WHERE mid.database_id = DB_ID()
    AND mid.object_id IN (OBJECT_ID('dbo.Jobs'), OBJECT_ID('dbo.Organizations'))
  ORDER BY (migs.avg_user_impact * migs.user_seeks) DESC;
END TRY
BEGIN CATCH
  SELECT ERROR_MESSAGE() AS MissingIndexDmvError;
END CATCH;
"@

$meta = Invoke-Sql -ConnectionString $cs -Sql $metaSql -Parameters @{}
Write-Host "Meta elapsed: $($meta.ElapsedMs)ms"
$meta.DataSet.Tables[0] | Format-Table -AutoSize
$meta.DataSet.Tables[1] | Format-Table -AutoSize
$meta.DataSet.Tables[2] | Format-Table -AutoSize
if ($meta.DataSet.Tables.Count -gt 3) {
  $meta.DataSet.Tables[3] | Format-Table -AutoSize
}

# 2) Profile representative query shapes
$cutoff = (Get-Date).AddDays(-1 * [double]$DaysBack).ToString("yyyy-MM-ddTHH:mm:ss")

function New-FullTextOrQuery {
  param([string]$text)
  $t = ($text ?? '').Trim()
  if ($t.Length -le 4) { return $t }
  $tokens = $t.Split([char[]]@(' ',"`t","`r","`n"), [System.StringSplitOptions]::RemoveEmptyEntries) |
    ForEach-Object {
      ($_ -replace '[^0-9A-Za-z]', '')
    } |
    Where-Object { $_ -and $_.Length -ge 2 } |
    Select-Object -First 10

  if (-not $tokens -or $tokens.Count -eq 0) { return $t }
  return ($tokens | ForEach-Object { '"' + $_ + '*"' }) -join ' OR '
}

function Get-SearchPredicateSql {
  param([string]$raw)
  $t = ($raw ?? '').Trim()
  if ($t.Length -eq 0) {
    return '1 = 1'
  }
  if ($t.Length -le 4) {
    return "(j.Title LIKE '%' + @SearchText + '%' OR o.Name LIKE '%' + @SearchText + '%')"
  }
  return "(j.JobID IN (SELECT [KEY] FROM CONTAINSTABLE(Jobs, (Title, Location, City, Country), @SearchText)) OR j.OrganizationID IN (SELECT [KEY] FROM CONTAINSTABLE(Organizations, Name, @SearchText)))"
}

$searchPredicate = Get-SearchPredicateSql -raw $SearchText

# We keep this query close to current code: Published jobs in last N days, join org/ref metadata,
# order by (roleTitleScore, preferenceScore, PublishedAt, JobID) and page.
# Note: This script doesn't know the exact user prefs; it fetches them by email.
$querySql = @"
SET NOCOUNT ON;
SET STATISTICS IO ON;
SET STATISTICS TIME ON;
$(if ($IncludePlan) { 'SET STATISTICS XML ON;' } else { '' })

DECLARE @CutoffDT DATETIME2 = TRY_CONVERT(DATETIME2, @Cutoff, 126);
DECLARE @PageSizeInt INT = TRY_CONVERT(INT, @PageSize);
DECLARE @SearchText NVARCHAR(200) = @Search;

DECLARE @UserID UNIQUEIDENTIFIER = (SELECT TOP 1 UserID FROM dbo.Users WHERE Email = @Email);
DECLARE @ApplicantID UNIQUEIDENTIFIER = (SELECT TOP 1 ApplicantID FROM dbo.Applicants WHERE UserID = @UserID);

DECLARE @PreferredJobTypes NVARCHAR(4000) = (SELECT TOP 1 PreferredJobTypes FROM dbo.Applicants WHERE ApplicantID = @ApplicantID);
DECLARE @PreferredWorkTypes NVARCHAR(4000) = (SELECT TOP 1 PreferredWorkTypes FROM dbo.Applicants WHERE ApplicantID = @ApplicantID);
DECLARE @PreferredLocations NVARCHAR(4000) = (SELECT TOP 1 PreferredLocations FROM dbo.Applicants WHERE ApplicantID = @ApplicantID);
DECLARE @PreferredCompanySize NVARCHAR(4000) = (SELECT TOP 1 PreferredCompanySize FROM dbo.Applicants WHERE ApplicantID = @ApplicantID);
DECLARE @LatestJobTitle NVARCHAR(4000) = (
  SELECT TOP 1 we.JobTitle
  FROM dbo.WorkExperiences we
  WHERE we.ApplicantID = @ApplicantID
    AND (we.IsActive = 1 OR we.IsActive IS NULL)
  ORDER BY
    CASE WHEN we.EndDate IS NULL THEN 1 ELSE 0 END DESC,
    we.EndDate DESC,
    we.StartDate DESC
);

-- Keep the same scoring style as current code (LIKE/STRING_SPLIT in ORDER BY)
WITH Base AS (
  SELECT
    j.JobID,
    j.Title,
    j.JobTypeID,
    j.WorkplaceTypeID,
    j.OrganizationID,
    j.Location,
    j.City,
    j.Country,
    j.IsRemote,
    j.SalaryRangeMin,
    j.SalaryRangeMax,
    j.SalaryPeriod,
    j.PublishedAt,
    j.CreatedAt,
    jt.Value AS JobTypeName,
    wt.Value AS WorkplaceTypeName,
    o.Name AS OrganizationName,
    ISNULL(o.LogoURL,'') AS OrganizationLogo,

    (
      (CASE
        WHEN NULLIF(LTRIM(RTRIM(@PreferredJobTypes)), '') IS NOT NULL
         AND (',' + LOWER(REPLACE(@PreferredJobTypes, ' ', '')) + ',') LIKE '%,' + LOWER(REPLACE(jt.Value, ' ', '')) + ',%'
        THEN 3 ELSE 0 END)
      +
      (CASE
        WHEN NULLIF(LTRIM(RTRIM(@PreferredWorkTypes)), '') IS NOT NULL
         AND NULLIF(LTRIM(RTRIM(wt.Value)), '') IS NOT NULL
         AND (',' + LOWER(REPLACE(@PreferredWorkTypes, ' ', '')) + ',') LIKE '%,' + LOWER(REPLACE(wt.Value, ' ', '')) + ',%'
        THEN 2 ELSE 0 END)
      +
      (CASE
        WHEN NULLIF(LTRIM(RTRIM(@PreferredLocations)), '') IS NOT NULL
         AND EXISTS (
            SELECT 1
            FROM STRING_SPLIT(@PreferredLocations, ',') loc
            WHERE NULLIF(LTRIM(RTRIM(loc.value)), '') IS NOT NULL
              AND (
                j.Location LIKE '%' + LTRIM(RTRIM(loc.value)) + '%'
                OR j.City LIKE '%' + LTRIM(RTRIM(loc.value)) + '%'
                OR j.Country LIKE '%' + LTRIM(RTRIM(loc.value)) + '%'
              )
         )
        THEN 2 ELSE 0 END)
      +
      (CASE
        WHEN NULLIF(LTRIM(RTRIM(@PreferredCompanySize)), '') IS NOT NULL
         AND NULLIF(LTRIM(RTRIM(o.Size)), '') IS NOT NULL
         AND LOWER(LTRIM(RTRIM(o.Size))) = LOWER(LTRIM(RTRIM(@PreferredCompanySize)))
        THEN 1 ELSE 0 END)
    ) AS PreferenceScore,

    (
      (CASE
        WHEN NULLIF(LTRIM(RTRIM(@LatestJobTitle)), '') IS NOT NULL
         AND j.Title LIKE '%' + LTRIM(RTRIM(@LatestJobTitle)) + '%'
        THEN 6 ELSE 0 END)
      +
      (CASE
        WHEN NULLIF(LTRIM(RTRIM(@LatestJobTitle)), '') IS NOT NULL
         AND EXISTS (
            SELECT 1
            FROM STRING_SPLIT(@LatestJobTitle, ' ') tok
            WHERE LEN(LTRIM(RTRIM(tok.value))) >= 3
              AND j.Title LIKE '%' + LTRIM(RTRIM(tok.value)) + '%'
         )
        THEN 4 ELSE 0 END)
    ) AS RoleTitleScore

  FROM dbo.Jobs j
  INNER JOIN dbo.ReferenceMetadata jt ON j.JobTypeID = jt.ReferenceID AND jt.RefType = 'JobType'
  INNER JOIN dbo.Organizations o ON j.OrganizationID = o.OrganizationID
  LEFT JOIN dbo.ReferenceMetadata wt ON j.WorkplaceTypeID = wt.ReferenceID AND wt.RefType = 'WorkplaceType'
  WHERE j.Status = 'Published'
    AND j.PublishedAt >= @CutoffDT
    AND ($searchPredicate)
)
SELECT TOP (@PageSizeInt)
  *
FROM Base
ORDER BY
  CASE WHEN @SearchText <> '' THEN 0 ELSE RoleTitleScore END DESC,
  PreferenceScore DESC,
  PublishedAt DESC,
  JobID DESC;
"@

$params = @{
  Email = $Email
  Cutoff = $cutoff
  PageSize = [string]$PageSize
  Search = (New-FullTextOrQuery -text $SearchText)
}

Write-Host "\nProfiling query (DaysBack=$DaysBack, PageSize=$PageSize, Search='$SearchText', IncludePlan=$IncludePlan)"
$profile = Invoke-Sql -ConnectionString $cs -Sql $querySql -Parameters $params
Write-Host "Query elapsed: $($profile.ElapsedMs)ms"

# Print STATISTICS output (IO/TIME)
if ($profile.Messages.Count -gt 0) {
  Write-Host "--- SQL messages (STATISTICS IO/TIME) ---"
  $profile.Messages | ForEach-Object { Write-Host $_ }
}

# Show a couple rows to confirm shape
if ($profile.DataSet.Tables.Count -gt 0) {
  $t = $profile.DataSet.Tables[0]
  Write-Host "Rows returned: $($t.Rows.Count)"
  $t | Select-Object -First 3 | Format-Table JobID, Title, PublishedAt, PreferenceScore, RoleTitleScore -AutoSize
}
