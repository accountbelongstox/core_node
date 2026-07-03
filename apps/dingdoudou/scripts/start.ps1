# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using Split-Path, Join-Path, or Resolve-Path.
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# 订多多 (DingDuoDuo) build script.
# Idempotent: installs pnpm only if missing, installs node_modules only if missing,
# then (re)builds the WXT extension into <dingdoudou>/.output/ (overwrite build).
#
# NOTE: pnpm/wxt write progress to STDERR. We must NOT use $ErrorActionPreference='Stop'
# around native calls (PowerShell 5.1 would convert that stderr into a terminating error
# and abort even on a successful build). Native success is judged by $LASTEXITCODE.

$ErrorActionPreference = "Continue"

# --- Variables (declared up-front) ---
$ScriptDir       = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir          = Split-Path -Parent $ScriptDir
$PackageJsonPath = Join-Path $AppDir "package.json"
$NodeModulesDir  = Join-Path $AppDir "node_modules"
$PnpmStoreMarker = Join-Path $NodeModulesDir ".pnpm"
$WxtMarker       = Join-Path $NodeModulesDir "wxt"
$OutputDir       = Join-Path $AppDir ".output"
$BuiltDir        = Join-Path $OutputDir "chrome-mv3"
$InitialDir      = Get-Location
$PnpmCmd         = $null
$NpmCmd          = $null
$CorepackCmd     = $null
$DepsReady       = $false

function Resolve-Tool {
    param([string]$Name)
    try {
        $cmd = Get-Command $Name -ErrorAction Stop
        if ($cmd -and $cmd.Source) { return $cmd.Source }
        if ($cmd) { return $Name }
    } catch { }
    return $null
}

function Stop-WithError {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    Set-Location $InitialDir
    exit 1
}

Write-Host ""
Write-Host "========================================"
Write-Host "  DingDuoDuo (订多多) - Build"
Write-Host "========================================"
Write-Host "[INFO] App directory: $AppDir"

if (-not (Test-Path -LiteralPath $PackageJsonPath)) {
    Stop-WithError "package.json not found at $PackageJsonPath"
}

Set-Location $AppDir

# --- Ensure pnpm is available (install only if missing) ---
$PnpmCmd = Resolve-Tool "pnpm"
if (-not $PnpmCmd) {
    Write-Host "[INFO] pnpm not found. Attempting to enable it via corepack..." -ForegroundColor Yellow
    $CorepackCmd = Resolve-Tool "corepack"
    if ($CorepackCmd) {
        & $CorepackCmd enable pnpm
        & $CorepackCmd prepare pnpm@latest --activate
        $PnpmCmd = Resolve-Tool "pnpm"
    }
}
if (-not $PnpmCmd) {
    Write-Host "[INFO] Installing pnpm globally via npm..." -ForegroundColor Yellow
    $NpmCmd = Resolve-Tool "npm"
    if (-not $NpmCmd) {
        Stop-WithError "Node.js/npm not found in PATH. Install Node.js first (run DD.CMD Install)."
    }
    & $NpmCmd install -g pnpm
    if ($LASTEXITCODE -ne 0) { Stop-WithError "Failed to install pnpm (npm exit $LASTEXITCODE)." }
    $PnpmCmd = Resolve-Tool "pnpm"
}
if (-not $PnpmCmd) {
    Stop-WithError "pnpm is still unavailable after install attempts."
}
Write-Host "[INFO] Using pnpm: $PnpmCmd"

# --- Install dependencies only if not already installed (idempotent) ---
if ((Test-Path -LiteralPath $NodeModulesDir) -and (Test-Path -LiteralPath $PnpmStoreMarker) -and (Test-Path -LiteralPath $WxtMarker)) {
    $DepsReady = $true
}
if ($DepsReady) {
    Write-Host "[INFO] Dependencies already installed - skipping 'pnpm install'." -ForegroundColor Green
} else {
    Write-Host "[INFO] Installing dependencies (pnpm install)..." -ForegroundColor Cyan
    & $PnpmCmd install
    if ($LASTEXITCODE -ne 0) { Stop-WithError "pnpm install failed (exit $LASTEXITCODE)." }
}

# --- Build (overwrite into .output/, idempotent) ---
Write-Host "[INFO] Building extension into: $OutputDir" -ForegroundColor Cyan
& $PnpmCmd run build
if ($LASTEXITCODE -ne 0) { Stop-WithError "Build failed (exit $LASTEXITCODE)." }

if (Test-Path -LiteralPath $BuiltDir) {
    Write-Host "[SUCCESS] Build complete: $BuiltDir" -ForegroundColor Green
} elseif (Test-Path -LiteralPath $OutputDir) {
    Write-Host "[SUCCESS] Build output present: $OutputDir" -ForegroundColor Green
} else {
    Stop-WithError "Build reported success but no .output directory was found."
}

Set-Location $InitialDir
exit 0
