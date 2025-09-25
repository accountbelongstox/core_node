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

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Save original working directory
$originalDir = Get-Location

try {
    # Get script directory and target directory
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $NcoreROOt = Split-Path -Parent $scriptDir
    $targetDir = Join-Path $NcoreROOt "poly_apps\laravel_main"
    
    Write-Host "Script Directory: $scriptDir" -ForegroundColor Cyan
    Write-Host "Core Node Root: $NcoreROOt" -ForegroundColor Cyan
    Write-Host "Target Directory: $targetDir" -ForegroundColor Cyan
    
    # Check if target directory exists
    if (-not (Test-Path $targetDir)) {
        Write-Host "Error: Target directory not found: $targetDir" -ForegroundColor Red
        exit 1
    }
    
    # Change to target directory
    Write-Host "Changing to target directory: $targetDir" -ForegroundColor Green
    Set-Location $targetDir
    Write-Host "Current working directory: $(Get-Location)" -ForegroundColor Green
    
    $PORT = 18000
    
    # Print PHP and Composer versions
    Write-Host "PHP Version:" -ForegroundColor Cyan
    php --version
    
    Write-Host "Composer Version:" -ForegroundColor Cyan
    composer --version
    
    Write-Host "Clearing route cache..." -ForegroundColor Yellow
    php artisan route:clear
    
    Write-Host "Listing routes..." -ForegroundColor Yellow
    php artisan route:list
    
    Write-Host "Running migrations..." -ForegroundColor Yellow
    "yes" | php artisan migrate
    
    Write-Host ""
    Write-Host "Detecting local IP addresses..." -ForegroundColor Cyan
    
    # Print localhost URL
    Write-Host "Accessible at: http://127.0.0.1:$PORT" -ForegroundColor Green
    
    # Get local IP addresses
    $ipAddresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
        $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" 
    }
    
    foreach ($ip in $ipAddresses) {
        Write-Host "Accessible at: http://$($ip.IPAddress):$PORT" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "Starting Laravel development environment with hot reload..." -ForegroundColor Green
    Write-Host "Hot reload enabled with concurrent services: server and queue" -ForegroundColor Cyan
    Write-Host "Note: Running in headless API mode - web.php serves only API debug interface" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
    
    # Start Laravel development server
    explorer http://127.0.0.1:$PORT
    composer dev:win
    
} catch {
    Write-Host "Error during Laravel development setup: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    # Restore original directory
    Write-Host "Restoring original directory: $originalDir" -ForegroundColor Cyan
    Set-Location $originalDir
    Write-Host "Current working directory: $(Get-Location)" -ForegroundColor Green
}
