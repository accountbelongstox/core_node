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

param(
    [Parameter(Mandatory=$true)]
    [hashtable]$WindowsVersion,
    
    [Parameter(Mandatory=$true)]
    [string]$CurrentWSLVersion,
    
    [Parameter(Mandatory=$true)]
    [string]$Step80ScriptPath
)

# Declare all variables at the beginning
$ErrorActionPreference = "Stop"
$script:UpgradeRequired = $false
$script:RestartRequired = $false
$script:StartupScriptPath = ""
$script:StartupScriptName = "ContinueWSLInstallation.ps1"
$script:UpgradeStage = 0
$script:MaxUpgradeStages = 5
$script:UpgradeHistory = @()

# Import common functions
$scriptPath = Split-Path $MyInvocation.MyCommand.Path -Parent
$installPowershellsPath = Split-Path $scriptPath -Parent
$winShellsPath = Split-Path $installPowershellsPath -Parent
$winCommonPath = Join-Path $winShellsPath "win_common"
. (Join-Path $winCommonPath "GlobalVars.ps1")
. (Join-Path $winCommonPath "CommanFunc.ps1")

function Get-UpgradeStage {
    $upgradeStateFile = Join-Path $env:TEMP "wsl_upgrade_state.json"
    
    if (Test-Path $upgradeStateFile) {
        try {
            $stateContent = Get-Content $upgradeStateFile -Raw | ConvertFrom-Json
            $script:UpgradeStage = $stateContent.Stage
            $script:UpgradeHistory = $stateContent.History
            Write-ColorMessage -Message "[WSL Upgrade] Resuming from stage $($script:UpgradeStage)" -Type "Info"
            return $script:UpgradeStage
        } catch {
            Write-ColorMessage -Message "[WSL Upgrade] Error reading upgrade state: $_" -Type "Warning"
            $script:UpgradeStage = 0
            $script:UpgradeHistory = @()
        }
    } else {
        $script:UpgradeStage = 0
        $script:UpgradeHistory = @()
    }
    
    return $script:UpgradeStage
}

function Set-UpgradeStage {
    param(
        [int]$Stage,
        [string]$Action,
        [string]$Status
    )
    
    $script:UpgradeStage = $Stage
    $script:UpgradeHistory += @{
        Stage = $Stage
        Action = $Action
        Status = $Status
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }
    
    $upgradeStateFile = Join-Path $env:TEMP "wsl_upgrade_state.json"
    $stateObject = @{
        Stage = $script:UpgradeStage
        History = $script:UpgradeHistory
        LastUpdate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }
    
    try {
        $stateObject | ConvertTo-Json -Depth 3 | Set-Content $upgradeStateFile -Encoding UTF8
        Write-ColorMessage -Message "[WSL Upgrade] Stage $($Stage): $($Action) - $($Status)" -Type "Info"
    } catch {
        Write-ColorMessage -Message "[WSL Upgrade] Error saving upgrade state: $_" -Type "Warning"
    }
}

function Clear-UpgradeState {
    $upgradeStateFile = Join-Path $env:TEMP "wsl_upgrade_state.json"
    if (Test-Path $upgradeStateFile) {
        try {
            Remove-Item $upgradeStateFile -Force
            Write-ColorMessage -Message "[WSL Upgrade] Upgrade state cleared." -Type "Info"
        } catch {
            Write-ColorMessage -Message "[WSL Upgrade] Warning: Could not clear upgrade state: $_" -Type "Warning"
        }
    }
}

function Test-WSLFeatureEnabled {
    param([string]$FeatureName)
    
    try {
        $feature = Get-WindowsOptionalFeature -Online -FeatureName $FeatureName -ErrorAction SilentlyContinue
        if ($feature -and $feature.State -eq "Enabled") {
            return $true
        }
        return $false
    } catch {
        return $false
    }
}

function Enable-WSLFeature {
    param([string]$FeatureName)
    
    try {
        Write-ColorMessage -Message "[WSL Upgrade] Enabling Windows feature: $FeatureName" -Type "Info"
        Enable-WindowsOptionalFeature -Online -FeatureName $FeatureName -NoRestart -All
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "[WSL Upgrade] Successfully enabled feature: $FeatureName" -Type "Success"
            return $true
        } else {
            Write-ColorMessage -Message "[WSL Upgrade] Failed to enable feature: $FeatureName" -Type "Error"
            return $false
        }
    } catch {
        Write-ColorMessage -Message "[WSL Upgrade] Error enabling feature '$FeatureName': $_" -Type "Error"
        return $false
    }
}

function Get-WSLVersionInfo {
    try {
        $wslStatus = & wsl --status 2>&1
        if ($LASTEXITCODE -eq 0) {
            # Extract version information
            $versionInfo = @{
                IsInstalled = $true
                DefaultVersion = "Unknown"
                KernelVersion = "Unknown"
                WSLVersion = "Unknown"
            }
            
            if ($wslStatus -match "Default Version: (\d+)") {
                $versionInfo.DefaultVersion = $matches[1]
            }
            
            if ($wslStatus -match "WSL version: ([^\r\n]+)") {
                $versionInfo.WSLVersion = $matches[1].Trim()
            }
            
            if ($wslStatus -match "Default kernel version: ([^\r\n]+)") {
                $versionInfo.KernelVersion = $matches[1].Trim()
            }
            
            return $versionInfo
        } else {
            return @{
                IsInstalled = $false
                DefaultVersion = "NotInstalled"
                KernelVersion = "NotInstalled"
                WSLVersion = "NotInstalled"
            }
        }
    } catch {
        return @{
            IsInstalled = $false
            DefaultVersion = "NotInstalled"
            KernelVersion = "NotInstalled"
            WSLVersion = "NotInstalled"
        }
    }
}

function Test-WSLUpdateAvailable {
    try {
        Write-ColorMessage -Message "[WSL Upgrade] Checking for WSL updates..." -Type "Info"
        
        # Check if wsl --update is available and if there are updates
        $updateCheck = & wsl --update --dry-run 2>&1
        if ($LASTEXITCODE -eq 0) {
            if ($updateCheck -match "No updates available" -or $updateCheck -match "already up to date") {
                Write-ColorMessage -Message "[WSL Upgrade] WSL is already up to date." -Type "Success"
                return $false
            } else {
                Write-ColorMessage -Message "[WSL Upgrade] WSL updates are available." -Type "Warning"
                return $true
            }
        } else {
            # If --dry-run is not supported, try regular update check
            $updateCheck = & wsl --update 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-ColorMessage -Message "[WSL Upgrade] WSL update completed." -Type "Success"
                return $false
            } else {
                Write-ColorMessage -Message "[WSL Upgrade] WSL update failed or not available." -Type "Warning"
                return $true
            }
        }
    } catch {
        Write-ColorMessage -Message "[WSL Upgrade] Error checking WSL updates: $_" -Type "Warning"
        return $true
    }
}

function Test-UpgradeRequired {
    param(
        [hashtable]$WindowsVersion,
        [string]$CurrentWSLVersion
    )
    
    $script:UpgradeRequired = $false
    
    # Get detailed WSL version information
    $wslInfo = Get-WSLVersionInfo
    
    # Check if Windows version is too old for WSL2
    if ($WindowsVersion.IsWin10 -and $WindowsVersion.Build -lt 18362) {
        Write-ColorMessage -Message "[WSL Upgrade] Windows 10 build $($WindowsVersion.Build) is too old for WSL2. Upgrade required." -Type "Warning"
        $script:UpgradeRequired = $true
        return $true
    }
    
    # Check if WSL is not installed and system needs updates
    if ($CurrentWSLVersion -eq "NotInstalled" -or -not $wslInfo.IsInstalled) {
        Write-ColorMessage -Message "[WSL Upgrade] WSL is not installed. System may need updates." -Type "Warning"
        $script:UpgradeRequired = $true
        return $true
    }
    
    # Check if WSL1 is installed but system supports WSL2
    if ($CurrentWSLVersion -eq "WSL1" -and $WindowsVersion.IsWin10Build1903OrLater) {
        Write-ColorMessage -Message "[WSL Upgrade] WSL1 detected on WSL2-capable system. Upgrade required." -Type "Warning"
        $script:UpgradeRequired = $true
        return $true
    }
    
    # Check if WSL2 is installed but kernel is outdated
    if ($CurrentWSLVersion -eq "WSL2" -and $wslInfo.DefaultVersion -eq "2") {
        Write-ColorMessage -Message "[WSL Upgrade] WSL2 detected. Checking for kernel updates..." -Type "Info"
        if (Test-WSLUpdateAvailable) {
            Write-ColorMessage -Message "[WSL Upgrade] WSL2 kernel update required." -Type "Warning"
            $script:UpgradeRequired = $true
            return $true
        }
    }
    
    # Check if WSL version is unknown or corrupted
    if ($CurrentWSLVersion -eq "Unknown") {
        Write-ColorMessage -Message "[WSL Upgrade] WSL version is unknown. System may need updates." -Type "Warning"
        $script:UpgradeRequired = $true
        return $true
    }
    
    # Check if WSL is installed but features are not properly enabled
    if ($wslInfo.IsInstalled -and $wslInfo.DefaultVersion -eq "Unknown") {
        Write-ColorMessage -Message "[WSL Upgrade] WSL is installed but not properly configured. Update required." -Type "Warning"
        $script:UpgradeRequired = $true
        return $true
    }
    
    # Check for Windows 11 specific WSL requirements
    if ($WindowsVersion.IsWin11) {
        Write-ColorMessage -Message "[WSL Upgrade] Windows 11 detected. Checking WSL compatibility..." -Type "Info"
        if ($wslInfo.DefaultVersion -ne "2") {
            Write-ColorMessage -Message "[WSL Upgrade] Windows 11 requires WSL2. Upgrade required." -Type "Warning"
            $script:UpgradeRequired = $true
            return $true
        }
    }
    
    Write-ColorMessage -Message "[WSL Upgrade] No upgrade required." -Type "Success"
    return $false
}

function Update-WSLKernel {
    Write-ColorMessage -Message "[WSL Upgrade] Updating WSL kernel using wsl --update..." -Type "Info"
    
    try {
        # Try wsl --update first (preferred method for newer systems)
        Write-ColorMessage -Message "[WSL Upgrade] Running: wsl --update" -Type "Info"
        $updateResult = & wsl --update 2>&1
        $updateExitCode = $LASTEXITCODE
        
        if ($updateExitCode -eq 0) {
            Write-ColorMessage -Message "[WSL Upgrade] WSL kernel updated successfully using wsl --update." -Type "Success"
            Write-ColorMessage -Message "[WSL Upgrade] Update output: $updateResult" -Type "Info"
            return $true
        } else {
            Write-ColorMessage -Message "[WSL Upgrade] wsl --update failed with exit code: $updateExitCode" -Type "Warning"
            Write-ColorMessage -Message "[WSL Upgrade] Update output: $updateResult" -Type "Warning"
            return $false
        }
    } catch {
        Write-ColorMessage -Message "[WSL Upgrade] Error running wsl --update: $_" -Type "Error"
        return $false
    }
}

function Download-WSLUpdate {
    Write-ColorMessage -Message "[WSL Upgrade] Downloading WSL update package..." -Type "Info"
    
    try {
        # Try multiple download sources
        $downloadUrls = @(
            "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi",
            "https://github.com/microsoft/WSL/releases/latest/download/wsl_update_x64.msi"
        )
        
        $tempDir = $env:TEMP
        $wslUpdatePath = Join-Path $tempDir "wsl_update_x64.msi"
        
        foreach ($wslUpdateUrl in $downloadUrls) {
            try {
                Write-ColorMessage -Message "[WSL Upgrade] Trying to download from: $wslUpdateUrl" -Type "Info"
                Write-ColorMessage -Message "[WSL Upgrade] Saving to: $wslUpdatePath" -Type "Info"
                
                # Download WSL update
                Invoke-WebRequest -Uri $wslUpdateUrl -OutFile $wslUpdatePath -UseBasicParsing -TimeoutSec 30
                if (Test-Path $wslUpdatePath) {
                    $fileSize = (Get-Item $wslUpdatePath).Length
                    if ($fileSize -gt 1024) {  # Check if file is not empty
                        Write-ColorMessage -Message "[WSL Upgrade] WSL update package downloaded successfully from $wslUpdateUrl." -Type "Success"
                        Write-ColorMessage -Message "[WSL Upgrade] File size: $fileSize bytes" -Type "Info"
                        return $wslUpdatePath
                    } else {
                        Write-ColorMessage -Message "[WSL Upgrade] Downloaded file is too small, trying next source..." -Type "Warning"
                        Remove-Item $wslUpdatePath -Force -ErrorAction SilentlyContinue
                    }
                }
            } catch {
                Write-ColorMessage -Message "[WSL Upgrade] Failed to download from $wslUpdateUrl : $_" -Type "Warning"
                Remove-Item $wslUpdatePath -Force -ErrorAction SilentlyContinue
            }
        }
        
        Write-ColorMessage -Message "[WSL Upgrade] Failed to download WSL update package from all sources." -Type "Error"
        return $null
    } catch {
        Write-ColorMessage -Message "[WSL Upgrade] Error downloading WSL update: $_" -Type "Error"
        return $null
    }
}

function Install-WSLUpdate {
    param([string]$WSLUpdatePath)
    
    if (-not (Test-Path $WSLUpdatePath)) {
        Write-ColorMessage -Message "[WSL Upgrade] WSL update package not found: $WSLUpdatePath" -Type "Error"
        return $false
    }
    
    Write-ColorMessage -Message "[WSL Upgrade] Installing WSL update package..." -Type "Warning"
    
    try {
        # Install WSL update silently
        $installArgs = @(
            "/i", $WSLUpdatePath,
            "/quiet",
            "/norestart"
        )
        
        Write-ColorMessage -Message "[WSL Upgrade] Running: msiexec.exe $($installArgs -join ' ')" -Type "Info"
        $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $installArgs -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            Write-ColorMessage -Message "[WSL Upgrade] WSL update installed successfully." -Type "Success"
            return $true
        } else {
            Write-ColorMessage -Message "[WSL Upgrade] WSL update installation failed with exit code: $($process.ExitCode)" -Type "Error"
            return $false
        }
    } catch {
        Write-ColorMessage -Message "[WSL Upgrade] Error installing WSL update: $_" -Type "Error"
        return $false
    }
}

function Create-StartupScript {
    param([string]$Step80ScriptPath)
    
    Write-ColorMessage -Message "[WSL Upgrade] Creating startup script for post-restart installation..." -Type "Info"
    
    try {
        # Get startup directory
        $startupDir = [Environment]::GetFolderPath("Startup")
        $script:StartupScriptPath = Join-Path $startupDir $script:StartupScriptName
        
        # Create startup script content
        $startupScriptContent = @"
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

# Auto-generated startup script for WSL multi-stage installation continuation
# This script will be automatically deleted after successful installation

Write-Host "=== WSL Multi-Stage Installation Continuation ===" -ForegroundColor Cyan
Write-Host "System has been restarted after WSL upgrade stage." -ForegroundColor Green
Write-Host "Continuing WSL installation process..." -ForegroundColor Yellow
Write-Host ""

# Wait for system to stabilize
Start-Sleep -Seconds 15

# Check upgrade state
`$upgradeStateFile = Join-Path `$env:TEMP "wsl_upgrade_state.json"
if (Test-Path `$upgradeStateFile) {
    try {
        `$stateContent = Get-Content `$upgradeStateFile -Raw | ConvertFrom-Json
        Write-Host "Resuming WSL upgrade from stage: `$(`$stateContent.Stage)" -ForegroundColor Cyan
        Write-Host "Last action: `$(`$stateContent.History[-1].Action)" -ForegroundColor Cyan
    } catch {
        Write-Host "Could not read upgrade state file." -ForegroundColor Yellow
    }
}

# Prompt user to continue
Write-Host "Press Y to continue WSL installation, or any other key to skip:" -ForegroundColor Yellow -NoNewline
`$userInput = Read-Host
if (`$userInput -eq "Y" -or `$userInput -eq "y") {
    Write-Host "Continuing WSL installation..." -ForegroundColor Green
    
    # Execute Step80 script
    try {
        & "$Step80ScriptPath"
        `$exitCode = `$LASTEXITCODE
        
        if (`$exitCode -eq 0) {
            Write-Host "WSL installation completed successfully!" -ForegroundColor Green
            
            # Check if upgrade state should be cleared
            if (Test-Path `$upgradeStateFile) {
                try {
                    `$stateContent = Get-Content `$upgradeStateFile -Raw | ConvertFrom-Json
                    if (`$stateContent.Stage -ge 4) {
                        Write-Host "Clearing upgrade state file..." -ForegroundColor Cyan
                        Remove-Item `$upgradeStateFile -Force
                    }
                } catch {
                    Write-Host "Warning: Could not clear upgrade state file." -ForegroundColor Yellow
                }
            }
        } else {
            Write-Host "WSL installation failed with exit code: `$exitCode" -ForegroundColor Red
            Write-Host "Upgrade state preserved for debugging." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Error during WSL installation: `$_" -ForegroundColor Red
        Write-Host "Upgrade state preserved for debugging." -ForegroundColor Yellow
    }
} else {
    Write-Host "WSL installation skipped by user." -ForegroundColor Yellow
    Write-Host "Upgrade state preserved for manual continuation." -ForegroundColor Yellow
}

# Clean up: Remove this startup script
Write-Host "Cleaning up startup script..." -ForegroundColor Cyan
try {
    `$currentScriptPath = `$MyInvocation.MyCommand.Path
    if (Test-Path `$currentScriptPath) {
        Remove-Item `$currentScriptPath -Force
        Write-Host "Startup script removed successfully." -ForegroundColor Green
    }
} catch {
    Write-Host "Warning: Could not remove startup script: `$_" -ForegroundColor Yellow
}

Write-Host "=== WSL Installation Continuation Complete ===" -ForegroundColor Cyan
"@

        # Write startup script
        Set-Content -Path $script:StartupScriptPath -Value $startupScriptContent -Encoding UTF8
        
        if (Test-Path $script:StartupScriptPath) {
            Write-ColorMessage -Message "[WSL Upgrade] Startup script created: $script:StartupScriptPath" -Type "Success"
            return $true
        } else {
            Write-ColorMessage -Message "[WSL Upgrade] Failed to create startup script." -Type "Error"
            return $false
        }
    } catch {
        Write-ColorMessage -Message "[WSL Upgrade] Error creating startup script: $_" -Type "Error"
        return $false
    }
}

function Request-SystemRestart {
    Write-ColorMessage -Message "[WSL Upgrade] System restart is required to complete WSL upgrade." -Type "Warning"
    Write-ColorMessage -Message "[WSL Upgrade] A startup script has been created to continue installation after restart." -Type "Info"
    
    Write-Host ""
    Write-Host "=== RESTART REQUIRED ===" -ForegroundColor Red
    Write-Host "The system needs to be restarted to complete the WSL upgrade." -ForegroundColor Yellow
    Write-Host "After restart, the installation will continue automatically." -ForegroundColor Green
    Write-Host ""
    
    $restartChoice = Read-Host "Do you want to restart now? (Y/n)"
    if ($restartChoice -eq "Y" -or $restartChoice -eq "y" -or [string]::IsNullOrEmpty($restartChoice)) {
        Write-ColorMessage -Message "[WSL Upgrade] Restarting system in 10 seconds..." -Type "Warning"
        Write-ColorMessage -Message "[WSL Upgrade] Press Ctrl+C to cancel restart." -Type "Info"
        
        # Countdown
        for ($i = 10; $i -gt 0; $i--) {
            Write-Host "Restarting in $i seconds..." -ForegroundColor Yellow
            Start-Sleep -Seconds 1
        }
        
        # Restart system
        Restart-Computer -Force
    } else {
        Write-ColorMessage -Message "[WSL Upgrade] Restart cancelled by user." -Type "Warning"
        Write-ColorMessage -Message "[WSL Upgrade] Please restart manually when ready." -Type "Info"
    }
}

function Process-WSLUpgrade {
    param(
        [hashtable]$WindowsVersion,
        [string]$CurrentWSLVersion,
        [string]$Step80ScriptPath
    )
    
    Write-ColorMessage -Message "[WSL Upgrade] Starting multi-stage WSL upgrade process..." -Type "Info"
    
    # Get current upgrade stage
    $currentStage = Get-UpgradeStage
    
    # Get detailed WSL info
    $wslInfo = Get-WSLVersionInfo
    
    Write-ColorMessage -Message "[WSL Upgrade] Current stage: $currentStage" -Type "Info"
    Write-ColorMessage -Message "[WSL Upgrade] WSL Status: Installed=$($wslInfo.IsInstalled), Version=$($wslInfo.DefaultVersion)" -Type "Info"
    
    # Stage 0: Initial assessment and Windows feature enablement
    if ($currentStage -eq 0) {
        Write-ColorMessage -Message "[WSL Upgrade] Stage 0: Initial assessment and Windows feature enablement" -Type "Info"
        
        $restartNeeded = $false
        
        # Check and enable WSL feature
        if (-not (Test-WSLFeatureEnabled "Microsoft-Windows-Subsystem-Linux")) {
            Write-ColorMessage -Message "[WSL Upgrade] WSL feature not enabled. Enabling..." -Type "Warning"
            if (Enable-WSLFeature "Microsoft-Windows-Subsystem-Linux") {
                $restartNeeded = $true
                Set-UpgradeStage 0 "Enable WSL Feature" "Success"
            } else {
                Set-UpgradeStage 0 "Enable WSL Feature" "Failed"
                return $false
            }
        } else {
            Write-ColorMessage -Message "[WSL Upgrade] WSL feature is already enabled." -Type "Success"
        }
        
        # Check and enable Virtual Machine Platform (for WSL2)
        if ($WindowsVersion.IsWin10Build1903OrLater -and -not (Test-WSLFeatureEnabled "VirtualMachinePlatform")) {
            Write-ColorMessage -Message "[WSL Upgrade] Virtual Machine Platform not enabled. Enabling for WSL2..." -Type "Warning"
            if (Enable-WSLFeature "VirtualMachinePlatform") {
                $restartNeeded = $true
                Set-UpgradeStage 0 "Enable VMP Feature" "Success"
            } else {
                Set-UpgradeStage 0 "Enable VMP Feature" "Failed"
                return $false
            }
        } else {
            Write-ColorMessage -Message "[WSL Upgrade] Virtual Machine Platform is already enabled or not required." -Type "Success"
        }
        
        if ($restartNeeded) {
            Write-ColorMessage -Message "[WSL Upgrade] Stage 0 completed. Restart required for feature changes." -Type "Warning"
            Set-UpgradeStage 1 "Restart for Features" "Pending"
            Create-StartupScript -Step80ScriptPath $Step80ScriptPath
            Request-SystemRestart
            return $true
        } else {
            Write-ColorMessage -Message "[WSL Upgrade] Stage 0 completed. No restart needed. Continuing to stage 1." -Type "Success"
            Set-UpgradeStage 1 "Feature Check" "Complete"
            # Continue to stage 1 without returning
        }
    }
    
    # Stage 1: Install or update WSL
    if ($currentStage -eq 1) {
        Write-ColorMessage -Message "[WSL Upgrade] Stage 1: Install or update WSL" -Type "Info"
        
        if (-not $wslInfo.IsInstalled) {
            Write-ColorMessage -Message "[WSL Upgrade] WSL not installed. Installing..." -Type "Warning"
            
            # Try wsl --install first
            try {
                & wsl --install --no-distribution
                if ($LASTEXITCODE -eq 0) {
                    Write-ColorMessage -Message "[WSL Upgrade] WSL installed successfully using wsl --install." -Type "Success"
                    Set-UpgradeStage 2 "Install WSL" "Success"
                } else {
                    throw "wsl --install failed"
                }
            } catch {
                Write-ColorMessage -Message "[WSL Upgrade] wsl --install failed. Trying MSI installation..." -Type "Warning"
                
                # Fallback to MSI installation
                $wslUpdatePath = Download-WSLUpdate
                if ($wslUpdatePath -and (Install-WSLUpdate -WSLUpdatePath $wslUpdatePath)) {
                    Write-ColorMessage -Message "[WSL Upgrade] WSL installed successfully using MSI." -Type "Success"
                    Set-UpgradeStage 2 "Install WSL MSI" "Success"
                    
                    # Clean up
                    Remove-Item $wslUpdatePath -Force -ErrorAction SilentlyContinue
                } else {
                    Write-ColorMessage -Message "[WSL Upgrade] Failed to install WSL." -Type "Error"
                    Set-UpgradeStage 1 "Install WSL" "Failed"
                    return $false
                }
            }
        } else {
            Write-ColorMessage -Message "[WSL Upgrade] WSL is already installed." -Type "Success"
            Set-UpgradeStage 2 "WSL Check" "Complete"
            # Continue to stage 2 without returning
        }
    }
    
    # Stage 2: Upgrade to WSL2 if needed
    if ($currentStage -eq 2) {
        Write-ColorMessage -Message "[WSL Upgrade] Stage 2: Upgrade to WSL2 if needed" -Type "Info"
        
        $wslInfo = Get-WSLVersionInfo
        
        if ($wslInfo.DefaultVersion -eq "1" -and $WindowsVersion.IsWin10Build1903OrLater) {
            Write-ColorMessage -Message "[WSL Upgrade] WSL1 detected on WSL2-capable system. Upgrading..." -Type "Warning"
            
            # Set WSL2 as default
            try {
                & wsl --set-default-version 2
                if ($LASTEXITCODE -eq 0) {
                    Write-ColorMessage -Message "[WSL Upgrade] WSL2 set as default version." -Type "Success"
                    
                    # Convert existing distributions
                    $distributions = & wsl -l -q
                    foreach ($distro in $distributions) {
                        if ($distro -and $distro.Trim()) {
                            Write-ColorMessage -Message "[WSL Upgrade] Converting '$distro' to WSL2..." -Type "Info"
                            & wsl --set-version $distro 2
                        }
                    }
                    
                    Set-UpgradeStage 3 "Upgrade to WSL2" "Success"
                } else {
                    Write-ColorMessage -Message "[WSL Upgrade] Failed to set WSL2 as default." -Type "Error"
                    Set-UpgradeStage 2 "Upgrade to WSL2" "Failed"
                    return $false
                }
            } catch {
                Write-ColorMessage -Message "[WSL Upgrade] Error upgrading to WSL2: $_" -Type "Error"
                Set-UpgradeStage 2 "Upgrade to WSL2" "Failed"
                return $false
            }
        } else {
            Write-ColorMessage -Message "[WSL Upgrade] WSL2 is already the default or not supported." -Type "Success"
            Set-UpgradeStage 3 "WSL2 Check" "Complete"
            # Continue to stage 3 without returning
        }
    }
    
    # Stage 3: Update WSL2 kernel
    if ($currentStage -eq 3) {
        Write-ColorMessage -Message "[WSL Upgrade] Stage 3: Update WSL2 kernel" -Type "Info"
        
        $wslInfo = Get-WSLVersionInfo
        
        if ($wslInfo.DefaultVersion -eq "2") {
            Write-ColorMessage -Message "[WSL Upgrade] WSL2 detected. Checking for kernel updates..." -Type "Info"
            
            if (Update-WSLKernel) {
                Write-ColorMessage -Message "[WSL Upgrade] WSL2 kernel updated successfully." -Type "Success"
                Set-UpgradeStage 4 "Update WSL2 Kernel" "Success"
            } else {
                Write-ColorMessage -Message "[WSL Upgrade] WSL2 kernel update failed or not needed." -Type "Warning"
                Set-UpgradeStage 4 "Update WSL2 Kernel" "Skipped"
            }
        } else {
            Write-ColorMessage -Message "[WSL Upgrade] WSL2 not available. Skipping kernel update." -Type "Info"
            Set-UpgradeStage 4 "Update WSL2 Kernel" "Skipped"
            # Continue to stage 4 without returning
        }
    }
    
    # Stage 4: Final verification and cleanup
    if ($currentStage -eq 4) {
        Write-ColorMessage -Message "[WSL Upgrade] Stage 4: Final verification and cleanup" -Type "Info"
        
        $wslInfo = Get-WSLVersionInfo
        
        if ($wslInfo.IsInstalled) {
            Write-ColorMessage -Message "[WSL Upgrade] WSL upgrade completed successfully!" -Type "Success"
            Write-ColorMessage -Message "[WSL Upgrade] Final status: Version=$($wslInfo.DefaultVersion), WSL=$($wslInfo.WSLVersion)" -Type "Info"
            
            # Clear upgrade state
            Clear-UpgradeState
            Set-UpgradeStage 5 "Final Verification" "Complete"
            
            return $false  # Return false to continue with normal installation
        } else {
            Write-ColorMessage -Message "[WSL Upgrade] WSL upgrade failed. WSL is not properly installed." -Type "Error"
            Set-UpgradeStage 4 "Final Verification" "Failed"
            return $false
        }
    }
    
    # If we reach here, we're in an unexpected stage
    Write-ColorMessage -Message "[WSL Upgrade] Unexpected upgrade stage: $currentStage" -Type "Error"
    return $false
}

# Main execution
try {
    $upgradeProcessed = Process-WSLUpgrade -WindowsVersion $WindowsVersion -CurrentWSLVersion $CurrentWSLVersion -Step80ScriptPath $Step80ScriptPath
    
    if ($upgradeProcessed) {
        Write-ColorMessage -Message "[WSL Upgrade] Upgrade process completed. System restart initiated." -Type "Success"
        exit 0
    } else {
        Write-ColorMessage -Message "[WSL Upgrade] No upgrade required. Continuing with normal installation." -Type "Info"
        exit 1
    }
} catch {
    Write-ColorMessage -Message "[WSL Upgrade] Error during upgrade process: $_" -Type "Error"
    exit 1
}
