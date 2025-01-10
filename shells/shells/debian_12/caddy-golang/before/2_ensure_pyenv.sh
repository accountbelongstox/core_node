#!/bin/bash

# Check if running on Debian-based system
if [ ! -f /etc/debian_version ]; then
    echo "This script only supports Debian-based systems"
    exit 1
fi

# Get system information
SYSTEM_NAME="debian"
SYSTEM_VERSION=$(cat /etc/debian_version | tr '/' '_')

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:3])))')

SCRIPT_ROOT_DIR=$(cat "/usr/core_node/global_var/SCRIPT_ROOT_DIR")

PYENV_DIR="pyenv_${SYSTEM_NAME}_${SYSTEM_VERSION}_python${PYTHON_VERSION}"
FULL_PYENV_PATH="${SCRIPT_ROOT_DIR}/${PYENV_DIR}"

# Check if virtual environment exists
if [ ! -d "$FULL_PYENV_PATH" ]; then
    echo "Creating new Python virtual environment at: $FULL_PYENV_PATH"
    
    # Ensure python3-venv is installed
    if ! dpkg -l | grep -q python3-venv; then
        echo "Installing python3-venv package..."
        sudo apt-get update
        sudo apt-get install -y python3-venv
    fi
    
    # Create virtual environment
    python3 -m venv "$FULL_PYENV_PATH"
    
    if [ $? -ne 0 ]; then
        echo "Failed to create virtual environment"
        exit 1
    fi
else
    echo "Python virtual environment already exists at: $FULL_PYENV_PATH"
fi

env_python_path="${FULL_PYENV_PATH}/bin/python"
env_pip_path="${FULL_PYENV_PATH}/bin/pip"
# Print detailed Python information
echo "Python Details:"
env_python_path --version
echo "Location: ${env_python_path}"
echo "Absolute Path: ${env_python_path}"

# Print detailed pip information
echo -e "\nPip Details:"
env_pip_path --version
echo "Location: ${env_pip_path}"
echo "Absolute Path: ${env_pip_path}"

# Show activation instructions
echo -e "\nTo activate this environment, use the following command:"
echo "source ${FULL_PYENV_PATH}/bin/activate"

AUTO_INSTALL_REQUIRE_SCRIPT="${SCRIPT_ROOT_DIR}/pycore/auto_installrequire/auto_install_main.py"
"${env_python_path}" "${AUTO_INSTALL_REQUIRE_SCRIPT}"

GLOBAL_VAR_DIR="/usr/core_node/global_var"
PY_VENV_FILE="$GLOBAL_VAR_DIR/PY_VENV_DIR"
if [ ! -f "$PY_VENV_FILE" ]; then
    echo "$VENV_FULL_DIR" | sudo tee "$PY_VENV_FILE" > /dev/null
fi