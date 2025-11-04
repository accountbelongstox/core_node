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
CORE_NODE_DIR="$(cd "$PARENT_DIR/../../.." && pwd)"
SCRIPT_INDEX="FIX"

# Source global variables
source "$PARENT_DIR/common/gvar_common.sh"

# Variable declarations
nginx_config_dir=""
sites_enabled_dir=""
USE_SUDO=""

echo "========================================"
echo "COMPREHENSIVE DOMAIN SETUP FIX"
echo "========================================"
echo ""
echo "[$SCRIPT_INDEX] This script will fix all known issues:"
echo "[$SCRIPT_INDEX]   1. Update core_node code from git"
echo "[$SCRIPT_INDEX]   2. Fix certbot zope module issue"
echo "[$SCRIPT_INDEX]   3. Clean up conflicting symlinks"
echo "[$SCRIPT_INDEX]   4. Provide next steps"
echo ""

# Check if USE_SUDO is set
if [ -z "$USE_SUDO" ]; then
    if command -v sudo >/dev/null 2>&1; then
        USE_SUDO="sudo"
    else
        USE_SUDO=""
    fi
fi

# Get paths
nginx_config_dir=$(map_web_path "nginxconfig")
sites_enabled_dir="$nginx_config_dir/sites-enabled"

echo "[$SCRIPT_INDEX] Environment:"
echo "[$SCRIPT_INDEX]   Core Node: $CORE_NODE_DIR"
echo "[$SCRIPT_INDEX]   Nginx config: $nginx_config_dir"
echo "[$SCRIPT_INDEX]   Sites enabled: $sites_enabled_dir"
echo "[$SCRIPT_INDEX]   Using sudo: ${USE_SUDO:-no}"
echo ""

# Step 1: Update code from git
echo "========================================"
echo "STEP 1: UPDATE CODE FROM GIT"
echo "========================================"

cd "$CORE_NODE_DIR" || exit 1

echo "[$SCRIPT_INDEX] Current directory: $(pwd)"
echo "[$SCRIPT_INDEX] Checking git status..."
git status --short | head -10

echo ""
echo "[$SCRIPT_INDEX] Fetching latest changes..."
git fetch origin

echo ""
echo "[$SCRIPT_INDEX] Current commit: $(git rev-parse --short HEAD)"
echo "[$SCRIPT_INDEX] Latest remote commit: $(git rev-parse --short origin/main)"

if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
    echo ""
    read -p "[$SCRIPT_INDEX] Pull latest changes? (y/N): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "[$SCRIPT_INDEX] Pulling latest changes..."
        git pull origin main

        if [ $? -eq 0 ]; then
            echo "[$SCRIPT_INDEX] [OK] Code updated successfully"
            echo "[$SCRIPT_INDEX] New commit: $(git rev-parse --short HEAD)"
        else
            echo "[$SCRIPT_INDEX] [ERROR] Failed to pull changes"
            echo "[$SCRIPT_INDEX] Please resolve git conflicts manually"
        fi
    else
        echo "[$SCRIPT_INDEX] Skipping git pull"
    fi
else
    echo "[$SCRIPT_INDEX] [OK] Code is already up to date"
fi

echo ""

# Step 2: Fix certbot zope module
echo "========================================"
echo "STEP 2: FIX CERTBOT ZOPE MODULE"
echo "========================================"

echo "[$SCRIPT_INDEX] Checking certbot installation..."

if command -v certbot >/dev/null 2>&1; then
    echo "[$SCRIPT_INDEX] Certbot is installed: $(which certbot)"

    # Test if zope module is available
    if python3 -c "import zope" 2>/dev/null; then
        echo "[$SCRIPT_INDEX] [OK] Zope module is already installed"
    else
        echo "[$SCRIPT_INDEX] [WARN] Zope module is missing"
        echo ""
        read -p "[$SCRIPT_INDEX] Install zope module? (y/N): " -n 1 -r
        echo ""

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "[$SCRIPT_INDEX] Installing zope interface..."

            # Try different installation methods
            if $USE_SUDO pip3 install zope.interface 2>/dev/null; then
                echo "[$SCRIPT_INDEX] [OK] Installed via pip3"
            elif $USE_SUDO pip install zope.interface 2>/dev/null; then
                echo "[$SCRIPT_INDEX] [OK] Installed via pip"
            elif $USE_SUDO apt-get install -y python3-zope.interface 2>/dev/null; then
                echo "[$SCRIPT_INDEX] [OK] Installed via apt-get"
            else
                echo "[$SCRIPT_INDEX] [ERROR] Failed to install zope module"
                echo "[$SCRIPT_INDEX] Please install manually:"
                echo "[$SCRIPT_INDEX]   sudo pip3 install zope.interface"
                echo "[$SCRIPT_INDEX]   or: sudo apt-get install python3-zope.interface"
            fi

            # Verify installation
            if python3 -c "import zope" 2>/dev/null; then
                echo "[$SCRIPT_INDEX] [OK] Zope module verification successful"
            else
                echo "[$SCRIPT_INDEX] [ERROR] Zope module still not available"
            fi
        fi
    fi

    # Check certbot-dns-dnspod plugin
    echo ""
    echo "[$SCRIPT_INDEX] Checking certbot-dns-dnspod plugin..."
    if pip3 list 2>/dev/null | grep -q certbot-dns-dnspod; then
        echo "[$SCRIPT_INDEX] [OK] certbot-dns-dnspod is installed"
        echo "[$SCRIPT_INDEX] Version: $(pip3 show certbot-dns-dnspod 2>/dev/null | grep Version)"
    else
        echo "[$SCRIPT_INDEX] [WARN] certbot-dns-dnspod is NOT installed"
        echo "[$SCRIPT_INDEX] Without this plugin, only self-signed certificates will be generated"
        echo ""
        read -p "[$SCRIPT_INDEX] Install certbot-dns-dnspod? (y/N): " -n 1 -r
        echo ""

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "[$SCRIPT_INDEX] Installing certbot-dns-dnspod..."
            $USE_SUDO pip3 install certbot-dns-dnspod

            if pip3 list 2>/dev/null | grep -q certbot-dns-dnspod; then
                echo "[$SCRIPT_INDEX] [OK] certbot-dns-dnspod installed successfully"
            else
                echo "[$SCRIPT_INDEX] [ERROR] Failed to install certbot-dns-dnspod"
            fi
        fi
    fi
else
    echo "[$SCRIPT_INDEX] [ERROR] Certbot is not installed"
    echo "[$SCRIPT_INDEX] Please install certbot first"
fi

echo ""

# Step 3: Clean up symlinks
echo "========================================"
echo "STEP 3: CLEAN UP CONFLICTING SYMLINKS"
echo "========================================"

if [ -d "$sites_enabled_dir" ]; then
    symlink_count=$(find "$sites_enabled_dir" -type l 2>/dev/null | wc -l)
    echo "[$SCRIPT_INDEX] Found $symlink_count symlinks in sites-enabled"

    if [ "$symlink_count" -gt 0 ]; then
        echo ""
        echo "[$SCRIPT_INDEX] Existing symlinks:"
        ls -1 "$sites_enabled_dir" | head -20

        echo ""
        read -p "[$SCRIPT_INDEX] Remove all symlinks to allow clean setup? (y/N): " -n 1 -r
        echo ""

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "[$SCRIPT_INDEX] Removing symlinks..."

            removed=0
            for link in "$sites_enabled_dir"/*; do
                if [ -L "$link" ]; then
                    if $USE_SUDO rm -f "$link" 2>/dev/null; then
                        ((removed++))
                        echo "[$SCRIPT_INDEX]   Removed: $(basename "$link")"
                    fi
                fi
            done

            echo "[$SCRIPT_INDEX] [OK] Removed $removed symlinks"
        else
            echo "[$SCRIPT_INDEX] Keeping existing symlinks"
        fi
    else
        echo "[$SCRIPT_INDEX] [OK] No symlinks to clean up"
    fi
else
    echo "[$SCRIPT_INDEX] [ERROR] Sites-enabled directory not found: $sites_enabled_dir"
fi

echo ""

# Step 4: Summary and next steps
echo "========================================"
echo "STEP 4: SUMMARY AND NEXT STEPS"
echo "========================================"

echo ""
echo "[$SCRIPT_INDEX] Fix process completed!"
echo ""
echo "[$SCRIPT_INDEX] Next steps:"
echo "[$SCRIPT_INDEX]   1. Verify Laravel code is updated:"
echo "[$SCRIPT_INDEX]      cd $CORE_NODE_DIR"
echo "[$SCRIPT_INDEX]      git log --oneline -5"
echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX]   2. Re-run domain setup script:"
echo "[$SCRIPT_INDEX]      bash $CORE_NODE_DIR/scripts/shells/linux/debian/install_shells/130_setup_domains.sh"
echo "[$SCRIPT_INDEX]"
echo "[$SCRIPT_INDEX]   3. Check diagnostics output for any remaining issues"
echo ""
echo "========================================"
