#!/bin/bash
# Common reusable shell functions for scripts
# Naming rule: function names end with `_from_common_functions` so callers know the source file

# Resolve current directory and include shared globals
COMMON_FUNCS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHELLS_DIR="$(dirname "$COMMON_FUNCS_DIR")"

# Source gvar_common.sh from the same directory
source "$COMMON_FUNCS_DIR/gvar_common.sh"


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

# Common download function with fallback support
download_with_fallback_from_common_functions() {
    local download_urls=("$@")
    local output_file="${download_urls[-1]}"
    unset 'download_urls[-1]'

    local downloaded=false

    print_step_from_common_functions "Starting download to: $output_file"

    # Try each URL
    for url in "${download_urls[@]}"; do
        print_step_from_common_functions "Attempting to download from: $url"

        # Try with different wget options
        local wget_options=(
            "--timeout=30 --tries=3 --show-progress"
            "--timeout=60 --tries=2 --no-check-certificate"
            "--timeout=120 --tries=1 --no-dns-cache"
        )

        for options in "${wget_options[@]}"; do
            print_step_from_common_functions "Using wget options: $options"
            if eval "wget $options -O \"$output_file\" \"$url\""; then
                print_success_from_common_functions "Successfully downloaded from: $url"
                downloaded=true
                break 2
            else
                print_warning_from_common_functions "Failed with options: $options"
                $USE_SUDO rm -f "$output_file" 2>/dev/null
            fi
        done

        print_warning_from_common_functions "All wget attempts failed for: $url"
    done

    # Fallback to curl if wget failed
    if [ "$downloaded" = "false" ]; then
        print_step_from_common_functions "All wget sources failed. Checking if curl is available..."
        if command -v curl >/dev/null 2>&1; then
            print_step_from_common_functions "Trying with curl as fallback..."
            for url in "${download_urls[@]}"; do
                print_step_from_common_functions "Attempting curl download from: $url"
                if curl -L --connect-timeout 30 --max-time 300 -o "$output_file" "$url"; then
                    print_success_from_common_functions "Successfully downloaded with curl from: $url"
                    downloaded=true
                    break
                else
                    print_warning_from_common_functions "Curl failed for: $url"
                    $USE_SUDO rm -f "$output_file" 2>/dev/null
                fi
            done
        fi
    fi

    if [ "$downloaded" = "false" ]; then
        print_error_from_common_functions "All download methods failed"
        print_error_from_common_functions "Please check your network connectivity or try manually downloading:"
        for url in "${download_urls[@]}"; do
            echo "  $url"
        done
        return 1
    fi

    return 0
}

# Check if downloaded file exists and has valid size
check_existing_download_from_common_functions() {
    local file_path="$1"
    local min_size="${2:-20971520}"  # Default 20MB

    if [ -f "$file_path" ]; then
        print_step_from_common_functions "Found existing download file: $file_path"
        local file_size=$(stat -c%s "$file_path" 2>/dev/null || echo "0")
        if [ "$file_size" -gt "$min_size" ]; then
            print_success_from_common_functions "Existing file size looks good ($file_size bytes), skipping download"
            return 0
        else
            print_warning_from_common_functions "Existing file size too small ($file_size bytes), will re-download"
            $USE_SUDO rm -f "$file_path"
            return 1
        fi
    fi
    return 1
}

# Extract compressed archive (tar.gz, tar.xz, zip)
extract_archive_from_common_functions() {
    local archive_file="$1"
    local target_dir="$2"
    local strip_components="${3:-1}"

    if [ ! -f "$archive_file" ]; then
        print_error_from_common_functions "Archive file not found: $archive_file"
        return 1
    fi

    print_step_from_common_functions "Extracting archive: $archive_file"
    $USE_SUDO mkdir -p "$target_dir"

    case "$archive_file" in
        *.tar.gz|*.tgz)
            if $USE_SUDO tar -xzf "$archive_file" -C "$target_dir" --strip-components="$strip_components"; then
                print_success_from_common_functions "Successfully extracted tar.gz archive"
                return 0
            fi
            ;;
        *.tar.xz)
            if $USE_SUDO tar -xf "$archive_file" -C "$target_dir" --strip-components="$strip_components"; then
                print_success_from_common_functions "Successfully extracted tar.xz archive"
                return 0
            fi
            ;;
        *.zip)
            if $USE_SUDO unzip -q "$archive_file" -d "$target_dir"; then
                print_success_from_common_functions "Successfully extracted zip archive"
                return 0
            fi
            ;;
        *)
            print_error_from_common_functions "Unsupported archive format: $archive_file"
            return 1
            ;;
    esac

    print_error_from_common_functions "Failed to extract archive: $archive_file"
    return 1
}

# Clean up temporary files and directories
cleanup_temp_files_from_common_functions() {
    local file_or_dir="$1"

    if [ -z "$file_or_dir" ]; then
        print_warning_from_common_functions "No file or directory specified for cleanup"
        return 1
    fi

    if [ -e "$file_or_dir" ]; then
        print_step_from_common_functions "Cleaning up: $file_or_dir"
        $USE_SUDO rm -rf "$file_or_dir" 2>/dev/null
        if [ $? -eq 0 ]; then
            print_success_from_common_functions "Cleanup completed: $file_or_dir"
            return 0
        else
            print_warning_from_common_functions "Failed to cleanup: $file_or_dir"
            return 1
        fi
    fi

    return 0
}

# Smart print function with automatic type detection (from common_functions.sh)
smart_print_from_common_functions() {
    local msg="$1"
    local type="${2:-auto}"

    # Auto-detect message type if not specified
    if [ "$type" = "auto" ]; then
        case "$msg" in
            *"error"*|*"Error"*|*"ERROR"*|*"failed"*|*"Failed"*|*"FAILED"*|*"???*|*"???*)
                type="error"
                ;;
            *"success"*|*"Success"*|*"SUCCESS"*|*"completed"*|*"Completed"*|*"???*|*"???*)
                type="success"
                ;;
            *"warning"*|*"Warning"*|*"WARNING"*|*"warn"*|*"Warn"*|*"???*|*"????"*)
                type="warning"
                ;;
            *"info"*|*"Info"*|*"INFO"*|*"note"*|*"Note"*|*"???*|*"????"*)
                type="info"
                ;;
            *"debug"*|*"Debug"*|*"DEBUG"*|*"????"*)
                type="debug"
                ;;
            *)
                type="normal"
                ;;
        esac
    fi

    # Call appropriate print method based on type
    case "$type" in
        "error")
            print_error_from_common_functions "$msg"
            ;;
        "success")
            print_success_from_common_functions "$msg"
            ;;
        "warning")
            print_warning_from_common_functions "$msg"
            ;;
        "info")
            print_info_from_common_functions "$msg"
            ;;
        "debug")
            print_debug_from_common_functions "$msg"
            ;;
        "normal"|*)
            echo "$msg"
            ;;
    esac
}

# Debug print function (from common_functions.sh)
print_debug_from_common_functions() {
    local msg="$1"
    echo -e "\033[0;35m[DEBUG] ${msg}\033[0m"
}

# Print file content with prefix (from common_functions.sh)
print_file_with_prefix_from_common_functions() {
    local file_path="$1"
    local prefix="${2:-    }"

    if [[ ! -f "$file_path" ]]; then
        print_warning_from_common_functions "File not found: $file_path"
        return 1
    fi

    while IFS= read -r line || [[ -n "$line" ]]; do
        echo "${prefix}${line}"
    done < "$file_path"
}

# Show post-install artifacts for verification (from common_functions.sh)
show_post_install_artifacts_from_common_functions() {
    local launch_script="$1"
    local desktop_entry="$2"
    local system_desktop_disabled="$3"

    print_step_from_common_functions "Displaying generated launch artifacts"

    if [[ -n "$launch_script" ]] && [[ -f "$launch_script" ]]; then
        print_info_from_common_functions "Launch script: $launch_script"
        print_file_with_prefix_from_common_functions "$launch_script"
        echo ""
    fi

    if [[ -n "$desktop_entry" ]] && [[ -f "$desktop_entry" ]]; then
        print_info_from_common_functions "Desktop entry: $desktop_entry"
        print_file_with_prefix_from_common_functions "$desktop_entry"
        echo ""
    fi

    if [[ -n "$system_desktop_disabled" ]] && [[ -f "$system_desktop_disabled" ]]; then
        print_info_from_common_functions "System desktop entry disabled: $system_desktop_disabled"
    fi
}
