<#
.SYNOPSIS
    Shared native-Windows MySQL manager (Windows twin of Linux 85_install_mysql.sh).
    Official MySQL Community Server Windows ZIP (cdn.mysql.com, version from contract
    versions.mysql) extracted to a versioned dir and registered with the documented
    `mysqld --install <service> --defaults-file=<ini>`; data dir D:\www\wwwroot\mysql\data, localhost-only, root password from the
    MYSQL_ROOT_PASSWORD global var (generated once). Reuses a server already
    serving the contract port (e.g. WSL MySQL) instead of starting a second one.
#>

# =============================================================================
# VARIABLES (declared at the beginning of the file)
# =============================================================================
$script:MysqlCommonDirectory   = Split-Path -Parent $PSCommandPath
$script:MysqlServiceName       = 'mysql-core-node'
$script:MysqlUser              = 'root'
$script:MysqlPasswordKey       = 'MYSQL_ROOT_PASSWORD'
$script:MysqlWebBase           = 'D:\www'
$script:MysqlDataRoot          = Join-Path $script:MysqlWebBase 'wwwroot\mysql'
$script:MysqlDataDir           = Join-Path $script:MysqlDataRoot 'data'
$script:MysqlLogDir            = Join-Path $script:MysqlDataRoot 'logs'
$script:MysqlIniPath           = Join-Path $script:MysqlDataRoot 'my.ini'
$script:MysqlSystemSchemaDir   = Join-Path $script:MysqlDataDir 'mysql'
$script:MysqlReadyWaitSeconds  = 30

if (-not (Get-Command -Name 'Get-ServiceContractValue' -ErrorAction SilentlyContinue)) {
    . (Join-Path $script:MysqlCommonDirectory 'ServiceContract.ps1')
}
if (-not (Get-Command -Name 'Install-OfficialArchive' -ErrorAction SilentlyContinue)) {
    . (Join-Path $script:MysqlCommonDirectory 'OfficialArchiveCommon.ps1')
}
$script:MysqlHost = Get-ServiceContractHost -Name 'loopback'
$script:MysqlPort = Get-ServiceContractPort -Name 'mysql'
$script:MysqlVersion = [string](Get-ServiceContractValue -ContractPath 'versions.mysql')
$script:MysqlSeries = ($script:MysqlVersion.Split('.')[0..1]) -join '.'
$script:MysqlDownloadUrl = 'https://cdn.mysql.com/Downloads/MySQL-{0}/mysql-{1}-winx64.zip' -f $script:MysqlSeries, $script:MysqlVersion
$script:MysqlBaseDir = Join-Path (Join-Path $Global:LANG_COMPILER_DIR 'MySQL') ('mysql-{0}' -f $script:MysqlVersion)
$script:MysqlServerExe = Join-Path $script:MysqlBaseDir 'bin\mysqld.exe'

function Write-MysqlLog {
    param([string]$Message, [string]$Type = 'Info')
    Write-ColorMessage -Message "[MySQL] $Message" -Type $Type
}

# =============================================================================
# PASSWORD / PROBES
# =============================================================================
function Get-MysqlRootPassword {
    $password = [string](Get-GlobalVar -key $script:MysqlPasswordKey -defaultValue '')
    $bytes = $null
    $clean = ''

    if (-not [string]::IsNullOrWhiteSpace($password)) { return $password.Trim() }
    $bytes = New-Object 'System.Byte[]' 32
    ([System.Security.Cryptography.RandomNumberGenerator]::Create()).GetBytes($bytes)
    $clean = ([System.Convert]::ToBase64String($bytes)) -replace '[^A-Za-z0-9]', ''
    $password = $clean.Substring(0, [Math]::Min(24, $clean.Length))
    Set-GlobalVar -key $script:MysqlPasswordKey -value $password | Out-Null
    return $password
}

function Test-MysqlPortOpen {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $client.BeginConnect($script:MysqlHost, $script:MysqlPort, $null, $null)
        return ($iar.AsyncWaitHandle.WaitOne(1500, $false) -and $client.Connected)
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Wait-MysqlPortOpen {
    for ($i = 0; $i -lt $script:MysqlReadyWaitSeconds; $i++) {
        if (Test-MysqlPortOpen) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Invoke-MysqlClient {
    param([string]$BaseDir, [string]$Sql, [string]$Password = '', [switch]$NoPassword)
    $client = Join-Path $BaseDir 'bin\mysql.exe'
    $arguments = @("--host=$($script:MysqlHost)", "--port=$($script:MysqlPort)", "--user=$($script:MysqlUser)", '--batch', '--skip-column-names')
    $previousPassword = $env:MYSQL_PWD
    # Function-scoped: the mysql client writes normal output on stderr.
    $ErrorActionPreference = 'Continue'

    if ($NoPassword) { $arguments += '--skip-password' } else { $env:MYSQL_PWD = $Password }
    try {
        $output = & $client @arguments --execute=$Sql 2>$null
        return [pscustomobject]@{ Ok = ($LASTEXITCODE -eq 0); Output = $output }
    } finally {
        $env:MYSQL_PWD = $previousPassword
    }
}

# =============================================================================
# INSTALL / INITIALIZE / SERVICE
# =============================================================================
function Install-MysqlPackage {
    if (-not (Install-OfficialArchive -Url $script:MysqlDownloadUrl -InstallDir $script:MysqlBaseDir -VerifyRelativePath 'bin\mysqld.exe' -Description "MySQL $($script:MysqlVersion)")) {
        return $null
    }
    Write-MysqlLog "Binaries ready: $($script:MysqlBaseDir)" 'Success'
    return $script:MysqlBaseDir
}

function Set-MysqlConfig {
    param([string]$BaseDir)
    $content = @"
; Managed by core_node MysqlManager.ps1
[mysqld]
basedir=$($BaseDir -replace '\\', '/')
datadir=$($script:MysqlDataDir -replace '\\', '/')
port=$($script:MysqlPort)
bind-address=$($script:MysqlHost)
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
log-error=$((Join-Path $script:MysqlLogDir 'error.log') -replace '\\', '/')

[client]
port=$($script:MysqlPort)
default-character-set=utf8mb4
"@
    $existing = ''

    foreach ($dir in @($script:MysqlDataRoot, $script:MysqlLogDir)) {
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    }
    if (Test-Path -LiteralPath $script:MysqlIniPath) { $existing = [System.IO.File]::ReadAllText($script:MysqlIniPath) }
    if ($existing -cne $content) {
        [System.IO.File]::WriteAllText($script:MysqlIniPath, $content, (New-Object System.Text.UTF8Encoding($false)))
        Write-MysqlLog "Config written: $($script:MysqlIniPath)" 'Success'
    }
}

function Initialize-MysqlDataDir {
    param([string]$BaseDir)
    if (Test-Path -LiteralPath $script:MysqlSystemSchemaDir -PathType Container) {
        Write-MysqlLog "Data dir already initialized: $($script:MysqlDataDir) (idempotent)" 'Success'
        return $true
    }
    # Function-scoped: mysqld writes normal output on stderr.
    $ErrorActionPreference = 'Continue'
    Write-MysqlLog "Initializing data dir $($script:MysqlDataDir) ..."
    & (Join-Path $BaseDir 'bin\mysqld.exe') "--defaults-file=$($script:MysqlIniPath)" '--initialize-insecure' '--console' 2>&1 | Out-Null
    return (Test-Path -LiteralPath $script:MysqlSystemSchemaDir -PathType Container)
}

# Registers (or repairs a stale registration of) the Windows service, sets auto-start and starts it.
function Register-MysqlService {
    param([string]$BaseDir)
    $mysqld = Join-Path $BaseDir 'bin\mysqld.exe'
    $svcKey = Join-Path 'HKLM:\SYSTEM\CurrentControlSet\Services' $script:MysqlServiceName
    $service = Get-Service -Name $script:MysqlServiceName -ErrorAction SilentlyContinue
    $imagePath = ''
    # Function-scoped: mysqld writes normal output on stderr.
    $ErrorActionPreference = 'Continue'

    if ($service) {
        try { $imagePath = (Get-ItemProperty -Path $svcKey -Name ImagePath -ErrorAction Stop).ImagePath } catch { $imagePath = '' }
        if ($imagePath -notlike "*$($script:MysqlIniPath)*" -or $imagePath -notlike "*$BaseDir*") {
            Write-MysqlLog "Service $($script:MysqlServiceName) points at a stale path -> re-registering." 'Warning'
            if ($service.Status -ne 'Stopped') { Stop-Service -Name $script:MysqlServiceName -Force -ErrorAction SilentlyContinue }
            & $mysqld --remove $script:MysqlServiceName 2>&1 | Out-Null
            Start-Sleep -Seconds 2
            $service = $null
        }
    }
    if (-not $service -and $Global:IS_RUN_ADMIN) {
        & $mysqld --install $script:MysqlServiceName "--defaults-file=$($script:MysqlIniPath)" 2>&1 | Out-Null
        $service = Get-Service -Name $script:MysqlServiceName -ErrorAction SilentlyContinue
    }
    if ($service) {
        Set-Service -Name $script:MysqlServiceName -StartupType Automatic -ErrorAction SilentlyContinue
        if ($service.Status -ne 'Running') {
            try { Start-Service -Name $script:MysqlServiceName -ErrorAction Stop } catch { Write-MysqlLog "Start-Service failed: $($_.Exception.Message)" 'Warning' }
        }
        return
    }
    Write-MysqlLog 'Not elevated: the service is not registered; starting mysqld for this session.' 'Warning'
    Start-Process -FilePath $mysqld -ArgumentList @("--defaults-file=`"$($script:MysqlIniPath)`"") -WindowStyle Hidden | Out-Null
}

function Set-MysqlRootPassword {
    param([string]$BaseDir, [string]$Password)
    $sql = "ALTER USER '$($script:MysqlUser)'@'localhost' IDENTIFIED BY '$Password';"
    if ((Invoke-MysqlClient -BaseDir $BaseDir -Password $Password -Sql 'SELECT 1').Ok) { return $true }
    return (Invoke-MysqlClient -BaseDir $BaseDir -NoPassword -Sql $sql).Ok
}

function Save-MysqlInfo {
    param([string]$BaseDir)
    Set-GlobalVar -key 'MYSQL_BIN' -value (Join-Path $BaseDir 'bin\mysql.exe') | Out-Null
    Set-GlobalVar -key 'MYSQL_DATA_DIR' -value $script:MysqlDataDir | Out-Null
    Set-GlobalVar -key 'MYSQL_LOG_DIR' -value $script:MysqlLogDir | Out-Null
    Set-GlobalVar -key 'MYSQL_CONFIG_FILE' -value $script:MysqlIniPath | Out-Null
    Set-GlobalVar -key 'MYSQL_PORT' -value ([string]$script:MysqlPort) | Out-Null
    Set-GlobalVar -key 'MYSQL_AVAILABLE' -value 'true' | Out-Null
}

# =============================================================================
# ORCHESTRATOR (idempotent + port reuse)
# =============================================================================
function Ensure-Mysql {
    $password = Get-MysqlRootPassword
    $baseDir = $null

    if (Test-MysqlPortOpen) {
        Write-MysqlLog "Port $($script:MysqlPort) already serving -> reusing the existing server (no second server)." 'Success'
        $baseDir = if (Test-Path -LiteralPath $script:MysqlServerExe -PathType Leaf) { $script:MysqlBaseDir } else { $null }
        if ($baseDir -and -not (Invoke-MysqlClient -BaseDir $baseDir -Password $password -Sql 'SELECT 1').Ok) {
            Write-MysqlLog "The server on $($script:MysqlPort) rejects $($script:MysqlPasswordKey); align its root password with the global var." 'Error'
            return $false
        }
        if ($baseDir) { Save-MysqlInfo -BaseDir $baseDir }
        return $true
    }

    $baseDir = Install-MysqlPackage
    if (-not $baseDir) { Write-MysqlLog 'MySQL binaries not resolved after install.' 'Error'; return $false }
    Set-MysqlConfig -BaseDir $baseDir
    if (-not (Initialize-MysqlDataDir -BaseDir $baseDir)) {
        Write-MysqlLog "Data dir initialization failed; see $($script:MysqlLogDir)." 'Error'
        return $false
    }
    Register-MysqlService -BaseDir $baseDir
    if (-not (Wait-MysqlPortOpen)) {
        Write-MysqlLog "MySQL did not become ready on $($script:MysqlPort); see $($script:MysqlLogDir)." 'Error'
        return $false
    }
    if (-not (Set-MysqlRootPassword -BaseDir $baseDir -Password $password)) {
        Write-MysqlLog "Could not set the root password from $($script:MysqlPasswordKey)." 'Error'
        return $false
    }
    Save-MysqlInfo -BaseDir $baseDir
    Write-MysqlLog "MySQL ready on $($script:MysqlHost):$($script:MysqlPort) (data: $($script:MysqlDataDir))." 'Success'
    return $true
}
