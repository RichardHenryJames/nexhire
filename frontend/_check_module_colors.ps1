$files = Get-Content "$env:TEMP\changed_files.txt"

foreach ($f in $files) {
    if (-not (Test-Path $f)) { continue }
    $lines = Get-Content $f
    $issues = @()
    $insideArrowFn = $false
    $braceDepth = 0
    $parenDepth = 0
    $inMultiLineComment = $false
    $inGetStylesFn = $false
    $getStylesBraceDepth = 0
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        $trimmed = $line.Trim()
        
        # Track multi-line comments
        if ($trimmed -match '/\*') { $inMultiLineComment = $true }
        if ($trimmed -match '\*/') { $inMultiLineComment = $false; continue }
        if ($inMultiLineComment) { continue }
        
        # Skip single-line comments
        if ($trimmed -match '^\s*//' -or $trimmed -match '^\s*\*') { continue }
        
        # Detect start of React component function - stop scanning
        # Patterns: export default function Name, function NameWithCapital(, const Name = (, const Name = React.memo
        if ($trimmed -match '^export\s+default\s+function\s+\w' -or
            $trimmed -match '^export\s+function\s+[A-Z]' -or
            $trimmed -match '^function\s+[A-Z]' -or
            $trimmed -match '^(export\s+)?(const|let|var)\s+[A-Z][A-Za-z0-9]+\s*=\s*\(' -or
            $trimmed -match '^(export\s+)?(const|let|var)\s+[A-Z][A-Za-z0-9]+\s*=\s*\(\s*\{' -or
            $trimmed -match '^(export\s+)?(const|let|var)\s+[A-Z][A-Za-z0-9]+\s*=\s*React\.' -or
            $trimmed -match '^(export\s+)?(const|let|var)\s+[A-Z][A-Za-z0-9]+\s*=\s*\(\s*props' -or
            $trimmed -match '^(export\s+)?(const|let|var)\s+[A-Z][A-Za-z0-9]+\s*=\s*\(\s*\)' -or
            $trimmed -match '^export\s+default\s+\(' ) {
            break
        }
        
        # Skip import lines
        if ($trimmed -match '^import\s') { continue }
        
        # Skip const colors = ... definitions  
        if ($trimmed -match '^\s*(const|let|var)\s+colors\s*=') { continue }
        
        # Skip brandColors and authDarkColors references only
        if ($trimmed -match 'brandColors|authDarkColors') { continue }
        
        # Track lines that define a function taking colors as param (these are OK)
        # e.g., const getStyles = (colors) => ({  or  const styles = (colors) => {
        if ($trimmed -match '=\s*\(\s*colors\s*\)\s*=>') { 
            $inGetStylesFn = $true
            $getStylesBraceDepth = 0
            # Count opening braces
            $opens = ([regex]::Matches($line, '\{')).Count
            $closes = ([regex]::Matches($line, '\}')).Count
            $getStylesBraceDepth += ($opens - $closes)
            continue 
        }
        if ($trimmed -match '=\s*\(\s*colors\s*,') { 
            $inGetStylesFn = $true
            $getStylesBraceDepth = 0
            $opens = ([regex]::Matches($line, '\{')).Count
            $closes = ([regex]::Matches($line, '\}')).Count
            $getStylesBraceDepth += ($opens - $closes)
            continue 
        }
        
        # If inside a getStyles-type function, track braces to know when it ends
        if ($inGetStylesFn) {
            $opens = ([regex]::Matches($line, '\{')).Count
            $closes = ([regex]::Matches($line, '\}')).Count
            $getStylesBraceDepth += ($opens - $closes)
            if ($getStylesBraceDepth -le 0) {
                $inGetStylesFn = $false
            }
            continue
        }
        
        # Now check if the line has colors. reference at module level
        if ($trimmed -match 'colors\.') {
            $lineNum = $i + 1
            $issues += "  Line ${lineNum}: $trimmed"
        }
    }
    
    if ($issues.Count -gt 0) {
        Write-Host ""
        Write-Host "=== $f ==="
        $issues | ForEach-Object { Write-Host $_ }
    }
}
