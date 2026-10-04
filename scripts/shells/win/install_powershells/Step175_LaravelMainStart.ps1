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
$webServerPlane = Get-WebServerPlane

function Set-Step175Failure {
    # One `ERROR: step 175: <reason>` line per failure; the script ends with a non-zero exit.
    param([Parameter(Mandatory = $true)][string]$Reason)
    $script:step175Failed = $true
    [Console]::Error.WriteLine("ERROR: step ${STEP_NUMBER}: $Reason")
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
if ($CertificatesOnly) {
    Invoke-FrankenPhpCertificateRenewal | Out-Null
    if ((Test-FrankenPhpLanOnlyHost) -or (Test-FrankenPhpTailnetConnected)) {
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
# Plane mutual exclusion (Linux DESIGN_TRANSPORT_PLANE.md): only the selected plane's services run.
if ($webServerPlane -ne 'frankenphp') { Disable-WebPlaneService -Name (Get-FrankenPhpServiceName) }
if ($webServerPlane -ne 'nginx') {
    Disable-WebPlaneService -Name (Get-NginxServiceName)
    Disable-WebPlaneService -Name (Get-PhpCgiServiceName)
}
if ($webServerPlane -eq 'none') {
    Write-FrankenPhpLog -Message "Step $STEP_NUMBER complete (START_WEB_SERVER=none: no web server service)." -Type 'Success'
    return
}
if ($webServerPlane -eq 'nginx') {
    if (-not (Ensure-NginxPlane)) {
        Set-Step175Failure -Reason "nginx plane services $(Get-NginxServiceName)/$(Get-PhpCgiServiceName) are not running after convergence"
        exit 1
    }
    Write-FrankenPhpLog -Message "Step $STEP_NUMBER complete." -Type 'Success'
    return
}

Ensure-FrankenPhpCertificates | Out-Null
Ensure-FrankenPhpCertificateRenewalTask | Out-Null
# LAN/desktop hosts and every tailnet member (public servers included):
# provision the local certificates (mkcert 127.0.0.1; the mesh machine name for the
# UI and api.<machine> for Laravel via Tailscale cert + mkcert, or DNS-01 DNSPod under
# Headscale) and deploy them as Caddy HTTPS sites.
# Additive: the public domain routes are untouched. Mirrors
# fm_domain_tailnet_site_ensure in frankenphp_domain_common.sh.
if ((Test-FrankenPhpLanOnlyHost) -or (Test-FrankenPhpTailnetConnected)) {
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
if ($serviceReady) {
    Write-FrankenPhpLog -Message "Step $STEP_NUMBER complete." -Type 'Success'
}
else {
    Set-Step175Failure -Reason "service $(Get-FrankenPhpServiceName) is not running after convergence"
    exit 1
}
