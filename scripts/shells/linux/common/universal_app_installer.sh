#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Universal Application Installer
# Supports multiple installation methods: apt, snap, flatpak, web, npm, pipx, uv_tool, curl
# Uses unified package IDs and creates launch scripts automatically

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script identification
SCRIPT_INDEX="[UNIVERSAL_INSTALLER]"

# Source required files
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_CURRENT_DIR/gvar_common.sh"
source "$SCRIPT_CURRENT_DIR/linux_applications_list.sh"

# Installation method handlers
install_via_apt() {
    local package_id="$1"
    local app_name="$2"
    
    echo -e "${BLUE}$SCRIPT_INDEX Installing $app_name via APT: $package_id${NC}"
    
    # Update package list
    $USE_SUDO apt update
    
    # Install package
    if $USE_SUDO apt install -y "$package_id"; then
        echo -e "${GREEN}$SCRIPT_INDEX Successfully installed $app_name via APT${NC}"
        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX Failed to install $app_name via APT${NC}"
        return 1
    fi
}

install_via_snap() {
    local package_id="$1"
    local app_name="$2"
    
    echo -e "${BLUE}$SCRIPT_INDEX Installing $app_name via SNAP: $package_id${NC}"
    
    # Check if snapd is installed
    if ! command -v snap >/dev/null 2>&1; then
        echo -e "${YELLOW}$SCRIPT_INDEX Installing snapd first...${NC}"
        $USE_SUDO apt update
        $USE_SUDO apt install -y snapd
    fi
    
    # Install snap package
    if $USE_SUDO snap install "$package_id"; then
        echo -e "${GREEN}$SCRIPT_INDEX Successfully installed $app_name via SNAP${NC}"
        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX Failed to install $app_name via SNAP${NC}"
        return 1
    fi
}

install_via_flatpak() {
    local package_id="$1"
    local app_name="$2"
    
    echo -e "${BLUE}$SCRIPT_INDEX Installing $app_name via FLATPAK: $package_id${NC}"
    
    # Check if flatpak is installed
    if ! command -v flatpak >/dev/null 2>&1; then
        echo -e "${YELLOW}$SCRIPT_INDEX Installing flatpak first...${NC}"
        $USE_SUDO apt update
        $USE_SUDO apt install -y flatpak
        $USE_SUDO flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
    fi
    
    # Install flatpak package
    if $USE_SUDO flatpak install -y flathub "$package_id"; then
        echo -e "${GREEN}$SCRIPT_INDEX Successfully installed $app_name via FLATPAK${NC}"
        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX Failed to install $app_name via FLATPAK${NC}"
        return 1
    fi
}

install_via_web() {
    local package_id="$1"
    local app_name="$2"
    
    echo -e "${BLUE}$SCRIPT_INDEX Installing $app_name via WEB download: $package_id${NC}"
    
    # Create temporary directory
    local temp_dir="/tmp/${app_name}_install"
    mkdir -p "$temp_dir"
    cd "$temp_dir"
    
    # Download the package
    if wget -O "${app_name}.deb" "$package_id"; then
        echo -e "${GREEN}$SCRIPT_INDEX Downloaded $app_name package${NC}"
        
        # Install the .deb package
        if $USE_SUDO dpkg -i "${app_name}.deb"; then
            echo -e "${GREEN}$SCRIPT_INDEX Successfully installed $app_name via WEB${NC}"
            # Fix any dependency issues
            $USE_SUDO apt-get install -f -y
            cd - && rm -rf "$temp_dir"
            return 0
        else
            echo -e "${RED}$SCRIPT_INDEX Failed to install $app_name .deb package${NC}"
            cd - && rm -rf "$temp_dir"
            return 1
        fi
    else
        echo -e "${RED}$SCRIPT_INDEX Failed to download $app_name from $package_id${NC}"
        cd - && rm -rf "$temp_dir"
        return 1
    fi
}

install_via_npm() {
    local package_id="$1"
    local app_name="$2"
    
    echo -e "${BLUE}$SCRIPT_INDEX Installing $app_name via NPM: $package_id${NC}"
    
    # Check if npm is installed
    if ! command -v npm >/dev/null 2>&1; then
        echo -e "${YELLOW}$SCRIPT_INDEX Installing Node.js and npm first...${NC}"
        $USE_SUDO apt update
        $USE_SUDO apt install -y nodejs npm
    fi
    
    # Install npm package globally
    if $USE_SUDO npm install -g "$package_id"; then
        echo -e "${GREEN}$SCRIPT_INDEX Successfully installed $app_name via NPM${NC}"
        
        # Fix permissions for npm global binaries
        echo -e "${BLUE}$SCRIPT_INDEX Setting executable permissions for npm global binaries...${NC}"
        local npm_global_bin
        npm_global_bin=$($USE_SUDO npm config get prefix 2>/dev/null)
        if [ -n "$npm_global_bin" ] && [ -d "$npm_global_bin/bin" ]; then
            # Set executable permissions for all binaries in npm global bin directory
            $USE_SUDO find "$npm_global_bin/bin" -type f -name "*" -exec chmod +x {} \; 2>/dev/null || true
            echo -e "${GREEN}$SCRIPT_INDEX Set executable permissions for binaries in: $npm_global_bin/bin${NC}"
            
            # Also check for the specific package binary
            local package_name=$(echo "$package_id" | sed 's/.*\///' | sed 's/@.*//')
            local binary_path="$npm_global_bin/bin/$package_name"
            if [ -f "$binary_path" ]; then
                $USE_SUDO chmod +x "$binary_path"
                echo -e "${GREEN}$SCRIPT_INDEX Set executable permission for: $binary_path${NC}"
            fi
        else
            echo -e "${YELLOW}$SCRIPT_INDEX Warning: Could not determine npm global bin directory${NC}"
        fi
        
        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX Failed to install $app_name via NPM${NC}"
        return 1
    fi
}

install_via_pipx() {
    local package_id="$1"
    local app_name="$2"
    
    echo -e "${BLUE}$SCRIPT_INDEX Installing $app_name via PIPX: $package_id${NC}"
    
    # Check if pipx is installed
    if ! command -v pipx >/dev/null 2>&1; then
        echo -e "${YELLOW}$SCRIPT_INDEX Installing pipx first...${NC}"
        $USE_SUDO apt update
        $USE_SUDO apt install -y python3-pip
        $USE_SUDO pip3 install pipx
        $USE_SUDO pipx ensurepath
    fi
    
    # Install pipx package
    if $USE_SUDO pipx install "$package_id"; then
        echo -e "${GREEN}$SCRIPT_INDEX Successfully installed $app_name via PIPX${NC}"
        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX Failed to install $app_name via PIPX${NC}"
        return 1
    fi
}

install_via_uv_tool() {
    local package_id="$1"
    local app_name="$2"
    
    echo -e "${BLUE}$SCRIPT_INDEX Installing $app_name via UV TOOL: $package_id${NC}"
    
    # Check if uv is installed
    if ! command -v uv >/dev/null 2>&1; then
        echo -e "${YELLOW}$SCRIPT_INDEX Installing uv first...${NC}"
        curl -LsSf https://astral.sh/uv/install.sh | sh
        source ~/.bashrc
    fi
    
    # Install uv tool
    if $USE_SUDO uv tool install "$package_id"; then
        echo -e "${GREEN}$SCRIPT_INDEX Successfully installed $app_name via UV TOOL${NC}"
        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX Failed to install $app_name via UV TOOL${NC}"
        return 1
    fi
}

install_via_curl() {
    local package_id="$1"
    local app_name="$2"
    
    echo -e "${BLUE}$SCRIPT_INDEX Installing $app_name via CURL: $package_id${NC}"
    
    # Download and execute install script
    if curl -fsSL "$package_id" | $USE_SUDO bash; then
        echo -e "${GREEN}$SCRIPT_INDEX Successfully installed $app_name via CURL${NC}"
        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX Failed to install $app_name via CURL${NC}"
        return 1
    fi
}

# Main installation function
install_application() {
    local app_name="$1"
    
    echo -e "${CYAN}$SCRIPT_INDEX Installing application: $app_name${NC}"
    
    # Get application properties
    local package_id=$(get_package_id "$app_name")
    local install_method=$(get_install_method "$app_name")
    local app_display_name=$(get_app_property "$app_name" "name")
    
    # Skip if no package ID or install method
    if [ -z "$package_id" ] || [ -z "$install_method" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Skipping $app_name - no package ID or install method${NC}"
        return 0
    fi
    
    echo -e "${BLUE}$SCRIPT_INDEX Package ID: $package_id${NC}"
    echo -e "${BLUE}$SCRIPT_INDEX Install Method: $install_method${NC}"
    
    # Install based on method
    case "$install_method" in
        "$METHOD_APT")
            install_via_apt "$package_id" "$app_display_name"
            ;;
        "$METHOD_SNAP")
            install_via_snap "$package_id" "$app_display_name"
            ;;
        "$METHOD_FLATPAK")
            install_via_flatpak "$package_id" "$app_display_name"
            ;;
        "$METHOD_WEB")
            install_via_web "$package_id" "$app_display_name"
            ;;
        "$METHOD_NPM")
            install_via_npm "$package_id" "$app_display_name"
            ;;
        "$METHOD_PIPX")
            install_via_pipx "$package_id" "$app_display_name"
            ;;
        "$METHOD_UV_TOOL")
            install_via_uv_tool "$package_id" "$app_display_name"
            ;;
        "$METHOD_CURL")
            install_via_curl "$package_id" "$app_display_name"
            ;;
        *)
            echo -e "${RED}$SCRIPT_INDEX Unknown install method: $install_method${NC}"
            return 1
            ;;
    esac
    
    local install_result=$?
    
    # Create launch script if installation was successful
    if [ $install_result -eq 0 ]; then
        create_launch_script "$app_name"
        echo -e "${GREEN}$SCRIPT_INDEX Installation of $app_name completed successfully${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX Installation of $app_name failed${NC}"
    fi
    
    return $install_result
}

# Export functions
export -f install_application install_via_apt install_via_snap install_via_flatpak
export -f install_via_web install_via_npm install_via_pipx install_via_uv_tool install_via_curl
