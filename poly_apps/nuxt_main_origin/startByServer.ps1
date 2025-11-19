# VRISTO Nuxt 4 Production Server Startup Script
# This script automatically builds and starts the production server

Write-Host "Starting VRISTO Nuxt 4 Production Server..." -ForegroundColor Green

# Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is not installed or not in PATH" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if yarn is installed
if (-not (Get-Command yarn -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Yarn is not installed or not in PATH" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if we're in the correct directory
if (-not (Test-Path "package.json")) {
    Write-Host "Error: package.json not found. Please run this script from the project root directory." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Installing dependencies..." -ForegroundColor Yellow
yarn install

Write-Host "Building the application..." -ForegroundColor Yellow
yarn build

# Check if build was successful
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed. Please check the error messages above." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Build completed successfully!" -ForegroundColor Green

# Check if the server file exists
if (-not (Test-Path ".output\server\index.mjs")) {
    Write-Host "Error: Server file not found at .output\server\index.mjs" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Starting production server..." -ForegroundColor Green
Write-Host "Server will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start the production server
node .output\server\index.mjs 