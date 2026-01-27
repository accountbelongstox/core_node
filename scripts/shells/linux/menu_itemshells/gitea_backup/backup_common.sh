#!/bin/bash
# Common Backup Functions
# This file contains common backup logic shared by all backup modules
# Supports namespace-based backup organization (gitea/laravel/etc.)

BACKUP_COMMON_VERSION="1.0.0"

# Load common functions if not already loaded
if [[ -z "$GVAR_COMMON_LOADED" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
    source "$COMMON_DIR/gvar_common.sh"
    source "$COMMON_DIR/common_functions.sh"
fi

# Backup base directory (using map_web_path)
BACKUP_BASE_DIR=$(map_web_path "www")
BACKUP_ROOT_DIR="$BACKUP_BASE_DIR/backups"
BACKUP_RETENTION_DAYS=30

# Get backup directory for a namespace
get_backup_dir() {
    local namespace="$1"
    if [[ -z "$namespace" ]]; then
        print_error_from_common_functions "Namespace is required"
        return 1
    fi
    echo "$BACKUP_ROOT_DIR/$namespace"
}

# Create backup filename with timestamp
create_backup_filename() {
    local namespace="$1"
    local prefix="$2"
    local extension="${3:-tar.gz}"
    
    if [[ -z "$namespace" ]] || [[ -z "$prefix" ]]; then
        print_error_from_common_functions "Namespace and prefix are required"
        return 1
    fi
    
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_number=1
    local base_filename="${prefix}-backup-${timestamp}"
    local backup_dir=$(get_backup_dir "$namespace")
    local filename="${base_filename}-${backup_number}.${extension}"
    
    while [[ -f "$backup_dir/$filename" ]]; do
        ((backup_number++))
        filename="${base_filename}-${backup_number}.${extension}"
    done
    
    echo "$filename"
}

# Prompt for web management server after backup
prompt_download_server() {
    local backup_file="$1"
    local namespace="$2"
    
    if [[ ! -f "$backup_file" ]]; then
        return 1
    fi
    
    echo ""
    print_info_from_common_functions "Backup completed successfully"
    echo ""
    echo -n "Do you want to start a web backup management interface? (y/N): "
    read -r response
    
    case "$response" in
        [yY]|[yY][eE][sS])
            local web_manager_script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/backup_web_manager.py"
            
            if [[ ! -f "$web_manager_script" ]]; then
                print_error_from_common_functions "Web manager script not found: $web_manager_script"
                return 1
            fi
            
            print_info_from_common_functions "Starting web backup management interface..."
            print_info_from_common_functions "The server will start in the background"
            echo ""
            print_warning_from_common_functions "Press Ctrl+C in the server window to stop it"
            echo ""
            
            # Get backup base directory
            local backup_base_dir="$BACKUP_ROOT_DIR"
            
            python3 "$web_manager_script" 8888 "$backup_base_dir" &
            local server_pid=$!
            
            sleep 2
            if kill -0 "$server_pid" 2>/dev/null; then
                local local_ip=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "127.0.0.1")
                print_success_from_common_functions "Web backup management interface started (PID: $server_pid)"
                echo ""
                print_info_from_common_functions "Access the web interface at:"
                print_info_from_common_functions "  Local: http://127.0.0.1:8888"
                print_info_from_common_functions "  Network: http://${local_ip}:8888"
                echo ""
                print_info_from_common_functions "To stop the server, run: kill $server_pid"
            else
                print_error_from_common_functions "Failed to start web management interface"
                return 1
            fi
            ;;
        *)
            print_info_from_common_functions "Web management interface not started"
            ;;
    esac
    
    return 0
}

# Cleanup old backups for a namespace
cleanup_old_backups() {
    local namespace="$1"
    local retention_days="${2:-$BACKUP_RETENTION_DAYS}"
    local pattern="${3:-*-backup-*.tar.gz}"
    
    if [[ -z "$namespace" ]]; then
        print_error_from_common_functions "Namespace is required"
        return 1
    fi
    
    local backup_dir=$(get_backup_dir "$namespace")
    
    print_step_from_common_functions "Cleaning up old backups (older than $retention_days days)..."
    
    if [[ ! -d "$backup_dir" ]]; then
        print_info_from_common_functions "Backup directory does not exist, nothing to clean"
        return 0
    fi
    
    local deleted_count=0
    while IFS= read -r -d '' file; do
        $USE_SUDO rm -f "$file"
        ((deleted_count++))
        print_info_from_common_functions "Deleted: $(basename "$file")"
    done < <(find "$backup_dir" -name "$pattern" -mtime +$retention_days -print0 2>/dev/null)
    
    if [[ $deleted_count -eq 0 ]]; then
        print_info_from_common_functions "No old backups found to delete"
    else
        print_success_from_common_functions "Deleted $deleted_count old backup(s)"
    fi
    
    return 0
}

# Verify backup file integrity
verify_backup() {
    local backup_file="$1"
    
    if [[ ! -f "$backup_file" ]]; then
        print_error_from_common_functions "Backup file not found: $backup_file"
        return 1
    fi
    
    print_step_from_common_functions "Verifying backup file integrity..."
    
    local extension="${backup_file##*.}"
    case "$extension" in
        tar.gz|tgz)
            if tar -tzf "$backup_file" &>/dev/null; then
                print_success_from_common_functions "Backup file integrity verified (tar.gz)"
                return 0
            else
                print_error_from_common_functions "Backup file is corrupted or invalid"
                return 1
            fi
            ;;
        zip)
            if unzip -t "$backup_file" &>/dev/null; then
                print_success_from_common_functions "Backup file integrity verified (zip)"
                return 0
            else
                print_error_from_common_functions "Backup file is corrupted or invalid"
                return 1
            fi
            ;;
        *)
            print_warning_from_common_functions "Unknown backup format, skipping verification"
            return 0
            ;;
    esac
}

