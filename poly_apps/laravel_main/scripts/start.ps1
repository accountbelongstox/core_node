# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED.
# ### AI SPECIAL ATTENTION RULES END ###

# Windows PowerShell port of scripts/start.sh (Unix: use scripts/start.sh).
# Full lifecycle: ensure composer deps -> ensure Laravel runtime dirs / .env / APP_KEY
# -> ensure pdo_pgsql -> ensure PostgreSQL (service/winget) -> credentials via the
# CoreNodeSecrets global-var store -> create per-app databases (PostgreSQL-only;
# config/database.php is code-only and ignores .env entirely)
# -> route:clear -> route:list -> migrate -> sys:init -> detect IPs -> start dev.
# - Windows: no pcntl -> always composer dev:win; IPs via Get-NetIPAddress.
# - PRIORITY: REUSE the WSL PostgreSQL when one is reachable. With WSL2 default NAT
#   networking, Linux services are reachable from Windows via localhost
#   (learn.microsoft.com/windows/wsl/networking: "you can access it from a Windows
#   app ... using localhost"; .wslconfig localhostForwarding). Verified locally:
#   such forwarded connections arrive on the Linux side FROM 127.0.0.1, so the
#   pg_hba loopback scram rule written by 46_install_postgresql.sh admits them.
#   The WSL-side credential is harvested via wsl.exe into the Windows store so
#   both stores hold the same value. A SECOND Windows server is only installed
#   (winget -> EDB installer) when port 5432 is closed AND no WSL is available.
# - PostgreSQL parity with start.sh: the password is GENERATED here and stored in the
#   global-var store read by App\Support\CoreNodeSecrets (one file per key, value +
#   trailing newline) -- NEVER written into .env. On Windows PHP the default store
#   '/var/_core_node' resolves against the current drive, so this script pins it to
#   '<LaravelDrive>\var\_core_node' and EXPORTS CORE_NODE_DATA_DIR for all children.
# - If PostgreSQL cannot be made ready, the script falls back to the per-app SQLite
#   files (degraded mode) and prints ACTION REQUIRED guidance.
# - Linux: see start.sh (auto-installs php/composer/node, node-free fallback).

$OriginalDirectory = Get-Location
$ScriptDir = $PSScriptRoot
$LaravelDir = Split-Path -Parent $ScriptDir
$VendorDir = Join-Path $LaravelDir "vendor"
$VendorAutoload = Join-Path $VendorDir "autoload.php"
$EnvPath = Join-Path $LaravelDir ".env"
$EnvExamplePath = Join-Path $LaravelDir ".env.example"
$Port = 9000
# Companion Windows-side WSL helper (same scripts dir): sets the netsh portproxy +
# firewall so other Tailscale/LAN devices can reach the WSL backend on :Port.
$PortForwardScript = Join-Path $ScriptDir "wsl_port_forward.ps1"
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
# PostgreSQL chain state (Windows parity with scripts/start.sh PG link).
$LaravelDriveRoot = [System.IO.Path]::GetPathRoot($LaravelDir)
$CoreNodeDataDir = $null
$GlobalVarDir = $null
$PgPasswordFile = $null
$PgPassword = $null
$PgPasswordChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
$PgPasswordBytes = $null
$PgRng = $null
$PgHost = "127.0.0.1"
$PgPort = 5432
$PgUser = "postgres"
$PgService = $null
$PgPortOpen = $false
$PgAuthOk = $false
$PdoPgsqlPresent = $false
# Canonical dd.cmd-chain php.ini configurator (Windows counterpart of start.sh's
# 47_ensure_php_pgsql.sh): scripts/shells/win/1_phpconfig/configure_php_ini.php.
$RepoRootDir = Split-Path -Parent (Split-Path -Parent $LaravelDir)
$PhpIniConfigScript = Join-Path $RepoRootDir "scripts\shells\win\1_phpconfig\configure_php_ini.php"
$PhpExeForConfig = $null
$phpModulesRetry = $null
$PsqlExe = $null
$WingetCmd = $null
$WingetPgIds = @("PostgreSQL.PostgreSQL.17", "PostgreSQL.PostgreSQL.16")
$WingetPgId = $null
$wingetOut = $null
$PgWaitIndex = 0
# Per-app PostgreSQL databases (same list as start.sh APP_DB_NAMES; mirrors
# config/database.php $polyConnection(..., pgDatabase) targets).
$AppDbNames = @(
    "core_node_main",
    "app_qy_v1_database",
    "awy_v0_database",
    "vipclub_v1_database",
    "server_manager_v1_database",
    "achat_v1_database",
    "code_mart_v1_database",
    "mcp_v1_database",
    "it_tools_v1_database",
    "bank_v1_database"
)
$dbName = $null
$pgQueryOut = $null
$phpModulesOut = $null
$phpIniPath = $null
$phpExtDir = $null
$envDriverChanged = $false
$envDriverLines = $null
# WSL PostgreSQL reuse state (priority path; see header).
$WslExe = $null
$WslPgMode = $false
$wslOut = $null
$WslStorePasswordPath = "/var/_core_node/global_var/POSTGRES_PASSWORD"
$PgPasswordFromWsl = $null
# WSL-first orchestration state (start.ps1 is the single Windows entry point: it
# prefers launching the WSL backend over the degraded native-Windows runtime).
$BackendMode = $null
$WslDistros = @()
$WslDefaultDistro = $null
$WslStartShPath = $null
$IsAdminPs = $false
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

# --- Functions (PostgreSQL chain helpers) ---

# Fast TCP probe (PowerShell 5.1-safe; Test-NetConnection is too slow for a boot path).
function Test-PgTcpPort {
    param([string]$TargetHost, [int]$TargetPort, [int]$TimeoutMs)
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    try {
        $tcpAsync = $tcpClient.BeginConnect($TargetHost, $TargetPort, $null, $null)
        if (-not $tcpAsync.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
            return $false
        }
        $tcpClient.EndConnect($tcpAsync)
        return $true
    } catch {
        return $false
    } finally {
        $tcpClient.Close()
    }
}

# Resolve psql.exe: PATH first, then the standard EDB/winget install roots
# (%ProgramFiles%\PostgreSQL\<major>\bin), newest major version first.
function Resolve-PsqlPath {
    $psqlCmdInfo = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlCmdInfo) {
        return $psqlCmdInfo.Source
    }
    $pgRoots = @()
    if ($env:ProgramFiles) {
        $pgRoots += (Join-Path $env:ProgramFiles "PostgreSQL")
    }
    if (${env:ProgramFiles(x86)}) {
        $pgRoots += (Join-Path ${env:ProgramFiles(x86)} "PostgreSQL")
    }
    foreach ($pgRoot in $pgRoots) {
        if (Test-Path -LiteralPath $pgRoot) {
            $pgVersionDirs = Get-ChildItem -LiteralPath $pgRoot -Directory -ErrorAction SilentlyContinue |
                Sort-Object { $verNum = 0; [void][int]::TryParse($_.Name, [ref]$verNum); $verNum } -Descending
            foreach ($pgVersionDir in $pgVersionDirs) {
                $psqlCandidate = Join-Path $pgVersionDir.FullName "bin\psql.exe"
                if (Test-Path -LiteralPath $psqlCandidate) {
                    return $psqlCandidate
                }
            }
        }
    }
    return $null
}

# Run a single SQL command against the local server as the postgres superuser.
# Caller sets $env:PGPASSWORD beforehand; check $LASTEXITCODE after the call.
function Invoke-PgSql {
    param([string]$PsqlPath, [string]$Sql)
    return (& $PsqlPath -h $PgHost -p $PgPort -U $PgUser -d postgres -tAc $Sql 2>&1)
}

# Resolve wsl.exe (PATH, then the canonical System32 location).
function Resolve-WslExe {
    $wslCmdInfo = Get-Command wsl.exe -ErrorAction SilentlyContinue
    if ($wslCmdInfo) {
        return $wslCmdInfo.Source
    }
    $wslCandidate = Join-Path $env:SystemRoot "System32\wsl.exe"
    if (Test-Path -LiteralPath $wslCandidate) {
        return $wslCandidate
    }
    return $null
}

# Run a single SQL command on the WSL PostgreSQL via the local Unix socket as the
# postgres OS user (peer auth, no password) -- the same admin path start.sh /
# 46_install_postgresql.sh use (run_as_postgres psql). Check $LASTEXITCODE after.
function Invoke-WslPgSqlPeer {
    param([string]$Sql)
    return (& $WslExe -u postgres -e psql -tAc $Sql 2>&1)
}

# Validate a password against the WSL PostgreSQL over TCP loopback (scram). This
# exercises the EXACT pg_hba rule that Windows-forwarded connections hit: verified
# on this setup, WSL2 NAT localhost forwarding delivers them to the Linux side
# with source address 127.0.0.1. Passwords are [A-Za-z0-9] by construction (both
# generators), so single-quote embedding into sh -c is safe.
function Test-WslPgScram {
    param([string]$Password)
    return (& $WslExe -e sh -c ("PGPASSWORD='{0}' psql -h 127.0.0.1 -p {1} -U {2} -d postgres -tAc 'SELECT 1'" -f $Password, $PgPort, $PgUser) 2>&1)
}

# List registered WSL distros (trimmed, empty entries dropped). WSL_UTF8=1 makes
# recent wsl.exe emit UTF-8; the \0/\r strip keeps older UTF-16 output usable too.
function Get-WslInstalledDistros {
    param([string]$WslPath)
    $prevUtf8 = $env:WSL_UTF8
    $env:WSL_UTF8 = "1"
    $raw = $null
    try {
        $raw = & $WslPath -l -q 2>$null
    } catch {
        $raw = $null
    } finally {
        $env:WSL_UTF8 = $prevUtf8
    }
    if (-not $raw) { return @() }
    # Drop empties and Docker Desktop's system distros (they cannot run the backend).
    # `wsl -l -q` lists the DEFAULT distro first, so [0] downstream is the default.
    return @($raw |
        ForEach-Object { ($_ -replace "[\0\r]", "").Trim() } |
        Where-Object { ($_ -ne "") -and ($_ -notmatch '^docker-desktop') })
}

# Convert an absolute Windows drive path to its WSL /mnt/<drive>/... form so a
# Windows-side script path can be handed to bash inside WSL.
function Convert-WinPathToWsl {
    param([string]$WinPath)
    $full = [System.IO.Path]::GetFullPath($WinPath)
    $drive = $full.Substring(0, 1).ToLower()
    $rest = ($full.Substring(2)) -replace '\\', '/'
    return "/mnt/$drive$rest"
}

# Idempotent y/N prompt defaulting to NO. LARAVEL_ASSUME_YES=1 pre-confirms; a
# non-interactive session (no console) answers NO so nothing ever blocks.
function Read-PsYesNoDefaultNo {
    param([string]$Message)
    if ($env:LARAVEL_ASSUME_YES -eq '1') { return $true }
    if (-not [Environment]::UserInteractive) { return $false }
    $reply = Read-Host "$Message [y/N]"
    return ($reply -match '^[Yy]')
}

Write-Host "Initial directory (invocation): $($OriginalDirectory.Path)" -ForegroundColor DarkGray
Write-Host "Working directory (Laravel root): $LaravelDir" -ForegroundColor DarkGray
Write-Host ""

try {
    Set-Location -Path $LaravelDir

    # ========================================================================
    # WSL-first orchestration (single Windows entry point).
    # ------------------------------------------------------------------------
    # The PRIMARY runtime is Laravel Octane on Swoole, which has NO Windows build
    # and runs only on Linux/WSL (scripts/start.sh is that runtime; the native
    # path below is a degraded, Swoole-less fallback). So when WSL is available we
    # ORCHESTRATE it from here -- everything the Windows host can invoke directly is
    # invoked directly:
    #   1. (host-runnable) Tailscale/LAN port-forward Windows:Port -> WSL:Port, so
    #      OTHER Tailscale/LAN devices can reach the WSL backend (needs admin -> UAC).
    #      Under WSL2 NAT, octane:start binds the WSL VM's 0.0.0.0, not the host, so
    #      without this only the host's own localhost can reach it.
    #   2. (host-runnable) launch start.sh INSIDE WSL in the foreground.
    # If WSL is NOT installed we PROMPT (idempotent) to install it, otherwise we fall
    # through to the native-Windows runtime below. Opt out of WSL with:
    #   $env:LARAVEL_BACKEND_MODE = 'native'   (force native)  | 'wsl' (force WSL)
    $BackendMode = $env:LARAVEL_BACKEND_MODE
    $WslExe = Resolve-WslExe
    if ($WslExe) {
        $WslDistros = Get-WslInstalledDistros $WslExe
    }
    if ($BackendMode -ne 'native') {
        if ($WslExe -and ($WslDistros.Count -gt 0)) {
            $WslDefaultDistro = $WslDistros[0]
            Write-Host ""
            Write-Host "WSL detected (distro: $WslDefaultDistro) -> orchestrating the WSL backend (Octane/Swoole)." -ForegroundColor Cyan

            # 1. Tailscale/LAN port-forward (host-runnable; netsh + firewall need admin).
            if (Test-Path -LiteralPath $PortForwardScript) {
                Write-Host "Setting Windows->WSL port-forward for :$Port (Tailscale/LAN reachability)..." -ForegroundColor Yellow
                $IsAdminPs = (New-Object Security.Principal.WindowsPrincipal(
                    [Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole(
                    [Security.Principal.WindowsBuiltInRole]::Administrator)
                if ($IsAdminPs) {
                    & $PortForwardScript -Port $Port
                } else {
                    Write-Host "  (a UAC prompt will appear -- the port-forward needs Administrator for netsh/firewall)" -ForegroundColor DarkGray
                    Start-Process -FilePath "powershell.exe" -Verb RunAs -Wait -ArgumentList @(
                        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PortForwardScript`"", "-Port", "$Port"
                    )
                }
            } else {
                Write-Host "  Note: $PortForwardScript missing -> skipping port-forward (external access may not work)." -ForegroundColor Yellow
            }

            # 2. Launch start.sh inside WSL (foreground). start.sh derives all its own
            #    paths from its location, so only its WSL path is needed. --no-service
            #    keeps it foreground/non-prompting (this orchestrator owns lifecycle).
            $WslStartShPath = Convert-WinPathToWsl (Join-Path $ScriptDir "start.sh")
            Write-Host "Launching backend in WSL: $WslDefaultDistro -> $WslStartShPath" -ForegroundColor Cyan
            Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray
            Write-Host ""
            & $WslExe -d $WslDefaultDistro -- env PORT=$Port bash $WslStartShPath --no-service
            exit $LASTEXITCODE
        } else {
            # WSL feature/distro absent -> idempotent prompt, then fall back to native.
            Write-Host ""
            if (-not $WslExe) {
                Write-Host "WSL is not installed on this host (wsl.exe not found)." -ForegroundColor Yellow
            } else {
                Write-Host "WSL is installed but no distro is registered." -ForegroundColor Yellow
            }
            Write-Host "The PRIMARY runtime (Octane/Swoole) needs WSL. Install it once (a reboot is required):" -ForegroundColor Yellow
            Write-Host "    wsl --install -d Ubuntu" -ForegroundColor Cyan
            if (Read-PsYesNoDefaultNo "Run 'wsl --install -d Ubuntu' now? (a reboot will be required)") {
                wsl --install -d Ubuntu
                Write-Host "WSL install started. Reboot, finish the Ubuntu first-run setup, then re-run start.ps1." -ForegroundColor Green
                exit 0
            }
            Write-Host "Continuing with the DEGRADED native-Windows runtime (Swoole-less; no Octane timer tasks)." -ForegroundColor Yellow
            Write-Host ""
        }
    }
    # (Reached only when LARAVEL_BACKEND_MODE='native', or WSL is unavailable and the
    #  user declined to install it -> the existing native-Windows flow runs below.)

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

    # --- PHP pdo_pgsql extension check (the app uses PostgreSQL on Windows too) ---
    # Without pdo_pgsql every PG connection dies at migrate with "could not find
    # driver", so a missing extension forces the SQLite fallback below.
    $phpModulesOut = php -m 2>&1
    if (($phpModulesOut | Out-String) -match '(?im)^\s*pdo_pgsql\s*$') {
        $PdoPgsqlPresent = $true
        Write-Host "PHP pdo_pgsql extension present." -ForegroundColor Green
    } else {
        # Canonical auto-fix first (dd.cmd chain): configure_php_ini.php enables the
        # required extension set (now including pdo_pgsql + pgsql) idempotently --
        # same role as 47_ensure_php_pgsql.sh invoked by start.sh on Linux.
        if (Test-Path -LiteralPath $PhpIniConfigScript) {
            $PhpExeForConfig = (Get-Command php -ErrorAction SilentlyContinue).Source
            if ($PhpExeForConfig) {
                Write-Host "PHP pdo_pgsql missing. Invoking canonical configurator (dd.cmd chain):" -ForegroundColor Yellow
                Write-Host "  $PhpIniConfigScript" -ForegroundColor Yellow
                php $PhpIniConfigScript $PhpExeForConfig 2>&1 | Out-Null
                $phpModulesRetry = php -m 2>&1
                if (($phpModulesRetry | Out-String) -match '(?im)^\s*pdo_pgsql\s*$') {
                    $PdoPgsqlPresent = $true
                    Write-Host "pdo_pgsql enabled by configure_php_ini.php -> PostgreSQL driver available." -ForegroundColor Green
                }
            }
        }
    }
    if (-not $PdoPgsqlPresent) {
        $phpIniPath = (php -r "echo php_ini_loaded_file();" 2>&1 | Out-String).Trim()
        $phpExtDir = (php -r "echo ini_get('extension_dir');" 2>&1 | Out-String).Trim()
        Write-Host "  *** ACTION REQUIRED: PHP pdo_pgsql extension missing -> PostgreSQL cannot be used." -ForegroundColor Red
        Write-Host "  *** Fix (official Windows PHP ships the DLLs; only the ini lines are missing):" -ForegroundColor Red
        if ($phpIniPath) {
            Write-Host "  ***   1. Open: $phpIniPath" -ForegroundColor Red
        } else {
            Write-Host "  ***   1. No php.ini is loaded: copy php.ini-development to php.ini next to php.exe, then open it." -ForegroundColor Red
        }
        Write-Host "  ***   2. Add (or uncomment) these two lines: extension=pdo_pgsql and extension=pgsql" -ForegroundColor Red
        if ($phpExtDir) {
            Write-Host "  ***   3. Confirm php_pdo_pgsql.dll and php_pgsql.dll exist in: $phpExtDir" -ForegroundColor Red
        } else {
            Write-Host "  ***   3. Confirm php_pdo_pgsql.dll and php_pgsql.dll exist in the PHP ext directory." -ForegroundColor Red
        }
        Write-Host "  ***   4. Verify with: php -m | findstr pdo_pgsql -- then re-run start.ps1." -ForegroundColor Red
    }

    # --- Credentials: CoreNodeSecrets-compatible global-var store ---
    # App\Support\CoreNodeSecrets::dir() = getenv('CORE_NODE_DATA_DIR') else
    # '/var/_core_node' (+ '/global_var/<KEY>', one file per key, value + trailing
    # newline). On Windows PHP a rootless '/var/...' resolves against the CURRENT
    # DRIVE, so pin the store deterministically to '<LaravelDrive>\var\_core_node'
    # and EXPORT CORE_NODE_DATA_DIR so every php/artisan/composer child process
    # reads the exact same store. The password is NEVER written into .env.
    if ($env:CORE_NODE_DATA_DIR) {
        $CoreNodeDataDir = $env:CORE_NODE_DATA_DIR
    } else {
        $CoreNodeDataDir = Join-Path $LaravelDriveRoot "var\_core_node"
        $env:CORE_NODE_DATA_DIR = $CoreNodeDataDir
    }
    $GlobalVarDir = Join-Path $CoreNodeDataDir "global_var"
    $PgPasswordFile = Join-Path $GlobalVarDir "POSTGRES_PASSWORD"
    if (-not (Test-Path -LiteralPath $GlobalVarDir)) {
        New-Item -ItemType Directory -Force -Path $GlobalVarDir | Out-Null
    }
    if (Test-Path -LiteralPath $PgPasswordFile) {
        $PgPassword = Get-Content -LiteralPath $PgPasswordFile -Raw -ErrorAction SilentlyContinue
        if ($PgPassword) {
            $PgPassword = $PgPassword.Trim()
        }
    }
    # --- Database: PostgreSQL (Windows parity with start.sh), localhost-only ---
    Write-Host "Ensuring PostgreSQL (localhost-only, per-app databases)..." -ForegroundColor Yellow
    $PgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
    $PsqlExe = Resolve-PsqlPath
    $WslExe = Resolve-WslExe
    $PgPortOpen = Test-PgTcpPort -TargetHost $PgHost -TargetPort $PgPort -TimeoutMs 1500

    # Installed-but-stopped native Windows service: start it and wait briefly.
    # (EDB installer convention names the service postgresql-x64-<major>; the
    # postgresql* wildcard covers it without pinning the major version.)
    if ((-not $PgPortOpen) -and $PgService -and ($PgService.Status -ne "Running")) {
        Write-Host "  PostgreSQL service '$($PgService.Name)' found stopped; starting..." -ForegroundColor Yellow
        try {
            Start-Service -Name $PgService.Name -ErrorAction Stop
        } catch {
            Write-Host "  Warning: failed to start service '$($PgService.Name)': $($_.Exception.Message)" -ForegroundColor Yellow
        }
        for ($PgWaitIndex = 0; $PgWaitIndex -lt 15; $PgWaitIndex++) {
            $PgPortOpen = Test-PgTcpPort -TargetHost $PgHost -TargetPort $PgPort -TimeoutMs 1000
            if ($PgPortOpen) {
                break
            }
            Start-Sleep -Seconds 1
        }
        # ServiceController status is a snapshot; re-query so the mode decision
        # below sees the post-start state.
        $PgService = Get-Service -Name $PgService.Name -ErrorAction SilentlyContinue
    }

    # Port still closed but WSL exists: the canonical PostgreSQL likely lives
    # INSIDE WSL (start.sh -> 46_install_postgresql.sh chain). Try to start it
    # there (WSL-safe sysv service, no systemd needed) instead of installing a
    # SECOND Windows server.
    if ((-not $PgPortOpen) -and $WslExe) {
        Write-Host "  Port $PgPort closed; trying to start PostgreSQL inside WSL (canonical Linux chain)..." -ForegroundColor Yellow
        $wslOut = & $WslExe -u root -e service postgresql start 2>&1
        for ($PgWaitIndex = 0; $PgWaitIndex -lt 15; $PgWaitIndex++) {
            $PgPortOpen = Test-PgTcpPort -TargetHost $PgHost -TargetPort $PgPort -TimeoutMs 1000
            if ($PgPortOpen) {
                break
            }
            Start-Sleep -Seconds 1
        }
        if (-not $PgPortOpen) {
            Write-Host "  WSL PostgreSQL did not come up; run 'bash scripts/start.sh' inside WSL once to install/configure it." -ForegroundColor Yellow
        }
    }

    # Determine the serving mode for an open port: a RUNNING native Windows
    # service owns it; otherwise probe the WSL server (peer-auth psql over the
    # Unix socket). WSL2 default NAT networking forwards Windows localhost to
    # Linux services (learn.microsoft.com/windows/wsl/networking), and those
    # forwarded connections reach the Linux side from 127.0.0.1, matching the
    # 46_install_postgresql.sh pg_hba loopback scram rule.
    if ($PgPortOpen) {
        if ($PgService -and ($PgService.Status -eq "Running")) {
            $WslPgMode = $false
        } elseif ($WslExe) {
            $wslOut = Invoke-WslPgSqlPeer -Sql "SELECT 1"
            if (($LASTEXITCODE -eq 0) -and (($wslOut | Out-String) -match "1")) {
                $WslPgMode = $true
                Write-Host "  Port $PgPort is served by the WSL PostgreSQL (NAT localhost forwarding) -> reusing it (no second Windows server)." -ForegroundColor Green
            }
        }
    }

    # Credentials: when WSL is present and the Windows store is empty, HARVEST the
    # WSL-side value (canonical generator: 46_install_postgresql.sh) so both
    # stores hold the SAME password. Generate only for a Windows-native server
    # (same semantics: 24 random [A-Za-z0-9], persisted value + LF, no BOM --
    # CoreNodeSecrets trims whitespace only).
    if ((-not $PgPassword) -and $WslExe) {
        $PgPasswordFromWsl = (& $WslExe -e cat $WslStorePasswordPath 2>&1 | Out-String).Trim()
        if (($LASTEXITCODE -eq 0) -and $PgPasswordFromWsl) {
            $PgPassword = $PgPasswordFromWsl
            [System.IO.File]::WriteAllText($PgPasswordFile, "$PgPassword`n")
            Write-Host "  Harvested POSTGRES_PASSWORD from the WSL store into the Windows store: $PgPasswordFile" -ForegroundColor Green
        }
    }
    if (-not $PgPassword) {
        if ($WslPgMode) {
            Write-Host "  *** ACTION REQUIRED: WSL PostgreSQL is running but no credential exists in either store." -ForegroundColor Red
            Write-Host "  *** Run 'bash scripts/start.sh' inside WSL once (46_install_postgresql.sh generates the" -ForegroundColor Red
            Write-Host "  *** password and applies ALTER USER), then re-run start.ps1." -ForegroundColor Red
        } else {
            $PgRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
            $PgPasswordBytes = New-Object byte[] 24
            $PgRng.GetBytes($PgPasswordBytes)
            $PgPassword = -join ($PgPasswordBytes | ForEach-Object { $PgPasswordChars[$_ % $PgPasswordChars.Length] })
            [System.IO.File]::WriteAllText($PgPasswordFile, "$PgPassword`n")
            Write-Host "  Generated POSTGRES_PASSWORD into global-var store: $PgPasswordFile" -ForegroundColor Yellow
        }
    }

    # Not installed anywhere (port closed, no native service/psql, no WSL). The
    # Windows DevInstaller chain (scripts\shells\win\install_powershells\
    # Step*.ps1) has NO PostgreSQL step, so install via winget (best-effort).
    # winget docs: --override is "a string that will be passed directly to the
    # installer" and REPLACES the manifest's silent switches ('--mode unattended
    # --unattendedmodeui none'), so those are repeated here together with the EDB
    # unattended credential/port options (--superpassword/--serverport). The
    # PostgreSQL.PostgreSQL.<major> winget package wraps the EDB community
    # installer (get.enterprisedb.com/postgresql/...-windows-x64.exe).
    if ((-not $PgPortOpen) -and (-not $PgService) -and (-not $PsqlExe) -and (-not $WslExe)) {
        $WingetCmd = Get-Command winget -ErrorAction SilentlyContinue
        if ($WingetCmd) {
            foreach ($WingetPgId in $WingetPgIds) {
                Write-Host "  Installing PostgreSQL via winget: $WingetPgId (best-effort, unattended)..." -ForegroundColor Yellow
                $wingetOut = & $WingetCmd.Source install --id $WingetPgId -e --silent --accept-package-agreements --accept-source-agreements --override "--mode unattended --unattendedmodeui none --superpassword $PgPassword --serverport $PgPort" 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "  winget install $WingetPgId completed." -ForegroundColor Green
                    break
                }
                Write-Host "  winget install $WingetPgId failed (exit $LASTEXITCODE)." -ForegroundColor Yellow
            }
        } else {
            Write-Host "  winget not available -> cannot auto-install PostgreSQL." -ForegroundColor Yellow
        }
        $PgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
        $PsqlExe = Resolve-PsqlPath
        if ($PgService -and ($PgService.Status -ne "Running")) {
            try {
                Start-Service -Name $PgService.Name -ErrorAction Stop
            } catch {
                Write-Host "  Warning: failed to start service '$($PgService.Name)': $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
        for ($PgWaitIndex = 0; $PgWaitIndex -lt 30; $PgWaitIndex++) {
            $PgPortOpen = Test-PgTcpPort -TargetHost $PgHost -TargetPort $PgPort -TimeoutMs 1000
            if ($PgPortOpen) {
                break
            }
            Start-Sleep -Seconds 1
        }
        if (-not $PgPortOpen) {
            Write-Host "  *** ACTION REQUIRED: PostgreSQL could not be installed/started automatically." -ForegroundColor Red
            Write-Host "  *** Install it manually (e.g. 'winget install PostgreSQL.PostgreSQL.17' or the EDB" -ForegroundColor Red
            Write-Host "  *** installer). If the installer asks for a superuser password, either use the value" -ForegroundColor Red
            Write-Host "  *** stored in: $PgPasswordFile" -ForegroundColor Red
            Write-Host "  *** or overwrite that file with the password you chose (single line), then re-run start.ps1." -ForegroundColor Red
        }
    }

    # Verify credentials and ensure the per-app databases (idempotent).
    if ($PgPortOpen -and $WslPgMode) {
        # WSL reuse path: validate over TCP loopback scram (the exact pg_hba rule
        # Windows-forwarded connections hit), admin via peer-auth psql inside WSL
        # (no Windows psql.exe required).
        if ($PgPassword) {
            $pgQueryOut = Test-WslPgScram -Password $PgPassword
            if (($LASTEXITCODE -eq 0) -and (($pgQueryOut | Out-String) -match "1")) {
                $PgAuthOk = $true
            }
        }
        if (-not $PgAuthOk) {
            # The Windows store may be stale: re-harvest from WSL and retry once.
            $PgPasswordFromWsl = (& $WslExe -e cat $WslStorePasswordPath 2>&1 | Out-String).Trim()
            if (($LASTEXITCODE -eq 0) -and $PgPasswordFromWsl -and ($PgPasswordFromWsl -ne $PgPassword)) {
                $pgQueryOut = Test-WslPgScram -Password $PgPasswordFromWsl
                if (($LASTEXITCODE -eq 0) -and (($pgQueryOut | Out-String) -match "1")) {
                    $PgPassword = $PgPasswordFromWsl
                    [System.IO.File]::WriteAllText($PgPasswordFile, "$PgPassword`n")
                    $PgAuthOk = $true
                    Write-Host "  Windows store was stale -> re-synced POSTGRES_PASSWORD from the WSL store." -ForegroundColor Yellow
                }
            }
        }
        if ($PgAuthOk) {
            Write-Host "  WSL PostgreSQL accepts loopback scram auth with the stored credential (stores in sync)." -ForegroundColor Green
            # Per-app databases are normally created by start.sh inside WSL;
            # verify existence and fill any missing one.
            foreach ($dbName in $AppDbNames) {
                $pgQueryOut = Invoke-WslPgSqlPeer -Sql "SELECT 1 FROM pg_database WHERE datname='$dbName'"
                if (-not (($pgQueryOut | Out-String) -match "1")) {
                    Write-Host "  Creating database (via WSL): $dbName" -ForegroundColor Yellow
                    $pgQueryOut = Invoke-WslPgSqlPeer -Sql "CREATE DATABASE $dbName"
                    if ($LASTEXITCODE -ne 0) {
                        Write-Host "    Warning: failed to create $dbName" -ForegroundColor Yellow
                    }
                }
            }
            Write-Host "  Per-app PostgreSQL databases ensured (WSL server)." -ForegroundColor Green
        } else {
            Write-Host "  *** ACTION REQUIRED: the WSL PostgreSQL rejected loopback password auth." -ForegroundColor Red
            Write-Host "  *** Run 'bash scripts/start.sh' inside WSL once (46_install_postgresql.sh re-applies" -ForegroundColor Red
            Write-Host "  *** ALTER USER from the WSL store), then re-run start.ps1." -ForegroundColor Red
        }
    } elseif ($PgPortOpen) {
        if (-not $PsqlExe) {
            Write-Host "  *** ACTION REQUIRED: PostgreSQL is listening on port $PgPort but psql.exe was not found" -ForegroundColor Red
            Write-Host "  *** (PATH and %ProgramFiles%\PostgreSQL\<ver>\bin probed) -> per-app databases cannot" -ForegroundColor Red
            Write-Host "  *** be ensured. Add the PostgreSQL bin directory to PATH and re-run start.ps1." -ForegroundColor Red
        } else {
            $env:PGPASSWORD = $PgPassword
            $pgQueryOut = Invoke-PgSql -PsqlPath $PsqlExe -Sql "SELECT 1"
            if (($LASTEXITCODE -eq 0) -and (($pgQueryOut | Out-String) -match "1")) {
                $PgAuthOk = $true
                Write-Host "  PostgreSQL reachable; stored credentials accepted." -ForegroundColor Green
            } else {
                # EDB dev-guide: a plain 'winget install PostgreSQL.PostgreSQL.<n>'
                # (manifest silent switches only, no --superpassword) leaves the
                # default superuser password 'postgres'. Probe it and self-heal by
                # rotating to the stored value (ALTER USER -- the same semantics
                # 46_install_postgresql.sh applies on Linux).
                $env:PGPASSWORD = "postgres"
                $pgQueryOut = Invoke-PgSql -PsqlPath $PsqlExe -Sql "SELECT 1"
                if (($LASTEXITCODE -eq 0) -and (($pgQueryOut | Out-String) -match "1")) {
                    $pgQueryOut = Invoke-PgSql -PsqlPath $PsqlExe -Sql "ALTER USER postgres WITH PASSWORD '$PgPassword'"
                    if ($LASTEXITCODE -eq 0) {
                        $env:PGPASSWORD = $PgPassword
                        $pgQueryOut = Invoke-PgSql -PsqlPath $PsqlExe -Sql "SELECT 1"
                        if (($LASTEXITCODE -eq 0) -and (($pgQueryOut | Out-String) -match "1")) {
                            $PgAuthOk = $true
                            Write-Host "  Default 'postgres' password detected -> rotated to the stored value (ALTER USER)." -ForegroundColor Yellow
                        }
                    }
                }
            }
            if (-not $PgAuthOk) {
                Write-Host "  *** ACTION REQUIRED: PostgreSQL is running but rejected the stored password." -ForegroundColor Red
                Write-Host "  *** The store file read by Laravel (App\Support\CoreNodeSecrets) is:" -ForegroundColor Red
                Write-Host "  ***   $PgPasswordFile" -ForegroundColor Red
                Write-Host "  *** Option 1: overwrite that file with the server's actual postgres password (single line)." -ForegroundColor Red
                Write-Host "  *** Option 2: change the server password to the stored value:" -ForegroundColor Red
                Write-Host "  ***   psql -h $PgHost -U $PgUser -c `"ALTER USER postgres WITH PASSWORD '<stored value>';`"" -ForegroundColor Red
                Write-Host "  *** Then re-run start.ps1." -ForegroundColor Red
            }
            if ($PgAuthOk) {
                foreach ($dbName in $AppDbNames) {
                    $pgQueryOut = Invoke-PgSql -PsqlPath $PsqlExe -Sql "SELECT 1 FROM pg_database WHERE datname='$dbName'"
                    if (-not (($pgQueryOut | Out-String) -match "1")) {
                        Write-Host "  Creating database: $dbName" -ForegroundColor Yellow
                        $pgQueryOut = Invoke-PgSql -PsqlPath $PsqlExe -Sql "CREATE DATABASE $dbName"
                        if ($LASTEXITCODE -ne 0) {
                            Write-Host "    Warning: failed to create $dbName" -ForegroundColor Yellow
                        }
                    }
                }
                Write-Host "  Per-app PostgreSQL databases ensured." -ForegroundColor Green
            }
            Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        }
    }

    # --- PostgreSQL-only enforcement (no fallback database exists) ---
    # config/database.php hardcodes pgsql for every active connection and reads
    # NOTHING from .env (driver/host/port/user/database are code literals; the
    # password comes from the CoreNodeSecrets store). There is no SQLite
    # connection to fall back to: if PostgreSQL is not ready the app cannot
    # serve, so say it loudly instead of pretending a degraded mode exists.
    if ($PgAuthOk -and $PdoPgsqlPresent) {
        Write-Host "PostgreSQL ready (pdo_pgsql + authenticated localhost server)." -ForegroundColor Green
    } else {
        Write-Host "  *** ACTION REQUIRED: PostgreSQL is NOT ready and this app is PostgreSQL-only." -ForegroundColor Red
        Write-Host "  *** There is no SQLite fallback; migrations and every request will fail." -ForegroundColor Red
        Write-Host "  *** Fix the ACTION REQUIRED items above, then re-run start.ps1." -ForegroundColor Red
    }
    # Neutralize stale DB lines in .env idempotently (same approach as start.sh
    # on Linux). The active connections ignore .env by design, but leftover
    # POLY_DB_DRIVER / DB_* lines mislead readers and used to repoint the
    # runtime in older revisions -- comment them out so .env stays inert.
    if (Test-Path -LiteralPath $EnvPath) {
        $envDriverChanged = $false
        $envDriverLines = @(Get-Content -LiteralPath $EnvPath | ForEach-Object {
            if ($_ -match '^(POLY_DB_DRIVER|DB_CONNECTION|DB_HOST|DB_PORT|DB_DATABASE|DB_USERNAME|DB_PASSWORD|DB_URL)=') {
                $envDriverChanged = $true
                ("# [disabled by start.ps1: database config is code-only PostgreSQL, .env is ignored] {0}" -f $_)
            } else {
                $_
            }
        })
        if ($envDriverChanged) {
            Write-Host "  .env DB override line(s) found -> commented out (database config is code-only)." -ForegroundColor Yellow
            [System.IO.File]::WriteAllLines($EnvPath, [string[]]$envDriverLines)
            php artisan config:clear 2>&1 | Out-Null
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
        Write-Host "  Warning: migrate had errors (PostgreSQL unreachable or schema issue). Fix DB/migrations then run 'php artisan migrate'. Continuing." -ForegroundColor Yellow
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
