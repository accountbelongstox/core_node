# ### AI SPECIAL ATTENTION RULES START ###
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# ### AI SPECIAL ATTENTION RULES END ###
#
# GitHub520 hosts refresh: replace only the marked block in hosts file, leave other entries intact.
# Markers: # GitHub520 Host Start ... # GitHub520 Host End

$ErrorActionPreference = "Stop"

$GitHub520HostsUrl = "https://raw.hellogithub.com/hosts"
$GitHub520MarkerStart = "# GitHub520 Host Start"
$GitHub520MarkerEnd = "# GitHub520 Host End"

function Get-GitHubHostsFilePath {
    if ($env:OS -match "Windows") {
        return Join-Path $env:SystemRoot "System32\drivers\etc\hosts"
    }
    return "/etc/hosts"
}

function Get-ResponseContentAsString {
    param([object]$Response)
    $raw = $Response.Content
    if ($null -eq $raw) { return $null }
    if ($raw -is [byte[]]) {
        return [System.Text.Encoding]::UTF8.GetString($raw)
    }
    if ($raw -is [string]) {
        return $raw.TrimEnd()
    }
    return $raw.ToString().TrimEnd()
}

function Get-GitHubHostsContent {
    try {
        $response = Invoke-WebRequest -Uri $GitHub520HostsUrl -UseBasicParsing -TimeoutSec 15
        if ($response.StatusCode -ne 200) {
            Write-Warning "GitHub520 fetch failed: StatusCode=$($response.StatusCode)"
            return $null
        }
        $text = Get-ResponseContentAsString -Response $response
        if ([string]::IsNullOrWhiteSpace($text)) {
            Write-Warning "GitHub520 fetch returned empty content."
            return $null
        }
        $text = $text.TrimEnd()
        if ($text -match [regex]::Escape($GitHub520MarkerStart) -and $text -match [regex]::Escape($GitHub520MarkerEnd)) {
            return $text
        }
        Write-Warning "GitHub520 content missing expected markers (Start/End)."
        return $null
    } catch {
        Write-Warning "Failed to fetch GitHub520 hosts: $($_.Exception.Message)"
    }
    return $null
}

function Remove-GitHub520Block {
    param([string[]]$Lines)
    $out = @()
    $inside = $false
    foreach ($line in $Lines) {
        if ($line -match "^\s*" + [regex]::Escape($GitHub520MarkerStart)) {
            $inside = $true
            continue
        }
        if ($inside) {
            if ($line -match "^\s*" + [regex]::Escape($GitHub520MarkerEnd)) {
                $inside = $false
            }
            continue
        }
        $out += $line
    }
    return $out
}

function Update-GitHubHostsFile {
    $hostsPath = Get-GitHubHostsFilePath
    if (-not (Test-Path $hostsPath)) {
        Write-Warning "Hosts file not found: $hostsPath"
        return $false
    }

    $newContent = Get-GitHubHostsContent
    if (-not $newContent) {
        Write-Warning "Could not fetch GitHub520 hosts content."
        return $false
    }

    $existingLines = @(Get-Content -Path $hostsPath -Encoding UTF8 -ErrorAction Stop)
    $withoutBlock = Remove-GitHub520Block -Lines $existingLines
    $trailingEmpty = 0
    for ($i = $withoutBlock.Count - 1; $i -ge 0; $i--) {
        if ([string]::IsNullOrWhiteSpace($withoutBlock[$i])) {
            $trailingEmpty++
        } else {
            break
        }
    }
    $keepCount = $withoutBlock.Count - $trailingEmpty
    $baseLines = if ($keepCount -gt 0) { $withoutBlock[0..($keepCount - 1)] } else { @() }
    $newLine = [Environment]::NewLine
    $toWrite = ($baseLines -join $newLine) + $newLine + $newLine + $newContent + $newLine

    try {
        [System.IO.File]::WriteAllText($hostsPath, $toWrite, [System.Text.UTF8Encoding]::new($false))
    } catch {
        Write-Warning "Failed to write hosts file (may need Administrator): $_"
        return $false
    }

    try {
        Start-Process -FilePath "ipconfig" -ArgumentList "/flushdns" -Wait -NoNewWindow
    } catch {
        Write-Warning "Flush DNS skipped: $_"
    }
    return $true
}

function Invoke-GitHubHostRefresh {
    param(
        [scriptblock]$WriteColorText = { param($t, $c) Write-Host $t }
    )
    & $WriteColorText "Fetching GitHub520 hosts..." "Cyan"
    if (Update-GitHubHostsFile) {
        & $WriteColorText "GitHub HOST updated and DNS flushed." "Green"
        return $true
    }
    & $WriteColorText "GitHub HOST refresh failed or skipped." "Yellow"
    return $false
}
