#!/bin/bash
# Backup Management Main Menu
# This file provides the main interactive menu for backup/restore operations
# Called by dd.sh

MAIN_VERSION="1.0.0"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source all core modules
source "$SCRIPT_DIR/backup_gitea_core.sh"
source "$SCRIPT_DIR/restore_gitea_core.sh"
source "$SCRIPT_DIR/backup_list_manager.sh"
source "$SCRIPT_DIR/backup_laravel_core.sh"
source "$SCRIPT_DIR/restore_laravel_core.sh"
source "$SCRIPT_DIR/backup_core_node_core.sh"
source "$SCRIPT_DIR/restore_core_node_core.sh"

# Main menu display
show_backup_menu() {
    while true; do
        clear
        print_header_from_common_functions "Backup Management"

        echo ""
        echo "───────────────────────────────────────────────────────────────────────────────"
        echo "Gitea Backup:"
        echo "  1) Backup Gitea"
        echo "  2) Restore Gitea from Backup"
        echo "  3) List Gitea Backups"
        echo "  4) Delete Gitea Backup"
        echo "  5) Show Gitea Backup Details"
        echo "  6) Cleanup Old Gitea Backups"
        echo "  7) Test Gitea Backup Integrity"
        echo "  8) Start Download Server for Gitea Backup"
        echo ""
        echo "Laravel Backup:"
        echo "  9) Backup Laravel"
        echo " 10) Restore Laravel from Backup"
        echo " 11) List Laravel Backups"
        echo " 12) Delete Laravel Backup"
        echo " 13) Show Laravel Backup Details"
        echo " 14) Cleanup Old Laravel Backups"
        echo " 15) Test Laravel Backup Integrity"
        echo " 16) Start Download Server for Laravel Backup"
        echo ""
        echo "Core_node Project Backup:"
        echo " 17) Backup Core_node Project"
        echo " 18) Restore Core_node from Backup"
        echo " 19) List Core_node Backups"
        echo " 20) Delete Core_node Backup"
        echo " 21) Show Core_node Backup Details"
        echo " 22) Cleanup Old Core_node Backups"
        echo " 23) Test Core_node Backup Integrity"
        echo " 24) Start Download Server for Core_node Backup"
        echo ""
        echo "  0) Return to Main Menu"
        echo "───────────────────────────────────────────────────────────────────────────────"
        echo ""
        echo -n "Select an option [0-24]: "

        read -r choice

        case "$choice" in
            1)
                echo ""
                print_header_from_common_functions "Backup Gitea"
                
                if ! is_gitea_installed; then
                    print_error_from_common_functions "Gitea is not installed"
                    print_info_from_common_functions "Install Gitea first using: 125_install_gitea.sh"
                else
                    backup_gitea
                fi
                
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            2)
                echo ""
                print_header_from_common_functions "Restore Gitea from Backup"

                if ! is_gitea_installed; then
                    print_error_from_common_functions "Gitea is not installed"
                    print_info_from_common_functions "Install Gitea first using: 125_install_gitea.sh"
                else
                    local backup_file=$(select_backup)
                    if [[ $? -eq 0 ]] && [[ -n "$backup_file" ]]; then
                        restore_gitea "$backup_file"
                    fi
                fi

                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            3)
                echo ""
                print_header_from_common_functions "List Gitea Backups"
                list_backups
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            4)
                echo ""
                print_header_from_common_functions "Delete Gitea Backup"
                delete_backup
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            5)
                echo ""
                print_header_from_common_functions "Show Gitea Backup Details"
                show_backup_details
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            6)
                echo ""
                print_header_from_common_functions "Cleanup Old Gitea Backups"
                echo ""
                echo -n "Enter retention days (default: 30): "
                read -r retention_days

                if [[ -z "$retention_days" ]]; then
                    retention_days=30
                fi

                cleanup_old_gitea_backups "$retention_days"

                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            7)
                echo ""
                print_header_from_common_functions "Test Gitea Backup Integrity"

                local backup_file=$(select_backup)
                if [[ $? -eq 0 ]] && [[ -n "$backup_file" ]]; then
                    verify_gitea_backup "$backup_file"
                fi

                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            8)
                echo ""
                print_header_from_common_functions "Start Download Server for Gitea Backup"

                local backup_file=$(select_backup)
                if [[ $? -eq 0 ]] && [[ -n "$backup_file" ]]; then
                    prompt_download_server "$backup_file" "gitea"
                fi

                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            9)
                echo ""
                print_header_from_common_functions "Backup Laravel"
                backup_laravel
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            10)
                echo ""
                print_header_from_common_functions "Restore Laravel from Backup"

                local backup_file=$(select_laravel_backup)
                if [[ $? -eq 0 ]] && [[ -n "$backup_file" ]]; then
                    restore_laravel "$backup_file"
                fi

                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            11)
                echo ""
                print_header_from_common_functions "List Laravel Backups"
                list_laravel_backups
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            12)
                echo ""
                print_header_from_common_functions "Delete Laravel Backup"
                delete_laravel_backup
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            13)
                echo ""
                print_header_from_common_functions "Show Laravel Backup Details"
                show_laravel_backup_details
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            14)
                echo ""
                print_header_from_common_functions "Cleanup Old Laravel Backups"
                echo ""
                echo -n "Enter retention days (default: 30): "
                read -r retention_days

                if [[ -z "$retention_days" ]]; then
                    retention_days=30
                fi

                cleanup_old_backups "laravel" "$retention_days" "laravel-backup-*.tar.gz"

                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            15)
                echo ""
                print_header_from_common_functions "Test Laravel Backup Integrity"

                local backup_file=$(select_laravel_backup)
                if [[ $? -eq 0 ]] && [[ -n "$backup_file" ]]; then
                    verify_backup "$backup_file"
                fi

                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            16)
                echo ""
                print_header_from_common_functions "Start Download Server for Laravel Backup"

                local backup_file=$(select_laravel_backup)
                if [[ $? -eq 0 ]] && [[ -n "$backup_file" ]]; then
                    prompt_download_server "$backup_file" "laravel"
                fi

                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            17)
                echo ""
                print_header_from_common_functions "Backup Core_node Project"
                backup_core_node
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            18)
                echo ""
                print_header_from_common_functions "Restore Core_node from Backup"
                local backup_file=$(select_core_node_backup)
                if [[ $? -eq 0 ]] && [[ -n "$backup_file" ]]; then
                    restore_core_node "$backup_file"
                fi
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            19)
                echo ""
                print_header_from_common_functions "List Core_node Backups"
                list_core_node_backups
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            20)
                echo ""
                print_header_from_common_functions "Delete Core_node Backup"
                delete_core_node_backup
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            21)
                echo ""
                print_header_from_common_functions "Show Core_node Backup Details"
                show_core_node_backup_details
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            22)
                echo ""
                print_header_from_common_functions "Cleanup Old Core_node Backups"
                echo ""
                echo -n "Enter retention days (default: 30): "
                read -r retention_days
                if [[ -z "$retention_days" ]]; then
                    retention_days=30
                fi
                cleanup_old_backups "core_node" "$retention_days" "core_node-backup-*.tar.gz"
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            23)
                echo ""
                print_header_from_common_functions "Test Core_node Backup Integrity"
                local backup_file=$(select_core_node_backup)
                if [[ $? -eq 0 ]] && [[ -n "$backup_file" ]]; then
                    verify_backup "$backup_file"
                fi
                echo ""
                echo "Press Enter to continue..."
                read
                ;;
            24)
                echo ""
                print_header_from_common_functions "Start Download Server for Core_node Backup"
                local backup_file=$(select_core_node_backup)
                if [[ $? -eq 0 ]] && [[ -n "$backup_file" ]]; then
                    prompt_download_server "$backup_file" "core_node"
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
                print_error_from_common_functions "Invalid option. Please select 0-24."
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
