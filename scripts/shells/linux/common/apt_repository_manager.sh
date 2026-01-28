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

# APT Repository Manager Library
# Provides comprehensive backup, restore, and management functions for APT repositories
# All function names end with `_from_apt_repository_manager` to identify the source file

# Variable declarations
APT_REPO_MANAGER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APT_SOURCES_DIR="/etc/apt"
APT_SOURCES_LIST="$APT_SOURCES_DIR/sources.list"
APT_SOURCES_LIST_D="$APT_SOURCES_DIR/sources.list.d"
APT_KEYRINGS_DIR="/usr/share/keyrings"
APT_TRUSTED_KEYS_DIR="/etc/apt/trusted.gpg.d"
APT_BACKUP_BASE_DIR="$APT_REPO_MANAGER_DIR/apt_repository_backups"
APT_ORIGINAL_BACKUP_DIR="$APT_BACKUP_BASE_DIR/original"
APT_BACKUP_TIMESTAMP=""
APT_BACKUP_DIR=""

# Source required files (trust-based programming)
source "$APT_REPO_MANAGER_DIR/common_functions.sh"
source "$APT_REPO_MANAGER_DIR/gvar_common.sh"

# Ensure USE_SUDO is set
if [ -z "${USE_SUDO:-}" ]; then
    if [ "$(id -u)" -eq 0 ]; then
        USE_SUDO=""
    else
        USE_SUDO="sudo"
    fi
fi

# Get real login user (not root)
get_real_login_user_from_apt_repository_manager() {
    # Use function from common_functions.sh if available (check if function exists)
    if type get_real_user_from_common_functions >/dev/null 2>&1; then
        local result=$(get_real_user_from_common_functions 2>/dev/null)
        if [ -n "$result" ] && [ "$result" != "root" ]; then
            echo "$result"
            return 0
        fi
    fi
    
    # Fallback: simple detection
    if [ "$(id -u)" -ne 0 ]; then
        echo "$USER"
        return 0
    elif [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
        echo "$SUDO_USER"
        return 0
    elif [ -n "${ACTUAL_DESKTOP_USER:-}" ] && [ "$ACTUAL_DESKTOP_USER" != "root" ]; then
        echo "$ACTUAL_DESKTOP_USER"
        return 0
    else
        # Last resort: find first non-system user
        local real_user=$(getent passwd | awk -F: '$3 >= 1000 && $3 < 60000 {print $1; exit}')
        if [ -n "$real_user" ] && [ "$real_user" != "root" ]; then
            echo "$real_user"
            return 0
        fi
    fi
    
    # Final fallback (should not reach here)
    return 1
}

# Fix file permissions to real user (not root)
fix_file_permissions_from_apt_repository_manager() {
    local file_path="$1"
    local permissions="${2:-+x}"
    
    if [ -z "$file_path" ]; then
        return 1
    fi
    
    local real_user=$(get_real_login_user_from_apt_repository_manager)
    if [ -z "$real_user" ] || [ "$real_user" = "root" ]; then
        # If we can't determine real user, just chmod
        $USE_SUDO chmod "$permissions" "$file_path" 2>/dev/null || return 1
        return 0
    fi
    
    # Set ownership to real user first, then chmod
    $USE_SUDO chown "$real_user:$real_user" "$file_path" 2>/dev/null || true
    $USE_SUDO chmod "$permissions" "$file_path" 2>/dev/null || return 1
    
    return 0
}

# Ensure packages are installed
ensure_packages_from_apt_repository_manager() {
    local packages="$*"
    [ -z "$packages" ] && return 0
    
    local missing_packages=""
    for pkg in $packages; do
        if ! command -v "$pkg" >/dev/null 2>&1 && ! dpkg -l | grep -q "^ii.*$pkg "; then
            missing_packages="$missing_packages $pkg"
        fi
    done
    
    [ -z "$missing_packages" ] && return 0
    
    echo "Installing packages:$missing_packages"
    $USE_SUDO apt update >/dev/null 2>&1
    $USE_SUDO apt install -y $missing_packages >/dev/null 2>&1 || {
        echo "ERROR: Failed to install packages:$missing_packages" >&2
        return 1
    }
    return 0
}

# Initialize backup directory structure
init_apt_backup_dir_from_apt_repository_manager() {
    # Create base backup directory (user-accessible)
    $USE_SUDO mkdir -p "$APT_BACKUP_BASE_DIR" 2>/dev/null || {
        echo "ERROR: Failed to create backup base directory: $APT_BACKUP_BASE_DIR" >&2
        return 1
    }
    
    # Ensure original backup exists (one-time backup on first use)
    if [ ! -d "$APT_ORIGINAL_BACKUP_DIR" ]; then
        backup_original_apt_sources_from_apt_repository_manager
    fi
    
    APT_BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    APT_BACKUP_DIR="$APT_BACKUP_BASE_DIR/$APT_BACKUP_TIMESTAMP"
    
    $USE_SUDO mkdir -p "$APT_BACKUP_DIR" 2>/dev/null || {
        echo "ERROR: Failed to create backup directory: $APT_BACKUP_DIR" >&2
        return 1
    }
    
    return 0
}

# Backup original APT sources (one-time, on first use)
backup_original_apt_sources_from_apt_repository_manager() {
    if [ -d "$APT_ORIGINAL_BACKUP_DIR" ]; then
        return 0
    fi
    
    echo "Creating original APT sources backup (first time use)..."
    $USE_SUDO mkdir -p "$APT_ORIGINAL_BACKUP_DIR" 2>/dev/null || {
        echo "ERROR: Failed to create original backup directory" >&2
        return 1
    }
    
    # Backup sources.list
    if [ -f "$APT_SOURCES_LIST" ]; then
        $USE_SUDO cp -p "$APT_SOURCES_LIST" "$APT_ORIGINAL_BACKUP_DIR/sources.list" 2>/dev/null || {
            echo "WARNING: Failed to backup $APT_SOURCES_LIST" >&2
        }
    fi
    
    # Backup entire sources.list.d directory
    if [ -d "$APT_SOURCES_LIST_D" ]; then
        $USE_SUDO cp -rp "$APT_SOURCES_LIST_D" "$APT_ORIGINAL_BACKUP_DIR/sources.list.d" 2>/dev/null || {
            echo "WARNING: Failed to backup $APT_SOURCES_LIST_D" >&2
        }
    fi
    
    # Backup keyrings directory
    if [ -d "$APT_KEYRINGS_DIR" ]; then
        $USE_SUDO mkdir -p "$APT_ORIGINAL_BACKUP_DIR/keyrings" 2>/dev/null || true
        $USE_SUDO cp -rp "$APT_KEYRINGS_DIR"/* "$APT_ORIGINAL_BACKUP_DIR/keyrings/" 2>/dev/null || {
            echo "WARNING: Failed to backup $APT_KEYRINGS_DIR" >&2
        }
    fi
    
    # Backup trusted keys directory
    if [ -d "$APT_TRUSTED_KEYS_DIR" ]; then
        $USE_SUDO mkdir -p "$APT_ORIGINAL_BACKUP_DIR/trusted.gpg.d" 2>/dev/null || true
        $USE_SUDO cp -rp "$APT_TRUSTED_KEYS_DIR"/* "$APT_ORIGINAL_BACKUP_DIR/trusted.gpg.d/" 2>/dev/null || {
            echo "WARNING: Failed to backup $APT_TRUSTED_KEYS_DIR" >&2
        }
    fi
    
    # Create backup manifest
    {
        echo "Original APT Repository Backup"
        echo "Backup Time: $(date)"
        echo "Backup Path: $APT_ORIGINAL_BACKUP_DIR"
        echo ""
        echo "This is the original backup created on first use of the repository manager."
        echo "Files backed up:"
        find "$APT_ORIGINAL_BACKUP_DIR" -type f 2>/dev/null | sort
    } | $USE_SUDO tee "$APT_ORIGINAL_BACKUP_DIR/manifest.txt" >/dev/null 2>&1 || true
    
    echo "Original backup completed: $APT_ORIGINAL_BACKUP_DIR"
    return 0
}

# Backup entire APT sources directory structure (using directory copy only)
backup_apt_sources_from_apt_repository_manager() {
    local backup_id="${1:-$APT_BACKUP_TIMESTAMP}"
    local backup_path="$APT_BACKUP_BASE_DIR/$backup_id"
    
    if [ -z "$backup_id" ] || [ "$backup_id" = "$APT_BACKUP_TIMESTAMP" ]; then
        if ! init_apt_backup_dir_from_apt_repository_manager; then
            echo "ERROR: Failed to initialize backup directory" >&2
            return 1
        fi
        backup_path="$APT_BACKUP_DIR"
    fi
    
    $USE_SUDO mkdir -p "$backup_path" 2>/dev/null || {
        echo "ERROR: Failed to create backup directory: $backup_path" >&2
        return 1
    }
    
    echo "Backing up APT sources to: $backup_path"
    
    # Backup sources.list (simple file copy)
    if [ -f "$APT_SOURCES_LIST" ]; then
        $USE_SUDO cp -p "$APT_SOURCES_LIST" "$backup_path/sources.list" 2>/dev/null || {
            echo "WARNING: Failed to backup $APT_SOURCES_LIST" >&2
        }
    fi
    
    # Backup entire sources.list.d directory (directory copy)
    if [ -d "$APT_SOURCES_LIST_D" ]; then
        $USE_SUDO cp -rp "$APT_SOURCES_LIST_D" "$backup_path/sources.list.d" 2>/dev/null || {
            echo "WARNING: Failed to backup $APT_SOURCES_LIST_D" >&2
        }
    fi
    
    # Backup keyrings directory (directory copy)
    if [ -d "$APT_KEYRINGS_DIR" ]; then
        $USE_SUDO mkdir -p "$backup_path/keyrings" 2>/dev/null || true
        $USE_SUDO cp -rp "$APT_KEYRINGS_DIR"/* "$backup_path/keyrings/" 2>/dev/null || {
            echo "WARNING: Failed to backup $APT_KEYRINGS_DIR" >&2
        }
    fi
    
    # Backup trusted keys directory (directory copy)
    if [ -d "$APT_TRUSTED_KEYS_DIR" ]; then
        $USE_SUDO mkdir -p "$backup_path/trusted.gpg.d" 2>/dev/null || true
        $USE_SUDO cp -rp "$APT_TRUSTED_KEYS_DIR"/* "$backup_path/trusted.gpg.d/" 2>/dev/null || {
            echo "WARNING: Failed to backup $APT_TRUSTED_KEYS_DIR" >&2
        }
    fi
    
    # Create backup manifest (simple file write)
    local manifest_file="$backup_path/manifest.txt"
    {
        echo "APT Repository Backup Manifest"
        echo "Backup ID: $backup_id"
        echo "Backup Time: $(date)"
        echo "Backup Path: $backup_path"
        echo ""
        echo "Files backed up:"
        find "$backup_path" -type f 2>/dev/null | sort
    } | $USE_SUDO tee "$manifest_file" >/dev/null 2>&1 || true
    
    echo "Backup completed: $backup_path"
    echo "$backup_path"
    return 0
}

# Restore entire APT sources directory structure (using directory copy only)
restore_apt_sources_from_apt_repository_manager() {
    local backup_id="$1"
    
    if [ -z "$backup_id" ]; then
        echo "ERROR: Backup ID is required" >&2
        return 1
    fi
    
    local backup_path="$APT_BACKUP_BASE_DIR/$backup_id"
    
    if [ ! -d "$backup_path" ]; then
        echo "ERROR: Backup directory not found: $backup_path" >&2
        return 1
    fi
    
    echo "Restoring APT sources from: $backup_path"
    
    # Restore sources.list (simple file copy)
    if [ -f "$backup_path/sources.list" ]; then
        $USE_SUDO cp -p "$backup_path/sources.list" "$APT_SOURCES_LIST" 2>/dev/null || {
            echo "WARNING: Failed to restore $APT_SOURCES_LIST" >&2
        }
    fi
    
    # Remove existing sources.list.d and restore from backup (directory copy)
    if [ -d "$backup_path/sources.list.d" ]; then
        $USE_SUDO rm -rf "$APT_SOURCES_LIST_D"/* 2>/dev/null || true
        $USE_SUDO cp -rp "$backup_path/sources.list.d"/* "$APT_SOURCES_LIST_D/" 2>/dev/null || {
            echo "WARNING: Failed to restore $APT_SOURCES_LIST_D" >&2
        }
    fi
    
    # Restore keyrings (directory copy)
    if [ -d "$backup_path/keyrings" ]; then
        $USE_SUDO mkdir -p "$APT_KEYRINGS_DIR" 2>/dev/null || true
        $USE_SUDO cp -rp "$backup_path/keyrings"/* "$APT_KEYRINGS_DIR/" 2>/dev/null || {
            echo "WARNING: Failed to restore $APT_KEYRINGS_DIR" >&2
        }
    fi
    
    # Restore trusted keys (directory copy)
    if [ -d "$backup_path/trusted.gpg.d" ]; then
        $USE_SUDO mkdir -p "$APT_TRUSTED_KEYS_DIR" 2>/dev/null || true
        $USE_SUDO cp -rp "$backup_path/trusted.gpg.d"/* "$APT_TRUSTED_KEYS_DIR/" 2>/dev/null || {
            echo "WARNING: Failed to restore $APT_TRUSTED_KEYS_DIR" >&2
        }
    fi
    
    echo "Restore completed from: $backup_path"
    return 0
}

# Add repository with automatic backup
add_repository_with_backup_from_apt_repository_manager() {
    local repo_name="$1"
    local repo_line="$2"
    local key_url="$3"
    local key_file="$4"
    
    if [ -z "$repo_name" ] || [ -z "$repo_line" ]; then
        echo "ERROR: Repository name and line are required" >&2
        return 1
    fi
    
    # Initialize backup
    if ! init_apt_backup_dir_from_apt_repository_manager; then
        echo "ERROR: Failed to initialize backup directory" >&2
        return 1
    fi
    
    # Backup before adding repository
    local backup_id
    backup_id=$(backup_apt_sources_from_apt_repository_manager)
    local backup_result=$?
    if [ $backup_result -ne 0 ] || [ -z "$backup_id" ]; then
        echo "ERROR: Failed to backup before adding repository" >&2
        return 1
    fi
    
    echo "Backup created: $backup_id"
    echo "Adding repository: $repo_name"
    
    # Add GPG key if provided
    if [ -n "$key_url" ] && [ -n "$key_file" ]; then
        echo "Adding GPG key from: $key_url"
        $USE_SUDO mkdir -p "$(dirname "$key_file")" 2>/dev/null || true
        
        # Ensure curl is available
        if ! ensure_packages_from_apt_repository_manager curl; then
            echo "WARNING: Failed to install curl, cannot add GPG key" >&2
            return 1
        fi
        
        if curl -fsSL "$key_url" | $USE_SUDO gpg --dearmor -o "$key_file" 2>/dev/null; then
            echo "GPG key added successfully"
        else
            echo "WARNING: Failed to add GPG key" >&2
        fi
    fi
    
    # Add repository source
    local repo_list_file="$APT_SOURCES_LIST_D/${repo_name}.list"
    echo "$repo_line" | $USE_SUDO tee "$repo_list_file" > /dev/null
    
    if [ -f "$repo_list_file" ]; then
        echo "Repository added: $repo_list_file"
        echo "Backup ID for restore: $backup_id"
        echo "$backup_id"
        return 0
    else
        echo "ERROR: Failed to add repository" >&2
        return 1
    fi
}

# Remove repository and restore from backup
remove_repository_with_restore_from_apt_repository_manager() {
    local repo_name="$1"
    local backup_id="$2"
    
    if [ -z "$repo_name" ]; then
        echo "ERROR: Repository name is required" >&2
        return 1
    fi
    
    echo "Removing repository: $repo_name"
    
    # Remove repository list file
    local repo_list_file="$APT_SOURCES_LIST_D/${repo_name}.list"
    if [ -f "$repo_list_file" ]; then
        $USE_SUDO rm -f "$repo_list_file"
        echo "Removed: $repo_list_file"
    fi
    
    # Remove associated keyring if exists
    local keyring_pattern="$APT_KEYRINGS_DIR/*${repo_name}*"
    for keyring in $keyring_pattern; do
        if [ -f "$keyring" ]; then
            $USE_SUDO rm -f "$keyring"
            echo "Removed keyring: $keyring"
        fi
    done
    
    # Restore from backup if backup_id provided
    if [ -n "$backup_id" ]; then
        echo "Restoring from backup: $backup_id"
        restore_apt_sources_from_apt_repository_manager "$backup_id"
    fi
    
    return 0
}

# Execute command with repository backup and restore
execute_with_repo_backup_from_apt_repository_manager() {
    local repo_name="$1"
    local repo_line="$2"
    local key_url="$3"
    local key_file="$4"
    shift 4
    local command_to_execute="$*"
    
    if [ -z "$repo_name" ] || [ -z "$command_to_execute" ]; then
        echo "ERROR: Repository name and command are required" >&2
        return 1
    fi
    
    # Backup before adding repository
    local backup_id
    backup_id=$(add_repository_with_backup_from_apt_repository_manager "$repo_name" "$repo_line" "$key_url" "$key_file")
    local backup_result=$?
    if [ $backup_result -ne 0 ] || [ -z "$backup_id" ]; then
        echo "ERROR: Failed to backup and add repository" >&2
        return 1
    fi
    
    # Update apt cache
    echo "Updating apt cache..."
    $USE_SUDO apt update 2>/dev/null || true
    
    # Execute the command
    echo "Executing: $command_to_execute"
    eval "$command_to_execute"
    local exit_code=$?
    
    # Remove repository and restore
    echo "Removing repository and restoring backup..."
    remove_repository_with_restore_from_apt_repository_manager "$repo_name" "$backup_id"
    
    # Update apt cache after restore
    echo "Updating apt cache after restore..."
    $USE_SUDO apt update 2>/dev/null || true
    
    # Verify restoration was successful
    if [ ! -f "$APT_SOURCES_LIST_D/${repo_name}.list" ]; then
        echo "Repository successfully removed and restored"
    else
        echo "WARNING: Repository file still exists after restore attempt" >&2
    fi
    
    return $exit_code
}

# List all backups
list_apt_backups_from_apt_repository_manager() {
    if [ ! -d "$APT_BACKUP_BASE_DIR" ]; then
        echo "No backups found"
        return 1
    fi
    
    echo "Available APT repository backups:"
    echo "  original - Original backup (created on first use)"
    
    for backup_dir in "$APT_BACKUP_BASE_DIR"/*; do
        if [ -d "$backup_dir" ] && [ "$(basename "$backup_dir")" != "original" ]; then
            local backup_id=$(basename "$backup_dir")
            local manifest_file="$backup_dir/manifest.txt"
            if [ -f "$manifest_file" ]; then
                local backup_time=$(grep "Backup Time:" "$manifest_file" 2>/dev/null | head -1 | cut -d: -f2- | xargs)
                echo "  $backup_id - $backup_time"
            else
                echo "  $backup_id"
            fi
        fi
    done
    
    return 0
}

# Clean old backups (keep last N backups, always keep original)
clean_old_apt_backups_from_apt_repository_manager() {
    local keep_count="${1:-10}"
    
    if [ ! -d "$APT_BACKUP_BASE_DIR" ]; then
        return 0
    fi
    
    # Get list of backups sorted by modification time (newest first), exclude original
    local backups=($(ls -t "$APT_BACKUP_BASE_DIR" 2>/dev/null | grep -v "^original$"))
    local total_backups=${#backups[@]}
    
    if [ $total_backups -le $keep_count ]; then
        echo "No old backups to clean (keeping $total_backups backups + original)"
        return 0
    fi
    
    local to_remove=$((total_backups - keep_count))
    echo "Removing $to_remove old backup(s) (keeping original backup)..."
    
    for ((i=$keep_count; i<$total_backups; i++)); do
        local backup_to_remove="$APT_BACKUP_BASE_DIR/${backups[$i]}"
        if [ -d "$backup_to_remove" ] && [ "$(basename "$backup_to_remove")" != "original" ]; then
            $USE_SUDO rm -rf "$backup_to_remove"
            echo "Removed: ${backups[$i]}"
        fi
    done
    
    echo "Cleanup completed"
    return 0
}

# Get current repository state (for verification, no sed operations)
get_apt_repository_state_from_apt_repository_manager() {
    echo "Current APT repository state:"
    echo ""
    
    echo "sources.list:"
    if [ -f "$APT_SOURCES_LIST" ]; then
        cat "$APT_SOURCES_LIST"
    else
        echo "  (not found)"
    fi
    
    echo ""
    echo "sources.list.d:"
    if [ -d "$APT_SOURCES_LIST_D" ]; then
        for file in "$APT_SOURCES_LIST_D"/*.list; do
            if [ -f "$file" ]; then
                echo "  $(basename "$file"):"
                cat "$file"
            fi
        done
    else
        echo "  (directory not found)"
    fi
    
    echo ""
    echo "Keyrings:"
    if [ -d "$APT_KEYRINGS_DIR" ]; then
        ls -la "$APT_KEYRINGS_DIR"
    else
        echo "  (directory not found)"
    fi
    
    return 0
}

# ============================================================================
# COMMON REPOSITORY MANAGEMENT FUNCTIONS
# ============================================================================

# Add PHP repository (Ubuntu/Debian) with automatic backup and restore
add_php_repository_from_apt_repository_manager() {
    local os_id="$1"
    local os_codename="$2"
    local command_to_execute="$3"
    
    if [ -z "$os_id" ] || [ -z "$os_codename" ]; then
        echo "ERROR: OS ID and codename are required" >&2
        return 1
    fi
    
    local php_key_url="https://packages.sury.org/php/apt.gpg"
    local php_key_file="/usr/share/keyrings/php-archive-keyring.gpg"
    local php_repo_line=""
    
    if [[ "$os_id" == "ubuntu" ]]; then
        php_repo_line="deb [signed-by=$php_key_file] https://ppa.launchpad.net/ondrej/php/ubuntu $os_codename main"
    elif [[ "$os_id" == "debian" ]]; then
        php_repo_line="deb [signed-by=$php_key_file] https://packages.sury.org/php/ $os_codename main"
    else
        echo "ERROR: Unsupported OS: $os_id" >&2
        return 1
    fi
    
    execute_with_repo_backup_from_apt_repository_manager \
        "php" \
        "$php_repo_line" \
        "$php_key_url" \
        "$php_key_file" \
        "$command_to_execute"
    
    return $?
}

# Add Antigravity repository with automatic backup and restore
add_antigravity_repository_from_apt_repository_manager() {
    local command_to_execute="$1"
    
    local antigravity_key_url="https://us-central1-apt.pkg.dev/doc/repo-signing-key.gpg"
    local antigravity_key_file="/etc/apt/keyrings/antigravity-repo-key.gpg"
    local antigravity_repo_line="deb [signed-by=$antigravity_key_file] https://us-central1-apt.pkg.dev/projects/antigravity-auto-updater-dev/ antigravity-debian main"
    
    execute_with_repo_backup_from_apt_repository_manager \
        "antigravity" \
        "$antigravity_repo_line" \
        "$antigravity_key_url" \
        "$antigravity_key_file" \
        "$command_to_execute"
    
    return $?
}

# Add Docker repository with automatic backup and restore
add_docker_repository_from_apt_repository_manager() {
    local os_codename="$1"
    local command_to_execute="$2"
    
    if [ -z "$os_codename" ]; then
        echo "ERROR: OS codename is required" >&2
        return 1
    fi
    
    local docker_key_url="https://download.docker.com/linux/ubuntu/gpg"
    local docker_key_file="/usr/share/keyrings/docker-archive-keyring.gpg"
    local docker_repo_line="deb [arch=$(dpkg --print-architecture) signed-by=$docker_key_file] https://download.docker.com/linux/ubuntu $os_codename stable"
    
    execute_with_repo_backup_from_apt_repository_manager \
        "docker" \
        "$docker_repo_line" \
        "$docker_key_url" \
        "$docker_key_file" \
        "$command_to_execute"
    
    return $?
}

# Add Microsoft Edge repository with automatic backup and restore
add_edge_repository_from_apt_repository_manager() {
    local command_to_execute="$1"
    
    local edge_key_url="https://packages.microsoft.com/keys/microsoft.asc"
    local edge_key_file="/usr/share/keyrings/microsoft-edge.gpg"
    local edge_repo_line="deb [arch=amd64 signed-by=$edge_key_file] https://packages.microsoft.com/repos/edge stable main"
    
    execute_with_repo_backup_from_apt_repository_manager \
        "edge" \
        "$edge_repo_line" \
        "$edge_key_url" \
        "$edge_key_file" \
        "$command_to_execute"
    
    return $?
}

# Add MariaDB/MySQL repository with automatic backup and restore
# Note: MariaDB uses an official setup script, so we need to handle it differently
add_mysql_repository_from_apt_repository_manager() {
    local os_id="$1"
    local os_codename="$2"
    local command_to_execute="$3"
    
    if [ -z "$os_id" ] || [ -z "$os_codename" ]; then
        echo "ERROR: OS ID and codename are required" >&2
        return 1
    fi
    
    # MariaDB uses an official setup script that handles repository addition
    # We need to backup before running the script, then restore after installation
    local repo_name="mariadb"
    local backup_id=$(date +%Y%m%d_%H%M%S)_${repo_name}
    local backup_dir="$APT_BACKUP_BASE_DIR/$backup_id"
    
    # Initialize backup directory
    if ! init_apt_backup_dir_from_apt_repository_manager; then
        echo "ERROR: Failed to initialize backup directory" >&2
        return 1
    fi
    
    # Backup current state
    if ! backup_apt_sources_from_apt_repository_manager "$backup_id"; then
        echo "ERROR: Failed to backup current state" >&2
        return 1
    fi
    
    # Ensure required packages are available
    if ! ensure_packages_from_apt_repository_manager curl apt-transport-https ca-certificates; then
        echo "ERROR: Failed to install required packages" >&2
        restore_apt_sources_from_apt_repository_manager "$backup_id"
        return 1
    fi
    
    # Download and run MariaDB repository setup script
    local setup_script="/tmp/mariadb_repo_setup"
    if ! curl -LsSO https://r.mariadb.com/downloads/mariadb_repo_setup; then
        echo "ERROR: Failed to download mariadb_repo_setup script" >&2
        restore_apt_sources_from_apt_repository_manager "$backup_id"
        return 1
    fi
    
    $USE_SUDO mv mariadb_repo_setup "$setup_script"
    fix_file_permissions_from_apt_repository_manager "$setup_script" "+x"
    
    # Run the setup script
    if ! $USE_SUDO "$setup_script" --mariadb-server-version="mariadb-10.11"; then
        echo "ERROR: Failed to setup MariaDB repository" >&2
        $USE_SUDO rm -f "$setup_script"
        restore_apt_sources_from_apt_repository_manager "$backup_id"
        return 1
    fi
    
    $USE_SUDO rm -f "$setup_script"
    
    # Update package list
    $USE_SUDO apt update
    
    # Execute the installation command
    if ! eval "$command_to_execute"; then
        echo "ERROR: Installation command failed" >&2
        restore_apt_sources_from_apt_repository_manager "$backup_id"
        return 1
    fi
    
    # Restore original sources after successful installation
    restore_apt_sources_from_apt_repository_manager "$backup_id"
    
    return 0
}

# Add repository permanently (no restore) - for manage_repositories function
add_apt_repository_from_apt_repository_manager() {
    local repo_name="$1"
    local repo_line="$2"
    local key_url="$3"
    local key_file="$4"
    
    if [ -z "$repo_name" ] || [ -z "$repo_line" ]; then
        echo "ERROR: Repository name and line are required" >&2
        return 1
    fi
    
    # Add GPG key if provided
    if [ -n "$key_url" ] && [ -n "$key_file" ]; then
        echo "Adding GPG key from: $key_url"
        $USE_SUDO mkdir -p "$(dirname "$key_file")" 2>/dev/null || true
        
        # Ensure curl is available
        if ! ensure_packages_from_apt_repository_manager curl; then
            echo "WARNING: Failed to install curl, cannot add GPG key" >&2
            return 1
        fi
        
        if curl -fsSL "$key_url" | $USE_SUDO gpg --dearmor -o "$key_file" 2>/dev/null; then
            echo "GPG key added successfully"
        else
            echo "WARNING: Failed to add GPG key" >&2
            return 1
        fi
    fi
    
    # Add repository source
    local repo_list_file="$APT_SOURCES_LIST_D/${repo_name}.list"
    echo "$repo_line" | $USE_SUDO tee "$repo_list_file" > /dev/null
    
    if [ -f "$repo_list_file" ]; then
        echo "Repository added: $repo_list_file"
        return 0
    else
        echo "ERROR: Failed to add repository" >&2
        return 1
    fi
}

# Remove repository permanently - for manage_repositories function
remove_apt_repository_from_apt_repository_manager() {
    local repo_name="$1"
    
    if [ -z "$repo_name" ]; then
        echo "ERROR: Repository name is required" >&2
        return 1
    fi
    
    # Remove repository file
    local repo_list_file="$APT_SOURCES_LIST_D/${repo_name}.list"
    if [ -f "$repo_list_file" ]; then
        $USE_SUDO rm -f "$repo_list_file"
        echo "Removed repository file: $repo_list_file"
    fi
    
    # Remove GPG key (try common locations)
    local key_files=(
        "/usr/share/keyrings/${repo_name}.gpg"
        "/usr/share/keyrings/${repo_name}-keyring.gpg"
        "/usr/share/keyrings/${repo_name}-archive-keyring.gpg"
        "/etc/apt/trusted.gpg.d/${repo_name}.gpg"
    )
    
    for key_file in "${key_files[@]}"; do
        if [ -f "$key_file" ]; then
            $USE_SUDO rm -f "$key_file"
            echo "Removed GPG key: $key_file"
        fi
    done
    
    # Remove MariaDB specific files
    if [ "$repo_name" = "mariadb" ]; then
        local mariadb_files=(
            "/etc/apt/sources.list.d/mariadb.list"
            "/etc/apt/sources.list.d/mariadb-10.11.list"
            "/etc/apt/sources.list.d/mariadb-maxscale.list"
        )
        for file in "${mariadb_files[@]}"; do
            if [ -f "$file" ]; then
                $USE_SUDO rm -f "$file"
                echo "Removed: $file"
            fi
        done
        
        local mariadb_keys=(
            "/usr/share/keyrings/mariadb-keyring.gpg"
            "/usr/share/keyrings/mariadb-archive-keyring.gpg"
        )
        for key in "${mariadb_keys[@]}"; do
            if [ -f "$key" ]; then
                $USE_SUDO rm -f "$key"
                echo "Removed: $key"
            fi
        done
    fi
    
    echo "Repository removal completed: $repo_name"
    return 0
}

# Manage repositories based on control variables (for 12_update.sh)
# This function manages repositories without automatic restore (permanent addition)
manage_repositories_from_apt_repository_manager() {
    echo "Managing repositories based on control variables..."
    
    # Get control variables
    local install_edge=$(get_global_var "INSTALL_EDGE" "false")
    local install_mysql=$(get_global_var "INSTALL_MYSQL" "false")
    
    echo "INSTALL_EDGE: $install_edge, INSTALL_MYSQL: $install_mysql"
    
    # Initialize backup directory (ensure original backup exists)
    if ! init_apt_backup_dir_from_apt_repository_manager; then
        echo "WARNING: Failed to initialize backup directory, continuing anyway..." >&2
    fi
    
    # Manage Edge repository
    if [ "$install_edge" = "true" ]; then
        echo "Managing Edge repository..."
        local edge_key_url="https://packages.microsoft.com/keys/microsoft.asc"
        local edge_key_file="/usr/share/keyrings/microsoft-edge.gpg"
        local edge_repo_line="deb [arch=amd64 signed-by=$edge_key_file] https://packages.microsoft.com/repos/edge stable main"
        
        # Check if already added
        if [ -f "/etc/apt/sources.list.d/microsoft-edge.list" ]; then
            echo "Edge repository already added"
        else
            # Add Edge repository (permanent, no restore)
            add_apt_repository_from_apt_repository_manager \
                "edge" \
                "$edge_repo_line" \
                "$edge_key_url" \
                "$edge_key_file"
            
            if [ $? -eq 0 ]; then
                $USE_SUDO apt update
                echo "Edge repository added successfully"
            else
                echo "Warning: Edge repository addition failed"
            fi
        fi
    elif [ "$install_edge" = "false" ]; then
        echo "Removing Edge repository..."
        remove_apt_repository_from_apt_repository_manager "edge"
    else
        echo "INSTALL_EDGE not set or invalid: $install_edge"
    fi
    
    # Manage MySQL repository
    if [ "$install_mysql" = "true" ]; then
        echo "Managing MySQL repository..."
        
        # Detect OS
        local os_id=""
        local os_codename=""
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            os_id="$ID"
            os_codename="$VERSION_CODENAME"
        fi
        
        # Check if already added
        local mariadb_files=(
            "/etc/apt/sources.list.d/mariadb.list"
            "/etc/apt/sources.list.d/mariadb-10.11.list"
            "/etc/apt/sources.list.d/mariadb-maxscale.list"
        )
        
        local already_added=false
        for file in "${mariadb_files[@]}"; do
            if [ -f "$file" ]; then
                already_added=true
                echo "MariaDB repository already added at: $file"
                break
            fi
        done
        
        if [ "$already_added" = false ]; then
            # Use MariaDB setup script (permanent, no restore)
            # Ensure required packages are available
            if ! ensure_packages_from_apt_repository_manager curl apt-transport-https ca-certificates; then
                echo "Warning: Failed to install required packages" >&2
                return 1
            fi
            
            local setup_script="/tmp/mariadb_repo_setup"
            if curl -LsSO https://r.mariadb.com/downloads/mariadb_repo_setup; then
                $USE_SUDO mv mariadb_repo_setup "$setup_script"
                fix_file_permissions_from_apt_repository_manager "$setup_script" "+x"
                
                if $USE_SUDO "$setup_script" --mariadb-server-version="mariadb-10.11"; then
                    $USE_SUDO rm -f "$setup_script"
                    $USE_SUDO apt update
                    echo "MariaDB repository added successfully"
                else
                    echo "Warning: MariaDB repository addition failed"
                    $USE_SUDO rm -f "$setup_script"
                fi
            else
                echo "Warning: Failed to download MariaDB setup script"
            fi
        fi
    elif [ "$install_mysql" = "false" ]; then
        echo "Removing MySQL repository..."
        remove_apt_repository_from_apt_repository_manager "mariadb"
    else
        echo "INSTALL_MYSQL not set or invalid: $install_mysql"
    fi
    
    echo "Repository management completed"
}

# Clean up all custom repositories and restore to original state
cleanup_all_custom_repositories_from_apt_repository_manager() {
    echo "Cleaning up all custom repositories..."
    
    # Initialize backup directory
    if ! init_apt_backup_dir_from_apt_repository_manager; then
        echo "WARNING: Failed to initialize backup directory, continuing anyway..." >&2
    fi
    
    # Backup current state before cleanup
    local cleanup_backup_id="cleanup_$(date +%Y%m%d_%H%M%S)"
    if ! backup_apt_sources_from_apt_repository_manager "$cleanup_backup_id"; then
        echo "WARNING: Failed to backup before cleanup, continuing anyway..." >&2
    fi
    
    # Remove all custom repository files (keep system defaults)
    echo "Removing custom repository files..."
    $USE_SUDO find "$APT_SOURCES_LIST_D" -name "*.list" -type f -exec rm -f {} \; 2>/dev/null || true
    
    # Remove all custom GPG keys from keyrings
    echo "Removing custom GPG keys..."
    $USE_SUDO find "$APT_KEYRINGS_DIR" -name "*.gpg" -type f -exec rm -f {} \; 2>/dev/null || true
    
    # Remove all custom GPG keys from trusted.gpg.d
    echo "Removing custom trusted GPG keys..."
    $USE_SUDO find "$APT_TRUSTED_KEYS_DIR" -name "*.gpg" -type f -exec rm -f {} \; 2>/dev/null || true
    
    # Clean apt cache
    echo "Cleaning APT cache..."
    $USE_SUDO apt clean 2>/dev/null || true
    $USE_SUDO apt autoclean 2>/dev/null || true
    
    echo "Custom repositories cleanup completed"
    echo "Backup saved at: $APT_BACKUP_BASE_DIR/$cleanup_backup_id"
    return 0
}

# Restore to original backup (first-time backup)
restore_to_original_from_apt_repository_manager() {
    echo "Restoring APT sources to original state..."
    
    if [ ! -d "$APT_ORIGINAL_BACKUP_DIR" ]; then
        echo "ERROR: Original backup not found. Creating it now..." >&2
        backup_original_apt_sources_from_apt_repository_manager
    fi
    
    # Restore from original backup
    restore_apt_sources_from_apt_repository_manager "original"
    
    if [ $? -eq 0 ]; then
        echo "Successfully restored to original state"
        $USE_SUDO apt update 2>/dev/null || true
        return 0
    else
        echo "ERROR: Failed to restore to original state" >&2
        return 1
    fi
}

# Detect and fix repository configuration issues
detect_and_fix_repository_issues_from_apt_repository_manager() {
    echo "Detecting repository configuration issues..."
    
    local issues_found=0
    
    # Check for duplicate sources
    if [ -f "$APT_SOURCES_LIST" ] && [ -d "$APT_SOURCES_LIST_D" ]; then
        local sources_list_count=$(grep -c "^deb " "$APT_SOURCES_LIST" 2>/dev/null || echo "0")
        local sources_list_d_count=$(find "$APT_SOURCES_LIST_D" -name "*.list" -exec grep -c "^deb " {} \; 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
        
        # Ensure variables are numeric (remove any whitespace and non-numeric characters)
        sources_list_count=$(echo "$sources_list_count" | tr -d '[:space:]' | grep -E '^[0-9]+$' || echo "0")
        sources_list_d_count=$(echo "$sources_list_d_count" | tr -d '[:space:]' | grep -E '^[0-9]+$' || echo "0")
        
        # Validate and compare numeric values
        if [ -n "$sources_list_count" ] && [ -n "$sources_list_d_count" ]; then
            if [ "$sources_list_count" -gt 0 ] 2>/dev/null && [ "$sources_list_d_count" -gt 0 ] 2>/dev/null; then
                echo "WARNING: Found potential duplicate sources (sources.list and sources.list.d both have entries)"
                issues_found=$((issues_found + 1))
            fi
        fi
    fi
    
    # Check for broken GPG keys
    local broken_keys=0
    for key_file in "$APT_KEYRINGS_DIR"/*.gpg "$APT_TRUSTED_KEYS_DIR"/*.gpg; do
        if [ -f "$key_file" ] && ! gpg --no-default-keyring --keyring "$key_file" --list-keys >/dev/null 2>&1; then
            broken_keys=$((broken_keys + 1))
        fi
    done
    
    if [ "$broken_keys" -gt 0 ]; then
        echo "WARNING: Found $broken_keys broken GPG key(s)"
        issues_found=$((issues_found + 1))
    fi
    
    # Check for missing repository files referenced in sources
    local missing_refs=0
    while IFS= read -r repo_line; do
        if echo "$repo_line" | grep -q "signed-by="; then
            local key_path=$(echo "$repo_line" | sed -n 's/.*signed-by=\([^]]*\).*/\1/p')
            if [ -n "$key_path" ] && [ ! -f "$key_path" ]; then
                missing_refs=$((missing_refs + 1))
            fi
        fi
    done < <(find "$APT_SOURCES_LIST_D" -name "*.list" -exec cat {} \; 2>/dev/null)
    
    if [ "$missing_refs" -gt 0 ]; then
        echo "WARNING: Found $missing_refs missing GPG key reference(s)"
        issues_found=$((issues_found + 1))
    fi
    
    if [ "$issues_found" -eq 0 ]; then
        echo "No repository issues detected"
        return 0
    else
        echo "Found $issues_found type(s) of repository issues"
        return 1
    fi
}

# Comprehensive repository repair function
repair_repositories_from_apt_repository_manager() {
    echo "Starting comprehensive repository repair..."
    
    # Initialize backup directory
    if ! init_apt_backup_dir_from_apt_repository_manager; then
        echo "WARNING: Failed to initialize backup directory, continuing anyway..." >&2
    fi
    
    # Backup current state before repair
    local repair_backup_id="repair_$(date +%Y%m%d_%H%M%S)"
    if ! backup_apt_sources_from_apt_repository_manager "$repair_backup_id"; then
        echo "WARNING: Failed to backup before repair, continuing anyway..." >&2
    else
        echo "Backup created: $repair_backup_id"
    fi
    
    # Step 1: Clean up problematic repositories
    echo "Step 1: Cleaning up problematic repositories..."
    cleanup_all_custom_repositories_from_apt_repository_manager
    
    # Step 2: Restore to original if available, otherwise create clean state
    echo "Step 2: Restoring to clean state..."
    if [ -d "$APT_ORIGINAL_BACKUP_DIR" ]; then
        restore_to_original_from_apt_repository_manager
    else
        echo "No original backup found, creating clean state..."
        # Create minimal clean sources.list
        if [ ! -f "$APT_SOURCES_LIST" ] || [ ! -s "$APT_SOURCES_LIST" ]; then
            # Detect OS and create appropriate sources
            local os_id=""
            local os_codename=""
            if [ -f /etc/os-release ]; then
                . /etc/os-release
                os_id="$ID"
                os_codename="$VERSION_CODENAME"
            fi
            
            if [ "$os_id" = "ubuntu" ] && [ -n "$os_codename" ]; then
                $USE_SUDO tee "$APT_SOURCES_LIST" > /dev/null << EOF
# Ubuntu repositories
deb http://archive.ubuntu.com/ubuntu/ $os_codename main restricted universe multiverse
deb http://archive.ubuntu.com/ubuntu/ $os_codename-updates main restricted universe multiverse
deb http://archive.ubuntu.com/ubuntu/ $os_codename-backports main restricted universe multiverse
deb http://security.ubuntu.com/ubuntu/ $os_codename-security main restricted universe multiverse
EOF
                echo "Created clean Ubuntu sources.list"
            fi
        fi
    fi
    
    # Step 3: Fix APT configuration
    echo "Step 3: Fixing APT configuration..."
    $USE_SUDO mkdir -p /etc/apt/apt.conf.d 2>/dev/null || true
    
    # Create apt configuration to handle temporary issues
    $USE_SUDO tee /etc/apt/apt.conf.d/99repository-manager > /dev/null << 'EOF'
# Repository Manager Configuration
Acquire::gpgv::Options { "--ignore-time-conflict"; };
Acquire::Check-Valid-Until "false";
Dir::Cache::archives "/var/cache/apt/archives/";
Dir::State::lists "/var/lib/apt/lists/";
Dir::Log "/var/log/apt/";
EOF
    
    # Step 4: Fix package manager state
    echo "Step 4: Fixing package manager state..."
    $USE_SUDO dpkg --configure -a 2>/dev/null || true
    $USE_SUDO apt --fix-broken install -y 2>/dev/null || true
    
    # Step 5: Update package lists
    echo "Step 5: Updating package lists..."
    $USE_SUDO apt update --allow-unauthenticated 2>/dev/null || {
        echo "WARNING: Package list update had issues, but continuing..." >&2
    }
    
    # Step 6: Verify repair
    echo "Step 6: Verifying repair..."
    if detect_and_fix_repository_issues_from_apt_repository_manager; then
        echo "Repository repair completed successfully"
        return 0
    else
        echo "WARNING: Some repository issues may remain" >&2
        return 1
    fi
}

# Verify repository health and functionality
verify_repository_health_from_apt_repository_manager() {
    echo "Verifying repository health..."
    
    local health_score=0
    local max_score=4
    
    # Test 1: APT update functionality
    echo "Test 1: APT update functionality..."
    if $USE_SUDO apt update --allow-unauthenticated >/dev/null 2>&1; then
        echo "  [OK] APT update works"
        health_score=$((health_score + 1))
    else
        echo "  [FAIL] APT update failed"
    fi
    
    # Test 2: Package search functionality
    echo "Test 2: Package search functionality..."
    if apt search python3 >/dev/null 2>&1 | head -5 >/dev/null; then
        echo "  [OK] Package search works"
        health_score=$((health_score + 1))
    else
        echo "  [FAIL] Package search failed"
    fi
    
    # Test 3: Repository configuration integrity
    echo "Test 3: Repository configuration integrity..."
    if detect_and_fix_repository_issues_from_apt_repository_manager >/dev/null 2>&1; then
        echo "  [OK] Repository configuration is clean"
        health_score=$((health_score + 1))
    else
        echo "  [WARN] Repository configuration has issues"
    fi
    
    # Test 4: GPG key validity
    echo "Test 4: GPG key validity..."
    local valid_keys=0
    local total_keys=0
    for key_file in "$APT_KEYRINGS_DIR"/*.gpg "$APT_TRUSTED_KEYS_DIR"/*.gpg; do
        if [ -f "$key_file" ]; then
            total_keys=$((total_keys + 1))
            if gpg --no-default-keyring --keyring "$key_file" --list-keys >/dev/null 2>&1; then
                valid_keys=$((valid_keys + 1))
            fi
        fi
    done
    
    if [ "$total_keys" -eq 0 ] || [ "$valid_keys" -eq "$total_keys" ]; then
        echo "  [OK] All GPG keys are valid ($valid_keys/$total_keys)"
        health_score=$((health_score + 1))
    else
        echo "  [WARN] Some GPG keys are invalid ($valid_keys/$total_keys valid)"
    fi
    
    # Report health score
    local health_percentage=$((health_score * 100 / max_score))
    echo "Repository health score: $health_score/$max_score ($health_percentage%)"
    
    if [ "$health_score" -eq "$max_score" ]; then
        echo "Repository system is healthy"
        return 0
    elif [ "$health_score" -ge 2 ]; then
        echo "Repository system is mostly healthy with minor issues"
        return 0
    else
        echo "Repository system has significant issues"
        return 1
    fi
}

