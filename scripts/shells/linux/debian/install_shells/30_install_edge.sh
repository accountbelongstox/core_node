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
SCRIPT_INDEX="30"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Source repository manager
source "$PARENT_DIR_LEVEL_1/debian_com/repository_manager.sh"

INSTALL_EDGE=$(get_var "INSTALL_EDGE")
INSTALL_MODE=$(get_var "INSTALL_MODE")

echo "[$SCRIPT_INDEX] Microsoft Edge Installation Script"
echo "[$SCRIPT_INDEX] INSTALL_EDGE: $INSTALL_EDGE, INSTALL_MODE: $INSTALL_MODE"

if [ "$INSTALL_EDGE" = "false" ]; then
    echo "[$SCRIPT_INDEX] INSTALL_EDGE is false - Edge repository should be removed by 12_update.sh"
    echo "[$SCRIPT_INDEX] Checking if Edge is still installed..."
    
    # Check if Edge is still installed despite repository removal
    if command -v microsoft-edge &> /dev/null; then
        echo "[$SCRIPT_INDEX] Edge is still installed, removing..."
        $USE_SUDO apt remove -y microsoft-edge-stable 2>/dev/null || true
        $USE_SUDO apt purge -y microsoft-edge-stable 2>/dev/null || true
        echo "[$SCRIPT_INDEX] Edge removed successfully"
    else
        echo "[$SCRIPT_INDEX] Edge is not installed"
    fi
    
    # Clean up any remaining Edge-related files
    $USE_SUDO rm -f "/usr/local/bin/microsoft-edge" 2>/dev/null || true
    
    # Clear stored variables
    set_var "EDGE_BIN" ""
    set_var "EDGE_VERSION" ""
    
    echo "[$SCRIPT_INDEX] Microsoft Edge cleanup completed"
    exit 0
fi

# Check repository status before proceeding (only when installing)
if ! verify_edge_repo_for_install; then
    echo "[$SCRIPT_INDEX] Please run 12_update.sh first to properly manage repositories"
    exit 1
fi

# Function to kill hanging Edge processes
kill_edge_processes() {
    local count=$(pgrep -c "microsoft-edge" 2>/dev/null | tr -d '\n' || echo "0")
    if [ "$count" -gt 3 ]; then
        echo "[$SCRIPT_INDEX] Found $count Edge processes, cleaning up..."
        $USE_SUDO pkill -f "microsoft-edge" 2>/dev/null || true
        echo "[$SCRIPT_INDEX] All Edge processes have been terminated"
    elif [ "$count" -gt 0 ]; then
        echo "[$SCRIPT_INDEX] Found $count Edge process(es), normal range"
    fi
}

# Function to check Edge version
check_edge_version() {
    if command -v microsoft-edge &> /dev/null; then
        local version=$(microsoft-edge --version 2>/dev/null || echo "unknown version")
        echo "[$SCRIPT_INDEX] Microsoft Edge is installed: $version"
        return 0
    fi
    return 1
}

# Install Edge if not present
install_edge() {
    echo "[$SCRIPT_INDEX] Installing Microsoft Edge..."
    
    # Repository should already be added by 12_update.sh
    echo "[$SCRIPT_INDEX] Installing Edge from pre-configured repository..."
    
    # Update package list and install Edge
    echo "[$SCRIPT_INDEX] Updating package list and installing Edge..."
    $USE_SUDO apt update
    $USE_SUDO apt install -y microsoft-edge-stable
    
    # Verify installation
    if check_edge_version; then
        echo "[$SCRIPT_INDEX] Microsoft Edge installed successfully"
    else
        echo "[$SCRIPT_INDEX] Error: Failed to install Microsoft Edge"
        exit 1
    fi
}

# Main logic
echo "[$SCRIPT_INDEX] Checking Microsoft Edge installation..."

# Kill hanging processes if any
kill_edge_processes

# Check if Edge is installed
if check_edge_version; then
    echo "[$SCRIPT_INDEX] Edge browser is already installed"
    
    # Store Edge binary path in global variables
    if command -v microsoft-edge &> /dev/null; then
        edge_path=$(which microsoft-edge)
        if [ -n "$edge_path" ]; then
            # Use the proper set_var function instead of directly writing to file
            set_var "EDGE_BIN" "$edge_path"
            set_var "EDGE_VERSION" "$(microsoft-edge --version 2>/dev/null || echo 'unknown')"
            echo "[$SCRIPT_INDEX] Edge binary path stored in global variables: $edge_path"
            
            # Create symlink in /usr/local/bin if it doesn't exist
            if [ ! -L "/usr/local/bin/microsoft-edge" ]; then
                $USE_SUDO ln -sf "$edge_path" "/usr/local/bin/microsoft-edge"
                echo "[$SCRIPT_INDEX] Created symlink: /usr/local/bin/microsoft-edge -> $edge_path"
            fi
        fi
    fi
else
    echo "[$SCRIPT_INDEX] Edge browser not found, proceeding with installation..."
    install_edge
    
    # Store info after installation
    if command -v microsoft-edge &> /dev/null; then
        edge_path=$(which microsoft-edge)
        set_var "EDGE_BIN" "$edge_path"
        set_var "EDGE_VERSION" "$(microsoft-edge --version 2>/dev/null || echo 'unknown')"
        echo "[$SCRIPT_INDEX] Edge installation info stored in global variables"
    fi
fi

# Final status check
echo "[$SCRIPT_INDEX] ==============================="
echo "[$SCRIPT_INDEX] Edge Browser Status:"
echo "[$SCRIPT_INDEX] ==============================="
check_edge_version

# Check running processes
local edge_processes=$(ps aux | grep -i "microsoft-edge" | grep -v grep | wc -l | tr -d '\n')
if [ "$edge_processes" -gt 0 ]; then
    echo "[$SCRIPT_INDEX] Found $edge_processes Edge processes running"
else
    echo "[$SCRIPT_INDEX] No Edge processes running"
fi

# Display stored variables
local edge_bin=$(get_var "EDGE_BIN" 2>/dev/null || echo "not set")
local edge_version=$(get_var "EDGE_VERSION" 2>/dev/null || echo "not set")
echo "[$SCRIPT_INDEX] Stored variables:"
echo "[$SCRIPT_INDEX]   EDGE_BIN: $edge_bin"
echo "[$SCRIPT_INDEX]   EDGE_VERSION: $edge_version"
echo "[$SCRIPT_INDEX] ===============================" 
