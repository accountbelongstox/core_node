#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For Shell scripts: Always use absolute paths, avoid relative paths like "../".
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_CURRENT_DIR")"
SCRIPT_INDEX="CLEANUP"

# Source global variables
source "$PARENT_DIR/common/gvar_common.sh"

# Variable declarations
nginx_config_dir=""
sites_enabled_dir=""
USE_SUDO=""

echo "========================================"
echo "CLEANUP FAILED DOMAIN CONFIGURATIONS"
echo "========================================"
echo ""

# Get paths
nginx_config_dir=$(map_web_path "nginxconfig")
sites_enabled_dir="$nginx_config_dir/sites-enabled"

echo "[$SCRIPT_INDEX] Configuration directories:"
echo "[$SCRIPT_INDEX]   Nginx config: $nginx_config_dir"
echo "[$SCRIPT_INDEX]   Sites enabled: $sites_enabled_dir"
echo ""

# Check if USE_SUDO is set
if [ -z "$USE_SUDO" ]; then
    if command -v sudo >/dev/null 2>&1; then
        USE_SUDO="sudo"
    else
        USE_SUDO=""
    fi
fi

# List all symlinks in sites-enabled
echo "[$SCRIPT_INDEX] Current symlinks in sites-enabled:"
if [ -d "$sites_enabled_dir" ]; then
    ls -la "$sites_enabled_dir/" | grep "^l" | head -20

    total_links=$(ls -1 "$sites_enabled_dir/" 2>/dev/null | wc -l)
    echo "[$SCRIPT_INDEX] Total links: $total_links"
else
    echo "[$SCRIPT_INDEX] [ERROR] Sites-enabled directory not found!"
    exit 1
fi
echo ""

# Ask for confirmation
echo "[$SCRIPT_INDEX] This script will:"
echo "[$SCRIPT_INDEX]   1. Remove ALL symbolic links in sites-enabled"
echo "[$SCRIPT_INDEX]   2. Keep the actual configuration files in sites-available"
echo "[$SCRIPT_INDEX]   3. Allow you to re-run the domain setup script cleanly"
echo ""
read -p "[$SCRIPT_INDEX] Do you want to continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "[$SCRIPT_INDEX] Cleanup cancelled"
    exit 0
fi

echo ""
echo "[$SCRIPT_INDEX] Starting cleanup..."
echo ""

# Remove all symlinks in sites-enabled
removed_count=0
failed_count=0

if [ -d "$sites_enabled_dir" ]; then
    for link in "$sites_enabled_dir"/*; do
        if [ -L "$link" ]; then
            link_name=$(basename "$link")
            echo "[$SCRIPT_INDEX] Removing: $link_name"

            if $USE_SUDO rm -f "$link" 2>/dev/null; then
                ((removed_count++))
            else
                echo "[$SCRIPT_INDEX]   [FAILED] Could not remove: $link_name"
                ((failed_count++))
            fi
        fi
    done
fi

echo ""
echo "[$SCRIPT_INDEX] =================================="
echo "[$SCRIPT_INDEX] Cleanup Summary:"
echo "[$SCRIPT_INDEX]   Removed: $removed_count links"
echo "[$SCRIPT_INDEX]   Failed:  $failed_count links"
echo "[$SCRIPT_INDEX] =================================="
echo ""

# Verify cleanup
remaining_links=$(ls -1 "$sites_enabled_dir/" 2>/dev/null | wc -l)
if [ "$remaining_links" -eq 0 ]; then
    echo "[$SCRIPT_INDEX] [OK] All links removed successfully"
else
    echo "[$SCRIPT_INDEX] [WARN] $remaining_links links still remain"
fi

echo ""
echo "[$SCRIPT_INDEX] Next steps:"
echo "[$SCRIPT_INDEX]   1. Run: cd /www/wwwroot/core_node && git pull"
echo "[$SCRIPT_INDEX]   2. Run: bash scripts/shells/linux/debian/install_shells/130_setup_domains.sh"
echo ""
echo "[$SCRIPT_INDEX] Cleanup complete!"
