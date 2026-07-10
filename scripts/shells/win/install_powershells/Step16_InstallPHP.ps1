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
$STEP_NUMBER = 16

# Import variable management functions
$parentDir = Split-Path $PSScriptRoot -Parent
. "$parentDir\win_common\GlobalVars.ps1"
. "$parentDir\win_common\CommonFunc.ps1"
. "$parentDir\win_common\PackageManagerInvokes.ps1"

# All variable definitions at the beginning of the file
$windowsPathFunctionPath = Join-Path $parentDir "win_common\WindowsPathFunction.ps1"
$postinstallDir = Join-Path $PSScriptRoot "postinstall"
$phpPostInstallProcessorPath = Join-Path $postinstallDir "PhpPostInstallProcessor.ps1"

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
$PHP_DOWNLOADS_PAGE_URL = "https://www.php.net/downloads.php"


# PHP installation directories
$PHP_INSTALL_BASE = Join-Path $Global:LANG_COMPILER_DIR "PHP"
$PHP_INSTALL_DIR = Join-Path $PHP_INSTALL_BASE "php$PHP_VERSION_SHORT"
$PHP_CACHE_DIR = Join-Path $Global:SCOOP_CACHE_DIR "php"

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
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Error searching for ${PHP_EXE_NAME}: $($_.Exception.Message)" -Type "Warning"
    }
    
    return $null
}

function Get-LatestPHPVersionFromWeb {
    [CmdletBinding()]
    param ()

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Fetching latest PHP version from official website..." -Type "Info"

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
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Found latest PHP version: $version" -Type "Success"
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Download URL: $downloadUrl" -Type "Info"
                    return $downloadUrl
                }
                else {
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Found PHP version $version but it's below minimum requirement ($PHP_VERSION_DISPLAY)" -Type "Warning"
                }
            }
            catch {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Invalid version format: $version" -Type "Warning"
            }
        }

        Write-ColorMessage -Message "[Step $STEP_NUMBER] Could not find valid PHP $PHP_VERSION_DISPLAY download URL in HTML" -Type "Warning"
    }
    catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to fetch latest PHP version: $($_.Exception.Message)" -Type "Warning"
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

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing PHP $PHP_VERSION (NTS) from web..." -Type "Warning"

    # Create cache directory if it doesn't exist
    if (-not (Test-Path $PHP_CACHE_DIR)) {
        New-Item -ItemType Directory -Path $PHP_CACHE_DIR -Force | Out-Null
    }

    # Create installation directory if it doesn't exist
    if (-not (Test-Path $PHP_INSTALL_DIR)) {
        New-Item -ItemType Directory -Path $PHP_INSTALL_DIR -Force | Out-Null
    }

    # Download PHP archive
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Downloading PHP from $downloadUrl" -Type "Info"
    $downloaded = Get-FileWithSizeCheck -localPath $zipFilePath -remoteUrl $downloadUrl -description "PHP $PHP_VERSION (NTS)"

    # If download failed, try to get latest version from website
    if (-not $downloaded -or -not (Test-Path $zipFilePath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Default download URL failed, fetching latest version from PHP website..." -Type "Warning"
        
        $downloadUrl = Get-LatestPHPVersionFromWeb
        if ($downloadUrl) {
            $zipFileName = Split-Path $downloadUrl -Leaf
            $zipFilePath = Join-Path $PHP_CACHE_DIR $zipFileName
            
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Attempting download from latest version URL: $downloadUrl" -Type "Info"
            $downloaded = Get-FileWithSizeCheck -localPath $zipFilePath -remoteUrl $downloadUrl -description "PHP (NTS)"
        }
        
        if (-not $downloaded -or -not (Test-Path $zipFilePath)) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to download PHP archive from all sources" -Type "Error"
            return $null
        }
    }

    # Extract PHP archive
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Extracting PHP to $PHP_INSTALL_DIR..." -Type "Info"
    try {
        # Use .NET to extract zip (compatible with PowerShell 5.1)
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::ExtractToDirectory($zipFilePath, $PHP_INSTALL_DIR)
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully extracted PHP" -Type "Success"
    }
    catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to extract PHP: $($_.Exception.Message)" -Type "Error"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Removing corrupted ZIP file: $zipFilePath" -Type "Warning"
        if (Test-Path $zipFilePath) {
            Remove-Item -Path $zipFilePath -Force
        }
        return $false
    }

    # Find PHP executable recursively in installation directory
    $phpExePath = Find-PHPExecutable -SearchDirectory $PHP_INSTALL_DIR
    
    if ($phpExePath -and (Test-Path $phpExePath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP installed successfully at $phpExePath" -Type "Success"
        return $phpExePath
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP executable not found after extraction" -Type "Error"
        return $null
    }
}

function Install-PHPWithWinget {
    [CmdletBinding()]
    param ()

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Attempting to install PHP using winget..." -Type "Info"
    
    $wingetExe = Get-Command "winget" -ErrorAction SilentlyContinue
    if (-not $wingetExe) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] winget not available, skipping..." -Type "Warning"
        return $null
    }

    # Try PHP.PHP.8.5 package
    $exePath = Invoke-WingetCommand -Id $PHP_WINGET_PACKAGE_ID -InstallDir $PHP_INSTALL_DIR -Keyword $PHP_EXE_NAME -ForceInstall $false
    
    if ($exePath -and (Test-Path $exePath)) {
        # Verify it's in the expected PHP installation directory
        $exePathDir = Split-Path $exePath -Parent
        if ($exePathDir -eq $PHP_INSTALL_DIR -or $exePathDir -like $PHP_VERSION_PATTERN_8_5) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP installed via winget at $exePath" -Type "Success"
            return $exePath
        }
        else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] winget installed PHP is not in expected $PHP_VERSION_SHORT directory" -Type "Warning"
        }
    }
    else {
        $phpExePath = Find-PHPExecutable -SearchDirectory $PHP_INSTALL_DIR
        if ($phpExePath -and (Test-Path $phpExePath)) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP installed via winget at $phpExePath" -Type "Success"
            return $phpExePath
        }
    }
    
    return $null
}

function Install-PHPWithChoco {
    [CmdletBinding()]
    param ()

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Attempting to install PHP using Chocolatey..." -Type "Info"
    
    $chocoExe = Get-Command "choco" -ErrorAction SilentlyContinue
    if (-not $chocoExe) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Chocolatey not available, skipping..." -Type "Warning"
        return $null
    }

    # Try installing PHP via Chocolatey
    $exePath = Invoke-ChocoCommand -PackageName $PHP_CHOCO_PACKAGE_NAME -InstallDir $PHP_INSTALL_DIR -Keyword $PHP_EXE_NAME -ForceInstall $false
    
    if ($exePath -and (Test-Path $exePath)) {
        $exePathDir = Split-Path $exePath -Parent
        if ($exePathDir -eq $PHP_INSTALL_DIR -or $exePathDir -like $PHP_VERSION_PATTERN_8_5) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP installed via Chocolatey at $exePath" -Type "Success"
            return $exePath
        }
        else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Chocolatey installed PHP is not in expected $PHP_VERSION_SHORT directory" -Type "Warning"
        }
    }
    else {
        $phpExePath = Find-PHPExecutable -SearchDirectory $PHP_INSTALL_DIR
        if ($phpExePath -and (Test-Path $phpExePath)) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP installed via Chocolatey at $phpExePath" -Type "Success"
            return $phpExePath
        }
    }
    
    return $null
}

function Install-PHPWithScoop {
    [CmdletBinding()]
    param ()

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Attempting to install PHP using Scoop..." -Type "Info"
    
    $scoopExe = Get-Command "scoop" -ErrorAction SilentlyContinue
    if (-not $scoopExe) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Scoop not available, skipping..." -Type "Warning"
        return $null
    }

    # Try installing PHP via Scoop
    $exePath = Invoke-ScoopCommand -PackageName $PHP_SCOOP_PACKAGE_NAME -Keyword $PHP_EXE_NAME -ForceInstall $false
    
    if ($exePath -and (Test-Path $exePath)) {
        # Scoop installs to its own directory, but we check if it's the expected PHP package
        if ($exePath -like $PHP_VERSION_PATTERN_85 -or $exePath -like $PHP_VERSION_PATTERN_8_5) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP installed via Scoop at $exePath" -Type "Success"
            return $exePath
        }
        else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Scoop installed PHP is not $PHP_SCOOP_PACKAGE_NAME package" -Type "Warning"
        }
    }
    
    return $null
}



function Set-PHPEnvironmentVariables {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory = $true)]
        [string]$PhpExePath
    )

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting PHP environment variables..." -Type "Info"

    $phpInstallDir = Split-Path $PhpExePath -Parent
    
    # Add PHP directory to PATH
    & $windowsPathFunctionPath "add" $phpInstallDir

    # Set PHP_HOME environment variable
    & $windowsPathFunctionPath "setvar" "PHP_HOME" $phpInstallDir

    # Refresh environment variables in current session
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Refreshing environment variables..." -Type "Info"
    & $windowsPathFunctionPath "refresh-bat"
    $refreshBatchPath = Join-Path $env:TEMP "refresh_env.cmd"
    & $refreshBatchPath

    # Manually refresh PATH in current PowerShell session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP environment variables configured" -Type "Success"
}


function Step16_InstallPHP {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing PHP $PHP_VERSION_DISPLAY for Laravel development..." -Type "Info"

    # Check if PHP is already installed in expected directory
    $phpExePath = $null
    $needsInstall = $true

    if (Verify-PHPBinary) {
        $phpExePath = Find-PHPExecutable -SearchDirectory $PHP_INSTALL_DIR
        if ($phpExePath) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Found existing PHP $PHP_VERSION_DISPLAY installation at $phpExePath" -Type "Success"
            $needsInstall = $false
        }
    }

    # Install PHP if not already installed with acceptable version
    if ($needsInstall) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP $PHP_VERSION_DISPLAY not found, starting installation with fallback methods..." -Type "Warning"
        
        # Try installation methods in order: direct download -> choco -> scoop -> winget (winget last as fallback)
        $installationMethods = @(
            @{ Name = "direct download"; Function = { Install-PHPFromWeb } },
            @{ Name = "choco"; Function = { Install-PHPWithChoco } },
            @{ Name = "scoop"; Function = { Install-PHPWithScoop } },
            @{ Name = "winget"; Function = { Install-PHPWithWinget } }
        )
        
        foreach ($method in $installationMethods) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Trying installation method: $($method.Name)..." -Type "Info"
            $result = & $method.Function
            if ($result) {
                $phpExePath = $result
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully installed PHP using $($method.Name)" -Type "Success"
                break
            }
            else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Installation method $($method.Name) failed, trying next method..." -Type "Warning"
            }
        }

        if (-not $phpExePath) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] All installation methods failed" -Type "Error"
            Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
            return
        }
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP already installed, proceeding with configuration and repair..." -Type "Info"
    }

    # Always run configuration and repair steps (even if PHP is already installed)
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Running configuration and repair steps..." -Type "Info"

    # Set environment variables (always run to ensure correct setup, continue even if fails)
    try {
        Set-PHPEnvironmentVariables -PhpExePath $phpExePath
    }
    catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: Failed to set environment variables: $($_.Exception.Message)" -Type "Warning"
    }

    # Get PHP installation directory
    $phpInstallDir = Split-Path $phpExePath -Parent

    # Import and run PhpPostInstallProcessor for configuration (always run to fix/update configuration, continue even if fails)
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Running PHP post-installation configuration..." -Type "Info"

    try {
        # Import the processor
        . $phpPostInstallProcessorPath

        # Create callback hashtable for full_setup operation
        $phpCallback = @{
            Operation = "full_setup"
        }

        # Get actual PHP version for display (optional, not for validation)
        $actualPhpVersion = $PHP_VERSION_DISPLAY
        try {
            $versionOutput = & $phpExePath --version 2>&1 | Select-Object -First 1
            if ($versionOutput -match 'PHP (\d+\.\d+\.\d+)') {
                $actualPhpVersion = $matches[1]
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
            -LogPrefix "[Step $STEP_NUMBER]"
    }
    catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: Failed to run PhpPostInstallProcessor: $($_.Exception.Message)" -Type "Warning"
    }


    Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP installation and configuration completed" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

# Execute PHP installation
Step16_InstallPHP
