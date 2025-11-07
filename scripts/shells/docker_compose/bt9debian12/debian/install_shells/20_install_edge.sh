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

# Source global variables
source "$PARENT_DIR_LEVEL_2$PARENT_DIR_LEVEL_2/linux/LGar.sh"
source "$PARENT_DIR_LEVEL_5/linux/common/gvar_common.sh"
INSTALL_EDGE=$(get_var "INSTALL_EDGE")
INSTALL_MODE=$(get_var "INSTALL_MODE")

if [ "$INSTALL_EDGE" = "false" ]; then
    echo "Skipping Microsoft Edge installation,INSTALL_EDGE: $INSTALL_EDGE,INSTALL_MODE: $INSTALL_MODE" 
    exit 0
fi

# Function to kill hanging Edge processes
kill_edge_processes() {
    local count=$(pgrep -c "microsoft-edge")
    if [ "$count" -gt 3 ]; then
        echo "Found $count Edge processes, cleaning up..."
        ${USE_SUDO} pkill -f "microsoft-edge"
        echo "All Edge processes have been terminated"
    elif [ "$count" -gt 0 ]; then
        echo "Found $count Edge process(es), normal range"
    fi
}

# Function to check Edge version
check_edge_version() {
    if command -v microsoft-edge &> /dev/null; then
        local version=$(microsoft-edge --version)
        echo "Microsoft Edge is installed: $version"
        return 0
    fi
    return 1
}

# Install Edge if not present
install_edge() {
    echo "Installing Microsoft Edge..."
    
    # Add Microsoft Edge repository
    curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > microsoft.gpg
    ${USE_SUDO} install -o root -g root -m 644 microsoft.gpg /usr/share/keyrings/microsoft-edge.gpg
    rm microsoft.gpg
    
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-edge.gpg] https://packages.microsoft.com/repos/edge stable main" | \
        ${USE_SUDO} tee /etc/apt/sources.list.d/microsoft-edge.list
    
    # Update package list and install Edge
    ${USE_SUDO} apt update
    ${USE_SUDO} apt install -y microsoft-edge-stable
    
    # Verify installation
    if check_edge_version; then
        echo "Microsoft Edge installed successfully"
    else
        echo "Error: Failed to install Microsoft Edge"
        exit 1
    fi
}

# Main logic
echo "Checking Microsoft Edge installation..."

# Kill hanging processes if any
kill_edge_processes

# Check if Edge is installed
if check_edge_version; then
    echo "Edge browser is already installed"
    
    # Store Edge binary path in global variables if needed
    if command -v microsoft-edge &> /dev/null; then
        edge_path=$(which microsoft-edge)
        if [ -n "$edge_path" ]; then
            echo "$edge_path" | ${USE_SUDO} tee "/usr/core_node/global_var/EDGE_BIN" > /dev/null
            echo "Edge binary path stored in global variables"
        fi
    fi
else
    echo "Edge browser not found, proceeding with installation..."
    install_edge
fi

# Final status check
echo "
Edge Browser Status:
-------------------"
check_edge_version
ps aux | grep -i "microsoft-edge" | grep -v grep || echo "No Edge processes running" 