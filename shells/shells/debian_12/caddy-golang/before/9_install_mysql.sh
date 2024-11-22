#!/bin/bash

# Check if script is run with sudo
check_sudo() {
    if [ "$EUID" -ne 0 ]; then
        echo "Please run this script with sudo"
        exit 1
    fi
}

# Check sudo at the start
check_sudo

# Now we know we have sudo, we don't need to use sudo for commands
# Function to set global variable
set_var() {
    local key="$1"
    local val="$2"
    local var_dir="/usr/script_global_var"
    
    # Convert key to uppercase
    key=$(echo "$key" | tr '[:lower:]' '[:upper:]')
    
    # Ensure directory exists
    if [ ! -d "$var_dir" ]; then
        mkdir -p "$var_dir"
    fi
    
    echo "$val" | tee "$var_dir/$key" > /dev/null
}

# Function to get global variable
get_var() {
    local key="$1"
    local var_dir="/usr/script_global_var"
    
    # Convert key to uppercase
    key=$(echo "$key" | tr '[:lower:]' '[:upper:]')
    
    if [ -f "$var_dir/$key" ]; then
        cat "$var_dir/$key"
    fi
}

# Generate MySQL production configuration
generate_mysql_config() {
    cat > /etc/mysql/mysql.conf.d/mysqld.cnf <<EOF
[mysqld]
# Basic Settings
user            = mysql
pid-file        = /var/run/mysqld/mysqld.pid
socket          = /var/run/mysqld/mysqld.sock
port            = 3306
basedir         = /usr
datadir         = /www/mysql/data
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
log_error = /var/log/mysql/error.log
slow_query_log         = 1
slow_query_log_file    = /var/log/mysql/mysql-slow.log
long_query_time        = 2

# Character Set
character-set-server  = utf8mb4
collation-server      = utf8mb4_general_ci

# Binary Logging
log-bin                 = /www/mysql/data/mysql-bin
expire-logs-days        = 7
max-binlog-size        = 100M
binlog-format          = ROW
EOF
}

# Install and configure MySQL
install_mysql() {
    echo "Installing MySQL (MariaDB)..."
    
    # Add MariaDB repository
    curl -LsS https://r.mariadb.com/downloads/mariadb_repo_setup | bash -s -- --mariadb-server-version="mariadb-10.11"
    
    # Install MariaDB server and client
    apt update
    apt install -y mariadb-server mariadb-client
    
    # Create MySQL user and group if they don't exist
    if ! getent group mysql >/dev/null; then
        groupadd mysql
    fi
    if ! getent passwd mysql >/dev/null; then
        useradd -r -g mysql -s /bin/false mysql
    fi
    
    # Setup data directory
    setup_data_dir
    local need_init=$?
    
    # Get or generate root password
    local root_password=$(get_mysql_password)
    
    # Stop MariaDB service for configuration
    systemctl stop mariadb
    
    # Create necessary directories
    mkdir -p /etc/mysql/mysql.conf.d
    mkdir -p /var/run/mysqld
    chown mysql:mysql /var/run/mysqld
    
    # Generate production configuration
    generate_mysql_config
    
    # Initialize MySQL if needed
    if [ $need_init -eq 1 ]; then
        echo "Initializing MySQL data directory..."
        mysql_install_db --user=mysql --datadir=/www/mysql/data
    fi
    
    # Start MariaDB service
    systemctl start mariadb
    systemctl enable mariadb
    
    # Set root password and secure the installation
    echo "Securing MySQL installation..."
    # First try without password
    if ! mysql -u root -e "SELECT 1"; then
        # Try with sudo
        echo "Setting up root password..."
        sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$root_password';"
        # Now use the password for subsequent commands
        mysql -u root -p"$root_password" -e "DELETE FROM mysql.user WHERE User='';"
        mysql -u root -p"$root_password" -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');"
        mysql -u root -p"$root_password" -e "DROP DATABASE IF EXISTS test;"
        mysql -u root -p"$root_password" -e "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';"
        mysql -u root -p"$root_password" -e "FLUSH PRIVILEGES;"
    else
        # If we can connect without password, set it up
        mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$root_password';"
        mysql -u root -p"$root_password" -e "DELETE FROM mysql.user WHERE User='';"
        mysql -u root -p"$root_password" -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');"
        mysql -u root -p"$root_password" -e "DROP DATABASE IF EXISTS test;"
        mysql -u root -p"$root_password" -e "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';"
        mysql -u root -p"$root_password" -e "FLUSH PRIVILEGES;"
    fi
}

# Check if MySQL/MariaDB is already installed
check_mysql() {
    if command -v mariadb &> /dev/null || command -v mysql &> /dev/null; then
        local version=$(mariadb --version || mysql --version)
        echo "MySQL/MariaDB is already installed: $version"
        return 0
    fi
    return 1
}

# Setup MySQL data directory
setup_data_dir() {
    local DATA_DIR="/www/mysql/data"
    
    # Create MySQL directories
    mkdir -p "$DATA_DIR"
    mkdir -p /var/log/mysql
    
    # Set proper ownership
    chown -R mysql:mysql "$DATA_DIR"
    chown -R mysql:mysql /var/log/mysql
    chmod 750 "$DATA_DIR"
    
    # Check if data directory is empty
    if [ -z "$(ls -A $DATA_DIR)" ]; then
        return 1  # Need initialization
    else
        return 0  # Already initialized
    fi
}

# Generate or get root password
get_mysql_password() {
    local stored_password=$(get_var "MYSQL_ROOT_PASSWORD")
    if [ -n "$stored_password" ]; then
        echo "$stored_password"
    else
        local new_password=$(openssl rand -base64 12)
        set_var "MYSQL_ROOT_PASSWORD" "$new_password"
        echo "$new_password"
    fi
}

# Store MySQL information in global variables
store_mysql_info() {
    set_var "MYSQL_BIN" "$(which mysql)"
    set_var "MYSQLD_BIN" "$(which mysqld)"
    set_var "MYSQL_VERSION" "$(mysql --version)"
    set_var "MYSQL_CONFIG_DIR" "/etc/mysql"
    set_var "MYSQL_DATA_DIR" "/www/mysql/data"
    set_var "MYSQL_CONFIG_FILE" "/etc/mysql/mysql.conf.d/mysqld.cnf"
    set_var "MYSQL_SERVICE_STATUS" "$(systemctl is-active mariadb)"
    
    local port=$(mysql -N -e "SHOW VARIABLES LIKE 'port';" | awk '{print $2}')
    set_var "MYSQL_PORT" "$port"
}

# Adjust memory settings
adjust_mysql_memory() {
    # Get total memory in MB
    local total_mem_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    local total_mem_mb=$((total_mem_kb / 1024))
    
    # Calculate 10% of total memory
    local target_mem_mb=$((total_mem_mb / 10))
    
    # Find the closest match from 100/200/300/400/500
    local memory_options=(100 200 300 400 500)
    local selected_mem=100
    
    for mem in "${memory_options[@]}"; do
        if [ $target_mem_mb -ge $mem ]; then
            selected_mem=$mem
        else
            break
        fi
    done
    
    # Get scripts directory from global variables
    local COMMON_SCRIPTS_DIR=$(get_var "COMMON_SCRIPTS_DIR")
    if [ -z "$COMMON_SCRIPTS_DIR" ]; then
        echo "Error: COMMON_SCRIPTS_DIR not found in global variables"
        return 1
    fi
    
    local ADJUST_SCRIPT="$COMMON_SCRIPTS_DIR/adjust_mariadb_memory.js"
    
    if [ ! -f "$ADJUST_SCRIPT" ]; then
        echo "Error: MariaDB memory adjustment script not found at $ADJUST_SCRIPT"
        return 1
    fi
    
    echo "Adjusting MariaDB memory settings..."
    echo "Total System Memory: ${total_mem_mb}MB"
    echo "Target Memory (10%): ${target_mem_mb}MB"
    echo "Selected Memory: ${selected_mem}M"
    
    # Run the adjustment script
    if command -v node &> /dev/null; then
        node "$ADJUST_SCRIPT" "${selected_mem}M"
    else
        echo "Error: Node.js is not installed"
        return 1
    fi
}

# Main installation logic
if check_mysql; then
    echo "MySQL/MariaDB is already installed, checking configuration..."
    setup_data_dir
else
    install_mysql
fi

# Store MySQL information
store_mysql_info

# Adjust memory settings
echo "
Adjusting MariaDB memory settings..."
adjust_mysql_memory

# Display MySQL status and configuration
echo "
MySQL Installation Status:
------------------------
Version: $(mysql --version)
Service Status: $(systemctl is-active mariadb)
Data Directory: /www/mysql/data
Root Password: $(get_var "MYSQL_ROOT_PASSWORD")

Current MySQL Configuration:
--------------------------"
if [ -f "/etc/mysql/mysql.conf.d/mysqld.cnf" ]; then
    cat "/etc/mysql/mysql.conf.d/mysqld.cnf"
else
    echo "Warning: MySQL configuration file not found"
fi

echo "
Stored Global Variables:
----------------------"
for var in MYSQL_*; do
    if [ -f "/usr/script_global_var/$var" ]; then
        if [ "$var" = "MYSQL_ROOT_PASSWORD" ]; then
            echo "$var = ********"
        else
            echo "$var = $(cat "/usr/script_global_var/$var")"
        fi
    fi
done

# Final service check
if ! systemctl is-active --quiet mariadb; then
    echo "
Warning: MySQL service is not running
You can start it with: systemctl start mariadb"
fi 

# Final service and connection check
echo "
Performing final checks..."

if systemctl is-active --quiet mariadb; then
    echo "✓ MariaDB service is running"
    
    # Test database connection
    if mysql -u root -p"$root_password" -e "SELECT VERSION();" &>/dev/null; then
        echo "✓ Database connection successful"
        echo "✓ Root password is correctly set"
        
        # Check data directory
        if [ -d "/www/mysql/data" ] && [ "$(ls -A /www/mysql/data)" ]; then
            echo "✓ Data directory is properly initialized"
        else
            echo "✗ Data directory issues detected"
        fi
        
        # Check configuration
        if [ -f "/etc/mysql/mysql.conf.d/mysqld.cnf" ]; then
            echo "✓ Configuration file is in place"
        else
            echo "✗ Configuration file is missing"
        fi
        
        # Show current database size
        echo "
Database Status:"
        mysql -u root -p"$root_password" -e "SELECT table_schema 'Database', 
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) 'Size (MB)'
        FROM information_schema.tables
        GROUP BY table_schema;"
    else
        echo "✗ Database connection failed"
        echo "Please check the root password and database status"
    fi
else
    echo "✗ MariaDB service is not running"
    echo "Try starting it manually: systemctl start mariadb"
fi 