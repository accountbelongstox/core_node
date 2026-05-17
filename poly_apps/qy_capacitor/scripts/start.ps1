# wordflow-ai (qy_capacitor): idempotent pnpm install, verify toolchain, then dev server.
# Run from repo: .\poly_apps\qy_capacitor\scripts\start.ps1

param(
    [Parameter(Mandatory = $false)]
    [switch]$ForceInstall
)

$ScriptDir = $PSScriptRoot
$AppRoot = Split-Path -Parent $ScriptDir
$NodeModulesPath = Join-Path $AppRoot "node_modules"
$PackageJsonPath = Join-Path $AppRoot "package.json"
$EnvPath = Join-Path $AppRoot ".env"
$OriginalDir = (Get-Location).Path

function Write-Info { param([string]$Message) Write-Host "[wordflow-ai] $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "[wordflow-ai] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "[wordflow-ai] $Message" -ForegroundColor Yellow }
function Write-Err { param([string]$Message) Write-Host "[wordflow-ai] $Message" -ForegroundColor Red }

function Test-PnpmCli {
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Write-Err "pnpm not found on PATH. Install: npm i -g pnpm  or  corepack enable && corepack prepare pnpm@latest --activate"
        exit 1
    }
}

function Test-ViteReady {
    param([string]$Root)
    $viteJs = Join-Path $Root "node_modules\vite\bin\vite.js"
    return (Test-Path -LiteralPath $viteJs)
}

Write-Info "Original directory: $OriginalDir"
Write-Info "Working directory:  $AppRoot"

Test-PnpmCli

if (-not (Test-Path -LiteralPath $PackageJsonPath)) {
    Write-Err "package.json not found at: $PackageJsonPath"
    exit 1
}

$NeedInstall = [bool]$ForceInstall
if (-not $NeedInstall) {
    if (-not (Test-Path -LiteralPath $NodeModulesPath)) {
        $NeedInstall = $true
    } else {
        $hasAnyPackage = Get-ChildItem -Path $NodeModulesPath -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $hasAnyPackage) {
            $NeedInstall = $true
        } elseif (-not (Test-ViteReady -Root $AppRoot)) {
            Write-Warn "node_modules present but dev toolchain incomplete (e.g. vite missing); running pnpm install."
            $NeedInstall = $true
        }
    }
}

if ($NeedInstall) {
    Write-Info "Installing pnpm dependencies (idempotent)..."
    Push-Location -LiteralPath $AppRoot
    try {
        pnpm install
        if ($LASTEXITCODE -ne 0) {
            Write-Err "pnpm install failed."
            Pop-Location
            Set-Location -LiteralPath $OriginalDir
            exit 1
        }
        if (-not (Test-ViteReady -Root $AppRoot)) {
            Write-Err "pnpm install finished but vite is still missing. Try removing node_modules and pnpm-lock.yaml, then re-run with -ForceInstall."
            Pop-Location
            Set-Location -LiteralPath $OriginalDir
            exit 1
        }
        Write-Success "Dependencies ready."
    } finally {
        Pop-Location
    }
} else {
    Write-Info "Dependencies look complete; skipping install. Use -ForceInstall to reinstall."
}

$DevPort = 3000
if (Test-Path -LiteralPath $EnvPath) {
    $envContent = Get-Content -LiteralPath $EnvPath -ErrorAction SilentlyContinue
    foreach ($line in $envContent) {
        if ($line -match '^\s*PORT\s*=\s*(\d+)\s*') {
            $DevPort = [int]$Matches[1]
            break
        }
    }
}
$DevUrl = "http://localhost:$DevPort"

$OpenUrlJob = Start-Job -ScriptBlock {
    param($Url, $DelaySeconds)
    Start-Sleep -Seconds $DelaySeconds
    Start-Process $Url
} -ArgumentList $DevUrl, 4

Write-Info "Starting dev server (pnpm run dev). Browser will open: $DevUrl"
$ExitCode = 0
Push-Location -LiteralPath $AppRoot
try {
    pnpm run dev
    $ExitCode = $LASTEXITCODE
} finally {
    Pop-Location
    $null = Wait-Job $OpenUrlJob -ErrorAction SilentlyContinue
    $null = Remove-Job $OpenUrlJob -Force -ErrorAction SilentlyContinue
    Set-Location -LiteralPath $OriginalDir
    Write-Info "Restored to original directory: $OriginalDir"
    exit $ExitCode
}
