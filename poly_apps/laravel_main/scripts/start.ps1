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
#      route:list -> sys:init -> detect IPs -> service (Step175) or foreground runtime.
# PostgreSQL parity: the installer owns POSTGRES_PASSWORD in its global-var store
#   and mirrors it into RuntimeConfigurationStore; config/database.php is code-only
#   PostgreSQL at 127.0.0.1:5432.
# Runtime: the Windows runtime is FrankenPHP running the Octane worker
#   (win_common/FrankenPhpManager.ps1). The background service ncore-laravel-frankenphp
#   (WinSW) is converged by install_powershells/Step175_LaravelMainStart.ps1, exactly as
#   Linux start.sh delegates to 175_laravel_main_start.sh. The foreground runtime runs
#   the same frankenphp binary + Caddyfile; before Step175 has provisioned them it falls
#   back to `php artisan serve` (HTTP API only).
# DB sharing: when Windows and Linux/WSL run on the same machine, whichever starts
#   first owns :5432; the other REUSES it (Ensure-Postgresql probes the port first),
#   so there is one live server at a time -- the only safe shared model (a native
#   Windows NTFS cluster and a Linux ext4 cluster cannot share one data dir).
# Arguments (parsed from $args, see Show-Usage): --service | --no-service | --status |
#   --with-ui | --no-ui. Env AS_SERVICE=yes|no, INCLUDE_UI=yes|no and CODEMART_INIT=yes|no
#   pre-answer the prompts; --service (= AS_SERVICE=yes) never prompts and never restarts
#   an already running service. The legacy NSSM service ncore-laravel-main (its body ran
#   the removed `composer dev:win` runtime) is retired: its body (LARAVEL_SERVICE_RUN=1)
#   now stops itself, and service installs remove it.

# --- Variables (declared at the beginning of the file) ---
$OriginalDirectory = Get-Location
$ScriptDir = $PSScriptRoot
$LaravelDir = Split-Path -Parent $ScriptDir
$PolyAppsDir = Split-Path -Parent $LaravelDir
$RepoRootDir = Split-Path -Parent $PolyAppsDir
$WinCommonDir = Join-Path $RepoRootDir "scripts\shells\win\win_common"
$InstallStepsDir = Join-Path $RepoRootDir "scripts\shells\win\install_powershells"
$VendorDir = Join-Path $LaravelDir "vendor"
$VendorAutoload = Join-Path $VendorDir "autoload.php"
$BootstrapApp = Join-Path $LaravelDir "bootstrap\app.php"
$Laravel13UpgradeScript = Join-Path $ScriptDir "upgrade_laravel_13.ps1"
$RuntimeConfigDir = $null
$Port = $null
$BindHost = $null
$PgManagerScript = Join-Path $WinCommonDir "PostgresqlManager.ps1"
$ServiceContractScript = Join-Path $WinCommonDir "ServiceContract.ps1"
$FrankenPhpManagerScript = Join-Path $WinCommonDir "FrankenPhpManager.ps1"
$Step175Script = Join-Path $InstallStepsDir "Step175_LaravelMainStart.ps1"
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
$AllProcesses = @()
$ProcessById = @{}
$processEntry = $null
$phpProc = $null
$isServeLane = $false
$isWorkerLane = $false
$ServiceTreePids = @()
$ProcessAncestryMaxDepth = 16
# Stale-process cleanup scope: artisan lanes whose own or ancestor command line references
# $LaravelDir belong to this app; artisan serve also when it serves $Port.
$LaravelDirPattern = ((($LaravelDir -split '[\\/]') | ForEach-Object { [regex]::Escape($_) }) -join '[\\/]') + '(?:[\\/"''\s]|$)'
$ArtisanServePattern = 'artisan\s+serve\b'
$ArtisanServePortPattern = $null
$ArtisanWorkerLanePattern = 'artisan\s+(queue:listen|reverb:start|schedule:work)\b'
$portConns = $null
$portWaited = 0
$testListener = $null
$PgWinExportSql = $null
$PgWinExportStale = $false
$PgWinExportBinDir = $null
$PgWinExportTmp = $null
# Background service: ncore-laravel-frankenphp (WinSW, converged by Step175). The name comes
# from FrankenPhpManager.ps1; ncore-laravel-main is the retired NSSM service.
$NssmServiceManagerScript = Join-Path $WinCommonDir "NssmServiceManager.ps1"
$LegacyServiceName = "ncore-laravel-main"
$LaravelServiceName = $null
$LaravelServiceState = $null
$FrankenPhpRuntime = $null
$FrankenPhpExe = $null
$FrankenPhpCaddyfile = $null
$FrankenPhpReady = $false
$SelfScript = Join-Path $ScriptDir "start.ps1"
$UiStartPs1 = Join-Path $PolyAppsDir "pycore_laravel_wordnew_ui\scripts\start.ps1"
$AsServiceEnv = $env:AS_SERVICE
$IncludeUiEnv = $env:INCLUDE_UI
$IsServiceRun = ($env:LARAVEL_SERVICE_RUN -eq "1")
$StatusRequested = $false
$ServiceFlag = $null
$ServiceMode = $false
$AsServiceChoice = $false
$IncludeUiChoice = $false
$CodemartInitDefault = "no"
$IncludeUiDefault = "no"
$PwshExe = $null
$ComposerInteractionArgs = @()
$ArtisanInteractionArgs = @()
$FrameworkMajor = $null
$LegacyServiceRemoved = $false
$GeneratedAccessCode = $null
$ShownAccessCode = $null
$StoredAccessCode = $null
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
. $ServiceContractScript
function Show-Usage {
    Write-Host "Usage: powershell -File `"$SelfScript`" [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  --help, -h          Show this help message and exit."
    Write-Host "  --show-super-code   Show the last generated super code and exit."
    Write-Host "  --status            Print the runtime service state (running|stopped|absent) and exit."
    Write-Host "  --service           Non-interactive: install/start the FrankenPHP Windows service via Step175"
    Write-Host "                      (elevated; no restart when already running). Same as AS_SERVICE=yes."
    Write-Host "  --no-service        Skip the service prompt and run in the foreground. Same as AS_SERVICE=no."
    Write-Host "  --with-ui, --no-ui  Also register (or skip) the nexus-dash UI service. Same as INCLUDE_UI=yes|no."
    Write-Host ""
    Write-Host "Environment: CODEMART_INIT=yes|no (default no with --service), DD_AUTO_CONTINUE=1."
}

# FrankenPHP runtime paths from the shared manager. It is dot-sourced inside this function
# so GlobalVars' StrictMode/"Stop" preference stays out of this script's own scope.
function Get-FrankenPhpRuntimeProfile {
    . $FrankenPhpManagerScript
    return @{
        ServiceName           = Get-FrankenPhpServiceName
        BinaryPath            = Get-FrankenPhpBinaryPath
        CaddyfilePath         = Get-FrankenPhpCaddyfilePath
        WorkerPath            = Join-Path (Join-Path (Get-FrankenPhpLaravelDirectory) 'public') 'frankenphp-worker.php'
        PhpIniScanDirectory   = Split-Path -Parent (Get-FrankenPhpPhpIniPath)
        DataDirectory         = $script:FrankenPhpDataDirectory
        CaddyConfigDirectory  = $script:FrankenPhpCaddyConfigDirectory
        IsElevated            = Test-AdminPrivileges
    }
}

# Process environment the FrankenPHP service gets from Ensure-FrankenPhpWindowsService,
# applied to this process for the foreground runtime (same Caddyfile, no watch directives).
function Set-FrankenPhpForegroundEnvironment {
    param([Parameter(Mandatory = $true)][hashtable]$Runtime)
    $env:PHP_INI_SCAN_DIR = $Runtime.PhpIniScanDirectory
    $env:XDG_DATA_HOME = $Runtime.DataDirectory
    $env:XDG_CONFIG_HOME = $Runtime.CaddyConfigDirectory
    $env:FRANKENPHP_BINARY_PATH = $Runtime.BinaryPath
    $env:FRANKENPHP_VARIANT = "windows-native"
    $env:FRANKENPHP_DNS01_MODE = "external"
    $env:CADDY_SERVER_WORKER_DIRECTIVE = ""
    $env:CADDY_SERVER_WATCH_DIRECTIVES = ""
}

# Retired NSSM body (LARAVEL_SERVICE_RUN=1): it used to run `composer dev:win` and free
# port 9000 on every restart, killing the FrankenPHP service. It runs as LocalSystem, where
# nssm.exe is not on PATH, so Disable-NssmService writes NSSM's exit action and the start
# type directly: NSSM stops the service when this body exits. It never touches the ports.
function Stop-LegacyServiceBody {
    Write-Host "Legacy service $LegacyServiceName is retired; laravel_main runs as the FrankenPHP service (Step175)." -ForegroundColor Yellow
    Write-Host "Run (elevated): powershell -File `"$SelfScript`" --service" -ForegroundColor Yellow
    if (Disable-NssmService -ServiceName $LegacyServiceName) {
        Write-Host "  $LegacyServiceName disabled; NSSM stops it when this body exits." -ForegroundColor DarkGray
    } else {
        Write-Host "  Warning: $LegacyServiceName could not be disabled; remove it with the command above." -ForegroundColor Yellow
    }
}

# The FrankenPHP service is already running: report it, never restart it.
function Show-LaravelServiceAlreadyRunning {
    Write-Host "Service $LaravelServiceName is already running (port $Port); nothing to start, no restart." -ForegroundColor Green
    Write-Host "  Manage: Get-Service $LaravelServiceName ; Restart-Service $LaravelServiceName ; Stop-Service $LaravelServiceName" -ForegroundColor DarkGray
}

# Win32_Process exposes no working directory: a process belongs to a directory when its own
# or a live ancestor's command line references it (laravel_main\scripts\start.ps1, the
# artisan serve server.php). A parent created after its child is a reused PID.
function Test-ProcessOwnedByDirectory {
    param(
        [Parameter(Mandatory = $true)]$Process,
        [Parameter(Mandatory = $true)][hashtable]$ProcessTable,
        [Parameter(Mandatory = $true)][string]$DirectoryPattern
    )
    $current = $Process
    $parent = $null
    $depth = 0
    while ($current -and ($depth -le $ProcessAncestryMaxDepth)) {
        if ($current.CommandLine -and ($current.CommandLine -match $DirectoryPattern)) { return $true }
        $parent = $ProcessTable[[int]$current.ParentProcessId]
        if ((-not $parent) -or ([int]$parent.ProcessId -eq [int]$current.ProcessId)) { return $false }
        if ($parent.CreationDate -and $current.CreationDate -and ($parent.CreationDate -gt $current.CreationDate)) { return $false }
        $current = $parent
        $depth++
    }
    return $false
}

# The access code lives in the external runtime store (PathMapper
# laravel_data_dir, outside the repository); InstallationAccessCode.php only
# reads it and is never regenerated. Self-contained reader (runs before the
# later function definitions, so it inlines the php call).
function Get-StoredInstallationAccessCode {
    param(
        [Parameter(Mandatory = $true)][string]$PhpExecutable,
        [Parameter(Mandatory = $true)][string]$AutoloadPath,
        [Parameter(Mandatory = $true)][string]$BootstrapPath
    )
    $phpCode = '$autoload = $argv[1]; $bootstrap = $argv[2]; require $autoload; require $bootstrap; $value = \App\Support\RuntimeConfigurationStore::get("INSTALLATION_ACCESS_CODE"); if ($value !== null) { echo $value; }'
    $output = & $PhpExecutable -r $phpCode -- $AutoloadPath $BootstrapPath
    $exitCode = $LASTEXITCODE
    $accessCode = ($output | Out-String).Trim()

    if (($exitCode -ne 0) -or [string]::IsNullOrWhiteSpace($accessCode)) {
        throw "Installation access code not provisioned yet; run the full start once."
    }
    return $accessCode
}

foreach ($Argument in $args) {
    switch ($Argument) {
        "--help" { $HelpRequested = $true }
        "-h" { $HelpRequested = $true }
        "--show-super-code" { $ShowSuperCode = $true }
        "--status" { $StatusRequested = $true }
        "--service" { $ServiceFlag = "yes" }
        "--no-service" { $ServiceFlag = "no" }
        "--with-ui" { $IncludeUiEnv = "yes" }
        "--no-ui" { $IncludeUiEnv = "no" }
    }
}
if ($ServiceFlag) {
    $AsServiceEnv = $ServiceFlag
}
$ServiceMode = ($AsServiceEnv -eq "yes")

if ($HelpRequested) {
    Show-Usage
    exit 0
}

if ($ShowSuperCode) {
    $phpCmd = Get-Command php -ErrorAction SilentlyContinue
    if (-not $phpCmd) {
        Write-Host "ERROR: php not found; cannot read the runtime configuration store." -ForegroundColor Red
        exit 1
    }
    try {
        $StoredSuperCode = Get-StoredInstallationAccessCode -PhpExecutable $phpCmd.Path -AutoloadPath $VendorAutoload -BootstrapPath $BootstrapApp
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

# Shared NSSM helpers (service state, legacy service removal, DevInstaller steps, prompts).
. $NssmServiceManagerScript

# The retired legacy body retires its own service before any other work.
if ($IsServiceRun) {
    Stop-LegacyServiceBody
    exit 0
}

$Port = Get-ServiceContractPort -Name "laravel_api_backend"
$BindHost = Get-ServiceContractHost -Name "any"
$ArtisanServePortPattern = "artisan\s+serve\b.*--port[=\s]+$Port\b"

function New-InstallationAccessCode {
    $segments = @(
        ([Guid]::NewGuid().ToString("N").Substring(0, 4)).ToUpperInvariant(),
        ([Guid]::NewGuid().ToString("N").Substring(0, 4)).ToUpperInvariant(),
        ([Guid]::NewGuid().ToString("N").Substring(0, 4)).ToUpperInvariant(),
        ([Guid]::NewGuid().ToString("N").Substring(0, 4)).ToUpperInvariant()
    )
    return "NEXU-$($segments -join '-')"
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
    # Installation access (super) code: provisioned once into the external
    # store, stable across runs; InstallationAccessCode.php only reads it.
    if (-not [string]::IsNullOrWhiteSpace($script:GeneratedAccessCode)) {
        Set-RuntimeConfigurationValueWhenMissing -PhpExecutable $PhpExecutable -AutoloadPath $AutoloadPath -BootstrapPath $BootstrapPath -Key "INSTALLATION_ACCESS_CODE" -Value $script:GeneratedAccessCode
    }

    return $directory
}

$FrankenPhpRuntime = Get-FrankenPhpRuntimeProfile
$LaravelServiceName = $FrankenPhpRuntime.ServiceName
$LaravelServiceState = Get-ServiceRunState -ServiceName $LaravelServiceName

if ($StatusRequested) {
    Write-Output $LaravelServiceState
    exit 0
}

if ($LaravelServiceState -eq "running") {
    Show-LaravelServiceAlreadyRunning
    exit 0
}

$PwshExe = (Get-Command powershell.exe -ErrorAction SilentlyContinue).Source
if (-not $PwshExe) { $PwshExe = (Get-Command pwsh.exe -ErrorAction SilentlyContinue).Source }

if ($ServiceMode) {
    if (-not $FrankenPhpRuntime.IsElevated) {
        Write-Host "ERROR: --service installs the Windows service $LaravelServiceName and needs an elevated (Administrator) PowerShell." -ForegroundColor Red
        exit 1
    }
    $LegacyServiceRemoved = Remove-NssmService -ServiceName $LegacyServiceName
    if (-not $LegacyServiceRemoved) {
        Write-Host "  Warning: legacy service $LegacyServiceName is still registered; its body no longer touches port $Port." -ForegroundColor Yellow
    }
    if ([string]::IsNullOrEmpty($env:CODEMART_INIT)) { $env:CODEMART_INIT = $CodemartInitDefault }
    if ([string]::IsNullOrEmpty($IncludeUiEnv)) { $IncludeUiEnv = $IncludeUiDefault }
    $ComposerInteractionArgs = @("--no-interaction")
    $ArtisanInteractionArgs = @("--no-interaction")
}

Write-Host "Initial directory (invocation): $($OriginalDirectory.Path)" -ForegroundColor DarkGray
Write-Host "Working directory (Laravel root): $LaravelDir" -ForegroundColor DarkGray
Write-Host ""

try {
    Set-Location -Path $LaravelDir

    # Candidate access code for THIS provisioning run; persisted into the
    # external runtime store by Initialize-RuntimeConfigurationStore (only
    # when the store has none - the code is stable across runs, and the
    # InstallationAccessCode.php repository file is never rewritten).
    $GeneratedAccessCode = New-InstallationAccessCode

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

    # The Laravel 12 -> 13 upgrade is interactive only; --service reports it and stops.
    if ($ServiceMode) {
        $FrameworkMajor = Get-LaravelFrameworkMajor -LaravelRoot $LaravelDir -PhpExecutable $phpCmd.Source
        if (($null -ne $FrameworkMajor) -and ($FrameworkMajor -ne $Laravel13TargetMajor)) {
            Write-Host "ERROR: Laravel $FrameworkMajor detected; run start.ps1 interactively once to upgrade to Laravel $Laravel13TargetMajor." -ForegroundColor Red
            exit 1
        }
    } elseif (-not (Invoke-Laravel13Upgrade -LaravelRoot $LaravelDir -PhpExecutable $phpCmd.Source -ComposerExecutable $composerCmd.Source)) {
        exit 1
    }

    # Ensure vendor dependencies before any artisan command.
    if ((-not (Test-Path -LiteralPath $VendorDir)) -or (-not (Test-Path -LiteralPath $VendorAutoload))) {
        Write-Host "vendor/ not found. Running composer install..." -ForegroundColor Yellow
        composer install @ComposerInteractionArgs
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
        # extensions idempotently -- same role as 77_ensure_php_pgsql.sh on Linux.
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
    # resolves the same store as the PG manager, PathMapper and the FrankenPHP
    # service (<PG data drive>\www\core_node), NOT the repo drive.
    Resolve-PgDataDir | Out-Null

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
    php artisan sys:init @ArtisanInteractionArgs
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

    # --- Idempotent: stop stale foreground sessions before (re)starting ---
    # The prerequisites above can take minutes while the SCM or the launcher starts the
    # FrankenPHP service, so its state is re-read right before any kill and its process tree
    # is never killed. Mirrors start.sh ensure_port_free(): kill stale app processes first,
    # wait for port release, then fall back to netsh reserve only for Windows dynamic-range
    # conflicts (Hyper-V/WSL2 reserving the port with no listener process).
    $LaravelServiceState = Get-ServiceRunState -ServiceName $LaravelServiceName
    if ($LaravelServiceState -eq "running") {
        Show-LaravelServiceAlreadyRunning
        exit 0
    }
    Write-Host "Ensuring port $Port is free (idempotent restart)..." -ForegroundColor Yellow
    $stopPids = @()

    # (1) php.exe artisan lanes: the artisan serve fallback and the retired dev:win lanes
    #     (queue:listen / reverb:start / schedule:work). schedule:work binds NO port, so the
    #     port-based step (2) can never catch a stale one -- this command-line match is its
    #     ONLY cleanup path. Lanes of this app (see Test-ProcessOwnedByDirectory) and
    #     artisan serve on $Port are always stopped; the unattended --service run never
    #     stops another project's lanes, an interactive run also clears unowned worker lanes.
    $AllProcesses = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
    $ProcessById = @{}
    foreach ($processEntry in $AllProcesses) {
        $ProcessById[[int]$processEntry.ProcessId] = $processEntry
    }
    foreach ($phpProc in @($AllProcesses | Where-Object { ($_.Name -eq 'php.exe') -and $_.CommandLine })) {
        $isServeLane = ($phpProc.CommandLine -match $ArtisanServePattern)
        $isWorkerLane = ($phpProc.CommandLine -match $ArtisanWorkerLanePattern)
        if ((-not $isServeLane) -and (-not $isWorkerLane)) { continue }
        if ((Test-ProcessOwnedByDirectory -Process $phpProc -ProcessTable $ProcessById -DirectoryPattern $LaravelDirPattern) -or
            ($isServeLane -and ($phpProc.CommandLine -match $ArtisanServePortPattern)) -or
            ($isWorkerLane -and (-not $ServiceMode))) {
            $stopPids += [int]$phpProc.ProcessId
        }
    }

    # (2) Kill processes owning port $Port (a stale foreground frankenphp / artisan serve).
    $portConns = @(
        (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    ) | Where-Object { $_ } | Select-Object -ExpandProperty OwningProcess -Unique
    if ($portConns) { $stopPids += @($portConns) }

    # Never the service's own process tree (WinSW wrapper + children), even when the
    # service started after the re-check above.
    $ServiceTreePids = @(Get-ServiceProcessTreeIds -ServiceName $LaravelServiceName)
    $stopPids = @($stopPids | ForEach-Object { [int]$_ } | Where-Object { ($_ -gt 0) -and ($ServiceTreePids -notcontains $_) } | Sort-Object -Unique)
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

    # --- Background service (AFTER the full prerequisite setup; mirrors start.sh -> 175) ---
    # --service / AS_SERVICE=yes installs it without asking; otherwise ask (default Y) unless
    # --no-service / AS_SERVICE=no. Step175 converges FrankenPHP and the WinSW service in its
    # own PowerShell process (it loads GlobalVars' strict mode).
    if ($ServiceMode) {
        $AsServiceChoice = $true
    } elseif ($AsServiceEnv -eq "no") {
        $AsServiceChoice = $false
    } else {
        $AsServiceChoice = Read-YesNoDefaultYes "Prerequisites ready. Install laravel_main as the Windows service $LaravelServiceName (FrankenPHP, Step175)?"
    }
    if ($AsServiceChoice -and (-not $ServiceMode) -and (-not $FrankenPhpRuntime.IsElevated)) {
        Write-Host "  Installing $LaravelServiceName needs an elevated (Administrator) PowerShell; continuing in the foreground." -ForegroundColor Yellow
        $AsServiceChoice = $false
    }

    if ($AsServiceChoice) {
        if (-not $ServiceMode) {
            $LegacyServiceRemoved = Remove-NssmService -ServiceName $LegacyServiceName
        }
        Write-Host "Converging $LaravelServiceName via $Step175Script ..." -ForegroundColor Yellow
        & $PwshExe -NoProfile -ExecutionPolicy Bypass -File $Step175Script
        $LaravelServiceState = Get-ServiceRunState -ServiceName $LaravelServiceName
        if ($LaravelServiceState -eq "running") {
            Write-Host "Service $LaravelServiceName is running (port $Port)." -ForegroundColor Green
            Write-Host "  Manage: Get-Service $LaravelServiceName ; Restart-Service $LaravelServiceName ; Stop-Service $LaravelServiceName" -ForegroundColor DarkGray

            # --- Optional: also bring the nexus-dash UI up as its own background service ---
            # A separate process (never dot-sourced or `&`): the UI script may itself
            # `exit`, which would otherwise terminate this script's own process.
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
                    Start-ChildScriptWithEnv -PwshExePath $PwshExe -ScriptPath $UiStartPs1 -ScriptArgs @("-Service", "-NoBackend") `
                        -WorkingDirectory (Split-Path -Parent $UiStartPs1) -Wait | Out-Null
                } else {
                    Write-Host "  Warning: UI start script not found: $UiStartPs1 (skipping)." -ForegroundColor Yellow
                }
            }
            exit 0
        }
        Write-Host "Service $LaravelServiceName is not running after Step175 (state: $LaravelServiceState)." -ForegroundColor Red
        if ($ServiceMode) {
            exit 1
        }
        Write-Host "Continuing in the foreground." -ForegroundColor Yellow
    }

    # --- Foreground runtime ---
    # FrankenPHP with the Octane worker: same binary, Caddyfile and environment as the
    # service (Ctrl+C stops it). Until Step175 has provisioned them, fall back to the
    # built-in server; native Windows lacks pcntl_fork, so it must use one worker, and it
    # serves the HTTP API only (no Octane worker, Mercure, queue or timer lanes).
    $FrankenPhpExe = $FrankenPhpRuntime.BinaryPath
    $FrankenPhpCaddyfile = $FrankenPhpRuntime.CaddyfilePath
    $FrankenPhpReady = ((Test-Path -LiteralPath $FrankenPhpExe -PathType Leaf) -and
        (Test-Path -LiteralPath $FrankenPhpCaddyfile -PathType Leaf) -and
        (Test-Path -LiteralPath $FrankenPhpRuntime.WorkerPath -PathType Leaf))
    Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
    Write-Host ""
    if ($FrankenPhpReady) {
        Set-FrankenPhpForegroundEnvironment -Runtime $FrankenPhpRuntime
        Write-Host "Starting FrankenPHP (Octane worker) in the foreground: $FrankenPhpCaddyfile" -ForegroundColor Green
        & $FrankenPhpExe run --config $FrankenPhpCaddyfile --adapter caddyfile
    } else {
        Write-Host "FrankenPHP runtime not provisioned yet (run this script with --service, elevated, or Step175_LaravelMainStart.ps1)." -ForegroundColor Yellow
        Write-Host "Fallback: php artisan serve on ${BindHost}:$Port (HTTP API only; no Octane worker, Mercure, queue or timer lanes)." -ForegroundColor Yellow
        $env:PHP_CLI_SERVER_WORKERS = "1"
        php artisan serve "--host=$BindHost" "--port=$Port"
    }
}
finally {
    Set-Location -Path $OriginalDirectory
    Write-Host ""
    Write-Host "Restored to initial directory: $($OriginalDirectory.Path)" -ForegroundColor DarkGray
    Write-Host ""
    # Show the STORED code when resolvable (it wins over this run's candidate
    # once provisioned - the code is stable across runs).
    $ShownAccessCode = $GeneratedAccessCode
    if ($null -ne $phpCmd) {
        try {
            $StoredAccessCode = Get-RuntimeConfigurationValue -PhpExecutable $phpCmd.Path -AutoloadPath $VendorAutoload -BootstrapPath $BootstrapApp -Key "INSTALLATION_ACCESS_CODE"
            if (-not [string]::IsNullOrWhiteSpace($StoredAccessCode)) {
                $ShownAccessCode = $StoredAccessCode
            }
        } catch { }
    }
    Write-Host "Installation access value: $ShownAccessCode" -ForegroundColor Yellow
}
