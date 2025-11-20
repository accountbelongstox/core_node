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