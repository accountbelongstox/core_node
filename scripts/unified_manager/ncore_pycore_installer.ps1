# Ncore/Pycore/Installer - Unified Installer for ncoreApp and pycoreApp
# This script handles complete installation and initialization
# Usage: .\ncore_pycore_installer.ps1 -AppName "app_name" -AppType "ncoreApp|pycoreApp" -StartCommand "command" -WorkingDir "path"

param(
    [Parameter(Mandatory=$true)]
    [string]$AppName,

    [Parameter(Mandatory=$true)]
    [ValidateSet("ncoreApp", "pycoreApp")]
    [string]$AppType,

    [Parameter(Mandatory=$true)]
    [string]$StartCommand,

    [Parameter(Mandatory=$true)]
    [string]$WorkingDir,

    [Parameter(Mandatory=$false)]
    [string]$RootDir
)

# Set console encoding to UTF-8 to prevent garbled text
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Get script directory and root directory
$scriptPath = $PSScriptRoot
if (-not $RootDir) {
    $RootDir = (Get-Item $scriptPath).Parent.Parent.FullName
}

# Display banner
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Ncore/Pycore/Installer - Unified Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "App Name: $AppName" -ForegroundColor White
Write-Host "App Type: $AppType" -ForegroundColor White
Write-Host "Root Dir: $RootDir" -ForegroundColor Gray
Write-Host ""

# Read build_config.ini if exists
$appDir = $WorkingDir
$configExists = $false
$buildConfig = @{}

if ($AppType -eq "pycoreApp") {
    $appDir = Join-Path $RootDir "pyapps\$AppName"
} elseif ($AppType -eq "ncoreApp") {
    $appDir = Join-Path $RootDir "apps\$AppName"
}

Write-Host "Checking for build_config.ini..." -ForegroundColor Gray
try {
    $configExistsOutput = python -m pycore.pyutils.build_config_parser "$appDir" "exists" 2>$null
    $configExists = ($configExistsOutput -eq "true")

    if ($configExists) {
        Write-Host "Found build_config.ini, loading configuration..." -ForegroundColor Green
        $configJson = python -m pycore.pyutils.build_config_parser "$appDir" "all" 2>$null
        $buildConfig = $configJson | ConvertFrom-Json

        # Display config info
        $displayName = $buildConfig.app_info.display_name_english
        if ($buildConfig.app_info.display_name_chinese) {
            $displayName = "$($buildConfig.app_info.display_name_chinese) ($displayName)"
        }
        if ($displayName) {
            Write-Host "  Display Name: $displayName" -ForegroundColor Cyan
        }
        if ($buildConfig.app_info.description) {
            Write-Host "  Description: $($buildConfig.app_info.description)" -ForegroundColor Gray
        }
        if ($buildConfig.app_info.version) {
            Write-Host "  Version: $($buildConfig.app_info.version)" -ForegroundColor Gray
        }

        # Execute pre-install commands if specified
        if ($buildConfig.installation.pre_install_commands) {
            $preCommands = python -m pycore.pyutils.build_config_parser "$appDir" "pre_install_commands" 2>$null
            if ($preCommands) {
                Write-Host ""
                Write-Host "Executing pre-install commands..." -ForegroundColor Cyan
                $commandList = $preCommands -split ";"
                foreach ($cmd in $commandList) {
                    $cmd = $cmd.Trim()
                    if ($cmd) {
                        Write-Host "  Running: $cmd" -ForegroundColor Gray
                        try {
                            Invoke-Expression $cmd
                        } catch {
                            Write-Host "  Warning: Command failed: $($_.Exception.Message)" -ForegroundColor Yellow
                        }
                    }
                }
                Write-Host "Pre-install commands completed" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "No build_config.ini found" -ForegroundColor Yellow
        Write-Host "  Tip: Create build_config.ini in app directory for advanced configuration" -ForegroundColor Yellow
        Write-Host "       You can customize dependencies, startup commands, and more!" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Warning: Failed to read build_config.ini: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# Step 0: Check and install Node.js and Python if needed
Write-Host "[0/5] Checking runtime dependencies..." -ForegroundColor Yellow

# Get paths to installation scripts (using relative paths from script location)
$installPowershellsDir = Join-Path (Split-Path (Split-Path $scriptPath -Parent) -Parent) "shells\win\install_powershells"
$step12Script = Join-Path $installPowershellsDir "Step12_InstallApplications.ps1"

# Check Node.js
$nodeInstalled = $false
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host "Node.js is installed: $nodeVersion" -ForegroundColor Green
        $nodeInstalled = $true
    }
} catch {
    Write-Host "Node.js not found" -ForegroundColor Yellow
}

# Check Python
$pythonInstalled = $false
try {
    $pythonVersion = python --version 2>$null
    if ($pythonVersion) {
        Write-Host "Python is installed: $pythonVersion" -ForegroundColor Green
        $pythonInstalled = $true
    }
} catch {
    Write-Host "Python not found" -ForegroundColor Yellow
}

# Install missing runtimes using Step12_InstallApplications.ps1
if (-not $nodeInstalled -or -not $pythonInstalled) {
    Write-Host ""
    Write-Host "Installing missing runtimes..." -ForegroundColor Yellow

    if (Test-Path $step12Script) {
        if (-not $nodeInstalled) {
            Write-Host "Installing Node.js via Step12_InstallApplications.ps1..." -ForegroundColor Gray
            & powershell -ExecutionPolicy Bypass -File $step12Script -PackageName "NodeJS"
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

            # Verify installation
            try {
                $nodeVersion = node --version 2>$null
                if ($nodeVersion) {
                    Write-Host "Node.js installed successfully: $nodeVersion" -ForegroundColor Green
                } else {
                    Write-Host "WARNING: Node.js installation may have failed" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "WARNING: Node.js installation may have failed" -ForegroundColor Yellow
            }
        }

        if (-not $pythonInstalled) {
            Write-Host "Installing Python via Step12_InstallApplications.ps1..." -ForegroundColor Gray
            & powershell -ExecutionPolicy Bypass -File $step12Script -PackageName "Python313"
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

            # Verify installation
            try {
                $pythonVersion = python --version 2>$null
                if ($pythonVersion) {
                    Write-Host "Python installed successfully: $pythonVersion" -ForegroundColor Green
                } else {
                    Write-Host "WARNING: Python installation may have failed" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "WARNING: Python installation may have failed" -ForegroundColor Yellow
            }
        }

        Write-Host "Runtime installation complete" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Installation script not found: $step12Script" -ForegroundColor Red
        Write-Host "Please install Node.js and Python manually." -ForegroundColor Yellow
        Write-Host "Node.js: https://nodejs.org/" -ForegroundColor Yellow
        Write-Host "Python: https://www.python.org/" -ForegroundColor Yellow
        Read-Host "Press Enter to continue anyway (may fail)"
    }
}
Write-Host ""

# Step 1: Update pnpm itself (optional, skip if fails)
Write-Host "[1/5] Checking pnpm..." -ForegroundColor Yellow
Write-Host "[DEBUG] Current directory: $PWD" -ForegroundColor DarkGray
try {
    Write-Host "[DEBUG] Attempting to update pnpm globally..." -ForegroundColor DarkGray
    # Redirect stderr to null to hide pnpm config errors
    $pnpmOutput = pnpm add -g pnpm 2>$null
    Write-Host "[DEBUG] pnpm update finished with exit code: $LASTEXITCODE" -ForegroundColor DarkGray
    if ($LASTEXITCODE -eq 0) {
        Write-Host "pnpm updated successfully" -ForegroundColor Green
    } else {
        Write-Host "Skipping pnpm update (not required)" -ForegroundColor Gray
    }
} catch {
    Write-Host "Skipping pnpm update (not required)" -ForegroundColor Gray
}
Write-Host "[DEBUG] Step 1 completed" -ForegroundColor DarkGray
Write-Host ""

# Step 2: Check if node_modules exists
Write-Host "[2/5] Checking Node.js dependencies..." -ForegroundColor Yellow
Write-Host "[DEBUG] Starting Step 2 - Node.js dependencies check" -ForegroundColor DarkGray

# Check if pnpm install should be skipped from config
$skipPnpmInstall = $false
if ($configExists -and $buildConfig.installation.skip_pnpm_install) {
    $skipPnpmInstall = $true
    Write-Host "[DEBUG] skip_pnpm_install = true from config" -ForegroundColor DarkGray
    Write-Host "Skipping pnpm install (configured in build_config.ini)" -ForegroundColor Yellow
}

if (-not $skipPnpmInstall) {
    $nodeModulesPath = Join-Path $RootDir "node_modules"
    Write-Host "[DEBUG] Checking for node_modules at: $nodeModulesPath" -ForegroundColor DarkGray
    if (Test-Path $nodeModulesPath) {
        Write-Host "[DEBUG] node_modules directory exists" -ForegroundColor DarkGray
        Write-Host "node_modules exists, skipping pnpm install" -ForegroundColor Green
        Write-Host ""
    } else {
        # Step 3: Install Node.js dependencies
        Write-Host "[DEBUG] node_modules not found, will install" -ForegroundColor DarkGray
        Write-Host "node_modules not found, installing..." -ForegroundColor Gray
        Write-Host "[DEBUG] Changing directory to: $RootDir" -ForegroundColor DarkGray
        Write-Host "Running: pnpm install" -ForegroundColor Gray
        Push-Location $RootDir
        try {
            Write-Host "[DEBUG] Executing pnpm install..." -ForegroundColor DarkGray
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host "Installing dependencies..." -ForegroundColor Cyan
            Write-Host "========================================" -ForegroundColor Cyan
            pnpm install 2>&1 | Out-Host
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host "[DEBUG] pnpm install finished with exit code: $LASTEXITCODE" -ForegroundColor DarkGray
            if ($LASTEXITCODE -ne 0) {
                Write-Host ""
                Write-Host "[ERROR] Node.js installation failed with exit code: $LASTEXITCODE" -ForegroundColor Red
                Write-Host "Check the error messages above." -ForegroundColor Red
                Write-Host ""
                Pop-Location
                Read-Host "Press Enter to exit"
                exit 1
            }
            Write-Host "[DEBUG] pnpm install completed successfully" -ForegroundColor DarkGray
            Write-Host "Node.js dependencies installed successfully" -ForegroundColor Green
            Write-Host ""
        } catch {
            Write-Host ""
            Write-Host "[ERROR] Node.js installation failed: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "[DEBUG] Exception details: $($_.Exception)" -ForegroundColor DarkGray
            Write-Host ""
            Pop-Location
            Read-Host "Press Enter to exit"
            exit 1
        }
        Write-Host "[DEBUG] Returning to original directory" -ForegroundColor DarkGray
        Pop-Location
    }
} else {
    Write-Host "[DEBUG] Skipping pnpm install as configured" -ForegroundColor DarkGray
    Write-Host ""
}
Write-Host "[DEBUG] Step 2 completed" -ForegroundColor DarkGray
Write-Host ""

# Step 4: Initialize pycore (Python dependencies)
Write-Host "[3/5] Initializing pycore (Python dependencies)..." -ForegroundColor Yellow
Write-Host "[DEBUG] Starting Step 3 - pycore initialization" -ForegroundColor DarkGray

# Check if pycore init should be skipped from config
$skipPycoreInit = $false
if ($configExists -and $buildConfig.installation.skip_pycore_init) {
    $skipPycoreInit = $true
    Write-Host "[DEBUG] skip_pycore_init = true from config" -ForegroundColor DarkGray
    Write-Host "Skipping pycore initialization (configured in build_config.ini)" -ForegroundColor Yellow
    Write-Host ""
}

if (-not $skipPycoreInit) {
    $pycoreModuleCaller = Join-Path $RootDir "pycore_module_caller.py"
    Write-Host "[DEBUG] pycore_module_caller path: $pycoreModuleCaller" -ForegroundColor DarkGray
    Write-Host "[DEBUG] Checking if pycore_module_caller.py exists..." -ForegroundColor DarkGray
    if (Test-Path $pycoreModuleCaller) {
        Write-Host "[DEBUG] Found pycore_module_caller.py" -ForegroundColor DarkGray
    } else {
        Write-Host "[ERROR] pycore_module_caller.py not found at: $pycoreModuleCaller" -ForegroundColor Red
    }
    Write-Host "Running: python `"$pycoreModuleCaller`" --module pycore --call check_and_install_dependencies" -ForegroundColor Gray
    Write-Host ""
    try {
        Write-Host "[DEBUG] Executing pycore module caller..." -ForegroundColor DarkGray
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Initializing Python dependencies..." -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan
        python "$pycoreModuleCaller" --module pycore --call check_and_install_dependencies 2>&1 | Out-Host
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "[DEBUG] pycore initialization finished with exit code: $LASTEXITCODE" -ForegroundColor DarkGray
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "[DEBUG] pycore initialization succeeded" -ForegroundColor DarkGray
            Write-Host "pycore initialized successfully" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "[DEBUG] pycore initialization completed with warnings (exit code: $LASTEXITCODE)" -ForegroundColor DarkGray
            Write-Host "Warning: pycore initialization completed with warnings (exit code: $LASTEXITCODE)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host ""
        Write-Host "[ERROR] pycore initialization failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "[DEBUG] Exception details: $($_.Exception)" -ForegroundColor DarkGray
    }
    Write-Host ""
}
Write-Host "[DEBUG] Step 3 completed" -ForegroundColor DarkGray
Write-Host ""

# Step 5: Create desktop shortcut
Write-Host "[4/5] Creating desktop shortcut..." -ForegroundColor Yellow
Write-Host "[DEBUG] Starting Step 4 - Desktop shortcut creation" -ForegroundColor DarkGray

# Check if desktop shortcut should be created from config
$createShortcut = $true
if ($configExists -and $buildConfig.installation.PSObject.Properties.Name -contains "create_desktop_shortcut") {
    $createShortcut = $buildConfig.installation.create_desktop_shortcut
    Write-Host "[DEBUG] create_desktop_shortcut from config: $createShortcut" -ForegroundColor DarkGray
}

if ($createShortcut) {
    Write-Host "[DEBUG] Using Python Desktop Shortcut Manager for automatic icon conversion..." -ForegroundColor DarkGray

    # Use display name from config if available
    $shortcutName = $AppName
    if ($configExists -and $buildConfig.app_info.display_name_chinese) {
        $shortcutName = $buildConfig.app_info.display_name_chinese
        Write-Host "[DEBUG] Using Chinese display name: $shortcutName" -ForegroundColor DarkGray
    } else {
        Write-Host "[DEBUG] Using app name: $shortcutName" -ForegroundColor DarkGray
    }

    # Get icon path from config if specified
    $configIconFile = $null
    if ($configExists) {
        $configIconFile = python -m pycore.pyutils.build_config_parser "$appDir" "icon_file" 2>$null
        if ($configIconFile) {
            Write-Host "[DEBUG] Icon from config: $configIconFile" -ForegroundColor DarkGray
        }
    }

    # Use description from config if available
    $shortcutDesc = "Launch $AppName via Ncore/Pycore/Installer"
    if ($configExists -and $buildConfig.app_info.description) {
        $shortcutDesc = $buildConfig.app_info.description
        Write-Host "[DEBUG] Using description from config" -ForegroundColor DarkGray
    }

    # Create temporary batch file for shortcut target
    $tempScriptDir = Join-Path $env:TEMP "core_node_shortcuts"
    if (-not (Test-Path $tempScriptDir)) {
        New-Item -ItemType Directory -Path $tempScriptDir -Force | Out-Null
    }
    $cleanAppName = $AppName -replace '[/\\:*?"<>|]', '_'
    $tempBatFile = Join-Path $tempScriptDir "$cleanAppName.bat"

    Write-Host "[DEBUG] Creating temporary batch file: $tempBatFile" -ForegroundColor DarkGray
    $batContent = @"
@echo off
powershell.exe -ExecutionPolicy Bypass -File "$PSCommandPath" -AppName "$AppName" -AppType "$AppType" -StartCommand "$StartCommand" -WorkingDir "$WorkingDir" -RootDir "$RootDir"
"@
    $batContent | Out-File -FilePath $tempBatFile -Encoding ASCII -Force

    # Build Python command arguments
    $pythonScriptPath = Join-Path $RootDir "pycore\pyutils\desktop_shortcut_manager.py"
    $pythonArgs = @(
        $pythonScriptPath,
        'create',
        '--name', $shortcutName,
        '--target', $tempBatFile,
        '--working-dir', $WorkingDir,
        '--description', $shortcutDesc,
        '--app-dir', $appDir
    )

    # Add icon argument if specified in config
    if ($configIconFile) {
        $pythonArgs += '--icon'
        $pythonArgs += $configIconFile
    }

    # Add JSON output for parsing
    $pythonArgs += '--json'

    try {
        Write-Host "[DEBUG] Executing Python shortcut manager..." -ForegroundColor DarkGray
        Write-Host "[DEBUG] Python script: $pythonScriptPath" -ForegroundColor DarkGray
        Write-Host "[DEBUG] Command: python $($pythonArgs -join ' ')" -ForegroundColor DarkGray

        # Execute Python shortcut manager from root directory
        Push-Location $RootDir
        $result = & python $pythonArgs 2>&1 | Out-String
        Pop-Location

        Write-Host "[DEBUG] Python output: $result" -ForegroundColor DarkGray

        # Parse JSON result
        try {
            $jsonResult = $result | ConvertFrom-Json
            if ($jsonResult.success) {
                Write-Host "Desktop shortcut created: $($jsonResult.shortcut_path)" -ForegroundColor Green
                Write-Host "Icon used: $($jsonResult.icon_used)" -ForegroundColor Gray
                if ($jsonResult.icon_converted) {
                    Write-Host "PNG icon was automatically converted to ICO format" -ForegroundColor Cyan
                }
            } else {
                Write-Host "[WARNING] Failed to create shortcut: $($jsonResult.message)" -ForegroundColor Yellow
                Write-Host "[DEBUG] Error details: $($jsonResult.error)" -ForegroundColor DarkGray
            }
        } catch {
            Write-Host "[WARNING] Could not parse Python output, but command may have succeeded" -ForegroundColor Yellow
            Write-Host "[DEBUG] Raw output: $result" -ForegroundColor DarkGray
        }
    } catch {
        Write-Host "[ERROR] Failed to create desktop shortcut: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "[DEBUG] Exception details: $($_.Exception)" -ForegroundColor DarkGray
    }
} else {
    Write-Host "[DEBUG] Skipping shortcut creation (configured in build_config.ini)" -ForegroundColor DarkGray
    Write-Host "Skipping desktop shortcut creation (configured in build_config.ini)" -ForegroundColor Yellow
}
Write-Host "[DEBUG] Step 4 completed" -ForegroundColor DarkGray
Write-Host ""

# Execute post-install commands if specified
Write-Host "[DEBUG] Checking for post-install commands..." -ForegroundColor DarkGray
if ($configExists -and $buildConfig.installation.post_install_commands) {
    Write-Host "[DEBUG] Post-install commands found in config" -ForegroundColor DarkGray
    $postCommands = python -m pycore.pyutils.build_config_parser "$appDir" "post_install_commands" 2>$null
    if ($postCommands) {
        Write-Host "[DEBUG] Post-install commands: $postCommands" -ForegroundColor DarkGray
        Write-Host "Executing post-install commands..." -ForegroundColor Cyan
        $commandList = $postCommands -split ";"
        foreach ($cmd in $commandList) {
            $cmd = $cmd.Trim()
            if ($cmd) {
                Write-Host "  Running: $cmd" -ForegroundColor Gray
                try {
                    Invoke-Expression $cmd 2>&1 | Out-Host
                    Write-Host "[DEBUG] Command completed with exit code: $LASTEXITCODE" -ForegroundColor DarkGray
                } catch {
                    Write-Host "  [ERROR] Command failed: $($_.Exception.Message)" -ForegroundColor Red
                    Write-Host "[DEBUG] Exception details: $($_.Exception)" -ForegroundColor DarkGray
                }
            }
        }
        Write-Host "Post-install commands completed" -ForegroundColor Green
        Write-Host ""
    }
} else {
    Write-Host "[DEBUG] No post-install commands in config" -ForegroundColor DarkGray
}

# Display installation complete
Write-Host "[DEBUG] All installation steps completed" -ForegroundColor DarkGray
Write-Host "========================================" -ForegroundColor Green
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Step 6: Start application
Write-Host "[5/5] Starting $AppName..." -ForegroundColor Yellow
Write-Host "[DEBUG] Starting Step 5 - Application launch" -ForegroundColor DarkGray
Write-Host "========================================" -ForegroundColor Cyan

# Check for custom startup command and working directory from config
$finalStartCommand = $StartCommand
$finalWorkingDir = $WorkingDir
Write-Host "[DEBUG] Default start command: $finalStartCommand" -ForegroundColor DarkGray
Write-Host "[DEBUG] Default working dir: $finalWorkingDir" -ForegroundColor DarkGray

if ($configExists) {
    Write-Host "[DEBUG] Checking for custom startup configuration..." -ForegroundColor DarkGray

    # Check for custom startup command
    $customCommandOutput = python -m pycore.pyutils.build_config_parser "$appDir" "startup_command" 2>$null
    # If output is an array, take the last line (the actual value)
    if ($customCommandOutput -is [array]) {
        $customCommand = $customCommandOutput[-1]
    } else {
        $customCommand = $customCommandOutput
    }

    if ($customCommand -and $customCommand.Trim()) {
        $finalStartCommand = $customCommand.Trim()
        Write-Host "[DEBUG] Custom startup command found: $finalStartCommand" -ForegroundColor DarkGray
        Write-Host "Using custom startup command from config" -ForegroundColor Cyan
    } else {
        Write-Host "[DEBUG] No custom startup command in config" -ForegroundColor DarkGray
    }

    # Check for custom working directory
    $customWorkDir = $buildConfig.startup.working_directory
    if ($customWorkDir) {
        Write-Host "[DEBUG] Custom working directory from config: $customWorkDir" -ForegroundColor DarkGray
        $finalWorkingDir = Join-Path $appDir $customWorkDir
        if (-not (Test-Path $finalWorkingDir)) {
            Write-Host "[DEBUG] Custom working directory not found, using default" -ForegroundColor DarkGray
            $finalWorkingDir = $WorkingDir
            Write-Host "Warning: Custom working directory not found, using default" -ForegroundColor Yellow
        } else {
            Write-Host "[DEBUG] Custom working directory exists" -ForegroundColor DarkGray
            Write-Host "Using custom working directory from config" -ForegroundColor Cyan
        }
    } else {
        Write-Host "[DEBUG] No custom working directory in config" -ForegroundColor DarkGray
    }

    # Set environment variables from config
    if ($buildConfig.startup.environment) {
        Write-Host "[DEBUG] Setting environment variables from config..." -ForegroundColor DarkGray
        Write-Host "Setting environment variables from config..." -ForegroundColor Cyan
        foreach ($envKey in $buildConfig.startup.environment.PSObject.Properties.Name) {
            $envValue = $buildConfig.startup.environment.$envKey
            if ($envKey -and $envValue) {
                [Environment]::SetEnvironmentVariable($envKey, $envValue, "Process")
                Write-Host "  $envKey = $envValue" -ForegroundColor Gray
                Write-Host "[DEBUG] Set env var: $envKey = $envValue" -ForegroundColor DarkGray
            }
        }
    } else {
        Write-Host "[DEBUG] No environment variables in config" -ForegroundColor DarkGray
    }
}

Write-Host "Working Directory: $finalWorkingDir" -ForegroundColor Gray
Write-Host "Command: $finalStartCommand" -ForegroundColor Gray
Write-Host "[DEBUG] Final working directory: $finalWorkingDir" -ForegroundColor DarkGray
Write-Host "[DEBUG] Final start command: $finalStartCommand" -ForegroundColor DarkGray
Write-Host ""

Write-Host "[DEBUG] Changing to working directory..." -ForegroundColor DarkGray
Push-Location $finalWorkingDir
try {
    Write-Host "[DEBUG] Executing start command..." -ForegroundColor DarkGray
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Application starting..." -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Invoke-Expression $finalStartCommand 2>&1 | Out-Host
    Write-Host "[DEBUG] Application finished with exit code: $LASTEXITCODE" -ForegroundColor DarkGray
} catch {
    Write-Host ""
    Write-Host "[ERROR] Failed to start application: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "[DEBUG] Exception details: $($_.Exception)" -ForegroundColor DarkGray
    Write-Host ""
} finally {
    Write-Host "[DEBUG] Returning to original directory" -ForegroundColor DarkGray
    Pop-Location
}

Write-Host ""
Write-Host "[DEBUG] Script execution completed" -ForegroundColor DarkGray
Read-Host "Press Enter to exit"
