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
$STEP_NUMBER = 3

# Import variable management functions
. "$PSScriptRoot\..\win_common\GlobalVars.ps1"
. "$PSScriptRoot\..\win_common\CommonFunc.ps1"

function Test-AndInstallWinGet {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking WinGet installation..." -Type "Info"
    
    # Check if winget is already installed
    try {
        $wingetVersion = & winget --version
        if ($wingetVersion) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] WinGet is already installed. Version: $wingetVersion" -Type "Success"
            return $true
        }
    } catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] WinGet not found, proceeding with installation..." -Type "Warning"
    }

    # Check Windows version
    $osInfo = Get-CimInstance -ClassName Win32_OperatingSystem
    $buildNumber = [int]$osInfo.BuildNumber
    if ($buildNumber -lt 16299) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Windows version too old (build $buildNumber). WinGet requires Windows 10 1709 (build 16299) or later." -Type "Error"
        return $false
    }

    # Try to install WinGet using PowerShell module
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing WinGet PowerShell module..." -Type "Info"
    try {
        # Install NuGet package provider if not present
        if (-not (Get-PackageProvider -Name NuGet -ErrorAction SilentlyContinue)) {
            Install-PackageProvider -Name NuGet -Force | Out-Null
        }

        # Install WinGet PowerShell module
        Install-Module -Name Microsoft.WinGet.Client -Force -Repository PSGallery | Out-Null
        
        # Repair WinGet package manager
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Repairing WinGet package manager..." -Type "Info"
        Repair-WinGetPackageManager -AllUsers

        # Verify installation
        $wingetVersion = & winget --version
        if ($wingetVersion) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] WinGet installed successfully. Version: $wingetVersion" -Type "Success"
            return $true
        }
    } catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to install WinGet using PowerShell module: $_" -Type "Error"
    }

    # If PowerShell module installation fails, try to register App Installer
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Trying to register App Installer..." -Type "Info"
    try {
        Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe
        Start-Sleep -Seconds 5  # Wait for registration to complete
        
        # Verify installation again
        $wingetVersion = & winget --version
        if ($wingetVersion) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] WinGet installed successfully. Version: $wingetVersion" -Type "Success"
            return $true
        }
    } catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to register App Installer: $_" -Type "Error"
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to install WinGet. Please install it manually from the Microsoft Store." -Type "Error"
    return $false
}

function Test-WingetFirstTimeUse {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking if this is winget's first use on Windows 10..." -Type "Info"
    
    # Only check on Windows 10
    if (-not $Global:isWin10) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Not Windows 10, skipping first-time use check" -Type "Info"
        return $false
    }
    
    # Check if winget cache directory exists and has been used before
    $wingetUserConfirmationFlag = Join-Path $Global:USER_CACHE_DIR "winget_user_confirmation.flag"
    
    # If user confirmation flag exists, user has manually confirmed in temporary script
    if (Test-Path $wingetUserConfirmationFlag) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] User has confirmed winget usage in temporary script, skipping first-time authorization" -Type "Success"
        return $false
    }
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Detected potential first-time winget use on Windows 10" -Type "Warning"
    return $true
}

function Handle-WingetFirstTimeAuthorization {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Handling winget first-time authorization on Windows 10..." -Type "Info"
    
    $tempScriptDir = Join-Path $Global:USER_CACHE_DIR "winget_first_run"
    $tempScriptBat = Join-Path $tempScriptDir "winget_first_run_test.bat"
    $chromeDriverDir = Join-Path $Global:LANG_COMPILER_DIR "chromedriver"
    
    if (-not (Test-Path $tempScriptDir)) {
        New-Item -ItemType Directory -Path $tempScriptDir -Force | Out-Null
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Created temporary script directory: $tempScriptDir" -Type "Info"
    }
    
    $batContent = @"
@echo off
echo Winget First Time Authorization Test
echo.
echo This script will test winget installation to trigger first-time authorization.
echo When prompted, please type 'Y' and press Enter to accept the terms.
echo.
echo Installing Chromium.ChromeDriver to test directory...
echo Target directory: $chromeDriverDir
echo.

winget install Chromium.ChromeDriver --location "$chromeDriverDir" --accept-package-agreements --accept-source-agreements

echo.
echo Installation attempt completed.
echo Please check the output above for any prompts or errors.
echo.
echo IMPORTANT: Please confirm that you have completed the winget authorization
echo by typing 'Y' and pressing Enter below. This will create a confirmation flag.
echo.
set /p user_confirmation="Have you completed winget authorization? (Y/N): "

if /i "%user_confirmation%"=="Y" (
    echo Creating user confirmation flag...
    echo %date% %time% - User confirmed winget authorization > "$($Global:USER_CACHE_DIR)\winget_user_confirmation.flag"
    echo User confirmation flag created successfully.
) else (
    echo No confirmation provided. Please run this script again when ready.
)

echo.
echo Script execution completed.
echo.
echo Press any key to close this window...
pause > nul
"@
    
    Set-Content -Path $tempScriptBat -Value $batContent -Encoding ASCII -Force
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Created temporary batch script: $tempScriptBat" -Type "Success"
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Opening script directory in Explorer..." -Type "Info"
    & explorer $tempScriptDir
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Launching winget authorization test script..." -Type "Info"
    & explorer $tempScriptBat
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] WINGET FIRST-TIME AUTHORIZATION:" -Type "Warning"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] 1. A Command Prompt window has been opened automatically" -Type "Warning"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] 2. When prompted by winget, type 'Y' and press Enter" -Type "Warning"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] 3. Wait for the installation to complete" -Type "Warning"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] 4. Press any key in that window to close it when done" -Type "Warning"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] 5. Explorer folder is also open for reference" -Type "Warning"
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Waiting 10 minutes for manual winget authorization..." -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Press 'Y' to skip waiting at any time, or wait for auto-skip after timeout" -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Current time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -Type "Info"
    
    $endTime = (Get-Date).AddMinutes(10)
    $timeRemaining = 600
    
    while ($timeRemaining -gt 0 -and (Get-Date) -lt $endTime) {
        $minutes = [int][math]::Floor($timeRemaining / 60)
        $seconds = [int]($timeRemaining % 60)
        Write-Host "`r[Step $STEP_NUMBER] Time remaining: $($minutes.ToString('D2')):$($seconds.ToString('D2')) - Press 'Y' to skip..." -ForegroundColor Yellow -NoNewline
        
        # Check for user input without blocking
        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)
            if ($key.Key -eq 'Y' -or $key.KeyChar -eq 'y' -or $key.KeyChar -eq 'Y') {
                Write-Host ""
                Write-ColorMessage -Message "[Step $STEP_NUMBER] User pressed 'Y' - skipping remaining wait time..." -Type "Info"
                break
            }
        }
        
        Start-Sleep -Seconds 1
        $timeRemaining--
    }
    
    Write-Host ""
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Manual authorization time completed" -Type "Info"
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Note: User confirmation flag will be created by temporary script after manual input" -Type "Info"
    
    try {
        Remove-Item -Path $tempScriptDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Cleaned up temporary script directory" -Type "Info"
    } catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: Could not clean up temporary directory: $tempScriptDir" -Type "Warning"
    }
    
    return $true
}

function Init-WingetSource {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking winget and its source configuration..." -Type "Info"
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Error: winget is not installed" -Type "Error"
        return $false
    }
    $wingetVersion = winget --version
    Write-ColorMessage -Message "[Step $STEP_NUMBER] winget version: $wingetVersion" -Type "Success"
    $sourceList = winget source list | Out-String
    $isUstc = $sourceList -match "ustc\.edu"
    $isOfficial = $sourceList -match "https://cdn\.winget\.microsoft\.com"

    if ($Global:RegionIsGlobal) {
        if ($isOfficial) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Already using the official winget source. No changes needed." -Type "Success"
        } else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Not using the official source. Resetting to the official winget source..." -Type "Warning"
            winget source reset --force
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Reset to the official winget source." -Type "Success"
            $sourceList = winget source list | Out-String
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Current sources:\n$sourceList" -Type "Info"
        }
    } else {
        if ($isUstc) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Already using the USTC mirror source. No changes needed." -Type "Success"
        } else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Not using the USTC mirror. Resetting and setting to USTC mirror..." -Type "Warning"
            winget source reset --force
            winget source remove winget -ErrorAction SilentlyContinue
            winget source add winget https://mirrors.ustc.edu.cn/winget-source --accept-source-agreements --trust-level trusted
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Set to USTC mirror source." -Type "Success"
            $sourceList = winget source list | Out-String
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Current sources:\n$sourceList" -Type "Info"
        }
    }
}

# Main execution
Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
Write-ColorMessage -Message "[Step $STEP_NUMBER] Initializing winget configuration..." -Type "Info"

# Step 1: First test and install WinGet if needed
Test-AndInstallWinGet

# Step 2: Check for first-time use and handle authorization (Windows 10 only)
if (Test-WingetFirstTimeUse) {
    if (Handle-WingetFirstTimeAuthorization) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Winget first-time authorization completed successfully" -Type "Success"
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: Failed to handle winget first-time authorization" -Type "Warning"
    }
}

# Step 3: Initialize winget source configuration
Init-WingetSource

Write-ColorMessage -Message "[Step $STEP_NUMBER] Winget initialization completed" -Type "Success"
Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"