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

# Import variable management functions and global variables
. "$PSScriptRoot\..\win_common\GlobalVars.ps1"
. "$PSScriptRoot\..\win_common\CommonFunc.ps1"

$STEP_NUMBER = 1

function Test-SystemRequirements {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Verifying system requirements..." -Type "Info"

    # Check Windows version
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking Windows version..." -Type "Info"
    $osInfo = Get-CimInstance Win32_OperatingSystem
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Operating System: $($osInfo.Caption)" -Type "Success"

    # Check available disk space
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking available disk space..." -Type "Info"
    $disk = Get-PSDrive D
    $freeSpaceGB = [math]::Round($disk.Free / 1GB, 2)
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Free space on D: drive: $freeSpaceGB GB" -Type "Success"
    
    if ($freeSpaceGB -lt 50) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Error: Insufficient disk space. At least 50 GB required." -Type "Error"
    }

    # Display memory info without requirement check
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking system memory..." -Type "Info"
    $memory = Get-CimInstance Win32_ComputerSystem
    $totalMemoryGB = [math]::Round($memory.TotalPhysicalMemory / 1GB, 2)
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Total RAM: $totalMemoryGB GB" -Type "Success"

    Write-ColorMessage -Message "[Step $STEP_NUMBER] System requirements verified" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

# Initialize Base Structure
function Initialize-BaseStructure {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Initializing base structure..." -Type "Info"

    # Get system name from variable storage
    $systemName = $systemName

    # Define all base directories
    $baseDirectories = @{
        "BASE_DIR"                = $BASE_DIR
        "APPS_DIR"                = $APPS_DIR
        "TEMP_DIR"                = $TEMP_DIR
        "DOWNLOADS_DIR"           = $DOWNLOADS_DIR
        "LOGS_DIR"                = $LOGS_DIR
        "LOG_FILE"                = $LOG_FILE
        "PROJECT_ROOT_DIR"        = $PROJECT_ROOT_DIR
        "PROJECT_DIR"             = $PROJECT_DIR
        "PROJECT_SCRIPTS_DIR"     = $PROJECT_SCRIPTS_DIR
        "PROJECT_WIN_SCRIPTS_DIR" = $PROJECT_WIN_SCRIPTS_DIR
        "CHOCO_DIR"               = $CHOCO_DIR
        "SCOOP_CACHE_DIR"         = $SCOOP_CACHE_DIR
        "SCOOP_DIR"               = $SCOOP_DIR
        "SCOOP_GLOBAL_DIR"        = $SCOOP_GLOBAL_DIR
        "CHOCO_CACHE_DIR"         = $CHOCO_CACHE_DIR
    }

    # Normalize PROJECT_DIR path for comparison
    $normalizedProjectDir = $PROJECT_DIR.TrimEnd('\')

    # Create directories and save variables
    $stepCount = 1
    foreach ($dir in $baseDirectories.GetEnumerator()) {
        $formattedStep = "0.{0:00}" -f $stepCount
        $normalizedDirValue = $dir.Value.TrimEnd('\')

        # Check if this is PROJECT_DIR itself
        if ($normalizedDirValue -eq $normalizedProjectDir) {
            if (-not (Test-Path $PROJECT_DIR)) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Skipping $($dir.Key): $($dir.Value) (PROJECT_DIR must be cloned via Step7, not created manually)" -Type "Warning"
                $stepCount++
                continue
            }
        }

        # Check if this is a subdirectory of PROJECT_DIR (but not PROJECT_DIR itself)
        $isProjectSubDir = $normalizedDirValue.StartsWith("$normalizedProjectDir\", [System.StringComparison]::OrdinalIgnoreCase)

        if ($isProjectSubDir) {
            # This is a subdirectory of PROJECT_DIR, check if PROJECT_DIR exists
            if (-not (Test-Path $PROJECT_DIR)) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Skipping $($dir.Key): $($dir.Value) (PROJECT_DIR does not exist)" -Type "Warning"
                $stepCount++
                continue
            }
        }

        if (-not (Test-Path $dir.Value)) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Creating directory: $($dir.Value)" -Type "Warning"
            New-Item -ItemType Directory -Path $dir.Value -Force | Out-Null
        }
        $stepCount++
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Base structure initialization completed" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

# Step 1: Initialize Base Directories
function Step1_InitializeBaseDirectories {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Initializing base directories..." -Type "Info"

    # Get system name from variable storage
    $systemName = $systemName

    # Define all required directories with their environment variable names
    $directories = @{
        "LANG_COMPILER_DIR" = $LANG_COMPILER_DIR
        "APP_INSTALL_DIR"   = $APP_INSTALL_DIR
        "USER_DIR"          = $USER_DIR
        "USER_CACHE_DIR"    = $USER_CACHE_DIR
        "GIT_CONFIG_DIR"    = $GIT_CONFIG_DIR
        "USER_CONFIG_DIR"   = $USER_CONFIG_DIR
        "SCRIPTS_DIR"       = $SCRIPTS_DIR
        "APP_INSTALLED_FLAG_DIR" = $APP_INSTALLED_FLAG_DIR
    }

    # Create directories and set environment variables
    $stepCount = 2
    foreach ($dir in $directories.GetEnumerator()) {
        $formattedStep = "1.{0:00}" -f $stepCount
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting up $($dir.Key)" -Type "Info"
        
        # Create directory if it doesn't exist
        if (-not (Test-Path $dir.Value)) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Creating directory: $($dir.Value)" -Type "Warning"
            New-Item -ItemType Directory -Path $dir.Value -Force | Out-Null
        }

        $stepCount++
    }

    # Create and check WINGET flag file
    $formattedStep = "1.{0:00}" -f $stepCount
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting up WINGET_FLAG_FILE" -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Base directory initialization completed" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

# Function to get directory path from variable storage
function Get-DirectoryPath {
    param(
        [string]$key,
        [string]$defaultValue = ""
    )
    return Get-VariableFromFile -key $key -defaultValue $defaultValue
}

# Check and set execution policy if needed
$currentPolicy = Get-ExecutionPolicy
if ($currentPolicy -ne 'RemoteSigned' -and $currentPolicy -ne 'Bypass') {
    try {
        Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Force -ErrorAction Stop
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Execution policy set to RemoteSigned" -Type "Success"
    }
    catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Note: Execution policy is managed by system policy and cannot be changed locally" -Type "Warning"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Current effective policy: $currentPolicy" -Type "Warning"
    }
}

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

Test-SystemRequirements
Initialize-BaseStructure
Step1_InitializeBaseDirectories
