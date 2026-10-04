# Declare all variables at the beginning
$ErrorActionPreference = "Stop"
$COMPONENT_ID = 'Wsl_Install'
$env:WSL_UTF8 = '1'

# System compatibility variables
$script:WindowsVersion = $null
$script:WSLVersion = $null
$script:WSLInstalled = $false
$script:WSL2Supported = $false
$script:RequiredFeaturesEnabled = $false

# Path variables
$script:CurrentScriptPath = $null
$script:InstallPowershellsDir = $null
$script:PostinstallPath = $null
$script:UpgradeScriptPath = $null
$script:ChangedWslConfDistros = @()

# Import common functions
. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "GlobalVars.ps1")
. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "CommonFunc.ps1")
. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "DockerWslBridge.ps1")

function Get-WindowsVersion {
    try {
        $osInfo = Get-WmiObject -Class Win32_OperatingSystem
        $version = [System.Environment]::OSVersion.Version
        $buildNumber = $osInfo.BuildNumber
        
        $script:WindowsVersion = @{
            Major = $version.Major
            Minor = $version.Minor
            Build = $buildNumber
            Version = $version
            IsWin10 = ($version.Major -eq 10 -and $version.Minor -eq 0)
            IsWin11 = ($version.Major -eq 10 -and $version.Minor -eq 0 -and $buildNumber -ge 22000)
            IsWin10Build1903OrLater = ($version.Major -eq 10 -and $version.Minor -eq 0 -and $buildNumber -ge 18362)
        }
        
        Write-ColorMessage -Message "[$COMPONENT_ID] Detected Windows Version: $($version.Major).$($version.Minor).$buildNumber" -Type "Info"
        return $script:WindowsVersion
    } catch {
        Write-ColorMessage -Message "[$COMPONENT_ID] Error detecting Windows version: $_" -Type "Error"
        return $null
    }
}

function Test-WSL2Support {
    param([hashtable]$WindowsVersion)
    
    if (-not $WindowsVersion) {
        return $false
    }
    
    # WSL2 requires Windows 10 version 1903 (build 18362) or later
    $script:WSL2Supported = $WindowsVersion.IsWin10Build1903OrLater
    
    if ($script:WSL2Supported) {
        Write-ColorMessage -Message "[$COMPONENT_ID] WSL2 is supported on this Windows version" -Type "Success"
    } else {
        Write-ColorMessage -Message "[$COMPONENT_ID] WSL2 is not supported on this Windows version (requires build 18362+)" -Type "Warning"
    }
    
    return $script:WSL2Supported
}

function Get-WslStatusText {
    $ErrorActionPreference = 'Continue'
    return ((& wsl --status 2>&1 | ForEach-Object { "$_".Replace("`0", '') }) -join "`n")
}

function Get-WSLVersion {
    try {
        $wslStatus = Get-WslStatusText
        if ("$wslStatus" -notmatch "not installed") {
            if (("$wslStatus").Contains('Default Version: 2')) {
                $script:WSLVersion = "WSL2"
                Write-ColorMessage -Message "[$COMPONENT_ID] WSL2 is the default version" -Type "Success"
            } elseif (("$wslStatus").Contains('Default Version: 1')) {
                $script:WSLVersion = "WSL1"
                Write-ColorMessage -Message "[$COMPONENT_ID] WSL1 is the default version" -Type "Warning"
            } else {
                $script:WSLVersion = "Unknown"
                Write-ColorMessage -Message "[$COMPONENT_ID] Could not determine WSL version" -Type "Warning"
            }
        } else {
            $script:WSLVersion = "NotInstalled"
            Write-ColorMessage -Message "[$COMPONENT_ID] WSL is not installed" -Type "Warning"
        }
        return $script:WSLVersion
    } catch {
        $script:WSLVersion = "NotInstalled"
        Write-ColorMessage -Message "[$COMPONENT_ID] Error checking WSL version: $_" -Type "Error"
        return $script:WSLVersion
    }
}

function Test-RequiredWindowsFeatures {
    param([hashtable]$WindowsVersion)
    
    if (-not $WindowsVersion) {
        return $false
    }
    
    $requiredFeatures = @()
    
    # Check Windows features based on version
    if ($WindowsVersion.IsWin10) {
        $requiredFeatures = @(
            "Microsoft-Windows-Subsystem-Linux",
            "VirtualMachinePlatform"
        )
        
        # For older Win10 versions, we might need different features
        if ($WindowsVersion.Build -lt 18362) {
            Write-ColorMessage -Message "[$COMPONENT_ID] Windows 10 build $($WindowsVersion.Build) detected - using legacy WSL1 features" -Type "Warning"
            $requiredFeatures = @("Microsoft-Windows-Subsystem-Linux")
        }
    }
    
    $allEnabled = $true
    foreach ($feature in $requiredFeatures) {
        try {
            $featureState = Get-WindowsOptionalFeature -Online -FeatureName $feature -ErrorAction SilentlyContinue
            if ($featureState -and $featureState.State -eq "Enabled") {
                Write-ColorMessage -Message "[$COMPONENT_ID] Feature '$feature' is enabled" -Type "Success"
            } else {
                Write-ColorMessage -Message "[$COMPONENT_ID] Feature '$feature' is not enabled" -Type "Warning"
                $allEnabled = $false
            }
        } catch {
            Write-ColorMessage -Message "[$COMPONENT_ID] Error checking feature '$feature': $_" -Type "Error"
            $allEnabled = $false
        }
    }
    
    $script:RequiredFeaturesEnabled = $allEnabled
    return $allEnabled
}

function Enable-RequiredWindowsFeatures {
    param([hashtable]$WindowsVersion)
    
    if (-not $WindowsVersion) {
        return $false
    }
    
    $featuresToEnable = @()
    
    if ($WindowsVersion.IsWin10) {
        if ($WindowsVersion.Build -ge 18362) {
            # WSL2 features for newer Win10
            $featuresToEnable = @(
                "Microsoft-Windows-Subsystem-Linux",
                "VirtualMachinePlatform"
            )
        } else {
            # WSL1 features for older Win10
            $featuresToEnable = @("Microsoft-Windows-Subsystem-Linux")
        }
    }
    
    foreach ($feature in $featuresToEnable) {
        try {
            Write-ColorMessage -Message "[$COMPONENT_ID] Enabling Windows feature: $feature" -Type "Warning"
            Enable-WindowsOptionalFeature -Online -FeatureName $feature -NoRestart -All
            $featureState = Get-WindowsOptionalFeature -Online -FeatureName $feature -ErrorAction SilentlyContinue
            if ($featureState -and $featureState.State -eq "Enabled") {
                Write-ColorMessage -Message "[$COMPONENT_ID] Successfully enabled feature: $feature" -Type "Success"
            } else {
                Write-ColorMessage -Message "[$COMPONENT_ID] Failed to enable feature: $feature" -Type "Error"
                return $false
            }
        } catch {
            Write-ColorMessage -Message "[$COMPONENT_ID] Error enabling feature '$feature': $_" -Type "Error"
            return $false
        }
    }
    
    return $true
}

function Invoke-WSLUpgradeProcessor {
    param(
        [hashtable]$WindowsVersion,
        [string]$CurrentWSLVersion
    )
    
    Write-ColorMessage -Message "[$COMPONENT_ID] Checking if WSL upgrade is required..." -Type "Info"
    
    # Check if upgrade is required
    $upgradeRequired = $false
    
    # Check if Windows version is too old for WSL2
    if ($WindowsVersion.IsWin10 -and $WindowsVersion.Build -lt 18362) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Windows 10 build $($WindowsVersion.Build) is too old for WSL2. Upgrade required." -Type "Warning"
        $upgradeRequired = $true
    }
    
    # Check if WSL is not installed and system needs updates
    if ($CurrentWSLVersion -eq "NotInstalled") {
        Write-ColorMessage -Message "[$COMPONENT_ID] WSL is not installed. System may need updates." -Type "Warning"
        $upgradeRequired = $true
    }
    
    # Check if WSL1 is installed but system supports WSL2
    if ($CurrentWSLVersion -eq "WSL1" -and $WindowsVersion.IsWin10Build1903OrLater) {
        Write-ColorMessage -Message "[$COMPONENT_ID] WSL1 detected on WSL2-capable system. Upgrade required." -Type "Warning"
        $upgradeRequired = $true
    }
    
    if (-not $upgradeRequired) {
        Write-ColorMessage -Message "[$COMPONENT_ID] No upgrade required. Continuing with normal installation." -Type "Success"
        return $false
    }
    
    # Call WSL upgrade processor
    Write-ColorMessage -Message "[$COMPONENT_ID] Calling WSL upgrade processor..." -Type "Warning"
    
    # Initialize path variables
    $script:CurrentScriptPath = $MyInvocation.PSCommandPath
    $script:InstallPowershellsDir = Split-Path $script:CurrentScriptPath -Parent
    $script:PostinstallPath = Join-Path $script:InstallPowershellsDir "postinstall"
    $script:UpgradeScriptPath = Join-Path $script:PostinstallPath "WSLUpgradeProcessor.ps1"
    
    Write-ColorMessage -Message "[$COMPONENT_ID] installPowershellsDir: $($script:InstallPowershellsDir)" -Type "Info"
    Write-ColorMessage -Message "[$COMPONENT_ID] postinstallPath: $($script:PostinstallPath)" -Type "Info"
    Write-ColorMessage -Message "[$COMPONENT_ID] Looking for upgrade script at: $($script:UpgradeScriptPath)" -Type "Info"
    
    if (Test-Path $script:UpgradeScriptPath) {
        try {
            Write-ColorMessage -Message "[$COMPONENT_ID] Executing upgrade script: $($script:UpgradeScriptPath)" -Type "Info"
            & $script:UpgradeScriptPath -WindowsVersion $WindowsVersion -CurrentWSLVersion $CurrentWSLVersion -WslInstallScriptPath $script:CurrentScriptPath

            $upgradeStateFile = Join-Path $env:TEMP "wsl_upgrade_state.json"
            if ((Test-Path $upgradeStateFile) -or (Test-Path (Join-Path $Global:USER_CACHE_DIR "ContinueWSLInstallation.ps1"))) {
                Write-ColorMessage -Message "[$COMPONENT_ID] Upgrade process completed. System restart initiated." -Type "Success"
                return $true
            } else {
                Write-ColorMessage -Message "[$COMPONENT_ID] Upgrade process did not require restart. Continuing with normal installation." -Type "Warning"
                return $false
            }
        } catch {
            Write-ColorMessage -Message "[$COMPONENT_ID] Error calling upgrade script: $_" -Type "Error"
            Write-ColorMessage -Message "[$COMPONENT_ID] Continuing with normal installation." -Type "Warning"
            return $false
        }
    } else {
        Write-ColorMessage -Message "[$COMPONENT_ID] Upgrade script not found: $($script:UpgradeScriptPath)" -Type "Error"
        Write-ColorMessage -Message "[$COMPONENT_ID] Continuing with normal installation." -Type "Warning"
        return $false
    }
}

function Is-WSLInstalled {
    if (Test-Path $WSL_INSTALLED_FLAG) {
        return $true
    }
    try {
        $wslOutput = & wsl --status 2>&1
        if ("$wslOutput" -notmatch "not installed") {
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

function Prompt-WSLInstall {
    $msg = "[$COMPONENT_ID] The Windows Subsystem for Linux is not installed. Do you want to install it now? [Y/n] (Auto-continue in 10 seconds with 'Y')"
    Write-Host $msg -ForegroundColor Yellow

    $userInput = $null
    $timeout = 10
    $startTime = Get-Date
    $endTime = $startTime.AddSeconds($timeout)

    while ((Get-Date) -lt $endTime) {
        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)
            $char = $key.KeyChar.ToString().ToUpper()

            if ($char -eq "Y") {
                Write-Host ""
                return $true
            } elseif ($char -eq "N") {
                Write-Host ""
                Write-ColorMessage -Message "[$COMPONENT_ID] Skipping WSL installation." -Type "Info"
                return $false
            }
        }
        Start-Sleep -Milliseconds 100
    }

    Write-Host ""
    Write-ColorMessage -Message "[$COMPONENT_ID] Auto-continuing with 'Y' after timeout" -Type "Info"
    return $true
}

function Clean-String {
    param ([string]$InputString)
    $cleaned = $InputString -replace '[\r\n\s]+', ' '
    return $cleaned.Trim()
}

function Get-SudoPassword {
    Write-ColorMessage -Message "[$COMPONENT_ID] Please enter your Ubuntu sudo password (press Enter to use default password '$Global:UBUNTU_DEFAULT_PASSWORD'):" -Type "Warning"
    Write-ColorMessage -Message "[$COMPONENT_ID] You have 10 seconds to enter the password..." -Type "Info"
    
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
        Write-ColorMessage -Message "[$COMPONENT_ID] Using default password after timeout" -Type "Warning"
        return $Global:UBUNTU_DEFAULT_PASSWORD
    }
    
    return $password
}

function Set-WSLConfiguration {
    Write-ColorMessage -Message "[$COMPONENT_ID] Checking WSL configuration files..." -Type "Info"
    
    # Define configuration content
    $wslConfigContent = @"
[wsl2]
memory=4GB
processors=2
swap=2GB
localhostForwarding=true
"@

    $wslConfigPath = Join-Path $env:USERPROFILE ".wslconfig"
    
    if (-not (Test-Path $wslConfigPath)) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Creating .wslconfig file..." -Type "Info"
        Set-Content -Path $wslConfigPath -Value $wslConfigContent -Encoding UTF8
        
        Write-ColorMessage -Message "[$COMPONENT_ID] Manual configuration required:" -Type "Warning"
        Write-ColorMessage -Message "1. Open .wslconfig file at: $wslConfigPath" -Type "Info"
        Write-ColorMessage -Message "2. Verify the configuration matches your system" -Type "Info"
        Write-ColorMessage -Message "3. Adjust memory and processor settings if needed" -Type "Info"
        Write-ColorMessage -Message "4. Save the file" -Type "Info"
        Write-ColorMessage -Message "5. Restart WSL: wsl --shutdown" -Type "Info"
        Write-ColorMessage -Message "6. Wait 10 seconds, then restart Ubuntu" -Type "Info"
        Write-ColorMessage -Message "7. Type 'yes' here when you have completed all steps" -Type "Warning"
        
        do {
            $confirmation = Read-Host "Have you completed all configuration steps? (yes/no)"
        } while ($confirmation -ne "yes")
        
        # Verify the configuration after manual setup
        if (Test-Path $wslConfigPath) {
            $configContent = Get-Content $wslConfigPath -Raw
            if ($configContent -match "\[wsl2\]" -and $configContent -match "memory=4GB") {
                Write-ColorMessage -Message "[$COMPONENT_ID] Successfully verified .wslconfig configuration" -Type "Success"
            } else {
                Write-ColorMessage -Message "[$COMPONENT_ID] Warning: .wslconfig verification failed. Please check the configuration manually." -Type "Warning"
            }
        }
    } else {
        Write-ColorMessage -Message "[$COMPONENT_ID] .wslconfig already exists" -Type "Success"
    }

    # Restart WSL to apply changes
    Write-ColorMessage -Message "[$COMPONENT_ID] Restarting WSL to apply configuration changes..." -Type "Warning"
    & wsl --shutdown
    Start-Sleep -Seconds 10  # Wait for WSL to fully shut down
    Write-ColorMessage -Message "[$COMPONENT_ID] WSL configuration completed" -Type "Success"
}

function Wsl_Install {
    Write-ColorMessage -Message "[$COMPONENT_ID] Starting WSL installation with compatibility checks..." -Type "Info"
    
    # Step 1: Detect Windows version
    Write-ColorMessage -Message "[$COMPONENT_ID] Step 1: Detecting Windows version..." -Type "Info"
    $windowsVersion = Get-WindowsVersion
    if (-not $windowsVersion) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Failed to detect Windows version. Aborting." -Type "Error"
        return
    }
    
    # Step 2: Check WSL2 support
    Write-ColorMessage -Message "[$COMPONENT_ID] Step 2: Checking WSL2 support..." -Type "Info"
    $wsl2Supported = Test-WSL2Support -WindowsVersion $windowsVersion
    
    # Step 3: Check current WSL version
    Write-ColorMessage -Message "[$COMPONENT_ID] Step 3: Checking current WSL version..." -Type "Info"
    $currentWSLVersion = Get-WSLVersion
    
    # Step 4: Check if upgrade is required and handle it
    Write-ColorMessage -Message "[$COMPONENT_ID] Step 4: Checking if upgrade is required..." -Type "Info"
    $upgradeHandled = Invoke-WSLUpgradeProcessor -WindowsVersion $windowsVersion -CurrentWSLVersion $currentWSLVersion
    
    if ($upgradeHandled) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Upgrade process handled. Installation will continue after restart." -Type "Success"
        return
    }
    
    # Step 5: Check required Windows features
    Write-ColorMessage -Message "[$COMPONENT_ID] Step 5: Checking required Windows features..." -Type "Info"
    $featuresEnabled = Test-RequiredWindowsFeatures -WindowsVersion $windowsVersion
    
    # Step 6: Enable required features if needed
    if (-not $featuresEnabled) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Step 6: Enabling required Windows features..." -Type "Warning"
        if (-not (Enable-RequiredWindowsFeatures -WindowsVersion $windowsVersion)) {
            Write-ColorMessage -Message "[$COMPONENT_ID] Failed to enable required Windows features. Please restart and try again." -Type "Error"
            return
        }
    } else {
        Write-ColorMessage -Message "[$COMPONENT_ID] Step 6: All required Windows features are enabled." -Type "Success"
    }
    
    # Step 7: Handle WSL installation/upgrade
    Write-ColorMessage -Message "[$COMPONENT_ID] Step 7: Handling WSL installation/upgrade..." -Type "Info"
    
    if ($currentWSLVersion -eq "NotInstalled") {
        Write-ColorMessage -Message "[$COMPONENT_ID] WSL is not installed. Installing..." -Type "Warning"
        if (-not (Prompt-WSLInstall)) {
            return
        }
        
        # Install WSL based on system capabilities
        if ($wsl2Supported) {
            Write-ColorMessage -Message "[$COMPONENT_ID] Installing WSL2 (system supports it)..." -Type "Info"
            try {
                & wsl --install --no-launch
                $wslStatusAfterInstall = Get-WslStatusText
                if ("$wslStatusAfterInstall" -notmatch "not installed") {
                    Write-ColorMessage -Message "[$COMPONENT_ID] WSL2 installation completed." -Type "Success"
                } else {
                    Write-ColorMessage -Message "[$COMPONENT_ID] WSL2 installation failed, trying legacy method..." -Type "Warning"
                    & dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
                    & dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
                }
            } catch {
                Write-ColorMessage -Message "[$COMPONENT_ID] Error during WSL installation: $_" -Type "Error"
                return
            }
        } else {
            Write-ColorMessage -Message "[$COMPONENT_ID] Installing WSL1 (system doesn't support WSL2)..." -Type "Warning"
            try {
                & dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
                $wslFeatureState = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -ErrorAction SilentlyContinue
                if ($wslFeatureState -and $wslFeatureState.State -eq "Enabled") {
                    Write-ColorMessage -Message "[$COMPONENT_ID] WSL1 installation completed." -Type "Success"
                } else {
                    Write-ColorMessage -Message "[$COMPONENT_ID] WSL1 installation failed." -Type "Error"
                    return
                }
            } catch {
                Write-ColorMessage -Message "[$COMPONENT_ID] Error during WSL1 installation: $_" -Type "Error"
                return
            }
        }
        
        New-Item -ItemType File -Path $WSL_INSTALLED_FLAG -Force | Out-Null
        Write-ColorMessage -Message "[$COMPONENT_ID] WSL installation flag created." -Type "Success"
        
    } elseif ($currentWSLVersion -eq "WSL1" -and $wsl2Supported) {
        Write-ColorMessage -Message "[$COMPONENT_ID] WSL1 detected, upgrading to WSL2..." -Type "Warning"
        try {
            # Set WSL2 as default version
            Write-ColorMessage -Message "[$COMPONENT_ID] Setting WSL2 as default version..." -Type "Info"
            & wsl --set-default-version 2
            $wslStatusAfterDefault = Get-WslStatusText
            if (("$wslStatusAfterDefault").Contains('Default Version: 2')) {
                Write-ColorMessage -Message "[$COMPONENT_ID] WSL2 set as default version" -Type "Success"
            } else {
                Write-ColorMessage -Message "[$COMPONENT_ID] Failed to set WSL2 as default version" -Type "Error"
                return
            }
            
            # Convert existing distributions to WSL2
            $distributions = & wsl -l -q
            foreach ($distro in $distributions) {
                if ($distro -and $distro.Trim()) {
                    Write-ColorMessage -Message "[$COMPONENT_ID] Converting distribution '$distro' to WSL2..." -Type "Info"
                    & wsl --set-version $distro 2
                    $distroListAfter = & wsl --list --verbose 2>&1
                    if ("$distroListAfter" -match "$([regex]::Escape($distro.Trim())).*\b2\b") {
                        Write-ColorMessage -Message "[$COMPONENT_ID] Successfully converted '$distro' to WSL2" -Type "Success"
                    } else {
                        Write-ColorMessage -Message "[$COMPONENT_ID] Failed to convert '$distro' to WSL2" -Type "Warning"
                    }
                }
            }
        } catch {
            Write-ColorMessage -Message "[$COMPONENT_ID] Error during WSL1 to WSL2 upgrade: $_" -Type "Error"
            return
        }
    } else {
        Write-ColorMessage -Message "[$COMPONENT_ID] WSL is already installed and properly configured." -Type "Success"
    }

    Write-ColorMessage -Message "[$COMPONENT_ID] Checking installed WSL distributions..." -Type "Info"
    $wslList = & wsl --list --verbose
    Write-ColorMessage -Message "[$COMPONENT_ID] Current WSL distributions:" -Type "Info"
    Write-Host $wslList

    # Step 8: Configure default user to root for all Ubuntu/Debian distributions (always run, even if already installed)
    Write-ColorMessage -Message "[$COMPONENT_ID] Step 8: Configuring default user to root for Ubuntu/Debian distributions..." -Type "Info"
    
    $distros = & wsl -l -q 2>&1
    $linuxDistros = @()
    
    foreach ($distro in $distros) {
        if ($distro) {
            # Clean the string (remove null characters from UTF-16 encoding)
            $cleanDistro = $distro.ToString() -replace '\x00', ''
            $cleanDistro = $cleanDistro.Trim()
            
            # Check if it's an Ubuntu or Debian distribution
            if ($cleanDistro -match "Ubuntu|Debian" -and $cleanDistro -ne "" -and $cleanDistro -ne "NAME") {
                $linuxDistros += $cleanDistro
            }
        }
    }
    
    if ($linuxDistros.Count -gt 0) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Found Ubuntu/Debian distributions: $($linuxDistros -join ', ')" -Type "Info"
        
        foreach ($distroName in $linuxDistros) {
            Write-ColorMessage -Message "[$COMPONENT_ID] Checking default user for $distroName..." -Type "Info"

            try {
                # Merge [user] default=root; every other /etc/wsl.conf section (e.g. [boot] systemd=true) is kept.
                $wslConfResult = Set-WslConfKey -Distro $distroName -Section 'user' -Key 'default' -Value 'root' -Prefix "[$COMPONENT_ID]"
                if ($wslConfResult -eq 'unchanged') {
                    Write-ColorMessage -Message "[$COMPONENT_ID] Default user is already root for $distroName." -Type "Success"
                } elseif ($wslConfResult -eq 'changed') {
                    $script:ChangedWslConfDistros += $distroName
                    Write-ColorMessage -Message "[$COMPONENT_ID] Default user set to root for $distroName." -Type "Success"
                } else {
                    Write-ColorMessage -Message "[$COMPONENT_ID] Failed to set default user for $distroName." -Type "Warning"
                }
            } catch {
                Write-ColorMessage -Message "[$COMPONENT_ID] Error configuring $distroName : $_" -Type "Error"
            }
        }

        # Restart only the distros whose wsl.conf changed so the new default user applies.
        foreach ($distroName in $script:ChangedWslConfDistros) {
            Write-ColorMessage -Message "[$COMPONENT_ID] Terminating $distroName to apply the wsl.conf change..." -Type "Info"
            & wsl --terminate $distroName
        }
    } else {
        Write-ColorMessage -Message "[$COMPONENT_ID] No Ubuntu/Debian distributions found. Skipping user configuration." -Type "Info"
    }

    # Note: Debian distribution installation is handled by Wsl_Debian13.ps1
    # This script sets up WSL infrastructure (features, kernel, etc.) and configures existing distributions
    Write-ColorMessage -Message "[$COMPONENT_ID] WSL setup completed." -Type "Success"
    Write-ColorMessage -Message "[$COMPONENT_ID] Run Wsl_Debian13.ps1 to install Debian distribution." -Type "Info"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

Wsl_Install
