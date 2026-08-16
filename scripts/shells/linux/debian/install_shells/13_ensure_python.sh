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
PYTHON_VENV_SETUP_COMMON=""

# Source global variables
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
# Shared venv resolution + print-command-string wrappers (single source of truth
# for the venv path and for "echo the command before running it"). Sourced AFTER
# gvar_common.sh so it can derive the venv path from COMPILE_DIR.
source "$PARENT_DIR_LEVEL_2/common/venv_python_common.sh"
# Idempotent CPU/GPU build guards (single source of truth, also runnable standalone).
source "$PARENT_DIR_LEVEL_2/common/onnxruntime_cpu_guard.sh"
source "$PARENT_DIR_LEVEL_2/common/pycore_package_policy_install.sh"
PYTHON_VENV_SETUP_COMMON="$PARENT_DIR_LEVEL_2/common/python_venv_setup_common.sh"
source "$PYTHON_VENV_SETUP_COMMON"

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

    # NOTE: We do NOT hand-import the Ubuntu archive signing key into /etc/apt/trusted.gpg.d.
    # The ubuntu-keyring PACKAGE installed above is the distro's own mechanism and provides/
    # refreshes the archive keys correctly. Hand-importing distro archive keys modifies the
    # system's OWN signing keys, which is forbidden.

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

    # Try apt-get update first; only clean /var/lib/apt/lists when update fails (avoids unnecessary full refresh every run)
    print_step_from_common_functions "Updating package list..."
    echo "[13] $USE_SUDO apt-get update"
    if ! $USE_SUDO apt-get update; then
        print_step_from_common_functions "Cleaning up package lists (update failed, retrying with fresh lists)..."
        echo "[13] $USE_SUDO rm -rf /var/lib/apt/lists/*"
        $USE_SUDO rm -rf /var/lib/apt/lists/* 2>/dev/null || true
        echo "[13] Fixing APT GPG keys and retrying update..."
        fix_apt_gpg_if_needed
    fi

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

    # Install GUI and system packages (real-time output). The AppIndicator GIR
    # package was renamed: modern Debian/Kali/Ubuntu ship the Ayatana fork
    # (gir1.2-ayatanaappindicator3-0.1); older Ubuntu used gir1.2-appindicator3-0.1.
    # Pick whichever the apt index actually offers, and install only packages that
    # have a real candidate, so one missing name cannot abort the whole batch
    # (a single apt-get invocation aborts entirely on an uninstallable package).
    print_step_from_common_functions "Installing GUI and system packages..."
    local gui_pkgs=(python3-tk "${version_specific_tk}" tk-dev tcl-dev python3-gi python3-gi-cairo python3-pil python3-pil.imagetk gir1.2-gtk-3.0)
    local appind_cand=""
    local cand
    for cand in gir1.2-ayatanaappindicator3-0.1 gir1.2-appindicator3-0.1; do
        if apt-cache show "$cand" >/dev/null 2>&1; then
            appind_cand="$cand"
            gui_pkgs+=("$cand")
            break
        fi
    done
    [ -z "$appind_cand" ] && print_warning_from_common_functions "No AppIndicator GIR package in apt index (system-tray icon optional); continuing"

    # Keep only packages that actually have an install candidate, so one missing
    # name (e.g. a version-specific tk that does not exist) cannot abort the batch.
    local gui_installable=()
    local gp
    for gp in "${gui_pkgs[@]}"; do
        if apt-cache policy "$gp" 2>/dev/null | grep -qE 'Candidate: [^(]'; then
            gui_installable+=("$gp")
        else
            print_warning_from_common_functions "Skipping unavailable GUI package: $gp"
        fi
    done

    echo "[13] $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y ${gui_installable[*]} --no-install-recommends"
    $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y \
        "${gui_installable[@]}" \
        --no-install-recommends \
        || print_warning_from_common_functions "Some GUI packages failed to install (non-fatal; core tkinter comes from python3-tk)"

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
    # Post-install cleanup: remove cached lists to free space (safe; next apt-get update will refetch)
    echo "[13] $USE_SUDO rm -rf /var/lib/apt/lists/*"
    $USE_SUDO rm -rf /var/lib/apt/lists/*

    print_success_from_common_functions "Python essentials installed successfully"
    return 0
}

# Generic function to run pip install with real-time output
# Args: $1=python_cmd, $2=space-delimited package specs.
run_pip_install_realtime() {
    local python_cmd="$1"
    local package_spec="$2"
    local IFS=' '
    local cmd_args=("$python_cmd" "-m" "pip" "install")
    local package_words=()

    read -ra package_words <<< "$package_spec"
    cmd_args+=("${package_words[@]}")

    # Add standard flags. The PEP 668 escape flags (--break-system-packages /
    # --no-user) are needed ONLY for an externally-managed SYSTEM python; inside a
    # venv they are unnecessary, so add them only when $python_cmd is NOT a venv
    # interpreter (detected via pyvenv.cfg). This is what lets installs targeting
    # $VENV_PYTHON3 land cleanly in the venv instead of scattering to ~/.local.
    cmd_args+=("--index-url" "https://pypi.org/simple/")
    if [ ! -f "$(dirname "$python_cmd")/../pyvenv.cfg" ]; then
        cmd_args+=("--break-system-packages" "--no-user")
    fi
    
    echo "[13] ${cmd_args[*]}"
    "${cmd_args[@]}" || true
}

# Preserve the pip bundled into the selected interpreter.
upgrade_pip_official() {
    local pip_cmd="$1"
    local python_cmd="$2"

    if [ -n "$pip_cmd" ] && [ -f "$pip_cmd" ]; then
        print_success_from_common_functions "pip is present for $python_cmd; preserving the installed version"
    else
        print_warning_from_common_functions "pip binary not found at: $pip_cmd"
    fi
}

# Function to install required Python packages with official PyPI only
install_python_packages_official() {
    local pip_cmd="$1"
    local python_cmd="$2"
    local package_name=""
    local package_spec=""
    local package_metadata=""
    local constrained=0
    local missing_packages=()
    local packages=()
    shift 2
    packages=("$@")

    if [ -z "$pip_cmd" ] || [ ! -f "$pip_cmd" ]; then
        print_warning_from_common_functions "pip binary not found, skipping package installation"
    else
        for package_spec in "${packages[@]}"; do
            package_name="${package_spec%%<*}"
            package_name="${package_name%%>*}"
            package_name="${package_name%%=*}"
            package_name="${package_name%%!*}"
            package_name="${package_name%%~*}"
            constrained=0
            [[ "$package_name" != "$package_spec" ]] && constrained=1
            package_metadata="$("$python_cmd" -m pip show "$package_name" 2>/dev/null || true)"
            if [[ "$constrained" -eq 1 || "$package_metadata" != *"Name:"* ]]; then
                missing_packages+=("$package_spec")
            fi
        done
        if [[ ${#missing_packages[@]} -gt 0 ]]; then
            print_step_from_common_functions "Installing missing/ABI-constrained Python packages: ${missing_packages[*]}"
            run_pip_install_realtime "$python_cmd" "${missing_packages[*]}"
        else
            print_success_from_common_functions "Python package metadata is complete; preserving installed packages"
        fi
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

    # Authoritative signal: does certbot actually RUN? On modern urllib3 (2.x -- shipped by
    # current Debian/Kali) the old DEFAULT_CIPHERS constant was REMOVED, and modern certbot no
    # longer needs it, so a missing DEFAULT_CIPHERS is NOT a failure by itself. Gate the
    # destructive urllib3 repair behind this functional test so it runs ONLY when certbot is
    # genuinely broken -- otherwise a healthy Kali box needlessly runs a system-side
    # `pip uninstall` that aborts under PEP 668 (externally-managed-environment).
    local default_ciphers="absent"
    python3 -c "from urllib3.util.ssl_ import DEFAULT_CIPHERS" >/dev/null 2>&1 && default_ciphers="present"
    if certbot plugins >/dev/null 2>&1; then
        print_success_from_common_functions "certbot runs correctly (urllib3 $current_version, DEFAULT_CIPHERS $default_ciphers); no fix needed"
        return 0
    fi
    print_warning_from_common_functions "certbot is not working; attempting urllib3 repair..."

    # Repair urllib3 for certbot. certbot runs on the SYSTEM interpreter (/usr/bin/python3),
    # so this is deliberately a system-side repair (NOT the venv). On an externally-managed
    # system (Debian/Ubuntu/Kali, PEP 668) system-side pip aborts with
    # "externally-managed-environment" unless given --break-system-packages -- the override the
    # OS error message itself documents. Use the system interpreter explicitly, because after
    # this script's symlinks run a bare `pip3`/`python3` may resolve to the venv.
    print_step_from_common_functions "Fixing urllib3 compatibility for certbot..."
    local sys_py3=/usr/bin/python3
    [ -x "$sys_py3" ] || sys_py3="$(command -v python3)"

    echo ">>> Uninstalling existing urllib3 (system-side)..."
    echo "[13] $USE_SUDO $sys_py3 -m pip uninstall -y --break-system-packages urllib3"
    $USE_SUDO "$sys_py3" -m pip uninstall -y --break-system-packages urllib3 2>&1 || true

    echo ">>> Installing certbot-compatible urllib3 (system-side)..."
    # certbot 2.x depends on urllib3.util.ssl_.DEFAULT_CIPHERS, which urllib3 2.x REMOVED, so
    # this repair pins the last 1.x (1.26.18) -- the SAME version 27_install_certbot.sh enforces
    # (one system-python urllib3 policy; --no-user matches 26 too). Upgrading to a newer 2.x
    # would not fix a DEFAULT_CIPHERS failure. The worker venv owns its modern urllib3 major in
    # third_party.py) is a SEPARATE interpreter and is unaffected.
    echo "[13] $USE_SUDO $sys_py3 -m pip install --break-system-packages --no-user urllib3<2"
    $USE_SUDO "$sys_py3" -m pip install --break-system-packages --no-user 'urllib3<2' 2>&1 || true

    # Re-test certbot functionally.
    if certbot plugins >/dev/null 2>&1; then
        print_success_from_common_functions "certbot compatibility fixed"
    else
        print_warning_from_common_functions "certbot still has issues, may need manual fix"
    fi

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
    # No version constraints; pip resolves versions automatically.
    install_pycore_package_policy "$VENV_PYTHON3" "[13]" || true

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
