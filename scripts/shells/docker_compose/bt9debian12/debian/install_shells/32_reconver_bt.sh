#!/bin/bash
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

# Source LGar.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2$PARENT_DIR_LEVEL_2/linux/LGar.sh"
source "$PARENT_DIR_LEVEL_5/linux/common/gvar_common.sh"

# Required directories
REQUIRED_DIRS=("wwwroot" "backup" "wwwlogs")

# Function to ensure required directories exist
ensure_required_dirs() {
    echo "Ensuring required directories exist..."
    
    # Create /www if it doesn't exist
    mkdir -p /www
    
    # Create and set permissions for each required directory
    for dir in "${REQUIRED_DIRS[@]}"; do
        local full_path="/www/$dir"
        if [ ! -d "$full_path" ]; then
            echo "Creating directory: $full_path"
            mkdir -p "$full_path"
        fi
        echo "Setting permissions for: $full_path"
        local detected_user=$(detect_system_user)
        chown -R ${detected_user}:${detected_user} "$full_path"
        chmod 755 "$full_path"
    done
    
    echo "All required directories are set up"
}

# Function to stop services
stop_services() {
    echo "Stopping services..."
    
    # Stop BT Panel (ignore errors)
    bt stop 2>/dev/null || true
    
    # Stop Nginx (ignore errors)
    systemctl stop nginx 2>/dev/null || true
    service nginx stop 2>/dev/null || true
    
    # Stop MySQL (ignore errors)
    systemctl stop mysql 2>/dev/null || true
    systemctl stop mariadb 2>/dev/null || true
    service mysql stop 2>/dev/null || true
    
    echo "Services stopped"
    # Wait a moment to ensure all services are properly stopped
    sleep 3
}

# Function to start services
start_services() {
    echo "Starting services..."
    
    # Start MySQL (ignore errors)
    systemctl start mysql 2>/dev/null || true
    systemctl start mariadb 2>/dev/null || true
    service mysql start 2>/dev/null || true
    
    # Start Nginx (ignore errors)
    systemctl start nginx 2>/dev/null || true
    service nginx start 2>/dev/null || true
    
    # Start BT Panel (ignore errors)
    bt start 2>/dev/null || true
    
    echo "Services started"
}

# Function to check if server directory exists
check_server_dir() {
    [ -d "/www/server" ]
}

# Function to check if backup file exists
check_backup_file() {
    if [ ! -f "$BACKUP_FILE" ]; then
        echo "Error: Backup file not found at: $BACKUP_FILE"
        return 1
    fi
    return 0
}

# Function to restore from backup
restore_from_backup() {
    echo "Restoring from backup file: $BACKUP_FILE"
    
    # Create temporary directory for extraction
    local temp_dir=$(mktemp -d)
    
    # Extract backup to temporary directory
    if ! tar -xzf "$BACKUP_FILE" -C "$temp_dir"; then
        echo "Error: Failed to extract backup file"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Check if server directory exists in the backup
    if [ ! -d "$temp_dir/server" ]; then
        echo "Error: server directory not found in backup"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Create /www if it doesn't exist
    mkdir -p /www
    
    # Copy server directory from backup
    cp -r "$temp_dir/server" /www/
    local restore_status=$?
    
    # Clean up
    rm -rf "$temp_dir"
    
    if [ $restore_status -eq 0 ]; then
        echo "Successfully restored server directory to /www/server"
        # Set proper permissions
        chown -R root:root /www/server
        chmod -R 755 /www/server
        return 0
    else
        echo "Error: Failed to restore server directory"
        return 1
    fi
}

# Main logic
main() {
    # First ensure all required directories exist
    ensure_required_dirs
    
    # Check if server directory already exists
    if check_server_dir; then
        echo "/www/server directory already exists, no recovery needed"
        return 0
    fi
    
    # Check if backup file exists
    if ! check_backup_file; then
        return 1
    fi
    
    # Stop services before recovery
    stop_services
    
    # Perform recovery
    restore_from_backup
    local recovery_result=$?
    
    # Start services after recovery
    start_services
    
    if [ $recovery_result -eq 0 ]; then
        echo "Recovery completed successfully"
    else
        echo "Recovery failed"
    fi
    
    return $recovery_result
}

# Execute main function
main
