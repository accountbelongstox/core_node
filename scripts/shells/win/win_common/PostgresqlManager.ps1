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

<#
.SYNOPSIS
    Shared native-Windows PostgreSQL manager. Dot-sourced by both
    Step_InstallPostgreSQL.ps1 (DevInstaller) and poly_apps/laravel_main/scripts/
    start.ps1 so they never drift.

    Mirrors the Linux canonical installer 47_install_postgresql.sh:
      - binaries under D:\.dev_<sys>\PG, data dir at map_web_path "postgresql"\data
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
$Global:PG_VERSION       = "16.4"   # native binaries package version (bump to upgrade)
$Global:PG_WEB_BASE      = "D:\www" # matches PathMapper.php Windows base ($basePath)

# Tooling root D:\.dev_<sys>: reuse GlobalVars' constant when available (DevInstaller
# context), else self-detect by build number (start.ps1 context, no GlobalVars).
if ($Global:LANG_COMPILER_DIR) {
    $Global:PG_TOOL_ROOT = $Global:LANG_COMPILER_DIR
} elseif ([int]([System.Environment]::OSVersion.Version.Build) -ge 22000) {
    $Global:PG_TOOL_ROOT = "D:\.dev_win11"
} else {
    $Global:PG_TOOL_ROOT = "D:\.dev_win10"
}

$Global:PG_INSTALL_DIR   = Join-Path $Global:PG_TOOL_ROOT "PG"            # binaries root
$Global:PG_BIN_DIR       = Join-Path $Global:PG_INSTALL_DIR "bin"
$Global:PG_DATA_ROOT     = Join-Path $Global:PG_WEB_BASE "wwwroot\postgresql"  # map_web_path "postgresql"
$Global:PG_DATA_DIR      = Join-Path $Global:PG_DATA_ROOT "data"
$Global:PG_LOG_DIR       = Join-Path $Global:PG_DATA_ROOT "logs"
$Global:PG_LARAVEL_DB    = Join-Path $Global:PG_WEB_BASE "wwwroot\laravel_db"
$Global:PG_SECRET_MIRROR = Join-Path $Global:PG_LARAVEL_DB ".core_node_secrets\POSTGRES_PASSWORD"
$Global:PG_BINARIES_URL  = "https://get.enterprisedb.com/postgresql/postgresql-$($Global:PG_VERSION)-1-windows-x64-binaries.zip"
# Persistent download cache (kept across runs; a valid archive is reused, never re-downloaded).
if ($Global:USER_CACHE_DIR) {
    $Global:PG_CACHE_DIR = Join-Path $Global:USER_CACHE_DIR "downloads"
} else {
    $Global:PG_CACHE_DIR = Join-Path $env:LOCALAPPDATA "core_node\.cache\downloads"
}
$Global:PG_CACHE_ZIP     = Join-Path $Global:PG_CACHE_DIR "postgresql-$($Global:PG_VERSION)-windows-x64-binaries.zip"

# Canonical per-app database union (config/database.php polyConnection() names +
# core_node_main + legacy). MUST match 47_install_postgresql.sh / start.sh.
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
    # password. Pin it to <data-drive>\var\_core_node and EXPORT so php/artisan
    # children read the same store. Idempotent.
    if (-not $env:CORE_NODE_DATA_DIR) {
        $driveRoot = [System.IO.Path]::GetPathRoot($Global:PG_DATA_ROOT)
        $env:CORE_NODE_DATA_DIR = Join-Path $driveRoot "var\_core_node"
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
    # Prefer our native install, then any EDB install, then PATH.
    if (Test-Path (Join-Path $Global:PG_BIN_DIR "pg_ctl.exe")) { return $Global:PG_BIN_DIR }
    $edb = Get-ChildItem -Path "$env:ProgramFiles\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | Select-Object -First 1
    if ($edb -and (Test-Path (Join-Path $edb.FullName "bin\pg_ctl.exe"))) { return (Join-Path $edb.FullName "bin") }
    $cmd = Get-Command pg_ctl.exe -ErrorAction SilentlyContinue
    if ($cmd) { return (Split-Path $cmd.Source -Parent) }
    return $null
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
    param([string]$Url, [string]$Destination)
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
                    Write-Progress -Activity "Downloading PostgreSQL $($Global:PG_VERSION)" -Status "$pct%" -PercentComplete $pct
                    $lastPct = $pct
                }
            } else {
                Write-Progress -Activity "Downloading PostgreSQL $($Global:PG_VERSION)" -Status "Downloading..." -PercentComplete -1
            }
        }
        Write-Progress -Activity "Downloading PostgreSQL $($Global:PG_VERSION)" -Completed
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
    # Resolve/install the PostgreSQL Windows binaries. Idempotent + cached: a valid
    # archive in PG_CACHE_DIR is reused (never re-downloaded), and the cache is kept.
    if (Test-Path (Join-Path $Global:PG_BIN_DIR "pg_ctl.exe")) {
        Write-PgLog "Binaries already present: $Global:PG_BIN_DIR (idempotent)" "Success"
        return $true
    }
    if (-not (Test-Path $Global:PG_CACHE_DIR)) { New-Item -ItemType Directory -Path $Global:PG_CACHE_DIR -Force | Out-Null }

    if (Test-PgZipValid $Global:PG_CACHE_ZIP) {
        Write-PgLog "Reusing cached binaries archive: $Global:PG_CACHE_ZIP" "Success"
    } else {
        Write-PgLog "Downloading PostgreSQL $Global:PG_VERSION binaries (cached for reuse)..." "Info"
        $downloaded = $false
        # Prefer the shared progress+size-cache helper when it is available.
        if (Get-Command Get-FileWithSizeCheck -ErrorAction SilentlyContinue) {
            Get-FileWithSizeCheck -localPath $Global:PG_CACHE_ZIP -remoteUrl $Global:PG_BINARIES_URL -description "PostgreSQL $($Global:PG_VERSION) binaries" | Out-Null
            $downloaded = (Test-PgZipValid $Global:PG_CACHE_ZIP)
        }
        if (-not $downloaded) {
            $downloaded = (Invoke-PgWebDownload -Url $Global:PG_BINARIES_URL -Destination $Global:PG_CACHE_ZIP) -and (Test-PgZipValid $Global:PG_CACHE_ZIP)
        }
        if (-not $downloaded) {
            Write-PgLog "Binaries download failed or archive invalid. Source: $Global:PG_BINARIES_URL" "Error"
            if (Test-Path $Global:PG_CACHE_ZIP) { Remove-Item $Global:PG_CACHE_ZIP -Force -ErrorAction SilentlyContinue }
            return $false
        }
    }

    # Extract from the cached archive (kept for next time).
    $extractDir = Join-Path $env:TEMP "pg_extract_$($Global:PG_VERSION)"
    try {
        if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
        Expand-Archive -Path $Global:PG_CACHE_ZIP -DestinationPath $extractDir -Force
        # The archive contains a top-level "pgsql" folder; move its contents into PG_INSTALL_DIR.
        $inner = Join-Path $extractDir "pgsql"
        $source = if (Test-Path $inner) { $inner } else { $extractDir }
        if (-not (Test-Path $Global:PG_INSTALL_DIR)) { New-Item -ItemType Directory -Path $Global:PG_INSTALL_DIR -Force | Out-Null }
        Copy-Item -Path (Join-Path $source "*") -Destination $Global:PG_INSTALL_DIR -Recurse -Force
        Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path (Join-Path $Global:PG_BIN_DIR "pg_ctl.exe")) {
            Write-PgLog "Binaries installed: $Global:PG_INSTALL_DIR (cache kept: $Global:PG_CACHE_ZIP)" "Success"
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
    param([string]$BinDir, [string]$Password)
    if (Test-Path (Join-Path $Global:PG_DATA_DIR "PG_VERSION")) {
        Write-PgLog "Data dir already initialized: $Global:PG_DATA_DIR (idempotent)" "Success"
        return $true
    }
    Write-PgLog "Initializing cluster at $Global:PG_DATA_DIR ..." "Info"
    if (-not (Test-Path $Global:PG_DATA_ROOT)) { New-Item -ItemType Directory -Path $Global:PG_DATA_ROOT -Force | Out-Null }
    if (-not (Test-Path $Global:PG_LOG_DIR)) { New-Item -ItemType Directory -Path $Global:PG_LOG_DIR -Force | Out-Null }
    $pwFile = Join-Path $env:TEMP "pg_initpw.txt"
    [System.IO.File]::WriteAllText($pwFile, $Password)
    try {
        $initdb = Join-Path $BinDir "initdb.exe"
        & $initdb --pgdata=$Global:PG_DATA_DIR --username=$Global:PG_USER --pwfile=$pwFile --encoding=UTF8 --auth=scram-sha-256 --auth-host=scram-sha-256 | Out-Null
        return (Test-Path (Join-Path $Global:PG_DATA_DIR "PG_VERSION"))
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
# ORCHESTRATOR (idempotent + :5432 reuse)
# =============================================================================
function Ensure-Postgresql {
    # Returns $true when a PostgreSQL server is serving on 127.0.0.1:5432 with the
    # app databases present. Reuses an already-serving server (e.g. WSL) instead of
    # starting a second one.
    $password = Get-PgPassword

    # 1. Reuse path: something is already serving 5432.
    if (Test-PgPortOpen) {
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

    # 2. Native bring-up: install -> init -> configure -> service -> dbs.
    Write-PgLog "Port $($Global:PG_PORT) free -> bringing up native Windows PostgreSQL." "Info"
    if (-not (Install-PgBinaries)) { return $false }
    $binDir = Resolve-PgBinDir
    if (-not $binDir) { Write-PgLog "No PostgreSQL binaries resolved." "Error"; return $false }

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
    Write-PgLog "Native PostgreSQL ready on $($Global:PG_HOST):$($Global:PG_PORT)." "Success"
    return $true
}
