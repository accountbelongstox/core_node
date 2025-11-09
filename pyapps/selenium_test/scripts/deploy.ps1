#!/usr/bin/env pwsh
# Selenium Test Application - Deploy Script
# Description: Validates deployment and environment setup

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Deployment Validation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory and project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Split-Path -Parent $ScriptDir
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $AppDir)

$ErrorCount = 0
$WarningCount = 0

function Test-Requirement {
    param(
        [string]$Name,
        [scriptblock]$Test,
        [string]$ErrorMessage,
        [bool]$Critical = $true
    )

    Write-Host -NoNewline "[CHECK] $Name... "
    try {
        $Result = & $Test
        if ($Result) {
            Write-Host "OK" -ForegroundColor Green
            return $true
        } else {
            if ($Critical) {
                Write-Host "FAILED" -ForegroundColor Red
                Write-Host "        $ErrorMessage" -ForegroundColor Red
                $script:ErrorCount++
            } else {
                Write-Host "WARNING" -ForegroundColor Yellow
                Write-Host "        $ErrorMessage" -ForegroundColor Yellow
                $script:WarningCount++
            }
            return $false
        }
    } catch {
        if ($Critical) {
            Write-Host "FAILED" -ForegroundColor Red
            Write-Host "        $ErrorMessage" -ForegroundColor Red
            Write-Host "        Error: $_" -ForegroundColor Red
            $script:ErrorCount++
        } else {
            Write-Host "WARNING" -ForegroundColor Yellow
            Write-Host "        $ErrorMessage" -ForegroundColor Yellow
            $script:WarningCount++
        }
        return $false
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Environment Checks" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Python check
Test-Requirement -Name "Python installation" -Test {
    try {
        $null = python --version 2>&1
        return $true
    } catch {
        return $false
    }
} -ErrorMessage "Python not found in PATH. Install Python 3.8+"

# Pip check
Test-Requirement -Name "pip installation" -Test {
    try {
        $null = python -m pip --version 2>&1
        return $true
    } catch {
        return $false
    }
} -ErrorMessage "pip not found. Run: python -m ensurepip"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Package Checks" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Selenium package
Test-Requirement -Name "selenium package" -Test {
    try {
        $null = python -c "import selenium" 2>&1
        return $?
    } catch {
        return $false
    }
} -ErrorMessage "selenium not installed. Run: pip install selenium"

# webdriver-manager package
Test-Requirement -Name "webdriver-manager package" -Test {
    try {
        $null = python -c "import webdriver_manager" 2>&1
        return $?
    } catch {
        return $false
    }
} -ErrorMessage "webdriver-manager not installed. Run: pip install webdriver-manager"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " PyCore Modules" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test pycore imports
$PyImports = @{
    "pycore.pyfoundations.color_print" = "ColorPrint module"
    "pycore.pylauncher" = "Launcher module"
    "pycore.pyutils.pybrowser" = "PyBrowser module"
}

foreach ($Import in $PyImports.GetEnumerator()) {
    $ModulePath = $Import.Key
    $ModuleName = $Import.Value

    Test-Requirement -Name $ModuleName -Test {
        try {
            $ImportCmd = "import sys; sys.path.insert(0, r'$ProjectRoot'); from $ModulePath import *"
            $null = python -c $ImportCmd 2>&1
            return $?
        } catch {
            return $false
        }
    } -ErrorMessage "$ModulePath not found or has errors"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " File Structure" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Required files
$RequiredFiles = @{
    (Join-Path $AppDir "main.py") = "Main entry point"
    (Join-Path $AppDir "development_analysis.md") = "Development analysis"
    (Join-Path $AppDir "config\launcher_config.json") = "Launcher configuration"
    (Join-Path $AppDir "config\browser_test_config.json") = "Browser test configuration"
}

foreach ($File in $RequiredFiles.GetEnumerator()) {
    $FilePath = $File.Key
    $FileDesc = $File.Value

    Test-Requirement -Name $FileDesc -Test {
        return Test-Path $FilePath
    } -ErrorMessage "Missing file: $FilePath"
}

# Required directories
$RequiredDirs = @{
    (Join-Path $AppDir "config") = "Configuration directory"
    (Join-Path $AppDir "scripts") = "Scripts directory"
}

foreach ($Dir in $RequiredDirs.GetEnumerator()) {
    $DirPath = $Dir.Key
    $DirDesc = $Dir.Value

    Test-Requirement -Name $DirDesc -Test {
        return Test-Path $DirPath
    } -ErrorMessage "Missing directory: $DirPath"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Browser Availability" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Chrome
Test-Requirement -Name "Chrome browser" -Test {
    $ChromePaths = @(
        "C:\Program Files\Google\Chrome\Application\chrome.exe",
        "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    )
    foreach ($Path in $ChromePaths) {
        if (Test-Path $Path) { return $true }
    }
    return $false
} -ErrorMessage "Chrome not found. Download from: https://www.google.com/chrome/" -Critical $false

# Edge
Test-Requirement -Name "Edge browser" -Test {
    $EdgePaths = @(
        "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    )
    foreach ($Path in $EdgePaths) {
        if (Test-Path $Path) { return $true }
    }
    return $false
} -ErrorMessage "Edge not found (usually pre-installed)" -Critical $false

# Firefox
Test-Requirement -Name "Firefox browser" -Test {
    $FirefoxPaths = @(
        "C:\Program Files\Mozilla Firefox\firefox.exe",
        "C:\Program Files (x86)\Mozilla Firefox\firefox.exe"
    )
    foreach ($Path in $FirefoxPaths) {
        if (Test-Path $Path) { return $true }
    }
    return $false
} -ErrorMessage "Firefox not found. Download from: https://www.mozilla.org/firefox/" -Critical $false

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Validation Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($ErrorCount -eq 0 -and $WarningCount -eq 0) {
    Write-Host "✓ All checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Deployment is ready. You can now:" -ForegroundColor Yellow
    Write-Host "  1. Run: .\scripts\start.ps1" -ForegroundColor White
    Write-Host "  2. Or: python pymain.py app=selenium_test" -ForegroundColor White
    Write-Host ""
    exit 0
} elseif ($ErrorCount -eq 0) {
    Write-Host "✓ Critical checks passed (with $WarningCount warning(s))" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Deployment is usable but has warnings:" -ForegroundColor Yellow
    Write-Host "  - Review warnings above" -ForegroundColor White
    Write-Host "  - You can still run: .\scripts\start.ps1" -ForegroundColor White
    Write-Host ""
    exit 0
} else {
    Write-Host "✗ Deployment validation failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Found $ErrorCount error(s) and $WarningCount warning(s)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please fix the errors above before running." -ForegroundColor Yellow
    Write-Host "You can run: .\scripts\install.ps1 to install dependencies" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
