# Matrix UI React - Startup Script
# Automatically installs pnpm if not present, then displays menu for dev/build operations

$ErrorActionPreference = 'Continue'

# Get project root directory (scripts folder's parent)
if ($PSScriptRoot) {
    $script:ProjectRoot = Split-Path -Parent $PSScriptRoot
} else {
    $script:ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}

# Verify project root exists and contains package.json
$packageJsonPath = Join-Path $script:ProjectRoot 'package.json'
if (-not (Test-Path $packageJsonPath)) {
    Write-Host '[WARNING] package.json not found in expected location. Using script directory parent.' -ForegroundColor 'Yellow'
}

Write-Host ""
Write-Host '========================================' -ForegroundColor 'Cyan'
Write-Host 'Matrix UI React - Startup Script' -ForegroundColor 'Cyan'
$projectRootMsg = 'Project Root: ' + $script:ProjectRoot
Write-Host $projectRootMsg -ForegroundColor 'Gray'
Write-Host '========================================' -ForegroundColor 'Cyan'
Write-Host ""

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = 'White'
    )
    Write-Host $Message -ForegroundColor $Color
}

function Test-PnpmInstalled {
    $pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($pnpmCmd) {
        return $true
    }
    return $false
}

function Install-Pnpm {
    Write-ColorOutput '[INFO] pnpm is not installed. Installing pnpm...' 'Yellow'
    
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($npmCmd) {
        Write-ColorOutput '[INFO] Installing pnpm via npm...' 'Cyan'
        npm install -g pnpm
    }
    else {
        Write-ColorOutput '[INFO] npm not found. Trying standalone installer...' 'Cyan'
        try {
            Invoke-WebRequest -Uri "https://get.pnpm.io/install.ps1" -UseBasicParsing | Invoke-Expression
        }
        catch {
            $errorMsg = '[ERROR] Failed to install pnpm: ' + $_
            Write-ColorOutput $errorMsg 'Red'
            Write-ColorOutput '[INFO] Please install pnpm manually: npm install -g pnpm' 'Yellow'
            return $false
        }
    }
    
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
    
    # Verify installation
    Start-Sleep -Seconds 2
    if (Test-PnpmInstalled) {
        Write-ColorOutput '[SUCCESS] pnpm installed successfully!' 'Green'
        return $true
    }
    else {
        Write-ColorOutput '[WARNING] pnpm installation may require terminal restart.' 'Yellow'
        return $false
    }
}

function Install-Dependencies {
    Write-Host ""
    Write-ColorOutput '[INFO] Updating pnpm to latest version...' 'Cyan'
    pnpm self-update
    
    Write-Host ""
    Write-ColorOutput '[INFO] Installing project dependencies...' 'Cyan'
    Set-Location $script:ProjectRoot
    
    pnpm install
    
    Write-ColorOutput '[INFO] Dependency installation completed.' 'Green'
}

function Start-DevServer {
    Write-Host ""
    Write-ColorOutput '[INFO] Starting development server...' 'Cyan'
    Write-ColorOutput '[INFO] Press Ctrl+C to stop the server' 'Yellow'
    Write-ColorOutput ""
    Set-Location $script:ProjectRoot
    
    pnpm dev
}

function Start-Build {
    Write-Host ""
    Write-ColorOutput '[INFO] Building project...' 'Cyan'
    Set-Location $script:ProjectRoot
    
    pnpm build
    
    Write-Host ""
    Write-ColorOutput '[INFO] Build process completed.' 'Green'
}

function Start-Preview {
    Write-Host ""
    Write-ColorOutput '[INFO] Starting preview server...' 'Cyan'
    Write-ColorOutput '[INFO] Press Ctrl+C to stop the server' 'Yellow'
    Write-ColorOutput ""
    Set-Location $script:ProjectRoot
    
    pnpm preview
}

function Show-Menu {
    Clear-Host
    Write-Host ""
    Write-Host '============================================================' -ForegroundColor 'Cyan'
    Write-Host '         Matrix UI React - Development Menu              ' -ForegroundColor 'Cyan'
    Write-Host '============================================================' -ForegroundColor 'Cyan'
    Write-Host ""
    Write-Host '  [1] Start Development Server (pnpm dev)' -ForegroundColor 'White'
    Write-Host '  [2] Build Project (pnpm build)' -ForegroundColor 'White'
    Write-Host '  [3] Preview Production Build (pnpm preview)' -ForegroundColor 'White'
    Write-Host '  [4] Install/Update Dependencies (pnpm install)' -ForegroundColor 'White'
    Write-Host '  [5] Exit' -ForegroundColor 'White'
    Write-Host ""
}

# Main execution
# Check and install pnpm
    if (-not (Test-PnpmInstalled)) {
        Write-ColorOutput '[WARNING] pnpm is not installed.' 'Yellow'
        $installed = Install-Pnpm
        if (-not $installed) {
            Write-ColorOutput '[ERROR] Could not install pnpm. Please install manually.' 'Red'
            Write-ColorOutput '[INFO] Run: npm install -g pnpm' 'Yellow'
            Write-Host ""
            Read-Host 'Press Enter to exit'
            exit
        }
    }
    else {
        $pnpmVersion = pnpm --version
        $versionMsg = '[INFO] pnpm is already installed. Version: ' + $pnpmVersion
        Write-ColorOutput $versionMsg 'Green'
    }
    
    # Check if node_modules exists
    $nodeModulesPath = Join-Path $script:ProjectRoot 'node_modules'
    if (-not (Test-Path $nodeModulesPath)) {
        Write-ColorOutput '[INFO] node_modules not found. Installing dependencies...' 'Yellow'
        Install-Dependencies
    }
    else {
        Write-ColorOutput '[INFO] Dependencies already installed.' 'Green'
    }
    
    Write-Host ""
    Write-ColorOutput '[INFO] Setup complete. Opening menu...' 'Cyan'
    Start-Sleep -Seconds 1
    
    # Main menu loop
    while ($true) {
        Show-Menu
        $choice = Read-Host 'Select an option'
        
        switch ($choice) {
            '1' {
                Start-DevServer
                Write-Host ""
                Write-ColorOutput '[INFO] Development server stopped.' 'Yellow'
                Write-Host ""
                Read-Host 'Press Enter to continue'
            }
            '2' {
                Start-Build
                Write-Host ""
                Read-Host 'Press Enter to continue'
            }
            '3' {
                Start-Preview
                Write-Host ""
                Write-ColorOutput '[INFO] Preview server stopped.' 'Yellow'
                Write-Host ""
                Read-Host 'Press Enter to continue'
            }
            '4' {
                Install-Dependencies
                Write-Host ""
                Read-Host 'Press Enter to continue'
            }
            '5' {
                Write-Host ""
                $exitMsg = '[INFO] Exiting...'
                Write-ColorOutput $exitMsg 'Cyan'
                exit
            }
            default {
                Write-Host ""
                $errorMsg = '[ERROR] Invalid option. Please select 1-5.'
                Write-ColorOutput $errorMsg 'Red'
                Start-Sleep -Seconds 1
            }
        }
    }
