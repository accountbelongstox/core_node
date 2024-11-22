#!/bin/bash

SCRIPT_ROOT_DIR=$(cat "/usr/script_global_var/SCRIPT_ROOT_DIR")
COMMON_SCRIPTS_DIR=$(cat "/usr/script_global_var/COMMON_SCRIPTS_DIR")
TEST_PROXY_SCRIPT="$COMMON_SCRIPTS_DIR/test_github_proxy.js"
CHECK_DOCKER_CONFIG_SCRIPT="$COMMON_SCRIPTS_DIR/check_docker_config.js"

# Automatically determine the LSB release codename from the system
LSB_RELEASE=$(lsb_release -c | awk '{print $2}')

# Test GitHub proxy and get the fastest URL
test_github_proxy() {
    echo -e "\033[0;34mTesting GitHub proxy speeds...\033[0m"
    
    if [ ! -f "$TEST_PROXY_SCRIPT" ]; then
        echo -e "\033[0;31mGitHub proxy test script not found at: $TEST_PROXY_SCRIPT\033[0m"
        return 1
    fi

    # Run the proxy test
    node "$TEST_PROXY_SCRIPT" "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64"
    
    if [ -f "/usr/script_global_var/GITHUB_PROXY_URL" ]; then
        PROXY_URL=$(cat "/usr/script_global_var/GITHUB_PROXY_URL")
        if [ -n "$PROXY_URL" ]; then
            echo -e "\033[0;32mUsing GitHub proxy: $PROXY_URL\033[0m"
        else
            echo -e "\033[0;34mUsing direct GitHub connection\033[0m"
        fi
        return 0
    else
        echo -e "\033[0;31mFailed to get proxy test results\033[0m"
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
            return 0
        fi
    fi
    echo "$base_url"
    return 0
}

# Function to install Docker Compose
install_docker_compose() {
    echo -e "\033[0;34mInstalling Docker Compose...\033[0m"
    
    # Get the appropriate download URL
    local download_url
    download_url=$(get_compose_url)
    echo -e "\033[0;34mDownloading from: $download_url\033[0m"

    # Download and install Docker Compose
    if curl -L "$download_url" -o /usr/bin/docker-compose; then
        chmod +x /usr/bin/docker-compose
        echo -e "\033[0;32mDocker Compose downloaded and installed successfully\033[0m"
        docker-compose --version
        return 0
    else
        echo -e "\033[0;31mFailed to download Docker Compose\033[0m"
        return 1
    fi
}

# Function to install Docker
install_docker() {
    echo -e "\033[0;34mInstalling Docker...\033[0m"
    
    apt-get update
    apt-get install -y ca-certificates curl gnupg lsb-release

    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --yes --dearmor -o /etc/apt/keyrings/docker.gpg
    
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
        $LSB_RELEASE stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Verify installation
    if docker --version; then
        echo -e "\033[0;32mDocker installed successfully\033[0m"
        return 0
    else
        echo -e "\033[0;31mDocker installation failed\033[0m"
        return 1
    fi
}

# Configure Docker daemon
configure_docker() {
    echo -e "\033[0;34mConfiguring Docker daemon...\033[0m"
    
    if [ ! -f "$CHECK_DOCKER_CONFIG_SCRIPT" ]; then
        echo -e "\033[0;31mDocker config script not found at: $CHECK_DOCKER_CONFIG_SCRIPT\033[0m"
        return 1
    fi

    # Run the Docker configuration script
    node "$CHECK_DOCKER_CONFIG_SCRIPT"
    local result=$?
    
    if [ $result -eq 0 ]; then
        echo -e "\033[0;32mDocker configuration completed successfully\033[0m"
        systemctl restart docker
        return 0
    else
        echo -e "\033[0;31mFailed to configure Docker\033[0m"
        return 1
    fi
}

# Main installation process
main() {
    # Check if script is run as root
    if [ "$EUID" -ne 0 ]; then
        echo -e "\033[0;31mPlease run as root\033[0m"
        exit 1
    fi

    # Test GitHub proxy first
    echo -e "\033[0;34mTesting GitHub connectivity...\033[0m"
    test_github_proxy || true  # Continue even if proxy test fails

    # Install Docker if not present
    if ! command -v docker > /dev/null 2>&1; then
        echo -e "\033[0;34mDocker is not installed\033[0m"
        install_docker || exit 1
    else
        echo -e "\033[0;34mDocker is already installed\033[0m"
    fi

    # Install Docker Compose if not present
    if ! command -v docker-compose > /dev/null 2>&1; then
        echo -e "\033[0;34mDocker Compose is not installed\033[0m"
        install_docker_compose || exit 1
    else
        echo -e "\033[0;34mDocker Compose is already installed\033[0m"
    fi

    # Configure Docker
    configure_docker || exit 1

    echo -e "\033[0;32mDocker installation and configuration completed successfully\033[0m"
    
    # Display versions
    docker --version
    docker-compose --version
}

# Execute main function
main "$@"
