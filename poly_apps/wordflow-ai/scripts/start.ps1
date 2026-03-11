# wordflow-ai start script: idempotent pnpm install then run dev server.
# Run from repo: .\poly_apps\wordflow-ai\scripts\start.ps1

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

Write-Info "Original directory: $OriginalDir"
Write-Info "Working directory:  $AppRoot"

if (-not (Test-Path -LiteralPath $PackageJsonPath)) {
    Write-Err "package.json not found at: $PackageJsonPath"
    exit 1
}

$NeedInstall = $ForceInstall
if (-not $NeedInstall) {
    if (-not (Test-Path -LiteralPath $NodeModulesPath)) {
        $NeedInstall = $true
    } else {
        $hasAnyPackage = Get-ChildItem -Path $NodeModulesPath -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $hasAnyPackage) {
            $NeedInstall = $true
        }
    }
}

if ($NeedInstall) {
    Write-Info "Installing pnpm dependencies..."
    Push-Location -LiteralPath $AppRoot
    try {
        pnpm install
        if ($LASTEXITCODE -ne 0) {
            Write-Err "pnpm install failed."
            Pop-Location
            Set-Location -LiteralPath $OriginalDir
            exit 1
        }
        Write-Success "Dependencies installed."
    } finally {
        Pop-Location
    }
} else {
    Write-Info "node_modules present; skipping install (idempotent). Use -ForceInstall to reinstall."
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
