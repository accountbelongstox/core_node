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

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="99"

# Source global variables
source "$PARENT_DIR_LEVEL_2/LGar.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Variables
INSTALL_MYSQL=$(get_var "INSTALL_MYSQL" "false")
INSTALL_EDGE=$(get_var "INSTALL_EDGE" "false")
INSTALL_PHP=$(get_var "INSTALL_PHP" "false")

echo "[$SCRIPT_INDEX] Repository Cleanup Script"
echo "[$SCRIPT_INDEX] INSTALL_MYSQL: $INSTALL_MYSQL"
echo "[$SCRIPT_INDEX] INSTALL_EDGE: $INSTALL_EDGE"
echo "[$SCRIPT_INDEX] INSTALL_PHP: $INSTALL_PHP"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to remove Microsoft Edge repository
remove_edge_repository() {
    echo "[$SCRIPT_INDEX] Removing Microsoft Edge repository..."
    
    # Remove repository file
    if [ -f "/etc/apt/sources.list.d/microsoft-edge.list" ]; then
        $USE_SUDO rm -f "/etc/apt/sources.list.d/microsoft-edge.list"
        echo "[$SCRIPT_INDEX] Removed Microsoft Edge repository file"
    fi
    
    # Remove GPG key
    if [ -f "/usr/share/keyrings/microsoft-edge.gpg" ]; then
        $USE_SUDO rm -f "/usr/share/keyrings/microsoft-edge.gpg"
        echo "[$SCRIPT_INDEX] Removed Microsoft Edge GPG key"
    fi
    
    # Remove any Microsoft GPG keys from apt keyring
    $USE_SUDO apt-key del 0xBC528686B50D79E3 2>/dev/null || true
    
    echo "[$SCRIPT_INDEX] Microsoft Edge repository cleanup completed"
}

# Function to remove MariaDB repositories
remove_mariadb_repositories() {
    echo "[$SCRIPT_INDEX] Removing MariaDB repositories..."
    
    # Remove MariaDB repository files
    local mariadb_files=(
        "/etc/apt/sources.list.d/mariadb.list"
        "/etc/apt/sources.list.d/mariadb-10.11.list"
        "/etc/apt/sources.list.d/mariadb-maxscale.list"
    )
    
    for file in "${mariadb_files[@]}"; do
        if [ -f "$file" ]; then
            $USE_SUDO rm -f "$file"
            echo "[$SCRIPT_INDEX] Removed $file"
        fi
    done
    
    # Remove MariaDB GPG keys
    local mariadb_keys=(
        "/usr/share/keyrings/mariadb-keyring.gpg"
        "/usr/share/keyrings/mariadb-archive-keyring.gpg"
    )
    
    for key in "${mariadb_keys[@]}"; do
        if [ -f "$key" ]; then
            $USE_SUDO rm -f "$key"
            echo "[$SCRIPT_INDEX] Removed $key"
        fi
    done
    
    # Remove MariaDB GPG keys from apt keyring
    $USE_SUDO apt-key del 0x177F4010FE56CA3336300305F1656F24C74CD1D8 2>/dev/null || true
    $USE_SUDO apt-key del 0x0x177F4010FE56CA3336300305F1656F24C74CD1D8 2>/dev/null || true
    
    echo "[$SCRIPT_INDEX] MariaDB repository cleanup completed"
}

# Function to remove PHP repository
remove_php_repository() {
    echo "[$SCRIPT_INDEX] Removing PHP repository..."
    
    # Remove PHP repository file
    if [ -f "/etc/apt/sources.list.d/ondrej-ubuntu-php-$(lsb_release -sc).list" ]; then
        $USE_SUDO rm -f "/etc/apt/sources.list.d/ondrej-ubuntu-php-$(lsb_release -sc).list"
        echo "[$SCRIPT_INDEX] Removed PHP repository file"
    fi
    
    # Remove PHP GPG key
    if [ -f "/usr/share/keyrings/ondrej-ubuntu-php-$(lsb_release -sc).gpg" ]; then
        $USE_SUDO rm -f "/usr/share/keyrings/ondrej-ubuntu-php-$(lsb_release -sc).gpg"
        echo "[$SCRIPT_INDEX] Removed PHP GPG key"
    fi
    
    # Remove PHP GPG key from apt keyring
    $USE_SUDO apt-key del 0x4F4EA0AAE5267A6C 2>/dev/null || true
    
    echo "[$SCRIPT_INDEX] PHP repository cleanup completed"
}

# Function to stop and disable MySQL services
stop_mysql_services() {
    echo "[$SCRIPT_INDEX] Stopping and disabling MySQL services..."
    
    # Stop MySQL/MariaDB services
    if command_exists systemctl; then
        if systemctl is-active --quiet mariadb 2>/dev/null; then
            $USE_SUDO systemctl stop mariadb
            echo "[$SCRIPT_INDEX] Stopped MariaDB service"
        fi
        if systemctl is-active --quiet mysql 2>/dev/null; then
            $USE_SUDO systemctl stop mysql
            echo "[$SCRIPT_INDEX] Stopped MySQL service"
        fi
        
        # Disable services
        $USE_SUDO systemctl disable mariadb 2>/dev/null || true
        $USE_SUDO systemctl disable mysql 2>/dev/null || true
        echo "[$SCRIPT_INDEX] Disabled MySQL/MariaDB services"
    fi
    
    # Kill any remaining MySQL processes
    local mysql_processes=$(pgrep -f "mysql\|mariadb" | wc -l)
    if [ "$mysql_processes" -gt 0 ]; then
        echo "[$SCRIPT_INDEX] Found $mysql_processes MySQL processes, terminating..."
        $USE_SUDO pkill -f "mysql\|mariadb" 2>/dev/null || true
        sleep 2
    fi
}

# Function to remove MySQL packages
remove_mysql_packages() {
    echo "[$SCRIPT_INDEX] Removing MySQL packages..."
    
    # Stop services first
    stop_mysql_services
    
    # Remove MySQL/MariaDB packages
    $USE_SUDO apt remove --purge -y \
        mariadb-server \
        mariadb-client \
        mariadb-common \
        mysql-server \
        mysql-client \
        mysql-common \
        libmariadb3 \
        libmariadb-dev \
        libmysqlclient21 \
        libmysqlclient-dev 2>/dev/null || true
    
    # Remove MySQL data directories
    if [ -d "/www/mysql" ]; then
        $USE_SUDO rm -rf "/www/mysql"
        echo "[$SCRIPT_INDEX] Removed MySQL data directory"
    fi
    
    # Remove MySQL configuration
    if [ -d "/etc/mysql" ]; then
        $USE_SUDO rm -rf "/etc/mysql"
        echo "[$SCRIPT_INDEX] Removed MySQL configuration directory"
    fi
    
    # Remove MySQL user and group
    if getent passwd mysql >/dev/null 2>&1; then
        $USE_SUDO userdel mysql 2>/dev/null || true
        echo "[$SCRIPT_INDEX] Removed MySQL user"
    fi
    if getent group mysql >/dev/null 2>&1; then
        $USE_SUDO groupdel mysql 2>/dev/null || true
        echo "[$SCRIPT_INDEX] Removed MySQL group"
    fi
    
    echo "[$SCRIPT_INDEX] MySQL packages removal completed"
}

# Function to remove Edge packages
remove_edge_packages() {
    echo "[$SCRIPT_INDEX] Removing Microsoft Edge packages..."
    
    # Kill Edge processes
    local edge_processes=$(pgrep -f "microsoft-edge" | wc -l)
    if [ "$edge_processes" -gt 0 ]; then
        echo "[$SCRIPT_INDEX] Found $edge_processes Edge processes, terminating..."
        $USE_SUDO pkill -f "microsoft-edge" 2>/dev/null || true
        sleep 2
    fi
    
    # Remove Edge packages
    $USE_SUDO apt remove --purge -y \
        microsoft-edge-stable \
        microsoft-edge-beta \
        microsoft-edge-dev 2>/dev/null || true
    
    # Remove Edge data directories
    $USE_SUDO rm -rf /home/*/.config/microsoft-edge* 2>/dev/null || true
    $USE_SUDO rm -rf /root/.config/microsoft-edge* 2>/dev/null || true
    
    echo "[$SCRIPT_INDEX] Microsoft Edge packages removal completed"
}

# Function to clean up apt cache and update
cleanup_apt() {
    echo "[$SCRIPT_INDEX] Cleaning up apt cache..."
    
    # Clean apt cache
    $USE_SUDO apt clean
    $USE_SUDO apt autoclean
    
    # Update package list
    $USE_SUDO apt update
    
    echo "[$SCRIPT_INDEX] Apt cleanup completed"
}

# Function to fix GPG key issues
fix_gpg_keys() {
    echo "[$SCRIPT_INDEX] Fixing GPG key issues..."
    
    # Clean up temporary files
    $USE_SUDO rm -f /tmp/apt.conf.* 2>/dev/null || true
    $USE_SUDO rm -f /tmp/apt-key.* 2>/dev/null || true
    
    # Fix permissions
    $USE_SUDO chmod 755 /tmp
    $USE_SUDO chown root:root /tmp
    
    # Update GPG keys
    $USE_SUDO apt-key update 2>/dev/null || true
    
    echo "[$SCRIPT_INDEX] GPG key issues fixed"
}

# Main execution logic
echo "[$SCRIPT_INDEX] === Repository Cleanup ==="

# Fix GPG key issues first
fix_gpg_keys

# Handle MySQL cleanup
if [ "$INSTALL_MYSQL" = "false" ]; then
    echo "[$SCRIPT_INDEX] MySQL is disabled - cleaning up..."
    remove_mariadb_repositories
    stop_mysql_services
    remove_mysql_packages
else
    echo "[$SCRIPT_INDEX] MySQL is enabled - keeping repositories"
fi

# Handle Edge cleanup
if [ "$INSTALL_EDGE" = "false" ]; then
    echo "[$SCRIPT_INDEX] Edge is disabled - cleaning up..."
    remove_edge_repository
    remove_edge_packages
else
    echo "[$SCRIPT_INDEX] Edge is enabled - keeping repositories"
fi

# Handle PHP cleanup
if [ "$INSTALL_PHP" = "false" ]; then
    echo "[$SCRIPT_INDEX] PHP is disabled - cleaning up..."
    remove_php_repository
else
    echo "[$SCRIPT_INDEX] PHP is enabled - keeping repositories"
fi

# Final cleanup
cleanup_apt

echo "[$SCRIPT_INDEX] === Cleanup Summary ==="
echo "[$SCRIPT_INDEX] MySQL Status: $INSTALL_MYSQL"
echo "[$SCRIPT_INDEX] Edge Status: $INSTALL_EDGE"
echo "[$SCRIPT_INDEX] PHP Status: $INSTALL_PHP"
echo "[$SCRIPT_INDEX] Repository cleanup completed successfully"
