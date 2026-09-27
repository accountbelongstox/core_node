#!/bin/bash

BACKUP_DIR="/backups/www"
WWW_DIR="/www"
MAX_BACKUPS=3
CURRENT_DATE=$(date +%s)

mkdir -p "$BACKUP_DIR"

# Function to check if a directory is empty
is_empty_dir() {
    [ -z "$(ls -A "$1")" ]
}

# Function to delete old backups if more than MAX_BACKUPS exist
delete_old_backups() {
    local backups=("$BACKUP_DIR"/*.tar.gz)
    local count=${#backups[@]}
    
    if (( count > MAX_BACKUPS )); then
        # Sort backups by modification time (oldest first) and delete the oldest ones
        for backup in $(ls -1t "$BACKUP_DIR"/*.tar.gz | tail -n +$((MAX_BACKUPS + 1))); do
            echo "Deleting old backup: $backup"
            rm -f "$backup"
        done
    fi
}

# Check if the /backups/www directory exists and is empty
if [ ! -d "$BACKUP_DIR" ] || is_empty_dir "$BACKUP_DIR"; then
    echo "Backing up /www directory..."
    tar -czf "$BACKUP_DIR/www_backup_$(date +%Y%m%d_%H%M%S).tar.gz" "$WWW_DIR"
    echo "Backup completed."
else
    echo "Checking existing backups in $BACKUP_DIR..."

    # Iterate over the existing backups to check their modification times
    for backup in "$BACKUP_DIR"/*.tar.gz; do
        if [ -f "$backup" ]; then
            last_modified=$(stat -c %Y "$backup")  # Get last modified time
            age=$((CURRENT_DATE - last_modified))  # Calculate age in seconds

            # Check if the backup is older than 1 day (86400 seconds)
            if (( age > 86400 )); then
                echo "Backup $backup is older than 1 day. Creating a new backup..."
                tar -czf "$BACKUP_DIR/www_backup_$(date +%Y%m%d_%H%M%S).tar.gz" "$WWW_DIR"
                delete_old_backups
                echo "Backup completed."
                exit 0
            fi
        fi
    done
    
    echo "All backups are up-to-date. No new backup needed."
fi
