# ### AI SPECIAL ATTENTION RULES START ###
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# ### AI SPECIAL ATTENTION RULES END ###
#
# Gitee hosts refresh. Replaces only the marked block. Tries IP library, caches working IP.
# Markers: # Gitee Host Start ... # Gitee Host End

$ErrorActionPreference = "Stop"

$scriptPath = $PSScriptRoot
$GiteeMarkerStart = "# Gitee Host Start"
$GiteeMarkerEnd = "# Gitee Host End"
$GiteeDomains = @("gitee.com", "www.gitee.com", "api.gitee.com")
$GiteeTestUrl = "https://gitee.com/"
$GiteeTestTimeoutSec = 5
$GiteeIpLibrary = @("180.76.198.225", "180.76.199.13", "180.76.198.77")
$GiteeCacheDir = "C:\_node_core"
$GiteeCacheFile = ""

$script:HostsPath = ""
$script:ChosenIp = ""
$script:BlockContent = ""
$script:ReplacedCount = 0
$script:EchoCommand = $null
$script:WriteColorText = { param($t, $c) Write-Host $t }

if ($env:OS -match "Windows") {
    $GiteeCacheFile = Join-Path $GiteeCacheDir "gitee_host_cache.txt"
} else {
    $GiteeCacheFile = "/var/_node_core/gitee_host_cache.txt"
}

$hostsCommonPath = Join-Path $scriptPath "hosts_common.ps1"
if (Test-Path $hostsCommonPath) {
    . $hostsCommonPath
}

function Get-GiteeCacheIp {
    if (-not (Test-Path $GiteeCacheFile)) { return $null }
    $content = Get-Content -Path $GiteeCacheFile -Raw -ErrorAction SilentlyContinue
    if ([string]::IsNullOrWhiteSpace($content)) { return $null }
    $ip = $content.Trim()
    if ($ip -match "^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$") { return $ip }
    return $null
}

function Set-GiteeCacheIp {
    param([string]$Ip)
    $dir = Split-Path $GiteeCacheFile -Parent
    if (-not (Test-Path $dir)) {
        New-Item -Path $dir -ItemType Directory -Force | Out-Null
    }
    Set-Content -Path $GiteeCacheFile -Value $Ip -Encoding UTF8 -NoNewline
}

function Test-GiteeIpWithPing {
    param([string]$Ip)
    if ([string]::IsNullOrWhiteSpace($Ip)) { return $false }
    try {
        $p = Start-Process -FilePath "ping" -ArgumentList "-n", "1", "-w", ($GiteeTestTimeoutSec * 1000), $Ip -Wait -NoNewWindow -PassThru
        return ($p.ExitCode -eq 0)
    } catch {
        return $false
    }
}

function Get-GiteeBlockContent {
    param([string]$Ip)
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine($GiteeMarkerStart)
    foreach ($d in $GiteeDomains) {
        [void]$sb.AppendLine("$Ip`t$d")
    }
    [void]$sb.AppendLine("# Cached working IP for Gitee")
    [void]$sb.AppendLine($GiteeMarkerEnd)
    return $sb.ToString()
}

function Invoke-GiteeHostRefresh {
    param(
        [scriptblock]$WriteColorText = { param($t, $c) Write-Host $t }
    )
    $script:WriteColorText = $WriteColorText
    $script:EchoCommand = { param($cmd) & $script:WriteColorText "> $cmd" "DarkGray" }
    $script:HostsPath = Get-HostsFilePath
    $script:ChosenIp = ""
    $script:BlockContent = ""
    $script:ReplacedCount = 0

    & $script:WriteColorText "Hosts file: $script:HostsPath" "Cyan"
    if (-not (Test-Path $script:HostsPath)) {
        Write-Warning "Hosts file not found: $script:HostsPath"
        return
    }

    $cachedIp = Get-GiteeCacheIp
    $candidates = @()
    if ($cachedIp) {
        $candidates += $cachedIp
    }
    foreach ($ip in $GiteeIpLibrary) {
        if ($candidates -notcontains $ip) {
            $candidates += $ip
        }
    }

    & $script:WriteColorText "Gitee IP candidates (cached first, then library): $($candidates -join ', ')" "Cyan"
    foreach ($ip in $candidates) {
        & $script:WriteColorText "Testing IP: $ip ..." "Cyan"
        & $script:EchoCommand "ping -n 1 -w $($GiteeTestTimeoutSec * 1000) $ip"
        if (Test-GiteeIpWithPing -Ip $ip) {
            $script:ChosenIp = $ip
            & $script:WriteColorText "IP $ip responds OK (ping)." "Green"
            break
        }
        & $script:WriteColorText "IP $ip failed, try next." "Yellow"
    }

    if (-not $script:ChosenIp) {
        Write-Warning "No Gitee IP responded. Hosts not updated."
        foreach ($ip in $candidates) {
            & $script:WriteColorText "  ping -n 1 -w $($GiteeTestTimeoutSec * 1000) $ip" "DarkGray"
        }
        $speedTestUrl = "https://tool.chinaz.com/speedworld/www.gitee.com"
        & $script:WriteColorText "Opening in browser: $speedTestUrl" "Cyan"
        try {
            Start-Process $speedTestUrl
        } catch {
            Write-Warning "Failed to open browser: $_"
        }
        return
    }

    Set-GiteeCacheIp -Ip $script:ChosenIp
    $script:BlockContent = Get-GiteeBlockContent -Ip $script:ChosenIp
    & $script:WriteColorText "Gitee block content:" "Cyan"
    & $script:WriteColorText $script:BlockContent "DarkGray"

    $existingLines = @(Get-Content -Path $script:HostsPath -Encoding UTF8 -ErrorAction Stop)
    $result = Remove-MarkedBlock -Lines $existingLines -MarkerStart $GiteeMarkerStart -MarkerEnd $GiteeMarkerEnd
    $withoutBlock = $result.Lines
    $script:ReplacedCount = $result.RemovedCount
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
    $toWrite = ($baseLines -join $newLine) + $newLine + $newLine + $script:BlockContent + $newLine

    & $script:EchoCommand "Write-Content to `"$script:HostsPath`""
    try {
        [System.IO.File]::WriteAllText($script:HostsPath, $toWrite, [System.Text.UTF8Encoding]::new($false))
    } catch {
        Write-Warning "Failed to write hosts file (may need Administrator): $_"
        return
    }

    & $script:EchoCommand "ipconfig /flushdns"
    Invoke-HostsFlushDns

    & $script:WriteColorText "Gitee HOST refresh succeeded. Using IP: $script:ChosenIp" "Green"
    & $script:WriteColorText "Verifying: resolving gitee.com..." "DarkGray"
    & $script:EchoCommand "Resolve-DnsName gitee.com -ErrorAction SilentlyContinue | Select-Object -First 1"
    $resolved = Resolve-DnsName -Name "gitee.com" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($resolved -and $resolved.IPAddress) {
        & $script:WriteColorText "Test OK: gitee.com -> $($resolved.IPAddress)" "Green"
    } else {
        & $script:WriteColorText "Test: Resolve-DnsName did not return IP (may still work via hosts)." "Yellow"
    }
}
