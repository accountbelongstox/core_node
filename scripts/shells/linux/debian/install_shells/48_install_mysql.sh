#!/bin/bash
# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Declare all variables at the beginning
SCRIPT_CURRENT_DIR=""
PARENT_DIR_LEVEL_1=""
PARENT_DIR_LEVEL_2=""
SCRIPT_INDEX="48"
START_MYSQL=""
INSTALL_MODE=""
MYSQL_CONFIG_FILE=""
MYSQL_DATA_DIR=""
MYSQL_LOG_DIR=""

# Source gvar_common.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Source repository manager
source "$PARENT_DIR_LEVEL_1/debian_com/repository_manager.sh"
# Initialize variables
SCRIPT_INDEX="48"
START_MYSQL=$(get_var "START_MYSQL" "false")
INSTALL_MODE=$(get_var "INSTALL_MODE")
MYSQL_CONFIG_FILE="/etc/mysql/mysql.conf.d/mysqld.cnf"
# Use compile_dir for database data and logs (auto-selects based on environment)
MYSQL_DATA_DIR=$(map_web_path "compile_dir" "mysql/data")
MYSQL_LOG_DIR=$(map_web_path "compile_dir" "mysql/logs")

echo "[$SCRIPT_INDEX] MySQL Management Script"
echo "[$SCRIPT_INDEX] START_MYSQL: $START_MYSQL"

# Check repository status before proceeding
if ! verify_mysql_repo_for_install; then
    echo "[$SCRIPT_INDEX] Please run 12_update.sh first to properly manage repositories"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if MySQL is already installed
check_mysql() {
    if command_exists mysql; then
        return 0  # true, is installed
    fi
    return 1  # false, is not installed
}

# Function to check if MySQL service is running
is_mysql_running() {
    if command_exists systemctl; then
        if systemctl is-active --quiet mariadb; then
            return 0
        else
            return 1
        fi
    elif command_exists service; then
        if service mariadb status >/dev/null 2>&1; then
            return 0
        else
            return 1
        fi
    else
        return 1
    fi
}

# Function to disable MySQL services
disable_mysql_services() {
    echo "[$SCRIPT_INDEX] Disabling MySQL services..."

    # Stop MySQL service if running
    if is_mysql_running; then
        echo "[$SCRIPT_INDEX] Stopping MySQL service..."
        $USE_SUDO systemctl stop mariadb 2>/dev/null || $USE_SUDO service mariadb stop 2>/dev/null
    fi

    # Wait a moment and check if MySQL processes are still running
    sleep 1

    # Kill any remaining mariadb/mysqld processes
    if pgrep -x mariadbd >/dev/null 2>&1 || pgrep -x mysqld >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] MySQL processes still running, killing them..."
        $USE_SUDO pkill -TERM mariadbd 2>/dev/null || true
        $USE_SUDO pkill -TERM mysqld 2>/dev/null || true
        sleep 2

        # Force kill if still running
        if pgrep -x mariadbd >/dev/null 2>&1 || pgrep -x mysqld >/dev/null 2>&1; then
            echo "[$SCRIPT_INDEX] Force killing MySQL processes..."
            $USE_SUDO pkill -9 mariadbd 2>/dev/null || true
            $USE_SUDO pkill -9 mysqld 2>/dev/null || true
        fi
    fi

    # Verify MySQL is stopped
    if is_mysql_running; then
        echo "[$SCRIPT_INDEX] Warning: Failed to stop all MySQL processes"
    else
        echo "[$SCRIPT_INDEX] MySQL service stopped successfully"
    fi

    # Disable MySQL service from auto-start
    echo "[$SCRIPT_INDEX] Disabling MySQL service from auto-start..."
    $USE_SUDO systemctl disable mariadb 2>/dev/null || $USE_SUDO update-rc.d mariadb disable 2>/dev/null

    echo "[$SCRIPT_INDEX] MySQL services disabled successfully"
}

# Function to enable MySQL services
enable_mysql_services() {
    echo "[$SCRIPT_INDEX] Enabling MySQL services..."
    
    # Enable MySQL service for auto-start
    echo "[$SCRIPT_INDEX] Enabling MySQL service for auto-start..."
    $USE_SUDO systemctl enable mariadb 2>/dev/null || $USE_SUDO update-rc.d mariadb enable 2>/dev/null
    
    # Start MySQL service
    echo "[$SCRIPT_INDEX] Starting MySQL service..."
    $USE_SUDO systemctl start mariadb 2>/dev/null || $USE_SUDO service mariadb start 2>/dev/null
    
    # Wait a moment for service to start
    sleep 3
    
    if is_mysql_running; then
        echo "[$SCRIPT_INDEX] MySQL service started successfully"
    else
        echo "[$SCRIPT_INDEX] Warning: MySQL service may not have started properly"
    fi
}

# Function to setup MySQL data directory
setup_data_dir() {
    # Use the mapped path from variable initialization
    local DATA_DIR="$MYSQL_DATA_DIR"

    # Create MySQL directories using mapped paths
    mkdir -p "$DATA_DIR"
    mkdir -p "$MYSQL_LOG_DIR"

    # Set proper ownership (skip in WSL as Windows filesystem doesn't support chown)
    if [ "$IS_WSL" = false ]; then
        chown -R mysql:mysql "$DATA_DIR"
        chown -R mysql:mysql "$MYSQL_LOG_DIR"
    fi
    chmod 750 "$DATA_DIR" 2>/dev/null || true

    # Check if data directory is empty
    if [ -z "$(ls -A $DATA_DIR)" ]; then
        return 1  # Need initialization
    else
        return 0  # Already initialized
    fi
}

# Generate MySQL production configuration
generate_mysql_config() {
    cat > "$MYSQL_CONFIG_FILE" <<EOF
[mysqld]
# Basic Settings
user            = mysql
pid-file        = /var/run/mysqld/mysqld.pid
socket          = /var/run/mysqld/mysqld.sock
port            = 3306
basedir         = /usr
datadir         = $MYSQL_DATA_DIR
tmpdir          = /tmp
lc-messages-dir = /usr/share/mysql
bind-address    = 0.0.0.0

# Security
local_infile    = 0
symbolic-links  = 0

# Fine Tuning
key_buffer_size         = 256M
max_allowed_packet      = 64M
thread_stack           = 192K
thread_cache_size      = 8
max_connections        = 1000
table_open_cache       = 2000
open_files_limit       = 65535

# InnoDB Settings
default_storage_engine  = InnoDB
innodb_buffer_pool_size = 1G
innodb_log_file_size   = 256M
innodb_file_per_table  = 1
innodb_flush_method    = O_DIRECT
innodb_flush_log_at_trx_commit = 1

# Logging
log_error = $MYSQL_LOG_DIR/error.log
slow_query_log         = 1
slow_query_log_file    = $MYSQL_LOG_DIR/mysql-slow.log
long_query_time        = 2

# Character Set
character-set-server  = utf8mb4
collation-server      = utf8mb4_general_ci

# Binary Logging
log-bin                 = $MYSQL_DATA_DIR/mysql-bin
expire-logs-days        = 7
max-binlog-size        = 100M
binlog-format          = ROW
EOF
}

# Function to get or generate MySQL root password
get_mysql_password() {
    local stored_password=$(get_global_var "MYSQL_ROOT_PASSWORD")
    if [ -n "$stored_password" ]; then
        echo "$stored_password"
    else
        local new_password=$(openssl rand -base64 12)
        set_global_var "MYSQL_ROOT_PASSWORD" "$new_password"
        echo "$new_password"
    fi
}

# Function to install MySQL
install_mysql() {
    echo "Installing MySQL (MariaDB)..."

    # Detect OS for version-specific handling
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_ID="$ID"
        OS_VERSION_ID="$VERSION_ID"
        echo "[$SCRIPT_INDEX] Detected OS: $OS_ID $OS_VERSION_ID"
    fi

    # Repository should already be added by 12_update.sh
    echo "[$SCRIPT_INDEX] Installing MariaDB from pre-configured repository..."

    # Update package list
    $USE_SUDO apt update

    # Install MariaDB server and client
    if ! $USE_SUDO apt install -y mariadb-server mariadb-client 2>&1 | tee /tmp/mysql_install.log; then
        echo "[$SCRIPT_INDEX] Initial installation failed, checking for issues..."
        cat /tmp/mysql_install.log

        # Try to fix broken dependencies
        echo "[$SCRIPT_INDEX] Attempting to fix broken dependencies..."
        $USE_SUDO apt --fix-broken install -y

        # Retry installation
        echo "[$SCRIPT_INDEX] Retrying MariaDB installation..."
        if ! $USE_SUDO apt install -y mariadb-server mariadb-client; then
            echo "[$SCRIPT_INDEX] Failed to install MariaDB"
            rm -f /tmp/mysql_install.log
            return 1
        fi
    fi

    rm -f /tmp/mysql_install.log

    # Create MySQL user and group if they don't exist
    if ! getent group mysql >/dev/null; then
        $USE_SUDO groupadd mysql
    fi
    if ! getent passwd mysql >/dev/null; then
        $USE_SUDO useradd -r -g mysql -s /bin/false mysql
    fi

    # Setup data directory
    setup_data_dir
    local need_init=$?

    # Get or generate root password
    local root_password=$(get_mysql_password)
    
    # Stop MariaDB service for configuration
    systemctl stop mariadb
    
    # Define custom config directory from the config file path
    CUSTOM_CONFIG_DIR=$(dirname "$MYSQL_CONFIG_FILE")
    STANDARD_INCLUDE_DIR="/etc/mysql/conf.d"
    REDIRECT_CONFIG_FILE="${STANDARD_INCLUDE_DIR}/z-custom-config-include.cnf"

    # Create necessary directories
    mkdir -p "$CUSTOM_CONFIG_DIR"
    mkdir -p "$STANDARD_INCLUDE_DIR"
    mkdir -p /var/run/mysqld
    chown mysql:mysql /var/run/mysqld

    # Create a redirect file in the standard MySQL include dir to load our custom config
    echo "# This file is auto-generated by the installation script." > "$REDIRECT_CONFIG_FILE"
    echo "# It includes the configuration from the custom directory specified during setup." >> "$REDIRECT_CONFIG_FILE"
    echo "!includedir $CUSTOM_CONFIG_DIR/" >> "$REDIRECT_CONFIG_FILE"
    echo "[$SCRIPT_INDEX] Created redirect config at $REDIRECT_CONFIG_FILE to include configs from $CUSTOM_CONFIG_DIR"

    # Generate production configuration in the custom directory
    generate_mysql_config
    
    # Initialize MySQL if needed
    if [ $need_init -eq 1 ]; then
        echo "Initializing MySQL data directory..."
        mysql_install_db --user=mysql --datadir="$MYSQL_DATA_DIR"
    fi
    
    # Start MariaDB service
    systemctl start mariadb
    systemctl enable mariadb
    
    # Set root password and secure the installation
    echo "Securing MySQL installation..."
    mysql --connect-expired-password -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$root_password';"
    
    # Store MySQL information
    store_mysql_info
}

# Function to store MySQL information in global variables
store_mysql_info() {
    set_global_var "MYSQL_BIN" "$(which mysql)"
    set_global_var "MYSQLD_BIN" "$(which mysqld)"
    set_global_var "MYSQL_VERSION" "$(mysql --version)"
    set_global_var "MYSQL_CONFIG_DIR" "/etc/mysql"
    # Use the mapped paths from variable initialization
    set_global_var "MYSQL_DATA_DIR" "$MYSQL_DATA_DIR"
    set_global_var "MYSQL_LOG_DIR" "$MYSQL_LOG_DIR"
    set_global_var "MYSQL_CONFIG_FILE" "/etc/mysql/mysql.conf.d/mysqld.cnf"
    set_global_var "MYSQL_SERVICE_STATUS" "$(systemctl is-active mariadb)"
    local port=$(mysql -N -e "SHOW VARIABLES LIKE 'port';" | awk '{print $2}')
    set_global_var "MYSQL_PORT" "$port"
}

# Main execution logic
echo "[$SCRIPT_INDEX] === MySQL Management ==="

# Check if running as root
if [ "$EUID" -ne 0 ] && [ "$USE_SUDO" = "sudo" ]; then
    echo "[$SCRIPT_INDEX] Please run this script with sudo"
    exit 1
fi

# Configure based on START_MYSQL variable
if [ "$START_MYSQL" = "true" ]; then
    echo "[$SCRIPT_INDEX] ============================================"
    echo "[$SCRIPT_INDEX] START_MYSQL is true - Installing and starting MySQL..."
    echo "[$SCRIPT_INDEX] ============================================"

    # Check if MySQL is already installed
    if check_mysql; then
        echo "[$SCRIPT_INDEX] MySQL is already installed: $(mysql --version)"
        # Update stored information
        store_mysql_info
    else
        install_mysql
        if ! check_mysql; then
            echo "[$SCRIPT_INDEX] Error: MySQL installation failed"
            exit 1
        fi
        echo "[$SCRIPT_INDEX] MySQL installed successfully: $(mysql --version)"
    fi

    # Enable and start services
    enable_mysql_services

    # Set global variables
    set_var "MYSQL_AVAILABLE" "true"
    set_var "MYSQL_ENABLED" "true"

    echo "[$SCRIPT_INDEX] ============================================"
    echo "[$SCRIPT_INDEX] MySQL is installed and running"
    echo "[$SCRIPT_INDEX] ============================================"
else
    echo "[$SCRIPT_INDEX] ============================================"
    echo "[$SCRIPT_INDEX] START_MYSQL is false - Skipping MySQL installation"
    echo "[$SCRIPT_INDEX] ============================================"

    # If MySQL is already installed, stop and disable it
    if check_mysql; then
        echo "[$SCRIPT_INDEX] MySQL is already installed, stopping and disabling services..."
        disable_mysql_services

        # Set global variables
        set_var "MYSQL_AVAILABLE" "true"
        set_var "MYSQL_ENABLED" "false"

        echo "[$SCRIPT_INDEX] ============================================"
        echo "[$SCRIPT_INDEX] MySQL is installed but stopped and disabled"
        echo "[$SCRIPT_INDEX] ============================================"
    else
        echo "[$SCRIPT_INDEX] MySQL is not installed and will not be installed"

        # Set global variables
        set_var "MYSQL_AVAILABLE" "false"
        set_var "MYSQL_ENABLED" "false"

        echo "[$SCRIPT_INDEX] ============================================"
        echo "[$SCRIPT_INDEX] MySQL skipped"
        echo "[$SCRIPT_INDEX] ============================================"
    fi
fi

echo "[$SCRIPT_INDEX] MySQL configuration completed"

# Display MySQL installation status
echo "[$SCRIPT_INDEX] === MySQL Status ==="
if check_mysql; then
    echo "[$SCRIPT_INDEX] Version: $(mysql --version)"
    echo "[$SCRIPT_INDEX] Service Status: $(systemctl is-active mariadb 2>/dev/null || echo 'unknown')"
    echo "[$SCRIPT_INDEX] Root Password: $(get_global_var "MYSQL_ROOT_PASSWORD" 2>/dev/null || echo 'not set')"
    echo "[$SCRIPT_INDEX] Data Directory: $(get_global_var "MYSQL_DATA_DIR" 2>/dev/null || echo 'not set')"
    echo "[$SCRIPT_INDEX] Port: $(get_global_var "MYSQL_PORT" 2>/dev/null || echo 'not set')"
    echo "[$SCRIPT_INDEX] Main Config: $(get_global_var "MYSQL_CONFIG_FILE" 2>/dev/null || echo 'not set')"
else
    echo "[$SCRIPT_INDEX] MySQL is not installed"
fi

echo "[$SCRIPT_INDEX] MySQL Management Script completed" 
