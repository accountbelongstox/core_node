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

# PHP / Laravel Windows vs Linux (this script is for Windows; Unix use scripts/start.sh):
# - Windows: no pcntl -> always composer dev:win; PHP_CLI_SERVER_WORKERS ignored without --no-reload (single server only); IPs via Get-NetIPAddress.
# - Linux: pcntl optional -> composer dev or dev:win; IPs via ip/ifconfig. Swoole/Octane and systemctl service status are Linux-oriented.

$OriginalDirectory = Get-Location
$ScriptDir = $PSScriptRoot
$LaravelDir = Split-Path -Parent $ScriptDir
$Port = 18000
$IPList = @()

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
    $migrateOut = php artisan migrate 2>&1
    $migrateExit = $LASTEXITCODE
    $migrateOut
    if ($migrateExit -ne 0) {
        Write-Host "  Warning: migrate had errors (e.g. SQLite PRIMARY KEY or schema). Fix DB/migrations then run 'php artisan migrate'. Continuing to start server." -ForegroundColor Yellow
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
    Write-Host "  - Swoole/Octane native server: use Linux or php artisan serve / dev:win." -ForegroundColor DarkGray
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
