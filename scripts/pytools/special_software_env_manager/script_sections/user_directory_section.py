"""
User Directory Section Generator

Generates custom user directory sections for Windows and Linux.
"""


class UserDirectorySectionGenerator:
    """Generates custom user directory sections"""

    @staticmethod
    def generate_windows_user_directory_section() -> str:
        """Generate Windows PowerShell custom user directory section"""
        return """
#region Initialize Path Variables
$scriptActualPath = $PSCommandPath
$item = Get-Item -LiteralPath $PSCommandPath
if ($item -and $item -is [System.IO.FileInfo] -and $item.LinkType) {
    $scriptActualPath = $item.Target
}
$scriptCurrentPath = Split-Path $scriptActualPath -Parent
if (-not $scriptCurrentPath) {
    $scriptCurrentPath = $PSScriptRoot
    if (-not $scriptCurrentPath) {
        $scriptCurrentPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    }
}
$scriptsDirPath = Split-Path $scriptCurrentPath -Parent
$projectRootPath = Split-Path $scriptsDirPath -Parent
$shellsDirPath = Join-Path $scriptsDirPath "shells"
$winDirPath = Join-Path $shellsDirPath "win"
$winCommonDirPath = Join-Path $winDirPath "win_common"
$pytoolsDirPath = Join-Path $scriptsDirPath "pytools"
$aiToolsDirPath = Join-Path $pytoolsDirPath "ai_tools"
# Path resolution algorithm:
#   Script -> Scripts Dir -> Project Root -> Tool-specific directories
Write-Host "[DEBUG] Script Path: $scriptCurrentPath" -ForegroundColor DarkGray
Write-Host "[DEBUG] Scripts Dir: $scriptsDirPath" -ForegroundColor DarkGray
Write-Host "[DEBUG] Project Root: $projectRootPath" -ForegroundColor DarkGray
#endregion
# Path resolution algorithm:
#   Script -> Scripts Dir -> Project Root -> Tool-specific directories

#region Custom User Directory Configuration
# ============================================================================
# CUSTOM USER DIRECTORY SETTING
# ============================================================================
# Auto-scans D:\\.tmp\\Users\\ for existing MyBest1, MyBest2, etc.
# Usage: script.ps1 [number|MyBestX]
#   - If number is provided: uses D:\\.tmp\\Users\\MyBest[number]
#   - If full name is provided (e.g., MyBest1): uses D:\\.tmp\\Users\\MyBest1
#   - If no argument: auto-finds next available MyBest[X] or creates new one
# ============================================================================

$baseTempDir = "D:\\.tmp\\Users"
$userDirPrefix = "MyBest"

# Get directory name/number from command line argument (if provided)
$userDirName = $null
if ($args.Count -gt 0) {
    $argValue = $args[0]
    # Check if it's a number
    if ($argValue -match '^\\d+$') {
        $userDirName = "$userDirPrefix$argValue"
        Write-Host "[INFO] Using specified number: $argValue -> $userDirName" -ForegroundColor Cyan
    }
    # Check if it's a full name (MyBestX format)
    elseif ($argValue -match "^$userDirPrefix\\d+$") {
        $userDirName = $argValue
        Write-Host "[INFO] Using specified full name: $userDirName" -ForegroundColor Cyan
    }
}

# If no argument specified, auto-scan for existing MyBest directories
if ($null -eq $userDirName) {
    Write-Host "[INFO] Auto-scanning for existing MyBest directories..." -ForegroundColor Cyan
    
    # Create base directory if it doesn't exist
    if (-not (Test-Path $baseTempDir)) {
        Write-Host "[INFO] Creating base directory: $baseTempDir" -ForegroundColor Cyan
        New-Item -ItemType Directory -Path $baseTempDir -Force | Out-Null
    }
    
    # Find existing MyBest directories
    $existingNumbers = @()
    if (Test-Path $baseTempDir) {
        $existingDirs = Get-ChildItem -Path $baseTempDir -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "^$userDirPrefix(\\d+)$" }
        foreach ($dir in $existingDirs) {
            if ($dir.Name -match "^$userDirPrefix(\\d+)$") {
                $num = [int]$matches[1]
                $existingNumbers += $num
            }
        }
    }
    
    # Find next available number
    if ($existingNumbers.Count -gt 0) {
        $existingNumbers = $existingNumbers | Sort-Object
        $maxNumber = $existingNumbers[-1]
        $nextNumber = $maxNumber + 1
        $userDirName = "$userDirPrefix$nextNumber"
        Write-Host "[INFO] Found existing MyBest directories: $($existingNumbers -join ', ')" -ForegroundColor Gray
        Write-Host "[INFO] Using next available number: $nextNumber -> $userDirName" -ForegroundColor Cyan
    } else {
        $userDirName = "$userDirPrefix" + "1"
        Write-Host "[INFO] No existing MyBest directories found, starting with: $userDirName" -ForegroundColor Cyan
    }
}

# Build directory path
$CustomUserDirectory = Join-Path $baseTempDir $userDirName

# Create the directory if it doesn't exist
try {
    if (-not (Test-Path $baseTempDir)) {
        Write-Host "[INFO] Creating base directory: $baseTempDir" -ForegroundColor Cyan
        New-Item -ItemType Directory -Path $baseTempDir -Force | Out-Null
    }

    if (-not (Test-Path $CustomUserDirectory)) {
        Write-Host "[INFO] Creating custom user directory: $CustomUserDirectory" -ForegroundColor Cyan
        New-Item -ItemType Directory -Path $CustomUserDirectory -Force | Out-Null
    }

    # Verify directory was created successfully
    if (Test-Path $CustomUserDirectory) {
        $userProfilePath = $CustomUserDirectory
        Write-Host "[SUCCESS] Using MyBest directory: $userProfilePath" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Failed to create custom directory, falling back to system default" -ForegroundColor Yellow
        $userProfilePath = $env:USERPROFILE
        if (-not $userProfilePath) {
            $userProfilePath = [Environment]::GetFolderPath("UserProfile")
        }
        Write-Host "[INFO] Using system default user directory: $userProfilePath" -ForegroundColor Cyan
    }
} catch {
    Write-Host "[ERROR] Failed to create custom user directory: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "[INFO] Falling back to system default..." -ForegroundColor Yellow
    $userProfilePath = $env:USERPROFILE
    if (-not $userProfilePath) {
        $userProfilePath = [Environment]::GetFolderPath("UserProfile")
    }
    Write-Host "[INFO] Using system default user directory: $userProfilePath" -ForegroundColor Cyan
}

$userHomePath = $userProfilePath
$usersDirectoryPath = Split-Path $userProfilePath -Parent

# Set environment variables for Node.js, React, Python, and other applications
# ============================================================================
# These environment variables will be available to all child processes
# including Node.js, React, Python, and other applications launched from this script
#
# Python usage examples:
#   import os
#   user_home = os.expanduser("~")  # Uses HOME or USERPROFILE
#   user_home = os.getenv("USERPROFILE") or os.getenv("HOME")
#   from pathlib import Path
#   user_home = Path.home()  # Uses HOME or USERPROFILE
# ============================================================================
$env:USERPROFILE = $userProfilePath
$env:HOME = $userProfilePath
$env:USER_HOME = $userProfilePath
$env:HOMEPATH = $userProfilePath
$env:USER_DIR = $userProfilePath

Write-Host "[INFO] Environment variables set for Node.js/React/Python applications:" -ForegroundColor Cyan
Write-Host "  USERPROFILE = $env:USERPROFILE" -ForegroundColor Gray
Write-Host "  HOME = $env:HOME" -ForegroundColor Gray
Write-Host "  USER_HOME = $env:USER_HOME" -ForegroundColor Gray
Write-Host "  HOMEPATH = $env:HOMEPATH" -ForegroundColor Gray
Write-Host "  USER_DIR = $env:USER_DIR" -ForegroundColor Gray
Write-Host ""
#endregion

# Test path resolution (can be removed in production)
Write-Host "[DEBUG] Path Resolution Test:" -ForegroundColor Magenta
Write-Host "  Script Path: $scriptCurrentPath" -ForegroundColor Gray
Write-Host "  Scripts Dir: $scriptsDirPath" -ForegroundColor Gray
Write-Host "  Shells Dir: $shellsDirPath" -ForegroundColor Gray
Write-Host "  Win Dir: $winDirPath" -ForegroundColor Gray
Write-Host "  Win Common Dir: $winCommonDirPath" -ForegroundColor Gray
Write-Host "  PyTools Dir: $pytoolsDirPath" -ForegroundColor Gray
Write-Host "  AI Tools Dir: $aiToolsDirPath" -ForegroundColor Gray
Write-Host "  User Profile: $userProfilePath" -ForegroundColor Gray
Write-Host "  User Home: $userHomePath" -ForegroundColor Gray
Write-Host "  Users Directory: $usersDirectoryPath" -ForegroundColor Gray
Write-Host ""
#endregion
"""

    @staticmethod
    def generate_linux_user_directory_section() -> str:
        """Generate Linux bash custom user directory section"""
        return """
#region Initialize Path Variables
# Resolve script real path (handle symlinks)
# When script is executed via symlink, BASH_SOURCE[0] returns symlink path
# We need to resolve it to actual file path to get correct directory
scriptSource="${BASH_SOURCE[0]}"
# Check if scriptSource is a symlink and resolve it
if [ -L "$scriptSource" ]; then
    # Resolve symlink to actual file path
    scriptSource="$(readlink -f "$scriptSource" 2>/dev/null || echo "$scriptSource")"
fi
# Get absolute path of script directory
scriptCurrentPath="$(cd "$(dirname "$scriptSource")" && pwd)"

# Calculate project structure paths
# Expected structure: project_root/scripts/linuxenvs/script.sh
scriptsDirPath="$(cd "$scriptCurrentPath/.." && pwd)"
projectRootPath="$(cd "$scriptsDirPath/.." && pwd)"

# Additional paths (optional, for compatibility)
shellsDirPath="$scriptsDirPath/shells"
linuxDirPath="$shellsDirPath/linux"
linuxCommonDirPath="$linuxDirPath/linux_common"
pytoolsDirPath="$scriptsDirPath/pytools"
ai_tools_dir_path="$pytoolsDirPath/ai_tools"

# Path resolution algorithm:
#   Script (resolve symlink) -> Script Dir (linuxenvs) -> Scripts Dir -> Project Root

echo "[DEBUG] scriptSource:      $scriptSource"
echo "[DEBUG] scriptCurrentPath: $scriptCurrentPath"
echo "[DEBUG] scriptsDirPath:    $scriptsDirPath"
echo "[DEBUG] projectRootPath:   $projectRootPath"

#region Custom User Directory Configuration
# ============================================================================
# CUSTOM USER DIRECTORY SETTING
# ============================================================================
# Auto-scans /var/_core_node/Users/ for existing MyBest1, MyBest2, etc.
# Usage: script.sh [number|MyBestX]
#   - If number is provided: uses /var/_core_node/Users/MyBest[number]
#   - If full name is provided (e.g., MyBest1): uses /var/_core_node/Users/MyBest1
#   - If no argument: auto-finds next available MyBest[X] or creates new one
# ============================================================================

baseTempDir="/var/_core_node/Users"
userDirPrefix="MyBest"

# Get directory name/number from command line argument (if provided)
userDirName=""
if [ $# -gt 0 ]; then
    argValue="$1"
    # Check if it's a number
    if [[ "$argValue" =~ ^[0-9]+$ ]]; then
        userDirName="${userDirPrefix}${argValue}"
        echo "[INFO] Using specified number: $argValue -> $userDirName"
    # Check if it's a full name (MyBestX format)
    elif [[ "$argValue" =~ ^${userDirPrefix}[0-9]+$ ]]; then
        userDirName="$argValue"
        echo "[INFO] Using specified full name: $userDirName"
    fi
fi

# If no argument specified, auto-scan for existing MyBest directories
if [ -z "$userDirName" ]; then
    echo "[INFO] Auto-scanning for existing MyBest directories..."
    
    # Create base directory if it doesn't exist
    if [ ! -d "$baseTempDir" ]; then
        echo "[INFO] Creating base directory: $baseTempDir"
        mkdir -p "$baseTempDir"
    fi
    
    # Find existing MyBest directories
    existingNumbers=()
    if [ -d "$baseTempDir" ]; then
        for dir in "$baseTempDir"/${userDirPrefix}[0-9]*; do
            if [ -d "$dir" ]; then
                dirName=$(basename "$dir")
                if [[ "$dirName" =~ ^${userDirPrefix}([0-9]+)$ ]]; then
                    num="${BASH_REMATCH[1]}"
                    existingNumbers+=("$num")
                fi
            fi
        done
    fi
    
    # Find next available number
    if [ ${#existingNumbers[@]} -gt 0 ]; then
        # Find max number
        maxNumber=0
        for num in "${existingNumbers[@]}"; do
            if [ "$num" -gt "$maxNumber" ]; then
                maxNumber="$num"
            fi
        done
        nextNumber=$((maxNumber + 1))
        userDirName="${userDirPrefix}${nextNumber}"
        echo "[INFO] Found existing MyBest directories: ${existingNumbers[*]}"
        echo "[INFO] Using next available number: $nextNumber -> $userDirName"
    else
        userDirName="${userDirPrefix}1"
        echo "[INFO] No existing MyBest directories found, starting with: $userDirName"
    fi
fi

# Build directory path
CustomUserDirectory="$baseTempDir/$userDirName"

# Create the directory if it doesn't exist
if [ ! -d "$baseTempDir" ]; then
    echo "[INFO] Creating base directory: $baseTempDir"
    mkdir -p "$baseTempDir"
fi

if [ ! -d "$CustomUserDirectory" ]; then
    echo "[INFO] Creating custom user directory: $CustomUserDirectory"
    mkdir -p "$CustomUserDirectory"
fi

# Verify directory was created successfully
if [ -d "$CustomUserDirectory" ]; then
    userProfilePath="$CustomUserDirectory"
    echo "[SUCCESS] Using MyBest directory: $userProfilePath"
else
    echo "[WARNING] Failed to create custom directory, falling back to system default"
    userProfilePath="$HOME"
    echo "[INFO] Using system default user directory: $userProfilePath"
fi

userHomePath="$userProfilePath"
usersDirectoryPath="$(dirname "$userProfilePath")"

# Set environment variables for Node.js, React, Python, and other applications
# ============================================================================
# These environment variables will be available to all child processes
# including Node.js, React, Python, and other applications launched from this script
#
# Python usage examples:
#   import os
#   user_home = os.expanduser("~")  # Uses HOME
#   user_home = os.getenv("HOME")
#   from pathlib import Path
#   user_home = Path.home()  # Uses HOME
# ============================================================================
export HOME="$userProfilePath"
export USER_HOME="$userProfilePath"
export USER_DIR="$userProfilePath"

echo "[INFO] Environment variables set for Node.js/React/Python applications:"
echo "  HOME = $HOME"
echo "  USER_HOME = $USER_HOME"
echo "  USER_DIR = $USER_DIR"
echo ""
#endregion

#endregion
"""


__all__ = ['UserDirectorySectionGenerator']

