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
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Source shared Python setup function
source "$PARENT_DIR_LEVEL_1/debian_com/shared_python_setup.sh"

# pipx is a default tool installation - no conditional check needed

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to ensure pip3 is installed
ensure_pip3_installed() {
    echo "Ensuring pip3 is installed..."
    
    # Check if pip3 is already available
    if command_exists pip3; then
        echo "pip3 is already installed: $(pip3 --version)"
        return 0
    fi
    
    # Check if python3 is available
    if ! command_exists python3; then
        echo "Installing python3..."
        $USE_SUDO apt update --allow-unauthenticated 2>/dev/null || true
        $USE_SUDO apt install -y python3 2>/dev/null || {
            echo "Warning: Failed to install python3 via apt"
            echo "Please install python3 manually or check your system"
            return 1
        }
    else
        echo "python3 is available"
    fi
    
    # Install packages individually to handle failures gracefully
    echo "Installing Python packages individually..."
    
    # Try to install python3-pip
    if ! command_exists pip3; then
        echo "Installing python3-pip..."
        if $USE_SUDO apt install -y python3-pip 2>/dev/null; then
            echo "python3-pip installed successfully"
        else
            echo "Warning: Failed to install python3-pip via apt"
            # Try alternative method
            echo "Trying alternative pip installation method..."
            if python3 -m ensurepip --upgrade 2>/dev/null; then
                echo "pip installed via ensurepip"
            else
                echo "Warning: ensurepip also failed"
            fi
        fi
    fi
    
    # Try to install python3-venv
    echo "Installing python3-venv..."
    if $USE_SUDO apt install -y python3-venv 2>/dev/null; then
        echo "python3-venv installed successfully"
    else
        echo "Warning: Failed to install python3-venv, but continuing..."
    fi
    
    # Try to install python3-dev
    echo "Installing python3-dev..."
    if $USE_SUDO apt install -y python3-dev 2>/dev/null; then
        echo "python3-dev installed successfully"
    else
        echo "Warning: Failed to install python3-dev, but continuing..."
    fi
    
    # Verify pip3 installation
    if command_exists pip3; then
        echo "pip3 installed successfully: $(pip3 --version)"
        return 0
    else
        echo "Warning: pip3 not found, but python3 is available"
        echo "You may need to install pip manually or use python3 -m pip"
        return 1
    fi
}

# Function to install pipx and additional packages
install_pipx_packages() {
    echo "Installing pipx and additional packages..."
    
    # Try to ensure pip3 is installed first
    ensure_pip3_installed || echo "Warning: pip3 installation had issues, but continuing..."
    
    # Ensure Python environment is set up
    if ! ensure_python_environment; then
        echo "Failed to set up Python environment" >&2
        return 1
    fi
    
    # Try to install pipx using apt first
    echo "Attempting to install pipx via apt..."
    if $USE_SUDO apt install -y pipx 2>/dev/null; then
        echo "pipx installed successfully via apt"
        return 0
    else
        echo "Warning: Failed to install pipx via apt"
        
        # Try alternative installation methods
        echo "Trying alternative pipx installation methods..."
        
        # Method 1: Try using pip3 if available
        if command_exists pip3; then
            echo "Trying to install pipx via pip3..."
            if pip3 install pipx --user 2>/dev/null; then
                echo "pipx installed successfully via pip3 (user install)"
                return 0
            fi
        fi
        
        # Method 2: Try using python3 -m pip if available
        if command_exists python3; then
            echo "Trying to install pipx via python3 -m pip..."
            if python3 -m pip install pipx --user 2>/dev/null; then
                echo "pipx installed successfully via python3 -m pip (user install)"
                return 0
            fi
        fi
        
        # Method 3: Try using ensurepip and then pip
        echo "Trying to install pipx via ensurepip method..."
        if python3 -m ensurepip --upgrade 2>/dev/null && python3 -m pip install pipx --user 2>/dev/null; then
            echo "pipx installed successfully via ensurepip method (user install)"
            return 0
        fi
        
        echo "Error: All pipx installation methods failed" >&2
        return 1
    fi
}

# Function to configure pipx globally
configure_pipx() {
    echo "Configuring pipx for global access..."

    # Create pipx directories
    $USE_SUDO mkdir -p /opt/pipx
    $USE_SUDO chmod 755 /opt/pipx

    # Set pipx environment variables
    export PIPX_HOME=/opt/pipx
    export PIPX_BIN_DIR=/usr/local/bin

    # Initialize pipx
    if command_exists pipx; then
        echo "Running pipx ensurepath..."
        $USE_SUDO PIPX_HOME=/opt/pipx PIPX_BIN_DIR=/usr/local/bin pipx ensurepath --force
    else
        echo "Warning: pipx command not found, skipping ensurepath"
    fi

    # Use common function to set up environment and symlinks
    # Add pipx installation directory to global path
    add_to_global_path_from_common_functions "/opt/pipx"
    
    # Add pipx binary to global path and create symlinks
    local pipx_bin_path=""
    if [ -f /usr/bin/pipx ]; then
        pipx_bin_path="/usr/bin/pipx"
        add_to_global_path_from_common_functions "$pipx_bin_path"
    fi

    echo "pipx configured for global access"
    return 0
}

# Main execution
echo "pipx Installation and Configuration Script"

# Install pipx and required packages
if command_exists pipx; then
    echo "pipx is already installed: $(pipx --version)"
else
    echo "Installing pipx and required packages..."
    if ! install_pipx_packages; then
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
echo "Example usage: $USE_SUDO pipx install <package_name>"
