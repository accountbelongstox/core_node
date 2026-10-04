. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "GlobalVars.ps1")
. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "CommonFunc.ps1")

# Get WindowsPathFunction.ps1 path
$windowsPathFunctionPath = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common\WindowsPathFunction.ps1"

$COMPONENT_ID = 'Android_Studio'

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
        Write-ColorMessage -Message "[$COMPONENT_ID] Found adb.exe at: $adbPathFound" -Type "Success"
        # Add adb path to environment using WindowsPathFunction.ps1
        $adbDir = Split-Path $adbPathFound
        & $windowsPathFunctionPath "add" $adbDir
    } else {
        Write-ColorMessage -Message "[$COMPONENT_ID] adb.exe not found in any known SDK/platform-tools path! Please ensure Android SDK is installed." -Type "Warning"
        Write-ColorMessage -Message ("[$COMPONENT_ID] Searched directories:" + [Environment]::NewLine + ($searchedDirs -join [Environment]::NewLine)) -Type "Info"
    }
}

function Android_Studio {
    Write-ColorMessage -Message "[$COMPONENT_ID] Installing Android Studio..." -Type "Info"
    
    # Create installation directories if they don't exist
    if (-not (Test-Path $ANDROID_STUDIO_DIR)) {
        New-Item -ItemType Directory -Path $ANDROID_STUDIO_DIR -Force | Out-Null
        Write-ColorMessage -Message "[$COMPONENT_ID] Created installation directory: $ANDROID_STUDIO_DIR" -Type "Info"
    }
    
    # Create hard links for default paths
    Write-ColorMessage -Message "[$COMPONENT_ID] Creating hard links for Android Studio directories..." -Type "Info"
    
    # Create hard link for Android Studio
    
    if (Test-Path $ANDROID_STUDIO_EXE_PATH) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Android Studio is already installed at: $ANDROID_STUDIO_EXE_PATH" -Type "Success"
    }
    else {
        # Test-AndRecreateHardLink -LinkPath $defaultStudioPath -TargetPath $ANDROID_STUDIO_DIR
        $installerPath = Join-Path $DOWNLOADS_DIR "android-studio.exe"
        Write-ColorMessage -Message "[$COMPONENT_ID] Downloading Android Studio..." -Type "Warning"
        $downloaded = Get-FileWithSizeCheck -localPath $installerPath -remoteUrl $ANDROID_STUDIO_DOWNLOAD_URL -description "Android Studio installer"
        if (Test-Path $installerPath) {
            Write-ColorMessage -Message "[$COMPONENT_ID] Installing Android Studio..." -Type "Warning"
            $installArgs = @(
                "/S" # Silent install
            )
            Start-Process -FilePath $installerPath -ArgumentList $installArgs -Wait
            if (Test-Path $ANDROID_STUDIO_EXE_PATH) {
                Write-ColorMessage -Message "[$COMPONENT_ID] Successfully installed Android Studio" -Type "Success"
            }
            else {
                Write-ColorMessage -Message "[$COMPONENT_ID] Failed to install Android Studio" -Type "Error"
            }
        }
        else {
            Write-ColorMessage -Message "[$COMPONENT_ID] Failed to download Android Studio installer" -Type "Error"
        }
    }

    if (Test-Path $ANDROID_STUDIO_EXE_PATH) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Android Studio is already installed at: $ANDROID_STUDIO_EXE_PATH" -Type "Success"
        
        # Create desktop shortcut using unified system
        Write-ColorMessage -Message "[$COMPONENT_ID] Creating Android Studio desktop shortcut using unified system..." -Type "Info"
        try {
            $shortcutCreated = Create-DesktopShortcutsForPackage -ShortcutName "Android Studio" -ExePath $ANDROID_STUDIO_EXE_PATH -CategoryName $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS -ScanKeywords @("Android Studio", "studio64", "android-studio")
            if ($shortcutCreated) {
                Write-ColorMessage -Message "[$COMPONENT_ID] Successfully created Android Studio desktop shortcut" -Type "Success"
            } else {
                Write-ColorMessage -Message "[$COMPONENT_ID] Desktop shortcut creation completed (may already exist)" -Type "Info"
            }
        }
        catch {
            Write-ColorMessage -Message "[$COMPONENT_ID] Error creating desktop shortcut: $($_.Exception.Message)" -Type "Warning"
        }
    }
    Write-ColorMessage -Message "[$COMPONENT_ID] Checking Android Studio environment variables..." -Type "Info"
    # Auto-detect Android SDK directory
    $foundSdkPath = $null
    foreach ($p in $Global:SDK_PATHS) {
        if (Test-Path $p) {
            $foundSdkPath = $p
            break
        }
    }
    if ($foundSdkPath) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Found Android SDK directory: $foundSdkPath" -Type "Success"
        [void](& $windowsPathFunctionPath "setvar" "ANDROID_HOME" $foundSdkPath)
        [void](& $windowsPathFunctionPath "setvar" "ANDROID_SDK_ROOT" $foundSdkPath)
        Write-ColorMessage -Message "[$COMPONENT_ID] Set ANDROID_HOME/ANDROID_SDK_ROOT to: $foundSdkPath" -Type "Success"
        $platformToolsPath = Join-Path $foundSdkPath "platform-tools"
        if (Test-Path $platformToolsPath) {
            [void](& $windowsPathFunctionPath "add" $platformToolsPath)
            Write-ColorMessage -Message "[$COMPONENT_ID] Added platform-tools to PATH: $platformToolsPath" -Type "Success"

        } else {
            Write-ColorMessage -Message "[$COMPONENT_ID] platform-tools not found in: $foundSdkPath" -Type "Warning"
        }
        $emulatorPath = Join-Path $foundSdkPath "emulator"
        if (Test-Path $emulatorPath) {
            [void](& $windowsPathFunctionPath "add" $emulatorPath)
            Write-ColorMessage -Message "[$COMPONENT_ID] Added emulator to PATH: $emulatorPath" -Type "Success"
        } else {
            Write-ColorMessage -Message "[$COMPONENT_ID] emulator directory not found in: $foundSdkPath" -Type "Warning"
        }
        $cmdlineToolsLatestBinPath = Join-Path $foundSdkPath "cmdline-tools\latest\bin"
        $cmdlineToolsBinPath = Join-Path $foundSdkPath "cmdline-tools\bin"
        if (Test-Path $cmdlineToolsLatestBinPath) {
            [void](& $windowsPathFunctionPath "add" $cmdlineToolsLatestBinPath)
            Write-ColorMessage -Message "[$COMPONENT_ID] Added cmdline-tools to PATH: $cmdlineToolsLatestBinPath" -Type "Success"
        } elseif (Test-Path $cmdlineToolsBinPath) {
            [void](& $windowsPathFunctionPath "add" $cmdlineToolsBinPath)
            Write-ColorMessage -Message "[$COMPONENT_ID] Added cmdline-tools to PATH: $cmdlineToolsBinPath" -Type "Success"
        } else {
            Write-ColorMessage -Message "[$COMPONENT_ID] cmdline-tools directory not found in: $foundSdkPath" -Type "Warning"
        }
        Add-AdbToPathIfExists
    } else {
        Write-ColorMessage -Message "[$COMPONENT_ID] No valid Android SDK directory found! Please install Android SDK first." -Type "Error"
    }
    Write-ColorMessage -Message "[$COMPONENT_ID] Checking Android Studio PATH entries..." -Type "Info"
    [void](& $windowsPathFunctionPath "add" $ANDROID_STUDIO_DIR)
    if (Test-Path -LiteralPath $ANDROID_STUDIO_EXE_PATH) {
        New-Item -ItemType File -Path $ANDROID_STUDIO_INSTALLED_FLAG -Force | Out-Null
        Write-ColorMessage -Message "[$COMPONENT_ID] Created installation flag: $ANDROID_STUDIO_INSTALLED_FLAG" -Type "Success"
        Write-ColorMessage -Message "[$COMPONENT_ID] Android Studio installation completed" -Type "Success"
    } else {
        Write-ColorMessage -Message "[$COMPONENT_ID] Android Studio not found at $ANDROID_STUDIO_EXE_PATH after install" -Type "Error"
    }
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

Android_Studio
