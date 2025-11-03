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

# Directories to exclude from backup
EXCLUDE_DIRS=("wwwroot" "backup" "wwwlogs")

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

# Function to check if directory should be excluded
should_exclude() {
    local item="$1"
    for exclude_dir in "${EXCLUDE_DIRS[@]}"; do
        if [ "$item" = "$exclude_dir" ]; then
            return 0  # true, should exclude
        fi
    done
    return 1  # false, should not exclude
}

# Function to create backup
create_backup() {
    echo "Creating backup of /www directory (excluding ${EXCLUDE_DIRS[*]})..."
    
    # Create backup directory if it doesn't exist
    mkdir -p "$(dirname "$BACKUP_FILE")"
    
    # Create a temporary directory for the backup process
    local temp_dir=$(mktemp -d)
    
    # Copy all files and directories except excluded ones
    cd /www || return 1
    for item in *; do
        if ! should_exclude "$item"; then
            cp -r "$item" "$temp_dir/"
        fi
    done
    
    # Create backup from the temporary directory
    tar -czf "$BACKUP_FILE" -C "$temp_dir" .
    local backup_status=$?
    
    # Clean up temporary directory
    rm -rf "$temp_dir"
    
    # Check if backup was successful
    if [ $backup_status -eq 0 ]; then
        echo "Backup created successfully at: $BACKUP_FILE"
        echo "Note: The following directories were excluded from the backup: ${EXCLUDE_DIRS[*]}"
        return 0
    else
        echo "Error: Backup creation failed"
        return 1
    fi
}

# Main backup logic
main() {
    # Check if backup already exists
    if [ -f "$BACKUP_FILE" ]; then
        echo "Backup file already exists at: $BACKUP_FILE"
        echo "Skipping backup creation"
        return 0
    fi
    
    # Check if /www exists
    if [ ! -d "/www" ]; then
        echo "Error: /www directory does not exist"
        return 1
    fi
    
    # Stop services before backup
    stop_services
    
    # Create backup
    create_backup
    local backup_result=$?
    
    # Start services after backup
    start_services
    
    return $backup_result
}

# Execute main function
main
