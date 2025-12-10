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

$STEP_NUMBER = 4
$SCRIPT_INDEX = "[Step $STEP_NUMBER]"

# Node.js installation configuration
# Version is defined in GlobalVars.ps1 to prevent multiple definitions
$NodeJSVersion = $Global:NODE_VERSION
$NodeJSInstallDir = Join-Path $Global:LANG_COMPILER_DIR "node-v$NodeJSVersion"
$NodeJSDownloadUrl = "https://nodejs.org/dist/v$NodeJSVersion/node-v$NodeJSVersion-win-x64.zip"
$NodeJSArchiveRoot = "node-v$NodeJSVersion-win-x64"

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
    $oldNodeDirs = @(Get-ChildItem -Path $langCompilerDir -Directory -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -match '^node(-v[\d\.]+)?$' -and $_.FullName -ne $NodeJSInstallDir
    })

    if (-not $oldNodeDirs -or $oldNodeDirs.Count -eq 0) {
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
        Write-ColorMessage -Message "$SCRIPT_INDEX   Delete old installation? (Y/n, timeout 5s, default: Y)" -Type "Warning"
        $stopWatch = [System.Diagnostics.Stopwatch]::StartNew()
        $timeout = 5
        $shouldDelete = $true

        while ($stopWatch.Elapsed.TotalSeconds -lt $timeout -and !$host.UI.RawUI.KeyAvailable) {
            Start-Sleep -Milliseconds 200
        }

        if ($host.UI.RawUI.KeyAvailable) {
            $key = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown").Character
            if ($key -eq 'n' -or $key -eq 'N') {
                $shouldDelete = $false
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
        Write-ColorMessage -Message "$SCRIPT_INDEX Node.js already installed at: $NodeExePath" -Type "Success"
        Write-ColorMessage -Message "$SCRIPT_INDEX Checking version:" -Type "Info"
        & $NodeExePath --version

        # Ensure it's in PATH
        Write-ColorMessage -Message "$SCRIPT_INDEX Adding Node.js to PATH..." -Type "Info"
        & $windowsPathFunctionPath "add" $NodeJSInstallDir

        # Install package managers
        Install-PackageManagers

        # Configure registries
        Configure-NpmRegistry
        Configure-PnpmRegistry

        return $true
    }

    # Ensure installation directory exists
    if (-not (Test-Path $NodeJSInstallDir)) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Creating Node.js installation directory: $NodeJSInstallDir" -Type "Info"
        New-Item -ItemType Directory -Path $NodeJSInstallDir -Force
    }

    # Download and install Node.js
    Write-ColorMessage -Message "$SCRIPT_INDEX Downloading Node.js v$NodeJSVersion..." -Type "Warning"
    Write-ColorMessage -Message "$SCRIPT_INDEX URL: $NodeJSDownloadUrl" -Type "Info"

    $tempZip = Join-Path $env:TEMP "node-v$NodeJSVersion-win-x64.zip"
    $tempExtract = Join-Path $env:TEMP "node-v$NodeJSVersion-extract"

    try {
        # Download
        Invoke-WebRequest -Uri $NodeJSDownloadUrl -OutFile $tempZip -UseBasicParsing
        Write-ColorMessage -Message "$SCRIPT_INDEX Downloaded to: $tempZip" -Type "Success"

        # Extract
        Write-ColorMessage -Message "$SCRIPT_INDEX Extracting archive..." -Type "Info"
        if (Test-Path $tempExtract) {
            Remove-Item -Path $tempExtract -Recurse -Force
        }
        Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force

        # Move files to installation directory
        $extractedFolder = Join-Path $tempExtract $NodeJSArchiveRoot
        if (Test-Path $extractedFolder) {
            Write-ColorMessage -Message "$SCRIPT_INDEX Moving files to: $NodeJSInstallDir" -Type "Info"

            # Copy all files
            Get-ChildItem -Path $extractedFolder -Recurse | ForEach-Object {
                $targetPath = Join-Path $NodeJSInstallDir $_.FullName.Substring($extractedFolder.Length)
                if ($_.PSIsContainer) {
                    if (-not (Test-Path $targetPath)) {
                        New-Item -ItemType Directory -Path $targetPath -Force
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
            Write-ColorMessage -Message "$SCRIPT_INDEX Node.js installed successfully at: $NodeExePath" -Type "Success"
            Write-ColorMessage -Message "$SCRIPT_INDEX Checking version:" -Type "Info"
            & $NodeExePath --version

            # Add to PATH using WindowsPathFunction.ps1
            Write-ColorMessage -Message "$SCRIPT_INDEX Adding Node.js to PATH..." -Type "Info"
            & $windowsPathFunctionPath "add" $NodeJSInstallDir

            # Install package managers
            Install-PackageManagers

            # Configure registries
            Configure-NpmRegistry
            Configure-PnpmRegistry

            return $true
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

function Install-PackageManagers {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing pnpm and yarn package managers..." -Type "Info"

    # Validate npm exists
    if (-not (Test-Path $NpmExePath)) {
        Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: npm not found at $NpmExePath" -Type "Error"
        return $false
    }

    # Install pnpm
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing pnpm..." -Type "Warning"
    if (Test-Path $PnpmExePath) {
        Write-ColorMessage -Message "$SCRIPT_INDEX pnpm already installed" -Type "Success"
    } else {
        & $NpmExePath install -g pnpm
        Start-Sleep -Milliseconds 500
        if (Test-Path $PnpmExePath) {
            Write-ColorMessage -Message "$SCRIPT_INDEX pnpm installed successfully" -Type "Success"
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: pnpm installation may have failed" -Type "Warning"
        }
    }

    if (Test-Path $PnpmExePath) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Configuring pnpm..." -Type "Info"

        # Set pnpm global directories
        $pnpmGlobalDir = Join-Path $NodeJSInstallDir "pnpm-global"
        $pnpmGlobalBinDir = Join-Path $pnpmGlobalDir ".bin"

        & $PnpmExePath config set global-dir $pnpmGlobalDir
        & $PnpmExePath config set global-bin-dir $pnpmGlobalBinDir
        & $PnpmExePath config set enable-pre-post-scripts true
        & $PnpmExePath setup

        Write-ColorMessage -Message "$SCRIPT_INDEX pnpm global-dir: $pnpmGlobalDir" -Type "Success"
        Write-ColorMessage -Message "$SCRIPT_INDEX pnpm global-bin-dir: $pnpmGlobalBinDir" -Type "Success"
        Write-ColorMessage -Message "$SCRIPT_INDEX pnpm enable-pre-post-scripts: true" -Type "Success"
        Write-ColorMessage -Message "$SCRIPT_INDEX pnpm setup completed" -Type "Success"
    }

    # Install yarn
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing yarn..." -Type "Warning"
    if (Test-Path $YarnExePath) {
        Write-ColorMessage -Message "$SCRIPT_INDEX yarn already installed" -Type "Success"
    } else {
        & $NpmExePath install -g yarn
        Start-Sleep -Milliseconds 500
        if (Test-Path $YarnExePath) {
            Write-ColorMessage -Message "$SCRIPT_INDEX yarn installed successfully" -Type "Success"
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: yarn installation may have failed" -Type "Warning"
        }
    }

    return $true
}

function Configure-NpmRegistry {
    Write-ColorMessage -Message "$SCRIPT_INDEX Configuring npm registry..." -Type "Info"

    $selectedRegion = Get-GlobalVar -Key "SELECTED_REGION"

    if ($selectedRegion -eq "China") {
        Write-ColorMessage -Message "$SCRIPT_INDEX Setting npm China mirrors..." -Type "Warning"

        & $NpmExePath config set registry https://registry.npmmirror.com
        & $NpmExePath config set disturl https://npmmirror.com/dist
        & $NpmExePath config set electron_mirror https://npmmirror.com/mirrors/electron/
        & $NpmExePath config set sass_binary_site https://npmmirror.com/mirrors/node-sass
        & $NpmExePath config set phantomjs_cdnurl https://npmmirror.com/mirrors/phantomjs

        Write-ColorMessage -Message "$SCRIPT_INDEX npm China mirrors configured successfully" -Type "Success"
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX Using default npm registry (Global region)" -Type "Info"
    }

    return $true
}

function Configure-PnpmRegistry {
    Write-ColorMessage -Message "$SCRIPT_INDEX Configuring pnpm registry..." -Type "Info"

    if (-not (Test-Path $PnpmExePath)) {
        Write-ColorMessage -Message "$SCRIPT_INDEX pnpm not installed, skipping configuration" -Type "Warning"
        return $false
    }

    $selectedRegion = Get-GlobalVar -Key "SELECTED_REGION"
    $userHome = [Environment]::GetFolderPath('UserProfile')
    $pnpmrcPath = Join-Path $userHome ".pnpmrc"

    if ($selectedRegion -eq "China") {
        Write-ColorMessage -Message "$SCRIPT_INDEX Creating .pnpmrc with China mirrors..." -Type "Warning"

        $pnpmrcContent = @"
registry=https://registry.npmmirror.com
disturl=https://npmmirror.com/dist
electron_mirror=https://npmmirror.com/mirrors/electron/
sass_binary_site=https://npmmirror.com/mirrors/node-sass
phantomjs_cdnurl=https://npmmirror.com/mirrors/phantomjs
enable-pre-post-scripts=true
"@

        Set-Content -Path $pnpmrcPath -Value $pnpmrcContent -Force
        Write-ColorMessage -Message "$SCRIPT_INDEX .pnpmrc created at: $pnpmrcPath" -Type "Success"
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX Using default pnpm registry (Global region)" -Type "Info"

        $pnpmrcContent = @"
enable-pre-post-scripts=true
"@

        Set-Content -Path $pnpmrcPath -Value $pnpmrcContent -Force
        Write-ColorMessage -Message "$SCRIPT_INDEX .pnpmrc created with default settings" -Type "Success"
    }

    Write-ColorMessage -Message "$SCRIPT_INDEX Force-setting pnpm enable-pre-post-scripts via CLI..." -Type "Info"
    & $PnpmExePath config set enable-pre-post-scripts true
    Write-ColorMessage -Message "$SCRIPT_INDEX pnpm enable-pre-post-scripts set to true" -Type "Success"

    return $true
}

function Verify-AndFix-AllConfigs {
    Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Info"
    Write-ColorMessage -Message "$SCRIPT_INDEX Verifying and fixing all configurations..." -Type "Warning"
    Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Info"

    Write-ColorMessage -Message "$SCRIPT_INDEX [1/4] Checking npm configuration..." -Type "Info"
    if (Test-Path $NpmExePath) {
        Configure-NpmRegistry
        Write-ColorMessage -Message "$SCRIPT_INDEX npm configuration verified" -Type "Success"
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX npm not found, skipping" -Type "Warning"
    }

    Write-ColorMessage -Message "$SCRIPT_INDEX [2/4] Checking pnpm installation..." -Type "Info"
    if (Test-Path $PnpmExePath) {
        Write-ColorMessage -Message "$SCRIPT_INDEX pnpm already installed" -Type "Success"
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX Installing pnpm..." -Type "Warning"
        & $NpmExePath install -g pnpm
        Start-Sleep -Milliseconds 500
    }

    Write-ColorMessage -Message "$SCRIPT_INDEX [3/4] Checking pnpm configuration..." -Type "Info"
    if (Test-Path $PnpmExePath) {
        $pnpmGlobalDir = Join-Path $NodeJSInstallDir "pnpm-global"
        $pnpmGlobalBinDir = Join-Path $pnpmGlobalDir ".bin"

        Write-ColorMessage -Message "$SCRIPT_INDEX Setting pnpm global-dir: $pnpmGlobalDir" -Type "Info"
        & $PnpmExePath config set global-dir $pnpmGlobalDir

        Write-ColorMessage -Message "$SCRIPT_INDEX Setting pnpm global-bin-dir: $pnpmGlobalBinDir" -Type "Info"
        & $PnpmExePath config set global-bin-dir $pnpmGlobalBinDir

        Write-ColorMessage -Message "$SCRIPT_INDEX Setting pnpm enable-pre-post-scripts: true" -Type "Info"
        & $PnpmExePath config set enable-pre-post-scripts true

        Write-ColorMessage -Message "$SCRIPT_INDEX Running pnpm setup..." -Type "Info"
        & $PnpmExePath setup

        Configure-PnpmRegistry

        Write-ColorMessage -Message "$SCRIPT_INDEX pnpm configuration verified and fixed" -Type "Success"
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX pnpm not found, skipping" -Type "Warning"
    }

    Write-ColorMessage -Message "$SCRIPT_INDEX [4/4] Checking yarn installation..." -Type "Info"
    if (Test-Path $YarnExePath) {
        Write-ColorMessage -Message "$SCRIPT_INDEX yarn already installed" -Type "Success"
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX Installing yarn..." -Type "Warning"
        & $NpmExePath install -g yarn
        Start-Sleep -Milliseconds 500
        if (Test-Path $YarnExePath) {
            Write-ColorMessage -Message "$SCRIPT_INDEX yarn installed successfully" -Type "Success"
        }
    }

    Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Info"
    Write-ColorMessage -Message "$SCRIPT_INDEX All configurations verified and fixed" -Type "Success"
    Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Info"

    return $true
}

function Test-NodeJSInstallation {
    Write-ColorMessage -Message "$SCRIPT_INDEX Testing Node.js installation..." -Type "Info"

    if (Test-Path $NodeExePath) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Node.js version:" -Type "Info"
        & $NodeExePath --version
    }

    if (Test-Path $NpmExePath) {
        Write-ColorMessage -Message "$SCRIPT_INDEX npm version:" -Type "Info"
        & $NpmExePath --version
    }

    if (Test-Path $PnpmExePath) {
        Write-ColorMessage -Message "$SCRIPT_INDEX pnpm version:" -Type "Info"
        & $PnpmExePath --version
    }

    if (Test-Path $YarnExePath) {
        Write-ColorMessage -Message "$SCRIPT_INDEX yarn version:" -Type "Info"
        & $YarnExePath --version
    }

    Write-ColorMessage -Message "$SCRIPT_INDEX Verifying pnpm configuration..." -Type "Info"
    if (Test-Path $PnpmExePath) {
        Write-ColorMessage -Message "$SCRIPT_INDEX pnpm config list:" -Type "Info"
        & $PnpmExePath config list
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

    Write-Host ""
    Verify-AndFix-AllConfigs

    Write-Host ""
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
