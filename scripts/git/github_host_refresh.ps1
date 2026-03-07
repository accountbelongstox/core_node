# ### AI SPECIAL ATTENTION RULES START ###
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# ### AI SPECIAL ATTENTION RULES END ###
#
# GitHub520 hosts refresh. Replaces only the marked block in hosts file.
# Markers: # GitHub520 Host Start ... # GitHub520 Host End
# Ref: https://github.com/521xueweihan/GitHub520

$ErrorActionPreference = "Stop"

$GitHub520HostsUrl = "https://raw.hellogithub.com/hosts"
$GitHub520MarkerStart = "# GitHub520 Host Start"
$GitHub520MarkerEnd = "# GitHub520 Host End"

$script:HostsPath = ""
$script:DownloadTempFile = ""
$script:NewContent = ""
$script:FetchedCount = 0
$script:ReplacedCount = 0
$script:RefreshSuccess = $false
$script:EchoCommand = $null
$script:WriteColorText = { param($t, $c) Write-Host $t }

function Get-GitHubHostsFilePath {
    if ($env:OS -match "Windows") {
        return Join-Path $env:SystemRoot "System32\drivers\etc\hosts"
    }
    return "/etc/hosts"
}

function Get-CurlPath {
    $curlExe = Get-Command "curl.exe" -ErrorAction SilentlyContinue
    if ($curlExe) { return $curlExe.Source }
    $curlExe = Get-Command "curl" -ErrorAction SilentlyContinue
    if ($curlExe -and $curlExe.Source -notmatch "Invoke-WebRequest") { return $curlExe.Source }
    return $null
}

function Install-CurlIfMissing {
    if (Get-CurlPath) { return }
    if (Get-Command "winget" -ErrorAction SilentlyContinue) {
        try {
            Start-Process -FilePath "winget" -ArgumentList "install","curl.curl","--accept-package-agreements","--accept-source-agreements" -Wait -NoNewWindow
        } catch { }
    }
    if (-not (Get-CurlPath) -and (Get-Command "choco" -ErrorAction SilentlyContinue)) {
        try {
            Start-Process -FilePath "choco" -ArgumentList "install","curl","-y" -Wait -NoNewWindow
        } catch { }
    }
}

function Get-HostEntryCount {
    param([string]$Content)
    $n = 0
    foreach ($line in ($Content -split "[\r\n]+")) {
        $t = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($t) -or $t.StartsWith("#")) { continue }
        if ($t -match "^\s*[\d.]+\s+\S+") { $n++ }
    }
    return $n
}

function Remove-GitHub520Block {
    param([string[]]$Lines)
    $out = @()
    $inside = $false
    $script:ReplacedCount = 0
    foreach ($line in $Lines) {
        if ($line -match "^\s*" + [regex]::Escape($GitHub520MarkerStart)) {
            $inside = $true
            $script:ReplacedCount++
            continue
        }
        if ($inside) {
            $script:ReplacedCount++
            if ($line -match "^\s*" + [regex]::Escape($GitHub520MarkerEnd)) {
                $inside = $false
            }
            continue
        }
        $out += $line
    }
    return $out
}

function Invoke-GitHubHostRefresh {
    param(
        [scriptblock]$WriteColorText = { param($t, $c) Write-Host $t }
    )
    $script:WriteColorText = $WriteColorText
    $script:EchoCommand = { param($cmd) & $script:WriteColorText "> $cmd" "DarkGray" }
    $script:HostsPath = Get-GitHubHostsFilePath
    $script:RefreshSuccess = $false
    $script:NewContent = ""
    $script:FetchedCount = 0
    $script:ReplacedCount = 0

    & $script:WriteColorText "Hosts file: $script:HostsPath" "Cyan"
    if (-not (Test-Path $script:HostsPath)) {
        Write-Warning "Hosts file not found: $script:HostsPath"
        return
    }

    & $script:WriteColorText "Fetching GitHub520 hosts..." "Cyan"
    $curlPath = Get-CurlPath
    if (-not $curlPath) {
        Write-Warning "curl not found. Attempting to install..."
        Install-CurlIfMissing
        $curlPath = Get-CurlPath
    }
    if (-not $curlPath) {
        Write-Warning "Could not find or install curl. Install manually (e.g. winget install curl.curl)."
        return
    }

    $script:DownloadTempFile = [System.IO.Path]::GetTempFileName()
    $curlArgs = @("-sL", "--connect-timeout", "15", "--max-time", "30", "-o", $script:DownloadTempFile, $GitHub520HostsUrl)
    & $script:EchoCommand "& `"$curlPath`" -sL --connect-timeout 15 --max-time 30 -o `"$script:DownloadTempFile`" `"$GitHub520HostsUrl`""
    Start-Process -FilePath $curlPath -ArgumentList $curlArgs -Wait -NoNewWindow

    if (-not (Test-Path $script:DownloadTempFile)) {
        Write-Warning "Download failed: temp file does not exist."
        return
    }
    $rawSize = (Get-Item $script:DownloadTempFile).Length
    if ($rawSize -eq 0) {
        Write-Warning "Download failed: file is empty."
        Remove-Item $script:DownloadTempFile -ErrorAction SilentlyContinue
        return
    }

    $script:NewContent = [System.IO.File]::ReadAllText($script:DownloadTempFile, [System.Text.Encoding]::UTF8).TrimEnd()
    Remove-Item $script:DownloadTempFile -ErrorAction SilentlyContinue
    $script:DownloadTempFile = ""

    if (-not ($script:NewContent -match [regex]::Escape($GitHub520MarkerStart) -and $script:NewContent -match [regex]::Escape($GitHub520MarkerEnd))) {
        Write-Warning "Downloaded content missing expected markers (Start/End)."
        return
    }

    & $script:WriteColorText "Downloaded content (GitHub520 block):" "Cyan"
    & $script:WriteColorText $script:NewContent "DarkGray"
    $script:FetchedCount = Get-HostEntryCount -Content $script:NewContent
    & $script:WriteColorText "Fetched entries: $script:FetchedCount" "Cyan"

    $existingLines = @(Get-Content -Path $script:HostsPath -Encoding UTF8 -ErrorAction Stop)
    $withoutBlock = Remove-GitHub520Block -Lines $existingLines
    & $script:WriteColorText "Replaced (old block lines): $script:ReplacedCount" "Cyan"

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
    $toWrite = ($baseLines -join $newLine) + $newLine + $newLine + $script:NewContent + $newLine

    & $script:EchoCommand "Write-Content to `"$script:HostsPath`""
    try {
        [System.IO.File]::WriteAllText($script:HostsPath, $toWrite, [System.Text.UTF8Encoding]::new($false))
    } catch {
        Write-Warning "Failed to write hosts file (may need Administrator): $_"
        return
    }

    & $script:EchoCommand "ipconfig /flushdns"
    try {
        Start-Process -FilePath "ipconfig" -ArgumentList "/flushdns" -Wait -NoNewWindow
    } catch {
        Write-Warning "Flush DNS skipped: $_"
    }

    $script:RefreshSuccess = $true
    & $script:WriteColorText "Refresh succeeded. Hosts file updated and DNS cache flushed." "Green"
    & $script:WriteColorText "Verifying: resolving github.com..." "DarkGray"
    & $script:EchoCommand "Resolve-DnsName github.com -ErrorAction SilentlyContinue | Select-Object -First 1"
    $resolved = Resolve-DnsName -Name "github.com" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($resolved -and $resolved.IPAddress) {
        & $script:WriteColorText "Test OK: github.com -> $($resolved.IPAddress)" "Green"
    } else {
        & $script:WriteColorText "Test: Resolve-DnsName did not return IP (may still work via hosts)." "Yellow"
    }
}
