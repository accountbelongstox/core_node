# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED.
# ### AI SPECIAL ATTENTION RULES END ###

# Declare all variables at the beginning
$OriginalDirectory = Get-Location
$ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 9000
$IPList = @()

# Change to the directory where the script is located
Set-Location -Path $ScriptDirectory

Write-Host "Clearing route cache..." -ForegroundColor Yellow
php artisan route:clear

Write-Host "Listing routes..." -ForegroundColor Yellow
php artisan route:list

Write-Host "Running migrations..." -ForegroundColor Yellow
php artisan migrate

Write-Host "Detecting local IPs (excluding loopback)..." -ForegroundColor Yellow

# Get network adapters and their IP addresses
try {
    $NetworkAdapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
        $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^0\.' -and $_.IPAddress -notmatch '^169\.254\.'
    }
    
    if ($NetworkAdapters) {
        $IPList = $NetworkAdapters.IPAddress
    }
} catch {
    Write-Host "Unable to detect IP addresses using Get-NetIPAddress" -ForegroundColor Red
}

Write-Host "Accessible URLs (ready to copy):" -ForegroundColor Green
if ($IPList.Count -gt 0) {
    foreach ($IP in $IPList) {
        Write-Host "  http://$IP`:$Port" -ForegroundColor Cyan
    }
} else {
    Write-Host "  http://localhost`:$Port (fallback)" -ForegroundColor Cyan
}

Write-Host "Starting Laravel development environment with hot reload..." -ForegroundColor Green
Write-Host "Note: Running in headless API mode - web.php serves only API debug interface" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Red

# Check if pcntl extension is available for full dev mode
$PcntlAvailable = php -m | Select-String "pcntl"

if ($PcntlAvailable) {
    Write-Host "Full development mode with logs enabled" -ForegroundColor Green
    composer dev
} else {
    Write-Host "Limited development mode (no logs) - pcntl extension not available" -ForegroundColor Yellow
    composer dev:win
}

# After the server exits, return to original directory
Set-Location -Path $OriginalDirectory
