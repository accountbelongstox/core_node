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

# Unified Manager - Main Menu Interface
# Provides a unified interface for application management with interactive menu

# Import global variables and utilities
$UNIFIED_MANAGER_ROOT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$UTILS_PATH = Join-Path $UNIFIED_MANAGER_ROOT_DIR "common\utils.ps1"
. (Join-Path $UNIFIED_MANAGER_ROOT_DIR "common\global_vars.ps1")

# Script paths
$START_APPS_SCRIPT = Join-Path $UNIFIED_MANAGER_ROOT_DIR "app_managers\start_apps.ps1"
$INSTALL_SCRIPT = Join-Path $UNIFIED_MANAGER_ROOT_DIR "app_managers\install_all.ps1"
$BUILD_SCRIPT = Join-Path $UNIFIED_MANAGER_ROOT_DIR "app_managers\build_apps.ps1"

# Import utilities
if (Test-Path $UTILS_PATH) {
    . $UTILS_PATH
} else {
    Write-Error "Utilities not found: $UTILS_PATH"
    exit 1
}

# Function to test console capabilities
function Test-ConsoleCapabilities {
    $capabilities = @{
        KeyInput = $true
        CursorControl = $true  
        ColorControl = $true
    }

    try {
        $null = [Console]::ReadKey
    } catch {
        $capabilities.KeyInput = $false
    }

    try {
        $null = [Console]::CursorVisible
    } catch {
        $capabilities.CursorControl = $false
    }

    try {
        $null = [Console]::ForegroundColor
    } catch {
        $capabilities.ColorControl = $false
    }

    return $capabilities
}

# Function to write colored messages
function Write-ColorMessage {
    param(
        [Parameter(Mandatory=$true)] [string]$Message,
        [Parameter(Mandatory=$true)] [ValidateSet("Info", "Success", "Warning", "Error")] [string]$Type
    )
    
    $color = switch ($Type) {
        "Info"    { "Cyan" }
        "Success" { "Green" }
        "Warning" { "Yellow" }
        "Error"   { "Red" }
    }
    
    $prefix = switch ($Type) {
        "Info"    { "[INFO] " }
        "Success" { "[OK] " }
        "Warning" { "[WARN] " }
        "Error"   { "[ERROR] " }
    }
    
    Write-Host -ForegroundColor $color "$prefix$Message"
}

# Function for interactive menu (copied from dd.ps1)
function Invoke-InteractiveMenu {
    param(
        [Parameter(Mandatory=$true)] [array]$Items,
        [Parameter(Mandatory=$true)] [string]$Title,
        [Parameter()] [bool]$EnableValueToggle = $true
    )
    $selectedIndex = 0

    $consoleCapabilities = Test-ConsoleCapabilities

    $cursorVisible = $true
    $originalForeground = [ConsoleColor]::Gray
    $originalBackground = [ConsoleColor]::Black

    if ($consoleCapabilities.CursorControl) {
        try {
            $cursorVisible = [Console]::CursorVisible
            [Console]::CursorVisible = $false
        } catch {
            Write-ColorMessage -Message "Warning: Cannot control cursor visibility in this environment" -Type "Warning"
        }
    }

    if ($consoleCapabilities.ColorControl) {
        try {
            $originalForeground = [Console]::ForegroundColor
            $originalBackground = [Console]::BackgroundColor
        } catch {
            Write-ColorMessage -Message "Warning: Cannot get console colors in this environment" -Type "Warning"
            $originalForeground = [ConsoleColor]::Gray
            $originalBackground = [ConsoleColor]::Black
        }
    }

    function Draw-MenuInternal {
        Clear-Host
        Write-ColorMessage -Message $Title -Type "Info"
        for ($i = 0; $i -lt $Items.Count; $i++) {
            $item = $Items[$i]
            if (-not $item.ContainsKey('CurrentValueIndex')) { 
                $item | Add-Member -NotePropertyName CurrentValueIndex -NotePropertyValue 0 
            }
            $currentValue = $item.Values[$item.CurrentValueIndex]
            $valueDisplay = ""
            if ($item.Values.Count -gt 1 -or $currentValue -ne "default") { 
                $valueDisplay = " [$currentValue]" 
            }
            if ($i -eq $selectedIndex) {
                Write-Host -NoNewline ">"
                Write-Host -NoNewline -ForegroundColor Black -BackgroundColor White (" {0,-40}{1}" -f $item.Text, $valueDisplay)
                Write-Host ""
            } else {
                Write-Host ("  {0,-40}{1}" -f $item.Text, $valueDisplay)
            }
        }
    }

    while ($true) {
        Draw-MenuInternal

        if ($consoleCapabilities.KeyInput) {
            try {
                $key = [Console]::ReadKey($true).Key
            } catch {
                Write-ColorMessage -Message "Error: Cannot read console input in this environment, falling back to number input" -Type "Warning"
                $consoleCapabilities.KeyInput = $false
                continue
            }
        } else {
            Write-Host ""
            Write-Host "Console key input not supported. Please use number selection:" -ForegroundColor Yellow
            for ($i = 0; $i -lt $Items.Count; $i++) {
                Write-Host "  $($i + 1). $($Items[$i].Text)" -ForegroundColor Cyan
            }

            do {
                $input = Read-Host "Enter selection (1-$($Items.Count))"
                $selection = $null
                if ([int]::TryParse($input, [ref]$selection) -and $selection -ge 1 -and $selection -le $Items.Count) {
                    $selectedIndex = $selection - 1
                    break
                } else {
                    Write-Host "Invalid selection. Please enter a number between 1 and $($Items.Count)" -ForegroundColor Red
                }
            } while ($true)

            if ($consoleCapabilities.CursorControl) {
                try { [Console]::CursorVisible = $cursorVisible } catch { }
            }
            if ($consoleCapabilities.ColorControl) {
                try {
                    [Console]::ForegroundColor = $originalForeground
                    [Console]::BackgroundColor = $originalBackground
                } catch { }
            }
            Clear-Host
            return $selectedIndex
        }
        
        switch ($key) {
            'UpArrow'   { 
                if ($selectedIndex -gt 0) { $selectedIndex-- } 
                else { $selectedIndex = $Items.Count - 1 } 
            }
            'DownArrow' { 
                if ($selectedIndex -lt $Items.Count - 1) { $selectedIndex++ } 
                else { $selectedIndex = 0 } 
            }
            'LeftArrow' {
                if ($EnableValueToggle) {
                    $item = $Items[$selectedIndex]
                    if ($item.Values.Count -gt 1) {
                        $item.CurrentValueIndex--
                        if ($item.CurrentValueIndex -lt 0) { 
                            $item.CurrentValueIndex = $item.Values.Count - 1 
                        }
                    }
                }
            }
            'RightArrow' {
                if ($EnableValueToggle) {
                    $item = $Items[$selectedIndex]
                    if ($item.Values.Count -gt 1) {
                        $item.CurrentValueIndex++
                        if ($item.CurrentValueIndex -ge $item.Values.Count) { 
                            $item.CurrentValueIndex = 0 
                        }
                    }
                }
            }
            'Enter'     {
                if ($consoleCapabilities.CursorControl) {
                    try { [Console]::CursorVisible = $cursorVisible } catch { }
                }
                if ($consoleCapabilities.ColorControl) {
                    try {
                        [Console]::ForegroundColor = $originalForeground
                        [Console]::BackgroundColor = $originalBackground
                    } catch { }
                }
                Clear-Host
                return $selectedIndex
            }
        }
    }
}

# Function to show Start Poly Applications submenu
function Show-StartPolyApplicationsMenu {
    $subMenuItems = @(
        @{
            Text              = "Run Poly apps"
            Values            = @("default")
            CurrentValueIndex = 0
            Action            = {
                $polyAppsPath = Join-Path $PROJECT_ROOT "poly_apps"
                
                if (-not (Test-Path $polyAppsPath -PathType Container)) {
                    Write-ColorMessage -Message "Poly apps directory not found: $polyAppsPath" -Type "Error"
                    Read-Host "Press Enter to continue"
                    return
                }
                
                $polyAppDirectories = Get-ChildItem -Path $polyAppsPath -Directory | Select-Object -ExpandProperty Name
                
                if ($polyAppDirectories.Count -eq 0) {
                    Write-ColorMessage -Message "No poly app directories found in: $polyAppsPath" -Type "Warning"
                    Read-Host "Press Enter to continue"
                    return
                }
                
                Write-ColorMessage -Message "Available poly apps:" -Type "Info"
                for ($i = 0; $i -lt $polyAppDirectories.Count; $i++) {
                    Write-ColorMessage -Message "$($i + 1). $($polyAppDirectories[$i])" -Type "Info"
                }
                Write-ColorMessage -Message "0. Return to main menu" -Type "Info"
                
                $choice = Read-Host "Select a poly app to run"
                
                if ($choice -eq "0" -or [string]::IsNullOrEmpty($choice)) {
                    return
                }
                
                $selectedIndex = [int]$choice - 1
                if ($selectedIndex -ge 0 -and $selectedIndex -lt $polyAppDirectories.Count) {
                    $selectedPolyApp = $polyAppDirectories[$selectedIndex]
                    $mainJsPath = Join-Path $PROJECT_ROOT "main.js"
                    
                    Write-ColorMessage -Message "Running poly app: $selectedPolyApp" -Type "Info"
                    Write-ColorMessage -Message "Command: node $mainJsPath poly_app=$selectedPolyApp" -Type "Info"
                    
                    & node $mainJsPath poly_app=$selectedPolyApp
                }
                else {
                    Write-ColorMessage -Message "Invalid selection. Please try again." -Type "Warning"
                    Read-Host "Press Enter to continue"
                }
            }
        },
        @{
            Text              = "Build Poly apps"
            Values            = @("default")
            CurrentValueIndex = 0
            Action            = {
                $selectedValue = "interactive"
                if (Test-Path $BUILD_SCRIPT) {
                    try {
                        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$BUILD_SCRIPT" -Interactive
                    } catch {
                        Write-ColorMessage -Message "Error executing build script: $($_.Exception.Message)" -Type "Error"
                    }
                } else {
                    Write-ColorMessage -Message "Error: build_apps.ps1 script not found at $BUILD_SCRIPT" -Type "Error"
                }
                Read-Host "Press Enter to continue"
            }
        },
        @{
            Text              = "Test Registry Parser"
            Values            = @("default")
            CurrentValueIndex = 0
            Action            = {
                $testScript = Join-Path $UNIFIED_MANAGER_ROOT_DIR "test_ini_registry.ps1"
                if (Test-Path $testScript) {
                    & powershell -NoProfile -ExecutionPolicy Bypass -File $testScript
                } else {
                    Write-ColorMessage -Message "Error: test_ini_registry.ps1 script not found" -Type "Error"
                }
                Read-Host "Press Enter to continue"
            }
        },
        @{
            Text              = "Back to Main Menu"
            Values            = @("default")
            CurrentValueIndex = 0
            Action            = {
                return
            }
        },
        @{
            Text              = "Exit"
            Values            = @("default")
            CurrentValueIndex = 0
            Action            = {
                Write-ColorMessage -Message "Exiting Unified Manager..." -Type "Info"
                exit 0
            }
        }
    )
    
    while ($true) {
        $selection = Invoke-InteractiveMenu -Items $subMenuItems -Title "Start Poly Applications - Select an option" -EnableValueToggle $false
        
        if ($selection -ge 0 -and $selection -lt $subMenuItems.Count) {
            $selectedItem = $subMenuItems[$selection]
            if ($selectedItem.Action) {
                try {
                    & $selectedItem.Action
                    if ($selectedItem.Text -eq "Back to Main Menu") {
                        return
                    }
                } catch {
                    Write-ColorMessage -Message "Error executing action: $_" -Type "Error"
                    Read-Host "Press Enter to continue"
                }
            }
        }
    }
}

# Function to show applications list
function Show-ApplicationsList {
    Write-ColorMessage -Message "Available Applications:" -Type "Info"
    Write-Host ""
    
    # Show regular apps
    $appsPath = Join-Path $PROJECT_ROOT "apps"
    if (Test-Path $appsPath -PathType Container) {
        $appDirectories = Get-ChildItem -Path $appsPath -Directory | Select-Object -ExpandProperty Name
        if ($appDirectories.Count -gt 0) {
            Write-ColorMessage -Message "Regular Apps:" -Type "Info"
            for ($i = 0; $i -lt $appDirectories.Count; $i++) {
                Write-ColorMessage -Message "  $($i + 1). $($appDirectories[$i])" -Type "Info"
            }
        }
    }
    
    Write-Host ""
    
    # Show poly apps
    $polyAppsPath = Join-Path $PROJECT_ROOT "poly_apps"
    if (Test-Path $polyAppsPath -PathType Container) {
        $polyAppDirectories = Get-ChildItem -Path $polyAppsPath -Directory | Select-Object -ExpandProperty Name
        if ($polyAppDirectories.Count -gt 0) {
            Write-ColorMessage -Message "Poly Apps:" -Type "Info"
            for ($i = 0; $i -lt $polyAppDirectories.Count; $i++) {
                Write-ColorMessage -Message "  $($i + 1). $($polyAppDirectories[$i])" -Type "Info"
            }
        }
    }
    
    Read-Host "Press Enter to continue"
}

# Menu items definition
$MenuItems = @(
    @{
        Text              = "Start Applications"
        Values            = @("interactive", "list-only")
        CurrentValueIndex = 0
        Action            = {
            $selectedValue = $MenuItems[0].Values[$MenuItems[0].CurrentValueIndex]
            Write-ColorMessage -Message "Executing: $START_APPS_SCRIPT" -Type "Info"

            if (-not (Test-Path $START_APPS_SCRIPT)) {
                Write-ColorMessage -Message "Error: Script file not found at $START_APPS_SCRIPT" -Type "Error"
                Read-Host "Press Enter to continue"
                return
            }

            try {
                if ($selectedValue -eq "interactive") {
                    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$START_APPS_SCRIPT" -Interactive
                } else {
                    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$START_APPS_SCRIPT" -List
                    Read-Host "Press Enter to continue"
                }
            } catch {
                Write-ColorMessage -Message "Error executing script: $($_.Exception.Message)" -Type "Error"
                Write-ColorMessage -Message "Script path: $START_APPS_SCRIPT" -Type "Info"
                Read-Host "Press Enter to continue"
            }
        }
    },
    @{
        Text              = "Start Poly Applications"
        Values            = @("interactive", "list-only")
        CurrentValueIndex = 0
        Action            = {
            $selectedValue = $MenuItems[1].Values[$MenuItems[1].CurrentValueIndex]
            if ($selectedValue -eq "interactive") {
                Show-StartPolyApplicationsMenu
            } else {
                Show-ApplicationsList
            }
        }
    },
    @{
        Text              = "Install Dependencies"
        Values            = @("all-apps", "specific-apps")
        CurrentValueIndex = 0
        Action            = {
            $selectedValue = $MenuItems[2].Values[$MenuItems[2].CurrentValueIndex]
            if (Test-Path $INSTALL_SCRIPT) {
                try {
                    if ($selectedValue -eq "all-apps") {
                        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTALL_SCRIPT"
                    } else {
                        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTALL_SCRIPT" -Interactive
                    }
                } catch {
                    Write-ColorMessage -Message "Error executing install script: $($_.Exception.Message)" -Type "Error"
                }
            } else {
                Write-ColorMessage -Message "Error: install_all.ps1 script not found at $INSTALL_SCRIPT" -Type "Error"
            }
            Read-Host "Press Enter to continue"
        }
    },
    @{
        Text              = "Build Applications"
        Values            = @("interactive", "list-only", "all-buildable")
        CurrentValueIndex = 0
        Action            = {
            $selectedValue = $MenuItems[3].Values[$MenuItems[3].CurrentValueIndex]
            if (Test-Path $BUILD_SCRIPT) {
                try {
                    if ($selectedValue -eq "interactive") {
                        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$BUILD_SCRIPT" -Interactive
                    } elseif ($selectedValue -eq "list-only") {
                        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$BUILD_SCRIPT" -List
                    } else {
                        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$BUILD_SCRIPT" -All
                    }
                } catch {
                    Write-ColorMessage -Message "Error executing build script: $($_.Exception.Message)" -Type "Error"
                }
            } else {
                Write-ColorMessage -Message "Error: build_apps.ps1 script not found at $BUILD_SCRIPT" -Type "Error"
            }
            Read-Host "Press Enter to continue"
        }
    },
    @{
        Text              = "Back to Main Menu"
        Values            = @("default")
        CurrentValueIndex = 0
        Action            = {
            Write-ColorMessage -Message "Returning to main menu..." -Type "Info"
            $ddScript = Join-Path $PROJECT_ROOT "scripts\shells\win\dd.ps1"
            if (Test-Path $ddScript) {
                & powershell -NoProfile -ExecutionPolicy Bypass -File $ddScript -SkipInitialization
            } else {
                Write-ColorMessage -Message "Error: dd.ps1 script not found" -Type "Error"
                Read-Host "Press Enter to continue"
            }
        }
    },
    @{
        Text              = "Exit"
        Values            = @("default")
        CurrentValueIndex = 0
        Action            = {
            Write-ColorMessage -Message "Exiting Unified Manager..." -Type "Info"
            exit 0
        }
    }
)

# Main menu loop
function Start-UnifiedManager {
    Write-ColorMessage -Message "Starting Unified Application Manager" -Type "Info"
    Write-Host ""

    while ($true) {
        try {
            $selection = Invoke-InteractiveMenu -Items $MenuItems -Title "Unified App Manager - Select an option (Up/Down to move, Left/Right to change mode, Enter to select)" -EnableValueToggle $true
            
            if ($selection -ge 0 -and $selection -lt $MenuItems.Count) {
                $selectedItem = $MenuItems[$selection]
                if ($selectedItem.Action) {
                    try {
                        & $selectedItem.Action
                    } catch {
                        Write-ColorMessage -Message "Error executing action: $_" -Type "Error"
                        Read-Host "Press Enter to continue"
                    }
                }
            }
        } catch {
            Write-ColorMessage -Message "Error in menu: $_" -Type "Error"
            Read-Host "Press Enter to continue"
        }
    }
}

# Start the unified manager
Start-UnifiedManager