# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED.
# ### AI SPECIAL ATTENTION RULES END ###

# Single entry (Windows) for pycore_laravel_wordnew_ui (nexus-dash): the Windows
# counterpart of start.sh. Needs NO parameters. Idempotently resolves bun
# (PATH -> canonical Step4 installer), installs dependencies (skips when already
# present), launches
# the laravel_main backend in its own window, then serves the dashboard dev server
# in the foreground -- unless a background NSSM service is requested (see below).
# Run from repo: .\poly_apps\pycore_laravel_wordnew_ui\scripts\start.ps1
#   Force reinstall: -ForceInstall     Skip backend: -NoBackend
#   Build detected APK: -BuildApk [-App wordnew] [-ApkType debug|release]
#   Background service (idempotent, via NSSM): needs NO parameter -- env var
#   AS_SERVICE=yes|no pre-answers the prompt (same name/values as start.sh) for
#   non-interactive callers. Env var NEXUS_DASH_SERVICE_RUN=1 (set via NSSM
#   AppEnvironmentExtra, never a script argument) marks the NSSM-launched invocation
#   itself: it skips the prompt/registration and the interactive browser-open, and
#   serves in the foreground (that IS the service body).

param(
    [Parameter(Mandatory = $false)]
    [switch]$ForceInstall,
    [Parameter(Mandatory = $false)]
    [switch]$NoBackend,
    [Parameter(Mandatory = $false)]
    [switch]$BuildApk,
    [Parameter(Mandatory = $false)]
    [string]$App,
    [Parameter(Mandatory = $false)]
    [ValidateSet('ask', 'debug', 'release')]
    [string]$ApkType = 'ask',
    [Parameter(Mandatory = $false)]
    [switch]$SkipApkAssets,
    [Parameter(Mandatory = $false)]
    [switch]$CleanApk,
    [Parameter(Mandatory = $false)]
    [switch]$NoOpenOutput,
    [Parameter(Mandatory = $false)]
    [switch]$NonInteractive,
    [Parameter(Mandatory = $false)]
    [switch]$Dist,
    [Parameter(Mandatory = $false)]
    [int]$Port = 0
)

$OriginalDir = (Get-Location).Path
$ScriptDir = $PSScriptRoot
$AppRoot = Split-Path -Parent $ScriptDir
$PolyAppsDir = Split-Path -Parent $AppRoot
$RepoRoot = Split-Path -Parent $PolyAppsDir
$WinCommonDirectory = Join-Path $RepoRoot "scripts\shells\win\win_common"
$ServiceContractCommon = Join-Path $WinCommonDirectory "ServiceContract.ps1"
$FrankenPhpManagerScript = Join-Path $WinCommonDirectory "FrankenPhpManager.ps1"
$WebAccessConfigPath = ''
$WebAccessConfigDirectory = ''
$CoreNodeDataDirectory = ''

. $ServiceContractCommon
. $FrankenPhpManagerScript

Ensure-FrankenPhpWebAccessConfiguration | Out-Null
$WebAccessConfigPath = Get-FrankenPhpWebAccessConfigurationPath
$WebAccessConfigDirectory = Split-Path -Parent $WebAccessConfigPath
$CoreNodeDataDirectory = Split-Path -Parent $WebAccessConfigDirectory
$env:CORE_NODE_DATA_DIR = $CoreNodeDataDirectory

if ($Port -le 0) {
    $Port = Get-ServiceContractPort -Name "nexus_dash_frontend"
}
$BindHost = Get-ServiceContractHost -Name "any"
$LaravelScriptsDir = Join-Path (Join-Path $PolyAppsDir "laravel_main") "scripts"
$LaravelStart = Join-Path $LaravelScriptsDir "start.ps1"
$NodeModulesPath = Join-Path $AppRoot "node_modules"
$PackageJsonPath = Join-Path $AppRoot "package.json"
$BuildApkScript = Join-Path $ScriptDir "flavor\build_apk.py"
$PwshExe = (Get-Command powershell.exe -ErrorAction SilentlyContinue)
$NeedInstall = $false
$hasAnyPackage = $null
$BunWasMissing = $false
$BunSource = ''
$DevPort = $Port
$DevUrl = ""
$OpenUrlJob = $null
$ExitCode = 0
$stalePids = @()
$stalePid = $null
$stillListening = $null
$blockerPid = $null
# Background service registration (NSSM-backed; see win_common/NssmServiceManager.ps1).
$NssmServiceManagerScript = Join-Path $RepoRoot "scripts\shells\win\win_common\NssmServiceManager.ps1"
$UiServiceName = "ncore-nexus-dash"
$UiServiceDisplayName = "Nexus Dash (core_node)"
$UiServiceDesc = "Nexus Dash frontend (pycore_laravel_wordnew_ui)"
$ExistingUiService = Get-Service -Name $UiServiceName -ErrorAction SilentlyContinue
$SelfScript = Join-Path $ScriptDir "start.ps1"
$CacheBaseDir = if ($Global:CORE_NODE_CACHE_DIR) { $Global:CORE_NODE_CACHE_DIR } elseif ($env:CORE_NODE_CACHE_DIR) { $env:CORE_NODE_CACHE_DIR } else { 'D:\www\cache' }
$LogDir = Join-Path $CacheBaseDir 'pycore\logs'
$AsServiceEnv = $env:AS_SERVICE
$IsServiceRun = ($env:NEXUS_DASH_SERVICE_RUN -eq "1")
$AsServiceChoice = $false
$NssmPath = $null
$PwshServiceExe = $null
$ServiceArgs = $null
$ServiceRegistered = $false
$PythonCommand = $null
$BuildArguments = @()
$DistIndexPath = Join-Path $AppRoot "dist\index.html"
$NeedDistBuild = $Dist -and ($ForceInstall -or (-not (Test-Path -LiteralPath $DistIndexPath)))

# Shared NSSM service registration helper (idempotent install-or-update + restart).
. $NssmServiceManagerScript

function Write-Info { param([string]$Message) Write-Host "[nexus-dash] $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "[nexus-dash] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "[nexus-dash] $Message" -ForegroundColor Yellow }
function Write-Err { param([string]$Message) Write-Host "[nexus-dash] $Message" -ForegroundColor Red }

# Resolve bun onto PATH. No parameters required.
function Resolve-Bun {
    if (Get-Command bun -ErrorAction SilentlyContinue) { return $true }
    return $false
}

function Test-ViteReady {
    param([string]$Root)
    $viteJs = Join-Path $Root "node_modules\vite\bin\vite.js"
    return (Test-Path -LiteralPath $viteJs)
}

function Test-DashboardDevServerHealthy {
    param([int]$Port)
    try {
        $html = Invoke-WebRequest "http://localhost:$Port/pycore-manager" -UseBasicParsing -TimeoutSec 2
        if ($html.StatusCode -ne 200 -or $html.Content -notmatch 'Nexus Dash') { return $false }
        # Tailwind v4 is compiled via @tailwindcss/vite. A stale v3/PostCSS server
        # still serves HTML but returns 500 on /themes/index.css (missing autoprefixer).
        $css = Invoke-WebRequest "http://localhost:$Port/themes/index.css" -UseBasicParsing -TimeoutSec 5
        if ($css.StatusCode -ne 200) { return $false }
        if ($css.Content.Length -lt 10000) { return $false }
        if ($css.Content -match '@tailwind\s+(base|components|utilities)') { return $false }
        return $true
    } catch {
        return $false
    }
}

Write-Info "Original directory: $OriginalDir"
Write-Info "Working directory:  $AppRoot"

# --- 1) Toolchain: bun (idempotent auto-install via the canonical DevInstaller step) + node ---
$BunWasMissing = -not (Resolve-Bun)
if ($BunWasMissing) {
    Write-Info "bun not found -> invoking canonical installer (idempotent, installs node + bun): Step4_InstallNodeJS.ps1"
    Invoke-DevInstallerStep -RepoRootDir $RepoRoot -StepScriptName "Step4_InstallNodeJS.ps1" | Out-Null
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Info "node not found -> invoking canonical installer (idempotent): Step4_InstallNodeJS.ps1"
    Invoke-DevInstallerStep -RepoRootDir $RepoRoot -StepScriptName "Step4_InstallNodeJS.ps1" | Out-Null
}
if (-not (Resolve-Bun)) {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Err "node still not found after Step4_InstallNodeJS.ps1. Run it manually via the Installer Menu."
    } else {
        Write-Err "bun not found on PATH. Install: npm i -g bun"
    }
    Set-Location -LiteralPath $OriginalDir
    exit 1
}
if ($BunWasMissing) {
    $BunSource = (Get-Command bun -ErrorAction SilentlyContinue).Source
    Write-Success "Upgraded the frontend runtime to bun: $BunSource"
}

if (-not (Test-Path -LiteralPath $PackageJsonPath)) {
    Write-Err "package.json not found at: $PackageJsonPath"
    Set-Location -LiteralPath $OriginalDir
    exit 1
}

# --- 2) Dependencies: converge in place with bun (parity with start.sh) ---
# Policy: bun install is idempotent -- it verifies the tree against bun.lock
# (migrating a legacy pnpm-lock.yaml on first run) and only touches what differs,
# so an EXISTING node_modules is UPDATED in place, never removed and reinstalled
# from scratch. A from-scratch reinstall happens ONLY when node_modules is
# missing/empty, when a legacy pnpm layout (.pnpm marker) is detected, or when
# -ForceInstall is passed.
Push-Location -LiteralPath $AppRoot
try {
    $FreshInstall = $false
    $HaveModules = $false
    if (Test-Path -LiteralPath $NodeModulesPath) {
        $HaveModules = [bool](Get-ChildItem -Path $NodeModulesPath -Directory -ErrorAction SilentlyContinue | Select-Object -First 1)
    }

    # One-time cutover from a pnpm-created node_modules (symlinked .pnpm layout):
    # rebuild the tree once so no stale pnpm symlinks survive; the marker
    # disappears after the first bun install.
    if (Test-Path -LiteralPath (Join-Path $NodeModulesPath ".pnpm")) {
        Write-Info "pnpm node_modules layout detected -> rebuilding it with bun..."
        Remove-Item -LiteralPath $NodeModulesPath -Recurse -Force -ErrorAction SilentlyContinue
        $HaveModules = $false
    }

    if ($ForceInstall) {
        Write-Info "Force reinstall requested: reinstalling dependencies from scratch..."
        bun install --force
        if ($LASTEXITCODE -ne 0) {
            Write-Err "bun install failed."
            Pop-Location
            Set-Location -LiteralPath $OriginalDir
            exit 1
        }
        $FreshInstall = $true
    } elseif (-not $HaveModules) {
        Write-Info "node_modules missing -> installing dependencies..."
        bun install
        if ($LASTEXITCODE -ne 0) {
            Write-Err "bun install failed."
            Pop-Location
            Set-Location -LiteralPath $OriginalDir
            exit 1
        }
        $FreshInstall = $true
    } else {
        # node_modules EXISTS -> converge in place. bun install only touches what
        # differs from bun.lock, so repeated runs never wipe the tree.
        Write-Info "node_modules present -> updating dependencies (bun install)..."
        bun install
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Dependencies ready (tree verified/updated in place)."
        } else {
            Write-Warn "bun install did not complete cleanly; keeping existing node_modules."
        }

        # Self-heal: if the in-place update left the toolchain broken (e.g. a stale/
        # corrupted node_modules\vite entry from an interrupted package-manager
        # switch), fall back to the SAME from-scratch reinstall -ForceInstall uses.
        # Nobody is present to pass -ForceInstall for an NSSM-launched service body --
        # leaving vite missing here means `bun x vite` fails immediately on every
        # (re)start, and NSSM's AppRestartDelay just retries the same broken tree
        # forever (an endless crash-restart loop instead of a one-time repair).
        if (-not (Test-ViteReady -Root $AppRoot)) {
            Write-Warn "Dev toolchain (vite) still not present -> reinstalling dependencies from scratch..."
            bun install --force
            if ($LASTEXITCODE -eq 0) { $FreshInstall = $true }
        }
    }

    if (-not (Test-ViteReady -Root $AppRoot)) {
        Write-Err "bun install finished but vite is still missing. Remove node_modules + bun.lock, then re-run with -ForceInstall."
        Pop-Location
        Set-Location -LiteralPath $OriginalDir
        exit 1
    }
    Write-Success "Dependencies ready."
} finally {
    Pop-Location
}

if ($NeedDistBuild) {
    Write-Info "Building production dist (bun run build)..."
    Push-Location -LiteralPath $AppRoot
    try {
        bun run build
        if ($LASTEXITCODE -ne 0) {
            Write-Err "bun run build failed."
            Set-Location -LiteralPath $OriginalDir
            exit 1
        }
    } finally {
        Pop-Location
    }
}
if ($Dist -and (-not (Test-Path -LiteralPath $DistIndexPath))) {
    Write-Err "Production dist is missing: $DistIndexPath"
    Set-Location -LiteralPath $OriginalDir
    exit 1
}

# --- APK action: detect a native-enabled flavor, build it, and stop. ---
if ($BuildApk) {
    $PythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $PythonCommand) { $PythonCommand = Get-Command python3 -ErrorAction SilentlyContinue }
    if (-not $PythonCommand) {
        Write-Err "Python is required for APK flavor preparation."
        Set-Location -LiteralPath $OriginalDir
        exit 1
    }
    if (-not (Test-Path -LiteralPath $BuildApkScript)) {
        Write-Err "APK build script not found: $BuildApkScript"
        Set-Location -LiteralPath $OriginalDir
        exit 1
    }
    $BuildArguments = @($BuildApkScript, '--root', $AppRoot, '--build-type', $ApkType)
    if ($App) { $BuildArguments = @($BuildArguments; '--app'; $App) }
    if ($SkipApkAssets) { $BuildArguments = @($BuildArguments; '--assets'; 'no') }
    if ($CleanApk) { $BuildArguments = @($BuildArguments; '--clean'; 'yes') }
    if ($NoOpenOutput) { $BuildArguments = @($BuildArguments; '--open'; 'no') }
    if ($NonInteractive) { $BuildArguments = @($BuildArguments; '--non-interactive') }
    Write-Info "Starting APK build workflow."
    & $PythonCommand.Source @BuildArguments
    $ExitCode = $LASTEXITCODE
    Set-Location -LiteralPath $OriginalDir
    exit $ExitCode
}

# --- 2b) Optional background service registration (parity with start.sh's AS_SERVICE
# prompt). NEXUS_DASH_SERVICE_RUN=1 (set via NSSM AppEnvironmentExtra, never a script
# argument) marks the NSSM-launched invocation itself: it skips this block entirely and
# falls through to the foreground dev server below, which is the service body. When
# registration succeeds and -NoBackend was not passed, laravel_main is brought up as
# its OWN separate background service too (a visible new window, used by step 3 below,
# cannot run under a service session).
if (-not $IsServiceRun) {
    if ($NonInteractive) {
        $AsServiceChoice = [bool]$ExistingUiService
    } elseif ($AsServiceEnv -eq "no") {
        $AsServiceChoice = $false
    } elseif ($AsServiceEnv -eq "yes") {
        $AsServiceChoice = $true
    } else {
        $AsServiceChoice = Read-YesNoDefaultNo "Add the nexus-dash dashboard to a background Windows service (via NSSM)?"
    }

    if ($AsServiceChoice) {
        $NssmPath = Ensure-Nssm -RepoRootDir $RepoRoot
        if (-not $NssmPath) {
            Write-Warn "NSSM unavailable and auto-install (winget) failed -> cannot register a background service."
            Write-Warn "Install it manually (e.g. 'winget install NSSM.NSSM' or https://nssm.cc/), then re-run start.ps1."
            Write-Warn "Continuing in the foreground."
        } else {
            if (-not (Test-Path -LiteralPath $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }
            $PwshServiceExe = (Get-Command powershell.exe -ErrorAction SilentlyContinue).Source
            if (-not $PwshServiceExe) { $PwshServiceExe = (Get-Command pwsh.exe -ErrorAction SilentlyContinue).Source }
            if ($Dist) {
                $ServiceArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$SelfScript`" -NoBackend -NonInteractive -Dist -Port $DevPort"
            } else {
                $ServiceArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$SelfScript`" -NoBackend -NonInteractive -Port $DevPort"
            }
            Write-Info "Registering Windows service $UiServiceName (NSSM)..."
            $ServiceRegistered = Register-NssmService -NssmPath $NssmPath -ServiceName $UiServiceName `
                -DisplayName $UiServiceDisplayName -Description $UiServiceDesc `
                -ExePath $PwshServiceExe -Arguments $ServiceArgs -WorkingDirectory $AppRoot `
                -EnvironmentExtra @("NEXUS_DASH_SERVICE_RUN=1") `
                -StdoutLog (Join-Path $LogDir "nexus_dash.service.out.log") `
                -StderrLog (Join-Path $LogDir "nexus_dash.service.err.log")

            if ($ServiceRegistered) {
                Write-Success "Service $UiServiceName registered and (re)started."
                Write-Info "  Manage: Get-Service $UiServiceName ; Restart-Service $UiServiceName ; Stop-Service $UiServiceName"
                Write-Info "  Logs:   $LogDir\nexus_dash.service.out.log"

                if (-not $NoBackend) {
                    if ((-not $PwshExe) -or (-not (Test-Path -LiteralPath $LaravelStart))) {
                        Write-Warn "laravel_main start.ps1 not found/usable; skipping backend service registration."
                    } else {
                        # Non-blocking (mirrors start.sh's nohup): laravel_main's own prerequisite
                        # setup (migrate/sys:init/...) can take a while and registers its own
                        # separate NSSM service, so it must not block this script's own startup.
                        # AS_SERVICE=yes pre-answers laravel_main's own prompt (env var, not an
                        # argument -- laravel_main's start.ps1 needs no parameters either).
                        # Start-ChildScriptWithEnv (not Start-Process) GUARANTEES the env var
                        # reaches the child -- Start-Process's ShellExecute path does not
                        # reliably propagate one set just before the call.
                        Write-Info "Bringing up laravel_main backend as its own background service (idempotent)..."
                        Start-ChildScriptWithEnv -PwshExePath $PwshExe.Source -ScriptPath $LaravelStart `
                            -WorkingDirectory $LaravelScriptsDir -EnvironmentVars @{ AS_SERVICE = "yes" } -Hidden
                    }
                }

                Set-Location -LiteralPath $OriginalDir
                exit 0
            } else {
                Write-Warn "Service registration failed; continuing in the foreground."
            }
        }
    }
}

# --- 3) Backend: launch laravel_main in its own window (parity with start.sh) ---
if ($NoBackend) {
    Write-Info "Skipping laravel_main backend (-NoBackend)."
} elseif (-not $PwshExe) {
    Write-Warn "powershell.exe not found on PATH; skipping laravel_main backend launch."
} elseif (-not (Test-Path -LiteralPath $LaravelStart)) {
    Write-Warn "Laravel start script not found: $LaravelStart (skipping backend launch)."
} else {
    Write-Info "Launching laravel_main backend in a new window..."
    Start-Process -FilePath $PwshExe.Source `
        -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-File", $LaravelStart) `
        -WorkingDirectory $LaravelScriptsDir
}

# --- 4) Frontend server in the foreground -----------------------------------
$DevUrl = "http://localhost:$DevPort"

# Skip only if a HEALTHY dashboard dev server is already on this port (HTML +
# compiled Tailwind CSS). A stale v3/PostCSS process still answers HTML but
# breaks /themes/index.css - do not reuse it.
if (Test-DashboardDevServerHealthy -Port $DevPort) {
    Write-Success "Dashboard already running on $DevUrl - skipping launch."
    if ((-not $IsServiceRun) -and (-not $NonInteractive)) { Start-Process $DevUrl }
    Set-Location -LiteralPath $OriginalDir
    exit 0
}

# Stale listener on our port (broken CSS or foreign server): free it first.
$stalePids = @(
    Get-NetTCPConnection -LocalPort $DevPort -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
)
foreach ($stalePid in $stalePids) {
    if (-not $stalePid) { continue }
    Write-Warn "Freeing port $DevPort (pid $stalePid) before starting dashboard..."
    Stop-Process -Id $stalePid -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 500
$stillListening = Get-NetTCPConnection -LocalPort $DevPort -State Listen -ErrorAction SilentlyContinue
if ($stillListening) {
    $blockerPid = ($stillListening | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -ne 0 } | Select-Object -First 1)
    Write-Err "Port $DevPort is still in use (pid $blockerPid). End that node.exe in Task Manager, or restart pyservice, then re-run this script."
    Set-Location -LiteralPath $OriginalDir
    exit 1
}

if ((-not $IsServiceRun) -and (-not $NonInteractive)) {
    $OpenUrlJob = Start-Job -ScriptBlock {
        param($Url, $DelaySeconds)
        Start-Sleep -Seconds $DelaySeconds
        Start-Process $Url
    } -ArgumentList $DevUrl, 4
    Write-Info "Starting dev server (bun x vite --port $DevPort --strictPort). Browser will open: $DevUrl"
} elseif ($IsServiceRun) {
    Write-Info "Starting dev server (bun x vite --port $DevPort --strictPort) as service body."
} else {
    Write-Info "Starting frontend non-interactively on $DevUrl."
}
$ExitCode = 0
Push-Location -LiteralPath $AppRoot
try {
    if ($Dist) {
        bun x vite preview --port $DevPort --strictPort --host $BindHost
    } else {
        bun x vite --port $DevPort --strictPort --host $BindHost
    }
    $ExitCode = $LASTEXITCODE
} finally {
    Pop-Location
    if ($OpenUrlJob) {
        $null = Wait-Job $OpenUrlJob -ErrorAction SilentlyContinue
        $null = Remove-Job $OpenUrlJob -Force -ErrorAction SilentlyContinue
    }
    Set-Location -LiteralPath $OriginalDir
    Write-Info "Restored to original directory: $OriginalDir"
    exit $ExitCode
}
