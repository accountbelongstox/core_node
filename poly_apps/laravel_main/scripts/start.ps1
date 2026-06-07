# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Windows PowerShell port of scripts/start.sh (Unix: use scripts/start.sh).
# Full lifecycle: ensure composer deps -> ensure Laravel runtime dirs / .env / APP_KEY
# -> route:clear -> route:list -> migrate -> sys:init -> detect IPs -> start dev.
# - Windows: no pcntl -> always composer dev:win; IPs via Get-NetIPAddress.
# - Linux: see start.sh (auto-installs php/composer/node, node-free fallback).

$OriginalDirectory = Get-Location
$ScriptDir = $PSScriptRoot
$LaravelDir = Split-Path -Parent $ScriptDir
$VendorDir = Join-Path $LaravelDir "vendor"
$VendorAutoload = Join-Path $VendorDir "autoload.php"
$EnvPath = Join-Path $LaravelDir ".env"
$EnvExamplePath = Join-Path $LaravelDir ".env.example"
$SqliteDir = Join-Path $LaravelDir "database"
$SqlitePath = Join-Path $SqliteDir "database.sqlite"
$Port = 9000
$IPList = @()
$phpCmd = $null
$composerCmd = $null
$adapters = $null
$routeOut = $null
$migrateOut = $null
$migrateExit = 0
$runtimeRel = $null
$runtimeFull = $null
$envContent = $null
# Laravel runtime directories that MUST exist and be writable. Git does not track
# empty dirs, so a fresh checkout/restore can miss these -> package:discover fails
# with "bootstrap/cache directory must be present and writable".
$LaravelRuntimeDirs = @(
    "bootstrap\cache",
    "storage\framework\cache\data",
    "storage\framework\sessions",
    "storage\framework\views",
    "storage\framework\testing",
    "storage\logs",
    "storage\app\public",
    "storage\app\private"
)

Write-Host "Initial directory (invocation): $($OriginalDirectory.Path)" -ForegroundColor DarkGray
Write-Host "Working directory (Laravel root): $LaravelDir" -ForegroundColor DarkGray
Write-Host ""

try {
    Set-Location -Path $LaravelDir

    $phpCmd = Get-Command php -ErrorAction SilentlyContinue
    $composerCmd = Get-Command composer -ErrorAction SilentlyContinue
    if (-not $phpCmd) {
        Write-Host "PHP not found in PATH. On Windows run Installer Menu -> Run DevInstaller (Step12_InstallPHP.ps1)." -ForegroundColor Red
        exit 1
    }
    if (-not $composerCmd) {
        Write-Host "Composer not found in PATH. Run DevInstaller first (PhpPostInstallProcessor installs Composer)." -ForegroundColor Red
        exit 1
    }

    # Ensure Laravel runtime directories exist before any composer/artisan command.
    Write-Host "Ensuring Laravel runtime directories..." -ForegroundColor Yellow
    foreach ($runtimeRel in $LaravelRuntimeDirs) {
        $runtimeFull = Join-Path $LaravelDir $runtimeRel
        if (-not (Test-Path -LiteralPath $runtimeFull)) {
            New-Item -ItemType Directory -Force -Path $runtimeFull | Out-Null
        }
    }

    # Ensure .env exists (mirrors composer post-root-package-install).
    if ((-not (Test-Path -LiteralPath $EnvPath)) -and (Test-Path -LiteralPath $EnvExamplePath)) {
        Write-Host "Creating .env from .env.example..." -ForegroundColor Yellow
        Copy-Item -LiteralPath $EnvExamplePath -Destination $EnvPath
    }

    # Ensure vendor dependencies are installed before running any artisan command.
    if ((-not (Test-Path -LiteralPath $VendorDir)) -or (-not (Test-Path -LiteralPath $VendorAutoload))) {
        Write-Host "vendor/ not found. Running composer install..." -ForegroundColor Yellow
        composer install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: composer install failed" -ForegroundColor Red
            exit 1
        }
        Write-Host ""
    }

    # Ensure APP_KEY (needs framework; after composer install).
    if (Test-Path -LiteralPath $EnvPath) {
        $envContent = Get-Content -LiteralPath $EnvPath -ErrorAction SilentlyContinue
        if (-not ($envContent | Where-Object { $_ -match '^APP_KEY=base64:' })) {
            Write-Host "Generating APP_KEY..." -ForegroundColor Yellow
            php artisan key:generate --force --ansi
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  Warning: key:generate failed (continuing)." -ForegroundColor Yellow
            }
        }
    }

    # Ensure sqlite database file when DB_CONNECTION=sqlite.
    if (Test-Path -LiteralPath $EnvPath) {
        $envContent = Get-Content -LiteralPath $EnvPath -ErrorAction SilentlyContinue
        if ($envContent | Where-Object { $_ -match '^DB_CONNECTION=sqlite' }) {
            if (-not (Test-Path -LiteralPath $SqliteDir)) {
                New-Item -ItemType Directory -Force -Path $SqliteDir | Out-Null
            }
            if (-not (Test-Path -LiteralPath $SqlitePath)) {
                New-Item -ItemType File -Path $SqlitePath | Out-Null
            }
        }
    }

    Write-Host "Clearing route cache..." -ForegroundColor Yellow
    php artisan route:clear 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Warning: route:clear had issues (continuing)." -ForegroundColor Yellow
    }

    Write-Host "Listing routes..." -ForegroundColor Yellow
    $routeOut = php artisan route:list 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Warning: route:list failed (e.g. app error or redeclare). Fix app code then run 'php artisan route:list'. Continuing." -ForegroundColor Yellow
    } else {
        $routeOut
    }

    Write-Host "Running migrations..." -ForegroundColor Yellow
    $migrateOut = php artisan migrate --force 2>&1
    $migrateExit = $LASTEXITCODE
    $migrateOut
    if ($migrateExit -ne 0) {
        Write-Host "  Warning: migrate had errors (e.g. SQLite PRIMARY KEY or schema). Fix DB/migrations then run 'php artisan migrate'. Continuing." -ForegroundColor Yellow
    }

    Write-Host "Initializing system (php artisan sys:init)..." -ForegroundColor Yellow
    php artisan sys:init 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Warning: sys:init had issues (continuing)." -ForegroundColor Yellow
    }

    Write-Host "Detecting local IPs (excluding loopback)..." -ForegroundColor Yellow
    try {
        $adapters = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {
            $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^0\.' -and $_.IPAddress -notmatch '^169\.254\.'
        }
        if ($adapters) {
            $IPList = @($adapters.IPAddress)
        }
    } catch {
        Write-Host "  Unable to detect IPs: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    Write-Host "Accessible URLs (ready to copy):" -ForegroundColor Green
    if ($IPList.Count -gt 0) {
        foreach ($ip in $IPList) {
            Write-Host "  http://${ip}:$Port" -ForegroundColor Cyan
        }
    } else {
        Write-Host "  http://localhost:$Port (fallback)" -ForegroundColor Cyan
    }

    Write-Host "Starting Laravel development environment with hot reload..." -ForegroundColor Green
    Write-Host "Note: Headless API mode - web.php serves API debug interface." -ForegroundColor Yellow
    Write-Host "Press Ctrl+C to stop all services." -ForegroundColor Gray
    Write-Host ""
    Write-Host "Windows (PHP/Laravel): Not supported on this platform:" -ForegroundColor DarkGray
    Write-Host "  - pcntl extension -> single process only; use composer dev:win." -ForegroundColor DarkGray
    Write-Host "  - PHP_CLI_SERVER_WORKERS ignored without --no-reload (single server)." -ForegroundColor DarkGray
    Write-Host "  - Swoole/Octane is the task-system driver and is Linux/WSL only." -ForegroundColor DarkGray
    Write-Host "    Windows uses composer dev:win (serve + queue) as a fallback; the" -ForegroundColor DarkGray
    Write-Host "    Octane timer tasks (TTS/cover/translation) do NOT run on Windows." -ForegroundColor DarkGray
    Write-Host "  - systemctl/service status (ServerManager) is Linux-oriented." -ForegroundColor DarkGray
    Write-Host "  Ref: development-guides/DD_POWERSHELL_GUIDE, Run DevInstaller for PHP/Composer." -ForegroundColor DarkGray
    Write-Host ""

    composer dev:win
}
finally {
    Set-Location -Path $OriginalDirectory
    Write-Host ""
    Write-Host "Restored to initial directory: $($OriginalDirectory.Path)" -ForegroundColor DarkGray
}
