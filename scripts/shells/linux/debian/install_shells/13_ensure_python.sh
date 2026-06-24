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
# Shared venv resolution + print-command-string wrappers (single source of truth
# for the venv path and for "echo the command before running it"). Sourced AFTER
# gvar_common.sh so it can derive the venv path from COMPILE_DIR.
source "$PARENT_DIR_LEVEL_2/common/venv_python_common.sh"
# Idempotent CPU/GPU build guards (single source of truth, also runnable standalone).
source "$PARENT_DIR_LEVEL_2/common/torch_cpu_guard.sh"
source "$PARENT_DIR_LEVEL_2/common/onnxruntime_cpu_guard.sh"

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

# Repair the Debian/Ubuntu/Kali "no RECORD file" uninstall blocker.
#
# apt installs some Python packages (e.g. mpmath, a sympy dependency) into
# /usr/lib/python3/dist-packages WITHOUT a RECORD file. When a PyPI package needs
# a DIFFERENT version of such a package (e.g. torch requires mpmath<1.4 but the
# distro ships 1.4.x), pip tries to uninstall the distro copy, cannot (no RECORD),
# and aborts the whole install with "uninstall-no-record-file".
#
# Fix (dpkg-safe, idempotent): for each blocked package, install the required
# version pip-side with --ignore-installed --no-deps into /usr/local/.../dist-packages,
# which shadows the apt copy via sys.path precedence WITHOUT removing dpkg-owned
# files. The caller then retries the original install, which now sees the
# constraint satisfied and performs no uninstall. Returns 0 if a shadow was applied.
# Args: $1=python_cmd  $2=pip output log file.
pip_repair_no_record_blocker() {
    local python_cmd="$1"
    local log="$2"
    local sysflags=()
    local applied=1
    local blockers b constraint

    # System interpreter (not a venv) needs the PEP 668 escape flags.
    if [ ! -f "$(dirname "$python_cmd")/../pyvenv.cfg" ]; then
        sysflags=("--break-system-packages" "--no-user")
    fi

    # Packages pip refused to uninstall: "no RECORD file was found for <pkg>."
    blockers="$(grep -oiE "no RECORD file was found for [A-Za-z0-9._-]+" "$log" 2>/dev/null \
        | awk '{print $NF}' | sed 's/\.$//' | sort -u)"
    [ -z "$blockers" ] && return 1

    for b in $blockers; do
        # Recover the version constraint pip was resolving, e.g.
        #   "Collecting mpmath<1.4,>=1.1.0 (from sympy>=1.13.3->torch)".
        constraint="$(grep -oiE "Collecting ${b}[<>=!,0-9. ]*" "$log" 2>/dev/null \
            | head -1 | sed "s/^[Cc]ollecting ${b}//; s/[[:space:]].*//")"
        echo "[13] Repair: distro '${b}' has no RECORD file; installing pip-managed '${b}${constraint}' into /usr/local (shadows apt copy, dpkg untouched)."
        if "$python_cmd" -m pip install "${sysflags[@]}" --ignore-installed --no-deps \
            "${b}${constraint}" --index-url https://pypi.org/simple/; then
            applied=0
        fi
    done
    return $applied
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

    # Add standard flags. The PEP 668 escape flags (--break-system-packages /
    # --no-user) are needed ONLY for an externally-managed SYSTEM python; inside a
    # venv they are unnecessary, so add them only when $python_cmd is NOT a venv
    # interpreter (detected via pyvenv.cfg). This is what lets installs targeting
    # $VENV_PYTHON3 land cleanly in the venv instead of scattering to ~/.local.
    cmd_args+=("--index-url" "https://pypi.org/simple/")
    if [ ! -f "$(dirname "$python_cmd")/../pyvenv.cfg" ]; then
        cmd_args+=("--break-system-packages" "--no-user")
    fi
    
    # Add additional flags if provided
    if [ -n "$additional_flags" ]; then
        read -ra flag_words <<< "$additional_flags"
        cmd_args+=("${flag_words[@]}")
    fi

    # Execute with real-time output, capturing it so we can auto-repair the
    # Debian/Ubuntu/Kali "no RECORD file" uninstall blocker and retry once.
    echo "[13] ${cmd_args[*]}"
    local pip_log
    pip_log="$(mktemp 2>/dev/null || echo "/tmp/_core_node_pip_$$.log")"
    "${cmd_args[@]}" 2>&1 | tee "$pip_log"
    local rc=${PIPESTATUS[0]}

    if [ "$rc" -ne 0 ] && grep -qiE "no RECORD file was found for|uninstall-no-record-file" "$pip_log"; then
        if pip_repair_no_record_blocker "$python_cmd" "$pip_log"; then
            echo "[13] Retrying after no-RECORD repair: ${cmd_args[*]}"
            "${cmd_args[@]}" 2>&1 | tee "$pip_log"
            rc=${PIPESTATUS[0]}
        fi
    fi

    rm -f "$pip_log"
    return $rc
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

# Establish the command contract on PATH (/usr/local/bin precedes /usr/bin):
#   pythonorigin                      -> the ORIGINAL system interpreter
#                                        (/usr/bin/python3), preserved under a
#                                        stable name (never renamed/removed).
#   python, python3, python3.<minor>  -> the VENV interpreter.
#   pip, pip3                         -> the VENV pip.
# /usr/bin/python3 itself is NEVER modified (dpkg-managed; system/maintainer
# scripts that hardcode #!/usr/bin/python3 keep working). Idempotent. This is the
# SINGLE source of truth for the python/pip symlinks (it replaces the three
# previously contradictory symlink behaviors). Returns 1 if the venv is absent.
link_commands_to_venv() {
    [ -x "$VENV_PYTHON3" ] || return 1
    local sys_python3="/usr/bin/python3"
    local venv_pyver link
    venv_pyver="$("$VENV_PYTHON3" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "")"

    # Preserve the original system interpreter as 'pythonorigin' -- capture ONCE (only when
    # absent) so a later run never overwrites the true original with a drifted target.
    if [ -x "$sys_python3" ] && [ ! -e /usr/local/bin/pythonorigin ]; then
        echo "[13] $USE_SUDO ln -sf $sys_python3 /usr/local/bin/pythonorigin"
        $USE_SUDO ln -sf "$sys_python3" /usr/local/bin/pythonorigin
    fi

    # python / python3 / python3.<minor> -> venv interpreter.
    for link in /usr/local/bin/python /usr/local/bin/python3 ${venv_pyver:+/usr/local/bin/python${venv_pyver}}; do
        echo "[13] $USE_SUDO ln -sf $VENV_PYTHON3 $link"
        $USE_SUDO ln -sf "$VENV_PYTHON3" "$link"
    done

    # pip / pip3 -> venv pip.
    if [ -f "$VENV_PIP3" ]; then
        [ -e "$VENV_PIP" ] || ln -sf pip3 "$VENV_PIP" 2>/dev/null || true
        for link in /usr/local/bin/pip /usr/local/bin/pip3; do
            echo "[13] $USE_SUDO ln -sf $VENV_PIP3 $link"
            $USE_SUDO ln -sf "$VENV_PIP3" "$link"
        done
    fi
    print_success_from_common_functions "Linked python/python3${venv_pyver:+/python${venv_pyver}} + pip/pip3 -> venv; system python preserved as 'pythonorigin'"
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

    # Once the venv exists, the whole contract (python / python3 / python3.x +
    # pip / pip3 -> venv, system python preserved as pythonorigin) is owned by
    # link_commands_to_venv(). This is what lets fix_python_links run before AND
    # after venv setup without clobbering the venv link.
    if [ -x "$VENV_PYTHON3" ]; then
        link_commands_to_venv
        return 0
    fi

    # First run (no venv yet): provisionally link `python`/`pip` to the system
    # interpreter so the commands exist; create_python_venv_and_replace_system
    # repoints them at the venv once it is built.
    local sys_python3 sys_pip3
    sys_python3=$(command -v python3)
    sys_pip3=$(command -v pip3 2>/dev/null)
    if [ -n "$sys_python3" ]; then
        echo "[13] $USE_SUDO ln -sf $sys_python3 /usr/local/bin/python"
        $USE_SUDO ln -sf "$sys_python3" /usr/local/bin/python
    fi
    if [ -n "$sys_pip3" ]; then
        echo "[13] $USE_SUDO ln -sf $sys_pip3 /usr/local/bin/pip"
        $USE_SUDO ln -sf "$sys_pip3" /usr/local/bin/pip
    fi
    print_info_from_common_functions "venv not present yet; python/pip provisionally -> system (switches to venv after venv creation)"
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

# Ensure the venv is writable by the invoking (non-root) user. The venv is
# created WITHOUT sudo (user-owned by design), but a venv left over from an
# earlier sudo run can be root-owned -- then pip prints "site-packages not
# writeable" and silently falls back to ~/.local, scattering packages and later
# colliding with dpkg/system dirs. Repair the ownership here so every venv pip
# install lands IN the venv. Same on Debian/Ubuntu/Kali.
ensure_venv_user_writable() {
    [ -d "$VENV_DIR" ] || return 0
    local owner_user="${SUDO_USER:-$(id -un)}"
    [ "$owner_user" = "root" ] && return 0   # pure-root run: root-owned venv is writable
    local cur
    cur="$(stat -c '%U' "$VENV_DIR" 2>/dev/null || echo "")"
    if [ -n "$cur" ] && [ "$cur" != "$owner_user" ]; then
        local owner_group
        owner_group="$(id -gn "$owner_user" 2>/dev/null || echo "$owner_user")"
        print_step_from_common_functions "Repairing venv ownership ($cur -> $owner_user) so pip installs land in the venv, not ~/.local..."
        echo "[13] $USE_SUDO chown -R $owner_user:$owner_group $VENV_DIR"
        $USE_SUDO chown -R "$owner_user:$owner_group" "$VENV_DIR" 2>/dev/null || true
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

        print_step_from_common_functions "Rebuild virtual environment? [n/Y] (press Y only if you added new packages; auto-continues in 15s)"
        read -t 15 -r response </dev/tty || true
        response=${response:-n}  # Default to n on Enter or 15s timeout (skip rebuild)

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

        # Build the venv with the SYSTEM interpreter explicitly. After this script
        # has run once, /usr/local/bin/python3 points at the venv, so a bare
        # `python3 -m venv` on a rebuild would try to use the very venv being
        # replaced (moved to a backup first -> dangling). Use the original system
        # python (pythonorigin if present, else /usr/bin/python3) so rebuilds are
        # always sound and never circular.
        local sys_py=/usr/local/bin/pythonorigin
        [ -x "$sys_py" ] || sys_py=/usr/bin/python3
        [ -x "$sys_py" ] || sys_py="$(command -v python3)"

        # Ensure python3-venv is installed (real-time output)
        if ! "$sys_py" -m venv --help >/dev/null 2>&1; then
            print_warning_from_common_functions "python3-venv module not available, installing..."
            echo "[13] $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv python3-pip --no-install-recommends"
            $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv python3-pip --no-install-recommends
        fi

        # Create the virtual environment WITH system-site-packages (real-time output)
        print_step_from_common_functions "Creating venv with --system-site-packages (allows access to system tkinter, PIL, etc.)..."
        echo "[13] $sys_py -m venv --system-site-packages $VENV_DIR"
        "$sys_py" -m venv --system-site-packages "$VENV_DIR"
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

    # Repair a stale (root-owned) venv back to the invoking user BEFORE any venv
    # pip runs, so installs land in the venv instead of falling back to ~/.local.
    ensure_venv_user_writable

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

    # IMPORTANT: Always refresh symlinks, even if venv was not rebuilt. This
    # ensures python/python3/python3.x + pip/pip3 always point at the venv, even
    # if system packages were updated or symlinks were modified manually.
    #
    # Establish the command contract: python / python3 / python3.<minor> +
    # pip / pip3 -> venv; the original system interpreter is preserved as
    # 'pythonorigin'. /usr/bin/python3 itself is never touched. Single source of
    # truth: link_commands_to_venv() (replaces the previously contradictory
    # per-command symlink blocks).
    print_step_from_common_functions "Pointing python / python3 / pip at the venv (system python preserved as 'pythonorigin')..."
    link_commands_to_venv

    local venv_pyver_disp
    venv_pyver_disp="$("$VENV_PYTHON3" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "")"

    print_success_from_common_functions "Python venv setup and system command replacement complete!"
    print_info_from_common_functions "Virtual environment: $VENV_DIR"
    print_info_from_common_functions ""
    print_info_from_common_functions "Command mapping:"
    print_info_from_common_functions "  pythonorigin                       -> System Python (/usr/bin/python3)"
    print_info_from_common_functions "  python / python3${venv_pyver_disp:+ / python${venv_pyver_disp}}   -> Venv Python ($VENV_PYTHON3)"
    print_info_from_common_functions "  pip / pip3                         -> Venv pip ($VENV_PIP3)"

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
    # this repair pins the last 1.x (1.26.18) -- the SAME version 26_install_certbot.sh enforces
    # (one system-python urllib3 policy; --no-user matches 26 too). Upgrading to a newer 2.x
    # would not fix a DEFAULT_CIPHERS failure. The worker's venv pin (urllib3>=2.0,<3 in
    # third_party.py) is a SEPARATE interpreter and is unaffected.
    echo "[13] $USE_SUDO $sys_py3 -m pip install --break-system-packages --no-user urllib3==1.26.18"
    $USE_SUDO "$sys_py3" -m pip install --break-system-packages --no-user urllib3==1.26.18 2>&1 || true

    # Re-test certbot functionally.
    if certbot plugins >/dev/null 2>&1; then
        print_success_from_common_functions "certbot compatibility fixed"
    else
        print_warning_from_common_functions "certbot still has issues, may need manual fix"
    fi

    return 0
}

# Function to check and fix package version with constraint validation
# Args: $1=import_name, $2=pip_package, $3=version_constraint (optional)
check_and_fix_package_version() {
    local import_name="$1"
    local pip_package="$2"
    local version_constraint="$3"

    # Install INTO the venv (the design's `python`), not the externally-managed
    # system python3. Targeting $VENV_PYTHON3 makes run_pip_install_realtime
    # detect the venv (pyvenv.cfg) and drop --break-system-packages/--no-user, so
    # packages land in the venv site-packages instead of ~/.local or /usr/local --
    # which is what caused the dpkg / "Permission denied" failures on Kali. Fall
    # back to system python3 if the venv does not exist yet.
    local py="$VENV_PYTHON3"
    [ -x "$py" ] || py="python3"

    # Special handling for packages with dots in import name (e.g., azure.cognitiveservices.speech)
    local import_cmd="import $import_name"
    local force_flag=""

    # Some packages expose an importable top-level even when their real compiled modules are
    # absent. On Debian/Kali the base libpyside6 stub satisfies `import PySide6` while
    # QtCore/QtWebEngine* ship as separate apt packages, so probe a representative submodule
    # and force the install past the system stub (the venv has system-site-packages, so a
    # plain `pip install PySide6` would otherwise be a no-op against the incomplete stub).
    case "$import_name" in
        PySide6)
            import_cmd="import PySide6.QtWebEngineWidgets"
            force_flag="--ignore-installed"
            ;;
    esac

    # Check if package is installed
    if ! "$py" -c "$import_cmd" 2>/dev/null; then
        # Package not installed
        if [ -n "$version_constraint" ]; then
            echo ">>> Installing $pip_package$version_constraint..."
            run_pip_install_realtime "$py" "$pip_package$version_constraint" "$force_flag" || true
        else
            echo ">>> Installing $pip_package..."
            run_pip_install_realtime "$py" "$pip_package" "$force_flag" || true
        fi
        return 0
    fi

    # Package is installed
    if [ -n "$version_constraint" ]; then
        echo ">>> Verifying $pip_package version constraint: $version_constraint"
        run_pip_install_realtime "$py" "$pip_package$version_constraint" "--force-reinstall" || true
    fi

    return 0
}

# Function to check and install all Python packages from third_party.py DEPENDENCY_MAP
check_and_install_python_packages_from_dependency_map() {
    print_header_from_common_functions "Python Package Installation from DEPENDENCY_MAP"
    print_info_from_common_functions "Checking and installing packages from pycore/pyfoundations/third_party.py"
    print_info_from_common_functions "Each package will be checked individually, even if others are correct"

    # torch first, with the correct CPU/GPU build, via the shared guard (full mode:
    # installs the right build when missing). Single source of truth: torch_cpu_guard.sh.
    tcg_ensure_torch_build
    # ONNX runtime: on a GPU-less host ensure the CPU runtime (not onnxruntime-gpu).
    ocg_ensure_onnx_runtime

    # Headless Linux (no desktop): skip GUI-only Qt packages (PySide6 ~629M) — pointless
    # without a display, and they lazy-install on demand. Force install with FORCE_GUI=1.
    local gui_only_imports="PySide6"
    local skip_gui=0
    if [[ "${FORCE_GUI:-0}" != "1" && "${HAS_DESKTOP_ENVIRONMENT:-false}" != "true" ]]; then
        skip_gui=1
        print_info_from_common_functions "[headless] No desktop environment: will skip GUI-only packages ($gui_only_imports)"
    fi

    # Package mapping format: "import_name|pip_package|version_constraint"
    # version_constraint left empty so pip resolves versions automatically
    local packages=(
        # PIL/Pillow - required by tkhtmlview
        "PIL|Pillow|"

        # Computer vision and automation
        "cv2|opencv-python|"
        "pyautogui|pyautogui|"
        "psutil|psutil|"
        "mss|mss|"

        # Deep learning - required by opencv
        "numpy|numpy|"
        # torch is installed separately by tcg_ensure_torch_build (torch_cpu_guard.sh,
        # called below) so a GPU-less host gets the CPU wheel, not the default CUDA build
        # + ~4.3G nvidia-*. ultralytics (and easyocr) then reuse the already-present torch.
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
        "edge_tts|edge-tts|"
        "whisper|openai-whisper|"
    )

    # Process required packages
    print_step_from_common_functions "Installing required packages (${#packages[@]} packages)..."
    local installed=0
    local failed=0

    for package_spec in "${packages[@]}"; do
        IFS='|' read -r import_name pip_package version_constraint <<< "$package_spec"

        if (( skip_gui )) && [[ " $gui_only_imports " == *" $import_name "* ]]; then
            print_info_from_common_functions "[headless] skipping GUI-only package: $pip_package"
            continue
        fi

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
        check_and_fix_package_version "$import_name" "$pip_package" "$version_constraint"
    done

    # Summary
    print_info_from_common_functions "Package installation summary: $installed successful, $failed failed/skipped"
    print_success_from_common_functions "Python package installation from DEPENDENCY_MAP complete!"

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
