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

function Get-CurlPath {
    $curlExe = Get-Command "curl.exe" -ErrorAction SilentlyContinue
    if ($curlExe) { return $curlExe.Source }
    $curlExe = Get-Command "curl" -ErrorAction SilentlyContinue
    if ($curlExe -and $curlExe.Source -notmatch "Invoke-WebRequest") { return $curlExe.Source }
    return $null
}

function Install-CurlIfMissing {
    if (Get-CurlPath) { return $true }
    if (Get-Command "winget" -ErrorAction SilentlyContinue) {
        try {
            $proc = Start-Process -FilePath "winget" -ArgumentList "install","curl.curl","--accept-package-agreements","--accept-source-agreements" -Wait -PassThru -NoNewWindow
            if ($proc.ExitCode -eq 0 -and (Get-CurlPath)) { return $true }
        } catch { }
    }
    if (Get-Command "choco" -ErrorAction SilentlyContinue) {
        try {
            $proc = Start-Process -FilePath "choco" -ArgumentList "install","curl","-y" -Wait -PassThru -NoNewWindow
            if ($proc.ExitCode -eq 0 -and (Get-CurlPath)) { return $true }
        } catch { }
    }
    return $false
}

function Get-GitHubHostsContent {
    param([scriptblock]$EchoCommand = $null)
    $curlPath = Get-CurlPath
    if (-not $curlPath) {
        Write-Warning "curl not found. Attempting to install..."
        if (-not (Install-CurlIfMissing)) {
            Write-Warning "Could not install curl. Install curl manually (e.g. winget install curl.curl)."
            return $null
        }
        $curlPath = Get-CurlPath
    }
    $tempFile = [System.IO.Path]::GetTempFileName()
    try {
        $curlArgs = @("-sL", "--connect-timeout", "15", "--max-time", "30", "-o", $tempFile, $GitHub520HostsUrl)
        $cmdLine = "& `"$curlPath`" -sL --connect-timeout 15 --max-time 30 -o `"$tempFile`" `"$GitHub520HostsUrl`""
        if ($EchoCommand) { & $EchoCommand $cmdLine }
        $proc = Start-Process -FilePath $curlPath -ArgumentList $curlArgs -Wait -NoNewWindow -PassThru
        if ($proc.ExitCode -ne 0) {
            Write-Warning "GitHub520 fetch failed: curl exit code $($proc.ExitCode)"
            return $null
        }
        if (-not (Test-Path $tempFile)) {
            Write-Warning "GitHub520 fetch failed: no output file."
            return $null
        }
        $text = [System.IO.File]::ReadAllText($tempFile, [System.Text.Encoding]::UTF8).TrimEnd()
        if ([string]::IsNullOrWhiteSpace($text)) {
            Write-Warning "GitHub520 fetch returned empty content."
            return $null
        }
        if ($text -match [regex]::Escape($GitHub520MarkerStart) -and $text -match [regex]::Escape($GitHub520MarkerEnd)) {
            return $text
        }
        Write-Warning "GitHub520 content missing expected markers (Start/End)."
        return $null
    } catch {
        Write-Warning "Failed to fetch GitHub520 hosts: $($_.Exception.Message)"
        return $null
    } finally {
        if (Test-Path $tempFile) { Remove-Item $tempFile -Force -ErrorAction SilentlyContinue }
    }
}

function Get-HostEntryCount {
    param([string]$Content)
    $count = 0
    foreach ($line in ($Content -split "[\r\n]+")) {
        $t = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($t) -or $t.StartsWith("#")) { continue }
        if ($t -match "^\s*[\d.]+\s+\S+") { $count++ }
    }
    return $count
}

function Remove-GitHub520Block {
    param([string[]]$Lines)
    $out = @()
    $inside = $false
    $removedCount = 0
    foreach ($line in $Lines) {
        if ($line -match "^\s*" + [regex]::Escape($GitHub520MarkerStart)) {
            $inside = $true
            $removedCount++
            continue
        }
        if ($inside) {
            $removedCount++
            if ($line -match "^\s*" + [regex]::Escape($GitHub520MarkerEnd)) {
                $inside = $false
            }
            continue
        }
        $out += $line
    }
    return @{ Lines = $out; RemovedCount = $removedCount }
}

function Update-GitHubHostsFile {
    param([scriptblock]$EchoCommand = $null)
    $hostsPath = Get-GitHubHostsFilePath
    if (-not (Test-Path $hostsPath)) {
        Write-Warning "Hosts file not found: $hostsPath"
        return @{ Success = $false; FetchedCount = 0; ReplacedCount = 0 }
    }

    $newContent = Get-GitHubHostsContent -EchoCommand $EchoCommand
    if (-not $newContent) {
        Write-Warning "Could not fetch GitHub520 hosts content."
        return @{ Success = $false; FetchedCount = 0; ReplacedCount = 0 }
    }

    $fetchedCount = Get-HostEntryCount -Content $newContent
    $existingLines = @(Get-Content -Path $hostsPath -Encoding UTF8 -ErrorAction Stop)
    $blockResult = Remove-GitHub520Block -Lines $existingLines
    $withoutBlock = $blockResult.Lines
    $replacedCount = $blockResult.RemovedCount
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

    if ($EchoCommand) { & $EchoCommand "Write-Content to `"$hostsPath`" (GitHub520 block)" }
    try {
        [System.IO.File]::WriteAllText($hostsPath, $toWrite, [System.Text.UTF8Encoding]::new($false))
    } catch {
        Write-Warning "Failed to write hosts file (may need Administrator): $_"
        return @{ Success = $false; FetchedCount = $fetchedCount; ReplacedCount = $replacedCount }
    }

    if ($EchoCommand) { & $EchoCommand "ipconfig /flushdns" }
    try {
        Start-Process -FilePath "ipconfig" -ArgumentList "/flushdns" -Wait -NoNewWindow
    } catch {
        Write-Warning "Flush DNS skipped: $_"
    }
    return @{ Success = $true; FetchedCount = $fetchedCount; ReplacedCount = $replacedCount }
}

function Invoke-GitHubHostRefresh {
    param(
        [scriptblock]$WriteColorText = { param($t, $c) Write-Host $t }
    )
    $echoCmd = { param($cmd) & $WriteColorText "> $cmd" "DarkGray" }
    & $WriteColorText "Fetching GitHub520 hosts..." "Cyan"
    $result = Update-GitHubHostsFile -EchoCommand $echoCmd
    & $WriteColorText "Fetched entries: $($result.FetchedCount) | Replaced (old block lines): $($result.ReplacedCount)" "Cyan"
    if ($result.Success) {
        & $WriteColorText "Refresh succeeded. Hosts file updated and DNS cache flushed." "Green"
        & $WriteColorText "Verifying: resolving github.com..." "DarkGray"
        $testCmd = "Resolve-DnsName github.com -ErrorAction SilentlyContinue | Select-Object -First 1"
        & $WriteColorText "> $testCmd" "DarkGray"
        $resolved = Resolve-DnsName -Name "github.com" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($resolved -and $resolved.IPAddress) {
            & $WriteColorText "Test OK: github.com -> $($resolved.IPAddress)" "Green"
        } else {
            & $WriteColorText "Test: Resolve-DnsName did not return IP (may still work via hosts)." "Yellow"
        }
        return $true
    }
    & $WriteColorText "Refresh failed or skipped." "Yellow"
    return $false
}
