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
# Cursor install never skips agent detection; agent detection never skips PATH refresh. Repeated runs fully verify and repair.

$script:AgentInstallUrl = "https://cursor.com/install?win32=true"
$script:RipgrepWingetId = "BurntSushi.ripgrep.MSVC"

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
        return $true
    } catch {
        return $false
    }
}

function Get-AgentVersion {
    Update-ProcessPathFromRegistry
    try {
        $v = & cursor --version 2>&1
        if ($v) { return ($v | Out-String).Trim() }
    } catch { }
    try {
        $v = & agent --version 2>&1
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

# Cursor IDE runs: node ...\AppData\Local\cursor-agent\versions\<version>\index.js
# If that path is missing/corrupt (e.g. another install step removed it), idempotent skip would leave agent broken.
function Test-AgentRuntimeIntact {
    $versionsDir = Join-Path $env:LOCALAPPDATA "cursor-agent\versions"
    if (-not (Test-Path $versionsDir -PathType Container)) { return $false }
    try {
        $versionDirs = Get-ChildItem -Path $versionsDir -Directory -ErrorAction SilentlyContinue
        foreach ($dir in $versionDirs) {
            $indexJs = Join-Path $dir.FullName "index.js"
            if (Test-Path $indexJs -PathType Leaf) { return $true }
        }
    } catch { }
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

    # Cursor install never skips agent detection; agent detection never skips PATH. Always refresh PATH then detect.
    Update-ProcessPathFromRegistry
    if ($PackageName -eq "Cursor") {
        Write-Host "$LogPrefix Cursor install flow: running full agent detection (PATH refreshed, no skip)." -ForegroundColor Cyan
    }

    # --- Step 1: Agent CLI. Always run PATH-backed detection first; install/repair only when missing or broken. ---
    $agentPresentBefore = Test-AgentCommandPresent
    $agentVerBefore = Get-AgentVersion
    $agentBroken = $agentPresentBefore -and (-not $agentVerBefore -or [string]::IsNullOrWhiteSpace($agentVerBefore))
    $runtimeIntact = Test-AgentRuntimeIntact
    $agentNeedInstall = -not $agentPresentBefore -or $agentBroken -or -not $runtimeIntact
    if ($agentBroken) {
        Write-Host "$LogPrefix Agent CLI in PATH but version check failed (broken); will attempt repair." -ForegroundColor Yellow
    }
    if (-not $runtimeIntact -and $agentPresentBefore) {
        Write-Host "$LogPrefix Agent runtime missing or corrupt (no index.js under cursor-agent\versions); will re-run install." -ForegroundColor Yellow
    }
    if ($agentNeedInstall) {
        Write-Host "$LogPrefix Installing Cursor agent CLI (cursor + agent command)..." -ForegroundColor Cyan
        try {
            Invoke-RestMethod -Uri $script:AgentInstallUrl -Method Get | Invoke-Expression
        } catch {
            Write-Host "$LogPrefix Agent CLI install failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "$LogPrefix Agent CLI present and version OK; skipping install (idempotent)." -ForegroundColor Green
    }
    # Always run full agent detection after install/repair (never skip); PATH refresh is inside detection.
    Update-ProcessPathFromRegistry
    $agentOk = Test-AgentCommandPresent
    $agentVer = Get-AgentVersion
    if ($agentVer) { Write-Host "$LogPrefix Agent CLI version: $agentVer" -ForegroundColor Cyan } else { Write-Host "$LogPrefix Agent CLI version: (could not get)" -ForegroundColor Yellow }
    if ($agentOk) { Write-Host "$LogPrefix Agent CLI detection: present." -ForegroundColor Green } else { Write-Host "$LogPrefix Agent CLI detection: not found in PATH." -ForegroundColor Red }

    # --- Step 2: RipGrep. Always run PATH-backed detection; install when not present; never skip detection. ---
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
    # Always run full RipGrep detection after (never skip); PATH refresh is inside detection.
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
