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

$STEP_NUMBER = 81

function Step81_InstallVisualStudio {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Visual Studio 2022..." -Type "Info"

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
    
    # Start the installation process
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Starting Visual Studio installation..." -Type "Warning"
    $wingetCommand = "winget install --id $($versionDetails.WingetId) --override `"$installArgs`" --accept-package-agreements --accept-source-agreements"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Executing command: $wingetCommand" -Type "Warning"
    $process = Start-Process -FilePath "winget" -ArgumentList "install --id $($versionDetails.WingetId) --override `"$installArgs`" --accept-package-agreements --accept-source-agreements" -Wait -NoNewWindow -PassThru
    
    if ($process.ExitCode -eq 0) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully installed Visual Studio 2022" -Type "Success"
        
        # Verify installation
        if (Test-Path $vsExePath) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Visual Studio installation verified" -Type "Success"
        }
        else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: Visual Studio installation verification failed" -Type "Warning"
        }
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to install Visual Studio 2022 (Exit Code: $($process.ExitCode))" -Type "Error"
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

Step81_InstallVisualStudio