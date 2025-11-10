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

# Step 4: Initialize pycore (Python dependencies)
Write-Host "[3/5] Initializing pycore (Python dependencies)..." -ForegroundColor Yellow
$pycoreInitScript = Join-Path $RootDir "pycore_init.py"
Write-Host "Running: python `"$pycoreInitScript`"" -ForegroundColor Gray
Write-Host ""
try {
    python "$pycoreInitScript"
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

# Step 5: Create desktop shortcut
Write-Host "[4/5] Creating desktop shortcut..." -ForegroundColor Yellow
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "$AppName.lnk"

try {
    $WScriptShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WScriptShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$PSCommandPath`" -AppName `"$AppName`" -AppType `"$AppType`" -StartCommand `"$StartCommand`" -WorkingDir `"$WorkingDir`" -RootDir `"$RootDir`""
    $Shortcut.WorkingDirectory = $WorkingDir
    $Shortcut.Description = "Launch $AppName via Ncore/Pycore/Installer"
    $Shortcut.Save()
    Write-Host "Desktop shortcut created: $shortcutPath" -ForegroundColor Green
} catch {
    Write-Host "Warning: Failed to create desktop shortcut: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# Display installation complete
Write-Host "========================================" -ForegroundColor Green
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Step 6: Start application
Write-Host "[5/5] Starting $AppName..." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Working Directory: $WorkingDir" -ForegroundColor Gray
Write-Host "Command: $StartCommand" -ForegroundColor Gray
Write-Host ""

Push-Location $WorkingDir
try {
    Invoke-Expression $StartCommand
} catch {
    Write-Host ""
    Write-Host "Failed to start application: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
} finally {
    Pop-Location
}

Write-Host ""
Read-Host "Press Enter to exit"
