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

# Get WindowsPathFunction.ps1 path
$windowsPathFunctionPath = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common\WindowsPathFunction.ps1"

$STEP_NUMBER = 56

# Declare global variables for paths
$Global:DEFAULT_STUDIO_PATH = "C:\Program Files\Android"
$Global:DEFAULT_SDK_PATH = "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk"
$Global:SDK_PATHS = @(
    $Global:ANDROID_SDK_DIR,
    "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk",
    "C:\Program Files\Android\Sdk",
    "C:\Program Files\Android",
    "C:\Program Files (x86)\Android\android-sdk",
    "C:\Android",
    "D:\Android",
    "C:\Program Files (x86)\Android\android-sdk\platform-tools"
)

function Add-AdbToPathIfExists {
    $adbFound = $false
    $searchedDirs = @()
    $adbPathFound = $null

    # 1. Search in standard SDK/platform-tools paths
    foreach ($sdkPath in $Global:SDK_PATHS) {
        $platformToolsDir = Join-Path $sdkPath "platform-tools"
        $adbPath = Join-Path -Path $platformToolsDir "adb.exe"
        $searchedDirs += $platformToolsDir
        if (Test-Path $adbPath) {
            $adbPathFound = $adbPath
            $adbFound = $true
            break
        }
    }

    # 2. Search in extra common locations
    if (-not $adbFound) {
        $extraPaths = @(
            "C:\Program Files (x86)\Android\android-sdk\platform-tools\adb.exe"
        )
        foreach ($adbPath in $extraPaths) {
            $searchedDirs += Split-Path $adbPath
            if (Test-Path $adbPath) {
                $adbPathFound = $adbPath
                $adbFound = $true
                break
            }
        }
    }

    # 3. Optional: Recursive search for adb.exe (disabled by default)
    # if (-not $adbFound) {
    #     try {
    #         $allAdb = Get-ChildItem -Path C:\,D:\ -Filter adb.exe -Recurse -ErrorAction SilentlyContinue -Force | Select-Object -First 1
    #         if ($allAdb) {
    #             $adbPathFound = $allAdb.FullName
    #             $adbFound = $true
    #             $searchedDirs += Split-Path $adbPathFound
    #         }
    #     } catch {}
    # }

    if ($adbFound -and $adbPathFound) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Found adb.exe at: $adbPathFound" -Type "Success"
        # Add adb path to environment using WindowsPathFunction.ps1
        $adbDir = Split-Path $adbPathFound
        & $windowsPathFunctionPath "add" $adbDir
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] adb.exe not found in any known SDK/platform-tools path! Please ensure Android SDK is installed." -Type "Warning"
        Write-ColorMessage -Message ("[Step $STEP_NUMBER] Searched directories:" + [Environment]::NewLine + ($searchedDirs -join [Environment]::NewLine)) -Type "Info"
    }
}

function Step56_InstallAndroidStudio {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Android Studio..." -Type "Info"
    
    # Create installation directories if they don't exist
    if (-not (Test-Path $ANDROID_STUDIO_DIR)) {
        New-Item -ItemType Directory -Path $ANDROID_STUDIO_DIR -Force | Out-Null
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Created installation directory: $ANDROID_STUDIO_DIR" -Type "Info"
    }
    
    # Create hard links for default paths
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Creating hard links for Android Studio directories..." -Type "Info"
    
    # Create hard link for Android Studio
    
    if (Test-Path $ANDROID_STUDIO_EXE_PATH) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Android Studio is already installed at: $ANDROID_STUDIO_EXE_PATH" -Type "Success"
    }
    else {
        # Test-AndRecreateHardLink -LinkPath $defaultStudioPath -TargetPath $ANDROID_STUDIO_DIR
        if (Test-Path $Global:DEFAULT_SDK_PATH) {
            Remove-Item -Path $Global:DEFAULT_SDK_PATH -Force
        }
        $installerPath = Join-Path $DOWNLOADS_DIR "android-studio.exe"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Downloading Android Studio..." -Type "Warning"
        $downloaded = Get-FileWithSizeCheck -localPath $installerPath -remoteUrl $ANDROID_STUDIO_DOWNLOAD_URL -description "Android Studio installer"
        if (Test-Path $installerPath) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Android Studio..." -Type "Warning"
            $installArgs = @(
                "/S" # Silent install
            )
            Start-Process -FilePath $installerPath -ArgumentList $installArgs -Wait
            if (Test-Path $ANDROID_STUDIO_EXE_PATH) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully installed Android Studio" -Type "Success"
            }
            else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to install Android Studio" -Type "Error"
            }
        }
        else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to download Android Studio installer" -Type "Error"
        }
    }

    if (Test-Path $ANDROID_STUDIO_EXE_PATH) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Android Studio is already installed at: $ANDROID_STUDIO_EXE_PATH" -Type "Success"
        
        # Check and create desktop shortcut
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking Android Studio desktop shortcut..." -Type "Info"
        $desktopPath = [Environment]::GetFolderPath("Desktop")
        $shortcutPath = Join-Path $desktopPath "Android Studio.lnk"
        
        if (-not (Test-Path $shortcutPath)) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Creating desktop shortcut for Android Studio..." -Type "Warning"
            $WshShell = New-Object -ComObject WScript.Shell
            $Shortcut = $WshShell.CreateShortcut($shortcutPath)
            $Shortcut.TargetPath = $ANDROID_STUDIO_EXE_PATH
            $Shortcut.WorkingDirectory = $ANDROID_STUDIO_DIR
            $Shortcut.Description = "Android Studio"
            $Shortcut.Save()
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Created desktop shortcut at: $shortcutPath" -Type "Success"
        }
        else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Desktop shortcut already exists at: $shortcutPath" -Type "Success"
        }
    }
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking Android Studio environment variables..." -Type "Info"
    # Auto-detect Android SDK directory
    $foundSdkPath = $null
    foreach ($p in $Global:SDK_PATHS) {
        if (Test-Path $p) {
            $foundSdkPath = $p
            break
        }
    }
    if ($foundSdkPath) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Found Android SDK directory: $foundSdkPath" -Type "Success"
        [void](& $windowsPathFunctionPath "setvar" "ANDROID_HOME" $foundSdkPath)
        [void](& $windowsPathFunctionPath "setvar" "ANDROID_SDK_ROOT" $foundSdkPath)
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Set ANDROID_HOME/ANDROID_SDK_ROOT to: $foundSdkPath" -Type "Success"
        $platformToolsPath = Join-Path $foundSdkPath "platform-tools"
        if (Test-Path $platformToolsPath) {
            [void](& $windowsPathFunctionPath "add" $platformToolsPath)
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Added platform-tools to PATH: $platformToolsPath" -Type "Success"
            
        } else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] platform-tools not found in: $foundSdkPath" -Type "Warning"
        }
        Add-AdbToPathIfExists
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] No valid Android SDK directory found! Please install Android SDK first." -Type "Error"
    }
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking Android Studio PATH entries..." -Type "Info"
    [void](& $windowsPathFunctionPath "add" $ANDROID_STUDIO_DIR)
    New-Item -ItemType File -Path $ANDROID_STUDIO_INSTALLED_FLAG -Force | Out-Null
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Created installation flag: $ANDROID_STUDIO_INSTALLED_FLAG" -Type "Success"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Android Studio installation completed" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

Step56_InstallAndroidStudio
