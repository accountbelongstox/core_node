#!/bin/bash
<<<<<<< HEAD
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

# Core_node Project Backup - core functions (namespace "core_node").
# Two-phase, READ-ONLY on the project:
#   Step 1: COPY the whole repo into a backup directory, AUTO-SKIPPING every
#           language's dependency/cache/build dir in ANY sub-dir (rsync --exclude).
#   Step 2: optionally ZIP that copy into a single .tar.gz (asked: zip Y/n).
# Skipped directories are simply NOT copied -- nothing in the project is ever moved,
# modified or deleted. A backup is therefore EITHER a plain directory copy
# (core_node-backup-<ts>-<N>) OR a compressed archive (core_node-backup-<ts>-<N>.tar.gz).

BACKUP_CORE_NODE_VERSION="2.0.0"
=======
# Core_node Project Backup Core Functions
# This file contains core backup/restore logic for the core_node project
# Called by backup_management_main.sh

BACKUP_CORE_NODE_VERSION="1.0.0"
>>>>>>> e010669954639e9bd7372a8de66626a68e9f8d8f

# Load common functions if not already loaded
if [[ -z "$GVAR_COMMON_LOADED" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
    source "$COMMON_DIR/gvar_common.sh"
    source "$COMMON_DIR/common_functions.sh"
fi

<<<<<<< HEAD
# Shared backup helpers (get_backup_dir, verify_backup, cleanup_old_backups,
# prompt_download_server, BACKUP_ROOT_DIR).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/backup_common.sh"

# --- Variable declarations (all at top) ------------------------------------- #
CORE_NODE_NAMESPACE="core_node"
CORE_NODE_ROOT_DIR_RESOLVED=""
CORE_NODE_BACKUP_DIR=""

# Resolve the LIVE core_node repo checkout. NOTE: do NOT use map_web_path "core_node"
# -- that maps under the /www DATA disk, a DIFFERENT path from the running checkout.
# Prefer CORE_NODE_ROOT_DIR (exported by dd.sh) when valid, else resolve from this
# script's location (gitea_backup sits 5 levels under the repo root).
_resolve_core_node_root() {
=======
# Source common backup functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/backup_common.sh"

# Resolve the live core_node repo checkout.
# NOTE: do NOT use map_web_path "core_node" -- that maps to the /www data disk,
# a different location from the running checkout. Prefer CORE_NODE_ROOT_DIR if
# it is set and valid, else resolve relative to this script (the gitea_backup
# directory sits 5 levels below the repo root).
get_core_node_root() {
>>>>>>> e010669954639e9bd7372a8de66626a68e9f8d8f
    if [[ -n "${CORE_NODE_ROOT_DIR:-}" ]] && [[ -d "$CORE_NODE_ROOT_DIR" ]]; then
        echo "$CORE_NODE_ROOT_DIR"
        return 0
    fi
    cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../../../../.." 2>/dev/null && pwd
}

<<<<<<< HEAD
CORE_NODE_ROOT_DIR_RESOLVED="$(_resolve_core_node_root)"
CORE_NODE_BACKUP_DIR="$(get_backup_dir "$CORE_NODE_NAMESPACE")"

# Dependency/cache/build excludes. BARE names so each matches at ANY depth incl. the
# root. The SAME `--exclude=NAME` form is understood by BOTH rsync (copy step) and
# tar (zip step). Tested: every dep/cache/build dir is skipped; real source (incl.
# files like build.rs or a dir literally named target containing source) is kept.
=======
# Core_node configuration
CORE_NODE_NAMESPACE="core_node"
CORE_NODE_ROOT_DIR_RESOLVED="$(get_core_node_root)"
CORE_NODE_BACKUP_DIR=$(get_backup_dir "$CORE_NODE_NAMESPACE")

# Dependency/cache/build excludes (bare unanchored names so each matches at any
# depth incl. the archive root; do NOT add --anchored). Tested on GNU tar 1.35.
>>>>>>> e010669954639e9bd7372a8de66626a68e9f8d8f
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

<<<<<<< HEAD
# True when a real core_node checkout is present.
is_core_node_installed() {
    [[ -d "$CORE_NODE_ROOT_DIR_RESOLVED" ]] \
        && { [[ -e "$CORE_NODE_ROOT_DIR_RESOLVED/.git" ]] || [[ -f "$CORE_NODE_ROOT_DIR_RESOLVED/AGENTS.md" ]]; }
}

# List all backups (both plain-dir copies AND .tar.gz archives), newest first.
_core_node_backups() {
    find "$CORE_NODE_BACKUP_DIR" -mindepth 1 -maxdepth 1 -name "core_node-backup-*" 2>/dev/null | sort -r
}

# Create a core_node project backup: copy (skip cache dirs) then optionally zip.
backup_core_node() {
    local exclude_git zip_choice base ts n src copy_dir archive_path final rc
    local include_git_excludes=(--exclude='.git')
    print_header_from_common_functions "Core_node Project Backup"

    if ! is_core_node_installed; then
        print_error_from_common_functions "Core_node project not found at: $CORE_NODE_ROOT_DIR_RESOLVED"
        return 1
    fi

    src="$CORE_NODE_ROOT_DIR_RESOLVED"
    print_info_from_common_functions "Project directory: $src"
    print_info_from_common_functions "Backup directory : $CORE_NODE_BACKUP_DIR"
    print_info_from_common_functions "Auto-skipping (NOT copied): node_modules, __pycache__/.venv/*.pyc, dist/build/.vite/.next/.nuxt,"
    print_info_from_common_functions "   .dart_tool, vendor (php), target (rust), and other dep/cache/build dirs at any depth."
    print_warning_from_common_functions "Read-only on the project: skipped dirs are just NOT copied -- nothing is deleted or changed."
    echo ""

    # Optionally include the (large) .git history in the copy.
    echo -n "Exclude the .git history from the backup (smaller)? (Y/n): "
    read -r exclude_git
    case "$exclude_git" in
        [nN]|[nN][oO]) include_git_excludes=(); print_info_from_common_functions "Including .git history" ;;
        *)             print_info_from_common_functions "Excluding .git history" ;;
    esac

    $USE_SUDO mkdir -p "$CORE_NODE_BACKUP_DIR" 2>/dev/null
    $USE_SUDO chmod 755 "$CORE_NODE_BACKUP_DIR" 2>/dev/null || true

    # Unique base name shared by the dir copy and (if zipped) the .tar.gz.
    ts="$(date +%Y%m%d-%H%M%S)"
    n=1
    base="core_node-backup-${ts}-${n}"
    while [[ -e "$CORE_NODE_BACKUP_DIR/$base" ]] || [[ -e "$CORE_NODE_BACKUP_DIR/$base.tar.gz" ]]; do
        ((n++)); base="core_node-backup-${ts}-${n}"
    done
    copy_dir="$CORE_NODE_BACKUP_DIR/$base"

    # ---- Step 1: COPY (skipping cache dirs) ---------------------------------- #
    print_step_from_common_functions "Step 1/2: Copying project to $base/ (skipping dependency/cache/build dirs)..."
    print_info_from_common_functions "This may take a while depending on project size..."
    if command -v rsync >/dev/null 2>&1; then
        $USE_SUDO rsync -a "${CORE_NODE_BACKUP_EXCLUDES[@]}" "${include_git_excludes[@]}" "$src/" "$copy_dir/"
        rc=$?
        # rsync 0=ok, 24=some files vanished (live tree), 23=some not transferred (perm).
        if [[ "$rc" -ne 0 && "$rc" -ne 24 && "$rc" -ne 23 ]]; then
            print_error_from_common_functions "Copy failed (rsync exit $rc)"
            $USE_SUDO rm -rf "$copy_dir" 2>/dev/null
            return 1
        fi
        [[ "$rc" -eq 23 ]] && print_warning_from_common_functions "Some files were not readable and were skipped (rsync 23)."
    else
        # Fallback without rsync: copy via a tar pipe honoring the same excludes.
        $USE_SUDO mkdir -p "$copy_dir"
        if ! $USE_SUDO tar -cf - "${CORE_NODE_BACKUP_EXCLUDES[@]}" "${include_git_excludes[@]}" \
                --warning=no-file-changed -C "$(dirname "$src")" "$(basename "$src")" \
              | $USE_SUDO tar -xf - -C "$copy_dir" --strip-components=1 2>/dev/null; then
            print_warning_from_common_functions "tar-pipe copy reported issues (live tree); continuing if files were copied."
        fi
    fi
    if [[ ! -d "$copy_dir" ]]; then
        print_error_from_common_functions "Copy produced no directory"
        return 1
    fi
    print_success_from_common_functions "Copied to: $copy_dir ($(du -sh "$copy_dir" 2>/dev/null | cut -f1))"
    echo ""

    # ---- Step 2: optional ZIP ----------------------------------------------- #
    echo -n "Compress this copy into a single .tar.gz (smaller, one file)? (Y/n): "
    read -r zip_choice
    case "$zip_choice" in
        [nN]|[nN][oO])
            final="$copy_dir"
            print_info_from_common_functions "Kept the plain directory copy as the backup (not zipped)."
            ;;
        *)
            print_step_from_common_functions "Step 2/2: Compressing to $base.tar.gz ..."
            archive_path="$CORE_NODE_BACKUP_DIR/$base.tar.gz"
            if $USE_SUDO tar -czf "$archive_path" -C "$CORE_NODE_BACKUP_DIR" "$base"; then
                $USE_SUDO chmod 640 "$archive_path" 2>/dev/null || true
                $USE_SUDO rm -rf "$copy_dir"
                final="$archive_path"
                print_success_from_common_functions "Compressed to: $archive_path ($(du -h "$archive_path" 2>/dev/null | cut -f1))"
                verify_backup "$final" || print_warning_from_common_functions "Integrity check did not pass"
            else
                final="$copy_dir"
                print_error_from_common_functions "Compression failed; the plain directory copy is kept at: $copy_dir"
            fi
            ;;
    esac

    echo ""
    print_success_from_common_functions "Core_node project backup completed (project untouched)"
    print_info_from_common_functions "Backup: $final"
    # The download/web server serves single files; offer it only for an archive.
    [[ -f "$final" ]] && prompt_download_server "$final" "$CORE_NODE_NAMESPACE"
    return 0
}

# List core_node backups (dir copies and .tar.gz archives).
list_core_node_backups() {
    local backups b filename size modified index kind
    print_header_from_common_functions "Core_node Backups"
    if [[ ! -d "$CORE_NODE_BACKUP_DIR" ]]; then
        print_info_from_common_functions "No backups yet (dir: $CORE_NODE_BACKUP_DIR)"
        return 0
    fi
    mapfile -t backups < <(_core_node_backups)
=======
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

>>>>>>> e010669954639e9bd7372a8de66626a68e9f8d8f
    if [[ ${#backups[@]} -eq 0 ]]; then
        print_info_from_common_functions "No Core_node backups found"
        return 0
    fi
<<<<<<< HEAD
    print_info_from_common_functions "Found ${#backups[@]} backup(s) in $CORE_NODE_BACKUP_DIR:"
    echo ""
    printf "%-4s %-8s %-34s %-10s %-20s\n" "No." "Type" "Name" "Size" "Modified"
    echo "──────────────────────────────────────────────────────────────────────────────────"
    index=1
    for b in "${backups[@]}"; do
        filename="$(basename "$b")"
        size="$(du -sh "$b" 2>/dev/null | cut -f1)"
        modified="$(stat -c "%y" "$b" 2>/dev/null | cut -d'.' -f1 || echo unknown)"
        if [[ -d "$b" ]]; then kind="[dir]"; else kind="[tar.gz]"; fi
        printf "%-4s %-8s %-34s %-10s %-20s\n" "$index" "$kind" "$filename" "$size" "$modified"
        ((index++))
    done
    return 0
}

# Select a core_node backup; echoes ONLY the chosen path to stdout (prompts -> stderr).
select_core_node_backup() {
    local backups choice
    mapfile -t backups < <(_core_node_backups)
    if [[ ${#backups[@]} -eq 0 ]]; then
        print_error_from_common_functions "No Core_node backups found" >&2
        return 1
    fi
    list_core_node_backups >&2
    echo "" >&2
    echo -n "Select backup number (1-${#backups[@]}, 0 to cancel): " >&2
    read -r choice
    if [[ "$choice" == "0" ]]; then
        print_info_from_common_functions "Cancelled" >&2
        return 1
    fi
    if [[ "$choice" =~ ^[0-9]+$ ]] && [[ "$choice" -ge 1 ]] && [[ "$choice" -le ${#backups[@]} ]]; then
        echo "${backups[$((choice-1))]}"
        return 0
    fi
    print_error_from_common_functions "Invalid selection" >&2
    return 1
}

# Show details + contents of a selected backup (dir or archive).
show_core_node_backup_details() {
    local backup_file filename size modified total
    backup_file="$(select_core_node_backup)" || return 1
    [[ -n "$backup_file" ]] || return 1
    print_header_from_common_functions "Core_node Backup Details"
    filename="$(basename "$backup_file")"
    size="$(du -sh "$backup_file" 2>/dev/null | cut -f1)"
    modified="$(stat -c "%y" "$backup_file" 2>/dev/null | cut -d'.' -f1 || echo unknown)"
    print_info_from_common_functions "Name    : $filename"
    print_info_from_common_functions "Type    : $([[ -d "$backup_file" ]] && echo 'directory copy' || echo 'tar.gz archive')"
    print_info_from_common_functions "Size    : $size"
    print_info_from_common_functions "Modified: $modified"
    print_info_from_common_functions "Location: $backup_file"
    echo ""
    print_step_from_common_functions "Contents (first 20 entries):"
    if [[ -d "$backup_file" ]]; then
        find "$backup_file" -mindepth 1 -maxdepth 2 2>/dev/null | head -20
        total="$(find "$backup_file" 2>/dev/null | wc -l)"
    else
        tar -tzf "$backup_file" 2>/dev/null | head -20
        total="$(tar -tzf "$backup_file" 2>/dev/null | wc -l)"
    fi
    [[ "$total" -gt 20 ]] && print_info_from_common_functions "... and $((total - 20)) more entries"
    return 0
}

# Delete a selected backup (dir copy or archive). Never touches project files.
delete_core_node_backup() {
    local backup_file filename confirm
    backup_file="$(select_core_node_backup)" || return 1
    [[ -n "$backup_file" ]] || return 1
    filename="$(basename "$backup_file")"
    print_warning_from_common_functions "About to delete the backup: $filename ($([[ -d "$backup_file" ]] && echo dir || echo archive))"
    echo -n "Are you sure? (yes/no): "
    read -r confirm
    if [[ "$confirm" == "yes" ]]; then
        if $USE_SUDO rm -rf "$backup_file"; then
            print_success_from_common_functions "Backup deleted: $filename"
        else
            print_error_from_common_functions "Failed to delete backup"
            return 1
        fi
    else
        print_info_from_common_functions "Deletion cancelled"
    fi
=======

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

>>>>>>> e010669954639e9bd7372a8de66626a68e9f8d8f
    return 0
}
