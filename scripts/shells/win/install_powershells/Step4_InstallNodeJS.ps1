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
$NodeJSPackage = @{
    Version                        = "24.11.1"
    PackageId                      = "node-v24.11.1-win-x64"
    Exec                           = "node.exe"
    Name                           = "node"
    Description                    = "Node.js 24.11.1 - JavaScript Runtime"
    InstallType                    = "web"
    ForceToInstallDir              = $true
    VerifySuffix                   = "--version"
    URL                            = "https://nodejs.org/dist/v24.11.1/node-v24.11.1-win-x64.zip"
    ArchiveType                    = "zip"
    ArchiveRootFolder              = "node-v24.11.1-win-x64"
    AppCustomInstallDir            = $Global:NODE_DIR
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

function Install-NodeJS {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing Node.js..." -Type "Info"

    # Check if already installed
    if (Test-Path $Global:NODE_EXE_PATH) {
        $existingVersion = & $Global:NODE_EXE_PATH --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "$SCRIPT_INDEX Node.js already installed: $existingVersion" -Type "Success"
            Write-ColorMessage -Message "$SCRIPT_INDEX Path: $($Global:NODE_EXE_PATH)" -Type "Info"

            # Still run post-install to ensure pnpm/yarn are installed
            $postInstallSuccess = Invoke-PostInstallCallbacks -Callbacks $NodeJSPackage.PostInstallCallbacks -ExecutablePath $Global:NODE_EXE_PATH -InstallDir $Global:NODE_DIR -PackageName $NodeJSPackage.Name
            return $true
        }
    }

    # Ensure installation directory exists
    if (-not (Test-Path $Global:NODE_DIR)) {
        New-Item -ItemType Directory -Path $Global:NODE_DIR -Force | Out-Null
        Write-ColorMessage -Message "$SCRIPT_INDEX Created Node.js installation directory: $($Global:NODE_DIR)" -Type "Info"
    }

    # Download and install Node.js
    Write-ColorMessage -Message "$SCRIPT_INDEX Downloading Node.js v$($NodeJSPackage.Version)..." -Type "Warning"
    Write-ColorMessage -Message "$SCRIPT_INDEX URL: $($NodeJSPackage.URL)" -Type "Info"

    $tempZip = Join-Path $env:TEMP "node-v$($NodeJSPackage.Version)-win-x64.zip"
    $tempExtract = Join-Path $env:TEMP "node-v$($NodeJSPackage.Version)-extract"

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
            Write-ColorMessage -Message "$SCRIPT_INDEX Moving files to: $($Global:NODE_DIR)" -Type "Info"

            # Copy all files
            Get-ChildItem -Path $extractedFolder -Recurse | ForEach-Object {
                $targetPath = Join-Path $Global:NODE_DIR $_.FullName.Substring($extractedFolder.Length)
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
        if (Test-Path $Global:NODE_EXE_PATH) {
            $installedVersion = & $Global:NODE_EXE_PATH --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-ColorMessage -Message "$SCRIPT_INDEX Node.js installed successfully: $installedVersion" -Type "Success"
                Write-ColorMessage -Message "$SCRIPT_INDEX Path: $($Global:NODE_EXE_PATH)" -Type "Info"

                # Add to PATH
                Write-ColorMessage -Message "$SCRIPT_INDEX Adding Node.js to PATH..." -Type "Info"
                Add-PathEntry -PathToAdd $Global:NODE_DIR -Scope "Machine"

                # Run post-install callbacks (install pnpm and yarn)
                $postInstallSuccess = Invoke-PostInstallCallbacks -Callbacks $NodeJSPackage.PostInstallCallbacks -ExecutablePath $Global:NODE_EXE_PATH -InstallDir $Global:NODE_DIR -PackageName $NodeJSPackage.Name

                if ($postInstallSuccess) {
                    Write-ColorMessage -Message "$SCRIPT_INDEX Node.js post-installation completed successfully" -Type "Success"
                } else {
                    Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: Node.js post-installation had issues" -Type "Warning"
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
    if (Test-Path $Global:NODE_EXE_PATH) {
        $nodeVersion = & $Global:NODE_EXE_PATH --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "$SCRIPT_INDEX   Node.js: $nodeVersion" -Type "Success"
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX   Node.js: FAILED" -Type "Error"
            return $false
        }
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX   Node.js: NOT FOUND" -Type "Error"
        return $false
    }

    # Test npm
    if (Test-Path $Global:NPM_EXE_PATH) {
        $npmVersion = & $Global:NPM_EXE_PATH --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "$SCRIPT_INDEX   npm: $npmVersion" -Type "Success"
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX   npm: FAILED" -Type "Warning"
        }
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX   npm: NOT FOUND" -Type "Warning"
    }

    # Test pnpm
    if (Test-Path $Global:PNPM_EXE_PATH) {
        $pnpmVersion = & $Global:PNPM_EXE_PATH --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "$SCRIPT_INDEX   pnpm: $pnpmVersion" -Type "Success"
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX   pnpm: FAILED" -Type "Warning"
        }
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX   pnpm: NOT FOUND" -Type "Warning"
    }

    # Test yarn
    if (Test-Path $Global:YARN_EXE_PATH) {
        $yarnVersion = & $Global:YARN_EXE_PATH --version 2>&1
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
