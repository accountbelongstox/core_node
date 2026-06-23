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

# Core_node Project Backup - core functions (namespace "core_node").
# Copies the whole core_node repo into a tar.gz, AUTO-SKIPPING every language's
# dependency/cache/build directory in ANY sub-directory. The backup is READ-ONLY
# on the project: skipped directories are simply NOT copied into the archive --
# nothing in the project is ever moved, modified or deleted.

BACKUP_CORE_NODE_VERSION="1.0.0"

# Load common functions if not already loaded
if [[ -z "$GVAR_COMMON_LOADED" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
    source "$COMMON_DIR/gvar_common.sh"
    source "$COMMON_DIR/common_functions.sh"
fi

# Shared backup helpers (get_backup_dir, create_backup_filename, verify_backup,
# cleanup_old_backups, prompt_download_server, BACKUP_ROOT_DIR).
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
    if [[ -n "${CORE_NODE_ROOT_DIR:-}" ]] && [[ -d "$CORE_NODE_ROOT_DIR" ]]; then
        echo "$CORE_NODE_ROOT_DIR"
        return 0
    fi
    cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../../../../.." 2>/dev/null && pwd
}

CORE_NODE_ROOT_DIR_RESOLVED="$(_resolve_core_node_root)"
CORE_NODE_BACKUP_DIR="$(get_backup_dir "$CORE_NODE_NAMESPACE")"

# Dependency/cache/build excludes. BARE unanchored names so each matches at ANY
# depth incl. the archive root (do NOT add --anchored, do NOT use '*/name'). Tested
# on GNU tar: every dep/cache/build dir is skipped, real source (incl. files like
# build.rs or a dir literally named target containing source) is kept.
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

# True when a real core_node checkout is present.
is_core_node_installed() {
    [[ -d "$CORE_NODE_ROOT_DIR_RESOLVED" ]] \
        && { [[ -e "$CORE_NODE_ROOT_DIR_RESOLVED/.git" ]] || [[ -f "$CORE_NODE_ROOT_DIR_RESOLVED/AGENTS.md" ]]; }
}

# Create a core_node project backup (read-only on the project).
backup_core_node() {
    local exclude_git backup_filename backup_path parent_dir base_name backup_size tar_rc
    local include_git_excludes=(--exclude='.git')
    print_header_from_common_functions "Core_node Project Backup"

    if ! is_core_node_installed; then
        print_error_from_common_functions "Core_node project not found at: $CORE_NODE_ROOT_DIR_RESOLVED"
        return 1
    fi

    print_info_from_common_functions "Project directory: $CORE_NODE_ROOT_DIR_RESOLVED"
    print_info_from_common_functions "Backup directory : $CORE_NODE_BACKUP_DIR"
    print_info_from_common_functions "Auto-skipping (NOT copied): node_modules, __pycache__/.venv/*.pyc, dist/build/.vite/.next/.nuxt,"
    print_info_from_common_functions "   .dart_tool, vendor (php), target (rust), and other dep/cache/build dirs at any depth."
    print_warning_from_common_functions "This only OMITS those dirs from the archive -- nothing in the project is deleted or changed."
    echo ""

    # Optionally include the (large) .git object store.
    echo -n "Exclude the .git history from the backup (smaller)? (Y/n): "
    read -r exclude_git
    case "$exclude_git" in
        [nN]|[nN][oO]) include_git_excludes=(); print_info_from_common_functions "Including .git history" ;;
        *)             print_info_from_common_functions "Excluding .git history" ;;
    esac

    $USE_SUDO mkdir -p "$CORE_NODE_BACKUP_DIR" 2>/dev/null
    $USE_SUDO chmod 755 "$CORE_NODE_BACKUP_DIR" 2>/dev/null || true

    backup_filename="$(create_backup_filename "$CORE_NODE_NAMESPACE" "core_node" "tar.gz")"
    backup_path="$CORE_NODE_BACKUP_DIR/$backup_filename"
    parent_dir="$(dirname "$CORE_NODE_ROOT_DIR_RESOLVED")"
    base_name="$(basename "$CORE_NODE_ROOT_DIR_RESOLVED")"

    print_step_from_common_functions "Archiving project to: $backup_filename"
    print_info_from_common_functions "This may take a while depending on project size..."
    echo ""

    # tar -C keeps the menu's working directory unchanged (a bare `cd` would pollute
    # the caller). Members are <base_name>/... --warning=no-file-changed silences the
    # benign "file changed as we read it" notices on a live tree.
    $USE_SUDO tar -czf "$backup_path" \
        "${CORE_NODE_BACKUP_EXCLUDES[@]}" "${include_git_excludes[@]}" \
        --warning=no-file-changed \
        -C "$parent_dir" "$base_name"
    tar_rc=$?

    # tar exit 1 = "some files changed while reading" (expected on a live project);
    # a created, integrity-valid archive is still a success.
    if [[ "$tar_rc" -eq 0 ]] || { [[ "$tar_rc" -eq 1 ]] && [[ -s "$backup_path" ]]; }; then
        $USE_SUDO chmod 640 "$backup_path" 2>/dev/null || true
        backup_size="$(du -h "$backup_path" 2>/dev/null | cut -f1)"
        [[ "$tar_rc" -eq 1 ]] && print_warning_from_common_functions "Some files changed during archiving (live project) -- archive still created."
        print_success_from_common_functions "Backup created: $backup_filename ($backup_size)"
        print_info_from_common_functions "Location: $backup_path"
    else
        print_error_from_common_functions "Backup failed (tar exit $tar_rc)"
        return 1
    fi

    echo ""
    verify_backup "$backup_path" || print_warning_from_common_functions "Integrity check did not pass"

    echo ""
    print_success_from_common_functions "Core_node project backup completed (project untouched)"
    prompt_download_server "$backup_path" "$CORE_NODE_NAMESPACE"
    return 0
}

# List core_node backups.
list_core_node_backups() {
    local backups filename size modified index b
    print_header_from_common_functions "Core_node Backups"
    if [[ ! -d "$CORE_NODE_BACKUP_DIR" ]]; then
        print_info_from_common_functions "No backups yet (dir: $CORE_NODE_BACKUP_DIR)"
        return 0
    fi
    backups=($(find "$CORE_NODE_BACKUP_DIR" -name "core_node-backup-*.tar.gz" -type f 2>/dev/null | sort -r))
    if [[ ${#backups[@]} -eq 0 ]]; then
        print_info_from_common_functions "No Core_node backups found"
        return 0
    fi
    print_info_from_common_functions "Found ${#backups[@]} backup(s) in $CORE_NODE_BACKUP_DIR:"
    echo ""
    printf "%-4s %-34s %-10s %-20s\n" "No." "Filename" "Size" "Modified"
    echo "──────────────────────────────────────────────────────────────────────────"
    index=1
    for b in "${backups[@]}"; do
        filename="$(basename "$b")"
        size="$(du -h "$b" 2>/dev/null | cut -f1)"
        modified="$(stat -c "%y" "$b" 2>/dev/null | cut -d'.' -f1 || echo unknown)"
        printf "%-4s %-34s %-10s %-20s\n" "$index" "$filename" "$size" "$modified"
        ((index++))
    done
    return 0
}

# Select a core_node backup; echoes ONLY the chosen path to stdout (prompts -> stderr).
select_core_node_backup() {
    local backups choice
    backups=($(find "$CORE_NODE_BACKUP_DIR" -name "core_node-backup-*.tar.gz" -type f 2>/dev/null | sort -r))
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

# Show details + contents of a selected backup.
show_core_node_backup_details() {
    local backup_file filename size modified total_files
    backup_file="$(select_core_node_backup)" || return 1
    [[ -n "$backup_file" ]] || return 1
    print_header_from_common_functions "Core_node Backup Details"
    filename="$(basename "$backup_file")"
    size="$(du -h "$backup_file" 2>/dev/null | cut -f1)"
    modified="$(stat -c "%y" "$backup_file" 2>/dev/null | cut -d'.' -f1 || echo unknown)"
    print_info_from_common_functions "Filename: $filename"
    print_info_from_common_functions "Size    : $size"
    print_info_from_common_functions "Modified: $modified"
    print_info_from_common_functions "Location: $backup_file"
    echo ""
    print_step_from_common_functions "Archive contents (first 20 entries):"
    tar -tzf "$backup_file" 2>/dev/null | head -20
    total_files="$(tar -tzf "$backup_file" 2>/dev/null | wc -l)"
    [[ "$total_files" -gt 20 ]] && print_info_from_common_functions "... and $((total_files - 20)) more entries"
    return 0
}

# Delete a selected backup ARCHIVE (never touches project files).
delete_core_node_backup() {
    local backup_file filename confirm
    backup_file="$(select_core_node_backup)" || return 1
    [[ -n "$backup_file" ]] || return 1
    filename="$(basename "$backup_file")"
    print_warning_from_common_functions "About to delete the backup archive: $filename"
    echo -n "Are you sure? (yes/no): "
    read -r confirm
    if [[ "$confirm" == "yes" ]]; then
        if $USE_SUDO rm -f "$backup_file"; then
            print_success_from_common_functions "Backup deleted: $filename"
        else
            print_error_from_common_functions "Failed to delete backup"
            return 1
        fi
    else
        print_info_from_common_functions "Deletion cancelled"
    fi
    return 0
}
