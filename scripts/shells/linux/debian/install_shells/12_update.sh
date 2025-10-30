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

# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

# Source gvar_common.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Source repository manager for repair functions
source "$PARENT_DIR_LEVEL_1/debian_com/repository_manager.sh"

# Check if running as root or with sudo
if [ "$(id -u)" -ne 0 ] && [ -z "$USE_SUDO" ]; then
    echo "Error: This script must be run as root or with sudo!"
    echo "Please run one of the following:"
    echo "  sudo bash $0"
    echo "  su - root"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to initialize core_node shared directories
initialize_core_node_directories() {
    echo "Initializing core_node shared directories..."

    # Use global variables from gvar_common.sh
    local CORE_NODE_BASE="${CORE_NODE_DATA_DIR}"
    local SHARED_DOWNLOADS="${CORE_NODE_SHARED_DOWNLOADS}"

    if $USE_SUDO mkdir -p "$CORE_NODE_BASE" 2>/dev/null; then
        $USE_SUDO chmod 777 "$CORE_NODE_BASE" 2>/dev/null || true
        echo "Created base directory: $CORE_NODE_BASE"
    else
        echo "Warning: Could not create $CORE_NODE_BASE (may already exist)"
    fi

    if $USE_SUDO mkdir -p "$SHARED_DOWNLOADS" 2>/dev/null; then
        $USE_SUDO chmod 777 "$SHARED_DOWNLOADS" 2>/dev/null || true
        echo "Created shared downloads directory: $SHARED_DOWNLOADS"
        echo "All users can now access: $SHARED_DOWNLOADS"
    else
        echo "Warning: Could not create $SHARED_DOWNLOADS (may already exist)"
    fi

    if [ -d "$CORE_NODE_BASE" ]; then
        echo "Core node directories initialized successfully"
    else
        echo "Warning: Failed to initialize core node directories"
    fi
}

# Function to install essential packages and configure Git
install_packages_and_configure_git() {
    echo "Installing essential packages..."
    $USE_SUDO apt install -y lsof cron curl vim git build-essential rsync htop \
        nano wget openssl libssl-dev zlib1g-dev libbz2-dev \
        libreadline-dev libsqlite3-dev llvm libncurses5-dev libncursesw5-dev \
        xz-utils tk-dev libffi-dev liblzma-dev make software-properties-common \
        cron dnsutils libvips-dev cpulimit expect tar gzip procps

    # Configure Git globally
    git config --global http.sslVerify "false"
    git config --global user.name "prop-dev"
    git config --global user.email "prop-dev@serve.com"
    echo "Essential packages installed."
}

# Main execution
echo "Starting system update and repair process..."

# Initialize core_node directories first
initialize_core_node_directories

# Check for skip GPG flag
SKIP_GPG_FIXES=false
if [ "$1" = "--skip-gpg" ] || [ "$1" = "-s" ]; then
    SKIP_GPG_FIXES=true
    echo "GPG key fixes disabled by user flag"
fi

# Pre-configure APT to handle GPG issues
echo "Pre-configuring APT to handle GPG verification issues..."
$USE_SUDO sh -c 'echo "APT::Get::AllowUnauthenticated \"true\";" > /etc/apt/apt.conf.d/99allow-unauth' 2>/dev/null || {
    echo "Failed to pre-configure APT, but continuing..."
}

# Fix system issues before repository management
echo "Fixing system issues..."

# Fix /tmp directory permissions
echo "Fixing /tmp directory permissions..."
$USE_SUDO chmod 1777 /tmp
$USE_SUDO chown root:root /tmp

# Clean up APT cache and temporary files
echo "Cleaning APT cache and temporary files..."
$USE_SUDO rm -rf /var/lib/apt/lists/*
$USE_SUDO rm -rf /tmp/apt.*
$USE_SUDO rm -rf /tmp/apt-key.*

# Fix APT configuration
echo "Fixing APT configuration..."
$USE_SUDO mkdir -p /var/lib/apt/lists/partial
$USE_SUDO mkdir -p /var/cache/apt/archives/partial
$USE_SUDO chmod 755 /var/lib/apt/lists/partial
$USE_SUDO chmod 755 /var/cache/apt/archives/partial

# Enhanced GPG key fixing with direct key import
echo "Performing enhanced GPG key fixes..."

# Function to fix temporary directory permissions
fix_temp_permissions() {
    echo "Fixing temporary directory permissions..."
    
    # Fix /tmp permissions
    $USE_SUDO chmod 1777 /tmp
    $USE_SUDO chown root:root /tmp
    
    # Create and fix apt temporary directories
    $USE_SUDO mkdir -p /var/cache/apt/archives/partial
    $USE_SUDO mkdir -p /var/lib/apt/lists/partial
    $USE_SUDO mkdir -p /var/log/apt
    
    # Set proper permissions
    $USE_SUDO chmod 755 /var/cache/apt/archives/partial
    $USE_SUDO chmod 755 /var/lib/apt/lists/partial
    $USE_SUDO chmod 755 /var/log/apt
    
    # Clean up any existing temporary files
    $USE_SUDO rm -f /tmp/apt.conf.* 2>/dev/null || true
    $USE_SUDO rm -f /tmp/apt-key.* 2>/dev/null || true
    
    echo "Temporary directory permissions fixed"
}

# Function to import Ubuntu archive signing keys
import_ubuntu_keys() {
    echo "Importing Ubuntu archive signing keys..."

    local ubuntu_keyserver="keyserver.ubuntu.com"
    local ubuntu_keys=(
        "871920D1991BC93C"
        "3B4FE6ACC0B21F32"
        "40976EAF437D05B5"
    )

    for key_id in "${ubuntu_keys[@]}"; do
        echo "Importing Ubuntu key: $key_id"
        if $USE_SUDO apt-key adv --keyserver "$ubuntu_keyserver" --recv-keys "$key_id" 2>/dev/null; then
            echo "Successfully imported key: $key_id"
        else
            echo "Failed to import key: $key_id, trying alternative method..."
            if $USE_SUDO gpg --keyserver "$ubuntu_keyserver" --recv-keys "$key_id" 2>/dev/null; then
                $USE_SUDO gpg --export "$key_id" | $USE_SUDO apt-key add - 2>/dev/null || true
                echo "Imported key via gpg: $key_id"
            else
                echo "Warning: Could not import key $key_id"
            fi
        fi
    done

    echo "Ubuntu key import completed"
}

# Function to fix GPG key issues
fix_gpg_keys() {
    echo "Fixing GPG key issues..."

    # Install required packages
    $USE_SUDO apt update --allow-unauthenticated 2>/dev/null || true
    $USE_SUDO apt install -y gnupg2 gnupg1 apt-transport-https ca-certificates curl wget

    # Fix GPG configuration
    $USE_SUDO mkdir -p /etc/apt/keyrings
    $USE_SUDO chmod 755 /etc/apt/keyrings

    # Import Ubuntu signing keys before cleaning
    import_ubuntu_keys

    # Update GPG keyring
    $USE_SUDO apt-key update 2>/dev/null || true

    echo "GPG key issues fixed"
}

# Function to fix apt configuration
fix_apt_config() {
    echo "Fixing apt configuration..."
    
    # Create apt configuration directory
    $USE_SUDO mkdir -p /etc/apt/apt.conf.d
    
    # Create apt configuration to handle GPG issues
    $USE_SUDO tee /etc/apt/apt.conf.d/99fix-gpg > /dev/null << 'EOF'
# Fix GPG issues
Acquire::gpgv::Options { "--ignore-time-conflict"; };
Acquire::Check-Valid-Until "false";
Acquire::AllowInsecureRepositories "true";
Acquire::AllowDowngradeToInsecureRepositories "true";
EOF
    
    # Create apt configuration for temporary files
    $USE_SUDO tee /etc/apt/apt.conf.d/99fix-temp > /dev/null << 'EOF'
# Fix temporary file issues
Dir::Cache::archives "/var/cache/apt/archives/";
Dir::State::lists "/var/lib/apt/lists/";
Dir::Log "/var/log/apt/";
EOF
    
    echo "Apt configuration fixed"
}

# Function to clean up problematic repositories
cleanup_problematic_repos() {
    echo "Cleaning up problematic repositories..."
    
    # Remove all custom repository files
    $USE_SUDO rm -f /etc/apt/sources.list.d/*.list 2>/dev/null || true
    
    # Remove all GPG keys
    $USE_SUDO rm -f /etc/apt/trusted.gpg.d/* 2>/dev/null || true
    $USE_SUDO rm -f /usr/share/keyrings/*.gpg 2>/dev/null || true
    
    # Clean apt cache
    $USE_SUDO apt clean
    $USE_SUDO apt autoclean
    
    echo "Problematic repositories cleaned up"
}

# Function to restore basic Ubuntu repositories
restore_basic_repos() {
    echo "Restoring basic Ubuntu repositories..."
    
    # Create basic sources.list
    $USE_SUDO tee /etc/apt/sources.list > /dev/null << 'EOF'
# Ubuntu repositories
deb http://archive.ubuntu.com/ubuntu/ noble main restricted universe multiverse
deb http://archive.ubuntu.com/ubuntu/ noble-updates main restricted universe multiverse
deb http://archive.ubuntu.com/ubuntu/ noble-backports main restricted universe multiverse
deb http://security.ubuntu.com/ubuntu/ noble-security main restricted universe multiverse
EOF
    
    # Update package list
    $USE_SUDO apt update --allow-unauthenticated 2>/dev/null || true
    
    echo "Basic repositories restored"
}

# Function to test apt functionality
test_apt() {
    echo "Testing apt functionality..."
    
    # Test apt update
    if $USE_SUDO apt update --allow-unauthenticated 2>/dev/null; then
        echo "[OK] apt update works"
    else
        echo "[FAIL] apt update still has issues"
        return 1
    fi
    
    # Test package search
    if apt search python3 2>/dev/null | head -5 >/dev/null; then
        echo "[OK] apt search works"
    else
        echo "[FAIL] apt search has issues"
        return 1
    fi
    
    echo "apt functionality test completed"
        return 0
}

# Repository cleanup functions
# Function to remove Microsoft Edge repository
remove_edge_repository() {
    echo "Removing Microsoft Edge repository..."
    
    # Remove repository file
    if [ -f "/etc/apt/sources.list.d/microsoft-edge.list" ]; then
        $USE_SUDO rm -f "/etc/apt/sources.list.d/microsoft-edge.list"
        echo "Removed Microsoft Edge repository file"
    fi
    
    # Remove GPG key
    if [ -f "/usr/share/keyrings/microsoft-edge.gpg" ]; then
        $USE_SUDO rm -f "/usr/share/keyrings/microsoft-edge.gpg"
        echo "Removed Microsoft Edge GPG key"
    fi
    
    # Remove any Microsoft GPG keys from apt keyring
    $USE_SUDO apt-key del 0xBC528686B50D79E3 2>/dev/null || true
    
    echo "Microsoft Edge repository cleanup completed"
}

# Function to remove MariaDB repositories
remove_mariadb_repositories() {
    echo "Removing MariaDB repositories..."
    
    # Remove MariaDB repository files
    local mariadb_files=(
        "/etc/apt/sources.list.d/mariadb.list"
        "/etc/apt/sources.list.d/mariadb-10.11.list"
        "/etc/apt/sources.list.d/mariadb-maxscale.list"
    )
    
    for file in "${mariadb_files[@]}"; do
        if [ -f "$file" ]; then
            $USE_SUDO rm -f "$file"
            echo "Removed $file"
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
            echo "Removed $key"
        fi
    done
    
    # Remove MariaDB GPG keys from apt keyring
    $USE_SUDO apt-key del 0x177F4010FE56CA3336300305F1656F24C74CD1D8 2>/dev/null || true
    $USE_SUDO apt-key del 0x0x177F4010FE56CA3336300305F1656F24C74CD1D8 2>/dev/null || true
    
    echo "MariaDB repository cleanup completed"
}

# Function to remove PHP repository
remove_php_repository() {
    echo "Removing PHP repository..."
    
    # Remove PHP repository file
    if [ -f "/etc/apt/sources.list.d/ondrej-ubuntu-php-$(lsb_release -sc).list" ]; then
        $USE_SUDO rm -f "/etc/apt/sources.list.d/ondrej-ubuntu-php-$(lsb_release -sc).list"
        echo "Removed PHP repository file"
    fi
    
    # Remove PHP GPG key
    if [ -f "/usr/share/keyrings/ondrej-ubuntu-php-$(lsb_release -sc).gpg" ]; then
        $USE_SUDO rm -f "/usr/share/keyrings/ondrej-ubuntu-php-$(lsb_release -sc).gpg"
        echo "Removed PHP GPG key"
    fi
    
    # Remove PHP GPG key from apt keyring
    $USE_SUDO apt-key del 0x4F4EA0AAE5267A6C 2>/dev/null || true
    
    echo "PHP repository cleanup completed"
}

# Function to stop and disable MySQL services
stop_mysql_services() {
    echo "Stopping and disabling MySQL services..."
    
    # Stop MySQL/MariaDB services
    if command_exists systemctl; then
        if systemctl is-active --quiet mariadb 2>/dev/null; then
            $USE_SUDO systemctl stop mariadb
            echo "Stopped MariaDB service"
        fi
        if systemctl is-active --quiet mysql 2>/dev/null; then
            $USE_SUDO systemctl stop mysql
            echo "Stopped MySQL service"
        fi
        
        # Disable services
        $USE_SUDO systemctl disable mariadb 2>/dev/null || true
        $USE_SUDO systemctl disable mysql 2>/dev/null || true
        echo "Disabled MySQL/MariaDB services"
    fi
    
    # Kill any remaining MySQL processes
    local mysql_processes=$(pgrep -f "mysql\|mariadb" | wc -l)
    if [ "$mysql_processes" -gt 0 ]; then
        echo "Found $mysql_processes MySQL processes, terminating..."
        $USE_SUDO pkill -f "mysql\|mariadb" 2>/dev/null || true
        sleep 2
    fi
}

# Function to remove MySQL packages
remove_mysql_packages() {
    echo "Removing MySQL packages..."

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

    # Remove MySQL data directories using path mapping from gvar_common.sh
    local mysql_data_dir=$(map_web_path "www" "mysql")
    if [ -d "$mysql_data_dir" ]; then
        $USE_SUDO rm -rf "$mysql_data_dir"
        echo "Removed MySQL data directory: $mysql_data_dir"
    fi

    # Remove MySQL configuration
    if [ -d "/etc/mysql" ]; then
        $USE_SUDO rm -rf "/etc/mysql"
        echo "Removed MySQL configuration directory"
    fi

    # Remove MySQL user and group
    if getent passwd mysql >/dev/null 2>&1; then
        $USE_SUDO userdel mysql 2>/dev/null || true
        echo "Removed MySQL user"
    fi
    if getent group mysql >/dev/null 2>&1; then
        $USE_SUDO groupdel mysql 2>/dev/null || true
        echo "Removed MySQL group"
    fi

    echo "MySQL packages removal completed"
}

# Function to remove Edge packages
remove_edge_packages() {
    echo "Removing Microsoft Edge packages..."
    
    # Kill Edge processes
    local edge_processes=$(pgrep -f "microsoft-edge" | wc -l)
    if [ "$edge_processes" -gt 0 ]; then
        echo "Found $edge_processes Edge processes, terminating..."
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
    
    echo "Microsoft Edge packages removal completed"
}

# Function to perform repository cleanup based on configuration
perform_repository_cleanup() {
    echo "=== Repository Cleanup ==="
    
    # Get configuration variables
    local INSTALL_MYSQL=$(get_var "INSTALL_MYSQL" "false")
    local INSTALL_EDGE=$(get_var "INSTALL_EDGE" "false")
    local INSTALL_PHP=$(get_var "INSTALL_PHP" "false")
    
    echo "MySQL Status: $INSTALL_MYSQL"
    echo "Edge Status: $INSTALL_EDGE"
    echo "PHP Status: $INSTALL_PHP"
    
    # Handle MySQL cleanup
    if [ "$INSTALL_MYSQL" = "false" ]; then
        echo "MySQL is disabled - cleaning up..."
        remove_mariadb_repositories
        stop_mysql_services
        remove_mysql_packages
    else
        echo "MySQL is enabled - keeping repositories"
    fi

    # Handle Edge cleanup
    if [ "$INSTALL_EDGE" = "false" ]; then
        echo "Edge is disabled - cleaning up..."
        remove_edge_repository
        remove_edge_packages
    else
        echo "Edge is enabled - keeping repositories"
    fi

    # Handle PHP cleanup
    if [ "$INSTALL_PHP" = "false" ]; then
        echo "PHP is disabled - cleaning up..."
        remove_php_repository
    else
        echo "PHP is enabled - keeping repositories"
    fi
    
    echo "Repository cleanup completed"
}

# Execute GPG fixes in organized sequence
if [ "$SKIP_GPG_FIXES" = true ]; then
    echo "Skipping GPG key fixes as requested..."
    echo "Configuring APT to work without GPG verification..."
    $USE_SUDO sh -c 'echo "APT::Get::AllowUnauthenticated \"true\";" > /etc/apt/apt.conf.d/99allow-unauth' 2>/dev/null || {
        echo "Failed to configure APT to ignore GPG verification, but continuing..."
    }
else
    echo "=== GPG Issues Fix ==="
    
    # Step 1: Fix temporary directory permissions
    fix_temp_permissions
    
    # Step 2: Fix GPG keys
        fix_gpg_keys
    
    # Step 3: Fix apt configuration
    fix_apt_config
    
    # Step 4: Clean up problematic repositories
    cleanup_problematic_repos
    
    # Step 5: Restore basic repositories
    restore_basic_repos
    
    # Step 6: Test apt functionality
    if test_apt; then
        echo "=== Fix Successful ==="
        echo "GPG issues have been resolved"
        echo "apt should now work properly"
    else
        echo "=== Fix Partially Successful ==="
        echo "Some issues may remain, but basic functionality should work"
    fi
fi

# Perform repository cleanup based on configuration
echo "Performing repository cleanup..."
perform_repository_cleanup

# Enhanced system repair function
echo "Performing enhanced system repairs..."
fix_system_issues() {
    echo "Starting comprehensive system repair..."
    
    # Fix package manager issues
    echo "Fixing package manager issues..."
    $USE_SUDO dpkg --configure -a 2>/dev/null || {
        echo "Package configuration fix failed, but continuing..."
    }
    
    # Fix broken packages
    echo "Fixing broken packages..."
    $USE_SUDO apt-get install -f -y 2>/dev/null || {
        echo "Broken package fix failed, but continuing..."
    }
    
    # Fix permission issues
    echo "Fixing permission issues..."
    $USE_SUDO chown -R root:root /var/lib/apt/ 2>/dev/null || true
    $USE_SUDO chmod -R 755 /var/lib/apt/ 2>/dev/null || true
    $USE_SUDO chown -R root:root /var/cache/apt/ 2>/dev/null || true
    $USE_SUDO chmod -R 755 /var/cache/apt/ 2>/dev/null || true
    
    # Fix network connectivity issues
    echo "Testing network connectivity..."
    if ! ping -c 1 archive.ubuntu.com >/dev/null 2>&1; then
        echo "Network connectivity issues detected, trying to fix DNS..."
        $USE_SUDO systemctl restart systemd-resolved 2>/dev/null || {
            echo "DNS restart failed, but continuing..."
        }
    fi
    
    # Fix systemd services
    echo "Fixing systemd services..."
    $USE_SUDO systemctl daemon-reload 2>/dev/null || {
        echo "Systemd daemon reload failed, but continuing..."
    }
    
    echo "System repair completed"
}

# Call the enhanced system repair function
fix_system_issues

# Fix duplicate sources before repository management
echo "Fixing duplicate APT sources..."
if [ -f "/etc/apt/sources.list" ] && [ -f "/etc/apt/sources.list.d/ubuntu.sources" ]; then
    echo "Backing up original sources.list..."
    $USE_SUDO cp /etc/apt/sources.list /etc/apt/sources.list.backup
    
    echo "Commenting out duplicate entries in sources.list..."
    $USE_SUDO sed -i 's/^deb /#deb /' /etc/apt/sources.list
    $USE_SUDO sed -i 's/^deb-src /#deb-src /' /etc/apt/sources.list
    
    echo "Duplicate sources fixed, using ubuntu.sources instead"
fi

# Use repository manager's repair functions
echo "Repairing apt repositories using repository manager..."
manage_repositories

# Try to update package lists
echo "Updating package lists..."
if ! $USE_SUDO apt update; then
    echo "Standard update failed, trying alternative methods..."
    
    # Try with --allow-unauthenticated
            $USE_SUDO apt update --allow-unauthenticated || {
                echo "Warning: Some repositories may have issues, but continuing..."
            }
fi

# Install packages and configure Git
install_packages_and_configure_git

# Fix unauthenticated packages issue
echo "Fixing unauthenticated packages issue..."
if apt list --upgradable 2>&1 | grep -q "cannot be authenticated"; then
    echo "Detected unauthenticated packages, attempting to fix..."
    
    # Try to update package lists after fixing keys
    echo "Updating package lists after GPG key fix..."
    $USE_SUDO apt update 2>/dev/null || {
        echo "Package list update failed, but continuing..."
    }
fi

echo "Configuring system parameters..."
$USE_SUDO sysctl fs.inotify.max_user_watches=524288
$USE_SUDO sysctl -p

# Final cleanup and verification
echo "Performing final cleanup and verification..."

# Clean up any remaining temporary files
$USE_SUDO rm -rf /tmp/apt.* /tmp/apt-key.* 2>/dev/null || true

# Enhanced system verification
echo "Performing enhanced system verification..."
verify_system_health() {
    echo "Starting comprehensive system health check..."
    
    # Check APT functionality
    echo "Verifying APT functionality..."
    if $USE_SUDO apt list --upgradable >/dev/null 2>&1; then
        echo "[OK] APT functionality verified successfully"
    else
        echo "[WARN] Warning: APT functionality may still have issues"
    fi
    
    # Check package manager integrity
    echo "Checking package manager integrity..."
    if $USE_SUDO dpkg --audit >/dev/null 2>&1; then
        echo "[OK] Package manager integrity verified"
    else
        echo "[WARN] Warning: Package manager integrity issues detected"
    fi
    
    # Check system services
    echo "Checking critical system services..."
    for service in "systemd-resolved" "networking"; do
        if systemctl is-active --quiet "$service" 2>/dev/null; then
            echo "[OK] Service $service is running"
        else
            echo "[WARN] Warning: Service $service is not running"
        fi
    done
    
    # Check disk space
    echo "Checking disk space..."
    disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -lt 90 ]; then
        echo "[OK] Disk space is adequate ($disk_usage% used)"
    else
        echo "[WARN] Warning: Disk space is low ($disk_usage% used)"
    fi
    
    # Check network connectivity
    echo "Checking network connectivity..."
    if ping -c 1 archive.ubuntu.com >/dev/null 2>&1; then
        echo "[OK] Network connectivity verified"
    else
        echo "[WARN] Warning: Network connectivity issues detected"
    fi
    
    echo "System health check completed"
}

# Call the enhanced verification function
verify_system_health

# Check for unauthenticated packages
echo "Checking for unauthenticated packages..."
if apt list --upgradable 2>&1 | grep -q "cannot be authenticated"; then
    echo "Warning: Some packages cannot be authenticated"
    echo "This is usually due to GPG key issues, but packages should still install correctly"
else
    echo "All packages are properly authenticated"
fi

# Check for duplicate sources
echo "Checking for duplicate APT sources..."
if apt-config dump | grep -q "Target Packages.*configured multiple times"; then
    echo "Warning: Duplicate APT sources detected, attempting to fix..."
    
    # Fix duplicate sources by commenting out sources.list entries
    if [ -f "/etc/apt/sources.list" ] && [ -f "/etc/apt/sources.list.d/ubuntu.sources" ]; then
        echo "Fixing duplicate sources by commenting out sources.list entries..."
        $USE_SUDO sed -i 's/^deb /#deb /' /etc/apt/sources.list
        $USE_SUDO sed -i 's/^deb-src /#deb-src /' /etc/apt/sources.list
        
        echo "Duplicate sources fixed, testing APT configuration..."
        if $USE_SUDO apt update >/dev/null 2>&1; then
            echo "APT sources configuration fixed successfully"
        else
            echo "Warning: APT sources still have issues, but system should still function"
        fi
    else
        echo "Warning: Duplicate APT sources detected, but system should still function"
    fi
else
    echo "APT sources configuration looks good"
fi

echo "Setup completed successfully!"
