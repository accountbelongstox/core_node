# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED.
# ### AI SPECIAL ATTENTION RULES END ###

# Single entry (Windows) for pycore_laravel_wordflow_ui (nexus-dash): the Windows
# counterpart of start.sh. Needs NO parameters. Idempotently resolves pnpm
# (PATH -> corepack), installs dependencies (skips when already present), launches
# the laravel_main backend in its own window, then serves the dashboard dev server
# in the foreground. Windows is differentiated: it never registers a system service.
# Run from repo: .\poly_apps\pycore_laravel_wordflow_ui\scripts\start.ps1
#   Force reinstall: -ForceInstall     Skip backend: -NoBackend

param(
    [Parameter(Mandatory = $false)]
    [switch]$ForceInstall,
    [Parameter(Mandatory = $false)]
    [switch]$NoBackend
)

$OriginalDir = (Get-Location).Path
$ScriptDir = $PSScriptRoot
$AppRoot = Split-Path -Parent $ScriptDir
$PolyAppsDir = Split-Path -Parent $AppRoot
$RepoRoot = Split-Path -Parent $PolyAppsDir
$LaravelScriptsDir = Join-Path (Join-Path $PolyAppsDir "laravel_main") "scripts"
$LaravelStart = Join-Path $LaravelScriptsDir "start.ps1"
$NodeModulesPath = Join-Path $AppRoot "node_modules"
$PackageJsonPath = Join-Path $AppRoot "package.json"
$PwshExe = (Get-Command powershell.exe -ErrorAction SilentlyContinue)
$NeedInstall = $false
$hasAnyPackage = $null
$DevPort = 13054
$DevUrl = ""
$OpenUrlJob = $null
$ExitCode = 0
$stalePids = @()
$stalePid = $null
$stillListening = $null
$blockerPid = $null

function Write-Info { param([string]$Message) Write-Host "[nexus-dash] $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "[nexus-dash] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "[nexus-dash] $Message" -ForegroundColor Yellow }
function Write-Err { param([string]$Message) Write-Host "[nexus-dash] $Message" -ForegroundColor Red }

# Resolve pnpm onto PATH: direct -> corepack activation. No parameters required.
function Resolve-Pnpm {
    if (Get-Command pnpm -ErrorAction SilentlyContinue) { return $true }
    if (Get-Command corepack -ErrorAction SilentlyContinue) {
        Write-Info "pnpm not found; activating via corepack..."
        corepack enable 2>$null | Out-Null
        corepack prepare pnpm@latest --activate 2>$null | Out-Null
        if (Get-Command pnpm -ErrorAction SilentlyContinue) { return $true }
    }
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

# --- 1) Toolchain: resolve pnpm (node must already be installed on Windows) ---
if (-not (Resolve-Pnpm)) {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Err "node not found on PATH. Install Node.js (e.g. winget install OpenJS.NodeJS.LTS), then re-run."
    } else {
        Write-Err "pnpm not found on PATH. Install: npm i -g pnpm  or  corepack enable && corepack prepare pnpm@latest --activate"
    }
    Set-Location -LiteralPath $OriginalDir
    exit 1
}

if (-not (Test-Path -LiteralPath $PackageJsonPath)) {
    Write-Err "package.json not found at: $PackageJsonPath"
    Set-Location -LiteralPath $OriginalDir
    exit 1
}

# --- 2) Dependencies: update in place, never wipe node_modules (parity with start.sh) ---
# Policy: an EXISTING node_modules is UPDATED in place, never removed and reinstalled from
# scratch. pnpm's own "... will be removed and reinstalled from scratch" prompt
# (ERR_PNPM_MODULES_BREAKING_CHANGE) only fires when it can purge; running pnpm
# non-interactively with confirm-modules-purge left at its default (true) makes pnpm ERROR
# instead of wiping on a major modules-format change -- so the tree is kept. A from-scratch
# reinstall happens ONLY when node_modules is missing/empty, or -ForceInstall is passed.
Push-Location -LiteralPath $AppRoot
try {
    $FreshInstall = $false
    $HaveModules = $false
    if (Test-Path -LiteralPath $NodeModulesPath) {
        $HaveModules = [bool](Get-ChildItem -Path $NodeModulesPath -Directory -ErrorAction SilentlyContinue | Select-Object -First 1)
    }

    if ($ForceInstall) {
        Write-Info "Force reinstall requested: reinstalling dependencies from scratch..."
        # Explicit opt-in to the purge; piped (non-interactive) so it cannot block.
        '' | pnpm install --config.confirm-modules-purge=false
        if ($LASTEXITCODE -ne 0) {
            Write-Err "pnpm install failed."
            Pop-Location
            Set-Location -LiteralPath $OriginalDir
            exit 1
        }
        $FreshInstall = $true
    } elseif (-not $HaveModules) {
        Write-Info "node_modules missing -> installing dependencies..."
        pnpm install
        if ($LASTEXITCODE -ne 0) {
            Write-Err "pnpm install failed."
            Pop-Location
            Set-Location -LiteralPath $OriginalDir
            exit 1
        }
        $FreshInstall = $true
    } else {
        # node_modules EXISTS -> update in place, never wipe. Piped stdin + default
        # confirm-modules-purge=true => pnpm aborts rather than purging on a breaking
        # modules-format change; we then KEEP the tree and warn.
        Write-Info "node_modules present -> updating in place (no from-scratch reinstall)..."
        '' | pnpm install --config.confirm-modules-purge=true
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Dependencies updated in place."
        } else {
            Write-Warn "Kept existing node_modules (pnpm wanted a from-scratch reinstall -- likely a pnpm major-version change)."
            Write-Warn "If the dev toolchain is broken below, re-run with -ForceInstall to recreate it."
        }
    }

    if (-not (Test-ViteReady -Root $AppRoot)) {
        if ($FreshInstall) {
            Write-Err "pnpm install finished but vite is still missing. Remove node_modules + pnpm-lock.yaml, then re-run with -ForceInstall."
            Pop-Location
            Set-Location -LiteralPath $OriginalDir
            exit 1
        }
        Write-Warn "Dev toolchain (vite) not present; keeping node_modules as requested. Run with -ForceInstall to recreate it from scratch."
    }
    Write-Success "Dependencies ready."
} finally {
    Pop-Location
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

# --- 4) Frontend: dev server in the foreground (fixed port, matches constants.ts) ---
$DevPort = 13054
$DevUrl = "http://localhost:$DevPort"

# Skip only if a HEALTHY dashboard dev server is already on this port (HTML +
# compiled Tailwind CSS). A stale v3/PostCSS process still answers HTML but
# breaks /themes/index.css - do not reuse it.
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
