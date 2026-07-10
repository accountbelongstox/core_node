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

# Import variable management functions and global variables
$WinCommonDir = Join-Path (Split-Path -Parent $PSScriptRoot) "win_common"
. (Join-Path $WinCommonDir "GlobalVars.ps1")
. (Join-Path $WinCommonDir "CommonFunc.ps1")

$STEP_NUMBER = 15

function Extend-WindowsUpdatePauseDays {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Extending Windows update pause days to prevent automatic updates..." -Type "Info"
    
    # Set maximum pause days (5000 x 100 = 500000 days, approximately 1369 years)
    $maxPauseDays = 500000
    
    # Calculate pause dates (start from now, end after maxPauseDays)
    $startTime = Get-Date
    $endTime = $startTime.AddDays($maxPauseDays)
    $startTimeISO = $startTime.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $endTimeISO = $endTime.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    
    # Define registry paths and values to set
    $registrySettings = @(
        @{
            Path = "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\FlightSettings"
            Values = @(
                @{ Name = "FlightSettingsMaxPauseDays"; Type = "REG_DWORD"; Value = $maxPauseDays }
            )
        },
        @{
            Path = "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings"
            Values = @(
                @{ Name = "FlightSettingsMaxPauseDays"; Type = "REG_DWORD"; Value = $maxPauseDays }
                @{ Name = "PauseFeatureUpdatesStartTime"; Type = "REG_SZ"; Value = $startTimeISO }
                @{ Name = "PauseFeatureUpdatesEndTime"; Type = "REG_SZ"; Value = $endTimeISO }
                @{ Name = "PauseQualityUpdatesStartTime"; Type = "REG_SZ"; Value = $startTimeISO }
                @{ Name = "PauseQualityUpdatesEndTime"; Type = "REG_SZ"; Value = $endTimeISO }
                @{ Name = "PauseUpdatesStartTime"; Type = "REG_SZ"; Value = $startTimeISO }
                @{ Name = "PauseUpdatesExpiryTime"; Type = "REG_SZ"; Value = $endTimeISO }
            )
        }
    )
    
    try {
        foreach ($registrySetting in $registrySettings) {
            $registryPath = $registrySetting.Path
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Processing registry path: $registryPath" -Type "Info"
            
            # Check if registry path exists, create if not
            $regPath = $registryPath -replace "HKEY_LOCAL_MACHINE", "HKLM:"
            if (-not (Test-Path $regPath)) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Creating registry path: $regPath" -Type "Info"
                New-Item -Path $regPath -Force | Out-Null
            }
            
            # Set all values for this registry path
            $successCount = 0
            $failCount = 0
            
            foreach ($valueConfig in $registrySetting.Values) {
                $valueName = $valueConfig.Name
                $valueType = $valueConfig.Type
                $valueData = $valueConfig.Value
                
                # Check current value if exists
                $currentValue = Get-ItemProperty -Path $regPath -Name $valueName -ErrorAction SilentlyContinue
                if ($currentValue) {
                    $currentVal = $currentValue.$valueName
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Current value for $valueName : $currentVal" -Type "Info"
                } else {
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Value $valueName does not exist, will be created." -Type "Info"
                }
                
                # Set registry value using reg command
                if ($valueType -eq "REG_DWORD") {
                    $regCommand = "reg add `"$registryPath`" /v $valueName /t $valueType /d $valueData /f"
                } else {
                    # For REG_SZ, escape the value properly
                    $regCommand = "reg add `"$registryPath`" /v $valueName /t $valueType /d `"$valueData`" /f"
                }
                
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting $valueName to $valueData ..." -Type "Info"
                $result = cmd /c $regCommand 2>&1

                $verifyAfterSet = Get-ItemProperty -Path $regPath -Name $valueName -ErrorAction SilentlyContinue
                $actualAfterSet = if ($verifyAfterSet) { $verifyAfterSet.$valueName } else { $null }
                $valueMatches = if ($valueType -eq "REG_DWORD") {
                    $null -ne $actualAfterSet -and [int]$actualAfterSet -eq [int]$valueData
                } else {
                    $null -ne $actualAfterSet -and "$actualAfterSet" -eq "$valueData"
                }

                if ($valueMatches) {
                    $successCount++
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully set $valueName to $valueData" -Type "Success"
                } else {
                    $failCount++
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to set $valueName" -Type "Error"
                    if ($result) {
                        Write-ColorMessage -Message "[Step $STEP_NUMBER] Error output: $result" -Type "Error"
                    }
                }
            }
            
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Completed for $registryPath . Success: $successCount, Failed: $failCount" -Type "Info"
            
            # Final verification
            Write-Host ""
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Verifying registry values for $registryPath ..." -Type "Info"
            foreach ($valueConfig in $registrySetting.Values) {
                $valueName = $valueConfig.Name
                $expectedValue = $valueConfig.Value
                
                $verifyValue = Get-ItemProperty -Path $regPath -Name $valueName -ErrorAction SilentlyContinue
                if ($verifyValue) {
                    $actualValue = $verifyValue.$valueName
                    if ($actualValue -eq $expectedValue) {
                        Write-ColorMessage -Message "[Step $STEP_NUMBER] Verified: $valueName = $actualValue" -Type "Success"
                    } else {
                        Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: $valueName mismatch. Expected: $expectedValue, Actual: $actualValue" -Type "Warning"
                    }
                } else {
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: $valueName not found after setting" -Type "Warning"
                }
            }
            
            Write-Host ""
        }
        
        Write-ColorMessage -Message "[Step $STEP_NUMBER] All registry paths processed successfully." -Type "Success"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Windows Update pause extended to $maxPauseDays days (approximately $([math]::Round($maxPauseDays / 365.25, 1)) years)." -Type "Success"
    }
    catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Error extending Windows update pause days: $_" -Type "Error"
    }
}

function Open-WindowsUpdateSettings {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Opening Windows Update settings..." -Type "Info"
    
    try {
        # Try to open Windows Update settings
        if ($Global:isWin11) {
            Start-Process "ms-settings:windowsupdate" -ErrorAction Stop
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Windows 11 Update settings opened." -Type "Success"
        }
        elseif ($Global:isWin10) {
            Start-Process "ms-settings:windowsupdate" -ErrorAction Stop
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Windows 10 Update settings opened." -Type "Success"
        }
        else {
            # Fallback method
            Start-Process "ms-settings:" -ErrorAction Stop
            Write-ColorMessage -Message "[Step $STEP_NUMBER] General Settings opened. Please navigate to Windows Update manually." -Type "Warning"
        }
    }
    catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to open Windows Update settings: $_" -Type "Error"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Please open Settings > Update & Security > Windows Update manually." -Type "Info"
    }
}

# Main execution - only run if script is executed directly, not when dot-sourced
if ($MyInvocation.InvocationName -ne '.') {
    Extend-WindowsUpdatePauseDays

    Write-Host ""
    Write-ColorMessage -Message "[Step $STEP_NUMBER] ============================================================================" -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] IMPORTANT: Please follow these steps in Windows Update settings:" -Type "Warning"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] 1. Find 'Pause updates' or 'Pause updates extend for' option" -Type "Warning"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] 2. Select the MAXIMUM duration available" -Type "Warning"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] 3. This will extend the pause period to the maximum time possible" -Type "Warning"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] ============================================================================" -Type "Info"
    Write-Host ""

    Open-WindowsUpdateSettings

    Write-Host ""
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Windows Update settings panel has been opened." -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Please select 'Pause updates extend for' and choose the maximum duration." -Type "Warning"
    Write-Host ""
    Write-ColorMessage -Message "Press any key to continue after you have completed the settings..." -Type "Info"
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Windows Update pause extension completed." -Type "Success"
}

