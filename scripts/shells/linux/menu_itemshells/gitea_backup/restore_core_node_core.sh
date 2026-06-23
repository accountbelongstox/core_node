#!/bin/bash
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 6344f025e5972e4651ccffc45c7fdd0033674741
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

# Core_node Project Restore - NON-DESTRUCTIVE.
# Extracts a core_node backup into a NEW timestamped directory next to the project.
# It NEVER moves, overwrites or deletes the live checkout (which also hosts this
# running script) -- the operator inspects the extracted copy and swaps it in by hand.
<<<<<<< HEAD
=======
# Core_node Project Restore Core Functions
# This file contains core restore logic for the core_node project
# Called by backup_management_main.sh
>>>>>>> e010669954639e9bd7372a8de66626a68e9f8d8f
=======
>>>>>>> 6344f025e5972e4651ccffc45c7fdd0033674741

RESTORE_CORE_NODE_VERSION="1.0.0"

# Load common functions if not already loaded
if [[ -z "$GVAR_COMMON_LOADED" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
    source "$COMMON_DIR/gvar_common.sh"
    source "$COMMON_DIR/common_functions.sh"
fi

<<<<<<< HEAD
<<<<<<< HEAD
# Reuse the core module's config (CORE_NODE_ROOT_DIR_RESOLVED, verify_backup, ...).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/backup_core_node_core.sh"

# Restore (extract) a core_node backup into a fresh directory. $1 = backup file.
restore_core_node() {
    local backup_file="$1"
    local base_name parent_dir restore_dir confirm

    print_header_from_common_functions "Core_node Restore (non-destructive)"

    if [[ -z "$backup_file" ]] || [[ ! -e "$backup_file" ]]; then
        print_error_from_common_functions "Backup not found: $backup_file"
        return 1
    fi

    # A backup is either a .tar.gz archive (verify integrity) or a plain dir copy.
    if [[ -f "$backup_file" ]]; then
        if ! verify_backup "$backup_file"; then
            print_error_from_common_functions "Backup integrity check failed; not restoring."
            return 1
        fi
    elif [[ ! -d "$backup_file" ]]; then
        print_error_from_common_functions "Backup is neither a file nor a directory: $backup_file"
        return 1
    fi

    base_name="$(basename "$CORE_NODE_ROOT_DIR_RESOLVED")"
    parent_dir="$(dirname "$CORE_NODE_ROOT_DIR_RESOLVED")"
    restore_dir="$parent_dir/${base_name}_restored_$(date +%Y%m%d-%H%M%S)"

    print_info_from_common_functions "Backup file: $(basename "$backup_file")"
    print_warning_from_common_functions "NON-DESTRUCTIVE: extracts to a NEW directory; the live checkout at"
    print_warning_from_common_functions "  $CORE_NODE_ROOT_DIR_RESOLVED  is NOT moved, overwritten or deleted."
    print_info_from_common_functions "Extract destination: $restore_dir"
    echo ""
    echo -n "Proceed with extraction? (yes/no): "
    read -r confirm
=======
# Source backup core to get common configuration
=======
# Reuse the core module's config (CORE_NODE_ROOT_DIR_RESOLVED, verify_backup, ...).
>>>>>>> 6344f025e5972e4651ccffc45c7fdd0033674741
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/backup_core_node_core.sh"

# Restore (extract) a core_node backup into a fresh directory. $1 = backup file.
restore_core_node() {
    local backup_file="$1"
    local base_name parent_dir restore_dir confirm

    print_header_from_common_functions "Core_node Restore (non-destructive)"

    if [[ -z "$backup_file" ]] || [[ ! -e "$backup_file" ]]; then
        print_error_from_common_functions "Backup not found: $backup_file"
        return 1
    fi

    # A backup is either a .tar.gz archive (verify integrity) or a plain dir copy.
    if [[ -f "$backup_file" ]]; then
        if ! verify_backup "$backup_file"; then
            print_error_from_common_functions "Backup integrity check failed; not restoring."
            return 1
        fi
    elif [[ ! -d "$backup_file" ]]; then
        print_error_from_common_functions "Backup is neither a file nor a directory: $backup_file"
        return 1
    fi

    base_name="$(basename "$CORE_NODE_ROOT_DIR_RESOLVED")"
    parent_dir="$(dirname "$CORE_NODE_ROOT_DIR_RESOLVED")"
    restore_dir="$parent_dir/${base_name}_restored_$(date +%Y%m%d-%H%M%S)"

    print_info_from_common_functions "Backup file: $(basename "$backup_file")"
    print_warning_from_common_functions "NON-DESTRUCTIVE: extracts to a NEW directory; the live checkout at"
    print_warning_from_common_functions "  $CORE_NODE_ROOT_DIR_RESOLVED  is NOT moved, overwritten or deleted."
    print_info_from_common_functions "Extract destination: $restore_dir"
    echo ""
    echo -n "Proceed with extraction? (yes/no): "
    read -r confirm
<<<<<<< HEAD

>>>>>>> e010669954639e9bd7372a8de66626a68e9f8d8f
=======
>>>>>>> 6344f025e5972e4651ccffc45c7fdd0033674741
    if [[ "$confirm" != "yes" ]]; then
        print_info_from_common_functions "Restore cancelled"
        return 0
    fi

<<<<<<< HEAD
<<<<<<< HEAD
    if ! $USE_SUDO mkdir -p "$restore_dir"; then
        print_error_from_common_functions "Cannot create destination: $restore_dir"
        return 1
    fi

    print_step_from_common_functions "Restoring into $restore_dir ..."
    local restore_rc=0
    if [[ -d "$backup_file" ]]; then
        # Directory-copy backup: replicate its contents into restore_dir.
        if command -v rsync >/dev/null 2>&1; then
            $USE_SUDO rsync -a "$backup_file/" "$restore_dir/"; restore_rc=$?
        else
            $USE_SUDO cp -a "$backup_file/." "$restore_dir/"; restore_rc=$?
        fi
    else
        # .tar.gz archive: extract, dropping the leading "<base_name>/".
        $USE_SUDO tar -xzf "$backup_file" -C "$restore_dir" --strip-components=1 2>/dev/null; restore_rc=$?
    fi
    if [[ "$restore_rc" -eq 0 ]]; then
        echo ""
        print_success_from_common_functions "Restored a clean copy to: $restore_dir"
        print_info_from_common_functions "Inspect it, then swap it in MANUALLY if you want it to become the live checkout."
        print_info_from_common_functions "Dependency/cache/build dirs were not in the backup -- reinstall (npm/pip/composer/cargo/...) as needed."
    else
        print_error_from_common_functions "Extraction failed"
        $USE_SUDO rmdir "$restore_dir" 2>/dev/null || true
        return 1
    fi
=======
    # Extract into a temp dir and validate structure
    print_step_from_common_functions "Extracting backup file..."
    local restore_tmp_dir=$(mktemp -d)

    if ! tar -xzf "$backup_file" -C "$restore_tmp_dir" 2>/dev/null; then
        print_error_from_common_functions "Failed to extract backup file"
        rm -rf "$restore_tmp_dir"
=======
    if ! $USE_SUDO mkdir -p "$restore_dir"; then
        print_error_from_common_functions "Cannot create destination: $restore_dir"
>>>>>>> 6344f025e5972e4651ccffc45c7fdd0033674741
        return 1
    fi

    print_step_from_common_functions "Restoring into $restore_dir ..."
    local restore_rc=0
    if [[ -d "$backup_file" ]]; then
        # Directory-copy backup: replicate its contents into restore_dir.
        if command -v rsync >/dev/null 2>&1; then
            $USE_SUDO rsync -a "$backup_file/" "$restore_dir/"; restore_rc=$?
        else
            $USE_SUDO cp -a "$backup_file/." "$restore_dir/"; restore_rc=$?
        fi
    else
        # .tar.gz archive: extract, dropping the leading "<base_name>/".
        $USE_SUDO tar -xzf "$backup_file" -C "$restore_dir" --strip-components=1 2>/dev/null; restore_rc=$?
    fi
    if [[ "$restore_rc" -eq 0 ]]; then
        echo ""
        print_success_from_common_functions "Restored a clean copy to: $restore_dir"
        print_info_from_common_functions "Inspect it, then swap it in MANUALLY if you want it to become the live checkout."
        print_info_from_common_functions "Dependency/cache/build dirs were not in the backup -- reinstall (npm/pip/composer/cargo/...) as needed."
    else
        print_error_from_common_functions "Extraction failed"
        $USE_SUDO rmdir "$restore_dir" 2>/dev/null || true
        return 1
    fi
<<<<<<< HEAD

    # Move the existing checkout aside
    local target_dir="$CORE_NODE_ROOT_DIR_RESOLVED"
    local parent_dir="$(dirname "$target_dir")"
    if [[ -d "$target_dir" ]]; then
        local moved_aside="${target_dir}.backup.$(date +%Y%m%d-%H%M%S)"
        print_step_from_common_functions "Moving current checkout aside: $moved_aside"
        $USE_SUDO mv "$target_dir" "$moved_aside" || {
            print_error_from_common_functions "Failed to move current checkout aside"
            rm -rf "$restore_tmp_dir"
            return 1
        }
    fi

    # Move the restored tree into place
    print_step_from_common_functions "Restoring project files..."
    $USE_SUDO mkdir -p "$parent_dir"
    if ! $USE_SUDO mv "$extracted_dir" "$target_dir"; then
        print_error_from_common_functions "Failed to move restored files into place"
        rm -rf "$restore_tmp_dir"
        return 1
    fi

    # Optional ownership fix (REAL_USER is not always defined)
    if [[ -n "${REAL_USER:-}" ]]; then
        $USE_SUDO chown -R "$REAL_USER:$REAL_USER" "$target_dir" 2>/dev/null || true
    fi

    # Cleanup
    rm -rf "$restore_tmp_dir"

    echo ""
    print_success_from_common_functions "Core_node restore completed successfully"
    print_info_from_common_functions "Note: dependency/cache/build directories were not part of the backup"
    print_info_from_common_functions "Reinstall dependencies (npm install / pip install / etc.) as needed"

>>>>>>> e010669954639e9bd7372a8de66626a68e9f8d8f
=======
>>>>>>> 6344f025e5972e4651ccffc45c7fdd0033674741
    return 0
}
