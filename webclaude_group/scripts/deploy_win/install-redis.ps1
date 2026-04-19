#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Idempotent Redis installation for webclaude-go-gateway on Windows.

.DESCRIPTION
    Downloads Redis for Windows (tporadowski/redis port), extracts to install
    directory, configures redis.windows-service.conf, installs as a Windows
    service, and starts it.

    Fully idempotent: safe to run multiple times.

.EXAMPLE
    .\install-redis.ps1
#>

param([string]$RepoRoot = "")

Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $RepoRoot) { $RepoRoot = $env:WEBCLAUDE_SERVICE_ROOT }
if (-not $RepoRoot -or -not (Test-Path -LiteralPath $RepoRoot)) {
    Write-Host "  [FAIL] Pass -RepoRoot <service-repo> or set WEBCLAUDE_SERVICE_ROOT (directory with .env / .env.example)." -ForegroundColor Red
    exit 1
}
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path

# ═══════════════════════════════════════════════════════════════════════════════
# Constants - fixed install root (D:\.dev_win10\redis)
# ═══════════════════════════════════════════════════════════════════════════════
$REDIS_VERSION   = "5.0.14.1"
$DEV_WIN_ROOT    = "D:\.dev_win10"
$INSTALL_DIR     = Join-Path $DEV_WIN_ROOT "redis"
$SERVICE_NAME    = "Redis"
$PASSWORD_FILE   = Join-Path $INSTALL_DIR ".redis_password"

$REDIS_SERVER    = Join-Path $INSTALL_DIR "redis-server.exe"
$REDIS_CLI       = Join-Path $INSTALL_DIR "redis-cli.exe"
$REDIS_CONF      = Join-Path $INSTALL_DIR "redis.windows-service.conf"

$DOWNLOAD_URL    = "https://github.com/tporadowski/redis/releases/download/v${REDIS_VERSION}/Redis-x64-${REDIS_VERSION}.zip"

# ── Load .env ────────────────────────────────────────────────────────────────

$EnvFile = Join-Path $RepoRoot ".env"
if (-not (Test-Path $EnvFile)) { $EnvFile = Join-Path $RepoRoot ".env.example" }

$REDIS_HOST     = "127.0.0.1"
$REDIS_PORT     = 6379
$REDIS_PASSWORD = ""
$REDIS_DB       = 0

if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $eqIdx = $line.IndexOf("=")
            if ($eqIdx -gt 0) {
                $k = $line.Substring(0, $eqIdx).Trim()
                $v = $line.Substring($eqIdx + 1).Trim()
                switch ($k) {
                    "REDIS_HOST"     { $script:REDIS_HOST = $v }
                    "REDIS_PORT"     { $script:REDIS_PORT = [int]$v }
                    "REDIS_PASSWORD" { $script:REDIS_PASSWORD = $v }
                    "REDIS_DB"       { $script:REDIS_DB = [int]$v }
                }
            }
        }
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════
function Write-Header([string]$t) {
    Write-Host "`n$("=" * 60)" -ForegroundColor Cyan
    Write-Host "  $t" -ForegroundColor Cyan
    Write-Host "$("=" * 60)" -ForegroundColor Cyan
}
function Write-Ok([string]$t)   { Write-Host "  [OK]   $t" -ForegroundColor Green }
function Write-Info([string]$t)  { Write-Host "  [INFO] $t" -ForegroundColor Yellow }
function Write-Fail([string]$t)  { Write-Host "  [FAIL] $t" -ForegroundColor Red }
function Write-Skip([string]$t)  { Write-Host "  [SKIP] $t" -ForegroundColor DarkGray }

function Test-TCPPort([string]$targetHost, [int]$targetPort, [int]$ms = 2000) {
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $r = $c.BeginConnect($targetHost, $targetPort, $null, $null)
        $ok = $r.AsyncWaitHandle.WaitOne($ms, $false)
        $c.Close()
        return $ok
    } catch { return $false }
}

function Write-Warn([string]$t) { Write-Host "  [WARN] $t" -ForegroundColor DarkYellow }

function Get-RedisServiceImagePath {
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

function Test-RedisServiceBinaryOk {
    $img = Get-RedisServiceImagePath
    if ($img -eq "") { return $false }
    return ([System.IO.Path]::GetFullPath($img) -ieq [System.IO.Path]::GetFullPath($REDIS_SERVER))
}

function Request-RedisServiceMatchesInstallDir {
    $svc = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    if (-not $svc) { return $true }

    $img = Get-RedisServiceImagePath
    if ($img -eq "") { return $true }

    $want = [System.IO.Path]::GetFullPath($REDIS_SERVER)
    $have = [System.IO.Path]::GetFullPath($img)
    if ($have -ieq $want) { return $true }

    Write-Host ""
    Write-Warn "Windows service '$SERVICE_NAME' is not using the fixed install path."
    Write-Warn "  Service redis-server.exe: $have"
    Write-Warn "  Expected:                 $want"
    $yn = Read-Host "Stop/uninstall this service and data under its folder, then install under ${INSTALL_DIR}? [Y/n]"
    if ($yn -ne "" -and $yn -notmatch "^[Yy]") {
        Write-Fail "Stopped. Remove the service manually or run again and choose Y."
        return $false
    }

    if ($svc.Status -eq "Running") {
        Write-Info "Stopping service '$SERVICE_NAME' ..."
        & $have --service-stop --service-name $SERVICE_NAME 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        Start-Sleep -Seconds 2
    }

    Write-Info "Uninstalling service via: $have --service-uninstall"
    & $have --service-uninstall --service-name $SERVICE_NAME 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    Start-Sleep -Seconds 2

    $wrongRoot = [System.IO.Path]::GetFullPath((Split-Path $have))
    $expRoot = [System.IO.Path]::GetFullPath($INSTALL_DIR)
    if ($wrongRoot -ine $expRoot -and (Test-Path $wrongRoot)) {
        Write-Info "Removing old install tree: $wrongRoot"
        Remove-Item -LiteralPath $wrongRoot -Recurse -Force -ErrorAction SilentlyContinue
    }

    Write-Info "Waiting for port ${REDIS_PORT} to free after service removal ..."
    $w = 0
    while ((Test-TCPPort $REDIS_HOST $REDIS_PORT) -and $w -lt 30) {
        Start-Sleep -Seconds 1
        $w++
    }

    Write-Ok "Old Redis service removed. Continuing with fixed path install."
    return $true
}

function Request-RemoveWrongRedisLocation {
    $repoRedis = Join-Path $RepoRoot "redis"
    $legacyExe = Join-Path $repoRedis "redis-server.exe"
    if (-not (Test-Path $legacyExe)) { return $true }

    $want = [System.IO.Path]::GetFullPath($INSTALL_DIR)
    $have = [System.IO.Path]::GetFullPath($repoRedis)
    if ($have -ieq $want) { return $true }

    Write-Host ""
    Write-Warn "Redis is present under the repo, not the fixed install path:"
    Write-Warn "  Found: $repoRedis"
    Write-Warn "  Expected: $INSTALL_DIR"
    $yn = Read-Host "Stop/uninstall service if it uses this folder, delete this folder, then install under the fixed path? [Y/n]"
    if ($yn -ne "" -and $yn -notmatch "^[Yy]") {
        Write-Fail "Stopped. Remove or rename the folder above, then run this script again."
        return $false
    }

    $svc = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq "Running") {
        Write-Info "Stopping service '$SERVICE_NAME' ..."
        & $legacyExe --service-stop --service-name $SERVICE_NAME 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        Start-Sleep -Seconds 2
    }

    $img = Get-RedisServiceImagePath
    if ($img -ne "" -and $img.StartsWith($have, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Info "Uninstalling Windows service (binary was under repo path) ..."
        & $legacyExe --service-uninstall --service-name $SERVICE_NAME 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        Start-Sleep -Seconds 1
    }

    Write-Info "Removing: $repoRedis"
    Remove-Item -LiteralPath $repoRedis -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $repoRedis) {
        Write-Fail "Could not remove $repoRedis (files in use?). Close programs and run again."
        return $false
    }
    Write-Ok "Old repo copy removed"
    return $true
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 1 - Download & extract
# ═══════════════════════════════════════════════════════════════════════════════
function Install-Binary {
    Write-Header "Step 1: Download & Extract"

    if (Test-Path $REDIS_SERVER) {
        Write-Skip "redis-server.exe already present at $REDIS_SERVER"
        return
    }

    $tempDir = Join-Path $env:TEMP "redis_install"
    $zipPath = Join-Path $tempDir "Redis-x64-${REDIS_VERSION}.zip"

    if (-not (Test-Path $tempDir)) { New-Item -ItemType Directory -Path $tempDir -Force | Out-Null }

    if (-not (Test-Path $zipPath)) {
        Write-Info "Downloading Redis $REDIS_VERSION ..."
        Write-Info "URL: $DOWNLOAD_URL"
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $wc = New-Object System.Net.WebClient
            $wc.DownloadFile($DOWNLOAD_URL, $zipPath)
            $wc.Dispose()
            $sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
            Write-Ok "Downloaded ($sizeMB MB)"
        } catch {
            Write-Fail "Download failed: $_"
            Write-Info "Manual download: https://github.com/tporadowski/redis/releases"
            return
        }
    } else {
        Write-Skip "ZIP already cached: $zipPath"
    }

    Write-Info "Extracting to $INSTALL_DIR ..."
    if (-not (Test-Path $INSTALL_DIR)) { New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null }

    # Redis ZIP may contain files directly or in a subfolder
    Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force

    # Check if extracted into a subdirectory
    $subDir = Get-ChildItem -Path $tempDir -Directory | Where-Object { $_.Name -like "Redis*" } | Select-Object -First 1
    $sourceDir = if ($subDir) { $subDir.FullName } else { $tempDir }

    # Look for redis-server.exe in source
    $serverExe = Get-ChildItem -Path $sourceDir -Filter "redis-server.exe" -Recurse | Select-Object -First 1
    if (-not $serverExe) {
        Write-Fail "redis-server.exe not found in archive"; return
    }
    $actualSource = Split-Path $serverExe.FullName -Parent

    Get-ChildItem -Path $actualSource | ForEach-Object {
        $dest = Join-Path $INSTALL_DIR $_.Name
        if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
        Copy-Item $_.FullName $dest -Recurse -Force
    }

    if (-not (Test-Path $REDIS_SERVER)) {
        Write-Fail "redis-server.exe missing after extraction"; return
    }
    Write-Ok "Redis binaries installed to $INSTALL_DIR"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 2 - Create configuration
# ═══════════════════════════════════════════════════════════════════════════════
function New-RedisConfig {
    Write-Header "Step 2: Configuration"

    if (Test-Path $REDIS_CONF) {
        Write-Skip "Config already exists: $REDIS_CONF"
        return
    }

    $confContent = @"
# Redis Windows Service Configuration
# Generated by install-redis.ps1

bind $REDIS_HOST
port $REDIS_PORT

# Persistence
save 900 1
save 300 10
save 60 10000
dbfilename dump.rdb
dir $($INSTALL_DIR -replace '\\', '/')

# Memory
maxmemory 256mb
maxmemory-policy allkeys-lru

# Logging
loglevel notice
logfile $($INSTALL_DIR -replace '\\', '/')/redis.log

# Database count
databases 16
"@

    if ($REDIS_PASSWORD) {
        $confContent += "`n`n# Authentication`nrequirepass $REDIS_PASSWORD`n"
    }

    [System.IO.File]::WriteAllText($REDIS_CONF, $confContent, (New-Object System.Text.UTF8Encoding $false))
    Write-Ok "Config created at $REDIS_CONF"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 3 - Install & start Windows service
#   redis-server --service-install <conf> --service-name <name>
#   redis-server --service-start  --service-name <name>
# ═══════════════════════════════════════════════════════════════════════════════
function Install-RedisService {
    Write-Header "Step 3: Install Windows Service"

    $svc = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    if ($svc) {
        Write-Skip "Service '$SERVICE_NAME' already registered"
    } else {
        Write-Info "Installing Redis as Windows service '$SERVICE_NAME' ..."
        & $REDIS_SERVER --service-install $REDIS_CONF --service-name $SERVICE_NAME 2>&1 | ForEach-Object {
            Write-Host "    $_" -ForegroundColor DarkGray
        }
        # Verify by checking service exists now
        $svc = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
        if ($svc) { Write-Ok "Service '$SERVICE_NAME' installed" }
        else { Write-Fail "Service registration failed" }
    }
}

function Start-RedisService {
    Write-Header "Step 4: Start Service"

    if (Test-TCPPort $REDIS_HOST $REDIS_PORT) {
        Write-Skip "Port $REDIS_PORT already open"
        return
    }

    $svc = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    if (-not $svc) {
        Write-Fail "Service '$SERVICE_NAME' not found"; return
    }

    Write-Info "Starting Redis service ..."
    & $REDIS_SERVER --service-start --service-name $SERVICE_NAME 2>&1 | ForEach-Object {
        Write-Host "    $_" -ForegroundColor DarkGray
    }

    $maxWait = 15; $waited = 0
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 1; $waited++
        if (Test-TCPPort $REDIS_HOST $REDIS_PORT) { break }
    }

    if (-not (Test-TCPPort $REDIS_HOST $REDIS_PORT)) {
        Write-Fail "Redis did not respond on port $REDIS_PORT within $maxWait seconds"
        Write-Info "Check: $(Join-Path $INSTALL_DIR 'redis.log')"
        return
    }
    Write-Ok "Redis service started on port $REDIS_PORT"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 5 - Add to PATH
# ═══════════════════════════════════════════════════════════════════════════════
function Add-ToPath {
    $currentPath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    if ($currentPath -notlike "*$INSTALL_DIR*") {
        [System.Environment]::SetEnvironmentVariable("Path", "$currentPath;$INSTALL_DIR", "Machine")
        $env:Path = "$env:Path;$INSTALL_DIR"
        Write-Ok "Added $INSTALL_DIR to system PATH"
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 6 - Verification
# ═══════════════════════════════════════════════════════════════════════════════
function Test-Installation {
    Write-Header "Verification"

    $script:InstallOk = $true

    if (Test-TCPPort $REDIS_HOST $REDIS_PORT) {
        Write-Ok "TCP ${REDIS_HOST}:${REDIS_PORT} is open"
    } else {
        Write-Fail "TCP ${REDIS_HOST}:${REDIS_PORT} not reachable"
        $script:InstallOk = $false
    }

    $svc = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq "Running") {
        Write-Ok "Service '$SERVICE_NAME' is running"
    } else {
        Write-Fail "Service '$SERVICE_NAME' is not running"
        $script:InstallOk = $false
    }

    # PING test
    if (Test-Path $REDIS_CLI) {
        $authArgs = @()
        if ($REDIS_PASSWORD) { $authArgs = @("-a", $REDIS_PASSWORD) }
        $pong = & $REDIS_CLI -h $REDIS_HOST -p $REDIS_PORT @authArgs PING 2>&1
        if ("$pong" -match "PONG") {
            Write-Ok "PING -> PONG"
        } else {
            Write-Fail "PING failed: $pong"
            $script:InstallOk = $false
        }
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "  Redis Installer for webclaude-go-gateway" -ForegroundColor Magenta
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  DEV_WIN_ROOT = $DEV_WIN_ROOT" -ForegroundColor Gray
Write-Host "  INSTALL_DIR  = $INSTALL_DIR" -ForegroundColor Gray
Write-Host "  REDIS_HOST   = $REDIS_HOST" -ForegroundColor Gray
Write-Host "  REDIS_PORT   = $REDIS_PORT" -ForegroundColor Gray

if (-not (Request-RemoveWrongRedisLocation)) {
    Write-Host ""
    return
}

if (-not (Request-RedisServiceMatchesInstallDir)) {
    Write-Host ""
    return
}

$listen = Test-TCPPort $REDIS_HOST $REDIS_PORT
$winSvc = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
$svcOk = Test-RedisServiceBinaryOk
$haveCli = Test-Path $REDIS_CLI

if ($listen -and $svcOk -and $haveCli) {
    Write-Header "Step 0: Redis already running (fixed path)"
    Write-Ok "Reachable on ${REDIS_HOST}:${REDIS_PORT} (redis-server under $INSTALL_DIR)"
}
elseif (-not $listen) {
    Install-Binary
    New-RedisConfig
    Install-RedisService
    Start-RedisService
    Add-ToPath
}
elseif ($listen -and -not $winSvc) {
    Write-Header "Step 0: Port open (no Windows service '$SERVICE_NAME')"
    Write-Warn "Something is listening on ${REDIS_PORT}. If it is not Redis, free the port."
}
else {
    Write-Header "Step 0: Cannot use local install"
    Write-Fail "Port ${REDIS_PORT} is open but redis-server.exe under $INSTALL_DIR is missing or does not match service '$SERVICE_NAME'."
    Write-Info "Run this script as Administrator; when prompted, choose Y to remove the wrong service."
}

Test-Installation

Write-Host ""
if ($script:InstallOk) {
    Write-Ok "Redis is ready!"
    Write-Host "  CLI: redis-cli -h $REDIS_HOST -p $REDIS_PORT" -ForegroundColor White
} else {
    Write-Fail "Setup completed with issues - check errors above"
}
Write-Host ""
