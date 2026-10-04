# Windows nginx web server plane (START_WEB_SERVER=nginx; Linux 33_install_nginx.sh counterpart).
# Official nginx.org Windows ZIP (version from contract versions.nginx) + the native PHP's php-cgi.exe
# FastCGI backend (Web_Php.ps1), each a WinSW service like the FrankenPHP plane. nginx serves
# Laravel public/ on the contract laravel_api_backend port, the same port the FrankenPHP plane uses.
$script:NginxCommonDirectory = Split-Path -Parent $PSCommandPath
if (-not (Get-Command -Name 'Get-ServiceContractValue' -ErrorAction SilentlyContinue)) {
    . (Join-Path $script:NginxCommonDirectory 'ServiceContract.ps1')
}
if (-not (Get-Command -Name 'Install-OfficialArchive' -ErrorAction SilentlyContinue)) {
    . (Join-Path $script:NginxCommonDirectory 'OfficialArchiveCommon.ps1')
}
$script:NginxWinswManagerPath = Join-Path $script:NginxCommonDirectory 'WinswServiceManager.ps1'
$script:NginxRepositoryRoot = [System.IO.Path]::GetFullPath([string]$Global:PROJECT_DIR)
$script:NginxVersion = [string](Get-ServiceContractValue -ContractPath 'versions.nginx')
$script:NginxDownloadUrl = 'https://nginx.org/download/nginx-{0}.zip' -f $script:NginxVersion
$script:NginxInstallDir = Join-Path (Join-Path $Global:LANG_COMPILER_DIR 'nginx') ('nginx-{0}' -f $script:NginxVersion)
$script:NginxExe = Join-Path $script:NginxInstallDir 'nginx.exe'
$script:NginxRuntimeRoot = Join-Path 'D:\www' 'nginx'
$script:NginxConfDir = Join-Path $script:NginxRuntimeRoot 'conf'
$script:NginxLogDir = Join-Path $script:NginxRuntimeRoot 'logs'
$script:NginxTempDir = Join-Path $script:NginxRuntimeRoot 'temp'
$script:NginxServiceDir = Join-Path $script:NginxRuntimeRoot 'service'
$script:NginxConfPath = Join-Path $script:NginxConfDir 'nginx.conf'
$script:NginxLaravelDirectory = Join-Path (Join-Path $script:NginxRepositoryRoot 'poly_apps') 'laravel_main'
$script:NginxLaravelPublicDirectory = Join-Path $script:NginxLaravelDirectory 'public'
$script:NginxServiceName = 'ncore-laravel-nginx'
$script:NginxDisplayName = 'core_node Laravel nginx'
$script:NginxDescription = 'nginx web server plane for core_node Laravel'
$script:PhpCgiExe = Join-Path $Global:PHP_NATIVE_INSTALL_DIR 'php-cgi.exe'
$script:PhpCgiServiceName = 'ncore-laravel-phpcgi'
$script:PhpCgiDisplayName = 'core_node Laravel PHP FastCGI'
$script:PhpCgiDescription = 'php-cgi FastCGI backend for the core_node nginx plane'

function Write-NginxLog {
    param([string]$Message, [string]$Type = 'Info')
    Write-ColorMessage -Message "[nginx] $Message" -Type $Type
}

function ConvertTo-NginxPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    return ($Path -replace '\\', '/')
}

function Get-NginxServiceName { return $script:NginxServiceName }
function Get-PhpCgiServiceName { return $script:PhpCgiServiceName }

function Install-NginxBinaries {
    if (-not (Install-OfficialArchive -Url $script:NginxDownloadUrl -InstallDir $script:NginxInstallDir -VerifyRelativePath 'nginx.exe' -Description "nginx $($script:NginxVersion)")) {
        Write-NginxLog "nginx binaries are not ready: $($script:NginxInstallDir)" 'Error'
        return $false
    }
    Write-NginxLog "Binaries ready: $($script:NginxInstallDir)" 'Success'
    return $true
}

function Ensure-NginxConfig {
    $backendPort = Get-ServiceContractPort -Name 'laravel_api_backend'
    $fastcgiPort = Get-ServiceContractPort -Name 'php_cgi_fastcgi'
    $anyHost = Get-ServiceContractHost -Name 'any'
    $loopback = Get-ServiceContractHost -Name 'loopback'
    $bodySize = [string](Get-ServiceContractValue -ContractPath 'php_runtime.post_max_size')
    $timeout = [int](Get-ServiceContractValue -ContractPath 'php_runtime.max_execution_time_seconds')
    $installConf = ConvertTo-NginxPath -Path (Join-Path $script:NginxInstallDir 'conf')
    $publicPath = ConvertTo-NginxPath -Path $script:NginxLaravelPublicDirectory
    $existing = ''
    # Function-scoped: nginx -t writes normal output on stderr.
    $ErrorActionPreference = 'Continue'
    $content = @"
# Managed by core_node NginxManager.ps1
worker_processes 1;
error_log logs/error.log;
pid logs/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include "$installConf/mime.types";
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 65;
    client_max_body_size $bodySize;
    access_log logs/access.log;
    client_body_temp_path temp/client_body;
    proxy_temp_path temp/proxy;
    fastcgi_temp_path temp/fastcgi;
    uwsgi_temp_path temp/uwsgi;
    scgi_temp_path temp/scgi;

    server {
        listen $anyHost`:$backendPort;
        root "$publicPath";
        index index.php index.html;

        location / {
            try_files `$uri `$uri/ /index.php?`$query_string;
        }

        location ~ \.php$ {
            fastcgi_pass $loopback`:$fastcgiPort;
            fastcgi_index index.php;
            include "$installConf/fastcgi_params";
            fastcgi_param SCRIPT_FILENAME `$document_root`$fastcgi_script_name;
            fastcgi_read_timeout ${timeout}s;
        }

        location ~ /\.(?!well-known) {
            deny all;
        }
    }
}
"@

    foreach ($dir in @($script:NginxConfDir, $script:NginxLogDir, $script:NginxTempDir, $script:NginxServiceDir)) {
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    }
    if (Test-Path -LiteralPath $script:NginxConfPath) { $existing = [System.IO.File]::ReadAllText($script:NginxConfPath) }
    if ($existing -cne $content) {
        [System.IO.File]::WriteAllText($script:NginxConfPath, $content, (New-Object System.Text.UTF8Encoding($false)))
    }
    & $script:NginxExe -t -p ('{0}/' -f (ConvertTo-NginxPath -Path $script:NginxRuntimeRoot)) -c 'conf/nginx.conf' 2>&1 | ForEach-Object { Write-Host "$_" }
    if ($LASTEXITCODE -ne 0) {
        Write-NginxLog "nginx -t rejected $($script:NginxConfPath)" 'Error'
        return $false
    }
    Write-NginxLog "Config ready: $($script:NginxConfPath)" 'Success'
    return $true
}

function Register-NginxPlaneService {
    param([string]$Name, [string]$DisplayName, [string]$Description, [string]$ExePath, [string]$Arguments,
        [string]$WorkingDirectory, [string[]]$Environment = @())
    $winswPath = $null
    $service = $null

    . $script:NginxWinswManagerPath
    Ensure-Winsw -RepoRootDir $script:NginxRepositoryRoot | Out-Null
    $winswPath = Find-WinswExe -RepoRootDir $script:NginxRepositoryRoot
    if ([string]::IsNullOrWhiteSpace([string]$winswPath)) {
        Write-NginxLog 'WinSW binary postcondition failed.' 'Error'
        return $false
    }
    Enable-WebPlaneService -Name $Name
    Register-WinswService -WinswExePath $winswPath -ServiceName $Name -DisplayName $DisplayName -Description $Description `
        -ExePath $ExePath -Arguments $Arguments -WorkingDirectory $WorkingDirectory -EnvironmentExtra $Environment `
        -StdoutLog (Join-Path $script:NginxLogDir "$Name.out.log") -StderrLog (Join-Path $script:NginxLogDir "$Name.err.log") `
        -ServiceDirectory (Join-Path $script:NginxServiceDir $Name) | Out-Null
    $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if ($null -eq $service -or $service.Status -ne 'Running') {
        Write-NginxLog "Service $Name is not running." 'Error'
        return $false
    }
    Write-NginxLog "Windows service running: $Name" 'Success'
    return $true
}

# Re-enables a plane service that a plane switch disabled; a missing service is a no-op.
function Enable-WebPlaneService {
    param([Parameter(Mandatory = $true)][string]$Name)
    if (Get-Service -Name $Name -ErrorAction SilentlyContinue) {
        Set-Service -Name $Name -StartupType Automatic -ErrorAction SilentlyContinue
    }
}

# Stops and disables (never removes) the service of a plane that is not selected; a missing service is a no-op.
function Disable-WebPlaneService {
    param([Parameter(Mandatory = $true)][string]$Name)
    $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if ($null -eq $service) { return }
    if ($service.Status -ne 'Stopped') { Stop-Service -Name $Name -Force -ErrorAction SilentlyContinue }
    Set-Service -Name $Name -StartupType Disabled -ErrorAction SilentlyContinue
    Write-NginxLog "Plane service stopped and disabled: $Name" 'Info'
}

function Ensure-NginxPlane {
    $loopback = Get-ServiceContractHost -Name 'loopback'
    $fastcgiPort = Get-ServiceContractPort -Name 'php_cgi_fastcgi'
    $phpIniScanDir = Split-Path -Parent $script:PhpCgiExe

    if (-not (Test-Path -LiteralPath $script:PhpCgiExe -PathType Leaf)) {
        Write-NginxLog "php-cgi.exe missing: $($script:PhpCgiExe) (run Web_Php.ps1)" 'Error'
        return $false
    }
    if (-not (Install-NginxBinaries)) { return $false }
    if (-not (Ensure-NginxConfig)) { return $false }
    if (-not (Register-NginxPlaneService -Name $script:PhpCgiServiceName -DisplayName $script:PhpCgiDisplayName `
            -Description $script:PhpCgiDescription -ExePath $script:PhpCgiExe -Arguments ('-b {0}:{1}' -f $loopback, $fastcgiPort) `
            -WorkingDirectory $script:NginxLaravelDirectory -Environment @('PHP_FCGI_MAX_REQUESTS=0', ('PHPRC={0}' -f $phpIniScanDir)))) {
        return $false
    }
    return (Register-NginxPlaneService -Name $script:NginxServiceName -DisplayName $script:NginxDisplayName `
            -Description $script:NginxDescription -ExePath $script:NginxExe `
            -Arguments ('-p "{0}/" -c conf/nginx.conf' -f (ConvertTo-NginxPath -Path $script:NginxRuntimeRoot)) `
            -WorkingDirectory $script:NginxRuntimeRoot)
}
