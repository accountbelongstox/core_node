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

# Get WindowsPathFunction.ps1 path
$windowsPathFunctionPath = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common\WindowsPathFunction.ps1"

$STEP_NUMBER = 30

# Chrome Application ID
$CHROME_ID = "Google.Chrome"
function Step26_InstallChrome {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Chrome..." -Type "Info"

    # Define Chrome paths
    $chromeDefaultPath = "C:\Program Files\Google"
    $chromeInstallPath = Join-Path $APP_INSTALL_DIR "Chrome"
    $chromeInstalled = $false

    # Check if Chrome is already installed in the custom location
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking Chrome installation..." -Type "Info"
    if (Test-DirectoryNotEmpty $chromeInstallPath) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Chrome is already installed at $chromeInstallPath" -Type "Success"
        $chromeInstalled = $true
    } else {
        # Check if default Chrome directory exists and is not a hard link
        if (Test-Path $chromeDefaultPath) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking Chrome default installation..." -Type "Info"
            # Check if it's a hard link
            $isHardLink = $false
            try {
                $fsi = Get-Item $chromeDefaultPath -Force
                $isHardLink = $fsi.Attributes -band [System.IO.FileAttributes]::ReparsePoint
            }
            catch {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Error checking directory attributes: $($_.Exception.Message)" -Type "Warning"
            }
            if (-not $isHardLink) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Removing existing Chrome installation..." -Type "Warning"
                # Try to uninstall Chrome using winget
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Uninstalling Chrome using winget..." -Type "Warning"
                winget uninstall $CHROME_ID --silent
                # Remove the Google directory
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Removing $chromeDefaultPath..." -Type "Warning"
                Remove-Item -Path $chromeDefaultPath -Recurse -Force -ErrorAction SilentlyContinue
            } else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Chrome directory is already a hard link" -Type "Success"
                $chromeInstalled = $true
            }
        }
        if (-not $chromeInstalled) {
            # Create Chrome installation directory
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Creating Chrome installation directory..." -Type "Info"
            if (-not (Test-Path $chromeInstallPath)) {
                New-Item -ItemType Directory -Path $chromeInstallPath -Force | Out-Null
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Created directory: $chromeInstallPath" -Type "Success"
            }
            # Create hard link
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Creating hard link for Chrome..." -Type "Info"
            try {
                # Create parent directory if it doesn't exist
                $parentDir = Split-Path $chromeDefaultPath -Parent
                if (-not (Test-Path $parentDir)) {
                    New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
                }
                # Create hard link
                cmd /c mklink /J "$chromeDefaultPath" "$chromeInstallPath"
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Created hard link from $chromeDefaultPath to $chromeInstallPath" -Type "Success"
            }
            catch {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Error creating hard link: $($_.Exception.Message)" -Type "Error"
            }
            # Install Chrome using winget
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Chrome using winget..." -Type "Info"
            if (Invoke-WingetCommand -Id $CHROME_ID -InstallDir $chromeInstallPath) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully installed Chrome" -Type "Success"
            } else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to install Chrome" -Type "Error"
            }
        }
    }
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Chrome installation completed" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
    # Create desktop shortcut for Chrome
    $chromeExe = Join-Path $chromeInstallPath "Chrome\Application\chrome.exe"
    if (Test-Path $chromeExe) {
        Create-DesktopShortcut -ExePath $chromeExe -ShortcutName "Chrome"
        # Set CHROME_EXECUTABLE environment variable
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting CHROME_EXECUTABLE environment variable..." -Type "Info"
        & $windowsPathFunctionPath "setvar" "CHROME_EXECUTABLE" $chromeExe
        Write-ColorMessage -Message "[Step $STEP_NUMBER] CHROME_EXECUTABLE set to: $chromeExe" -Type "Success"
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Chrome executable not found for shortcut creation: $chromeExe" -Type "Warning"
    }
}

# Step 6B: Install Chrome Beta
function Step26_InstallChromeBeta {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Chrome Beta..." -Type "Info"
    # Define Chrome Beta paths
    $chromeBetaDefaultPath = "C:\Program Files\Google\Chrome Beta"
    $chromeBetaInstallPath = Join-Path $APP_INSTALL_DIR "Chrome Beta"
    $chromeBetaInstalled = $false
    # Check if Chrome Beta is already installed in the custom location
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking Chrome Beta installation..." -Type "Info"
    if (Test-DirectoryNotEmpty $chromeBetaInstallPath) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Chrome Beta is already installed at $chromeBetaInstallPath" -Type "Success"
        $chromeBetaInstalled = $true
    } else {
        # Check if default Chrome Beta directory exists and is not a hard link
        if (Test-Path $chromeBetaDefaultPath) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking Chrome Beta default installation..." -Type "Info"
            # Check if it's a hard link
            $isHardLink = $false
            try {
                $fsi = Get-Item $chromeBetaDefaultPath -Force
                $isHardLink = $fsi.Attributes -band [System.IO.FileAttributes]::ReparsePoint
            }
            catch {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Error checking directory attributes: $($_.Exception.Message)" -Type "Warning"
            }
            if (-not $isHardLink) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Removing existing Chrome Beta installation..." -Type "Warning"
                # Try to uninstall Chrome Beta using winget
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Uninstalling Chrome Beta using winget..." -Type "Warning"
                winget uninstall "Google.Chrome.Beta" --silent
                # Remove the Chrome Beta directory
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Removing $chromeBetaDefaultPath..." -Type "Warning"
                Remove-Item -Path $chromeBetaDefaultPath -Recurse -Force -ErrorAction SilentlyContinue
            } else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Chrome Beta directory is already a hard link" -Type "Success"
                $chromeBetaInstalled = $true
            }
        }
        if (-not $chromeBetaInstalled) {
            # Create Chrome Beta installation directory
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Creating Chrome Beta installation directory..." -Type "Info"
            if (-not (Test-Path $chromeBetaInstallPath)) {
                New-Item -ItemType Directory -Path $chromeBetaInstallPath -Force | Out-Null
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Created directory: $chromeBetaInstallPath" -Type "Success"
            }
            # Create hard link
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Creating hard link for Chrome Beta..." -Type "Info"
            try {
                # Create parent directory if it doesn't exist
                $parentDir = Split-Path $chromeBetaDefaultPath -Parent
                if (-not (Test-Path $parentDir)) {
                    New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
                }
                # Create hard link
                cmd /c mklink /J "$chromeBetaDefaultPath" "$chromeBetaInstallPath"
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Created hard link from $chromeBetaDefaultPath to $chromeBetaInstallPath" -Type "Success"
            }
            catch {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Error creating hard link: $($_.Exception.Message)" -Type "Error"
            }
            # Install Chrome Beta using winget
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Chrome Beta using winget..." -Type "Info"
            if (Invoke-WingetCommand -Id "Google.Chrome.Beta" -InstallDir $chromeBetaInstallPath) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully installed Chrome Beta" -Type "Success"
            } else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to install Chrome Beta" -Type "Error"
            }
        }
    }
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Chrome Beta installation completed" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
    # Create desktop shortcut for Chrome Beta
    $chromeBetaExe = Join-Path $chromeBetaInstallPath "Application\chrome.exe"
    if (Test-Path $chromeBetaExe) {
        Create-DesktopShortcut -ExePath $chromeBetaExe -ShortcutName "ChromeBeta"
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Chrome Beta executable not found for shortcut creation: $chromeBetaExe" -Type "Warning"
    }
}

Step26_InstallChrome
Step26_InstallChromeBeta
