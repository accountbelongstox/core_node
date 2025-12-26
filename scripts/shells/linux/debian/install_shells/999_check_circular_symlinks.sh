#!/bin/bash
# Check and Fix Circular Symlinks in /usr/local/bin
#
# This script detects and removes circular symlinks that point to themselves,
# which can cause "Too many levels of symbolic links" errors in system tools.
#
# Usage:
#   ./999_check_circular_symlinks.sh          # Check and report only
#   ./999_check_circular_symlinks.sh --fix    # Check and fix automatically

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

SCRIPT_INDEX="999"
FIX_MODE=false

# Parse arguments
if [[ "$1" == "--fix" ]]; then
    FIX_MODE=true
fi

print_step_from_common_functions "Checking for circular symlinks in /usr/local/bin..."

# Find all circular symlinks
CIRCULAR_SYMLINKS=()
while IFS= read -r link; do
    if [[ -L "$link" ]]; then
        target=$(readlink "$link" 2>/dev/null)
        basename_link=$(basename "$link")

        # Check if symlink points to itself (either absolute or basename)
        if [[ "$target" == "$link" ]] || [[ "$target" == "$basename_link" ]] || [[ "$target" == "/usr/local/bin/$basename_link" ]]; then
            CIRCULAR_SYMLINKS+=("$link")
        fi
    fi
done < <(find /usr/local/bin -type l 2>/dev/null)

# Report findings
if [[ ${#CIRCULAR_SYMLINKS[@]} -eq 0 ]]; then
    print_success_from_common_functions "No circular symlinks found"
    exit 0
fi

print_warning_from_common_functions "Found ${#CIRCULAR_SYMLINKS[@]} circular symlinks:"
echo ""
for link in "${CIRCULAR_SYMLINKS[@]}"; do
    target=$(readlink "$link" 2>/dev/null)
    echo "  ✗ $(basename "$link") → $target"
done
echo ""

# Fix if requested
if [[ "$FIX_MODE" == true ]]; then
    print_step_from_common_functions "Removing circular symlinks..."

    removed_count=0
    for link in "${CIRCULAR_SYMLINKS[@]}"; do
        if $USE_SUDO rm -f "$link" 2>/dev/null; then
            ((removed_count++))
            print_info_from_common_functions "Removed: $(basename "$link")"
        else
            print_error_from_common_functions "Failed to remove: $(basename "$link")"
        fi
    done

    print_success_from_common_functions "Removed $removed_count circular symlinks"

    # Verify critical tools still work
    print_step_from_common_functions "Verifying critical tools..."

    CRITICAL_TOOLS=("gzip" "tar" "curl" "wget" "bzip2" "xz")
    all_working=true

    for tool in "${CRITICAL_TOOLS[@]}"; do
        if command -v "$tool" >/dev/null 2>&1; then
            print_info_from_common_functions "✓ $tool: $(which "$tool")"
        else
            print_warning_from_common_functions "✗ $tool: not found"
            all_working=false
        fi
    done

    if [[ "$all_working" == true ]]; then
        print_success_from_common_functions "All critical tools verified"
    else
        print_warning_from_common_functions "Some tools may need reinstallation"
    fi
else
    print_warning_from_common_functions "Run with --fix to remove circular symlinks"
    print_info_from_common_functions "Command: $0 --fix"
    exit 1
fi
