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
$STEP_NUMBER = 7

# Import variable management functions
$parentDir = Split-Path $PSScriptRoot -Parent
. "$parentDir\win_common\GlobalVars.ps1"
. "$parentDir\win_common\CommonFunc.ps1"

# Get WindowsPathFunction.ps1 path
$windowsPathFunctionPath = Join-Path $parentDir "win_common\WindowsPathFunction.ps1"

# Import PhpPostInstallProcessor
$postinstallDir = Join-Path $PSScriptRoot "postinstall"
$phpPostInstallProcessorPath = Join-Path $postinstallDir "PhpPostInstallProcessor.ps1"

# PHP version configuration
$PHP_VERSION = "8.4.15"
$PHP_VERSION_SHORT = "8.4"

# PHP download URLs for version 8.4.15
$PHP_NTS_URL = "https://downloads.php.net/~windows/releases/archives/php-$PHP_VERSION-nts-Win32-vs17-x64.zip"
$PHP_NTS_DEBUG_URL = "https://downloads.php.net/~windows/releases/archives/php-debug-pack-$PHP_VERSION-nts-Win32-vs17-x64.zip"
$PHP_TS_URL = "https://downloads.php.net/~windows/releases/archives/php-$PHP_VERSION-Win32-vs17-x64.zip"
$PHP_TS_DEBUG_URL = "https://downloads.php.net/~windows/releases/archives/php-debug-pack-$PHP_VERSION-Win32-vs17-x64.zip"

# PHP installation directories
$PHP_INSTALL_BASE = Join-Path $Global:LANG_COMPILER_DIR "PHP"
$PHP_INSTALL_DIR = Join-Path $PHP_INSTALL_BASE "php$PHP_VERSION_SHORT"
$PHP_CACHE_DIR = Join-Path $Global:SCOOP_CACHE_DIR "php"

# PHP executables
$PHP_EXE_PATH = Join-Path $PHP_INSTALL_DIR "php.exe"

# Preferred PHP type (NTS for Laravel Octane, TS for traditional web apps)
$PHP_PREFERRED_TYPE = "nts"

function Install-PHPFromWeb {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$false)]
        [string]$PhpType = "nts"
    )

    $downloadUrl = if ($PhpType -eq "nts") { $PHP_NTS_URL } else { $PHP_TS_URL }
    $debugUrl = if ($PhpType -eq "nts") { $PHP_NTS_DEBUG_URL } else { $PHP_TS_DEBUG_URL }
    $zipFileName = Split-Path $downloadUrl -Leaf
    $zipFilePath = Join-Path $PHP_CACHE_DIR $zipFileName

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing PHP $PHP_VERSION ($PhpType)..." -Type "Warning"

    # Create cache directory if it doesn't exist
    if (-not (Test-Path $PHP_CACHE_DIR)) {
        New-Item -ItemType Directory -Path $PHP_CACHE_DIR -Force | Out-Null
    }

    # Create installation directory if it doesn't exist
    if (-not (Test-Path $PHP_INSTALL_DIR)) {
        New-Item -ItemType Directory -Path $PHP_INSTALL_DIR -Force | Out-Null
    }

    # Download PHP archive with mirror support
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Downloading PHP from $downloadUrl" -Type "Info"
    $downloaded = Get-FileWithSizeCheck -localPath $zipFilePath -remoteUrl $downloadUrl -description "PHP $PHP_VERSION ($PhpType)"

    if (-not $downloaded -or -not (Test-Path $zipFilePath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to download PHP archive" -Type "Error"
        return $false
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
        return $false
    }

    # Verify PHP installation
    if (Test-Path $PHP_EXE_PATH) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP installed successfully at $PHP_EXE_PATH" -Type "Success"

        # Get PHP version info
        $phpVersionOutput = & $PHP_EXE_PATH --version 2>&1
        Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP Version: $phpVersionOutput" -Type "Info"

        return $true
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP executable not found after extraction" -Type "Error"
        return $false
    }
}


function Set-PHPEnvironmentVariables {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting PHP environment variables..." -Type "Info"

    if (Test-Path $PHP_EXE_PATH) {
        # Add PHP directory to PATH
        & $windowsPathFunctionPath "add" $PHP_INSTALL_DIR

        # Set PHP_HOME environment variable
        & $windowsPathFunctionPath "setvar" "PHP_HOME" $PHP_INSTALL_DIR

        # Refresh environment variables in current session
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Refreshing environment variables..." -Type "Info"
        & $windowsPathFunctionPath "refresh-bat"
        $refreshBatchPath = Join-Path $env:TEMP "refresh_env.cmd"
        if (Test-Path $refreshBatchPath) {
            & $refreshBatchPath
        }

        # Manually refresh PATH in current PowerShell session
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

        Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP environment variables configured" -Type "Success"
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP executable not found, skipping environment setup" -Type "Warning"
    }
}


function Step7_InstallPHP {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing PHP $PHP_VERSION for Laravel development..." -Type "Info"

    # Check if PHP binary exists
    $phpInstalled = $false

    if (Test-Path $PHP_EXE_PATH) {
        $phpInstalled = $true
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Found existing PHP at $PHP_EXE_PATH" -Type "Success"

        # Get PHP version
        try {
            $phpVersionOutput = & $PHP_EXE_PATH --version 2>&1
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Current Version: $phpVersionOutput" -Type "Info"
        }
        catch {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: Could not determine PHP version" -Type "Warning"
        }
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP not found, starting installation..." -Type "Warning"
    }

    # Install PHP if not already installed
    if (-not $phpInstalled) {
        $phpInstalled = Install-PHPFromWeb -PhpType $PHP_PREFERRED_TYPE

        if (-not $phpInstalled) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to install PHP" -Type "Error"
            Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
            return
        }
    }

    # Set environment variables (always run to ensure correct setup)
    Set-PHPEnvironmentVariables

    # Import and run PhpPostInstallProcessor for configuration (always run to fix/update configuration)
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Running PHP post-installation configuration..." -Type "Info"

    if (Test-Path $phpPostInstallProcessorPath) {
        # Import the processor
        . $phpPostInstallProcessorPath

        # Create callback hashtable for full_setup operation
        $phpCallback = @{
            Operation = "full_setup"
        }

        # Run the post-install processor
        $postInstallSuccess = Invoke-PhpPostInstallProcessor `
            -PhpCallback $phpCallback `
            -PackageName "PHP $PHP_VERSION" `
            -ExecutablePath $PHP_EXE_PATH `
            -InstallDir $PHP_INSTALL_DIR `
            -LogPrefix "[Step $STEP_NUMBER]"

        if ($postInstallSuccess) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP post-installation configuration completed successfully" -Type "Success"
        }
        else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP post-installation configuration encountered errors" -Type "Warning"
        }
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: PhpPostInstallProcessor not found at $phpPostInstallProcessorPath" -Type "Warning"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Skipping advanced configuration" -Type "Warning"
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] PHP installation and configuration completed" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

# Execute PHP installation
Step7_InstallPHP
