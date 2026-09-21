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

# Optional: seed CodeMart demo accounts/projects via `php artisan sys:codemartinit`
# (idempotent). Defaults to N; the CODEMART_INIT environment variable (yes|no)
# skips the interactive prompt.
if ([string]::IsNullOrEmpty($codemartInit)) {
    $codemartInitAnswer = Read-Host 'Initialize CodeMart demo data (php artisan sys:codemartinit)? [y/N]'
    if ($codemartInitAnswer -match '^(?i:y|yes)$') {
        $codemartInit = 'yes'
    }
    else {
        $codemartInit = 'no'
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
