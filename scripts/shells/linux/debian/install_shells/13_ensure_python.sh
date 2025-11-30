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
UBUNTU_ARCHIVE_KEY_ID="871920D1991BC93C"
VENV_DIR=""
VENV_PYTHON3=""
VENV_PYTHON=""
VENV_PIP3=""
VENV_PIP=""

# Source global variables
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Get Python version (default to 3 if not installed)
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))' 2>/dev/null || echo "3.12")

# Set venv directory path from COMPILE_DIR
VENV_DIR="$COMPILE_DIR/python3_venv"
VENV_PYTHON3="$VENV_DIR/bin/python3"
VENV_PYTHON="$VENV_DIR/bin/python"
VENV_PIP3="$VENV_DIR/bin/pip3"
VENV_PIP="$VENV_DIR/bin/pip"

echo "COMPILE_DIR: $COMPILE_DIR"
echo "Python venv directory: $VENV_DIR"
echo "Python version: $PYTHON_VERSION"

# Load environment
if [ -f /etc/environment ]; then
    set -a
    source /etc/environment
    set +a
fi

SELECTED_REGION=${SELECTED_REGION:-$(get_var "SELECTED_REGION")}

print_header_from_common_functions "Python Environment Setup"

# Try to fix APT GPG issues for Ubuntu 24.04 (noble) or similar environments
fix_apt_gpg_if_needed() {
    # Only attempt on Debian/Ubuntu-like systems with apt-get available
    if ! command -v apt-get >/dev/null 2>&1; then
        return 0
    fi

    # First attempt: ensure ubuntu-keyring is present (may already be installed)
    # If repositories are currently unverified, allow insecure temporarily only for keyring
    $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get update -qq || true
    $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ubuntu-keyring 2>/dev/null || \
    $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::AllowInsecureRepositories=true \
        -o Acquire::AllowDowngradeToInsecureRepositories=true install -y -qq ubuntu-keyring || true

    # Explicitly import the 2024 Ubuntu archive automatic signing key if missing
    if [ ! -f /etc/apt/trusted.gpg.d/ubuntu-archive-2024.gpg ]; then
        if command -v gpg >/dev/null 2>&1; then
            print_step_from_common_functions "Importing Ubuntu archive signing key ($UBUNTU_ARCHIVE_KEY_ID)"
            tmpkey="/tmp/ubuntu-archive-2024.gpg"
            curl -fsSL "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x$UBUNTU_ARCHIVE_KEY_ID" \
                | gpg --dearmor | $USE_SUDO tee "$tmpkey" >/dev/null || true
            if [ -s "$tmpkey" ]; then
                $USE_SUDO mv "$tmpkey" /etc/apt/trusted.gpg.d/ubuntu-archive-2024.gpg || true
            else
                rm -f "$tmpkey" 2>/dev/null || true
            fi
        fi
    fi

    # Retry update after key/keyring adjustments
    $USE_SUDO apt-get update -qq || true
}

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
    if ! $USE_SUDO apt-get update -qq; then
        print_warning_from_common_functions "apt-get update failed, attempting to fix APT GPG keys"
        fix_apt_gpg_if_needed
    fi

    # Install Python and essential packages
    print_step_from_common_functions "Installing Python3 and development tools..."
    $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        python3-setuptools \
        python3-wheel \
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
        # Fallback: try ensurepip (may be disabled on Debian/Ubuntu builds) and re-check
        print_warning_from_common_functions "pip3 not available, attempting python3 -m ensurepip"
        if python3 -m ensurepip --upgrade >/dev/null 2>&1; then
            if command -v pip3 >/dev/null 2>&1; then
                print_success_from_common_functions "pip3 installed via ensurepip"
                PIP_INSTALLED=true
            else
                print_warning_from_common_functions "ensurepip ran but pip3 still missing; attempting direct package install"
                $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-pip --no-install-recommends || true
                if command -v pip3 >/dev/null 2>&1; then
                    print_success_from_common_functions "pip3 installed via apt after ensurepip"
                    PIP_INSTALLED=true
                else
                    print_error_from_common_functions "Failed to install pip3"
                    return 1
                fi
            fi
        else
            # As a last resort, attempt re-import keys and retry pip install
            fix_apt_gpg_if_needed
            $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-pip --no-install-recommends || true
            if command -v pip3 >/dev/null 2>&1; then
                print_success_from_common_functions "pip3 installed after fixing APT keys"
                PIP_INSTALLED=true
            else
                print_error_from_common_functions "Failed to install pip3"
                return 1
            fi
        fi
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

# Function to create Python venv and replace system commands
create_python_venv_and_replace_system() {
    print_step_from_common_functions "Creating Python virtual environment and replacing system commands..."

    # Ensure COMPILE_DIR exists
    if [ ! -d "$COMPILE_DIR" ]; then
        print_step_from_common_functions "Creating compile directory: $COMPILE_DIR"
        $USE_SUDO mkdir -p "$COMPILE_DIR"
        $USE_SUDO chmod 755 "$COMPILE_DIR"
    fi

    # Create venv if it doesn't exist
    if [ ! -d "$VENV_DIR" ]; then
        print_step_from_common_functions "Creating Python virtual environment in: $VENV_DIR"

        # Ensure python3-venv is installed
        if ! python3 -m venv --help >/dev/null 2>&1; then
            print_warning_from_common_functions "python3-venv module not available, installing..."
            $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv python3-pip --no-install-recommends
        fi

        # Create the virtual environment
        if python3 -m venv "$VENV_DIR"; then
            print_success_from_common_functions "Virtual environment created successfully"
        else
            print_error_from_common_functions "Failed to create virtual environment"
            return 1
        fi

        # Upgrade pip in venv
        if [ -f "$VENV_PIP3" ]; then
            print_step_from_common_functions "Upgrading pip in virtual environment..."
            "$VENV_PYTHON3" -m pip install --upgrade pip setuptools wheel 2>&1 | head -20 || true
        fi
    else
        print_info_from_common_functions "Virtual environment already exists at: $VENV_DIR"
    fi

    # Verify venv executables exist
    if [ ! -f "$VENV_PYTHON3" ]; then
        print_error_from_common_functions "Virtual environment python3 not found at: $VENV_PYTHON3"
        return 1
    fi

    # Backup and replace system Python commands
    print_step_from_common_functions "Checking and fixing system Python commands..."

    # Handle python3
    if [ -e /usr/local/bin/python3 ]; then
        # Check if it already points to venv
        local current_target=$(readlink -f /usr/local/bin/python3 2>/dev/null || echo "")
        if [ "$current_target" = "$VENV_PYTHON3" ]; then
            print_success_from_common_functions "python3 already points to venv, skipping"
        else
            # Not pointing to venv, need to backup and replace
            if [ ! -e /usr/local/bin/python3_system ]; then
                print_step_from_common_functions "Backing up python3 to python3_system"
                if [ -L /usr/local/bin/python3 ]; then
                    # If it's a symlink, copy the symlink target
                    local link_target=$(readlink /usr/local/bin/python3)
                    $USE_SUDO ln -sf "$link_target" /usr/local/bin/python3_system
                else
                    # If it's a real file, find the actual system python3
                    local system_python3=$(command -v python3 2>/dev/null || echo "/usr/bin/python3")
                    $USE_SUDO ln -sf "$system_python3" /usr/local/bin/python3_system
                fi
                print_success_from_common_functions "Created backup: python3_system"
            fi
            # Replace with venv
            $USE_SUDO rm -f /usr/local/bin/python3
            $USE_SUDO ln -sf "$VENV_PYTHON3" /usr/local/bin/python3
            print_success_from_common_functions "Created symlink: python3 -> $VENV_PYTHON3"
        fi
    else
        # Doesn't exist, check if we need to backup system python3 first
        if command -v python3 >/dev/null 2>&1 && [ ! -e /usr/local/bin/python3_system ]; then
            local system_python3=$(command -v python3)
            print_step_from_common_functions "Backing up system python3 to python3_system"
            $USE_SUDO ln -sf "$system_python3" /usr/local/bin/python3_system
            print_success_from_common_functions "Created backup: python3_system"
        fi
        # Create new symlink
        $USE_SUDO ln -sf "$VENV_PYTHON3" /usr/local/bin/python3
        print_success_from_common_functions "Created symlink: python3 -> $VENV_PYTHON3"
    fi

    # Handle python
    if [ -e /usr/local/bin/python ]; then
        local current_target=$(readlink -f /usr/local/bin/python 2>/dev/null || echo "")
        if [ "$current_target" = "$VENV_PYTHON3" ]; then
            print_success_from_common_functions "python already points to venv, skipping"
        else
            $USE_SUDO rm -f /usr/local/bin/python
            $USE_SUDO ln -sf "$VENV_PYTHON3" /usr/local/bin/python
            print_success_from_common_functions "Created symlink: python -> $VENV_PYTHON3"
        fi
    else
        $USE_SUDO ln -sf "$VENV_PYTHON3" /usr/local/bin/python
        print_success_from_common_functions "Created symlink: python -> $VENV_PYTHON3"
    fi

    # Create pip -> pip3 symlink in venv if it doesn't exist
    if [ -f "$VENV_PIP3" ] && [ ! -e "$VENV_PIP" ]; then
        ln -sf pip3 "$VENV_PIP"
    fi

    # Handle pip3
    if [ -f "$VENV_PIP3" ]; then
        if [ -e /usr/local/bin/pip3 ]; then
            local current_target=$(readlink -f /usr/local/bin/pip3 2>/dev/null || echo "")
            if [ "$current_target" = "$VENV_PIP3" ]; then
                print_success_from_common_functions "pip3 already points to venv, skipping"
            else
                if [ ! -e /usr/local/bin/pip3_system ]; then
                    print_step_from_common_functions "Backing up pip3 to pip3_system"
                    if [ -L /usr/local/bin/pip3 ]; then
                        local link_target=$(readlink /usr/local/bin/pip3)
                        $USE_SUDO ln -sf "$link_target" /usr/local/bin/pip3_system
                    else
                        local system_pip3=$(command -v pip3 2>/dev/null || echo "/usr/bin/pip3")
                        $USE_SUDO ln -sf "$system_pip3" /usr/local/bin/pip3_system
                    fi
                    print_success_from_common_functions "Created backup: pip3_system"
                fi
                $USE_SUDO rm -f /usr/local/bin/pip3
                $USE_SUDO ln -sf "$VENV_PIP3" /usr/local/bin/pip3
                print_success_from_common_functions "Created symlink: pip3 -> $VENV_PIP3"
            fi
        else
            if command -v pip3 >/dev/null 2>&1 && [ ! -e /usr/local/bin/pip3_system ]; then
                local system_pip3=$(command -v pip3)
                print_step_from_common_functions "Backing up system pip3 to pip3_system"
                $USE_SUDO ln -sf "$system_pip3" /usr/local/bin/pip3_system
                print_success_from_common_functions "Created backup: pip3_system"
            fi
            $USE_SUDO ln -sf "$VENV_PIP3" /usr/local/bin/pip3
            print_success_from_common_functions "Created symlink: pip3 -> $VENV_PIP3"
        fi

        # Handle pip
        if [ -e /usr/local/bin/pip ]; then
            local current_target=$(readlink -f /usr/local/bin/pip 2>/dev/null || echo "")
            if [ "$current_target" = "$VENV_PIP3" ]; then
                print_success_from_common_functions "pip already points to venv, skipping"
            else
                if [ ! -e /usr/local/bin/pip_system ]; then
                    print_step_from_common_functions "Backing up pip to pip_system"
                    if [ -L /usr/local/bin/pip ]; then
                        local link_target=$(readlink /usr/local/bin/pip)
                        $USE_SUDO ln -sf "$link_target" /usr/local/bin/pip_system
                    else
                        local system_pip=$(command -v pip 2>/dev/null || echo "/usr/bin/pip")
                        $USE_SUDO ln -sf "$system_pip" /usr/local/bin/pip_system
                    fi
                    print_success_from_common_functions "Created backup: pip_system"
                fi
                $USE_SUDO rm -f /usr/local/bin/pip
                $USE_SUDO ln -sf "$VENV_PIP3" /usr/local/bin/pip
                print_success_from_common_functions "Created symlink: pip -> $VENV_PIP3"
            fi
        else
            if command -v pip >/dev/null 2>&1 && [ ! -e /usr/local/bin/pip_system ]; then
                local system_pip=$(command -v pip)
                print_step_from_common_functions "Backing up system pip to pip_system"
                $USE_SUDO ln -sf "$system_pip" /usr/local/bin/pip_system
                print_success_from_common_functions "Created backup: pip_system"
            fi
            $USE_SUDO ln -sf "$VENV_PIP3" /usr/local/bin/pip
            print_success_from_common_functions "Created symlink: pip -> $VENV_PIP3"
        fi
    fi

    print_success_from_common_functions "Python venv setup and system command replacement complete!"
    print_info_from_common_functions "Virtual environment: $VENV_DIR"
    print_info_from_common_functions "System commands now point to venv binaries"
    print_info_from_common_functions "Backup commands: python3_system, pip3_system, pip_system"

    return 0
}

# Function to setup Python venv for production server with high Python version
setup_production_python_venv() {
    print_step_from_common_functions "Setting up Python venv for production server..."

    local python_venv_dir="$COMPILE_DIR/python_venv"
    local python_version_major=""
    local python_version_minor=""
    local system_python3_path=""

    if command -v python3 >/dev/null 2>&1; then
        system_python3_path=$(command -v python3)
        python_version_major=$(python3 -c 'import sys; print(sys.version_info.major)' 2>/dev/null || echo "0")
        python_version_minor=$(python3 -c 'import sys; print(sys.version_info.minor)' 2>/dev/null || echo "0")
    else
        print_error_from_common_functions "Python3 not found, cannot setup venv"
        return 1
    fi

    local python_version_full="${python_version_major}.${python_version_minor}"
    print_info_from_common_functions "Detected Python version: $python_version_full (path: $system_python3_path)"

    if [ "$python_version_major" -lt 3 ]; then
        print_error_from_common_functions "Python version too old: $python_version_full"
        return 1
    fi

    if [ "$python_version_major" -eq 3 ] && [ "$python_version_minor" -le 11 ]; then
        print_info_from_common_functions "Python version $python_version_full is acceptable (<=3.11), skipping venv setup"
        print_step_from_common_functions "Ensuring Python symlinks are correct for all versions..."
        fix_python_links
        return 0
    fi

    print_warning_from_common_functions "Python version $python_version_full is higher than 3.11"
    print_step_from_common_functions "Creating Python venv in: $python_venv_dir"

    if [ -d "$python_venv_dir" ] && [ -f "$python_venv_dir/bin/python3" ]; then
        print_info_from_common_functions "Python venv already exists at: $python_venv_dir"
        print_step_from_common_functions "Verifying existing venv..."
    else
        print_step_from_common_functions "Creating new Python venv..."

        if [ ! -d "$COMPILE_DIR" ]; then
            print_step_from_common_functions "Creating compile directory: $COMPILE_DIR"
            $USE_SUDO mkdir -p "$COMPILE_DIR"
            $USE_SUDO chmod 755 "$COMPILE_DIR"
        fi

        print_step_from_common_functions "Ensuring python3-venv and pip are installed..."
        if ! python3 -m venv --help >/dev/null 2>&1; then
            print_warning_from_common_functions "python3-venv module not available, installing..."
            $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv python3-pip python3-setuptools python3-wheel --no-install-recommends || true
        fi

        if ! python3 -m pip --version >/dev/null 2>&1; then
            print_warning_from_common_functions "pip module not available, installing..."
            $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-pip python3-setuptools --no-install-recommends || true
        fi

        print_step_from_common_functions "Creating venv with system Python3: $system_python3_path"

        local venv_created=false

        if $system_python3_path -m venv "$python_venv_dir" 2>/dev/null; then
            print_success_from_common_functions "Python venv created successfully"
            venv_created=true
        else
            print_warning_from_common_functions "Standard venv creation failed, trying alternative methods..."

            if python3 -m venv --system-site-packages "$python_venv_dir" 2>/dev/null; then
                print_success_from_common_functions "Python venv created with --system-site-packages"
                venv_created=true
            elif python3 -m venv --without-pip "$python_venv_dir" 2>/dev/null; then
                print_success_from_common_functions "Python venv created without pip (will install manually)"
                venv_created=true

                print_step_from_common_functions "Manually installing pip into venv..."
                if command -v wget >/dev/null 2>&1; then
                    wget -q -O "$python_venv_dir/get-pip.py" https://bootstrap.pypa.io/get-pip.py 2>/dev/null || true
                    if [ -f "$python_venv_dir/get-pip.py" ]; then
                        "$python_venv_dir/bin/python3" "$python_venv_dir/get-pip.py" 2>/dev/null || true
                        rm -f "$python_venv_dir/get-pip.py"
                        print_success_from_common_functions "pip installed manually"
                    fi
                elif command -v curl >/dev/null 2>&1; then
                    curl -sS -o "$python_venv_dir/get-pip.py" https://bootstrap.pypa.io/get-pip.py 2>/dev/null || true
                    if [ -f "$python_venv_dir/get-pip.py" ]; then
                        "$python_venv_dir/bin/python3" "$python_venv_dir/get-pip.py" 2>/dev/null || true
                        rm -f "$python_venv_dir/get-pip.py"
                        print_success_from_common_functions "pip installed manually"
                    fi
                fi
            else
                print_error_from_common_functions "All venv creation methods failed"
                print_info_from_common_functions "Will continue with system Python instead"
                return 1
            fi
        fi

        if [ "$venv_created" = true ]; then
            print_step_from_common_functions "Installing essential packages in venv..."
            if [ -f "$python_venv_dir/bin/pip3" ]; then
                "$python_venv_dir/bin/pip3" install --upgrade pip setuptools wheel 2>&1 | head -20 || true
            elif [ -f "$python_venv_dir/bin/pip" ]; then
                "$python_venv_dir/bin/pip" install --upgrade pip setuptools wheel 2>&1 | head -20 || true
            else
                print_warning_from_common_functions "pip not available in venv, skipping package installation"
            fi
        fi
    fi

    local venv_python3="$python_venv_dir/bin/python3"
    local venv_pip3="$python_venv_dir/bin/pip3"
    local venv_pip="$python_venv_dir/bin/pip"

    if [ ! -f "$venv_python3" ]; then
        print_error_from_common_functions "Python venv python3 binary not found at: $venv_python3"
        return 1
    fi

    local pip_binary=""
    if [ -f "$venv_pip3" ]; then
        pip_binary="$venv_pip3"
        print_info_from_common_functions "Found pip3 in venv: $venv_pip3"
    elif [ -f "$venv_pip" ]; then
        pip_binary="$venv_pip"
        print_info_from_common_functions "Found pip in venv: $venv_pip"
        if [ ! -f "$venv_pip3" ]; then
            print_step_from_common_functions "Creating pip3 symlink in venv..."
            ln -sf "$venv_pip" "$venv_pip3" 2>/dev/null || true
        fi
    else
        print_warning_from_common_functions "pip not found in venv, but python3 exists"
    fi

    print_step_from_common_functions "Setting +x permissions on venv binaries..."
    $USE_SUDO chmod +x "$venv_python3" 2>/dev/null || chmod +x "$venv_python3"
    if [ -n "$pip_binary" ] && [ -f "$pip_binary" ]; then
        $USE_SUDO chmod +x "$pip_binary" 2>/dev/null || chmod +x "$pip_binary"
    fi
    if [ -f "$venv_pip3" ] && [ "$pip_binary" != "$venv_pip3" ]; then
        $USE_SUDO chmod +x "$venv_pip3" 2>/dev/null || chmod +x "$venv_pip3"
    fi

    print_step_from_common_functions "Setting up global symlinks to venv Python..."

    if [ -L /usr/local/bin/python3 ] || [ -f /usr/local/bin/python3 ]; then
        $USE_SUDO rm -f /usr/local/bin/python3
    fi
    $USE_SUDO ln -sf "$venv_python3" /usr/local/bin/python3
    print_success_from_common_functions "Created symlink: /usr/local/bin/python3 -> $venv_python3"

    if [ -n "$pip_binary" ] && [ -f "$pip_binary" ]; then
        if [ -L /usr/local/bin/pip3 ] || [ -f /usr/local/bin/pip3 ]; then
            $USE_SUDO rm -f /usr/local/bin/pip3
        fi
        $USE_SUDO ln -sf "$pip_binary" /usr/local/bin/pip3
        print_success_from_common_functions "Created symlink: /usr/local/bin/pip3 -> $pip_binary"
    fi

    if [ -L /usr/local/bin/python ] || [ -f /usr/local/bin/python ]; then
        $USE_SUDO rm -f /usr/local/bin/python
    fi
    $USE_SUDO ln -sf "$venv_python3" /usr/local/bin/python
    print_success_from_common_functions "Created symlink: /usr/local/bin/python -> $venv_python3"

    if [ -n "$pip_binary" ] && [ -f "$pip_binary" ]; then
        if [ -L /usr/local/bin/pip ] || [ -f /usr/local/bin/pip ]; then
            $USE_SUDO rm -f /usr/local/bin/pip
        fi
        $USE_SUDO ln -sf "$pip_binary" /usr/local/bin/pip
        print_success_from_common_functions "Created symlink: /usr/local/bin/pip -> $pip_binary"
    fi

    print_success_from_common_functions "Production Python venv setup complete!"
    print_info_from_common_functions "Python venv location: $python_venv_dir"
    print_info_from_common_functions "System Python version: $python_version_full"
    print_info_from_common_functions "Global python3/pip3 now point to venv binaries"
    print_info_from_common_functions "Venv allows isolated package management for production"

    return 0
}

# Main function
main() {
    local needs_install=false

    print_step_from_common_functions "Checking Python environment status..."
    print_info_from_common_functions "Environment type: IS_PRODUCTION=$IS_PRODUCTION, IS_WSL=$IS_WSL, HAS_DESKTOP_ENVIRONMENT=$HAS_DESKTOP_ENVIRONMENT"

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

    # Create Python venv and replace system commands
    print_header_from_common_functions "Python Virtual Environment Setup"
    if ! create_python_venv_and_replace_system; then
        print_warning_from_common_functions "Failed to setup Python venv"
        print_warning_from_common_functions "Falling back to system Python..."

        # Fallback: Fix Python symlinks for system Python
        if ! fix_python_links; then
            print_warning_from_common_functions "Failed to fix some Python symlinks"
        fi
    fi

    # Verify installation
    print_step_from_common_functions "Final verification..."
    if ! verify_installation; then
        print_error_from_common_functions "Verification failed - some components are missing"
        return 1
    fi

    print_success_from_common_functions "Python environment setup complete!"
    if [ -d "$VENV_DIR" ] && [ -f "$VENV_PYTHON3" ]; then
        print_info_from_common_functions "Using Python virtual environment: $VENV_DIR"
        print_info_from_common_functions "System commands (python, python3, pip, pip3) now point to venv"
        print_info_from_common_functions "Backup commands available: python3_system, pip3_system, pip_system"
    else
        print_info_from_common_functions "Using system Python directly (no virtual environment)"
    fi
    print_info_from_common_functions "Tools available: python, python3, pip, pip3"

    return 0
}

# Execute main function
main
exit $?
