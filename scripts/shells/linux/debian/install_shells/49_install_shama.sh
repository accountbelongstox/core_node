#!/bin/bash
# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

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
SCRIPT_INDEX="49"
INSTALL_SAMBA=""

# Source global variables
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Initialize variables
SCRIPT_INDEX="49"
INSTALL_SAMBA=$(get_var "INSTALL_SAMBA")

echo "[$SCRIPT_INDEX] Samba Management Script"
echo "[$SCRIPT_INDEX] INSTALL_SAMBA: $INSTALL_SAMBA"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if Samba is installed
check_samba() {
    if command_exists samba || dpkg -l | grep -q "samba"; then
        return 0  # true, is installed
    fi
    return 1  # false, is not installed
}

# Function to check if Samba service is running
is_samba_running() {
    if command_exists systemctl; then
        if systemctl is-active --quiet smbd || systemctl is-active --quiet samba; then
            return 0
        else
            return 1
        fi
    elif command_exists service; then
        if service smbd status >/dev/null 2>&1 || service samba status >/dev/null 2>&1; then
            return 0
        else
            return 1
        fi
    else
        return 1
    fi
}

# Function to disable Samba services
disable_samba_services() {
    echo "[$SCRIPT_INDEX] Disabling Samba services..."
    
    # Stop Samba services if running
    if is_samba_running; then
        echo "[$SCRIPT_INDEX] Stopping Samba services..."
        $USE_SUDO systemctl stop smbd 2>/dev/null || $USE_SUDO service smbd stop 2>/dev/null
        $USE_SUDO systemctl stop nmbd 2>/dev/null || $USE_SUDO service nmbd stop 2>/dev/null
        $USE_SUDO systemctl stop samba 2>/dev/null || $USE_SUDO service samba stop 2>/dev/null
        
        if is_samba_running; then
            echo "[$SCRIPT_INDEX] Warning: Failed to stop Samba services"
        else
            echo "[$SCRIPT_INDEX] Samba services stopped successfully"
        fi
    else
        echo "[$SCRIPT_INDEX] Samba services are not running"
    fi
    
    # Disable Samba services from auto-start
    echo "[$SCRIPT_INDEX] Disabling Samba services from auto-start..."
    $USE_SUDO systemctl disable smbd 2>/dev/null || $USE_SUDO update-rc.d smbd disable 2>/dev/null
    $USE_SUDO systemctl disable nmbd 2>/dev/null || $USE_SUDO update-rc.d nmbd disable 2>/dev/null
    $USE_SUDO systemctl disable samba 2>/dev/null || $USE_SUDO update-rc.d samba disable 2>/dev/null
    
    echo "[$SCRIPT_INDEX] Samba services disabled successfully"
}

# Function to enable Samba services
enable_samba_services() {
    echo "[$SCRIPT_INDEX] Enabling Samba services..."
    
    # Enable Samba services for auto-start
    echo "[$SCRIPT_INDEX] Enabling Samba services for auto-start..."
    $USE_SUDO systemctl enable smbd 2>/dev/null || $USE_SUDO update-rc.d smbd enable 2>/dev/null
    $USE_SUDO systemctl enable nmbd 2>/dev/null || $USE_SUDO update-rc.d nmbd enable 2>/dev/null
    $USE_SUDO systemctl enable samba 2>/dev/null || $USE_SUDO update-rc.d samba enable 2>/dev/null
    
    # Start Samba services
    echo "[$SCRIPT_INDEX] Starting Samba services..."
    $USE_SUDO systemctl start smbd 2>/dev/null || $USE_SUDO service smbd start 2>/dev/null
    $USE_SUDO systemctl start nmbd 2>/dev/null || $USE_SUDO service nmbd start 2>/dev/null
    $USE_SUDO systemctl start samba 2>/dev/null || $USE_SUDO service samba start 2>/dev/null
    
    # Wait a moment for services to start
    sleep 2
    
    if is_samba_running; then
        echo "[$SCRIPT_INDEX] Samba services started successfully"
    else
        echo "[$SCRIPT_INDEX] Warning: Samba services may not have started properly"
    fi
}

# Function to install Samba
install_samba() {
    echo "[$SCRIPT_INDEX] Installing Samba..."
    
    # Update package list
    $USE_SUDO apt-get update
    
    # Install Samba
    $USE_SUDO apt-get install -y samba samba-common-bin
    
    if check_samba; then
        echo "[$SCRIPT_INDEX] Samba installed successfully"
        return 0
    else
        echo "[$SCRIPT_INDEX] Failed to install Samba"
        return 1
    fi
}

# Main execution logic
echo "[$SCRIPT_INDEX] === Samba Management ==="

# Check INSTALL_SAMBA variable
if [ "$INSTALL_SAMBA" = "true" ]; then
    echo "[$SCRIPT_INDEX] INSTALL_SAMBA is true - Installing and enabling Samba..."
    
    # Install Samba if not present
    if ! check_samba; then
        if ! install_samba; then
            echo "[$SCRIPT_INDEX] Failed to install Samba"
            exit 1
        fi
    else
        echo "[$SCRIPT_INDEX] Samba is already installed"
    fi
    
    # Enable Samba services
    enable_samba_services
    
    # Set global variables
    set_var "SAMBA_AVAILABLE" "true"
    set_var "SAMBA_ENABLED" "true"
    
    echo "[$SCRIPT_INDEX] Samba installation and enablement completed"
    
elif [ "$INSTALL_SAMBA" = "false" ]; then
    echo "[$SCRIPT_INDEX] INSTALL_SAMBA is false - Disabling Samba services..."
    
    # Disable Samba services (but keep installation)
    disable_samba_services
    
    # Set global variables
    set_var "SAMBA_AVAILABLE" "true"
    set_var "SAMBA_ENABLED" "false"
    
    echo "[$SCRIPT_INDEX] Samba services disabled (installation preserved)"
    
else
    echo "[$SCRIPT_INDEX] INSTALL_SAMBA is not set or invalid: $INSTALL_SAMBA"
    echo "[$SCRIPT_INDEX] Skipping Samba management"
    exit 0
fi

# Display Samba installation status
echo "[$SCRIPT_INDEX] === Samba Status ==="
if check_samba; then
    echo "[$SCRIPT_INDEX] Samba is installed"
    echo "[$SCRIPT_INDEX] Service Status: $(systemctl is-active smbd 2>/dev/null || echo 'unknown')"
    echo "[$SCRIPT_INDEX] Configuration: /etc/samba/smb.conf"
else
    echo "[$SCRIPT_INDEX] Samba is not installed"
fi

echo "[$SCRIPT_INDEX] Samba Management Script completed"
