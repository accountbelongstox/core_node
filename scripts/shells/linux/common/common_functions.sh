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

    # Try curl first (primary method)
    if command -v curl >/dev/null 2>&1; then
        for url in "${download_urls[@]}"; do
            print_step_from_common_functions "Attempting curl download from: $url"

            # Try with different curl options
            local curl_options=(
                "-L --connect-timeout 30 --max-time 600 --retry 3 --retry-delay 2"
                "-L --connect-timeout 60 --max-time 900 --retry 2 --retry-delay 5 -k"
                "-L --connect-timeout 120 --max-time 1200 --retry 1 -k"
            )

            for options in "${curl_options[@]}"; do
                print_step_from_common_functions "Using curl options: $options"
                if eval "curl $options --progress-bar -o \"$output_file\" \"$url\""; then
                    print_success_from_common_functions "Successfully downloaded with curl from: $url"
                    downloaded=true
                    break 2
                else
                    print_warning_from_common_functions "Failed with options: $options"
                    rm -f "$output_file" 2>/dev/null
                fi
            done

            print_warning_from_common_functions "All curl attempts failed for: $url"
        done
    else
        print_warning_from_common_functions "curl is not available, skipping curl method"
    fi

    # Fallback to wget if curl failed
    if [ "$downloaded" = "false" ]; then
        print_step_from_common_functions "curl failed. Checking if wget is available..."
        if command -v wget >/dev/null 2>&1; then
            print_step_from_common_functions "Trying with wget as fallback..."

            for url in "${download_urls[@]}"; do
                print_step_from_common_functions "Attempting wget download from: $url"

                # Try with different wget options
                local wget_options=(
                    "--timeout=30 --tries=3 --show-progress"
                    "--timeout=60 --tries=2 --no-check-certificate"
                    "--timeout=120 --tries=1 --no-check-certificate"
                )

                for options in "${wget_options[@]}"; do
                    print_step_from_common_functions "Using wget options: $options"
                    if eval "wget $options -O \"$output_file\" \"$url\""; then
                        print_success_from_common_functions "Successfully downloaded with wget from: $url"
                        downloaded=true
                        break 2
                    else
                        print_warning_from_common_functions "Failed with options: $options"
                        rm -f "$output_file" 2>/dev/null
                    fi
                done

                print_warning_from_common_functions "All wget attempts failed for: $url"
            done
        else
            print_warning_from_common_functions "wget is not available either"
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

# Enhanced download function with browser headers and redirect support
# Usage: download_with_browser_headers_from_common_functions <url> <output_dir> [max_retries]
# Returns: Path to downloaded file (echoes to stdout)
# Exit codes: 0=success, 1=failure
download_with_browser_headers_from_common_functions() {
    local url="$1"
    local output_dir="$2"
    local max_retries="${3:-3}"

    if [[ -z "$url" ]] || [[ -z "$output_dir" ]]; then
        print_error_from_common_functions "Usage: download_with_browser_headers_from_common_functions <url> <output_dir> [max_retries]"
        return 1
    fi

    # Create output directory if it doesn't exist
    mkdir -p "$output_dir" 2>/dev/null || true

    # Browser User-Agent header
    local user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    print_step_from_common_functions "Attempting to download from: $url"
    print_info_from_common_functions "Output directory: $output_dir"

    local retry_count=0
    local downloaded=false
    local final_file=""

    while [[ $retry_count -lt $max_retries ]]; do
        if [[ $retry_count -gt 0 ]]; then
            print_warning_from_common_functions "Retry attempt $retry_count/$max_retries..."
            sleep 2
        fi

        # Try wget first (preferred for showing progress)
        if command -v wget >/dev/null 2>&1; then
            print_step_from_common_functions "Using wget with browser headers..."

            # Get the final redirect URL and filename
            local temp_headers="/tmp/download_headers_$$.txt"

            # First, do a HEAD request to get final URL and filename
            if wget --spider --server-response \
                --user-agent="$user_agent" \
                --max-redirect=10 \
                "$url" 2>&1 | tee "$temp_headers" | grep -q "HTTP/"; then

                # Extract filename from Content-Disposition or URL
                local filename=""
                if grep -q "Content-Disposition" "$temp_headers"; then
                    filename=$(grep "Content-Disposition" "$temp_headers" | \
                        grep -oP 'filename=["'"'"']?\K[^"'"'"';]+' | tail -1)
                fi

                # If no filename from header, extract from final URL
                if [[ -z "$filename" ]]; then
                    local final_url=$(grep "Location:" "$temp_headers" | tail -1 | awk '{print $2}' | tr -d '\r')
                    if [[ -n "$final_url" ]]; then
                        filename=$(basename "$final_url")
                    else
                        filename=$(basename "$url")
                    fi
                fi

                # Remove any query parameters from filename
                filename="${filename%%\?*}"

                # Ensure filename is not empty
                if [[ -z "$filename" ]]; then
                    filename="download_$(date +%s)"
                fi

                final_file="$output_dir/$filename"
                print_info_from_common_functions "Target file: $filename"

                # Check if file already exists and is valid
                if [[ -f "$final_file" ]]; then
                    local existing_size=$(stat -c%s "$final_file" 2>/dev/null || stat -f%z "$final_file" 2>/dev/null || echo "0")
                    print_info_from_common_functions "File already exists: $filename ($existing_size bytes)"

                    # Get remote file size from Content-Length header
                    local remote_size=$(grep -i "Content-Length:" "$temp_headers" | tail -1 | awk '{print $2}' | tr -d '\r' || echo "0")

                    if [[ "$remote_size" -gt 0 ]] && [[ "$existing_size" -eq "$remote_size" ]]; then
                        # File size matches and is valid (>50MB for Cursor/VSCode)
                        if [[ "$existing_size" -gt 52428800 ]]; then
                            print_success_from_common_functions "File already downloaded and verified: $filename ($existing_size bytes)"
                            print_info_from_common_functions "Skipping download"
                            downloaded=true
                            rm -f "$temp_headers"
                            echo "$final_file"
                            return 0
                        else
                            print_warning_from_common_functions "File size too small ($existing_size bytes), re-downloading"
                            rm -f "$final_file"
                        fi
                    elif [[ "$remote_size" -gt 0 ]]; then
                        print_warning_from_common_functions "File size mismatch (local: $existing_size bytes, remote: $remote_size bytes)"
                        print_info_from_common_functions "Re-downloading file"
                        rm -f "$final_file"
                    else
                        print_warning_from_common_functions "Could not verify remote file size, checking local file"
                        # If we can't get remote size, trust local file if it's large enough
                        if [[ "$existing_size" -gt 52428800 ]]; then
                            print_success_from_common_functions "Local file appears valid: $filename ($existing_size bytes)"
                            print_info_from_common_functions "Skipping download"
                            downloaded=true
                            rm -f "$temp_headers"
                            echo "$final_file"
                            return 0
                        else
                            print_warning_from_common_functions "Local file too small ($existing_size bytes), re-downloading"
                            rm -f "$final_file"
                        fi
                    fi
                fi

                # Now download with progress (keep stderr for progress display)
                echo ""  # Add newline before progress bar
                print_info_from_common_functions "Downloading to: $final_file"

                if wget --show-progress --progress=bar:force \
                    --user-agent="$user_agent" \
                    --max-redirect=10 \
                    --timeout=30 \
                    --tries=2 \
                    -O "$final_file" \
                    "$url"; then

                    echo ""  # Add newline after progress bar

                    # Wait a moment for file system to sync
                    sleep 1

                    # Verify file was downloaded and has size > 0
                    if [[ -f "$final_file" ]]; then
                        if [[ -s "$final_file" ]]; then
                            local file_size=$(stat -c%s "$final_file" 2>/dev/null || stat -f%z "$final_file" 2>/dev/null || echo "0")
                            print_success_from_common_functions "Download successful: $filename ($file_size bytes)"
                            downloaded=true
                            rm -f "$temp_headers"
                            echo "$final_file"
                            return 0
                        else
                            print_warning_from_common_functions "Downloaded file is empty (0 bytes): $final_file"
                            rm -f "$final_file"
                        fi
                    else
                        print_warning_from_common_functions "Downloaded file not found: $final_file"
                    fi
                else
                    echo ""  # Add newline after failed download
                    print_warning_from_common_functions "wget download failed (exit code: $?)"
                    rm -f "$final_file"
                fi
            else
                print_warning_from_common_functions "wget spider check failed"
            fi

            rm -f "$temp_headers"
        fi

        # Try curl as fallback
        if [[ "$downloaded" = "false" ]] && command -v curl >/dev/null 2>&1; then
            print_step_from_common_functions "Using curl with browser headers..."

            # Get final filename from redirect
            local redirect_url=$(curl -sIL \
                -A "$user_agent" \
                --max-redirs 10 \
                "$url" | grep -i "^location:" | tail -1 | awk '{print $2}' | tr -d '\r')

            local filename=""
            if [[ -n "$redirect_url" ]]; then
                filename=$(basename "$redirect_url")
            else
                filename=$(basename "$url")
            fi

            # Remove query parameters
            filename="${filename%%\?*}"

            if [[ -z "$filename" ]]; then
                filename="download_$(date +%s)"
            fi

            final_file="$output_dir/$filename"
            print_info_from_common_functions "Target file: $filename"

            # Check if file already exists and is valid
            if [[ -f "$final_file" ]]; then
                local existing_size=$(stat -c%s "$final_file" 2>/dev/null || stat -f%z "$final_file" 2>/dev/null || echo "0")
                print_info_from_common_functions "File already exists: $filename ($existing_size bytes)"

                # Get remote file size from Content-Length header using curl
                local remote_size=$(curl -sIL \
                    -A "$user_agent" \
                    --max-redirs 10 \
                    "$url" | grep -i "^content-length:" | tail -1 | awk '{print $2}' | tr -d '\r' || echo "0")

                if [[ "$remote_size" -gt 0 ]] && [[ "$existing_size" -eq "$remote_size" ]]; then
                    # File size matches and is valid (>50MB for Cursor/VSCode)
                    if [[ "$existing_size" -gt 52428800 ]]; then
                        print_success_from_common_functions "File already downloaded and verified: $filename ($existing_size bytes)"
                        print_info_from_common_functions "Skipping download"
                        downloaded=true
                        echo "$final_file"
                        return 0
                    else
                        print_warning_from_common_functions "File size too small ($existing_size bytes), re-downloading"
                        rm -f "$final_file"
                    fi
                elif [[ "$remote_size" -gt 0 ]]; then
                    print_warning_from_common_functions "File size mismatch (local: $existing_size bytes, remote: $remote_size bytes)"
                    print_info_from_common_functions "Re-downloading file"
                    rm -f "$final_file"
                else
                    print_warning_from_common_functions "Could not verify remote file size, checking local file"
                    # If we can't get remote size, trust local file if it's large enough
                    if [[ "$existing_size" -gt 52428800 ]]; then
                        print_success_from_common_functions "Local file appears valid: $filename ($existing_size bytes)"
                        print_info_from_common_functions "Skipping download"
                        downloaded=true
                        echo "$final_file"
                        return 0
                    else
                        print_warning_from_common_functions "Local file too small ($existing_size bytes), re-downloading"
                        rm -f "$final_file"
                    fi
                fi
            fi

            # Download with curl showing progress
            echo ""  # Add newline before progress bar
            print_info_from_common_functions "Downloading to: $final_file"

            if curl -L --progress-bar \
                -A "$user_agent" \
                --max-redirs 10 \
                --connect-timeout 30 \
                --max-time 600 \
                -o "$final_file" \
                "$url"; then

                echo ""  # Add newline after progress bar

                # Wait a moment for file system to sync
                sleep 1

                # Verify file was downloaded and has size > 0
                if [[ -f "$final_file" ]]; then
                    if [[ -s "$final_file" ]]; then
                        local file_size=$(stat -c%s "$final_file" 2>/dev/null || stat -f%z "$final_file" 2>/dev/null || echo "0")
                        print_success_from_common_functions "Download successful: $filename ($file_size bytes)"
                        downloaded=true
                        echo "$final_file"
                        return 0
                    else
                        print_warning_from_common_functions "Downloaded file is empty (0 bytes): $final_file"
                        rm -f "$final_file"
                    fi
                else
                    print_warning_from_common_functions "Downloaded file not found: $final_file"
                fi
            else
                echo ""  # Add newline after failed download
                print_warning_from_common_functions "curl download failed (exit code: $?)"
                rm -f "$final_file"
            fi
        fi

        retry_count=$((retry_count + 1))
    done

    if [[ "$downloaded" = "false" ]]; then
        print_error_from_common_functions "All download attempts failed after $max_retries retries"
        print_error_from_common_functions "URL: $url"
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

# ============================================================================
# Directory Migration and Permission Management Functions
# ============================================================================

# Get real user (not root, not sudo) (from common_functions.sh)
get_real_user_from_common_functions() {
    local real_user=""
    local real_home=""

    # Priority 1: Check SUDO_USER environment variable
    if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
        real_user="$SUDO_USER"
        real_home="$(getent passwd "$real_user" 2>/dev/null | cut -d: -f6)"
        if [ -n "$real_home" ] && [ -d "$real_home" ]; then
            echo "$real_user"
            return 0
        fi
    fi

    # Priority 2: If not root, return current user
    if [ "$(id -u)" -ne 0 ] && [ "$USER" != "root" ]; then
        echo "$USER"
        return 0
    fi

    # Priority 3: Check ACTUAL_DESKTOP_USER from gvar_common.sh
    if [ -n "${ACTUAL_DESKTOP_USER:-}" ] && [ "$ACTUAL_DESKTOP_USER" != "root" ]; then
        echo "$ACTUAL_DESKTOP_USER"
        return 0
    fi

    # Priority 4: Scan /home/* for most recently modified accessible directory
    # This finds the user who is actively using the system
    local most_recent_user=""
    local most_recent_time=0

    for user_home in /home/*; do
        if [ -d "$user_home" ] && [ -r "$user_home" ]; then
            local username="$(basename "$user_home")"

            # Skip system users and special names
            if [ "$username" = "lost+found" ] || [ "$username" = "nobody" ]; then
                continue
            fi

            # Check if user exists in passwd
            if ! id -u "$username" >/dev/null 2>&1; then
                continue
            fi

            # Get last modification time of home directory and common subdirectories
            local check_dirs=(
                "$user_home"
                "$user_home/.bashrc"
                "$user_home/.profile"
                "$user_home/.local"
                "$user_home/.config"
                "$user_home/Desktop"
                "$user_home/Documents"
            )

            for check_dir in "${check_dirs[@]}"; do
                if [ -e "$check_dir" ]; then
                    local mtime=$(stat -c %Y "$check_dir" 2>/dev/null || echo 0)
                    if [ "$mtime" -gt "$most_recent_time" ]; then
                        most_recent_time=$mtime
                        most_recent_user="$username"
                    fi
                fi
            done
        fi
    done

    if [ -n "$most_recent_user" ]; then
        echo "$most_recent_user"
        return 0
    fi

    # Priority 5: Find first non-system user (UID >= 1000, < 60000)
    while IFS=: read -r username _ uid _ _ homedir _; do
        if [ "$uid" -ge 1000 ] && [ "$uid" -lt 60000 ] && [ -d "$homedir" ] && [ "$username" != "nobody" ]; then
            echo "$username"
            return 0
        fi
    done < /etc/passwd

    # Fallback: return current user
    echo "$USER"
    return 0
}

# Migrate from old directory to new directory (from common_functions.sh)
migrate_old_to_new_directory_from_common_functions() {
    local old_base_pattern="$1"  # e.g., "dev_ubuntu24" or "/www/dev_ubuntu24"
    local new_base_pattern="$2"  # e.g., "_ubuntu_24" or "/www/_ubuntu_24"
    local specific_path="${3:-}"  # Optional: specific subdirectory to migrate

    # Resolve full paths
    local old_dir=""
    local new_dir=""
    local www_base=$(map_web_path "www")

    # If patterns don't start with /, assume they're under www
    if [[ "$old_base_pattern" != /* ]]; then
        old_dir="$www_base/$old_base_pattern"
    else
        old_dir="$old_base_pattern"
    fi

    if [[ "$new_base_pattern" != /* ]]; then
        new_dir="$www_base/$new_base_pattern"
    else
        new_dir="$new_base_pattern"
    fi

    # If specific path provided, append it
    if [ -n "$specific_path" ]; then
        old_dir="$old_dir/$specific_path"
        new_dir="$new_dir/$specific_path"
    fi

    # Check if old directory exists
    if [ ! -d "$old_dir" ]; then
        print_debug_from_common_functions "Old directory does not exist: $old_dir"
        return 0
    fi

    # Check if new directory already exists
    if [ -d "$new_dir" ]; then
        print_warning_from_common_functions "New directory already exists: $new_dir"
        print_info_from_common_functions "Merging contents from old directory: $old_dir"

        # Merge: Copy files that don't exist in new directory
        $USE_SUDO rsync -a --ignore-existing "$old_dir/" "$new_dir/"

        print_info_from_common_functions "Removing old directory: $old_dir"
        $USE_SUDO rm -rf "$old_dir"
    else
        print_step_from_common_functions "Migrating: $old_dir -> $new_dir"

        # Create parent directory if needed
        local parent_dir="$(dirname "$new_dir")"
        if [ ! -d "$parent_dir" ]; then
            $USE_SUDO mkdir -p "$parent_dir"
        fi

        # Move the entire directory
        $USE_SUDO mv "$old_dir" "$new_dir"

        print_success_from_common_functions "Migration complete: $new_dir"
    fi

    return 0
}

# Fix permissions for installation directory (from common_functions.sh)
fix_installation_permissions_from_common_functions() {
    local target_path="$1"
    local permission_mode="${2:-777}"  # Default: 777 (all users)
    local set_owner="${3:-true}"       # Default: set owner to real user

    if [ ! -e "$target_path" ]; then
        print_warning_from_common_functions "Path does not exist: $target_path"
        return 1
    fi

    print_step_from_common_functions "Fixing permissions for: $target_path"
    print_info_from_common_functions "[SAFE_PATH] target_path=$target_path"

    # Refuse recursive chown/chmod on system or dangerous paths
    if [ -z "$target_path" ] || [[ "$target_path" != /* ]]; then
        print_warning_from_common_functions "Refusing: target_path empty or not absolute"
        return 1
    fi
    case "$target_path" in
        /|/usr|/usr/*|/etc|/etc/*|/bin|/bin/*|/sbin|/sbin/*|/lib|/lib/*|/var)
            print_warning_from_common_functions "Refusing chown/chmod on system path: $target_path"
            return 1
            ;;
    esac

    # Get real user
    local real_user=$(get_real_user_from_common_functions)
    local real_group=$(id -gn "$real_user" 2>/dev/null || echo "$real_user")

    print_info_from_common_functions "Real user: $real_user:$real_group"
    print_info_from_common_functions "Permission mode: $permission_mode"

    # Set ownership to real user if requested
    if [ "$set_owner" = "true" ]; then
        print_info_from_common_functions "Changing ownership to: $real_user:$real_group"
        $USE_SUDO chown -R "$real_user:$real_group" "$target_path" 2>/dev/null || {
            print_warning_from_common_functions "Failed to change ownership, continuing..."
        }
    fi

    # Set permissions
    print_info_from_common_functions "Setting permissions: $permission_mode"
    $USE_SUDO chmod -R "$permission_mode" "$target_path" 2>/dev/null || {
        print_warning_from_common_functions "Failed to set permissions, continuing..."
    }

    # For directories, also set execute bit
    if [ -d "$target_path" ]; then
        $USE_SUDO find "$target_path" -type d -exec chmod a+x {} \; 2>/dev/null || true
    fi

    print_success_from_common_functions "Permissions fixed for: $target_path"
    return 0
}

# Ensure directory exists with correct permissions (from common_functions.sh)
ensure_directory_permissions_from_common_functions() {
    local target_dir="$1"
    local permission_mode="${2:-755}"  # Default: 755
    local set_owner="${3:-true}"       # Default: set owner to real user

    # Create directory if it doesn't exist
    if [ ! -d "$target_dir" ]; then
        print_step_from_common_functions "Creating directory: $target_dir"
        $USE_SUDO mkdir -p "$target_dir"
    fi

    # Fix permissions
    fix_installation_permissions_from_common_functions "$target_dir" "$permission_mode" "$set_owner"

    return 0
}

# Fix NPM global installation permissions (from common_functions.sh)
fix_npm_global_permissions_from_common_functions() {
    print_step_from_common_functions "Fixing NPM global installation permissions"

    # Get npm global prefix
    local npm_prefix=$(npm config get prefix 2>/dev/null || echo "")

    if [ -z "$npm_prefix" ] || [ ! -d "$npm_prefix" ]; then
        print_warning_from_common_functions "NPM global prefix not found or not a directory"
        return 1
    fi

    print_info_from_common_functions "NPM global prefix: $npm_prefix"

    # Fix permissions for bin and lib directories
    if [ -d "$npm_prefix/bin" ]; then
        fix_installation_permissions_from_common_functions "$npm_prefix/bin" "755" "true"
    fi

    if [ -d "$npm_prefix/lib" ]; then
        fix_installation_permissions_from_common_functions "$npm_prefix/lib" "755" "true"
    fi

    # Make all binaries executable
    if [ -d "$npm_prefix/bin" ]; then
        $USE_SUDO find "$npm_prefix/bin" -type f -exec chmod +x {} \; 2>/dev/null || true
    fi

    print_success_from_common_functions "NPM permissions fixed"
    return 0
}

# Update wrapper scripts to use new directory paths (from common_functions.sh)
update_wrapper_script_paths_from_common_functions() {
    local wrapper_dir="${1:-/usr/local/super_scripts}"
    local old_pattern="${2:-}"
    local new_pattern="${3:-_ubuntu_24}"

    if [ ! -d "$wrapper_dir" ]; then
        print_warning_from_common_functions "Wrapper directory does not exist: $wrapper_dir"
        return 0
    fi

    print_step_from_common_functions "Updating wrapper scripts in: $wrapper_dir"

    local updated_count=0

    # Find and update all wrapper scripts
    while IFS= read -r -d '' script_file; do
        if grep -q "$old_pattern" "$script_file" 2>/dev/null; then
            print_info_from_common_functions "Updating: $script_file"
            $USE_SUDO sed -i "s|$old_pattern|$new_pattern|g" "$script_file"
            ((updated_count++))
        fi
    done < <(find "$wrapper_dir" -type f -name "*.sh" -print0 2>/dev/null)

    # Also check files without .sh extension
    while IFS= read -r -d '' script_file; do
        if [ -f "$script_file" ] && [ ! -d "$script_file" ] && grep -q "$old_pattern" "$script_file" 2>/dev/null; then
            print_info_from_common_functions "Updating: $script_file"
            $USE_SUDO sed -i "s|$old_pattern|$new_pattern|g" "$script_file"
            ((updated_count++))
        fi
    done < <(find "$wrapper_dir" -type f ! -name "*.sh" -print0 2>/dev/null)

    print_success_from_common_functions "Updated $updated_count wrapper scripts"
    return 0
}

# ============================================================================
# DOWNLOADS DIRECTORY SEARCH FUNCTIONS
# ============================================================================

# Find all Downloads directories for all users
# Returns: Array of Downloads directory paths
find_all_downloads_dirs_from_common_functions() {
    local search_dirs=()

    # Add current user's Downloads
    if [[ -n "$HOME" ]] && [[ -d "$HOME/Downloads" ]]; then
        search_dirs+=("$HOME/Downloads")
    fi

    # Add all other users' Downloads directories
    if [[ -d "/home" ]]; then
        for user_home in /home/*; do
            if [[ -d "$user_home/Downloads" ]]; then
                search_dirs+=("$user_home/Downloads")
            fi
        done
    fi

    # Add root's Downloads
    if [[ -d "/root/Downloads" ]]; then
        search_dirs+=("/root/Downloads")
    fi

    # Return unique directories
    printf '%s\n' "${search_dirs[@]}" | sort -u
}

# Find a specific file pattern in all Downloads directories
# Usage: find_file_in_downloads_from_common_functions <pattern> [newest|oldest]
# Pattern: Glob pattern to match (e.g., "*.deb", "code_*.deb", "cursor-*.AppImage")
# Sort: "newest" (default) or "oldest" - return newest or oldest matching file
# Returns: Full path to the found file, or empty string if not found
find_file_in_downloads_from_common_functions() {
    local pattern="$1"
    local sort_order="${2:-newest}"  # Default to newest
    local found_files=()

    # Get all Downloads directories
    local search_dirs=($(find_all_downloads_dirs_from_common_functions))

    if [[ ${#search_dirs[@]} -eq 0 ]]; then
        return 1
    fi

    # Search for files matching pattern (case-insensitive)
    for dir in "${search_dirs[@]}"; do
        while IFS= read -r -d '' file; do
            if [[ -f "$file" ]]; then
                found_files+=("$file")
            fi
        done < <(find "$dir" -maxdepth 1 -type f -iname "$pattern" -print0 2>/dev/null)
    done

    if [[ ${#found_files[@]} -eq 0 ]]; then
        return 1
    fi

    # Sort files by modification time
    local sorted_file
    if [[ "$sort_order" == "oldest" ]]; then
        # Oldest first
        sorted_file=$(printf '%s\n' "${found_files[@]}" | xargs -r ls -t -r | head -n 1)
    else
        # Newest first (default)
        sorted_file=$(printf '%s\n' "${found_files[@]}" | xargs -r ls -t | head -n 1)
    fi

    if [[ -n "$sorted_file" ]] && [[ -f "$sorted_file" ]]; then
        echo "$sorted_file"
        return 0
    fi

    return 1
}

# Find multiple files matching a pattern in Downloads directories
# Usage: find_files_in_downloads_from_common_functions <pattern> [max_results]
# Pattern: Glob pattern to match
# Max results: Maximum number of results to return (default: unlimited)
# Returns: Array of file paths, sorted by modification time (newest first)
find_files_in_downloads_from_common_functions() {
    local pattern="$1"
    local max_results="${2:-0}"  # 0 means unlimited
    local found_files=()

    # Get all Downloads directories
    local search_dirs=($(find_all_downloads_dirs_from_common_functions))

    if [[ ${#search_dirs[@]} -eq 0 ]]; then
        return 1
    fi

    # Search for files matching pattern (case-insensitive)
    for dir in "${search_dirs[@]}"; do
        while IFS= read -r -d '' file; do
            if [[ -f "$file" ]]; then
                found_files+=("$file")
            fi
        done < <(find "$dir" -maxdepth 1 -type f -iname "$pattern" -print0 2>/dev/null)
    done

    if [[ ${#found_files[@]} -eq 0 ]]; then
        return 1
    fi

    # Sort by modification time (newest first) and limit results
    if [[ $max_results -gt 0 ]]; then
        printf '%s\n' "${found_files[@]}" | xargs -r ls -t | head -n "$max_results"
    else
        printf '%s\n' "${found_files[@]}" | xargs -r ls -t
    fi

    return 0
}

# Prompt user to download a file and wait for it to appear in Downloads
# Usage: prompt_and_wait_for_download_from_common_functions <url> <pattern> [timeout_seconds]
# URL: Download URL to show to user
# Pattern: File pattern to search for (e.g., "*.deb", "cursor-*.AppImage")
# Timeout: Maximum time to wait in seconds (default: 0 = infinite wait)
# Returns: Path to downloaded file, or returns error code if cancelled
# NOTE: This function loops FOREVER with auto-detection every 2 seconds until file found or user cancels
prompt_and_wait_for_download_from_common_functions() {
    local download_url="$1"
    local file_pattern="$2"
    local timeout_seconds="${3:-0}"  # 0 means infinite wait
    local start_time=$(date +%s)
    local check_interval=2  # Auto-check every 2 seconds
    local last_check=0

    print_step_from_common_functions "Manual download required"
    print_info_from_common_functions "Download URL: $download_url"
    print_info_from_common_functions "Save the file to any /home/*/Downloads directory"
    print_info_from_common_functions "Expected file pattern: $file_pattern"

    # Try to open URL in browser
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$download_url" 2>/dev/null &
    elif command -v open >/dev/null 2>&1; then
        open "$download_url" 2>/dev/null &
    fi

    echo ""
    if [[ $timeout_seconds -gt 0 ]]; then
        print_info_from_common_functions "Auto-scanning every ${check_interval}s (timeout: ${timeout_seconds}s)"
    else
        print_info_from_common_functions "Auto-scanning every ${check_interval}s (waiting indefinitely)"
    fi
    print_info_from_common_functions "Type 'quit' to cancel anytime"
    echo ""

    # Infinite while loop - only exits when file found or user cancels
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        # Auto-check at regular intervals
        if [[ $((current_time - last_check)) -ge $check_interval ]]; then
            local found_file=$(find_file_in_downloads_from_common_functions "$file_pattern" "newest")
            if [[ -n "$found_file" ]] && [[ -f "$found_file" ]]; then
                echo ""
                print_success_from_common_functions "Auto-detected downloaded file: $found_file"
                echo "$found_file"
                return 0
            fi
            last_check=$current_time

            # Show progress every auto-check
            echo "[${elapsed}s] Scanning Downloads directories for: $file_pattern"
        fi

        # Check timeout (if set)
        if [[ $timeout_seconds -gt 0 ]] && [[ $elapsed -ge $timeout_seconds ]]; then
            echo ""
            print_error_from_common_functions "Download timeout after ${timeout_seconds}s"
            return 1
        fi

        # Non-blocking input check (1 second timeout)
        read -r -t 1 user_input 2>/dev/null || true

        if [[ -n "$user_input" ]]; then
            case "${user_input,,}" in
                quit|q|exit|cancel)
                    echo ""
                    print_warning_from_common_functions "Download cancelled by user"
                    return 1
                    ;;
                yes|y|check)
                    # Force immediate check
                    local found_file=$(find_file_in_downloads_from_common_functions "$file_pattern" "newest")
                    if [[ -n "$found_file" ]] && [[ -f "$found_file" ]]; then
                        echo ""
                        print_success_from_common_functions "Found file: $found_file"
                        echo "$found_file"
                        return 0
                    else
                        print_warning_from_common_functions "File not found yet, continuing auto-scan..."
                    fi
                    ;;
            esac
        fi
    done

    # This line should never be reached due to infinite loop
    return 1
}

# ============================================================================
# NODE.JS TOOLS EXECUTION FUNCTIONS
# ============================================================================

# Execute node with absolute path and proper environment
# Usage: run_node_from_common_functions [args...]
# Returns: node exit code
run_node_from_common_functions() {
    # Ensure NODE_BIN is set
    if [[ -z "$NODE_BIN" ]] || [[ ! -x "$NODE_BIN" ]]; then
        # Fallback to system node
        if command -v node >/dev/null 2>&1; then
            node "$@"
            return $?
        else
            echo "Error: Node.js not found. Please install Node.js first." >&2
            return 127
        fi
    fi

    # Execute with absolute path
    "$NODE_BIN" "$@"
    return $?
}

# Execute npm with absolute path and proper environment
# Usage: run_npm_from_common_functions [args...]
# Returns: npm exit code
run_npm_from_common_functions() {
    # Ensure NPM_BIN is set
    if [[ -z "$NPM_BIN" ]] || [[ ! -x "$NPM_BIN" ]]; then
        # Fallback to system npm
        if command -v npm >/dev/null 2>&1; then
            npm "$@"
            return $?
        else
            echo "Error: npm not found. Please install npm first." >&2
            return 127
        fi
    fi

    # Add NODE_BIN_DIR to PATH for this execution
    local old_path="$PATH"
    export PATH="$NODE_BIN_DIR:$PATH"

    # Execute with absolute path
    "$NPM_BIN" "$@"
    local exit_code=$?

    # Restore PATH
    export PATH="$old_path"

    return $exit_code
}

# Execute pnpm with absolute path and proper environment
# Usage: run_pnpm_from_common_functions [args...]
# Returns: pnpm exit code
run_pnpm_from_common_functions() {
    # Idempotency: under no TTY (install scripts, systemd services) pnpm ABORTS its
    # node_modules format-purge (ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY) instead of
    # recreating the tree, which breaks otherwise-idempotent re-runs. Auto-confirm that
    # purge for these programmatic pnpm calls so install/add recreate node_modules and
    # never block. A caller may override by pre-setting npm_config_confirm_modules_purge.
    export npm_config_confirm_modules_purge="${npm_config_confirm_modules_purge:-false}"

    # Ensure PNPM_BIN is set
    if [[ -z "$PNPM_BIN" ]]; then
        # Try to find pnpm in NODE_BIN_DIR
        if [[ -n "$NODE_BIN_DIR" ]] && [[ -x "$NODE_BIN_DIR/pnpm" ]]; then
            PNPM_BIN="$NODE_BIN_DIR/pnpm"
        elif command -v pnpm >/dev/null 2>&1; then
            # Fallback to system pnpm
            pnpm "$@"
            return $?
        else
            echo "Error: pnpm not found. Please install pnpm first (npm install -g pnpm)" >&2
            return 127
        fi
    fi

    # Check if pnpm is installed
    if [[ ! -x "$PNPM_BIN" ]]; then
        # Try fallback
        if command -v pnpm >/dev/null 2>&1; then
            pnpm "$@"
            return $?
        else
            echo "Error: pnpm not found at $PNPM_BIN" >&2
            return 127
        fi
    fi

    # Add NODE_BIN_DIR and PNPM_GLOBAL_BIN_DIR to PATH for this execution
    local old_path="$PATH"
    if [[ -n "$PNPM_GLOBAL_BIN_DIR" ]]; then
        export PATH="$PNPM_GLOBAL_BIN_DIR:$NODE_BIN_DIR:$PATH"
    elif [[ -n "$NODE_BIN_DIR" ]]; then
        export PATH="$NODE_BIN_DIR:$PATH"
    fi

    # Execute with absolute path
    "$PNPM_BIN" "$@"
    local exit_code=$?

    # Restore original PATH
    export PATH="$old_path"
    return $exit_code
}

# Execute yarn with absolute path and proper environment
# Usage: run_yarn_from_common_functions [args...]
# Returns: yarn exit code
run_yarn_from_common_functions() {
    # Ensure YARN_BIN is set
    if [[ -z "$YARN_BIN" ]]; then
        # Try to find yarn in NODE_BIN_DIR
        if [[ -n "$NODE_BIN_DIR" ]] && [[ -x "$NODE_BIN_DIR/yarn" ]]; then
            YARN_BIN="$NODE_BIN_DIR/yarn"
        elif command -v yarn >/dev/null 2>&1; then
            # Fallback to system yarn
            yarn "$@"
            return $?
        else
            echo "Error: yarn not found. Please install yarn first." >&2
            return 127
        fi
    fi

    # Check if yarn is installed
    if [[ ! -x "$YARN_BIN" ]]; then
        # Try fallback
        if command -v yarn >/dev/null 2>&1; then
            yarn "$@"
            return $?
        else
            echo "Error: yarn not found at $YARN_BIN" >&2
            return 127
        fi
    fi

    # Add NODE_BIN_DIR to PATH for this execution
    local old_path="$PATH"
    export PATH="$NODE_BIN_DIR:$PATH"

    # Execute with absolute path
    "$YARN_BIN" "$@"
    local exit_code=$?

    # Restore PATH
    export PATH="$old_path"

    return $exit_code
}

# Execute npx with absolute path and proper environment
# Usage: run_npx_from_common_functions [args...]
# Returns: npx exit code
run_npx_from_common_functions() {
    # Ensure NPX_BIN is set
    if [[ -z "$NPX_BIN" ]] || [[ ! -x "$NPX_BIN" ]]; then
        # Fallback to system npx
        if command -v npx >/dev/null 2>&1; then
            npx "$@"
            return $?
        else
            echo "Error: npx not found. Please install npx first." >&2
            return 127
        fi
    fi

    # Add NODE_BIN_DIR to PATH for this execution
    local old_path="$PATH"
    export PATH="$NODE_BIN_DIR:$PATH"

    # Execute with absolute path
    "$NPX_BIN" "$@"
    local exit_code=$?

    # Restore PATH
    export PATH="$old_path"

    return $exit_code
}

# Ensure pnpm global bin directory is in PATH
# Usage: ensure_pnpm_path_from_common_functions
# Returns: 0 on success, 1 on failure
ensure_pnpm_path_from_common_functions() {
    if [[ -z "$PNPM_GLOBAL_BIN_DIR" ]]; then
        echo "Warning: PNPM_GLOBAL_BIN_DIR not set" >&2
        return 1
    fi

    # Check if already in current PATH
    if echo "$PATH" | grep -q "$PNPM_GLOBAL_BIN_DIR"; then
        return 0
    fi

    # Add to current session
    export PATH="$PNPM_GLOBAL_BIN_DIR:$PATH"

    # Add to /etc/environment for persistence
    if [[ ! -f /etc/environment ]]; then
        echo "PATH=\"$PNPM_GLOBAL_BIN_DIR:$NODE_BIN_DIR:/usr/local/bin:/usr/bin:/bin\"" | $USE_SUDO tee /etc/environment > /dev/null
    else
        # Check if pnpm bin dir is in /etc/environment
        if ! grep -q "$PNPM_GLOBAL_BIN_DIR" /etc/environment 2>/dev/null; then
            local current_path=$(grep "^PATH=" /etc/environment | sed 's/^PATH="//' | sed 's/"$//')
            if [[ -n "$current_path" ]]; then
                # Update existing PATH
                $USE_SUDO sed -i "s|^PATH=\"|PATH=\"$PNPM_GLOBAL_BIN_DIR:|" /etc/environment
            else
                # Add new PATH
                echo "PATH=\"$PNPM_GLOBAL_BIN_DIR:$NODE_BIN_DIR:/usr/local/bin:/usr/bin:/bin\"" | $USE_SUDO tee -a /etc/environment > /dev/null
            fi
        fi
    fi

    # Also ensure NODE_BIN_DIR is in PATH
    if ! echo "$PATH" | grep -q "$NODE_BIN_DIR"; then
        export PATH="$NODE_BIN_DIR:$PATH"

        if [[ -f /etc/environment ]] && ! grep -q "$NODE_BIN_DIR" /etc/environment 2>/dev/null; then
            local current_path=$(grep "^PATH=" /etc/environment | sed 's/^PATH="//' | sed 's/"$//')
            if [[ -n "$current_path" ]]; then
                $USE_SUDO sed -i "s|^PATH=\"|PATH=\"$NODE_BIN_DIR:|" /etc/environment
            fi
        fi
    fi

    return 0
}


