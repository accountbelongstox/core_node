# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# WinSW-backed Windows background service registration: an actively-maintained (MIT,
# github.com/winsw/winsw) alternative to win_common/NssmServiceManager.ps1. NSSM's last
# release (2.24) shipped 2014-08-31 (https://nssm.cc/download) with no release since;
# WinSW ships continuous releases (stable v2.12.0 used here; v3 is still alpha as of
# this writing). Same role as NssmServiceManager.ps1: wraps a plain script/command
# (not a real SCM binary -- it never calls StartServiceCtrlDispatcher) as a Windows
# service the SCM can start/stop/restart. Same call contract as Register-NssmService
# (drop-in): a poly_apps/*/scripts/start.ps1 can switch to this manager by dot-sourcing
# this file instead and calling Register-WinswService with identical parameters.
# Idempotent like its NSSM counterpart: a missing service is installed, an existing one
# has its config rewritten in place and is stopped/reinstalled/restarted.
# Console/stdin note: per official docs (github.com/winsw/winsw docs/xml-config-file.md),
# WinSW's own documented default is ALSO to allocate a console for the child process
# (<hidewindow> defaults to false) -- Register-WinswService below always emits
# <hidewindow>true</hidewindow> so a wrapped child never sees an attached-console STDIN
# and cannot hang on an interactive-looking prompt. This is the same class of bug fixed
# for NSSM via AppNoConsole/AppStdin in NssmServiceManager.ps1 (root cause: a service
# child whose STDIN looks like a real terminal, e.g. to PHP's stream_isatty(STDIN), can
# block forever on a Y/N confirmation nobody is present to answer).
# WinSW has no winget/choco package (confirmed against the official README): the
# release binary is fetched directly from GitHub Releases and cached, mirroring how
# Ensure-Nssm resolves nssm.exe.

# Pinned stable release (WinSW-x64.exe is the self-contained x64 build -- no local
# .NET Framework/Core dependency, matching nssm.exe's standalone nature).
$Global:WinswReleaseTag = "v2.12.0"
$Global:WinswAssetName = "WinSW-x64.exe"

# Resolve a cached WinSW-x64.exe under <cache>\pycore\tools\winsw. Returns $null if not found.
function Find-WinswExe {
    param([Parameter(Mandatory = $true)][string]$RepoRootDir)
    $winswCacheRoot = if ($Global:CORE_NODE_CACHE_DIR) { $Global:CORE_NODE_CACHE_DIR } elseif ($env:CORE_NODE_CACHE_DIR) { $env:CORE_NODE_CACHE_DIR } else { 'D:\www\cache' }
    $cacheDir = Join-Path $winswCacheRoot 'pycore\tools\winsw'
    $cachedExe = Join-Path $cacheDir $Global:WinswAssetName
    if (Test-Path -LiteralPath $cachedExe) { return $cachedExe }
    return $null
}

# Idempotent WinSW resolution: reuse an already-downloaded copy, else fetch the pinned
# stable release directly from GitHub Releases (no package manager distributes WinSW).
function Ensure-Winsw {
    param([Parameter(Mandatory = $true)][string]$RepoRootDir)
    $existing = Find-WinswExe -RepoRootDir $RepoRootDir
    if ($existing) { return $existing }

    $winswCacheRoot = if ($Global:CORE_NODE_CACHE_DIR) { $Global:CORE_NODE_CACHE_DIR } elseif ($env:CORE_NODE_CACHE_DIR) { $env:CORE_NODE_CACHE_DIR } else { 'D:\www\cache' }
    $cacheDir = Join-Path $winswCacheRoot 'pycore\tools\winsw'
    if (-not (Test-Path -LiteralPath $cacheDir)) { New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null }
    $targetExe = Join-Path $cacheDir $Global:WinswAssetName
    $downloadUrl = "https://github.com/winsw/winsw/releases/download/$($Global:WinswReleaseTag)/$($Global:WinswAssetName)"

    Write-Host "[WinswServiceManager] WinSW not found -> downloading $($Global:WinswReleaseTag) (idempotent, one-time)..." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $targetExe -UseBasicParsing
    } catch {
        Write-Host "[WinswServiceManager] Download failed: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }

    if (Test-Path -LiteralPath $targetExe) {
        Write-Host "[WinswServiceManager] WinSW ready: $targetExe" -ForegroundColor Green
        return $targetExe
    }
    return $null
}

# Minimal XML-attribute/text escaping for values interpolated into the generated config.
function ConvertTo-WinswXmlText {
    param([Parameter(Mandatory = $true)][string]$Text)
    return $Text.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace('"', "&quot;")
}

# Idempotent install-or-update + (re)start of a WinSW-wrapped service. Parameter names
# and meaning intentionally match Register-NssmService (NssmServiceManager.ps1) so a
# caller can switch managers by changing only the dot-sourced file and function name.
# WinSW v2.x resolves its config by same-basename pairing next to its own executable
# (<id>.exe looks for <id>.xml beside itself), not via a CLI path argument or the
# caller's current directory -- each service gets its own renamed exe copy + XML below.
function Register-WinswService {
    param(
        [Parameter(Mandatory = $true)][string]$WinswExePath,
        [Parameter(Mandatory = $true)][string]$ServiceName,
        [Parameter(Mandatory = $true)][string]$DisplayName,
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][string]$ExePath,
        [Parameter(Mandatory = $true)][string]$Arguments,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [string[]]$EnvironmentExtra = @(),
        [string]$StdoutLog = "",
        [string]$StderrLog = "",
        [string]$ServiceDirectory = ""
    )

    $serviceDir = if ([string]::IsNullOrWhiteSpace($ServiceDirectory)) {
        Join-Path $WorkingDirectory "winsw"
    } else {
        [System.IO.Path]::GetFullPath($ServiceDirectory)
    }
    $serviceExe = Join-Path $serviceDir "$ServiceName.exe"
    $serviceXml = Join-Path $serviceDir "$ServiceName.xml"
    $envLineItems = @()
    $envLines = ""
    $parts = @()
    $logDirective = ""
    $logDir = ""
    $xmlContent = ""
    $existingContent = $null
    $configurationChanged = $false
    $service = $null
    $attempt = 0
    $entry = ''

    if (-not (Test-Path -LiteralPath $serviceDir -PathType Container)) {
        New-Item -ItemType Directory -Force -Path $serviceDir | Out-Null
    }
    if (-not (Test-Path -LiteralPath $serviceExe -PathType Leaf)) {
        Copy-Item -LiteralPath $WinswExePath -Destination $serviceExe
    }
    if (-not (Test-Path -LiteralPath $serviceExe -PathType Leaf)) {
        Write-Host "[WinswServiceManager] Wrapper postcondition failed: $serviceExe" -ForegroundColor Red
        return $false
    }

    foreach ($entry in $EnvironmentExtra) {
        $parts = $entry -split "=", 2
        if ($parts.Count -eq 2) {
            $envLineItems = @($envLineItems) + @("  <env name=`"$(ConvertTo-WinswXmlText $parts[0])`" value=`"$(ConvertTo-WinswXmlText $parts[1])`"/>")
        }
    }
    if ($envLineItems.Count -gt 0) {
        $envLines = "{0}`r`n" -f ($envLineItems -join "`r`n")
    }

    if ($StdoutLog -or $StderrLog) {
        $logDir = Split-Path -Parent $StdoutLog
        if (-not $logDir) { $logDir = Split-Path -Parent $StderrLog }
        if ($logDir -and -not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
        $logDirective = "  <logpath>$(ConvertTo-WinswXmlText $logDir)</logpath>`r`n  <log mode=`"roll`"></log>`r`n"
    }

    $xmlContent = @"
<service>
  <id>$(ConvertTo-WinswXmlText $ServiceName)</id>
  <name>$(ConvertTo-WinswXmlText $DisplayName)</name>
  <description>$(ConvertTo-WinswXmlText $Description)</description>
  <executable>$(ConvertTo-WinswXmlText $ExePath)</executable>
  <arguments>$(ConvertTo-WinswXmlText $Arguments)</arguments>
  <workingdirectory>$(ConvertTo-WinswXmlText $WorkingDirectory)</workingdirectory>
  <startmode>Automatic</startmode>
  <onfailure action="restart" delay="5 sec"/>
  <hidewindow>true</hidewindow>
$envLines$logDirective</service>
"@
    if (Test-Path -LiteralPath $serviceXml -PathType Leaf) {
        $existingContent = Get-Content -LiteralPath $serviceXml -Raw
    }
    if ($existingContent -cne $xmlContent) {
        [System.IO.File]::WriteAllText($serviceXml, $xmlContent, [System.Text.UTF8Encoding]::new($false))
        $configurationChanged = $true
    }
    if (-not (Test-Path -LiteralPath $serviceXml -PathType Leaf) -or
        (Get-Content -LiteralPath $serviceXml -Raw) -cne $xmlContent) {
        Write-Host "[WinswServiceManager] Configuration postcondition failed: $serviceXml" -ForegroundColor Red
        return $false
    }

    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($null -eq $service) {
        Write-Host "[WinswServiceManager] Installing service: $ServiceName" -ForegroundColor Cyan
        & $serviceExe install
        $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    }
    elseif ($configurationChanged) {
        Write-Host "[WinswServiceManager] Refreshing changed service configuration: $ServiceName" -ForegroundColor Cyan
        & $serviceExe refresh
        $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    }
    if ($null -eq $service) {
        Write-Host "[WinswServiceManager] Service $ServiceName not found after registration." -ForegroundColor Red
        return $false
    }

    if ($configurationChanged -and $service.Status -eq 'Running') {
        Write-Host "[WinswServiceManager] Restarting changed service: $ServiceName" -ForegroundColor Cyan
        & $serviceExe restart
    }
    elseif ($service.Status -ne 'Running') {
        Write-Host "[WinswServiceManager] Starting service: $ServiceName" -ForegroundColor Cyan
        & $serviceExe start
    }

    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if ($null -ne $service -and $service.Status -eq 'Running') {
            break
        }
        Start-Sleep -Milliseconds 250
    }
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($null -eq $service -or $service.Status -ne 'Running') {
        Write-Host "[WinswServiceManager] Service start postcondition failed: $ServiceName" -ForegroundColor Red
        return $false
    }
    Write-Host "[WinswServiceManager] Service $ServiceName status: $($service.Status)" -ForegroundColor Green
    return $true
}
