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
    [Parameter()] [string]$Action = "install"
)

if ($Action -eq "Global" -or $Action -eq "China") {
    $Action = "install"
}

#region Variable Declarations
$script:WIN_COMMON_DIR = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common"
. (Join-Path $script:WIN_COMMON_DIR "GlobalVars.ps1")
. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")

$script:STEP_NUMBER = 85
$script:UBUNTU_VERSION = $Global:UBUNTU_VERSION
$script:UBUNTU_DISTRO_NAME = "Ubuntu-$script:UBUNTU_VERSION"
$script:UBUNTU_WSL_URL = $Global:UBUNTU_WSL_DOWNLOAD_URL
$script:UBUNTU_WSL_FILENAME = $Global:UBUNTU_WSL_FILENAME
$script:UBUNTU_WSL_LOCAL_PATH = $Global:UBUNTU_WSL_LOCAL_PATH
$script:WSL2_KERNEL_URL = $Global:WSL2_KERNEL_UPDATE_URL
$script:WSL2_KERNEL_FILENAME = $Global:WSL2_KERNEL_FILENAME
$script:WSL2_KERNEL_LOCAL_PATH = $Global:WSL2_KERNEL_LOCAL_PATH
#endregion

#region Helper Functions
function Write-StepMessage {
    param(
        [Parameter(Mandatory=$true)] [string]$Message,
        [Parameter()] [string]$Type = "Info"
    )
    
    $prefix = "[Step $script:STEP_NUMBER] "
    
    switch ($Type) {
        "Success" { Write-Host -ForegroundColor Green "$prefix$Message" }
        "Warning" { Write-Host -ForegroundColor Yellow "$prefix$Message" }
        "Error" { Write-Host -ForegroundColor Red "$prefix$Message" }
        default { Write-Host -ForegroundColor White "$prefix$Message" }
    }
}

function Test-WSL2Version {
    $separatorIndex = -1
    $versionValue = ''
    Write-StepMessage -Message "Testing WSL2 version..." -Type "Info"

    try {
        # Test basic WSL command
        $wslVersionOutput = & wsl --version 2>&1

        # Check if output contains WSL version info
        $outputString = $wslVersionOutput -join " "
        if ($outputString -like "*WSL version*") {
            Write-StepMessage -Message "WSL2 is properly installed and working" -Type "Success"

            # Try to extract version number
            foreach ($line in $wslVersionOutput) {
                if ($line -like "*WSL version*") {
                    $versionLine = $line.ToString().Trim()
                    $separatorIndex = $versionLine.IndexOf(':')
                    if ($separatorIndex -ge 0) {
                        $versionValue = $versionLine.Substring($separatorIndex + 1).Trim()
                        Write-StepMessage -Message "WSL version: $versionValue" -Type "Info"
                    }
                    break
                }
            }

            return $true
        } else {
            Write-StepMessage -Message "WSL command succeeded but no version info found" -Type "Warning"
        }
    } catch {
        Write-StepMessage -Message "WSL2 version check failed: $_" -Type "Warning"
    }

    # Try alternative check - test if WSL2 is available
    try {
        Write-StepMessage -Message "Trying alternative WSL check..." -Type "Info"
        $wslListOutput = & wsl --list --verbose 2>&1
        if ("$wslListOutput" -match '(?m)^\s*\*?\s*\S') {
            Write-StepMessage -Message "WSL is available and working" -Type "Success"
            return $true
        } else {
            Write-StepMessage -Message "WSL list command returned no distributions" -Type "Warning"
        }
    } catch {
        Write-StepMessage -Message "WSL list command also failed: $_" -Type "Warning"
    }

    return $false
}

function Install-WSL2Prerequisites {
    Write-StepMessage -Message "Installing WSL2 prerequisites..." -Type "Info"
    
    # Enable WSL feature
    Write-StepMessage -Message "Enabling Windows Subsystem for Linux feature..." -Type "Info"
    try {
        & dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
        & dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
        Write-StepMessage -Message "WSL features enabled successfully" -Type "Success"
    } catch {
        Write-StepMessage -Message "Failed to enable WSL features: $_" -Type "Error"
        return $false
    }
    
    # Download and install WSL2 kernel update
    Write-StepMessage -Message "Checking for WSL2 kernel update..." -Type "Info"

    if (-not (Test-Path $script:WSL2_KERNEL_LOCAL_PATH)) {
        # Check Downloads directory first
        $downloadsDir = Join-Path $env:USERPROFILE "Downloads"
        if (Test-Path $downloadsDir) {
            $downloadedKernels = @(Get-ChildItem -Path $downloadsDir -Filter "*wsl*update*.msi" -File)

            if ($downloadedKernels.Count -gt 0) {
                $downloadedKernel = $downloadedKernels | Sort-Object LastWriteTime -Descending | Select-Object -First 1
                Write-StepMessage -Message "Found WSL2 kernel update in Downloads: $($downloadedKernel.Name)" -Type "Success"
                try {
                    Copy-Item $downloadedKernel.FullName $script:WSL2_KERNEL_LOCAL_PATH -Force
                    Write-StepMessage -Message "Copied WSL2 kernel update to temp directory" -Type "Success"
                } catch {
                    Write-StepMessage -Message "Failed to copy WSL2 kernel update: $_" -Type "Warning"
                }
            } else {
                Write-StepMessage -Message "No WSL2 kernel updates found in Downloads directory" -Type "Info"
            }
        }

        # If still not found, download it
        if (-not (Test-Path $script:WSL2_KERNEL_LOCAL_PATH)) {
            Write-StepMessage -Message "Downloading WSL2 kernel update from: $script:WSL2_KERNEL_URL" -Type "Info"
            try {
                Invoke-WebRequest -Uri $script:WSL2_KERNEL_URL -OutFile $script:WSL2_KERNEL_LOCAL_PATH -UseBasicParsing
                Write-StepMessage -Message "WSL2 kernel update downloaded successfully" -Type "Success"
            } catch {
                Write-StepMessage -Message "Failed to download WSL2 kernel update: $_" -Type "Error"
                Write-StepMessage -Message "Please download manually from: $script:WSL2_KERNEL_URL" -Type "Warning"

                # Open download page
                try {
                    Start-Process $script:WSL2_KERNEL_URL
                    Write-StepMessage -Message "Opened download page in browser" -Type "Info"
                } catch {
                    Write-StepMessage -Message "Failed to open download page" -Type "Warning"
                }

                return $false
            }
        }
    } else {
        Write-StepMessage -Message "WSL2 kernel update already exists locally" -Type "Success"
    }
    
    # Install WSL2 kernel update
    Write-StepMessage -Message "Installing WSL2 kernel update..." -Type "Info"
    try {
        Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", $script:WSL2_KERNEL_LOCAL_PATH, "/quiet" -Wait
        Write-StepMessage -Message "WSL2 kernel update installed successfully" -Type "Success"
    } catch {
        Write-StepMessage -Message "Failed to install WSL2 kernel update: $_" -Type "Error"
        return $false
    }
    
    # Set WSL2 as default version
    Write-StepMessage -Message "Setting WSL2 as default version..." -Type "Info"
    try {
        & wsl --set-default-version 2
        Write-StepMessage -Message "WSL2 set as default version" -Type "Success"
    } catch {
        Write-StepMessage -Message "Failed to set WSL2 as default: $_" -Type "Warning"
    }
    
    return $true
}

function Test-UbuntuDownload {
    Write-StepMessage -Message "Testing Ubuntu download availability..." -Type "Info"
    
    try {
        $response = Invoke-WebRequest -Uri $script:UBUNTU_WSL_URL -Method Head -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-StepMessage -Message "Ubuntu download is available" -Type "Success"
            return $true
        }
    } catch {
        Write-StepMessage -Message "Ubuntu download test failed: $_" -Type "Warning"
    }
    
    return $false
}

function Get-UbuntuWSLFile {
    Write-StepMessage -Message "Getting Ubuntu WSL file..." -Type "Info"

    # Check Downloads directory first (fuzzy search)
    $downloadsDir = Join-Path $env:USERPROFILE "Downloads"
    if (Test-Path $downloadsDir) {
        Write-StepMessage -Message "Searching Downloads directory for Ubuntu WSL file..." -Type "Info"
        $downloadedFiles = @(Get-ChildItem -Path $downloadsDir -Filter "*ubuntu*24*wsl*" -File | Where-Object { $_.Length -gt 100MB })

        if ($downloadedFiles.Count -gt 0) {
            $foundFile = $downloadedFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            Write-StepMessage -Message "Found Ubuntu WSL file in Downloads: $($foundFile.Name)" -Type "Success"

            # Copy to temp directory for consistency
            try {
                Copy-Item $foundFile.FullName $script:UBUNTU_WSL_LOCAL_PATH -Force
                Write-StepMessage -Message "Copied Ubuntu WSL file to temp directory" -Type "Success"
                return $script:UBUNTU_WSL_LOCAL_PATH
            } catch {
                Write-StepMessage -Message "Failed to copy file from Downloads: $_" -Type "Warning"
            }
        } else {
            Write-StepMessage -Message "No Ubuntu WSL files found in Downloads directory" -Type "Info"
        }
    }

    # Check if file already exists in temp directory
    if (Test-Path $script:UBUNTU_WSL_LOCAL_PATH) {
        $fileSize = (Get-Item $script:UBUNTU_WSL_LOCAL_PATH).Length
        if ($fileSize -gt 100MB) {
            Write-StepMessage -Message "Ubuntu WSL file already exists in temp directory and appears valid" -Type "Success"
            return $script:UBUNTU_WSL_LOCAL_PATH
        } else {
            Write-StepMessage -Message "Local Ubuntu WSL file appears corrupted, removing..." -Type "Warning"
            Remove-Item $script:UBUNTU_WSL_LOCAL_PATH -Force
        }
    }
    
    # Prompt user for static package download (default Y with 10s timeout)
    Write-StepMessage -Message "Do you want to download Ubuntu WSL static package? [Y/n] (Auto-continue in 10 seconds with 'Y')" -Type "Warning"
    Write-StepMessage -Message "Static package URL: $script:UBUNTU_WSL_URL" -Type "Info"
    
    $useStaticPackage = $true
    $timeout = 10
    $startTime = Get-Date
    $endTime = $startTime.AddSeconds($timeout)
    
    while ((Get-Date) -lt $endTime) {
        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)
            $char = $key.KeyChar.ToString().ToUpper()
            
            if ($char -eq "N") {
                Write-Host ""
                $useStaticPackage = $false
                Write-StepMessage -Message "Using native WSL installation method instead" -Type "Info"
                break
            } elseif ($char -eq "Y" -or $key.Key -eq [ConsoleKey]::Enter) {
                Write-Host ""
                break
            }
        }
        Start-Sleep -Milliseconds 100
    }
    
    if (-not $useStaticPackage) {
        return $null
    }
    
    Write-StepMessage -Message "Using static package download method" -Type "Info"
    
    # Test download availability
    if (Test-UbuntuDownload) {
        Write-StepMessage -Message "Downloading Ubuntu WSL from: $script:UBUNTU_WSL_URL" -Type "Info"
        try {
            # Create temp directory if it doesn't exist
            if (-not (Test-Path $Global:TEMP_DIR)) {
                New-Item -ItemType Directory -Path $Global:TEMP_DIR -Force | Out-Null
            }
            
            Invoke-WebRequest -Uri $script:UBUNTU_WSL_URL -OutFile $script:UBUNTU_WSL_LOCAL_PATH -UseBasicParsing
            Write-StepMessage -Message "Ubuntu WSL downloaded successfully" -Type "Success"
            return $script:UBUNTU_WSL_LOCAL_PATH
        } catch {
            Write-StepMessage -Message "Failed to download Ubuntu WSL: $_" -Type "Error"
        }
    }
    
    # Fallback to native WSL installation
    Write-StepMessage -Message "Download failed, using WSL2 native installation method" -Type "Warning"
    return $null
}

function Install-UbuntuWSL {
    param(
        [string]$WSLFilePath
    )
    
    Write-StepMessage -Message "Installing Ubuntu WSL..." -Type "Info"
    
    if ($WSLFilePath -and (Test-Path $WSLFilePath)) {
        # Install from downloaded file
        Write-StepMessage -Message "Installing from downloaded file: $WSLFilePath" -Type "Info"
        try {
            # Ensure WSL disk directory exists
            if (-not (Test-Path $Global:WSL_UBUNTU_DISK_DIR)) {
                New-Item -ItemType Directory -Path $Global:WSL_UBUNTU_DISK_DIR -Force | Out-Null
                Write-StepMessage -Message "Created WSL Ubuntu disk directory: $Global:WSL_UBUNTU_DISK_DIR" -Type "Info"
            }
            
            & wsl --import $script:UBUNTU_DISTRO_NAME $Global:WSL_UBUNTU_DISK_DIR $WSLFilePath
            $wslListAfterImport = & wsl --list --verbose 2>&1
            if (("$wslListAfterImport" -match [regex]::Escape($script:UBUNTU_DISTRO_NAME)) -and (Test-Path $Global:WSL_UBUNTU_DISK_DIR)) {
                Write-StepMessage -Message "Ubuntu installed successfully from downloaded file to: $Global:WSL_UBUNTU_DISK_DIR" -Type "Success"
                return $true
            }
        } catch {
            Write-StepMessage -Message "Failed to install from downloaded file: $_" -Type "Error"
        }
    }
    
    # Fallback to native installation
    Write-StepMessage -Message "Using WSL2 native installation method..." -Type "Info"
    try {
        & wsl --install -d Ubuntu-24.04
        $wslListAfterInstall = & wsl --list --verbose 2>&1
        if (("$wslListAfterInstall").Contains('Ubuntu-24.04') -or ("$wslListAfterInstall").Contains('Ubuntu 24.04')) {
            Write-StepMessage -Message "Ubuntu installed successfully using native method" -Type "Success"
            return $true
        }
    } catch {
        Write-StepMessage -Message "Failed to install using native method: $_" -Type "Error"
    }
    
    return $false
}

function Restart-UbuntuWSL {
    Write-StepMessage -Message "Restarting Ubuntu WSL..." -Type "Info"

    # Get all Ubuntu 24 distributions
    $ubuntu24Distros = @(Get-InstalledUbuntu24Distros)

    if (-not $ubuntu24Distros -or $ubuntu24Distros.Count -eq 0) {
        Write-StepMessage -Message "No Ubuntu 24 distributions found to restart" -Type "Error"
        return $false
    }

    $allRestarted = $true

    foreach ($distroName in $ubuntu24Distros) {
        try {
            Write-StepMessage -Message "Processing: $distroName" -Type "Info"

            # Check if this distro is running
            $runningDistros = & wsl --list --running 2>&1
            $isRunning = $false

            foreach ($runningLine in $runningDistros) {
                if ($runningLine -match [regex]::Escape($distroName)) {
                    $isRunning = $true
                    break
                }
            }

            if ($isRunning) {
                Write-Host "  -> $distroName is currently running" -ForegroundColor Yellow
                Write-Host "  -> Stopping $distroName..." -ForegroundColor Yellow
                & wsl --terminate $distroName

                # Wait and verify shutdown
                Write-Host "  -> Waiting for clean shutdown..." -ForegroundColor Yellow
                Start-Sleep -Seconds 3

                # Verify it's stopped
                $verifyOutput = & wsl --list --verbose 2>&1
                $isStopped = $false
                foreach ($line in $verifyOutput) {
                    $cleanLine = $line.ToString() -replace '\x00', '' | ForEach-Object { $_.Trim() }
                    if ($cleanLine.IndexOf($distroName) -ge 0 -and $cleanLine.IndexOf("Stopped") -ge 0) {
                        $isStopped = $true
                        break
                    }
                }

                if ($isStopped) {
                    Write-Host "  -> Confirmed: $distroName is stopped" -ForegroundColor Green
                } else {
                    Write-Host "  -> Warning: $distroName may still be running" -ForegroundColor Yellow
                }
            } else {
                Write-Host "  -> $distroName was not running" -ForegroundColor Cyan
            }

            # Start the distro
            Write-Host "  -> Starting $distroName..." -ForegroundColor Yellow
            & wsl -d $distroName echo "Ubuntu WSL started successfully" 2>&1 | Out-Null

            # Verify it's running
            Write-Host "  -> Verifying startup..." -ForegroundColor Yellow
            Start-Sleep -Seconds 2
            $verifyOutput = & wsl --list --verbose 2>&1
            $isRunning = $false
            foreach ($line in $verifyOutput) {
                $cleanLine = $line.ToString() -replace '\x00', '' | ForEach-Object { $_.Trim() }
                if ($cleanLine.IndexOf($distroName) -ge 0 -and $cleanLine.IndexOf("Running") -ge 0) {
                    $isRunning = $true
                    break
                }
            }

            if ($isRunning) {
                Write-Host "  -> Confirmed: $distroName is running" -ForegroundColor Green
                Write-StepMessage -Message "$distroName restarted successfully" -Type "Success"
            } else {
                Write-Host "  -> Warning: $distroName may not be running properly" -ForegroundColor Yellow
                Write-StepMessage -Message "Failed to start $distroName" -Type "Error"
                $allRestarted = $false
            }

            Write-Host "" # Add blank line between distributions

        } catch {
            Write-StepMessage -Message "Failed to restart $distroName : $_" -Type "Error"
            $allRestarted = $false
        }
    }

    if ($allRestarted) {
        Write-StepMessage -Message "All Ubuntu 24 distributions restarted successfully" -Type "Success"
    }

    return $allRestarted
}

function Get-InstalledUbuntu24Distros {
    Write-StepMessage -Message "Detecting installed Ubuntu 24 distributions..." -Type "Info"

    try {
        $wslList = & wsl --list 2>&1
        if ("$wslList" -match '(?m)^\s*\*?\s*\S') {
            $ubuntu24Distros = @()
            foreach ($line in $wslList) {
                # Convert to string and handle UTF-16 encoding issues
                $lineStr = $line.ToString()

                # Remove null characters and trim
                $cleanLine = $lineStr -replace '\x00', '' | ForEach-Object { $_.Trim() }

                # Match various Ubuntu 24 naming patterns
                if ($cleanLine.IndexOf("Ubuntu") -ge 0 -and $cleanLine.IndexOf("24") -ge 0) {
                    # Extract just the distribution name (first word)
                    $distroName = ($cleanLine -split '\s+')[0]
                    if ($distroName -and $distroName -ne "" -and $distroName -ne "NAME") {
                        $ubuntu24Distros += $distroName
                        Write-StepMessage -Message "Found Ubuntu 24 distribution: $distroName" -Type "Info"
                    }
                }
            }
            return ,$ubuntu24Distros  # Force return as array
        }
    } catch {
        Write-StepMessage -Message "Error checking installed distros: $_" -Type "Warning"
    }

    return @()
}

function Uninstall-UbuntuWSL {
    Write-StepMessage -Message "Uninstalling existing Ubuntu WSL..." -Type "Warning"

    # Get all Ubuntu 24 distributions
    $ubuntu24Distros = @(Get-InstalledUbuntu24Distros)

    if (-not $ubuntu24Distros -or $ubuntu24Distros.Count -eq 0) {
        Write-StepMessage -Message "No Ubuntu 24 distributions found to uninstall" -Type "Info"
        return $true
    }

    $allUninstalled = $true

    foreach ($distroName in $ubuntu24Distros) {
        try {
            Write-StepMessage -Message "Uninstalling: $distroName" -Type "Warning"

            # Stop the distro if running
            & wsl --terminate $distroName 2>$null
            Start-Sleep -Seconds 2

            # Unregister the distro
            & wsl --unregister $distroName
            $wslListAfterUnregister = & wsl --list --verbose 2>&1
            if ("$wslListAfterUnregister" -notmatch [regex]::Escape($distroName)) {
                Write-StepMessage -Message "Successfully uninstalled: $distroName" -Type "Success"
            } else {
                Write-StepMessage -Message "Failed to uninstall: $distroName" -Type "Error"
                $allUninstalled = $false
            }
        } catch {
            Write-StepMessage -Message "Failed to uninstall $distroName : $_" -Type "Error"
            $allUninstalled = $false
        }
    }

    if ($allUninstalled) {
        Write-StepMessage -Message "All Ubuntu 24 distributions uninstalled successfully" -Type "Success"
    }

    return $allUninstalled
}

function Wait-ForRestart {
    Write-StepMessage -Message "WSL2 installation may require a system restart to complete" -Type "Warning"
    Write-StepMessage -Message "Please restart your computer manually when convenient" -Type "Info"
    Write-StepMessage -Message "After restart, run this script again to continue the installation" -Type "Info"
    Write-StepMessage -Message "The script will NOT automatically restart your computer" -Type "Info"

    Write-Host ""
    Write-StepMessage -Message "Press Enter to continue (manual restart required)..." -Type "Warning"
    Read-Host
}
#endregion

#region Main Execution Logic
function Invoke-WSLUbuntuAction {
    param(
        [Parameter(Mandatory=$true)] [string]$ActionType
    )

    Write-StepMessage -Message "Starting WSL Ubuntu 24 action: $ActionType" -Type "Info"

    switch ($ActionType.ToLower()) {
        "install" {
            # 1. Test WSL2 version
            if (-not (Test-WSL2Version)) {
                Write-StepMessage -Message "WSL2 not properly installed, installing prerequisites..." -Type "Warning"
                if (-not (Install-WSL2Prerequisites)) {
                    Write-StepMessage -Message "Failed to install WSL2 prerequisites" -Type "Error"
                    Wait-ForRestart
                    return $false
                }

                # Re-test WSL2 after installation
                Write-StepMessage -Message "Re-testing WSL2 after prerequisites installation..." -Type "Info"
                if (-not (Test-WSL2Version)) {
                    Write-StepMessage -Message "WSL2 installation may require system restart to complete" -Type "Warning"
                    Write-StepMessage -Message "However, you can try to continue installation first" -Type "Info"

                    $continueChoice = Read-Host "Continue with Ubuntu installation anyway? (y/n)"
                    if ($continueChoice -ne "y" -and $continueChoice -ne "Y") {
                        Wait-ForRestart
                        return $false
                    }
                    Write-StepMessage -Message "Continuing with Ubuntu installation..." -Type "Info"
                }
            }

            # 2. Check if Ubuntu 24 is already installed
            $ubuntu24Distros = @(Get-InstalledUbuntu24Distros)
            if ($ubuntu24Distros -and $ubuntu24Distros.Count -gt 0) {
                Write-StepMessage -Message "Ubuntu 24 is already installed:" -Type "Success"
                foreach ($distro in $ubuntu24Distros) {
                    if ($distro -and $distro.Trim() -ne "") {
                        Write-StepMessage -Message "  - $distro" -Type "Info"
                    }
                }
                Write-StepMessage -Message "Use 'reinstall' action to reinstall or 'restart' to restart" -Type "Info"
                return $true
            }

            # 3. Get Ubuntu WSL file
            $ubuntuFile = Get-UbuntuWSLFile

            # 4. Install Ubuntu
            if (Install-UbuntuWSL -WSLFilePath $ubuntuFile) {
                Write-StepMessage -Message "Ubuntu 24.04 installation completed successfully" -Type "Success"
                return $true
            } else {
                Write-StepMessage -Message "Ubuntu 24.04 installation failed" -Type "Error"
                return $false
            }
        }

        "reinstall" {
            # 1. Uninstall existing Ubuntu
            if (-not (Uninstall-UbuntuWSL)) {
                Write-StepMessage -Message "Failed to uninstall existing Ubuntu" -Type "Error"
                return $false
            }

            # 2. Get Ubuntu WSL file (prefer local cache)
            $ubuntuFile = Get-UbuntuWSLFile

            # 3. Install Ubuntu
            if (Install-UbuntuWSL -WSLFilePath $ubuntuFile) {
                Write-StepMessage -Message "Ubuntu 24.04 reinstallation completed successfully" -Type "Success"
                return $true
            } else {
                Write-StepMessage -Message "Ubuntu 24.04 reinstallation failed" -Type "Error"
                return $false
            }
        }

        "restart" {
            if (Restart-UbuntuWSL) {
                Write-StepMessage -Message "Ubuntu 24.04 restart completed successfully" -Type "Success"
                return $true
            } else {
                Write-StepMessage -Message "Ubuntu 24.04 restart failed" -Type "Error"
                return $false
            }
        }

        default {
            Write-StepMessage -Message "Invalid action: $ActionType. Valid actions: install, reinstall, restart" -Type "Error"
            return $false
        }
    }
}

# Main execution
try {
    Invoke-WSLUbuntuAction -ActionType $Action
} catch {
    Write-StepMessage -Message "An error occurred during execution: $_" -Type "Error"
}
#endregion
