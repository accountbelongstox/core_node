# InteractiveMenu.ps1
# Interactive menu system for React Native launcher with per-app mode toggle

$VK_UP = 0x26
$VK_DOWN = 0x28
$VK_LEFT = 0x25
$VK_RIGHT = 0x27
$VK_RETURN = 0x0D
$VK_ESCAPE = 0x1B

Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class KeyboardUtil {
        [DllImport("user32.dll")]
        public static extern short GetAsyncKeyState(int vKey);
    }
"@

function Get-AppStateFile {
    param([string]$AppDirectory)

    $stateDir = Join-Path $AppDirectory ".app-states"
    if (-not (Test-Path $stateDir)) {
        New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
    }

    return Join-Path $stateDir "app-preferences.json"
}

function Load-AppStates {
    param([string]$AppDirectory)

    $stateFile = Get-AppStateFile -AppDirectory $AppDirectory

    if (Test-Path $stateFile) {
        try {
            $content = Get-Content $stateFile -Raw | ConvertFrom-Json
            return $content
        } catch {
            return @{}
        }
    }

    return @{}
}

function Save-AppStates {
    param(
        [string]$AppDirectory,
        [hashtable]$States
    )

    $stateFile = Get-AppStateFile -AppDirectory $AppDirectory
    $States | ConvertTo-Json -Depth 10 | Set-Content $stateFile -Encoding UTF8
}

function Get-AppState {
    param(
        [hashtable]$States,
        [string]$AppName,
        [string]$Property,
        [string]$Default
    )

    if ($States.ContainsKey($AppName)) {
        $appState = $States[$AppName]
        if ($appState.PSObject.Properties[$Property]) {
            return $appState.$Property
        }
    }

    return $Default
}

function Set-AppState {
    param(
        [hashtable]$States,
        [string]$AppName,
        [string]$Property,
        [string]$Value
    )

    if (-not $States.ContainsKey($AppName)) {
        $States[$AppName] = @{}
    }

    $States[$AppName][$Property] = $Value
}

function Show-InteractiveMenu {
    param(
        [Parameter(Mandatory = $true)]
        [array]$MenuItems,
        [Parameter(Mandatory = $false)]
        [int]$InitialIndex = 0,
        [Parameter(Mandatory = $false)]
        [string]$AppDirectory = ""
    )

    $modeOptions = @("debug", "build", "test")
    $platformOptions = @("android", "ios")
    $selectedIndex = $InitialIndex
    $running = $true

    if ($selectedIndex -ge $MenuItems.Count) {
        $selectedIndex = 0
    }

    # Load app states from file
    $appStates = Load-AppStates -AppDirectory $AppDirectory

    # Initialize default states for all apps if not set
    foreach ($item in $MenuItems) {
        $appName = $item.Name
        if (-not $appStates.ContainsKey($appName)) {
            $appStates[$appName] = @{
                mode = "debug"
                platform = "android"
            }
        }
    }

    function Get-ModeLabel {
        param([string]$ModeValue)
        switch ($ModeValue) {
            "debug" { return "Debug" }
            "build" { return "Build" }
            "test"  { return "Test" }
            default { return $ModeValue }
        }
    }

    function Get-PlatformLabel {
        param([string]$PlatformValue)
        switch ($PlatformValue) {
            "android" { return "Android" }
            "ios"     { return "iOS" }
            default   { return $PlatformValue }
        }
    }

    function Draw-Menu {
        Clear-Host
        Write-Host ""
        Write-Host "===============================================================================" -ForegroundColor Cyan
        Write-Host "  REACT NATIVE MULTI-APP LAUNCHER" -ForegroundColor Cyan
        Write-Host "===============================================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Use Arrow Keys: Up/Down to select app, Left/Right to toggle mode/platform" -ForegroundColor Gray
        Write-Host "Press Enter to start, ESC to exit" -ForegroundColor Gray
        Write-Host ""

        for ($i = 0; $i -lt $MenuItems.Count; $i++) {
            $item = $MenuItems[$i]
            $isSelected = ($i -eq $selectedIndex)
            $appName = $item.Name

            # Get app-specific mode and platform
            $appMode = Get-AppState -States $appStates -AppName $appName -Property "mode" -Default "debug"
            $appPlatform = Get-AppState -States $appStates -AppName $appName -Property "platform" -Default "android"

            $prefix = if ($isSelected) { ">" } else { " " }
            $modeLabel = Get-ModeLabel -ModeValue $appMode
            $platformLabel = Get-PlatformLabel -PlatformValue $appPlatform
            $statusText = "[$modeLabel/$platformLabel]"

            if ($isSelected) {
                Write-Host "$prefix $($item.DisplayName) ($($item.Name)) $statusText" -ForegroundColor Green -BackgroundColor DarkGray
            }
            else {
                Write-Host "$prefix $($item.DisplayName) ($($item.Name)) $statusText" -ForegroundColor White
            }
        }

        Write-Host ""
        Write-Host "===============================================================================" -ForegroundColor Cyan
        Write-Host ""

        $selectedApp = $MenuItems[$selectedIndex]
        $selectedAppName = $selectedApp.Name
        $selectedAppMode = Get-AppState -States $appStates -AppName $selectedAppName -Property "mode" -Default "debug"
        $selectedAppPlatform = Get-AppState -States $appStates -AppName $selectedAppName -Property "platform" -Default "android"

        Write-Host "Selected: $($selectedApp.DisplayName)" -ForegroundColor Yellow
        Write-Host "  Mode     : $(Get-ModeLabel -ModeValue $selectedAppMode)" -ForegroundColor Cyan
        Write-Host "  Platform : $(Get-PlatformLabel -PlatformValue $selectedAppPlatform)" -ForegroundColor Cyan
        Write-Host ""

        Write-Host "===============================================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Controls: [Up/Down] Navigate | [Left] Toggle Mode | [Right] Toggle Platform | [Enter] Start | [ESC] Exit" -ForegroundColor Gray
    }

    Draw-Menu

    while ($running) {
        Start-Sleep -Milliseconds 50

        if ([KeyboardUtil]::GetAsyncKeyState($VK_UP) -band 0x8000) {
            $selectedIndex = ($selectedIndex - 1 + $MenuItems.Count) % $MenuItems.Count
            Draw-Menu
            Start-Sleep -Milliseconds 150
        }
        elseif ([KeyboardUtil]::GetAsyncKeyState($VK_DOWN) -band 0x8000) {
            $selectedIndex = ($selectedIndex + 1) % $MenuItems.Count
            Draw-Menu
            Start-Sleep -Milliseconds 150
        }
        elseif ([KeyboardUtil]::GetAsyncKeyState($VK_LEFT) -band 0x8000) {
            # Toggle mode for current app
            $currentApp = $MenuItems[$selectedIndex]
            $currentAppName = $currentApp.Name
            $currentMode = Get-AppState -States $appStates -AppName $currentAppName -Property "mode" -Default "debug"

            $currentModeIndex = $modeOptions.IndexOf($currentMode)
            if ($currentModeIndex -lt 0) { $currentModeIndex = 0 }
            $newModeIndex = ($currentModeIndex + 1) % $modeOptions.Count
            $newMode = $modeOptions[$newModeIndex]

            Set-AppState -States $appStates -AppName $currentAppName -Property "mode" -Value $newMode
            Save-AppStates -AppDirectory $AppDirectory -States $appStates

            Draw-Menu
            Start-Sleep -Milliseconds 150
        }
        elseif ([KeyboardUtil]::GetAsyncKeyState($VK_RIGHT) -band 0x8000) {
            # Toggle platform for current app
            $currentApp = $MenuItems[$selectedIndex]
            $currentAppName = $currentApp.Name
            $currentPlatform = Get-AppState -States $appStates -AppName $currentAppName -Property "platform" -Default "android"

            $currentPlatformIndex = $platformOptions.IndexOf($currentPlatform)
            if ($currentPlatformIndex -lt 0) { $currentPlatformIndex = 0 }
            $newPlatformIndex = ($currentPlatformIndex + 1) % $platformOptions.Count
            $newPlatform = $platformOptions[$newPlatformIndex]

            Set-AppState -States $appStates -AppName $currentAppName -Property "platform" -Value $newPlatform
            Save-AppStates -AppDirectory $AppDirectory -States $appStates

            Draw-Menu
            Start-Sleep -Milliseconds 150
        }
        elseif ([KeyboardUtil]::GetAsyncKeyState($VK_RETURN) -band 0x8000) {
            $running = $false
            Start-Sleep -Milliseconds 150
        }
        elseif ([KeyboardUtil]::GetAsyncKeyState($VK_ESCAPE) -band 0x8000) {
            Write-Host ""
            Write-Host "Cancelled by user" -ForegroundColor Yellow
            exit 0
        }
    }

    $selectedApp = $MenuItems[$selectedIndex]
    $selectedAppName = $selectedApp.Name
    $selectedMode = Get-AppState -States $appStates -AppName $selectedAppName -Property "mode" -Default "debug"
    $selectedPlatform = Get-AppState -States $appStates -AppName $selectedAppName -Property "platform" -Default "android"

    return @{
        SelectedIndex = $selectedIndex
        SelectedApp = $selectedApp
        Mode = $selectedMode
        Platform = $selectedPlatform
    }
}
