#!/bin/bash

# Get installed version
get_installed_version() {
    if [[ -f "$GITEA_INSTALLED_FLAG" ]]; then
        grep "^VERSION=" "$GITEA_INSTALLED_FLAG" 2>/dev/null | cut -d= -f2
    fi
}

# Save installation info
save_installation_info() {
    local version="$1"

    $USE_SUDO mkdir -p "$(dirname "$GITEA_INSTALLED_FLAG")"
    cat <<EOF | $USE_SUDO tee "$GITEA_INSTALLED_FLAG" > /dev/null
DATE=$(date '+%Y-%m-%d %H:%M:%S')
VERSION=$version
BINARY=$GITEA_BINARY
DATA_DIR=$GITEA_DATA_DIR
CONFIG_DIR=$GITEA_CONFIG_DIR
PORT=$GITEA_PORT
EOF
}

# Check if Gitea is already installed
is_gitea_installed() {
    if command -v gitea >/dev/null 2>&1; then
        return 0  # Installed
    fi
    return 1  # Not installed
}

# Detect system architecture
detect_architecture() {
    local arch=$(uname -m)
    case "$arch" in
        x86_64)
            echo "linux-amd64"
            ;;
        aarch64)
            echo "linux-arm64"
            ;;
        armv7l)
            echo "linux-arm-7"
            ;;
        *)
            print_error_from_common_functions "Unsupported architecture: $arch"
            return 1
            ;;
    esac
}

# Check if Git is installed
check_git_installation() {
    print_step_from_common_functions "Checking Git installation..."

    if command -v git >/dev/null 2>&1; then
        local git_version=$(git --version 2>/dev/null | awk '{print $3}')
        print_success_from_common_functions "Git is installed (version: $git_version)"
        return 0
    else
        print_warning_from_common_functions "Git is not installed"
        print_info_from_common_functions "Git is required for Gitea to function"
        print_info_from_common_functions "Please run script 27_install_git_ssh.sh first, or install Git manually"

        echo -n "Do you want to install Git now? (Y/n): "
        read -r response
        case "$response" in
            [nN]|[nN][oO])
                print_error_from_common_functions "Cannot proceed without Git"
                return 1
                ;;
            *)
                print_step_from_common_functions "Installing Git..."
                if $USE_SUDO apt-get update && $USE_SUDO apt-get install -y git; then
                    local git_version=$(git --version 2>/dev/null | awk '{print $3}')
                    print_success_from_common_functions "Git installed successfully (version: $git_version)"
                    return 0
                else
                    print_error_from_common_functions "Failed to install Git"
                    return 1
                fi
                ;;
        esac
    fi
}

# Install required dependencies
install_dependencies() {
    print_step_from_common_functions "Installing required dependencies..."

    # Update package list
    $USE_SUDO apt-get update -qq

    # Essential dependencies for Gitea
    local deps=(
        "wget"          # For downloading Gitea binary
        "curl"          # For API calls and version checks
        "sqlite3"       # SQLite database support (default database)
        "ca-certificates" # SSL/TLS certificates
        "gnupg"         # GPG support for commit signing
    )

    for dep in "${deps[@]}"; do
        # Extract package name (remove comments)
        local pkg=$(echo "$dep" | awk '{print $1}')

        if ! dpkg -l | grep -q "^ii  $pkg "; then
            print_step_from_common_functions "Installing $pkg..."
            $USE_SUDO apt-get install -y "$pkg"
        else
            print_info_from_common_functions "$pkg is already installed"
        fi
    done

    print_success_from_common_functions "All dependencies installed"
    return 0
}

# Create Gitea user
create_gitea_user() {
    print_step_from_common_functions "Creating Gitea user..."

    if id "$GITEA_USER" &>/dev/null; then
        print_info_from_common_functions "User $GITEA_USER already exists"
    else
        $USE_SUDO useradd --system --shell /bin/bash --comment 'Git Version Control' --create-home --home-dir /home/$GITEA_USER $GITEA_USER
        print_success_from_common_functions "User $GITEA_USER created"
    fi

    ensure_gitea_user_privileges

    return 0
}

ensure_gitea_user_privileges() {
    print_step_from_common_functions "Ensuring $GITEA_USER user permissions..."

    local user_home="/home/$GITEA_USER"
    local required_groups=("sudo")

    # Ensure home directory exists
    if [[ ! -d "$user_home" ]]; then
        $USE_SUDO mkdir -p "$user_home"
        print_info_from_common_functions "Created home directory at $user_home"
    fi

    # Fix home directory ownership and permissions (always)
    $USE_SUDO chown $GITEA_USER:$GITEA_USER "$user_home"
    $USE_SUDO chmod 750 "$user_home"
    print_info_from_common_functions "Fixed $user_home ownership and permissions"

    # Fix user shell (always)
    $USE_SUDO usermod --shell /bin/bash "$GITEA_USER"
    print_info_from_common_functions "Ensured $GITEA_USER shell is /bin/bash"

    # Ensure user is in required groups (always)
    for group in "${required_groups[@]}"; do
        if getent group "$group" >/dev/null 2>&1; then
            $USE_SUDO usermod -aG "$group" "$GITEA_USER" 2>/dev/null || true
            print_info_from_common_functions "Ensured $GITEA_USER is in $group group"
        else
            print_warning_from_common_functions "Required group $group not found on system"
        fi
    done

    # Fix Gitea base directory permissions (always)
    if [[ -d "$GITEA_BASE_DIR" ]]; then
        safe_chown_R "$GITEA_USER:$GITEA_USER" "$GITEA_BASE_DIR"
        safe_chmod_R 750 "$GITEA_BASE_DIR"
        $USE_SUDO chmod 770 "$GITEA_CONFIG_DIR" 2>/dev/null || true
        print_info_from_common_functions "Fixed $GITEA_BASE_DIR ownership and permissions"
    fi

    # Fix binary permissions (always)
    if [[ -f "$GITEA_BINARY" ]]; then
        $USE_SUDO chown root:root "$GITEA_BINARY"
        $USE_SUDO chmod 755 "$GITEA_BINARY"
        print_info_from_common_functions "Fixed $GITEA_BINARY ownership and permissions"
    fi

    print_success_from_common_functions "$GITEA_USER user permissions verified and fixed"
}

verify_cached_binary() {
    local binary_path="$1"
    local expected_version="$2"

    if [[ ! -f "$binary_path" ]]; then
        return 1
    fi

    if [[ ! -s "$binary_path" ]]; then
        return 1
    fi

    $USE_SUDO chmod +x "$binary_path" 2>/dev/null || true

    local version=$("$binary_path" --version 2>/dev/null | grep -oP 'version \K[0-9.]+' | head -n1 || echo "")

    if [[ -z "$version" ]]; then
        return 1
    fi

    if [[ "$version" != "$expected_version" ]]; then
        return 1
    fi

    return 0
}

install_cached_binary() {
    local source_binary="$1"

    if [[ ! -f "$source_binary" ]]; then
        print_error_from_common_functions "Cached binary not found at $source_binary"
        return 1
    fi

    if ! $USE_SUDO cp "$source_binary" "$GITEA_BINARY"; then
        print_error_from_common_functions "Failed to copy cached binary to $GITEA_BINARY"
        return 1
    fi

    if ! $USE_SUDO chmod +x "$GITEA_BINARY"; then
        print_error_from_common_functions "Failed to set execute permission on $GITEA_BINARY"
        return 1
    fi

    print_success_from_common_functions "Gitea binary installed from cache"
    return 0
}

# Download Gitea binary
download_gitea() {
    print_step_from_common_functions "Checking Gitea binary..."

    # Detect architecture
    GITEA_ARCH=$(detect_architecture)
    if [[ $? -ne 0 ]]; then
        return 1
    fi

    GITEA_BINARY_URL="https://dl.gitea.com/gitea/${GITEA_VERSION}/gitea-${GITEA_VERSION}-${GITEA_ARCH}"
    local cached_binary_filename="gitea-${GITEA_VERSION}-${GITEA_ARCH}"
    local cached_binary="$GITEA_CACHE_DIR/$cached_binary_filename"

    $USE_SUDO mkdir -p "$GITEA_CACHE_DIR"
    $USE_SUDO chmod 750 "$GITEA_CACHE_DIR" 2>/dev/null || true

    # Use ACTUAL_DESKTOP_USER from gvar_common.sh (already detected)
    local real_user="${ACTUAL_DESKTOP_USER:-ubuntu}"
    local real_user_home="${ACTUAL_DESKTOP_USER_HOME:-/home/ubuntu}"
    local downloads_dir="$real_user_home/Downloads"
    local downloads_binary="$downloads_dir/$cached_binary_filename"

    # Ensure Downloads directory exists
    if [[ ! -d "$downloads_dir" ]]; then
        $USE_SUDO mkdir -p "$downloads_dir"
        $USE_SUDO chown ${real_user}:${real_user} "$downloads_dir" 2>/dev/null || true
    fi

    # Check if binary already exists and matches target version
    if [[ -f "$GITEA_BINARY" ]]; then
        local current_version=$($GITEA_BINARY --version 2>/dev/null | grep -oP 'version \K[0-9.]+' | head -n1 || echo "")
        print_info_from_common_functions "DEBUG: Existing binary found, version: $current_version"
        print_info_from_common_functions "DEBUG: Target version: $GITEA_VERSION"

        if [[ "$current_version" == "$GITEA_VERSION" ]]; then
            print_success_from_common_functions "Gitea binary already exists with correct version ($GITEA_VERSION)"
            print_info_from_common_functions "DEBUG: Skipping download, using existing binary at $GITEA_BINARY"
            return 0
        else
            print_warning_from_common_functions "Existing binary version ($current_version) differs from target ($GITEA_VERSION)"
            print_info_from_common_functions "DEBUG: Will download new version..."
        fi
    else
        print_info_from_common_functions "DEBUG: Binary not found at $GITEA_BINARY, will download..."
    fi

    # Check if binary exists in user's Downloads directory
    if verify_cached_binary "$downloads_binary" "$GITEA_VERSION"; then
        print_success_from_common_functions "Found Gitea binary in Downloads: $downloads_binary"
        $USE_SUDO cp "$downloads_binary" "$cached_binary"
        $USE_SUDO chmod 755 "$cached_binary"
        install_cached_binary "$cached_binary"
        return $?
    fi

    # Check cached binary
    if verify_cached_binary "$cached_binary" "$GITEA_VERSION"; then
        print_success_from_common_functions "Using cached Gitea binary at $cached_binary"
        install_cached_binary "$cached_binary"
        return $?
    elif [[ -f "$cached_binary" ]]; then
        print_warning_from_common_functions "Cached binary at $cached_binary is invalid, removing..."
        $USE_SUDO rm -f "$cached_binary"
    fi

    # Download binary
    print_step_from_common_functions "Downloading Gitea ${GITEA_VERSION}..."
    print_info_from_common_functions "DEBUG: Download URL: $GITEA_BINARY_URL"
    print_info_from_common_functions "DEBUG: Will save to Downloads: $downloads_binary"

    # Download to user's Downloads directory
    if $USE_SUDO wget -O "$downloads_binary" "$GITEA_BINARY_URL"; then
        print_success_from_common_functions "Gitea binary downloaded to Downloads"

        if [[ ! -s "$downloads_binary" ]]; then
            print_error_from_common_functions "Downloaded binary is empty"
            $USE_SUDO rm -f "$downloads_binary"
            return 1
        fi

        $USE_SUDO chmod +x "$downloads_binary"
        $USE_SUDO chown ${real_user}:${real_user} "$downloads_binary" 2>/dev/null || true

        if ! verify_cached_binary "$downloads_binary" "$GITEA_VERSION"; then
            print_error_from_common_functions "Downloaded binary verification failed"
            $USE_SUDO rm -f "$downloads_binary"
            return 1
        fi

        local binary_size=$(stat -c%s "$downloads_binary" 2>/dev/null || stat -f%z "$downloads_binary" 2>/dev/null)
        print_info_from_common_functions "DEBUG: Downloaded binary size: $binary_size bytes"
        print_info_from_common_functions "DEBUG: Binary saved to: $downloads_binary"

        print_info_from_common_functions "DEBUG: Copying to cache at $cached_binary"
        $USE_SUDO cp "$downloads_binary" "$cached_binary"
        $USE_SUDO chmod 755 "$cached_binary"

        print_success_from_common_functions "Binary saved to Downloads for future use"

        install_cached_binary "$cached_binary"
        return $?
    else
        print_error_from_common_functions "Failed to download Gitea binary"
        print_error_from_common_functions "DEBUG: wget failed for URL: $GITEA_BINARY_URL"
        $USE_SUDO rm -f "$downloads_binary"
        return 1
    fi
}

# Create directories
create_directories() {
    print_step_from_common_functions "Creating Gitea directories..."
    print_info_from_common_functions "DEBUG: Base directory: $GITEA_BASE_DIR"
    print_info_from_common_functions "DEBUG: Data directory: $GITEA_DATA_DIR"
    print_info_from_common_functions "DEBUG: Config directory: $GITEA_CONFIG_DIR"
    print_info_from_common_functions "DEBUG: Custom directory: $GITEA_CUSTOM_DIR"
    print_info_from_common_functions "DEBUG: Log directory: $GITEA_LOG_DIR"

    # Create base directory structure
    $USE_SUDO mkdir -p "$GITEA_BASE_DIR"
    $USE_SUDO mkdir -p "$GITEA_DATA_DIR"
    $USE_SUDO mkdir -p "$GITEA_CONFIG_DIR"
    $USE_SUDO mkdir -p "$GITEA_CUSTOM_DIR"
    $USE_SUDO mkdir -p "$GITEA_LOG_DIR"
    print_info_from_common_functions "DEBUG: All directories created successfully"

    # Set ownership and permissions
    print_info_from_common_functions "DEBUG: Setting ownership to $GITEA_USER:$GITEA_USER"
    safe_chown_R "$GITEA_USER:$GITEA_USER" "$GITEA_BASE_DIR"
    safe_chmod_R 750 "$GITEA_BASE_DIR"
    $USE_SUDO chmod 770 "$GITEA_CONFIG_DIR"
    print_info_from_common_functions "DEBUG: Ownership and permissions set"

    print_success_from_common_functions "Gitea directories created at $GITEA_BASE_DIR"
    return 0
}

# Create Gitea configuration file
create_gitea_config() {
    print_step_from_common_functions "Creating Gitea configuration..."

    local config_file="$GITEA_CONFIG_DIR/app.ini"

    # Check if configuration already exists
    if [[ -f "$config_file" ]]; then
        print_info_from_common_functions "Configuration file already exists, updating paths only..."

        # Update directory paths in existing config (idempotent)
        $USE_SUDO sed -i "s|^HTTP_PORT.*=.*|HTTP_PORT = $GITEA_PORT|" "$config_file" 2>/dev/null || true
        $USE_SUDO sed -i "s|^PATH.*=.*gitea\.db|PATH = $GITEA_DATA_DIR/gitea.db|" "$config_file" 2>/dev/null || true
        $USE_SUDO sed -i "s|^ROOT.*=.*repositories|ROOT = $GITEA_DATA_DIR/repositories|" "$config_file" 2>/dev/null || true
        $USE_SUDO sed -i "s|^ROOT_PATH.*=.*|ROOT_PATH = $GITEA_LOG_DIR|" "$config_file" 2>/dev/null || true
        $USE_SUDO sed -i "s|^AVATAR_UPLOAD_PATH.*=.*|AVATAR_UPLOAD_PATH = $GITEA_DATA_DIR/avatars|" "$config_file" 2>/dev/null || true
        $USE_SUDO sed -i "s|^REPOSITORY_AVATAR_UPLOAD_PATH.*=.*|REPOSITORY_AVATAR_UPLOAD_PATH = $GITEA_DATA_DIR/repo-avatars|" "$config_file" 2>/dev/null || true
        $USE_SUDO sed -i "s|^PATH.*=.*attachments|PATH = $GITEA_DATA_DIR/attachments|" "$config_file" 2>/dev/null || true
        $USE_SUDO sed -i "s|^PROVIDER_CONFIG.*=.*|PROVIDER_CONFIG = $GITEA_DATA_DIR/sessions|" "$config_file" 2>/dev/null || true

        # Fix permissions (always)
        $USE_SUDO chown $GITEA_USER:$GITEA_USER "$config_file"
        $USE_SUDO chmod 640 "$config_file"

        print_success_from_common_functions "Gitea configuration updated with current paths"
        return 0
    fi

    # Generate SECRET_KEY only once
    local secret_key=$(openssl rand -base64 32 2>/dev/null || echo "CHANGE_THIS_SECRET_KEY_$(date +%s)")

    # Create new configuration file
    cat <<EOF | $USE_SUDO tee "$config_file" > /dev/null
[server]
HTTP_PORT = $GITEA_PORT
ROOT_URL = http://localhost:$GITEA_PORT/
DOMAIN = localhost

[database]
DB_TYPE = sqlite3
PATH = $GITEA_DATA_DIR/gitea.db

[repository]
ROOT = $GITEA_DATA_DIR/repositories

[log]
ROOT_PATH = $GITEA_LOG_DIR
MODE = console, file
LEVEL = info

[security]
INSTALL_LOCK = false
SECRET_KEY = $secret_key

[service]
DISABLE_REGISTRATION = false
REQUIRE_SIGNIN_VIEW = false

[picture]
AVATAR_UPLOAD_PATH = $GITEA_DATA_DIR/avatars
REPOSITORY_AVATAR_UPLOAD_PATH = $GITEA_DATA_DIR/repo-avatars

[attachment]
PATH = $GITEA_DATA_DIR/attachments

[session]
PROVIDER = file
PROVIDER_CONFIG = $GITEA_DATA_DIR/sessions
EOF

    # Set ownership and permissions
    $USE_SUDO chown $GITEA_USER:$GITEA_USER "$config_file"
    $USE_SUDO chmod 640 "$config_file"

    print_success_from_common_functions "Gitea configuration created"
    return 0
}

# Create systemd service
create_systemd_service() {
    print_step_from_common_functions "Creating systemd service..."

    local service_file="/etc/systemd/system/gitea.service"

    cat <<EOF | $USE_SUDO tee "$service_file" > /dev/null
[Unit]
Description=Gitea (Git with a cup of tea)
After=network.target
Wants=network.target

[Service]
Type=simple
User=$GITEA_USER
Group=$GITEA_USER
WorkingDirectory=$GITEA_DATA_DIR
ExecStart=$GITEA_BINARY web --config $GITEA_CONFIG_DIR/app.ini --work-path $GITEA_DATA_DIR --custom-path $GITEA_CUSTOM_DIR
Restart=always
Environment=USER=$GITEA_USER HOME=/home/$GITEA_USER GITEA_WORK_DIR=$GITEA_DATA_DIR

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd
    $USE_SUDO systemctl daemon-reload

    print_success_from_common_functions "Systemd service created"
    return 0
}

# Configure firewall for Gitea
configure_firewall() {
    print_step_from_common_functions "Configuring firewall for Gitea..."
    print_info_from_common_functions "DEBUG: Port to open: $GITEA_PORT/tcp"
    print_info_from_common_functions "DEBUG: Calling firewall_allow_port from firewall_manager.sh"

    # Use firewall_manager.sh library to handle firewall configuration
    # This automatically detects and configures UFW, firewalld, or iptables
    # If no firewall is active, it does nothing (never installs a firewall)
    if firewall_allow_port "$GITEA_PORT" "tcp" "Gitea Web Service"; then
        print_success_from_common_functions "Firewall configured successfully for port $GITEA_PORT/tcp"
        print_info_from_common_functions "DEBUG: Firewall rule added successfully"
    else
        print_warning_from_common_functions "Firewall configuration may have issues, but port may still be accessible"
        print_info_from_common_functions "DEBUG: Firewall configuration returned error or no firewall detected"
    fi

    return 0
}

# Detect all IP addresses
detect_ip_addresses() {
    print_step_from_common_functions "Detecting IP addresses..."

    local ips=()

    # Get all IPv4 addresses
    while IFS= read -r ip; do
        if [[ -n "$ip" ]] && [[ "$ip" != "127.0.0.1" ]]; then
            ips+=("$ip")
        fi
    done < <(hostname -I 2>/dev/null | tr ' ' '\n')

    # Add localhost
    ips+=("127.0.0.1")
    ips+=("localhost")

    # Get public IP
    local public_ip=$(curl -s https://api.ipify.org 2>/dev/null || echo "")
    if [[ -n "$public_ip" ]] && [[ "$public_ip" != "127.0.0.1" ]]; then
        ips+=("$public_ip (public)")
    fi

    echo "${ips[@]}"
}

# Display user accounts
display_user_accounts() {
    print_step_from_common_functions "Checking Gitea administrator accounts..."

    # List only admin users
    local user_list_output
    user_list_output=$($USE_SUDO -u $GITEA_USER $GITEA_BINARY --config "$GITEA_CONFIG_DIR/app.ini" --work-path "$GITEA_DATA_DIR" --custom-path "$GITEA_CUSTOM_DIR" admin user list --admin 2>&1)
    local list_exit_code=$?

    if [[ $list_exit_code -eq 0 ]]; then
        echo ""
        print_info_from_common_functions "Registered administrator accounts:"
        echo "$user_list_output"

        # Check if output only contains header (no actual users)
        local user_count=$(echo "$user_list_output" | grep -v "^ID" | grep -v "^$" | wc -l)
        if [[ $user_count -eq 0 ]]; then
            echo ""
            print_warning_from_common_functions "No administrator accounts found"
            print_info_from_common_functions "Create admin account:"
            echo "  gitea --config $GITEA_CONFIG_DIR/app.ini --work-path $GITEA_DATA_DIR --custom-path $GITEA_CUSTOM_DIR admin user create --username admin --password YourPassword --email admin@example.com --admin"
        fi
        echo ""
    else
        echo ""
        print_warning_from_common_functions "Unable to list administrator accounts"
        print_info_from_common_functions "Error output:"
        echo "$user_list_output"
        echo ""
    fi
}

# Display web access information
display_web_access_info() {
    print_header_from_common_functions "Gitea Web Access Information"

    local ips=($(detect_ip_addresses))

    print_success_from_common_functions "Gitea is now accessible at the following addresses:"
    echo ""

    for ip in "${ips[@]}"; do
        echo -e "${GREEN}  http://${ip}:${GITEA_PORT}${NC}"
    done

    echo ""
    print_info_from_common_functions "Default configuration:"
    echo "  - Port: $GITEA_PORT"
    echo "  - Base directory: $GITEA_BASE_DIR"
    echo "  - Data directory: $GITEA_DATA_DIR"
    echo "  - Config file: $GITEA_CONFIG_DIR/app.ini"
    echo "  - Log directory: $GITEA_LOG_DIR"
    echo ""

    display_user_accounts

    print_info_from_common_functions "First-time setup:"
    echo "  1. Open any of the URLs above in your browser"
    echo "  2. Complete the initial configuration wizard"
    echo "  3. Create your administrator account"
    echo ""
    print_warning_from_common_functions "Important notes:"
    echo "  - Ensure firewall allows port $GITEA_PORT"
    echo "  - Configuration is stored in: $GITEA_CONFIG_DIR/app.ini"
    echo "  - All data is stored under: $GITEA_BASE_DIR"
    echo ""
}

# Start Gitea service
start_gitea_service() {
    print_step_from_common_functions "Starting Gitea service..."

    # Enable service
    $USE_SUDO systemctl enable gitea

    # Start service
    $USE_SUDO systemctl start gitea

    # Wait for service to start
    sleep 3

    # Check service status
    if $USE_SUDO systemctl is-active --quiet gitea; then
        print_success_from_common_functions "Gitea service started successfully"
        return 0
    else
        print_error_from_common_functions "Failed to start Gitea service"
        $USE_SUDO systemctl status gitea --no-pager
        return 1
    fi
}

