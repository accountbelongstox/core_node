# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED.
# ### AI SPECIAL ATTENTION RULES END ###

# Capacitor native build entry (Windows) for pycore_laravel_wordnew_ui.
# This script IMPLEMENTS NO INSTALLATION: every prerequisite repair is delegated
# to the idempotent DevInstaller steps referenced by FULL PATH (dd.cmd menu):
#   Step4_InstallNodeJS.ps1              - node + bun
#   Step8_InstallPython.ps1              - python
#   Step21_InstallApplications.ps1       - JDK 21 (-ExactPackageName Java -> Oracle.JDK.21,
#                                          wires JAVA_HOME/JDK_HOME/PATH via ApplicationsList)
#   Step62_InstallAndroidSdkPackages.ps1 - cmdline-tools + licenses + platform-tools +
#                                          platforms;android-36 + build-tools;36.0.0
# (each step is per-detail idempotent: every component is gated by binary existence)
# Flow control here uses NO exit codes and NO install functions: progress is judged
# purely by BINARY EXISTENCE. Toolchain constants and JDK/SDK detectors are
# CENTRALIZED in scripts/shells/win/win_common/AndroidBuildEnv.ps1 (shared with the
# dd step). Mutator functions are void. The script has ONE exit point. Then it
# delegates the flavor selection + web build + `cap sync` + Gradle APK assembly to
# scripts/flavor/build_apk.py (single build truth).
# dd constants come from win_common/GlobalVars.ps1 (single source of truth).
# HTTPS_PROXY/HTTP_PROXY is passed to sdkmanager/gradle via JAVA_TOOL_OPTIONS.
#
# Run from repo:
#   .\poly_apps\pycore_laravel_wordnew_ui\scripts\start_build.ps1
#   .\poly_apps\pycore_laravel_wordnew_ui\scripts\start_build.ps1 -App wordnew -BuildType release
#   .\poly_apps\pycore_laravel_wordnew_ui\scripts\start_build.ps1 -List

param(
    [Parameter(Mandatory = $false)]
    [string]$App,
    [Parameter(Mandatory = $false)]
    [switch]$List,
    [Parameter(Mandatory = $false)]
    [ValidateSet('ask', 'debug', 'release')]
    [string]$BuildType = 'ask',
    [Parameter(Mandatory = $false)]
    [ValidateSet('android', 'ios')]
    [string]$Platform = 'android',
    [Parameter(Mandatory = $false)]
    [switch]$SkipAssets,
    [Parameter(Mandatory = $false)]
    [switch]$Clean,
    [Parameter(Mandatory = $false)]
    [switch]$NoOpenOutput,
    [Parameter(Mandatory = $false)]
    [switch]$NonInteractive,
    [Parameter(Mandatory = $false)]
    [switch]$ForceInstall
)

$ErrorActionPreference = 'Stop'
$OriginalDir = (Get-Location).Path
$ScriptDir = $PSScriptRoot
$AppRoot = Split-Path -Parent $ScriptDir
$PolyAppsDir = Split-Path -Parent $AppRoot
$RepoRoot = Split-Path -Parent $PolyAppsDir
$BuildApkScript = Join-Path $ScriptDir "flavor\build_apk.py"
$NodeModulesPath = Join-Path $AppRoot "node_modules"
$ViteBinPath = Join-Path $AppRoot "node_modules\vite\bin\vite.js"
$PackageJsonPath = Join-Path $AppRoot "package.json"
# dd component full paths (constants from the dd directory layout)
$WinShellsDir = Join-Path (Join-Path $RepoRoot 'scripts') 'shells\win'
$WinCommonDir = Join-Path $WinShellsDir 'win_common'
$InstallStepsDir = Join-Path $WinShellsDir 'install_powershells'
$GlobalVarsScript = Join-Path $WinCommonDir 'GlobalVars.ps1'
$NssmServiceManagerScript = Join-Path $WinCommonDir 'NssmServiceManager.ps1'
$AndroidBuildEnvScript = Join-Path $WinCommonDir 'AndroidBuildEnv.ps1'
$StepNodeJs = Join-Path $InstallStepsDir 'Step4_InstallNodeJS.ps1'
$StepPython = Join-Path $InstallStepsDir 'Step8_InstallPython.ps1'
$StepApplications = Join-Path $InstallStepsDir 'Step21_InstallApplications.ps1'
$StepAndroidSdk = Join-Path $InstallStepsDir 'Step62_InstallAndroidSdkPackages.ps1'
# Project-locals (env toolchain state lives in the central library's $Global: vars)
$PythonCommand = $null
$BuildArguments = @()
$HaveModules = $false
$AllReady = $true
$BuildOk = $false

. $GlobalVarsScript
. $NssmServiceManagerScript
. $AndroidBuildEnvScript

function Write-Info { param([string]$Message) Write-Host "[nexus-build] $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "[nexus-build] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "[nexus-build] $Message" -ForegroundColor Yellow }
function Write-Err { param([string]$Message) Write-Host "[nexus-build] $Message" -ForegroundColor Red }

# ---------- Project-scoped binary-existence gates ----------

function Test-PythonReady { return [bool]((Get-Command python -ErrorAction SilentlyContinue) -or (Get-Command python3 -ErrorAction SilentlyContinue)) }

function Test-BunReady { return [bool](Get-Command bun -ErrorAction SilentlyContinue) }

function Test-ViteReady { return (Test-Path -LiteralPath $ViteBinPath) }

# ---------- Delegation: void invocations of the dd idempotent steps ----------

function Invoke-DevStep {
    param([string]$StepPath, [string[]]$StepArguments = @())
    if (-not (Test-Path -LiteralPath $StepPath)) {
        Write-Err "DevInstaller step not found: $StepPath"
        return
    }
    Write-Info "Invoking dd idempotent step: $(Split-Path -Leaf $StepPath)"
    if ($StepArguments.Count -gt 0) {
        powershell -NoProfile -ExecutionPolicy Bypass -File $StepPath @StepArguments
    } else {
        powershell -NoProfile -ExecutionPolicy Bypass -File $StepPath
    }
    Update-SessionPathFromRegistry
}

# ---------- Project dependencies (project deps, not an environment install) ----------

function Install-Deps {
    Push-Location -LiteralPath $AppRoot
    try {
        $HaveModules = $false
        if (Test-Path -LiteralPath $NodeModulesPath) {
            $HaveModules = [bool](Get-ChildItem -Path $NodeModulesPath -Directory -ErrorAction SilentlyContinue | Select-Object -First 1)
        }
        # One-time cutover from a pnpm-created node_modules (symlinked .pnpm layout):
        # rebuild the tree once so no stale pnpm symlinks survive.
        if (Test-Path -LiteralPath (Join-Path $NodeModulesPath ".pnpm")) {
            Write-Info "pnpm node_modules layout detected -> rebuilding it with bun..."
            Remove-Item -LiteralPath $NodeModulesPath -Recurse -Force -ErrorAction SilentlyContinue
            $HaveModules = $false
        }
        if ($ForceInstall -or (-not $HaveModules) -or (-not (Test-ViteReady))) {
            Write-Info "Installing dependencies (node_modules/vite missing or -ForceInstall)..."
            bun install --force
        } else {
            Write-Info "node_modules present -> updating dependencies (bun install)..."
            bun install
        }
        if (-not (Test-ViteReady)) {
            Write-Info "vite still missing -> reinstalling dependencies from scratch..."
            bun install --force
        }
    } finally {
        Pop-Location
    }
}

Write-Info "Original directory: $OriginalDir"
Write-Info "Working directory:  $AppRoot"
Write-Info "Constants: CACHE=$($Global:CORE_NODE_CACHE_DIR) | SDK=$($Global:ANDROID_SDK_DIR) | TOOLCHAIN=$($Global:LANG_COMPILER_DIR) | CENTRAL_LIB=$AndroidBuildEnvScript"

if ($Platform -eq 'ios') {
    Write-Err "iOS builds require macOS with Xcode 26+ (Capacitor 8). Run scripts/start_build.sh on a Mac."
    $AllReady = $false
}

# --- Prerequisite: node + bun (binary gate: bun on PATH) ---
if ($AllReady -and (-not (Test-BunReady))) {
    Write-Info "bun not found. Invoking dd idempotent step (installs node + bun): Step4_InstallNodeJS.ps1"
    Invoke-DevStep -StepPath $StepNodeJs
    if (-not (Test-BunReady)) {
        Write-Err "bun still missing after Step4_InstallNodeJS.ps1."
        $AllReady = $false
    } else {
        Write-Success "Upgraded the frontend runtime to bun: $((Get-Command bun -ErrorAction SilentlyContinue).Source)"
    }
}

# --- Prerequisite: python (binary gate: python on PATH) ---
if ($AllReady -and (-not (Test-PythonReady))) {
    Invoke-DevStep -StepPath $StepPython
    if (-not (Test-PythonReady)) {
        Write-Err "python still missing after Step8_InstallPython.ps1."
        $AllReady = $false
    }
}
if ($AllReady) {
    $PythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $PythonCommand) { $PythonCommand = Get-Command python3 -ErrorAction SilentlyContinue }
}

# --- Project dependencies (binary gate: vite.js) ---
if ($AllReady -and (-not $List) -and (-not (Test-ViteReady))) {
    Install-Deps
    if (-not (Test-ViteReady)) {
        Write-Err "Dependencies incomplete (vite missing) after bun install."
        $AllReady = $false
    }
}

# --- Prerequisite: JDK 21 (central detector: java.exe with major >= 21) ---
if ($AllReady -and (-not $List)) {
    Resolve-AndroidBuildJavaHome
    if (-not (Test-AndroidBuildJavaReady)) {
        Invoke-DevStep -StepPath $StepApplications -StepArguments @('-ExactPackageName', 'Java')
        Resolve-AndroidBuildJavaHome
        if (-not (Test-AndroidBuildJavaReady)) {
            Write-Err "JDK $($Global:ANDROID_BUILD_REQUIRED_JAVA_MAJOR)+ still missing after Step21_InstallApplications.ps1 -ExactPackageName Java."
            $AllReady = $false
        }
    }
}

# --- Prerequisite: Android SDK packages (central detector: sdkmanager + adb + platform + build-tools) ---
if ($AllReady -and (-not $List)) {
    Resolve-AndroidBuildSdkRoot
    if (-not (Test-AndroidBuildSdkReady)) {
        Invoke-DevStep -StepPath $StepAndroidSdk
        Resolve-AndroidBuildSdkRoot
        if (-not (Test-AndroidBuildSdkReady)) {
            Write-Err "Android SDK packages still missing after Step62_InstallAndroidSdkPackages.ps1 (check network/proxy: HTTPS_PROXY)."
            $AllReady = $false
        }
    }
}

# --- Export resolved toolchain env for the build (central state) ---
if ($AllReady -and (-not $List)) {
    $env:JAVA_HOME = $Global:ANDROID_BUILD_JAVA_HOME
    $env:Path = "$(Join-Path $Global:ANDROID_BUILD_JAVA_HOME 'bin');$env:Path"
    $env:ANDROID_HOME = $Global:ANDROID_BUILD_SDK_ROOT
    $env:ANDROID_SDK_ROOT = $Global:ANDROID_BUILD_SDK_ROOT
    $env:Path = "$(Join-Path $Global:ANDROID_BUILD_SDK_ROOT 'platform-tools');$(Join-Path $Global:ANDROID_BUILD_SDK_ROOT 'cmdline-tools\latest\bin');$env:Path"
    Write-Success "JAVA_HOME = $($Global:ANDROID_BUILD_JAVA_HOME)"
    Write-Success "ANDROID_HOME = $($Global:ANDROID_BUILD_SDK_ROOT)"
    if (Set-AndroidBuildJavaProxy) {
        Write-Info "Proxy enabled via JAVA_TOOL_OPTIONS for sdkmanager/gradle."
    }
}

if ($AllReady) {
    $BuildArguments = @($BuildApkScript, '--root', $AppRoot, '--build-type', $BuildType)
    if ($App) { $BuildArguments += @('--app', $App) }
    if ($List) { $BuildArguments += @('--list') }
    if ($SkipAssets) { $BuildArguments += @('--assets', 'no') }
    if ($Clean) { $BuildArguments += @('--clean', 'yes') }
    if ($NoOpenOutput) { $BuildArguments += @('--open', 'no') }
    if ($NonInteractive) { $BuildArguments += @('--non-interactive') }

    Write-Info "Starting Capacitor native build workflow (platform: $Platform)."
    & $PythonCommand.Source @BuildArguments
    $BuildOk = ($LASTEXITCODE -eq 0)
    if ($BuildOk) { Write-Success "Native build workflow finished." } else { Write-Err "Native build workflow failed." }
} else {
    Write-Err "Prerequisites are not ready; build was not started."
}

Set-Location -LiteralPath $OriginalDir
if ($AllReady -and $BuildOk) { exit 0 } else { exit 1 }
