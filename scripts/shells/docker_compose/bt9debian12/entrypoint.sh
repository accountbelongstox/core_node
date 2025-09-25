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

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEBIAN_SCRIPTS_DIR="${SCRIPT_CURRENT_DIR}/debian/install_shells"

# Check if /www is an empty directory
is_webroot_empty() {
    [ -z "$(ls -A $WEB_ROOT)" ]
}

# Check if backup file exists
backup_exists() {
    [ -f "$BACKUP_FILE" ]
}

# Extract backup file
extract_backup() {
    echo "Backup file detected, extracting to $WEB_ROOT..."
    tar -xzf "$BACKUP_FILE" -C "$WEB_ROOT" --strip-components=1
    chown -R www-data:www-data "$WEB_ROOT"
    echo "Extraction completed"
}

# Check if BT (aaPanel) directories exist
has_bt_dirs() {
    [ -d "$WEB_ROOT/server" ] && [ -d "$WEB_ROOT/wwwroot" ]
}

# Execute debian scripts in order
execute_debian_scripts() {
    # Check if debian directory exists
    if [ ! -d "$DEBIAN_SCRIPTS_DIR" ]; then
        echo "Debian scripts directory not found: $DEBIAN_SCRIPTS_DIR"
        return
    fi
    
    # Find all .sh files with numeric prefixes and store them in an array
    local -a script_files_with_prefix
    while IFS= read -r -d '' file; do
        # Extract the numeric prefix (1-3 digits followed by underscore)
        if [[ $(basename "$file") =~ ^([0-9]{1,3})_ ]]; then
            prefix=${BASH_REMATCH[1]}
            script_files_with_prefix+=("$prefix|$file")
        fi
    done < <(find "$DEBIAN_SCRIPTS_DIR" -type f -name "*.sh" -print0)

    # Sort by numeric prefix
    IFS=$'\n' sorted_scripts=($(printf "%s\n" "${script_files_with_prefix[@]}" | sort -n -t'|' -k1,1))
    unset IFS

    # Extract sorted file paths
    local -a script_files
    for entry in "${sorted_scripts[@]}"; do
        script_files+=("${entry#*|}")
    done

    # Print the order of scripts to be executed
    echo "Scripts to be executed in order:"
    for script in "${script_files[@]}"; do
        echo "  $script"
    done

    # Execute each script in order
    for script in "${script_files[@]}"; do
        echo "Executing script: $script"
        if [ -x "$script" ]; then
            "$script"
        else
            bash "$script"
        fi
        if [ $? -ne 0 ]; then
            echo "Warning: Script $script exited with non-zero status"
        fi
    done
}

# Main logic
main() {
    # Check if /www is mounted
    if mountpoint -q "$WEB_ROOT"; then
        echo "Detected /www is mounted"
        
        if is_webroot_empty; then
            if backup_exists; then
                extract_backup
            else
                echo "Warning: $WEB_ROOT is empty and backup file $BACKUP_FILE not found"
            fi
        fi
        
        # Check if BT (aaPanel) services need to be started
        if has_bt_dirs; then
            echo "BT directories detected, starting services..."
            # Replace with actual startup command
            bt start
        else
            echo "BT directories not detected, skipping service startup"
        fi
    else
        # Continuously prompt for mounting
        while true; do
            echo "Error: $NEED_MOUNT_MESSAGE"
            sleep 10
        done
    fi
    
    # Keep container running
    tail -f /dev/null
}

# Execute scripts and main function
execute_debian_scripts
main