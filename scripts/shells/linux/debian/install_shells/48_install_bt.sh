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

# Declare all variables at the beginning
SCRIPT_CURRENT_DIR=""
PARENT_DIR_LEVEL_1=""
PARENT_DIR_LEVEL_2=""
SCRIPT_INDEX="48"
INSTALL_BT=""
BT_UNINSTALL_URL=""
AA_PANEL_URL=""
AA_PANEL_KEY=""

# Source global variables
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Initialize variables
BT_UNINSTALL_URL="http://download.bt.cn/install/bt-uninstall.sh"
AA_PANEL_URL="https://www.aapanel.com/script/install_pro_en.sh"
AA_PANEL_KEY="aa372544"

# WARNING: INSTALL_BT is hardcoded to false - Baota Panel installation is disabled
INSTALL_BT="false"
if [ "$INSTALL_BT" != "true" ]; then
    echo "[$SCRIPT_INDEX] Skipping BT Panel installation (INSTALL_BT: $INSTALL_BT)"
    exit 0
fi

echo "[$SCRIPT_INDEX] BT Panel Installation Script"
echo "[$SCRIPT_INDEX] Description: Install or uninstall BT Panel based on configuration"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if bt command exists
check_bt_command() {
    if command_exists bt; then
        echo "[$SCRIPT_INDEX] BT command found: $(which bt)"
        return 0
    else
        echo "[$SCRIPT_INDEX] BT command not found"
        return 1
    fi
}

# Function to uninstall BT Panel
uninstall_bt_panel() {
    echo "[$SCRIPT_INDEX] Uninstalling BT Panel..."
    
    # Check if bt command exists
    if ! check_bt_command; then
        echo "[$SCRIPT_INDEX] BT command not found, cannot uninstall"
        return 1
    fi
    
    # Download uninstall script
    echo "[$SCRIPT_INDEX] Downloading BT uninstall script..."
    if wget -O bt-uninstall.sh "$BT_UNINSTALL_URL"; then
        echo "[$SCRIPT_INDEX] BT uninstall script downloaded successfully"
    else
        echo "[$SCRIPT_INDEX] Failed to download BT uninstall script"
        return 1
    fi
    
    # Make script executable
    chmod +x bt-uninstall.sh
    
    # Execute uninstall script with automatic input
    echo "[$SCRIPT_INDEX] Executing BT uninstall script..."
    echo "[$SCRIPT_INDEX] Auto-input: 1 (confirm uninstall), 2 (confirm again)"
    
    # Use expect or printf to provide input automatically
    if command_exists expect; then
        expect << EOF
spawn $USE_SUDO sh bt-uninstall.sh
expect "Are you sure you want to uninstall BT Panel? (y/n):" { send "1\r" }
expect "Are you sure you want to uninstall BT Panel? (y/n):" { send "2\r" }
expect eof
EOF
    else
        # Fallback method using printf
        printf "1\n2\n" | $USE_SUDO sh bt-uninstall.sh
    fi
    
    # Check if uninstall was successful
    if ! check_bt_command; then
        echo "[$SCRIPT_INDEX] BT Panel uninstalled successfully"
        # Clean up downloaded script
        rm -f bt-uninstall.sh
        return 0
    else
        echo "[$SCRIPT_INDEX] BT Panel uninstall may have failed"
        return 1
    fi
}

# Function to install AA Panel (aapanel)
install_aa_panel() {
    echo "[$SCRIPT_INDEX] Installing AA Panel (aapanel)..."
    
    # Download and install AA Panel
    echo "[$SCRIPT_INDEX] Downloading AA Panel installation script..."
    if command_exists curl; then
        if curl -ksSO "$AA_PANEL_URL"; then
            echo "[$SCRIPT_INDEX] AA Panel script downloaded successfully"
        else
            echo "[$SCRIPT_INDEX] Failed to download AA Panel script with curl"
            return 1
        fi
    elif command_exists wget; then
        if wget --no-check-certificate -O install_pro_en.sh "$AA_PANEL_URL"; then
            echo "[$SCRIPT_INDEX] AA Panel script downloaded successfully"
        else
            echo "[$SCRIPT_INDEX] Failed to download AA Panel script with wget"
            return 1
        fi
    else
        echo "[$SCRIPT_INDEX] Neither curl nor wget found, cannot download AA Panel"
        return 1
    fi
    
    # Make script executable
    chmod +x install_pro_en.sh
    
    # Execute installation script with key
    echo "[$SCRIPT_INDEX] Installing AA Panel with key: $AA_PANEL_KEY"
    $USE_SUDO bash install_pro_en.sh "$AA_PANEL_KEY"
    
    # Check if installation was successful
    if [ $? -eq 0 ]; then
        echo "[$SCRIPT_INDEX] AA Panel installed successfully"
        # Clean up downloaded script
        rm -f install_pro_en.sh
        return 0
    else
        echo "[$SCRIPT_INDEX] AA Panel installation failed"
        return 1
    fi
}

# Function to determine if running on Ubuntu
is_ubuntu() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [ "$ID" = "ubuntu" ]; then
            return 0
        fi
    fi
    return 1
}

# Main execution
echo "[$SCRIPT_INDEX] === BT Panel Management ==="

# Determine if we need sudo
if is_ubuntu; then
    echo "[$SCRIPT_INDEX] Ubuntu detected, using sudo"
    USE_SUDO="sudo"
else
    echo "[$SCRIPT_INDEX] Non-Ubuntu system, checking root privileges"
    if [ "$(id -u)" -eq 0 ]; then
        USE_SUDO=""
        echo "[$SCRIPT_INDEX] Running as root"
    else
        USE_SUDO="sudo"
        echo "[$SCRIPT_INDEX] Using sudo for commands"
    fi
fi

# Check current BT status
if check_bt_command; then
    echo "[$SCRIPT_INDEX] BT Panel is currently installed"
    echo "[$SCRIPT_INDEX] Uninstalling BT Panel..."
    if uninstall_bt_panel; then
        echo "[$SCRIPT_INDEX] BT Panel uninstalled successfully"
    else
        echo "[$SCRIPT_INDEX] Failed to uninstall BT Panel"
        exit 1
    fi
else
    echo "[$SCRIPT_INDEX] BT Panel is not installed"
fi

# Install AA Panel
echo "[$SCRIPT_INDEX] Installing AA Panel..."
if install_aa_panel; then
    echo "[$SCRIPT_INDEX] AA Panel installed successfully"
    
    # Set global variable for other scripts
    set_var "BT_PANEL_AVAILABLE" "true"
    set_var "BT_PANEL_TYPE" "aapanel"
    
    echo "[$SCRIPT_INDEX] === Installation Complete ==="
    echo "[$SCRIPT_INDEX] AA Panel is now available"
    echo "[$SCRIPT_INDEX] Access URL will be provided after installation completes"
    echo "[$SCRIPT_INDEX] Default username and password will be shown in the installation output"
    
else
    echo "[$SCRIPT_INDEX] Failed to install AA Panel"
    set_var "BT_PANEL_AVAILABLE" "false"
    exit 1
fi

echo "[$SCRIPT_INDEX] BT Panel Management Script completed"
