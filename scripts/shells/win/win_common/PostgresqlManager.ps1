<#
.SYNOPSIS
    Shared native-Windows PostgreSQL manager. Dot-sourced by both
    Step_InstallPostgreSQL.ps1 (DevInstaller) and poly_apps/laravel_main/scripts/
    start.ps1 so they never drift.

    Mirrors the Linux canonical installer 75_install_postgresql.sh:
      - binaries under <LANG_COMPILER_DIR>\PG, data dir at map_web_path "postgresql"\data
        (D:\www\wwwroot\postgresql\data),
      - superuser "postgres", password from the shared CoreNodeSecrets store
        (CORE_NODE_DATA_DIR\global_var\POSTGRES_PASSWORD + laravel_db mirror),
      - localhost-only: listen_addresses='localhost', pg_hba scram on 127.0.0.1/::1,
      - per-app databases from the canonical union,
      - port 5432.

    DB-sharing model (idempotent + :5432 reuse): Ensure-Postgresql first probes
    127.0.0.1:5432; if a server is already serving (e.g. a WSL PostgreSQL started
    first, surfaced on Windows via WSL2 NAT), it is REUSED -- no second server is
    started. Only when 5432 is free does it install/init/start a native cluster.
#>

# =============================================================================
# VARIABLES (declared at the beginning of the file)
# =============================================================================
$Global:PG_HOST          = "127.0.0.1"
$Global:PG_PORT          = 5432
$Global:PG_USER          = "postgres"
$Global:PG_SERVICE_NAME  = "postgresql-core-node"
if (-not (Get-Command Get-ServiceContractValue -ErrorAction SilentlyContinue)) {
    . (Join-Path (Split-Path -Parent $PSCommandPath) "ServiceContract.ps1")
}
$Global:PG_VERSION       = [string](Get-ServiceContractValue -ContractPath "versions.postgresql") # EDB binaries package version
$Global:PG_MAJOR         = $Global:PG_VERSION.Split('.')[0]
$Global:PG_WEB_BASE      = "D:\www" # matches PathMapper.php Windows base ($basePath)

# Tooling root <LANG_COMPILER_DIR>: reuse GlobalVars' constant when already loaded (DevInstaller
# context), else load GlobalVars in a child scope (start.ps1 context) so the caller's
# StrictMode / ErrorActionPreference stay unchanged.
$Global:PG_GLOBAL_VARS_PS1 = Join-Path $PSScriptRoot "GlobalVars.ps1"
if (-not $Global:LANG_COMPILER_DIR) {
    & { . $Global:PG_GLOBAL_VARS_PS1 }
}
$Global:PG_TOOL_ROOT = $Global:LANG_COMPILER_DIR

$Global:PG_LEGACY_INSTALL_DIR = Join-Path $Global:PG_TOOL_ROOT "PG"      # pre-versioned layout; kept as a pg_upgrade source
$Global:PG_INSTALL_DIR   = Join-Path $Global:PG_TOOL_ROOT ("PG-{0}" -f $Global:PG_VERSION) # versioned binaries root
$Global:PG_BIN_DIR       = Join-Path $Global:PG_INSTALL_DIR "bin"
$Global:PG_PREVIOUS_MAJORS = Get-ServiceContractValue -ContractPath "versions.postgresql_previous_majors" # major -> EDB version for pg_upgrade
$Global:PG_DATA_ROOT     = Join-Path $Global:PG_WEB_BASE "wwwroot\postgresql"  # map_web_path "postgresql"
$Global:PG_DATA_DIR      = Join-Path $Global:PG_DATA_ROOT "data"
$Global:PG_LOG_DIR       = Join-Path $Global:PG_DATA_ROOT "logs"
$Global:PG_UPGRADE_STAGE_DIR = Join-Path $Global:PG_DATA_ROOT ("data_upgrade_{0}" -f $Global:PG_MAJOR)
$Global:PG_UPGRADE_DONE_MARKER = "pg_upgrade_done"
$Global:PG_UPGRADE_WORK_DIR  = Join-Path $Global:PG_LOG_DIR "pg_upgrade"
$Global:PG_UPGRADE_PORT  = 50432
$Global:PG_UPGRADED      = $false
$Global:PG_LARAVEL_DB    = Join-Path $Global:PG_WEB_BASE "wwwroot\laravel_db"
$Global:PG_SECRET_MIRROR = Join-Path $Global:PG_LARAVEL_DB ".core_node_secrets\POSTGRES_PASSWORD"
$Global:PG_BINARIES_URL_FORMAT = "https://get.enterprisedb.com/postgresql/postgresql-{0}-1-windows-x64-binaries.zip"
# Persistent download cache (kept across runs; a valid archive is reused, never re-downloaded):
# the Windows downloads dir on the program drive, never the D: shared data.
$Global:PG_CACHE_DIR = $Global:DOWNLOADS_DIR
$Global:PG_CACHE_ZIP_FORMAT = "postgresql-{0}-windows-x64-binaries.zip"

# Canonical per-app database union (config/database.php polyConnection() names +
# core_node_main + legacy). MUST match 75_install_postgresql.sh / start.sh.
$Global:PG_APP_DATABASES = @(
    "core_node_main",
    "app_qy_v1_database",
    "awy_v0_database",
    "vipclub_v1_database",
    "server_manager_v1_database",
    "achat_v1_database",
    "code_mart_v1_database",
    "mcp_v1_database",
    "it_tools_v1_database",
    "bank_v1_database",
    "pdd_tool_v1_database",
    "ding_duo_duo_v1_database"
)

# =============================================================================
# LOGGING (reuse CommonFunc's Write-ColorMessage when dot-sourced together)
# =============================================================================
function Write-PgLog {
    param([string]$Message, [string]$Type = "Info")
    if (Get-Command Write-ColorMessage -ErrorAction SilentlyContinue) {
        Write-ColorMessage -Message "[PG] $Message" -Type $Type
    } else {
        $color = switch ($Type) { "Success" { "Green" } "Warning" { "Yellow" } "Error" { "Red" } default { "Cyan" } }
        Write-Host "[PG] $Message" -ForegroundColor $color
    }
}

# =============================================================================
# SHARED-STORE PASSWORD (CoreNodeSecrets parity)
# =============================================================================
function Resolve-PgDataDir {
    # CORE_NODE_DATA_DIR drives where CoreNodeSecrets (and Laravel) read the
    # password. Pin it to <data-drive>\www\core_node and EXPORT so php/artisan
    # children read the same store. Idempotent.
    if (-not $env:CORE_NODE_DATA_DIR) {
        $driveRoot = [System.IO.Path]::GetPathRoot($Global:PG_DATA_ROOT)
        $env:CORE_NODE_DATA_DIR = Join-Path $driveRoot "www\core_node"
    }
    return $env:CORE_NODE_DATA_DIR
}

function Get-PgPassword {
    # Read from the global-var store, else the laravel_db mirror, else generate.
    # Always (re)persist to BOTH so Laravel and dd stay aligned (matches 46.sh).
    $dataDir = Resolve-PgDataDir
    $globalVarDir = Join-Path $dataDir "global_var"
    $pwFile = Join-Path $globalVarDir "POSTGRES_PASSWORD"
    $password = ""

    if (Test-Path $pwFile) {
        $password = ([System.IO.File]::ReadAllText($pwFile)).Trim()
    }
    if (-not $password -and (Test-Path $Global:PG_SECRET_MIRROR)) {
        $password = ([System.IO.File]::ReadAllText($Global:PG_SECRET_MIRROR)).Trim()
    }
    if (-not $password) {
        $bytes = New-Object 'System.Byte[]' 32
        ([System.Security.Cryptography.RandomNumberGenerator]::Create()).GetBytes($bytes)
        $clean = ([System.Convert]::ToBase64String($bytes)) -replace '[^A-Za-z0-9]', ''
        $password = $clean.Substring(0, [Math]::Min(24, $clean.Length))
    }

    if (-not (Test-Path $globalVarDir)) { New-Item -ItemType Directory -Path $globalVarDir -Force | Out-Null }
    $mirrorDir = Split-Path $Global:PG_SECRET_MIRROR -Parent
    if (-not (Test-Path $mirrorDir)) { New-Item -ItemType Directory -Path $mirrorDir -Force | Out-Null }
    # LF + no BOM, matching the Linux/CoreNodeSecrets format.
    [System.IO.File]::WriteAllText($pwFile, "$password`n")
    [System.IO.File]::WriteAllText($Global:PG_SECRET_MIRROR, "$password`n")
    return $password
}

# =============================================================================
# BINARY / SERVER RESOLUTION
# =============================================================================
function Resolve-PgBinDir {
    # Prefer our native install (target version, then the pre-versioned layout), then any EDB install, then PATH.
    if (Test-Path (Join-Path $Global:PG_BIN_DIR "pg_ctl.exe")) { return $Global:PG_BIN_DIR }
    if (Test-Path (Join-Path $Global:PG_LEGACY_INSTALL_DIR "bin\pg_ctl.exe")) { return (Join-Path $Global:PG_LEGACY_INSTALL_DIR "bin") }
    $edb = Get-ChildItem -Path (Join-Path $env:ProgramFiles "PostgreSQL") -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | Select-Object -First 1
    if ($edb -and (Test-Path (Join-Path $edb.FullName "bin\pg_ctl.exe"))) { return (Join-Path $edb.FullName "bin") }
    $cmd = Get-Command pg_ctl.exe -ErrorAction SilentlyContinue
    if ($cmd) { return (Split-Path $cmd.Source -Parent) }
    return $null
}

function Get-PgBinMajor {
    # Major version of the binaries in BinDir ("pg_ctl (PostgreSQL) 18.6" -> "18"), or "" when unknown.
    param([string]$BinDir)
    $pgctl = Join-Path $BinDir "pg_ctl.exe"
    $text = ""
    if (-not (Test-Path $pgctl)) { return "" }
    $text = ("" + (& $pgctl --version 2>$null)).Trim()
    if (-not $text) { return "" }
    return (($text.Split(" ") | Select-Object -Last 1).Split(".")[0])
}

function Find-PgBinDirForMajor {
    # Installed binaries of one major: versioned PG-* dirs, the pre-versioned PG dir, EDB installs.
    param([string]$Major)
    $candidates = @()
    $dir = ""
    $candidates += @(Get-ChildItem -Path $Global:PG_TOOL_ROOT -Directory -Filter "PG-*" -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.FullName "bin" })
    $candidates += (Join-Path $Global:PG_LEGACY_INSTALL_DIR "bin")
    $candidates += @(Get-ChildItem -Path (Join-Path $env:ProgramFiles "PostgreSQL") -Directory -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.FullName "bin" })
    foreach ($dir in $candidates) {
        if ((Get-PgBinMajor -BinDir $dir) -eq $Major) { return $dir }
    }
    return $null
}

function Get-PgDataMajor {
    # Major version of a cluster data dir (its PG_VERSION file), or "" when not initialized.
    param([string]$DataDir = $Global:PG_DATA_DIR)
    $versionFile = Join-Path $DataDir "PG_VERSION"
    if (-not (Test-Path $versionFile)) { return "" }
    return ([System.IO.File]::ReadAllText($versionFile)).Trim()
}

function Test-PgPortOpen {
    # True if something is listening on 127.0.0.1:5432.
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $client.BeginConnect($Global:PG_HOST, $Global:PG_PORT, $null, $null)
        if ($iar.AsyncWaitHandle.WaitOne(1500, $false) -and $client.Connected) { return $true }
        return $false
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Invoke-Psql {
    # Run a single SQL statement as the superuser against the running server.
    param([string]$BinDir, [string]$Password, [string]$Database = "postgres", [string]$Sql)
    $psql = Join-Path $BinDir "psql.exe"
    $prev = $env:PGPASSWORD
    $env:PGPASSWORD = $Password
    try {
        return (& $psql -h $Global:PG_HOST -p $Global:PG_PORT -U $Global:PG_USER -d $Database -tAc $Sql 2>$null)
    } finally {
        $env:PGPASSWORD = $prev
    }
}

function Test-PgAuth {
    # True if the stored password authenticates against the running server.
    param([string]$BinDir, [string]$Password)
    if (-not $BinDir) { return $false }
    $result = Invoke-Psql -BinDir $BinDir -Password $Password -Sql "SELECT 1"
    return ("$result".Trim() -eq "1")
}

# =============================================================================
# INSTALL / INITIALIZE / CONFIGURE
# =============================================================================
function Test-PgZipValid {
    # A cached archive is reusable only if it opens as a non-empty zip.
    param([string]$ZipPath)
    if (-not (Test-Path $ZipPath)) { return $false }
    if ((Get-Item $ZipPath).Length -lt 1MB) { return $false }
    $zip = $null
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
        $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
        return ($zip.Entries.Count -gt 0)
    } catch {
        return $false
    } finally {
        if ($zip) { $zip.Dispose() }
    }
}

function Invoke-PgWebDownload {
    # Self-contained download with a Write-Progress bar (fallback when the shared
    # CommonFunc Get-FileWithSizeCheck is not dot-sourced, e.g. start.ps1 context).
    param([string]$Url, [string]$Destination, [string]$Label = "PostgreSQL")
    $webClient = New-Object System.Net.WebClient
    $partFile = "$Destination.part"
    $totalSize = 0
    $lastPct = -1
    $bytesNow = 0
    $pct = 0
    try {
        try { $totalSize = [int64]((Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing).Headers['Content-Length']) } catch { $totalSize = 0 }
        $webClient.DownloadFileAsync((New-Object Uri($Url)), $partFile)
        while ($webClient.IsBusy) {
            Start-Sleep -Milliseconds 400
            if (($totalSize -gt 0) -and (Test-Path $partFile)) {
                $bytesNow = (Get-Item $partFile).Length
                $pct = [math]::Min(100, [math]::Floor(($bytesNow / $totalSize) * 100))
                if ($pct -ne $lastPct) {
                    Write-Progress -Activity "Downloading $Label" -Status "$pct%" -PercentComplete $pct
                    $lastPct = $pct
                }
            } else {
                Write-Progress -Activity "Downloading $Label" -Status "Downloading..." -PercentComplete -1
            }
        }
        Write-Progress -Activity "Downloading $Label" -Completed
        if ((Test-Path $partFile) -and ((Get-Item $partFile).Length -gt 0)) {
            if (Test-Path $Destination) { Remove-Item $Destination -Force }
            Rename-Item -Path $partFile -NewName (Split-Path $Destination -Leaf) -Force
            return $true
        }
        return $false
    } catch {
        Write-PgLog "Download error: $($_.Exception.Message)" "Error"
        return $false
    } finally {
        $webClient.Dispose()
        if (Test-Path $partFile) { Remove-Item $partFile -Force -ErrorAction SilentlyContinue }
    }
}

function Install-PgBinaries {
    # Resolve/install the PostgreSQL Windows binaries of one version into PG-<version>. Idempotent +
    # cached: a valid archive in PG_CACHE_DIR is reused (never re-downloaded), and the cache is kept.
    param([string]$Version = $Global:PG_VERSION)
    $installDir = Join-Path $Global:PG_TOOL_ROOT ("PG-{0}" -f $Version)
    $binDir = Join-Path $installDir "bin"
    $url = $Global:PG_BINARIES_URL_FORMAT -f $Version
    $cacheZip = Join-Path $Global:PG_CACHE_DIR ($Global:PG_CACHE_ZIP_FORMAT -f $Version)
    $label = "PostgreSQL $Version binaries"
    $downloaded = $false

    if (Test-Path (Join-Path $binDir "pg_ctl.exe")) {
        Write-PgLog "Binaries already present: $binDir (idempotent)" "Success"
        return $true
    }
    if (-not (Test-Path $Global:PG_CACHE_DIR)) { New-Item -ItemType Directory -Path $Global:PG_CACHE_DIR -Force | Out-Null }

    if (Test-PgZipValid $cacheZip) {
        Write-PgLog "Reusing cached binaries archive: $cacheZip" "Success"
    } else {
        Write-PgLog "Downloading $label (cached for reuse)..." "Info"
        # Prefer the shared progress+size-cache helper when it is available.
        if (Get-Command Get-FileWithSizeCheck -ErrorAction SilentlyContinue) {
            Get-FileWithSizeCheck -localPath $cacheZip -remoteUrl $url -description $label | Out-Null
            $downloaded = (Test-PgZipValid $cacheZip)
        }
        if (-not $downloaded) {
            $downloaded = (Invoke-PgWebDownload -Url $url -Destination $cacheZip -Label $label) -and (Test-PgZipValid $cacheZip)
        }
        if (-not $downloaded) {
            Write-PgLog "Binaries download failed or archive invalid. Source: $url" "Error"
            if (Test-Path $cacheZip) { Remove-Item $cacheZip -Force -ErrorAction SilentlyContinue }
            return $false
        }
    }

    # Extract from the cached archive (kept for next time).
    $extractDir = Join-Path $Global:WORK_DIR "pg_extract_$Version"
    try {
        if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
        Expand-Archive -Path $cacheZip -DestinationPath $extractDir -Force
        # The archive contains a top-level "pgsql" folder; move its contents into the install dir.
        $inner = Join-Path $extractDir "pgsql"
        $source = if (Test-Path $inner) { $inner } else { $extractDir }
        if (-not (Test-Path $installDir)) { New-Item -ItemType Directory -Path $installDir -Force | Out-Null }
        Copy-Item -Path (Join-Path $source "*") -Destination $installDir -Recurse -Force
        Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path (Join-Path $binDir "pg_ctl.exe")) {
            Write-PgLog "Binaries installed: $installDir (cache kept: $cacheZip)" "Success"
            return $true
        }
        Write-PgLog "Archive extracted but pg_ctl.exe not found." "Error"
        return $false
    } catch {
        Write-PgLog "Extraction failed: $($_.Exception.Message)" "Error"
        return $false
    }
}

function Initialize-PgCluster {
    # initdb the data dir if not already initialized (PG_VERSION marker). Idempotent.
    param([string]$BinDir, [string]$Password, [string]$DataDir = $Global:PG_DATA_DIR)
    $versionFile = Join-Path $DataDir "PG_VERSION"
    if (Test-Path $versionFile) {
        Write-PgLog "Data dir already initialized: $DataDir (idempotent)" "Success"
        return $true
    }
    Write-PgLog "Initializing cluster at $DataDir ..." "Info"
    if (-not (Test-Path $Global:PG_DATA_ROOT)) { New-Item -ItemType Directory -Path $Global:PG_DATA_ROOT -Force | Out-Null }
    if (-not (Test-Path $Global:PG_LOG_DIR)) { New-Item -ItemType Directory -Path $Global:PG_LOG_DIR -Force | Out-Null }
    $pwFile = Join-Path $Global:WORK_DIR "pg_initpw.txt"
    [System.IO.File]::WriteAllText($pwFile, $Password)
    try {
        $initdb = Join-Path $BinDir "initdb.exe"
        & $initdb --pgdata=$DataDir --username=$Global:PG_USER --pwfile=$pwFile --encoding=UTF8 --auth=scram-sha-256 --auth-host=scram-sha-256 | Out-Null
        return (Test-Path $versionFile)
    } finally {
        Remove-Item $pwFile -Force -ErrorAction SilentlyContinue
    }
}

function Set-PgConfig {
    # Force localhost-only + scram, like 46.sh configure_localhost_only. Idempotent.
    $conf = Join-Path $Global:PG_DATA_DIR "postgresql.conf"
    $hba = Join-Path $Global:PG_DATA_DIR "pg_hba.conf"

    if (Test-Path $conf) {
        $lines = Get-Content -Path $conf
        $lines = $lines -replace "^[#\s]*listen_addresses\s*=.*", "listen_addresses = 'localhost'"
        $lines = $lines -replace "^[#\s]*port\s*=.*", "port = $($Global:PG_PORT)"
        if (-not ($lines -match "^\s*listen_addresses\s*=")) { $lines += "listen_addresses = 'localhost'" }
        if (-not ($lines -match "^\s*port\s*=")) { $lines += "port = $($Global:PG_PORT)" }
        Set-Content -Path $conf -Value $lines -Encoding ASCII
    }

    if (Test-Path $hba) {
        $hbaLines = Get-Content -Path $hba
        $want = @(
            "host    all    all    127.0.0.1/32    scram-sha-256",
            "host    all    all    ::1/128    scram-sha-256"
        )
        foreach ($rule in $want) {
            $token = ($rule -split '\s+')[3]
            if (-not ($hbaLines -match [regex]::Escape($token))) { $hbaLines += $rule }
        }
        Set-Content -Path $hba -Value $hbaLines -Encoding ASCII
    }
    Write-PgLog "Config set to localhost-only scram (port $($Global:PG_PORT))" "Success"
}

function Register-PgService {
    # Idempotently register the cluster as a Windows service AND self-repair it on
    # re-runs: if the existing service points at a stale binary/data dir (moved
    # install, changed data dir, leftover registration), it is unregistered and
    # re-registered at the correct paths, then set to auto-start and started.
    param([string]$BinDir)
    $pgctl = Join-Path $BinDir "pg_ctl.exe"
    $svcKey = Join-Path "HKLM:\SYSTEM\CurrentControlSet\Services" $Global:PG_SERVICE_NAME
    $svc = Get-Service -Name $Global:PG_SERVICE_NAME -ErrorAction SilentlyContinue
    $imagePath = ""
    $needsReregister = $false
    $svcUp = $false

    if ($svc) {
        try { $imagePath = (Get-ItemProperty -Path $svcKey -Name ImagePath -ErrorAction Stop).ImagePath } catch { $imagePath = "" }
        if ($imagePath -and (($imagePath -notlike "*$($Global:PG_DATA_DIR)*") -or ($imagePath -notlike "*$($BinDir)*"))) {
            $needsReregister = $true
        }
        if ($needsReregister) {
            Write-PgLog "Service $Global:PG_SERVICE_NAME points at a stale path -> repairing (unregister + re-register)." "Warning"
            try { if ($svc.Status -ne "Stopped") { Stop-Service -Name $Global:PG_SERVICE_NAME -Force -ErrorAction SilentlyContinue } } catch {}
            & $pgctl unregister -N $Global:PG_SERVICE_NAME 2>$null | Out-Null
            Start-Sleep -Seconds 2
            $svc = $null
        } else {
            Write-PgLog "Service $Global:PG_SERVICE_NAME registered correctly (idempotent)." "Success"
        }
    }

    if (-not $svc) {
        Write-PgLog "Registering service $Global:PG_SERVICE_NAME (data: $Global:PG_DATA_DIR) ..." "Info"
        & $pgctl register -N $Global:PG_SERVICE_NAME -D $Global:PG_DATA_DIR -S auto 2>$null | Out-Null
        Start-Sleep -Seconds 2
        $svc = Get-Service -Name $Global:PG_SERVICE_NAME -ErrorAction SilentlyContinue
    }

    if ($svc) {
        # Ensure auto-start, then start and let it open the socket before any fallback.
        try { Set-Service -Name $Global:PG_SERVICE_NAME -StartupType Automatic -ErrorAction SilentlyContinue } catch {}
        if ($svc.Status -ne "Running") {
            try { Start-Service -Name $Global:PG_SERVICE_NAME -ErrorAction Stop } catch { Write-PgLog "Start-Service failed: $($_.Exception.Message)" "Warning" }
        }
        for ($i = 0; $i -lt 8; $i++) {
            if (Test-PgPortOpen) { $svcUp = $true; break }
            Start-Sleep -Seconds 1
        }
    }
    # Fallback ONLY when no service brought the port up (non-admin / register failed;
    # pg_ctl refuses if a postmaster is already running, and postgres.exe won't run elevated).
    if (-not $svcUp -and -not (Test-PgPortOpen)) {
        Write-PgLog "Service did not open the port; starting via pg_ctl ..." "Info"
        & $pgctl start -D $Global:PG_DATA_DIR -l (Join-Path $Global:PG_LOG_DIR "server.log") -w -t 30 | Out-Null
    }
}

function New-PgAppDatabases {
    # Create each canonical app DB if absent. Idempotent.
    param([string]$BinDir, [string]$Password)
    Write-PgLog "Ensuring per-app databases..." "Info"
    foreach ($db in $Global:PG_APP_DATABASES) {
        $exists = Invoke-Psql -BinDir $BinDir -Password $Password -Sql "SELECT 1 FROM pg_database WHERE datname='$db'"
        if ("$exists".Trim() -eq "1") {
            Write-PgLog "  database $db : exists (idempotent)" "Success"
        } else {
            Invoke-Psql -BinDir $BinDir -Password $Password -Sql "CREATE DATABASE `"$db`"" | Out-Null
            Write-PgLog "  database $db : created" "Info"
        }
    }
}

function Set-PgSuperuserPassword {
    # Re-assert the superuser password so the store and role stay in sync. Idempotent.
    param([string]$BinDir, [string]$Password)
    Invoke-Psql -BinDir $BinDir -Password $Password -Sql "ALTER USER $($Global:PG_USER) WITH PASSWORD '$Password'" | Out-Null
}

# =============================================================================
# UPGRADE (idempotent: minor = new binaries + service repair, major = pg_upgrade)
# =============================================================================
function Get-PgAsideName {
    # A free sibling name for a directory moved aside (never deleted): <leaf>.<suffix>-<timestamp>.
    param([string]$Path, [string]$Suffix)
    return ("{0}.{1}-{2}" -f (Split-Path $Path -Leaf), $Suffix, (Get-Date -Format "yyyyMMddHHmmss"))
}

function Stop-PgCluster {
    # Stop the native cluster (service, else pg_ctl) so its data dir can be upgraded. Idempotent.
    param([string]$BinDir)
    $service = Get-Service -Name $Global:PG_SERVICE_NAME -ErrorAction SilentlyContinue
    $pidFile = Join-Path $Global:PG_DATA_DIR "postmaster.pid"
    if ($service -and $service.Status -ne "Stopped") {
        try { Stop-Service -Name $Global:PG_SERVICE_NAME -Force -ErrorAction Stop } catch { Write-PgLog "Stop-Service failed: $($_.Exception.Message)" "Warning" }
    }
    if (Test-Path $pidFile) {
        & (Join-Path $BinDir "pg_ctl.exe") stop -D $Global:PG_DATA_DIR -m fast -w -t 60 2>$null | Out-Null
    }
    return (-not (Test-Path $pidFile))
}

function Complete-PgUpgradeSwap {
    # Swap a completed staged cluster (marker written only after pg_upgrade succeeded) into the data
    # dir: the old cluster is stopped and moved aside as data.pg<old>-<timestamp>. Also resumes a
    # swap that a previous run did not finish.
    $oldMajor = ""
    $oldBin = $null
    if ((Get-PgDataMajor -DataDir $Global:PG_UPGRADE_STAGE_DIR) -ne $Global:PG_MAJOR) { return }
    if (-not (Test-Path (Join-Path $Global:PG_UPGRADE_STAGE_DIR $Global:PG_UPGRADE_DONE_MARKER))) { return }
    if (Test-Path $Global:PG_DATA_DIR) {
        $oldMajor = Get-PgDataMajor
        if ($oldMajor -eq $Global:PG_MAJOR) { return }
        $oldBin = Find-PgBinDirForMajor -Major $oldMajor
        if ($oldBin -and -not (Stop-PgCluster -BinDir $oldBin)) { Write-PgLog "The PostgreSQL $oldMajor cluster did not stop; upgrade swap postponed." "Error"; return }
        Rename-Item -Path $Global:PG_DATA_DIR -NewName (Get-PgAsideName -Path $Global:PG_DATA_DIR -Suffix "pg$oldMajor")
    }
    Rename-Item -Path $Global:PG_UPGRADE_STAGE_DIR -NewName (Split-Path $Global:PG_DATA_DIR -Leaf)
    $Global:PG_UPGRADED = $true
    Write-PgLog "Upgrade swap complete: $Global:PG_DATA_DIR is PostgreSQL $Global:PG_MAJOR." "Success"
}

function Invoke-PgMajorUpgrade {
    # pg_upgrade in copy mode (the old cluster stays intact) from the data dir's major to PG_MAJOR.
    # The old cluster is kept as data.pg<old>-<timestamp>; a failed attempt's staging dir is moved aside.
    param([string]$Password, [string]$DataMajor)
    $oldBin = Find-PgBinDirForMajor -Major $DataMajor
    $newBin = $Global:PG_BIN_DIR
    $previousVersion = ""
    $previousPassword = $env:PGPASSWORD
    $exitCode = 1

    if (-not $oldBin) {
        if ($Global:PG_PREVIOUS_MAJORS.PSObject.Properties[$DataMajor]) { $previousVersion = [string]$Global:PG_PREVIOUS_MAJORS.$DataMajor }
        if (-not $previousVersion) {
            Write-PgLog "No PostgreSQL $DataMajor binaries for pg_upgrade; add $DataMajor to versions.postgresql_previous_majors." "Error"
            return $false
        }
        if (-not (Install-PgBinaries -Version $previousVersion)) { return $false }
        $oldBin = Find-PgBinDirForMajor -Major $DataMajor
    }
    if (-not $oldBin) { Write-PgLog "PostgreSQL $DataMajor binaries not resolved for pg_upgrade." "Error"; return $false }

    Write-PgLog "Upgrading cluster PostgreSQL $DataMajor -> $Global:PG_VERSION (pg_upgrade copy mode, old data kept)..." "Info"
    if (-not (Stop-PgCluster -BinDir $oldBin)) { Write-PgLog "The PostgreSQL $DataMajor cluster did not stop." "Error"; return $false }
    if (Test-Path $Global:PG_UPGRADE_STAGE_DIR) {
        Rename-Item -Path $Global:PG_UPGRADE_STAGE_DIR -NewName (Get-PgAsideName -Path $Global:PG_UPGRADE_STAGE_DIR -Suffix "failed")
    }
    if (-not (Initialize-PgCluster -BinDir $newBin -Password $Password -DataDir $Global:PG_UPGRADE_STAGE_DIR)) {
        Write-PgLog "initdb of the upgrade target failed: $Global:PG_UPGRADE_STAGE_DIR" "Error"
        return $false
    }
    if (-not (Test-Path $Global:PG_UPGRADE_WORK_DIR)) { New-Item -ItemType Directory -Path $Global:PG_UPGRADE_WORK_DIR -Force | Out-Null }
    Push-Location $Global:PG_UPGRADE_WORK_DIR
    $env:PGPASSWORD = $Password
    try {
        & (Join-Path $newBin "pg_upgrade.exe") --old-bindir=$oldBin --new-bindir=$newBin --old-datadir=$Global:PG_DATA_DIR `
            --new-datadir=$Global:PG_UPGRADE_STAGE_DIR --username=$Global:PG_USER --old-port=$Global:PG_UPGRADE_PORT --new-port=$Global:PG_UPGRADE_PORT
        $exitCode = $LASTEXITCODE
    } finally {
        $env:PGPASSWORD = $previousPassword
        Pop-Location
    }
    if ($exitCode -ne 0) {
        Write-PgLog "pg_upgrade failed (exit $exitCode); the PostgreSQL $DataMajor cluster is unchanged. Logs: $Global:PG_UPGRADE_WORK_DIR, $Global:PG_UPGRADE_STAGE_DIR\pg_upgrade_output.d" "Error"
        Rename-Item -Path $Global:PG_UPGRADE_STAGE_DIR -NewName (Get-PgAsideName -Path $Global:PG_UPGRADE_STAGE_DIR -Suffix "failed")
        if (Get-Service -Name $Global:PG_SERVICE_NAME -ErrorAction SilentlyContinue) { Start-Service -Name $Global:PG_SERVICE_NAME -ErrorAction SilentlyContinue }
        return $false
    }
    [System.IO.File]::WriteAllText((Join-Path $Global:PG_UPGRADE_STAGE_DIR $Global:PG_UPGRADE_DONE_MARKER), $DataMajor)
    Complete-PgUpgradeSwap
    return $Global:PG_UPGRADED
}

function Invoke-PgUpgradeIfNeeded {
    # Converge the native cluster to PG_MAJOR before it starts. No-op when it already matches or is
    # not initialized; a newer cluster (downgrade) is refused.
    param([string]$Password)
    $dataMajor = ""
    Complete-PgUpgradeSwap
    $dataMajor = Get-PgDataMajor
    if (-not $dataMajor -or $dataMajor -eq $Global:PG_MAJOR) { return $true }
    if ([int]$dataMajor -gt [int]$Global:PG_MAJOR) {
        Write-PgLog "Cluster $Global:PG_DATA_DIR is PostgreSQL $dataMajor, newer than versions.postgresql $Global:PG_VERSION; downgrade is not supported." "Error"
        return $false
    }
    return (Invoke-PgMajorUpgrade -Password $Password -DataMajor $dataMajor)
}

function Test-PgNativeOutdated {
    # True when our cluster needs the native path: its data dir is another major, or our service runs
    # other binaries than PG_BIN_DIR (minor upgrade; Register-PgService re-points it).
    $svcKey = Join-Path "HKLM:\SYSTEM\CurrentControlSet\Services" $Global:PG_SERVICE_NAME
    $imagePath = ""
    $dataMajor = Get-PgDataMajor
    if ($dataMajor -and $dataMajor -ne $Global:PG_MAJOR) { return $true }
    if (-not (Get-Service -Name $Global:PG_SERVICE_NAME -ErrorAction SilentlyContinue)) { return $false }
    try { $imagePath = (Get-ItemProperty -Path $svcKey -Name ImagePath -ErrorAction Stop).ImagePath } catch { return $false }
    return ($imagePath -notlike "*$($Global:PG_BIN_DIR)*")
}

function Invoke-PgPostUpgradeAnalyze {
    # pg_upgrade does not carry planner statistics; rebuild them once after an upgrade.
    param([string]$BinDir, [string]$Password)
    $previousPassword = $env:PGPASSWORD
    if (-not $Global:PG_UPGRADED) { return }
    $env:PGPASSWORD = $Password
    try {
        & (Join-Path $BinDir "vacuumdb.exe") -h $Global:PG_HOST -p $Global:PG_PORT -U $Global:PG_USER --all --analyze-in-stages 2>$null | Out-Null
    } finally {
        $env:PGPASSWORD = $previousPassword
    }
    Write-PgLog "Planner statistics rebuilt after the upgrade (vacuumdb --analyze-in-stages)." "Success"
}

# =============================================================================
# ORCHESTRATOR (idempotent + :5432 reuse)
# =============================================================================
function Ensure-Postgresql {
    # Returns $true when a PostgreSQL server is serving on 127.0.0.1:5432 with the
    # app databases present. Reuses an already-serving server (e.g. WSL) instead of
    # starting a second one.
    $password = Get-PgPassword

    # 1. Reuse path: something is already serving 5432 (our own outdated cluster takes the native path).
    if ((Test-PgPortOpen) -and -not (Test-PgNativeOutdated)) {
        Write-PgLog "Port $($Global:PG_PORT) already serving -> reusing existing server (no 2nd cluster)." "Success"
        $binDir = Resolve-PgBinDir
        if (-not $binDir) {
            Write-PgLog "No local psql to verify the existing server; assuming reachable (PHP pdo_pgsql will connect)." "Warning"
            return $true
        }
        if (Test-PgAuth -BinDir $binDir -Password $password) {
            New-PgAppDatabases -BinDir $binDir -Password $password
            return $true
        }
        Write-PgLog "Existing server on $($Global:PG_PORT) rejects the stored password; set its postgres password to match the shared store." "Error"
        return $false
    }

    # 2. Native bring-up: install -> upgrade -> init -> configure -> service -> dbs.
    Write-PgLog "Bringing up native Windows PostgreSQL $Global:PG_VERSION." "Info"
    if (-not (Install-PgBinaries)) { return $false }
    if (-not (Invoke-PgUpgradeIfNeeded -Password $password)) { return $false }
    $binDir = $Global:PG_BIN_DIR

    if (-not (Initialize-PgCluster -BinDir $binDir -Password $password)) {
        Write-PgLog "Cluster initialization failed." "Error"; return $false
    }
    Set-PgConfig
    Register-PgService -BinDir $binDir

    $ready = $false
    for ($i = 0; $i -lt 15; $i++) {
        if (Test-PgPortOpen) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { Write-PgLog "PostgreSQL did not become ready on $($Global:PG_PORT)." "Error"; return $false }

    Set-PgSuperuserPassword -BinDir $binDir -Password $password
    New-PgAppDatabases -BinDir $binDir -Password $password
    Invoke-PgPostUpgradeAnalyze -BinDir $binDir -Password $password
    Write-PgLog "Native PostgreSQL ready on $($Global:PG_HOST):$($Global:PG_PORT)." "Success"
    return $true
}
