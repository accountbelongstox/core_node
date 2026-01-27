#!/bin/bash
# Laravel Backup Core Functions
# This file contains core backup logic for Laravel applications
# Called by backup_management_main.sh

BACKUP_LARAVEL_VERSION="1.0.0"

# Load common functions if not already loaded
if [[ -z "$GVAR_COMMON_LOADED" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
    source "$COMMON_DIR/gvar_common.sh"
    source "$COMMON_DIR/common_functions.sh"
fi

# Source common backup functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/backup_common.sh"

# Laravel configuration
LARAVEL_NAMESPACE="laravel"
LARAVEL_PROJECT_DIR=$(map_web_path "programing" "core_node/poly_apps/laravel_main")
LARAVEL_BACKUP_DIR=$(get_backup_dir "$LARAVEL_NAMESPACE")

# Check if Laravel project exists
is_laravel_installed() {
    if [[ -d "$LARAVEL_PROJECT_DIR" ]] && [[ -f "$LARAVEL_PROJECT_DIR/artisan" ]]; then
        return 0
    fi
    return 1
}

# Get Laravel external data paths
get_laravel_external_paths() {
    local paths=()
    
    # Database directory (using map_web_path)
    local db_dir=$(map_web_path "wwwroot" "laravel_main/laravel_db")
    if [[ -d "$db_dir" ]]; then
        paths+=("$db_dir")
    fi
    
    # External storage paths (using map_web_path)
    local wwwroot_dir=$(map_web_path "wwwroot" "laravel_main")
    
    # Check common external storage directories
    local external_dirs=(
        "uploads"
        "static"
        "backups"
        "cache"
        "updates"
        "logs"
    )
    
    for dir in "${external_dirs[@]}"; do
        local full_path="$wwwroot_dir/$dir"
        if [[ -d "$full_path" ]]; then
            paths+=("$full_path")
        fi
    done
    
    # Storage external data
    local storage_external="$LARAVEL_PROJECT_DIR/storage/app/external_data"
    if [[ -d "$storage_external" ]]; then
        paths+=("$storage_external")
    fi
    
    echo "${paths[@]}"
}

# Perform Laravel backup
backup_laravel() {
    print_header_from_common_functions "Laravel Backup"

    if ! is_laravel_installed; then
        print_error_from_common_functions "Laravel project not found at: $LARAVEL_PROJECT_DIR"
        print_info_from_common_functions "Please ensure Laravel is installed"
        return 1
    fi

    print_info_from_common_functions "Laravel project directory: $LARAVEL_PROJECT_DIR"
    print_info_from_common_functions "Backup directory: $LARAVEL_BACKUP_DIR"
    echo ""

    # Create backup directory
    $USE_SUDO mkdir -p "$LARAVEL_BACKUP_DIR"
    $USE_SUDO chmod 755 "$LARAVEL_BACKUP_DIR" 2>/dev/null || true

    # Create backup filename
    local backup_filename=$(create_backup_filename "$LARAVEL_NAMESPACE" "laravel" "tar.gz")
    local backup_path="$LARAVEL_BACKUP_DIR/$backup_filename"

    print_step_from_common_functions "Creating backup: $backup_filename"
    print_info_from_common_functions "This may take a while depending on data size..."
    echo ""

    # Get external data paths
    local external_paths=($(get_laravel_external_paths))
    
    if [[ ${#external_paths[@]} -eq 0 ]]; then
        print_warning_from_common_functions "No external data directories found"
        echo ""
        echo -n "Do you want to backup Laravel project directory only? (y/N): "
        read -r response
        case "$response" in
            [yY]|[yY][eE][sS])
                print_step_from_common_functions "Backing up Laravel project directory..."
                cd "$(dirname "$LARAVEL_PROJECT_DIR")" || {
                    print_error_from_common_functions "Failed to change to parent directory"
                    return 1
                }
                
                if $USE_SUDO tar -czf "$backup_path" --exclude='vendor' --exclude='node_modules' --exclude='.git' "laravel_main" 2>/dev/null; then
                    print_success_from_common_functions "Backup created successfully"
                else
                    print_error_from_common_functions "Backup failed"
                    return 1
                fi
                ;;
            *)
                print_info_from_common_functions "Backup cancelled"
                return 0
                ;;
        esac
    else
        print_info_from_common_functions "Found ${#external_paths[@]} external data directory(ies) to backup:"
        for path in "${external_paths[@]}"; do
            print_info_from_common_functions "  - $path"
        done
        echo ""
        
        # Create temporary directory for backup staging
        local temp_backup_dir=$(mktemp -d)
        local backup_data_dir="$temp_backup_dir/laravel_backup_data"
        mkdir -p "$backup_data_dir"
        
        # Copy external data directories
        print_step_from_common_functions "Copying external data directories..."
        for path in "${external_paths[@]}"; do
            local dir_name=$(basename "$path")
            print_info_from_common_functions "Copying: $path -> $backup_data_dir/$dir_name"
            $USE_SUDO cp -r "$path" "$backup_data_dir/" 2>/dev/null || {
                print_warning_from_common_functions "Failed to copy: $path"
            }
        done
        
        # Copy .env file if exists
        if [[ -f "$LARAVEL_PROJECT_DIR/.env" ]]; then
            print_info_from_common_functions "Copying .env file..."
            $USE_SUDO cp "$LARAVEL_PROJECT_DIR/.env" "$backup_data_dir/" 2>/dev/null || true
        fi
        
        # Create archive
        print_step_from_common_functions "Creating backup archive..."
        cd "$temp_backup_dir" || {
            print_error_from_common_functions "Failed to change to temporary directory"
            rm -rf "$temp_backup_dir"
            return 1
        }
        
        if $USE_SUDO tar -czf "$backup_path" "laravel_backup_data" 2>/dev/null; then
            $USE_SUDO chmod 640 "$backup_path" 2>/dev/null || true
            local backup_size=$(du -h "$backup_path" | cut -f1)
            print_success_from_common_functions "Backup created successfully"
            print_info_from_common_functions "Backup file: $backup_filename"
            print_info_from_common_functions "Backup size: $backup_size"
            print_info_from_common_functions "Backup location: $backup_path"
        else
            print_error_from_common_functions "Backup failed"
            rm -rf "$temp_backup_dir"
            return 1
        fi
        
        # Cleanup temporary directory
        rm -rf "$temp_backup_dir"
    fi

    echo ""
    print_success_from_common_functions "Laravel backup completed successfully"

    # Prompt for download server
    prompt_download_server "$backup_path" "$LARAVEL_NAMESPACE"

    return 0
}

# List Laravel backups
list_laravel_backups() {
    print_header_from_common_functions "Laravel Backups"
    
    if [[ ! -d "$LARAVEL_BACKUP_DIR" ]]; then
        print_info_from_common_functions "No backup directory found"
        return 0
    fi
    
    local backups=($(find "$LARAVEL_BACKUP_DIR" -name "laravel-backup-*.tar.gz" -type f 2>/dev/null | sort -r))
    
    if [[ ${#backups[@]} -eq 0 ]]; then
        print_info_from_common_functions "No Laravel backups found"
        return 0
    fi
    
    print_info_from_common_functions "Found ${#backups[@]} backup(s):"
    echo ""
    printf "%-4s %-30s %-12s %-20s\n" "No." "Filename" "Size" "Modified"
    echo "────────────────────────────────────────────────────────────────────────────"
    
    local index=1
    for backup in "${backups[@]}"; do
        local filename=$(basename "$backup")
        local size=$(du -h "$backup" | cut -f1)
        local modified=$(stat -c "%y" "$backup" 2>/dev/null | cut -d' ' -f1,2 | cut -d'.' -f1 || echo "unknown")
        printf "%-4s %-30s %-12s %-20s\n" "$index" "$filename" "$size" "$modified"
        ((index++))
    done
    
    return 0
}

# Select Laravel backup
select_laravel_backup() {
    local backups=($(find "$LARAVEL_BACKUP_DIR" -name "laravel-backup-*.tar.gz" -type f 2>/dev/null | sort -r))
    
    if [[ ${#backups[@]} -eq 0 ]]; then
        print_error_from_common_functions "No Laravel backups found"
        return 1
    fi
    
    list_laravel_backups
    echo ""
    echo -n "Select backup number (1-${#backups[@]}): "
    read -r choice
    
    if [[ "$choice" =~ ^[0-9]+$ ]] && [[ "$choice" -ge 1 ]] && [[ "$choice" -le ${#backups[@]} ]]; then
        echo "${backups[$((choice-1))]}"
        return 0
    else
        print_error_from_common_functions "Invalid selection"
        return 1
    fi
}

# Show Laravel backup details
show_laravel_backup_details() {
    local backup_file=$(select_laravel_backup)
    if [[ $? -ne 0 ]] || [[ -z "$backup_file" ]]; then
        return 1
    fi
    
    print_header_from_common_functions "Laravel Backup Details"
    
    local filename=$(basename "$backup_file")
    local size=$(du -h "$backup_file" | cut -f1)
    local size_bytes=$(stat -c "%s" "$backup_file" 2>/dev/null || echo "unknown")
    local modified=$(stat -c "%y" "$backup_file" 2>/dev/null || echo "unknown")
    
    print_info_from_common_functions "Filename: $filename"
    print_info_from_common_functions "Size: $size ($size_bytes bytes)"
    print_info_from_common_functions "Modified: $modified"
    print_info_from_common_functions "Location: $backup_file"
    
    echo ""
    print_step_from_common_functions "Archive contents:"
    tar -tzf "$backup_file" 2>/dev/null | head -20
    local total_files=$(tar -tzf "$backup_file" 2>/dev/null | wc -l)
    if [[ $total_files -gt 20 ]]; then
        print_info_from_common_functions "... and $((total_files - 20)) more files"
    fi
    
    return 0
}

# Delete Laravel backup
delete_laravel_backup() {
    local backup_file=$(select_laravel_backup)
    if [[ $? -ne 0 ]] || [[ -z "$backup_file" ]]; then
        return 1
    fi
    
    print_header_from_common_functions "Delete Laravel Backup"
    
    local filename=$(basename "$backup_file")
    print_warning_from_common_functions "You are about to delete: $filename"
    echo -n "Are you sure? (y/N): "
    read -r confirm
    
    case "$confirm" in
        [yY]|[yY][eE][sS])
            if $USE_SUDO rm -f "$backup_file"; then
                print_success_from_common_functions "Backup deleted: $filename"
            else
                print_error_from_common_functions "Failed to delete backup"
                return 1
            fi
            ;;
        *)
            print_info_from_common_functions "Deletion cancelled"
            ;;
    esac
    
    return 0
}

