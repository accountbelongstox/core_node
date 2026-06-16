# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED.
# ### AI SPECIAL ATTENTION RULES END ###

# nexus-dash (pycore_laravel_wordflow_ui): idempotent pnpm install, verify toolchain, then dev server.
# Run from repo: .\poly_apps\pycore_laravel_wordflow_ui\scripts\start_dashboard.ps1

param(
    [Parameter(Mandatory = $false)]
    [switch]$ForceInstall
)

$ScriptDir = $PSScriptRoot
$AppRoot = Split-Path -Parent $ScriptDir
$NodeModulesPath = Join-Path $AppRoot "node_modules"
$PackageJsonPath = Join-Path $AppRoot "package.json"
$OriginalDir = (Get-Location).Path
$NeedInstall = $false
$hasAnyPackage = $null
$DevPort = 13054
$envContent = $null
$line = $null
$DevUrl = ""
$OpenUrlJob = $null
$ExitCode = 0

function Write-Info { param([string]$Message) Write-Host "[nexus-dash] $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "[nexus-dash] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "[nexus-dash] $Message" -ForegroundColor Yellow }
function Write-Err { param([string]$Message) Write-Host "[nexus-dash] $Message" -ForegroundColor Red }

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

# Fixed dashboard dev port (no env vars). Matches config/constants.ts
# DEFAULT_FRONTEND_PORT and vite.config.ts; pyservice passes --port on the CLI
# when it needs a different one.
$DevPort = 13054
$DevUrl = "http://localhost:$DevPort"

# Skip only if a HEALTHY dashboard dev server is already on this port (HTML +
# compiled Tailwind CSS). A stale v3/PostCSS process still answers HTML but
# breaks /themes/index.css — do not reuse it.
if (Test-DashboardDevServerHealthy -Port $DevPort) {
    Write-Success "Dashboard already running on $DevUrl - skipping launch."
    Start-Process $DevUrl
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

$OpenUrlJob = Start-Job -ScriptBlock {
    param($Url, $DelaySeconds)
    Start-Sleep -Seconds $DelaySeconds
    Start-Process $Url
} -ArgumentList $DevUrl, 4

Write-Info "Starting dev server (pnpm exec vite --port $DevPort --strictPort). Browser will open: $DevUrl"
$ExitCode = 0
Push-Location -LiteralPath $AppRoot
try {
    pnpm exec vite --port $DevPort --strictPort --host 0.0.0.0
    $ExitCode = $LASTEXITCODE
} finally {
    Pop-Location
    $null = Wait-Job $OpenUrlJob -ErrorAction SilentlyContinue
    $null = Remove-Job $OpenUrlJob -Force -ErrorAction SilentlyContinue
    Set-Location -LiteralPath $OriginalDir
    Write-Info "Restored to original directory: $OriginalDir"
    exit $ExitCode
}
