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
PARENT_DIR_LEVEL_3="$(dirname "$PARENT_DIR_LEVEL_2")"
PARENT_DIR_LEVEL_4="$(dirname "$PARENT_DIR_LEVEL_3")"
PARENT_DIR_LEVEL_5="$(dirname "$PARENT_DIR_LEVEL_4")"

# Source global variables
source "$PARENT_DIR_LEVEL_5/linux/LGar.sh"
source "/mnt/dev_sdb3/programing/core_node/scripts/shells/linux/common/gvar_common.sh"

# Check if AI tools installation is enabled
INSTALL_AI_TOOLS=$(get_var "INSTALL_AI_TOOLS")
if [ "$INSTALL_AI_TOOLS" != "true" ]; then
    echo "[15] Skipping pipx installation (INSTALL_AI_TOOLS: $INSTALL_AI_TOOLS)"
    exit 0
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install required packages
install_requirements() {
    echo "Installing required packages..."
    
    # Update package lists
    if ! sudo apt-get update; then
        echo "Failed to update package lists" >&2
        return 1
    fi

    # Install required packages
    if ! sudo apt-get install -y python3-pip python3-venv python3-full pipx; then
        echo "Failed to install required packages" >&2
        return 1
    fi

    # Verify pip installation
    if ! python3 -m pip --version >/dev/null 2>&1; then
        echo "pip installation verification failed" >&2
        return 1
    fi

    echo "pip version: $(python3 -m pip --version)"
        return 0
}

# Function to configure pipx globally
configure_pipx() {
    echo "Configuring pipx for global access..."

    # Create system-wide pipx environment script
    local pipx_env_script="/etc/profile.d/pipx.sh"
    sudo tee "$pipx_env_script" > /dev/null << 'EOF'
#!/bin/bash
# pipx Environment Setup
export PIPX_HOME=/opt/pipx
export PIPX_BIN_DIR=/usr/local/bin
export PATH="$PIPX_BIN_DIR:$PATH"
EOF

    sudo chmod 755 "$pipx_env_script"
    echo "Global pipx environment script created: $pipx_env_script"

    # Source the environment for current session
    source "$pipx_env_script"

    # Create pipx directories
    sudo mkdir -p /opt/pipx
    sudo chmod 755 /opt/pipx

    # Set pipx environment variables
    export PIPX_HOME=/opt/pipx
    export PIPX_BIN_DIR=/usr/local/bin

    # Initialize pipx
    if command_exists pipx; then
        echo "Running pipx ensurepath..."
        sudo PIPX_HOME=/opt/pipx PIPX_BIN_DIR=/usr/local/bin pipx ensurepath --force
    else
        echo "Warning: pipx command not found, skipping ensurepath"
    fi

    # Create symlink for pipx if needed
    if [ -f /usr/bin/pipx ] && [ ! -L /usr/local/bin/pipx ]; then
        sudo ln -sf /usr/bin/pipx /usr/local/bin/pipx
        sudo chmod 755 /usr/local/bin/pipx
    fi

    echo "pipx configured for global access"
    return 0
}

# Main execution
echo "pipx Installation and Configuration Script"

# Install required packages
if command_exists pipx; then
    echo "pipx is already installed: $(pipx --version)"
else
    echo "Installing required packages..."
    if ! install_requirements; then
        exit 1
    fi
fi

# Configure pipx
if ! configure_pipx; then
    exit 1
fi

# Verify and print pipx information
verify_pipx_installation() {
    echo -e "\nVerifying pipx installation..."
    
    # Check if pipx is accessible
    if ! command_exists pipx; then
        echo "Error: pipx not found in PATH" >&2
        echo "Current PATH: $PATH"
        return 1
    fi
    
    # Print pipx information
    echo -e "\npipx Details:"
    echo "Version: $(pipx --version 2>/dev/null || echo 'Unable to get version')"
    echo "Location: $(which pipx 2>/dev/null || echo 'Not found')"
    if [ -L "$(which pipx)" ]; then
        echo "Symlink target: $(readlink -f $(which pipx))"
    fi
    echo "PIPX_HOME: ${PIPX_HOME:-'Not set'}"
    echo "PIPX_BIN_DIR: ${PIPX_BIN_DIR:-'Not set'}"
    
    # List installed packages
    echo -e "\nInstalled packages via pipx:"
    pipx list 2>/dev/null || echo "No packages installed yet"
    
    return 0
}

# Run verification
if ! verify_pipx_installation; then
    echo "Error: pipx verification failed" >&2
    exit 1
fi

echo -e "\npipx installation and configuration completed successfully!"
echo "pipx is now available globally and can be used to install Python CLI tools."
echo "Example usage: sudo pipx install <package_name>"