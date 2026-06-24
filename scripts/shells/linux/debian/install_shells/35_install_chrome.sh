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

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="35"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/desktop_shortcut_manager.sh"
source "$PARENT_DIR_LEVEL_2/common/app_resource_limit.sh"

# Declare variables
INSTALL_CHROME=$(get_var "INSTALL_CHROME")
INSTALL_MODE=$(get_var "INSTALL_MODE")
CHROME_INSTALL_METHOD=$(get_var "CHROME_INSTALL_METHOD" "apt")  # Default to apt (direct .deb download)
CHROME_DOWNLOAD_URL="https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb"
CHROME_INSTALL_DIR=""
CHROME_BIN_PATH=""
CHROME_VERSION=""
CHROME_DESKTOP_FILE=""
CHROME_SHORTCUT_CREATED=false
SYS_ARCH=""

# Run all apt/dpkg steps unattended so an idempotent/headless re-run never blocks
# on a debconf or conffile prompt.
export DEBIAN_FRONTEND=noninteractive

echo "[$SCRIPT_INDEX] Google Chrome Installation Script"
echo "[$SCRIPT_INDEX] INSTALL_CHROME: $INSTALL_CHROME, INSTALL_MODE: $INSTALL_MODE, METHOD: $CHROME_INSTALL_METHOD"

# Remove any existing Chrome repository files (we use direct .deb download)
echo "[$SCRIPT_INDEX] Cleaning up any existing Chrome repository files..."
if [ -f "/etc/apt/sources.list.d/google-chrome.list" ]; then
    echo "[$SCRIPT_INDEX] Removing Chrome repository: /etc/apt/sources.list.d/google-chrome.list"
    $USE_SUDO rm -f /etc/apt/sources.list.d/google-chrome.list
fi
if [ -f "/etc/apt/trusted.gpg.d/google-chrome.gpg" ]; then
    echo "[$SCRIPT_INDEX] Removing Chrome GPG key: /etc/apt/trusted.gpg.d/google-chrome.gpg"
    $USE_SUDO rm -f /etc/apt/trusted.gpg.d/google-chrome.gpg
fi

# Function to determine optimal Chrome installation directory
get_chrome_install_directory() {
    # Use map_web_path for consistent directory mapping
    CHROME_INSTALL_DIR=$(map_web_path "compile_dir" "applications/chrome")
    echo "[$SCRIPT_INDEX] Chrome installation directory: $CHROME_INSTALL_DIR"
}

# Function to check if real GOOGLE CHROME is already installed.
# Chromium is NOT Google Chrome and is NEVER accepted here: this installer wants
# real Chrome and must not be satisfied (nor rolled back to) by a Chromium binary.
check_chrome_installation() {
    local chrome_paths=(
        "/usr/bin/google-chrome"
        "/usr/bin/google-chrome-stable"
        "/opt/google/chrome/chrome"
        "/var/lib/flatpak/exports/bin/com.google.Chrome"
        "$CHROME_INSTALL_DIR/chrome"
    )

    local chrome_path
    for chrome_path in "${chrome_paths[@]}"; do
        if [ -f "$chrome_path" ] && [ -x "$chrome_path" ]; then
            CHROME_BIN_PATH="$chrome_path"
            CHROME_VERSION=$($chrome_path --version 2>/dev/null || echo "unknown")
            echo "[$SCRIPT_INDEX] Google Chrome found at: $chrome_path (version: $CHROME_VERSION)"
            return 0
        fi
    done

    return 1
}

# Function to remove Chromium across every packaging system. Google Chrome is the
# chosen browser, so Chromium must not coexist with it. Fully idempotent: it acts
# only when Chromium is present and every step is best-effort (no rollback).
remove_chromium() {
    if ! command -v chromium >/dev/null 2>&1 \
        && ! command -v chromium-browser >/dev/null 2>&1 \
        && ! { command -v snap >/dev/null 2>&1 && snap list chromium >/dev/null 2>&1; } \
        && ! { command -v flatpak >/dev/null 2>&1 && flatpak info org.chromium.Chromium >/dev/null 2>&1; }; then
        echo "[$SCRIPT_INDEX] Chromium not present, nothing to remove"
        return 0
    fi

    echo "[$SCRIPT_INDEX] Removing Chromium (Google Chrome must not coexist with it)..."
    $USE_SUDO apt-get remove -y chromium chromium-browser chromium-common chromium-sandbox chromium-driver 2>/dev/null || true
    $USE_SUDO apt-get purge -y chromium chromium-browser chromium-common chromium-sandbox chromium-driver 2>/dev/null || true
    $USE_SUDO apt-get autoremove -y 2>/dev/null || true
    if command -v snap >/dev/null 2>&1; then
        $USE_SUDO snap remove chromium 2>/dev/null || true
    fi
    if command -v flatpak >/dev/null 2>&1; then
        $USE_SUDO flatpak uninstall -y org.chromium.Chromium 2>/dev/null || true
    fi
    echo "[$SCRIPT_INDEX] Chromium removal completed"
}

# Function removed: verify_chrome_repo_for_install
# We no longer use third-party repositories - direct .deb download instead

# Function to install Chrome via APT (using .deb package from Downloads or direct download)
install_chrome_apt() {
    echo "[$SCRIPT_INDEX] Installing Chrome via APT package manager..."

    # Try to find Chrome .deb in Downloads directories first
    echo "[$SCRIPT_INDEX] Searching for Chrome .deb in Downloads directories..."
    local chrome_deb=$(find_file_in_downloads_from_common_functions "google-chrome-stable*.deb" "newest")

    if [[ -z "$chrome_deb" ]]; then
        echo "[$SCRIPT_INDEX] No Chrome .deb found in Downloads, downloading automatically..."

        # Detect actual user and use their Downloads directory
        if [ -z "$ACTUAL_DESKTOP_USER_HOME" ]; then
            detect_actual_desktop_user
        fi

        local downloads_dir
        if [ -n "$ACTUAL_DESKTOP_USER_HOME" ] && [ -d "$ACTUAL_DESKTOP_USER_HOME" ]; then
            downloads_dir="$ACTUAL_DESKTOP_USER_HOME/Downloads"
            echo "[$SCRIPT_INDEX] Using actual user's Downloads directory: $downloads_dir"
            mkdir -p "$downloads_dir" 2>/dev/null || {
                echo "[$SCRIPT_INDEX] Warning: Cannot create Downloads directory, using /tmp"
                downloads_dir="/tmp"
            }
        else
            echo "[$SCRIPT_INDEX] Warning: Cannot detect actual user, using /tmp"
            downloads_dir="/tmp"
        fi

        local download_target="$downloads_dir/google-chrome-stable_current_amd64.deb"

        echo "[$SCRIPT_INDEX] Download target: $download_target"
        echo "[$SCRIPT_INDEX] Download URL: $CHROME_DOWNLOAD_URL"

        # Try automatic download with progress bar
        if wget --show-progress --progress=bar:force -O "$download_target" "$CHROME_DOWNLOAD_URL"; then
            if [ -f "$download_target" ] && [ -s "$download_target" ]; then
                chrome_deb="$download_target"
                echo "[$SCRIPT_INDEX] Chrome package downloaded successfully"
                echo "[$SCRIPT_INDEX] Package saved to: $chrome_deb"
                echo "[$SCRIPT_INDEX] (Package will be preserved for future installations)"
            else
                echo "[$SCRIPT_INDEX] Download completed but file is empty or missing"
                rm -f "$download_target"
                chrome_deb=""
            fi
        else
            echo "[$SCRIPT_INDEX] Automatic download failed"
            rm -f "$download_target"
            chrome_deb=""
        fi

        # If download failed, prompt user to download manually
        if [[ -z "$chrome_deb" ]]; then
            echo "[$SCRIPT_INDEX] Please download manually from: https://www.google.com/chrome/"

            chrome_deb=$(prompt_and_wait_for_download_from_common_functions \
                "https://www.google.com/chrome/" \
                "google-chrome-stable*.deb" \
                0)

            if [[ -z "$chrome_deb" ]]; then
                echo "[$SCRIPT_INDEX] Failed to obtain Chrome package"
                return 1
            fi
        fi
    else
        echo "[$SCRIPT_INDEX] Found Chrome .deb: $chrome_deb"
    fi

    # Install the package
    echo "[$SCRIPT_INDEX] Installing Chrome from: $chrome_deb"
    if $USE_SUDO dpkg -i "$chrome_deb" 2>&1 | tee /tmp/chrome_install.log; then
        echo "[$SCRIPT_INDEX] Google Chrome installed successfully"
    else
        echo "[$SCRIPT_INDEX] dpkg installation had issues, fixing dependencies..."
        $USE_SUDO apt-get install -f -y

        # Verify installation after fix
        if ! command -v google-chrome &> /dev/null; then
            echo "[$SCRIPT_INDEX] Error: Failed to install Google Chrome"
            cat /tmp/chrome_install.log 2>/dev/null
            return 1
        fi
    fi

    # Note: Do NOT delete the downloaded .deb file - keep it for future use

    # Verify installation
    if command -v google-chrome &> /dev/null; then
        CHROME_BIN_PATH=$(which google-chrome)
        CHROME_VERSION=$(google-chrome --version 2>/dev/null || echo "unknown")
        echo "[$SCRIPT_INDEX] Chrome installed successfully"
        return 0
    else
        echo "[$SCRIPT_INDEX] Failed to install Chrome"
        return 1
    fi
}

# Function to install Chrome via Flatpak
install_chrome_flatpak() {
    echo "[$SCRIPT_INDEX] Installing Chrome via Flatpak package manager..."
    
    # Check if flatpak is available
    if ! command -v flatpak &> /dev/null; then
        echo "[$SCRIPT_INDEX] Flatpak not available, installing flatpak..."
        $USE_SUDO apt update
        $USE_SUDO apt install -y flatpak
    fi
    
    # Add flathub repository
    $USE_SUDO flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
    
    # Install Chrome via flatpak
    $USE_SUDO flatpak install -y flathub com.google.Chrome
    
    # Verify installation
    if flatpak list | grep -q "com.google.Chrome"; then
        CHROME_BIN_PATH="/var/lib/flatpak/exports/bin/com.google.Chrome"
        CHROME_VERSION=$(flatpak run com.google.Chrome --version 2>/dev/null || echo "unknown")
        echo "[$SCRIPT_INDEX] Chrome installed successfully via Flatpak"
        return 0
    else
        echo "[$SCRIPT_INDEX] Failed to install Chrome via Flatpak"
        return 1
    fi
}

# Function to install Chrome via direct download
install_chrome_direct() {
    echo "[$SCRIPT_INDEX] Installing Chrome via direct download..."
    
    # Create installation directory
    $USE_SUDO mkdir -p "$CHROME_INSTALL_DIR"
    
    # Download Chrome package
    local chrome_package="/tmp/google-chrome-stable_current_amd64.deb"
    echo "[$SCRIPT_INDEX] Downloading Chrome package..."
    wget -q -O "$chrome_package" "https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb"
    
    if [ $? -eq 0 ]; then
        # Install the package
        $USE_SUDO dpkg -i "$chrome_package"
        
        # Fix any dependency issues
        $USE_SUDO apt-get install -f -y
        
        # Clean up
        rm -f "$chrome_package"
        
        # Verify installation
        if command -v google-chrome &> /dev/null; then
            CHROME_BIN_PATH=$(which google-chrome)
            CHROME_VERSION=$(google-chrome --version 2>/dev/null || echo "unknown")
            echo "[$SCRIPT_INDEX] Chrome installed successfully via direct download"
            return 0
        fi
    fi
    
    echo "[$SCRIPT_INDEX] Failed to install Chrome via direct download"
    return 1
}

# Function to create desktop shortcut
create_desktop_shortcut() {
    if [ "$HAS_DESKTOP_ENVIRONMENT" = false ]; then
        echo "[$SCRIPT_INDEX] No desktop environment detected, skipping shortcut creation"
        return 0
    fi
    
    if [ -z "$CHROME_BIN_PATH" ] || [ ! -f "$CHROME_BIN_PATH" ]; then
        echo "[$SCRIPT_INDEX] Chrome binary not found, cannot create shortcut"
        return 1
    fi
    
    echo "[$SCRIPT_INDEX] Creating desktop shortcut for Chrome..."

    # System-wide menu entry (covers all users / all desktop environments) plus a
    # desktop icon for every user, via the shared shortcut manager.
    CHROME_DESKTOP_FILE="/usr/share/applications/google-chrome.desktop"

    create_desktop_shortcut_from_desktop_shortcut_manager \
        --id google-chrome \
        --name "Google Chrome" \
        --exec "$CHROME_BIN_PATH %U" \
        --icon google-chrome \
        --comment "Access the Internet" \
        --categories "Network;WebBrowser;" \
        --startup-wmclass "Google-chrome" \
        --mimetype "text/html;text/xml;application/xhtml+xml;application/vnd.mozilla.xul+xml;text/mml;x-scheme-handler/http;x-scheme-handler/https;x-scheme-handler/ftp;x-scheme-handler/chrome;application/x-extension-htm;application/x-extension-html;application/x-extension-shtml;application/xhtml+xml;application/xml;text/plain;" \
        --extra "StartupNotify=true" \
        --desktop all

    CHROME_SHORTCUT_CREATED=true
    echo "[$SCRIPT_INDEX] Desktop shortcut created successfully"

    # Resource limit: cap the whole Chrome process tree in one cgroup-v2 user scope
    # and repoint the menu/desktop Exec (id=google-chrome) at the wrapper. Chrome is
    # PINNED to MemoryMax=2G (override) -- more headroom than the 1G default -- while the
    # shared 20% ceiling and 10%*nproc CPU still come from app_resource_limit.sh.
    # Idempotent (never double-wraps).
    APP_MEM_CAP_MB=2048 apply_app_resource_limit \
        --id google-chrome --exec "$CHROME_BIN_PATH" \
        --desktop all --field "%U"
}

# Function to create symlink in /usr/local/bin
create_system_symlink() {
    if [ -z "$CHROME_BIN_PATH" ] || [ ! -f "$CHROME_BIN_PATH" ]; then
        echo "[$SCRIPT_INDEX] Chrome binary not found, cannot create symlink"
        return 1
    fi
    
    local symlink_path="/usr/local/bin/google-chrome"
    
    if [ ! -L "$symlink_path" ]; then
        $USE_SUDO ln -sf "$CHROME_BIN_PATH" "$symlink_path"
        echo "[$SCRIPT_INDEX] Created system symlink: $symlink_path -> $CHROME_BIN_PATH"
    else
        echo "[$SCRIPT_INDEX] System symlink already exists: $symlink_path"
    fi
}

# Function to store Chrome information in global variables
store_chrome_info() {
    if [ -n "$CHROME_BIN_PATH" ]; then
        set_var "CHROME_BIN" "$CHROME_BIN_PATH"
        set_var "CHROME_VERSION" "$CHROME_VERSION"
        set_var "CHROME_INSTALL_DIR" "$CHROME_INSTALL_DIR"
        set_var "CHROME_DESKTOP_FILE" "$CHROME_DESKTOP_FILE"
        set_var "CHROME_SHORTCUT_CREATED" "$CHROME_SHORTCUT_CREATED"
        echo "[$SCRIPT_INDEX] Chrome information stored in global variables"
    fi
}

# Function to kill hanging Chrome processes.
# CRITICAL: never match by full command line. This script's own path contains
# "chrome" (35_install_chrome.sh), so `pkill -f chrome` would kill the running
# script and its parent shell (SIGTERM -> exit 143). Match the browser executable
# NAME only (pgrep without -f), and always exclude our own process tree.
kill_chrome_processes() {
    local self_pid=$$
    local parent_pid=$PPID
    local all_pids pid kill_pids count

    all_pids=$(pgrep "chrome|chromium" 2>/dev/null || true)
    kill_pids=""
    for pid in $all_pids; do
        if [ "$pid" != "$self_pid" ] && [ "$pid" != "$parent_pid" ]; then
            kill_pids="$kill_pids $pid"
        fi
    done

    count=$(echo $kill_pids | wc -w | tr -d ' ')
    if [ "$count" -gt 3 ]; then
        echo "[$SCRIPT_INDEX] Found $count Chrome process(es), cleaning up..."
        $USE_SUDO kill $kill_pids 2>/dev/null || true
        echo "[$SCRIPT_INDEX] Chrome processes have been terminated"
    elif [ "$count" -gt 0 ]; then
        echo "[$SCRIPT_INDEX] Found $count Chrome process(es), normal range"
    fi
}

# Main installation logic
# No longer need to check repository status as we download .deb directly

if [ "$INSTALL_CHROME" = "false" ]; then
    echo "[$SCRIPT_INDEX] INSTALL_CHROME is false - Chrome should be removed"
    echo "[$SCRIPT_INDEX] Checking if Chrome is still installed..."
    
    # Check if Chrome is still installed
    if check_chrome_installation; then
        echo "[$SCRIPT_INDEX] Chrome is still installed, removing..."
        $USE_SUDO apt-get remove -y google-chrome-stable 2>/dev/null || true
        $USE_SUDO apt-get purge -y google-chrome-stable 2>/dev/null || true
        $USE_SUDO flatpak uninstall -y com.google.Chrome 2>/dev/null || true
        echo "[$SCRIPT_INDEX] Chrome removed successfully"
    else
        echo "[$SCRIPT_INDEX] Chrome is not installed"
    fi

    # Remove Chromium too, whether or not real Chrome was present (idempotent:
    # no-op when Chromium is absent). check_chrome_installation matches only real
    # Chrome, so a Chromium-only box must still be cleaned here.
    remove_chromium
    
    # Clean up any remaining Chrome-related files
    $USE_SUDO rm -f "/usr/local/bin/google-chrome" 2>/dev/null || true
    remove_desktop_shortcut_from_desktop_shortcut_manager --id google-chrome --menu --desktop all
    
    # Clear stored variables
    set_var "CHROME_BIN" ""
    set_var "CHROME_VERSION" ""
    set_var "CHROME_INSTALL_DIR" ""
    set_var "CHROME_DESKTOP_FILE" ""
    set_var "CHROME_SHORTCUT_CREATED" "false"
    
    echo "[$SCRIPT_INDEX] Google Chrome cleanup completed"
    exit 0
fi

# Google Chrome for Linux ships for amd64/x86_64 only. Per policy we do NOT
# substitute Chromium, so on any other architecture there is nothing to install:
# skip cleanly (idempotent) instead of rolling back to Chromium.
SYS_ARCH=$(dpkg --print-architecture 2>/dev/null || uname -m)
if [ "$SYS_ARCH" != "amd64" ] && [ "$SYS_ARCH" != "x86_64" ]; then
    echo "[$SCRIPT_INDEX] Google Chrome is unavailable for architecture '$SYS_ARCH'; skipping (Chromium is not used as a substitute)."
    exit 0
fi

# Determine installation directory
get_chrome_install_directory

# Kill hanging processes if any
kill_chrome_processes

# Check if Chrome is already installed
if check_chrome_installation; then
    echo "[$SCRIPT_INDEX] Chrome browser is already installed"
    echo "[$SCRIPT_INDEX] Verifying and repairing installation if needed..."

    # Always ensure symlink and shortcut are correct (repair if needed)
    echo "[$SCRIPT_INDEX] Ensuring system symlink is correct..."
    create_system_symlink

    echo "[$SCRIPT_INDEX] Ensuring desktop shortcut is correct..."
    create_desktop_shortcut

    # Update stored information
    echo "[$SCRIPT_INDEX] Updating stored information..."
    store_chrome_info

    echo "[$SCRIPT_INDEX] Installation verification and repair completed"
else
    echo "[$SCRIPT_INDEX] Chrome browser not found, proceeding with installation..."
    
    # Try installation methods in order of preference
    installation_success=false
    
    case "$CHROME_INSTALL_METHOD" in
        "apt")
            if install_chrome_apt; then
                installation_success=true
            fi
            ;;
        "flatpak")
            if install_chrome_flatpak; then
                installation_success=true
            fi
            ;;
        "direct")
            if install_chrome_direct; then
                installation_success=true
            fi
            ;;
        "auto")
            # REAL Google Chrome only (apt/direct .deb, then the Chrome flatpak).
            # No Chromium fallback: this installer never rolls back to Chromium.
            if install_chrome_apt; then
                installation_success=true
            elif install_chrome_direct; then
                installation_success=true
            elif install_chrome_flatpak; then
                installation_success=true
            fi
            ;;
        *)
            echo "[$SCRIPT_INDEX] Unknown installation method: $CHROME_INSTALL_METHOD"
            echo "[$SCRIPT_INDEX] Falling back to auto mode (real Chrome only, no Chromium)..."
            if install_chrome_apt; then
                installation_success=true
            elif install_chrome_direct; then
                installation_success=true
            elif install_chrome_flatpak; then
                installation_success=true
            fi
            ;;
    esac
    
    if [ "$installation_success" = true ]; then
        echo "[$SCRIPT_INDEX] Chrome installation completed successfully"
        
        # Create symlink and shortcut
        create_system_symlink
        create_desktop_shortcut
        
        # Store information
        store_chrome_info
    else
        echo "[$SCRIPT_INDEX] Error: Failed to install Chrome using any method"
        exit 1
    fi
fi

# Real Google Chrome is now installed (the only way to reach this point). Remove
# Chromium if it is present so Chrome does not coexist with it. Idempotent.
remove_chromium

# Final status check
echo "[$SCRIPT_INDEX] ==============================="
echo "[$SCRIPT_INDEX] Chrome Browser Status:"
echo "[$SCRIPT_INDEX] ==============================="

if check_chrome_installation; then
    echo "[$SCRIPT_INDEX] Chrome is installed and working"
    echo "[$SCRIPT_INDEX] Binary path: $CHROME_BIN_PATH"
    echo "[$SCRIPT_INDEX] Version: $CHROME_VERSION"
else
    echo "[$SCRIPT_INDEX] Chrome installation failed"
fi

# Check running processes
CHROME_PROCESSES_COUNT=$(ps aux | grep -i "chrome\|chromium" | grep -v grep | wc -l | tr -d '\n')
if [ -n "$CHROME_PROCESSES_COUNT" ] && [ "$CHROME_PROCESSES_COUNT" -gt 0 ]; then
    echo "[$SCRIPT_INDEX] Found $CHROME_PROCESSES_COUNT Chrome processes running"
else
    echo "[$SCRIPT_INDEX] No Chrome processes running"
fi

# Display stored variables
CHROME_BIN_VAR=$(get_var "CHROME_BIN" 2>/dev/null || echo "not set")
CHROME_VERSION_VAR=$(get_var "CHROME_VERSION" 2>/dev/null || echo "not set")
CHROME_INSTALL_DIR_VAR=$(get_var "CHROME_INSTALL_DIR" 2>/dev/null || echo "not set")
CHROME_DESKTOP_FILE_VAR=$(get_var "CHROME_DESKTOP_FILE" 2>/dev/null || echo "not set")
CHROME_SHORTCUT_CREATED_VAR=$(get_var "CHROME_SHORTCUT_CREATED" 2>/dev/null || echo "not set")

echo "[$SCRIPT_INDEX] Stored variables:"
echo "[$SCRIPT_INDEX]   CHROME_BIN: $CHROME_BIN_VAR"
echo "[$SCRIPT_INDEX]   CHROME_VERSION: $CHROME_VERSION_VAR"
echo "[$SCRIPT_INDEX]   CHROME_INSTALL_DIR: $CHROME_INSTALL_DIR_VAR"
echo "[$SCRIPT_INDEX]   CHROME_DESKTOP_FILE: $CHROME_DESKTOP_FILE_VAR"
echo "[$SCRIPT_INDEX]   CHROME_SHORTCUT_CREATED: $CHROME_SHORTCUT_CREATED_VAR"
echo "[$SCRIPT_INDEX] ==============================="
