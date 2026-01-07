#!/bin/bash
# Gitea Backup Management Main Menu
# This file provides the main interactive menu for Gitea backup/restore operations
# Called by dd.sh

MAIN_VERSION="1.0.0"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source all core modules
source "$SCRIPT_DIR/backup_gitea_core.sh"
source "$SCRIPT_DIR/restore_gitea_core.sh"
source "$SCRIPT_DIR/backup_list_manager.sh"

# Main menu display
show_backup_menu() {
    while true; do
        clear
        print_header_from_common_functions "Gitea Backup Management"

        # Show Gitea status
        echo ""
        if is_gitea_installed; then
            local gitea_version=$(get_gitea_version)
            print_info_from_common_functions "Gitea Version: $gitea_version"

            if is_gitea_running; then
                print_success_from_common_functions "Gitea Status: Running"
            else
                print_warning_from_common_functions "Gitea Status: Stopped"
            fi
        else
            print_error_from_common_functions "Gitea is not installed"
            echo ""
            print_info_from_common_functions "Install Gitea first using: 123_install_gitea.sh"
            echo ""
            echo "Press Enter to return to main menu..."
            read
            return 0
        fi

        echo ""
        print_info_from_common_functions "Backup Directory: $BACKUP_DIR"

        # Count existing backups
        if [[ -d "$BACKUP_DIR" ]]; then
            local backup_count=$(find "$BACKUP_DIR" -name "gitea-backup-*.zip" -type f 2>/dev/null | wc -l)
            print_info_from_common_functions "Existing Backups: $backup_count"
        else
            print_info_from_common_functions "Existing Backups: 0"
        fi

        echo ""
        echo "───────────────────────────────────────────────────────────────────────────────"
        echo "1) Backup Gitea Now"
        echo "2) Restore from Backup"
        echo "3) List All Backups"
        echo "4) Delete a Backup"
        echo "5) Show Backup Details"
        echo "6) Cleanup Old Backups"
        echo "7) Test Backup Integrity"
        echo "0) Return to Main Menu"
        echo "───────────────────────────────────────────────────────────────────────────────"
        echo ""
        echo -n "Select an option [0-7]: "

        read -r choice

        case "$choice" in
            1)
                echo ""
                backup_gitea
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            2)
                echo ""
                print_header_from_common_functions "Restore Gitea from Backup"

                local backup_file=$(select_backup)
                if [[ $? -eq 0 ]] && [[ -n "$backup_file" ]]; then
                    restore_gitea "$backup_file"
                fi

                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            3)
                echo ""
                list_backups
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            4)
                echo ""
                delete_backup
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            5)
                echo ""
                show_backup_details
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            6)
                echo ""
                print_header_from_common_functions "Cleanup Old Backups"
                echo ""
                echo -n "Enter retention days (default: $BACKUP_RETENTION_DAYS): "
                read -r retention_days

                if [[ -z "$retention_days" ]]; then
                    retention_days=$BACKUP_RETENTION_DAYS
                fi

                cleanup_old_backups "$retention_days"

                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            7)
                echo ""
                print_header_from_common_functions "Test Backup Integrity"

                local backup_file=$(select_backup)
                if [[ $? -eq 0 ]] && [[ -n "$backup_file" ]]; then
                    verify_backup "$backup_file"
                fi

                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            0)
                print_info_from_common_functions "Returning to main menu..."
                return 0
                ;;
            *)
                print_error_from_common_functions "Invalid option. Please select 0-7."
                sleep 2
                ;;
        esac
    done
}

# Entry point
main() {
    # Check if running as root or with sudo
    if [[ $EUID -ne 0 ]] && [[ -z "$USE_SUDO" ]]; then
        print_warning_from_common_functions "This script may require root privileges for some operations"
        echo ""
    fi

    # Show the menu
    show_backup_menu
}

# Run main function
main "$@"
