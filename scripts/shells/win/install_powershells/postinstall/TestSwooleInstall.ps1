# Test script to verify Swoole installation methods on Windows
# This script tests different sources for Swoole DLL files

param(
    [Parameter(Mandatory = $true)]
    [string]$PhpPath,
    [Parameter(Mandatory = $true)]
    [string]$InstallDir
)

Write-Host "Testing Swoole installation methods for Windows..." -ForegroundColor Cyan

# PHP build facts straight from PHP (no output scraping)
$phpArch = if (([string](& $PhpPath -r "echo PHP_INT_SIZE;" 2>$null)).Trim() -eq '4') { "x86" } else { "x64" }
$phpThreadSafety = if (([string](& $PhpPath -r "echo PHP_ZTS;" 2>$null)).Trim() -eq '1') { "ts" } else { "nts" }
$phpMinorVersion = ([string](& $PhpPath -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;" 2>$null)).Trim()
$extDir = ([string](& $PhpPath -r "echo ini_get('extension_dir');" 2>$null)).Trim()
if ([string]::IsNullOrEmpty($extDir)) {
    $extDir = Join-Path $InstallDir "ext"
    Write-Host "Using default extension directory: $extDir" -ForegroundColor Yellow
}

Write-Host "PHP Version: $phpMinorVersion" -ForegroundColor Yellow
Write-Host "PHP Architecture: $phpArch" -ForegroundColor Yellow
Write-Host "PHP Thread Safety: $phpThreadSafety" -ForegroundColor Yellow
Write-Host "Extension Directory: $extDir" -ForegroundColor Cyan

# Official Windows PECL builds (same source and naming as PhpPostInstallProcessor.ps1)
. (Join-Path (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "win_common") "ServiceContract.ps1")
$swooleVersion = [string](Get-ServiceContractValue -ContractPath 'versions.swoole_windows')
$releaseUrl = 'https://downloads.php.net/~windows/pecl/releases/swoole'

Write-Host "`nTesting official Windows PECL builds of Swoole $swooleVersion..." -ForegroundColor Cyan
foreach ($vsTag in @('vs17', 'vs16')) {
    $zipUrl = "{0}/{1}/php_swoole-{2}-{3}-{4}-{5}-{6}.zip" -f $releaseUrl, $swooleVersion, $swooleVersion.ToLowerInvariant(), $phpMinorVersion, $phpThreadSafety, $vsTag, $phpArch
    Write-Host "Testing: $zipUrl" -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri $zipUrl -Method Head -UseBasicParsing -ErrorAction Stop | Out-Null
        Write-Host "  [OK] Available" -ForegroundColor Green
    }
    catch {
        Write-Host "  [FAIL] Not found (Status: $($_.Exception.Response.StatusCode.value__))" -ForegroundColor Red
    }
}
# Test GitHub releases
Write-Host "`nTesting GitHub releases..." -ForegroundColor Cyan
$githubReleasesUrl = "https://api.github.com/repos/swoole/swoole-src/releases/latest"
try {
    $githubResponse = Invoke-RestMethod -Uri $githubReleasesUrl -UseBasicParsing
    Write-Host "Latest GitHub release: $($githubResponse.tag_name)" -ForegroundColor Green
    Write-Host "Release assets:" -ForegroundColor Yellow
    foreach ($asset in $githubResponse.assets) {
        Write-Host "  - $($asset.name)" -ForegroundColor Cyan
    }
}
catch {
    Write-Host "Failed to fetch GitHub releases: $($_.Exception.Message)" -ForegroundColor Red
}

# Test alternative sources
Write-Host "`nTesting alternative sources..." -ForegroundColor Cyan

# Test PECL snapshots
$peclSnapshotsUrl = "https://downloads.php.net/~windows/pecl/snaps/swoole/"
Write-Host "Testing PECL snapshots: $peclSnapshotsUrl" -ForegroundColor Yellow
try {
    $snapshotsResponse = Invoke-WebRequest -Uri $peclSnapshotsUrl -UseBasicParsing -ErrorAction Stop
    Write-Host "  [OK] Snapshots page accessible" -ForegroundColor Green
}
catch {
    Write-Host "  [FAIL] Snapshots page not accessible" -ForegroundColor Red
}

Write-Host "`nTest completed." -ForegroundColor Cyan
