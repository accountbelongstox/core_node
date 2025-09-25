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

# Flutter Development Script
# Author: Development Script System
# Version: 1.0

# Get script directory and set target directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$NcoreROOt = Split-Path -Parent ($scriptDir)
$targetDir = Join-Path $NcoreROOt "poly_apps\flutter_bloom"

# Backup current working directory
$originalWorkingDir = Get-Location
Write-Host "Backed up original working directory: $originalWorkingDir" -ForegroundColor Cyan

# Change to target directory
if (Test-Path $targetDir) {
    Set-Location $targetDir
    Write-Host "Changed working directory to: $targetDir" -ForegroundColor Green
} else {
    Write-Error "Target directory not found: $targetDir"
    exit 1
}

# Scan for Flutter apps in lib/apps directory
$appsDir = Join-Path $targetDir "lib\apps"
if (-not (Test-Path $appsDir)) {
    Write-Error "Apps directory not found: $appsDir"
    exit 1
}

$apps = @()
Get-ChildItem -Path $appsDir -Directory | ForEach-Object {
    if ($_.Name -match "^app_") {
        $apps += @{
            "name" = $_.Name
            "path" = $_.FullName
            "isMain" = ($_.Name -eq "app_main")
        }
    }
}

if ($apps.Count -eq 0) {
    Write-Error "No Flutter apps found in $appsDir"
    exit 1
}

# Display available apps
Write-Host ""
Write-Host "Available Flutter Apps:" -ForegroundColor Yellow
Write-Host "-" * 50 -ForegroundColor Yellow

for ($i = 0; $i -lt $apps.Count; $i++) {
    $app = $apps[$i]
    $displayName = $app.name
    if ($app.isMain) {
        $displayName += " (Main Entry Point A)"
    }
    Write-Host "$($i + 1). $displayName" -ForegroundColor White
}

Write-Host ""

# Get user selection
do {
    $selection = Read-Host "Select app to run (1-$($apps.Count))"
    
    try {
        $selectedIndex = [int]$selection
        if ($selectedIndex -ge 1 -and $selectedIndex -le $apps.Count) {
            $selectedApp = $apps[$selectedIndex - 1]
            break
        }
    }
    catch {
        # Invalid input
    }
    
    Write-Warning "Invalid selection. Please enter a number between 1 and $($apps.Count)"
} while ($true)

# Get local IP address
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch "^169\.254\." -and $_.IPAddress -notmatch "^127\." } | Select-Object -First 1).IPAddress

if (-not $localIP) {
    $localIP = "127.0.0.1"
}

$port = 18002

# Display connection information
Write-Host ""
Write-Host "Connection Information:" -ForegroundColor Green
Write-Host "Local IP: $localIP" -ForegroundColor Cyan
Write-Host "Port: $port" -ForegroundColor Cyan
Write-Host "URL: http://$localIP`:$port" -ForegroundColor Yellow
Write-Host ""

# Run flutter pub get
Write-Host "Running flutter pub get..." -ForegroundColor Yellow
try {
    flutter pub get
    if ($LASTEXITCODE -eq 0) {
        Write-Host "flutter pub get completed successfully" -ForegroundColor Green
    } else {
        Write-Warning "flutter pub get had issues, but continuing..."
    }
}
catch {
    Write-Warning "Error running flutter pub get: $($_.Exception.Message)"
}

# Build Flutter command
$entryPoint = "lib\apps\$($selectedApp.name)\main_app_$($selectedApp.name.Replace('app_', '')).dart"
$flutterCommand = "flutter run -d web-server --web-hostname=0.0.0.0 --web-port=$port -t $entryPoint"

Write-Host ""
Write-Host "Starting Flutter app: $($selectedApp.name)" -ForegroundColor Green
Write-Host "Entry point: $entryPoint" -ForegroundColor Cyan
Write-Host "Command: $flutterCommand" -ForegroundColor Gray
Write-Host ""

# Execute Flutter command
try {
    # Start Flutter command in background
    & flutter run -d web-server --web-hostname=0.0.0.0 --web-port=$port -t $entryPoint
    
    # Wait a moment for Flutter to start
    Start-Sleep -Seconds 3
    
    # Open default browser
    $url = "http://$localIP`:$port"
    Write-Host ""
    Write-Host "Opening default browser with URL: $url" -ForegroundColor Green
    Start-Process $url
    
    Write-Host ""
    Write-Host "Flutter app is running in background" -ForegroundColor Yellow
    Write-Host "Press Ctrl+C to stop the Flutter app" -ForegroundColor Yellow
    
    # Keep script running to maintain Flutter process
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
catch {
    Write-Error "Error running Flutter app: $($_.Exception.Message)"
}
finally {
    # Restore original working directory
    Set-Location $originalWorkingDir
    Write-Host ""
    Write-Host "Restored working directory to: $originalWorkingDir" -ForegroundColor Cyan
}
