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

# Step number for this script
$STEP_NUMBER = 10

# Import variable management functions
. "$PSScriptRoot\..\win_common\GlobalVars.ps1"
. "$PSScriptRoot\..\win_common\CommonFunc.ps1"

# Get WindowsPathFunction.ps1 path
$windowsPathFunctionPath = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common\WindowsPathFunction.ps1"

function Install-ScoopWithChinaMirror {
    [CmdletBinding()]
    param (
        [switch]$Force
    )
    $isFirstInstall = $false

    # Check if $SCOOP_EXE is a directory (should be a file)
    if (Test-Path $SCOOP_EXE -PathType Container) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: $SCOOP_EXE is a directory, expected a file. Deleting the directory..." -Type "Warning"
        Remove-Item -Path $SCOOP_EXE -Recurse -Force
    }

    # Check if already installed
    if (Test-Path $SCOOP_EXE) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Scoop is already installed." -Type "Success"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Scoop executable path: $SCOOP_EXE" -Type "Info"
    }
    else {
        $isFirstInstall = $true
        
        # Check PowerShell version and Language Mode
        $psVersion = $PSVersionTable.PSVersion
        $languageMode = $ExecutionContext.SessionState.LanguageMode
        
        if ($languageMode -ne "FullLanguage") {
            throw "PowerShell Language Mode must be FullLanguage to install Scoop. Current mode: $languageMode"
        }

        # Check and set execution policy
        try {
            $currentPolicy = Get-ExecutionPolicy -Scope CurrentUser
            if ($currentPolicy -eq "Restricted") {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting execution policy to RemoteSigned..." -Type "Warning"
                Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
            }
        }
        catch {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to set execution policy: $_" -Type "Warning"
        }

        # Create necessary directories
        if (-not (Test-Path $SCOOP_CACHE_DIR)) {
            New-Item -ItemType Directory -Path $SCOOP_CACHE_DIR -Force | Out-Null
        }
        if (-not (Test-Path $SCOOP_DIR)) {
            New-Item -ItemType Directory -Path $SCOOP_DIR -Force | Out-Null
        }

        # Set environment variables for custom installation
        & $windowsPathFunctionPath "setvar" 'SCOOP' $SCOOP_DIR
        & $windowsPathFunctionPath "setvar" 'SCOOP_GLOBAL' $SCOOP_GLOBAL_DIR
        
        # Refresh environment variables in current session
        & $windowsPathFunctionPath "refresh-bat"
        $refreshBatchPath = Join-Path $env:TEMP "refresh_env.cmd"
        if (Test-Path $refreshBatchPath) {
            & $refreshBatchPath
        }

        Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Scoop..." -Type "Warning"
        
        # Download and execute installer
        $installerPath = Join-Path $SCOOP_CACHE_DIR "install.ps1"
        
        if ($Global:RegionIsChina) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Using China mirror for Scoop installation..." -Type "Warning"
            $installUrl = "https://ghproxy.cc/https://raw.githubusercontent.com/ScoopInstaller/Install/master/install.ps1"
        } else {
            $installUrl = "https://raw.githubusercontent.com/ScoopInstaller/Install/master/install.ps1"
        }

        # Download installer
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Downloading Scoop installer from $installUrl" -Type "Info"
        $downloaded = Get-FileWithSizeCheck -localPath $installerPath -remoteUrl $installUrl -description "Scoop installer"

        if (Test-Path $installerPath) {
            # Execute installer with parameters
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Running Scoop installer..." -Type "Warning"
            $installParams = @{
                ScoopDir = $SCOOP_DIR
                ScoopGlobalDir = $SCOOP_GLOBAL_DIR
                NoProxy = ($Global:RegionIsChina)
            }
            
            # Check if running as admin
            $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
            if ($isAdmin) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Running as administrator, adding RunAsAdmin parameter..." -Type "Warning"
                $installParams.Add("RunAsAdmin", $true)
            }

            & $installerPath @installParams

            # Wait for scoop to be available
            $maxAttempts = 10
            $attempt = 0
            $scoopAvailable = $false
            while ($attempt -lt $maxAttempts) {
                if (Get-Command scoop -ErrorAction SilentlyContinue) {
                    $scoopAvailable = $true
                    break
                }
                Start-Sleep -Seconds 2
                $attempt++
            }

            if (-not $scoopAvailable) {
                throw "Scoop command not available after installation"
            }

            # Configure aria2 for faster downloads
            & $SCOOP_EXE config aria2-enabled $true
        } else {
            throw "Failed to download Scoop installer"
        }
    }

    if ($isFirstInstall) {
        try {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Configuring Scoop..." -Type "Warning"

            # Check if Git is available before adding buckets
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking for Git availability..." -Type "Info"
            $gitExePath = $Global:GIT_EXE_PATH

            if (-not (Test-Path $gitExePath)) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Git not found at $gitExePath" -Type "Warning"
            } else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Git found at: $gitExePath" -Type "Success"
                & $gitExePath --version

                # Add essential buckets
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Adding essential buckets..." -Type "Warning"
                if (-not (& scoop bucket list | Select-String "main")) {
                    if ($Global:RegionIsChina) {
                        & $SCOOP_EXE bucket add main https://ghproxy.cc/https://github.com/ScoopInstaller/Main
                    } else {
                        & $SCOOP_EXE bucket add main
                    }
                }

                if (-not (& scoop bucket list | Select-String "extras")) {
                    if ($Global:RegionIsChina) {
                        & $SCOOP_EXE bucket add extras https://ghproxy.cc/https://github.com/ScoopInstaller/Extras
                    } else {
                        & $SCOOP_EXE bucket add extras
                    }
                }

                # Update Scoop
                & $SCOOP_EXE update
            }
        }
        catch {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to configure Scoop: $_" -Type "Warning"
        }
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Scoop installed and configured successfully!" -Type "Success"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installation path: $SCOOP_DIR" -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Global installation path: $SCOOP_GLOBAL_DIR" -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Scoop executable path: $SCOOP_EXE" -Type "Info"
}

Install-ScoopWithChinaMirror