#!/bin/bash
# Laravel Restore Core Functions
# This file contains core restore logic for Laravel applications
# Called by backup_management_main.sh

RESTORE_LARAVEL_VERSION="1.0.0"

# Load common functions if not already loaded
if [[ -z "$GVAR_COMMON_LOADED" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
    source "$COMMON_DIR/gvar_common.sh"
    source "$COMMON_DIR/common_functions.sh"
fi

# Source backup core to get common configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/backup_laravel_core.sh"

# Restore Laravel from backup
restore_laravel() {
    local backup_file="$1"

    print_header_from_common_functions "Laravel Restore"

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
    echo ""

    print_warning_from_common_functions "IMPORTANT: Restore will REPLACE all current Laravel external data"
    print_warning_from_common_functions "This includes database, uploads, static files, and external storage"
    echo ""
    echo -n "Are you sure you want to restore from this backup? (yes/no): "
    read -r confirm

    if [[ "$confirm" != "yes" ]]; then
        print_info_from_common_functions "Restore cancelled"
        return 0
    fi

    print_step_from_common_functions "Extracting backup file..."
    local restore_tmp_dir=$(mktemp -d)
    
    if ! tar -xzf "$backup_file" -C "$restore_tmp_dir" 2>/dev/null; then
        print_error_from_common_functions "Failed to extract backup file"
        rm -rf "$restore_tmp_dir"
        return 1
    fi

    local backup_data_dir="$restore_tmp_dir/laravel_backup_data"
    if [[ ! -d "$backup_data_dir" ]]; then
        print_error_from_common_functions "Invalid backup structure"
        rm -rf "$restore_tmp_dir"
        return 1
    fi

    print_step_from_common_functions "Restoring external data directories..."
    
    # Get external data paths
    local wwwroot_dir=$(map_web_path "wwwroot" "laravel_main")
    local db_dir=$(map_web_path "wwwroot" "laravel_main/laravel_db")
    
    # Restore database directory
    if [[ -d "$backup_data_dir/laravel_db" ]]; then
        print_info_from_common_functions "Restoring database directory..."
        if [[ -d "$db_dir" ]]; then
            print_info_from_common_functions "Backing up current database directory..."
            $USE_SUDO mv "$db_dir" "${db_dir}.backup.$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
        fi
        $USE_SUDO mkdir -p "$(dirname "$db_dir")"
        $USE_SUDO cp -r "$backup_data_dir/laravel_db" "$db_dir"
        $USE_SUDO chown -R "$REAL_USER:$REAL_USER" "$db_dir" 2>/dev/null || true
        print_success_from_common_functions "Database directory restored"
    fi

    # Restore external storage directories
    local external_dirs=("uploads" "static" "backups" "cache" "updates" "logs")
    for dir in "${external_dirs[@]}"; do
        if [[ -d "$backup_data_dir/$dir" ]]; then
            print_info_from_common_functions "Restoring $dir directory..."
            local target_dir="$wwwroot_dir/$dir"
            if [[ -d "$target_dir" ]]; then
                print_info_from_common_functions "Backing up current $dir directory..."
                $USE_SUDO mv "$target_dir" "${target_dir}.backup.$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
            fi
            $USE_SUDO mkdir -p "$(dirname "$target_dir")"
            $USE_SUDO cp -r "$backup_data_dir/$dir" "$target_dir"
            $USE_SUDO chown -R "$REAL_USER:$REAL_USER" "$target_dir" 2>/dev/null || true
            print_success_from_common_functions "$dir directory restored"
        fi
    done

    # Restore external_data
    if [[ -d "$backup_data_dir/external_data" ]]; then
        print_info_from_common_functions "Restoring external_data directory..."
        local external_data_dir="$LARAVEL_PROJECT_DIR/storage/app/external_data"
        if [[ -d "$external_data_dir" ]]; then
            print_info_from_common_functions "Backing up current external_data directory..."
            $USE_SUDO mv "$external_data_dir" "${external_data_dir}.backup.$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
        fi
        $USE_SUDO mkdir -p "$(dirname "$external_data_dir")"
        $USE_SUDO cp -r "$backup_data_dir/external_data" "$external_data_dir"
        $USE_SUDO chown -R "$REAL_USER:$REAL_USER" "$external_data_dir" 2>/dev/null || true
        print_success_from_common_functions "external_data directory restored"
    fi

    # Restore .env file if exists
    if [[ -f "$backup_data_dir/.env" ]]; then
        print_info_from_common_functions "Backup contains .env file"
        echo -n "Do you want to restore .env file? (y/N): "
        read -r restore_env
        if [[ "$restore_env" =~ ^[yY] ]]; then
            if [[ -f "$LARAVEL_PROJECT_DIR/.env" ]]; then
                print_info_from_common_functions "Backing up current .env file..."
                $USE_SUDO cp "$LARAVEL_PROJECT_DIR/.env" "$LARAVEL_PROJECT_DIR/.env.backup.$(date +%Y%m%d-%H%M%S)"
            fi
            $USE_SUDO cp "$backup_data_dir/.env" "$LARAVEL_PROJECT_DIR/.env"
            $USE_SUDO chown "$REAL_USER:$REAL_USER" "$LARAVEL_PROJECT_DIR/.env" 2>/dev/null || true
            print_success_from_common_functions ".env file restored"
        fi
    fi

    # Cleanup
    rm -rf "$restore_tmp_dir"

    echo ""
    print_success_from_common_functions "Laravel restore completed successfully"
    print_info_from_common_functions "Please verify your application is working correctly"

    return 0
}

