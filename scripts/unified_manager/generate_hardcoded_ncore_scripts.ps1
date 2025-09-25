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

# Generate Hardcoded NCore Scripts
# Creates hardcoded scripts for each NCore application in their respective apps/{appname}/scripts/ directories

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$UTILS_PATH = Join-Path $SCRIPT_DIR "common\utils.ps1"
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $SCRIPT_DIR)

# Import utilities
. $UTILS_PATH

Write-Info "Generating hardcoded NCore application scripts..."

$registry = Get-AppRegistry
if (-not $registry) {
    Write-Error "Failed to load application registry"
    exit 1
}

# Get all NCore applications (excluding DevOps which is already done)
$ncoreApps = @()
foreach ($appName in $registry.apps.PSObject.Properties.Name) {
    $appConfig = $registry.apps.$appName
    if ($appConfig.type -eq "ncore-app" -and $appName -ne "DevOps") {
        $ncoreApps += $appName
    }
}

Write-Info "Found $($ncoreApps.Count) NCore applications to process (excluding DevOps)"

foreach ($appName in $ncoreApps) {
    Write-Info "Generating scripts for: $appName"
    
    # Create scripts directory
    $appScriptsDir = Join-Path $PROJECT_ROOT "apps\$appName\scripts"
    if (-not (Test-Path $appScriptsDir)) {
        New-Item -ItemType Directory -Path $appScriptsDir -Force | Out-Null
    }
    
    # Generate start.ps1
    $startPs1 = @"
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

# $appName NCore App Start Script
# Hardcoded start script for $appName application

# Variables declaration
`$SCRIPT_DIR = Split-Path -Parent `$MyInvocation.MyCommand.Path
`$APP_DIR = Split-Path -Parent `$SCRIPT_DIR
`$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent `$APP_DIR)

Write-Host "[INFO] Starting NCore application: $appName" -ForegroundColor Green

try {
    # Change to project root directory
    Set-Location `$PROJECT_ROOT
    
    # Check if main.js exists
    if (-not (Test-Path "main.js")) {
        Write-Host "[ERROR] main.js not found in project root" -ForegroundColor Red
        exit 1
    }
    
    # Start $appName using unified entry point
    Write-Host "[INFO] Executing: node ./main.js app=$appName" -ForegroundColor Cyan
    node ./main.js app=$appName
}
catch {
    Write-Host "[ERROR] Failed to start $appName`: `$_" -ForegroundColor Red
    exit 1
}

exit 0
"@
    
    # Generate start.sh
    $startSh = @"
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

# $appName NCore App Start Script
# Hardcoded start script for $appName application

# Variables declaration
SCRIPT_DIR="`$(cd "`$(dirname "`${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="`$(dirname "`$SCRIPT_DIR")"
PROJECT_ROOT="`$(dirname "`$(dirname "`$APP_DIR")")"

echo "[INFO] Starting NCore application: $appName"

# Change to project root directory
cd "`$PROJECT_ROOT" || {
    echo "[ERROR] Failed to change to project root: `$PROJECT_ROOT"
    exit 1
}

# Check if main.js exists
if [ ! -f "main.js" ]; then
    echo "[ERROR] main.js not found in project root"
    exit 1
fi

# Start $appName using unified entry point
echo "[INFO] Executing: node ./main.js app=$appName"
node ./main.js app=$appName

exit 0
"@
    
    # Generate install.ps1
    $installPs1 = @"
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

# $appName NCore App Install Script
# Hardcoded install script for $appName application

# Variables declaration
`$SCRIPT_DIR = Split-Path -Parent `$MyInvocation.MyCommand.Path
`$APP_DIR = Split-Path -Parent `$SCRIPT_DIR
`$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent `$APP_DIR)
`$COMMON_INSTALL = Join-Path `$PROJECT_ROOT "scripts\unified_manager\ncore_common_install.ps1"

Write-Host "[INFO] Installing dependencies for $appName application" -ForegroundColor Green

try {
    # Call common install script first
    if (Test-Path `$COMMON_INSTALL) {
        Write-Host "[INFO] Calling common NCore install script..." -ForegroundColor Cyan
        & `$COMMON_INSTALL
        if (`$LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Common install script failed" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "[ERROR] Common install script not found: `$COMMON_INSTALL" -ForegroundColor Red
        exit 1
    }

    # $appName-specific installation logic (if any)
    Write-Host "[INFO] $appName-specific installation completed" -ForegroundColor Green
}
catch {
    Write-Host "[ERROR] Failed to install $appName dependencies: `$_" -ForegroundColor Red
    exit 1
}

exit 0
"@

    # Generate install.sh
    $installSh = @"
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

# $appName NCore App Install Script
# Hardcoded install script for $appName application

# Variables declaration
SCRIPT_DIR="`$(cd "`$(dirname "`${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="`$(dirname "`$SCRIPT_DIR")"
PROJECT_ROOT="`$(dirname "`$(dirname "`$APP_DIR")")"
COMMON_INSTALL="`$PROJECT_ROOT/scripts/unified_manager/ncore_common_install.sh"

echo "[INFO] Installing dependencies for $appName application"

# Call common install script first
if [ -f "`$COMMON_INSTALL" ]; then
    echo "[INFO] Calling common NCore install script..."
    if bash "`$COMMON_INSTALL"; then
        echo "[INFO] Common install completed successfully"
    else
        echo "[ERROR] Common install script failed"
        exit 1
    fi
else
    echo "[ERROR] Common install script not found: `$COMMON_INSTALL"
    exit 1
fi

# $appName-specific installation logic (if any)
echo "[INFO] $appName-specific installation completed"

exit 0
"@

    # Generate deploy.ps1
    $deployPs1 = @"
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

# $appName NCore App Deploy Script
# Hardcoded deploy script for $appName application

# Variables declaration
`$SCRIPT_DIR = Split-Path -Parent `$MyInvocation.MyCommand.Path
`$APP_DIR = Split-Path -Parent `$SCRIPT_DIR
`$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent `$APP_DIR)

Write-Host "[INFO] Deploying NCore application: $appName" -ForegroundColor Green

try {
    # Change to project root directory
    Set-Location `$PROJECT_ROOT

    # Check if main.js exists
    if (-not (Test-Path "main.js")) {
        Write-Host "[ERROR] main.js not found in project root" -ForegroundColor Red
        exit 1
    }

    # Deploy $appName in production mode
    Write-Host "[INFO] Starting $appName in production mode..." -ForegroundColor Cyan
    `$env:NODE_ENV = "production"
    node ./main.js app=$appName
}
catch {
    Write-Host "[ERROR] Failed to deploy $appName`: `$_" -ForegroundColor Red
    exit 1
}

exit 0
"@

    # Generate deploy.sh
    $deploySh = @"
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

# $appName NCore App Deploy Script
# Hardcoded deploy script for $appName application

# Variables declaration
SCRIPT_DIR="`$(cd "`$(dirname "`${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="`$(dirname "`$SCRIPT_DIR")"
PROJECT_ROOT="`$(dirname "`$(dirname "`$APP_DIR")")"

echo "[INFO] Deploying NCore application: $appName"

# Change to project root directory
cd "`$PROJECT_ROOT" || {
    echo "[ERROR] Failed to change to project root: `$PROJECT_ROOT"
    exit 1
}

# Check if main.js exists
if [ ! -f "main.js" ]; then
    echo "[ERROR] main.js not found in project root"
    exit 1
fi

# Deploy $appName in production mode
echo "[INFO] Starting $appName in production mode..."
export NODE_ENV=production
node ./main.js app=$appName

exit 0
"@

    # Generate stop.ps1
    $stopPs1 = @"
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

# $appName NCore App Stop Script
# Hardcoded stop script for $appName application

Write-Host "[INFO] Stopping NCore application: $appName" -ForegroundColor Yellow

try {
    # Stop processes matching the $appName app
    `$processes = Get-Process | Where-Object { `$_.ProcessName -eq "node" -and `$_.CommandLine -like "*app=$appName*" }

    if (`$processes) {
        foreach (`$process in `$processes) {
            Write-Host "[INFO] Stopping process PID: `$(`$process.Id)" -ForegroundColor Cyan
            Stop-Process -Id `$process.Id -Force
        }
        Write-Host "[SUCCESS] $appName stopped successfully" -ForegroundColor Green
    } else {
        Write-Host "[INFO] No running processes found for $appName" -ForegroundColor Gray
    }
}
catch {
    Write-Host "[ERROR] Failed to stop $appName`: `$_" -ForegroundColor Red
    exit 1
}

exit 0
"@

    # Generate stop.sh
    $stopSh = @"
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

# $appName NCore App Stop Script
# Hardcoded stop script for $appName application

echo "[INFO] Stopping NCore application: $appName"

# Stop processes matching the $appName app
PIDS=`$(pgrep -f "node.*app=$appName")

if [ -n "`$PIDS" ]; then
    echo "[INFO] Found $appName processes: `$PIDS"
    for PID in `$PIDS; do
        echo "[INFO] Stopping process PID: `$PID"
        kill -TERM "`$PID"
    done

    # Wait a moment and force kill if still running
    sleep 2
    REMAINING_PIDS=`$(pgrep -f "node.*app=$appName")
    if [ -n "`$REMAINING_PIDS" ]; then
        echo "[INFO] Force killing remaining processes: `$REMAINING_PIDS"
        for PID in `$REMAINING_PIDS; do
            kill -KILL "`$PID"
        done
    fi

    echo "[SUCCESS] $appName stopped successfully"
else
    echo "[INFO] No running processes found for $appName"
fi

exit 0
"@

    # Write all scripts
    $startPs1 | Out-File -FilePath (Join-Path $appScriptsDir "start.ps1") -Encoding UTF8
    $startSh | Out-File -FilePath (Join-Path $appScriptsDir "start.sh") -Encoding UTF8
    $installPs1 | Out-File -FilePath (Join-Path $appScriptsDir "install.ps1") -Encoding UTF8
    $installSh | Out-File -FilePath (Join-Path $appScriptsDir "install.sh") -Encoding UTF8
    $deployPs1 | Out-File -FilePath (Join-Path $appScriptsDir "deploy.ps1") -Encoding UTF8
    $deploySh | Out-File -FilePath (Join-Path $appScriptsDir "deploy.sh") -Encoding UTF8
    $stopPs1 | Out-File -FilePath (Join-Path $appScriptsDir "stop.ps1") -Encoding UTF8
    $stopSh | Out-File -FilePath (Join-Path $appScriptsDir "stop.sh") -Encoding UTF8

    Write-Success "Generated complete script set for: $appName"
}

Write-Success "All hardcoded NCore scripts generated successfully!"

exit 0
