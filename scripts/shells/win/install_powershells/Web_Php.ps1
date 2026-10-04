# Step number for this script
$COMPONENT_ID = 'Web_Php'

# Import variable management functions
$parentDir = Split-Path $PSScriptRoot -Parent
. (Join-Path (Join-Path $parentDir "win_common") "GlobalVars.ps1")
. (Join-Path (Join-Path $parentDir "win_common") "CommonFunc.ps1")
. (Join-Path (Join-Path $parentDir "win_common") "PackageManagerInvokes.ps1")

# All variable definitions at the beginning of the file
$windowsPathFunctionPath = Join-Path $parentDir "win_common\WindowsPathFunction.ps1"
$postinstallDir = Join-Path $PSScriptRoot "postinstall"
$phpPostInstallProcessorPath = Join-Path $postinstallDir "PhpPostInstallProcessor.ps1"
$frankenPhpManagerPath = Join-Path (Join-Path $parentDir "win_common") "FrankenPhpManager.ps1"
$PHP_RUNTIME_PLANE = $null

# PHP version configuration - Only install PHP 8.5 or higher
# Latest stable version: PHP 8.5.2
$PHP_VERSION = "8.5.2"
$PHP_VERSION_SHORT = "8.5"

# PHP version matching patterns (unified to avoid duplication)
$PHP_VERSION_PATTERN_85 = "*php85*"
$PHP_VERSION_PATTERN_8_5 = "*php8.5*"
$PHP_SCOOP_PACKAGE_NAME = "php85"
$PHP_WINGET_PACKAGE_ID = "PHP.PHP.8.5"
$PHP_CHOCO_PACKAGE_NAME = "php"
$PHP_EXE_NAME = "php.exe"
$PHP_VERSION_DISPLAY = "8.5+"

# PHP download URLs (NTS - Non-Thread Safe, recommended for Laravel)
# NTS is recommended for:
# - Laravel Octane (required)
# - CLI usage and development
# - Better performance on Windows with IIS/FastCGI
$PHP_DOWNLOAD_URL = "https://windows.php.net/downloads/releases/php-$PHP_VERSION-nts-Win32-vs17-x64.zip"
# windows.php.net keeps the newest $PHP_VERSION_SHORT build under this alias; superseded builds move to /archives/
$PHP_LATEST_DOWNLOAD_URL = "https://windows.php.net/downloads/releases/latest/php-$PHP_VERSION_SHORT-nts-Win32-vs17-x64-latest.zip"
$PHP_DOWNLOADS_PAGE_URL = "https://www.php.net/downloads.php"


# PHP installation directories
$PHP_INSTALL_DIR = $Global:PHP_NATIVE_INSTALL_DIR
$PHP_CACHE_DIR = Join-Path $Global:DOWNLOADS_DIR "php"

. $phpPostInstallProcessorPath
. $frankenPhpManagerPath
$FRANKENPHP_INI_SCAN_DIR = Split-Path -Parent (Get-FrankenPhpPhpIniPath)

function Find-PHPExecutable {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory = $true)]
        [string]$SearchDirectory
    )

    try {
        $phpExe = Get-ChildItem -Path $SearchDirectory -Filter $PHP_EXE_NAME -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($phpExe) {
            return $phpExe.FullName
        }
    }
    catch {
        Write-ColorMessage -Message "[$COMPONENT_ID] Error searching for ${PHP_EXE_NAME}: $($_.Exception.Message)" -Type "Warning"
    }
    
    return $null
}

function Get-LatestPHPVersionFromWeb {
    [CmdletBinding()]
    param ()

    Write-ColorMessage -Message "[$COMPONENT_ID] Fetching latest PHP version from official website..." -Type "Info"

    try {
        $htmlContent = Invoke-WebRequest -Uri $PHP_DOWNLOADS_PAGE_URL -UseBasicParsing -ErrorAction Stop
        $htmlText = $htmlContent.Content

        # Look for PHP version in download URLs (simple and flexible)
        $versionPattern = 'php-([\d.]+).*?\.zip'
        $versionMatches = [regex]::Matches($htmlText, $versionPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        
        if ($versionMatches.Count -gt 0) {
            $latestMatch = $versionMatches[0]
            $version = $latestMatch.Groups[1].Value
            $downloadUrl = $latestMatch.Value

            # Check if version meets minimum requirement
            try {
                $versionObj = [version]$version
                $minVersionObj = [version]$PHP_VERSION_SHORT
                if ($versionObj -ge $minVersionObj) {
                    Write-ColorMessage -Message "[$COMPONENT_ID] Found latest PHP version: $version" -Type "Success"
                    Write-ColorMessage -Message "[$COMPONENT_ID] Download URL: $downloadUrl" -Type "Info"
                    return $downloadUrl
                }
                else {
                    Write-ColorMessage -Message "[$COMPONENT_ID] Found PHP version $version but it's below minimum requirement ($PHP_VERSION_DISPLAY)" -Type "Warning"
                }
            }
            catch {
                Write-ColorMessage -Message "[$COMPONENT_ID] Invalid version format: $version" -Type "Warning"
            }
        }

        Write-ColorMessage -Message "[$COMPONENT_ID] Could not find valid PHP $PHP_VERSION_DISPLAY download URL in HTML" -Type "Warning"
    }
    catch {
        Write-ColorMessage -Message "[$COMPONENT_ID] Failed to fetch latest PHP version: $($_.Exception.Message)" -Type "Warning"
    }
    
    return $null
}

function Verify-PHPBinary {
    # Check if installation directory exists and contains PHP executable
    if (-not (Test-Path $PHP_INSTALL_DIR)) {
        return $false
    }
    
    $phpExePath = Find-PHPExecutable -SearchDirectory $PHP_INSTALL_DIR
    if ($phpExePath -and (Test-Path $phpExePath)) {
        return $true
    }
    
    return $false
}

function Install-PHPFromWeb {
    [CmdletBinding()]
    param ()

    $downloadUrl = $PHP_DOWNLOAD_URL
    $zipFileName = Split-Path $downloadUrl -Leaf
    $zipFilePath = Join-Path $PHP_CACHE_DIR $zipFileName

    Write-ColorMessage -Message "[$COMPONENT_ID] Installing PHP $PHP_VERSION (NTS) from web..." -Type "Warning"

    # Create cache directory if it doesn't exist
    if (-not (Test-Path $PHP_CACHE_DIR)) {
        New-Item -ItemType Directory -Path $PHP_CACHE_DIR -Force | Out-Null
    }

    # Create installation directory if it doesn't exist
    if (-not (Test-Path $PHP_INSTALL_DIR)) {
        New-Item -ItemType Directory -Path $PHP_INSTALL_DIR -Force | Out-Null
    }

    # Download PHP archive
    Write-ColorMessage -Message "[$COMPONENT_ID] Downloading PHP from $downloadUrl" -Type "Info"
    $downloaded = Get-FileWithSizeCheck -localPath $zipFilePath -remoteUrl $downloadUrl -description "PHP $PHP_VERSION (NTS)"

    # If download failed, try to get latest version from website
    if (-not $downloaded -or -not (Test-Path $zipFilePath)) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Default download URL failed, fetching latest version from PHP website..." -Type "Warning"
        
        $downloadUrl = $PHP_LATEST_DOWNLOAD_URL
        if ($downloadUrl) {
            $zipFileName = Split-Path $downloadUrl -Leaf
            $zipFilePath = Join-Path $PHP_CACHE_DIR $zipFileName
            
            Write-ColorMessage -Message "[$COMPONENT_ID] Attempting download from latest version URL: $downloadUrl" -Type "Info"
            $downloaded = Get-FileWithSizeCheck -localPath $zipFilePath -remoteUrl $downloadUrl -description "PHP (NTS)"
        }
        
        if (-not $downloaded -or -not (Test-Path $zipFilePath)) {
            Write-ColorMessage -Message "[$COMPONENT_ID] Failed to download PHP archive from all sources" -Type "Error"
            return $null
        }
    }

    # Extract PHP archive
    Write-ColorMessage -Message "[$COMPONENT_ID] Extracting PHP to $PHP_INSTALL_DIR..." -Type "Info"
    try {
        # Use .NET to extract zip (compatible with PowerShell 5.1)
        Expand-Archive -LiteralPath $zipFilePath -DestinationPath $PHP_INSTALL_DIR -Force
        Write-ColorMessage -Message "[$COMPONENT_ID] Successfully extracted PHP" -Type "Success"
    }
    catch {
        Write-ColorMessage -Message "[$COMPONENT_ID] Failed to extract PHP: $($_.Exception.Message)" -Type "Error"
        Write-ColorMessage -Message "[$COMPONENT_ID] Removing corrupted ZIP file: $zipFilePath" -Type "Warning"
        if (Test-Path $zipFilePath) {
            Remove-Item -Path $zipFilePath -Force
        }
        return $false
    }

    # Find PHP executable recursively in installation directory
    $phpExePath = Find-PHPExecutable -SearchDirectory $PHP_INSTALL_DIR
    
    if ($phpExePath -and (Test-Path $phpExePath)) {
        Write-ColorMessage -Message "[$COMPONENT_ID] PHP installed successfully at $phpExePath" -Type "Success"
        return $phpExePath
    }
    else {
        Write-ColorMessage -Message "[$COMPONENT_ID] PHP executable not found after extraction" -Type "Error"
        return $null
    }
}

function Install-PHPWithWinget {
    [CmdletBinding()]
    param ()

    Write-ColorMessage -Message "[$COMPONENT_ID] Attempting to install PHP using winget..." -Type "Info"
    
    $wingetExe = Get-Command "winget" -ErrorAction SilentlyContinue
    if (-not $wingetExe) {
        Write-ColorMessage -Message "[$COMPONENT_ID] winget not available, skipping..." -Type "Warning"
        return $null
    }

    # Try PHP.PHP.8.5 package
    $exePath = Invoke-WingetCommand -Id $PHP_WINGET_PACKAGE_ID -InstallDir $PHP_INSTALL_DIR -Keyword $PHP_EXE_NAME -ForceInstall $false
    
    if ($exePath -and (Test-Path $exePath)) {
        # Verify it's in the expected PHP installation directory
        $exePathDir = Split-Path $exePath -Parent
        if ($exePathDir -eq $PHP_INSTALL_DIR -or $exePathDir -like $PHP_VERSION_PATTERN_8_5) {
            Write-ColorMessage -Message "[$COMPONENT_ID] PHP installed via winget at $exePath" -Type "Success"
            return $exePath
        }
        else {
            Write-ColorMessage -Message "[$COMPONENT_ID] winget installed PHP is not in expected $PHP_VERSION_SHORT directory" -Type "Warning"
        }
    }
    else {
        $phpExePath = Find-PHPExecutable -SearchDirectory $PHP_INSTALL_DIR
        if ($phpExePath -and (Test-Path $phpExePath)) {
            Write-ColorMessage -Message "[$COMPONENT_ID] PHP installed via winget at $phpExePath" -Type "Success"
            return $phpExePath
        }
    }
    
    return $null
}

function Install-PHPWithChoco {
    [CmdletBinding()]
    param ()

    Write-ColorMessage -Message "[$COMPONENT_ID] Attempting to install PHP using Chocolatey..." -Type "Info"
    
    $chocoExe = Get-Command "choco" -ErrorAction SilentlyContinue
    if (-not $chocoExe) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Chocolatey not available, skipping..." -Type "Warning"
        return $null
    }

    # Try installing PHP via Chocolatey
    $exePath = Invoke-ChocoCommand -PackageName $PHP_CHOCO_PACKAGE_NAME -InstallDir $PHP_INSTALL_DIR -Keyword $PHP_EXE_NAME -ForceInstall $false
    
    if ($exePath -and (Test-Path $exePath)) {
        $exePathDir = Split-Path $exePath -Parent
        if ($exePathDir -eq $PHP_INSTALL_DIR -or $exePathDir -like $PHP_VERSION_PATTERN_8_5) {
            Write-ColorMessage -Message "[$COMPONENT_ID] PHP installed via Chocolatey at $exePath" -Type "Success"
            return $exePath
        }
        else {
            Write-ColorMessage -Message "[$COMPONENT_ID] Chocolatey installed PHP is not in expected $PHP_VERSION_SHORT directory" -Type "Warning"
        }
    }
    else {
        $phpExePath = Find-PHPExecutable -SearchDirectory $PHP_INSTALL_DIR
        if ($phpExePath -and (Test-Path $phpExePath)) {
            Write-ColorMessage -Message "[$COMPONENT_ID] PHP installed via Chocolatey at $phpExePath" -Type "Success"
            return $phpExePath
        }
    }
    
    return $null
}

function Install-PHPWithScoop {
    [CmdletBinding()]
    param ()

    Write-ColorMessage -Message "[$COMPONENT_ID] Attempting to install PHP using Scoop..." -Type "Info"
    
    $scoopExe = Get-Command "scoop" -ErrorAction SilentlyContinue
    if (-not $scoopExe) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Scoop not available, skipping..." -Type "Warning"
        return $null
    }

    # Try installing PHP via Scoop
    $exePath = Invoke-ScoopCommand -PackageName $PHP_SCOOP_PACKAGE_NAME -Keyword $PHP_EXE_NAME -ForceInstall $false
    
    if ($exePath -and (Test-Path $exePath)) {
        # Scoop installs to its own directory, but we check if it's the expected PHP package
        if ($exePath -like $PHP_VERSION_PATTERN_85 -or $exePath -like $PHP_VERSION_PATTERN_8_5) {
            Write-ColorMessage -Message "[$COMPONENT_ID] PHP installed via Scoop at $exePath" -Type "Success"
            return $exePath
        }
        else {
            Write-ColorMessage -Message "[$COMPONENT_ID] Scoop installed PHP is not $PHP_SCOOP_PACKAGE_NAME package" -Type "Warning"
        }
    }
    
    return $null
}



function Set-PHPEnvironmentVariables {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory = $true)]
        [string]$PhpExePath,
        [string]$IniScanDir = "",
        [string]$StaleIniScanDir = ""
    )

    Write-ColorMessage -Message "[$COMPONENT_ID] Setting PHP environment variables..." -Type "Info"

    Set-PhpCliRuntime -PhpExePath $PhpExePath -IniScanDir $IniScanDir -StaleIniScanDir $StaleIniScanDir -LogPrefix "[$COMPONENT_ID]" | Out-Null

    # Refresh environment variables in current session
    Write-ColorMessage -Message "[$COMPONENT_ID] Refreshing environment variables..." -Type "Info"
    & $windowsPathFunctionPath "refresh-bat"
    $refreshBatchPath = Join-Path $env:TEMP "refresh_env.cmd"
    & $refreshBatchPath

    # Manually refresh PATH in current PowerShell session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    Write-ColorMessage -Message "[$COMPONENT_ID] PHP environment variables configured" -Type "Success"
}


# FrankenPHP plane (Linux 93_install_php.sh frankenphp branch): FrankenPHP embeds PHP,
# so its php.exe becomes the single php CLI; native PHP and Swoole are skipped.
function Install-WebPhpFrankenPhpPlane {
    $phpExePath = Get-FrankenPhpPhpPath
    $phpInstallDir = Split-Path $phpExePath -Parent

    Write-ColorMessage -Message "[$COMPONENT_ID] PHP runtime plane: frankenphp (embedded PHP, native PHP install skipped)" -Type "Info"
    Ensure-FrankenPhpNativeInstall | Out-Null
    if (-not (Test-FrankenPhpNativePayload)) {
        Write-ColorMessage -Message "[$COMPONENT_ID] FrankenPHP runtime is unavailable: $phpExePath" -Type "Error"
        Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
        return
    }
    Ensure-FrankenPhpPhpConfiguration | Out-Null

    try {
        Set-PHPEnvironmentVariables -PhpExePath $phpExePath -IniScanDir $FRANKENPHP_INI_SCAN_DIR
    }
    catch {
        Write-ColorMessage -Message "[$COMPONENT_ID] Warning: Failed to set environment variables: $($_.Exception.Message)" -Type "Warning"
    }

    try {
        Invoke-PhpPostInstallProcessor `
            -PhpCallback @{ Operation = "install_composer" } `
            -PackageName "FrankenPHP PHP" `
            -ExecutablePath $phpExePath `
            -InstallDir $phpInstallDir `
            -LogPrefix "[$COMPONENT_ID]"
    }
    catch {
        Write-ColorMessage -Message "[$COMPONENT_ID] Warning: Failed to run PhpPostInstallProcessor: $($_.Exception.Message)" -Type "Warning"
    }

    Write-ColorMessage -Message "[$COMPONENT_ID] Swoole skipped: frankenphp plane embeds its Octane app server" -Type "Info"
    Write-ColorMessage -Message "[$COMPONENT_ID] PHP installation and configuration completed (plane: frankenphp)" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

function Web_Php {
    $script:PHP_RUNTIME_PLANE = Get-PhpRuntimePlane
    if ($script:PHP_RUNTIME_PLANE -eq "frankenphp") {
        Install-WebPhpFrankenPhpPlane
        return
    }

    Write-ColorMessage -Message "[$COMPONENT_ID] Installing PHP $PHP_VERSION_DISPLAY for Laravel development (plane: system)..." -Type "Info"

    # Check if PHP is already installed in expected directory
    $phpExePath = $null
    $needsInstall = $true

    if (Verify-PHPBinary) {
        $phpExePath = Find-PHPExecutable -SearchDirectory $PHP_INSTALL_DIR
        if ($phpExePath) {
            Write-ColorMessage -Message "[$COMPONENT_ID] Found existing PHP $PHP_VERSION_DISPLAY installation at $phpExePath" -Type "Success"
            $needsInstall = $false
        }
    }

    # Install PHP if not already installed with acceptable version
    if ($needsInstall) {
        Write-ColorMessage -Message "[$COMPONENT_ID] PHP $PHP_VERSION_DISPLAY not found, starting installation with fallback methods..." -Type "Warning"
        
        # Try installation methods in order: direct download -> choco -> scoop -> winget (winget last as fallback)
        $installationMethods = @(
            @{ Name = "direct download"; Function = { Install-PHPFromWeb } },
            @{ Name = "choco"; Function = { Install-PHPWithChoco } },
            @{ Name = "scoop"; Function = { Install-PHPWithScoop } },
            @{ Name = "winget"; Function = { Install-PHPWithWinget } }
        )
        
        foreach ($method in $installationMethods) {
            Write-ColorMessage -Message "[$COMPONENT_ID] Trying installation method: $($method.Name)..." -Type "Info"
            $result = & $method.Function
            if ($result) {
                $phpExePath = $result
                Write-ColorMessage -Message "[$COMPONENT_ID] Successfully installed PHP using $($method.Name)" -Type "Success"
                break
            }
            else {
                Write-ColorMessage -Message "[$COMPONENT_ID] Installation method $($method.Name) failed, trying next method..." -Type "Warning"
            }
        }

        if (-not $phpExePath) {
            Write-ColorMessage -Message "[$COMPONENT_ID] All installation methods failed" -Type "Error"
            Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
            return
        }
    }
    else {
        Write-ColorMessage -Message "[$COMPONENT_ID] PHP already installed, proceeding with configuration and repair..." -Type "Info"
    }

    # Always run configuration and repair steps (even if PHP is already installed)
    Write-ColorMessage -Message "[$COMPONENT_ID] Running configuration and repair steps..." -Type "Info"

    # Set environment variables (always run to ensure correct setup, continue even if fails)
    try {
        Set-PHPEnvironmentVariables -PhpExePath $phpExePath -StaleIniScanDir $FRANKENPHP_INI_SCAN_DIR
    }
    catch {
        Write-ColorMessage -Message "[$COMPONENT_ID] Warning: Failed to set environment variables: $($_.Exception.Message)" -Type "Warning"
    }

    # Get PHP installation directory
    $phpInstallDir = Split-Path $phpExePath -Parent

    # Import and run PhpPostInstallProcessor for configuration (always run to fix/update configuration, continue even if fails)
    Write-ColorMessage -Message "[$COMPONENT_ID] Running PHP post-installation configuration..." -Type "Info"

    try {
        # Create callback hashtable for full_setup operation
        $phpCallback = @{
            Operation = "full_setup"
        }

        # Get actual PHP version for display (optional, not for validation)
        $actualPhpVersion = $PHP_VERSION_DISPLAY
        try {
            $versionOutput = & $phpExePath --version 2>&1 | Select-Object -First 1
            if (([string]$versionOutput).StartsWith('PHP ', [System.StringComparison]::OrdinalIgnoreCase) -and
                ([string]$versionOutput).Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries).Count -gt 1) {
                $actualPhpVersion = ([string]$versionOutput).Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries)[1]
            }
        }
        catch {
            # Ignore version check errors
        }
        
        # Run the post-install processor
        Invoke-PhpPostInstallProcessor `
            -PhpCallback $phpCallback `
            -PackageName "PHP $actualPhpVersion" `
            -ExecutablePath $phpExePath `
            -InstallDir $phpInstallDir `
            -LogPrefix "[$COMPONENT_ID]"
    }
    catch {
        Write-ColorMessage -Message "[$COMPONENT_ID] Warning: Failed to run PhpPostInstallProcessor: $($_.Exception.Message)" -Type "Warning"
    }


    Write-ColorMessage -Message "[$COMPONENT_ID] PHP installation and configuration completed" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

# Execute PHP installation
Web_Php
