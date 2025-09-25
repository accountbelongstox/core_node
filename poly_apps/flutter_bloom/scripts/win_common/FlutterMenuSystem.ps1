# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Flutter Menu System Helper Functions
# Interactive menu system for Flutter multi-app development
# Author: Development Script System
# Version: 1.0

# Import required modules
$WinCommonDir = $PSScriptRoot
. (Join-Path $WinCommonDir "FlutterGlobalVar.ps1")

function Show-MainMenu {
    <#
    .SYNOPSIS
    Display main menu for Flutter development script
    #>

    Clear-Host
    Write-Host "           Flutter Multi-App Development System" -ForegroundColor Green
    Write-Host ""
    Write-Host "Main Menu:" -ForegroundColor Cyan
    Write-Host "1. Select App and Debug/Build" -ForegroundColor White
    Write-Host "2. Cleanup and Restore" -ForegroundColor White
    Write-Host "3. System Information" -ForegroundColor White
    Write-Host "4. Settings" -ForegroundColor White
    Write-Host "5. Icons Visualization System" -ForegroundColor White
    Write-Host "0. Exit" -ForegroundColor White
    Write-Host ""
    Write-Host ""
}

function Get-MainMenuSelection {
    <#
    .SYNOPSIS
    Get user selection from main menu

    .RETURNS
    Selected menu option as string
    #>

    do {
        Show-MainMenu
        $selection = Read-Host "Enter your choice (0-5)"

        switch ($selection) {
            "1" { return "build" }
            "2" { return "cleanup" }
            "3" { return "info" }
            "4" { return "settings" }
            "5" { return "icons" }
            "0" { return "exit" }
            default {
                Write-Warning "Invalid selection. Press any key to continue..."
                $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            }
        }
    } while ($true)
}

function Show-AppSelectionMenu {
    <#
    .SYNOPSIS
    Display app selection menu with cached action modes

    .PARAMETER Apps
    Array of available Flutter apps
    #>

    param(
        [Parameter(Mandatory=$true)]
        [array]$Apps
    )

    Write-Host ""
    Write-Host "Available Flutter Apps:" -ForegroundColor Yellow
    Write-Host "-" * 50 -ForegroundColor Yellow

    # Add "All Apps" option
    Write-Host "0. All Apps (Main Entry Point - lib/main.dart)" -ForegroundColor White

    # List individual apps with their cached action modes
    for ($i = 0; $i -lt $Apps.Count; $i++) {
        $app = $Apps[$i]
        $displayName = $app.name
        $actionMode = Get-FileVariable -Name ($Global:KEY_APP_ACTION_MODE_PREFIX + $app.name) -DefaultValue "Debug"

        if ($app.isMain) {
            $displayName += " (Main Entry Point)"
        }

        # Show current action mode in brackets
        $displayName += " [$actionMode]"

        Write-Host "$($i + 1). $displayName" -ForegroundColor White
    }

    Write-Host ""
}

function Get-AppSelection {
    <#
    .SYNOPSIS
    Get user app selection with validation and store it, with toggle support

    .PARAMETER Apps
    Array of available Flutter apps

    .RETURNS
    Selected app object or special selection
    #>

    param(
        [Parameter(Mandatory=$true)]
        [array]$Apps
    )

    do {
        Show-AppSelectionMenu -Apps $Apps
        Write-Host "Use left/right arrows to toggle action modes, Enter to select, or type number:" -ForegroundColor Cyan
        $selection = Read-Host "Select app (0 for all, 1-$($Apps.Count) for specific app)"

        try {
            $selectedIndex = [int]$selection

            if ($selectedIndex -eq 0) {
                Set-FileVariable -Name $Global:KEY_SELECTED_APP -Value "All"
                return @{ "name" = "All"; "isAllOption" = $true }
            }
            elseif ($selectedIndex -ge 1 -and $selectedIndex -le $Apps.Count) {
                $selectedApp = $Apps[$selectedIndex - 1]
                Set-FileVariable -Name $Global:KEY_SELECTED_APP -Value $selectedApp.name

                # Set current active app and action for other scripts
                Set-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_APP -Value $selectedApp.name
                $currentAction = Get-FileVariable -Name ($Global:KEY_APP_ACTION_MODE_PREFIX + $app.name) -DefaultValue "Debug"
                Set-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_ACTION -Value $currentAction

                return $selectedApp
            }
        }
        catch {
            # Invalid input
        }

        Write-Warning "Invalid selection. Please enter a number between 0 and $($Apps.Count)"
        Write-Host "Press any key to continue..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

    } while ($true)
}

function Get-AppSelectionWithToggle {
    <#
    .SYNOPSIS
    Interactive app selection with left/right arrow toggle for action modes

    .PARAMETER Apps
    Array of available Flutter apps

    .RETURNS
    Selected app object
    #>

    param(
        [Parameter(Mandatory=$true)]
        [array]$Apps
    )

    # Load last selected app index from cache, default to 1
    $currentSelection = Get-FileVariable -Name $Global:KEY_LAST_SELECTED_APP_INDEX -DefaultValue "1"
    try {
        $currentSelection = [int]$currentSelection
    } catch {
        $currentSelection = 1
    }
    $filteredApps = $Apps | Where-Object { $_.name -ne "app_main" }
    $maxSelection = $filteredApps.Count

    do {
        Clear-Host
        Write-Host "[INFO] Flutter Bloom App Selection" -ForegroundColor Green
        Write-Host "===================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Available Flutter Apps:" -ForegroundColor Yellow
        Write-Host "-" * 50 -ForegroundColor Yellow

        # Display "All Apps" option with toggle support
        $allHighlight = if ($currentSelection -eq 0) { " -> " } else { "    " }
        $allActionMode = Get-FileVariable -Name ($Global:KEY_APP_ACTION_MODE_PREFIX + "app_main") -DefaultValue "Debug"
        $allPlatformMode = Get-FileVariable -Name ($Global:KEY_APP_PLATFORM_MODE_PREFIX + "app_main") -DefaultValue "Android"
        Write-Host "$allHighlight 0. app_main (Main Entry Point) [$allActionMode/$allPlatformMode]" -ForegroundColor $(if ($currentSelection -eq 0) { "Green" } else { "White" })

        # Display individual apps with highlighting and platform info (excluding app_main since it's shown as option 0)
        for ($i = 0; $i -lt $filteredApps.Count; $i++) {
            $app = $filteredApps[$i]
            $appIndex = $i + 1
            $actionMode = Get-FileVariable -Name ($Global:KEY_APP_ACTION_MODE_PREFIX + $app.name) -DefaultValue "Debug"
            $platformMode = Get-FileVariable -Name ($Global:KEY_APP_PLATFORM_MODE_PREFIX + $app.name) -DefaultValue "Android"
            $displayName = $app.name

            # Show both action and platform modes
            $displayName += " [$actionMode/$platformMode]"
            $highlight = if ($currentSelection -eq $appIndex) { " -> " } else { "    " }
            $color = if ($currentSelection -eq $appIndex) { "Green" } else { "White" }

            Write-Host "$highlight $appIndex. $displayName" -ForegroundColor $color
        }

        Write-Host ""
        Write-Host "Controls:" -ForegroundColor Cyan
        Write-Host "  Up/Down arrows: Navigate apps" -ForegroundColor Gray
        Write-Host "  Left arrow: Toggle Debug/Build mode" -ForegroundColor Gray
        Write-Host "  Right arrow: Toggle platform (Web/Android/Windows/All)" -ForegroundColor Gray
        Write-Host "  Enter: Select app" -ForegroundColor Gray
        Write-Host ""

        # Get key input
        $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

        switch ($key.VirtualKeyCode) {
            38 { # Up arrow
                $currentSelection = if ($currentSelection -eq 0) { $maxSelection } else { $currentSelection - 1 }
            }
            40 { # Down arrow
                $currentSelection = if ($currentSelection -eq $maxSelection) { 0 } else { $currentSelection + 1 }
            }
            37 { # Left arrow - Toggle Debug/Build mode only
                if ($currentSelection -eq 0) {
                    # Handle app_main toggle
                    $currentAction = Get-FileVariable -Name ($Global:KEY_APP_ACTION_MODE_PREFIX + "app_main") -DefaultValue "Debug"
                    $newAction = if ($currentAction -eq "Debug") { "Build" } else { "Debug" }
                    Set-FileVariable -Name ($Global:KEY_APP_ACTION_MODE_PREFIX + "app_main") -Value $newAction
                } elseif ($currentSelection -gt 0) {
                    $selectedApp = $filteredApps[$currentSelection - 1]
                    $currentAction = Get-FileVariable -Name ($Global:KEY_APP_ACTION_MODE_PREFIX + $selectedApp.name) -DefaultValue "Debug"
                    $newAction = if ($currentAction -eq "Debug") { "Build" } else { "Debug" }
                    Set-FileVariable -Name ($Global:KEY_APP_ACTION_MODE_PREFIX + $selectedApp.name) -Value $newAction
                }
            }
            39 { # Right arrow - Toggle platform only
                $platforms = @("Web", "Android", "Windows", "All")
                if ($currentSelection -eq 0) {
                    # Handle app_main platform toggle
                    $currentPlatform = Get-FileVariable -Name ($Global:KEY_APP_PLATFORM_MODE_PREFIX + "app_main") -DefaultValue "Android"
                    $currentIndex = [array]::IndexOf($platforms, $currentPlatform)
                    if ($currentIndex -eq -1) { $currentIndex = 0 }
                    $newIndex = if ($currentIndex -eq ($platforms.Count - 1)) { 0 } else { $currentIndex + 1 }
                    Set-FileVariable -Name ($Global:KEY_APP_PLATFORM_MODE_PREFIX + "app_main") -Value $platforms[$newIndex]
                } elseif ($currentSelection -gt 0) {
                    $selectedApp = $filteredApps[$currentSelection - 1]
                    $currentPlatform = Get-FileVariable -Name ($Global:KEY_APP_PLATFORM_MODE_PREFIX + $selectedApp.name) -DefaultValue "Android"
                    $currentIndex = [array]::IndexOf($platforms, $currentPlatform)
                    if ($currentIndex -eq -1) { $currentIndex = 0 }
                    $newIndex = if ($currentIndex -eq ($platforms.Count - 1)) { 0 } else { $currentIndex + 1 }
                    Set-FileVariable -Name ($Global:KEY_APP_PLATFORM_MODE_PREFIX + $selectedApp.name) -Value $platforms[$newIndex]
                }
            }
            13 { # Enter
                if ($currentSelection -eq 0) {
                    # Get current action and platform for app_main
                    $currentAction = Get-FileVariable -Name ($Global:KEY_APP_ACTION_MODE_PREFIX + "app_main") -DefaultValue "Debug"
                    $currentPlatform = Get-FileVariable -Name ($Global:KEY_APP_PLATFORM_MODE_PREFIX + "app_main") -DefaultValue "Android"

                    # Set file variables for backward compatibility
                    Set-FileVariable -Name $Global:KEY_SELECTED_APP -Value "All"
                    Set-FileVariable -Name $Global:KEY_SELECTED_ACTION -Value $currentAction
                    Set-FileVariable -Name $Global:KEY_SELECTED_PLATFORM -Value $currentPlatform

                    # Set global KEY variables for consistency
                    Set-FileVariable -Name $Global:KEY_SELECTED_APP -Value "All"
                    Set-FileVariable -Name $Global:KEY_SELECTED_ACTION -Value $currentAction
                    Set-FileVariable -Name $Global:KEY_SELECTED_PLATFORM -Value $currentPlatform

                    # Set current active app, action and platform for app_main
                    Set-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_APP -Value "app_main"
                    Set-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_ACTION -Value $currentAction
                    Set-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_PLATFORM -Value $currentPlatform

                    # Save current selection index for next time
                    Set-FileVariable -Name $Global:KEY_LAST_SELECTED_APP_INDEX -Value "0"

                    return @{ "name" = "All"; "isAllOption" = $true }
                } else {
                    $selectedApp = $filteredApps[$currentSelection - 1]

                    # Get current action and platform for the selected app
                    $currentAction = Get-FileVariable -Name ($Global:KEY_APP_ACTION_MODE_PREFIX + $selectedApp.name) -DefaultValue "Debug"
                    $currentPlatform = Get-FileVariable -Name ($Global:KEY_APP_PLATFORM_MODE_PREFIX + $selectedApp.name) -DefaultValue "Android"

                    # Set file variables for backward compatibility
                    Set-FileVariable -Name $Global:KEY_SELECTED_APP -Value $selectedApp.name
                    Set-FileVariable -Name $Global:KEY_SELECTED_ACTION -Value $currentAction
                    Set-FileVariable -Name $Global:KEY_SELECTED_PLATFORM -Value $currentPlatform

                    # Set current active app, action and platform for other scripts
                    Set-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_APP -Value $selectedApp.name
                    Set-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_ACTION -Value $currentAction
                    Set-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_PLATFORM -Value $currentPlatform

                    # Save current selection index for next time
                    Set-FileVariable -Name $Global:KEY_LAST_SELECTED_APP_INDEX -Value $currentSelection.ToString()

                    return $selectedApp
                }
            }
            27 { # Escape
                throw "User cancelled selection"
            }
        }

    } while ($true)
}

function Show-BuildActionMenu {
    <#
    .SYNOPSIS
    Display build action selection menu (legacy - now handled via toggle)
    #>

    Write-Host ""
    Write-Host "Build Actions (handled via app selection toggle):" -ForegroundColor Yellow
    Write-Host "-" * 30 -ForegroundColor Yellow
    Write-Host "Debug and Build actions are now toggled during app selection" -ForegroundColor Cyan
    Write-Host "Use left/right arrows in app selection to toggle between Debug/Build" -ForegroundColor Cyan
    Write-Host ""
}

function Get-BuildActionSelection {
    <#
    .SYNOPSIS
    Legacy function - build action is now handled via toggle in app selection

    .RETURNS
    Current action from cache or 'debug' as default
    #>

    $currentApp = Get-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_APP -DefaultValue ""
    if ($currentApp) {
        $action = Get-FileVariable -Name ($Global:KEY_APP_ACTION_MODE_PREFIX + $currentApp) -DefaultValue "Debug"
        $actionLower = $action.ToLower()
        Set-FileVariable -Name $Global:KEY_SELECTED_ACTION -Value $action
        return $actionLower
    } else {
        Set-FileVariable -Name $Global:KEY_SELECTED_ACTION -Value "Debug"
        return "debug"
    }
}

function Show-PlatformMenu {
    <#
    .SYNOPSIS
    Display platform selection menu
    #>

    Write-Host ""
    Write-Host "Target Platforms:" -ForegroundColor Yellow
    Write-Host "-" * 30 -ForegroundColor Yellow
    Write-Host "1. Web" -ForegroundColor White
    Write-Host "2. Android" -ForegroundColor White
    Write-Host "3. Windows" -ForegroundColor White
    Write-Host "4. All Platforms" -ForegroundColor White
    Write-Host ""
}

function Get-PlatformSelection {
    <#
    .SYNOPSIS
    Interactive platform selection with left/right arrow toggle

    .RETURNS
    Selected platform as string
    #>

    # Get current active app for platform caching
    $currentApp = Get-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_APP -DefaultValue ""
    $defaultPlatform = if ($currentApp) { Get-FileVariable -Name ($Global:KEY_APP_PLATFORM_MODE_PREFIX + $app.name) -DefaultValue "Android" $currentApp } else { "Web" }

    # Define available platforms
    $platforms = @("Web", "Android", "Windows", "iOS", "All")
    $currentPlatformIndex = [array]::IndexOf($platforms, $defaultPlatform)
    if ($currentPlatformIndex -eq -1) { $currentPlatformIndex = 0 }

    do {
        Clear-Host
        Write-Host "[INFO] Flutter Bloom Platform Selection" -ForegroundColor Green
        Write-Host "=======================================" -ForegroundColor Cyan
        Write-Host ""

        Write-Host "Target Platforms:" -ForegroundColor Yellow
        Write-Host "- * $($platforms.Count)" -ForegroundColor Yellow

        # Show all platforms with current selection highlighted
        for ($i = 0; $i -lt $platforms.Count; $i++) {
            $platformName = $platforms[$i]
            $displayNumber = $i + 1
            $highlight = if ($i -eq $currentPlatformIndex) { " -> " } else { "    " }
            $color = if ($i -eq $currentPlatformIndex) { "Green" } else { "White" }

            Write-Host "$highlight $displayNumber. $platformName" -ForegroundColor $color
        }

        Write-Host ""
        Write-Host "Controls: Left/Right arrows to toggle platforms, Enter to select" -ForegroundColor Cyan
        Write-Host "Current selection: $($platforms[$currentPlatformIndex])" -ForegroundColor Yellow
        Write-Host ""

        # Get key input
        $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

        switch ($key.VirtualKeyCode) {
            37 { # Left arrow - previous platform
                $currentPlatformIndex = if ($currentPlatformIndex -eq 0) { $platforms.Count - 1 } else { $currentPlatformIndex - 1 }
            }
            39 { # Right arrow - next platform
                $currentPlatformIndex = if ($currentPlatformIndex -eq ($platforms.Count - 1)) { 0 } else { $currentPlatformIndex + 1 }
            }
            13 { # Enter - select current platform
                $selectedPlatform = $platforms[$currentPlatformIndex]
                $platformName = $selectedPlatform.ToLower()

                # Update all cache variables
                Set-FileVariable -Name $Global:KEY_SELECTED_PLATFORM -Value $platformName
                Set-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_PLATFORM -Value $selectedPlatform
                if ($currentApp) {
                    Set-FileVariable -Name ($Global:KEY_APP_PLATFORM_MODE_PREFIX + $app.name) -Value $currentApp -PlatformMode $selectedPlatform
                }

                return $platformName
            }
            27 { # Escape
                throw "User cancelled platform selection"
            }
        }

    } while ($true)
}

function Show-CleanupMenu {
    <#
    .SYNOPSIS
    Display cleanup options menu

    .PARAMETER Apps
    Array of available Flutter apps
    #>

    param(
        [Parameter(Mandatory=$true)]
        [array]$Apps
    )

    Write-Host ""
    Write-Host "Cleanup Options:" -ForegroundColor Yellow
    Write-Host "-" * 30 -ForegroundColor Yellow
    Write-Host "0. Cleanup All Apps" -ForegroundColor White

    for ($i = 0; $i -lt $Apps.Count; $i++) {
        Write-Host "$($i + 1). Cleanup $($Apps[$i].name)" -ForegroundColor White
    }

    Write-Host ""
}

function Get-CleanupSelection {
    <#
    .SYNOPSIS
    Get user cleanup selection

    .PARAMETER Apps
    Array of available Flutter apps

    .RETURNS
    Selected app for cleanup or "all"
    #>

    param(
        [Parameter(Mandatory=$true)]
        [array]$Apps
    )

    do {
        Show-CleanupMenu -Apps $Apps
        $selection = Read-Host "Select cleanup option (0 for all, 1-$($Apps.Count) for specific app)"

        try {
            $selectedIndex = [int]$selection

            if ($selectedIndex -eq 0) {
                return "all"
            }
            elseif ($selectedIndex -ge 1 -and $selectedIndex -le $Apps.Count) {
                return $Apps[$selectedIndex - 1].name
            }
        }
        catch {
            # Invalid input
        }

        Write-Warning "Invalid selection. Please enter a number between 0 and $($Apps.Count)"
        Write-Host "Press any key to continue..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

    } while ($true)
}

function Show-SystemInfo {
    <#
    .SYNOPSIS
    Display system information
    #>

    Write-Host ""
    Write-Host "System Information:" -ForegroundColor Yellow
    Write-Host "=" * 50 -ForegroundColor Yellow

    # Flutter information
    Write-Host "Flutter:" -ForegroundColor Cyan
    try {
        $flutterVersion = flutter --version 2>&1 | Select-Object -First 1
        Write-Host "  Version: $flutterVersion" -ForegroundColor White
    }
    catch {
        Write-Host "  Status: Not available" -ForegroundColor Red
    }

    # Python information
    Write-Host "Python:" -ForegroundColor Cyan
    try {
        $pythonVersion = python --version 2>&1
        Write-Host "  Version: $pythonVersion" -ForegroundColor White
    }
    catch {
        Write-Host "  Status: Not available" -ForegroundColor Red
    }

    # Project information
    Write-Host "Project:" -ForegroundColor Cyan
    $projectRoot = Get-GvarValue -Name "flutter_project_dir"
    if ($projectRoot) {
        Write-Host "  Root: $projectRoot" -ForegroundColor White
    }

    $debugMode = Get-GvarValue -Name "debug_mode"
    Write-Host "  Debug Mode: $debugMode" -ForegroundColor White

    Write-Host ""
    Write-Host "Press any key to continue..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Show-SettingsMenu {
    <#
    .SYNOPSIS
    Display settings menu
    #>

    Write-Host ""
    Write-Host "Settings:" -ForegroundColor Yellow
    Write-Host "-" * 30 -ForegroundColor Yellow
    Write-Host "1. Toggle Debug Mode" -ForegroundColor White
    Write-Host "2. View Build Options" -ForegroundColor White
    Write-Host "3. Reset to Defaults" -ForegroundColor White
    Write-Host "0. Back to Main Menu" -ForegroundColor White
    Write-Host ""
}

function Get-SettingsSelection {
    <#
    .SYNOPSIS
    Get user settings selection

    .RETURNS
    Selected settings action
    #>

    do {
        Show-SettingsMenu
        $selection = Read-Host "Select settings option (0-3)"

        switch ($selection) {
            "1" { return "toggle_debug" }
            "2" { return "view_options" }
            "3" { return "reset_defaults" }
            "0" { return "back" }
            default {
                Write-Warning "Invalid selection. Please enter 0-3"
                Write-Host "Press any key to continue..."
                $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            }
        }
    } while ($true)
}

# Functions are available for dot-sourcing, no Export-ModuleMember needed