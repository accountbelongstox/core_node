#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Declare all variables at the beginning
SCRIPT_CURRENT_DIR=""
PARENT_DIR_LEVEL_1=""
PARENT_DIR_LEVEL_2=""
PYTHON_VERSION=""
SELECTED_REGION=""
PYTHON_INSTALLED=false
PIP_INSTALLED=false

# Source global variables
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Get Python version (default to 3 if not installed)
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))' 2>/dev/null || echo "3.12")

echo "COMPILE_DIR: $COMPILE_DIR"
echo "Python version: $PYTHON_VERSION"

# Load environment
if [ -f /etc/environment ]; then
    set -a
    source /etc/environment
    set +a
fi

SELECTED_REGION=${SELECTED_REGION:-$(get_var "SELECTED_REGION")}

print_header_from_common_functions "Python Environment Setup"

# Function to check if Python3 is installed
check_python_installed() {
    if command -v python3 >/dev/null 2>&1; then
        print_success_from_common_functions "Python3 $(python3 -V 2>&1) is installed"
        PYTHON_INSTALLED=true
        return 0
    else
        print_warning_from_common_functions "Python3 is not installed"
        PYTHON_INSTALLED=false
        return 1
    fi
}

# Function to check if pip3 is installed
check_pip_installed() {
    if command -v pip3 >/dev/null 2>&1; then
        print_success_from_common_functions "pip3 $(pip3 -V 2>&1 | cut -d' ' -f2) is installed"
        PIP_INSTALLED=true
        return 0
    elif python3 -m pip --version >/dev/null 2>&1; then
        print_success_from_common_functions "pip is available via python3 -m pip"
        PIP_INSTALLED=true
        return 0
    else
        print_warning_from_common_functions "pip3 is not installed"
        PIP_INSTALLED=false
        return 1
    fi
}

# Function to install Python essentials
install_python_essentials() {
    print_step_from_common_functions "Installing Python and essential packages..."

    # Clean up broken package lists
    print_step_from_common_functions "Cleaning up package lists..."
    $USE_SUDO rm -rf /var/lib/apt/lists/* 2>/dev/null || true

    # Update package list
    print_step_from_common_functions "Updating package list..."
    $USE_SUDO apt-get update -qq

    # Install Python and essential packages
    print_step_from_common_functions "Installing Python3 and development tools..."
    $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y \
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
        print_success_from_common_functions "Python3 installed: $(python3 -V 2>&1)"
        PYTHON_INSTALLED=true
    else
        print_error_from_common_functions "Failed to install Python3"
        return 1
    fi

    if pip3 -V >/dev/null 2>&1; then
        print_success_from_common_functions "pip3 installed: $(pip3 -V 2>&1)"
        PIP_INSTALLED=true
    else
        print_error_from_common_functions "Failed to install pip3"
        return 1
    fi

    # Clean up
    $USE_SUDO apt-get clean
    $USE_SUDO rm -rf /var/lib/apt/lists/*

    print_success_from_common_functions "Python essentials installed successfully"
    return 0
}

# Function to set pip mirror based on region
set_pip_mirror() {
    if [ "$SELECTED_REGION" = "China" ]; then
        print_step_from_common_functions "Setting pip mirror to China (Huawei Cloud)..."
        mkdir -p ~/.pip
        tee ~/.pip/pip.conf > /dev/null <<EOF
[global]
index-url = https://repo.huaweicloud.com/repository/pypi/simple/
trusted-host = repo.huaweicloud.com
EOF
        print_success_from_common_functions "pip mirror configured for China region"
    else
        print_step_from_common_functions "Using default pip configuration (Global region)"
    fi
}

# Function to fix Python symlinks
fix_python_links() {
    print_step_from_common_functions "Fixing Python symlinks in /usr/local/bin..."

    # Check if python3 exists
    if ! command -v python3 >/dev/null 2>&1; then
        print_error_from_common_functions "python3 not found, cannot create links"
        return 1
    fi

    local python3_path=$(command -v python3)
    local pip3_path=$(command -v pip3 2>/dev/null)

    # Create python -> python3 symlink
    if [ ! -e /usr/local/bin/python ]; then
        print_step_from_common_functions "Creating symlink: /usr/local/bin/python -> $python3_path"
        $USE_SUDO ln -sf "$python3_path" /usr/local/bin/python
        print_success_from_common_functions "Created python symlink"
    elif [ -L /usr/local/bin/python ]; then
        local current_target=$(readlink -f /usr/local/bin/python)
        if [ "$current_target" != "$python3_path" ]; then
            print_step_from_common_functions "Updating python symlink to point to $python3_path"
            $USE_SUDO ln -sf "$python3_path" /usr/local/bin/python
            print_success_from_common_functions "Updated python symlink"
        else
            print_success_from_common_functions "python symlink already correct"
        fi
    fi

    # Create pip -> pip3 symlink if pip3 exists
    if [ -n "$pip3_path" ]; then
        if [ ! -e /usr/local/bin/pip ]; then
            print_step_from_common_functions "Creating symlink: /usr/local/bin/pip -> $pip3_path"
            $USE_SUDO ln -sf "$pip3_path" /usr/local/bin/pip
            print_success_from_common_functions "Created pip symlink"
        elif [ -L /usr/local/bin/pip ]; then
            local current_target=$(readlink -f /usr/local/bin/pip)
            if [ "$current_target" != "$pip3_path" ]; then
                print_step_from_common_functions "Updating pip symlink to point to $pip3_path"
                $USE_SUDO ln -sf "$pip3_path" /usr/local/bin/pip
                print_success_from_common_functions "Updated pip symlink"
            else
                print_success_from_common_functions "pip symlink already correct"
            fi
        fi
    fi

    return 0
}

# Function to verify Python installation
verify_installation() {
    print_step_from_common_functions "Verifying Python installation..."

    local verification_failed=false

    # Check Python3
    if command -v python3 >/dev/null 2>&1; then
        print_success_from_common_functions "Python3: $(python3 -V 2>&1)"
    else
        print_error_from_common_functions "Python3 not found"
        verification_failed=true
    fi

    # Check python symlink
    if command -v python >/dev/null 2>&1; then
        print_success_from_common_functions "python: $(python -V 2>&1)"
    else
        print_warning_from_common_functions "python symlink not found (optional)"
    fi

    # Check pip3
    if command -v pip3 >/dev/null 2>&1; then
        print_success_from_common_functions "pip3: $(pip3 -V 2>&1 | cut -d' ' -f1-2)"
    else
        print_error_from_common_functions "pip3 not found"
        verification_failed=true
    fi

    # Check pip symlink
    if command -v pip >/dev/null 2>&1; then
        print_success_from_common_functions "pip: $(pip -V 2>&1 | cut -d' ' -f1-2)"
    else
        print_warning_from_common_functions "pip symlink not found (optional)"
    fi

    # Check essential modules
    if python3 -c "import setuptools" 2>/dev/null; then
        print_success_from_common_functions "setuptools module available"
    else
        print_warning_from_common_functions "setuptools module not available"
    fi

    if python3 -c "import wheel" 2>/dev/null; then
        print_success_from_common_functions "wheel module available"
    else
        print_warning_from_common_functions "wheel module not available"
    fi

    if [ "$verification_failed" = true ]; then
        return 1
    else
        return 0
    fi
}

# Main function
main() {
    local needs_install=false

    print_step_from_common_functions "Checking Python environment status..."

    # Check Python installation
    if ! check_python_installed; then
        print_warning_from_common_functions "Python3 needs to be installed"
        needs_install=true
    fi

    # Check pip installation
    if ! check_pip_installed; then
        print_warning_from_common_functions "pip3 needs to be installed"
        needs_install=true
    fi

    # Install Python essentials if needed
    if [ "$needs_install" = true ]; then
        if ! install_python_essentials; then
            print_error_from_common_functions "Failed to install Python essentials"
            return 1
        fi

        # Set pip mirror after installation
        set_pip_mirror
    else
        print_info_from_common_functions "Python and pip are already installed"
        # Still set pip mirror for existing installations
        set_pip_mirror
    fi

    # Fix Python symlinks (always run to ensure correctness)
    if ! fix_python_links; then
        print_warning_from_common_functions "Failed to fix some Python symlinks"
    fi

    # Verify installation
    print_step_from_common_functions "Final verification..."
    if ! verify_installation; then
        print_error_from_common_functions "Verification failed - some components are missing"
        return 1
    fi

    print_success_from_common_functions "Python environment setup complete!"
    print_info_from_common_functions "System Python is used directly (no virtual environments)"
    print_info_from_common_functions "Tools available: python3, pip3"

    return 0
}

# Execute main function
main
exit $?
