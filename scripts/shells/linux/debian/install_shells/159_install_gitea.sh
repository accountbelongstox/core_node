#!/bin/bash
# Gitea Installation Script
#
# Prerequisites:
#   - Git must be installed (run 27_install_git_ssh.sh first)
#   - SQLite3 (automatically installed)
#   - wget/curl (automatically installed)
#
# Usage:
#   ./159_install_gitea.sh   # Normal installation (no arguments)
#
# This script installs Gitea - a self-hosted Git service
# After installation, it will detect all IPs and display available web addresses
#

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
SCRIPT_INDEX="124"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
GITEA_INSTALL_BACKEND="$PARENT_DIR_LEVEL_2/common/gitea_install_backend_common.sh"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/installation_library.sh"
source "$PARENT_DIR_LEVEL_2/common/firewall_manager.sh"
source "$PARENT_DIR_LEVEL_2/common/arrow_menu.sh"
source "$GITEA_INSTALL_BACKEND"

# Initialize global variables
init_global_vars

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
INSTALL_GITEA=$(get_var "INSTALL_GITEA" "true")

# Gitea version and configuration
GITEA_VERSION="1.21.5"
GITEA_ARCH="linux-amd64"
GITEA_BINARY_URL="https://dl.gitea.com/gitea/${GITEA_VERSION}/gitea-${GITEA_VERSION}-${GITEA_ARCH}"

# Set up Gitea directories
WWWROOT_DIR=$(map_web_path "wwwroot")
GITEA_BASE_DIR="$WWWROOT_DIR/data/gitea"
GITEA_BINARY="/usr/local/bin/gitea"
GITEA_DATA_DIR="$GITEA_BASE_DIR/data"
GITEA_CONFIG_DIR="$GITEA_BASE_DIR/config"
GITEA_CUSTOM_DIR="$GITEA_BASE_DIR/custom"
GITEA_LOG_DIR="$GITEA_BASE_DIR/log"
GITEA_INSTALLED_FLAG="$GITEA_BASE_DIR/.installed"
GITEA_CACHE_DIR="$GITEA_BASE_DIR/cache"
GITEA_USER="git"
GITEA_PORT="3000"
GITEA_SERVICE="gitea"

# Ensure sudo is available and set USE_SUDO
if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
else
    USE_SUDO=""
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# No arguments supported (removed parameter parsing)


# Cleanup Gitea installation
cleanup_gitea() {
    print_header_from_common_functions "Cleaning up Gitea installation"

    # Stop and disable service
    if $USE_SUDO systemctl is-active --quiet gitea 2>/dev/null; then
        print_step_from_common_functions "Stopping Gitea service..."
        $USE_SUDO systemctl stop gitea
    fi

    if $USE_SUDO systemctl is-enabled --quiet gitea 2>/dev/null; then
        print_step_from_common_functions "Disabling Gitea service..."
        $USE_SUDO systemctl disable gitea
    fi

    # Remove systemd service
    if [[ -f "/etc/systemd/system/gitea.service" ]]; then
        print_step_from_common_functions "Removing systemd service..."
        $USE_SUDO rm -f "/etc/systemd/system/gitea.service"
        $USE_SUDO systemctl daemon-reload
    fi

    # Remove binary
    if [[ -f "$GITEA_BINARY" ]]; then
        print_step_from_common_functions "Removing Gitea binary..."
        $USE_SUDO rm -f "$GITEA_BINARY"
    fi

    # Remove firewall rule using firewall_manager.sh
    print_step_from_common_functions "Removing firewall rule..."
    firewall_remove_port "$GITEA_PORT" "tcp" 2>/dev/null || true

    # Remove base directory (contains data, config, custom, and log)
    if [[ -d "$GITEA_BASE_DIR" ]]; then
        print_step_from_common_functions "Removing Gitea base directory: $GITEA_BASE_DIR"
        $USE_SUDO rm -rf "$GITEA_BASE_DIR"
    fi

    # Note: We don't remove the git user as it may be used by other services

    print_success_from_common_functions "Gitea cleanup completed"
    return 0
}

# Main installation function
install_gitea() {
    print_header_from_common_functions "Installing Gitea"

    # Check Git installation (CRITICAL DEPENDENCY)
    if ! check_git_installation; then
        print_error_from_common_functions "Git is required but not installed"
        print_info_from_common_functions "Please install Git first by running: ./27_install_git_ssh.sh"
        return 1
    fi

    # Install dependencies
    if ! install_dependencies; then
        return 1
    fi

    # Create Gitea user
    if ! create_gitea_user; then
        return 1
    fi

    # Download Gitea
    if ! download_gitea; then
        return 1
    fi

    # Create directories
    if ! create_directories; then
        return 1
    fi

    # Create Gitea configuration
    if ! create_gitea_config; then
        return 1
    fi

    # Create systemd service
    if ! create_systemd_service; then
        return 1
    fi

    # Configure firewall
    configure_firewall

    # Start service
    if ! start_gitea_service; then
        return 1
    fi

    # Save installation info
    save_installation_info "$GITEA_VERSION"

    print_success_from_common_functions "Gitea installation completed successfully!"

    # Display web access information
    display_web_access_info

    return 0
}

# Interactive cleanup prompt with version check
# Repair Gitea configuration without removing data
repair_gitea_configuration() {
    print_header_from_common_functions "Repairing Gitea Configuration"
    print_info_from_common_functions "This will update configuration and service files without touching your data"
    echo ""

    # Download/update binary if version mismatch
    local current_binary_version=""
    if [[ -f "$GITEA_BINARY" ]]; then
        current_binary_version=$($GITEA_BINARY --version 2>/dev/null | grep -oP 'version \K[0-9.]+' | head -n1 || echo "")
    fi

    if [[ "$current_binary_version" != "$GITEA_VERSION" ]]; then
        print_step_from_common_functions "Updating Gitea binary from $current_binary_version to $GITEA_VERSION..."
        if ! download_gitea; then
            print_warning_from_common_functions "Failed to update binary, keeping current version"
        fi
    else
        print_info_from_common_functions "Gitea binary is already up-to-date (version $GITEA_VERSION)"
    fi

    # Ensure directories exist with correct permissions
    print_step_from_common_functions "Verifying directory structure..."
    create_directories

    # Ensure user privileges and permissions are correct
    print_step_from_common_functions "Verifying user privileges..."
    ensure_gitea_user_privileges

    # Update configuration file (preserves existing config, only updates paths)
    print_step_from_common_functions "Updating configuration file..."
    create_gitea_config

    # Recreate systemd service (idempotent)
    print_step_from_common_functions "Updating systemd service..."
    create_systemd_service

    # Ensure firewall rules are in place
    print_step_from_common_functions "Verifying firewall rules..."
    configure_firewall

    # Regenerate Git hooks to ensure paths are correct
    print_step_from_common_functions "Regenerating repository Git hooks..."
    $USE_SUDO -u $GITEA_USER $GITEA_BINARY --config "$GITEA_CONFIG_DIR/app.ini" --work-path "$GITEA_DATA_DIR" --custom-path "$GITEA_CUSTOM_DIR" admin regenerate hooks 2>/dev/null || true

    # Restart service to apply changes
    print_step_from_common_functions "Restarting Gitea service..."
    $USE_SUDO systemctl restart gitea 2>/dev/null || start_gitea_service

    # Update installation info
    save_installation_info "$GITEA_VERSION"

    print_success_from_common_functions "Gitea configuration repaired successfully!"
    print_info_from_common_functions "All your repositories and data are preserved"
    echo ""

    # Display access info
    display_web_access_info

    return 0
}

# Disable Gitea service
disable_gitea_service() {
    print_info_from_common_functions "Checking Gitea service status..."

    # Check if Gitea is installed and running
    local gitea_running=false
    if systemctl is-active --quiet gitea 2>/dev/null; then
        gitea_running=true
        print_warning_from_common_functions "Gitea service is currently running"
    elif is_gitea_installed; then
        print_info_from_common_functions "Gitea is installed but not running"
    else
        print_info_from_common_functions "Gitea is not installed"
        return 0
    fi

    # Only prompt if Gitea is installed
    if is_gitea_installed || [[ "$gitea_running" == true ]]; then
        echo ""
        print_warning_from_common_functions "INSTALL_GITEA is set to false"
        echo -n "Do you want to disable Gitea service? (y/N) [N]: "
        read -r response

        case "$response" in
            [yY]|[yY][eE][sS])
                print_info_from_common_functions "Disabling Gitea service..."

                # Stop the service if running
                if [[ "$gitea_running" == true ]]; then
                    print_step_from_common_functions "Stopping Gitea service..."
                    if $USE_SUDO systemctl stop gitea 2>/dev/null; then
                        print_success_from_common_functions "Gitea service stopped"
                    else
                        print_warning_from_common_functions "Failed to stop Gitea service"
                    fi
                fi

                # Disable the service
                print_step_from_common_functions "Disabling Gitea service..."
                if $USE_SUDO systemctl disable gitea 2>/dev/null; then
                    print_success_from_common_functions "Gitea service disabled"
                else
                    print_warning_from_common_functions "Failed to disable Gitea service (may not be enabled)"
                fi

                # Optionally close firewall port
                print_step_from_common_functions "Checking firewall configuration..."
                if command -v ufw >/dev/null 2>&1 && $USE_SUDO ufw status 2>/dev/null | grep -q "Status: active"; then
                    print_info_from_common_functions "UFW firewall is active"
                    echo -n "Do you want to close port $GITEA_PORT in firewall? (y/N) [N]: "
                    read -r fw_response
                    case "$fw_response" in
                        [yY]|[yY][eE][sS])
                            if $USE_SUDO ufw delete allow "$GITEA_PORT/tcp" 2>/dev/null; then
                                print_success_from_common_functions "Firewall rule removed for port $GITEA_PORT"
                            else
                                print_warning_from_common_functions "No firewall rule found for port $GITEA_PORT"
                            fi
                            ;;
                        *)
                            print_info_from_common_functions "Keeping firewall rule"
                            ;;
                    esac
                fi

                echo ""
                print_success_from_common_functions "Gitea service has been disabled"
                print_info_from_common_functions "To re-enable: sudo systemctl enable gitea && sudo systemctl start gitea"
                return 0
                ;;
            ""|[nN]|[nN][oO])
                print_info_from_common_functions "Keeping Gitea service as is"
                return 0
                ;;
            *)
                print_info_from_common_functions "Invalid choice, keeping current state"
                return 0
                ;;
        esac
    fi

    return 0
}

prompt_cleanup_reinstall() {
    local confirm=""
    local installed_version=""
    local response=3
    local selected_index=2
    local -a action_menu_items=(
        "Repair configuration (recommended - preserves all data)"
        "Full reinstall (WARNING: deletes all repositories and data)"
        "Keep current installation and exit"
    )

    if is_gitea_installed; then
        print_warning_from_common_functions "Gitea is already installed"

        installed_version=$(get_installed_version)
        if [[ -n "$installed_version" ]]; then
            print_info_from_common_functions "Installed version: $installed_version"
            print_info_from_common_functions "Target version: $GITEA_VERSION"
        else
            print_info_from_common_functions "No version metadata found for current installation"
        fi

        echo ""
        display_user_accounts

        arrow_menu_select "Existing Gitea Installation" action_menu_items 2 2
        selected_index=$ARROW_MENU_SELECTED_INDEX
        response=$((selected_index + 1))

        case "$response" in
            2)
                print_warning_from_common_functions "Full reinstall will DELETE all repositories and data!"
                echo -n "Are you sure? Type 'yes' to confirm: "
                read -r confirm
                if [[ "$confirm" == "yes" ]]; then
                    print_info_from_common_functions "Performing full reinstall..."
                    cleanup_gitea
                    return 0
                else
                    print_info_from_common_functions "Reinstall cancelled"
                    return 1
                fi
                ;;
            3|""|[nN]|[nN][oO])
                print_info_from_common_functions "Keeping current installation"

                # Restart service when installation is allowed
                if [[ "$INSTALL_GITEA" != "false" ]]; then
                    print_step_from_common_functions "Restarting Gitea service..."
                    if $USE_SUDO systemctl restart gitea 2>/dev/null; then
                        print_success_from_common_functions "Gitea service restarted"
                    else
                        print_warning_from_common_functions "Failed to restart Gitea service"
                    fi

                    # Display access info
                    echo ""
                    display_web_access_info
                fi

                return 1
                ;;
            1|[yY]|[yY][eE][sS])
                print_info_from_common_functions "Repairing configuration..."
                repair_gitea_configuration
                return 1
                ;;
            *)
                print_info_from_common_functions "Invalid choice, exiting"
                return 1
                ;;
        esac
    fi
    return 0
}

# Backup Gitea data
# This function stops the service, creates a timestamped backup archive, and optionally starts a download server
backup_gitea_data() {
    print_header_from_common_functions "Gitea Data Backup"

    if ! is_gitea_installed; then
        print_error_from_common_functions "Gitea is not installed"
        print_info_from_common_functions "Please install Gitea first using this script"
        return 1
    fi

    local was_running=false
    if systemctl is-active --quiet "$GITEA_SERVICE" 2>/dev/null; then
        was_running=true
        print_info_from_common_functions "Gitea service is running and will be stopped for backup"
    fi

    # Stop Gitea service
    if [[ "$was_running" == true ]]; then
        print_step_from_common_functions "Stopping Gitea service..."
        if ! $USE_SUDO systemctl stop "$GITEA_SERVICE"; then
            print_error_from_common_functions "Failed to stop Gitea service"
            return 1
        fi
        sleep 3
        print_success_from_common_functions "Gitea service stopped"
    fi

    # Create backup directory
    local backup_base_dir=$(map_web_path "www")
    local backup_dir="$backup_base_dir/backups/gitea"
    $USE_SUDO mkdir -p "$backup_dir"
    $USE_SUDO chmod 755 "$backup_dir" 2>/dev/null || true

    # Create timestamped backup filename
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_filename="gitea-backup-${timestamp}.tar.gz"
    local backup_path="$backup_dir/$backup_filename"

    print_step_from_common_functions "Creating backup archive: $backup_filename"
    print_info_from_common_functions "This may take a while depending on data size..."

    # Create backup archive
    cd "$GITEA_BASE_DIR" || {
        print_error_from_common_functions "Failed to change to Gitea base directory"
        if [[ "$was_running" == true ]]; then
            $USE_SUDO systemctl start "$GITEA_SERVICE"
        fi
        return 1
    }

    if $USE_SUDO tar -czf "$backup_path" data config custom log 2>/dev/null; then
        $USE_SUDO chmod 640 "$backup_path" 2>/dev/null || true
        local backup_size=$(du -h "$backup_path" | cut -f1)
        print_success_from_common_functions "Backup created successfully"
        print_info_from_common_functions "Backup file: $backup_filename"
        print_info_from_common_functions "Backup size: $backup_size"
        print_info_from_common_functions "Backup location: $backup_path"
    else
        print_error_from_common_functions "Backup failed"
        if [[ "$was_running" == true ]]; then
            $USE_SUDO systemctl start "$GITEA_SERVICE"
        fi
        return 1
    fi

    # Restart service if it was running
    if [[ "$was_running" == true ]]; then
        echo ""
        print_step_from_common_functions "Starting Gitea service..."
        if $USE_SUDO systemctl start "$GITEA_SERVICE"; then
            sleep 3
            if systemctl is-active --quiet "$GITEA_SERVICE" 2>/dev/null; then
                print_success_from_common_functions "Gitea service started"
            else
                print_warning_from_common_functions "Gitea service may not have started properly"
            fi
        else
            print_error_from_common_functions "Failed to start Gitea service"
            print_warning_from_common_functions "Please start Gitea manually: sudo systemctl start gitea"
        fi
    fi

    echo ""
    print_success_from_common_functions "Backup completed successfully"
    echo "$backup_path"
    return 0
}

# Main script execution
main() {
    # Check if Gitea installation is disabled via global variable
    if [[ "$INSTALL_GITEA" == "false" ]]; then
        print_header_from_common_functions "Gitea Installation Script"
        print_warning_from_common_functions "INSTALL_GITEA is set to false"
        print_info_from_common_functions "Gitea installation is disabled in configuration"
        echo ""

        # Show current user accounts if Gitea is installed
        if is_gitea_installed; then
            display_user_accounts
        fi

        # Check if Gitea is already installed and offer to disable it
        disable_gitea_service
        exit 0
    fi

    print_header_from_common_functions "Gitea Installation Script"
    print_info_from_common_functions "Installation Directory: $GITEA_INSTALL_DIR"
    print_info_from_common_functions "Version: $GITEA_VERSION"

    # Interactive cleanup prompt
    if ! prompt_cleanup_reinstall; then
        exit 0
    fi

    # Run installation
    install_gitea
    exit $?
}

# Run main function (no arguments supported)
main
