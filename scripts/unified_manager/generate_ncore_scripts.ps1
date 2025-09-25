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

# NCore App Script Generator
# Generates standardized scripts for all NCore applications

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$UTILS_PATH = Join-Path $SCRIPT_DIR "common\utils.ps1"
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $SCRIPT_DIR)

# Import utilities
. $UTILS_PATH

# Function to generate PowerShell start script for unified manager
function New-NCoreStartScript {
    param([string]$AppName)

    $scriptContent = @"
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

# NCore App Start Script - $AppName
# Unified manager script for starting $AppName application

# Variables declaration
`$SCRIPT_DIR = Split-Path -Parent `$MyInvocation.MyCommand.Path
`$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent `$SCRIPT_DIR)

Write-Host "[INFO] Starting NCore application: $AppName" -ForegroundColor Green
Write-Host "[INFO] Project root: `$PROJECT_ROOT" -ForegroundColor Gray
Write-Host "[INFO] App directory: `$APP_DIR" -ForegroundColor Gray

# Change to project root
Set-Location `$PROJECT_ROOT

# Execute NCore application
try {
    Write-Host "[INFO] Executing: node ./main.js app=$AppName" -ForegroundColor Cyan
    node ./main.js app=$AppName
}
catch {
    Write-Host "[ERROR] Failed to start $AppName`: `$_" -ForegroundColor Red
    exit 1
}
"@
    
    return $scriptContent
}

# Function to generate Shell start script
function New-NCoreStartScriptLinux {
    param([string]$AppName, [string]$AppPath)
    
    $scriptContent = @"
#!/bin/bash

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

# NCore App Start Script - $AppName
# Auto-generated script for starting $AppName application

# Variables declaration
SCRIPT_DIR="`$(cd "`$(dirname "`${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="`$(dirname "`$SCRIPT_DIR")"
PROJECT_ROOT="`$(dirname "`$(dirname "`$APP_DIR")")"

echo "[INFO] Starting NCore application: $AppName"
echo "[INFO] Project root: `$PROJECT_ROOT"
echo "[INFO] App directory: `$APP_DIR"

# Change to project root
cd "`$PROJECT_ROOT" || exit 1

# Execute NCore application
echo "[INFO] Executing: node ./main.js app=$AppName"
node ./main.js app=$AppName
"@
    
    return $scriptContent
}

# Function to generate install script
function New-NCoreInstallScript {
    param([string]$AppName, [string]$AppPath)
    
    $scriptContent = @"
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

# NCore App Install Script - $AppName
# Auto-generated script for installing $AppName dependencies

# Variables declaration
`$SCRIPT_DIR = Split-Path -Parent `$MyInvocation.MyCommand.Path
`$APP_DIR = Split-Path -Parent `$SCRIPT_DIR
`$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent `$APP_DIR)

Write-Host "[INFO] Installing dependencies for NCore application: $AppName" -ForegroundColor Green
Write-Host "[INFO] Project root: `$PROJECT_ROOT" -ForegroundColor Gray

# Change to project root
Set-Location `$PROJECT_ROOT

# Install shared dependencies
try {
    Write-Host "[INFO] Installing shared dependencies with yarn..." -ForegroundColor Cyan
    yarn install
    
    if (`$LASTEXITCODE -eq 0) {
        Write-Host "[SUCCESS] Dependencies installed successfully for $AppName" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "[ERROR] Failed to install dependencies: `$_" -ForegroundColor Red
    exit 1
}
"@
    
    return $scriptContent
}

# Function to generate deploy script
function New-NCoreDeployScript {
    param([string]$AppName, [string]$AppPath)
    
    $scriptContent = @"
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

# NCore App Deploy Script - $AppName
# Auto-generated script for deploying $AppName application

# Variables declaration
`$SCRIPT_DIR = Split-Path -Parent `$MyInvocation.MyCommand.Path
`$APP_DIR = Split-Path -Parent `$SCRIPT_DIR
`$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent `$APP_DIR)

Write-Host "[INFO] Deploying NCore application: $AppName" -ForegroundColor Green
Write-Host "[INFO] Project root: `$PROJECT_ROOT" -ForegroundColor Gray

# Change to project root
Set-Location `$PROJECT_ROOT

# Deploy application (customize as needed)
try {
    Write-Host "[INFO] Deploying $AppName..." -ForegroundColor Cyan
    
    # Add deployment logic here
    # Example: copy files, restart services, etc.
    
    Write-Host "[SUCCESS] $AppName deployed successfully" -ForegroundColor Green
}
catch {
    Write-Host "[ERROR] Failed to deploy $AppName`: `$_" -ForegroundColor Red
    exit 1
}
"@
    
    return $scriptContent
}

# Function to generate stop script
function New-NCoreStopScript {
    param([string]$AppName, [string]$AppPath)
    
    $scriptContent = @"
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

# NCore App Stop Script - $AppName
# Auto-generated script for stopping $AppName application

Write-Host "[INFO] Stopping NCore application: $AppName" -ForegroundColor Yellow

try {
    # Stop processes matching the app name
    `$processes = Get-Process | Where-Object { `$_.ProcessName -eq "node" -and `$_.CommandLine -like "*app=$AppName*" }
    
    if (`$processes) {
        foreach (`$process in `$processes) {
            Write-Host "[INFO] Stopping process PID: `$(`$process.Id)" -ForegroundColor Cyan
            Stop-Process -Id `$process.Id -Force
        }
        Write-Host "[SUCCESS] $AppName stopped successfully" -ForegroundColor Green
    } else {
        Write-Host "[INFO] No running processes found for $AppName" -ForegroundColor Gray
    }
}
catch {
    Write-Host "[ERROR] Failed to stop $AppName`: `$_" -ForegroundColor Red
    exit 1
}
"@
    
    return $scriptContent
}

# Main function to generate all scripts for NCore apps
function New-AllNCoreScripts {
    Write-Info "Generating standardized scripts for all NCore applications..."
    
    $registry = Get-AppRegistry
    if (-not $registry) {
        Write-Error "Failed to load application registry"
        return $false
    }
    
    $ncoreApps = @()
    foreach ($appName in $registry.apps.PSObject.Properties.Name) {
        $app = $registry.apps.$appName
        if ($app.type -eq "ncore-app") {
            $ncoreApps += @{
                Name = $appName
                Path = $app.path
                NCoreAppName = $app.ncore_app_name
            }
        }
    }
    
    Write-Info "Found $($ncoreApps.Count) NCore applications"
    
    foreach ($app in $ncoreApps) {
        $appPath = Join-Path $PROJECT_ROOT $app.Path
        $scriptsDir = Join-Path $appPath "scripts"
        
        # Create scripts directory if it doesn't exist
        if (-not (Test-Path $scriptsDir)) {
            New-Item -ItemType Directory -Path $scriptsDir -Force | Out-Null
            Write-Info "Created scripts directory: $scriptsDir"
        }
        
        # Generate PowerShell scripts
        $startScript = New-NCoreStartScript -AppName $app.NCoreAppName -AppPath $app.Path
        $installScript = New-NCoreInstallScript -AppName $app.NCoreAppName -AppPath $app.Path
        $deployScript = New-NCoreDeployScript -AppName $app.NCoreAppName -AppPath $app.Path
        $stopScript = New-NCoreStopScript -AppName $app.NCoreAppName -AppPath $app.Path
        
        # Generate Linux scripts
        $startScriptLinux = New-NCoreStartScriptLinux -AppName $app.NCoreAppName -AppPath $app.Path
        
        # Write scripts to files
        $startScript | Out-File -FilePath (Join-Path $scriptsDir "start.ps1") -Encoding UTF8
        $installScript | Out-File -FilePath (Join-Path $scriptsDir "install.ps1") -Encoding UTF8
        $deployScript | Out-File -FilePath (Join-Path $scriptsDir "deploy.ps1") -Encoding UTF8
        $stopScript | Out-File -FilePath (Join-Path $scriptsDir "stop.ps1") -Encoding UTF8
        $startScriptLinux | Out-File -FilePath (Join-Path $scriptsDir "start.sh") -Encoding UTF8
        
        Write-Success "Generated scripts for: $($app.Name)"
    }
    
    Write-Success "All NCore application scripts generated successfully!"
    return $true
}

# Main execution
if (-not (Test-Path $UTILS_PATH)) {
    Write-Error "Utilities not found: $UTILS_PATH"
    exit 1
}

$success = New-AllNCoreScripts
if (-not $success) {
    exit 1
}

exit 0
