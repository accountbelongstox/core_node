#!/bin/bash
# Gitea Backup List Manager
# This file contains backup listing and management functions
# Called by backup_management_main.sh

LIST_MANAGER_VERSION="1.0.0"

# Source backup core to get common configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_LIST_LINUX_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
source "$SCRIPT_DIR/backup_gitea_core.sh"
source "$BACKUP_LIST_LINUX_DIR/common/arrow_menu.sh"

# List all available backups
list_backups() {
    print_header_from_common_functions "Available Gitea Backups"

    if [[ ! -d "$BACKUP_DIR" ]]; then
        print_info_from_common_functions "No backup directory found"
        print_info_from_common_functions "Location: $BACKUP_DIR"
        return 1
    fi

    local backups=($(find "$BACKUP_DIR" -name "gitea-backup-*.zip" -type f 2>/dev/null | sort -r))

    if [[ ${#backups[@]} -eq 0 ]]; then
        print_info_from_common_functions "No backups found in: $BACKUP_DIR"
        return 1
    fi

    print_info_from_common_functions "Backup directory: $BACKUP_DIR"
    print_info_from_common_functions "Total backups: ${#backups[@]}"
    echo ""
    echo "-------------------------------------------------------------------------------"
    printf "%-5s %-30s %-15s %-25s\n" "No." "Filename" "Size" "Date Modified"
    echo "-------------------------------------------------------------------------------"

    local index=1
    for backup in "${backups[@]}"; do
        local filename=$(basename "$backup")
        local size=$(du -h "$backup" | cut -f1)
        local modified=$(stat -c '%y' "$backup" 2>/dev/null | cut -d'.' -f1)
        printf "%-5s %-30s %-15s %-25s\n" "$index" "$filename" "$size" "$modified"
        ((index++))
    done

    echo "-------------------------------------------------------------------------------"
    echo ""

    return 0
}

# Select backup from list
select_backup() {
    local backups=($(find "$BACKUP_DIR" -name "gitea-backup-*.zip" -type f 2>/dev/null | sort -r))
    local menu_items=()
    local backup=""
    local selected_index=0

    if [[ ${#backups[@]} -eq 0 ]]; then
        print_info_from_common_functions "No backups found in: $BACKUP_DIR" >&2
        return 1
    fi
    for backup in "${backups[@]}"; do
        menu_items+=("$(basename "$backup") [$(du -h "$backup" 2>/dev/null | cut -f1)]")
    done
    menu_items+=("Cancel")

    arrow_menu_select "Select Gitea Backup" menu_items 0 "${#backups[@]}"
    selected_index="$ARROW_MENU_SELECTED_INDEX"
    if [[ "$selected_index" -eq "${#backups[@]}" ]]; then
        return 1
    fi
    echo "${backups[$selected_index]}"
    return 0
}

# Delete a backup
delete_backup() {
    print_header_from_common_functions "Delete Gitea Backup"

    local backup_file=$(select_backup)
    if [[ $? -ne 0 ]]; then
        return 1
    fi

    echo ""
    print_warning_from_common_functions "Selected backup: $(basename "$backup_file")"
    echo -n "Are you sure you want to delete this backup? (yes/no): "
    read -r confirm

    if [[ "$confirm" != "yes" ]]; then
        print_info_from_common_functions "Deletion cancelled"
        return 0
    fi

    if $USE_SUDO rm -f "$backup_file"; then
        print_success_from_common_functions "Backup deleted successfully"
        return 0
    else
        print_error_from_common_functions "Failed to delete backup"
        return 1
    fi
}

# Show backup details
show_backup_details() {
    print_header_from_common_functions "Backup Details"

    local backup_file=$(select_backup)
    if [[ $? -ne 0 ]]; then
        return 1
    fi

    echo ""
    print_info_from_common_functions "Backup file: $(basename "$backup_file")"
    print_info_from_common_functions "Full path: $backup_file"
    print_info_from_common_functions "File size: $(du -h "$backup_file" | cut -f1)"
    print_info_from_common_functions "Created: $(stat -c '%y' "$backup_file" 2>/dev/null | cut -d'.' -f1)"
    echo ""

    print_step_from_common_functions "Backup contents:"
    unzip -l "$backup_file" 2>/dev/null | head -30

    echo ""
    return 0
}
