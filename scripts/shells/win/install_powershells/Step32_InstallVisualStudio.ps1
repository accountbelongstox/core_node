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

$STEP_NUMBER = 32

function Step32_InstallVisualStudio {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Visual Studio 2022..." -Type "Info"

    # Check Windows version compatibility
    $osInfo = Get-CimInstance Win32_OperatingSystem
    $winBuild = [int]$osInfo.BuildNumber
    $isWin10 = $winBuild -lt 22000
    $isWin11 = $winBuild -ge 22000
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Windows Build: $winBuild (Win10: $isWin10, Win11: $isWin11)" -Type "Info"
    
    # Check available disk space (Visual Studio requires at least 8GB)
    $drive = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
    $freeSpaceGB = [math]::Round($drive.FreeSpace / 1GB, 2)
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Available disk space: $freeSpaceGB GB" -Type "Info"
    
    if ($freeSpaceGB -lt 8) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: Low disk space ($freeSpaceGB GB). Visual Studio requires at least 8GB." -Type "Warning"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Using minimal installation to reduce space requirements." -Type "Warning"
        $Global:VS2022_DEFAULT_VERSION = "2022-minimal"
    } elseif ($isWin10) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Windows 10 detected. Using Win10-compatible configuration." -Type "Info"
        $Global:VS2022_DEFAULT_VERSION = "2022"
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Windows 11 detected. Using full configuration." -Type "Info"
        $Global:VS2022_DEFAULT_VERSION = "2022"
    }

    # Create installation directory if it doesn't exist
    if (-not (Test-Path $VS2022_DIR)) {
        New-Item -ItemType Directory -Path $VS2022_DIR -Force | Out-Null
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Created installation directory: $VS2022_DIR" -Type "Info"
    }

    # Check if Visual Studio is already installed by verifying the IDE executable
    $vsExePath = Join-Path $VS2022_DIR "Community\Common7\IDE\devenv.exe"
    if (Test-Path $vsExePath) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Visual Studio 2022 is already installed" -Type "Success"
        return
    }

    # Create hard links for all Visual Studio directories
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Creating hard links for Visual Studio directories..." -Type "Info"
    $linkResult = Set-VisualStudioHardLinks
    if (-not $linkResult) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to create all Visual Studio hard links" -Type "Error"
        return
    }

    # Prepare installation command
    $versionDetails = $VS2022_VERSIONS[$VS2022_DEFAULT_VERSION]
    $workloads = $versionDetails.Workloads -join " "
    $components = $versionDetails.Components -join " "
    
    # Prepare the installation arguments
    $installArgs = "--wait --quiet --add $workloads $components"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Visual Studio 2022 with components:" -Type "Warning"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Workloads: $workloads" -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Components: $components" -Type "Info"
    
    # Start the installation process with retry mechanism
    $maxRetries = 2
    $retryCount = 0
    $installationSuccess = $false
    
    while (-not $installationSuccess -and $retryCount -le $maxRetries) {
        if ($retryCount -gt 0) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Retry attempt $retryCount of $maxRetries..." -Type "Warning"
            Start-Sleep -Seconds 10
        }
        
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Starting Visual Studio installation..." -Type "Warning"
        $wingetCommand = "winget install --id $($versionDetails.WingetId) --override `"$installArgs`" --accept-package-agreements --accept-source-agreements"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Executing command: $wingetCommand" -Type "Warning"
        
        $process = Start-Process -FilePath "winget" -ArgumentList "install --id $($versionDetails.WingetId) --override `"$installArgs`" --accept-package-agreements --accept-source-agreements" -Wait -NoNewWindow -PassThru
        
        if ($process.ExitCode -eq 0) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully installed Visual Studio 2022" -Type "Success"
            $installationSuccess = $true
            
            # Verify installation
            if (Test-Path $vsExePath) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Visual Studio installation verified" -Type "Success"
            }
            else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: Visual Studio installation verification failed" -Type "Warning"
            }
        }
        else {
            $exitCode = $process.ExitCode
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to install Visual Studio 2022 (Exit Code: $exitCode)" -Type "Error"
            
            # Handle specific error codes
            switch ($exitCode) {
                2147942512 { # 0x80070070 - Not enough disk space
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Error: Insufficient disk space. Trying minimal installation..." -Type "Error"
                    if ($Global:VS2022_DEFAULT_VERSION -ne "2022-minimal") {
                        $Global:VS2022_DEFAULT_VERSION = "2022-minimal"
                        $versionDetails = $VS2022_VERSIONS[$VS2022_DEFAULT_VERSION]
                        $workloads = $versionDetails.Workloads -join " "
                        $components = $versionDetails.Components -join " "
                        $installArgs = "--wait --quiet --add $workloads $components"
                        Write-ColorMessage -Message "[Step $STEP_NUMBER] Switched to minimal installation configuration" -Type "Info"
                        $retryCount++
                        continue
                    }
                }
                2147942402 { # 0x80070002 - File not found
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Error: Installation file not found. This may be a network issue." -Type "Error"
                }
                default {
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Error: Unknown installation error (Code: $exitCode)" -Type "Error"
                }
            }
            
            $retryCount++
        }
    }
    
    if (-not $installationSuccess) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Visual Studio installation failed after $maxRetries retries" -Type "Error"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] You may need to install Visual Studio manually or free up disk space" -Type "Warning"
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Visual Studio 2022 installation completed" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

function Set-VisualStudioHardLinks {
    $username = $env:USERNAME
    $vsTargetDir = $VS2022_DIR
    $linkErrors = @()

    # Define all directories that need to be linked
    $vsDirectories = @(
        @{
            Source = "C:\Program Files\Microsoft Visual Studio\2022\Community"
            Target = Join-Path $vsTargetDir "Community"
        },
        @{
            Source = "C:\Program Files (x86)\Microsoft Visual Studio"
            Target = Join-Path $vsTargetDir "x86\Microsoft Visual Studio"
        },
        @{
            Source = "C:\Program Files (x86)\Microsoft SDKs"
            Target = Join-Path $vsTargetDir "x86\Microsoft SDKs"
        },
        @{
            Source = "C:\Users\$username\AppData\Local\Microsoft\VisualStudio"
            Target = Join-Path $vsTargetDir "User\VisualStudio"
        },
        @{
            Source = "C:\Users\$username\AppData\Local\Microsoft\VSCommon"
            Target = Join-Path $vsTargetDir "User\VSCommon"
        },
        @{
            Source = "C:\Users\$username\.nuget\packages"
            Target = Join-Path $vsTargetDir "User\nuget\packages"
        },
        @{
            Source = "C:\Users\$username\source\repos"
            Target = Join-Path $vsTargetDir "User\source\repos"
        },
        @{
            Source = "C:\Program Files (x86)\Android"
            Target = Join-Path $vsTargetDir "x86\Android"
        },
        @{
            Source = "C:\Program Files\dotnet"
            Target = Join-Path $vsTargetDir "dotnet"
        },
        @{
            Source = "C:\ProgramData\Microsoft\VisualStudio\Packages"
            Target = Join-Path $vsTargetDir "ProgramData\Packages"
        },
        @{
            Source = "C:\Users\$username\AppData\Local\Microsoft\VSApplicationInsights"
            Target = Join-Path $vsTargetDir "User\VSApplicationInsights"
        }
    )

    foreach ($dir in $vsDirectories) {
        $source = $dir.Source
        $target = $dir.Target

        # Create parent directory if it doesn't exist
        $parentDir = Split-Path $target -Parent
        if (-not (Test-Path $parentDir)) {
            New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
        }

        Write-ColorMessage -Message "[Step $STEP_NUMBER] Creating hard link: $source -> $target" -Type "Info"
        try {
            # Check if source exists
            if (-not (Test-Path $source)) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: Source directory does not exist: $source" -Type "Warning"
                continue
            }

            # Use Test-AndRecreateHardLink to create the hard link
            $result = Test-AndRecreateHardLink -LinkPath $target -TargetPath $source
            if (-not $result) {
                $errorMsg = "Failed to create hard link for $source"
                Write-ColorMessage -Message "[Step $STEP_NUMBER] $errorMsg" -Type "Error"
                $linkErrors += $errorMsg
            }
            else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully created hard link" -Type "Success"
            }
        }
        catch {
            $errorMsg = "Error creating hard link for $source : $($_.Exception.Message)"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] $errorMsg" -Type "Error"
            $linkErrors += $errorMsg
        }
    }

    if ($linkErrors.Count -gt 0) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] The following errors occurred while creating hard links:" -Type "Error"
        foreach ($errorMsg in $linkErrors) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] - $errorMsg" -Type "Error"
        }
        return $false
    }

    return $true
}

Step32_InstallVisualStudio