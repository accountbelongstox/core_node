#!/bin/bash
# Gitea Backup Core Functions
# This file contains core backup logic for Gitea
# Called by backup_management_main.sh

BACKUP_CORE_VERSION="1.0.0"

# Load common functions if not already loaded
if [[ -z "$GVAR_COMMON_LOADED" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
    source "$COMMON_DIR/gvar_common.sh"
    source "$COMMON_DIR/common_functions.sh"
fi

# Gitea configuration
GITEA_USER="git"
GITEA_SERVICE="gitea"
GITEA_BINARY="/usr/local/bin/gitea"
WWWROOT_DIR=$(map_web_path "wwwroot")
GITEA_BASE_DIR="$WWWROOT_DIR/data/gitea"
GITEA_DATA_DIR="$GITEA_BASE_DIR/data"
GITEA_CONFIG_DIR="$GITEA_BASE_DIR/config"
GITEA_CUSTOM_DIR="$GITEA_BASE_DIR/custom"
GITEA_LOG_DIR="$GITEA_BASE_DIR/log"

# Source common backup functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/backup_common.sh"

# Backup configuration
GITEA_NAMESPACE="gitea"
BACKUP_DIR=$(get_backup_dir "$GITEA_NAMESPACE")
BACKUP_RETENTION_DAYS=30

# Check if Gitea is installed
is_gitea_installed() {
    if [[ -f "$GITEA_BINARY" ]] && [[ -d "$GITEA_BASE_DIR" ]]; then
        return 0
    fi
    return 1
}

# Check if Gitea service is running
is_gitea_running() {
    if systemctl is-active --quiet "$GITEA_SERVICE" 2>/dev/null; then
        return 0
    fi
    return 1
}

# Stop Gitea service
stop_gitea_service() {
    print_step_from_common_functions "Stopping Gitea service..."

    if ! is_gitea_running; then
        print_info_from_common_functions "Gitea service is not running"
        return 0
    fi

    if $USE_SUDO systemctl stop "$GITEA_SERVICE"; then
        sleep 3
        if is_gitea_running; then
            print_error_from_common_functions "Failed to stop Gitea service"
            return 1
        fi
        print_success_from_common_functions "Gitea service stopped"
        return 0
    else
        print_error_from_common_functions "Failed to stop Gitea service"
        return 1
    fi
}

# Start Gitea service
start_gitea_service() {
    print_step_from_common_functions "Starting Gitea service..."

    if is_gitea_running; then
        print_info_from_common_functions "Gitea service is already running"
        return 0
    fi

    if $USE_SUDO systemctl start "$GITEA_SERVICE"; then
        sleep 3
        if ! is_gitea_running; then
            print_error_from_common_functions "Gitea service failed to start"
            return 1
        fi
        print_success_from_common_functions "Gitea service started"
        return 0
    else
        print_error_from_common_functions "Failed to start Gitea service"
        return 1
    fi
}

# Get Gitea version
get_gitea_version() {
    if [[ -f "$GITEA_BINARY" ]]; then
        $GITEA_BINARY --version 2>/dev/null | grep -oP 'version \K[0-9.]+' | head -n1 || echo "unknown"
    else
        echo "not-installed"
    fi
}

# Create backup filename (using common function)
create_gitea_backup_filename() {
    create_backup_filename "$GITEA_NAMESPACE" "gitea" "zip"
}

# Perform Gitea backup
backup_gitea() {
    print_header_from_common_functions "Gitea Backup"

    if ! is_gitea_installed; then
        print_error_from_common_functions "Gitea is not installed"
        print_info_from_common_functions "Please install Gitea first using 124_install_gitea.sh"
        return 1
    fi

    local was_running=false
    if is_gitea_running; then
        was_running=true
    fi

    print_info_from_common_functions "Gitea version: $(get_gitea_version)"
    print_info_from_common_functions "Base directory: $GITEA_BASE_DIR"
    print_info_from_common_functions "Backup directory: $BACKUP_DIR"
    echo ""

    $USE_SUDO mkdir -p "$BACKUP_DIR"
    $USE_SUDO chmod 755 "$BACKUP_DIR" 2>/dev/null || true

    local backup_filename=$(create_gitea_backup_filename)
    local backup_path="$BACKUP_DIR/$backup_filename"

    print_warning_from_common_functions "Gitea service MUST be stopped during backup to ensure consistency"
    if [[ "$was_running" == true ]]; then
        print_info_from_common_functions "Gitea service is currently running and will be stopped"
    fi
    echo ""

    if ! stop_gitea_service; then
        print_error_from_common_functions "Cannot proceed with backup - failed to stop service"
        return 1
    fi

    print_step_from_common_functions "Creating backup: $backup_filename"
    print_info_from_common_functions "This may take a while depending on repository size..."
    echo ""

    cd "$GITEA_BASE_DIR" || {
        print_error_from_common_functions "Failed to change to Gitea base directory"
        if [[ "$was_running" == true ]]; then
            start_gitea_service
        fi
        return 1
    }

    if $USE_SUDO -u "$GITEA_USER" "$GITEA_BINARY" dump \
        -c "$GITEA_CONFIG_DIR/app.ini" \
        --file "$backup_path" \
        --tempdir "$GITEA_DATA_DIR"; then

        print_success_from_common_functions "Backup created successfully"

        local backup_size=$(du -h "$backup_path" | cut -f1)
        print_info_from_common_functions "Backup file: $backup_filename"
        print_info_from_common_functions "Backup size: $backup_size"
        print_info_from_common_functions "Backup location: $backup_path"

        $USE_SUDO chmod 640 "$backup_path" 2>/dev/null || true

    else
        print_error_from_common_functions "Backup failed"
        if [[ "$was_running" == true ]]; then
            start_gitea_service
        fi
        return 1
    fi

    if [[ "$was_running" == true ]]; then
        echo ""
        if ! start_gitea_service; then
            print_error_from_common_functions "Backup successful but failed to restart service"
            print_warning_from_common_functions "Please start Gitea manually: sudo systemctl start gitea"
            return 1
        fi
    else
        echo ""
        print_info_from_common_functions "Gitea service was not running before backup and remains stopped"
    fi

    echo ""
    print_success_from_common_functions "Backup completed successfully"

    # Prompt for download server
    prompt_download_server "$backup_path" "$GITEA_NAMESPACE"

    return 0
}

# Cleanup old backups (wrapper for common function)
cleanup_old_gitea_backups() {
    cleanup_old_backups "$GITEA_NAMESPACE" "${1:-$BACKUP_RETENTION_DAYS}" "gitea-backup-*.zip"
}

# Verify backup file (wrapper for common function)
verify_gitea_backup() {
    verify_backup "$1"
}
