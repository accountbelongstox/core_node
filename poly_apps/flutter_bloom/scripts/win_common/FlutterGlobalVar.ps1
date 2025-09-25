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

# FTemp Directory Configuration - Using .cache namespace
$Global:FTEMP_BASE_DIR = Join-Path $Global:SCRIPT_ROOT_DIR ".cache"
$Global:FTEMP_FLUTTER_DIR = Join-Path $Global:FTEMP_BASE_DIR "flutter_bloom"

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
$Global:GVAR_EXCHANGE_FILE = Join-Path $Global:GVAR_EXCHANGE_DIR "variables.txt"
$Global:GVAR_TYPES_FILE = Join-Path $Global:GVAR_EXCHANGE_DIR "types.txt"
$Global:GVAR_LOCK_FILE = Join-Path $Global:GVAR_EXCHANGE_DIR "gvar.lock"

# Build cache directory constants - Added for temp_build_dir.txt
$Global:TEMP_BUILD_DIR_FILE = "temp_build_dir.txt"

# Platform Detection
$Global:IS_WINDOWS = $PSVersionTable.Platform -eq "Win32NT" -or $null -eq $PSVersionTable.Platform
$Global:IS_LINUX = $PSVersionTable.Platform -eq "Unix"
$Global:IS_MACOS = $PSVersionTable.OS -like "*Darwin*"

# Build Configuration
$Global:ORIGINAL_CONFIG_FILE = Join-Path $Global:DEV_SCRIPT_DIR "original_config.ini"
$Global:BUILD_OPTIONS_FILE = Join-Path $Global:DEV_SCRIPT_DIR "build_option.ini"

# Key Constants - All keys in UPPERCASE for consistency
$Global:KEY_APP_NAME = "APP_NAME"
$Global:KEY_BUILD_ACTION = "BUILD_ACTION"
$Global:KEY_BUILD_PLATFORM = "BUILD_PLATFORM"
$Global:KEY_LAST_SELECTED_APP = "LAST_SELECTED_APP"
$Global:KEY_LAST_BUILD_ACTION = "LAST_BUILD_ACTION"
$Global:KEY_LAST_SELECTION_TIME = "LAST_SELECTION_TIME"
$Global:KEY_APP_DISPLAY_NAME = "APP_DISPLAY_NAME"
$Global:KEY_APP_ID = "APP_ID"
$Global:KEY_BUILD_OPTIONS = "BUILD_OPTIONS"
$Global:KEY_IMAGE_COMPRESSION = "IMAGE_COMPRESSION"
$Global:KEY_DECRYPT_RESOURCES = "DECRYPT_RESOURCES"
$Global:KEY_START_BUILD = "START_BUILD"
$Global:KEY_DEBUG_MODE = "DEBUG_MODE"
$Global:KEY_EXTERNAL_BUILD_ACTIVE = "EXTERNAL_BUILD_ACTIVE"
$Global:KEY_FLUTTER_PROJECT_DIR_BY_GVAR = "FLUTTER_PROJECT_DIR_BY_GVAR"
$Global:KEY_BUILD_COMPLETED = "BUILD_COMPLETED"
$Global:KEY_BUILD_CONFIRMED = "BUILD_CONFIRMED"
$Global:KEY_FINAL_WORKING_DIRECTORY = "FINAL_WORKING_DIRECTORY"
$Global:KEY_LARAVEL_SERVER_STATUS = "LARAVEL_SERVER_STATUS"
$Global:KEY_LARAVEL_ENVIRONMENT = "LARAVEL_ENVIRONMENT"
$Global:KEY_LARAVEL_PORT = "LARAVEL_PORT"
$Global:KEY_LARAVEL_INTEGRATION = "LARAVEL_INTEGRATION"
$Global:KEY_APP_ACTION_MODE_PREFIX = "APP_ACTION_MODE_"
$Global:KEY_APP_PLATFORM_MODE_PREFIX = "APP_PLATFORM_MODE_"
$Global:KEY_LAST_SELECTED_APP_INDEX = "LAST_SELECTED_APP_INDEX"
$Global:KEY_CURRENT_ACTIVE_APP = "CURRENT_ACTIVE_APP"
$Global:KEY_CURRENT_ACTIVE_ACTION = "CURRENT_ACTIVE_ACTION"
$Global:KEY_CURRENT_ACTIVE_PLATFORM = "CURRENT_ACTIVE_PLATFORM"
$Global:KEY_APP_INDEX = "APP_INDEX"
$Global:KEY_SELECTED_APP = "SELECTED_APP"
$Global:KEY_SELECTED_ACTION = "SELECTED_ACTION"
$Global:KEY_SELECTED_PLATFORM = "SELECTED_PLATFORM"
$Global:KEY_SELECTED_ENTRY_FILE = "SELECTED_ENTRY_FILE"
$Global:KEY_DEBUG_PORT = "DEBUG_PORT"

# New compilation menu keys
$Global:KEY_COMPILATION_MENU_TYPE = "COMPILATION_MENU_TYPE"
$Global:KEY_SELECTED_COMPILATION_OPTION = "SELECTED_COMPILATION_OPTION"
$Global:KEY_BUILD_PHASE = "BUILD_PHASE"
$Global:KEY_LAST_COMPILATION_MENU_SELECTION = "LAST_COMPILATION_MENU_SELECTION"

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
    Initialize the Gvar exchange system
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

    # Initialize empty variables file if it doesn't exist
    if (-not (Test-Path $Global:GVAR_EXCHANGE_FILE)) {
        "" | Set-Content -Path $Global:GVAR_EXCHANGE_FILE -Encoding UTF8
        if ($Global:DEBUG_MODE) {
            Write-Host "Initialized Gvar exchange file: $Global:GVAR_EXCHANGE_FILE" -ForegroundColor Green
        }
    }

    # Initialize empty types file if it doesn't exist
    if (-not (Test-Path $Global:GVAR_TYPES_FILE)) {
        "" | Set-Content -Path $Global:GVAR_TYPES_FILE -Encoding UTF8
        if ($Global:DEBUG_MODE) {
            Write-Host "Initialized Gvar types file: $Global:GVAR_TYPES_FILE" -ForegroundColor Green
        }
    }

    if ($Global:DEBUG_MODE) {
        Write-Host "Gvar system initialized successfully" -ForegroundColor Green
    }
}

function Wait-GvarLock {
    <#
    .SYNOPSIS
    Wait for Gvar lock to be released (thread safety)
    #>
    
    $timeout = 30 # seconds
    $elapsed = 0
    
    while ((Test-Path $Global:GVAR_LOCK_FILE) -and ($elapsed -lt $timeout)) {
        Start-Sleep -Milliseconds 100
        $elapsed += 0.1
    }
    
    if ($elapsed -ge $timeout) {
        throw "Gvar lock timeout exceeded"
    }
}

function Set-GvarLock {
    <#
    .SYNOPSIS
    Create Gvar lock file
    #>
    
    New-Item -ItemType File -Path $Global:GVAR_LOCK_FILE -Force | Out-Null
}

function Remove-GvarLock {
    <#
    .SYNOPSIS
    Remove Gvar lock file
    #>
    
    if (Test-Path $Global:GVAR_LOCK_FILE) {
        Remove-Item -Path $Global:GVAR_LOCK_FILE -Force
    }
}

function Set-GvarValue {
    <#
    .SYNOPSIS
    Set a variable in the Gvar exchange system

    .PARAMETER Name
    Variable name

    .PARAMETER Value
    Variable value
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$Name,

        [Parameter(Mandatory=$true)]
        $Value
    )

    try {
        Wait-GvarLock
        Set-GvarLock

        # Read current variables
        $variables = @{}
        if (Test-Path $Global:GVAR_EXCHANGE_FILE) {
            $content = Get-Content -Path $Global:GVAR_EXCHANGE_FILE -Raw -Encoding UTF8
            if ($content -and $content.Trim()) {
                foreach ($line in $content -split "`r?`n") {
                    if ($line -match '^([^=]+)=(.*)$') {
                        $varName = $matches[1].Trim()
                        $varValue = $matches[2].Trim()
                        $variables[$varName] = $varValue
                    }
                }
            }
        }

        # Set new variable
        $variables[$Name] = $Value

        # Write back to file
        $outputLines = @()
        foreach ($kvp in $variables.GetEnumerator()) {
            $outputLines += "$($kvp.Key)=$($kvp.Value)"
        }
        $outputLines -join "`n" | Set-Content -Path $Global:GVAR_EXCHANGE_FILE -Encoding UTF8

        if ($Global:DEBUG_MODE) {
            Write-Host "Set Gvar: $Name = $Value" -ForegroundColor Cyan
        }
    }
    finally {
        Remove-GvarLock
    }
}

function Get-GvarValue {
    <#
    .SYNOPSIS
    Get a variable from the Gvar exchange system
    
    .PARAMETER Name
    Variable name
    
    .PARAMETER DefaultValue
    Default value if variable doesn't exist
    #>
    
    param(
        [Parameter(Mandatory=$true)]
        [string]$Name,
        
        [Parameter(Mandatory=$false)]
        $DefaultValue = $null
    )
    
    try {
        Wait-GvarLock
        Set-GvarLock
        
        if (-not (Test-Path $Global:GVAR_EXCHANGE_FILE)) {
            return $DefaultValue
        }
        
        $content = Get-Content -Path $Global:GVAR_EXCHANGE_FILE -Raw -Encoding UTF8
        if (-not $content -or -not $content.Trim()) {
            return $DefaultValue
        }
        
        foreach ($line in $content -split "`r?`n") {
            if ($line -match '^([^=]+)=(.*)$') {
                $varName = $matches[1].Trim()
                $varValue = $matches[2].Trim()
                if ($varName -eq $Name) {
                    if ($Global:DEBUG_MODE) {
                        Write-Host "Get Gvar: $Name = $varValue" -ForegroundColor Cyan
                    }
                    return $varValue
                }
            }
        }
        
        return $DefaultValue
    }
    finally {
        Remove-GvarLock
    }
}

function Get-AllGvarValues {
    <#
    .SYNOPSIS
    Get all variables from the Gvar exchange system
    #>
    
    try {
        Wait-GvarLock
        Set-GvarLock
        
        if (-not (Test-Path $Global:GVAR_EXCHANGE_FILE)) {
            return @{}
        }
        
        $content = Get-Content -Path $Global:GVAR_EXCHANGE_FILE -Raw -Encoding UTF8
        if (-not $content -or -not $content.Trim()) {
            return @{}
        }
        
        $variables = @{}
        foreach ($line in $content -split "`r?`n") {
            if ($line -match '^([^=]+)=(.*)$') {
                $varName = $matches[1].Trim()
                $varValue = $matches[2].Trim()
                $variables[$varName] = $varValue
            }
        }
        
        return $variables
    }
    finally {
        Remove-GvarLock
    }
}

function Clear-GvarExchange {
    <#
    .SYNOPSIS
    Clear all variables from the Gvar exchange system
    #>
    
    try {
        Wait-GvarLock
        Set-GvarLock
        
        "" | Set-Content -Path $Global:GVAR_EXCHANGE_FILE -Encoding UTF8
        
        if ($Global:DEBUG_MODE) {
            Write-Host "Cleared Gvar exchange" -ForegroundColor Yellow
        }
    }
    finally {
        Remove-GvarLock
    }
}

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
    Set a variable using file-based storage in FTemp directory

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

    # Ensure the temp directory exists
    if (-not (Test-Path $Global:FTEMP_FLUTTER_DIR)) {
        New-Item -ItemType Directory -Path $Global:FTEMP_FLUTTER_DIR -Force | Out-Null
    }

    $filePath = Join-Path $Global:FTEMP_FLUTTER_DIR $Name
    # Use UTF8 without BOM to avoid encoding issues
    [System.IO.File]::WriteAllText($filePath, $Value, [System.Text.UTF8Encoding]::new($false))

    if ($Global:DEBUG_MODE) {
        Write-Host "Set File Variable: $Name = $Value" -ForegroundColor Cyan
    }
}

function Get-FileVariable {
    <#
    .SYNOPSIS
    Get a variable from file-based storage in FTemp directory

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

    $filePath = Join-Path $Global:FTEMP_FLUTTER_DIR $Name

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
