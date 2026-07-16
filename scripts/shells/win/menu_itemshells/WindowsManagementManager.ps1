# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY FORBIDDEN
# ### AI SPECIAL ATTENTION RULES END ###

<#
.SYNOPSIS
    Windows Management Menu
.DESCRIPTION
    Provides a menu interface for Windows system management including system information display and Windows Update pause extension
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_COMMON_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "win_common"
$script:SHELLS_DIR = Split-Path (Split-Path $script:PS_CURRENT_DIR -Parent) -Parent
$script:INSTALL_POWERSHELLS_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "install_powershells"
$script:TOOLS_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "tools"
$script:ANDROID_LAUNCHER = Join-Path $script:TOOLS_DIR "AndroidEmulatorLauncher.ps1"
$script:SCRIPTS_ROOT_DIR = Split-Path $script:SHELLS_DIR -Parent
$script:CHROME_REPAIR_SCRIPT = Join-Path $script:SCRIPTS_ROOT_DIR "chromefix\repair-chrome-crash.ps1"
$script:CHROME_REPAIR_SCRIPT_FALLBACK = Join-Path "D:\programing\Users\$env:USERNAME\.core_node\scripts\chromefix" "repair-chrome-crash.ps1"
$script:USER_PROFILE_PATH_MAPPING_SCRIPT = Join-Path $script:PS_CURRENT_DIR "UserProfilePathMapping.ps1"
$script:WSL_UBUNTU_MANAGER_SCRIPT = Join-Path $script:PS_CURRENT_DIR "WSLUbuntuManager.ps1"

# Import required modules
. (Join-Path $script:WIN_COMMON_DIR "GlobalVars.ps1")
. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")
$script:COLOR_SUCCESS = "Green"
$script:COLOR_WARNING = "Yellow"
$script:COLOR_ERROR = "Red"
$script:COLOR_INFO = "White"
#endregion

#region Helper Functions
function Write-ColorMessage {
    param(
        [Parameter(Mandatory=$true)] [string]$Message,
        [Parameter()] [string]$Type = "Info"
    )
    
    $color = $script:COLOR_INFO
    $prefix = "[*] "
    
    if ($Type -eq "Success") {
        $color = $script:COLOR_SUCCESS
        $prefix = "[+] "
    } elseif ($Type -eq "Warning") {
        $color = $script:COLOR_WARNING
        $prefix = "[!] "
    } elseif ($Type -eq "Error") {
        $color = $script:COLOR_ERROR
        $prefix = "[-] "
    }
    
    Write-Host "$prefix$Message" -ForegroundColor $color
}

function Show-WindowsSystemInfoHeader {
    $osInfo = Get-CimInstance Win32_OperatingSystem
    $computerInfo = Get-CimInstance Win32_ComputerSystem

    Write-Host ""
    Write-ColorMessage -Message "================================================================================" -Type "Info"
    Write-ColorMessage -Message "Windows System Information" -Type "Info"
    Write-ColorMessage -Message "================================================================================" -Type "Info"
    Write-ColorMessage -Message "Operating System: $($osInfo.Caption)" -Type "Info"
    Write-ColorMessage -Message "Version: $($osInfo.Version) (Build $($osInfo.BuildNumber))" -Type "Info"
    Write-ColorMessage -Message "Architecture: $($osInfo.OSArchitecture)" -Type "Info"
    Write-ColorMessage -Message "Computer Name: $($computerInfo.Name)" -Type "Info"
    Write-ColorMessage -Message "Total Physical Memory: $([math]::Round($computerInfo.TotalPhysicalMemory / 1GB, 2)) GB" -Type "Info"
    Write-ColorMessage -Message "Manufacturer: $($computerInfo.Manufacturer)" -Type "Info"
    Write-ColorMessage -Message "Model: $($computerInfo.Model)" -Type "Info"
    Write-ColorMessage -Message "================================================================================" -Type "Info"
    Write-Host ""
}
#endregion

#region Main Functions
function Show-WindowsManagementSubMenu {
    $extendWindowsUpdateScript = Join-Path $script:INSTALL_POWERSHELLS_DIR "Step15_ExtendWindowsUpdate.ps1"

    $subItems = @(
        @{
            Text = "Display System Information";
            Values = @("default");
            CurrentValueIndex = 0;
            Key = $null;
            Action = {
                Write-Host ""
                Write-ColorMessage -Message "Detailed System Information:" -Type "Info"
                try {
                    $os = Get-CimInstance Win32_OperatingSystem
                    $cs = Get-CimInstance Win32_ComputerSystem
                    Write-Host "OS Name:           $($os.Caption)"
                    Write-Host "OS Version:        $($os.Version) Build $($os.BuildNumber)"
                    Write-Host "System Type:       $($os.OSArchitecture)"
                    Write-Host "Computer Name:     $($cs.Name)"
                    $totalMB = [math]::Round($cs.TotalPhysicalMemory / 1MB, 2)
                    $freeMB = [math]::Round(($os.FreePhysicalMemory) / 1KB, 2)
                    Write-Host "Total Physical Memory:    $totalMB MB"
                    Write-Host "Available Physical Memory: $freeMB MB"
                } catch {
                    Write-ColorMessage -Message "Failed to get system info: $_" -Type "Error"
                }
            }
        },
        @{
            Text = "Extend Windows Update Pause Days";
            Values = @("default");
            CurrentValueIndex = 0;
            Key = $null;
            Action = {
                if (Test-Path $extendWindowsUpdateScript) {
                    Write-ColorMessage -Message "Executing Step15: Extend Windows Update Pause Days..." -Type "Info"
                    Write-Host ""
                    & $extendWindowsUpdateScript
                } else {
                    Write-ColorMessage -Message "Step15 script not found at: $extendWindowsUpdateScript" -Type "Error"
                }
            }
        },
        @{
            Text = "Start Android Emulator (Stable)";
            Values = @("default");
            CurrentValueIndex = 0;
            Key = $null;
            Action = {
                Clear-Host
                $stableLauncher = Join-Path $script:TOOLS_DIR "AndroidEmulatorStableLauncher.ps1"
                if (Test-Path $stableLauncher) {
                    Write-ColorMessage -Message "Launching stable Android emulator launcher..." -Type "Info"
                    Write-Host ""
                    try {
                        & powershell -NoProfile -ExecutionPolicy Bypass -File $stableLauncher
                    } catch {
                        Write-ColorMessage -Message "Failed to start emulator launcher: $($_.Exception.Message)" -Type "Error"
                    }
                } else {
                    Write-ColorMessage -Message "Stable launcher script not found: $stableLauncher" -Type "Error"
                }
            }
        },
        @{
            Text = "APP Install";
            Values = @("default");
            CurrentValueIndex = 0;
            Key = $null;
            Action = {
                $appInstallMenuScript = Join-Path $script:PS_CURRENT_DIR "AppInstallMenu.ps1"
                if (Test-Path $appInstallMenuScript) {
                    Write-ColorMessage -Message "Launching APP Install Menu..." -Type "Info"
                    Write-Host ""
                    & $appInstallMenuScript
                } else {
                    Write-ColorMessage -Message "AppInstallMenu.ps1 not found: $appInstallMenuScript" -Type "Error"
                }
            }
        },
        @{
            Text = "WSL Ubuntu Management";
            Values = @("default");
            CurrentValueIndex = 0;
            Key = $null;
            Action = {
                if (Test-Path $script:WSL_UBUNTU_MANAGER_SCRIPT) {
                    Write-ColorMessage -Message "Launching WSL Ubuntu Management..." -Type "Info"
                    Write-Host ""
                    & powershell -NoProfile -ExecutionPolicy Bypass -File $script:WSL_UBUNTU_MANAGER_SCRIPT
                } else {
                    Write-ColorMessage -Message "WSLUbuntuManager.ps1 not found: $script:WSL_UBUNTU_MANAGER_SCRIPT" -Type "Error"
                }
            }
        },
        @{
            Text = "Repair Chrome Crash (PUP + Compat Shim / 0xC0000409)";
            Values = @("default");
            CurrentValueIndex = 0;
            Key = $null;
            Action = {
                Clear-Host
                $repairScript = $script:CHROME_REPAIR_SCRIPT
                if (-not (Test-Path $repairScript)) { $repairScript = $script:CHROME_REPAIR_SCRIPT_FALLBACK }
                if (Test-Path $repairScript) {
                    Write-ColorMessage -Message "Repairing Chrome crash (AW PUP removal + compat shim fix)..." -Type "Info"
                    Write-Host ""
                    & powershell -NoProfile -ExecutionPolicy Bypass -File $repairScript
                } else {
                    Write-ColorMessage -Message "Chrome repair script not found: $repairScript" -Type "Error"
                }
            }
        },
        @{
            Text = "Path Mapping (.cursor / .devin)";
            Values = @("default");
            CurrentValueIndex = 0;
            Key = $null;
            Action = {
                if (Test-Path $script:USER_PROFILE_PATH_MAPPING_SCRIPT) {
                    . $script:USER_PROFILE_PATH_MAPPING_SCRIPT
                    Show-UserProfilePathMappingMenu
                } else {
                    Write-ColorMessage -Message "UserProfilePathMapping.ps1 not found: $script:USER_PROFILE_PATH_MAPPING_SCRIPT" -Type "Error"
                }
            }
        },
        @{ Text = "Back"; Values = @("default"); Key = $null; Action = { return } },
        @{ Text = "Quit"; Values = @("default"); Key = $null; Action = { exit } }
    )

    foreach ($item in $subItems) {
        if ($item.Key) {
            $savedValue = Get-GlobalVar -Key $item.Key
            if ($savedValue) {
                $valueIndex = [array]::IndexOf($item.Values, $savedValue)
                if ($valueIndex -ge 0) {
                    $item.CurrentValueIndex = $valueIndex
                }
            }
        }
    }

    $selected = 0
    while ($true) {
        Clear-Host
        Show-WindowsSystemInfoHeader
        Write-ColorMessage -Message "Windows Management Menu (Up/Down to move, Left/Right to change value, Enter to select)" -Type "Info"
        for ($i=0; $i -lt $subItems.Count; $i++) {
            $it = $subItems[$i]
            $valIndex = if ($it.ContainsKey('CurrentValueIndex')) { $it.CurrentValueIndex } else { 0 }
            $currVal = $it.Values[$valIndex]
            $display = if ($it.Values.Count -gt 1 -or $currVal -ne 'default') { " [$currVal]" } else { "" }
            if ($i -eq $selected) {
                Write-Host -NoNewline ">"
                Write-Host -NoNewline -ForegroundColor Black -BackgroundColor White (" {0,-35}{1}" -f $it.Text, $display)
                Write-Host ""
            } else {
                Write-Host ("  {0,-35}{1}" -f $it.Text, $display)
            }
        }

        try {
            $key = [Console]::ReadKey($true).Key
        } catch {
            Write-ColorMessage -Message "Error: Cannot read console input in this environment, using fallback" -Type "Warning"
            Write-Host "Press Enter to continue or type 'q' to quit: " -NoNewline
            $userInput = Read-Host
            if ($userInput -eq 'q') {
                return
            } else {
                continue
            }
        }
        switch ($key) {
            'UpArrow'   { if ($selected -gt 0) { $selected-- } else { $selected = $subItems.Count - 1 } }
            'DownArrow' { if ($selected -lt $subItems.Count - 1) { $selected++ } else { $selected = 0 } }
            'LeftArrow' {
                $it = $subItems[$selected]
                if ($it.Values.Count -gt 1) {
                    if (-not $it.ContainsKey('CurrentValueIndex')) { $it | Add-Member -NotePropertyName CurrentValueIndex -NotePropertyValue 0 }
                    $it.CurrentValueIndex--
                    if ($it.CurrentValueIndex -lt 0) { $it.CurrentValueIndex = $it.Values.Count - 1 }
                    if ($it.Key) {
                        $selectedValue = $it.Values[$it.CurrentValueIndex]
                        Set-GlobalVar -Key $it.Key -Value $selectedValue
                    }
                }
            }
            'RightArrow' {
                $it = $subItems[$selected]
                if ($it.Values.Count -gt 1) {
                    if (-not $it.ContainsKey('CurrentValueIndex')) { $it | Add-Member -NotePropertyName CurrentValueIndex -NotePropertyValue 0 }
                    $it.CurrentValueIndex++
                    if ($it.CurrentValueIndex -ge $it.Values.Count) { $it.CurrentValueIndex = 0 }
                    if ($it.Key) {
                        $selectedValue = $it.Values[$it.CurrentValueIndex]
                        Set-GlobalVar -Key $it.Key -Value $selectedValue
                    }
                }
            }
            'Enter' {
                $selectedItem = $subItems[$selected]
                $selectedText = $selectedItem.Text

                if ($selectedText -eq "Back") {
                    $selectedItem.Action.Invoke()
                    return
                }
                if ($selectedText -eq "Quit") {
                    $selectedItem.Action.Invoke()
                    exit
                }

                Clear-Host
                $selectedItem.Action.Invoke()
                Wait-MenuContinue
            }
            'Q' { return }
            'Escape' { return }
        }
    }
}
#endregion

# Main execution
Show-WindowsManagementSubMenu
