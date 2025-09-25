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

# Shared Python Environment Setup Function
# This function ensures Python3, pip3, venv, and essential packages are installed
# It should be sourced by scripts that require Python environment

# Declare all variables at the beginning
PYTHON_SETUP_COMPLETED=false
APT_UPDATED=false
PYTHON_INSTALLED=false
PIP_INSTALLED=false
VENV_INSTALLED=false

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

# Function to update apt packages (only once per session)
update_apt_packages() {
    if [ "$APT_UPDATED" = true ]; then
        echo "apt packages already updated in this session"
        return 0
    fi
    
    echo "Updating apt package lists..."
    
    # Check if running as root
    if [ "$(id -u)" -ne 0 ]; then
        echo "Error: This function requires root privileges for package installation"
        echo "Please run with sudo or as root user"
        return 1
    fi
    
    # Clean up broken package lists if they exist
    echo "Cleaning up package lists..."
    rm -rf /var/lib/apt/lists/* 2>/dev/null || true
    
    # Update package list
    if apt-get update -qq; then
        echo "apt package lists updated successfully"
        APT_UPDATED=true
        return 0
    else
        echo "Failed to update apt package lists"
        return 1
    fi
}

# Function to install Python essentials
install_python_essentials() {
    echo "Installing Python essentials..."
    
    # Check if running as root
    if [ "$(id -u)" -ne 0 ]; then
        echo "Error: This function requires root privileges for package installation"
        echo "Please run with sudo or as root user"
        return 1
    fi
    
    # Update apt packages if not already done
    if ! update_apt_packages; then
        echo "Failed to update apt packages"
        return 1
    fi
    
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
        python3-full \
        build-essential \
        libssl-dev \
        libffi-dev \
        zlib1g-dev \
        libbz2-dev \
        libreadline-dev \
        libsqlite3-dev \
        libncurses5-dev \
        libncursesw5-dev \
        xz-utils \
        tk-dev \
        liblzma-dev \
        python3-openssl \
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

    echo "Python essentials installation completed successfully"
    return 0
}

# Main function to ensure Python environment is set up
ensure_python_environment() {
    # Check if already completed in this session
    if [ "$PYTHON_SETUP_COMPLETED" = true ]; then
        echo "Python environment already set up in this session"
        return 0
    fi
    
    echo "=== Ensuring Python Environment Setup ==="
    
    local needs_install=false
    
    # Check Python installation
    if ! check_python_installed; then
        echo "Python3 is not installed, will install..."
        needs_install=true
    fi

    # Check pip installation
    if ! check_pip_installed; then
        echo "pip3 is not installed, will install..."
        needs_install=true
    fi

    # Check venv module
    if ! check_venv_available; then
        echo "venv module is not available, will install..."
        needs_install=true
    fi

    # Install Python essentials if needed
    if [ "$needs_install" = true ]; then
        echo "Installing Python essentials..."
        if ! install_python_essentials; then
            echo "Failed to install Python essentials"
            return 1
        fi
    fi

    # Final verification
    if ! check_python_installed || ! check_pip_installed || ! check_venv_available; then
        echo "Failed to verify Python environment setup"
        return 1
    fi

    PYTHON_SETUP_COMPLETED=true
    echo "=== Python Environment Setup Complete ==="
    echo "Summary:"
    echo "- Python3: $([ "$PYTHON_INSTALLED" = true ] && echo "Installed" || echo "Not installed")"
    echo "- pip3: $([ "$PIP_INSTALLED" = true ] && echo "Installed" || echo "Not installed")"
    echo "- venv: $([ "$VENV_INSTALLED" = true ] && echo "Available" || echo "Not available")"
    
    return 0
}
