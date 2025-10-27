#!/bin/bash
# Desktop Applications Installation Script
#
# Usage:
#   ./120_install_desktop_applications.sh                    # Normal installation using config flags
#   ./120_install_desktop_applications.sh DEV               # Test install DEV package group (UPPERCASE = group)
#   ./120_install_desktop_applications.sh code              # Test install apps containing "code" in name (lowercase = app)
#   ./120_install_desktop_applications.sh DEV firefox       # Test install "firefox" apps from DEV group
#   ./120_install_desktop_applications.sh --cleanup code    # Force cleanup "code" from all package managers
#
# Parameter Rules:
#   Single parameter: UPPERCASE = group match, lowercase = app name match
#   Two parameters: first = group, second = app name within that group
#   All matching is case-insensitive internally
#   Any parameters will show rules and wait for confirmation
#
# Test mode ignores installation flag files and installs matching packages directly
# Cleanup mode removes packages from snap, apt, flatpak and cleans up binaries
#
# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

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

# Script identification and path setup
SCRIPT_INDEX="120"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/linux_applications_list.sh"
source "$PARENT_DIR_LEVEL_1/debian_com/installation_library.sh"

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
SCRIPT_TEMP_DIR=$(create_script_temp_dir "120_install_desktop_applications")
LOG_FILE="$SCRIPT_TEMP_DIR/desktop_apps_install_$(date +%Y%m%d_%H%M%S).log"

# Package group installation flags - set defaults based on environment
# Base packages: always true for essential tools
INSTALL_BASE_PACKAGES=$(get_var "INSTALL_BASE_PACKAGES" "true")

# Development packages: true if desktop environment or WSL
if [ "$HAS_DESKTOP_ENVIRONMENT" = true ] || [ "$IS_WSL" = true ]; then
    INSTALL_DEV_PACKAGES=$(get_var "INSTALL_DEV_PACKAGES" "true")
else
    INSTALL_DEV_PACKAGES=$(get_var "INSTALL_DEV_PACKAGES" "false")
fi

# Application packages: true only if desktop environment (not server)
if [ "$HAS_DESKTOP_ENVIRONMENT" = true ]; then
    INSTALL_APP_PACKAGES=$(get_var "INSTALL_APP_PACKAGES" "true")
else
    INSTALL_APP_PACKAGES=$(get_var "INSTALL_APP_PACKAGES" "false")
fi

# AI packages: true if desktop environment or WSL
if [ "$HAS_DESKTOP_ENVIRONMENT" = true ] || [ "$IS_WSL" = true ]; then
    INSTALL_AI_PACKAGES=$(get_var "INSTALL_AI_PACKAGES" "true")
else
    INSTALL_AI_PACKAGES=$(get_var "INSTALL_AI_PACKAGES" "false")
fi

# MCP packages: true if desktop environment or WSL
if [ "$HAS_DESKTOP_ENVIRONMENT" = true ] || [ "$IS_WSL" = true ]; then
    INSTALL_MCP_PACKAGES=$(get_var "INSTALL_MCP_PACKAGES" "true")
else
    INSTALL_MCP_PACKAGES=$(get_var "INSTALL_MCP_PACKAGES" "false")
fi

# Logging function
log_message() {
    local message="$1"
    echo "[$SCRIPT_INDEX][$(date '+%Y-%m-%d %H:%M:%S')] $message" | tee -a "$LOG_FILE"
}

# Get AI tools installation flag
INSTALL_AI_TOOLS=$(get_var "INSTALL_AI_TOOLS" "false")

log_message "Starting desktop applications installation for Linux..."
log_message "Install mode: $INSTALL_MODE"
log_message "Environment detection:"
log_message "  IS_WSL: $IS_WSL"
log_message "  IS_PRODUCTION: $IS_PRODUCTION"
log_message "  HAS_DESKTOP_ENVIRONMENT: $HAS_DESKTOP_ENVIRONMENT"
log_message "  DESKTOP_ENVIRONMENT: $DESKTOP_ENVIRONMENT"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install package via snap
install_via_snap() {
    local package_id="$1"
    local app_name="$2"
    
    if ! command_exists snap; then
        log_message "Snap is not installed. Installing snapd..."
        log_message "Updating package lists with timeout..."
        if timeout 300 $USE_SUDO apt update; then
            log_message "Package lists updated successfully"
        else
            log_message "Warning: Package update timed out or failed, continuing anyway"
        fi
        
        log_message "Installing snapd..."
        if timeout 600 $USE_SUDO apt install -y snapd; then
            log_message "snapd installed successfully"
        else
            log_message "Error: Failed to install snapd"
            return 1
        fi
        
        # Enable snap services
        log_message "Enabling snap services..."
        $USE_SUDO systemctl enable --now snapd.socket || {
            log_message "Warning: Failed to enable snapd.socket"
        }
        $USE_SUDO ln -sf /var/lib/snapd/snap /snap 2>/dev/null || true
    fi
    
    log_message "Installing $app_name via snap: $package_id"
    if $USE_SUDO snap install $package_id; then
        log_message "Successfully installed $app_name via snap"
        return 0
    else
        log_message "Failed to install $app_name via snap"
        return 1
    fi
}

# Function to install package via apt
install_via_apt() {
    local package_id="$1"
    local app_name="$2"
    
    log_message "Installing $app_name via apt: $package_id"
    log_message "Updating package lists with timeout..."
    if timeout 300 $USE_SUDO apt update; then
        log_message "Package lists updated successfully"
    else
        log_message "Warning: Package update timed out or failed, continuing anyway"
    fi
    
    log_message "Installing package with timeout..."
    if timeout 600 $USE_SUDO apt install -y "$package_id"; then
        log_message "Successfully installed $app_name via apt"
        return 0
    else
        log_message "Failed to install $app_name via apt"
        return 1
    fi
}

# Function to install package via flatpak
install_via_flatpak() {
    local package_id="$1"
    local app_name="$2"
    
    if ! command_exists flatpak; then
        log_message "Flatpak is not installed. Installing flatpak..."
        log_message "Updating package lists with timeout..."
        if timeout 300 $USE_SUDO apt update; then
            log_message "Package lists updated successfully"
        else
            log_message "Warning: Package update timed out or failed, continuing anyway"
        fi
        
        log_message "Installing flatpak..."
        if timeout 600 $USE_SUDO apt install -y flatpak; then
            log_message "flatpak installed successfully"
        else
            log_message "Error: Failed to install flatpak"
            return 1
        fi
        
        # Add flathub repository
        log_message "Adding flathub repository..."
        if timeout 120 flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo; then
            log_message "Flathub repository added successfully"
        else
            log_message "Warning: Failed to add flathub repository"
        fi
    fi
    
    log_message "Installing $app_name via flatpak: $package_id"
    if flatpak install -y flathub "$package_id"; then
        log_message "Successfully installed $app_name via flatpak"
        return 0
    else
        log_message "Failed to install $app_name via flatpak"
        return 1
    fi
}

# Function to install AppImage
install_via_appimage() {
    local download_url="$1"
    local app_name="$2"
    local exec_name="$3"
    
    local appimage_dir="/opt/appimages"
    local appimage_file="$appimage_dir/${exec_name}.AppImage"
    
    log_message "Installing $app_name via AppImage from: $download_url"
    
    # Create AppImage directory
    $USE_SUDO mkdir -p "$appimage_dir"
    
    # Download AppImage
    if $USE_SUDO wget -O "$appimage_file" "$download_url"; then
        # Make executable
        $USE_SUDO chmod +x "$appimage_file"
        
        # Create symlink in /usr/local/bin
        $USE_SUDO ln -sf "$appimage_file" "/usr/local/bin/$exec_name" 2>/dev/null || true
        
        log_message "Successfully installed $app_name AppImage"
        return 0
    else
        log_message "Failed to download $app_name AppImage"
        return 1
    fi
}

# Function to install via web download (deb packages)
install_via_web() {
    local download_url="$1"
    local app_name="$2"
    local temp_file="$SCRIPT_TEMP_DIR/$(basename "$download_url")"
    
    log_message "Installing $app_name via web download from: $download_url"
    
    # Download package
    if wget -O "$temp_file" "$download_url"; then
        # Install deb package
        if $USE_SUDO dpkg -i "$temp_file"; then
            log_message "Successfully installed $app_name from web"
            # Fix any dependency issues
            $USE_SUDO apt-get install -f -y 2>/dev/null || true
            return 0
        else
            log_message "Failed to install $app_name deb package"
            # Try to fix dependencies and retry
            $USE_SUDO apt-get install -f -y
            if $USE_SUDO dpkg -i "$temp_file"; then
                log_message "Successfully installed $app_name after fixing dependencies"
                return 0
            else
                log_message "Failed to install $app_name even after fixing dependencies"
                return 1
            fi
        fi
    else
        log_message "Failed to download $app_name package"
        return 1
    fi
}



# Function to install via npm
install_via_npm() {
    local package_id="$1"
    local app_name="$2"
    
    if ! command_exists npm; then
        log_message "npm is not installed. Cannot install $app_name"
        return 1
    fi
    
    log_message "Installing $app_name via npm: $package_id"
    if timeout 300 npm install -g "$package_id"; then
        log_message "Successfully installed $app_name via npm"
        return 0
    else
        log_message "Failed to install $app_name via npm"
        return 1
    fi
}

# Function to install via uv tool
install_via_uv_tool() {
    local package_id="$1"
    local app_name="$2"

    if ! command_exists uv; then
        log_message "uv is not installed. Cannot install $app_name"
        return 1
    fi

    log_message "Installing $app_name via uv tool: $package_id"
    if timeout 300 uv tool install "$package_id"; then
        log_message "Successfully installed $app_name via uv tool"
        return 0
    else
        log_message "Failed to install $app_name via uv tool"
        return 1
    fi
}

# Function to install via pipx
install_via_pipx() {
    local package_id="$1"
    local app_name="$2"

    if ! command_exists pipx; then
        log_message "pipx is not installed. Cannot install $app_name"
        return 1
    fi

    log_message "Installing $app_name via pipx: $package_id"
    if timeout 300 pipx install "$package_id"; then
        log_message "Successfully installed $app_name via pipx"
        return 0
    else
        log_message "Failed to install $app_name via pipx"
        return 1
    fi
}

# Function to install via curl (download and install)
install_via_curl() {
    local download_url="$1"
    local app_name="$2"
    local exec_name="$3"

    if ! command_exists curl; then
        log_message "curl is not installed. Installing curl..."
        if ! $USE_SUDO apt update && $USE_SUDO apt install -y curl; then
            log_message "Failed to install curl. Cannot install $app_name"
            return 1
        fi
    fi

    log_message "Installing $app_name via curl from: $download_url"

    # Create temporary file
    local temp_file="$SCRIPT_TEMP_DIR/${exec_name}_install_$(date +%s)"

    # Download the installation script or binary
    if curl -fsSL "$download_url" -o "$temp_file"; then
        # Make executable if it's a script
        chmod +x "$temp_file"

        # If it's an installation script, run it
        if head -n 1 "$temp_file" | grep -q "^#!"; then
            log_message "Executing installation script for $app_name"
            if bash "$temp_file"; then
                log_message "Successfully installed $app_name via curl script"
                return 0
            else
                log_message "Failed to execute installation script for $app_name"
                return 1
            fi
        else
            # If it's a binary, install it directly
            local install_path="/usr/local/bin/$exec_name"
            log_message "Installing $app_name binary to $install_path"
            if $USE_SUDO cp "$temp_file" "$install_path" && $USE_SUDO chmod +x "$install_path"; then
                log_message "Successfully installed $app_name binary via curl"
                return 0
            else
                log_message "Failed to install $app_name binary"
                return 1
            fi
        fi
    else
        log_message "Failed to download $app_name from: $download_url"
        return 1
    fi
}

# Function to create symlink to /usr/local/bin
create_symlink_usr_local_bin() {
    local exec_name="$1"
    local app_name="${2:-$exec_name}"

    # Find the binary in common locations
    local binary_path=""
    local search_paths=(
        "/usr/bin/$exec_name"
        "/usr/local/bin/$exec_name"
        "$HOME/.local/bin/$exec_name"
        "$HOME/.cargo/bin/$exec_name"
        "/opt/*/bin/$exec_name"
        "/snap/bin/$exec_name"
    )

    for path in "${search_paths[@]}"; do
        # Handle wildcard expansion for /opt/*/bin/
        if [[ "$path" == *"*"* ]]; then
            for expanded_path in $path; do
                if [ -f "$expanded_path" ] && [ -x "$expanded_path" ]; then
                    binary_path="$expanded_path"
                    break 2
                fi
            done
        elif [ -f "$path" ] && [ -x "$path" ]; then
            binary_path="$path"
            break
        fi
    done

    if [ -z "$binary_path" ]; then
        log_message "Binary for $app_name not found in common locations"
        return 1
    fi

    # Create symlink if target doesn't already exist or points elsewhere
    local target_link="/usr/local/bin/$exec_name"
    if [ -L "$target_link" ]; then
        local current_target=$(readlink "$target_link")
        if [ "$current_target" = "$binary_path" ]; then
            log_message "Symlink already exists and is correct: $target_link -> $binary_path"
            return 0
        else
            log_message "Updating existing symlink: $target_link -> $binary_path"
        fi
    fi

    log_message "Creating symlink: $target_link -> $binary_path"
    if $USE_SUDO ln -sf "$binary_path" "$target_link"; then
        log_message "Successfully created symlink for $app_name"
        return 0
    else
        log_message "Failed to create symlink for $app_name"
        return 1
    fi
}

# Function to verify application installation
verify_installation() {
    local exec_name="$1"
    local app_name="$2"
    local verify_command="$3"
    
    if command_exists "$exec_name"; then
        log_message "$app_name is installed and available in PATH"
        
        if [ -n "$verify_command" ]; then
            log_message "Verifying $app_name with: $verify_command"
            if $exec_name $verify_command >/dev/null 2>&1; then
                log_message "$app_name verification successful"
            else
                log_message "$app_name verification failed but executable exists"
            fi
        fi
        return 0
    else
        log_message "$app_name is not available in PATH"
        return 1
    fi
}

# Function to prompt user for package group installation confirmation
prompt_package_group_installation() {
    local group_name="$1"
    local group_description="$2"
    local install_flag="$3"

    log_message "=========================================="
    log_message "Package Group Installation: $group_name"
    log_message "=========================================="
    log_message "Description: $group_description"
    log_message "Install Flag: $install_flag"
    log_message ""

    if [ "$install_flag" = "false" ]; then
        log_message "$group_name installation is disabled by configuration"
        log_message "Skipping $group_name installation..."
        return 1
    fi

    log_message "Do you want to proceed with $group_name installation? (Y/n)"
    log_message "You have 60 seconds to decide (default: Yes)..."

    local response=""
    if read -t 60 -r response; then
        if [[ "$response" =~ ^[Nn]$ ]]; then
            log_message "$group_name installation cancelled by user"
            return 1
        else
            log_message "Proceeding with $group_name installation..."
            return 0
        fi
    else
        echo ""
        log_message "Timeout reached, defaulting to: Yes"
        log_message "Proceeding with $group_name installation..."
        return 0
    fi
}

# Function to install single application
install_application() {
    local app_name="$1"
    local display_name=""
    local exec_name=""
    local install_method=""
    local package_id=""
    local verify_command=""
    local launch_command=""

    # Handle MCP apps (remove mcp_ prefix for property lookup)
    local lookup_app="$app_name"
    if [[ "$app_name" == mcp_* ]]; then
        lookup_app="${app_name#mcp_}"
    fi

    # Get application properties using the unified structure
    display_name=$(get_app_property "$lookup_app" "name")
    exec_name=$(get_app_property "$lookup_app" "exec")
    install_method=$(get_install_method "$lookup_app")
    package_id=$(get_package_id "$lookup_app")
    verify_command=$(get_app_property "$lookup_app" "verify_command")
    launch_command=$(get_launch_command "$lookup_app")
    
    # Skip if no package ID or install method
    if [ -z "$package_id" ] || [ -z "$install_method" ]; then
        log_message "Skipping $app_name - no package ID or install method"
        return 0
    fi

    log_message "Installing $display_name..."
    log_message "  Method: $install_method"
    log_message "  Package ID: $package_id"
    log_message "  Executable: $exec_name"

    # Check if already installed
    if verify_installation "$exec_name" "$display_name" "$verify_command"; then
        log_message "$display_name is already installed, skipping"
        return 0
    fi

    # Use universal install function from installation library
    universal_install "$install_method" "$package_id" "$display_name" "$exec_name"
    
    local install_result=$?

    # Create launch script if installation was successful and launch command exists
    if [ $install_result -eq 0 ] && [ -n "$launch_command" ]; then
        log_message "Creating launch script for $display_name"
        create_launch_script "$lookup_app"
    fi
    
    # Verify installation
    if [ $install_result -eq 0 ]; then
        if verify_installation "$exec_name" "$display_name" "$verify_command"; then
            log_message "Successfully installed and verified $display_name"
            return 0
        else
            log_message "Installation completed but verification failed for $display_name"
            return 1
        fi
    else
        log_message "Installation failed for $display_name"
        return 1
    fi
}

# Function to install applications by package group
install_applications_by_package_group() {
    local package_group="$1"
    local apps_to_install

    log_message "Installing applications for package group: $package_group"

    # Get applications for the target package group
    mapfile -t apps_to_install < <(get_apps_by_package_group "$package_group")

    if [ ${#apps_to_install[@]} -eq 0 ]; then
        log_message "No applications found for package group: $package_group"
        return 0
    fi

    log_message "Found ${#apps_to_install[@]} applications for package group $package_group"

    local installed_count=0
    local failed_count=0

    for app in "${apps_to_install[@]}"; do
        if install_application "$app"; then
            ((installed_count++))
        else
            ((failed_count++))
        fi
    done

    log_message "Package group $package_group installation complete: $installed_count successful, $failed_count failed"
}

# Function to install applications by group (legacy compatibility)
install_applications_by_group() {
    local target_group="$1"
    local apps_to_install

    log_message "Installing applications for group: $target_group"

    # Get applications for the target group
    mapfile -t apps_to_install < <(get_apps_by_group "$target_group")

    if [ ${#apps_to_install[@]} -eq 0 ]; then
        log_message "No applications found for group: $target_group"
        return 0
    fi

    log_message "Found ${#apps_to_install[@]} applications for group $target_group"

    local installed_count=0
    local failed_count=0

    for app in "${apps_to_install[@]}"; do
        if install_application "$app"; then
            ((installed_count++))
        else
            ((failed_count++))
        fi
    done

    log_message "Group $target_group installation complete: $installed_count successful, $failed_count failed"
}

# Function to install all applications
install_all_applications() {
    log_message "Installing all available applications..."

    install_applications_by_package_group "BASE"
    install_applications_by_package_group "DEV"
    install_applications_by_package_group "APP"
    install_applications_by_package_group "AI"
}




# Function to test specific package group
test_package_group() {
    local search_term="$1"
    local found_group=""

    # Convert search term to uppercase for comparison
    local search_upper=$(echo "$search_term" | tr '[:lower:]' '[:upper:]')

    # Check which package group matches
    case "$search_upper" in
        *BASE*|*BASE_PACKAGES*)
            found_group="BASE"
            ;;
        *DEV*|*DEV_PACKAGES*|*DEVELOPMENT*)
            found_group="DEV"
            ;;
        *APP*|*APP_PACKAGES*|*APPLICATION*)
            found_group="APP"
            ;;
        *AI*|*AI_PACKAGES*)
            found_group="AI"
            ;;
        *MCP*|*MCP_PACKAGES*)
            found_group="MCP"
            ;;
        *)
            log_message "No package group found matching: $search_term"
            return 1
            ;;
    esac

    log_message "=========================================="
    log_message "Testing Package Group: $found_group"
    log_message "Search Term: $search_term"
    log_message "=========================================="

    install_applications_by_package_group "$found_group"
}

# Function to test specific applications by name
test_applications_by_name() {
    local search_term="$1"
    local group_filter="$2"  # Optional group filter
    local search_lower=$(echo "$search_term" | tr '[:upper:]' '[:lower:]')
    local found_apps=()

    log_message "=========================================="
    if [ -n "$group_filter" ]; then
        log_message "Testing Applications by Name: $search_term in Group: $group_filter"
    else
        log_message "Testing Applications by Name: $search_term"
    fi
    log_message "=========================================="

    # Determine which groups to search
    local search_groups=()
    if [ -n "$group_filter" ]; then
        # Search only in specified group
        local group_upper=$(echo "$group_filter" | tr '[:lower:]' '[:upper:]')
        case "$group_upper" in
            *BASE*|*BASE_PACKAGES*)
                search_groups=("BASE")
                ;;
            *DEV*|*DEV_PACKAGES*|*DEVELOPMENT*)
                search_groups=("DEV")
                ;;
            *APP*|*APP_PACKAGES*|*APPLICATION*)
                search_groups=("APP")
                ;;
            *AI*|*AI_PACKAGES*)
                search_groups=("AI")
                ;;
            *MCP*|*MCP_PACKAGES*)
                search_groups=("MCP")
                ;;
            *)
                log_message "Unknown group filter: $group_filter, searching all groups"
                search_groups=("BASE" "DEV" "APP" "AI" "MCP")
                ;;
        esac
    else
        # Search in all package groups
        search_groups=("BASE" "DEV" "APP" "AI" "MCP")
    fi

    for group in "${search_groups[@]}"; do
        local apps_in_group
        mapfile -t apps_in_group < <(get_apps_by_package_group "$group")

        for app in "${apps_in_group[@]}"; do
            # Handle MCP apps (remove mcp_ prefix for name lookup)
            local lookup_app="$app"
            if [[ "$app" == mcp_* ]]; then
                lookup_app="${app#mcp_}"
            fi

            local app_name=$(get_app_property "$lookup_app" "name")
            local app_name_lower=$(echo "$app_name" | tr '[:upper:]' '[:lower:]')

            # Check if search term is contained in app name (case insensitive)
            if [[ "$app_name_lower" == *"$search_lower"* ]]; then
                found_apps+=("$app")
                log_message "Found matching app: $app_name ($app) in group $group"
            fi
        done
    done

    if [ ${#found_apps[@]} -eq 0 ]; then
        if [ -n "$group_filter" ]; then
            log_message "No applications found matching: $search_term in group: $group_filter"
        else
            log_message "No applications found matching: $search_term"
        fi
        return 1
    fi

    log_message "Installing ${#found_apps[@]} matching applications..."

    local installed_count=0
    local failed_count=0

    for app in "${found_apps[@]}"; do
        if install_application "$app"; then
            ((installed_count++))
        else
            ((failed_count++))
        fi
    done

    log_message "Test installation complete: $installed_count successful, $failed_count failed"
}

# Function to show help
show_help() {
    echo "Desktop Applications Installation Script"
    echo ""
    echo "Usage:"
    echo "  $0                        # Normal installation using config flags"
    echo "  $0 DEV                   # Test install DEV package group (UPPERCASE = group)"
    echo "  $0 code                  # Test install apps containing 'code' in name (lowercase = app)"
    echo "  $0 DEV firefox           # Test install 'firefox' apps from DEV group"
    echo "  $0 --cleanup <name>      # Force cleanup package by executable name"
    echo "  $0 --help                # Show this help message"
    echo ""
    echo "Parameter Rules:"
    echo "  Single parameter:"
    echo "    - UPPERCASE: Match package group (e.g., DEV, BASE, APP)"
    echo "    - lowercase: Match application name (e.g., code, firefox)"
    echo "  Two parameters:"
    echo "    - First: Package group name"
    echo "    - Second: Application name within that group"
    echo "  All matching is case-insensitive internally"
    echo ""
    echo "Package Groups:"
    echo "  BASE - Essential base applications"
    echo "  DEV  - Development tools and IDEs"
    echo "  APP  - Desktop applications and productivity tools"
    echo "  AI   - AI development tools and assistants"
    echo "  MCP  - MCP service packages"
    echo ""
    echo "Test mode ignores installation flag files and installs matching packages directly"
    echo "Cleanup mode removes package from all package managers (snap, apt, flatpak)"
}

# Function to show parameter rules and wait for confirmation
show_parameter_rules_and_confirm() {
    local param1="$1"
    local param2="$2"

    echo ""
    echo "=========================================="
    echo "PARAMETER MATCHING RULES"
    echo "=========================================="
    echo "Single parameter:"
    echo "  - UPPERCASE: Match package group (e.g., DEV, BASE, APP)"
    echo "  - lowercase: Match application name (e.g., code, firefox)"
    echo "Two parameters:"
    echo "  - First: Package group name"
    echo "  - Second: Application name within that group"
    echo "All matching is case-insensitive internally"
    echo ""

    if [ -n "$param2" ]; then
        echo "Your input: Group='$param1', App='$param2'"
        echo "Will search for applications containing '$param2' in group '$param1'"
    else
        if [[ "$param1" =~ ^[A-Z]+$ ]]; then
            echo "Your input: '$param1' (UPPERCASE detected)"
            echo "Will search for package group matching '$param1'"
        else
            echo "Your input: '$param1' (lowercase detected)"
            echo "Will search for applications containing '$param1' in name"
        fi
    fi

    echo ""
    echo "Press 'y' or any key to continue, 'n' to cancel:"
    read -r -n 1 response
    echo ""

    case "$response" in
        [nN])
            echo "Operation cancelled by user."
            return 1
            ;;
        *)
            echo "Continuing with installation..."
            return 0
            ;;
    esac
}

# Function to handle cleanup command
handle_cleanup() {
    local exec_name="$1"

    if [ -z "$exec_name" ]; then
        log_message "Error: No executable name provided for cleanup"
        echo "Usage: $0 --cleanup <executable_name>"
        return 1
    fi

    log_message "=========================================="
    log_message "Force Cleanup Mode: $exec_name"
    log_message "=========================================="

    force_cleanup_package "$exec_name" "$exec_name"

    log_message "Cleanup completed for: $exec_name"
    return 0
}

# Main installation logic
main() {
    local param1="$1"
    local param2="$2"

    # Check for help request
    if [ "$param1" = "--help" ] || [ "$param1" = "-h" ]; then
        show_help
        return 0
    fi

    # Check for cleanup request
    if [ "$param1" = "--cleanup" ]; then
        handle_cleanup "$param2"
        return $?
    fi

    log_message "=========================================="
    log_message "Starting Linux Desktop Applications Installation"
    log_message "Install Mode: $INSTALL_MODE"

    # Check if we're in test mode (any parameters provided)
    if [ -n "$param1" ]; then
        # Show parameter rules and wait for confirmation
        if ! show_parameter_rules_and_confirm "$param1" "$param2"; then
            log_message "Installation cancelled by user"
            return 1
        fi

        log_message "Test Mode Parameters: '$param1' '$param2'"
        log_message "Ignoring installation flag files"
        log_message "=========================================="

        # Handle two parameters: group + app name
        if [ -n "$param2" ]; then
            log_message "Two parameter mode: Group='$param1', App='$param2'"
            if test_applications_by_name "$param2" "$param1"; then
                return 0
            fi
            log_message "No matches found for app '$param2' in group '$param1'"
            return 1
        fi

        # Handle single parameter: determine if it's group or app based on case
        if [[ "$param1" =~ ^[A-Z]+$ ]]; then
            # All uppercase - treat as package group
            log_message "Single parameter (UPPERCASE): treating '$param1' as package group"
            if test_package_group "$param1"; then
                return 0
            fi
            log_message "No package group found matching: $param1"
            return 1
        else
            # Contains lowercase - treat as application name
            log_message "Single parameter (contains lowercase): treating '$param1' as application name"
            if test_applications_by_name "$param1"; then
                return 0
            fi
            log_message "No applications found matching: $param1"
            return 1
        fi
    fi

    log_message "=========================================="
    
    # Ensure system is up to date
    log_message "Updating package lists with timeout..."
    if timeout 300 $USE_SUDO apt update; then
        log_message "Package lists updated successfully"
    else
        log_message "Warning: Package update timed out or failed, continuing anyway"
    fi
    
    # Install essential packages first
    log_message "Installing essential system packages with timeout..."
    if timeout 600 $USE_SUDO apt install -y curl wget software-properties-common apt-transport-https ca-certificates gnupg lsb-release; then
        log_message "Essential packages installed successfully"
    else
        log_message "Warning: Some essential packages failed to install, continuing anyway"
    fi
    
    # Install package groups based on configuration flags
    log_message "Package group installation flags:"
    log_message "  BASE_PACKAGES: $INSTALL_BASE_PACKAGES"
    log_message "  DEV_PACKAGES: $INSTALL_DEV_PACKAGES"
    log_message "  APP_PACKAGES: $INSTALL_APP_PACKAGES"
    log_message "  AI_PACKAGES: $INSTALL_AI_PACKAGES"
    log_message "  MCP_PACKAGES: $INSTALL_MCP_PACKAGES"
    log_message ""

    # Install Base Packages
    if prompt_package_group_installation "BASE_PACKAGES" "Essential base applications" "$INSTALL_BASE_PACKAGES"; then
        install_applications_by_package_group "BASE"
    fi

    # Install Development Packages
    if prompt_package_group_installation "DEV_PACKAGES" "Development tools and IDEs" "$INSTALL_DEV_PACKAGES"; then
        install_applications_by_package_group "DEV"
    fi

    # Install Application Packages
    if prompt_package_group_installation "APP_PACKAGES" "Desktop applications and productivity tools" "$INSTALL_APP_PACKAGES"; then
        install_applications_by_package_group "APP"
    fi

    # Install AI Packages
    if prompt_package_group_installation "AI_PACKAGES" "AI development tools and assistants" "$INSTALL_AI_PACKAGES"; then
        install_applications_by_package_group "AI"
    fi

    # Install MCP Packages
    if prompt_package_group_installation "MCP_PACKAGES" "MCP service packages" "$INSTALL_MCP_PACKAGES"; then
        install_applications_by_package_group "MCP"
    fi
    
    log_message "=========================================="
    log_message "Desktop Applications Installation Complete"
    log_message "Log file: $LOG_FILE"
    log_message "=========================================="
}

# Check if running as root (not recommended for desktop applications)
if [ "$(id -u)" -eq 0 ]; then
    log_message "Warning: Running as root. Some desktop applications may not work correctly."
    log_message "Consider running this script as a regular user with sudo access."
fi

# Execute main function
main "$1" "$2"
