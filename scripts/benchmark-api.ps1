param(
  [string]$BaseUrl = "https://refopen-api-func.azurewebsites.net/api",
  [string]$Email = "admin@refopen.com",
  [string]$Password = "12345678",
  [int]$Iterations = 15,
  [int]$PageSize = 20,
  [string]$SearchText = "software"
)

$ErrorActionPreference = 'Stop'

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {
  # no-op
}

function Get-PercentileIndex {
  param(
    [int]$Count,
    [double]$Percent
  )
  if ($Count -le 0) { return $null }
  $idx = [int][Math]::Ceiling($Percent * $Count) - 1
  if ($idx -lt 0) { $idx = 0 }
  if ($idx -ge $Count) { $idx = $Count - 1 }
  return $idx
}

function Get-Stats {
  param([double[]]$Values)

  if (-not $Values -or $Values.Count -eq 0) {
    return [pscustomobject]@{ Count = 0; AvgMs = $null; P50Ms = $null; P95Ms = $null; MinMs = $null; MaxMs = $null }
  }

  $sorted = $Values | Sort-Object
  $count = $sorted.Count
  $avg = [Math]::Round((($sorted | Measure-Object -Average).Average), 1)
  $p50 = $sorted[(Get-PercentileIndex -Count $count -Percent 0.50)]
  $p95 = $sorted[(Get-PercentileIndex -Count $count -Percent 0.95)]
  return [pscustomobject]@{
    Count = $count
    AvgMs = [Math]::Round($avg, 1)
    P50Ms = [Math]::Round($p50, 1)
    P95Ms = [Math]::Round($p95, 1)
    MinMs = [Math]::Round($sorted[0], 1)
    MaxMs = [Math]::Round($sorted[$count - 1], 1)
  }
}

function Invoke-Login {
  param(
    [string]$BaseUrl,
    [string]$Email,
    [string]$Password
  )

  $loginUrl = "$BaseUrl/auth/login"
  $payload = @{ email = $Email; password = $Password } | ConvertTo-Json

  $resp = Invoke-RestMethod -Method Post -Uri $loginUrl -ContentType 'application/json' -Body $payload -TimeoutSec 60

  if (-not $resp.success) {
    throw "Login failed: $($resp.error) $($resp.message)"
  }

  $token = $resp.data.tokens.accessToken
  if (-not $token) {
    throw "Login response missing data.tokens.accessToken"
  }

  return $token
}

function Invoke-TimedGet {
  param(
    [string]$Url,
    [hashtable]$Headers
  )

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $resp = Invoke-WebRequest -Method Get -Uri $Url -Headers $Headers -TimeoutSec 60 -SkipHttpErrorCheck
  $sw.Stop()

  return [pscustomobject]@{
    ElapsedMs = [double]$sw.Elapsed.TotalMilliseconds
    StatusCode = [int]$resp.StatusCode
  }
}

function Benchmark-Endpoint {
  param(
    [string]$Name,
    [string]$Url,
    [hashtable]$Headers,
    [int]$Iterations
  )

  # Warmup (don’t count)
  $null = Invoke-TimedGet -Url $Url -Headers $Headers

  $times = New-Object System.Collections.Generic.List[double]
  $non2xx = 0

  for ($i = 1; $i -le $Iterations; $i++) {
    $r = Invoke-TimedGet -Url $Url -Headers $Headers
    $times.Add($r.ElapsedMs)
    if ($r.StatusCode -lt 200 -or $r.StatusCode -ge 300) {
      $non2xx++
    }
  }

  $stats = Get-Stats -Values ($times.ToArray())

  return [pscustomobject]@{
    Endpoint = $Name
    Url = $Url
    Iter = $stats.Count
    AvgMs = $stats.AvgMs
    P50Ms = $stats.P50Ms
    P95Ms = $stats.P95Ms
    MinMs = $stats.MinMs
    MaxMs = $stats.MaxMs
    Non2xx = $non2xx
  }
}

Write-Host "BaseUrl: $BaseUrl"
Write-Host "Login: POST $BaseUrl/auth/login"

$token = Invoke-Login -BaseUrl $BaseUrl -Email $Email -Password $Password
$headers = @{ Authorization = "Bearer $token" }

$jobsUrl = "$BaseUrl/jobs?page=1&pageSize=$PageSize"
$jobsSearchUrl = "$BaseUrl/jobs?page=1&pageSize=$PageSize&search=$([uri]::EscapeDataString($SearchText))"
$searchJobsUrl = "$BaseUrl/search/jobs?page=1&pageSize=$PageSize&search=$([uri]::EscapeDataString($SearchText))"

$results = @()
$results += Benchmark-Endpoint -Name "GET /jobs (default)" -Url $jobsUrl -Headers $headers -Iterations $Iterations
$results += Benchmark-Endpoint -Name "GET /jobs?search=..." -Url $jobsSearchUrl -Headers $headers -Iterations $Iterations
$results += Benchmark-Endpoint -Name "GET /search/jobs?search=..." -Url $searchJobsUrl -Headers $headers -Iterations $Iterations

$results | Select-Object Endpoint, Iter, AvgMs, P50Ms, P95Ms, MinMs, MaxMs, Non2xx | Format-Table -AutoSize
