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

# VRISTO Nuxt.js Project Development Startup Script for Windows
# Function: Check dependencies, display IP addresses, start development server

# Check if node_modules directory exists
if (-not (Test-Path -Path "node_modules")) {
    Write-Host "No node_modules directory detected, installing dependencies..." -ForegroundColor Yellow
    # Check if yarn is installed
    $yarnInstalled = $null
    try {
        $yarnInstalled = Get-Command yarn -ErrorAction Stop
    } catch {
        $yarnInstalled = $null
    }

    if ($yarnInstalled) {
        Write-Host "Using yarn to install dependencies..." -ForegroundColor Cyan
        yarn install
    } else {
        Write-Host "Using npm to install dependencies..." -ForegroundColor Cyan
        npm install
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Dependency installation failed, please check network connection or run installation command manually." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Dependencies installation completed!" -ForegroundColor Green
} else {
    Write-Host "node_modules directory exists, skipping installation step." -ForegroundColor Green
}

# Get all available IP addresses
Write-Host "`nAvailable IP addresses:" -ForegroundColor Cyan
$ipAddresses = Get-NetIPAddress | Where-Object { $_.AddressFamily -eq 'IPv4' -and $_.IPAddress -ne '127.0.0.1' } | Select-Object IPAddress
foreach ($ip in $ipAddresses) {
    Write-Host "http://$($ip.IPAddress):5173" -ForegroundColor Yellow
}

Write-Host "`nLocal access address:" -ForegroundColor Cyan
Write-Host "http://localhost:5173" -ForegroundColor Yellow

# Start development server
Write-Host "`nStarting development server..." -ForegroundColor Green

# Check if yarn is installed
$yarnInstalled = $null
try {
    $yarnInstalled = Get-Command yarn -ErrorAction Stop
} catch {
    $yarnInstalled = $null
}

if ($yarnInstalled) {
    Write-Host "Using command: yarn dev -- --host=0.0.0.0" -ForegroundColor Cyan
    yarn dev -- --host=0.0.0.0
} else {
    Write-Host "Using command: npm run dev -- --host=0.0.0.0" -ForegroundColor Cyan
    npm run dev -- --host=0.0.0.0
}