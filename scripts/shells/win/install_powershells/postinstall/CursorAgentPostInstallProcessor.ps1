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
# Ensures Cursor agent CLI and RipGrep (BurntSushi.ripgrep.MSVC) are installed; verifies both, no skip.

$script:AgentInstallUrl = "https://cursor.com/install?win32=true"
$script:RipgrepWingetId = "BurntSushi.ripgrep.MSVC"

function Test-AgentCommandPresent {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    $cursorCmd = Get-Command cursor -ErrorAction SilentlyContinue
    if ($cursorCmd) { return $true }
    $agentCmd = Get-Command agent -ErrorAction SilentlyContinue
    if ($agentCmd) { return $true }
    return $false
}

function Test-RipgrepPresent {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
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
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
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
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    try {
        $v = & rg --version 2>&1
        if ($v) { return ($v | Out-String).Trim() }
    } catch { }
    return ""
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

    # --- Agent CLI: always run install path if needed, then verify and print version (do not skip) ---
    if (Test-AgentCommandPresent) {
        Write-Host "$LogPrefix Agent CLI already present (verified)." -ForegroundColor Green
        $agentOk = $true
    } else {
        Write-Host "$LogPrefix Installing Cursor agent CLI (cursor + agent command)..." -ForegroundColor Cyan
        try {
            Invoke-RestMethod -Uri $script:AgentInstallUrl -Method Get | Invoke-Expression
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            if (Test-AgentCommandPresent) {
                Write-Host "$LogPrefix Agent CLI install verified (cursor/agent command found)." -ForegroundColor Green
                $agentOk = $true
            } else {
                Write-Host "$LogPrefix Agent CLI install ran but verification failed: cursor/agent command not found in PATH." -ForegroundColor Red
            }
        } catch {
            Write-Host "$LogPrefix Agent CLI install failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    if ($agentOk) {
        $agentVer = Get-AgentVersion
        if ($agentVer) { Write-Host "$LogPrefix Agent CLI version: $agentVer" -ForegroundColor Cyan } else { Write-Host "$LogPrefix Agent CLI version: (could not get)" -ForegroundColor Yellow }
    }

    # --- RipGrep: always run install path if needed, then verify and print version (do not skip) ---
    if (Test-RipgrepPresent) {
        Write-Host "$LogPrefix RipGrep (rg) already present (verified)." -ForegroundColor Green
        $ripgrepOk = $true
    } else {
        Write-Host "$LogPrefix Installing RipGrep (BurntSushi.ripgrep.MSVC) via winget..." -ForegroundColor Cyan
        try {
            $wingetPath = Get-Command winget -ErrorAction SilentlyContinue
            if (-not $wingetPath) {
                Write-Host "$LogPrefix winget not found; cannot install RipGrep." -ForegroundColor Red
            } else {
                $proc = Start-Process -FilePath "winget" -ArgumentList "install", "--id", $script:RipgrepWingetId, "-e", "--accept-package-agreements", "--accept-source-agreements" -Wait -PassThru -NoNewWindow
                $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
                if ($proc.ExitCode -eq 0 -and (Test-RipgrepPresent)) {
                    Write-Host "$LogPrefix RipGrep install verified (rg found)." -ForegroundColor Green
                    $ripgrepOk = $true
                } elseif (Test-RipgrepPresent) {
                    Write-Host "$LogPrefix RipGrep verified (rg found)." -ForegroundColor Green
                    $ripgrepOk = $true
                } else {
                    Write-Host "$LogPrefix RipGrep install completed but verification failed: rg not found in PATH (exit code $($proc.ExitCode))." -ForegroundColor Red
                }
            }
        } catch {
            Write-Host "$LogPrefix RipGrep install failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    if ($ripgrepOk) {
        $rgVer = Get-RipgrepVersion
        if ($rgVer) { Write-Host "$LogPrefix RipGrep version: $rgVer" -ForegroundColor Cyan } else { Write-Host "$LogPrefix RipGrep version: (could not get)" -ForegroundColor Yellow }
    }

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
