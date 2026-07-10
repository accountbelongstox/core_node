# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED.
# ### AI SPECIAL ATTENTION RULES END ###

# NSSM-backed Windows background service registration, shared by native-Windows app
# start scripts (poly_apps/*/scripts/start.ps1). Windows counterpart of
# scripts/shells/linux/common/debian_service_manager.sh: a plain PowerShell script or
# `composer`/`pnpm` command is not a valid SCM binary (it never calls
# StartServiceCtrlDispatcher), so NSSM wraps it as a resident child process the Service
# Control Manager can start/stop/restart. Register-NssmService is idempotent: a missing
# service is installed, an existing one has its configuration refreshed in place and is
# (re)started -- safe to call on every run.

# Resolve nssm.exe: PATH -> well-known install locations. Returns $null if not found.
function Find-NssmExe {
    $candidateNames = @("nssm", "nssm.exe")
    foreach ($name in $candidateNames) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    $wellKnownPaths = @(
        (Join-Path $env:ProgramFiles "nssm\nssm.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "nssm\nssm.exe")
    )
    foreach ($path in $wellKnownPaths) {
        if ($path -and (Test-Path -LiteralPath $path)) { return $path }
    }
    return $null
}

# Refresh this process's PATH from the registry: a tool just installed by winget/an
# installer script is otherwise invisible until a new shell starts.
function Update-SessionPathFromRegistry {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = @($machinePath, $userPath) -join ";"
}

# Run a DevInstaller Step*.ps1 as a live, visible subprocess (never dot-sourced: these
# are one-shot installer scripts, not reusable libraries, and each is already idempotent
# on its own -- mirrors how start.sh always subprocess-invokes its *_INSTALL_SCRIPT
# files). Existing Step-script logic is never modified here, only invoked on demand.
function Invoke-DevInstallerStep {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRootDir,
        [Parameter(Mandatory = $true)][string]$StepScriptName
    )
    $stepPath = Join-Path $RepoRootDir "scripts\shells\win\install_powershells\$StepScriptName"
    if (-not (Test-Path -LiteralPath $stepPath)) {
        Write-Host "[NssmServiceManager] DevInstaller step not found: $stepPath" -ForegroundColor Red
        return $false
    }
    Write-Host "[NssmServiceManager] Running DevInstaller step (idempotent, live output below): $StepScriptName" -ForegroundColor Yellow
    powershell -NoProfile -ExecutionPolicy Bypass -File $stepPath
    Update-SessionPathFromRegistry
    return ($LASTEXITCODE -eq 0)
}

# Idempotent winget resolution: reuse an existing install, else bootstrap it via the
# canonical DevInstaller step (Step3_InitWinget.ps1) -- needed before Ensure-Nssm (and
# any other winget-based install) can run on a fresh machine.
function Ensure-Winget {
    param([Parameter(Mandatory = $true)][string]$RepoRootDir)
    if (Get-Command winget -ErrorAction SilentlyContinue) { return $true }
    Invoke-DevInstallerStep -RepoRootDir $RepoRootDir -StepScriptName "Step3_InitWinget.ps1" | Out-Null
    return [bool](Get-Command winget -ErrorAction SilentlyContinue)
}

# Idempotent NSSM resolution: reuse an existing install, else auto-install via winget
# (mirrors the Linux pattern of resolving a tool then invoking its canonical installer
# on demand -- see install_powershells/Step40_InstallNSSM.ps1 for the DevInstaller-menu
# entry point that wraps this same function). RepoRootDir is used only to locate
# Step3_InitWinget.ps1 when winget itself is missing.
function Ensure-Nssm {
    param([Parameter(Mandatory = $true)][string]$RepoRootDir)
    $existing = Find-NssmExe
    if ($existing) { return $existing }

    if (-not (Ensure-Winget -RepoRootDir $RepoRootDir)) {
        Write-Host "[NssmServiceManager] NSSM not found and winget is unavailable -> cannot auto-install." -ForegroundColor Yellow
        return $null
    }

    Write-Host "[NssmServiceManager] NSSM not found -> installing via winget (idempotent, live output below)..." -ForegroundColor Yellow
    winget install --id NSSM.NSSM -e --accept-package-agreements --accept-source-agreements
    Update-SessionPathFromRegistry

    $installed = Find-NssmExe
    if ($installed) {
        Write-Host "[NssmServiceManager] NSSM installed: $installed" -ForegroundColor Green
    } else {
        Write-Host "[NssmServiceManager] NSSM install via winget did not produce a usable nssm.exe." -ForegroundColor Red
    }
    return $installed
}

# Launch a child PowerShell script with a GUARANTEED environment variable set.
# Start-Process's default ShellExecute path does not reliably propagate env vars set
# via $env: just before the call (ShellExecuteEx does not always hand off the calling
# process's current block) -- this bypasses ShellExecute entirely via
# System.Diagnostics.Process, whose EnvironmentVariables starts as a copy of the
# current process's environment, so an explicit override is always inherited by the
# child. Used to pre-answer another script's own AS_SERVICE/INCLUDE_UI prompt without
# adding a script parameter (both start.ps1 scripts must stay parameter-free).
function Start-ChildScriptWithEnv {
    param(
        [Parameter(Mandatory = $true)][string]$PwshExePath,
        [Parameter(Mandatory = $true)][string]$ScriptPath,
        [string[]]$ScriptArgs = @(),
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [hashtable]$EnvironmentVars = @{},
        [switch]$Wait,
        [switch]$Hidden
    )
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $PwshExePath
    $startInfo.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`" $($ScriptArgs -join ' ')".TrimEnd()
    $startInfo.WorkingDirectory = $WorkingDirectory
    $startInfo.UseShellExecute = $false
    if ($Hidden) {
        $startInfo.CreateNoWindow = $true
        $startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    }
    foreach ($key in $EnvironmentVars.Keys) {
        $startInfo.EnvironmentVariables[$key] = $EnvironmentVars[$key]
    }
    $proc = [System.Diagnostics.Process]::Start($startInfo)
    if ($Wait) { $proc.WaitForExit() }
    return $proc
}

# DEFAULT YES prompt.
function Read-YesNoDefaultYes {
    param([string]$Message)
    Write-Host "$Message [Y/n] " -ForegroundColor Yellow -NoNewline
    $reply = Read-Host
    return (-not ($reply -match '^[Nn]'))
}

# DEFAULT NO prompt.
function Read-YesNoDefaultNo {
    param([string]$Message)
    Write-Host "$Message [y/N] " -ForegroundColor Yellow -NoNewline
    $reply = Read-Host
    return [bool]($reply -match '^[Yy]')
}

# Idempotent install-or-update + (re)start of an NSSM-wrapped service.
function Register-NssmService {
    param(
        [Parameter(Mandatory = $true)][string]$NssmPath,
        [Parameter(Mandatory = $true)][string]$ServiceName,
        [Parameter(Mandatory = $true)][string]$DisplayName,
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][string]$ExePath,
        [Parameter(Mandatory = $true)][string]$Arguments,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [string[]]$EnvironmentExtra = @(),
        [string]$StdoutLog = "",
        [string]$StderrLog = ""
    )

    $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $existing) {
        Write-Host "[NssmServiceManager] Installing service: $ServiceName" -ForegroundColor Cyan
        & $NssmPath install $ServiceName $ExePath $Arguments
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[NssmServiceManager] nssm install failed for $ServiceName (exit $LASTEXITCODE)" -ForegroundColor Red
            return $false
        }
    } else {
        Write-Host "[NssmServiceManager] Service $ServiceName already registered -> refreshing configuration." -ForegroundColor Yellow
        & $NssmPath set $ServiceName Application $ExePath
        & $NssmPath set $ServiceName AppParameters $Arguments
    }

    & $NssmPath set $ServiceName DisplayName $DisplayName
    & $NssmPath set $ServiceName Description $Description
    & $NssmPath set $ServiceName AppDirectory $WorkingDirectory
    & $NssmPath set $ServiceName Start SERVICE_AUTO_START
    & $NssmPath set $ServiceName AppRestartDelay 5000
    # Without these, NSSM's documented default (https://nssm.cc/usage, "Console window") is to
    # allocate a real console and connect it to the child's stdin/stdout/stderr. PHP's
    # stream_isatty(STDIN) then reports true for a service with nobody attending its console,
    # so any interactive-looking prompt in the child (e.g. artisan's Y/N confirmations) blocks
    # forever instead of skipping -- this hung laravel_main's sys:init before port 9000 ever
    # opened. AppNoConsole disables the console entirely; AppStdin NUL is a belt-and-suspenders
    # explicit redirect so a read from stdin returns immediately instead of blocking.
    & $NssmPath set $ServiceName AppNoConsole 1
    & $NssmPath set $ServiceName AppStdin "NUL"
    if ($EnvironmentExtra.Count -gt 0) {
        & $NssmPath set $ServiceName AppEnvironmentExtra ($EnvironmentExtra -join "`r`n")
    }
    if ($StdoutLog) {
        & $NssmPath set $ServiceName AppStdout $StdoutLog
        & $NssmPath set $ServiceName AppRotateFiles 1
    }
    if ($StderrLog) {
        & $NssmPath set $ServiceName AppStderr $StderrLog
    }

    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $svc) {
        Write-Host "[NssmServiceManager] Service $ServiceName not found after registration." -ForegroundColor Red
        return $false
    }
    if ($svc.Status -eq "Running") {
        Write-Host "[NssmServiceManager] Restarting service: $ServiceName" -ForegroundColor Cyan
        Restart-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "[NssmServiceManager] Starting service: $ServiceName" -ForegroundColor Cyan
        Start-Service -Name $ServiceName -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
    $svc.Refresh()
    Write-Host "[NssmServiceManager] Service $ServiceName status: $($svc.Status)" -ForegroundColor Green
    return $true
}
