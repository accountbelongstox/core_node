# D3Check Init Server Script
# This script runs in the target directory and starts the application

param(
    [switch]$SkipPackageCheck = $false,
    [switch]$ForceReinstall = $false,
    [switch]$SkipStartupSetup = $false
)

# Set error action preference
$ErrorActionPreference = "Continue"

# Function to write info messages
function Write-Info {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan
}

# Function to write success messages
function Write-Success {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
}

# Function to write warning messages
function Write-Warning {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Yellow
}

# Function to write error messages
function Write-Error {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Red
}

# Function to write header messages
function Write-Header {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Magenta
}

# Function to setup startup shortcut
function Set-StartupShortcut {
    Write-Info "Setting up startup shortcut..."
    
    try {
        # Get the path to the set_startup.ps1 script
        $setStartupScript = Join-Path $PSScriptRoot "ps1_shells\set_startup.ps1"
        
        if (-not (Test-Path $setStartupScript)) {
            Write-Warning "Startup setup script not found: $setStartupScript"
            return $false
        }
        
        # Get the current script path
        $currentScriptPath = $PSCommandPath
        
        # Call the set_startup.ps1 script
        $setupResult = & $setStartupScript -ScriptPath $currentScriptPath 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Startup shortcut setup completed successfully"
            return $true
        } else {
            Write-Error "Startup shortcut setup failed"
            Write-Error "Setup output: $setupResult"
            return $false
        }
    }
    catch {
        Write-Error "Error setting up startup shortcut: $($_.Exception.Message)"
        return $false
    }
}

# Function to check if Python is available
function Test-PythonAvailable {
    try {
        $pythonVersion = python --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "[OK] Python found: $pythonVersion"
            return $true
        }
    }
    catch {
        Write-Error "[ERROR] Python not found in PATH"
        return $false
    }
    return $false
}

# Function to check if pip is available
function Test-PipAvailable {
    try {
        $pipVersion = pip --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "[OK] pip found: $pipVersion"
            return $true
        }
    }
    catch {
        Write-Error "[ERROR] pip not found"
        return $false
    }
    return $false
}

# Function to install Python packages
function Install-PythonPackages {
    param(
        [string]$InstallCommand
    )
    
    Write-Info "Installing missing packages..."
    Write-Host "Command: $InstallCommand" -ForegroundColor White
    
    try {
        $installResult = & cmd /c $InstallCommand 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "[OK] Successfully installed all packages"
            return $true
        } else {
            Write-Error "[ERROR] Failed to install packages"
            Write-Error "Error: $installResult"
            return $false
        }
    }
    catch {
        Write-Error "[ERROR] Error installing packages: $($_.Exception.Message)"
        return $false
    }
}

# Function to run package check
function Test-PythonPackages {
    Write-Info "Running Python package check..."
    
    try {
        # Run the Python package checker
        $checkResult = python utils/pypackages_check.py 2>$null
        $exitCode = $LASTEXITCODE
        
        if ($exitCode -eq 0) {
            # All packages are available
            return ""
        } else {
            # Packages need to be installed, return the installation command
            return ($checkResult -join "`n").Trim()
        }
    }
    catch {
        Write-Error "[ERROR] Error running package check: $($_.Exception.Message)"
        return $null
    }
}

# Function to start the main application
function Start-MainApplication {
    Write-Success "Starting D3Check application..."
    
    try {
        # Start the main Python application
        python main.py
    }
    catch {
        Write-Error "[ERROR] Error starting application: $($_.Exception.Message)"
        return $false
    }
    
    return $true
}

# Main execution
Write-Header "=== D3Check Init Server Script ==="
Write-Host ""

Write-Info "Current working directory: $(Get-Location)"
Write-Host ""

# Setup startup shortcut if not skipped
if (-not $SkipStartupSetup) {
    Write-Header "=== Setting Up Startup Shortcut ==="
    Set-StartupShortcut
    Write-Host ""
} else {
    Write-Warning "Skipping startup shortcut setup as requested."
    Write-Host ""
}

# Check if Python is available
if (-not (Test-PythonAvailable)) {
    Write-Error "Python is required but not found. Please install Python and add it to PATH."
    exit 1
}

# Check if pip is available
if (-not (Test-PipAvailable)) {
    Write-Error "pip is required but not found. Please install pip."
    exit 1
}

# Skip package check if requested
if ($SkipPackageCheck) {
    Write-Warning "Skipping package check as requested."
} else {
    # Check for missing packages
    $missingArgs = python utils/pypackages_check.py 2>$null

    if ($LASTEXITCODE -eq 1 -and $missingArgs -ne "") {
        Write-Host "Missing packages: $missingArgs"
        $cmd = "pip install $missingArgs"
        Write-Host "Install command: $cmd"
        & cmd /c $cmd
    } else {
        Write-Host "All packages are installed"
    }
}

Write-Host ""
Write-Header "=== Starting Application ==="

# Start the main application
Start-MainApplication 