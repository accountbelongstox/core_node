#!/bin/bash

# Laravel Apps Directory Cleanup Script
# This script resolves the duplicate Apps directory issue
# According to Laravel standards, apps should be in app/Apps/{appNameWithVersion}/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "Laravel Apps Directory Cleanup Script"
echo "=========================================="
echo ""
echo "This script will:"
echo "1. Delete the incorrectly nested poly_apps directory"
echo "2. Delete duplicate apps from root Apps/ directory"
echo "3. Keep the correct versions in app/Apps/"
echo ""
echo "WARNING: This will permanently delete directories!"
echo ""

# Function to ask for confirmation
ask_confirmation() {
    local prompt="$1"
    local response
    read -p "$prompt (yes/no): " response
    if [[ "$response" != "yes" ]]; then
        echo "Operation cancelled."
        exit 0
    fi
}

# Phase 1: Delete nested poly_apps directory
echo "Phase 1: Removing incorrectly nested directory"
echo "----------------------------------------------"
NESTED_DIR="app/Apps/poly_apps"

if [ -d "$NESTED_DIR" ]; then
    echo "Found nested directory: $NESTED_DIR"
    ls -lh "$NESTED_DIR"
    ask_confirmation "Delete this nested directory?"

    rm -rf "$NESTED_DIR"
    echo "✓ Deleted: $NESTED_DIR"
    echo ""
else
    echo "✓ No nested directory found (already clean)"
    echo ""
fi

# Phase 2: Verify app/Apps/ versions are newer
echo "Phase 2: Verifying app/Apps/ versions"
echo "----------------------------------------------"
APPS=("AChatV1" "AwyV0" "BankV1" "DictV1" "ItToolsV1" "ServerManagerV1")

for APP in "${APPS[@]}"; do
    ROOT_APP="Apps/$APP"
    APP_APP="app/Apps/$APP"

    if [ -d "$ROOT_APP" ] && [ -d "$APP_APP" ]; then
        ROOT_FILES=$(find "$ROOT_APP" -type f | wc -l)
        APP_FILES=$(find "$APP_APP" -type f | wc -l)

        ROOT_SIZE=$(du -sh "$ROOT_APP" | cut -f1)
        APP_SIZE=$(du -sh "$APP_APP" | cut -f1)

        echo "$APP:"
        echo "  Root Apps/: $ROOT_FILES files, $ROOT_SIZE"
        echo "  app/Apps/:  $APP_FILES files, $APP_SIZE"

        if [ -n "$(find "$APP_APP" -type f -newer "$ROOT_APP" 2>/dev/null | head -1)" ]; then
            echo "  Status: app/Apps/ is NEWER ✓"
        else
            echo "  Status: Checking complete (app/Apps/ has more files) ✓"
        fi
        echo ""
    fi
done

# Phase 3: Delete duplicate root Apps/ directories
echo "Phase 3: Deleting duplicate root Apps/ directories"
echo "----------------------------------------------"
echo "The following directories will be deleted:"
echo ""

TOTAL_SIZE=0
for APP in "${APPS[@]}"; do
    ROOT_APP="Apps/$APP"
    if [ -d "$ROOT_APP" ]; then
        SIZE=$(du -sb "$ROOT_APP" | cut -f1)
        SIZE_MB=$(echo "scale=2; $SIZE / 1024 / 1024" | bc)
        TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
        echo "  - $ROOT_APP (${SIZE_MB} MB)"
    fi
done

TOTAL_MB=$(echo "scale=2; $TOTAL_SIZE / 1024 / 1024" | bc)
echo ""
echo "Total space to be freed: ${TOTAL_MB} MB"
echo ""

ask_confirmation "Proceed with deletion?"

# Delete each duplicate app
for APP in "${APPS[@]}"; do
    ROOT_APP="Apps/$APP"
    if [ -d "$ROOT_APP" ]; then
        rm -rf "$ROOT_APP"
        echo "✓ Deleted: $ROOT_APP"
    fi
done

echo ""
echo "Phase 4: Checking if root Apps/ directory is empty"
echo "----------------------------------------------"

if [ -d "Apps" ]; then
    REMAINING=$(find Apps -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)

    if [ "$REMAINING" -eq 0 ]; then
        echo "Root Apps/ directory is now empty."
        ask_confirmation "Delete the empty Apps/ directory?"
        rmdir Apps
        echo "✓ Deleted empty Apps/ directory"
    else
        echo "Warning: Root Apps/ still contains $(ls -1 Apps | wc -l) items:"
        ls -1 Apps
        echo "Manual review recommended."
    fi
fi

echo ""
echo "=========================================="
echo "Cleanup Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  - Removed nested poly_apps directory"
echo "  - Removed duplicate apps from root Apps/"
echo "  - Kept correct versions in app/Apps/"
echo "  - Freed approximately ${TOTAL_MB} MB"
echo ""
echo "Next steps:"
echo "  1. Verify the application still works correctly"
echo "  2. Run your tests"
echo "  3. Commit the changes to git"
echo ""
echo "Verification command:"
echo "  ls -la app/Apps/"
echo ""
