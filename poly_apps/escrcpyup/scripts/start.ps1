# ============================================
# Escrcpy Start Script (PowerShell)
# ============================================

# Set encoding to UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Change to project root directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

# Color definitions
function Write-ColorText {
    param(
        [string]$Text,
        [string]$Color = "White"
    )
    Write-Host $Text -ForegroundColor $Color
}

function Write-Success {
    param([string]$Text)
    Write-ColorText "[OK] $Text" "Green"
}

function Write-Error {
    param([string]$Text)
    Write-ColorText "[ERROR] $Text" "Red"
}

function Write-Info {
    param([string]$Text)
    Write-ColorText "[INFO] $Text" "Cyan"
}

function Write-Warning {
    param([string]$Text)
    Write-ColorText "[WARN] $Text" "Yellow"
}

# Display Banner
function Show-Banner {
    Clear-Host
    Write-ColorText @"
================================================

        Escrcpy Development Toolkit
        Scrcpy Powered by Electron

================================================
"@ "Cyan"
    Write-Host ""
}

# Check if Node.js is installed
function Test-NodeInstalled {
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            Write-Success "Node.js installed: $nodeVersion"
            return $true
        }
    } catch {
        Write-Error "Node.js not installed"
        return $false
    }
    return $false
}

# Check if pnpm is installed
function Test-PnpmInstalled {
    try {
        $pnpmVersion = pnpm --version 2>$null
        if ($pnpmVersion) {
            Write-Success "pnpm installed: v$pnpmVersion"
            return $true
        }
    } catch {
        Write-Warning "pnpm not installed"
        return $false
    }
    return $false
}

# Install pnpm
function Install-Pnpm {
    Write-Info "Installing pnpm..."
    try {
        npm install -g pnpm
        Write-Success "pnpm installed successfully"
        return $true
    } catch {
        Write-Error "Failed to install pnpm: $_"
        return $false
    }
}

# Check and install dependencies
function Install-Dependencies {
    Write-Info "Restoring binary files from .py backups..."
    Write-Host ""

    # Restore binaries (adb.exe, scrcpy.exe, etc.) from .exe.py, .dll.py files
    & "$PSScriptRoot\prepare-binaries.ps1" -Action restore

    Write-Host ""
    Write-Info "Cleaning old dependencies..."
    Write-Host ""

    # Remove node_modules to avoid hoisting conflicts
    if (Test-Path "node_modules") {
        Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
    }

    Write-Info "Installing all dependencies with pnpm..."
    Write-Host ""

    # Clean install with streaming output
    & pnpm install --reporter=append-only

    Write-Host ""
    Write-Info "Running postinstall for Electron..."
    & pnpm run postinstall

    Write-Host ""
    Write-Info "Fixing Electron installation..."
    & pnpm run electron-fix

    Write-Host ""
    Write-Success "All dependencies ready"
    return $true
}

# Auto-initialize environment
function Initialize-Environment {
    Show-Banner
    Write-ColorText "=== Environment Initialization ===" "Yellow"
    Write-Host ""

    # Check Node.js
    if (-not (Test-NodeInstalled)) {
        Write-Error "Please install Node.js first: https://nodejs.org/"
        Write-Host ""
        Read-Host "Press Enter to return to main menu"
        return $false
    }

    # Check and install pnpm
    if (-not (Test-PnpmInstalled)) {
        $install = Read-Host "Install pnpm? (Y/n)"
        if ($install -ne 'n' -and $install -ne 'N') {
            if (-not (Install-Pnpm)) {
                Read-Host "Press Enter to return to main menu"
                return $false
            }
        } else {
            Write-Warning "Skipped pnpm installation"
            Read-Host "Press Enter to return to main menu"
            return $false
        }
    }

    # Install project dependencies
    if (-not (Install-Dependencies)) {
        Read-Host "Press Enter to return to main menu"
        return $false
    }

    Write-Host ""
    Write-Success "Environment initialization completed!"
    Write-Host ""
    Read-Host "Press Enter to return to main menu"
    return $true
}

# Verify Electron version
function Test-ElectronVersion {
    Write-Info "Verifying Electron installation..."

    try {
        $electronVersion = & pnpm exec electron --version 2>$null
        if ($electronVersion) {
            Write-Success "Local Electron version: $electronVersion"
            return $true
        }
    } catch {
        Write-Warning "Cannot detect Electron version"
    }

    return $true
}

# Start development server
function Start-DevServer {
    Show-Banner
    Write-ColorText "=== Start Development Server ===" "Yellow"
    Write-Host ""

    Write-Info "Preparing environment..."
    Write-Host ""
    Install-Dependencies | Out-Null
    Write-Host ""

    Test-ElectronVersion | Out-Null
    Write-Host ""

    Write-Info "Starting Vite + Electron development server..."
    Write-Info "Server address: http://localhost:1535"
    Write-Host ""
    Write-Warning "Press Ctrl+C to stop server"
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    & pnpm run dev

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Info "Development server stopped"
    Write-Host ""
    Read-Host "Press Enter to return to main menu"
}

# Build project
function Build-Project {
    param([string]$Platform)

    Show-Banner
    Write-ColorText "=== Build Project ===" "Yellow"
    Write-Host ""

    Write-Info "Preparing environment..."
    Write-Host ""
    Install-Dependencies
    Write-Host ""

    $buildCommand = switch ($Platform) {
        "Windows" { "build:win" }
        "macOS" { "build:mac" }
        "Linux" { "build:linux" }
        "All" { "build" }
        default { "build" }
    }

    Write-Info "Build platform: $Platform"
    Write-Info "Execute command: pnpm run $buildCommand"
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    $startTime = Get-Date
    & pnpm run $buildCommand
    $duration = (Get-Date) - $startTime

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Info "Build completed! Time: $([math]::Round($duration.TotalSeconds, 2))s"
    Write-Info "Output directory: dist, dist-electron"
    Write-Host ""
    Read-Host "Press Enter to return to main menu"
}

# Select build platform
function Select-BuildPlatform {
    Show-Banner
    Write-ColorText "=== Select Build Platform ===" "Yellow"
    Write-Host ""

    Write-Host "  1. Windows"
    Write-Host "  2. macOS"
    Write-Host "  3. Linux"
    Write-Host "  4. All Platforms"
    Write-Host "  0. Back to Main Menu"
    Write-Host ""

    $choice = Read-Host "Please select (0-4)"

    switch ($choice) {
        "1" { Build-Project -Platform "Windows" }
        "2" { Build-Project -Platform "macOS" }
        "3" { Build-Project -Platform "Linux" }
        "4" { Build-Project -Platform "All" }
        "0" { return }
        default {
            Write-Warning "Invalid selection"
            Start-Sleep -Seconds 1
            Select-BuildPlatform
        }
    }
}

# Run code linting
function Run-Lint {
    Show-Banner
    Write-ColorText "=== Code Linting ===" "Yellow"
    Write-Host ""

    Write-Info "Running ESLint..."
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    & pnpm run lint

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Press Enter to return to main menu"
}

# Fix code issues
function Fix-Lint {
    Show-Banner
    Write-ColorText "=== Fix Code Issues ===" "Yellow"
    Write-Host ""

    Write-Info "Auto-fixing code issues..."
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    & pnpm run lint:fix

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Press Enter to return to main menu"
}

# Clean project
function Clear-Project {
    Show-Banner
    Write-ColorText "=== Clean Project ===" "Yellow"
    Write-Host ""

    $confirm = Read-Host "Confirm delete node_modules and dist directories? (y/N)"
    if ($confirm -eq 'y' -or $confirm -eq 'Y') {
        Write-Info "Cleaning..."

        if (Test-Path "node_modules") {
            Remove-Item -Recurse -Force "node_modules"
            Write-Success "Deleted node_modules"
        }

        if (Test-Path "dist") {
            Remove-Item -Recurse -Force "dist"
            Write-Success "Deleted dist"
        }

        if (Test-Path "dist-electron") {
            Remove-Item -Recurse -Force "dist-electron"
            Write-Success "Deleted dist-electron"
        }

        Write-Host ""
        Write-Success "Clean completed!"
    } else {
        Write-Info "Cancelled"
    }

    Write-Host ""
    Read-Host "Press Enter to return to main menu"
}

# Display project information
function Show-ProjectInfo {
    Show-Banner
    Write-ColorText "=== Project Information ===" "Yellow"
    Write-Host ""

    $packageJson = Get-Content "package.json" | ConvertFrom-Json

    Write-Host "Project Name: " -NoNewline
    Write-ColorText $packageJson.name "Green"

    Write-Host "Version     : " -NoNewline
    Write-ColorText $packageJson.version "Green"

    Write-Host "Description : " -NoNewline
    Write-ColorText $packageJson.description "Green"

    Write-Host "Author      : " -NoNewline
    Write-ColorText $packageJson.author "Green"

    Write-Host ""
    Write-Info "Project Path: $projectRoot"

    # Node version
    $nodeVersion = node --version
    Write-Info "Node.js: $nodeVersion"

    # pnpm version
    try {
        $pnpmVersion = pnpm --version
        Write-Info "pnpm   : v$pnpmVersion"
    } catch {
        Write-Warning "pnpm not installed"
    }

    Write-Host ""
    Read-Host "Press Enter to return to main menu"
}

# Main menu
function Show-MainMenu {
    while ($true) {
        Show-Banner
        Write-ColorText "=== Main Menu ===" "Yellow"
        Write-Host ""
        Write-Host "  1. Start Development Server"
        Write-Host "  2. Build Project"
        Write-Host "  3. Initialize Environment"
        Write-Host "  4. Code Linting"
        Write-Host "  5. Fix Code Issues"
        Write-Host "  6. Clean Project"
        Write-Host "  7. Project Information"
        Write-Host "  0. Exit"
        Write-Host ""

        $choice = Read-Host "Please select (0-7)"

        switch ($choice) {
            "1" { Start-DevServer }
            "2" { Select-BuildPlatform }
            "3" { Initialize-Environment }
            "4" { Run-Lint }
            "5" { Fix-Lint }
            "6" { Clear-Project }
            "7" { Show-ProjectInfo }
            "0" {
                Write-Host ""
                Write-ColorText "Thank you for using Escrcpy Development Toolkit!" "Cyan"
                Write-Host ""
                exit 0
            }
            default {
                Write-Warning "Invalid selection, please try again"
                Start-Sleep -Seconds 1
            }
        }
    }
}

# Start main menu
Show-MainMenu
