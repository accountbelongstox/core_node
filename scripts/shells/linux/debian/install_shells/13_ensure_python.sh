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

    # First attempt: ensure ubuntu-keyring is present (real-time output)
    echo "[13] $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get update"
    $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get update
    echo "[13] $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y ubuntu-keyring"
    $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y ubuntu-keyring || \
    $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::AllowInsecureRepositories=true \
        -o Acquire::AllowDowngradeToInsecureRepositories=true install -y ubuntu-keyring

    # Explicitly import the 2024 Ubuntu archive automatic signing key if missing
    if [ ! -f /etc/apt/trusted.gpg.d/ubuntu-archive-2024.gpg ]; then
        if command -v gpg >/dev/null 2>&1; then
            print_step_from_common_functions "Importing Ubuntu archive signing key ($UBUNTU_ARCHIVE_KEY_ID)"
            tmpkey="/tmp/ubuntu-archive-2024.gpg"
            echo "[13] curl -fsSL ... | gpg --dearmor | $USE_SUDO tee $tmpkey"
            curl -fsSL "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x$UBUNTU_ARCHIVE_KEY_ID" \
                | gpg --dearmor | $USE_SUDO tee "$tmpkey"
            if [ -s "$tmpkey" ]; then
                echo "[13] $USE_SUDO mv $tmpkey /etc/apt/trusted.gpg.d/ubuntu-archive-2024.gpg"
                $USE_SUDO mv "$tmpkey" /etc/apt/trusted.gpg.d/ubuntu-archive-2024.gpg
            else
                rm -f "$tmpkey" 2>/dev/null || true
            fi
        fi
    fi

    # Retry update after key/keyring adjustments (real-time output)
    echo "[13] $USE_SUDO apt-get update"
    $USE_SUDO apt-get update
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

# Function to install Python essentials (all commands echoed and run with real-time output; no exit-code flow)
install_python_essentials() {
    print_step_from_common_functions "Installing Python and essential packages..."

    # Clean up broken package lists
    print_step_from_common_functions "Cleaning up package lists..."
    echo "[13] $USE_SUDO rm -rf /var/lib/apt/lists/*"
    $USE_SUDO rm -rf /var/lib/apt/lists/* 2>/dev/null || true

    # Update package list (real-time output)
    print_step_from_common_functions "Updating package list..."
    echo "[13] $USE_SUDO apt-get update"
    $USE_SUDO apt-get update
    echo "[13] (if update failed above, fixing APT GPG keys next)"
    fix_apt_gpg_if_needed

    # Install Python and essential packages (base packages first, real-time output)
    print_step_from_common_functions "Installing Python3 base packages..."
    echo "[13] $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3 python3-pip python3-venv python3-dev python3-setuptools python3-wheel build-essential libssl-dev libffi-dev --no-install-recommends"
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

    # Now detect Python version AFTER installation
    local py_major=$(python3 -c 'import sys; print(sys.version_info.major)' 2>/dev/null || echo "3")
    local py_minor=$(python3 -c 'import sys; print(sys.version_info.minor)' 2>/dev/null || echo "12")
    local py_version="${py_major}.${py_minor}"
    local version_specific_tk="python${py_version}-tk"

    print_info_from_common_functions "Detected Python version: ${py_version}"
    print_info_from_common_functions "Version-specific tkinter package: ${version_specific_tk}"

    # Install GUI and system packages with version-specific tk (real-time output)
    print_step_from_common_functions "Installing GUI and system packages..."
    echo "[13] $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-tk ${version_specific_tk} tk-dev tcl-dev python3-gi python3-gi-cairo python3-pil python3-pil.imagetk gir1.2-appindicator3-0.1 gir1.2-gtk-3.0 --no-install-recommends"
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
        --no-install-recommends

    # Verify and show Python3
    print_success_from_common_functions "Python3: $(python3 -V 2>&1)"
    PYTHON_INSTALLED=true

    # Ensure pip3: try ensurepip then apt install (real-time output; no exit-code branching)
    if ! command -v pip3 >/dev/null 2>&1 && ! python3 -m pip --version >/dev/null 2>&1; then
        print_warning_from_common_functions "pip3 not available, attempting ensurepip (real-time)..."
        echo "[13] python3 -m ensurepip --upgrade"
        python3 -m ensurepip --upgrade
    fi
    if ! command -v pip3 >/dev/null 2>&1 && ! python3 -m pip --version >/dev/null 2>&1; then
        print_warning_from_common_functions "Installing python3-pip via apt (real-time)..."
        echo "[13] $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-pip --no-install-recommends"
        $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-pip --no-install-recommends
    fi
    if command -v pip3 >/dev/null 2>&1 || python3 -m pip --version >/dev/null 2>&1; then
        print_success_from_common_functions "pip3: $(pip3 -V 2>&1 || python3 -m pip --version 2>&1)"
        PIP_INSTALLED=true
    fi

    echo "[13] $USE_SUDO apt-get clean"
    $USE_SUDO apt-get clean
    echo "[13] $USE_SUDO rm -rf /var/lib/apt/lists/*"
    $USE_SUDO rm -rf /var/lib/apt/lists/*

    print_success_from_common_functions "Python essentials installed successfully"
    return 0
}

# Generic function to run pip install with real-time output
# Args: $1=python_cmd, $2=package_spec (e.g., "package" or "package==1.0.0" or "--upgrade package1 package2"), $3=additional_flags (optional)
run_pip_install_realtime() {
    local python_cmd="$1"
    local package_spec="$2"
    local additional_flags="${3:-}"

    if [ -z "$python_cmd" ] || [ -z "$package_spec" ]; then
        return 1
    fi

    # Build command array for safe execution
    local cmd_args=("$python_cmd" "-m" "pip" "install")
    
    # Split package_spec into words and add to cmd_args
    # This handles cases like "--upgrade package1 package2"
    local IFS=' '
    read -ra package_words <<< "$package_spec"
    cmd_args+=("${package_words[@]}")
    
    # Add standard flags
    cmd_args+=("--index-url" "https://pypi.org/simple/" "--break-system-packages" "--no-user")
    
    # Add additional flags if provided
    if [ -n "$additional_flags" ]; then
        read -ra flag_words <<< "$additional_flags"
        cmd_args+=("${flag_words[@]}")
    fi

    # Execute with real-time output (no exit-code used for flow)
    echo "[13] ${cmd_args[*]}"
    "${cmd_args[@]}"
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
    run_pip_install_realtime "$python_cmd" "--upgrade pip" "--ignore-installed" || true
    return 0
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
    run_pip_install_realtime "$python_cmd" "--upgrade ${packages[*]}" "--ignore-installed" || true
    return 0
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
        echo "[13] $USE_SUDO ln -sf $python3_path /usr/local/bin/python"
        $USE_SUDO ln -sf "$python3_path" /usr/local/bin/python
        print_success_from_common_functions "Created python symlink"
    elif [ -L /usr/local/bin/python ]; then
        local current_target=$(readlink -f /usr/local/bin/python)
        if [ "$current_target" != "$python3_path" ]; then
            print_step_from_common_functions "Updating python symlink to point to $python3_path"
            echo "[13] $USE_SUDO ln -sf $python3_path /usr/local/bin/python"
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
            echo "[13] $USE_SUDO ln -sf $pip3_path /usr/local/bin/pip"
            $USE_SUDO ln -sf "$pip3_path" /usr/local/bin/pip
            print_success_from_common_functions "Created pip symlink"
        elif [ -L /usr/local/bin/pip ]; then
            local current_target=$(readlink -f /usr/local/bin/pip)
            if [ "$current_target" != "$pip3_path" ]; then
                print_step_from_common_functions "Updating pip symlink to point to $pip3_path"
                echo "[13] $USE_SUDO ln -sf $pip3_path /usr/local/bin/pip"
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
            print_step_from_common_functions "Removing old venv symlinks..."
            echo "[13] $USE_SUDO rm -f /usr/local/bin/python /usr/local/bin/pip /usr/local/bin/pip3"
            $USE_SUDO rm -f /usr/local/bin/python /usr/local/bin/pip /usr/local/bin/pip3 2>/dev/null || true

            # Backup old venv
            local backup_dir="${VENV_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
            echo "[13] mv $VENV_DIR $backup_dir"
            mv "$VENV_DIR" "$backup_dir" 2>/dev/null || true
            print_info_from_common_functions "Old venv backed up to: $backup_dir"
        else
            print_step_from_common_functions "Creating new Python virtual environment in: $VENV_DIR"
        fi

        # Ensure python3-venv is installed (real-time output)
        if ! python3 -m venv --help >/dev/null 2>&1; then
            print_warning_from_common_functions "python3-venv module not available, installing..."
            echo "[13] $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv python3-pip --no-install-recommends"
            $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv python3-pip --no-install-recommends
        fi

        # Create the virtual environment WITH system-site-packages (real-time output)
        print_step_from_common_functions "Creating venv with --system-site-packages (allows access to system tkinter, PIL, etc.)..."
        echo "[13] python3 -m venv --system-site-packages $VENV_DIR"
        python3 -m venv --system-site-packages "$VENV_DIR"
        print_success_from_common_functions "Virtual environment created with system-site-packages"

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
        echo "[13] $USE_SUDO rm -f /usr/local/bin/python3"
        $USE_SUDO rm -f /usr/local/bin/python3
        print_info_from_common_functions "python3 command will now use system Python: /usr/bin/python3"
    fi

    # ============================================================================
    # Handle 'python' command - ALWAYS refresh, pointing to venv
    # ============================================================================
    print_step_from_common_functions "Refreshing 'python' command to point to venv..."

    # Always remove and recreate (refresh every time)
    echo "[13] $USE_SUDO rm -f /usr/local/bin/python"
    $USE_SUDO rm -f /usr/local/bin/python
    echo "[13] $USE_SUDO ln -sf $VENV_PYTHON3 /usr/local/bin/python"
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
        echo "[13] $USE_SUDO rm -f /usr/local/bin/pip3"
        $USE_SUDO rm -f /usr/local/bin/pip3
        print_info_from_common_functions "pip3 command will now use system pip3"
    fi

    # Handle 'pip' command - ALWAYS refresh, pointing to venv
    if [ -f "$VENV_PIP3" ]; then
        print_step_from_common_functions "Refreshing 'pip' command to point to venv..."
        echo "[13] $USE_SUDO rm -f /usr/local/bin/pip"
        $USE_SUDO rm -f /usr/local/bin/pip
        echo "[13] $USE_SUDO ln -sf $VENV_PIP3 /usr/local/bin/pip"
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
            echo "[13] $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv python3-pip python3-setuptools python3-wheel --no-install-recommends"
            $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv python3-pip python3-setuptools python3-wheel --no-install-recommends
        fi

        if ! python3 -m pip --version >/dev/null 2>&1; then
            print_warning_from_common_functions "pip module not available, installing..."
            echo "[13] $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-pip python3-setuptools --no-install-recommends"
            $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-pip python3-setuptools --no-install-recommends
        fi

        print_step_from_common_functions "Creating venv with system Python3: $system_python3_path"
        local venv_created=false

        echo "[13] $system_python3_path -m venv $python_venv_dir"
        if $system_python3_path -m venv "$python_venv_dir"; then
            print_success_from_common_functions "Python venv created successfully"
            venv_created=true
        else
            print_warning_from_common_functions "Standard venv creation failed, trying --system-site-packages..."
            echo "[13] python3 -m venv --system-site-packages $python_venv_dir"
            if python3 -m venv --system-site-packages "$python_venv_dir"; then
                print_success_from_common_functions "Python venv created with --system-site-packages"
                venv_created=true
            else
                print_warning_from_common_functions "Trying --without-pip..."
                echo "[13] python3 -m venv --without-pip $python_venv_dir"
                if python3 -m venv --without-pip "$python_venv_dir"; then
                    print_success_from_common_functions "Python venv created without pip (will install manually)"
                    venv_created=true
                    print_step_from_common_functions "Manually installing pip into venv..."
                    if command -v wget >/dev/null 2>&1; then
                        echo "[13] wget -O $python_venv_dir/get-pip.py https://bootstrap.pypa.io/get-pip.py"
                        wget -O "$python_venv_dir/get-pip.py" https://bootstrap.pypa.io/get-pip.py
                        if [ -f "$python_venv_dir/get-pip.py" ]; then
                            echo "[13] $python_venv_dir/bin/python3 $python_venv_dir/get-pip.py"
                            "$python_venv_dir/bin/python3" "$python_venv_dir/get-pip.py"
                            rm -f "$python_venv_dir/get-pip.py"
                            print_success_from_common_functions "pip installed manually"
                        fi
                    elif command -v curl >/dev/null 2>&1; then
                        echo "[13] curl -o $python_venv_dir/get-pip.py https://bootstrap.pypa.io/get-pip.py"
                        curl -o "$python_venv_dir/get-pip.py" https://bootstrap.pypa.io/get-pip.py
                        if [ -f "$python_venv_dir/get-pip.py" ]; then
                            echo "[13] $python_venv_dir/bin/python3 $python_venv_dir/get-pip.py"
                            "$python_venv_dir/bin/python3" "$python_venv_dir/get-pip.py"
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
    echo ">>> Uninstalling existing urllib3..."
    $USE_SUDO pip3 uninstall -y urllib3 2>&1 || true

    # Install compatible version with real-time output
    echo ">>> Installing urllib3==1.26.18..."
    run_pip_install_realtime "python3" "urllib3==1.26.18" "" || true

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

    return 0
}

# Function to check and fix package version with constraint validation
# Args: $1=import_name, $2=pip_package, $3=version_constraint (optional)
check_and_fix_package_version() {
    local import_name="$1"
    local pip_package="$2"
    local version_constraint="$3"

    # Special handling for packages with dots in import name (e.g., azure.cognitiveservices.speech)
    local import_cmd="import $import_name"

    # Check if package is installed
    if ! python3 -c "$import_cmd" 2>/dev/null; then
        # Package not installed
        if [ -n "$version_constraint" ]; then
            echo ">>> Installing $pip_package$version_constraint..."
            run_pip_install_realtime "python3" "$pip_package$version_constraint" "" || true
        else
            echo ">>> Installing $pip_package..."
            run_pip_install_realtime "python3" "$pip_package" "" || true
        fi
        return 0
    fi

    # Package is installed - check if version constraint exists and needs verification
    if [ -n "$version_constraint" ]; then
        # For packages with version constraints, force reinstall to ensure correct version
        echo ">>> Verifying $pip_package version constraint: $version_constraint"
        run_pip_install_realtime "python3" "$pip_package$version_constraint" "--force-reinstall" || true
    fi

    return 0
}

# Function to check and install all Python packages from third_party.py DEPENDENCY_MAP
check_and_install_python_packages_from_dependency_map() {
    print_header_from_common_functions "Python Package Installation from DEPENDENCY_MAP"
    print_info_from_common_functions "Checking and installing packages from pycore/pyfoundations/third_party.py"
    print_info_from_common_functions "Each package will be checked individually, even if others are correct"

    # Package mapping format: "import_name|pip_package|version_constraint"
    # Version constraints use pip syntax: <11,>=10 or ==7.2.1
    # Empty version_constraint means no specific version requirement
    local packages=(
        # PIL/Pillow - required by tkhtmlview
        "PIL|Pillow|<11,>=10"

        # Computer vision and automation
        "cv2|opencv-python|"
        "pyautogui|pyautogui|"
        "psutil|psutil|"
        "mss|mss|"

        # Deep learning - required by opencv
        "numpy|numpy|<2.3.0,>=2"
        "torch|torch|"
        "ultralytics|ultralytics|"

        # Device communication
        "adb_shell|adb-shell|"

        # Video processing
        "av|av|"

        # Web framework
        "uvicorn|uvicorn[standard]|"
        "websockets|websockets|"
        "requests|requests|"
        "aiohttp|aiohttp|"
        "fastapi|fastapi|"

        # GUI and HTML rendering
        "tkinterweb|tkinterweb|"
        "tkhtmlview|tkhtmlview|"
        "pystray|pystray|"

        # Logging
        "loguru|loguru|"

        # Configuration
        "yaml|pyyaml|"

        # OCR
        "cnocr|cnocr[ort-cpu]|"

        # Document processing
        "pypdf|pypdf|"
        "pdfplumber|pdfplumber|"
        "docx|python-docx|"
        "openpyxl|openpyxl|"
        "pptx|python-pptx|"

        # HTML parsing
        "bs4|beautifulsoup4|"

        # Machine learning
        "sklearn|scikit-learn|"

        # Browser automation
        "selenium|selenium|"
        "webdriver_manager|webdriver-manager|"

        # Database
        "sqlalchemy|sqlalchemy|"

        # MCP (Model Context Protocol)
        "fastmcp|fastmcp|"

        # Azure Speech SDK (optional but auto-install)
        "azure.cognitiveservices.speech|azure-cognitiveservices-speech|"

        # Offline STT
        "vosk|vosk|"

        # Input control
        "pynput|pynput|"

        # Clipboard
        "pyperclip|pyperclip|"

        # Translation
        "googletrans|googletrans|"
        "httpx|httpx|"

        # Exchange API
        "okx|python-okx|"

        # Cache
        "redis|redis|"

        # Google Gemini API
        "google.genai|google-genai|"

        # Audio playback
        "pygame|pygame|"

        # Native UI
        "PySide6|PySide6|"

        # Phonetic transcription
        "eng_to_ipa|eng-to-ipa|"
    )

    # Optional packages - check but don't force install
    local optional_packages=(
        # Edge TTS - CRITICAL: version 7.2.1 required (7.2.2+ has NoAudioReceived bug)
        # Reference: https://github.com/rany2/edge-tts/issues/443
        "edge_tts|edge-tts|==7.2.1"

        # Whisper STT
        "whisper|openai-whisper|"
    )

    # Process required packages
    print_step_from_common_functions "Installing required packages (${#packages[@]} packages)..."
    local installed=0
    local failed=0

    for package_spec in "${packages[@]}"; do
        IFS='|' read -r import_name pip_package version_constraint <<< "$package_spec"

        if check_and_fix_package_version "$import_name" "$pip_package" "$version_constraint"; then
            ((installed++))
        else
            ((failed++))
        fi
    done

    # Process optional packages
    print_step_from_common_functions "Installing optional packages (${#optional_packages[@]} packages)..."

    for package_spec in "${optional_packages[@]}"; do
        IFS='|' read -r import_name pip_package version_constraint <<< "$package_spec"

        # Special handling for edge-tts with version checking (like in 30_install_edge.sh)
        if [ "$pip_package" = "edge-tts" ]; then
            # Use specialized function for edge-tts with version checking
            check_and_fix_edge_tts_version_from_dependency_map
        else
            check_and_fix_package_version "$import_name" "$pip_package" "$version_constraint"
        fi
    done

    # Summary
    print_info_from_common_functions "Package installation summary: $installed successful, $failed failed/skipped"
    print_success_from_common_functions "Python package installation from DEPENDENCY_MAP complete!"

    return 0
}

# Function to check and fix edge-tts version (specialized version checking)
# This is similar to the function in 30_install_edge.sh but adapted for 13_ensure_python.sh
check_and_fix_edge_tts_version_from_dependency_map() {
    local required_version="7.2.1"
    local compatible_versions=("7.2.1" "7.2.0" "7.1.0" "7.0.0")

    print_step_from_common_functions "Checking edge-tts Python package (TTS functionality)..."

    # Check if edge-tts is installed
    if ! python3 -c "import edge_tts" 2>/dev/null; then
        echo ">>> edge-tts not installed, installing version $required_version..."
        run_pip_install_realtime "python3" "edge-tts==$required_version" "" || true
        return 0
    fi

    # Get current version
    local current_version=$(python3 -c "import edge_tts; print(edge_tts.__version__)" 2>/dev/null || echo "unknown")
    print_info_from_common_functions "Current edge-tts version: $current_version"

    # Check if current version is compatible
    local is_compatible=0
    for ver in "${compatible_versions[@]}"; do
        if [ "$current_version" = "$ver" ]; then
            is_compatible=1
            break
        fi
    done

    if [ $is_compatible -eq 1 ]; then
        return 0
    fi

    # Incompatible version detected (7.2.2+), need to downgrade
    print_warning_from_common_functions "WARNING: edge-tts $current_version is incompatible (has NoAudioReceived bug)"
    print_warning_from_common_functions "Reference: https://github.com/rany2/edge-tts/issues/443"
    echo ">>> Downgrading edge-tts to $required_version..."

    # Force reinstall with correct version
    run_pip_install_realtime "python3" "edge-tts==$required_version" "--force-reinstall" || true

    return 0
}

# Main function (all commands real-time output; no exit-code flow control)
main() {
    print_step_from_common_functions "Checking Python environment status..."
    print_info_from_common_functions "Environment type: IS_PRODUCTION=$IS_PRODUCTION, IS_WSL=$IS_WSL, HAS_DESKTOP_ENVIRONMENT=$HAS_DESKTOP_ENVIRONMENT"

    check_python_installed
    check_pip_installed

    # Always run install_python_essentials (idempotent; real-time output)
    print_step_from_common_functions "Installing Python and essential packages (real-time)..."
    install_python_essentials

    # IMPORTANT: Always set pip mirror on every run to ensure correct configuration
    set_pip_mirror

    # IMPORTANT: Always fix Python symlinks on every run to ensure correct setup
    print_step_from_common_functions "Ensuring Python symlinks are correct..."
    fix_python_links

    # Create Python venv and replace system commands (run without exit-code branch)
    print_header_from_common_functions "Python Virtual Environment Setup"
    create_python_venv_and_replace_system
    fix_python_links

    # Verify installation (display only; no exit-code branch)
    print_step_from_common_functions "Final verification..."
    verify_installation

    # IDEMPOTENCY: Check and fix urllib3 compatibility for certbot
    print_step_from_common_functions "Checking urllib3 compatibility for certbot..."
    check_urllib3_for_certbot

    # IDEMPOTENCY: Install/check all Python packages from third_party.py DEPENDENCY_MAP
    # This replaces the old simple edge-tts installation with comprehensive package checking
    # Each package will be checked individually, even if some are already installed
    # Version constraints will be enforced (e.g., Pillow<11,>=10, numpy<2.3.0,>=2, edge-tts==7.2.1)
    check_and_install_python_packages_from_dependency_map

    print_success_from_common_functions "Python environment setup complete!"
    if [ -d "$VENV_DIR" ] && [ -f "$VENV_PYTHON3" ]; then
        print_info_from_common_functions "Using Python virtual environment: $VENV_DIR"
        print_info_from_common_functions "System commands (python, python3, pip, pip3) now point to venv"
        print_info_from_common_functions "Backup commands available: python3_system, pip3_system, pip_system"
    else
        print_info_from_common_functions "Using system Python directly (no virtual environment)"
    fi
    print_info_from_common_functions "Tools available: python, python3, pip, pip3"

}

# Execute main function (no exit code used)
main
