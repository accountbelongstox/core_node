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

    # Install Python and essential packages (base packages first)
    print_step_from_common_functions "Installing Python3 base packages..."

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
        --no-install-recommends 2>&1 || {
            print_warning_from_common_functions "Some base packages may have failed to install, continuing..."
        }

    # Now detect Python version AFTER installation
    local py_major=$(python3 -c 'import sys; print(sys.version_info.major)' 2>/dev/null || echo "3")
    local py_minor=$(python3 -c 'import sys; print(sys.version_info.minor)' 2>/dev/null || echo "12")
    local py_version="${py_major}.${py_minor}"
    local version_specific_tk="python${py_version}-tk"

    print_info_from_common_functions "Detected Python version: ${py_version}"
    print_info_from_common_functions "Version-specific tkinter package: ${version_specific_tk}"

    # Install GUI and system packages with version-specific tk
    print_step_from_common_functions "Installing GUI and system packages..."
    $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y \
        python3-tk \
        ${version_specific_tk} \
        tk-dev \
        tcl-dev \
        python3-gi \
        python3-gi-cairo \
        python3-pil \
        python3-pil.imagetk \
        gir1.2-appindicator3-0.1 \
        gir1.2-gtk-3.0 \
        --no-install-recommends 2>&1 || {
            print_warning_from_common_functions "Some GUI packages may have failed to install, continuing..."
        }

    # Verify installations
    if python3 -V >/dev/null 2>&1; then
        print_success_from_common_functions "Python3 installed: $(python3 -V 2>&1)"
        PYTHON_INSTALLED=true
    else
        print_error_from_common_functions "Failed to install Python3"
        return 1
    fi

    if pip3 -V >/dev/null 2>&1 || python3 -m pip --version >/dev/null 2>&1; then
        print_success_from_common_functions "pip3 installed: $(pip3 -V 2>&1 || python3 -m pip --version 2>&1)"
        PIP_INSTALLED=true
    else
        print_warning_from_common_functions "pip3 not available, attempting ensurepip"
        if python3 -m ensurepip --upgrade >/dev/null 2>&1; then
            if command -v pip3 >/dev/null 2>&1 || python3 -m pip --version >/dev/null 2>&1; then
                print_success_from_common_functions "pip3 installed via ensurepip"
                PIP_INSTALLED=true
            else
                print_warning_from_common_functions "ensurepip ran but pip3 still missing; attempting direct package install"
                $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-pip --no-install-recommends || true
                if command -v pip3 >/dev/null 2>&1 || python3 -m pip --version >/dev/null 2>&1; then
                    print_success_from_common_functions "pip3 installed via apt after ensurepip"
                    PIP_INSTALLED=true
                else
                    print_error_from_common_functions "Failed to install pip3"
                    return 1
                fi
            fi
        else
            fix_apt_gpg_if_needed
            $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-pip --no-install-recommends || true
            if command -v pip3 >/dev/null 2>&1 || python3 -m pip --version >/dev/null 2>&1; then
                print_success_from_common_functions "pip3 installed after fixing APT keys"
                PIP_INSTALLED=true
            else
                print_error_from_common_functions "Failed to install pip3"
                return 1
            fi
        fi
    fi

    $USE_SUDO apt-get clean
    $USE_SUDO rm -rf /var/lib/apt/lists/*

    print_success_from_common_functions "Python essentials installed successfully"
    return 0
}

# Function to upgrade pip with official PyPI only
upgrade_pip_official() {
    local pip_cmd="$1"
    local python_cmd="$2"

    print_step_from_common_functions "Upgrading pip to latest version using official PyPI..."

    if [ -z "$pip_cmd" ] || [ ! -f "$pip_cmd" ]; then
        print_warning_from_common_functions "pip binary not found at: $pip_cmd"
        return 1
    fi

    print_step_from_common_functions "Executing command: $python_cmd -m pip install --upgrade pip --index-url https://pypi.org/simple/"

    # IDEMPOTENCY: Always upgrade pip to ensure latest version
    # Use --no-user to force system-level installation (not /var/_core_node/Users)
    if $python_cmd -m pip install --upgrade pip --index-url https://pypi.org/simple/ --break-system-packages --no-user --ignore-installed 2>&1 | grep -v "WARNING\|Retrying" | head -20; then
        print_success_from_common_functions "pip upgraded successfully using official PyPI"
        return 0
    else
        print_warning_from_common_functions "pip upgrade failed, continuing with existing pip version"
        return 1
    fi
}

# Function to install required Python packages with official PyPI only
install_python_packages_official() {
    local pip_cmd="$1"
    local python_cmd="$2"
    shift 2
    local packages=("$@")

    if [ -z "$pip_cmd" ] || [ ! -f "$pip_cmd" ]; then
        print_warning_from_common_functions "pip binary not found, skipping package installation"
        return 1
    fi

    if [ ${#packages[@]} -eq 0 ]; then
        print_info_from_common_functions "No packages to install"
        return 0
    fi

    print_step_from_common_functions "Installing Python packages using official PyPI: ${packages[*]}"

    print_step_from_common_functions "Executing command: $python_cmd -m pip install --upgrade ${packages[*]} --index-url https://pypi.org/simple/"

    # IDEMPOTENCY: Always check and install/upgrade packages
    # Use --no-user to force system-level installation (not /var/_core_node/Users)
    if $python_cmd -m pip install --upgrade --index-url https://pypi.org/simple/ --break-system-packages --no-user --ignore-installed "${packages[@]}" 2>&1 | grep -v "WARNING\|Retrying" | head -30; then
        print_success_from_common_functions "Packages installed successfully using official PyPI"
        return 0
    else
        print_warning_from_common_functions "Package installation failed, continuing anyway"
        return 1
    fi
}

# Function to set pip mirror to official PyPI
set_pip_mirror() {
    print_step_from_common_functions "Configuring pip to use official PyPI..."

    local pip_conf_dir="$HOME/.pip"
    local pip_conf_file="$pip_conf_dir/pip.conf"

    mkdir -p "$pip_conf_dir"

    print_step_from_common_functions "Always using official PyPI for maximum reliability"
    cat > "$pip_conf_file" <<EOF
[global]
index-url = https://pypi.org/simple/
timeout = 120
retries = 5
EOF
    print_success_from_common_functions "pip configured to use official PyPI: https://pypi.org/simple/"
    print_info_from_common_functions "pip configuration file: $pip_conf_file"

    return 0
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

# Function to check if venv needs rebuild
check_venv_needs_rebuild() {
    local venv_dir="$1"
    local rebuild_needed=false

    # Check if venv exists
    if [ ! -d "$venv_dir" ]; then
        echo "true"  # Needs creation
        return 0
    fi

    # Check if venv has --system-site-packages enabled
    # This file exists if venv was created with --system-site-packages
    if [ ! -f "$venv_dir/pyvenv.cfg" ]; then
        print_warning_from_common_functions "venv config file missing, rebuild needed"
        echo "true"
        return 0
    fi

    # Check if system-site-packages is enabled
    if ! grep -q "include-system-site-packages = true" "$venv_dir/pyvenv.cfg" 2>/dev/null; then
        print_warning_from_common_functions "venv does not have system-site-packages enabled, rebuild needed"
        echo "true"
        return 0
    fi

    # Check if venv python can import tkinter and tkinter.ttk (test system packages)
    if [ -f "$venv_dir/bin/python3" ]; then
        # Test basic tkinter
        if ! "$venv_dir/bin/python3" -c "import tkinter" 2>/dev/null; then
            print_warning_from_common_functions "venv python cannot import tkinter, rebuild needed"
            echo "true"
            return 0
        fi

        # Test tkinter.ttk (common issue with incomplete tkinter installation)
        if ! "$venv_dir/bin/python3" -c "import tkinter.ttk" 2>/dev/null; then
            print_warning_from_common_functions "venv python cannot import tkinter.ttk, rebuild needed"
            echo "true"
            return 0
        fi

        # Test _tkinter (underlying C module)
        if ! "$venv_dir/bin/python3" -c "import _tkinter" 2>/dev/null; then
            print_warning_from_common_functions "venv python cannot import _tkinter (C module), rebuild needed"
            echo "true"
            return 0
        fi
    fi

    echo "false"
    return 0
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

    # Check if venv needs rebuild
    local rebuild_needed=$(check_venv_needs_rebuild "$VENV_DIR")
    local venv_was_rebuilt=false
    local user_wants_rebuild=false

    # Interactive prompt: Always ask user if they want to rebuild venv (except for first time)
    # Default is Y because there might be new packages to install
    if [ ! -d "$VENV_DIR" ]; then
        # Venv doesn't exist, must create (no prompt needed)
        print_step_from_common_functions "Virtual environment does not exist. Creating new one..."
        user_wants_rebuild=true
    else
        # Venv exists - always ask if user wants to rebuild
        if [ "$rebuild_needed" = "true" ]; then
            print_warning_from_common_functions "Virtual environment needs rebuild (tkinter or system packages changed)"
        else
            print_info_from_common_functions "Virtual environment exists and appears up-to-date"
        fi

        print_step_from_common_functions "Rebuild virtual environment? [n/Y] (press Y only if you added new packages)"
        read -r response </dev/tty
        response=${response:-n}  # Default to n if user just presses Enter

        if [[ "$response" =~ ^[Yy]$ ]]; then
            user_wants_rebuild=true
        else
            print_info_from_common_functions "Skipping venv rebuild. Using existing venv."
            user_wants_rebuild=false
        fi
    fi

    if [ "$user_wants_rebuild" = "true" ]; then
        venv_was_rebuilt=true
        if [ -d "$VENV_DIR" ]; then
            print_step_from_common_functions "Rebuilding Python virtual environment (old venv will be backed up)..."

            # Remove old symlinks that point to old venv BEFORE backing up
            # NOTE: We only manage /usr/local/bin/python, NOT python3 (python3 stays system default)
            print_step_from_common_functions "Removing old venv symlinks..."
            $USE_SUDO rm -f /usr/local/bin/python \
                             /usr/local/bin/pip /usr/local/bin/pip3 2>/dev/null || true

            # Backup old venv
            local backup_dir="${VENV_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
            mv "$VENV_DIR" "$backup_dir" 2>/dev/null || true
            print_info_from_common_functions "Old venv backed up to: $backup_dir"
        else
            print_step_from_common_functions "Creating new Python virtual environment in: $VENV_DIR"
        fi

        # Ensure python3-venv is installed
        if ! python3 -m venv --help >/dev/null 2>&1; then
            print_warning_from_common_functions "python3-venv module not available, installing..."
            $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv python3-pip --no-install-recommends
        fi

        # Create the virtual environment WITH system-site-packages
        # This allows venv to use system packages like python3.12-tk
        print_step_from_common_functions "Creating venv with --system-site-packages (allows access to system tkinter, PIL, etc.)..."
        if python3 -m venv --system-site-packages "$VENV_DIR"; then
            print_success_from_common_functions "Virtual environment created successfully with system-site-packages"
        else
            print_error_from_common_functions "Failed to create virtual environment"
            return 1
        fi

        # Upgrade pip in venv - always run to ensure latest version
        if [ -f "$VENV_PIP3" ]; then
            print_step_from_common_functions "Upgrading pip in virtual environment..."
            upgrade_pip_official "$VENV_PIP3" "$VENV_PYTHON3"

            print_step_from_common_functions "Installing essential packages in venv..."
            install_python_packages_official "$VENV_PIP3" "$VENV_PYTHON3" setuptools wheel
        fi
    else
        print_info_from_common_functions "Virtual environment already exists and is up-to-date: $VENV_DIR"
    fi

    # IMPORTANT: Always upgrade pip and essential packages, even if venv was not rebuilt
    # This ensures pip is always up-to-date and packages are fixed on every run
    print_step_from_common_functions "Ensuring pip and essential packages are up-to-date in venv..."
    if [ -f "$VENV_PIP3" ]; then
        upgrade_pip_official "$VENV_PIP3" "$VENV_PYTHON3"
        install_python_packages_official "$VENV_PIP3" "$VENV_PYTHON3" setuptools wheel
    fi

    # Verify venv executables exist
    if [ ! -f "$VENV_PYTHON3" ]; then
        print_error_from_common_functions "Virtual environment python3 not found at: $VENV_PYTHON3"
        return 1
    fi

    # IMPORTANT: Always refresh symlinks, even if venv was not rebuilt
    # This ensures that 'python' and 'pip' always point to the correct venv,
    # even if system packages were updated or symlinks were modified manually
    print_step_from_common_functions "Refreshing Python command symlinks..."

    # ============================================================================
    # IMPORTANT: python3 command stays as system default
    # We do NOT create /usr/local/bin/python3 symlink
    # System's /usr/bin/python3 will be used when user runs 'python3'
    # ============================================================================

    # Clean up any old python3 symlink if it exists (from previous versions of this script)
    if [ -L /usr/local/bin/python3 ]; then
        print_warning_from_common_functions "Removing old python3 symlink (python3 should use system default)"
        $USE_SUDO rm -f /usr/local/bin/python3
        print_info_from_common_functions "python3 command will now use system Python: /usr/bin/python3"
    fi

    # ============================================================================
    # Handle 'python' command - ALWAYS refresh, pointing to venv
    # ============================================================================
    print_step_from_common_functions "Refreshing 'python' command to point to venv..."

    # Always remove and recreate (refresh every time)
    $USE_SUDO rm -f /usr/local/bin/python
    $USE_SUDO ln -sf "$VENV_PYTHON3" /usr/local/bin/python
    print_success_from_common_functions "Created symlink: python -> $VENV_PYTHON3"

    # ============================================================================
    # Handle 'pip' and 'pip3' commands
    # Same as python: pip3 stays system default, pip points to venv
    # ============================================================================

    # Create pip -> pip3 symlink inside venv if it doesn't exist
    if [ -f "$VENV_PIP3" ] && [ ! -e "$VENV_PIP" ]; then
        ln -sf pip3 "$VENV_PIP"
    fi

    # Clean up any old pip3 symlink if it exists
    if [ -L /usr/local/bin/pip3 ]; then
        print_warning_from_common_functions "Removing old pip3 symlink (pip3 should use system default)"
        $USE_SUDO rm -f /usr/local/bin/pip3
        print_info_from_common_functions "pip3 command will now use system pip3"
    fi

    # Handle 'pip' command - ALWAYS refresh, pointing to venv
    if [ -f "$VENV_PIP3" ]; then
        print_step_from_common_functions "Refreshing 'pip' command to point to venv..."

        # Always remove and recreate (refresh every time)
        $USE_SUDO rm -f /usr/local/bin/pip
        $USE_SUDO ln -sf "$VENV_PIP3" /usr/local/bin/pip
        print_success_from_common_functions "Created symlink: pip -> $VENV_PIP3"
    fi

    print_success_from_common_functions "Python venv setup and system command replacement complete!"
    print_info_from_common_functions "Virtual environment: $VENV_DIR"
    print_info_from_common_functions ""
    print_info_from_common_functions "Command mapping:"
    print_info_from_common_functions "  python3  -> System Python (/usr/bin/python3)"
    print_info_from_common_functions "  python   -> Venv Python ($VENV_PYTHON3)"
    print_info_from_common_functions "  pip3     -> System pip3"
    print_info_from_common_functions "  pip      -> Venv pip ($VENV_PIP3)"

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
                upgrade_pip_official "$python_venv_dir/bin/pip3" "$python_venv_dir/bin/python3"
                install_python_packages_official "$python_venv_dir/bin/pip3" "$python_venv_dir/bin/python3" setuptools wheel
            elif [ -f "$python_venv_dir/bin/pip" ]; then
                upgrade_pip_official "$python_venv_dir/bin/pip" "$python_venv_dir/bin/python3"
                install_python_packages_official "$python_venv_dir/bin/pip" "$python_venv_dir/bin/python3" setuptools wheel
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

    # IMPORTANT: Always upgrade pip and packages, even if venv already exists
    # This ensures packages are always up-to-date on every run
    print_step_from_common_functions "Ensuring pip and packages are up-to-date in production venv..."
    if [ -f "$venv_pip3" ]; then
        upgrade_pip_official "$venv_pip3" "$venv_python3"
        install_python_packages_official "$venv_pip3" "$venv_python3" setuptools wheel
    elif [ -f "$venv_pip" ]; then
        upgrade_pip_official "$venv_pip" "$venv_python3"
        install_python_packages_official "$venv_pip" "$venv_python3" setuptools wheel
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

# Function to check and fix urllib3 compatibility for certbot
check_urllib3_for_certbot() {
    print_info_from_common_functions "Checking urllib3 version for certbot compatibility..."

    # Check if certbot is installed
    if ! command -v certbot >/dev/null 2>&1; then
        print_info_from_common_functions "certbot not installed, skipping urllib3 check"
        return 0
    fi

    # Check current urllib3 version
    local current_version=$(python3 -c "import urllib3; print(urllib3.__version__)" 2>/dev/null || echo "not found")
    print_info_from_common_functions "Current urllib3 version: $current_version"

    # Check if DEFAULT_CIPHERS is available (required by certbot 2.1.0)
    if python3 -c "from urllib3.util.ssl_ import DEFAULT_CIPHERS" >/dev/null 2>&1; then
        print_success_from_common_functions "urllib3 is compatible with certbot (has DEFAULT_CIPHERS)"

        # Test certbot
        if certbot plugins >/dev/null 2>&1; then
            print_success_from_common_functions "certbot plugins command works correctly"
            return 0
        else
            print_warning_from_common_functions "certbot has issues despite DEFAULT_CIPHERS present"
        fi
    else
        print_warning_from_common_functions "urllib3 missing DEFAULT_CIPHERS - certbot will fail"
    fi

    # Fix urllib3 if needed
    print_step_from_common_functions "Fixing urllib3 compatibility for certbot..."
    print_info_from_common_functions "Installing urllib3 1.26.18 (last version with DEFAULT_CIPHERS)..."

    # Remove incompatible versions
    $USE_SUDO pip3 uninstall -y urllib3 >/dev/null 2>&1 || true

    # Install compatible version
    if python3 -m pip install --break-system-packages --no-user urllib3==1.26.18 >/dev/null 2>&1; then
        local new_version=$(python3 -c "import urllib3; print(urllib3.__version__)" 2>/dev/null)
        print_success_from_common_functions "urllib3 $new_version installed successfully"

        # Verify DEFAULT_CIPHERS
        if python3 -c "from urllib3.util.ssl_ import DEFAULT_CIPHERS" >/dev/null 2>&1; then
            print_success_from_common_functions "DEFAULT_CIPHERS verified"

            # Test certbot
            if certbot plugins >/dev/null 2>&1; then
                print_success_from_common_functions "certbot compatibility fixed"
            else
                print_warning_from_common_functions "certbot still has issues, may need manual fix"
            fi
        else
            print_warning_from_common_functions "DEFAULT_CIPHERS still not available"
        fi
    else
        print_warning_from_common_functions "Failed to install urllib3 1.26.18"
    fi

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
    else
        print_info_from_common_functions "Python and pip are already installed"
    fi

    # IMPORTANT: Always set pip mirror on every run to ensure correct configuration
    set_pip_mirror

    # IMPORTANT: Always fix Python symlinks on every run to ensure correct setup
    print_step_from_common_functions "Ensuring Python symlinks are correct..."
    fix_python_links

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

    # IDEMPOTENCY: Check and fix urllib3 compatibility for certbot
    print_step_from_common_functions "Checking urllib3 compatibility for certbot..."
    check_urllib3_for_certbot

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
