# Test script to verify Swoole installation methods on Windows
# This script tests different sources for Swoole DLL files

param(
    [Parameter(Mandatory = $true)]
    [string]$PhpPath,
    [Parameter(Mandatory = $true)]
    [string]$InstallDir
)

Write-Host "Testing Swoole installation methods for Windows..." -ForegroundColor Cyan

# Get PHP info
$phpInfoOutput = & $PhpPath -i 2>&1 | Out-String

# Get PHP architecture
$phpArch = "x64"
if ($phpInfoOutput -match 'Architecture.*x86') {
    $phpArch = "x86"
}

# Get PHP thread safety
$phpThreadSafety = "nts"
if ($phpInfoOutput -match 'Thread Safety.*enabled') {
    $phpThreadSafety = "ts"
}

Write-Host "PHP Architecture: $phpArch" -ForegroundColor Yellow
Write-Host "PHP Thread Safety: $phpThreadSafety" -ForegroundColor Yellow

# Get extension directory
$extDirOutput = & $PhpPath -i 2>&1 | Select-String "extension_dir"
$extDir = $null
if ($extDirOutput) {
    $extDirLine = $extDirOutput.ToString()
    Write-Host "Extension dir output: $extDirLine" -ForegroundColor Yellow
    
    # Try different regex patterns
    if ($extDirLine -match 'extension_dir\s*=>\s*([^\s=]+)') {
        $extDir = $matches[1].Trim()
        Write-Host "Matched pattern 1: $extDir" -ForegroundColor Green
    }
    elseif ($extDirLine -match 'extension_dir.*?=>\s*([^\s=]+)') {
        $extDir = $matches[1].Trim()
        Write-Host "Matched pattern 2: $extDir" -ForegroundColor Green
    }
}

if ([string]::IsNullOrEmpty($extDir)) {
    $extDir = Join-Path $InstallDir "ext"
    Write-Host "Using default extension directory: $extDir" -ForegroundColor Yellow
}

Write-Host "Extension Directory: $extDir" -ForegroundColor Cyan

# Test different Swoole versions and sources
$swooleVersions = @("6.1.0", "6.0.0", "5.1.0", "4.8.15", "4.8.0")

Write-Host "`nTesting windows.php.net PECL releases..." -ForegroundColor Cyan
foreach ($version in $swooleVersions) {
    $dllUrl = "https://windows.php.net/downloads/pecl/releases/swoole/$version/php_swoole-$version-$phpThreadSafety-$phpArch.dll"
    Write-Host "Testing: $dllUrl" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri $dllUrl -Method Head -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✓ Available" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "  ✗ Not found (Status: $($_.Exception.Response.StatusCode.value__))" -ForegroundColor Red
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
$peclSnapshotsUrl = "https://windows.php.net/downloads/pecl/snaps/swoole/"
Write-Host "Testing PECL snapshots: $peclSnapshotsUrl" -ForegroundColor Yellow
try {
    $snapshotsResponse = Invoke-WebRequest -Uri $peclSnapshotsUrl -UseBasicParsing -ErrorAction Stop
    Write-Host "  ✓ Snapshots page accessible" -ForegroundColor Green
}
catch {
    Write-Host "  ✗ Snapshots page not accessible" -ForegroundColor Red
}

Write-Host "`nTest completed." -ForegroundColor Cyan
