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

# Import variable management functions and global variables
$WinCommonDir = Join-Path (Split-Path -Parent $PSScriptRoot) "win_common"
. (Join-Path $WinCommonDir "GlobalVars.ps1")
. (Join-Path $WinCommonDir "CommanFunc.ps1")

$STEP_NUMBER = 2

# Registry file path for Windows 10 context menu
$REG_SUB_PATH = "shells/win/scripts/Step2_Win10ContextMenu.reg"

function Set-PluggedInPowerSettings {
    Write-Host "[Step 2] Configuring power settings for always-on (plugged in) mode..." -ForegroundColor Cyan

    # Set power plan to High Performance if available
    $highPerfGuid = (powercfg /L | Select-String -Pattern "High performance" | ForEach-Object { $_.ToString().Split()[3] })
    if ($highPerfGuid) {
        powercfg /S $highPerfGuid
        Write-Host "[Step 2] Power plan set to High Performance." -ForegroundColor Green
    } else {
        Write-Host "[Step 2] High Performance power plan not found, skipping power plan change." -ForegroundColor Yellow
    }

    # Set disk timeout (plugged in) to never
    powercfg /change disk-timeout-ac 0

    # Set monitor timeout (plugged in) to never
    powercfg /change monitor-timeout-ac 0

    # Set standby timeout (plugged in) to never
    powercfg /change standby-timeout-ac 0

    # Disable hybrid sleep (plugged in)
    powercfg /setacvalueindex SCHEME_CURRENT SUB_SLEEP HYBRIDSLEEP 0

    # Disable hibernation
    powercfg /hibernate off

    Write-Host "[Step 2] Power settings updated for plugged-in mode: High Performance, disk, monitor, standby, hybrid sleep, and hibernation all set to never/off." -ForegroundColor Green
}

function Set-FileExplorerSettings {
    Write-Host "[Step 2] Configuring File Explorer settings..." -ForegroundColor Cyan

    try {
        # Show hidden files
        Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "Hidden" -Value 1
        Write-Host "[Step 2] Show hidden files enabled." -ForegroundColor Green

        # Show protected operating system files
        Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "ShowSuperHidden" -Value 1
        Write-Host "[Step 2] Show protected operating system files enabled." -ForegroundColor Green

        # Show file extensions
        Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "HideFileExt" -Value 0
        Write-Host "[Step 2] Show file extensions enabled." -ForegroundColor Green

        Write-Host "[Step 2] File Explorer registry settings configured successfully." -ForegroundColor Green
    }
    catch {
        Write-Host "[Step 2] Error configuring File Explorer settings: $_" -ForegroundColor Red
    }
}

function Set-DarkModeAndOpenSettings {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Configuring dark mode settings..." -Type "Info"
    
    try {
        $darkModeApplied = $false
        
        # Set dark mode for Windows based on version
        if ($Global:isWin10 -or $Global:isWin11) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Detected Windows 10/11, applying dark mode settings..." -Type "Info"
            
            # Set Apps to use dark theme
            Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" -Name "AppsUseLightTheme" -Value 0 -Type DWord -Force
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Apps dark theme enabled." -Type "Success"
            
            # Set System to use dark theme  
            Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" -Name "SystemUsesLightTheme" -Value 0 -Type DWord -Force
            Write-ColorMessage -Message "[Step $STEP_NUMBER] System dark theme enabled." -Type "Success"
            
            # Additional Windows 11 specific settings
            if ($Global:isWin11) {
                # Enable dark mode for taskbar and start menu
                Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" -Name "ColorPrevalence" -Value 0 -Type DWord -Force
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Windows 11 taskbar dark mode enabled." -Type "Success"
            }
            
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Dark mode configuration completed successfully." -Type "Success"
            $darkModeApplied = $true
        }
        else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Dark mode configuration not supported on this Windows version." -Type "Warning"
        }
        
        # Ask user if they want to open settings window (only if dark mode was applied)
        if ($darkModeApplied) {
            Write-Host ""
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Dark mode has been applied successfully!" -Type "Success"
            Write-Host "Do you want to open Windows Settings to review the theme settings? (Y/N)" -ForegroundColor Yellow -NoNewline
            Write-Host " [Auto-continue in 20 seconds with 'N']" -ForegroundColor Gray
            
            # Wait for user input with 20 second timeout
            $timeout = 20
            $userChoice = $null
            $startTime = Get-Date
            
            do {
                if ([Console]::KeyAvailable) {
                    $key = [Console]::ReadKey($true)
                    if ($key.Key -eq 'Y' -or $key.KeyChar -eq 'y') {
                        $userChoice = 'Y'
                        break
                    }
                    elseif ($key.Key -eq 'N' -or $key.KeyChar -eq 'n' -or $key.Key -eq 'Enter' -or $key.Key -eq 'Escape') {
                        $userChoice = 'N'
                        break
                    }
                }
                
                $elapsed = (Get-Date) - $startTime
                if ($elapsed.TotalSeconds -ge $timeout) {
                    $userChoice = 'N'
                    Write-Host ""
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Timeout reached, continuing without opening settings..." -Type "Info"
                    break
                }
                
                Start-Sleep -Milliseconds 100
            } while ($true)
            
            # Open settings if user chose to
            if ($userChoice -eq 'Y') {
                Write-Host ""
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Opening Windows Settings window..." -Type "Info"
                
                # Try multiple methods for better Win10/Win11 compatibility
                $settingsOpened = $false
                
                try {
                    # Method 1: Use ms-settings URI (preferred for Win10/Win11)
                    if ($Global:isWin11) {
                        Start-Process "ms-settings:personalization-colors" -ErrorAction Stop
                        $settingsOpened = $true
                        Write-ColorMessage -Message "[Step $STEP_NUMBER] Windows 11 Settings opened via ms-settings URI." -Type "Success"
                    }
                    elseif ($Global:isWin10) {
                        Start-Process "ms-settings:personalization-colors" -ErrorAction Stop
                        $settingsOpened = $true
                        Write-ColorMessage -Message "[Step $STEP_NUMBER] Windows 10 Settings opened via ms-settings URI." -Type "Success"
                    }
                }
                catch {
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] ms-settings URI failed, trying alternative method..." -Type "Warning"
                }
                
                # Method 2: Fallback to control panel if ms-settings fails
                if (-not $settingsOpened) {
                    try {
                        Start-Process "control" -ArgumentList "desk.cpl,,2" -ErrorAction Stop
                        $settingsOpened = $true
                        Write-ColorMessage -Message "[Step $STEP_NUMBER] Settings opened via Control Panel (fallback method)." -Type "Success"
                    }
                    catch {
                        Write-ColorMessage -Message "[Step $STEP_NUMBER] Control Panel method also failed, trying final fallback..." -Type "Warning"
                    }
                }
                
                # Method 3: Final fallback - open general settings
                if (-not $settingsOpened) {
                    try {
                        Start-Process "ms-settings:" -ErrorAction Stop
                        Write-ColorMessage -Message "[Step $STEP_NUMBER] General Settings opened (final fallback method)." -Type "Success"
                    }
                    catch {
                        Write-ColorMessage -Message "[Step $STEP_NUMBER] Unable to open Settings window. Please open manually: Settings > Personalization > Colors" -Type "Error"
                    }
                }
            }
            else {
                Write-Host ""
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Skipping settings window as requested." -Type "Info"
            }
        }
    }
    catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Error configuring dark mode: $_" -Type "Error"
    }
}

function Restart-ExplorerOnce {
    # Check if Explorer restart has already been performed
    if (Test-Path $Global:STEP2_EXPLORER_RESTART_FLAG) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Explorer restart has already been performed. Skipping..." -Type "Info"
        return
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Restarting File Explorer to apply changes..." -Type "Warning"
    
    try {
        # Lines 55-56: Restart File Explorer
        Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
        Start-Process explorer.exe
        
        # Create completion flag file
        New-Item -ItemType File -Path $Global:STEP2_EXPLORER_RESTART_FLAG -Force | Out-Null
        Write-ColorMessage -Message "[Step $STEP_NUMBER] File Explorer restarted successfully and flagged." -Type "Success"
    }
    catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Error restarting File Explorer: $_" -Type "Error"
    }
}

# Check if Step2 base settings have already been completed
if (Test-Path $Global:STEP2_BASE_SETTINGS_FLAG) {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Base settings have already been configured. Skipping..." -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] To reconfigure, delete the flag file: $Global:STEP2_BASE_SETTINGS_FLAG" -Type "Info"
} else {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Configuring base settings for the first time..." -Type "Info"
    
    Set-PluggedInPowerSettings
    Set-FileExplorerSettings
    Set-DarkModeAndOpenSettings
    
    # Create completion flag file
    New-Item -ItemType File -Path $Global:STEP2_BASE_SETTINGS_FLAG -Force | Out-Null
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Base settings configuration completed and flagged." -Type "Success"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Created completion flag: $Global:STEP2_BASE_SETTINGS_FLAG" -Type "Success"
}

function Set-Win10ContextMenuRegistry {
    # Check if this is Windows 10
    if (-not $Global:isWin10) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Skipping Win10 context menu registry settings - not Windows 10." -Type "Info"
        return
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Configuring Windows 10 CMD and PowerShell administrator context menus..." -Type "Info"

    # Always refresh registry, no flag check

    # CRITICAL: PowerShell "Run as Administrator" Setup
    # The Step2_Win10ContextMenu.reg file contains the FINAL WORKING VERSION
    # that successfully enables PowerShell "Run as Administrator" functionality.
    #
    # IMPORTANT: The command format in the registry file is CRITICAL:
    # cmd /c echo "%V%" | powershell $Path = $Input.Trim() -replace '''',''''''; Start-Process powershell -ArgumentList $('-NoExit -Command "Set-Location -LiteralPath ''' + $Path + '''"') -Verb RunAs
    #
    # This specific format ensures:
    # 1. %V parameter is properly passed through cmd echo command
    # 2. PowerShell receives the path via pipeline (|)
    # 3. Path is properly escaped for Set-Location command
    # 4. New PowerShell process starts with admin privileges (-Verb RunAs)
    # 5. PowerShell opens in the correct directory specified by %V
    #
    # DO NOT MODIFY this command format - it has been tested and verified to work

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Downloading and importing registry file..." -Type "Info"

    # Use Invoke-SmartLoadScript to intelligently load registry file (local or remote)
    $regFile = Invoke-SmartLoadScript -SubPath $REG_SUB_PATH -ForceDownload $false
    
    if (-not $regFile) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to load registry file, skipping context menu setup" -Type "Error"
        return
    }
    
    if (-not (Test-Path $regFile)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Registry file not found at: $regFile" -Type "Error"
        return
    }

    try {
        # Debug information
        $fileInfo = Get-Item $regFile
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Using registry file: $regFile" -Type "Success"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] File size: $($fileInfo.Length) bytes" -Type "Info"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Last modified: $($fileInfo.LastWriteTime)" -Type "Info"

        # Prepare import commands for manual testing
        $importCmd1 = "reg.exe import `"$regFile`""
        $importCmd2 = "regedit.exe /s `"$regFile`""
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Import command 1: $importCmd1" -Type "Warning"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Import command 2: $importCmd2" -Type "Warning"

        # Import registry file (try reg.exe first, fallback to regedit.exe)
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Executing registry import with reg.exe..." -Type "Info"
        $result = Start-Process -FilePath "reg.exe" -ArgumentList "import", "`"$regFile`"" -Wait -PassThru -WindowStyle Hidden
        
        # If reg.exe fails, try regedit.exe as fallback
        if ($result.ExitCode -ne 0) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] reg.exe failed, trying regedit.exe as fallback..." -Type "Warning"
            $result = Start-Process -FilePath "regedit.exe" -ArgumentList "/s", "`"$regFile`"" -Wait -PassThru -WindowStyle Hidden
        }
        
        if ($result.ExitCode -eq 0) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Registry imported successfully." -Type "Success"
        } else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Registry import failed with exit code: $($result.ExitCode)" -Type "Error"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Common exit codes:" -Type "Error"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] - Exit code 1: File not found or invalid format" -Type "Error"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] - Exit code 2: Syntax error in registry file" -Type "Error"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] - Exit code 5: Access denied (run as administrator)" -Type "Error"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Manual test commands:" -Type "Error"
            Write-ColorMessage -Message "[Step $STEP_NUMBER]   reg.exe import `"$regFile`"" -Type "Error"
            Write-ColorMessage -Message "[Step $STEP_NUMBER]   regedit.exe /s `"$regFile`"" -Type "Error"
        }
    }
    catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Error during registry configuration: $_" -Type "Error"
    }
}


# Always check and perform Explorer restart if needed (independent of base settings)
Restart-ExplorerOnce

# Always run dark mode configuration (independent of base settings flag)
Set-DarkModeAndOpenSettings

# Handle Windows 10 specific registry context menu
Set-Win10ContextMenuRegistry

