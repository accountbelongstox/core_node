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

$parentDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common"

. (Join-Path $winCommonDir "GlobalVars.ps1")
. (Join-Path $winCommonDir "CommonFunc.ps1")
. (Join-Path $winCommonDir "WindowsPathFunction.ps1")
. (Join-Path $winCommonDir "PackageManagerInvokes.ps1")
. (Join-Path $winCommonDir "PostInstallCallbackProcessor.ps1")

$STEP_NUMBER = 4
$SCRIPT_INDEX = "[Step $STEP_NUMBER]"

# Node.js package definition (extracted from ApplicationsList.ps1)
# IMPORTANT: Use versioned directory to support upgrades
$NodeJSVersion = "24.11.1"
$NodeJSInstallDir = Join-Path $Global:LANG_COMPILER_DIR "node-v$NodeJSVersion"

$NodeJSPackage = @{
    Version                        = $NodeJSVersion
    PackageId                      = "node-v$NodeJSVersion-win-x64"
    Exec                           = "node.exe"
    Name                           = "node"
    Description                    = "Node.js $NodeJSVersion - JavaScript Runtime"
    InstallType                    = "web"
    ForceToInstallDir              = $true
    VerifySuffix                   = "--version"
    URL                            = "https://nodejs.org/dist/v$NodeJSVersion/node-v$NodeJSVersion-win-x64.zip"
    ArchiveType                    = "zip"
    ArchiveRootFolder              = "node-v$NodeJSVersion-win-x64"
    AppCustomInstallDir            = $NodeJSInstallDir
    EnvVars                        = @(
        @{
            Type    = @("Path")
            Keyword = @("node.exe")
        }
    )
    DesktopShortcuts               = $null
    PostInstallCallbacks = @(
        @{
            Type       = "node"
            Operation  = "install_pnpm_yarn"
            Description = "Install pnpm and yarn package managers"
        }
    )
}

# Define paths using versioned directory
$NodeExePath = Join-Path $NodeJSInstallDir "node.exe"
$NpmExePath = Join-Path $NodeJSInstallDir "npm.cmd"
$PnpmExePath = Join-Path $NodeJSInstallDir "pnpm.cmd"
$YarnExePath = Join-Path $NodeJSInstallDir "yarn.cmd"

# Get WindowsPathFunction.ps1 path for PATH management
$windowsPathFunctionPath = Join-Path $winCommonDir "WindowsPathFunction.ps1"

function Remove-OldNodeVersions {
    Write-ColorMessage -Message "$SCRIPT_INDEX Checking for old Node.js versions..." -Type "Info"

    # Scan for old Node.js installations
    $langCompilerDir = $Global:LANG_COMPILER_DIR
    if (-not (Test-Path $langCompilerDir)) {
        Write-ColorMessage -Message "$SCRIPT_INDEX No previous installations found" -Type "Info"
        return
    }

    # Find all node directories (both versioned and non-versioned)
    $oldNodeDirs = Get-ChildItem -Path $langCompilerDir -Directory -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -match '^node(-v[\d\.]+)?$' -and $_.FullName -ne $NodeJSInstallDir
    }

    if ($oldNodeDirs.Count -eq 0) {
        Write-ColorMessage -Message "$SCRIPT_INDEX No old Node.js versions found" -Type "Info"
        return
    }

    Write-ColorMessage -Message "$SCRIPT_INDEX Found $($oldNodeDirs.Count) old Node.js installation(s):" -Type "Warning"
    foreach ($oldDir in $oldNodeDirs) {
        Write-ColorMessage -Message "$SCRIPT_INDEX   - $($oldDir.FullName)" -Type "Warning"

        # Remove from PATH using WindowsPathFunction.ps1
        Write-ColorMessage -Message "$SCRIPT_INDEX   Removing from PATH..." -Type "Info"
        & $windowsPathFunctionPath "remove" $oldDir.FullName

        # Ask before deleting directory
        Write-ColorMessage -Message "$SCRIPT_INDEX   Delete old installation? (y/N, timeout 5s, default: N)" -Type "Warning"
        $stopWatch = [System.Diagnostics.Stopwatch]::StartNew()
        $timeout = 5
        $shouldDelete = $false

        while ($stopWatch.Elapsed.TotalSeconds -lt $timeout -and !$host.UI.RawUI.KeyAvailable) {
            Start-Sleep -Milliseconds 200
        }

        if ($host.UI.RawUI.KeyAvailable) {
            $key = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown").Character
            if ($key -eq 'y' -or $key -eq 'Y') {
                $shouldDelete = $true
            }
        }

        $stopWatch.Stop()

        if ($shouldDelete) {
            try {
                Remove-Item -Path $oldDir.FullName -Recurse -Force -ErrorAction Stop
                Write-ColorMessage -Message "$SCRIPT_INDEX   Deleted: $($oldDir.FullName)" -Type "Success"
            } catch {
                Write-ColorMessage -Message "$SCRIPT_INDEX   Failed to delete: $($_.Exception.Message)" -Type "Error"
            }
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX   Kept old installation (removed from PATH only)" -Type "Info"
        }
    }

    # Refresh PATH
    Write-ColorMessage -Message "$SCRIPT_INDEX Refreshing environment variables..." -Type "Info"
    & $windowsPathFunctionPath "refresh-bat"
}

function Install-NodeJS {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing Node.js v$NodeJSVersion..." -Type "Info"

    # Remove old versions first
    Remove-OldNodeVersions

    # Check if current version already installed
    if (Test-Path $NodeExePath) {
        $existingVersion = & $NodeExePath --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "$SCRIPT_INDEX Node.js already installed: $existingVersion" -Type "Success"
            Write-ColorMessage -Message "$SCRIPT_INDEX Path: $NodeExePath" -Type "Info"

            # Ensure it's in PATH
            Write-ColorMessage -Message "$SCRIPT_INDEX Adding Node.js to PATH..." -Type "Info"
            & $windowsPathFunctionPath "add" $NodeJSInstallDir

            # Run post-install to ensure pnpm/yarn are installed
            try {
                $postInstallSuccess = Invoke-PostInstallCallbacks -Callbacks $NodeJSPackage.PostInstallCallbacks -ExecutablePath $NodeExePath -InstallDir $NodeJSInstallDir -PackageName $NodeJSPackage.Name
                if (-not $postInstallSuccess) {
                    Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: Post-installation had issues" -Type "Warning"
                }
            } catch {
                Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: Post-installation failed: $($_.Exception.Message)" -Type "Warning"
            }

            return $true
        }
    }

    # Ensure installation directory exists
    if (-not (Test-Path $NodeJSInstallDir)) {
        New-Item -ItemType Directory -Path $NodeJSInstallDir -Force | Out-Null
        Write-ColorMessage -Message "$SCRIPT_INDEX Created Node.js installation directory: $NodeJSInstallDir" -Type "Info"
    }

    # Download and install Node.js
    Write-ColorMessage -Message "$SCRIPT_INDEX Downloading Node.js v$NodeJSVersion..." -Type "Warning"
    Write-ColorMessage -Message "$SCRIPT_INDEX URL: $($NodeJSPackage.URL)" -Type "Info"

    $tempZip = Join-Path $env:TEMP "node-v$NodeJSVersion-win-x64.zip"
    $tempExtract = Join-Path $env:TEMP "node-v$NodeJSVersion-extract"

    try {
        # Download
        Invoke-WebRequest -Uri $NodeJSPackage.URL -OutFile $tempZip -UseBasicParsing
        Write-ColorMessage -Message "$SCRIPT_INDEX Downloaded to: $tempZip" -Type "Success"

        # Extract
        Write-ColorMessage -Message "$SCRIPT_INDEX Extracting archive..." -Type "Info"
        if (Test-Path $tempExtract) {
            Remove-Item -Path $tempExtract -Recurse -Force
        }
        Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force

        # Move files to installation directory
        $extractedFolder = Join-Path $tempExtract $NodeJSPackage.ArchiveRootFolder
        if (Test-Path $extractedFolder) {
            Write-ColorMessage -Message "$SCRIPT_INDEX Moving files to: $NodeJSInstallDir" -Type "Info"

            # Copy all files
            Get-ChildItem -Path $extractedFolder -Recurse | ForEach-Object {
                $targetPath = Join-Path $NodeJSInstallDir $_.FullName.Substring($extractedFolder.Length)
                if ($_.PSIsContainer) {
                    if (-not (Test-Path $targetPath)) {
                        New-Item -ItemType Directory -Path $targetPath -Force | Out-Null
                    }
                } else {
                    Copy-Item -Path $_.FullName -Destination $targetPath -Force
                }
            }

            Write-ColorMessage -Message "$SCRIPT_INDEX Files copied successfully" -Type "Success"
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Extracted folder not found: $extractedFolder" -Type "Error"
            return $false
        }

        # Cleanup
        Remove-Item -Path $tempZip -Force -ErrorAction SilentlyContinue
        Remove-Item -Path $tempExtract -Recurse -Force -ErrorAction SilentlyContinue

        # Verify installation
        if (Test-Path $NodeExePath) {
            $installedVersion = & $NodeExePath --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-ColorMessage -Message "$SCRIPT_INDEX Node.js installed successfully: $installedVersion" -Type "Success"
                Write-ColorMessage -Message "$SCRIPT_INDEX Path: $NodeExePath" -Type "Info"

                # Add to PATH using WindowsPathFunction.ps1
                Write-ColorMessage -Message "$SCRIPT_INDEX Adding Node.js to PATH..." -Type "Info"
                & $windowsPathFunctionPath "add" $NodeJSInstallDir

                # Run post-install callbacks (install pnpm and yarn)
                try {
                    $postInstallSuccess = Invoke-PostInstallCallbacks -Callbacks $NodeJSPackage.PostInstallCallbacks -ExecutablePath $NodeExePath -InstallDir $NodeJSInstallDir -PackageName $NodeJSPackage.Name

                    if ($postInstallSuccess) {
                        Write-ColorMessage -Message "$SCRIPT_INDEX Node.js post-installation completed successfully" -Type "Success"
                    } else {
                        Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: Node.js post-installation had issues" -Type "Warning"
                    }
                } catch {
                    Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: Post-installation failed: $($_.Exception.Message)" -Type "Warning"
                }

                return $true
            } else {
                Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Node.js verification failed" -Type "Error"
                return $false
            }
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Node.js executable not found after installation" -Type "Error"
            return $false
        }

    } catch {
        Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Failed to install Node.js: $($_.Exception.Message)" -Type "Error"

        # Cleanup on error
        if (Test-Path $tempZip) { Remove-Item -Path $tempZip -Force -ErrorAction SilentlyContinue }
        if (Test-Path $tempExtract) { Remove-Item -Path $tempExtract -Recurse -Force -ErrorAction SilentlyContinue }

        return $false
    }
}

function Test-NodeJSInstallation {
    Write-ColorMessage -Message "$SCRIPT_INDEX Testing Node.js installation..." -Type "Info"

    # Test Node.js
    if (Test-Path $NodeExePath) {
        $nodeVersion = & $NodeExePath --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "$SCRIPT_INDEX   Node.js: $nodeVersion" -Type "Success"
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX   Node.js: FAILED" -Type "Error"
            return $false
        }
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX   Node.js: NOT FOUND at $NodeExePath" -Type "Error"
        return $false
    }

    # Test npm
    if (Test-Path $NpmExePath) {
        $npmVersion = & $NpmExePath --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "$SCRIPT_INDEX   npm: $npmVersion" -Type "Success"
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX   npm: FAILED" -Type "Warning"
        }
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX   npm: NOT FOUND" -Type "Warning"
    }

    # Test pnpm
    if (Test-Path $PnpmExePath) {
        $pnpmVersion = & $PnpmExePath --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "$SCRIPT_INDEX   pnpm: $pnpmVersion" -Type "Success"
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX   pnpm: FAILED" -Type "Warning"
        }
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX   pnpm: NOT FOUND" -Type "Warning"
    }

    # Test yarn
    if (Test-Path $YarnExePath) {
        $yarnVersion = & $YarnExePath --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "$SCRIPT_INDEX   yarn: $yarnVersion" -Type "Success"
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX   yarn: FAILED" -Type "Warning"
        }
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX   yarn: NOT FOUND" -Type "Warning"
    }

    return $true
}

# Main execution
Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Info"
Write-ColorMessage -Message "$SCRIPT_INDEX   Node.js Installation (Step $STEP_NUMBER)" -Type "Info"
Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Info"

$installSuccess = Install-NodeJS

if ($installSuccess) {
    Write-ColorMessage -Message "$SCRIPT_INDEX Node.js installation completed successfully" -Type "Success"

    # Test installation
    $testSuccess = Test-NodeJSInstallation

    if ($testSuccess) {
        Write-ColorMessage -Message "$SCRIPT_INDEX All Node.js components verified successfully" -Type "Success"
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: Some Node.js components failed verification" -Type "Warning"
    }
} else {
    Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Node.js installation failed" -Type "Error"
    exit 1
}

Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Info"
