# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED.
# ### AI SPECIAL ATTENTION RULES END ###

# Orchestrator: launch laravel_main backend and laravel_dashboard (nexus-dash
# frontend) dev servers simultaneously. Each child script runs in its own
# independent PowerShell window so they start together. Prints every launched
# script first. Laravel can optionally be debugged in WSL (Linux) instead of a
# Windows window.
# Run from repo: .\poly_apps\laravel_dashboard\scripts\start.ps1

param(
    [Parameter(Mandatory = $false)]
    [switch]$ForceInstall
)

$OriginalDir = (Get-Location).Path
$ScriptDir = $PSScriptRoot
$DashAppRoot = Split-Path -Parent $ScriptDir
$PolyAppsDir = Split-Path -Parent $DashAppRoot
$RepoRoot = Split-Path -Parent $PolyAppsDir
$LaravelScriptsDir = Join-Path (Join-Path $PolyAppsDir "laravel_main") "scripts"
$LaravelStart = Join-Path $LaravelScriptsDir "start.ps1"
$DashStart = Join-Path $ScriptDir "start_dashboard.ps1"
$PwshExe = (Get-Command powershell.exe -ErrorAction SilentlyContinue)
$WslExe = (Get-Command wsl.exe -ErrorAction SilentlyContinue)
$DriveLetter = $RepoRoot.Substring(0, 1).ToLower()
$PathTail = ($RepoRoot.Substring(2) -replace '\\', '/')
$WslRepoRoot = "/mnt/$DriveLetter$PathTail"
$WslLaravelCmd = "cd '$WslRepoRoot' && ./poly_apps/laravel_main/scripts/start.sh"
$LaravelArgs = $null
$DashArgs = $null
$LaunchPlan = @()
$entry = $null
$index = 0
$UseWslAnswer = ""
$UseWsl = $false

function Write-Info { param([string]$Message) Write-Host "[dashboard-orchestrator] $Message" -ForegroundColor Cyan }
function Write-Err { param([string]$Message) Write-Host "[dashboard-orchestrator] $Message" -ForegroundColor Red }

Write-Info "Original directory: $OriginalDir"

if (-not $PwshExe) {
    Write-Err "powershell.exe not found on PATH."
    exit 1
}

if (-not (Test-Path -LiteralPath $LaravelStart)) {
    Write-Err "Laravel start script not found: $LaravelStart"
    exit 1
}

if (-not (Test-Path -LiteralPath $DashStart)) {
    Write-Err "laravel_dashboard start script not found: $DashStart"
    exit 1
}

# --- WSL option for Laravel backend ---
Write-Host ""
Write-Info "Laravel backend can be debugged in WSL (Linux) instead of a Windows window."
Write-Host "  WSL repo path (dynamic): $WslRepoRoot" -ForegroundColor DarkGray
Write-Host "  Run inside WSL:" -ForegroundColor DarkGray
Write-Host "    wsl bash -lc `"$WslLaravelCmd`"" -ForegroundColor Yellow
Write-Host "    (Linux needs php + composer in PATH; see start.sh hints if 'composer: command not found')" -ForegroundColor DarkGray
if (-not $WslExe) {
    Write-Host "  Note: wsl.exe not found on PATH; choose 'n' to use the Windows Laravel window." -ForegroundColor DarkGray
}
$UseWslAnswer = Read-Host "Use WSL for Laravel directly? (skips the Windows Laravel window) [Y/n]"
if ($UseWslAnswer -eq "" -or $UseWslAnswer -match '^[Yy]') {
    $UseWsl = $true
}

$LaravelArgs = @("-NoExit", "-ExecutionPolicy", "Bypass", "-File", $LaravelStart)
$DashArgs = @("-NoExit", "-ExecutionPolicy", "Bypass", "-File", $DashStart)
if ($ForceInstall) {
    $DashArgs += "-ForceInstall"
}

$LaunchPlan = @()
if (-not $UseWsl) {
    $LaunchPlan += [PSCustomObject]@{ Name = "laravel_main (backend, Windows)"; Path = $LaravelStart; WorkDir = $LaravelScriptsDir; Args = $LaravelArgs }
}
$LaunchPlan += [PSCustomObject]@{ Name = "laravel_dashboard (nexus-dash frontend)"; Path = $DashStart; WorkDir = $ScriptDir; Args = $DashArgs }

Write-Host ""
if ($UseWsl) {
    Write-Info "WSL selected: skipping the Windows Laravel window. Run Laravel yourself in WSL:"
    Write-Host "  wsl bash -lc `"$WslLaravelCmd`"" -ForegroundColor Yellow
}

Write-Info "Scripts to launch (all):"
$index = 0
foreach ($entry in $LaunchPlan) {
    $index = $index + 1
    Write-Host ("  [{0}] {1}" -f $index, $entry.Name) -ForegroundColor Cyan
    Write-Host ("      script : {0}" -f $entry.Path) -ForegroundColor DarkGray
    Write-Host ("      workdir: {0}" -f $entry.WorkDir) -ForegroundColor DarkGray
    Write-Host ("      args   : {0}" -f ($entry.Args -join ' ')) -ForegroundColor DarkGray
}
Write-Host ""

foreach ($entry in $LaunchPlan) {
    Write-Info "Launching $($entry.Name) in a new window..."
    Start-Process -FilePath $PwshExe.Source -ArgumentList $entry.Args -WorkingDirectory $entry.WorkDir
}

Write-Info "$($LaunchPlan.Count) script(s) launched in separate window(s). This orchestrator window can be closed."
