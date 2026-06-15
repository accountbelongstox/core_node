#!/bin/bash
# Central Application Registry
# This file contains centralized application definitions and configurations

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

# Registry version
APP_REGISTRY_VERSION="1.0.0"

# Declare global variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Base directories
INSTALL_BASE_DIR="/mnt/dev_sdb3/_ubuntu_24"
SUPER_SCRIPTS_DIR="$PROJECT_ROOT/super_scripts"

# Application definitions
declare -A CURSOR_CONFIG
CURSOR_CONFIG[name]="Cursor IDE"
CURSOR_CONFIG[description]="AI-powered code editor"
CURSOR_CONFIG[pattern]="cursor.*\.appimage"
CURSOR_CONFIG[url]="https://cursor.com/download"
CURSOR_CONFIG[keywords]="Linux,AppImage,x64"
CURSOR_CONFIG[install_dir]="$INSTALL_BASE_DIR/cursor"
CURSOR_CONFIG[extracted_dir]="$INSTALL_BASE_DIR/cursor/extracted"
CURSOR_CONFIG[desktop_file]="/usr/share/applications/cursor.desktop"
CURSOR_CONFIG[installed_flag]="$INSTALL_BASE_DIR/cursor/.installed"
CURSOR_CONFIG[launcher_script]="$INSTALL_BASE_DIR/cursor/cursor"
CURSOR_CONFIG[symlink_path]="/usr/local/bin/cursor"
CURSOR_CONFIG[super_script]="$SUPER_SCRIPTS_DIR/cursor"
CURSOR_CONFIG[process_names]="cursor"
CURSOR_CONFIG[process_paths]="/usr/share/cursor/cursor,$INSTALL_BASE_DIR/cursor/extracted/squashfs-root/usr/share/cursor/cursor"
CURSOR_CONFIG[exclude_patterns]="vscode,code"

declare -A VSCODE_CONFIG
VSCODE_CONFIG[name]="Visual Studio Code"
VSCODE_CONFIG[description]="Source code editor developed by Microsoft"
VSCODE_CONFIG[pattern]="code.*\.deb"
VSCODE_CONFIG[url]="https://code.visualstudio.com/"
VSCODE_CONFIG[keywords]="linux64"
VSCODE_CONFIG[install_dir]="$INSTALL_BASE_DIR/vscode"
VSCODE_CONFIG[deb_dir]="$INSTALL_BASE_DIR/vscode/deb"
VSCODE_CONFIG[desktop_file]="/usr/share/applications/code.desktop"
VSCODE_CONFIG[installed_flag]="$INSTALL_BASE_DIR/vscode/.installed"
VSCODE_CONFIG[launcher_script]="$INSTALL_BASE_DIR/vscode/vscode"
VSCODE_CONFIG[symlink_path]="/usr/local/bin/vscode"
VSCODE_CONFIG[super_script]="$SUPER_SCRIPTS_DIR/vscode"
VSCODE_CONFIG[process_names]="code"
VSCODE_CONFIG[process_paths]="/usr/share/code/code,/opt/visual-studio-code/code,/usr/bin/code"
VSCODE_CONFIG[exclude_patterns]="cursor"

# Application registry
declare -A APP_REGISTRY
APP_REGISTRY[cursor]="CURSOR_CONFIG"
APP_REGISTRY[vscode]="VSCODE_CONFIG"

# Get application configuration
get_app_config() {
    local app_name="$1"
    local config_key="$2"
    
    if [[ -z "$app_name" ]] || [[ -z "$config_key" ]]; then
        echo ""
        return 1
    fi
    
    local config_var="${APP_REGISTRY[$app_name]}"
    if [[ -z "$config_var" ]]; then
        echo ""
        return 1
    fi
    
    # Use indirect reference to get the value
    local -n config_ref="$config_var"
    echo "${config_ref[$config_key]}"
    return 0
}

# Get all configuration keys for an application
get_app_config_keys() {
    local app_name="$1"
    
    if [[ -z "$app_name" ]]; then
        return 1
    fi
    
    local config_var="${APP_REGISTRY[$app_name]}"
    if [[ -z "$config_var" ]]; then
        return 1
    fi
    
    # Use indirect reference to get the keys
    local -n config_ref="$config_var"
    printf '%s\n' "${!config_ref[@]}"
    return 0
}

# Check if application is registered
is_app_registered() {
    local app_name="$1"
    
    if [[ -z "$app_name" ]]; then
        return 1
    fi
    
    [[ -n "${APP_REGISTRY[$app_name]}" ]]
}

# Get list of all registered applications
get_registered_apps() {
    printf '%s\n' "${!APP_REGISTRY[@]}"
}

# Validate application configuration
validate_app_config() {
    local app_name="$1"
    
    if ! is_app_registered "$app_name"; then
        echo "Application not registered: $app_name"
        return 1
    fi
    
    local required_keys=("name" "description" "pattern" "url" "install_dir")
    local missing_keys=()
    
    for key in "${required_keys[@]}"; do
        local value=$(get_app_config "$app_name" "$key")
        if [[ -z "$value" ]]; then
            missing_keys+=("$key")
        fi
    done
    
    if [[ ${#missing_keys[@]} -gt 0 ]]; then
        echo "Missing required configuration keys for $app_name: ${missing_keys[*]}"
        return 1
    fi
    
    return 0
}

# Print application configuration
print_app_config() {
    local app_name="$1"
    
    if ! is_app_registered "$app_name"; then
        echo "Application not registered: $app_name"
        return 1
    fi
    
    echo "Configuration for $app_name:"
    local keys=($(get_app_config_keys "$app_name"))
    
    for key in "${keys[@]}"; do
        local value=$(get_app_config "$app_name" "$key")
        printf "  %-20s: %s\n" "$key" "$value"
    done
}

# Initialize application directories
init_app_directories() {
    local app_name="$1"
    
    if ! is_app_registered "$app_name"; then
        echo "Application not registered: $app_name"
        return 1
    fi
    
    local install_dir=$(get_app_config "$app_name" "install_dir")
    local extracted_dir=$(get_app_config "$app_name" "extracted_dir")
    local deb_dir=$(get_app_config "$app_name" "deb_dir")
    
    # Create install directory
    if [[ -n "$install_dir" ]]; then
        mkdir -p "$install_dir"
    fi
    
    # Create extracted directory if defined
    if [[ -n "$extracted_dir" ]]; then
        mkdir -p "$extracted_dir"
    fi
    
    # Create deb directory if defined
    if [[ -n "$deb_dir" ]]; then
        mkdir -p "$deb_dir"
    fi
    
    # Create super scripts directory
    mkdir -p "$SUPER_SCRIPTS_DIR"
    
    return 0
}

# Export configuration for backward compatibility
export_legacy_config() {
    local app_name="$1"
    
    if [[ "$app_name" == "cursor" ]]; then
CURSOR_INSTALL_DIR=$(get_app_config "cursor" "install_dir")
CURSOR_EXTRACTED_DIR=$(get_app_config "cursor" "extracted_dir")
CURSOR_DESKTOP_FILE=$(get_app_config "cursor" "desktop_file")
CURSOR_INSTALLED_FLAG=$(get_app_config "cursor" "installed_flag")
CURSOR_LAUNCHER_SCRIPT=$(get_app_config "cursor" "launcher_script")
CURSOR_DOWNLOAD_URL=$(get_app_config "cursor" "url")
    elif [[ "$app_name" == "vscode" ]]; then
VSCODE_INSTALL_DIR=$(get_app_config "vscode" "install_dir")
VSCODE_DEB_DIR=$(get_app_config "vscode" "deb_dir")
VSCODE_DESKTOP_FILE=$(get_app_config "vscode" "desktop_file")
VSCODE_INSTALLED_FLAG=$(get_app_config "vscode" "installed_flag")
VSCODE_LAUNCHER_SCRIPT=$(get_app_config "vscode" "launcher_script")
VSCODE_DOWNLOAD_URL=$(get_app_config "vscode" "url")
    fi
}

# Export all functions for use in other scripts
export -f get_app_config get_app_config_keys is_app_registered get_registered_apps
export -f validate_app_config print_app_config init_app_directories export_legacy_config
