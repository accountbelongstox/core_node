#!/bin/bash
# Core_node Project Restore Core Functions
# This file contains core restore logic for the core_node project
# Called by backup_management_main.sh

RESTORE_CORE_NODE_VERSION="1.0.0"

# Load common functions if not already loaded
if [[ -z "$GVAR_COMMON_LOADED" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
    source "$COMMON_DIR/gvar_common.sh"
    source "$COMMON_DIR/common_functions.sh"
fi

# Source backup core to get common configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/backup_core_node_core.sh"

# Restore core_node from backup
restore_core_node() {
    local backup_file="$1"

    print_header_from_common_functions "Core_node Restore"

    if [[ -z "$backup_file" ]]; then
        print_error_from_common_functions "No backup file specified"
        return 1
    fi

    if [[ ! -f "$backup_file" ]]; then
        print_error_from_common_functions "Backup file not found: $backup_file"
        return 1
    fi

    if ! verify_backup "$backup_file"; then
        print_error_from_common_functions "Backup file verification failed"
        return 1
    fi

    print_info_from_common_functions "Backup file: $(basename "$backup_file")"
    print_info_from_common_functions "Backup size: $(du -h "$backup_file" | cut -f1)"
    print_info_from_common_functions "Target project directory: $CORE_NODE_ROOT_DIR_RESOLVED"
    echo ""

    print_warning_from_common_functions "IMPORTANT: Restore will REPLACE the current core_node checkout"
    print_warning_from_common_functions "The existing directory will be moved aside as a .backup.<timestamp>"
    echo ""
    echo -n "Are you sure you want to restore from this backup? (yes/no): "
    read -r confirm

    if [[ "$confirm" != "yes" ]]; then
        print_info_from_common_functions "Restore cancelled"
        return 0
    fi

    # Extract into a temp dir and validate structure
    print_step_from_common_functions "Extracting backup file..."
    local restore_tmp_dir=$(mktemp -d)

    if ! tar -xzf "$backup_file" -C "$restore_tmp_dir" 2>/dev/null; then
        print_error_from_common_functions "Failed to extract backup file"
        rm -rf "$restore_tmp_dir"
        return 1
    fi

    local base_name="$(basename "$CORE_NODE_ROOT_DIR_RESOLVED")"
    local extracted_dir="$restore_tmp_dir/$base_name"
    if [[ ! -d "$extracted_dir" ]]; then
        print_error_from_common_functions "Invalid backup structure (expected member '$base_name/')"
        rm -rf "$restore_tmp_dir"
        return 1
    fi

    # Move the existing checkout aside
    local target_dir="$CORE_NODE_ROOT_DIR_RESOLVED"
    local parent_dir="$(dirname "$target_dir")"
    if [[ -d "$target_dir" ]]; then
        local moved_aside="${target_dir}.backup.$(date +%Y%m%d-%H%M%S)"
        print_step_from_common_functions "Moving current checkout aside: $moved_aside"
        $USE_SUDO mv "$target_dir" "$moved_aside" || {
            print_error_from_common_functions "Failed to move current checkout aside"
            rm -rf "$restore_tmp_dir"
            return 1
        }
    fi

    # Move the restored tree into place
    print_step_from_common_functions "Restoring project files..."
    $USE_SUDO mkdir -p "$parent_dir"
    if ! $USE_SUDO mv "$extracted_dir" "$target_dir"; then
        print_error_from_common_functions "Failed to move restored files into place"
        rm -rf "$restore_tmp_dir"
        return 1
    fi

    # Optional ownership fix (REAL_USER is not always defined)
    if [[ -n "${REAL_USER:-}" ]]; then
        $USE_SUDO chown -R "$REAL_USER:$REAL_USER" "$target_dir" 2>/dev/null || true
    fi

    # Cleanup
    rm -rf "$restore_tmp_dir"

    echo ""
    print_success_from_common_functions "Core_node restore completed successfully"
    print_info_from_common_functions "Note: dependency/cache/build directories were not part of the backup"
    print_info_from_common_functions "Reinstall dependencies (npm install / pip install / etc.) as needed"

    return 0
}
