# Python Package Installer for Flutter Bloom Build System
# Handles automated detection and installation of required Python packages

function Invoke-PythonPackageDetectionAndInstall {
    <#
    .SYNOPSIS
    Detects and installs missing Python packages required for Flutter Bloom build system

    .PARAMETER Force
    Force reinstallation of all packages

    .PARAMETER Quiet
    Suppress verbose output

    .RETURNS
    Boolean indicating success or failure
    #>
    [CmdletBinding()]
    param(
        [switch]$Force,
        [switch]$Quiet
    )

    $packageInstallerDir = $PSScriptRoot
    $detectorScript = Join-Path $packageInstallerDir "package_detector.py"
    $logPrefix = "[PYTHON-PACKAGE-INSTALLER]"

    # Check if detector script exists
    if (-not (Test-Path $detectorScript)) {
        Write-Error "$logPrefix Package detector script not found: $detectorScript"
        return $false
    }

    # Check if Python is available
    try {
        $pythonVersion = & python --version 2>&1
        if (-not $Quiet) {
            Write-Host "$logPrefix Python detected: $pythonVersion" -ForegroundColor Green
        }
    }
    catch {
        Write-Error "$logPrefix Python not found in PATH. Please install Python first."
        return $false
    }

    # Run package detection
    if (-not $Quiet) {
        Write-Host "$logPrefix Scanning for missing Python packages..." -ForegroundColor Cyan
    }

    try {
        $detectionOutput = & python "$detectorScript" 2>$null
        $missingPackages = @()

        if ($detectionOutput) {
            $missingPackages = $detectionOutput | Where-Object { $_.Trim() -ne "" }
        }

        # Handle results
        if ($missingPackages.Count -eq 0 -and -not $Force) {
            if (-not $Quiet) {
                Write-Host "$logPrefix All required Python packages are already installed" -ForegroundColor Green
            }
            return $true
        }

        if ($Force -or $missingPackages.Count -gt 0) {
            if ($Force) {
                if (-not $Quiet) {
                    Write-Host "$logPrefix Force mode enabled - reinstalling all packages" -ForegroundColor Yellow
                }
                # Get all packages for force reinstall
                $allPackages = @("Pillow", "PyYAML", "requests", "psutil", "colorama", "pathvalidate")
                $packagesToInstall = $allPackages
            }
            else {
                $packagesToInstall = $missingPackages
            }

            if (-not $Quiet) {
                Write-Host "$logPrefix Installing $($packagesToInstall.Count) packages: $($packagesToInstall -join ', ')" -ForegroundColor Yellow
            }

            # Install packages
            $installArgs = @("install") + $packagesToInstall
            if ($Force) {
                $installArgs += "--force-reinstall"
            }

            $installResult = & pip @installArgs 2>&1

            if ($LASTEXITCODE -eq 0) {
                if (-not $Quiet) {
                    Write-Host "$logPrefix Package installation completed successfully" -ForegroundColor Green
                }

                # Verify installation
                $verificationOutput = & python "$detectorScript" 2>$null
                $stillMissing = @()

                if ($verificationOutput) {
                    $stillMissing = $verificationOutput | Where-Object { $_.Trim() -ne "" }
                }

                if ($stillMissing.Count -eq 0) {
                    if (-not $Quiet) {
                        Write-Host "$logPrefix Installation verification successful" -ForegroundColor Green
                    }
                    return $true
                }
                else {
                    Write-Warning "$logPrefix Some packages may not have installed correctly: $($stillMissing -join ', ')"
                    return $false
                }
            }
            else {
                Write-Error "$logPrefix Package installation failed"
                if (-not $Quiet -and $installResult) {
                    Write-Host "Installation error details:" -ForegroundColor Red
                    $installResult | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
                }
                return $false
            }
        }
    }
    catch {
        Write-Error "$logPrefix Failed to detect or install packages: $($_.Exception.Message)"
        return $false
    }

    return $true
}

function Test-PythonPackageInstaller {
    <#
    .SYNOPSIS
    Test function for the Python package installer system
    #>
    Write-Host "[TEST] Testing Python package installer system..." -ForegroundColor Magenta

    $result = Invoke-PythonPackageDetectionAndInstall -Quiet:$false

    if ($result) {
        Write-Host "[TEST] Python package installer test completed successfully" -ForegroundColor Green
    }
    else {
        Write-Host "[TEST] Python package installer test failed" -ForegroundColor Red
    }

    return $result
}

# Functions are automatically available when dot-sourced
# Export-ModuleMember is only for PowerShell modules, not dot-sourced scripts

# Run test if executed directly (not when dot-sourced)
# Check if script is being executed directly rather than dot-sourced
if ($MyInvocation.InvocationName -eq $MyInvocation.MyCommand.Source) {
    # Only run test when script is executed directly with no parameters or -Test parameter
    if ($args.Count -eq 0 -or $args[0] -eq "-Test") {
        Test-PythonPackageInstaller
    }
}