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
SCRIPT_INDEX="32"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Source repository manager
source "$PARENT_DIR_LEVEL_1/debian_com/repository_manager.sh"

# Declare variables
INSTALL_CHROME=$(get_var "INSTALL_CHROME")
INSTALL_MODE=$(get_var "INSTALL_MODE")
CHROME_INSTALL_METHOD=$(get_var "CHROME_INSTALL_METHOD" "apt")
CHROME_INSTALL_DIR=""
CHROME_BIN_PATH=""
CHROME_VERSION=""
CHROME_DESKTOP_FILE=""
CHROME_SHORTCUT_CREATED=false

echo "[$SCRIPT_INDEX] Google Chrome Installation Script"
echo "[$SCRIPT_INDEX] INSTALL_CHROME: $INSTALL_CHROME, INSTALL_MODE: $INSTALL_MODE, METHOD: $CHROME_INSTALL_METHOD"

# Function to determine optimal Chrome installation directory
get_chrome_install_directory() {
    local base_dir=$(get_base_data_directory)
    local sys_name="${SYSTEM_NAME}"
    local sys_version=$(echo "${SYSTEM_VERSION}" | cut -d. -f1)
    
    # Use applications_dir from gvar_common.sh pattern
    if [ "$IS_WSL" = true ] || [ "$HAS_DESKTOP_ENVIRONMENT" = true ] || has_ntfs_disk 2>/dev/null; then
        # Development: base_dir/_system_version/applications/chrome
        CHROME_INSTALL_DIR="${base_dir}/_${sys_name}_${sys_version}/applications/chrome"
    else
        # Production server: /usr/.core_node/applications/chrome
        CHROME_INSTALL_DIR="/usr/.core_node/applications/chrome"
    fi
    
    echo "[$SCRIPT_INDEX] Chrome installation directory: $CHROME_INSTALL_DIR"
}

# Function to check if Chrome is already installed
check_chrome_installation() {
    local chrome_paths=(
        "/usr/bin/google-chrome"
        "/usr/bin/google-chrome-stable"
        "/usr/bin/chromium"
        "/usr/bin/chromium-browser"
        "/snap/bin/chromium"
        "/opt/google/chrome/chrome"
        "$CHROME_INSTALL_DIR/chrome"
    )
    
    for chrome_path in "${chrome_paths[@]}"; do
        if [ -f "$chrome_path" ] && [ -x "$chrome_path" ]; then
            CHROME_BIN_PATH="$chrome_path"
            CHROME_VERSION=$($chrome_path --version 2>/dev/null || echo "unknown")
            echo "[$SCRIPT_INDEX] Chrome found at: $chrome_path (version: $CHROME_VERSION)"
            return 0
        fi
    done
    
    return 1
}

# Function to install Chrome via APT
install_chrome_apt() {
    echo "[$SCRIPT_INDEX] Installing Chrome via APT package manager..."
    
    # Repository should already be added by repository manager
    echo "[$SCRIPT_INDEX] Installing Chrome from pre-configured repository..."
    
    # Update package list
    $USE_SUDO apt update
    
    # Install Chrome
    $USE_SUDO apt install -y google-chrome-stable
    
    # Verify installation
    if command -v google-chrome &> /dev/null; then
        CHROME_BIN_PATH=$(which google-chrome)
        CHROME_VERSION=$(google-chrome --version 2>/dev/null || echo "unknown")
        echo "[$SCRIPT_INDEX] Chrome installed successfully via APT"
        return 0
    else
        echo "[$SCRIPT_INDEX] Failed to install Chrome via APT"
        return 1
    fi
}

# Function to install Chrome via Snap
install_chrome_snap() {
    echo "[$SCRIPT_INDEX] Installing Chrome via Snap package manager..."
    
    # Check if snap is available
    if ! command -v snap &> /dev/null; then
        echo "[$SCRIPT_INDEX] Snap not available, installing snapd..."
        $USE_SUDO apt update
        $USE_SUDO apt install -y snapd
    fi
    
    # Install Chrome via snap
    $USE_SUDO snap install chromium
    
    # Verify installation
    if command -v chromium &> /dev/null; then
        CHROME_BIN_PATH=$(which chromium)
        CHROME_VERSION=$(chromium --version 2>/dev/null || echo "unknown")
        echo "[$SCRIPT_INDEX] Chrome installed successfully via Snap"
        return 0
    else
        echo "[$SCRIPT_INDEX] Failed to install Chrome via Snap"
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
    
    # Create desktop file
    CHROME_DESKTOP_FILE="/usr/share/applications/google-chrome.desktop"
    
    $USE_SUDO tee "$CHROME_DESKTOP_FILE" > /dev/null << EOF
[Desktop Entry]
Version=1.0
Name=Google Chrome
Comment=Access the Internet
Exec=$CHROME_BIN_PATH %U
Icon=google-chrome
Terminal=false
Type=Application
Categories=Network;WebBrowser;
MimeType=text/html;text/xml;application/xhtml+xml;application/vnd.mozilla.xul+xml;text/mml;x-scheme-handler/http;x-scheme-handler/https;x-scheme-handler/ftp;x-scheme-handler/chrome;application/x-extension-htm;application/x-extension-html;application/x-extension-shtml;application/xhtml+xml;application/xml;text/plain;
StartupNotify=true
StartupWMClass=Google-chrome
EOF
    
    # Set proper permissions
    $USE_SUDO chmod 644 "$CHROME_DESKTOP_FILE"
    
    # Create symlink in user's desktop directory if it exists
    local user_desktop="$HOME/Desktop"
    if [ -d "$user_desktop" ]; then
        ln -sf "$CHROME_DESKTOP_FILE" "$user_desktop/google-chrome.desktop"
        echo "[$SCRIPT_INDEX] Created desktop shortcut: $user_desktop/google-chrome.desktop"
    fi
    
    # Update desktop database
    if command -v update-desktop-database &> /dev/null; then
        $USE_SUDO update-desktop-database /usr/share/applications
    fi
    
    CHROME_SHORTCUT_CREATED=true
    echo "[$SCRIPT_INDEX] Desktop shortcut created successfully"
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

# Function to kill hanging Chrome processes
kill_chrome_processes() {
    local count=$(pgrep -c "chrome\|chromium" 2>/dev/null | tr -d '\n' || echo "0")
    if [ "$count" -gt 3 ]; then
        echo "[$SCRIPT_INDEX] Found $count Chrome processes, cleaning up..."
        $USE_SUDO pkill -f "chrome\|chromium" 2>/dev/null || true
        echo "[$SCRIPT_INDEX] All Chrome processes have been terminated"
    elif [ "$count" -gt 0 ]; then
        echo "[$SCRIPT_INDEX] Found $count Chrome process(es), normal range"
    fi
}

# Main installation logic
# Check repository status before proceeding (only when installing)
if [ "$INSTALL_CHROME" = "true" ]; then
    if ! verify_chrome_repo_for_install; then
        echo "[$SCRIPT_INDEX] Please run 12_update.sh first to properly manage repositories"
        exit 1
    fi
fi

if [ "$INSTALL_CHROME" = "false" ]; then
    echo "[$SCRIPT_INDEX] INSTALL_CHROME is false - Chrome should be removed"
    echo "[$SCRIPT_INDEX] Checking if Chrome is still installed..."
    
    # Check if Chrome is still installed
    if check_chrome_installation; then
        echo "[$SCRIPT_INDEX] Chrome is still installed, removing..."
        $USE_SUDO apt remove -y google-chrome-stable chromium chromium-browser 2>/dev/null || true
        $USE_SUDO apt purge -y google-chrome-stable chromium chromium-browser 2>/dev/null || true
        $USE_SUDO snap remove chromium 2>/dev/null || true
        $USE_SUDO flatpak uninstall -y com.google.Chrome 2>/dev/null || true
        echo "[$SCRIPT_INDEX] Chrome removed successfully"
    else
        echo "[$SCRIPT_INDEX] Chrome is not installed"
    fi
    
    # Clean up any remaining Chrome-related files
    $USE_SUDO rm -f "/usr/local/bin/google-chrome" 2>/dev/null || true
    $USE_SUDO rm -f "/usr/share/applications/google-chrome.desktop" 2>/dev/null || true
    rm -f "$HOME/Desktop/google-chrome.desktop" 2>/dev/null || true
    
    # Clear stored variables
    set_var "CHROME_BIN" ""
    set_var "CHROME_VERSION" ""
    set_var "CHROME_INSTALL_DIR" ""
    set_var "CHROME_DESKTOP_FILE" ""
    set_var "CHROME_SHORTCUT_CREATED" "false"
    
    echo "[$SCRIPT_INDEX] Google Chrome cleanup completed"
    exit 0
fi

# Determine installation directory
get_chrome_install_directory

# Kill hanging processes if any
kill_chrome_processes

# Check if Chrome is already installed
if check_chrome_installation; then
    echo "[$SCRIPT_INDEX] Chrome browser is already installed"
    
    # Create symlink and shortcut if needed
    create_system_symlink
    create_desktop_shortcut
    
    # Store information
    store_chrome_info
else
    echo "[$SCRIPT_INDEX] Chrome browser not found, proceeding with installation..."
    
    # Try installation methods in order of preference
    local installation_success=false
    
    case "$CHROME_INSTALL_METHOD" in
        "apt")
            if install_chrome_apt; then
                installation_success=true
            fi
            ;;
        "snap")
            if install_chrome_snap; then
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
            # Try all methods in order
            if install_chrome_apt; then
                installation_success=true
            elif install_chrome_snap; then
                installation_success=true
            elif install_chrome_flatpak; then
                installation_success=true
            elif install_chrome_direct; then
                installation_success=true
            fi
            ;;
        *)
            echo "[$SCRIPT_INDEX] Unknown installation method: $CHROME_INSTALL_METHOD"
            echo "[$SCRIPT_INDEX] Falling back to auto mode..."
            if install_chrome_apt; then
                installation_success=true
            elif install_chrome_snap; then
                installation_success=true
            elif install_chrome_flatpak; then
                installation_success=true
            elif install_chrome_direct; then
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
local chrome_processes=$(ps aux | grep -i "chrome\|chromium" | grep -v grep | wc -l | tr -d '\n')
if [ "$chrome_processes" -gt 0 ]; then
    echo "[$SCRIPT_INDEX] Found $chrome_processes Chrome processes running"
else
    echo "[$SCRIPT_INDEX] No Chrome processes running"
fi

# Display stored variables
local chrome_bin=$(get_var "CHROME_BIN" 2>/dev/null || echo "not set")
local chrome_version=$(get_var "CHROME_VERSION" 2>/dev/null || echo "not set")
local chrome_install_dir=$(get_var "CHROME_INSTALL_DIR" 2>/dev/null || echo "not set")
local chrome_desktop_file=$(get_var "CHROME_DESKTOP_FILE" 2>/dev/null || echo "not set")
local chrome_shortcut_created=$(get_var "CHROME_SHORTCUT_CREATED" 2>/dev/null || echo "not set")

echo "[$SCRIPT_INDEX] Stored variables:"
echo "[$SCRIPT_INDEX]   CHROME_BIN: $chrome_bin"
echo "[$SCRIPT_INDEX]   CHROME_VERSION: $chrome_version"
echo "[$SCRIPT_INDEX]   CHROME_INSTALL_DIR: $chrome_install_dir"
echo "[$SCRIPT_INDEX]   CHROME_DESKTOP_FILE: $chrome_desktop_file"
echo "[$SCRIPT_INDEX]   CHROME_SHORTCUT_CREATED: $chrome_shortcut_created"
echo "[$SCRIPT_INDEX] ==============================="
