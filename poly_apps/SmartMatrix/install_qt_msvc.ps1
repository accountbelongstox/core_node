# Qt 6.9.3 MSVC 2022 64-bit Installation Script
# This script downloads and installs Qt 6.9.3 with MSVC 2022 64-bit support

param(
    [string]$QtInstallPath = "D:\.dev_win11\Qt",
    [switch]$Force = $false
)

Write-Host "=== Qt 6.9.3 MSVC 2022 64-bit Installation Script ===" -ForegroundColor Green

# Set error action preference
$ErrorActionPreference = "Stop"

# Check if Qt MSVC version already exists
$QtMsvcPath = Join-Path $QtInstallPath "6.9.3\msvc2022_64"
if ((Test-Path $QtMsvcPath) -and -not $Force) {
    Write-Host "Qt 6.9.3 MSVC 2022 64-bit already exists at: $QtMsvcPath" -ForegroundColor Yellow
    Write-Host "Use -Force to reinstall" -ForegroundColor Yellow
    exit 0
}

Write-Host "Qt MSVC installation path: $QtMsvcPath" -ForegroundColor Yellow

# Check if Qt Maintenance Tool exists
$QtMaintenanceTool = Join-Path $QtInstallPath "MaintenanceTool.exe"
if (-not (Test-Path $QtMaintenanceTool)) {
    Write-Error "Qt Maintenance Tool not found at: $QtMaintenanceTool"
    Write-Host "Please install Qt first using the online installer from https://www.qt.io/download" -ForegroundColor Yellow
    exit 1
}

Write-Host "Found Qt Maintenance Tool at: $QtMaintenanceTool" -ForegroundColor Green

# Create installation command
$InstallCommand = @(
    "--accept-licenses",
    "--accept-messages",
    "--confirm-command",
    "install",
    "qt.qt6.693.win64_msvc2022_64"
)

Write-Host "Installing Qt 6.9.3 MSVC 2022 64-bit..." -ForegroundColor Yellow
Write-Host "Command: $QtMaintenanceTool $($InstallCommand -join ' ')" -ForegroundColor Cyan

try {
    # Run the installation
    & $QtMaintenanceTool @InstallCommand
    
    if ($LASTEXITCODE -ne 0) {
        throw "Qt installation failed with exit code: $LASTEXITCODE"
    }
    
    # Verify installation
    if (Test-Path $QtMsvcPath) {
        Write-Host "Qt 6.9.3 MSVC 2022 64-bit installed successfully!" -ForegroundColor Green
        Write-Host "Installation path: $QtMsvcPath" -ForegroundColor Green
        
        # List installed components
        Write-Host "Installed components:" -ForegroundColor Yellow
        Get-ChildItem $QtMsvcPath -Directory | ForEach-Object { 
            Write-Host "  - $($_.Name)" -ForegroundColor Cyan 
        }
    } else {
        throw "Installation verification failed - directory not found: $QtMsvcPath"
    }
    
} catch {
    Write-Error "Installation failed: $_"
    Write-Host "You may need to run this script as Administrator" -ForegroundColor Yellow
    exit 1
}

Write-Host "=== Installation completed successfully! ===" -ForegroundColor Green
Write-Host "You can now run the build script with MSVC 2022 64-bit support" -ForegroundColor Green
