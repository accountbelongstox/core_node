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

# Core_node Project Restore - NON-DESTRUCTIVE.
# Extracts a core_node backup into a NEW timestamped directory next to the project.
# It NEVER moves, overwrites or deletes the live checkout (which also hosts this
# running script) -- the operator inspects the extracted copy and swaps it in by hand.

RESTORE_CORE_NODE_VERSION="1.0.0"

# Load common functions if not already loaded
if [[ -z "$GVAR_COMMON_LOADED" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
    source "$COMMON_DIR/gvar_common.sh"
    source "$COMMON_DIR/common_functions.sh"
fi

# Reuse the core module's config (CORE_NODE_ROOT_DIR_RESOLVED, verify_backup, ...).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/backup_core_node_core.sh"

# Restore (extract) a core_node backup into a fresh directory. $1 = backup file.
restore_core_node() {
    local backup_file="$1"
    local base_name parent_dir restore_dir confirm

    print_header_from_common_functions "Core_node Restore (non-destructive)"

    if [[ -z "$backup_file" ]] || [[ ! -f "$backup_file" ]]; then
        print_error_from_common_functions "Backup file not found: $backup_file"
        return 1
    fi

    if ! verify_backup "$backup_file"; then
        print_error_from_common_functions "Backup integrity check failed; not restoring."
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
    if [[ "$confirm" != "yes" ]]; then
        print_info_from_common_functions "Restore cancelled"
        return 0
    fi

    if ! $USE_SUDO mkdir -p "$restore_dir"; then
        print_error_from_common_functions "Cannot create destination: $restore_dir"
        return 1
    fi

    print_step_from_common_functions "Extracting backup..."
    # --strip-components=1 drops the leading "<base_name>/" so the project contents
    # land directly inside restore_dir.
    if $USE_SUDO tar -xzf "$backup_file" -C "$restore_dir" --strip-components=1 2>/dev/null; then
        echo ""
        print_success_from_common_functions "Restored a clean copy to: $restore_dir"
        print_info_from_common_functions "Inspect it, then swap it in MANUALLY if you want it to become the live checkout."
        print_info_from_common_functions "Dependency/cache/build dirs were not in the backup -- reinstall (npm/pip/composer/cargo/...) as needed."
    else
        print_error_from_common_functions "Extraction failed"
        $USE_SUDO rmdir "$restore_dir" 2>/dev/null || true
        return 1
    fi
    return 0
}
