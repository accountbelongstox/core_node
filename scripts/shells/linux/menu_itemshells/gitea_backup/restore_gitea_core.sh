#!/bin/bash
# Gitea Restore Core Functions
# This file contains core restore logic for Gitea
# Called by backup_management_main.sh

RESTORE_CORE_VERSION="1.0.0"

# Source backup core to get common configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/backup_gitea_core.sh"

# Restore Gitea from backup
restore_gitea() {
    local backup_file="$1"

    print_header_from_common_functions "Gitea Restore"

    if [[ -z "$backup_file" ]]; then
        print_error_from_common_functions "No backup file specified"
        return 1
    fi

    if [[ ! -f "$backup_file" ]]; then
        print_error_from_common_functions "Backup file not found: $backup_file"
        return 1
    fi

    if ! verify_backup "$backup_file"; then
        return 1
    fi

    print_info_from_common_functions "Backup file: $(basename "$backup_file")"
    print_info_from_common_functions "Backup size: $(du -h "$backup_file" | cut -f1)"
    print_info_from_common_functions "Restore target: $GITEA_BASE_DIR"
    echo ""

    print_warning_from_common_functions "IMPORTANT: Restore will STOP Gitea service and REPLACE all data"
    print_warning_from_common_functions "This includes all repositories, database, and configuration"
    echo ""
    echo -n "Are you sure you want to restore from this backup? (yes/no): "
    read -r confirm

    if [[ "$confirm" != "yes" ]]; then
        print_info_from_common_functions "Restore cancelled"
        return 0
    fi

    local was_running=false
    if is_gitea_running; then
        was_running=true
    fi

    if ! stop_gitea_service; then
        print_error_from_common_functions "Cannot proceed with restore - failed to stop service"
        return 1
    fi

    local restore_tmp_dir="$GITEA_DATA_DIR/restore-$$"
    $USE_SUDO mkdir -p "$restore_tmp_dir"

    print_step_from_common_functions "Extracting backup file..."
    if ! $USE_SUDO unzip -q "$backup_file" -d "$restore_tmp_dir"; then
        print_error_from_common_functions "Failed to extract backup file"
        $USE_SUDO rm -rf "$restore_tmp_dir"
        if [[ "$was_running" == true ]]; then
            start_gitea_service
        fi
        return 1
    fi

    print_step_from_common_functions "Restoring configuration files..."
    if [[ -f "$restore_tmp_dir/app.ini" ]]; then
        $USE_SUDO cp -f "$restore_tmp_dir/app.ini" "$GITEA_CONFIG_DIR/app.ini"
        $USE_SUDO chown $GITEA_USER:$GITEA_USER "$GITEA_CONFIG_DIR/app.ini"
        $USE_SUDO chmod 640 "$GITEA_CONFIG_DIR/app.ini"
    fi

    print_step_from_common_functions "Restoring custom files..."
    if [[ -d "$restore_tmp_dir/custom" ]]; then
        $USE_SUDO rm -rf "$GITEA_CUSTOM_DIR"
        $USE_SUDO cp -rf "$restore_tmp_dir/custom" "$GITEA_CUSTOM_DIR"
    fi

    print_step_from_common_functions "Restoring data directory..."
    if [[ -d "$restore_tmp_dir/data" ]]; then
        $USE_SUDO rm -rf "$GITEA_DATA_DIR"/*
        $USE_SUDO cp -rf "$restore_tmp_dir/data"/* "$GITEA_DATA_DIR/"
    fi

    print_step_from_common_functions "Restoring repositories..."
    if [[ -d "$restore_tmp_dir/repos" ]]; then
        $USE_SUDO rm -rf "$GITEA_DATA_DIR/repositories"
        $USE_SUDO cp -rf "$restore_tmp_dir/repos" "$GITEA_DATA_DIR/repositories"
    fi

    print_step_from_common_functions "Restoring database..."
    if [[ -f "$restore_tmp_dir/gitea-db.sql" ]]; then
        local db_file="$GITEA_DATA_DIR/gitea.db"
        if [[ -f "$db_file" ]]; then
            $USE_SUDO rm -f "$db_file"
        fi
        cd "$GITEA_DATA_DIR" || {
            print_error_from_common_functions "Failed to change to data directory"
            $USE_SUDO rm -rf "$restore_tmp_dir"
            return 1
        }
        if ! $USE_SUDO sqlite3 "$db_file" < "$restore_tmp_dir/gitea-db.sql"; then
            print_error_from_common_functions "Failed to restore database"
            $USE_SUDO rm -rf "$restore_tmp_dir"
            return 1
        fi
    fi

    print_step_from_common_functions "Fixing permissions..."
    $USE_SUDO chown -R $GITEA_USER:$GITEA_USER "$GITEA_BASE_DIR"
    $USE_SUDO chmod -R 750 "$GITEA_BASE_DIR"
    $USE_SUDO chmod 770 "$GITEA_CONFIG_DIR"
    $USE_SUDO chmod 640 "$GITEA_CONFIG_DIR/app.ini"

    print_step_from_common_functions "Regenerating Git hooks..."
    $USE_SUDO -u $GITEA_USER $GITEA_BINARY \
        --config "$GITEA_CONFIG_DIR/app.ini" \
        --work-path "$GITEA_DATA_DIR" \
        --custom-path "$GITEA_CUSTOM_DIR" \
        admin regenerate hooks 2>/dev/null || true

    $USE_SUDO rm -rf "$restore_tmp_dir"

    if [[ "$was_running" == true ]]; then
        echo ""
        if ! start_gitea_service; then
            print_error_from_common_functions "Restore successful but failed to start service"
            print_warning_from_common_functions "Please start Gitea manually: sudo systemctl start gitea"
            return 1
        fi
    else
        echo ""
        print_info_from_common_functions "Gitea service was not running before restore and remains stopped"
        print_info_from_common_functions "Start manually: sudo systemctl start gitea"
    fi

    echo ""
    print_success_from_common_functions "Restore completed successfully"

    return 0
}
