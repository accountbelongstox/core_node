#!/usr/bin/env bash
# Shared Python venv creation, repair, and command-link helpers for Step13.

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
        echo "[13] safe_chown_R $owner_user:$owner_group $VENV_DIR"
        safe_chown_R "$owner_user:$owner_group" "$VENV_DIR"
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
            install_python_packages_official "$VENV_PIP3" "$VENV_PYTHON3" "setuptools<81" wheel
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
        install_python_packages_official "$VENV_PIP3" "$VENV_PYTHON3" "setuptools<81" wheel
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
                install_python_packages_official "$python_venv_dir/bin/pip3" "$python_venv_dir/bin/python3" "setuptools<81" wheel
            elif [ -f "$python_venv_dir/bin/pip" ]; then
                upgrade_pip_official "$python_venv_dir/bin/pip" "$python_venv_dir/bin/python3"
                install_python_packages_official "$python_venv_dir/bin/pip" "$python_venv_dir/bin/python3" "setuptools<81" wheel
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
        install_python_packages_official "$venv_pip3" "$venv_python3" "setuptools<81" wheel
    elif [ -f "$venv_pip" ]; then
        upgrade_pip_official "$venv_pip" "$venv_python3"
        install_python_packages_official "$venv_pip" "$venv_python3" "setuptools<81" wheel
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


