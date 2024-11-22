#!/bin/bash

# Get the script root directory and common scripts directory from global variables
if [ ! -f "/usr/script_global_var/SCRIPT_ROOT_DIR" ] || [ ! -f "/usr/script_global_var/COMMON_SCRIPTS_DIR" ]; then
    echo "Error: Required global variables not found"
    exit 1
fi

SCRIPT_ROOT_DIR=$(cat "/usr/script_global_var/SCRIPT_ROOT_DIR")
COMMON_SCRIPTS_DIR=$(cat "/usr/script_global_var/COMMON_SCRIPTS_DIR")
TEST_PROXY_SCRIPT="$COMMON_SCRIPTS_DIR/test_github_proxy.js"

# Automatically determine the LSB release codename from the system
LSB_RELEASE=$(lsb_release -c | awk '{print $2}')

# Print colored messages
print_info() {
    echo -e "\033[0;34m[INFO] $1\033[0m"
}

print_success() {
    echo -e "\033[0;32m[SUCCESS] $1\033[0m"
}

print_error() {
    echo -e "\033[0;31m[ERROR] $1\033[0m"
}

print_warning() {
    echo -e "\033[0;33m[WARNING] $1\033[0m"
}

# Test GitHub proxy and get the fastest URL
test_github_proxy() {
    print_info "Testing GitHub proxy speeds..."
    
    if [ ! -f "$TEST_PROXY_SCRIPT" ]; then
        print_error "GitHub proxy test script not found at: $TEST_PROXY_SCRIPT"
        return 1
    fi

    # Run the proxy test
    node "$TEST_PROXY_SCRIPT" "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64"
    
    if [ -f "/usr/script_global_var/GITHUB_PROXY_URL" ]; then
        PROXY_URL=$(cat "/usr/script_global_var/GITHUB_PROXY_URL")
        if [ -n "$PROXY_URL" ]; then
            print_success "Using GitHub proxy: $PROXY_URL"
        else
            print_info "Using direct GitHub connection"
        fi
        return 0
    else
        print_error "Failed to get proxy test results"
        return 1
    fi
}

# Get Docker Compose download URL based on proxy test
get_compose_url() {
    local base_url="https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64"
    if [ -f "/usr/script_global_var/GITHUB_PROXY_URL" ]; then
        PROXY_URL=$(cat "/usr/script_global_var/GITHUB_PROXY_URL")
        if [ -n "$PROXY_URL" ]; then
            echo "${PROXY_URL}docker/compose/releases/latest/download/docker-compose-linux-x86_64"
            return
        fi
    fi
    echo "$base_url"
}

# Function to install Docker Compose
install_docker_compose() {
    print_info "Installing Docker Compose..."
    
    # Get the appropriate download URL
    local download_url=$(get_compose_url)
    print_info "Downloading from: $download_url"

    # Download and install Docker Compose
    if curl -L "$download_url" -o /usr/bin/docker-compose; then
        chmod +x /usr/bin/docker-compose
        print_success "Docker Compose downloaded and installed successfully"
        docker-compose --version
    else
        print_error "Failed to download Docker Compose"
        return 1
    fi
}

# Function to install Docker
install_docker() {
    print_info "Installing Docker..."
    
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg lsb-release

    sudo mkdir -p /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --yes --dearmor -o /etc/apt/keyrings/docker.gpg
    
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
        $LSB_RELEASE stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Verify installation
    if docker --version; then
        print_success "Docker installed successfully"
    else
        print_error "Docker installation failed"
        return 1
    fi
}

# Configure Docker daemon
configure_docker() {
    print_info "Configuring Docker daemon..."
    
    local daemon_config="/etc/docker/daemon.json"
    if [ ! -f "$daemon_config" ]; then
        sudo mkdir -p /etc/docker
        cat > "$daemon_config" <<EOF
{
    "registry-mirrors": [
        "https://docker.mirrors.ustc.edu.cn",
        "https://hub-mirror.c.163.com",
        "https://mirror.baidubce.com"
    ],
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "100m",
        "max-file": "3"
    }
}
EOF
        print_success "Created Docker daemon configuration"
    fi
}

# Main installation process
main() {
    # Check if script is run as root
    if [ "$EUID" -ne 0 ]; then
        print_error "Please run as root"
        exit 1
    }

    # Test GitHub proxy first
    print_info "Testing GitHub connectivity..."
    test_github_proxy

    # Install Docker if not present
    if ! command -v docker &> /dev/null; then
        print_info "Docker is not installed"
        install_docker || exit 1
    else
        print_info "Docker is already installed"
    fi

    # Install Docker Compose if not present
    if ! command -v docker-compose &> /dev/null; then
        print_info "Docker Compose is not installed"
        install_docker_compose || exit 1
    else
        print_info "Docker Compose is already installed"
    fi

    # Configure Docker
    configure_docker

    print_success "Docker installation and configuration completed successfully"
    
    # Display versions
    docker --version
    docker-compose --version
}

# Run main function
main
