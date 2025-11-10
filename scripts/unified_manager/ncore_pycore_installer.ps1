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
$readConfigScript = Join-Path $RootDir "read_build_config.py"
$appDir = $WorkingDir
$configExists = $false
$buildConfig = @{}

if ($AppType -eq "pycoreApp") {
    $appDir = Join-Path $RootDir "pyapps\$AppName"
} elseif ($AppType -eq "ncoreApp") {
    $appDir = Join-Path $RootDir "apps\$AppName"
}

Write-Host "Checking for build_config.ini..." -ForegroundColor Gray
if (Test-Path $readConfigScript) {
    try {
        $configExistsOutput = python "$readConfigScript" "$appDir" "exists" 2>$null
        $configExists = ($configExistsOutput -eq "true")

        if ($configExists) {
            Write-Host "Found build_config.ini, loading configuration..." -ForegroundColor Green
            $configJson = python "$readConfigScript" "$appDir" "all" 2>$null
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
                $preCommands = python "$readConfigScript" "$appDir" "pre_install_commands" 2>$null
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
} else {
    Write-Host "Warning: read_build_config.py not found, skipping config" -ForegroundColor Yellow
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

# Step 1: Update pnpm itself
Write-Host "[1/5] Updating pnpm globally..." -ForegroundColor Yellow
Write-Host "Running: pnpm add -g pnpm" -ForegroundColor Gray
try {
    pnpm add -g pnpm
    if ($LASTEXITCODE -eq 0) {
        Write-Host "pnpm updated successfully" -ForegroundColor Green
    } else {
        Write-Host "Warning: Failed to update pnpm (exit code: $LASTEXITCODE), continuing..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Warning: Failed to update pnpm, continuing..." -ForegroundColor Yellow
}
Write-Host ""

# Step 2: Check if node_modules exists
Write-Host "[2/5] Checking Node.js dependencies..." -ForegroundColor Yellow

# Check if pnpm install should be skipped from config
$skipPnpmInstall = $false
if ($configExists -and $buildConfig.installation.skip_pnpm_install) {
    $skipPnpmInstall = $true
    Write-Host "Skipping pnpm install (configured in build_config.ini)" -ForegroundColor Yellow
}

if (-not $skipPnpmInstall) {
    $nodeModulesPath = Join-Path $RootDir "node_modules"
    if (Test-Path $nodeModulesPath) {
        Write-Host "node_modules exists, skipping pnpm install" -ForegroundColor Green
        Write-Host ""
    } else {
        # Step 3: Install Node.js dependencies
        Write-Host "node_modules not found, installing..." -ForegroundColor Gray
        Write-Host "Running: pnpm install" -ForegroundColor Gray
        Push-Location $RootDir
        try {
            pnpm install
            if ($LASTEXITCODE -ne 0) {
                Write-Host ""
                Write-Host "Node.js installation failed! Check the error messages above." -ForegroundColor Red
                Write-Host ""
                Pop-Location
                Read-Host "Press Enter to exit"
                exit 1
            }
            Write-Host "Node.js dependencies installed successfully" -ForegroundColor Green
            Write-Host ""
        } catch {
            Write-Host ""
            Write-Host "Node.js installation failed: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host ""
            Pop-Location
            Read-Host "Press Enter to exit"
            exit 1
        }
        Pop-Location
    }
} else {
    Write-Host ""
}

# Step 4: Initialize pycore (Python dependencies)
Write-Host "[3/5] Initializing pycore (Python dependencies)..." -ForegroundColor Yellow

# Check if pycore init should be skipped from config
$skipPycoreInit = $false
if ($configExists -and $buildConfig.installation.skip_pycore_init) {
    $skipPycoreInit = $true
    Write-Host "Skipping pycore initialization (configured in build_config.ini)" -ForegroundColor Yellow
    Write-Host ""
}

if (-not $skipPycoreInit) {
    $pycoreModuleCaller = Join-Path $RootDir "pycore_module_caller.py"
    Write-Host "Running: python `"$pycoreModuleCaller`" --module pycore --call check_and_install_dependencies" -ForegroundColor Gray
    Write-Host ""
    try {
        python "$pycoreModuleCaller" --module pycore --call check_and_install_dependencies
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "pycore initialized successfully" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "Warning: pycore initialization completed with warnings (exit code: $LASTEXITCODE)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host ""
        Write-Host "Warning: pycore initialization failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Step 5: Create desktop shortcut
Write-Host "[4/5] Creating desktop shortcut..." -ForegroundColor Yellow

# Check if desktop shortcut should be created from config
$createShortcut = $true
if ($configExists -and $buildConfig.installation.PSObject.Properties.Name -contains "create_desktop_shortcut") {
    $createShortcut = $buildConfig.installation.create_desktop_shortcut
}

if ($createShortcut) {
    $desktopPath = [Environment]::GetFolderPath("Desktop")

    # Use display name from config if available
    $shortcutName = $AppName
    if ($configExists -and $buildConfig.app_info.display_name_chinese) {
        $shortcutName = $buildConfig.app_info.display_name_chinese
    }

    $shortcutPath = Join-Path $desktopPath "$shortcutName.lnk"

    try {
        $WScriptShell = New-Object -ComObject WScript.Shell
        $Shortcut = $WScriptShell.CreateShortcut($shortcutPath)
        $Shortcut.TargetPath = "powershell.exe"
        $Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$PSCommandPath`" -AppName `"$AppName`" -AppType `"$AppType`" -StartCommand `"$StartCommand`" -WorkingDir `"$WorkingDir`" -RootDir `"$RootDir`""
        $Shortcut.WorkingDirectory = $WorkingDir

        # Use description from config if available
        $shortcutDesc = "Launch $AppName via Ncore/Pycore/Installer"
        if ($configExists -and $buildConfig.app_info.description) {
            $shortcutDesc = $buildConfig.app_info.description
        }
        $Shortcut.Description = $shortcutDesc

        $Shortcut.Save()
        Write-Host "Desktop shortcut created: $shortcutPath" -ForegroundColor Green
    } catch {
        Write-Host "Warning: Failed to create desktop shortcut: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "Skipping desktop shortcut creation (configured in build_config.ini)" -ForegroundColor Yellow
}
Write-Host ""

# Execute post-install commands if specified
if ($configExists -and $buildConfig.installation.post_install_commands) {
    $postCommands = python "$readConfigScript" "$appDir" "post_install_commands" 2>$null
    if ($postCommands) {
        Write-Host "Executing post-install commands..." -ForegroundColor Cyan
        $commandList = $postCommands -split ";"
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
        Write-Host "Post-install commands completed" -ForegroundColor Green
        Write-Host ""
    }
}

# Display installation complete
Write-Host "========================================" -ForegroundColor Green
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Step 6: Start application
Write-Host "[5/5] Starting $AppName..." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

# Check for custom startup command and working directory from config
$finalStartCommand = $StartCommand
$finalWorkingDir = $WorkingDir

if ($configExists) {
    # Check for custom startup command
    $customCommand = python "$readConfigScript" "$appDir" "startup_command" 2>$null
    if ($customCommand) {
        $finalStartCommand = $customCommand
        Write-Host "Using custom startup command from config" -ForegroundColor Cyan
    }

    # Check for custom working directory
    $customWorkDir = $buildConfig.startup.working_directory
    if ($customWorkDir) {
        $finalWorkingDir = Join-Path $appDir $customWorkDir
        if (-not (Test-Path $finalWorkingDir)) {
            $finalWorkingDir = $WorkingDir
            Write-Host "Warning: Custom working directory not found, using default" -ForegroundColor Yellow
        } else {
            Write-Host "Using custom working directory from config" -ForegroundColor Cyan
        }
    }

    # Set environment variables from config
    if ($buildConfig.startup.environment) {
        Write-Host "Setting environment variables from config..." -ForegroundColor Cyan
        foreach ($envKey in $buildConfig.startup.environment.PSObject.Properties.Name) {
            $envValue = $buildConfig.startup.environment.$envKey
            if ($envKey -and $envValue) {
                [Environment]::SetEnvironmentVariable($envKey, $envValue, "Process")
                Write-Host "  $envKey = $envValue" -ForegroundColor Gray
            }
        }
    }
}

Write-Host "Working Directory: $finalWorkingDir" -ForegroundColor Gray
Write-Host "Command: $finalStartCommand" -ForegroundColor Gray
Write-Host ""

Push-Location $finalWorkingDir
try {
    Invoke-Expression $finalStartCommand
} catch {
    Write-Host ""
    Write-Host "Failed to start application: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
} finally {
    Pop-Location
}

Write-Host ""
Read-Host "Press Enter to exit"
