#!/bin/bash
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

# Source LGar.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2$PARENT_DIR_LEVEL_2/linux/LGar.sh"
source "$PARENT_DIR_LEVEL_5/linux/common/gvar_common.sh"
INSTALL_MYSQL=$(get_var "INSTALL_MYSQL")
INSTALL_MODE=$(get_var "INSTALL_MODE")

if [ "$INSTALL_MYSQL" = "false" ]; then
    echo "Skipping MySQL installation,INSTALL_MYSQL: $INSTALL_MYSQL,INSTALL_MODE: $INSTALL_MODE" 
    exit 0
fi

# Function to check if MySQL is already installed
check_mysql() {
    if command -v mysql &> /dev/null; then
        return 0  # true, is installed
    fi
    return 1  # false, is not installed
}

# Function to setup MySQL data directory
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
    set_global_var "MYSQL_DATA_DIR" "/www/mysql/data"
    set_global_var "MYSQL_LOG_DIR" "/var/log/mysql"
    set_global_var "MYSQL_CONFIG_FILE" "/etc/mysql/mysql.conf.d/mysqld.cnf"
    set_global_var "MYSQL_SERVICE_STATUS" "$(systemctl is-active mariadb)"
    local port=$(mysql -N -e "SHOW VARIABLES LIKE 'port';" | awk '{print $2}')
    set_global_var "MYSQL_PORT" "$port"
}

# Main installation logic
echo "Checking MySQL installation requirements..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run this script with sudo"
    exit 1
fi


echo "Proceeding with MySQL installation..."

# Check if MySQL is already installed
if check_mysql; then
    echo "MySQL is already installed: $(mysql --version)"
    # Update stored information
    store_mysql_info
else
    install_mysql
    if ! check_mysql; then
        echo "Error: MySQL installation failed"
        exit 1
    fi
    echo "MySQL installed successfully: $(mysql --version)"
fi

# Display MySQL installation status
echo "
MySQL Installation Status:
-------------------------
Version: $(mysql --version)
Service Status: $(systemctl is-active mariadb)
Root Password: $(get_global_var "MYSQL_ROOT_PASSWORD")
Data Directory: $(get_global_var "MYSQL_DATA_DIR")
Port: $(get_global_var "MYSQL_PORT")

Configuration Files:
------------------
Main Config: $(get_global_var "MYSQL_CONFIG_FILE")
Error Log: $(get_global_var "MYSQL_LOG_DIR")/error.log
Slow Query Log: $(get_global_var "MYSQL_LOG_DIR")/mysql-slow.log"

# Final service check
if ! systemctl is-active --quiet mariadb; then
    echo "
Warning: MySQL service is not running
You can start it with: sudo systemctl start mariadb"
fi

exit 0 