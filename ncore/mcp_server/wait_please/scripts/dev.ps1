# dev.ps1 - Startup script for Tauri development

# --- Helper Functions ---
function Write-Log {
    param([string]$Message, [string]$Color = "White")
    Write-Host "[STARTUP] $Message" -ForegroundColor $Color
}

function Check-Command {
    param([string]$CommandName)
    return (Get-Command $CommandName -ErrorAction SilentlyContinue)
}

# --- Main Script ---

# Set working directory to the project root (one level above the 'scripts' directory)
$ProjectRoot = Split-Path -Path $PSScriptRoot -Parent
Set-Location -Path $ProjectRoot
Write-Log "Working directory set to: $ProjectRoot"

# 1. Check for Rust (rustc and cargo)
Write-Log "Checking for Rust..."
if (-not (Check-Command "rustc") -or -not (Check-Command "cargo")) {
    Write-Log "Error: Rust is not installed or not in PATH." -Color Red
    Write-Log "Please install Rust from https://www.rust-lang.org/tools/install" -Color Red
    exit 1
}
$rustcVersion = (rustc --version)
$cargoVersion = (cargo --version)
Write-Log "Found rustc: $rustcVersion" -Color Green
Write-Log "Found cargo: $cargoVersion" -Color Green

# 2. Check for pnpm
Write-Log "Checking for pnpm..."
if (-not (Check-Command "pnpm")) {
    Write-Log "pnpm not found. Attempting to install globally via npm..." -Color Yellow
    npm install -g pnpm
    if (-not (Check-Command "pnpm")) {
        Write-Log "Error: Failed to install pnpm. Please install it manually." -Color Red
        exit 1
    }
    Write-Log "pnpm installed successfully." -Color Green
} else {
    Write-Log "pnpm is already installed." -Color Green
}

# 3. Check for node_modules
Write-Log "Checking for node_modules..."
if (-not (Test-Path -Path (Join-Path $ProjectRoot "node_modules"))) {
    Write-Log "node_modules directory not found. Running 'pnpm install'..." -Color Yellow
    pnpm install
    if (-not (Test-Path -Path (Join-Path $ProjectRoot "node_modules"))) {
        Write-Log "Error: 'pnpm install' failed to create node_modules directory." -Color Red
        exit 1
    }
    Write-Log "node_modules installed successfully." -Color Green
} else {
    Write-Log "node_modules already exists." -Color Green
}

# 4. Check for tauri-cli
Write-Log "Checking for Tauri CLI..."
cargo tauri --version > $null 2>&1
if (-not $?) {
    Write-Log "'cargo tauri' command failed. Installing tauri-cli..." -Color Yellow
    
    # First attempt: Install from default registry
    cargo install tauri-cli
    
    # Check if installation succeeded. If not, try with a mirror.
    cargo tauri --version > $null 2>&1
    if (-not $?) {
        Write-Log "Failed to install from default registry. Trying with a mirror..." -Color Yellow
        
        # Temporarily configure cargo to use a mirror in the local project directory
        $cargoConfigDir = Join-Path $ProjectRoot ".cargo"
        $cargoConfigFile = Join-Path $cargoConfigDir "config.toml"
        
        if (-not (Test-Path $cargoConfigDir)) {
            New-Item -Path $cargoConfigDir -ItemType Directory | Out-Null
        }
        
        # Using a known reliable mirror
        $configContent = "[source.crates-io]`nreplace-with = 'rsproxy'`n`n[source.rsproxy]`nregistry = 'https://rsproxy.cn/crates.io-index'"
        Set-Content -Path $cargoConfigFile -Value $configContent
        
        Write-Log "Temporarily configured cargo to use a mirror (rsproxy.cn)."
        
        # Retry installation
        cargo install tauri-cli
        
        # Clean up the temporary config file
        Remove-Item -Path $cargoConfigFile -Force
        Write-Log "Removed temporary cargo configuration."
    }

    # Final verification
    cargo tauri --version > $null 2>&1
    if (-not $?) {
        Write-Log "Error: Failed to install tauri-cli even with a mirror." -Color Red
        Write-Log "Please check your network connection and try 'cargo install tauri-cli' manually." -Color Red
        exit 1
    }
    Write-Log "tauri-cli installed successfully." -Color Green
} else {
    Write-Log "Tauri CLI is already installed." -Color Green
}

# 5. Start the development server
Write-Log "All checks passed. Starting Tauri development server..." -Color Cyan
Write-Log "Executing: pnpm run tauri:dev"

pnpm run tauri:dev