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

. "$PSScriptRoot\..\win_common\GlobalVars.ps1"
. "$PSScriptRoot\..\win_common\CommonFunc.ps1"

$STEP_NUMBER = 31

function Get-CurrentUsername {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Getting current username..." -Type "Info"
    $username = $env:USERNAME
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Current username: $username" -Type "Success"
    return $username
}

function Find-WSLDistributionsInWindowsApps {
    param([string]$Username)
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Searching for WSL distributions in WindowsApps directory..." -Type "Info"
    $windowsAppsPath = "C:\Users\$Username\AppData\Local\Microsoft\WindowsApps"
    
    if (-not (Test-Path $windowsAppsPath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] WindowsApps directory not found: $windowsAppsPath" -Type "Warning"
        return @()
    }
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking directory: $windowsAppsPath" -Type "Info"
    
    $foundDistributions = @()
    $searchPatterns = @("ubuntu*.exe", "debian*.exe")
    
    foreach ($pattern in $searchPatterns) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Searching for pattern: $pattern" -Type "Info"
        $files = Get-ChildItem -Path $windowsAppsPath -Filter $pattern -ErrorAction SilentlyContinue
        
        foreach ($file in $files) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Found WSL distribution: $($file.Name)" -Type "Success"
            $foundDistributions += @{
                Name = $file.BaseName
                Path = $file.FullName
                Type = "Executable"
            }
        }
    }
    
    if ($foundDistributions.Count -eq 0) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] No WSL distributions found in WindowsApps directory" -Type "Warning"
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Found $($foundDistributions.Count) distribution(s) in WindowsApps directory" -Type "Success"
    }
    
    return $foundDistributions
}

function Find-WSLShortcutsInStartMenu {
    param([string]$Username)
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Searching for WSL shortcuts in Start Menu..." -Type "Info"
    $startMenuPath = "C:\Users\$Username\AppData\Roaming\Microsoft\Windows\Start Menu"
    
    if (-not (Test-Path $startMenuPath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Start Menu directory not found: $startMenuPath" -Type "Warning"
        return @()
    }
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking directory recursively: $startMenuPath" -Type "Info"
    
    $foundShortcuts = @()
    $searchPatterns = @("*ubuntu*.lnk", "*debian*.lnk")
    
    foreach ($pattern in $searchPatterns) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Searching for shortcut pattern: $pattern" -Type "Info"
        $shortcuts = Get-ChildItem -Path $startMenuPath -Filter $pattern -Recurse -ErrorAction SilentlyContinue
        
        foreach ($shortcut in $shortcuts) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Found WSL shortcut: $($shortcut.Name)" -Type "Success"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Shortcut location: $($shortcut.FullName)" -Type "Info"
            
            try {
                $shell = New-Object -ComObject WScript.Shell
                $link = $shell.CreateShortcut($shortcut.FullName)
                $target = $link.TargetPath
                $arguments = $link.Arguments
                $fullCommand = "$target $arguments".Trim()
                
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Shortcut target: $target" -Type "Info"
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Shortcut arguments: $arguments" -Type "Info"
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Full command: $fullCommand" -Type "Info"
                
                $foundShortcuts += @{
                    Name = $shortcut.BaseName
                    Path = $shortcut.FullName
                    Target = $target
                    Arguments = $arguments
                    FullCommand = $fullCommand
                    Type = "Shortcut"
                }
            } catch {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Error reading shortcut $($shortcut.Name): $_" -Type "Error"
            }
        }
    }
    
    if ($foundShortcuts.Count -eq 0) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] No WSL shortcuts found in Start Menu" -Type "Warning"
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Found $($foundShortcuts.Count) shortcut(s) in Start Menu" -Type "Success"
    }
    
    return $foundShortcuts
}

function Set-WSLDistributionDefaultUser {
    param([hashtable]$Distribution)
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Configuring distribution: $($Distribution.Name)" -Type "Info"
    
    if ($Distribution.Type -eq "Executable") {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting default user for executable: $($Distribution.Path)" -Type "Info"
        try {
            $configCommand = "$($Distribution.Path) config --default-user root"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Executing command: $configCommand" -Type "Info"
            
            & $Distribution.Path config --default-user root
            
            if ($LASTEXITCODE -eq 0) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully set default user to root for $($Distribution.Name)" -Type "Success"
                return $true
            } else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to set default user for $($Distribution.Name). Exit code: $LASTEXITCODE" -Type "Error"
                return $false
            }
        } catch {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Error executing config command for $($Distribution.Name): $_" -Type "Error"
            return $false
        }
    } elseif ($Distribution.Type -eq "Shortcut") {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Processing shortcut: $($Distribution.Name)" -Type "Info"
        
        if ($Distribution.FullCommand -match "--user root$") {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Shortcut already has --user root parameter" -Type "Success"
            return $true
        } else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Shortcut does not have --user root parameter, updating..." -Type "Warning"
            
            try {
                $shell = New-Object -ComObject WScript.Shell
                $link = $shell.CreateShortcut($Distribution.Path)
                
                $newArguments = "$($Distribution.Arguments) --user root".Trim()
                $link.Arguments = $newArguments
                $link.Save()
                
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Updated shortcut arguments to: $newArguments" -Type "Success"
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Shortcut updated successfully: $($Distribution.Path)" -Type "Success"
                return $true
            } catch {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Error updating shortcut $($Distribution.Name): $_" -Type "Error"
                return $false
            }
        }
    }
    
    return $false
}

function Configure-WSLRootAccess {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Starting WSL root access configuration..." -Type "Info"
    
    # Get current username
    $username = Get-CurrentUsername
    
    # Find distributions in WindowsApps directory
    $windowsAppsDistributions = Find-WSLDistributionsInWindowsApps -Username $username
    
    # Find shortcuts in Start Menu
    $startMenuShortcuts = Find-WSLShortcutsInStartMenu -Username $username
    
    # Combine all found distributions (ensure both are arrays)
    $allDistributions = @()
    if ($windowsAppsDistributions) {
        $allDistributions += $windowsAppsDistributions
    }
    if ($startMenuShortcuts) {
        $allDistributions += $startMenuShortcuts
    }
    
    if ($allDistributions.Count -eq 0) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] No WSL distributions or shortcuts found" -Type "Warning"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Please ensure WSL is installed and Ubuntu/Debian distributions are available" -Type "Info"
        return
    }
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Total distributions/shortcuts found: $($allDistributions.Count)" -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Starting configuration process..." -Type "Info"
    
    $successCount = 0
    $failureCount = 0
    
    foreach ($distribution in $allDistributions) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] ----------------------------------------" -Type "Info"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Processing: $($distribution.Name) ($($distribution.Type))" -Type "Info"
        
        $result = Set-WSLDistributionDefaultUser -Distribution $distribution
        
        if ($result) {
            $successCount++
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Configuration successful for: $($distribution.Name)" -Type "Success"
        } else {
            $failureCount++
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Configuration failed for: $($distribution.Name)" -Type "Error"
        }
    }
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] ----------------------------------------" -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Configuration completed:" -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Successful configurations: $successCount" -Type "Success"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed configurations: $failureCount" -Type $(if ($failureCount -gt 0) { "Error" } else { "Success" })
    
    if ($successCount -gt 0) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] WSL distributions have been configured to use root as default user" -Type "Success"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] You may need to restart your WSL distributions for changes to take effect" -Type "Info"
    }
    
}

function Verify-WSLRootConfiguration {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Verifying WSL root configuration..." -Type "Info"
    
    try {
        $wslList = & wsl -l -q 2>$null
        if ($wslList -and $wslList.Count -gt 0) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Available WSL distributions:" -Type "Info"
            foreach ($dist in $wslList) {
                if ($dist -match "ubuntu|debian") {
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Testing distribution: $dist" -Type "Info"
                    try {
                        $whoami = & wsl -d $dist whoami 2>$null
                        if ($whoami -eq "root") {
                            Write-ColorMessage -Message "[Step $STEP_NUMBER] $dist - Default user is root: SUCCESS" -Type "Success"
                        } else {
                            Write-ColorMessage -Message "[Step $STEP_NUMBER] $dist - Default user is $whoami (not root)" -Type "Warning"
                        }
                    } catch {
                        Write-ColorMessage -Message "[Step $STEP_NUMBER] $dist - Unable to test (distribution may not be running)" -Type "Warning"
                    }
                }
            }
        } else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] No WSL distributions found for verification" -Type "Warning"
        }
    } catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Error during verification: $_" -Type "Error"
    }
}

function Step31_SetRootLoginWSLUbuntuDebian {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Step 81: Set Root Login for WSL Ubuntu/Debian Distributions" -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] This script will configure WSL Ubuntu/Debian distributions to use root as default user" -Type "Info"
    
    Configure-WSLRootAccess
    Verify-WSLRootConfiguration
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Step 81 completed" -Type "Success"
}

# Execute the main function
Step31_SetRootLoginWSLUbuntuDebian