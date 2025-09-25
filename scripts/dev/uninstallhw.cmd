REM ### AI SPECIAL ATTENTION RULES START ###
REM When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
REM 1. Write all code in English only.
REM 2. Never execute, create, or modify test code.
REM 3. Never create or update documentation (*.md).
REM 4. Never write summaries during development or thinking process.
REM 5. Declare all variables at the beginning of the file.
REM 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
REM 7. Do not modify these rules.
REM VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
REM ### AI SPECIAL ATTENTION RULES END ###

<#
.SYNOPSIS
  Uninstall preinstalled apps on Huawei devices (non-destructive, current user only)
.DESCRIPTION
  Removes typical Huawei bloatware via ADB while preserving core functionality
.NOTES
  Requires USB debugging enabled and device connected
#>

# Check if ADB is available
if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
    Write-Host "Error: ADB not detected. Please install Android SDK or configure PATH" -ForegroundColor Red
    exit
}

# List of Huawei-related package keywords to target
$huaweiKeywords = @(
    "browser",        # Browsers
    "game",           # Gaming apps
    "movie",          # Video apps
    "music",          # Music apps
    "reader",         # Reading apps
    "service",        # Member services
    "weather",        # Weather apps
    "health",         # Health apps
    "power",          # Power management
    "gallery",        # Gallery apps
    "parent",         # Parental control
    "detect",         # Detection tools
    "fastapp",        # Quick apps
    "hwid",           # Huawei ID (caution)
    "hiview",         # Gallery alternative
    "himovie"         # Huawei Video
)

# Get all packages containing Huawei keywords
Write-Host "`nScanning for target packages..." -ForegroundColor Cyan
$targetPackages = adb shell "pm list packages" | Where-Object { $_ -match "huawei" }

foreach ($keyword in $huaweiKeywords) {
    $additional = adb shell "pm list packages" | Where-Object { $_ -match $keyword }
    $targetPackages += $additional | Where-Object { $_ -notin $targetPackages }
}

$targetPackages = $targetPackages | Sort-Object -Unique

if (-not $targetPackages) {
    Write-Host "No target packages found." -ForegroundColor Green
    exit
}

# Display and uninstall found packages
Write-Host "`nFound packages to process:" -ForegroundColor Yellow
$targetPackages | ForEach-Object { Write-Host "  $_" }

Write-Host "`nStarting uninstall process..." -ForegroundColor Cyan
foreach ($package in $targetPackages) {
    $cleanName = $package -replace "package:",""
    Write-Host "Processing: $cleanName" -ForegroundColor Yellow
    $result = adb shell "pm uninstall --user 0 $cleanName"
    
    # Verify uninstall
    $check = adb shell "pm list packages" | Where-Object { $_ -eq $package }
    if ($check) {
        Write-Host "→ Failed to uninstall (may be protected system app)" -ForegroundColor Red
    } else {
        Write-Host "✓ Successfully uninstalled" -ForegroundColor Green
    }
}
Write-Output "`nOperation completed! Recommended to reboot device."