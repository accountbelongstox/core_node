#!/bin/bash
# Desktop Applications Installation Script
#
# Usage:
#   ./153_install_desktop_applications.sh                    # Normal installation using config flags
#   ./153_install_desktop_applications.sh DEV               # Test install DEV package group (UPPERCASE = group)
#   ./153_install_desktop_applications.sh code              # Test install apps containing "code" in name (lowercase = app)
#   ./153_install_desktop_applications.sh DEV firefox       # Test install "firefox" apps from DEV group
#   ./153_install_desktop_applications.sh --cleanup code    # Force cleanup "code" from all package managers
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
SCRIPT_INDEX="121"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
DESKTOP_APPLICATION_INSTALLER="$PARENT_DIR_LEVEL_2/common/desktop_application_installer.sh"
DESKTOP_APPLICATION_REPORTING="$PARENT_DIR_LEVEL_2/common/desktop_application_reporting.sh"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/linux_applications_list.sh"
source "$PARENT_DIR_LEVEL_2/common/installation_library.sh"
source "$PARENT_DIR_LEVEL_2/common/desktop_shortcut_manager.sh"
source "$PARENT_DIR_LEVEL_1/debian_com/super_launch_helper.sh"

# Clear old NPM environment variable immediately
if [ -n "$NPM_CONFIG_PREFIX" ]; then
    unset NPM_CONFIG_PREFIX
fi

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
SCRIPT_TEMP_DIR=$(create_script_temp_dir "121_install_desktop_applications")
LOG_FILE="$SCRIPT_TEMP_DIR/desktop_apps_install_$(date +%Y%m%d_%H%M%S).log"

# Track installation results globally
declare -A INSTALLATION_RESULTS  # app_name -> status (success/failed/skipped/unavailable)
SKIPPED_APPS=()                   # Apps not installed due to missing packages
FAILED_APPS=()                    # Apps that failed installation
UNAVAILABLE_APPS=()               # Apps with package_id not found in registry

# Determine environment type and get packages to install
if [ "$HAS_DESKTOP_ENVIRONMENT" = true ]; then
    ENVIRONMENT_TYPE="desktop"
elif [ "$IS_WSL" = true ]; then
    ENVIRONMENT_TYPE="wsl"
elif [ "$IS_PRODUCTION" = true ]; then
    ENVIRONMENT_TYPE="server"
else
    ENVIRONMENT_TYPE="desktop"
fi

INSTALL_AI_TOOLS=$(get_var "INSTALL_AI_TOOLS" "false")
source "$DESKTOP_APPLICATION_INSTALLER"
source "$DESKTOP_APPLICATION_REPORTING"


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
    local skipped_count=0

    for app in "${apps_to_install[@]}"; do
        local lookup_app="$app"
        if [[ "$app" == mcp_* ]]; then
            lookup_app="${app#mcp_}"
        fi
        local display_name=$(get_app_property "$lookup_app" "name")
        
        # Ensure display_name is valid for array subscript
        if [[ -z "$display_name" ]]; then
            display_name="$lookup_app"
        fi
        # Remove any problematic characters for array subscript
        display_name=$(echo "$display_name" | sed 's/[^a-zA-Z0-9_-]/_/g')

        local exec_name=$(get_app_property "$lookup_app" "exec")
        install_application "$app" "$package_group"
        if command_exists "$exec_name"; then
            ((installed_count++))
            INSTALLATION_RESULTS["$display_name"]="success"
        else
            ((failed_count++))
            INSTALLATION_RESULTS["$display_name"]="failed"
            FAILED_APPS+=("$display_name")
        fi
    done

    log_message "Package group $package_group installation complete: $installed_count successful, $failed_count failed, $skipped_count skipped"
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
        local lookup_app="$app"
        if [[ "$app" == mcp_* ]]; then
            lookup_app="${app#mcp_}"
        fi
        local exec_name=$(get_app_property "$lookup_app" "exec")
        install_application "$app"
        if command_exists "$exec_name"; then
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

    # Need to track which app belongs to which group for proper super launch handling
    for app in "${found_apps[@]}"; do
        local app_group=""
        # Find which group this app belongs to
        for group in "${search_groups[@]}"; do
            local group_apps
            mapfile -t group_apps < <(get_apps_by_package_group "$group")
            for g_app in "${group_apps[@]}"; do
                if [ "$g_app" = "$app" ]; then
                    app_group="$group"
                    break 2
                fi
            done
        done

        if install_application "$app" "$app_group"; then
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
    echo "  $0 --exact-app <key>     # Install single app by key (e.g. chrome, firefox)"
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
            return
            ;;
        *)
            echo "Continuing with installation..."
            ;;
    esac
}

# Function to handle cleanup command
handle_cleanup() {
    local exec_name="$1"

    if [ -z "$exec_name" ]; then
        log_message "Error: No executable name provided for cleanup"
        echo "Usage: $0 --cleanup <executable_name>"
        return
    fi

    log_message "=========================================="
    log_message "Force Cleanup Mode: $exec_name"
    log_message "=========================================="

    force_cleanup_package "$exec_name" "$exec_name"

    log_message "Cleanup completed for: $exec_name"
}

# Find which package group contains the given app key
find_group_for_app() {
    local app_key="$1"
    local group
    for group in BASE DEV APP AI MCP; do
        local apps_in_group
        mapfile -t apps_in_group < <(get_apps_by_package_group "$group")
        local a
        for a in "${apps_in_group[@]}"; do
            if [ "$a" = "$app_key" ]; then
                echo "$group"
                return
            fi
        done
    done
}

# Function to install exactly one app by key (used by APP Install menu)
handle_exact_app() {
    local app_key="$1"

    if [ -z "$app_key" ]; then
        log_message "Error: No app key provided"
        echo "Usage: $0 --exact-app <app_key>"
        return
    fi

    local app_group
    app_group=$(find_group_for_app "$app_key")
    if [ -z "$app_group" ]; then
        log_message "Error: App key not found in any group: $app_key"
        return
    fi

    log_message "=========================================="
    log_message "Exact App Install: $app_key (group: $app_group)"
    log_message "=========================================="

    log_message "Checking and fixing pnpm global binary permissions..."
    fix_pnpm_permissions

    log_message "Updating package lists with timeout..."
    timeout 300 $USE_SUDO apt update 2>/dev/null || true

    log_message "Installing essential system packages with timeout..."
    timeout 600 $USE_SUDO DEBIAN_FRONTEND=noninteractive apt install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" curl wget software-properties-common apt-transport-https ca-certificates gnupg lsb-release 2>/dev/null || true

    if install_application "$app_key" "$app_group"; then
        log_message "Installation completed for: $app_key"
    else
        log_message "Installation finished for: $app_key (check log for details)"
    fi
}

# Main installation logic
main() {
    local param1="$1"
    local param2="$2"

    # Check if non-desktop system - skip directly (unless test mode)
    if [ "$HAS_DESKTOP_ENVIRONMENT" = false ] && [ -z "$param1" ]; then
        log_message "=========================================="
        log_message "Non-Desktop System Detected"
        log_message "=========================================="
        log_message "Non-desktop system detected - will filter out desktop applications"
        log_message "=========================================="
    fi

    # Always fix pnpm permissions first (regardless of what the script does)
    log_message "=========================================="
    log_message "Checking and fixing pnpm global binary permissions..."
    log_message "=========================================="
    fix_pnpm_permissions

    # Check for help request
    if [ "$param1" = "--help" ] || [ "$param1" = "-h" ]; then
        show_help
        return
    fi

    # Check for cleanup request
    if [ "$param1" = "--cleanup" ]; then
        handle_cleanup "$param2"
        return
    fi

    # Check for exact app install (APP Install menu)
    if [ "$param1" = "--exact-app" ]; then
        handle_exact_app "$param2"
        return
    fi

    log_message "=========================================="
    log_message "Starting Linux Desktop Applications Installation"
    log_message "Install Mode: $INSTALL_MODE"

    # Check if we're in test mode (any parameters provided)
    if [ -n "$param1" ]; then
        # Test mode: use parameters to control flow
        log_message "Test Mode: Using parameters to control installation"
        log_message "Parameter: $param1 $param2"
        log_message "=========================================="

        # Determine which package group to install based on param1
        local target_group=""
        local param_upper=$(echo "$param1" | tr '[:lower:]' '[:upper:]')

        case "$param_upper" in
            *BASE*)
                target_group="BASE"
                ;;
            *DEV*)
                target_group="DEV"
                ;;
            *APP*)
                target_group="APP"
                ;;
            *AI*)
                target_group="AI"
                ;;
            *MCP*)
                target_group="MCP"
                ;;
            *)
                log_message "Error: Unknown package group parameter: $param1"
                log_message "Valid parameters: BASE, DEV, APP, AI, MCP"
                return
                ;;
        esac

        log_message "Matched package group: $target_group"
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
        if timeout 600 $USE_SUDO DEBIAN_FRONTEND=noninteractive apt install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" curl wget software-properties-common apt-transport-https ca-certificates gnupg lsb-release; then
            log_message "Essential packages installed successfully"
        else
            log_message "Warning: Some essential packages failed to install, continuing anyway"
        fi

        log_message ""
        log_message "Installing $target_group package group..."
        log_message "=========================================="
        install_applications_by_package_group "$target_group"

        log_message ""
        log_message "=========================================="
        log_message "$target_group Package Group Installation Complete"
        log_message "Log file: $LOG_FILE"
        log_message "=========================================="

        # Print detailed installation report
        print_installation_report
        return
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
    if timeout 600 $USE_SUDO DEBIAN_FRONTEND=noninteractive apt install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" curl wget software-properties-common apt-transport-https ca-certificates gnupg lsb-release; then
        log_message "Essential packages installed successfully"
    else
        log_message "Warning: Some essential packages failed to install, continuing anyway"
    fi

    # Determine which package groups to install based on environment type
    log_message "=========================================="
    log_message "Environment Detection Results:"
    log_message "  Environment Type: $ENVIRONMENT_TYPE"
    log_message "  IS_WSL: $IS_WSL"
    log_message "  IS_PRODUCTION: $IS_PRODUCTION"
    log_message "  HAS_DESKTOP_ENVIRONMENT: $HAS_DESKTOP_ENVIRONMENT"
    log_message "=========================================="
    log_message ""

    # Determine which package groups to install
    local packages_to_install=()
    case "$ENVIRONMENT_TYPE" in
        desktop)
            log_message "Detected: Desktop Environment"
            log_message "Will install: BASE, DEV, APP, AI, and MCP packages"
            packages_to_install=("BASE" "DEV" "APP" "AI" "MCP")
            ;;
        wsl)
            log_message "Detected: WSL Environment"
            log_message "Will install: BASE, DEV, AI, and MCP packages (skipping APP)"
            packages_to_install=("BASE" "DEV" "AI" "MCP")
            ;;
        server)
            log_message "Detected: Server Environment"
            log_message "Will install: BASE, AI, and MCP packages (skipping DEV and APP)"
            packages_to_install=("BASE" "AI" "MCP")
            ;;
    esac

    log_message ""
    log_message "Installation Plan:"
    printf '  - %s\n' "${packages_to_install[@]}"
    log_message ""
    log_message "Continue with installation? (Y/n, auto-yes in 20s): "
    if read -t 20 -r response; then
        if [[ "$response" =~ ^[Nn]$ ]]; then
            log_message "Installation cancelled by user"
            return
        else
            log_message "User confirmed, starting installation..."
        fi
    else
        log_message "No response after 20 seconds, automatically continuing..."
    fi
    log_message "Starting package installation..."
    log_message "=========================================="
    log_message ""

    # Install each package group
    for package_group in "${packages_to_install[@]}"; do
        log_message ""
        log_message "=========================================="
        log_message "Installing $package_group packages..."
        log_message "=========================================="
        install_applications_by_package_group "$package_group"
    done

    log_message "=========================================="
    log_message "Desktop Applications Installation Complete"
    log_message "Log file: $LOG_FILE"
    log_message "=========================================="

    # Fix pnpm permissions after all installations
    log_message ""
    log_message "=========================================="
    log_message "Fixing pnpm global binary permissions..."
    log_message "=========================================="
    fix_pnpm_permissions

    # Print detailed installation report
    print_installation_report
}

# Check if running as root (not recommended for desktop applications)
if [ "$(id -u)" -eq 0 ]; then
    log_message "Warning: Running as root. Some desktop applications may not work correctly."
    log_message "Consider running this script as a regular user with sudo access."
fi

# Execute main function
main "$1" "$2"
