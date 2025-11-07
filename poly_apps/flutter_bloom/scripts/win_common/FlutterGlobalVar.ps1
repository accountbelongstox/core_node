# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Flutter Global Variables and Constants System
# Cross-platform variable exchange between PowerShell and Python
# Author: Development Script System
# Version: 2.1

# Core Constants - DO NOT MODIFY
$Global:SCRIPT_ROOT_DIR = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Global:DEV_SCRIPT_DIR = Join-Path $Global:SCRIPT_ROOT_DIR "dev"
$Global:DEV_DEBUG_DIR = Join-Path $Global:SCRIPT_ROOT_DIR "scripts\dev_debug"
$Global:BUILD_SCRIPTS_DIR = Join-Path $Global:SCRIPT_ROOT_DIR "scripts\build_scripts"
$Global:BUILD_DIR = "D:\programing\.build_dir"
$Global:FLUTTER_PROJECT_DIR = $Global:SCRIPT_ROOT_DIR

# FTemp Directory Configuration - Using user home .core_node cache
$Global:CORE_NODE_USER_CACHE = Join-Path $env:USERPROFILE ".core_node\.flutter_build\.cache"
$Global:FTEMP_FLUTTER_DIR = Join-Path $Global:CORE_NODE_USER_CACHE "flutter_bloom"

# Use home directory for cross-session cache
$Global:CACHE_BASE_DIR = Join-Path $env:USERPROFILE ".flutter_bloom_cache"
$Global:CACHE_FLUTTER_DIR = Join-Path $Global:CACHE_BASE_DIR "settings"

# New constants for external safe build
$Global:ASSETS_PLUGIN_DIR_TEMPLATE = "$Global:BUILD_DIR\assets_{app-name}"
$Global:ASSETS_INTERNAL_PLUGIN_DIR_TEMPLATE = "$Global:FLUTTER_PROJECT_DIR\assets\.internal_{appname}"

# Debug Mode Configuration
$Global:DEBUG_MODE = $false

# Gvar Exchange Directory - Updated to use .core_node directory
$Global:CORE_NODE_BASE_DIR = Join-Path $env:USERPROFILE ".core_node"
$Global:FLUTTER_BUILD_BASE_DIR = Join-Path $Global:CORE_NODE_BASE_DIR ".flutter_build"
$Global:GVAR_EXCHANGE_DIR = Join-Path $Global:FLUTTER_BUILD_BASE_DIR "global_vars"

# Build cache directory constants - Added for temp_build_dir.txt
$Global:TEMP_BUILD_DIR_FILE = "temp_build_dir.txt"

# Logging system directory constants
$Global:LOG_BASE_DIR = Join-Path $env:USERPROFILE ".core_node\.flutter_build\logs"

# Step 4 extended shared variables for complete image processing information
$Global:STEP4_PROCESSED_PATH_PREFIX = "STEP4_PROCESSED_PATH_"
$Global:STEP4_FILENAME_PREFIX = "STEP4_FILENAME_"
$Global:STEP4_FILE_SIZE_PREFIX = "STEP4_FILE_SIZE_"
$Global:STEP4_FORMAT_PREFIX = "STEP4_FORMAT_"
$Global:STEP4_COMPRESSION_MODE_PREFIX = "STEP4_COMPRESSION_MODE_"
$Global:STEP4_SOURCE_TYPE_PREFIX = "STEP4_SOURCE_TYPE_"
$Global:STEP4_IS_FALLBACK_PREFIX = "STEP4_IS_FALLBACK_"
$Global:STEP4_FALLBACK_FROM_PREFIX = "STEP4_FALLBACK_FROM_"
$Global:STEP4_FALLBACK_REASON_PREFIX = "STEP4_FALLBACK_REASON_"
$Global:STEP4_PROCESSING_TIMESTAMP_PREFIX = "STEP4_PROCESSING_TIMESTAMP_"
$Global:STEP4_ORIGINAL_PATH_PREFIX = "STEP4_ORIGINAL_PATH_"

# Platform Detection (defensive for different PowerShell versions)
$plat = $null
if ($PSVersionTable -is [hashtable] -and $PSVersionTable.ContainsKey('Platform')) {
    $plat = $PSVersionTable['Platform']
}
$osEnv = $env:OS
$Global:IS_WINDOWS = ($plat -eq 'Win32NT') -or ($osEnv -eq 'Windows_NT')
$Global:IS_LINUX = ($plat -eq 'Unix') -and -not $Global:IS_WINDOWS
$Global:IS_MACOS = $false

# Build Configuration
$Global:ORIGINAL_CONFIG_FILE = Join-Path $Global:DEV_SCRIPT_DIR "original_config.ini"
$Global:BUILD_OPTIONS_FILE = Join-Path $Global:DEV_SCRIPT_DIR "build_option.ini"

# Key Constants - All keys in KEY_ UPPERCASE format for consistency
$Global:KEY_APP_NAME = "KEY_APP_NAME"
$Global:KEY_BUILD_ACTION = "KEY_BUILD_ACTION"
$Global:KEY_BUILD_PLATFORM = "KEY_BUILD_PLATFORM"
$Global:KEY_LAST_SELECTED_APP = "KEY_LAST_SELECTED_APP"
$Global:KEY_LAST_BUILD_ACTION = "KEY_LAST_BUILD_ACTION"
$Global:KEY_LAST_SELECTION_TIME = "KEY_LAST_SELECTION_TIME"
$Global:KEY_APP_DISPLAY_NAME = "KEY_APP_DISPLAY_NAME"
$Global:KEY_APP_ID = "KEY_APP_ID"
$Global:KEY_BUILD_OPTIONS = "KEY_BUILD_OPTIONS"
$Global:KEY_IMAGE_COMPRESSION = "KEY_IMAGE_COMPRESSION"
$Global:KEY_DECRYPT_RESOURCES = "KEY_DECRYPT_RESOURCES"
$Global:KEY_START_BUILD = "KEY_START_BUILD"
$Global:KEY_DEBUG_MODE = "KEY_DEBUG_MODE"
$Global:KEY_EXTERNAL_BUILD_ACTIVE = "KEY_EXTERNAL_BUILD_ACTIVE"
$Global:KEY_FLUTTER_PROJECT_DIR_BY_GVAR = "KEY_FLUTTER_PROJECT_DIR_BY_GVAR"
$Global:KEY_BUILD_COMPLETED = "KEY_BUILD_COMPLETED"
$Global:KEY_BUILD_CONFIRMED = "KEY_BUILD_CONFIRMED"
$Global:KEY_FINAL_WORKING_DIRECTORY = "KEY_FINAL_WORKING_DIRECTORY"
$Global:KEY_LARAVEL_SERVER_STATUS = "KEY_LARAVEL_SERVER_STATUS"
$Global:KEY_LARAVEL_ENVIRONMENT = "KEY_LARAVEL_ENVIRONMENT"
$Global:KEY_LARAVEL_PORT = "KEY_LARAVEL_PORT"
$Global:KEY_LARAVEL_INTEGRATION = "KEY_LARAVEL_INTEGRATION"
$Global:KEY_APP_ACTION_MODE_PREFIX = "KEY_APP_ACTION_MODE_"
$Global:KEY_APP_PLATFORM_MODE_PREFIX = "KEY_APP_PLATFORM_MODE_"
$Global:KEY_LAST_SELECTED_APP_INDEX = "KEY_LAST_SELECTED_APP_INDEX"
$Global:KEY_CURRENT_ACTIVE_APP = "KEY_CURRENT_ACTIVE_APP"
$Global:KEY_CURRENT_ACTIVE_ACTION = "KEY_CURRENT_ACTIVE_ACTION"
$Global:KEY_CURRENT_ACTIVE_PLATFORM = "KEY_CURRENT_ACTIVE_PLATFORM"
$Global:KEY_APP_INDEX = "KEY_APP_INDEX"
$Global:KEY_SELECTED_APP = "KEY_SELECTED_APP"
$Global:KEY_SELECTED_ACTION = "KEY_SELECTED_ACTION"
$Global:KEY_SELECTED_PLATFORM = "KEY_SELECTED_PLATFORM"
$Global:KEY_SELECTED_ENTRY_FILE = "KEY_SELECTED_ENTRY_FILE"
$Global:KEY_DEBUG_PORT = "KEY_DEBUG_PORT"
$Global:KEY_SCRIPT_PATH = "KEY_SCRIPT_PATH"

# New compilation menu keys
$Global:KEY_COMPILATION_MENU_TYPE = "KEY_COMPILATION_MENU_TYPE"
$Global:KEY_SELECTED_COMPILATION_OPTION = "KEY_SELECTED_COMPILATION_OPTION"
$Global:KEY_BUILD_PHASE = "KEY_BUILD_PHASE"
$Global:KEY_LAST_COMPILATION_MENU_SELECTION = "KEY_LAST_COMPILATION_MENU_SELECTION"

# Additional backup and build keys
$Global:KEY_LAST_PUBSPEC_BACKUP_PATH = "KEY_LAST_PUBSPEC_BACKUP_PATH"
$Global:KEY_LAST_PUBSPEC_BACKUP_TIME = "KEY_LAST_PUBSPEC_BACKUP_TIME"
$Global:KEY_DEV_SCRIPT_DIR = "KEY_DEV_SCRIPT_DIR"
$Global:KEY_CURRENT_APP_NAME = "KEY_CURRENT_APP_NAME"
$Global:KEY_LAST_BUILD_APP_NAME = "KEY_LAST_BUILD_APP_NAME"
$Global:KEY_LAST_BUILD_ACTION = "KEY_LAST_BUILD_ACTION"
$Global:KEY_LAST_BUILD_PLATFORM = "KEY_LAST_BUILD_PLATFORM"
$Global:KEY_LAST_BUILD_TIMESTAMP = "KEY_LAST_BUILD_TIMESTAMP"
$Global:KEY_LAST_BUILD_SUCCESS = "KEY_LAST_BUILD_SUCCESS"

# Compilation Options
$Global:COMPILATION_OPTIONS = @(
    @{Name = "Analyze Code - Run static analysis"; Value = "analyze"},
    @{Name = "Clean Build - Remove build cache and rebuild"; Value = "clean"},
    @{Name = "Debug Build - Development version with debugging"; Value = "debug"},
    @{Name = "Profile Build - Performance profiling version"; Value = "profile"},
    @{Name = "Release Build - Production optimized version"; Value = "release"},
    @{Name = "Run Tests - Execute test suite"; Value = "test"}
)

# Key Prefixes for app-specific variables
$Global:KEY_PREFIX_APP = "APP_"
$Global:KEY_PREFIX_BUILD = "BUILD_"
$Global:KEY_PREFIX_CONFIG = "CONFIG_"
$Global:KEY_IMAGECOMPRESSION_PREFIX = "IMAGECOMPRESSION_"
$Global:KEY_APPID_PREFIX = "APPID_"
$Global:KEY_APPDISPLAYNAME_PREFIX = "APPDISPLAYNAME_"
$Global:KEY_BUILDOPTIONS_PREFIX = "BUILDOPTIONS_"

# Step20 Compilation Variables - Added for build mode support
$Global:KEY_COMPILATION_OPTION = "KEY_COMPILATION_OPTION"
$Global:KEY_COMPILATION_COMMAND = "KEY_COMPILATION_COMMAND"
$Global:KEY_BUILD_OUTPUT_DIR = "KEY_BUILD_OUTPUT_DIR"
$Global:KEY_APK_OUTPUT_PATH = "KEY_APK_OUTPUT_PATH"
$Global:KEY_COMPILATION_PLATFORM = "KEY_COMPILATION_PLATFORM"
$Global:KEY_BUILD_ROOT = "KEY_BUILD_ROOT"
$Global:KEY_CLEAN_COMMAND = "KEY_CLEAN_COMMAND"
$Global:KEY_BUILD_TIMESTAMP = "KEY_BUILD_TIMESTAMP"
$Global:KEY_APK_FILE_NAME = "KEY_APK_FILE_NAME"

# Script path keys for compilation commands
$Global:KEY_COMMAND = "KEY_COMMAND"
$Global:KEY_DEBUG_SCRIPT_PATH = "KEY_DEBUG_SCRIPT_PATH"
$Global:KEY_CLEAN_SCRIPT_PATH = "KEY_CLEAN_SCRIPT_PATH"
$Global:KEY_BUILD_COMMAND = "KEY_BUILD_COMMAND"
$Global:KEY_BUILD_SCRIPT_PATH = "KEY_BUILD_SCRIPT_PATH"

# Platform Flutter Directories
$Global:PLATFORM_DIRS = @(
    "android",
    "ios", 
    "windows",
    "linux",
    "macos",
    "web"
)

function Initialize-GvarSystem {
    <#
    .SYNOPSIS
    Initialize the Gvar exchange system - simplified for file-based storage
    #>

    if ($Global:DEBUG_MODE) {
        Write-Host "Initializing Gvar exchange system..." -ForegroundColor Yellow
    }

    # Create .core_node base directory if it doesn't exist
    if (-not (Test-Path $Global:CORE_NODE_BASE_DIR)) {
        New-Item -ItemType Directory -Path $Global:CORE_NODE_BASE_DIR -Force | Out-Null
        if ($Global:DEBUG_MODE) {
            Write-Host "Created .core_node directory: $Global:CORE_NODE_BASE_DIR" -ForegroundColor Green
        }
    }

    # Create .flutter_build directory if it doesn't exist
    if (-not (Test-Path $Global:FLUTTER_BUILD_BASE_DIR)) {
        New-Item -ItemType Directory -Path $Global:FLUTTER_BUILD_BASE_DIR -Force | Out-Null
        if ($Global:DEBUG_MODE) {
            Write-Host "Created .flutter_build directory: $Global:FLUTTER_BUILD_BASE_DIR" -ForegroundColor Green
        }
    }

    # Create global_vars exchange directory if it doesn't exist
    if (-not (Test-Path $Global:GVAR_EXCHANGE_DIR)) {
        New-Item -ItemType Directory -Path $Global:GVAR_EXCHANGE_DIR -Force | Out-Null
        if ($Global:DEBUG_MODE) {
            Write-Host "Created Gvar exchange directory: $Global:GVAR_EXCHANGE_DIR" -ForegroundColor Green
        }
    }

    # Create FTemp directory if it doesn't exist
    if (-not (Test-Path $Global:FTEMP_FLUTTER_DIR)) {
        New-Item -ItemType Directory -Path $Global:FTEMP_FLUTTER_DIR -Force | Out-Null
        if ($Global:DEBUG_MODE) {
            Write-Host "Created FTemp directory: $Global:FTEMP_FLUTTER_DIR" -ForegroundColor Green
        }
    }

    # Create cache directory if it doesn't exist
    if (-not (Test-Path $Global:CACHE_FLUTTER_DIR)) {
        New-Item -ItemType Directory -Path $Global:CACHE_FLUTTER_DIR -Force | Out-Null
        if ($Global:DEBUG_MODE) {
            Write-Host "Created Cache directory: $Global:CACHE_FLUTTER_DIR" -ForegroundColor Green
        }
    }

    if ($Global:DEBUG_MODE) {
        Write-Host "Gvar system initialized successfully" -ForegroundColor Green
    }
}

# Removed complex Gvar functions - now using simple file-based KEY=filename, VALUE=content approach

function Get-FlutterApps {
    <#
    .SYNOPSIS
    Scan and return list of Flutter apps
    #>
    
    $appsDir = Join-Path $Global:FLUTTER_PROJECT_DIR "lib\apps"
    
    if (-not (Test-Path $appsDir)) {
        Write-Warning "Flutter apps directory not found: $appsDir"
        return @()
    }
    
    $apps = @()
    Get-ChildItem -Path $appsDir -Directory | ForEach-Object {
        if ($_.Name -match "^app_") {
            $apps += @{
                "name" = $_.Name
                "path" = $_.FullName
                "isMain" = ($_.Name -eq "app_main")
            }
        }
    }
    
    return $apps
}

function Get-FlutterAppsWithIndex {
    <#
    .SYNOPSIS
    Get Flutter apps with index information for port allocation
    #>

    $apps = Get-FlutterApps
    $appsWithIndex = @()

    # app_main always gets index 0 if it exists
    $mainApp = $apps | Where-Object { $_.name -eq "app_main" }
    if ($mainApp) {
        $appsWithIndex += @{
            "name" = $mainApp.name
            "path" = $mainApp.path
            "isMain" = $true
            "index" = 0
            "port" = 10000
            "entryFile" = Join-Path $Global:FLUTTER_PROJECT_DIR "lib\apps\app_main\main_app_main.dart"
        }
    }

    # Other apps get indices 1, 2, 3... based on alphabetical order
    $otherApps = $apps | Where-Object { $_.name -ne "app_main" } | Sort-Object name
    for ($i = 0; $i -lt $otherApps.Count; $i++) {
        $app = $otherApps[$i]
        $index = $i + 1
        $appsWithIndex += @{
            "name" = $app.name
            "path" = $app.path
            "isMain" = $false
            "index" = $index
            "port" = 10000 + $index
            "entryFile" = Join-Path $Global:FLUTTER_PROJECT_DIR "lib\apps\$($app.name)\main_$($app.name).dart"
        }
    }

    return $appsWithIndex
}

function Get-AppInfoByName {
    <#
    .SYNOPSIS
    Get app information by app name
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$AppName
    )

    $apps = Get-FlutterAppsWithIndex
    return $apps | Where-Object { $_.name -eq $AppName } | Select-Object -First 1
}

# Removed wrapper functions - use direct variable access with key constants
# Use Get-FileVariable/Set-FileVariable with key constants instead
# Use Get-GvarValue/Set-GvarValue with key constants instead
# Use direct path operations instead of wrapper functions

function Set-FileVariable {
    <#
    .SYNOPSIS
    Set a variable using file-based storage in global_vars directory

    .PARAMETER Name
    Variable name (will be used as filename)

    .PARAMETER Value
    Variable value (will be stored as file content)
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$Name,

        [Parameter(Mandatory=$true)]
        [string]$Value
    )

    # Ensure the global_vars directory exists
    if (-not (Test-Path $Global:GVAR_EXCHANGE_DIR)) {
        New-Item -ItemType Directory -Path $Global:GVAR_EXCHANGE_DIR -Force | Out-Null
    }

    $filePath = Join-Path $Global:GVAR_EXCHANGE_DIR $Name
    # Use UTF8 without BOM to avoid encoding issues
    [System.IO.File]::WriteAllText($filePath, $Value, [System.Text.UTF8Encoding]::new($false))

    if ($Global:DEBUG_MODE) {
        Write-Host "Set File Variable: $Name = $Value" -ForegroundColor Cyan
    }
}

function Get-FileVariable {
    <#
    .SYNOPSIS
    Get a variable from file-based storage in global_vars directory

    .PARAMETER Name
    Variable name (filename)

    .PARAMETER DefaultValue
    Default value if file doesn't exist
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$Name,

        [Parameter(Mandatory=$false)]
        [string]$DefaultValue = ""
    )

    $filePath = Join-Path $Global:GVAR_EXCHANGE_DIR $Name

    if (Test-Path $filePath) {
        $value = Get-Content -Path $filePath -Raw -Encoding UTF8

        # Always process the content, even if it's empty
        if ($null -ne $value) {
            $value = $value.Trim()
            # Remove UTF-8 BOM if present (0xFEFF)
            if ($value.Length -gt 0 -and [int][char]$value[0] -eq 0xFEFF) {
                $value = $value.Substring(1)
            }
        } else {
            $value = ""
        }

        if ($Global:DEBUG_MODE) {
            Write-Host "Get File Variable: $Name = $value" -ForegroundColor Cyan
        }

        return $value
    }

    return $DefaultValue
}


# Build Script Variables (from BGVar.ps1)
$Global:pybuildscriptsDir = Join-Path $Global:SCRIPT_ROOT_DIR "scripts\build_scripts\pybuildscripts"
$Global:libDir = Join-Path $Global:FLUTTER_PROJECT_DIR "lib"
$Global:libAppsDir = Join-Path $Global:libDir "apps"

# Build cache directories
$Global:BUILD_CACHE_DIR = Join-Path $Global:BUILD_DIR ".cache"
$Global:BUILD_GVAR_DIR = Join-Path $Global:BUILD_CACHE_DIR "gvar"
if (-not (Test-Path $Global:BUILD_CACHE_DIR)) {
    New-Item -ItemType Directory -Path $Global:BUILD_CACHE_DIR -Force | Out-Null
}
if (-not (Test-Path $Global:BUILD_GVAR_DIR)) {
    New-Item -ItemType Directory -Path $Global:BUILD_GVAR_DIR -Force | Out-Null
}

# Get all directories under lib/apps that start with 'app_'
$Global:appDirs = @()
if (Test-Path $Global:libAppsDir) {
    $Global:appDirs = Get-ChildItem -Path $Global:libAppsDir -Directory | Where-Object { $_.Name -like "app_*" } | Select-Object -ExpandProperty Name
}

# Create a new array with 'app_' prefix removed
$Global:appNames = @()
if ($Global:appDirs) {
    $Global:appNames = $Global:appDirs | ForEach-Object { $_ -replace "^app_", "" }
}

# Additional build directories
$Global:AssetsDir = Join-Path $Global:FLUTTER_PROJECT_DIR "assets"
$Global:AndroidDir = Join-Path $Global:FLUTTER_PROJECT_DIR "android"
$Global:AndroidAppDir = Join-Path $Global:AndroidDir "app"
$Global:AndroidSrcDir = Join-Path $Global:AndroidAppDir "src"
$Global:AndroidSrcMainDir = Join-Path $Global:AndroidSrcDir "main"
$Global:AndroidSrcTestDir = Join-Path $Global:AndroidSrcDir "test"
$Global:FlutterLibDir = Join-Path $Global:FLUTTER_PROJECT_DIR "lib"

# Ensure the .cache directory exists under project root
$Global:BGCacheDir = Join-Path $Global:FLUTTER_PROJECT_DIR ".cache"
$Global:FlagsDir = Join-Path $Global:BGCacheDir "flags"
$Global:AssetsBackupDir = Join-Path $Global:BGCacheDir "assets_backup"
if (-not (Test-Path $Global:BGCacheDir)) {
    New-Item -ItemType Directory -Path $Global:BGCacheDir | Out-Null
}
if (-not (Test-Path $Global:FlagsDir)) {
    New-Item -ItemType Directory -Path $Global:FlagsDir | Out-Null
}
if (-not (Test-Path $Global:AssetsBackupDir)) {
    New-Item -ItemType Directory -Path $Global:AssetsBackupDir | Out-Null
}

# Define Python packages with their purposes
$Global:BGPythonPackages = @(
    @{Name = "keyboard"; Purpose = "Keyboard input handling for interactive scripts"},
    @{Name = "colorama"; Purpose = "Colored terminal output for better visibility"},
    @{Name = "Pillow"; Purpose = "Image processing and manipulation library"},
    @{Name = "opencv-python"; Purpose = "Computer vision and image processing"},
    @{Name = "numpy"; Purpose = "Numerical computing and array operations"},
    @{Name = "pathlib"; Purpose = "Object-oriented filesystem paths"},
    @{Name = "glob2"; Purpose = "Enhanced file pattern matching"},
    @{Name = "requests"; Purpose = "HTTP library for API requests"},
    @{Name = "pyyaml"; Purpose = "YAML file parsing and creation"},
    @{Name = "python-dotenv"; Purpose = "Environment variable management"},
    @{Name = "pytest"; Purpose = "Testing framework"},
    @{Name = "black"; Purpose = "Code formatting tool"},
    @{Name = "flake8"; Purpose = "Code style checker"}
)

$Global:BuildAppsStaticResourcesDir = Join-Path $Global:BUILD_DIR "build_apps_static_resources"
$Global:AppNameKey = 'AppName'
$Global:MenuGroups = @(
    @{
        Name = 'App Name';
        Key = $Global:AppNameKey;
        Options = if ($Global:appNames) { $Global:appNames } else { @() };
        Default = if ($Global:appNames) { $Global:appNames[0] } else { "" }
    },
    @{
        Name = 'App Display Name';
        Key = 'AppDisplayName';
        Options = @('Random Generate', 'Manual Input', 'Use Default');
        Default = 'Random Generate'
    },
    @{
        Name = 'APP ID';
        Key = 'APPID';
        Options = @('Use Previous ID', 'Generate Random ID');
        Default = 'Use Previous ID'
    },
    @{
        Name = 'Build Options';
        Key = 'BuildOptions';
        Options = @('Android', 'iOS', 'Android and iOS', 'Windows', 'Mac', 'All');
        Default = 'Android'
    },
    @{
        Name = 'Image Compression';
        Key = 'ImageCompression';
        Options = @('Default Compression', 'No Compression');
        Default = 'Default Compression'
    },
    @{
        Name = 'Decrypt Resources';
        Key = 'DecryptResources';
        Options = @('No', 'Yes');
        Default = 'No'
    },
    @{
        Name = 'Start Build';
        Key = 'StartBuild';
        Options = @('Press Enter to start build');
        Default = 'Press Enter to start build'
    }
)

# Initialize system on module load
Initialize-GvarSystem
