#!/bin/bash

SCRIPT_ROOT_DIR=$(cat "/usr/script_global_var/SCRIPT_ROOT_DIR")
COMMON_SCRIPTS_DIR=$(cat "/usr/script_global_var/COMMON_SCRIPTS_DIR")
CHECK_DOCKER_CONFIG_SCRIPT="$COMMON_SCRIPTS_DIR/check_docker_config.js"

# Automatically determine the LSB release codename from the system
LSB_RELEASE=$(lsb_release -c | awk '{print $2}')

# Define download URL list with fixed path
DOCKER_COMPOSE_VERSION="2.27.0"
# Define download URL list
URLS=(
  "https://mirrors.tuna.tsinghua.edu.cn/github-release/docker/compose/$(uname -s)-$(uname -m)/${DOCKER_COMPOSE_VERSION}/docker-compose"
  "https://registry.aliyuncs.com/docker-compose/v${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)"
  "https://ghproxy.com/https://github.com/docker/compose/releases/download/v${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)"
)
# Function to install Docker Compose
install_docker_compose() {
    echo -e "\033[0;34mInstalling Docker Compose...\033[0m"
    
    # Set timeout (300 seconds = 5 minutes)
    TIMEOUT=300
    
    # Target file path
    TARGET_FILE="/usr/local/bin/docker-compose"
    
    # Loop through each URL
    for URL in "${URLS[@]}"; do
        echo -e "\033[0;34mAttempting to download Docker Compose from ${URL}...\033[0m"
        
        # Use timeout to limit download duration
        if timeout ${TIMEOUT}s curl -L "$URL" -o "$TARGET_FILE"; then
            # Check if the file was downloaded successfully and is not empty
            if [ -s "$TARGET_FILE" ]; then
                echo -e "\033[0;32mDocker Compose downloaded successfully!\033[0m"
                chmod +x "$TARGET_FILE"
                ln -sf "$TARGET_FILE" /usr/bin/docker-compose
                /usr/local/bin/docker-compose --version
                return 0
            fi
        fi

        # If download fails or times out, delete the incomplete file
        echo -e "\033[0;31mDownload failed or timed out. Removing incomplete file...\033[0m"
        rm -f "$TARGET_FILE"
    done

    # If all download attempts fail
    echo -e "\033[0;31mAll download sources failed. Please check your network or download manually.\033[0m"
    return 1
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
    
    # Ensure proper permissions for Docker Compose
    echo -e "\033[0;34mEnsuring proper permissions for Docker Compose...\033[0m"
    if [ -f "/usr/local/bin/docker-compose" ]; then
        chmod +x /usr/local/bin/docker-compose
    fi
    if [ -f "/usr/bin/docker-compose" ]; then
        chmod +x /usr/bin/docker-compose
    fi
    
    # Display versions
    echo -e "\033[0;34mVerifying Docker installations...\033[0m"
    docker --version
    docker-compose --version || {
        echo -e "\033[0;31mWarning: docker-compose version check failed. Attempting to fix permissions...\033[0m"
        # If version check fails, try to reinstall the symlink
        ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        chmod +x /usr/bin/docker-compose
        echo -e "\033[0;34mRetrying docker-compose version check...\033[0m"
        docker-compose --version
    }
}

main "$@"
