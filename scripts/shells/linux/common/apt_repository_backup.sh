#!/bin/bash

# Sanitize a file: remove git merge conflict markers (<<<<<<, ======, >>>>>>)
# This prevents apt from breaking when synced files contain unresolved conflicts.
sanitize_git_conflicts_from_apt_repository_manager() {
    local file="$1"
    [ -z "$file" ] && return 0
    [ -f "$file" ] || return 0
    if grep -qE '^(<<<<<<<|=======|>>>>>>>)' "$file" 2>/dev/null; then
        echo "WARNING: Removing git conflict markers from $file" >&2
        $USE_SUDO sed -i '/^<<<<<<< /d; /^=======/d; /^>>>>>>> /d' "$file" 2>/dev/null || true
    fi
}

# Sanitize all apt source files to remove git conflict markers
sanitize_all_apt_sources_from_apt_repository_manager() {
    if [ -f "$APT_SOURCES_LIST" ]; then
        sanitize_git_conflicts_from_apt_repository_manager "$APT_SOURCES_LIST"
    fi
    if [ -d "$APT_SOURCES_LIST_D" ]; then
        for f in "$APT_SOURCES_LIST_D"/*; do
            [ -f "$f" ] && sanitize_git_conflicts_from_apt_repository_manager "$f"
        done
    fi
    # Also sanitize backup originals so restores don't reintroduce conflicts
    if [ -d "$APT_ORIGINAL_BACKUP_DIR" ]; then
        for f in "$APT_ORIGINAL_BACKUP_DIR"/sources.list "$APT_ORIGINAL_BACKUP_DIR"/sources.list.d/*; do
            [ -f "$f" ] && sanitize_git_conflicts_from_apt_repository_manager "$f"
        done
    fi
}

# Load-time side effect free: do NOT source gvar_common.sh/common_functions.sh
# here (their top-level disk scans and /etc/environment writes can hang on a
# sudo prompt in app-start contexts). Callers that need the full stack source
# those files themselves BEFORE this library; the guarded fallbacks below keep
# this library functional when they are absent.

# Ensure USE_SUDO is set
if [ -z "${USE_SUDO:-}" ]; then
    if [ "$(id -u)" -eq 0 ]; then
        USE_SUDO=""
    else
        USE_SUDO="sudo"
    fi
fi

# Fallback global-var reader (one file per key) used only when gvar_common.sh
# is not loaded; identical store format, no load-time side effects.
if ! declare -F get_global_var >/dev/null 2>&1; then
    get_global_var() {
        local key="$1"
        local default_value="${2:-}"
        local file="${GLOBAL_VAR_DIR:-${CORE_NODE_DATA_DIR:-/www/core_node}/global_var}/$key"
        if [ -f "$file" ]; then
            cat "$file" 2>/dev/null || echo "$default_value"
        else
            echo "$default_value"
        fi
    }
fi

# Get real login user (not root)
get_real_login_user_from_apt_repository_manager() {
    local result=""

    # Use function from common_functions.sh if available (check if function exists)
    if type get_real_user_from_common_functions >/dev/null 2>&1; then
        result="$(get_real_user_from_common_functions 2>/dev/null)"
        if [ -n "$result" ]; then
            echo "$result"
            return 0
        fi
    fi

    if type detect_system_user >/dev/null 2>&1; then
        detect_system_user
        return 0
    fi
    echo "root"
}

# Fix file permissions to real user (not root)
fix_file_permissions_from_apt_repository_manager() {
    local file_path="$1"
    local permissions="${2:-+x}"
    local real_user=""
    local real_group=""
    
    if [ -z "$file_path" ]; then
        return 1
    fi
    
    real_user="$(get_real_login_user_from_apt_repository_manager)"
    real_group="$(id -gn "$real_user" 2>/dev/null || echo "$real_user")"

    $USE_SUDO chown "$real_user:$real_group" "$file_path" 2>/dev/null || true
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
    
    echo "Installing packages:$missing_packages" >&2
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
    
    # Pre-sanitize live sources before backing up
    sanitize_all_apt_sources_from_apt_repository_manager
    echo "Creating original APT sources backup (first time use)..." >&2
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
    
    echo "Original backup completed: $APT_ORIGINAL_BACKUP_DIR" >&2
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
    
    echo "Backing up APT sources to: $backup_path" >&2
    
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
    
    echo "Backup completed: $backup_path" >&2
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

    # Accept either a backup directory name under APT_BACKUP_BASE_DIR or an
    # absolute backup path (as echoed by backup_apt_sources_...).
    local backup_path="$backup_id"
    case "$backup_path" in
        /*) : ;;
        *)  backup_path="$APT_BACKUP_BASE_DIR/$backup_id" ;;
    esac
    
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
    
    # NOTE: We deliberately do NOT restore /usr/share/keyrings or /etc/apt/trusted.gpg.d.
    # Those hold the distro's OWN signing keys (managed by the distro keyring packages);
    # overwriting them from a backup could clobber or downgrade system signing keys, which
    # is forbidden. Only apt source LISTS are restored above. Third-party keys live in their
    # own dedicated files, re-created idempotently by each repo installer, so need no restore.

    # Sanitize restored files to remove any git conflict markers
    sanitize_all_apt_sources_from_apt_repository_manager

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
    
    echo "Backup created: $backup_id" >&2
    echo "Adding repository: $repo_name" >&2

    # Add GPG key if provided
    if [ -n "$key_url" ] && [ -n "$key_file" ]; then
        echo "Adding GPG key from: $key_url" >&2
        $USE_SUDO mkdir -p "$(dirname "$key_file")" 2>/dev/null || true

        # Ensure curl is available
        if ! ensure_packages_from_apt_repository_manager curl; then
            echo "WARNING: Failed to install curl, cannot add GPG key" >&2
            return 1
        fi

        if curl -fsSL "$key_url" | $USE_SUDO gpg --dearmor --yes -o "$key_file" 2>/dev/null; then
            echo "GPG key added successfully" >&2
        else
            echo "WARNING: Failed to add GPG key" >&2
        fi
    fi

    # Add repository source
    local repo_list_file="$APT_SOURCES_LIST_D/${repo_name}.list"
    echo "$repo_line" | $USE_SUDO tee "$repo_list_file" > /dev/null

    if [ -f "$repo_list_file" ]; then
        echo "Repository added: $repo_list_file" >&2
        echo "Backup ID for restore: $backup_id" >&2
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

