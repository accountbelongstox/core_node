# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY FORBIDDEN
# ### AI SPECIAL ATTENTION RULES END ###

# Cursor Agent Post-Installation Processor
# Official verification is `agent --version` (https://cursor.com/docs/cli/installation).
# Cursor install never skips agent detection; agent detection never skips PATH refresh.

$script:AgentInstallUrl = "https://cursor.com/install?win32=true"
$script:RipgrepWingetId = "BurntSushi.ripgrep.MSVC"
$script:AgentVersionsDir = $null
$script:AgentCacheDir = $null

$script:AgentVersionsDir = Join-Path $env:LOCALAPPDATA "cursor-agent\versions"
$script:AgentCacheDir = Join-Path $env:LOCALAPPDATA "cursor-agent"

function Update-ProcessPathFromRegistry {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = $machinePath + ";" + $userPath
}

function Test-AgentCommandPresent {
    Update-ProcessPathFromRegistry
    $cursorCmd = Get-Command cursor -ErrorAction SilentlyContinue
    if ($cursorCmd) { return $true }
    $agentCmd = Get-Command agent -ErrorAction SilentlyContinue
    if ($agentCmd) { return $true }
    return $false
}

function Test-RipgrepPresent {
    Update-ProcessPathFromRegistry
    $rgCmd = Get-Command rg -ErrorAction SilentlyContinue
    if (-not $rgCmd) { return $false }
    try {
        $null = & rg --version 2>&1
    } catch {
        return $false
    }
    return $true
}

function Get-AgentVersion {
    Update-ProcessPathFromRegistry
    try {
        $v = & agent --version 2>&1
        if ($v) { return ($v | Out-String).Trim() }
    } catch { }
    try {
        $v = & cursor --version 2>&1
        if ($v) { return ($v | Out-String).Trim() }
    } catch { }
    return ""
}

function Get-RipgrepVersion {
    Update-ProcessPathFromRegistry
    try {
        $v = & rg --version 2>&1
        if ($v) { return ($v | Out-String).Trim() }
    } catch { }
    return ""
}

# Legacy Node runtime layout (optional). Modern agent CLI is a standalone binary;
# official verify is only `agent --version`. Missing index.js must NOT force reinstall.
function Test-AgentRuntimeIntact {
    if (-not (Test-Path -LiteralPath $script:AgentVersionsDir -PathType Container)) { return $false }
    try {
        $versionDirs = Get-ChildItem -LiteralPath $script:AgentVersionsDir -Directory -ErrorAction SilentlyContinue
        foreach ($dir in $versionDirs) {
            $indexJs = Join-Path $dir.FullName "index.js"
            if (Test-Path -LiteralPath $indexJs -PathType Leaf) { return $true }
        }
    } catch { }
    return $false
}

function Clear-CorruptCursorAgentDownloadState {
    param([string]$LogPrefix)

    $removed = $false
    if (Test-Path -LiteralPath $script:AgentVersionsDir -PathType Container) {
        try {
            $versionDirs = Get-ChildItem -LiteralPath $script:AgentVersionsDir -Directory -ErrorAction SilentlyContinue
            foreach ($dir in $versionDirs) {
                $indexJs = Join-Path $dir.FullName "index.js"
                if (-not (Test-Path -LiteralPath $indexJs -PathType Leaf)) {
                    Write-Host "$LogPrefix Clearing incomplete agent version dir: $($dir.FullName)" -ForegroundColor Yellow
                    Remove-Item -LiteralPath $dir.FullName -Recurse -Force -ErrorAction SilentlyContinue
                    $removed = $true
                }
            }
        } catch { }
    }

    $tempRoot = $env:TEMP
    if (-not [string]::IsNullOrWhiteSpace($tempRoot) -and (Test-Path -LiteralPath $tempRoot -PathType Container)) {
        try {
            $zipCandidates = Get-ChildItem -LiteralPath $tempRoot -Filter "*cursor*agent*.zip" -File -ErrorAction SilentlyContinue
            foreach ($zip in $zipCandidates) {
                Write-Host "$LogPrefix Removing temp agent zip: $($zip.FullName)" -ForegroundColor Yellow
                Remove-Item -LiteralPath $zip.FullName -Force -ErrorAction SilentlyContinue
                $removed = $true
            }
        } catch { }
    }
    return $removed
}

function Install-CursorAgentCliWithRetry {
    param(
        [string]$LogPrefix,
        [int]$MaxAttempts = 2
    )

    $attempt = 0
    $lastError = ""
    while ($attempt -lt $MaxAttempts) {
        $attempt = $attempt + 1
        try {
            if ($attempt -gt 1) {
                Write-Host "$LogPrefix Retrying agent CLI install (attempt $attempt/$MaxAttempts) after clearing corrupt download state..." -ForegroundColor Yellow
                Clear-CorruptCursorAgentDownloadState -LogPrefix $LogPrefix | Out-Null
            }
            # Download script to file first (more reliable than irm|iex on truncated/gzip edge cases).
            $stamp = [System.DateTime]::UtcNow.ToString("yyyyMMddHHmmssfff")
            $pidPart = [System.Diagnostics.Process]::GetCurrentProcess().Id
            $scriptFile = Join-Path $env:TEMP ("core_node_cursor_agent_install_{0}_{1}.ps1" -f $pidPart, $stamp)
            Invoke-WebRequest -Uri $script:AgentInstallUrl -OutFile $scriptFile -UseBasicParsing -TimeoutSec 180
            if (-not (Test-Path -LiteralPath $scriptFile -PathType Leaf) -or ((Get-Item -LiteralPath $scriptFile).Length -lt 32)) {
                throw "Downloaded install script is empty or missing: $scriptFile"
            }
            # Dot-source / iex in-process so PATH updates from the installer apply to this session.
            $scriptText = Get-Content -LiteralPath $scriptFile -Raw -ErrorAction Stop
            Remove-Item -LiteralPath $scriptFile -Force -ErrorAction SilentlyContinue
            Invoke-Expression $scriptText
            return $true
        } catch {
            $lastError = $_.Exception.Message
            Write-Host "$LogPrefix Agent CLI install attempt $attempt failed: $lastError" -ForegroundColor Red
            $isZipCorrupt = $lastError -match "Central Directory|End of Central|zip|archive"
            if ($isZipCorrupt) {
                Clear-CorruptCursorAgentDownloadState -LogPrefix $LogPrefix | Out-Null
            }
            if (-not $isZipCorrupt -or $attempt -ge $MaxAttempts) {
                break
            }
        }
    }
    if ($lastError -match "denied|Access to the path") {
        Write-Host "$LogPrefix Close Cursor/agent then run as Administrator: irm 'https://cursor.com/install?win32=true' | iex" -ForegroundColor Yellow
    }
    return $false
}

function Invoke-CursorAgentPostInstallProcessor {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$CursorAgentCallback,
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [Parameter(Mandatory = $false)]
        [string]$LogPrefix = "[CursorAgent-PostInstall]"
    )

    $agentOk = $false
    $ripgrepOk = $false
    $agentNeedInstall = $false
    $agentPresentBefore = $false
    $agentVerBefore = ""
    $agentBroken = $false
    $runtimeIntact = $false
    $agentVer = ""
    $rgVer = ""
    $ripgrepPresentBefore = $false
    $wingetPath = $null
    $proc = $null

    Update-ProcessPathFromRegistry
    if ($PackageName -eq "Cursor") {
        Write-Host "$LogPrefix Cursor install flow: running full agent detection (PATH refreshed, no skip)." -ForegroundColor Cyan
    }

    # --- Step 1: Agent CLI. Official verify: agent --version. Do not force reinstall for missing legacy index.js. ---
    $agentPresentBefore = Test-AgentCommandPresent
    $agentVerBefore = Get-AgentVersion
    $agentBroken = $agentPresentBefore -and [string]::IsNullOrWhiteSpace($agentVerBefore)
    $runtimeIntact = Test-AgentRuntimeIntact
    $agentNeedInstall = (-not $agentPresentBefore) -or $agentBroken
    if ($agentBroken) {
        Write-Host "$LogPrefix Agent CLI in PATH but version check failed (broken); will attempt repair." -ForegroundColor Yellow
    }
    if (-not $runtimeIntact -and $agentPresentBefore -and -not $agentBroken) {
        Write-Host "$LogPrefix Note: legacy cursor-agent\versions\index.js not found; agent CLI version OK — skipping reinstall (idempotent)." -ForegroundColor Cyan
    }
    if ($agentNeedInstall) {
        Write-Host "$LogPrefix Installing Cursor agent CLI (cursor + agent command)..." -ForegroundColor Cyan
        Clear-CorruptCursorAgentDownloadState -LogPrefix $LogPrefix | Out-Null
        $null = Install-CursorAgentCliWithRetry -LogPrefix $LogPrefix -MaxAttempts 2
    } else {
        Write-Host "$LogPrefix Agent CLI present and version OK; skipping install (idempotent)." -ForegroundColor Green
    }

    Update-ProcessPathFromRegistry
    $agentOk = Test-AgentCommandPresent
    $agentVer = Get-AgentVersion
    if ($agentVer) { Write-Host "$LogPrefix Agent CLI version: $agentVer" -ForegroundColor Cyan } else { Write-Host "$LogPrefix Agent CLI version: (could not get)" -ForegroundColor Yellow }
    if ($agentOk -and -not [string]::IsNullOrWhiteSpace($agentVer)) {
        $agentOk = $true
        Write-Host "$LogPrefix Agent CLI detection: present." -ForegroundColor Green
    } elseif ($agentOk) {
        $agentOk = $false
        Write-Host "$LogPrefix Agent CLI detection: binary on PATH but version check failed." -ForegroundColor Red
    } else {
        Write-Host "$LogPrefix Agent CLI detection: not found in PATH." -ForegroundColor Red
    }

    # --- Step 2: RipGrep ---
    Update-ProcessPathFromRegistry
    $ripgrepPresentBefore = Test-RipgrepPresent
    if (-not $ripgrepPresentBefore) {
        Write-Host "$LogPrefix Installing RipGrep (BurntSushi.ripgrep.MSVC) via winget..." -ForegroundColor Cyan
        try {
            $wingetPath = Get-Command winget -ErrorAction SilentlyContinue
            if (-not $wingetPath) {
                Write-Host "$LogPrefix winget not found; cannot install RipGrep." -ForegroundColor Red
            } else {
                $proc = Start-Process -FilePath "winget" -ArgumentList "install", "--id", $script:RipgrepWingetId, "-e", "--accept-package-agreements", "--accept-source-agreements" -Wait -PassThru -NoNewWindow
            }
        } catch {
            Write-Host "$LogPrefix RipGrep install failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "$LogPrefix RipGrep present; skipping install (idempotent)." -ForegroundColor Green
    }
    Update-ProcessPathFromRegistry
    $ripgrepOk = Test-RipgrepPresent
    $rgVer = Get-RipgrepVersion
    if ($rgVer) { Write-Host "$LogPrefix RipGrep version: $rgVer" -ForegroundColor Cyan } else { Write-Host "$LogPrefix RipGrep version: (could not get)" -ForegroundColor Yellow }
    if ($ripgrepOk) { Write-Host "$LogPrefix RipGrep detection: present." -ForegroundColor Green } else { Write-Host "$LogPrefix RipGrep detection: not found in PATH." -ForegroundColor Red }

    if (-not $agentOk) {
        Write-Host "$LogPrefix Result: Agent CLI not ensured (verification failed)." -ForegroundColor Red
    }
    if (-not $ripgrepOk) {
        Write-Host "$LogPrefix Result: RipGrep not ensured (verification failed)." -ForegroundColor Red
    }
    if ($agentOk -and $ripgrepOk) {
        Write-Host "$LogPrefix Result: Agent CLI and RipGrep both ensured and verified." -ForegroundColor Green
        return $true
    }
    return $false
}
