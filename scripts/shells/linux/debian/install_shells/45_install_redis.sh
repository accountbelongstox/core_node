#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="45"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

echo "[$SCRIPT_INDEX] Redis Installation Script"

# Check if Redis installation is enabled
INSTALL_REDIS=$(get_var "INSTALL_REDIS")
if [ "$INSTALL_REDIS" != "true" ]; then
    echo "[$SCRIPT_INDEX] Redis installation is disabled (INSTALL_REDIS: $INSTALL_REDIS)"
    echo "[$SCRIPT_INDEX] Checking for existing Redis services to disable..."

    # Disable any existing Redis services
    disable_redis_services
    exit 0
fi

check_and_install_sudo

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to disable Redis services
disable_redis_services() {
    echo "[$SCRIPT_INDEX] Disabling Redis services..."

    local redis_services=("redis-server" "redis")
    local found_service=""

    # Find installed Redis service
    for service in "${redis_services[@]}"; do
        if systemctl list-units --full -all | grep -Fq "$service.service"; then
            found_service="$service"
            echo "[$SCRIPT_INDEX] Found $service service"

            if systemctl is-active --quiet "$service"; then
                echo "[$SCRIPT_INDEX] Stopping $service service..."
                $USE_SUDO systemctl stop "$service"
            fi

            if systemctl is-enabled --quiet "$service"; then
                echo "[$SCRIPT_INDEX] Disabling $service service from auto-start..."
                $USE_SUDO systemctl disable "$service"
            fi

            echo "[$SCRIPT_INDEX] $service service has been stopped and disabled"
        fi
    done

    if [ -z "$found_service" ]; then
        echo "[$SCRIPT_INDEX] No Redis services found to disable"
    fi
}

# Function to check if Redis is installed
check_redis_installed() {
    if command_exists redis-server; then
        return 0
    fi
    return 1
}

# Function to install Redis
install_redis() {
    echo "[$SCRIPT_INDEX] Installing Redis server..."

    # Update package list
    $USE_SUDO apt update

    # Install Redis server
    if $USE_SUDO apt install -y redis-server; then
        echo "[$SCRIPT_INDEX] Redis server installed successfully"
    else
        echo "[$SCRIPT_INDEX] [ERROR] Failed to install Redis server"
        return 1
    fi

    return 0
}

# Function to configure Redis
configure_redis() {
    echo "[$SCRIPT_INDEX] Configuring Redis..."

    local redis_conf="/etc/redis/redis.conf"

    if [ -f "$redis_conf" ]; then
        # Backup original configuration
        $USE_SUDO cp "$redis_conf" "${redis_conf}.backup.$(date +%Y%m%d_%H%M%S)"

        # Configure Redis for production use
        echo "[$SCRIPT_INDEX] Applying Redis configuration optimizations..."

        # Set supervised to systemd
        $USE_SUDO sed -i 's/^supervised no/supervised systemd/' "$redis_conf"

        # Set working directory
        $USE_SUDO sed -i 's|^dir ./|dir /var/lib/redis|' "$redis_conf"

        # Configure memory management
        if ! grep -q "maxmemory-policy" "$redis_conf"; then
            echo "maxmemory-policy allkeys-lru" | $USE_SUDO tee -a "$redis_conf" >/dev/null
        fi

        # Configure log level
        $USE_SUDO sed -i 's/^loglevel notice/loglevel warning/' "$redis_conf"

        echo "[$SCRIPT_INDEX] Redis configuration updated"
    else
        echo "[$SCRIPT_INDEX] [WARNING] Redis configuration file not found at $redis_conf"
    fi
}

# Function to setup Redis service
setup_redis_service() {
    echo "[$SCRIPT_INDEX] Setting up Redis service..."

    # Enable Redis service
    if $USE_SUDO systemctl enable redis-server; then
        echo "[$SCRIPT_INDEX] Redis service enabled for auto-start"
    else
        echo "[$SCRIPT_INDEX] [WARNING] Failed to enable Redis service"
    fi

    # Start Redis service
    if $USE_SUDO systemctl start redis-server; then
        echo "[$SCRIPT_INDEX] Redis service started successfully"
    else
        echo "[$SCRIPT_INDEX] [ERROR] Failed to start Redis service"
        return 1
    fi

    # Wait for service to start
    sleep 3

    # Verify service is running
    if systemctl is-active --quiet redis-server; then
        echo "[$SCRIPT_INDEX] Redis service is running"
    else
        echo "[$SCRIPT_INDEX] [ERROR] Redis service failed to start"
        systemctl status redis-server --no-pager
        return 1
    fi

    return 0
}

# Function to test Redis installation
test_redis_installation() {
    echo "[$SCRIPT_INDEX] Testing Redis installation..."

    # Test Redis connection
    if timeout 10 redis-cli ping >/dev/null 2>&1; then
        local redis_response=$(redis-cli ping 2>/dev/null || echo "NO_RESPONSE")
        if [ "$redis_response" = "PONG" ]; then
            echo "[$SCRIPT_INDEX] [OK] Redis connection test passed"
        else
            echo "[$SCRIPT_INDEX] [ERROR] Redis ping test failed: $redis_response"
            return 1
        fi
    else
        echo "[$SCRIPT_INDEX] [ERROR] Redis connection test timed out"
        return 1
    fi

    # Test Redis basic operations
    if timeout 10 redis-cli set test_key "test_value" >/dev/null 2>&1; then
        local test_value=$(redis-cli get test_key 2>/dev/null || echo "NO_VALUE")
        if [ "$test_value" = "test_value" ]; then
            echo "[$SCRIPT_INDEX] [OK] Redis basic operations test passed"
            # Clean up test key
            redis-cli del test_key >/dev/null 2>&1
        else
            echo "[$SCRIPT_INDEX] [ERROR] Redis basic operations test failed"
            return 1
        fi
    else
        echo "[$SCRIPT_INDEX] [ERROR] Redis basic operations test timed out"
        return 1
    fi

    return 0
}

# Function to create Redis symlinks for system-wide access
create_redis_symlinks() {
    echo "[$SCRIPT_INDEX] Creating Redis symlinks for system-wide access..."

    # Create symlinks for Redis binaries
    local redis_binaries=("redis-server" "redis-cli" "redis-benchmark")

    for binary in "${redis_binaries[@]}"; do
        local binary_path=$(which "$binary" 2>/dev/null)
        if [ -n "$binary_path" ] && [ -f "$binary_path" ]; then
            local symlink_path="/usr/local/bin/$binary"

            if [ ! -f "$symlink_path" ] || [ ! -x "$symlink_path" ]; then
                if $USE_SUDO ln -sf "$binary_path" "$symlink_path"; then
                    echo "[$SCRIPT_INDEX] Created symlink: $symlink_path -> $binary_path"
                else
                    echo "[$SCRIPT_INDEX] [WARNING] Failed to create symlink for $binary"
                fi
            else
                echo "[$SCRIPT_INDEX] Symlink $symlink_path already exists and is valid"
            fi
        fi
    done
}

# Function to store Redis information
store_redis_info() {
    echo "[$SCRIPT_INDEX] Storing Redis information..."

    # Store Redis binary paths
    set_var "REDIS_SERVER_BIN" "$(which redis-server 2>/dev/null || echo '')"
    set_var "REDIS_CLI_BIN" "$(which redis-cli 2>/dev/null || echo '')"

    # Store Redis version
    if command_exists redis-server; then
        local redis_version=$(redis-server --version 2>/dev/null | grep -oP 'v=\K[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
        set_var "REDIS_VERSION" "$redis_version"
    fi

    # Store Redis configuration paths
    set_var "REDIS_CONFIG_FILE" "/etc/redis/redis.conf"
    set_var "REDIS_DATA_DIR" "/var/lib/redis"
    set_var "REDIS_LOG_FILE" "/var/log/redis/redis-server.log"

    echo "[$SCRIPT_INDEX] Redis information stored successfully"
}

# Function to display Redis information
display_redis_info() {
    echo "[$SCRIPT_INDEX] === Redis Installation Summary ==="

    if command_exists redis-server; then
        echo "[$SCRIPT_INDEX] Redis Server: $(which redis-server)"
        echo "[$SCRIPT_INDEX] Redis CLI: $(which redis-cli)"

        local redis_version=$(redis-server --version 2>/dev/null | grep -oP 'v=\K[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
        echo "[$SCRIPT_INDEX] Version: $redis_version"

        if systemctl is-active --quiet redis-server; then
            echo "[$SCRIPT_INDEX] Service Status: [RUNNING]"
        else
            echo "[$SCRIPT_INDEX] Service Status: [NOT RUNNING]"
        fi

        if systemctl is-enabled --quiet redis-server; then
            echo "[$SCRIPT_INDEX] Auto-start: [ENABLED]"
        else
            echo "[$SCRIPT_INDEX] Auto-start: [DISABLED]"
        fi

        echo "[$SCRIPT_INDEX] Configuration: /etc/redis/redis.conf"
        echo "[$SCRIPT_INDEX] Data Directory: /var/lib/redis"
        echo "[$SCRIPT_INDEX] Log File: /var/log/redis/redis-server.log"

        # Test connection
        if timeout 5 redis-cli ping >/dev/null 2>&1; then
            echo "[$SCRIPT_INDEX] Connection Test: [OK]"
        else
            echo "[$SCRIPT_INDEX] Connection Test: [FAILED]"
        fi

    else
        echo "[$SCRIPT_INDEX] Redis is not installed"
    fi
}

# Main execution
echo "[$SCRIPT_INDEX] === Redis Installation Process ==="

# Check if Redis is already installed
if check_redis_installed; then
    echo "[$SCRIPT_INDEX] Redis is already installed"

    # Ensure service is properly configured
    setup_redis_service

    # Create symlinks
    create_redis_symlinks

    # Test installation
    if test_redis_installation; then
        echo "[$SCRIPT_INDEX] [OK] Redis is ready for use"
        store_redis_info
        display_redis_info
    else
        echo "[$SCRIPT_INDEX] [WARNING] Redis is installed but tests failed"
    fi
else
    # Install Redis
    if install_redis; then
        echo "[$SCRIPT_INDEX] Redis installation completed"

        # Configure Redis
        configure_redis

        # Setup service
        if setup_redis_service; then
            echo "[$SCRIPT_INDEX] Redis service setup completed"

            # Create symlinks
            create_redis_symlinks

            # Test installation
            if test_redis_installation; then
                echo "[$SCRIPT_INDEX] [OK] Redis installation and tests completed successfully"
                store_redis_info
                display_redis_info
            else
                echo "[$SCRIPT_INDEX] [ERROR] Redis installation completed but tests failed"
                exit 1
            fi
        else
            echo "[$SCRIPT_INDEX] [ERROR] Redis service setup failed"
            exit 1
        fi
    else
        echo "[$SCRIPT_INDEX] [ERROR] Redis installation failed"
        exit 1
    fi
fi

echo "[$SCRIPT_INDEX] Redis installation script completed"
