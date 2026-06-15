#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Idempotent MySQL 8.0 install for webclaude-go-gateway on Windows.
    Every step uses filesystem / TCP / service-state checks — never exit codes.

.DESCRIPTION
    Official procedure: https://dev.mysql.com/doc/refman/8.0/en/windows-install-archive.html

.EXAMPLE
    .\install-mysql.ps1
    .\install-mysql.ps1 -SkipSchema
#>

param(
    [string]$RepoRoot = "",
    [switch]$SkipSchema = $false
)

# Do NOT set $ErrorActionPreference = "Stop" globally.
# Native exe stderr (mysql warnings) would kill the script.
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $RepoRoot) { $RepoRoot = $env:WEBCLAUDE_SERVICE_ROOT }
if (-not $RepoRoot -or -not (Test-Path -LiteralPath $RepoRoot)) {
    Write-Host "  [FAIL] Pass -RepoRoot <service-repo> or set WEBCLAUDE_SERVICE_ROOT (directory with .env / .env.example)." -ForegroundColor Red
    exit 1
}
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$MigrationsDir = Join-Path $RepoRoot "scripts\migrations"

# ═══════════════════════════════════════════════════════════════════════════════
# Constants - fixed install root (D:\.dev_win10\mysql, same convention on Win10/11)
# ═══════════════════════════════════════════════════════════════════════════════
$MYSQL_VERSION = "8.0.45"
$DEV_WIN_ROOT  = "D:\.dev_win10"
$INSTALL_DIR   = Join-Path $DEV_WIN_ROOT "mysql"
$DATA_DIR      = Join-Path $INSTALL_DIR "data"
$LOGS_DIR      = Join-Path $INSTALL_DIR "logs"
$SERVICE_NAME  = "MySQL"
$PASSWORD_FILE = Join-Path $INSTALL_DIR ".root_password"
$MYSQL_BIN     = Join-Path $INSTALL_DIR "bin"
$MYSQLD_EXE    = Join-Path $MYSQL_BIN "mysqld.exe"
$MYSQL_EXE     = Join-Path $MYSQL_BIN "mysql.exe"
$MY_INI        = Join-Path $INSTALL_DIR "my.ini"
$DOWNLOAD_URL  = "https://cdn.mysql.com/Downloads/MySQL-8.0/mysql-${MYSQL_VERSION}-winx64.zip"

$EnvFile = Join-Path $RepoRoot ".env"
if (-not (Test-Path $EnvFile)) { $EnvFile = Join-Path $RepoRoot ".env.example" }

$DB_HOST = "127.0.0.1"; $DB_PORT = 3306
$DB_USER = "crs"; $DB_PASSWORD = "crs_pass"; $DB_NAME = "claude_relay"

if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $eq = $line.IndexOf("=")
            if ($eq -gt 0) {
                $k = $line.Substring(0, $eq).Trim(); $v = $line.Substring($eq + 1).Trim()
                switch ($k) {
                    "DB_HOST"     { $script:DB_HOST = $v }
                    "DB_PORT"     { $script:DB_PORT = [int]$v }
                    "DB_USER"     { $script:DB_USER = $v }
                    "DB_PASSWORD" { $script:DB_PASSWORD = $v }
                    "DB_NAME"     { $script:DB_NAME = $v }
                }
            }
        }
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Helpers  (no exit-code checks — only state probes)
# ═══════════════════════════════════════════════════════════════════════════════
function Write-Header([string]$t) {
    Write-Host "`n$("=" * 60)" -ForegroundColor Cyan
    Write-Host "  $t" -ForegroundColor Cyan
    Write-Host "$("=" * 60)" -ForegroundColor Cyan
}
function Write-Ok([string]$t)   { Write-Host "  [OK]   $t" -ForegroundColor Green }
function Write-Info([string]$t)  { Write-Host "  [INFO] $t" -ForegroundColor Yellow }
function Write-Warn([string]$t)  { Write-Host "  [WARN] $t" -ForegroundColor DarkYellow }
function Write-Fail([string]$t)  { Write-Host "  [FAIL] $t" -ForegroundColor Red }
function Write-Skip([string]$t)  { Write-Host "  [SKIP] $t" -ForegroundColor DarkGray }

function Write-NoBOM([string]$path, [string]$content) {
    [System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding $false))
}

function Test-TCP([string]$h, [int]$p, [int]$ms = 2000) {
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $r = $c.BeginConnect($h, $p, $null, $null)
        $ok = $r.AsyncWaitHandle.WaitOne($ms, $false)
        $c.Close(); return $ok
    } catch { return $false }
}

function New-RandomPassword([int]$len = 20) {
    $chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] $len; $rng.GetBytes($bytes); $rng.Dispose()
    return -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

function Get-RootPassword {
    if (Test-Path $PASSWORD_FILE) { return (Get-Content $PASSWORD_FILE -Raw).Trim() }
    return ""
}

function Test-MySQLQuery([string]$user, [string]$pass, [string]$sql, [string]$db = "") {
    if (-not (Test-Path $MYSQL_EXE)) { return $false }
    # Use "localhost" so MySQL connects via socket/named-pipe, matching 'root'@'localhost'
    $a = @("-u", $user, "--password=$pass", "-h", "localhost", "-P", $DB_PORT, "--default-character-set=utf8mb4", "-e", $sql)
    if ($db) { $a += @("-D", $db) }
    $out = & $MYSQL_EXE @a 2>&1 | Out-String
    return ($out -notmatch "^ERROR")
}

function Invoke-MySQLSilent([string]$user, [string]$pass, [string]$sql, [string]$db = "", [switch]$expired) {
    # Use "localhost" for the same reason as Test-MySQLQuery
    $a = @("-u", $user, "--password=$pass", "-h", "localhost", "-P", $DB_PORT, "--default-character-set=utf8mb4")
    if ($expired) { $a += "--connect-expired-password" }
    $a += @("-e", $sql)
    if ($db) { $a += @("-D", $db) }
    & $MYSQL_EXE @a 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
}

function Get-MySQLServiceImagePath {
    $w = Get-WmiObject Win32_Service -Filter "Name='$SERVICE_NAME'" -ErrorAction SilentlyContinue
    if (-not $w) { return "" }
    $p = $w.PathName.Trim()
    if ($p.Length -ge 2 -and $p[0] -eq [char]34) {
        $end = $p.IndexOf([char]34, 1)
        if ($end -gt 1) { return $p.Substring(1, $end - 1) }
    }
    $ix = $p.IndexOf(".exe", [System.StringComparison]::OrdinalIgnoreCase)
    if ($ix -ge 0) { return $p.Substring(0, $ix + 4).Trim() }
    return $p
}

function Test-MySQLServiceBinaryOk {
    $img = Get-MySQLServiceImagePath
    if ($img -eq "") { return $false }
    return ([System.IO.Path]::GetFullPath($img) -ieq [System.IO.Path]::GetFullPath($MYSQLD_EXE))
}

function Request-MySQLServiceMatchesInstallDir {
    $svc = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    if (-not $svc) { return $true }

    $img = Get-MySQLServiceImagePath
    if ($img -eq "") { return $true }

    $want = [System.IO.Path]::GetFullPath($MYSQLD_EXE)
    $have = [System.IO.Path]::GetFullPath($img)
    if ($have -ieq $want) { return $true }

    Write-Host ""
    Write-Warn "Windows service '$SERVICE_NAME' is not using the fixed install path."
    Write-Warn "  Service mysqld.exe: $have"
    Write-Warn "  Expected:           $want"
    $yn = Read-Host "Stop/remove this service and data under its folder, then install under ${INSTALL_DIR}? [Y/n]"
    if ($yn -ne "" -and $yn -notmatch "^[Yy]") {
        Write-Fail "Stopped. Remove the service manually or run again and choose Y."
        return $false
    }

    if ($svc.Status -eq "Running") {
        Write-Info "Stopping service '$SERVICE_NAME' ..."
        Stop-Service -Name $SERVICE_NAME -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }

    Write-Info "Removing Windows service (using its current mysqld.exe) ..."
    & $have --remove $SERVICE_NAME 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    Start-Sleep -Seconds 2

    $wrongRoot = [System.IO.Path]::GetFullPath((Split-Path (Split-Path $have)))
    $expRoot = [System.IO.Path]::GetFullPath($INSTALL_DIR)
    if ($wrongRoot -ine $expRoot -and (Test-Path $wrongRoot)) {
        Write-Info "Removing old install tree: $wrongRoot"
        Remove-Item -LiteralPath $wrongRoot -Recurse -Force -ErrorAction SilentlyContinue
    }

    Write-Info "Waiting for port ${DB_PORT} to free after service removal ..."
    $w = 0
    while ((Test-TCP $DB_HOST $DB_PORT) -and $w -lt 30) {
        Start-Sleep -Seconds 1
        $w++
    }

    Write-Ok "Old MySQL service removed. Continuing with fixed path install."
    return $true
}

function Request-RemoveWrongMysqlLocation {
    $repoMysql = Join-Path $RepoRoot "mysql"
    $legacyExe = Join-Path $repoMysql "bin\mysqld.exe"
    if (-not (Test-Path $legacyExe)) { return $true }

    $want = [System.IO.Path]::GetFullPath($INSTALL_DIR)
    $have = [System.IO.Path]::GetFullPath($repoMysql)
    if ($have -ieq $want) { return $true }

    Write-Host ""
    Write-Warn "MySQL is present under the repo, not the fixed install path:"
    Write-Warn "  Found: $repoMysql"
    Write-Warn "  Expected: $INSTALL_DIR"
    $yn = Read-Host "Stop/remove service if it uses this folder, delete this folder, then install under the fixed path? [Y/n]"
    if ($yn -ne "" -and $yn -notmatch "^[Yy]") {
        Write-Fail "Stopped. Remove or rename the folder above, then run this script again."
        return $false
    }

    $svc = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq "Running") {
        Write-Info "Stopping service '$SERVICE_NAME' ..."
        Stop-Service -Name $SERVICE_NAME -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }

    $img = Get-MySQLServiceImagePath
    if ($img -ne "" -and $img.StartsWith($have, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Info "Removing Windows service (binary was under repo path) ..."
        & $legacyExe --remove $SERVICE_NAME 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        Start-Sleep -Seconds 1
    }

    Write-Info "Removing: $repoMysql"
    Remove-Item -LiteralPath $repoMysql -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $repoMysql) {
        Write-Fail "Could not remove $repoMysql (files in use?). Close programs and run again."
        return $false
    }
    Write-Ok "Old repo copy removed"
    return $true
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 1 — Download & extract  (idempotent: skip if mysqld.exe exists)
# ═══════════════════════════════════════════════════════════════════════════════
function Install-Binary {
    Write-Header "Step 1: Download & Extract (official docs 2.3.4.1)"

    if (Test-Path $MYSQLD_EXE) {
        Write-Skip "mysqld.exe already exists at $MYSQLD_EXE"
        return
    }

    $tempDir = Join-Path $env:TEMP "mysql_install"
    $zipPath = Join-Path $tempDir "mysql-${MYSQL_VERSION}-winx64.zip"
    if (-not (Test-Path $tempDir)) { New-Item -ItemType Directory -Path $tempDir -Force | Out-Null }

    # Download if ZIP missing or too small (partial download)
    $needDownload = $true
    if ((Test-Path $zipPath) -and ((Get-Item $zipPath).Length -gt 200MB)) {
        $sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
        Write-Skip "ZIP already cached ($sizeMB MB): $zipPath"
        $needDownload = $false
    }

    if ($needDownload) {
        if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
        Write-Info "Downloading MySQL $MYSQL_VERSION ..."
        Write-Info "URL: $DOWNLOAD_URL"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        try {
            Invoke-WebRequest -Uri $DOWNLOAD_URL -OutFile $zipPath -UseBasicParsing -TimeoutSec 600
        } catch {
            try {
                $wc = New-Object System.Net.WebClient
                $wc.Headers.Add("User-Agent", "Mozilla/5.0")
                $wc.DownloadFile("https://dev.mysql.com/get/Downloads/MySQL-8.0/mysql-${MYSQL_VERSION}-winx64.zip", $zipPath)
                $wc.Dispose()
            } catch {
                Write-Fail "Download failed. Please download manually:"
                Write-Info "  https://dev.mysql.com/downloads/mysql/8.0.html"
                Write-Info "  Save to: $zipPath"
                return
            }
        }
        if (-not (Test-Path $zipPath) -or (Get-Item $zipPath).Length -lt 200MB) {
            Write-Fail "Download incomplete or corrupt"; return
        }
        $sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
        Write-Ok "Downloaded ($sizeMB MB)"
    }

    # Extract — skip if bin dir already populated
    Write-Info "Extracting to $INSTALL_DIR ..."
    if (-not (Test-Path $INSTALL_DIR)) { New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null }

    Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
    $extracted = Get-ChildItem -Path $tempDir -Directory | Where-Object { $_.Name -like "mysql-*" } | Select-Object -First 1
    if (-not $extracted) { Write-Fail "Extracted folder not found"; return }

    Get-ChildItem -Path $extracted.FullName | ForEach-Object {
        $dest = Join-Path $INSTALL_DIR $_.Name
        if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
        Move-Item $_.FullName $dest
    }
    Remove-Item $extracted.FullName -Recurse -Force -ErrorAction SilentlyContinue

    if (Test-Path $MYSQLD_EXE) {
        Write-Ok "Binaries installed to $INSTALL_DIR"
    } else {
        Write-Fail "mysqld.exe not found after extraction"
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 2 — Create my.ini  (idempotent: skip if file exists)
# ═══════════════════════════════════════════════════════════════════════════════
function New-OptionFile {
    Write-Header "Step 2: Create Option File my.ini (official docs 2.3.4.2)"

    if (Test-Path $MY_INI) {
        Write-Skip "my.ini already exists at $MY_INI"
        return
    }

    foreach ($d in @($DATA_DIR, $LOGS_DIR)) {
        if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
    }

    $bd = $INSTALL_DIR -replace '\\', '/'
    $dd = $DATA_DIR    -replace '\\', '/'
    $ld = $LOGS_DIR    -replace '\\', '/'

    $ini = @"
[mysqld]
basedir=$bd
datadir=$dd
port=$DB_PORT
bind-address=0.0.0.0
character-set-server=utf8mb4
collation-server=utf8mb4_0900_ai_ci
innodb_buffer_pool_size=256M
innodb_redo_log_capacity=128M
innodb_flush_log_at_trx_commit=2
max_connections=200
max_allowed_packet=64M
log-error=$ld/error.log
sql_mode=STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
default_authentication_plugin=mysql_native_password
# Windows: enable named pipe so 'localhost' connects via pipe, not TCP
enable-named-pipe=ON

[client]
port=$DB_PORT
default-character-set=utf8mb4

[mysql]
default-character-set=utf8mb4
"@

    Write-NoBOM $MY_INI $ini
    Write-Ok "my.ini created at $MY_INI"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 3 — Initialize data dir  (idempotent: skip if data\mysql exists)
# ═══════════════════════════════════════════════════════════════════════════════
function Initialize-DataDir {
    Write-Header "Step 3: Initialize Data Directory (official docs 2.9.1)"

    $mysqlSystemDir = Join-Path $DATA_DIR "mysql"
    if (Test-Path $mysqlSystemDir) {
        Write-Skip "Data directory already initialized ($mysqlSystemDir exists)"
        return
    }

    if (-not (Test-Path $MYSQLD_EXE)) { Write-Fail "mysqld.exe not found"; return }
    if (-not (Test-Path $DATA_DIR)) { New-Item -ItemType Directory -Path $DATA_DIR -Force | Out-Null }

    # Use --initialize-insecure: root starts with empty password.
    # We set a real password in Step 6 for all hosts (localhost, 127.0.0.1, %).
    # This avoids the temp-password + --connect-expired-password dance that
    # breaks on Windows where 'localhost' resolves to '127.0.0.1' via TCP.
    Write-Info "Running: mysqld --initialize-insecure --console"
    $output = & $MYSQLD_EXE --defaults-file="$MY_INI" --initialize-insecure --console 2>&1
    $output | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }

    if (-not (Test-Path $mysqlSystemDir)) {
        Write-Fail "Data directory was not created. Check: $(Join-Path $LOGS_DIR 'error.log')"
        return
    }
    Write-Ok "Data directory initialized (root has empty password, will secure in Step 6)"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 4 — Install Windows service  (idempotent: skip if service registered)
# ═══════════════════════════════════════════════════════════════════════════════
function Install-Service {
    Write-Header "Step 4: Install Windows Service (official docs 2.3.4.8)"

    $svc = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    if ($svc) {
        Write-Skip "Service '$SERVICE_NAME' already registered"
        return
    }

    if (-not (Test-Path $MYSQLD_EXE)) { Write-Fail "mysqld.exe not found"; return }

    Write-Info "Running: mysqld --install $SERVICE_NAME"
    & $MYSQLD_EXE --install $SERVICE_NAME --defaults-file="$MY_INI" 2>&1 | ForEach-Object {
        Write-Host "    $_" -ForegroundColor DarkGray
    }

    # Verify by checking service exists now
    $svc = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    if ($svc) {
        Write-Ok "Service '$SERVICE_NAME' installed"
    } else {
        Write-Fail "Service registration failed"
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 5 — Start service  (idempotent: skip if TCP port open)
# ═══════════════════════════════════════════════════════════════════════════════
function Start-MySQLService {
    Write-Header "Step 5: Start Service (official docs: net start MySQL)"

    if (Test-TCP $DB_HOST $DB_PORT) {
        Write-Skip "Port $DB_PORT already open"
        return
    }

    $svc = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    if (-not $svc) { Write-Fail "Service '$SERVICE_NAME' not found"; return }

    if ($svc.Status -ne "Running") {
        Write-Info "Starting service..."
        Start-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    }

    $maxWait = 30; $waited = 0
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 1; $waited++
        if (Test-TCP $DB_HOST $DB_PORT) { break }
    }

    if (Test-TCP $DB_HOST $DB_PORT) {
        Write-Ok "MySQL service started on port $DB_PORT"
    } else {
        Write-Fail "MySQL did not respond within $maxWait seconds"
        Write-Info "Check: $(Join-Path $LOGS_DIR 'error.log')"
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 6 — Secure root  (idempotent: skip if root password already works)
# ═══════════════════════════════════════════════════════════════════════════════
function Set-RootPassword {
    Write-Header "Step 6: Secure Root Account (official docs 2.9.4)"

    if (-not (Test-Path $MYSQL_EXE)) { Write-Fail "mysql.exe not found"; return }
    if (-not (Test-TCP $DB_HOST $DB_PORT)) { Write-Fail "MySQL not reachable"; return }

    # If password file exists and works, already secured
    $existingPw = Get-RootPassword
    if ($existingPw -and (Test-MySQLQuery "root" $existingPw "SELECT 1;")) {
        Write-Ok "Root password already set and working"
        return
    }

    # Try empty password (from --initialize-insecure)
    $canConnect = Test-MySQLQuery "root" "" "SELECT 1;"
    if (-not $canConnect) {
        Write-Fail "Cannot connect as root with empty or saved password"
        return
    }

    $newPw = New-RandomPassword
    Write-Info "Setting root password and granting access for all hosts..."

    # Set password for localhost, create root for 127.0.0.1 and %
    $setupSql = @"
ALTER USER 'root'@'localhost' IDENTIFIED BY '$newPw';
CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED BY '$newPw';
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY '$newPw';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
"@
    Invoke-MySQLSilent "root" "" $setupSql

    # Verify
    Start-Sleep -Seconds 1
    if (Test-MySQLQuery "root" $newPw "SELECT 1;") {
        Write-NoBOM $PASSWORD_FILE $newPw
        Write-Ok "Root password secured and saved to $PASSWORD_FILE"
        Write-Ok "Root can connect from localhost, 127.0.0.1, and any host"

        # Auto-update .env DB_PASSWORD if it exists and is empty or default
        $envPath = Join-Path $RepoRoot ".env"
        if (Test-Path $envPath) {
            $envContent = Get-Content $envPath -Raw
            if ($envContent -match "(?m)^DB_PASSWORD=\s*$" -or $envContent -match "(?m)^DB_PASSWORD=crs_pass\s*$") {
                $envContent = $envContent -replace "(?m)^DB_PASSWORD=.*$", "DB_PASSWORD=$newPw"
                Write-NoBOM $envPath $envContent
                Write-Ok "Updated DB_PASSWORD in .env"
            }
        }
    } else {
        Write-Fail "Password change did not take effect - manual fix required"
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 7 — Schema  (idempotent: all CREATE IF NOT EXISTS)
# ═══════════════════════════════════════════════════════════════════════════════
function Initialize-Schema {
    Write-Header "Step 7: Create Database & Schema"

    if (-not (Test-Path $MYSQL_EXE)) { Write-Fail "mysql.exe not found"; return }
    if (-not (Test-TCP $DB_HOST $DB_PORT)) { Write-Fail "MySQL not reachable"; return }

    $rootPw = Get-RootPassword
    if (-not $rootPw) { Write-Fail "Cannot read root password"; return }

    # Database
    Write-Info "Creating database '$DB_NAME' ..."
    Invoke-MySQLSilent "root" $rootPw "CREATE DATABASE IF NOT EXISTS ``$DB_NAME`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

    # User (% plus 127.0.0.1 and localhost so apps using DB_HOST=127.0.0.1 do not get Error 1130)
    Write-Info "Creating app user (%, 127.0.0.1, localhost) ..."
    Invoke-MySQLSilent "root" $rootPw "CREATE USER IF NOT EXISTS '$DB_USER'@'%' IDENTIFIED WITH mysql_native_password BY '$DB_PASSWORD';"
    Invoke-MySQLSilent "root" $rootPw "CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY '$DB_PASSWORD';"
    Invoke-MySQLSilent "root" $rootPw "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED WITH mysql_native_password BY '$DB_PASSWORD';"
    Invoke-MySQLSilent "root" $rootPw "GRANT ALL PRIVILEGES ON ``$DB_NAME``.* TO '$DB_USER'@'%'; GRANT ALL PRIVILEGES ON ``$DB_NAME``.* TO '$DB_USER'@'127.0.0.1'; GRANT ALL PRIVILEGES ON ``$DB_NAME``.* TO '$DB_USER'@'localhost'; FLUSH PRIVILEGES;"

    # Verify user can connect
    if (Test-MySQLQuery $DB_USER $DB_PASSWORD "SELECT 1;" $DB_NAME) {
        Write-Ok "User '$DB_USER' ready"
    } else {
        Write-Warn "User '$DB_USER' cannot connect yet - may need manual check"
    }

    # Tables (all IF NOT EXISTS)
    Write-Info "Creating tables (IF NOT EXISTS) ..."
    $schemaFile = Join-Path $ScriptDir "relay_schema_init.sql"
    $schemaSql = @'
CREATE TABLE IF NOT EXISTS api_keys (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  hashed_key VARCHAR(191) DEFAULT NULL,
  user_id VARCHAR(191) DEFAULT NULL,
  status VARCHAR(32) DEFAULT 'active',
  data JSON DEFAULT NULL,
  created_at DATETIME(6) DEFAULT NULL,
  updated_at DATETIME(6) DEFAULT NULL,
  KEY idx_api_keys_hashed_key (hashed_key),
  KEY idx_api_keys_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS provider_accounts (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  provider_type VARCHAR(32) NOT NULL DEFAULT 'claude',
  status VARCHAR(32) DEFAULT 'active',
  data JSON DEFAULT NULL,
  created_at DATETIME(6) DEFAULT NULL,
  updated_at DATETIME(6) DEFAULT NULL,
  KEY idx_provider_accounts_type (provider_type),
  KEY idx_provider_accounts_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS provider_account_groups (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  provider_type VARCHAR(32) NOT NULL DEFAULT 'claude',
  name VARCHAR(191) DEFAULT NULL,
  strategy VARCHAR(32) DEFAULT NULL,
  config JSON DEFAULT NULL,
  created_at DATETIME(6) DEFAULT NULL,
  updated_at DATETIME(6) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS provider_group_members (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  group_id VARCHAR(64) NOT NULL,
  provider_account_id VARCHAR(64) NOT NULL,
  created_at DATETIME(6) DEFAULT NULL,
  UNIQUE KEY uk_group_member (group_id, provider_account_id),
  KEY idx_pgm_group (group_id),
  KEY idx_pgm_account (provider_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(191) DEFAULT NULL,
  status VARCHAR(32) DEFAULT 'active',
  is_active TINYINT(1) DEFAULT 1,
  data JSON DEFAULT NULL,
  created_at DATETIME(6) DEFAULT NULL,
  updated_at DATETIME(6) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usage_events (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id VARCHAR(64) DEFAULT NULL,
  account_id VARCHAR(64) DEFAULT NULL,
  account_type VARCHAR(32) DEFAULT NULL,
  account_client_id VARCHAR(64) DEFAULT NULL,
  api_key_id VARCHAR(64) DEFAULT NULL,
  usage_scope VARCHAR(32) DEFAULT NULL,
  normalized_model VARCHAR(64) DEFAULT NULL,
  raw_model VARCHAR(128) DEFAULT NULL,
  input_tokens BIGINT DEFAULT 0,
  output_tokens BIGINT DEFAULT 0,
  cache_create_tokens BIGINT DEFAULT 0,
  cache_read_tokens BIGINT DEFAULT 0,
  all_tokens BIGINT DEFAULT 0,
  requests INT DEFAULT 1,
  real_cost DOUBLE DEFAULT 0,
  rated_cost DOUBLE DEFAULT 0,
  response_time_ms BIGINT DEFAULT NULL,
  is_long_context TINYINT(1) DEFAULT 0,
  pricing_snapshot_json JSON DEFAULT NULL,
  request_status VARCHAR(32) DEFAULT NULL,
  http_status_code INT DEFAULT NULL,
  error_code VARCHAR(64) DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  cancelled_by VARCHAR(32) DEFAULT NULL,
  created_at DATETIME(6) NOT NULL,
  KEY idx_usage_events_api_key (api_key_id, created_at),
  KEY idx_usage_events_account (account_id, created_at),
  KEY idx_usage_events_created (created_at),
  KEY idx_usage_events_request_id (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS claude_group_account_usage (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  api_key_id VARCHAR(64) NOT NULL,
  group_id VARCHAR(64) NOT NULL,
  account_id VARCHAR(64) NOT NULL,
  use_count BIGINT DEFAULT 1,
  last_used_at DATETIME(6) DEFAULT NULL,
  created_at DATETIME(6) DEFAULT NULL,
  updated_at DATETIME(6) DEFAULT NULL,
  UNIQUE KEY uk_claude_group_account (api_key_id, group_id, account_id),
  KEY idx_cgau_group (group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS relay_instances (
  instance_id VARCHAR(128) NOT NULL PRIMARY KEY,
  host VARCHAR(191) DEFAULT NULL,
  port INT DEFAULT NULL,
  version VARCHAR(64) DEFAULT NULL,
  started_at DATETIME(6) DEFAULT NULL,
  last_seen_at DATETIME(6) DEFAULT NULL,
  tags JSON DEFAULT NULL,
  disabled TINYINT(1) DEFAULT 0,
  created_at DATETIME(6) DEFAULT NULL,
  updated_at DATETIME(6) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS relay_dispatch_records (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(32) DEFAULT NULL,
  status VARCHAR(32) DEFAULT NULL,
  group_id VARCHAR(64) DEFAULT NULL,
  api_key_id VARCHAR(64) DEFAULT NULL,
  selected_account_id VARCHAR(64) DEFAULT NULL,
  selected_account_type VARCHAR(32) DEFAULT NULL,
  requested_model VARCHAR(128) DEFAULT NULL,
  decision_source VARCHAR(64) DEFAULT NULL,
  capable_count INT DEFAULT 0,
  unknown_count INT DEFAULT 0,
  incapable_count INT DEFAULT 0,
  total_remaining_requests INT DEFAULT 0,
  threshold_remaining_requests INT DEFAULT 0,
  alert_reason VARCHAR(191) DEFAULT NULL,
  detail_json JSON DEFAULT NULL,
  created_at DATETIME(6) DEFAULT NULL,
  updated_at DATETIME(6) DEFAULT NULL,
  KEY idx_rdr_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_settings (
  `key` VARCHAR(128) NOT NULL PRIMARY KEY,
  name VARCHAR(191) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  value_json JSON DEFAULT NULL,
  updated_at DATETIME(6) DEFAULT NULL,
  updated_by VARCHAR(128) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_key_soft_quota_period_usage (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(191) DEFAULT NULL,
  api_key_id VARCHAR(64) NOT NULL,
  cycle_type VARCHAR(32) NOT NULL,
  period_start DATETIME(6) NOT NULL,
  period_end DATETIME(6) DEFAULT NULL,
  used_amount DOUBLE DEFAULT 0,
  metadata_json JSON DEFAULT NULL,
  created_at DATETIME(6) DEFAULT NULL,
  updated_at DATETIME(6) DEFAULT NULL,
  UNIQUE KEY uk_quota_period (api_key_id, cycle_type, period_start),
  KEY idx_qpu_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quota_policy_alert_events (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(191) DEFAULT NULL,
  api_key_id VARCHAR(64) DEFAULT NULL,
  period_start DATETIME(6) NOT NULL,
  period_end DATETIME(6) DEFAULT NULL,
  limit_amount DOUBLE DEFAULT 0,
  used_amount DOUBLE DEFAULT 0,
  alert_level VARCHAR(32) NOT NULL,
  metadata_json JSON DEFAULT NULL,
  created_at DATETIME(6) DEFAULT NULL,
  UNIQUE KEY uk_alert_event (api_key_id, period_start, alert_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quota_policy_shadow_events (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id VARCHAR(64) DEFAULT NULL,
  user_id VARCHAR(191) DEFAULT NULL,
  api_key_id VARCHAR(64) DEFAULT NULL,
  policy_mode VARCHAR(32) DEFAULT NULL,
  legacy_allowed TINYINT(1) DEFAULT 1,
  shadow_allowed TINYINT(1) DEFAULT 1,
  legacy_reason VARCHAR(191) DEFAULT NULL,
  shadow_reason VARCHAR(191) DEFAULT NULL,
  usage_scope VARCHAR(32) DEFAULT NULL,
  cost_amount DOUBLE DEFAULT 0,
  metadata_json JSON DEFAULT NULL,
  created_at DATETIME(6) DEFAULT NULL,
  KEY idx_qpse_api_key (api_key_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quota_policy_subject_overrides (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  subject_type VARCHAR(32) NOT NULL,
  subject_id VARCHAR(191) NOT NULL,
  policy_mode VARCHAR(32) NOT NULL DEFAULT 'legacy',
  config_json JSON DEFAULT NULL,
  created_at DATETIME(6) DEFAULT NULL,
  updated_at DATETIME(6) DEFAULT NULL,
  updated_by VARCHAR(128) DEFAULT NULL,
  UNIQUE KEY uk_subject (subject_type, subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
'@
    Write-NoBOM $schemaFile $schemaSql
    $src = "source " + (($schemaFile -replace '\\', '/'))
    & $MYSQL_EXE "-u" "root" "--password=$rootPw" "-h" $DB_HOST "-P" "$DB_PORT" "-D" $DB_NAME "--default-character-set=utf8mb4" "-e" $src 2>&1 | ForEach-Object {
        Write-Host "    $_" -ForegroundColor DarkGray
    }
    Remove-Item $schemaFile -Force -ErrorAction SilentlyContinue
    Write-Ok "Core tables created/verified (14 tables)"

    # Migrations
    if (Test-Path $MigrationsDir) {
        $sqlFiles = Get-ChildItem -Path $MigrationsDir -Filter "*.sql" | Sort-Object Name
        if ($sqlFiles.Count -gt 0) {
            Write-Info "Running $($sqlFiles.Count) migration(s) ..."
            foreach ($f in $sqlFiles) {
                Write-Host "    -> $($f.Name)" -ForegroundColor DarkGray
                $content = Get-Content $f.FullName -Raw
                Invoke-MySQLSilent "root" $rootPw $content $DB_NAME
            }
            Write-Ok "Migrations complete"
        }
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 8 — PATH
# ═══════════════════════════════════════════════════════════════════════════════
function Add-ToPath {
    $cur = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    if ($cur -notlike "*$MYSQL_BIN*") {
        [System.Environment]::SetEnvironmentVariable("Path", "$cur;$MYSQL_BIN", "Machine")
        $env:Path = "$env:Path;$MYSQL_BIN"
        Write-Ok "Added $MYSQL_BIN to system PATH"
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Verification  (pure state probes)
# ═══════════════════════════════════════════════════════════════════════════════
function Test-Installation {
    Write-Header "Verification"
    $script:InstallOk = $true

    if (Test-TCP $DB_HOST $DB_PORT) { Write-Ok "TCP ${DB_HOST}:${DB_PORT} open" }
    else { Write-Fail "TCP ${DB_HOST}:${DB_PORT} closed"; $script:InstallOk = $false }

    $svc = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq "Running") { Write-Ok "Service '$SERVICE_NAME' running" }
    else { Write-Fail "Service '$SERVICE_NAME' not running"; $script:InstallOk = $false }

    $rootPw = Get-RootPassword
    if ($rootPw -and (Test-MySQLQuery "root" $rootPw "SELECT 1;")) { Write-Ok "Root login OK" }
    elseif ($rootPw) { Write-Fail "Root login failed"; $script:InstallOk = $false }

    if (Test-MySQLQuery $DB_USER $DB_PASSWORD "SELECT 1;" $DB_NAME) {
        Write-Ok "App user '$DB_USER' -> '$DB_NAME' OK"
    } else { Write-Fail "App user login failed"; $script:InstallOk = $false }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main — every step is individually idempotent, always run the full pipeline
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "  MySQL Installer for webclaude-go-gateway" -ForegroundColor Magenta
Write-Host "  Official: https://dev.mysql.com/doc/refman/8.0/en/windows-install-archive.html" -ForegroundColor DarkGray
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  DEV_WIN_ROOT = $DEV_WIN_ROOT" -ForegroundColor Gray
Write-Host "  INSTALL_DIR  = $INSTALL_DIR" -ForegroundColor Gray
Write-Host "  DB_HOST:PORT = ${DB_HOST}:${DB_PORT}" -ForegroundColor Gray
Write-Host "  DB_NAME      = $DB_NAME" -ForegroundColor Gray
Write-Host "  DB_USER      = $DB_USER" -ForegroundColor Gray

if (-not (Request-RemoveWrongMysqlLocation)) {
    Write-Host ""
    return
}

if (-not (Request-MySQLServiceMatchesInstallDir)) {
    Write-Host ""
    return
}

$listen = Test-TCP $DB_HOST $DB_PORT
$winSvc = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
$svcOk = Test-MySQLServiceBinaryOk
$haveClient = Test-Path $MYSQL_EXE

if ($listen -and $svcOk -and $haveClient) {
    Write-Header "Step 0: MySQL already running (fixed path)"
    Write-Ok "Reachable on ${DB_HOST}:${DB_PORT} (mysqld under $INSTALL_DIR)"
    if (-not $SkipSchema) { Initialize-Schema }
}
elseif (-not $listen) {
    Install-Binary
    New-OptionFile
    Initialize-DataDir
    Install-Service
    Start-MySQLService
    Set-RootPassword
    if (-not $SkipSchema) { Initialize-Schema }
    Add-ToPath
}
elseif ($listen -and -not $winSvc) {
    Write-Header "Step 0: Port open (no Windows service '$SERVICE_NAME')"
    Write-Warn "Something is listening on ${DB_PORT}. If it is not MySQL, free the port. If it is external MySQL, only schema steps run."
    if (-not $SkipSchema -and $haveClient) { Initialize-Schema }
}
else {
    Write-Header "Step 0: Cannot use local install"
    Write-Fail "Port ${DB_PORT} is open but mysqld.exe under $INSTALL_DIR is missing or does not match service '$SERVICE_NAME'."
    Write-Info "Run this script as Administrator; when prompted, choose Y to remove the wrong service."
}

Test-Installation

Write-Host ""
if ($script:InstallOk) {
    Write-Ok "MySQL is ready!"
    Write-Host "  Root password file : $PASSWORD_FILE" -ForegroundColor Gray
    Write-Host "  App connection     : mysql -u $DB_USER -p -h $DB_HOST -P $DB_PORT $DB_NAME" -ForegroundColor White
} else {
    Write-Fail "Setup completed with issues - check errors above"
}
Write-Host ""
