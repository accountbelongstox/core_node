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

# Script Index for logging
$SCRIPT_INDEX = "InstallRedis"

# Resolve absolute paths for script dependencies
$scriptRoot = $PSScriptRoot
$parentPath = Split-Path -Parent $scriptRoot
$winCommonPath = Join-Path $parentPath "win_common"
$globalVarsPath = Join-Path $winCommonPath "GlobalVars.ps1"
$commonFuncPath = Join-Path $winCommonPath "CommonFunc.ps1"
$windowsPathFuncPath = Join-Path $winCommonPath "WindowsPathFunction.ps1"

# Import required modules
. $globalVarsPath
. $commonFuncPath
. $windowsPathFuncPath

# All variable declarations
$redisVersion = "5.0.14.1"
$redisPort = 6379
$redisInstallDir = ""
$redisConfigFile = ""
$redisDataDir = ""
$redisLogDir = ""
$redisServiceName = "Redis"
$installAsService = $true
$redisBindAddress = "127.0.0.1"
$redisMaxMemory = "256mb"
$redisMaxMemoryPolicy = "allkeys-lru"
$redisDownloadUrl = ""
$redisInstallerPath = ""
$redisServerExe = ""
$redisCliExe = ""
$existingService = $null
$downloadSuccess = $false
$installSuccess = $false
$serviceInstalled = $false

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] Redis Installation" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Set installation directory to global compiler dir
$redisInstallDir = Join-Path $Global:LANG_COMPILER_DIR "Redis"
$redisDataDir = Join-Path $redisInstallDir "data"
$redisLogDir = Join-Path $redisInstallDir "logs"
$redisConfigFile = Join-Path $redisInstallDir "redis.windows.conf"
$redisServerExe = Join-Path $redisInstallDir "redis-server.exe"
$redisCliExe = Join-Path $redisInstallDir "redis-cli.exe"

Write-Host "  [$SCRIPT_INDEX] Configuration:" -ForegroundColor White
Write-Host "  [$SCRIPT_INDEX]   - Redis Version: $redisVersion" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Install Directory: $redisInstallDir" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Port: $redisPort" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Install as Service: $installAsService" -ForegroundColor Gray
Write-Host ""

function Test-RedisInstallation {
    Write-Host "  [$SCRIPT_INDEX] Checking if Redis is already installed..." -ForegroundColor Cyan

    if (Test-Path $redisServerExe) {
        Write-Host "  [$SCRIPT_INDEX] Redis is already installed at: $redisInstallDir" -ForegroundColor Green
        Write-Host "  [$SCRIPT_INDEX] redis-server.exe found: $redisServerExe" -ForegroundColor Green
        return $true
    }

    $service = Get-Service -Name $redisServiceName -ErrorAction SilentlyContinue
    if ($service) {
        Write-Host "  [$SCRIPT_INDEX] Redis service is installed" -ForegroundColor Green
        return $true
    }

    Write-Host "  [$SCRIPT_INDEX] Redis is not installed" -ForegroundColor Yellow
    return $false
}

function Install-RedisManually {
    Write-Host "  [$SCRIPT_INDEX] Installing Redis..." -ForegroundColor Cyan

    $redisDownloadUrl = "https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.msi"
    $redisInstallerPath = Join-Path $Global:DOWNLOADS_DIR "Redis-x64.msi"

    if (-not (Test-Path $Global:DOWNLOADS_DIR)) {
        New-Item -ItemType Directory -Path $Global:DOWNLOADS_DIR -Force | Out-Null
    }

    Write-Host "  [$SCRIPT_INDEX] Downloading Redis installer..." -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] URL: $redisDownloadUrl" -ForegroundColor Gray
    Write-Host ""

    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $redisDownloadUrl -OutFile $redisInstallerPath -UseBasicParsing
    $ProgressPreference = 'Continue'

    if (-not (Test-Path $redisInstallerPath)) {
        Write-Host "  [$SCRIPT_INDEX] Failed to download Redis installer" -ForegroundColor Red
        return $false
    }

    Write-Host "  [$SCRIPT_INDEX] Redis installer downloaded successfully" -ForegroundColor Green
    Write-Host ""

    Write-Host "  [$SCRIPT_INDEX] Installing Redis to $redisInstallDir..." -ForegroundColor Cyan
    $installArgs = "/i `"$redisInstallerPath`" /quiet /norestart INSTALLFOLDER=`"$redisInstallDir`""

    $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $installArgs -Wait -PassThru -NoNewWindow

    if ($process.ExitCode -eq 0) {
        Write-Host "  [$SCRIPT_INDEX] Redis installed successfully" -ForegroundColor Green

        Remove-Item -Path $redisInstallerPath -Force -ErrorAction SilentlyContinue
        Write-Host "  [$SCRIPT_INDEX] Cleaned up installer file" -ForegroundColor Gray

        return $true
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] Failed to install Redis (exit code: $($process.ExitCode))" -ForegroundColor Red
        return $false
    }
}

function Initialize-RedisDirectories {
    Write-Host "  [$SCRIPT_INDEX] Initializing Redis directories..." -ForegroundColor Cyan

    if (-not (Test-Path $redisInstallDir)) {
        Write-Host "  [$SCRIPT_INDEX] Error: Redis installation directory not found" -ForegroundColor Red
        return $false
    }

    if (-not (Test-Path $redisDataDir)) {
        New-Item -ItemType Directory -Path $redisDataDir -Force | Out-Null
        Write-Host "  [$SCRIPT_INDEX] Created data directory: $redisDataDir" -ForegroundColor Green
    }

    if (-not (Test-Path $redisLogDir)) {
        New-Item -ItemType Directory -Path $redisLogDir -Force | Out-Null
        Write-Host "  [$SCRIPT_INDEX] Created log directory: $redisLogDir" -ForegroundColor Green
    }

    Write-Host "  [$SCRIPT_INDEX] Directories initialized successfully" -ForegroundColor Green
    return $true
}

function Configure-RedisConfig {
    Write-Host "  [$SCRIPT_INDEX] Configuring Redis..." -ForegroundColor Cyan

    if (-not (Test-Path $redisConfigFile)) {
        Write-Host "  [$SCRIPT_INDEX] Creating Redis configuration file..." -ForegroundColor Cyan

        $normalizedDataDir = $redisDataDir -replace '\\', '/'
        $normalizedLogDir = $redisLogDir -replace '\\', '/'

        $configContent = @"
# Redis Configuration File
# Generated by $SCRIPT_INDEX

# Network settings - bind to localhost only for security
bind $redisBindAddress
port $redisPort

# No password required for local connections
# protected-mode yes

# Persistence
dir $normalizedDataDir
dbfilename dump.rdb
save 900 1
save 300 10
save 60 10000

# Logging
logfile $normalizedLogDir/redis.log
loglevel notice

# Memory management
maxmemory $redisMaxMemory
maxmemory-policy $redisMaxMemoryPolicy
"@

        Set-Content -Path $redisConfigFile -Value $configContent -Encoding UTF8 -Force
        Write-Host "  [$SCRIPT_INDEX] Configuration file created" -ForegroundColor Green
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] Configuration file already exists" -ForegroundColor Gray

        $backupPath = Join-Path $redisInstallDir "redis.windows.conf.backup"
        Copy-Item -Path $redisConfigFile -Destination $backupPath -Force
        Write-Host "  [$SCRIPT_INDEX] Backed up existing config to: $backupPath" -ForegroundColor Gray
    }

    Write-Host "  [$SCRIPT_INDEX] Redis configured for:" -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX]   - Bind Address: $redisBindAddress (localhost only)" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]   - Port: $redisPort" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]   - Authentication: DISABLED (no password)" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]   - Max Memory: $redisMaxMemory" -ForegroundColor Gray
    Write-Host ""

    return $true
}

function Install-RedisService {
    Write-Host "  [$SCRIPT_INDEX] Checking Redis service..." -ForegroundColor Cyan

    if (-not (Test-Path $redisServerExe)) {
        Write-Host "  [$SCRIPT_INDEX] Error: redis-server.exe not found at: $redisServerExe" -ForegroundColor Red
        return $false
    }

    $existingService = Get-Service -Name $redisServiceName -ErrorAction SilentlyContinue
    if ($existingService) {
        if ($existingService.Status -eq 'Running') {
            Write-Host "  [$SCRIPT_INDEX] Redis service is already running" -ForegroundColor Green
            return $true
        }
        else {
            Write-Host "  [$SCRIPT_INDEX] Redis service exists but not running, attempting to start..." -ForegroundColor Yellow
            Start-Service -Name $redisServiceName -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2

            $service = Get-Service -Name $redisServiceName -ErrorAction SilentlyContinue
            if ($service -and $service.Status -eq 'Running') {
                Write-Host "  [$SCRIPT_INDEX] Redis service started successfully" -ForegroundColor Green
                return $true
            }
            else {
                Write-Host "  [$SCRIPT_INDEX] Failed to start service, reinstalling..." -ForegroundColor Yellow
                Stop-Service -Name $redisServiceName -Force -ErrorAction SilentlyContinue
                & sc.exe delete $redisServiceName | Out-Null
                Start-Sleep -Seconds 3
                Write-Host "  [$SCRIPT_INDEX] Removed broken service" -ForegroundColor Gray
            }
        }
    }

    Write-Host "  [$SCRIPT_INDEX] Installing Redis service..." -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] Command: $redisServerExe --service-install `"$redisConfigFile`" --service-name $redisServiceName" -ForegroundColor Gray

    $installOutput = & $redisServerExe --service-install $redisConfigFile --service-name $redisServiceName 2>&1
    Start-Sleep -Seconds 3

    $service = Get-Service -Name $redisServiceName -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Host "  [$SCRIPT_INDEX] Error: Service installation failed" -ForegroundColor Red
        Write-Host "  [$SCRIPT_INDEX] Output: $installOutput" -ForegroundColor Gray
        return $false
    }

    Write-Host "  [$SCRIPT_INDEX] Service installed successfully" -ForegroundColor Green

    Write-Host "  [$SCRIPT_INDEX] Starting Redis service..." -ForegroundColor Cyan
    Start-Service -Name $redisServiceName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    $service = Get-Service -Name $redisServiceName -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq 'Running') {
        Write-Host "  [$SCRIPT_INDEX] Redis service is running" -ForegroundColor Green
        return $true
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] Warning: Service installed but not running" -ForegroundColor Yellow
        if ($service) {
            Write-Host "  [$SCRIPT_INDEX] Service status: $($service.Status)" -ForegroundColor Gray
        }
        return $false
    }
}

function Test-RedisConnection {
    Write-Host "  [$SCRIPT_INDEX] Testing Redis connection..." -ForegroundColor Cyan

    if (-not (Test-Path $redisCliExe)) {
        Write-Host "  [$SCRIPT_INDEX] Warning: redis-cli.exe not found, skipping connection test" -ForegroundColor Yellow
        return $true
    }

    Write-Host "  [$SCRIPT_INDEX] Sending PING command..." -ForegroundColor Cyan

    $pingResult = & $redisCliExe -h $redisBindAddress -p $redisPort PING 2>&1

    if ($pingResult -match "PONG") {
        Write-Host "  [$SCRIPT_INDEX] Redis is responding correctly (PONG received)" -ForegroundColor Green

        Write-Host "  [$SCRIPT_INDEX] Testing SET/GET commands..." -ForegroundColor Cyan

        $testKey = "test_install_script"
        $testValue = "Redis is working!"

        & $redisCliExe -h $redisBindAddress -p $redisPort SET $testKey $testValue | Out-Null
        $getValue = & $redisCliExe -h $redisBindAddress -p $redisPort GET $testKey 2>&1

        if ($getValue -eq $testValue) {
            Write-Host "  [$SCRIPT_INDEX] SET/GET test successful" -ForegroundColor Green

            & $redisCliExe -h $redisBindAddress -p $redisPort DEL $testKey | Out-Null

            return $true
        }
        else {
            Write-Host "  [$SCRIPT_INDEX] Warning: SET/GET test failed" -ForegroundColor Yellow
            return $false
        }
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] Warning: Redis is not responding" -ForegroundColor Yellow
        return $false
    }
}

function Set-RedisEnvironmentVariables {
    Write-Host "  [$SCRIPT_INDEX] Setting Redis environment variables..." -ForegroundColor Cyan

    Add-Path -newPath $redisInstallDir
    Write-Host "  [$SCRIPT_INDEX] Added Redis to system PATH: $redisInstallDir" -ForegroundColor Green

    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Write-Host "  [$SCRIPT_INDEX] Refreshed current session PATH" -ForegroundColor Green
}

function Show-RedisInfo {
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "  [$SCRIPT_INDEX] Redis Installation Summary" -ForegroundColor Green
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "  [$SCRIPT_INDEX] Installation Directory: $redisInstallDir" -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] Configuration File: $redisConfigFile" -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] Data Directory: $redisDataDir" -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] Log Directory: $redisLogDir" -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] " -ForegroundColor White
    Write-Host "  [$SCRIPT_INDEX] Connection Info:" -ForegroundColor White
    Write-Host "  [$SCRIPT_INDEX]   Host: $redisBindAddress" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]   Port: $redisPort" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]   Password: NONE (no authentication)" -ForegroundColor Gray
    Write-Host ""

    $service = Get-Service -Name $redisServiceName -ErrorAction SilentlyContinue
    if ($service) {
        Write-Host "  [$SCRIPT_INDEX] Service Info:" -ForegroundColor White
        Write-Host "  [$SCRIPT_INDEX]   Service Name: $redisServiceName" -ForegroundColor Gray
        Write-Host "  [$SCRIPT_INDEX]   Status: $($service.Status)" -ForegroundColor Gray
        Write-Host "  [$SCRIPT_INDEX]   Startup Type: $($service.StartType)" -ForegroundColor Gray
        Write-Host ""
    }

    Write-Host "  [$SCRIPT_INDEX] Usage Examples:" -ForegroundColor White
    Write-Host "  [$SCRIPT_INDEX]   Connect: redis-cli -h $redisBindAddress -p $redisPort" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]   Ping: redis-cli PING" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]   Set: redis-cli SET mykey myvalue" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]   Get: redis-cli GET mykey" -ForegroundColor Gray
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host ""
}

# Main execution
Write-Host "  [$SCRIPT_INDEX] Starting Redis installation process..." -ForegroundColor Cyan
Write-Host ""

# Check if Redis is already installed
if (Test-RedisInstallation) {
    $service = Get-Service -Name $redisServiceName -ErrorAction SilentlyContinue
    $serviceRunning = $service -and $service.Status -eq 'Running'

    if ($serviceRunning) {
        Write-Host "  [$SCRIPT_INDEX] Redis is already installed and running normally" -ForegroundColor Green
        Write-Host ""

        Write-Host "  [$SCRIPT_INDEX] Repairing environment variables..." -ForegroundColor Cyan
        Set-RedisEnvironmentVariables | Out-Null

        Write-Host ""
        Show-RedisInfo
        exit 0
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] Redis is installed but service is not running, repairing configuration..." -ForegroundColor Yellow
        Write-Host ""

        Write-Host "  [$SCRIPT_INDEX] Repairing directories..." -ForegroundColor Cyan
        Initialize-RedisDirectories | Out-Null

        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] Repairing configuration file..." -ForegroundColor Cyan
        Configure-RedisConfig | Out-Null

        Write-Host "  [$SCRIPT_INDEX] Repairing service..." -ForegroundColor Cyan
        $serviceInstalled = Install-RedisService

        if ($serviceInstalled) {
            Write-Host "  [$SCRIPT_INDEX] Service repaired and running" -ForegroundColor Green
        }
        else {
            Write-Host "  [$SCRIPT_INDEX] Warning: Service repair failed" -ForegroundColor Yellow
        }

        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] Repairing environment variables..." -ForegroundColor Cyan
        Set-RedisEnvironmentVariables | Out-Null

        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] Testing connection..." -ForegroundColor Cyan
        Test-RedisConnection | Out-Null

        Write-Host ""
        Show-RedisInfo
        exit 0
    }
}

# Install Redis
Write-Host "  [$SCRIPT_INDEX] Redis not found, proceeding with installation..." -ForegroundColor Yellow
Write-Host ""

$installSuccess = Install-RedisManually

if (-not $installSuccess) {
    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] Failed to install Redis" -ForegroundColor Red
    Write-Host "  [$SCRIPT_INDEX] Please install manually from: https://github.com/tporadowski/redis/releases" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Initialize directories
Write-Host ""
if (-not (Initialize-RedisDirectories)) {
    Write-Host "  [$SCRIPT_INDEX] Failed to initialize directories" -ForegroundColor Red
    exit 1
}

# Configure Redis
Write-Host ""
if (-not (Configure-RedisConfig)) {
    Write-Host "  [$SCRIPT_INDEX] Failed to configure Redis" -ForegroundColor Red
    exit 1
}

# Install as Windows service
if ($installAsService) {
    Write-Host ""
    $serviceInstalled = Install-RedisService

    if ($serviceInstalled) {
        Write-Host "  [$SCRIPT_INDEX] Redis service installed and started successfully" -ForegroundColor Green
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] Warning: Failed to install service, but Redis binaries are installed" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX] You can run Redis manually: redis-server.exe `"$redisConfigFile`"" -ForegroundColor Cyan
    }
}

# Set environment variables
Write-Host ""
Set-RedisEnvironmentVariables | Out-Null

# Test connection
Write-Host ""
Test-RedisConnection | Out-Null

# Show installation summary
Show-RedisInfo

Write-Host "  [$SCRIPT_INDEX] Redis installation completed successfully" -ForegroundColor Green
Write-Host ""
