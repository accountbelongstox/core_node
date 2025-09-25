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

# Unified Manager Global Variables
# Defines core paths and constants for the unified manager system

# Core directory structure
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$UNIFIED_MANAGER_ROOT_DIR = Split-Path -Parent $SCRIPT_DIR
$UNIFIED_MANAGER_DIR = $UNIFIED_MANAGER_ROOT_DIR
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $UNIFIED_MANAGER_ROOT_DIR)

# Registry and configuration files
$REGISTRY_FILE = Join-Path $UNIFIED_MANAGER_DIR "app_registry.json"
$CONSTANTS_DIR = Join-Path $UNIFIED_MANAGER_DIR "constants"
$PATHS_FILE = Join-Path $CONSTANTS_DIR "paths.json"
$COMMANDS_FILE = Join-Path $CONSTANTS_DIR "commands.json"
$VERSIONS_FILE = Join-Path $CONSTANTS_DIR "versions.json"
$SERVICES_FILE = Join-Path $CONSTANTS_DIR "services.json"

# Application directories
$APPS_DIR = Join-Path $PROJECT_ROOT "apps"
$POLY_APPS_DIR = Join-Path $PROJECT_ROOT "poly_apps"
$NCORE_DIR = Join-Path $PROJECT_ROOT "ncore"

# Script directories
$SCRIPTS_DIR = Join-Path $PROJECT_ROOT "scripts"
$SHELLS_DIR = Join-Path $SCRIPTS_DIR "shells"
$WIN_SHELLS_DIR = Join-Path $SHELLS_DIR "win"
$LINUX_SHELLS_DIR = Join-Path $SHELLS_DIR "linux"

# Main executable
$MAIN_JS = Join-Path $PROJECT_ROOT "main.js"

# Platform detection
$IS_WINDOWS = $env:OS -eq "Windows_NT"
$IS_LINUX = -not $IS_WINDOWS

# Command templates for different platforms
$COMMAND_TEMPLATES = @{
    "start_cmd" = if ($IS_WINDOWS) { "start `"{0}`" `"{1}`"" } else { "bash `"{0}`" &" }
    "install_cmd" = if ($IS_WINDOWS) { "& `"{0}`"" } else { "bash `"{0}`"" }
    "deploy_cmd" = if ($IS_WINDOWS) { "explorer `"{0}`"" } else { "bash `"{0}`"" }
    "stop_cmd" = if ($IS_WINDOWS) { "explorer `"{0}`"" } else { "bash `"{0}`"" }
    "build_cmd" = if ($IS_WINDOWS) { "& `"{0}`"" } else { "bash `"{0}`"" }
}

# Function to get script path for an app
function Get-AppScriptPath {
    param(
        [Parameter(Mandatory=$true)] [string]$AppPath,
        [Parameter(Mandatory=$true)] [string]$ScriptName
    )
    
    $fullAppPath = if ([System.IO.Path]::IsPathRooted($AppPath)) {
        $AppPath
    } else {
        Join-Path $PROJECT_ROOT $AppPath
    }
    
    $scriptsDir = Join-Path $fullAppPath "scripts"
    return Join-Path $scriptsDir $ScriptName
}

# Function to build command for an app
function Build-AppCommand {
    param(
        [Parameter(Mandatory=$true)] [string]$CommandType,
        [Parameter(Mandatory=$true)] [string]$AppPath,
        [Parameter(Mandatory=$true)] [string]$ScriptName
    )
    
    $scriptPath = Get-AppScriptPath -AppPath $AppPath -ScriptName $ScriptName
    
    if ($CommandType -eq "start_cmd" -and $IS_LINUX) {
        # For Linux start commands, we need to handle the background process
        return "bash `"$scriptPath`" &"
    } else {
        $template = $COMMAND_TEMPLATES[$CommandType]
        if ($template) {
            return $template -f $scriptPath, $scriptPath
        } else {
            return "bash `"$scriptPath`""
        }
    }
}

# Function to get all available commands for an app
function Get-AppCommands {
    param(
        [Parameter(Mandatory=$true)] [string]$AppPath
    )
    
    $commands = @{}
    
    # Define script mappings
    $scriptMappings = @{
        "start_cmd" = "start.sh"
        "install_cmd" = "install.sh"
        "deploy_cmd" = "deploy.sh"
        "stop_cmd" = "stop.sh"
        "build_cmd" = "build.sh"
    }
    
    # Add platform-specific commands
    if ($IS_LINUX) {
        $scriptMappings["start_cmd_linux"] = "start.sh"
        $scriptMappings["install_cmd_linux"] = "install.sh"
        $scriptMappings["deploy_cmd_linux"] = "deploy.sh"
        $scriptMappings["stop_cmd_linux"] = "stop.sh"
    }
    
    foreach ($cmdType in $scriptMappings.Keys) {
        $scriptName = $scriptMappings[$cmdType]
        $scriptPath = Get-AppScriptPath -AppPath $AppPath -ScriptName $scriptName
        
        if (Test-Path $scriptPath) {
            $commands[$cmdType] = Build-AppCommand -CommandType $cmdType -AppPath $AppPath -ScriptName $scriptName
        }
    }
    
    return $commands
}

# Variables and functions are available after sourcing this file
# No need for Export-ModuleMember in script files
