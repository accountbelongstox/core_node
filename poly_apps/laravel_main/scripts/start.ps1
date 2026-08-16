# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED.
# ### AI SPECIAL ATTENTION RULES END ###

# Fully-native Windows port of scripts/start.sh (Unix: use scripts/start.sh).
# 1:1 lifecycle with start.sh, written natively (no WSL orchestration):
#   ensure php/composer -> Laravel runtime dirs / runtime secret store -> ensure pdo_pgsql
#   -> ensure PostgreSQL (shared PostgresqlManager: idempotent, native cluster on D:,
#      REUSES an already-serving :5432 server e.g. a WSL one) -> route:clear ->
#      route:list -> sys:init -> detect IPs -> composer dev:win.
# PostgreSQL parity: the installer owns POSTGRES_PASSWORD in its global-var store
#   and mirrors it into RuntimeConfigurationStore; config/database.php is code-only
#   PostgreSQL at 127.0.0.1:5432.
# Runtime: Laravel Octane's HTTP server cannot run on native Windows (octane:start
#   needs the pcntl SIGINT constant) -> use composer dev:win (serve+queue+reverb+
#   timer). The sub-minute timer task system (app/Services/TimerTasks/*, same code
#   as Linux/WSL) still runs here: OctaneTimerServiceProvider auto-falls-back from
#   the missing Octane(Swoole) tick to a Laravel Schedule->everySecond() tick,
#   driven by the `timer` lane (`php artisan schedule:work`) composer dev:win starts.
# DB sharing: when Windows and Linux/WSL run on the same machine, whichever starts
#   first owns :5432; the other REUSES it (Ensure-Postgresql probes the port first),
#   so there is one live server at a time -- the only safe shared model (a native
#   Windows NTFS cluster and a Linux ext4 cluster cannot share one data dir).
# Background service (idempotent, via NSSM -- see win_common/NssmServiceManager.ps1):
#   needs NO parameters, mirroring start.sh. Asked ONLY after the full prerequisite
#   setup below succeeds (env var AS_SERVICE=yes|no pre-answers it, same name/values as
#   start.sh, for non-interactive callers -- no prompt either way). env var
#   LARAVEL_SERVICE_RUN=1 marks the NSSM-launched invocation itself (set via NSSM
#   AppEnvironmentExtra, never a script argument): it skips the prompt and runs
#   straight through to composer dev:win in the foreground (that IS the service body),
#   exactly mirroring LARAVEL_SERVICE_RUN in start.sh. env var INCLUDE_UI=yes|no
#   pre-answers the extra "also register the nexus-dash UI as a service" step.

# --- Variables (declared at the beginning of the file) ---
$OriginalDirectory = Get-Location
$ScriptDir = $PSScriptRoot
$LaravelDir = Split-Path -Parent $ScriptDir
$PolyAppsDir = Split-Path -Parent $LaravelDir
$RepoRootDir = Split-Path -Parent $PolyAppsDir
$VendorDir = Join-Path $LaravelDir "vendor"
$VendorAutoload = Join-Path $VendorDir "autoload.php"
$BootstrapApp = Join-Path $LaravelDir "bootstrap\app.php"
$Laravel13UpgradeScript = Join-Path $ScriptDir "upgrade_laravel_13.ps1"
$RuntimeConfigDir = $null
$Port = 9000
$PgManagerScript = Join-Path $RepoRootDir "scripts\shells\win\win_common\PostgresqlManager.ps1"
$PhpIniConfigScript = Join-Path $RepoRootDir "scripts\shells\win\1_phpconfig\configure_php_ini.php"
$PhpIniDepsFixScript = Join-Path $RepoRootDir "scripts\shells\win\1_phpconfig\fix_php_ini_deps.php"
$IPList = @()
$phpCmd = $null
$composerCmd = $null
$adapters = $null
$routeOut = $null
$runtimeRel = $null
$runtimeFull = $null
$PdoPgsqlPresent = $false
$PhpExeForConfig = $null
$phpModulesOut = $null
$phpModulesRetry = $null
$phpIniPath = $null
$phpExtDir = $null
$pgReady = $false
$ip = $null
$stopPids = @()
$stopPid = $null
$prevPhpProcs = $null
$portConns = $null
$portWaited = 0
$testListener = $null
$PgWinExportSql = $null
$PgWinExportStale = $false
$PgWinExportBinDir = $null
$PgWinExportTmp = $null
# Background service registration (NSSM-backed; see win_common/NssmServiceManager.ps1).
$NssmServiceManagerScript = Join-Path $RepoRootDir "scripts\shells\win\win_common\NssmServiceManager.ps1"
$LaravelServiceName = "ncore-laravel-main"
$LaravelServiceDisplayName = "Laravel Main (core_node)"
$LaravelServiceDesc = "laravel_main backend (native Windows: serve+queue+reverb)"
$SelfScript = Join-Path $ScriptDir "start.ps1"
$CacheBaseDir = if ($Global:CORE_NODE_CACHE_DIR) { $Global:CORE_NODE_CACHE_DIR } elseif ($env:CORE_NODE_CACHE_DIR) { $env:CORE_NODE_CACHE_DIR } else { 'D:\www\cache' }
$LogDir = Join-Path $CacheBaseDir 'pycore\logs'
$UiStartPs1 = Join-Path $PolyAppsDir "pycore_laravel_wordnew_ui\scripts\start.ps1"
$AsServiceEnv = $env:AS_SERVICE
$IncludeUiEnv = $env:INCLUDE_UI
$IsServiceRun = ($env:LARAVEL_SERVICE_RUN -eq "1")
$AsServiceChoice = $false
$IncludeUiChoice = $false
$NssmPath = $null
$PwshServiceExe = $null
$ServiceArgs = $null
$ServiceRegistered = $false
$npxCmd = $null
$InstallationAccessCodeFile = Join-Path $LaravelDir "app\Support\InstallationAccessCode.php"
$GeneratedAccessCode = $null
$AccessCodeWriteError = $null
$Argument = $null
$HelpRequested = $false
$ShowSuperCode = $false
$StoredSuperCode = $null
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

. $Laravel13UpgradeScript
function Show-Usage {
    Write-Host "Usage: powershell -File `"$SelfScript`" [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  --help, -h          Show this help message and exit."
    Write-Host "  --show-super-code   Show the last generated super code and exit."
}

function Get-StoredInstallationAccessCode {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath
    )
    $source = $null
    $returnMatch = $null
    $literalMatches = $null
    $accessCode = $null

    if (-not (Test-Path -LiteralPath $FilePath)) {
        throw "Super code file not found: $FilePath"
    }
    $source = [System.IO.File]::ReadAllText($FilePath)
    $returnMatch = [regex]::Match($source, 'return\s+(?<expression>.*?);', [System.Text.RegularExpressions.RegexOptions]::Singleline)
    if (-not $returnMatch.Success) {
        throw "Super code return expression not found in: $FilePath"
    }
    $literalMatches = [regex]::Matches($returnMatch.Groups["expression"].Value, "'(?<value>[^']*)'")
    if ($literalMatches.Count -eq 0) {
        throw "Super code could not be read from: $FilePath"
    }
    $accessCode = ($literalMatches | ForEach-Object { $_.Groups["value"].Value }) -join ""
    return $accessCode
}

foreach ($Argument in $args) {
    switch ($Argument) {
        "--help" { $HelpRequested = $true }
        "-h" { $HelpRequested = $true }
        "--show-super-code" { $ShowSuperCode = $true }
    }
}

if ($HelpRequested) {
    Show-Usage
    exit 0
}

if ($ShowSuperCode) {
    try {
        $StoredSuperCode = Get-StoredInstallationAccessCode -FilePath $InstallationAccessCodeFile
        Write-Host "Super code: $StoredSuperCode" -ForegroundColor Yellow
        exit 0
    } catch {
        Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# Shared native PostgreSQL manager (single source of truth with the DevInstaller
# Step17_InstallPostgreSQL.ps1). Provides Ensure-Postgresql + Test-PgPortOpen.
. $PgManagerScript

# Shared NSSM service registration helper (idempotent install-or-update + restart).
. $NssmServiceManagerScript

function New-InstallationAccessCode {
    $segments = @(
        ([Guid]::NewGuid().ToString("N").Substring(0, 4)).ToUpperInvariant(),
        ([Guid]::NewGuid().ToString("N").Substring(0, 4)).ToUpperInvariant(),
        ([Guid]::NewGuid().ToString("N").Substring(0, 4)).ToUpperInvariant(),
        ([Guid]::NewGuid().ToString("N").Substring(0, 4)).ToUpperInvariant()
    )
    return "NEXU-$($segments -join '-')"
}

function Write-InstallationAccessCode {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string]$AccessCode
    )
    $directoryPath = Split-Path -Parent $FilePath
    if (-not (Test-Path -LiteralPath $directoryPath)) {
        New-Item -ItemType Directory -Force -Path $directoryPath | Out-Null
    }
    $phpSource = "<?php`r`n`r`nnamespace App\Support;`r`n`r`nfinal class InstallationAccessCode`r`n{`r`n    public static function value(): string`r`n    {`r`n        return '$AccessCode';`r`n    }`r`n}`r`n"
    [System.IO.File]::WriteAllText($FilePath, $phpSource, [System.Text.UTF8Encoding]::new($false))
}

function Get-RuntimeConfigurationDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$PhpExecutable,
        [Parameter(Mandatory = $true)][string]$AutoloadPath,
        [Parameter(Mandatory = $true)][string]$BootstrapPath
    )

    $phpCode = '$autoload = $argv[1]; $bootstrap = $argv[2]; require $autoload; require $bootstrap; echo \App\Support\RuntimeConfigurationStore::directory();'
    $output = & $PhpExecutable -r $phpCode -- $AutoloadPath $BootstrapPath
    $exitCode = $LASTEXITCODE
    $directory = ($output | Out-String).Trim()

    if (($exitCode -ne 0) -or [string]::IsNullOrWhiteSpace($directory)) {
        throw "Runtime configuration store directory could not be resolved."
    }

    return $directory
}

function Get-RuntimeConfigurationValue {
    param(
        [Parameter(Mandatory = $true)][string]$PhpExecutable,
        [Parameter(Mandatory = $true)][string]$AutoloadPath,
        [Parameter(Mandatory = $true)][string]$BootstrapPath,
        [Parameter(Mandatory = $true)][string]$Key
    )

    $phpCode = '$autoload = $argv[1]; $bootstrap = $argv[2]; $key = $argv[3]; $value = null; require $autoload; require $bootstrap; $value = \App\Support\RuntimeConfigurationStore::get($key); if ($value !== null) { echo $value; }'
    $output = & $PhpExecutable -r $phpCode -- $AutoloadPath $BootstrapPath $Key
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        throw "Runtime configuration value could not be read: $Key"
    }

    return ($output | Out-String).Trim()
}

function Set-RuntimeConfigurationValue {
    param(
        [Parameter(Mandatory = $true)][string]$PhpExecutable,
        [Parameter(Mandatory = $true)][string]$AutoloadPath,
        [Parameter(Mandatory = $true)][string]$BootstrapPath,
        [Parameter(Mandatory = $true)][string]$Key,
        [Parameter(Mandatory = $true)][string]$Value
    )

    $phpCode = '$autoload = $argv[1]; $bootstrap = $argv[2]; $key = $argv[3]; $value = trim(stream_get_contents(STDIN)); require $autoload; require $bootstrap; exit(\App\Support\RuntimeConfigurationStore::put($key, $value) ? 0 : 1);'
    $output = $Value | & $PhpExecutable -r $phpCode -- $AutoloadPath $BootstrapPath $Key
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        throw "Runtime configuration value could not be stored: $Key"
    }
}

function New-SecureRuntimeValue {
    param(
        [Parameter(Mandatory = $true)][string]$PhpExecutable,
        [Parameter(Mandatory = $true)][ValidateSet("app-key", "reverb-key", "reverb-secret")][string]$Type
    )

    $phpCode = ""
    $output = $null
    $exitCode = 0

    switch ($Type) {
        "app-key" { $phpCode = 'echo "base64:".base64_encode(random_bytes(32));' }
        "reverb-key" { $phpCode = 'echo bin2hex(random_bytes(16));' }
        "reverb-secret" { $phpCode = 'echo bin2hex(random_bytes(32));' }
    }

    $output = & $PhpExecutable -r $phpCode
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Secure runtime value generation failed: $Type"
    }

    return ($output | Out-String).Trim()
}

function Set-RuntimeConfigurationValueWhenMissing {
    param(
        [Parameter(Mandatory = $true)][string]$PhpExecutable,
        [Parameter(Mandatory = $true)][string]$AutoloadPath,
        [Parameter(Mandatory = $true)][string]$BootstrapPath,
        [Parameter(Mandatory = $true)][string]$Key,
        [Parameter(Mandatory = $true)][string]$Value
    )

    $currentValue = Get-RuntimeConfigurationValue -PhpExecutable $PhpExecutable -AutoloadPath $AutoloadPath -BootstrapPath $BootstrapPath -Key $Key

    if ([string]::IsNullOrWhiteSpace($currentValue)) {
        Set-RuntimeConfigurationValue -PhpExecutable $PhpExecutable -AutoloadPath $AutoloadPath -BootstrapPath $BootstrapPath -Key $Key -Value $Value
    }
}

function Initialize-RuntimeConfigurationStore {
    param(
        [Parameter(Mandatory = $true)][string]$PhpExecutable,
        [Parameter(Mandatory = $true)][string]$AutoloadPath,
        [Parameter(Mandatory = $true)][string]$BootstrapPath
    )

    $directory = Get-RuntimeConfigurationDirectory -PhpExecutable $PhpExecutable -AutoloadPath $AutoloadPath -BootstrapPath $BootstrapPath
    $generatedValue = ""

    $generatedValue = New-SecureRuntimeValue -PhpExecutable $PhpExecutable -Type "app-key"
    Set-RuntimeConfigurationValueWhenMissing -PhpExecutable $PhpExecutable -AutoloadPath $AutoloadPath -BootstrapPath $BootstrapPath -Key "APP_KEY" -Value $generatedValue
    Set-RuntimeConfigurationValueWhenMissing -PhpExecutable $PhpExecutable -AutoloadPath $AutoloadPath -BootstrapPath $BootstrapPath -Key "REVERB_APP_ID" -Value "task-system"
    $generatedValue = New-SecureRuntimeValue -PhpExecutable $PhpExecutable -Type "reverb-key"
    Set-RuntimeConfigurationValueWhenMissing -PhpExecutable $PhpExecutable -AutoloadPath $AutoloadPath -BootstrapPath $BootstrapPath -Key "REVERB_APP_KEY" -Value $generatedValue
    $generatedValue = New-SecureRuntimeValue -PhpExecutable $PhpExecutable -Type "reverb-secret"
    Set-RuntimeConfigurationValueWhenMissing -PhpExecutable $PhpExecutable -AutoloadPath $AutoloadPath -BootstrapPath $BootstrapPath -Key "REVERB_APP_SECRET" -Value $generatedValue

    return $directory
}

Write-Host "Initial directory (invocation): $($OriginalDirectory.Path)" -ForegroundColor DarkGray
Write-Host "Working directory (Laravel root): $LaravelDir" -ForegroundColor DarkGray
Write-Host ""

try {
    Set-Location -Path $LaravelDir

    $GeneratedAccessCode = New-InstallationAccessCode
    try {
        Write-InstallationAccessCode -FilePath $InstallationAccessCodeFile -AccessCode $GeneratedAccessCode
        Write-Host "Installation access value refreshed." -ForegroundColor Green
    } catch {
        $AccessCodeWriteError = $_.Exception.Message
        Write-Host "WARNING: Installation access value could not be refreshed: $AccessCodeWriteError" -ForegroundColor Yellow
    }

    # --- Toolchain: php + composer (idempotent auto-install via the canonical DevInstaller step) ---
    $phpCmd = Get-Command php -ErrorAction SilentlyContinue
    $composerCmd = Get-Command composer -ErrorAction SilentlyContinue
    if ((-not $phpCmd) -or (-not $composerCmd)) {
        Write-Host "PHP/Composer not found -> invoking canonical installer (idempotent): Step16_InstallPHP.ps1" -ForegroundColor Yellow
        Invoke-DevInstallerStep -RepoRootDir $RepoRootDir -StepScriptName "Step16_InstallPHP.ps1" | Out-Null
        $phpCmd = Get-Command php -ErrorAction SilentlyContinue
        $composerCmd = Get-Command composer -ErrorAction SilentlyContinue
    }
    if (-not $phpCmd) {
        Write-Host "PHP still not found after Step16_InstallPHP.ps1. Run it manually via the Installer Menu." -ForegroundColor Red
        exit 1
    }
    if (-not $composerCmd) {
        Write-Host "Composer still not found after Step16_InstallPHP.ps1. Run it manually via the Installer Menu." -ForegroundColor Red
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

    if (-not (Invoke-Laravel13Upgrade -LaravelRoot $LaravelDir -PhpExecutable $phpCmd.Source -ComposerExecutable $composerCmd.Source)) {
        exit 1
    }

    # Ensure vendor dependencies before any artisan command.
    if ((-not (Test-Path -LiteralPath $VendorDir)) -or (-not (Test-Path -LiteralPath $VendorAutoload))) {
        Write-Host "vendor/ not found. Running composer install..." -ForegroundColor Yellow
        composer install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: composer install failed" -ForegroundColor Red
            exit 1
        }
        Write-Host ""
    }

    # Initialize the canonical runtime store before any Artisan command.
    try {
        $RuntimeConfigDir = Initialize-RuntimeConfigurationStore `
            -PhpExecutable $phpCmd.Path `
            -AutoloadPath $VendorAutoload `
            -BootstrapPath $BootstrapApp
        Write-Host "Runtime configuration store ready: $RuntimeConfigDir" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: Runtime configuration store initialization failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }

    # --- Idempotent php.ini dependency fix (runs every startup, fast) ---
    # Comments out extensions that are auto-loaded as runtime deps of another extension
    # (e.g. pgsql auto-loaded by pdo_pgsql). Prevents "already loaded" warnings on every
    # PHP subprocess spawn. Must run before any php/artisan invocation.
    if (Test-Path -LiteralPath $PhpIniDepsFixScript) {
        php $PhpIniDepsFixScript | Out-Null
    }

    # --- PHP pdo_pgsql extension check (PostgreSQL-only app) ---
    # Without pdo_pgsql every PG connection dies at migrate with "could not find driver".
    $phpModulesOut = php -m
    if (($phpModulesOut | Out-String) -match '(?im)^\s*pdo_pgsql\s*$') {
        $PdoPgsqlPresent = $true
        Write-Host "PHP pdo_pgsql extension present." -ForegroundColor Green
    } else {
        # Canonical auto-fix (dd.cmd chain): configure_php_ini.php enables the required
        # extensions idempotently -- same role as 48_ensure_php_pgsql.sh on Linux.
        if (Test-Path -LiteralPath $PhpIniConfigScript) {
            $PhpExeForConfig = (Get-Command php -ErrorAction SilentlyContinue).Source
            if ($PhpExeForConfig) {
                Write-Host "PHP pdo_pgsql missing. Invoking canonical configurator: $PhpIniConfigScript" -ForegroundColor Yellow
                php $PhpIniConfigScript $PhpExeForConfig 2>&1 | Out-Null
                $phpModulesRetry = php -m
                if (($phpModulesRetry | Out-String) -match '(?im)^\s*pdo_pgsql\s*$') {
                    $PdoPgsqlPresent = $true
                    Write-Host "pdo_pgsql enabled by configure_php_ini.php." -ForegroundColor Green
                }
            }
        }
    }
    if (-not $PdoPgsqlPresent) {
        $phpIniPath = (php -r "echo php_ini_loaded_file();" | Out-String).Trim()
        $phpExtDir = (php -r "echo ini_get('extension_dir');" | Out-String).Trim()
        Write-Host "  *** ACTION REQUIRED: PHP pdo_pgsql extension missing -> PostgreSQL cannot be used." -ForegroundColor Red
        if ($phpIniPath) {
            Write-Host "  ***   1. Open: $phpIniPath" -ForegroundColor Red
        } else {
            Write-Host "  ***   1. No php.ini loaded: copy php.ini-development to php.ini next to php.exe, then open it." -ForegroundColor Red
        }
        Write-Host "  ***   2. Add (or uncomment): extension=pdo_pgsql  (pgsql loads automatically as its dependency)" -ForegroundColor Red
        if ($phpExtDir) {
            Write-Host "  ***   3. Confirm php_pdo_pgsql.dll and php_pgsql.dll exist in: $phpExtDir" -ForegroundColor Red
        }
        Write-Host "  ***   4. Verify with: php -m | findstr pdo_pgsql -- then re-run start.ps1." -ForegroundColor Red
    }

    # --- Runtime store root: pin CORE_NODE_DATA_DIR so every PHP/Artisan child
    # resolves the same RuntimeConfigurationStore mirror. On Windows a
    # rootless '/var/...' resolves against the current drive, so pin it explicitly.
    # Anchor to the PG data drive (same as the manager + all path mappers), NOT the
    # repo drive, so a standalone Step33 run and start.ps1 always agree on the store.
    if (-not $env:CORE_NODE_DATA_DIR) {
        $env:CORE_NODE_DATA_DIR = Join-Path ([System.IO.Path]::GetPathRoot($Global:PG_DATA_ROOT)) "var\_core_node"
    }

    # --- PostgreSQL: native cluster on D:, idempotent, reuse an already-serving :5432.
    Write-Host "Ensuring PostgreSQL (native Windows, idempotent, :5432 reuse)..." -ForegroundColor Yellow
    Write-Host "  Invoking shared PG manager (same idempotent engine as Step17_InstallPostgreSQL.ps1):" -ForegroundColor DarkGray
    Write-Host "    $PgManagerScript" -ForegroundColor DarkGray
    $pgReady = Ensure-Postgresql

    if ($pgReady -and $PdoPgsqlPresent) {
        Write-Host "PostgreSQL ready (pdo_pgsql + server on $($Global:PG_HOST):$($Global:PG_PORT))." -ForegroundColor Green
    } else {
        Write-Host "  *** ACTION REQUIRED: PostgreSQL is NOT ready and this app is PostgreSQL-only." -ForegroundColor Red
        Write-Host "  *** There is no SQLite fallback; migrations and every request will fail." -ForegroundColor Red
        Write-Host "  *** Fix the ACTION REQUIRED items above, then re-run start.ps1." -ForegroundColor Red
    }

    # --- Export Windows PG dump for Linux-native systems that cannot run .exe ---
    # WSL can pg_dumpall.exe directly; native Linux (e.g. dual-boot) reads this file.
    # Export only when: PG is ready AND (dump missing OR dump older than 24 h).
    # Runs pg_dumpall --clean so pg_sync_adapter.py can restore idempotently.
    if ($pgReady) {
        $PgWinExportSql = Join-Path $Global:PG_DATA_ROOT "pg_win_export.sql"
        $PgWinExportStale = $true
        if (Test-Path -LiteralPath $PgWinExportSql) {
            $PgWinExportAge = ((Get-Date) - (Get-Item -LiteralPath $PgWinExportSql).LastWriteTime).TotalHours
            if ($PgWinExportAge -lt 24) { $PgWinExportStale = $false }
        }
        if ($PgWinExportStale) {
            $PgWinExportBinDir = Resolve-PgBinDir
            if ($PgWinExportBinDir) {
                $PgWinExportTmp = Join-Path $Global:PG_DATA_ROOT "pg_win_export.sql.tmp"
                Write-Host "  Exporting Windows PG dump for Linux cross-env sync -> $PgWinExportSql" -ForegroundColor DarkGray
                $env:PGPASSWORD = Get-PgPassword
                & (Join-Path $PgWinExportBinDir "pg_dumpall.exe") `
                    -h $Global:PG_HOST -p $Global:PG_PORT -U $Global:PG_USER `
                    --clean --if-exists -f $PgWinExportTmp 2>&1 | Out-Null
                $env:PGPASSWORD = $null
                if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $PgWinExportTmp)) {
                    Move-Item -LiteralPath $PgWinExportTmp -Destination $PgWinExportSql -Force
                    Write-Host "  Windows PG export complete: $PgWinExportSql" -ForegroundColor DarkGray
                } else {
                    Write-Host "  Warning: Windows PG export failed (pg_dumpall exit $LASTEXITCODE). Continuing." -ForegroundColor Yellow
                    if (Test-Path -LiteralPath $PgWinExportTmp) { Remove-Item -LiteralPath $PgWinExportTmp -Force }
                }
            }
        }
    }

    Write-Host "Clearing configuration cache..." -ForegroundColor Yellow
    php artisan config:clear 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: config:clear failed; runtime credentials may be stale." -ForegroundColor Red
        exit 1
    }

    Write-Host "Clearing route cache..." -ForegroundColor Yellow
    php artisan route:clear 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Warning: route:clear had issues (continuing)." -ForegroundColor Yellow
    }

    Write-Host "Listing routes..." -ForegroundColor Yellow
    $routeOut = php artisan route:list
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Warning: route:list failed. Fix app code then run 'php artisan route:list'. Continuing." -ForegroundColor Yellow
    } else {
        $routeOut
    }

    Write-Host "Initializing system (php artisan sys:init)..." -ForegroundColor Yellow
    php artisan sys:init
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: sys:init failed; Laravel runtime startup stopped." -ForegroundColor Red
        exit 1
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

    # --- Idempotent: stop previous dev:win session before (re)starting ---
    # Mirrors start.sh ensure_port_free(): kill stale app processes first, wait for
    # port release, then fall back to netsh reserve only for Windows dynamic-range
    # conflicts (Hyper-V/WSL2 reserving the port with no listener process).
    Write-Host "Ensuring port $Port is free (idempotent restart)..." -ForegroundColor Yellow
    $stopPids = @()

    # (1) Kill any php.exe running artisan serve / queue:listen / reverb:start /
    #     schedule:work. Get-CimInstance gives us the full command line to
    #     distinguish them. schedule:work binds NO port, so step (2) below (port
    #     based) can never catch a stale one -- this command-line match is its
    #     ONLY cleanup path; omitting it here would leak one extra ticking
    #     schedule:work process (a duplicate TimerTasks/* driver) per restart.
    $prevPhpProcs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -eq 'php.exe' -and $_.CommandLine -and
        ($_.CommandLine -match 'artisan\s+serve' -or
         $_.CommandLine -match 'artisan\s+queue:listen' -or
         $_.CommandLine -match 'artisan\s+reverb:start' -or
         $_.CommandLine -match 'artisan\s+schedule:work')
    }
    if ($prevPhpProcs) {
        $stopPids += @($prevPhpProcs | Select-Object -ExpandProperty ProcessId)
    }

    # (2) Kill processes owning port $Port (serve) or 8080 (reverb).
    #     This also catches npx/node concurrently if it holds the socket.
    $portConns = @(
        (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue),
        (Get-NetTCPConnection -LocalPort 8080  -State Listen -ErrorAction SilentlyContinue)
    ) | Where-Object { $_ } | Select-Object -ExpandProperty OwningProcess -Unique
    if ($portConns) { $stopPids += @($portConns) }

    $stopPids = @($stopPids | Where-Object { $_ -gt 0 } | Sort-Object -Unique)
    if ($stopPids.Count -gt 0) {
        foreach ($stopPid in $stopPids) {
            Stop-Process -Id $stopPid -Force -ErrorAction SilentlyContinue
        }
        Write-Host "  Stopped $($stopPids.Count) process(es). Waiting for port $Port to release..." -ForegroundColor Yellow
        $portWaited = 0
        while ($portWaited -lt 8) {
            if (-not (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)) { break }
            Start-Sleep -Seconds 1
            $portWaited++
        }
    } else {
        Write-Host "  No previous session found on port $Port." -ForegroundColor DarkGray
    }

    # (3) If port is still not bindable despite no listener, it is in the Windows
    #     dynamic port range (Hyper-V/WSL2). Attempt netsh excludedportrange to
    #     reserve it for application use (removes it from the dynamic range).
    if (-not (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)) {
        try {
            $testListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
            $testListener.Start()
            $testListener.Stop()
            $testListener = $null
        } catch {
            $testListener = $null
            Write-Host "  Port $Port blocked by Windows dynamic range (Hyper-V/WSL2). Attempting netsh reserve (needs admin)..." -ForegroundColor Yellow
            netsh int ipv4 add excludedportrange protocol=tcp startport=$Port numberofports=1 2>&1 | Out-Null
            try {
                $testListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
                $testListener.Start()
                $testListener.Stop()
                $testListener = $null
                Write-Host "  Port $Port reserved and available." -ForegroundColor Green
            } catch {
                $testListener = $null
                Write-Host "  *** Port $Port still blocked. Run once in an admin terminal, then re-run start.ps1:" -ForegroundColor Red
                Write-Host "  ***   netsh int ipv4 add excludedportrange protocol=tcp startport=$Port numberofports=1" -ForegroundColor Red
                Write-Host "  ***   OR: net stop winnat; net start winnat" -ForegroundColor Red
            }
        }
    }
    Write-Host ""

    # --- Optional background service registration (AFTER the full prerequisite setup) ---
    # Mirrors start.sh: only once php/composer/PostgreSQL/migrate/sys:init/port-free are
    # all done do we ask whether to install a background service. LARAVEL_SERVICE_RUN=1
    # (set via NSSM AppEnvironmentExtra, never a script argument) marks the NSSM-launched
    # invocation itself: it skips the prompt/registration and falls straight through to
    # composer dev:win below, which is the actual service body.
    if (-not $IsServiceRun) {
        if ($AsServiceEnv -eq "no") {
            $AsServiceChoice = $false
        } elseif ($AsServiceEnv -eq "yes") {
            $AsServiceChoice = $true
        } else {
            $AsServiceChoice = Read-YesNoDefaultYes "Prerequisites ready. Add laravel_main to a background Windows service (via NSSM)?"
        }

        if ($AsServiceChoice) {
            $NssmPath = Ensure-Nssm -RepoRootDir $RepoRootDir
            if (-not $NssmPath) {
                Write-Host "  NSSM unavailable and auto-install (winget) failed -> cannot register a background service." -ForegroundColor Yellow
                Write-Host "  Install it manually (e.g. 'winget install NSSM.NSSM' or https://nssm.cc/), then re-run start.ps1." -ForegroundColor Yellow
                Write-Host "  Continuing in the foreground." -ForegroundColor Yellow
            } else {
                if (-not (Test-Path -LiteralPath $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }
                $PwshServiceExe = (Get-Command powershell.exe -ErrorAction SilentlyContinue).Source
                if (-not $PwshServiceExe) { $PwshServiceExe = (Get-Command pwsh.exe -ErrorAction SilentlyContinue).Source }
                $ServiceArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$SelfScript`""
                Write-Host "Registering Windows service $LaravelServiceName (NSSM)..." -ForegroundColor Yellow
                $ServiceRegistered = Register-NssmService -NssmPath $NssmPath -ServiceName $LaravelServiceName `
                    -DisplayName $LaravelServiceDisplayName -Description $LaravelServiceDesc `
                    -ExePath $PwshServiceExe -Arguments $ServiceArgs -WorkingDirectory $LaravelDir `
                    -EnvironmentExtra @("PORT=$Port", "LARAVEL_SERVICE_RUN=1") `
                    -StdoutLog (Join-Path $LogDir "laravel_main.service.out.log") `
                    -StderrLog (Join-Path $LogDir "laravel_main.service.err.log")

                if ($ServiceRegistered) {
                    Write-Host "Service $LaravelServiceName registered and (re)started." -ForegroundColor Green
                    Write-Host "  Manage: Get-Service $LaravelServiceName ; Restart-Service $LaravelServiceName ; Stop-Service $LaravelServiceName" -ForegroundColor DarkGray
                    Write-Host "  Logs:   $LogDir\laravel_main.service.out.log" -ForegroundColor DarkGray

                    # --- Optional: also bring the nexus-dash UI up as its own background service ---
                    # A separate process (never dot-sourced or `&`): the UI script may itself
                    # `exit`, which would otherwise terminate this script's own process. Uses
                    # Start-ChildScriptWithEnv (not Start-Process) so AS_SERVICE=yes is
                    # GUARANTEED to reach the child -- Start-Process's ShellExecute path does
                    # not reliably propagate an env var set just before the call, which
                    # otherwise leaves the child re-asking its own Y/n prompt.
                    if ($IncludeUiEnv -eq "no") {
                        $IncludeUiChoice = $false
                    } elseif ($IncludeUiEnv -eq "yes") {
                        $IncludeUiChoice = $true
                    } elseif (Test-Path -LiteralPath $UiStartPs1) {
                        $IncludeUiChoice = Read-YesNoDefaultNo "Also add the pycore_laravel_wordnew_ui dashboard to a background service?"
                    } else {
                        $IncludeUiChoice = $false
                    }
                    if ($IncludeUiChoice) {
                        if (Test-Path -LiteralPath $UiStartPs1) {
                            Write-Host "Bringing up pycore_laravel_wordnew_ui dashboard as a background service (idempotent)..." -ForegroundColor Yellow
                            Start-ChildScriptWithEnv -PwshExePath $PwshServiceExe -ScriptPath $UiStartPs1 -ScriptArgs @("-NoBackend") `
                                -WorkingDirectory (Split-Path -Parent $UiStartPs1) -EnvironmentVars @{ AS_SERVICE = "yes" } -Wait
                        } else {
                            Write-Host "  Warning: UI start script not found: $UiStartPs1 (skipping)." -ForegroundColor Yellow
                        }
                    }

                    exit 0
                } else {
                    Write-Host "Service registration failed; continuing in the foreground." -ForegroundColor Yellow
                }
            }
        }
    }

    # --- Runtime: native Windows server + queue + websockets + timer ---
    # IMPORTANT: Laravel Octane's HTTP server CANNOT run on native Windows. octane:start
    # references the pcntl signal constants SIGINT/SIGTERM/SIGHUP (no Windows pcntl build
    # -> "Undefined constant SIGINT"). RoadRunner/FrankenPHP do not provide Octane ticks
    # either. So we run the proven native Windows runtime: `composer dev:win` = artisan
    # serve + queue:listen + reverb + schedule:work (via npx concurrently). HTTP API,
    # queued jobs, WebSockets, and the sub-minute task-system timer (TimerTasks/*, the
    # SAME code as Linux/WSL) all run natively -- OctaneTimerServiceProvider detects the
    # missing Octane(Swoole) tick and drives the SAME tasks through a Laravel
    # Schedule->everySecond() tick instead, consumed by the `timer` lane
    # (`php artisan schedule:work`) composer dev:win now starts.
    # Native Windows lacks pcntl_fork, so the built-in server must use one worker.
    # This process-only runtime control is independent from Laravel configuration.
    $env:PHP_CLI_SERVER_WORKERS = "1"

    # --- Ensure Node.js/npx (idempotent auto-install): composer dev:win runs everything
    # through `npx concurrently` -- without it the runtime fails immediately.
    $npxCmd = Get-Command npx -ErrorAction SilentlyContinue
    if (-not $npxCmd) {
        Write-Host "npx not found -> invoking canonical installer (idempotent): Step4_InstallNodeJS.ps1" -ForegroundColor Yellow
        Invoke-DevInstallerStep -RepoRootDir $RepoRootDir -StepScriptName "Step4_InstallNodeJS.ps1" | Out-Null
        $npxCmd = Get-Command npx -ErrorAction SilentlyContinue
    }
    if (-not $npxCmd) {
        Write-Host "  *** npx still unavailable after Step4_InstallNodeJS.ps1 -> composer dev:win (npx concurrently) will fail." -ForegroundColor Red
    }

    Write-Host "Starting native Windows runtime: composer dev:win (serve + queue + reverb + timer)..." -ForegroundColor Green
    Write-Host "Note: sub-minute timer tasks run via Laravel Schedule + schedule:work here (same TimerTasks/* as Linux/WSL Octane tick)." -ForegroundColor Yellow
    Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
    Write-Host ""

    composer dev:win
}
finally {
    Set-Location -Path $OriginalDirectory
    Write-Host ""
    Write-Host "Restored to initial directory: $($OriginalDirectory.Path)" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Installation access value: $GeneratedAccessCode" -ForegroundColor Yellow
}
