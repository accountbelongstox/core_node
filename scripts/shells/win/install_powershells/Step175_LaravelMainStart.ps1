param([switch]$CertificatesOnly)

$STEP_NUMBER = 175
$installDirectory = Split-Path -Parent $PSCommandPath
$winDirectory = Split-Path -Parent $installDirectory
$commonDirectory = Join-Path $winDirectory 'win_common'
$managerPath = Join-Path $commonDirectory 'FrankenPhpManager.ps1'
$certificateManagerPath = Join-Path $commonDirectory 'FrankenPhpCertificateManager.ps1'
$step93Path = Join-Path $installDirectory 'Step93_InstallFrankenPHP.ps1'
$step94Path = Join-Path $installDirectory 'Step94_InstallComposer.ps1'
$step96Path = Join-Path $installDirectory 'Step96_ConfigurePHP85.ps1'
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
. $managerPath
. $certificateManagerPath

$laravelDirectory = Get-FrankenPhpLaravelDirectory
$phpPath = Get-FrankenPhpPhpPath
$composerPath = Get-FrankenPhpComposerPath
$artisanPath = Join-Path $laravelDirectory 'artisan'
$vendorAutoloadPath = Join-Path (Join-Path $laravelDirectory 'vendor') 'autoload.php'
$workerPath = Join-Path (Join-Path $laravelDirectory 'public') 'frankenphp-worker.php'
$env:PHP_INI_SCAN_DIR = Split-Path -Parent (Get-FrankenPhpPhpIniPath)

Write-FrankenPhpLog -Message "Step ${STEP_NUMBER}: converging the Laravel FrankenPHP deployment."

if ($CertificatesOnly) {
    Invoke-FrankenPhpCertificateRenewal | Out-Null
    if (Test-FrankenPhpLanOnlyHost) {
        Ensure-FrankenPhpLanLocalCertificates | Out-Null
    }
    Ensure-FrankenPhpLanLocalRoute | Out-Null
    Ensure-FrankenPhpDomainRoutes | Out-Null
    Ensure-FrankenPhpCaddyfile | Out-Null
    Invoke-FrankenPhpReload | Out-Null
    return
}

if (-not (Test-AdminPrivileges)) {
    Write-FrankenPhpLog -Message "Step ${STEP_NUMBER} installs the Windows service $(Get-FrankenPhpServiceName) and its certificate renewal task: re-run it from an elevated (Administrator) PowerShell." -Type 'Error'
    return
}

& $step93Path
& $step94Path
& $step96Path

if ((Test-Path -LiteralPath $composerPath -PathType Leaf) -and
    (Test-Path -LiteralPath $laravelDirectory -PathType Container)) {
    Push-Location $laravelDirectory
    try {
        & $composerPath install --no-interaction --prefer-dist --optimize-autoloader
    }
    finally {
        Pop-Location
    }
}
if (-not (Test-Path -LiteralPath $vendorAutoloadPath -PathType Leaf)) {
    Write-FrankenPhpLog -Message "Composer dependency postcondition failed: $vendorAutoloadPath" -Type 'Error'
}

if ((Test-Path -LiteralPath $phpPath -PathType Leaf) -and
    (Test-Path -LiteralPath $artisanPath -PathType Leaf) -and
    -not (Test-Path -LiteralPath $workerPath -PathType Leaf)) {
    Push-Location $laravelDirectory
    try {
        & $phpPath $artisanPath octane:install --server=frankenphp --no-interaction
    }
    finally {
        Pop-Location
    }
}
if (-not (Test-Path -LiteralPath $workerPath -PathType Leaf)) {
    Write-FrankenPhpLog -Message "Octane worker postcondition failed: $workerPath" -Type 'Error'
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
    }
    finally {
        Pop-Location
    }
}

Ensure-FrankenPhpCertificates | Out-Null
Ensure-FrankenPhpCertificateRenewalTask | Out-Null
# LAN/desktop hosts (no public IP bound locally): provision the local
# certificates (mkcert 127.0.0.1 + Tailscale ts.net) and deploy them as Caddy
# HTTPS sites. Additive: public servers skip provisioning and the LAN route
# renders only when certificate material exists, so the server flow is
# unchanged. Mirrors the Linux LAN branch in frankenphp_domain_common.sh.
if (Test-FrankenPhpLanOnlyHost) {
    Ensure-FrankenPhpLanLocalCertificates | Out-Null
}
Ensure-FrankenPhpLanLocalRoute | Out-Null
Ensure-FrankenPhpDomainRoutes | Out-Null
Ensure-FrankenPhpCaddyfile | Out-Null

if ((Test-Path -LiteralPath $vendorAutoloadPath -PathType Leaf) -and
    (Test-Path -LiteralPath $workerPath -PathType Leaf) -and
    (Test-Path -LiteralPath (Get-FrankenPhpCaddyfilePath) -PathType Leaf) -and
    (Test-FrankenPhpDomainRoutesReady)) {
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
    Write-FrankenPhpLog -Message "Step $STEP_NUMBER service postcondition failed." -Type 'Error'
}
