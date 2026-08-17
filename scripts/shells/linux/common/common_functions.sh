#!/bin/bash
# Common reusable shell functions for scripts
# Naming rule: function names end with `_from_common_functions` so callers know the source file

# Resolve current directory and include shared globals
COMMON_FUNCS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHELLS_DIR="$(dirname "$COMMON_FUNCS_DIR")"
AI_RUNTIME_POLICY_FILE="$(dirname "$SHELLS_DIR")/ai_runtime_policy.env"
PIP_LOCK_PATH="$COMMON_FUNCS_DIR/base_libs/pip_lock.sh"

# Source gvar_common.sh from the same directory
source "$COMMON_FUNCS_DIR/gvar_common.sh"
source "$AI_RUNTIME_POLICY_FILE"

# Source fs_perm_helpers.sh (idempotent recursive chown/chmod; avoids pinning
# the userspace ntfs-3g FUSE driver on NTFS/FUSE mounts).
source "$COMMON_FUNCS_DIR/fs_perm_helpers.sh"
source "$PIP_LOCK_PATH"

# Shared transformers requirement for the local LLM stack. Existing distributions are
# preserved and pip resolves the requirement only when the package is absent.
LLM_TRANSFORMERS_SPEC="${LLM_TRANSFORMERS_SPEC:-${AI_SHARED_TRANSFORMERS_SPEC:-transformers}}"


shared_transformers_matches_from_common_functions() {
    local python_cmd="$1"
    local metadata=""
    metadata="$("$python_cmd" -m pip show transformers 2>/dev/null || true)"
    [[ "$metadata" == *"Name:"* ]]
}

ensure_shared_transformers_from_common_functions() {
    local python_cmd="$1"

    if shared_transformers_matches_from_common_functions "$python_cmd"; then
        return 0
    fi
    echo "[transformers-policy] Installing missing $LLM_TRANSFORMERS_SPEC ..."
    vpip "$python_cmd" -m pip install "$LLM_TRANSFORMERS_SPEC"
}


# Helper function: Ensure service name has mcp prefix
ensure_mcp_prefix() {
    local service_name="$1"
    if [[ "$service_name" != mcp-* ]] && [[ "$service_name" != mcp_* ]]; then
        echo "mcp-$service_name"
    else
        echo "$service_name"
    fi
}

# Helper function: Check if binary name is protected
is_protected_binary() {
    local bin_name="$1"
    local protected_binaries=(
        "sudo" "su" "passwd" "chown" "chmod" "chroot" "mount" "umount"
        "init" "systemctl" "service" "systemd" "dbus" "udev" "cron"
        "ssh" "sshd" "login" "getty" "bash" "sh" "dash" "zsh"
        "iptables" "firewall" "ufw" "selinux" "apparmor" "polkit"
        "pkexec" "gksu" "kdesu" "visudo" "newgrp" "sg" "gpasswd"
    )

    for protected in "${protected_binaries[@]}"; do
        if [[ "$bin_name" == "$protected" ]]; then
            return 0  # Is protected
        fi
    done
    return 1  # Not protected
}

# Helper function: Add directory to PATH in /etc/environment
add_to_path_environment() {
    local dir_path="$1"

    if ! grep -q "PATH.*$dir_path" /etc/environment 2>/dev/null; then
        print_step_from_common_functions "Adding $dir_path to /etc/environment"
        $USE_SUDO sed -i '/^PATH=/d' /etc/environment 2>/dev/null || true
        echo "PATH=\"$dir_path:/usr/local/bin:/usr/bin:/bin\"" | $USE_SUDO tee -a /etc/environment > /dev/null
    fi
}


# Print a section header (from common_functions.sh)
print_header_from_common_functions() {
  local title="$1"
  echo -e "\n\033[1;34m=== ${title} ===\033[0m"
  echo -e "\033[1;34m$(printf '=%.0s' {1..50})\033[0m\n"
}

# Print a step line (from common_functions.sh)
print_step_from_common_functions() {
  local msg="$1"
  echo -e "\033[0;36m>>> ${msg}\033[0m"
}

# Print success (from common_functions.sh)
print_success_from_common_functions() {
  local msg="$1"
  echo -e "\033[0;32m[OK] ${msg}\033[0m"
}

# Print error (from common_functions.sh)
print_error_from_common_functions() {
  local msg="$1"
  echo -e "\033[0;31m[ERROR] ${msg}\033[0m"
}

# Print warning (from common_functions.sh)
print_warning_from_common_functions() {
  local msg="$1"
  echo -e "\033[0;33m[WARNING] ${msg}\033[0m"
}

# Print info (from common_functions.sh)
print_info_from_common_functions() {
  local msg="$1"
  echo -e "\033[0;36m[INFO] ${msg}\033[0m"
}


# Read a single raw secret value from .secret_keys/.secret_ignore: first non-empty,
# stripped line (BOM-aware). Empty string if the key file is absent. The shell twin
# of pyfoundations.secret_manager.get_secret_key. (from common_functions.sh)
get_secret_key_from_common_functions() {
  local key_name="$1"
  local project_root raw_file line
  project_root="$(dirname "$(dirname "$(dirname "$(dirname "$COMMON_FUNCS_DIR")")")")"
  raw_file="$project_root/.secret_keys/.secret_ignore/$key_name"
  [ -f "$raw_file" ] || { echo ""; return; }
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line#$'\xef\xbb\xbf'}"
    line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    if [ -n "$line" ]; then echo "$line"; return; fi
  done < "$raw_file"
  echo ""
}

# Resolve an indexed secret: first non-empty of <BASE>_1..<BASE>_5 then bare <BASE>.
# Mirrors pyfoundations.secret_manager.get_secret_key_indexed. (from common_functions.sh)
get_secret_key_indexed_from_common_functions() {
  local base_name="$1"
  local i value
  for i in 1 2 3 4 5; do
    value="$(get_secret_key_from_common_functions "${base_name}_${i}")"
    if [ -n "$value" ]; then echo "$value"; return; fi
  done
  get_secret_key_from_common_functions "$base_name"
}


# MCP Installation Methods - Extended for various package managers

# Install via curl script
install_via_curl_from_common_functions() {
    local url="$1"
    local service_name="$2"

    print_step_from_common_functions "Installing $service_name via curl from $url"

    # Special check for uv installer
    if [[ "$url" == *"uv/install.sh"* ]]; then
        print_step_from_common_functions "Checking if uv is already installed..."
        if command -v uv >/dev/null 2>&1; then
            print_success_from_common_functions "uv is already installed, skipping curl installation"
            return 0
        else
            print_step_from_common_functions "uv not found, installing via curl..."
        fi
    fi

    if command -v curl >/dev/null 2>&1; then
        curl -LsSf "$url" | sh
        return $?
    else
        print_error_from_common_functions "curl is not available"
        return 1
    fi
}

# Install via git clone
install_via_git_from_common_functions() {
    local repo_url="$1"
    local target_dir="$2"
    local service_name="$3"

    print_step_from_common_functions "Installing $service_name via git clone from $repo_url"

    if command -v git >/dev/null 2>&1; then
        if [ -d "$target_dir" ] && [ "$(ls -A "$target_dir" 2>/dev/null)" ]; then
            print_step_from_common_functions "Directory exists and not empty, performing git pull"
            cd "$target_dir" && git pull --force
            return $?
        else
            git clone "$repo_url" "$target_dir"
            return $?
        fi
    else
        print_error_from_common_functions "git is not available"
        return 1
    fi
}

# Install via npm
install_via_npm_from_common_functions() {
    local package="$1"
    local service_name="$2"

    print_step_from_common_functions "Installing $service_name via npm: $package"

    if command -v npm >/dev/null 2>&1; then
        # Check if package is already installed globally
        print_step_from_common_functions "Checking if $package is already installed..."
        if npm list -g "$package" >/dev/null 2>&1; then
            print_success_from_common_functions "$package is already installed globally, skipping installation"
            return 0
        else
            print_step_from_common_functions "$package not found, installing..."
            npm install -g "$package"
            return $?
        fi
    else
        print_error_from_common_functions "npm is not available"
        return 1
    fi
}

# Install via pip
install_via_pip_from_common_functions() {
    local package="$1"
    local service_name="$2"

    print_step_from_common_functions "Installing $service_name via pip: $package"

    # Determine which pip command to use
    local pip_cmd=""
    if command -v pip >/dev/null 2>&1; then
        pip_cmd="pip"
    elif command -v pip3 >/dev/null 2>&1; then
        pip_cmd="pip3"
    else
        print_error_from_common_functions "pip is not available"
        return 1
    fi

    # Check if package is already installed
    print_step_from_common_functions "Checking if $package is already installed..."
    if $pip_cmd show "$package" >/dev/null 2>&1; then
        print_success_from_common_functions "$package is already installed, skipping installation"
        return 0
    else
        print_step_from_common_functions "$package not found, installing..."
        $pip_cmd install "$package"
        return $?
    fi
}

# Install via uv
install_via_uv_from_common_functions() {
    local package="$1"
    local service_name="$2"

    print_step_from_common_functions "Installing $service_name via uv: $package"

    if command -v uv >/dev/null 2>&1; then
        # Check if package is already available via uv
        print_step_from_common_functions "Checking if $package is already available..."
        if uv pip show "$package" >/dev/null 2>&1; then
            print_success_from_common_functions "$package is already available, skipping installation"
            return 0
        else
            print_step_from_common_functions "$package not found, installing..."
            uv add "$package"
            return $?
        fi
    else
        print_error_from_common_functions "uv is not available"
        return 1
    fi
}

# Install via poetry
install_via_poetry_from_common_functions() {
    local package="$1"
    local service_name="$2"

    print_step_from_common_functions "Installing $service_name via poetry: $package"

    if command -v poetry >/dev/null 2>&1; then
        # Check if package is already in poetry dependencies
        print_step_from_common_functions "Checking if $package is already in poetry dependencies..."
        if poetry show "$package" >/dev/null 2>&1; then
            print_success_from_common_functions "$package is already in poetry dependencies, skipping installation"
            return 0
        else
            print_step_from_common_functions "$package not found, adding to poetry..."
            poetry add "$package"
            return $?
        fi
    else
        print_error_from_common_functions "poetry is not available"
        return 1
    fi
}

# Install via local directory with build configuration
install_via_local_from_common_functions() {
    local source_dir="$1"
    local target_dir="$2"
    local service_name="$3"
    local build_type="$4"

    print_step_from_common_functions "Installing $service_name via local directory ($build_type)"

    if [ ! -d "$source_dir" ]; then
        print_error_from_common_functions "Source directory not found: $source_dir"
        return 1
    fi

    local build_config="$source_dir/build_config.json"
    if [ ! -f "$build_config" ]; then
        print_error_from_common_functions "Build configuration not found: $build_config"
        return 1
    fi

    # Copy source to target directory
    print_step_from_common_functions "Copying source from $source_dir to $target_dir"
    mkdir -p "$target_dir"
    cp -r "$source_dir"/* "$target_dir/"

    # Change to target directory for build
    cd "$target_dir" || return 1

    # Parse build configuration and execute build commands
    local build_commands
    if command -v jq >/dev/null 2>&1; then
        build_commands=$(jq -r '.build_commands[]' "$build_config" 2>/dev/null)
    else
        # Fallback parsing without jq
        build_commands=$(grep -o '"build_commands":\s*\[[^]]*\]' "$build_config" | sed 's/.*\[\(.*\)\].*/\1/' | tr ',' '\n' | sed 's/[" ]//g')
    fi

    if [ -n "$build_commands" ]; then
        print_step_from_common_functions "Executing build commands for $service_name"
        echo "$build_commands" | while read -r cmd; do
            if [ -n "$cmd" ]; then
                print_step_from_common_functions "Running: $cmd"
                eval "$cmd" || {
                    print_error_from_common_functions "Build command failed: $cmd"
                    return 1
                }
            fi
        done
    else
        print_step_from_common_functions "No build commands specified, skipping build"
    fi

    print_success_from_common_functions "$service_name built successfully in $target_dir"
    return 0
}

# Parse build configuration from JSON file
parse_build_config_from_common_functions() {
    local config_file="$1"
    local field="$2"

    if [ ! -f "$config_file" ]; then
        echo ""
        return 1
    fi

    if command -v jq >/dev/null 2>&1; then
        jq -r ".$field // empty" "$config_file" 2>/dev/null
    else
        # Fallback parsing without jq
        case "$field" in
            "name"|"type"|"description"|"start_command"|"config_type"|"ai_usage_note")
                grep -o "\"$field\":\s*\"[^\"]*\"" "$config_file" | sed "s/.*\"$field\":\s*\"\([^\"]*\)\".*/\1/"
                ;;
            "port")
                grep -o "\"$field\":\s*[0-9]*" "$config_file" | sed "s/.*\"$field\":\s*\([0-9]*\).*/\1/"
                ;;
            "env_vars")
                grep -A 10 "\"$field\":" "$config_file" | grep -o "\"[^\"]*\":\s*\"[^\"]*\"" | sed 's/"//g' | sed 's/:/=/'
                ;;
        esac
    fi
}

# Add file to system startup - supports both systemd and WSL
add_to_startup_from_common_functions() {
    local file_path="$1"
    local service_name="$2"

    if [ -z "$service_name" ]; then
        service_name=$(basename "$file_path" | sed 's/\.[^.]*$//')
    fi

    print_step_from_common_functions "Adding $service_name to system startup"

    # Check if running in WSL
    if grep -qi microsoft /proc/version 2>/dev/null; then
        print_step_from_common_functions "Detected WSL environment - using Windows startup method"
        add_to_wsl_startup "$file_path" "$service_name"
    elif command -v systemctl >/dev/null 2>&1; then
        print_step_from_common_functions "Detected systemd - creating service"
        add_to_systemd_startup "$file_path" "$service_name"
    else
        print_step_from_common_functions "Using init.d method"
        add_to_initd_startup "$file_path" "$service_name"
    fi
}

# Add to systemd startup (Debian/Ubuntu with systemd)
add_to_systemd_startup() {
    local file_path="$1"
    local service_name="$2"

    # Ensure service name has mcp prefix for identification
    service_name=$(ensure_mcp_prefix "$service_name")

    local service_file="/etc/systemd/system/${service_name}.service"

    print_step_from_common_functions "Creating systemd service: $service_name"

    # Create systemd service file
    $USE_SUDO tee "$service_file" > /dev/null << EOF
[Unit]
Description=$service_name MCP Service
After=network.target

[Service]
Type=simple
ExecStart=$file_path
Restart=always
RestartSec=10
User=$USER
Environment=HOME=$HOME
Environment=MCP_DIR=$(map_web_path "www" "mcp_server")

[Install]
WantedBy=multi-user.target
EOF

    # Enable and start service
    $USE_SUDO systemctl daemon-reload
    $USE_SUDO systemctl enable "$service_name"

    print_success_from_common_functions "MCP service $service_name added to systemd startup"
}

# Add to init.d startup (older systems)
add_to_initd_startup() {
    local file_path="$1"
    local service_name="$2"

    # Ensure service name has mcp prefix for identification
    service_name=$(ensure_mcp_prefix "$service_name")

    local init_script="/etc/init.d/$service_name"

    print_step_from_common_functions "Creating init.d service: $service_name"

    # Create init.d script
    $USE_SUDO tee "$init_script" > /dev/null << EOF
#!/bin/bash
### BEGIN INIT INFO
# Provides:          $service_name
# Required-Start:    \$network \$local_fs
# Required-Stop:     \$network \$local_fs
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Description:       $service_name MCP Service
### END INIT INFO

case "\$1" in
    start)
        echo "Starting MCP service $service_name..."
        $file_path &
        ;;
    stop)
        echo "Stopping MCP service $service_name..."
        pkill -f "$file_path"
        ;;
    restart)
        \$0 stop
        sleep 2
        \$0 start
        ;;
    *)
        echo "Usage: \$0 {start|stop|restart}"
        exit 1
        ;;
esac
EOF

    $USE_SUDO chmod +x "$init_script"
    $USE_SUDO update-rc.d "$service_name" defaults

    print_success_from_common_functions "MCP service $service_name added to init.d startup"
}

# Add to WSL startup (Windows Subsystem for Linux)
add_to_wsl_startup() {
    local file_path="$1"
    local service_name="$2"

    # Ensure service name has mcp prefix for identification
    service_name=$(ensure_mcp_prefix "$service_name")

    print_step_from_common_functions "Setting up WSL startup for: $service_name"

    # Try multiple possible Windows user directories
    local possible_dirs=(
        "/mnt/c/Users/$USER/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup"
        "/mnt/c/Users/$LOGNAME/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup"
        "/mnt/c/Users/$(whoami)/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup"
    )

    local windows_startup_dir=""
    for dir in "${possible_dirs[@]}"; do
        if [ -d "$dir" ]; then
            windows_startup_dir="$dir"
            break
        fi
    done

    if [ -n "$windows_startup_dir" ]; then
        local batch_file="$windows_startup_dir/${service_name}.bat"
        cat > "$batch_file" << EOF
@echo off
REM MCP Service: $service_name
wsl -d Ubuntu -u $USER -- $file_path
EOF
        print_success_from_common_functions "MCP service $service_name added to Windows startup folder"
    else
        print_step_from_common_functions "Windows startup folder not accessible, using crontab for WSL"
        # Fallback to crontab for WSL with mcp identifier
        local cron_entry="@reboot $file_path # MCP service: $service_name"
        (crontab -l 2>/dev/null; echo "$cron_entry") | crontab -
        print_success_from_common_functions "MCP service $service_name added to crontab (WSL fallback)"
    fi
}


# Add path to global environment and create symlinks automatically
add_to_global_path_from_common_functions() {
    local input_path="$1"

    if [ -z "$input_path" ]; then
        print_error_from_common_functions "Path parameter is required"
        return 1
    fi

    print_step_from_common_functions "Setting up global environment for $input_path"

    # Determine if input is a file (binary) or directory
    if [ -f "$input_path" ]; then
        # It's a binary file - create single symlink only
        local bin_path="$input_path"
        local bin_dir=$(dirname "$bin_path")
        local bin_name=$(basename "$bin_path")
        local link_path="/usr/local/bin/$bin_name"

        print_step_from_common_functions "Processing binary: $bin_name"

        # Enhanced protection: Skip creating symlinks for system critical files
        if is_protected_binary "$bin_name"; then
            print_error_from_common_functions "SECURITY: Skipping protected system binary: $bin_name"
            return 1
        fi

        # Additional check: prevent symlinks to system directories
        if [[ "$bin_path" == /usr/bin/* ]] || [[ "$bin_path" == /bin/* ]] || [[ "$bin_path" == /sbin/* ]] || [[ "$bin_path" == /usr/sbin/* ]]; then
            if is_protected_binary "$bin_name"; then
                print_error_from_common_functions "SECURITY: Refusing to create symlink to system binary: $bin_path"
                return 1
            fi
        fi

        # Add binary directory to global PATH in /etc/environment
        add_to_path_environment "$bin_dir"

        # Final safety check before creating symlink
        if [ -L "$link_path" ]; then
            local existing_target=$(readlink -f "$link_path" 2>/dev/null)
            if [[ "$existing_target" == /usr/bin/* ]] || [[ "$existing_target" == /bin/* ]] || [[ "$existing_target" == /sbin/* ]] || [[ "$existing_target" == /usr/sbin/* ]]; then
                local existing_name=$(basename "$existing_target")
                if is_protected_binary "$existing_name"; then
                    print_error_from_common_functions "SECURITY: Existing symlink points to protected binary: $link_path -> $existing_target"
                    return 1
                fi
            fi
        fi

        # Self-link guard: when the input already IS the /usr/local/bin link
        # (e.g. a caller passed `command -v <bin>`), linking it onto itself
        # would create a symlink loop (ELOOP) that breaks resolvers (pipx
        # post-install resolve, systemd, shells). Also repair a pre-existing
        # self-loop here (file detection: readlink equals the link itself).
        if [ -L "$link_path" ] && [ "$(readlink "$link_path" 2>/dev/null)" = "$link_path" ]; then
            print_step_from_common_functions "Removing self-referential symlink loop: $link_path"
            sudo rm -f "$link_path"
        fi
        if [ "$bin_path" = "$link_path" ]; then
            print_info_from_common_functions "Binary already at canonical link location: $link_path (no link needed)"
        else
            # Create symlink to /usr/local/bin
            if [ -L "$link_path" ] || [ -f "$link_path" ]; then
                sudo rm -f "$link_path"
            fi

            sudo ln -sf "$bin_path" "$link_path"
            # SECURITY: Do NOT chmod symlinks - this can affect the target file
            # Only set execute permission if it's a regular file, not a symlink
            if [ ! -L "$link_path" ] && [ -f "$link_path" ]; then
                sudo chmod 755 "$link_path"
            fi

            print_success_from_common_functions "Created symlink: $link_path -> $bin_path"
        fi
        
    elif [ -d "$input_path" ]; then
        # It's a directory - only add to environment variables, NO automatic symlink creation
        local target_dir="$input_path"
        local dir_name=$(basename "$target_dir")
        
        print_step_from_common_functions "Processing directory: $dir_name"

        # Add directory to global PATH in /etc/environment
        add_to_path_environment "$target_dir"

        # Also add bin subdirectory if it exists
        if [ -d "$target_dir/bin" ]; then
            if ! grep -q "PATH.*$target_dir/bin" /etc/environment 2>/dev/null; then
                $USE_SUDO sed -i '/^PATH=/d' /etc/environment 2>/dev/null || true
                echo "PATH=\"$target_dir/bin:$target_dir:/usr/local/bin:/usr/bin:/bin\"" | $USE_SUDO tee -a /etc/environment > /dev/null
            fi
        fi
        
        # Add environment variable for the directory
        local env_var="${dir_name^^}_HOME"
        if ! grep -q "$env_var=" /etc/environment 2>/dev/null; then
            echo "$env_var=\"$target_dir\"" | sudo tee -a /etc/environment > /dev/null
        fi
        
        # REMOVED: Automatic symlink creation for directory contents
        # This was the source of the sudo permission problem
        print_step_from_common_functions "Directory added to environment variables only (no automatic symlinks)"
        
    else
        print_error_from_common_functions "Path does not exist: $input_path"
        return 1
    fi
    
    # Source the updated environment for current session
    set -a
    source /etc/environment 2>/dev/null || true
    set +a
    
    print_success_from_common_functions "Global environment setup completed for $input_path"
    return 0
}

. "$COMMON_FUNCS_DIR/download_functions_common.sh"
. "$COMMON_FUNCS_DIR/runtime_helpers_common.sh"

# Write stdin to <target> only when the content changed. When <backup_dir> is
# given, the previous version is copied there once with a timestamp suffix.
# Single shared implementation (file_ops_common.sh) used by the
# nginx/certbot/domain installers and every start-script context.
# shellcheck source=/dev/null
. "$COMMON_FUNCS_DIR/file_ops_common.sh"
