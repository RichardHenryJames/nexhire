param(
  [string]$ConnectionString = $env:NEXHIRE_DB_CONNECTION,
  [switch]$Accurate = $true,
  [int]$MaxIndianIT = 100
)

if (-not $ConnectionString -or $ConnectionString.Trim().Length -eq 0) {
  $ConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
}

Write-Host "\n?? Seeding Organizations (Fortune Global 500 + Top Indian IT)" -ForegroundColor Green
Write-Host "Using connection: $ConnectionString" -ForegroundColor Cyan

if (-not (Get-Module -ListAvailable -Name SqlServer)) {
  Write-Host "Installing SqlServer module..." -ForegroundColor Yellow
  Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}
Import-Module SqlServer -Force

function Normalize-Text {
  param([object]$Value)
  if ($null -eq $Value) { return $null }
  if ($Value -is [System.Array]) {
    foreach ($v in (@($Value) | Sort-Object -Descending)) { if ($v -is [string] -and $v.Trim().Length -gt 0) { return $v.Trim() } }
    return $null
  }
  return ($Value.ToString()).Trim()
}

function Truncate-String { param([string]$s,[int]$max); if ([string]::IsNullOrWhiteSpace($s)) { return $s } if ($s.Length -le $max) { return $s } return $s.Substring(0,$max) }

$WikipediaAPI = 'https://en.wikipedia.org/w/api.php'
$WikidataAPI = 'https://www.wikidata.org/w/api.php'

function Invoke-WikiApi { param([string]$BaseUri, [hashtable]$Params)
  $pairs = @()
  foreach ($k in $Params.Keys) { $v = $Params[$k]; if ($null -ne $v) { $pairs += "$k=$([uri]::EscapeDataString(($v | Out-String).Trim()))" } }
  $qs = ($pairs -join '&')
  $url = "$BaseUri?$qs"
  try { return Invoke-RestMethod -Method GET -Uri $url -TimeoutSec 60 } catch { Write-Warning "Wiki API error: $url :: $($_.Exception.Message)"; return $null }
}

function Get-CategoryMembers { param([string]$CategoryTitle, [int]$Limit = 500)
  $members = @(); $cont = $null
  do {
    $res = Invoke-WikiApi -BaseUri $WikipediaAPI -Params @{ action='query'; list='categorymembers'; cmtitle=$CategoryTitle; cmlimit=500; format='json'; cmcontinue=$cont }
    if ($res -and $res.query.categorymembers) { $members += $res.query.categorymembers; $cont = $res.'continue'.cmcontinue }
    else { $cont = $null }
  } while ($cont -and $members.Count -lt $Limit)
  return $members | Select-Object -First $Limit
}

function Get-WikibaseItemId { param([string]$Title)
  $res = Invoke-WikiApi -BaseUri $WikipediaAPI -Params @{ action='query'; prop='pageprops'; titles=$Title; format='json' }
  if (-not $res -or -not $res.query.pages) { return $null }
  foreach ($k in $res.query.pages.Keys) { $pp = $res.query.pages[$k].pageprops; if ($pp -and $pp.wikibase_item) { return $pp.wikibase_item } }
  return $null
}

function Get-WikidataEntity { param([string]$Qid)
  return Invoke-WikiApi -BaseUri $WikidataAPI -Params @{ action='wbgetentities'; ids=$Qid; props='claims|labels'; languages='en'; format='json' }
}

function Get-Label-FromQ { param([string]$Qid)
  $r = Invoke-WikiApi -BaseUri $WikidataAPI -Params @{ action='wbgetentities'; ids=$Qid; props='labels'; languages='en'; format='json' }
  try { return ($r.entities.$Qid.labels.en.value) } catch { return $null }
}

function Enrich-FromWikidata { param([string]$Qid)
  $enriched = @{ Website=$null; LinkedIn=$null; LogoURL=$null; Industry=$null; Size=$null }
  if (-not $Qid) { return $enriched }
  $res = Get-WikidataEntity -Qid $Qid
  try {
    $claims = $res.entities.$Qid.claims
    if ($claims.P856) { foreach ($c in $claims.P856) { $url = $c.mainsnak.datavalue.value; if ($url) { $enriched.Website = ($url -replace '^(https?:)//', '$1//'); break } } }
    if ($claims.P4264) { $id = $claims.P4264[0].mainsnak.datavalue.value; if ($id) { $enriched.LinkedIn = "https://www.linkedin.com/company/$id" } }
    if ($claims.P154) { $file = $claims.P154[0].mainsnak.datavalue.value; if ($file) { $enriched.LogoURL = "https://commons.wikimedia.org/wiki/Special:FilePath/$([uri]::EscapeDataString($file))" } }
    if ($claims.P452) { $qidIndustry = $claims.P452[0].mainsnak.datavalue.value.id; if ($qidIndustry) { $enriched.Industry = (Get-Label-FromQ -Qid $qidIndustry) } }
    if ($claims.P1128) { $val = $claims.P1128[0].mainsnak.datavalue.value.amount; if ($val) { $n = [int]([double]$val); if ($n -ge 10001) { $enriched.Size = '10001+' } elseif ($n -ge 5001) { $enriched.Size = '5001-10000' } elseif ($n -ge 1001) { $enriched.Size = '1001-5000' } elseif ($n -ge 501) { $enriched.Size = '501-1000' } elseif ($n -ge 201) { $enriched.Size = '201-500' } elseif ($n -ge 51) { $enriched.Size = '51-200' } elseif ($n -ge 11) { $enriched.Size = '11-50' } elseif ($n -ge 1) { $enriched.Size = '1-10' } } }
  } catch { }
  return $enriched
}

function Get-FortuneCompanies {
  Write-Host "Fetching Fortune Global 500 companies via Wikipedia category..." -ForegroundColor Cyan
  $members = Get-CategoryMembers -CategoryTitle 'Category:Fortune_Global_500_companies' -Limit 600
  $names = @(); foreach ($m in $members) { if ($m.title) { $names += (Normalize-Text $m.title) } }
  $names = $names | Where-Object { $_ -and $_ -notmatch '^Category:' } | Select-Object -Unique
  Write-Host "Found $($names.Count) unique Fortune 500 company pages" -ForegroundColor Green
  return $names
}

function Get-IndianITCompanies {
  Write-Host "Fetching Indian IT companies via Wikipedia category..." -ForegroundColor Cyan
  $members = Get-CategoryMembers -CategoryTitle 'Category:Information_technology_companies_of_India' -Limit 500
  $names = @(); foreach ($m in $members) { if ($m.title) { $names += (Normalize-Text $m.title) } }
  $names = $names | Where-Object { $_ -and $_ -notmatch '^Category:' } | Select-Object -Unique | Select-Object -First $MaxIndianIT
  Write-Host "Found $($names.Count) Indian IT company pages" -ForegroundColor Green
  return $names
}

function Upsert-Organizations { param([string[]]$Names,[string]$DefaultIndustry,[string]$DefaultType='Company',[switch]$EnrichWebsite)
  $inserted = 0
  foreach ($name in $Names) {
    $safeName = Truncate-String ($name -replace "'", "''") 200
    $industry = $DefaultIndustry
    $size = $null
    $website = $null
    $linkedin = $null
    $logo = $null

    $qid = Get-WikibaseItemId -Title $safeName
    if ($qid) {
      $e = Enrich-FromWikidata -Qid $qid
      if ($e.Industry) { $industry = $e.Industry }
      if ($e.Size) { $size = $e.Size }
      if ($e.Website) { $website = $e.Website }
      if ($e.LinkedIn) { $linkedin = $e.LinkedIn }
      if ($e.LogoURL) { $logo = $e.LogoURL }
    }

    $industry = Truncate-String ($industry -replace "'", "''") 100
    $size = Truncate-String ($size -replace "'", "''") 20
    $website = Truncate-String ($website -replace "'", "''") 500
    $linkedin = Truncate-String ($linkedin -replace "'", "''") 500
    $logo = Truncate-String ($logo -replace "'", "''") 1000

    $insertQuery = @"
IF NOT EXISTS (SELECT 1 FROM Organizations WHERE Name = N'$safeName')
BEGIN
  INSERT INTO Organizations (Name, Type, Industry, Size, Website, LinkedInProfile, Description, LogoURL, VerificationStatus, CreatedAt, UpdatedAt, IsActive)
  VALUES (N'$safeName', N'$DefaultType', N'$industry', $(if ($size) {"N'$size'"} else {'N''Unknown''' }), $(if ($website) {"N'$website'"} else {'NULL'}), $(if ($linkedin) {"N'$linkedin'"} else {'NULL'}), NULL, $(if ($logo) {"N'$logo'"} else {'NULL'}), 0, GETUTCDATE(), GETUTCDATE(), 1);
END
ELSE
BEGIN
  UPDATE Organizations SET
    Industry = COALESCE(NULLIF(Industry,''), N'$industry'),
    Size = COALESCE(NULLIF(Size,''), $(if ($size) {"N'$size'"} else {'N''Unknown''' })),
    Website = COALESCE(NULLIF(Website,''), $(if ($website) {"N'$website'"} else {'NULL'})),
    LinkedInProfile = COALESCE(NULLIF(LinkedInProfile,''), $(if ($linkedin) {"N'$linkedin'"} else {'NULL'})),
    LogoURL = COALESCE(NULLIF(LogoURL,''), $(if ($logo) {"N'$logo'"} else {'NULL'})),
    UpdatedAt = GETUTCDATE()
  WHERE Name = N'$safeName';
END
"@

    try { Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $insertQuery -QueryTimeout 120 | Out-Null; $inserted++ }
    catch { Write-Warning "Failed upsert for '$name': $($_.Exception.Message)" }
  }
  return $inserted
}

$fortuneNames = if ($Accurate) { Get-FortuneCompanies } else { @() }
if (-not $fortuneNames -or $fortuneNames.Count -eq 0) {
  Write-Warning 'Falling back to minimal Fortune list due to API failure'
  $fortuneNames = @('Apple Inc.','Microsoft','Saudi Aramco','Amazon','Alphabet Inc.','Samsung Electronics','Toyota','Volkswagen Group')
}

$indiaNames = if ($Accurate) { Get-IndianITCompanies } else { @('Tata Consultancy Services','Infosys','Wipro','HCL Technologies','Tech Mahindra','LTIMindtree','Mphasis','Persistent Systems','Cognizant','Capgemini') }

$ins1 = Upsert-Organizations -Names $fortuneNames -DefaultIndustry 'Various' -EnrichWebsite
$ins2 = Upsert-Organizations -Names $indiaNames -DefaultIndustry 'Information Technology' -EnrichWebsite

Write-Host "\n? Seed completed. Processed Fortune: $ins1, India IT: $ins2" -ForegroundColor Green
