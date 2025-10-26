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
PYTHON_VERSION=""
PYTHON_ENV_DIR=""
SELECTED_REGION=""
CLOUD_PROVIDER=""
PYENV_ROOT=""
PYENV_INSTALLED=false
PIP_INSTALLED=false
VENV_INSTALLED=false
PYTHON_INSTALLED=false

# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

# Source gvar_common.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Get Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))' 2>/dev/null || echo "3.8")
PYTHON_ENV_DIR="${COMPILE_DIR}/python${PYTHON_VERSION}_env"
PYENV_ROOT="${HOME}/.pyenv"

echo "COMPILE_DIR: $COMPILE_DIR"
echo "Python version: $PYTHON_VERSION"
echo "Python environment directory: $PYTHON_ENV_DIR"
echo "Pyenv root: $PYENV_ROOT"

# Ensure Python environment directory exists
if [ ! -d "$PYTHON_ENV_DIR" ]; then
    echo "Creating Python environment directory: $PYTHON_ENV_DIR"
    sudo mkdir -p "$PYTHON_ENV_DIR"
    sudo chmod 755 "$PYTHON_ENV_DIR"
else
    echo "Python environment directory already exists: $PYTHON_ENV_DIR"
fi

if [ -f /etc/environment ]; then
    set -a
    source /etc/environment
    set +a
fi

SELECTED_REGION=${SELECTED_REGION:-$(get_var "SELECTED_REGION")}
CLOUD_PROVIDER=${CLOUD_PROVIDER:-$(get_var "CLOUD_PROVIDER")}

# Function to check if Python is properly installed
check_python_installed() {
    if python3 -V >/dev/null 2>&1; then
        echo "Python $(python3 -V 2>&1) is installed"
        PYTHON_INSTALLED=true
        return 0
    else
        echo "Python3 is not installed"
        PYTHON_INSTALLED=false
        return 1
    fi
}

# Function to check if pip is installed
check_pip_installed() {
    if pip3 -V >/dev/null 2>&1; then
        echo "pip3 $(pip3 -V 2>&1 | cut -d' ' -f2) is installed"
        PIP_INSTALLED=true
        return 0
    elif python3 -m pip --version >/dev/null 2>&1; then
        echo "pip is available via python3 -m pip"
        PIP_INSTALLED=true
        return 0
    else
        echo "pip3 is not installed"
        PIP_INSTALLED=false
        return 1
    fi
}

# Function to check if venv module is available
check_venv_available() {
    if python3 -m venv --help >/dev/null 2>&1; then
        echo "venv module is available"
        VENV_INSTALLED=true
        return 0
    else
        echo "venv module is not available"
        VENV_INSTALLED=false
        return 1
    fi
}

# Function to check if pyenv is installed
check_pyenv_installed() {
    if command -v pyenv >/dev/null 2>&1; then
        echo "pyenv $(pyenv --version 2>&1 | cut -d' ' -f2) is installed"
        PYENV_INSTALLED=true
        return 0
    elif [ -d "$PYENV_ROOT" ] && [ -f "$PYENV_ROOT/bin/pyenv" ]; then
        echo "pyenv is installed but not in PATH"
        PYENV_INSTALLED=true
        return 0
    else
        echo "pyenv is not installed"
        PYENV_INSTALLED=false
        return 1
    fi
}

# Function to install pyenv
install_pyenv() {
    echo "Installing pyenv..."
    
    # Check if running as root
    if [ "$(id -u)" -eq 0 ]; then
        echo "Error: pyenv should not be installed as root user"
        echo "Please run this script as a regular user"
        return 1
    fi
    
    # Install dependencies
    echo "Installing pyenv dependencies..."
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
        make \
        build-essential \
        libssl-dev \
        zlib1g-dev \
        libbz2-dev \
        libreadline-dev \
        libsqlite3-dev \
        wget \
        curl \
        llvm \
        libncurses5-dev \
        libncursesw5-dev \
        xz-utils \
        tk-dev \
        libffi-dev \
        liblzma-dev \
        python3-openssl \
        git \
        --no-install-recommends
    
    # Install pyenv using the official installer
    echo "Downloading and installing pyenv..."
    curl https://pyenv.run | bash
    
    # Add pyenv to shell configuration
    if [ -f ~/.bashrc ]; then
        if ! grep -q 'export PYENV_ROOT' ~/.bashrc; then
            echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc
            echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc
            echo 'eval "$(pyenv init -)"' >> ~/.bashrc
        fi
    fi
    
    if [ -f ~/.zshrc ]; then
        if ! grep -q 'export PYENV_ROOT' ~/.zshrc; then
            echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.zshrc
            echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.zshrc
            echo 'eval "$(pyenv init -)"' >> ~/.zshrc
        fi
    fi
    
    # Set up environment for current session
    export PYENV_ROOT="$HOME/.pyenv"
    export PATH="$PYENV_ROOT/bin:$PATH"
    eval "$(pyenv init -)"
    
    if command -v pyenv >/dev/null 2>&1; then
        echo "pyenv installed successfully"
        PYENV_INSTALLED=true
        return 0
    else
        echo "Failed to install pyenv"
        return 1
    fi
}

# Function to set pip mirror based on region
set_pip_mirror() {
    if [ "$SELECTED_REGION" = "China" ]; then
        echo "Region is China, setting pip mirror to China mirror..."
        mkdir -p ~/.pip
        tee ~/.pip/pip.conf > /dev/null <<EOF
[global]
index-url = https://repo.huaweicloud.com/repository/pypi/simple/
trusted-host = repo.huaweicloud.com
EOF
        echo "pip mirror configuration completed for China region"
    else
        echo "Region is Global, keeping default pip configuration (no mirror setup)"
    fi
}

# Function to install pip when missing
install_pip() {
    echo "Installing pip..."
    
    # Check if running as root
    if [ "$(id -u)" -ne 0 ]; then
        echo "Error: This script requires root privileges for package installation"
        echo "Please run with sudo or as root user"
        return 1
    fi
    
    # Update package list
    apt-get update -qq
    
    # Install pip3
    DEBIAN_FRONTEND=noninteractive apt-get install -y python3-pip --no-install-recommends
    
    # Verify installation
    if pip3 -V >/dev/null 2>&1; then
        echo "pip3 installed successfully"
        PIP_INSTALLED=true
        return 0
    else
        echo "Failed to install pip3"
        return 1
    fi
}

# Function to upgrade pip (only in venv)
upgrade_pip() {
    if [ -n "$VIRTUAL_ENV" ]; then
        echo "Upgrading pip in virtual environment..."
        python -m pip install --upgrade pip setuptools wheel
        echo "Current pip version: $(pip -V)"
    else
        echo "Not in a virtual environment, skipping pip upgrade to avoid externally-managed-environment error."
    fi
}

# Function to install venv module when missing
install_venv() {
    echo "Installing python3-venv module..."
    
    # Check if running as root
    if [ "$(id -u)" -ne 0 ]; then
        echo "Error: This script requires root privileges for package installation"
        echo "Please run with sudo or as root user"
        return 1
    fi
    
    # Update package list
    apt-get update -qq
    
    # Install python3-venv
    DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv --no-install-recommends
    
    # Verify installation
    if python3 -m venv --help >/dev/null 2>&1; then
        echo "python3-venv installed successfully"
        VENV_INSTALLED=true
        return 0
    else
        echo "Failed to install python3-venv"
        return 1
    fi
}

# Function to create virtual environment
create_venv() {
    # Check if venv module is available
    if ! check_venv_available; then
        echo "venv module not available, installing..."
        if ! install_venv; then
            echo "Failed to install venv module"
            return 1
        fi
    fi
    
    # Check if Python environment directory is defined
    if [ -n "$PYTHON_ENV_DIR" ]; then
        echo "Checking virtual environment at ${PYTHON_ENV_DIR}..."
        
        # Check if venv already exists
        if [ -d "$PYTHON_ENV_DIR" ] && [ -f "$PYTHON_ENV_DIR/bin/python" ]; then
            echo "Virtual environment already exists at ${PYTHON_ENV_DIR}"
            return 0
        fi

        echo "Creating virtual environment at ${PYTHON_ENV_DIR}..."
        python3 -m venv "$PYTHON_ENV_DIR"
        
        if [ $? -eq 0 ]; then
            echo "Virtual environment created successfully"
            # Set proper permissions
            chmod -R 755 "$PYTHON_ENV_DIR"
            
            # Activate and upgrade pip in the virtual environment
            source "${PYTHON_ENV_DIR}/bin/activate"
            upgrade_pip
            deactivate
            return 0
        else
            echo "Failed to create virtual environment"
            return 1
        fi
    else
        echo "PYTHON_ENV_DIR not properly set, skipping virtual environment creation"
        return 0
    fi
}

# Function to install Python essentials
install_python_essentials() {
    echo "Installing Python essentials..."
    
    # Check if running as root
    if [ "$(id -u)" -ne 0 ]; then
        echo "Error: This script requires root privileges for package installation"
        echo "Please run with sudo or as root user"
        return 1
    fi
    
    # Clean up broken package lists if they exist
    echo "Cleaning up package lists..."
    rm -rf /var/lib/apt/lists/* 2>/dev/null || true
    
    # Update package list
    echo "Updating package list..."
    apt-get update

    # Install Python and essential packages
    echo "Installing Python and essential packages..."
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        python3-setuptools \
        python3-wheel \
        python3-distutils \
        build-essential \
        libssl-dev \
        libffi-dev \
        --no-install-recommends

    # Verify installations
    if python3 -V >/dev/null 2>&1; then
        echo "Python3 installed successfully: $(python3 -V 2>&1)"
        PYTHON_INSTALLED=true
    else
        echo "Failed to install Python3"
        return 1
    fi
    
    if pip3 -V >/dev/null 2>&1; then
        echo "pip3 installed successfully: $(pip3 -V 2>&1)"
        PIP_INSTALLED=true
    else
        echo "Failed to install pip3"
        return 1
    fi
    
    if python3 -m venv --help >/dev/null 2>&1; then
        echo "python3-venv installed successfully"
        VENV_INSTALLED=true
    else
        echo "Failed to install python3-venv"
        return 1
    fi

    # Clean up
    apt-get clean
    rm -rf /var/lib/apt/lists/*

    # Set pip mirror if in China
    set_pip_mirror
}

# Function to ensure pipenv is installed
ensure_pipenv_installed() {
    echo "Checking if pipenv is installed..."
    if command -v pipenv &> /dev/null; then
        echo "pipenv is already installed. Path: $(command -v pipenv)"
        return 0
    else
        echo "pipenv not found, proceeding with installation via apt..."
        
        # Ensure we have root privileges
        if [ "$(id -u)" -ne 0 ]; then
            echo "Error: This script requires root privileges for package installation."
            echo "Please run with sudo or as root user."
            return 1
        fi

        # The main install function already updates apt, but in case this function
        # is run when python is already installed, it's safer to update here too.
        echo "Updating package list before installing pipenv..."
        apt-get update -qq
        
        echo "Installing pipenv..."
        DEBIAN_FRONTEND=noninteractive apt-get install -y pipenv --no-install-recommends
        
        if command -v pipenv &> /dev/null; then
            echo "pipenv installed successfully via apt. Path: $(command -v pipenv)"
            return 0
        else
            echo "Failed to install pipenv via apt."
            return 1
        fi
    fi
}

# Function to verify installation
verify_installation() {
    # Check Python version
    if ! python3 -V >/dev/null 2>&1; then
        echo "Error: Python3 is not properly installed"
        return 1
    fi

    # Check pip version
    if ! pip3 -V >/dev/null 2>&1; then
        echo "Error: pip3 is not properly installed"
        return 1
    fi

    echo "Python $(python3 -V 2>&1) and $(pip3 -V) are properly installed"
    return 0
}

# Main function
main() {
    local is_new_install=false
    local needs_python_install=false
    local needs_pip_install=false
    local needs_venv_install=false
    local needs_pyenv_install=false

    echo "=== Python Environment Setup Script ==="
    echo "Checking current Python environment status..."

    # Check Python installation
    if ! check_python_installed; then
        echo "Python3 is not installed, will install..."
        needs_python_install=true
        is_new_install=true
    fi

    # Check pip installation
    if ! check_pip_installed; then
        echo "pip3 is not installed, will install..."
        needs_pip_install=true
        is_new_install=true
    fi

    # Check venv module
    if ! check_venv_available; then
        echo "venv module is not available, will install..."
        needs_venv_install=true
        is_new_install=true
    fi

    # Check pyenv installation
    if ! check_pyenv_installed; then
        echo "pyenv is not installed, will install..."
        needs_pyenv_install=true
    fi

    # Install Python essentials if needed
    if [ "$needs_python_install" = true ] || [ "$needs_pip_install" = true ] || [ "$needs_venv_install" = true ]; then
        echo "Installing Python essentials..."
        if ! install_python_essentials; then
            echo "Failed to install Python essentials"
            return 1
        fi
    fi

    # Install pyenv if needed (as regular user)
    if [ "$needs_pyenv_install" = true ]; then
        echo "Installing pyenv..."
        if ! install_pyenv; then
            echo "Failed to install pyenv"
            return 1
        fi
    fi

    # Verify installation if it's a new install
    if [ "$is_new_install" = true ] && ! verify_installation; then
        echo "Failed to verify Python environment installation"
        return 1
    fi

    # Create virtual environment if conditions are met
    echo "Setting up virtual environment..."
    if ! create_venv; then
        echo "Failed to create virtual environment"
        return 1
    fi

    # Ensure pipenv is installed
    echo "Ensuring pipenv is installed..."
    if ! ensure_pipenv_installed; then
        echo "Failed to install pipenv"
        return 1
    fi

    echo "=== Python Environment Setup Complete ==="
    echo "Summary:"
    echo "- Python3: $([ "$PYTHON_INSTALLED" = true ] && echo "Installed" || echo "Not installed")"
    echo "- pip3: $([ "$PIP_INSTALLED" = true ] && echo "Installed" || echo "Not installed")"
    echo "- venv: $([ "$VENV_INSTALLED" = true ] && echo "Available" || echo "Not available")"
    echo "- pyenv: $([ "$PYENV_INSTALLED" = true ] && echo "Installed" || echo "Not installed")"

    return 0
}

# Execute main function
main
