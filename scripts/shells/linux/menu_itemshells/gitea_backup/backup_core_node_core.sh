#!/bin/bash
# Core_node Project Backup Core Functions
# This file contains core backup/restore logic for the core_node project
# Called by backup_management_main.sh

BACKUP_CORE_NODE_VERSION="1.0.0"

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

# Resolve the live core_node repo checkout.
# NOTE: do NOT use map_web_path "core_node" -- that maps to the /www data disk,
# a different location from the running checkout. Prefer CORE_NODE_ROOT_DIR if
# it is set and valid, else resolve relative to this script (the gitea_backup
# directory sits 5 levels below the repo root).
get_core_node_root() {
    if [[ -n "${CORE_NODE_ROOT_DIR:-}" ]] && [[ -d "$CORE_NODE_ROOT_DIR" ]]; then
        echo "$CORE_NODE_ROOT_DIR"
        return 0
    fi
    cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../../../../.." 2>/dev/null && pwd
}

# Core_node configuration
CORE_NODE_NAMESPACE="core_node"
CORE_NODE_ROOT_DIR_RESOLVED="$(get_core_node_root)"
CORE_NODE_BACKUP_DIR=$(get_backup_dir "$CORE_NODE_NAMESPACE")

# Dependency/cache/build excludes (bare unanchored names so each matches at any
# depth incl. the archive root; do NOT add --anchored). Tested on GNU tar 1.35.
CORE_NODE_BACKUP_EXCLUDES=(
    --exclude='node_modules'
    --exclude='__pycache__'
    --exclude='*.pyc'
    --exclude='.venv'
    --exclude='venv'
    --exclude='.pytest_cache'
    --exclude='.mypy_cache'
    --exclude='.ruff_cache'
    --exclude='*.egg-info'
    --exclude='.tox'
    --exclude='dist'
    --exclude='build'
    --exclude='.vite'
    --exclude='.cache'
    --exclude='.next'
    --exclude='.nuxt'
    --exclude='.turbo'
    --exclude='.parcel-cache'
    --exclude='.svelte-kit'
    --exclude='.dart_tool'
    --exclude='.flutter-plugins*'
    --exclude='vendor'
    --exclude='target'
)

# Check if the core_node project exists
is_core_node_installed() {
    if [[ -d "$CORE_NODE_ROOT_DIR_RESOLVED" ]] && { [[ -d "$CORE_NODE_ROOT_DIR_RESOLVED/.git" ]] || [[ -f "$CORE_NODE_ROOT_DIR_RESOLVED/AGENTS.md" ]]; }; then
        return 0
    fi
    return 1
}

# Perform core_node backup
backup_core_node() {
    print_header_from_common_functions "Core_node Backup"

    if ! is_core_node_installed; then
        print_error_from_common_functions "Core_node project not found at: $CORE_NODE_ROOT_DIR_RESOLVED"
        print_info_from_common_functions "Please ensure the core_node checkout is present"
        return 1
    fi

    print_info_from_common_functions "Core_node project directory: $CORE_NODE_ROOT_DIR_RESOLVED"
    print_info_from_common_functions "Backup directory: $CORE_NODE_BACKUP_DIR"
    echo ""

    # Optionally include the .git object store (large)
    local include_git_excludes=(--exclude='.git')
    echo -n "Exclude .git object store from backup? (Y/n): "
    read -r exclude_git
    case "$exclude_git" in
        [nN]|[nN][oO])
            include_git_excludes=()
            print_info_from_common_functions "Including .git in backup"
            ;;
        *)
            print_info_from_common_functions "Excluding .git from backup"
            ;;
    esac

    # Create backup directory
    $USE_SUDO mkdir -p "$CORE_NODE_BACKUP_DIR"
    $USE_SUDO chmod 755 "$CORE_NODE_BACKUP_DIR" 2>/dev/null || true

    # Create backup filename
    local backup_filename=$(create_backup_filename "$CORE_NODE_NAMESPACE" "core_node" "tar.gz")
    local backup_path="$CORE_NODE_BACKUP_DIR/$backup_filename"

    print_step_from_common_functions "Creating backup: $backup_filename"
    print_info_from_common_functions "This may take a while depending on data size..."
    echo ""

    # Archive with members prefixed core_node/... by running from the parent dir
    local parent_dir="$(dirname "$CORE_NODE_ROOT_DIR_RESOLVED")"
    local base_name="$(basename "$CORE_NODE_ROOT_DIR_RESOLVED")"

    cd "$parent_dir" || {
        print_error_from_common_functions "Failed to change to parent directory: $parent_dir"
        return 1
    }

    print_step_from_common_functions "Archiving project (skipping dependency/cache/build directories)..."
    if $USE_SUDO tar -czf "$backup_path" "${CORE_NODE_BACKUP_EXCLUDES[@]}" "${include_git_excludes[@]}" "$base_name" 2>/dev/null; then
        $USE_SUDO chmod 640 "$backup_path" 2>/dev/null || true
        local backup_size=$(du -h "$backup_path" | cut -f1)
        print_success_from_common_functions "Backup created successfully"
        print_info_from_common_functions "Backup file: $backup_filename"
        print_info_from_common_functions "Backup size: $backup_size"
        print_info_from_common_functions "Backup location: $backup_path"
    else
        print_error_from_common_functions "Backup failed"
        return 1
    fi

    # Verify the archive integrity
    echo ""
    if ! verify_backup "$backup_path"; then
        print_warning_from_common_functions "Backup integrity verification failed"
    fi

    echo ""
    print_success_from_common_functions "Core_node backup completed successfully"

    # Prompt for download server
    prompt_download_server "$backup_path" "$CORE_NODE_NAMESPACE"

    return 0
}

# List core_node backups
list_core_node_backups() {
    print_header_from_common_functions "Core_node Backups"

    if [[ ! -d "$CORE_NODE_BACKUP_DIR" ]]; then
        print_info_from_common_functions "No backup directory found"
        return 0
    fi

    local backups=($(find "$CORE_NODE_BACKUP_DIR" -name "core_node-backup-*.tar.gz" -type f 2>/dev/null | sort -r))

    if [[ ${#backups[@]} -eq 0 ]]; then
        print_info_from_common_functions "No Core_node backups found"
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

# Select a core_node backup
select_core_node_backup() {
    local backups=($(find "$CORE_NODE_BACKUP_DIR" -name "core_node-backup-*.tar.gz" -type f 2>/dev/null | sort -r))

    if [[ ${#backups[@]} -eq 0 ]]; then
        print_error_from_common_functions "No Core_node backups found"
        return 1
    fi

    list_core_node_backups
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

# Show core_node backup details
show_core_node_backup_details() {
    local backup_file=$(select_core_node_backup)
    if [[ $? -ne 0 ]] || [[ -z "$backup_file" ]]; then
        return 1
    fi

    print_header_from_common_functions "Core_node Backup Details"

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

# Delete a core_node backup
delete_core_node_backup() {
    local backup_file=$(select_core_node_backup)
    if [[ $? -ne 0 ]] || [[ -z "$backup_file" ]]; then
        return 1
    fi

    print_header_from_common_functions "Delete Core_node Backup"

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
