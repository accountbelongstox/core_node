. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "GlobalVars.ps1")
. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "CommonFunc.ps1")

# Get WindowsPathFunction.ps1 path
$windowsPathFunctionPath = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common\WindowsPathFunction.ps1"

$STEP_NUMBER = 22

# Chrome Application ID
$CHROME_ID = "Google.Chrome"
$CHROME_BETA_ID = "Google.Chrome.Beta"
# Invoke-WingetCommand returns the installed executable's path (found via -Keyword), not a boolean
$CHROME_EXE_NAME = "chrome.exe"

# Post-install Chrome crash repair script (idempotent) and fallback path
$scriptsRootDir = Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
$chromeRepairScript = Join-Path $scriptsRootDir "chromefix\repair-chrome-crash.ps1"
$chromeRepairFallback = Join-Path (Join-Path $Global:CORE_NODE_DATA_DIR 'scripts\chromefix') "repair-chrome-crash.ps1"

function Step22_InstallChrome {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Chrome..." -Type "Info"

    # Define Chrome paths
    $chromeDefaultPath = "C:\Program Files\Google"
    $chromeInstallPath = Join-Path $APP_INSTALL_DIR "Chrome"
    $chromeInstalled = $false

    # Check if Chrome is already installed in the custom location
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking Chrome installation..." -Type "Info"
    $chromeJunctionReady = $false
    if (Test-Path -LiteralPath (Join-Path $chromeInstallPath "Chrome\Application\$CHROME_EXE_NAME") -PathType Leaf) {
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
            $otherGoogleItems = @(Get-ChildItem -LiteralPath $chromeDefaultPath -Force -ErrorAction SilentlyContinue | Where-Object { @('Chrome', 'Chrome Beta', 'Update', 'CrashReports', 'Temp') -notcontains $_.Name })
            if (-not $isHardLink -and $otherGoogleItems.Count -gt 0) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] $chromeDefaultPath also holds other Google products ($(($otherGoogleItems | ForEach-Object Name) -join ', ')); Chrome is kept in place" -Type "Warning"
                $chromeInstalled = $true
            } elseif (-not $isHardLink) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Removing existing Chrome installation..." -Type "Warning"
                # Try to uninstall Chrome using winget
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Uninstalling Chrome using winget..." -Type "Warning"
                winget uninstall $CHROME_ID --silent
                # Remove the Google directory
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Removing $chromeDefaultPath..." -Type "Warning"
                Remove-Item -Path $chromeDefaultPath -Recurse -Force -ErrorAction SilentlyContinue
            } else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Chrome directory is already a hard link" -Type "Success"
                $chromeJunctionReady = $true
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
                if (-not $chromeJunctionReady) { cmd /c mklink /J "$chromeDefaultPath" "$chromeInstallPath" | Out-Host }
                if (-not ((Test-Path -LiteralPath $chromeDefaultPath) -and ((Get-Item -LiteralPath $chromeDefaultPath -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint))) {
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Junction $chromeDefaultPath was not created; Chrome install skipped (run as administrator)" -Type "Error"
                    return
                }
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Created hard link from $chromeDefaultPath to $chromeInstallPath" -Type "Success"
            }
            catch {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Error creating hard link: $($_.Exception.Message)" -Type "Error"
            }
            # Install Chrome using winget
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Chrome using winget..." -Type "Info"
            if (Invoke-WingetCommand -Id $CHROME_ID -InstallDir $chromeInstallPath -Keyword $CHROME_EXE_NAME) {
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
function Step22_InstallChromeBeta {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Chrome Beta..." -Type "Info"
    # Define Chrome Beta paths
    $chromeBetaDefaultPath = "C:\Program Files\Google\Chrome Beta"
    $chromeBetaInstallPath = Join-Path $APP_INSTALL_DIR "Chrome Beta"
    $chromeBetaInstalled = $false
    # Check if Chrome Beta is already installed in the custom location
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking Chrome Beta installation..." -Type "Info"
    $chromeBetaJunctionReady = $false
    if (Test-Path -LiteralPath (Join-Path $chromeBetaInstallPath "Application\$CHROME_EXE_NAME") -PathType Leaf) {
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
                winget uninstall $CHROME_BETA_ID --silent
                # Remove the Chrome Beta directory
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Removing $chromeBetaDefaultPath..." -Type "Warning"
                Remove-Item -Path $chromeBetaDefaultPath -Recurse -Force -ErrorAction SilentlyContinue
            } else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Chrome Beta directory is already a hard link" -Type "Success"
                $chromeBetaJunctionReady = $true
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
                if (-not $chromeBetaJunctionReady) { cmd /c mklink /J "$chromeBetaDefaultPath" "$chromeBetaInstallPath" | Out-Host }
                if (-not ((Test-Path -LiteralPath $chromeBetaDefaultPath) -and ((Get-Item -LiteralPath $chromeBetaDefaultPath -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint))) {
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Junction $chromeBetaDefaultPath was not created; Chrome Beta install skipped (run as administrator)" -Type "Error"
                    return
                }
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Created hard link from $chromeBetaDefaultPath to $chromeBetaInstallPath" -Type "Success"
            }
            catch {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Error creating hard link: $($_.Exception.Message)" -Type "Error"
            }
            # Install Chrome Beta using winget
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Chrome Beta using winget..." -Type "Info"
            if (Invoke-WingetCommand -Id $CHROME_BETA_ID -InstallDir $chromeBetaInstallPath -Keyword $CHROME_EXE_NAME) {
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

# Post-install: idempotently remove any stale Chrome compatibility shim that triggers
# STATUS_STACK_BUFFER_OVERRUN (0xC0000409). A clean system is a no-op (skipped).
function Step22_RepairChromeCompatShim {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Post-install: repairing Chrome crash (AW PUP + compat shim)..." -Type "Info"
    $repairScript = $chromeRepairScript
    if (-not (Test-Path $repairScript)) { $repairScript = $chromeRepairFallback }
    if (Test-Path $repairScript) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $repairScript -Quiet | Out-Host
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Chrome crash repair completed" -Type "Success"
        } else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Chrome crash repair failed (exit $LASTEXITCODE)" -Type "Warning"
        }
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Chrome repair script not found (skipped): $repairScript" -Type "Warning"
    }
}

# Post-install: make Chrome the default browser. Windows 10 protects the UserChoice
# association hash, so the supported path is Chrome's own registration plus the
# Settings "Default apps" dialog; a person is present to confirm it (the flow may pop UI).
# Idempotent: when http+https already resolve to ChromeHTML nothing runs.
function Step22_SetChromeDefaultBrowser {
    $urlAssocRoot = 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations'
    $chromeExe = $null
    $waitSeconds = 180
    $pollSeconds = 5
    $elapsed = 0

    $isChromeDefault = {
        $allChrome = $true
        foreach ($proto in @('http', 'https')) {
            $progId = (Get-ItemProperty (Join-Path (Join-Path $urlAssocRoot $proto) 'UserChoice') -ErrorAction SilentlyContinue).ProgId
            if (-not ($progId -like 'ChromeHTML*')) { $allChrome = $false; break }
        }
        $allChrome
    }

    if (& $isChromeDefault) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Chrome is already the default browser (idempotent skip)" -Type "Success"
        return
    }

    $chromeExe = Find-ExecutableByKeyword -Keywords $CHROME_EXE_NAME -AdditionalScanPaths @(Join-Path $APP_INSTALL_DIR 'Chrome') -Recursive $true
    if (-not $chromeExe) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Chrome executable not found; skipping default-browser setup" -Type "Warning"
        return
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting Chrome as the default browser..." -Type "Info"
    # Chrome registers itself and asks Windows to apply the default (may show system UI).
    & $chromeExe --make-default-browser 2>$null | Out-Null
    Start-Sleep -Seconds 3
    if (& $isChromeDefault) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Chrome is now the default browser" -Type "Success"
        return
    }

    # Open the Default apps settings page and wait for the person present to pick Chrome.
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Opening Windows 'Default apps'; please select Chrome as the Web browser (waiting up to $waitSeconds s)..." -Type "Warning"
    Start-Process 'ms-settings:defaultapps'
    while ($elapsed -lt $waitSeconds) {
        Start-Sleep -Seconds $pollSeconds
        $elapsed += $pollSeconds
        if (& $isChromeDefault) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Chrome confirmed as the default browser" -Type "Success"
            return
        }
    }
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Default browser not switched to Chrome within $waitSeconds s; continuing (re-run this step anytime)" -Type "Warning"
}

Step22_InstallChrome
Step22_InstallChromeBeta
Step22_RepairChromeCompatShim
Step22_SetChromeDefaultBrowser
