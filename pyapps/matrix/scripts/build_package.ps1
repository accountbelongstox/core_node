# Matrix Application Packaging Script (PowerShell Wrapper)
# This script wraps the Python packaging script for easy execution from dd.ps1

# Variable declarations
$scriptDir = $PSScriptRoot
$rootDir = (Get-Item $scriptDir).Parent.Parent.Parent.FullName
$pymainPath = Join-Path $rootDir "pymain.py"
$buildScriptPath = Join-Path $scriptDir "build_package.py"

Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 68) -ForegroundColor Cyan
Write-Host " Matrix Application Packaging Script" -ForegroundColor Green
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 68) -ForegroundColor Cyan
Write-Host ""
Write-Host "Root Directory: $rootDir" -ForegroundColor Yellow
Write-Host "Build Script: $buildScriptPath" -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path $buildScriptPath)) {
    Write-Host "Error: Build script not found at: $buildScriptPath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check Python installation
$pythonCmd = $null
$pythonCandidates = @("python", "python3", "py")

foreach ($candidate in $pythonCandidates) {
    try {
        $version = & $candidate --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $pythonCmd = $candidate
            Write-Host "Found Python: $candidate ($version)" -ForegroundColor Green
            break
        }
    }
    catch {
        continue
    }
}

if ($null -eq $pythonCmd) {
    Write-Host "Error: Python not found. Please install Python 3.10 or higher." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Starting packaging process..." -ForegroundColor Cyan
Write-Host ""

# Run the Python packaging script
Set-Location $rootDir
& $pythonCmd $buildScriptPath

$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "=" -NoNewline -ForegroundColor Green
    Write-Host ("=" * 68) -ForegroundColor Green
    Write-Host " Packaging Completed Successfully!" -ForegroundColor Green
    Write-Host "=" -NoNewline -ForegroundColor Green
    Write-Host ("=" * 68) -ForegroundColor Green
} else {
    Write-Host "=" -NoNewline -ForegroundColor Red
    Write-Host ("=" * 68) -ForegroundColor Red
    Write-Host " Packaging Failed" -ForegroundColor Red
    Write-Host "=" -NoNewline -ForegroundColor Red
    Write-Host ("=" * 68) -ForegroundColor Red
}

Write-Host ""
Read-Host "Press Enter to exit"
exit $exitCode
