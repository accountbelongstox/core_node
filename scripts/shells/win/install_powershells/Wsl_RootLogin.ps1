. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "GlobalVars.ps1")
. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "CommonFunc.ps1")

$COMPONENT_ID = 'Wsl_RootLogin'

function Get-CurrentUsername {
    Write-ColorMessage -Message "[$COMPONENT_ID] Getting current username..." -Type "Info"
    $username = $env:USERNAME
    Write-ColorMessage -Message "[$COMPONENT_ID] Current username: $username" -Type "Success"
    return $username
}

function Find-WSLDistributionsInWindowsApps {
    param([string]$Username)
    
    Write-ColorMessage -Message "[$COMPONENT_ID] Searching for WSL distributions in WindowsApps directory..." -Type "Info"
    $windowsAppsPath = "C:\Users\$Username\AppData\Local\Microsoft\WindowsApps"
    
    if (-not (Test-Path $windowsAppsPath)) {
        Write-ColorMessage -Message "[$COMPONENT_ID] WindowsApps directory not found: $windowsAppsPath" -Type "Warning"
        return @()
    }
    
    Write-ColorMessage -Message "[$COMPONENT_ID] Checking directory: $windowsAppsPath" -Type "Info"
    
    $foundDistributions = @()
    $searchPatterns = @("ubuntu*.exe", "debian*.exe")
    
    foreach ($pattern in $searchPatterns) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Searching for pattern: $pattern" -Type "Info"
        $files = Get-ChildItem -Path $windowsAppsPath -Filter $pattern -ErrorAction SilentlyContinue
        
        foreach ($file in $files) {
            Write-ColorMessage -Message "[$COMPONENT_ID] Found WSL distribution: $($file.Name)" -Type "Success"
            $foundDistributions += @{
                Name = $file.BaseName
                Path = $file.FullName
                Type = "Executable"
            }
        }
    }
    
    if ($foundDistributions.Count -eq 0) {
        Write-ColorMessage -Message "[$COMPONENT_ID] No WSL distributions found in WindowsApps directory" -Type "Warning"
    } else {
        Write-ColorMessage -Message "[$COMPONENT_ID] Found $($foundDistributions.Count) distribution(s) in WindowsApps directory" -Type "Success"
    }
    
    return $foundDistributions
}

function Find-WSLShortcutsInStartMenu {
    param([string]$Username)
    
    Write-ColorMessage -Message "[$COMPONENT_ID] Searching for WSL shortcuts in Start Menu..." -Type "Info"
    $startMenuPath = "C:\Users\$Username\AppData\Roaming\Microsoft\Windows\Start Menu"
    
    if (-not (Test-Path $startMenuPath)) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Start Menu directory not found: $startMenuPath" -Type "Warning"
        return @()
    }
    
    Write-ColorMessage -Message "[$COMPONENT_ID] Checking directory recursively: $startMenuPath" -Type "Info"
    
    $foundShortcuts = @()
    $searchPatterns = @("*ubuntu*.lnk", "*debian*.lnk")
    
    foreach ($pattern in $searchPatterns) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Searching for shortcut pattern: $pattern" -Type "Info"
        $shortcuts = Get-ChildItem -Path $startMenuPath -Filter $pattern -Recurse -ErrorAction SilentlyContinue
        
        foreach ($shortcut in $shortcuts) {
            Write-ColorMessage -Message "[$COMPONENT_ID] Found WSL shortcut: $($shortcut.Name)" -Type "Success"
            Write-ColorMessage -Message "[$COMPONENT_ID] Shortcut location: $($shortcut.FullName)" -Type "Info"
            
            try {
                $shell = New-Object -ComObject WScript.Shell
                $link = $shell.CreateShortcut($shortcut.FullName)
                $target = $link.TargetPath
                $arguments = $link.Arguments
                $fullCommand = "$target $arguments".Trim()
                
                Write-ColorMessage -Message "[$COMPONENT_ID] Shortcut target: $target" -Type "Info"
                Write-ColorMessage -Message "[$COMPONENT_ID] Shortcut arguments: $arguments" -Type "Info"
                Write-ColorMessage -Message "[$COMPONENT_ID] Full command: $fullCommand" -Type "Info"
                
                $foundShortcuts += @{
                    Name = $shortcut.BaseName
                    Path = $shortcut.FullName
                    Target = $target
                    Arguments = $arguments
                    FullCommand = $fullCommand
                    Type = "Shortcut"
                }
            } catch {
                Write-ColorMessage -Message "[$COMPONENT_ID] Error reading shortcut $($shortcut.Name): $_" -Type "Error"
            }
        }
    }
    
    if ($foundShortcuts.Count -eq 0) {
        Write-ColorMessage -Message "[$COMPONENT_ID] No WSL shortcuts found in Start Menu" -Type "Warning"
    } else {
        Write-ColorMessage -Message "[$COMPONENT_ID] Found $($foundShortcuts.Count) shortcut(s) in Start Menu" -Type "Success"
    }
    
    return $foundShortcuts
}

function Set-WSLDistributionDefaultUser {
    param([hashtable]$Distribution)
    
    Write-ColorMessage -Message "[$COMPONENT_ID] Configuring distribution: $($Distribution.Name)" -Type "Info"
    
    if ($Distribution.Type -eq "Executable") {
        Write-ColorMessage -Message "[$COMPONENT_ID] Setting default user for executable: $($Distribution.Path)" -Type "Info"
        try {
            $configCommand = "$($Distribution.Path) config --default-user root"
            Write-ColorMessage -Message "[$COMPONENT_ID] Executing command: $configCommand" -Type "Info"
            
            & $Distribution.Path config --default-user root

            if ($LASTEXITCODE -eq 0) {
                Write-ColorMessage -Message "[$COMPONENT_ID] Successfully set default user to root for $($Distribution.Name)" -Type "Success"
                return $true
            } else {
                Write-ColorMessage -Message "[$COMPONENT_ID] Failed to set default user for $($Distribution.Name)" -Type "Error"
                return $false
            }
        } catch {
            Write-ColorMessage -Message "[$COMPONENT_ID] Error executing config command for $($Distribution.Name): $_" -Type "Error"
            return $false
        }
    } elseif ($Distribution.Type -eq "Shortcut") {
        Write-ColorMessage -Message "[$COMPONENT_ID] Processing shortcut: $($Distribution.Name)" -Type "Info"
        
        if ($Distribution.FullCommand -match "--user root$") {
            Write-ColorMessage -Message "[$COMPONENT_ID] Shortcut already has --user root parameter" -Type "Success"
            return $true
        } else {
            Write-ColorMessage -Message "[$COMPONENT_ID] Shortcut does not have --user root parameter, updating..." -Type "Warning"
            
            try {
                $shell = New-Object -ComObject WScript.Shell
                $link = $shell.CreateShortcut($Distribution.Path)
                
                $newArguments = "$($Distribution.Arguments) --user root".Trim()
                $link.Arguments = $newArguments
                $link.Save()
                
                Write-ColorMessage -Message "[$COMPONENT_ID] Updated shortcut arguments to: $newArguments" -Type "Success"
                Write-ColorMessage -Message "[$COMPONENT_ID] Shortcut updated successfully: $($Distribution.Path)" -Type "Success"
                return $true
            } catch {
                Write-ColorMessage -Message "[$COMPONENT_ID] Error updating shortcut $($Distribution.Name): $_" -Type "Error"
                return $false
            }
        }
    }
    
    return $false
}

function Configure-WSLRootAccess {
    Write-ColorMessage -Message "[$COMPONENT_ID] Starting WSL root access configuration..." -Type "Info"
    
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
        Write-ColorMessage -Message "[$COMPONENT_ID] No WSL distributions or shortcuts found" -Type "Warning"
        Write-ColorMessage -Message "[$COMPONENT_ID] Please ensure WSL is installed and Ubuntu/Debian distributions are available" -Type "Info"
        return
    }
    
    Write-ColorMessage -Message "[$COMPONENT_ID] Total distributions/shortcuts found: $($allDistributions.Count)" -Type "Info"
    Write-ColorMessage -Message "[$COMPONENT_ID] Starting configuration process..." -Type "Info"
    
    $successCount = 0
    $failureCount = 0
    
    foreach ($distribution in $allDistributions) {
        Write-ColorMessage -Message "[$COMPONENT_ID] ----------------------------------------" -Type "Info"
        Write-ColorMessage -Message "[$COMPONENT_ID] Processing: $($distribution.Name) ($($distribution.Type))" -Type "Info"
        
        $result = Set-WSLDistributionDefaultUser -Distribution $distribution
        
        if ($result) {
            $successCount++
            Write-ColorMessage -Message "[$COMPONENT_ID] Configuration successful for: $($distribution.Name)" -Type "Success"
        } else {
            $failureCount++
            Write-ColorMessage -Message "[$COMPONENT_ID] Configuration failed for: $($distribution.Name)" -Type "Error"
        }
    }
    
    Write-ColorMessage -Message "[$COMPONENT_ID] ----------------------------------------" -Type "Info"
    Write-ColorMessage -Message "[$COMPONENT_ID] Configuration completed:" -Type "Info"
    Write-ColorMessage -Message "[$COMPONENT_ID] Successful configurations: $successCount" -Type "Success"
    Write-ColorMessage -Message "[$COMPONENT_ID] Failed configurations: $failureCount" -Type $(if ($failureCount -gt 0) { "Error" } else { "Success" })
    
    if ($successCount -gt 0) {
        Write-ColorMessage -Message "[$COMPONENT_ID] WSL distributions have been configured to use root as default user" -Type "Success"
        Write-ColorMessage -Message "[$COMPONENT_ID] You may need to restart your WSL distributions for changes to take effect" -Type "Info"
    }
    
}

function Verify-WSLRootConfiguration {
    Write-ColorMessage -Message "[$COMPONENT_ID] Verifying WSL root configuration..." -Type "Info"
    
    try {
        $wslList = @(& wsl -l -q 2>$null | ForEach-Object { "$_".Replace("`0", "").Trim() } | Where-Object { $_ })
        if ($wslList -and $wslList.Count -gt 0) {
            Write-ColorMessage -Message "[$COMPONENT_ID] Available WSL distributions:" -Type "Info"
            foreach ($dist in $wslList) {
                if ($dist -match "ubuntu|debian") {
                    Write-ColorMessage -Message "[$COMPONENT_ID] Testing distribution: $dist" -Type "Info"
                    try {
                        $whoami = & wsl -d $dist whoami 2>$null
                        if ($whoami -eq "root") {
                            Write-ColorMessage -Message "[$COMPONENT_ID] $dist - Default user is root: SUCCESS" -Type "Success"
                        } else {
                            Write-ColorMessage -Message "[$COMPONENT_ID] $dist - Default user is $whoami (not root)" -Type "Warning"
                        }
                    } catch {
                        Write-ColorMessage -Message "[$COMPONENT_ID] $dist - Unable to test (distribution may not be running)" -Type "Warning"
                    }
                }
            }
        } else {
            Write-ColorMessage -Message "[$COMPONENT_ID] No WSL distributions found for verification" -Type "Warning"
        }
    } catch {
        Write-ColorMessage -Message "[$COMPONENT_ID] Error during verification: $_" -Type "Error"
    }
}

function Wsl_RootLogin {
    Write-ColorMessage -Message "[$COMPONENT_ID] Step 81: Set Root Login for WSL Ubuntu/Debian Distributions" -Type "Info"
    Write-ColorMessage -Message "[$COMPONENT_ID] This script will configure WSL Ubuntu/Debian distributions to use root as default user" -Type "Info"
    
    Configure-WSLRootAccess
    Verify-WSLRootConfiguration
    
    Write-ColorMessage -Message "[$COMPONENT_ID] completed" -Type "Success"
}

# Execute the main function
Wsl_RootLogin