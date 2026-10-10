param([switch]$CertificatesOnly)

$STEP_NUMBER = 175
$installDirectory = Split-Path -Parent $PSCommandPath
$winDirectory = Split-Path -Parent $installDirectory
$commonDirectory = Join-Path $winDirectory 'win_common'
$managerPath = Join-Path $commonDirectory 'FrankenPhpManager.ps1'
$certificateManagerPath = Join-Path $commonDirectory 'FrankenPhpCertificateManager.ps1'
$nginxManagerPath = Join-Path $commonDirectory 'NginxManager.ps1'
$webFrankenPhpPath = Join-Path $installDirectory 'Web_FrankenPhp.ps1'
$webComposerPath = Join-Path $installDirectory 'Web_Composer.ps1'
$webConfigurePhp85Path = Join-Path $installDirectory 'Web_ConfigurePhp85.ps1'
$postgresqlManagerPath = Join-Path $commonDirectory 'PostgresqlManager.ps1'
$databaseRedisPath = Join-Path $installDirectory 'Database_Redis.ps1'
$redisEnabled = $true
$redisPort = 0
$repositoryRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $winDirectory))
$uiStartScriptPath = Join-Path (Join-Path (Join-Path (Join-Path $repositoryRoot 'poly_apps') 'pycore_laravel_wordnew_ui') 'scripts') 'start.ps1'
$powerShellPath = Join-Path $PSHOME 'powershell.exe'
$lanOnlyHost = $false
# Git keeps no empty directories; package:discover needs these (Linux twin: LARAVEL_RUNTIME_DIRS).
$laravelRuntimeSubpaths = @(
    'bootstrap\cache',
    'storage\framework\cache\data',
    'storage\framework\sessions',
    'storage\framework\views',
    'storage\framework\testing',
    'storage\logs',
    'storage\app\public',
    'storage\app\private'
)
$laravelRuntimeSubpath = ''
$laravelDirectory = $null
$phpPath = $null
$composerPath = $null
$artisanPath = $null
$vendorAutoloadPath = $null
$workerPath = $null
$serviceReady = $false
$service = $null
$codemartInit = $env:CODEMART_INIT
$codemartInitAnswer = $null
$codemartInitDefault = 'no'
$autoContinueValues = @('1', 'true')
$autoContinue = $autoContinueValues -contains ([string]$env:DD_AUTO_CONTINUE).Trim().ToLowerInvariant()
$interactiveSession = [Environment]::UserInteractive -and -not [Console]::IsInputRedirected
$step175Failed = $false
$phpModules = @()
$commandExit = 0
$webServerPlane = ''
. $managerPath
. $certificateManagerPath
. $nginxManagerPath
. $postgresqlManagerPath
$webServerPlane = Get-WebServerPlane
$redisEnabled = ([string](Get-GlobalVar -key 'START_REDIS' -defaultValue 'true')).Trim().ToLowerInvariant() -ne 'false'
$redisPort = Get-ServiceContractPort -Name 'redis'

function Set-Step175Failure {
    # One `ERROR: step 175: <reason>` line per failure; the script ends with a non-zero exit.
    param([Parameter(Mandatory = $true)][string]$Reason)
    $script:step175Failed = $true
    [Console]::Error.WriteLine("ERROR: step ${STEP_NUMBER}: $Reason")
}

function Test-Step175LoopbackPort {
    param([Parameter(Mandatory = $true)][int]$Port)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $connect = $client.BeginConnect((Get-ServiceContractHost -Name 'loopback'), $Port, $null, $null)
        return ($connect.AsyncWaitHandle.WaitOne(1500, $false) -and $client.Connected)
    }
    catch {
        return $false
    }
    finally {
        $client.Close()
    }
}

$laravelDirectory = Get-FrankenPhpLaravelDirectory
$phpPath = Get-FrankenPhpPhpPath
$composerPath = Get-FrankenPhpComposerPath
$artisanPath = Join-Path $laravelDirectory 'artisan'
$vendorAutoloadPath = Join-Path (Join-Path $laravelDirectory 'vendor') 'autoload.php'
$workerPath = Join-Path (Join-Path $laravelDirectory 'public') 'frankenphp-worker.php'
$env:PHP_INI_SCAN_DIR = Split-Path -Parent (Get-FrankenPhpPhpIniPath)

Write-FrankenPhpLog -Message "Step ${STEP_NUMBER}: converging the Laravel deployment (web server plane: $webServerPlane)."

if ($CertificatesOnly -and $webServerPlane -ne 'frankenphp') {
    Write-FrankenPhpLog -Message "Certificates are managed by the FrankenPHP plane only (START_WEB_SERVER=$webServerPlane)."
    return
}
$lanOnlyHost = Test-FrankenPhpLanOnlyHost
if ($CertificatesOnly) {
    # Public-domain ACME (api.<prefix>.<root> and the UI hosts) only on a server;
    # a LAN host without a public address keeps only its mesh/local certificates.
    if (-not $lanOnlyHost) {
        Invoke-FrankenPhpCertificateRenewal | Out-Null
    }
    if ($lanOnlyHost -or (Test-FrankenPhpTailnetConnected)) {
        Ensure-FrankenPhpLanLocalCertificates | Out-Null
    }
    Ensure-FrankenPhpLanLocalRoute | Out-Null
    Ensure-FrankenPhpDomainRoutes | Out-Null
    Ensure-FrankenPhpCaddyfile | Out-Null
    Invoke-FrankenPhpReload | Out-Null
    return
}

if (-not (Ensure-LaravelBookSeedExtracted)) {
    Write-FrankenPhpLog -Message "Book seed corpus is not ready; sys:init will report step ${STEP_NUMBER}." -Type 'Warning'
}

if (-not (Test-AdminPrivileges)) {
    Set-Step175Failure -Reason "an elevated (Administrator) PowerShell is required to install the Windows service $(Get-FrankenPhpServiceName) and its certificate renewal task"
    exit 1
}

if (-not (Test-Path -LiteralPath $laravelDirectory -PathType Container)) {
    Set-Step175Failure -Reason "Laravel directory missing: $laravelDirectory"
    exit 1
}

& $webFrankenPhpPath
& $webComposerPath
& $webConfigurePhp85Path

if (-not (Test-Path -LiteralPath $phpPath -PathType Leaf)) {
    Set-Step175Failure -Reason "PHP is missing after its installer: $phpPath"
}
elseif (-not (Test-Path -LiteralPath $composerPath -PathType Leaf)) {
    Set-Step175Failure -Reason "Composer is missing after its installer: $composerPath"
}
else {
    $phpModules = @(& $phpPath -m)
    if ($phpModules -notcontains 'pdo_pgsql') {
        Set-Step175Failure -Reason 'pdo_pgsql is not loaded by the configured PHP (Web_ConfigurePhp85.ps1 must enable it)'
    }
}

# Laravel boots (package:discover, every artisan call) only with the runtime web access
# config; Linux twin: web_access_config_ensure before composer.
if (-not $step175Failed -and -not (Ensure-FrankenPhpWebAccessConfiguration)) {
    Set-Step175Failure -Reason "web access config postcondition failed: $(Get-FrankenPhpWebAccessConfigurationPath)"
}
foreach ($laravelRuntimeSubpath in $laravelRuntimeSubpaths) {
    if (-not (Ensure-FrankenPhpDirectory -Path (Join-Path $laravelDirectory $laravelRuntimeSubpath))) {
        Set-Step175Failure -Reason "Laravel runtime directory postcondition failed: $(Join-Path $laravelDirectory $laravelRuntimeSubpath)"
    }
}

if (-not $step175Failed) {
    Push-Location $laravelDirectory
    try {
        & $composerPath install --no-interaction --prefer-dist --optimize-autoloader
        $commandExit = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    if ($commandExit -ne 0) {
        Set-Step175Failure -Reason "composer install failed (exit $commandExit) in $laravelDirectory"
    }
    elseif (-not (Test-Path -LiteralPath $vendorAutoloadPath -PathType Leaf)) {
        Set-Step175Failure -Reason "composer dependency postcondition failed: $vendorAutoloadPath"
    }
}

if (-not $step175Failed -and $webServerPlane -eq 'frankenphp' -and
    (Test-Path -LiteralPath $artisanPath -PathType Leaf) -and
    -not (Test-Path -LiteralPath $workerPath -PathType Leaf)) {
    Push-Location $laravelDirectory
    try {
        & $phpPath $artisanPath octane:install --server=frankenphp --no-interaction
        $commandExit = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    if ($commandExit -ne 0) {
        Set-Step175Failure -Reason "artisan octane:install failed (exit $commandExit)"
    }
}
if (-not $step175Failed -and $webServerPlane -eq 'frankenphp' -and -not (Test-Path -LiteralPath $workerPath -PathType Leaf)) {
    Set-Step175Failure -Reason "Octane worker postcondition failed: $workerPath"
}

if ($step175Failed) { exit 1 }

# Data services sys:init needs (Linux twin: redis_endpoint_ensure + the PostgreSQL
# ensurer). PostgreSQL is always on (Laravel is PostgreSQL-only); a server already on
# :5432 is reused. Redis follows START_REDIS (default true): a running endpoint is
# reused, otherwise the native installer installs/repairs and starts its service.
Resolve-PgDataDir | Out-Null
if (-not (Ensure-Postgresql)) {
    Set-Step175Failure -Reason "PostgreSQL is not serving on $($Global:PG_HOST):$($Global:PG_PORT) with the app databases"
    exit 1
}
if ($redisEnabled -and -not (Test-Step175LoopbackPort -Port $redisPort)) {
    & $databaseRedisPath
    if (-not (Test-Step175LoopbackPort -Port $redisPort)) {
        Set-Step175Failure -Reason "Redis is not serving on port $redisPort after $databaseRedisPath"
        exit 1
    }
}

# A failed sys:init stops the run because every following database operation assumes
# the base schema exists. This matches the Linux step 175 ordering.
Write-FrankenPhpLog -Message 'Initializing system (php artisan sys:init).'
Push-Location $laravelDirectory
try {
    & $phpPath $artisanPath sys:init --no-interaction
    $commandExit = $LASTEXITCODE
}
finally {
    Pop-Location
}
if ($commandExit -ne 0) {
    Set-Step175Failure -Reason "artisan sys:init failed (exit $commandExit)"
    exit 1
}

# Optional: force CodeMart demo data via `php artisan sys:codemartinit` (idempotent).
# sys:init already seeds it unless the environment is production or
# CODEMART_SEED_DEMO=false. Defaults to N; CODEMART_INIT (yes|no) skips the prompt, and
# DD_AUTO_CONTINUE=1|true or a non-interactive session takes the default without asking.
if ([string]::IsNullOrEmpty($codemartInit)) {
    if ($autoContinue -or -not $interactiveSession) {
        $codemartInit = $codemartInitDefault
        Write-FrankenPhpLog -Message "CodeMart demo data seeding: non-interactive run, using default '$codemartInitDefault'."
    }
    else {
        $codemartInitAnswer = Read-Host 'Force CodeMart demo data seeding (php artisan sys:codemartinit)? [y/N]'
        if ($codemartInitAnswer -match '^(?i:y|yes)$') {
            $codemartInit = 'yes'
        }
        else {
            $codemartInit = $codemartInitDefault
        }
    }
}
if ($codemartInit -eq 'yes' -and (Test-Path -LiteralPath $artisanPath -PathType Leaf)) {
    Write-FrankenPhpLog -Message 'Seeding CodeMart demo data (php artisan sys:codemartinit).'
    Push-Location $laravelDirectory
    try {
        & $phpPath $artisanPath sys:codemartinit
        $commandExit = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    if ($commandExit -ne 0) {
        Set-Step175Failure -Reason "artisan sys:codemartinit failed (exit $commandExit)"
        exit 1
    }
}

# Mesh VPN node for every plane (the FrankenPHP plane also deploys its tailnet HTTPS sites below).
Invoke-MeshProviderConverge -SkipSite -NoInteractive | Out-Null

# Dashboard frontend service (Vite dev server, hot reload) on every plane, idempotent:
# listening = no-op; stuck/stopped = port reserved + restart; absent = register.
& $powerShellPath -NoProfile -ExecutionPolicy Bypass -File $uiStartScriptPath -Service -NoBackend -NonInteractive
$commandExit = $LASTEXITCODE
if ($commandExit -ne 0) {
    Set-Step175Failure -Reason "dashboard frontend service (port $(Get-ServiceContractPort -Name 'nexus_dash_frontend')) failed (exit $commandExit): $uiStartScriptPath -Service"
}

# Plane mutual exclusion (Linux DESIGN_TRANSPORT_PLANE.md): only the selected plane's services run.
if ($webServerPlane -ne 'frankenphp') { Disable-WebPlaneService -Name (Get-FrankenPhpServiceName) }
if ($webServerPlane -ne 'nginx') {
    Disable-WebPlaneService -Name (Get-NginxServiceName)
    Disable-WebPlaneService -Name (Get-PhpCgiServiceName)
}
if ($webServerPlane -eq 'none') {
    if ($step175Failed) { exit 1 }
    Write-FrankenPhpLog -Message "Step $STEP_NUMBER complete (START_WEB_SERVER=none: no web server service)." -Type 'Success'
    return
}
if ($webServerPlane -eq 'nginx') {
    if (-not (Ensure-NginxPlane)) {
        Set-Step175Failure -Reason "nginx plane services $(Get-NginxServiceName)/$(Get-PhpCgiServiceName) are not running after convergence"
        exit 1
    }
    if ($step175Failed) { exit 1 }
    Write-FrankenPhpLog -Message "Step $STEP_NUMBER complete." -Type 'Success'
    return
}

if (-not $lanOnlyHost) {
    Ensure-FrankenPhpCertificates | Out-Null
}
Ensure-FrankenPhpCertificateRenewalTask | Out-Null
# LAN/desktop hosts and every tailnet member (public servers included):
# provision the local certificates (mkcert 127.0.0.1; the mesh machine name for the
# UI and api.<machine> for Laravel via Tailscale cert + mkcert, or DNS-01 DNSPod under
# Headscale) and deploy them as Caddy HTTPS sites.
# Additive: the public domain routes are untouched. Mirrors
# fm_domain_tailnet_site_ensure in frankenphp_domain_common.sh.
if ($lanOnlyHost -or (Test-FrankenPhpTailnetConnected)) {
    Ensure-FrankenPhpLanLocalCertificates | Out-Null
}
Ensure-FrankenPhpLanLocalRoute | Out-Null
Ensure-FrankenPhpDomainRoutes | Out-Null
Ensure-FrankenPhpCaddyfile | Out-Null

if ((Test-Path -LiteralPath $vendorAutoloadPath -PathType Leaf) -and
    (Test-Path -LiteralPath $workerPath -PathType Leaf) -and
    (Test-Path -LiteralPath (Get-FrankenPhpCaddyfilePath) -PathType Leaf) -and
    (Test-FrankenPhpDomainRoutesReady)) {
    Enable-WebPlaneService -Name (Get-FrankenPhpServiceName)
    Ensure-FrankenPhpWindowsService | Out-Null
}
$service = Get-Service -Name (Get-FrankenPhpServiceName) -ErrorAction SilentlyContinue
if ($null -ne $service) {
    $service.Refresh()
}
$serviceReady = $null -ne $service -and $service.Status -eq 'Running'
if (-not $serviceReady) {
    Set-Step175Failure -Reason "service $(Get-FrankenPhpServiceName) is not running after convergence"
}

if ($step175Failed) { exit 1 }
Write-FrankenPhpLog -Message "Step $STEP_NUMBER complete." -Type 'Success'
