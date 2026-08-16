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
PIPX_VENV_DIR=""
PIPX_BIN=""
PIPX_HOME=""
PIPX_BIN_DIR=""

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Source shared Python setup function
source "$PARENT_DIR_LEVEL_1/debian_com/shared_python_setup.sh"

# Set pipx venv directory from COMPILE_DIR
PIPX_VENV_DIR="$COMPILE_DIR/pipx_venv"
PIPX_BIN="$PIPX_VENV_DIR/bin/pipx"
PIPX_HOME="$COMPILE_DIR/pipx_home"
PIPX_BIN_DIR="/usr/local/bin"

echo "COMPILE_DIR: $COMPILE_DIR"
echo "PIPX_VENV_DIR: $PIPX_VENV_DIR"
echo "PIPX_HOME: $PIPX_HOME (where pipx stores installed packages)"
echo "PIPX_BIN_DIR: $PIPX_BIN_DIR (where pipx creates executable symlinks)"

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

# Function to install pipx in uv venv
install_pipx_in_uv_venv() {
    echo "Installing pipx in uv virtual environment..."

    # Check if uv is available
    if ! command_exists uv; then
        echo "Error: uv not found. Please install uv first (script 20_install_uv.sh)"
        return 1
    fi

    # Ensure COMPILE_DIR exists
    if [ ! -d "$COMPILE_DIR" ]; then
        echo "Creating compile directory: $COMPILE_DIR"
        $USE_SUDO mkdir -p "$COMPILE_DIR"
        $USE_SUDO chmod 755 "$COMPILE_DIR"
    fi

    # Create venv if it doesn't exist
    if [ ! -d "$PIPX_VENV_DIR" ]; then
        echo "Creating pipx virtual environment using uv: $PIPX_VENV_DIR"
        if uv venv "$PIPX_VENV_DIR"; then
            echo "Virtual environment created successfully"
        else
            echo "Failed to create virtual environment"
            return 1
        fi
    else
        echo "Virtual environment already exists at: $PIPX_VENV_DIR"
    fi

    # Install pipx in the venv using uv
    echo "Installing pipx using uv..."
    if uv pip install --python "$PIPX_VENV_DIR/bin/python3" pipx; then
        echo "pipx installed successfully in venv"
    else
        echo "Failed to install pipx in venv"
        return 1
    fi

    # Verify pipx binary exists
    if [ ! -f "$PIPX_BIN" ]; then
        echo "Error: pipx binary not found at: $PIPX_BIN"
        return 1
    fi

    echo "pipx installed successfully in uv venv"
    return 0
}

# Function to setup pipx symlink with correctness detection
setup_pipx_symlink() {
    echo "Setting up pipx symlink..."

    if [ ! -f "$PIPX_BIN" ]; then
        echo "Error: pipx binary not found at: $PIPX_BIN"
        return 1
    fi

    # Check if symlink exists and verify its correctness
    if [ -e "/usr/local/bin/pipx" ]; then
        local current_target=$(readlink -f "/usr/local/bin/pipx" 2>/dev/null || echo "")
        local expected_target=$(readlink -f "$PIPX_BIN" 2>/dev/null || echo "$PIPX_BIN")

        if [ "$current_target" = "$expected_target" ]; then
            echo "Symlink /usr/local/bin/pipx already points to correct location, skipping"
        else
            echo "Symlink exists but incorrect, updating to: $PIPX_BIN"
            $USE_SUDO rm -f "/usr/local/bin/pipx"
            $USE_SUDO ln -sf "$PIPX_BIN" "/usr/local/bin/pipx"
            echo "Updated symlink: /usr/local/bin/pipx -> $PIPX_BIN"
        fi
    else
        $USE_SUDO ln -sf "$PIPX_BIN" "/usr/local/bin/pipx"
        echo "Created symlink: /usr/local/bin/pipx -> $PIPX_BIN"
    fi

    # Make binary executable
    $USE_SUDO chmod +x "$PIPX_BIN"

    echo "pipx symlink setup completed"
    return 0
}

# Function to configure pipx environment
configure_pipx_environment() {
    echo "Configuring pipx environment..."

    # Create pipx home directory
    $USE_SUDO mkdir -p "$PIPX_HOME"
    $USE_SUDO chmod 755 "$PIPX_HOME"

    # Ensure PIPX_BIN_DIR exists (should already exist as /usr/local/bin)
    if [ ! -d "$PIPX_BIN_DIR" ]; then
        $USE_SUDO mkdir -p "$PIPX_BIN_DIR"
        $USE_SUDO chmod 755 "$PIPX_BIN_DIR"
    fi

    # Set environment variables in /etc/environment
    set_env_and_var "PIPX_HOME" "$PIPX_HOME"
    set_env_and_var "PIPX_BIN_DIR" "$PIPX_BIN_DIR"

    # Export for current session
    export PIPX_HOME="$PIPX_HOME"
    export PIPX_BIN_DIR="$PIPX_BIN_DIR"

    # Run pipx ensurepath with configured directories
    if [ -f "$PIPX_BIN" ]; then
        echo "Running pipx ensurepath..."
        PIPX_HOME="$PIPX_HOME" PIPX_BIN_DIR="$PIPX_BIN_DIR" "$PIPX_BIN" ensurepath --force 2>/dev/null || true
    fi

    echo "pipx environment configured successfully"
    echo "  PIPX_HOME: $PIPX_HOME (package venvs storage)"
    echo "  PIPX_BIN_DIR: $PIPX_BIN_DIR (executable symlinks)"
    return 0
}

# Main execution
echo "pipx Installation and Configuration Script"

# Check if pipx is already installed in venv
if [ -f "$PIPX_BIN" ]; then
    echo "pipx is already installed at: $PIPX_BIN"
    echo "Version: $("$PIPX_BIN" --version 2>/dev/null || echo 'unknown')"
else
    echo "Installing pipx in uv venv..."
    if ! install_pipx_in_uv_venv; then
        echo "Error: Failed to install pipx"
        exit 1
    fi
fi

# Setup symlink
if ! setup_pipx_symlink; then
    echo "Error: Failed to setup pipx symlink"
    exit 1
fi

# Configure pipx environment
if ! configure_pipx_environment; then
    echo "Warning: Failed to configure pipx environment"
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
echo ""
echo "Configuration:"
echo "  pipx binary: /usr/local/bin/pipx -> $PIPX_BIN"
echo "  PIPX_HOME: $PIPX_HOME"
echo "  PIPX_BIN_DIR: $PIPX_BIN_DIR"
echo ""
echo "Usage: pipx install <package_name>"
echo "Installed packages will have their executables in: $PIPX_BIN_DIR"
