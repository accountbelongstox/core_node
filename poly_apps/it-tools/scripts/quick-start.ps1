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



# Global status variables
$global:SCRIPT_STATUS = 0
$global:NODEJS_STATUS = 0
$global:PNPM_STATUS = 0
$global:PNPM_PATH_STATUS = 0
$global:DEPENDENCIES_STATUS = 0
$global:BUILD_STATUS = 0
$global:PORT_STATUS = 0

# Logging functions
function Log-Info {
    param ([string]$message)
    Write-Host "[INFO] $message" -ForegroundColor Gray
}

function Log-Success {
    param ([string]$message)
    Write-Host "[SUCCESS] $message" -ForegroundColor Green
}

function Log-Warning {
    param ([string]$message)
    Write-Host "[WARNING] $message" -ForegroundColor Yellow
}

function Log-Error {
    param ([string]$message)
    Write-Host "[ERROR] $message" -ForegroundColor Red
}

# Function to check for and install Node.js
function Check-And-Install-NodeJs {
    $node_exists = Get-Command node -ErrorAction SilentlyContinue
    if ($node_exists) {
        $global:NODEJS_STATUS = 1
        Log-Success "Node.js installation verified"
    } else {
        $global:NODEJS_STATUS = 0
        Log-Warning "Node.js is not installed or not in PATH. Please install Node.js."
    }
}

# Function to check for and install pnpm
function Check-And-Install-Pnpm {
    $pnpm_exists = Get-Command pnpm -ErrorAction SilentlyContinue
    if (-not $pnpm_exists) {
        Log-Info "Installing pnpm..."
        $npm_exists = Get-Command npm -ErrorAction SilentlyContinue
        if ($npm_exists) {
            npm install -g pnpm
        } else {
            Log-Error "npm not found, cannot install pnpm"
            Log-Warning "pnpm installation skipped, will try to find existing installation"
            $global:PNPM_STATUS = 0
            return
        }
    }

    $pnpm_exists = Get-Command pnpm -ErrorAction SilentlyContinue
    if (-not $pnpm_exists) {
        Log-Error "pnpm installation failed"
        Log-Warning "pnpm installation failed, will try to find existing installation"
        $global:PNPM_STATUS = 0
    } else {
        $global:PNPM_STATUS = 1
        Log-Success "pnpm installation verified"
    }
}

# Function to ensure pnpm is in the PATH
function Ensure-Pnpm-In-Path {
    Log-Info "Ensuring pnpm is available in PATH..."
    $pnpm_path = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($pnpm_path) {
        Log-Success "pnpm found at: $($pnpm_path.Source)"
        $global:PNPM_PATH_STATUS = 1
        return
    }

    $npm_exists = Get-Command npm -ErrorAction SilentlyContinue
    if ($npm_exists) {
        $node_path = Get-Command node -ErrorAction SilentlyContinue
        if ($node_path) {
            $node_dir = Split-Path $node_path.Source -Parent
            Log-Info "Node.js directory: $node_dir"

            $pnpm_candidates = @(
                "$node_dir\pnpm.exe",
                "$node_dir\..\bin\pnpm.exe",
                "$node_dir\..\lib\node_modules\pnpm\bin\pnpm.exe",
                "C:\Program Files\nodejs\pnpm.exe",
                "$env:APPDATA\npm\pnpm.exe",
                "$env:LOCALAPPDATA\npm\pnpm.exe"
            )

            $npm_global_dir = npm config get prefix 2>$null
            if ($npm_global_dir) {
                $pnpm_candidates += "$npm_global_dir\bin\pnpm.exe"
                $pnpm_candidates += "$npm_global_dir\lib\node_modules\pnpm\bin\pnpm.exe"
            }

            foreach ($candidate in $pnpm_candidates) {
                if (Test-Path $candidate) {
                    Log-Info "Found pnpm at: $candidate"
                    # Create a symlink if necessary
                    if ($candidate -ne "C:\Program Files\nodejs\pnpm.exe") {
                        Log-Info "Creating symlink to C:\Program Files\nodejs\pnpm.exe..."
                        try {
                            New-Item -ItemType SymbolicLink -Path "C:\Program Files\nodejs\pnpm.exe" -Value $candidate -ErrorAction Stop
                            Log-Success "pnpm symlink created successfully"
                            $pnpm_version = pnpm --version
                            Log-Success "pnpm symlink verified: $pnpm_version"
                            $global:PNPM_PATH_STATUS = 1
                            return
                        } catch {
                            Log-Warning "Failed to create symlink, but pnpm is available at: $candidate"
                            $global:PNPM_PATH_STATUS = 1
                            return
                        }
                    } else {
                        Log-Success "pnpm already in C:\Program Files\nodejs"
                        $global:PNPM_PATH_STATUS = 1
                        return
                    }
                }
            }
        }
    }

    Log-Warning "pnpm not found in common locations, attempting reinstall..."
    if ($npm_exists) {
        npm install -g pnpm
        if (Get-Command pnpm -ErrorAction SilentlyContinue) {
            Log-Success "pnpm reinstalled and found"
            $global:PNPM_PATH_STATUS = 1
            return
        }
    }

    Log-Error "Failed to locate or install pnpm"
    Log-Warning "pnpm setup failed, but continuing with script execution"
    $global:PNPM_PATH_STATUS = 0
}

# Function to get local IP addresses
function Get-IPs {
    $ips = Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred | Where-Object { $_.IPAddress -ne "127.0.0.1" } | ForEach-Object { $_.IPAddress }
    if ($ips) {
        return $ips
    } else {
        return "0.0.0.0"
    }
}

# Function to find an available port
function Find-Available-Port {
    $port = 8088
    while ($port -lt 8100) {
        $tcp_listeners = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if (-not $tcp_listeners) {
            return $port
        }
        Log-Warning "Port $port is occupied, trying next port"
        $port++
    }
    Log-Error "Cannot find available port"
    return -1
}

# Main script execution
function Main {
    Write-Host "     IT-Tools Quick Start"

    Log-Info "Updating system and installing dependencies..."
    try {
        choco install -y curl wget git ffmpeg nodejs npm
    } catch {
        Log-Warning "Chocolatey command failed. Please ensure Chocolatey is installed and in your PATH."
    }


    Check-And-Install-NodeJs
    if ($global:NODEJS_STATUS -ne 1) {
        Log-Warning "Node.js installation may have failed, but continuing..."
    }

    Check-And-Install-Pnpm
    if ($global:PNPM_STATUS -ne 1) {
        Log-Warning "pnpm installation may have failed, but continuing..."
    }

    Ensure-Pnpm-In-Path
    if ($global:PNPM_PATH_STATUS -ne 1) {
        Log-Warning "pnpm path setup failed, but continuing..."
    }

    Log-Info "Installing project dependencies..."
    pnpm install
    if ($LASTEXITCODE -eq 0) {
        $global:DEPENDENCIES_STATUS = 1
        Log-Success "Project dependencies installed successfully"
    } else {
        $global:DEPENDENCIES_STATUS = 0
        Log-Warning "Project dependencies installation may have failed, but continuing..."
    }

    Log-Info "Building project..."
    pnpm build
    if ($LASTEXITCODE -eq 0) {
        $global:BUILD_STATUS = 1
        Log-Success "Project built successfully"
    } else {
        $global:BUILD_STATUS = 0
        Log-Warning "Project build may have failed, but continuing..."
    }

    $ips = Get-IPs
    $port = Find-Available-Port

    if ($port -ne -1) {
        $global:PORT_STATUS = 1
    } else {
        Log-Error "Failed to find available port, using default port 8088"
        $port = 8088
        $global:PORT_STATUS = 0
    }

    Write-Host ""
    Log-Success "Service started successfully!"
    Write-Host "Local access:"
    Write-Host "  http://localhost:$port"
    Write-Host ""
    Write-Host "Network access:"
    foreach ($ip in $ips) {
        Write-Host "  http://$ip`:$port"
    }
    Write-Host ""
    Write-Host "Video compression integrated into main server"
    Write-Host "Press Ctrl+C to stop service"
    Write-Host ""

    pnpm preview --port $port --host 0.0.0.0
}

# Run the main function
Main
