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

<#
.SYNOPSIS
    Comprehensive Xiaomi/REDMI Bloatware Removal Tool for MIUI 13 (K50 focused)
.DESCRIPTION
    This script automates removal of Xiaomi system apps and services using ADB commands.
    Based on tested packages from REDMI K50 (MIUI 13) with safety classifications.
.NOTES
    Version: 2.0
    Author: Your Name
    Requirements: ADB, USB Debugging enabled, Xiaomi device connected
#>

# ADB command prefix
$adb = "adb shell pm uninstall --user 0"
& adb devices
# Categorized bloatware list (K50 MIUI13 focused)
$bloatware = @{
    # SAFE TO REMOVE (with replacements available)
    "ReplaceableApps" = @(
        "com.sohu.inputmethod.sogou.xiaomi",    # Sogou Input Method
        "com.android.browser",                  # MI Browser
        "com.miui.video",                      # MI Video
        "com.miui.gallery",                    # MI Gallery
        "com.miui.player",                     # MI Music
        "com.miui.mishare.connectivity"        # MI Share
    )
    
    # RECOMMENDED TO REMOVE (annoyance/ads)
    "AdServices" = @(
        "com.miui.systemAdSolution",           # System Ad Solution
        "com.miui.analytics",                 # Analytics (reinstalls)
        "com.xiaomi.ab",                      # Mall component
        "com.miui.translation.kingsoft",      # Kingsoft Translate
        "com.miui.translation.youdao",        # Youdao Translate
        "com.miui.translationservice"         # Translation Service
    )
    
    # SYSTEM FEATURES (disable if unused)
    "SystemFeatures" = @(
        "com.miui.personalassistant",         # Smart Assistant (-1 screen)
        "com.android.quicksearchbox",         # Quick Search
        "com.miui.yellowpage",               # Yellow Pages
        "com.miui.hybrid",                   # Quick Apps Framework
        "com.miui.miservice",                # Service & Feedback
        "com.miui.contentextension",         # Content Extension
        "com.xiaomi.aiasst.service",         # AI Call
        "com.xiaomi.gamecenter.sdk.service", # Game Service
        "com.miui.bugreport"                # User Feedback
    )
    
    # POTENTIALLY SAFE (test carefully)
    "Experimental" = @(
        "com.miui.cit",                      # CIT Testing
        "com.miui.contentcatcher",           # App Extension
        "com.miui.maintenancemode",          # Maintenance Mode
        "com.miui.touchassistant",           # Floating Ball
        "com.miui.tsmclient",                # Smart Card
        "com.miui.phrase",                   # Common Phrases
        "com.xiaomi.joyose",                 # Step Counter
        "com.xiaomi.mirror",                 # MIUI+ Beta
        "com.xiaomi.mircs",                  # RCS Messages
        "com.xiaomi.otrpbroker"              # IoT Protocol
    )
    
    # DANGEROUS (may break system)
    "CriticalSystem" = @(
        "com.miui.securitycenter",           # Security Center
        "com.miui.android.fashiongallery"   # Wallpapers
    )
}

# Display warning
function Show-Warning {
    Write-Host "`nXIAOMI BLOATWARE REMOVAL TOOL" -ForegroundColor Red -BackgroundColor Black
    Write-Host "WARNING: Improper use may break system functionality"
    Write-Host "Recommended: Backup important data first`n"
    
    Write-Host "Categories:" -ForegroundColor Cyan
    Write-Host "1. Safe to remove (green)"
    Write-Host "2. Recommended for removal (yellow)"
    Write-Host "3. System features (cyan)"
    Write-Host "4. Experimental (magenta)"
    Write-Host "5. DANGEROUS - DO NOT REMOVE (red)`n"
}

# Process removal
function Remove-Bloatware {
    param($category, $color = "White")
    
    Write-Host "`nProcessing $category..." -ForegroundColor $color
    foreach ($pkg in $bloatware[$category]) {
        try {
            Write-Host "Attempting to remove: $pkg" -ForegroundColor Gray
            $output = Invoke-Expression "$adb $pkg"
            
            if ($output -match "Success") {
                Write-Host "[SUCCESS] Removed: $pkg" -ForegroundColor Green
            } else {
                Write-Host "[FAILED] May not exist: $pkg" -ForegroundColor DarkYellow
            }
        } catch {
            Write-Host "[ERROR] Failed to remove $pkg" -ForegroundColor Red
        }
    }
}

# Main execution
Show-Warning

# Check ADB
try {
    $null = adb devices
} catch {
    Write-Host "ADB not found! Install Android Platform Tools first." -ForegroundColor Red
    exit
}

# Interactive menu
do {
    Write-Host "`nSelect category to remove:"
    Write-Host "1. Replaceable Apps (Safe)"
    Write-Host "2. Ad Services (Recommended)"
    Write-Host "3. System Features"
    Write-Host "4. Experimental"
    Write-Host "5. VIEW DANGEROUS LIST"
    Write-Host "Q. Quit`n"
    
    $choice = Read-Host "Enter choice (1-5/Q)"
    
    switch ($choice) {
        '1' { Remove-Bloatware "ReplaceableApps" "Green" }
        '2' { Remove-Bloatware "AdServices" "Yellow" }
        '3' { Remove-Bloatware "SystemFeatures" "Cyan" }
        '4' { Remove-Bloatware "Experimental" "Magenta" }
        '5' { 
            Write-Host "`nCRITICAL SYSTEM APPS (DO NOT REMOVE):" -ForegroundColor Red
            $bloatware["CriticalSystem"] | ForEach-Object { Write-Host "  $_" }
        }
    }
} until ($choice -eq 'Q')

# Post-removal tips
Write-Host "`nPOST-REMOVAL TIPS:" -ForegroundColor Cyan
Write-Host "1. Reboot your device"
Write-Host "2. Disable remaining ads in Settings:"
Write-Host "   - Privacy -> Special permissions -> Show on lock screen"
Write-Host "   - Passwords & security -> Authorization & revocation"
Write-Host "3. Monitor for any system issues`n"