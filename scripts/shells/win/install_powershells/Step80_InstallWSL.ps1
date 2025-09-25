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
. "$PSScriptRoot\..\win_common\CommanFunc.ps1"

$STEP_NUMBER = 77

function Is-WSLInstalled {
    if (Test-Path $WSL_INSTALLED_FLAG) {
        return $true
    }
    try {
        $wslOutput = & wsl --status 2>&1
        if ($LASTEXITCODE -eq 0 -and $wslOutput -notmatch "not installed") {
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

function Prompt-WSLInstall {
    while ($true) {
        $msg = "[Step $STEP_NUMBER] The Windows Subsystem for Linux is not installed. Do you want to install it now? [Y/n] (Auto-continue in 10 seconds with 'Y')"
        Write-ColorMessage -Message $msg -Type "Warning"
        $input = $null
        $timeout = 10
        $startTime = Get-Date
        $endTime = $startTime.AddSeconds($timeout)
        while ((Get-Date) -lt $endTime) {
            if ([Console]::KeyAvailable) {
                $key = [Console]::ReadKey($true)
                $input = $key.KeyChar
                break
            }
            Start-Sleep -Milliseconds 100
        }
        if ($null -eq $input) {
            $input = "Y"
        }
        $input = $input.ToString().ToUpper()
        if ($input -eq "Y") {
            return $true
        } elseif ($input -eq "N") {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Skipping WSL installation." -Type "Info"
            return $false
        } else {
            Write-ColorMessage -Message "Please enter 'Y' or 'N' (case-insensitive)." -Type "Warning"
        }
    }
}

function Clean-String {
    param ([string]$InputString)
    $cleaned = $InputString -replace '[\r\n\s]+', ' '
    return $cleaned.Trim()
}

function Get-SudoPassword {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Please enter your Ubuntu sudo password (press Enter to use default password '$Global:UBUNTU_DEFAULT_PASSWORD'):" -Type "Warning"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] You have 10 seconds to enter the password..." -Type "Info"
    
    $startTime = Get-Date
    $endTime = $startTime.AddSeconds(10)
    $password = $null
    
    while ((Get-Date) -lt $endTime) {
        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)
            if ($key.Key -eq [ConsoleKey]::Enter) {
                break
            }
            $password += $key.KeyChar
        }
        Start-Sleep -Milliseconds 100
    }
    
    if ([string]::IsNullOrEmpty($password)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Using default password after timeout" -Type "Warning"
        return $Global:UBUNTU_DEFAULT_PASSWORD
    }
    
    return $password
}

function Set-WSLConfiguration {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking WSL configuration files..." -Type "Info"
    
    # Define configuration content
    $wslConfContent = @"
[boot]
systemd=true

[network]
generateResolvConf = true

[interop]
enabled = true
appendWindowsPath = true

[user]
default = root
"@

    $wslConfigContent = @"
[wsl2]
processors=2
localhostForwarding=true
swap=8GB
guiApplications=true
nestedVirtualization=true

[experimental]
sparseVhd=true
"@

    # Check and create wsl.conf
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking wsl.conf..." -Type "Info"
    
    try {
        # Check if wsl.conf exists and has correct content
        $verifyCommand = "cat /etc/wsl.conf 2>/dev/null"
        $fileContent = & wsl -d "Ubuntu-$Global:UBUNTU_VERSION" bash -c $verifyCommand 2>&1
        
        if ($fileContent -match "\[boot\]" -and $fileContent -match "\[user\]") {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] wsl.conf exists and has correct content" -Type "Success"
            
            Write-ColorMessage -Message "[Step $STEP_NUMBER] wsl.conf needs to be configured" -Type "Warning"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Please follow these steps:" -Type "Info"
            Write-ColorMessage -Message "1. Open Ubuntu 24.04 terminal" -Type "Info"
            Write-ColorMessage -Message "2. Run: sudo nano /etc/wsl.conf" -Type "Info"
            Write-ColorMessage -Message "3. Copy and paste the following content:" -Type "Info"
            Write-Host $wslConfContent -ForegroundColor Cyan
            Write-ColorMessage -Message "4. Press Ctrl+X, then Y, then Enter to save" -Type "Info"
            Write-ColorMessage -Message "5. After saving, run these commands to verify:" -Type "Info"
            Write-ColorMessage -Message "   - cat /etc/wsl.conf (to verify content)" -Type "Info"
            Write-ColorMessage -Message "   - whoami (should show 'root')" -Type "Info"
            Write-ColorMessage -Message "6. Exit Ubuntu terminal" -Type "Info"
            Write-ColorMessage -Message "7. In PowerShell, run: wsl --shutdown" -Type "Info"
            Write-ColorMessage -Message "8. Wait 10 seconds, then restart Ubuntu" -Type "Info"
            Write-ColorMessage -Message "9. Type 'yes' here when you have completed all steps" -Type "Warning"
        } else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] wsl.conf needs to be configured" -Type "Warning"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Please follow these steps:" -Type "Info"
            Write-ColorMessage -Message "1. Open Ubuntu 24.04 terminal" -Type "Info"
            Write-ColorMessage -Message "2. Run: sudo nano /etc/wsl.conf" -Type "Info"
            Write-ColorMessage -Message "3. Copy and paste the following content:" -Type "Info"
            Write-Host $wslConfContent -ForegroundColor Cyan
            Write-ColorMessage -Message "4. Press Ctrl+X, then Y, then Enter to save" -Type "Info"
            Write-ColorMessage -Message "5. After saving, run these commands to verify:" -Type "Info"
            Write-ColorMessage -Message "   - cat /etc/wsl.conf (to verify content)" -Type "Info"
            Write-ColorMessage -Message "   - whoami (should show 'root')" -Type "Info"
            Write-ColorMessage -Message "6. Exit Ubuntu terminal" -Type "Info"
            Write-ColorMessage -Message "7. In PowerShell, run: wsl --shutdown" -Type "Info"
            Write-ColorMessage -Message "8. Wait 10 seconds, then restart Ubuntu" -Type "Info"
            Write-ColorMessage -Message "9. Type 'yes' here when you have completed all steps" -Type "Warning"
            
            do {
                $confirmation = Read-Host "Have you completed all configuration steps? (yes/no)"
            } while ($confirmation -ne "yes")
            
            # Verify the configuration after manual setup
            $fileContent = & wsl -d "Ubuntu-$Global:UBUNTU_VERSION" bash -c $verifyCommand 2>&1
            if ($fileContent -match "\[boot\]" -and $fileContent -match "\[user\]") {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully verified wsl.conf configuration" -Type "Success"
            } else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: wsl.conf verification failed. Please check the configuration manually." -Type "Warning"
            }
        }
    } catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Error checking wsl.conf: $_" -Type "Error"
    }

    # Check and create .wslconfig
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking .wslconfig..." -Type "Info"
    $wslConfigPath = Join-Path $env:USERPROFILE ".wslconfig"
    
    if (-not (Test-Path $wslConfigPath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] .wslconfig needs to be configured" -Type "Warning"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Please follow these steps:" -Type "Info"
        Write-ColorMessage -Message "1. Open Notepad or your preferred text editor" -Type "Info"
        Write-ColorMessage -Message "2. Create a new file at: $wslConfigPath" -Type "Info"
        Write-ColorMessage -Message "3. Copy and paste the following content:" -Type "Info"
        Write-Host $wslConfigContent -ForegroundColor Cyan
        Write-ColorMessage -Message "4. Save the file" -Type "Info"
        Write-ColorMessage -Message "5. After saving, run these commands to verify:" -Type "Info"
        Write-ColorMessage -Message "   - wsl --status (to check WSL status)" -Type "Info"
        Write-ColorMessage -Message "   - wsl --shutdown (to apply changes)" -Type "Info"
        Write-ColorMessage -Message "6. Wait 10 seconds, then restart Ubuntu" -Type "Info"
        Write-ColorMessage -Message "7. Type 'yes' here when you have completed all steps" -Type "Warning"
        
        do {
            $confirmation = Read-Host "Have you completed all configuration steps? (yes/no)"
        } while ($confirmation -ne "yes")
        
        # Verify the configuration after manual setup
        if (Test-Path $wslConfigPath) {
            $configContent = Get-Content $wslConfigPath -Raw
            if ($configContent -match "\[wsl2\]" -and $configContent -match "memory=4GB") {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully verified .wslconfig configuration" -Type "Success"
            } else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: .wslconfig verification failed. Please check the configuration manually." -Type "Warning"
            }
        }
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] .wslconfig already exists" -Type "Success"
    }

    # Restart WSL to apply changes
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Restarting WSL to apply configuration changes..." -Type "Warning"
    & wsl --shutdown
    Start-Sleep -Seconds 10  # Wait for WSL to fully shut down
    Write-ColorMessage -Message "[Step $STEP_NUMBER] WSL configuration completed" -Type "Success"
}

function Step77_InstallWSL {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking WSL installation..." -Type "Info"
    if (-not (Is-WSLInstalled)) {
        if (-not (Prompt-WSLInstall)) {
            return
        }
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing WSL..." -Type "Warning"
        try {
            & wsl --install
            if ($LASTEXITCODE -eq 0) {
                New-Item -ItemType File -Path $WSL_INSTALLED_FLAG -Force | Out-Null
                Write-ColorMessage -Message "[Step $STEP_NUMBER] WSL installation completed and flag created." -Type "Success"
            } else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] WSL installation failed." -Type "Error"
                return
            }
        } catch {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Error during WSL installation: $_" -Type "Error"
            return
        }
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] WSL is already installed." -Type "Success"
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking installed WSL distributions..." -Type "Info"
    $wslList = & wsl --list --verbose
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Current WSL distributions:" -Type "Info"
    Write-Host $wslList

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking for Ubuntu 24.04..." -Type "Info"
    $distros = & wsl -l -q
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Found distributions: $($distros -join ', ')" -Type "Info"

    if ($distros -contains "Ubuntu-24.04") {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Ubuntu 24.04 is already installed." -Type "Success"
        $found = $true
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Ubuntu 24.04 not found. Installing..." -Type "Warning"
        try {
            & wsl --install -d Ubuntu-24.04
            if ($LASTEXITCODE -eq 0) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Ubuntu 24.04 installed successfully." -Type "Success"
            } else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to install Ubuntu 24.04." -Type "Error"
                return
            }
        } catch {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Error during Ubuntu 24.04 installation: $_" -Type "Error"
            return
        }
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking default user for Ubuntu 24.04..." -Type "Info"
    $defaultUser = & wsl -d Ubuntu-24.04 cat /etc/wsl.conf 2>$null | Select-String -Pattern "default="

    if ($defaultUser -notmatch "default=root") {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting root as default user for Ubuntu 24.04..." -Type "Warning"
        try {
            & wsl -d Ubuntu-24.04 bash -c "echo -e '[user]\ndefault=root' > /etc/wsl.conf"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Default user set to root for Ubuntu 24.04." -Type "Success"
        } catch {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Error setting default user to root: $_" -Type "Error"
        }
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Default user is already root for Ubuntu 24.04." -Type "Success"
    }


    Write-ColorMessage -Message "[Step $STEP_NUMBER] WSL and Ubuntu 24.04 setup completed." -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

Step77_InstallWSL
Set-WSLConfiguration