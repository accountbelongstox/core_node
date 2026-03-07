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

# Node.js Post-Installation Processor
# Handles pnpm and yarn installation, npm configuration
# Enhanced with automatic repair and validation

# Import required modules
$parentDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
. "$parentDir\win_common\GlobalVars.ps1"
. "$parentDir\win_common\CommonFunc.ps1"

function Install-PnpmAndYarn {
    param (
        [Parameter(Mandatory = $true)]
        [string]$NodePath,
        [Parameter(Mandatory = $true)]
        [string]$NpmPath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [string]$LogPrefix = "[Node-PackageManagers]"
    )

    Write-Host "$LogPrefix Installing pnpm and yarn package managers..." -ForegroundColor Cyan

    # Validate paths
    if (-not (Test-Path $NodePath)) {
        Write-Host "$LogPrefix ERROR: Node.js executable not found: $NodePath" -ForegroundColor Red
        return $false
    }

    if (-not (Test-Path $NpmPath)) {
        Write-Host "$LogPrefix ERROR: npm executable not found: $NpmPath" -ForegroundColor Red
        return $false
    }

    # Install pnpm
    Write-Host "$LogPrefix Installing pnpm..." -ForegroundColor Yellow
    $pnpmPath = Join-Path $InstallDir "pnpm.cmd"

    if (Test-Path $pnpmPath) {
        Write-Host "$LogPrefix pnpm already installed at: $pnpmPath" -ForegroundColor Green
    } else {
        & $NpmPath install -g pnpm
        if (Test-Path $pnpmPath) {
            Write-Host "$LogPrefix pnpm installed successfully" -ForegroundColor Green
        } else {
            Write-Host "$LogPrefix WARNING: pnpm installation may have failed" -ForegroundColor Yellow
        }
    }

    if (Test-Path $pnpmPath) {
        Write-Host "$LogPrefix Running pnpm setup..." -ForegroundColor Yellow
        Write-Host "Y" | & $pnpmPath setup
        Write-Host "$LogPrefix pnpm setup completed" -ForegroundColor Green

        # Always ensure pnpm global bin directory is in PATH (repair step)
        # Add-Path function handles duplicate checking internally
        try {
            $pnpmGlobalBinDir = & $pnpmPath config get global-bin-dir 2>&1 | Select-Object -First 1
            if (-not [string]::IsNullOrEmpty($pnpmGlobalBinDir) -and $pnpmGlobalBinDir -ne "undefined") {
                if (Test-Path $pnpmGlobalBinDir) {
                    $parentDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
                    $windowsPathFunctionPath = Join-Path $parentDir "win_common\WindowsPathFunction.ps1"
                    if (Test-Path $windowsPathFunctionPath) {
                        . $windowsPathFunctionPath
                        Write-Host "$LogPrefix Ensuring pnpm global bin directory is in PATH: $pnpmGlobalBinDir" -ForegroundColor Yellow
                        Add-Path -newPath $pnpmGlobalBinDir
                        Write-Host "$LogPrefix pnpm global bin directory PATH check completed" -ForegroundColor Green
                    } else {
                        Write-Host "$LogPrefix Warning: WindowsPathFunction.ps1 not found, cannot add pnpm bin to PATH" -ForegroundColor Yellow
                    }
                } else {
                    Write-Host "$LogPrefix Warning: pnpm global bin directory does not exist yet: $pnpmGlobalBinDir" -ForegroundColor Yellow
                    Write-Host "$LogPrefix Will be added to PATH when directory is created" -ForegroundColor Cyan
                }
            }
        } catch {
            Write-Host "$LogPrefix Warning: Failed to ensure pnpm bin in PATH: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    # Install yarn
    Write-Host "$LogPrefix Installing yarn..." -ForegroundColor Yellow
    $yarnPath = Join-Path $InstallDir "yarn.cmd"

    if (Test-Path $yarnPath) {
        Write-Host "$LogPrefix yarn already installed at: $yarnPath" -ForegroundColor Green
    } else {
        & $NpmPath install -g yarn
        if (Test-Path $yarnPath) {
            Write-Host "$LogPrefix yarn installed successfully" -ForegroundColor Green
        } else {
            Write-Host "$LogPrefix WARNING: yarn installation may have failed" -ForegroundColor Yellow
        }
    }

    return $true
}

function Test-NodeConfiguration {
    param(
        [Parameter(Mandatory = $true)]
        [string]$NodePath,
        [string]$LogPrefix = "[Node-Test]"
    )

    Write-Host "$LogPrefix Testing Node.js configuration..." -ForegroundColor Cyan

    try {
        # Test Node.js version
        $versionOutput = & $NodePath --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "$LogPrefix Node.js version: $versionOutput" -ForegroundColor Green
        } else {
            Write-Host "$LogPrefix Node.js version check failed: $versionOutput" -ForegroundColor Red
            return $false
        }

        # Test npm
        $npmPath = Join-Path (Split-Path -Parent $NodePath) "npm.cmd"
        if (Test-Path $npmPath) {
            $npmVersion = & $npmPath --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "$LogPrefix npm version: $npmVersion" -ForegroundColor Green
            }
        }

        # Test pnpm
        $pnpmPath = Join-Path (Split-Path -Parent $NodePath) "pnpm.cmd"
        if (Test-Path $pnpmPath) {
            $pnpmVersion = & $pnpmPath --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "$LogPrefix pnpm version: $pnpmVersion" -ForegroundColor Green
            }
        } else {
            Write-Host "$LogPrefix pnpm not installed" -ForegroundColor Yellow
        }

        # Test yarn
        $yarnPath = Join-Path (Split-Path -Parent $NodePath) "yarn.cmd"
        if (Test-Path $yarnPath) {
            $yarnVersion = & $yarnPath --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "$LogPrefix yarn version: $yarnVersion" -ForegroundColor Green
            }
        } else {
            Write-Host "$LogPrefix yarn not installed" -ForegroundColor Yellow
        }

        return $true
    }
    catch {
        Write-Host "$LogPrefix Node.js configuration test failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Invoke-NodePostInstallProcessor {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$NodeCallback,
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [Parameter(Mandatory = $false)]
        [string]$LogPrefix = "[Node-PostInstall]"
    )

    Write-Host "$LogPrefix Processing Node.js post-installation for $PackageName" -ForegroundColor Cyan

    $nodeOperation = if ($NodeCallback.ContainsKey("Operation")) { $NodeCallback.Operation } else { "" }

    if ([string]::IsNullOrEmpty($nodeOperation)) {
        Write-Host "$LogPrefix ERROR: Node callback missing Operation parameter" -ForegroundColor Red
        return $false
    }

    Write-Host "$LogPrefix Node.js Operation: $nodeOperation" -ForegroundColor Cyan

    $success = $false

    switch ($nodeOperation.ToLower()) {
        "install_pnpm_yarn" {
            Write-Host "$LogPrefix Installing pnpm and yarn..." -ForegroundColor Yellow

            # Get npm path (should be in same directory as node.exe)
            $npmPath = Join-Path $InstallDir "npm.cmd"

            if (-not (Test-Path $npmPath)) {
                Write-Host "$LogPrefix ERROR: npm.cmd not found at: $npmPath" -ForegroundColor Red
                return $false
            }

            # Install package managers
            $success = Install-PnpmAndYarn -NodePath $ExecutablePath -NpmPath $npmPath -InstallDir $InstallDir -LogPrefix $LogPrefix

            # Test configuration
            if ($success) {
                $testSuccess = Test-NodeConfiguration -NodePath $ExecutablePath -LogPrefix $LogPrefix
                if (-not $testSuccess) {
                    Write-Host "$LogPrefix WARNING: Node.js configuration test failed, but installation completed" -ForegroundColor Yellow
                }
            }
        }
        default {
            Write-Host "$LogPrefix ERROR: Unknown Node.js operation: $nodeOperation" -ForegroundColor Red
            return $false
        }
    }

    if ($success) {
        Write-Host "$LogPrefix Node.js post-installation completed successfully" -ForegroundColor Green
    } else {
        Write-Host "$LogPrefix Node.js post-installation failed" -ForegroundColor Red
    }

    return $success
}
