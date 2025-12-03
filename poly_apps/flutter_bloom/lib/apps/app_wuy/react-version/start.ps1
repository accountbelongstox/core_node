# React Web Project Startup Script

Write-Host "================================" -ForegroundColor Cyan
Write-Host "React Web Project Startup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if pnpm is installed
Write-Host "[1/3] Checking pnpm..." -ForegroundColor Yellow
$pnpmExists = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmExists) {
    Write-Host "ERROR: pnpm is not installed!" -ForegroundColor Red
    Write-Host "Please install pnpm: npm install -g pnpm" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "OK pnpm found" -ForegroundColor Green
Write-Host ""

# Check if node_modules exists
Write-Host "[2/3] Checking dependencies..." -ForegroundColor Yellow
$nodeModulesExists = Test-Path "node_modules"
if (-not $nodeModulesExists) {
    Write-Host "Dependencies not found. Installing..." -ForegroundColor Yellow
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install dependencies!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
} else {
    Write-Host "OK Dependencies installed" -ForegroundColor Green
}
Write-Host ""

# Start development server
Write-Host "[3/3] Starting development server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "Server will start at: http://localhost:3000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

pnpm dev
