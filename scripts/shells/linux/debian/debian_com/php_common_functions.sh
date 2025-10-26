#!/bin/bash
# PHP Common Functions for Debian/Ubuntu PHP Installation Scripts
# This file contains shared functions used across PHP-related installation scripts

# Source common variables
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_CURRENT_DIR/php_common_vars.sh"

# Source common functions for print functions and USE_SUDO
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Check network connectivity with multiple test hosts
check_network_connectivity_from_php_common() {
    local script_index="${1:-[NETWORK]}"
    print_step_from_common_functions "$script_index Checking network connectivity..."
    
    # Test multiple servers
    local test_hosts=("8.8.8.8" "1.1.1.1" "archive.ubuntu.com" "packages.sury.org")
    local connected=false
    
    for host in "${test_hosts[@]}"; do
        if ping -c 1 -W 5 "$host" >/dev/null 2>&1; then
            print_success_from_common_functions "$script_index Network connectivity confirmed (via $host)"
            connected=true
            break
        fi
    done
    
    if [ "$connected" = false ]; then
        print_error_from_common_functions "$script_index Network connectivity failed"
        print_step_from_common_functions "$script_index Attempting to use offline/cached packages"
        return 1
    fi
    
    return 0
}

# Check PHP-FPM installation and service status
check_php_fpm_status_from_php_common() {
    local php_version="${1:-8.4}"
    local script_index="${2:-[PHP_FPM]}"
    local fpm_service="php${php_version}-fpm"
    local socket_path="/run/php/php${php_version}-fpm.sock"
    
    print_step_from_common_functions "$script_index Checking PHP-FPM service status..."
    
    # Check if service exists
    if ! systemctl list-unit-files | grep -q "$fpm_service"; then
        print_error_from_common_functions "$script_index PHP-FPM service not installed: $fpm_service"
        return 3
    fi
    
    # Check if service is enabled
    if ! systemctl is-enabled --quiet "$fpm_service" 2>/dev/null; then
        print_warning_from_common_functions "$script_index PHP-FPM service not enabled: $fpm_service"
    fi
    
    # Check if service is running
    if systemctl is-active --quiet "$fpm_service"; then
        print_success_from_common_functions "$script_index PHP-FPM service is running: $fpm_service"
    else
        print_error_from_common_functions "$script_index PHP-FPM service not running: $fpm_service"
        return 1
    fi
    
    # Check socket file
    if [ -S "$socket_path" ]; then
        print_success_from_common_functions "$script_index PHP-FPM socket exists: $socket_path"
        local socket_perms=$(stat -c "%a" "$socket_path" 2>/dev/null || echo "unknown")
        print_info_from_common_functions "$script_index Socket permissions: $socket_perms"
    else
        print_error_from_common_functions "$script_index PHP-FPM socket not found: $socket_path"
        return 2
    fi
    
    return 0
}

# Check symbolic link integrity for universal PHP paths
check_symbolic_link_from_php_common() {
    local binary_name="${1:-php}"
    local expected_version="${2:-8.4}"
    local script_index="${3:-[SYMLINK]}"
    local target_link="/usr/local/bin/$binary_name"
    local expected_binary="/usr/bin/${binary_name}${expected_version}"
    
    print_step_from_common_functions "$script_index Checking symbolic link: $target_link"
    
    if [ -L "$target_link" ]; then
        local current_target=$(readlink "$target_link")
        print_info_from_common_functions "$script_index Current symlink target: $current_target"
        
        if [ "$current_target" = "$expected_binary" ]; then
            print_success_from_common_functions "$script_index Symlink is correct: $target_link -> $current_target"
            return 0
        else
            print_warning_from_common_functions "$script_index Symlink points to wrong version: $current_target (expected: $expected_binary)"
            return 1
        fi
    elif [ -f "$target_link" ]; then
        print_warning_from_common_functions "$script_index Target exists but is not a symlink: $target_link"
        return 1
    else
        print_error_from_common_functions "$script_index Symlink not found: $target_link"
        return 2
    fi
}

# Prevent Apache2 conflicts
prevent_apache2_conflicts_from_php_common() {
    local script_index="${1:-[APACHE2]}"
    print_step_from_common_functions "$script_index Preventing Apache2 conflicts..."
    
    # Stop Apache2 if running
    if systemctl is-active --quiet apache2 2>/dev/null; then
        print_warning_from_common_functions "$script_index Stopping Apache2 service..."
        $USE_SUDO systemctl stop apache2 || true
    fi
    
    # Disable Apache2 if enabled
    if systemctl is-enabled --quiet apache2 2>/dev/null; then
        print_warning_from_common_functions "$script_index Disabling Apache2 service..."
        $USE_SUDO systemctl disable apache2 || true
    fi
    
    # Hold Apache2 packages to prevent installation
    print_step_from_common_functions "$script_index Holding Apache2 packages..."
    $USE_SUDO apt-mark hold apache2 apache2-bin apache2-data apache2-utils libapache2-mod-php* 2>/dev/null || true
    
    print_success_from_common_functions "$script_index Apache2 conflicts prevented"
    return 0
}

# Set directory permissions for web applications
set_directory_permissions_from_php_common() {
    local target_dir="${1:-$(map_web_path "wwwroot")}"
    local script_index="${2:-[PERMISSIONS]}"
    
    print_step_from_common_functions "$script_index Setting directory permissions for: $target_dir"
    
    # Create directory if it doesn't exist
    if [ ! -d "$target_dir" ]; then
        print_step_from_common_functions "$script_index Creating directory: $target_dir"
        $USE_SUDO mkdir -p "$target_dir"
    fi
    
    # Set ownership to www-data
    print_step_from_common_functions "$script_index Setting ownership to www-data:www-data"
    $USE_SUDO chown -R www-data:www-data "$target_dir" 2>/dev/null || true
    
    # Set permissions
    print_step_from_common_functions "$script_index Setting directory permissions (755)"
    $USE_SUDO find "$target_dir" -type d -exec chmod 755 {} \; 2>/dev/null || true
    
    print_step_from_common_functions "$script_index Setting file permissions (644)"
    $USE_SUDO find "$target_dir" -type f -exec chmod 644 {} \; 2>/dev/null || true
    
    print_success_from_common_functions "$script_index Directory permissions set successfully"
    return 0
}

# Configure PHP-FPM pool
configure_php_fpm_pool_from_php_common() {
    local version="${1:-8.4}"
    local socket_path="${2:-/run/php/php8.4-fpm.sock}"
    local script_index="${3:-[PHP_FPM_POOL]}"
    
    print_step_from_common_functions "$script_index Configuring PHP-FPM pool for version $version"
    
    local pool_config="/etc/php/$version/fpm/pool.d/www.conf"
    
    if [ -f "$pool_config" ]; then
        # Backup original configuration
        $USE_SUDO cp "$pool_config" "${pool_config}.backup.$(date +%Y%m%d_%H%M%S)"
        
        # Update socket path
        print_step_from_common_functions "$script_index Setting socket path: $socket_path"
        $USE_SUDO sed -i "s|listen = .*|listen = $socket_path|" "$pool_config"
        
        # Update user and group
        print_step_from_common_functions "$script_index Setting user and group to www-data"
        $USE_SUDO sed -i 's/^user = .*/user = www-data/' "$pool_config"
        $USE_SUDO sed -i 's/^group = .*/group = www-data/' "$pool_config"
        
        # Update listen.owner and listen.group
        $USE_SUDO sed -i 's/^listen.owner = .*/listen.owner = www-data/' "$pool_config"
        $USE_SUDO sed -i 's/^listen.group = .*/listen.group = www-data/' "$pool_config"
        
        print_success_from_common_functions "$script_index PHP-FPM pool configured successfully"
        return 0
    else
        print_error_from_common_functions "$script_index PHP-FPM pool configuration file not found: $pool_config"
        return 1
    fi
}

# Ensure socket directory exists
ensure_socket_directory_from_php_common() {
    local socket_path="${1:-/run/php/php8.4-fpm.sock}"
    local script_index="${2:-[SOCKET_DIR]}"
    local socket_dir=$(dirname "$socket_path")
    
    print_step_from_common_functions "$script_index Ensuring socket directory exists: $socket_dir"
    
    if [ ! -d "$socket_dir" ]; then
        print_step_from_common_functions "$script_index Creating socket directory: $socket_dir"
        $USE_SUDO mkdir -p "$socket_dir"
    fi
    
    # Set proper permissions
    $USE_SUDO chmod 755 "$socket_dir"
    $USE_SUDO chown root:www-data "$socket_dir"
    
    print_success_from_common_functions "$script_index Socket directory ready: $socket_dir"
    return 0
}

# Verify PHP-FPM socket with retry mechanism
verify_php_fpm_socket_from_php_common() {
    local socket_path="${1:-/run/php/php8.4-fpm.sock}"
    local script_index="${2:-[SOCKET_VERIFY]}"
    local max_attempts=10
    local attempt=1
    
    print_step_from_common_functions "$script_index Verifying PHP-FPM socket: $socket_path"
    
    while [ $attempt -le $max_attempts ]; do
        if [ -S "$socket_path" ]; then
            print_success_from_common_functions "$script_index Socket verified: $socket_path"
            local socket_perms=$(stat -c "%a" "$socket_path" 2>/dev/null || echo "unknown")
            print_info_from_common_functions "$script_index Socket permissions: $socket_perms"
            return 0
        fi
        
        print_step_from_common_functions "$script_index Attempt $attempt/$max_attempts: Socket not ready, waiting..."
        sleep 2
        ((attempt++))
    done
    
    print_error_from_common_functions "$script_index Socket verification failed after $max_attempts attempts"
    return 1
}

# Update Nginx configuration for PHP
update_nginx_config_from_php_common() {
    local php_version="${1:-8.4}"
    local socket_path="${2:-/run/php/php8.4-fpm.sock}"
    local script_index="${3:-[NGINX_CONFIG]}"
    local install_nginx="${4:-false}"
    
    print_step_from_common_functions "$script_index Updating Nginx configuration for PHP $php_version"
    
    if [ "$install_nginx" != "true" ]; then
        print_info_from_common_functions "$script_index Nginx installation not enabled, skipping configuration"
        return 0
    fi
    
    if ! command -v nginx >/dev/null 2>&1; then
        print_warning_from_common_functions "$script_index Nginx not installed, skipping configuration"
        return 0
    fi
    
    # Update nginx configuration to use correct socket path
    local nginx_conf="/etc/nginx/nginx.conf"
    if [ -f "$nginx_conf" ]; then
        print_step_from_common_functions "$script_index Updating Nginx main configuration"
        
        # Update fastcgi_pass directives
        $USE_SUDO sed -i "s|fastcgi_pass unix:.*|fastcgi_pass unix:$socket_path;|g" "$nginx_conf"
        
        print_success_from_common_functions "$script_index Nginx configuration updated"
    fi
    
    return 0
}

# Update Caddy configuration for PHP
update_caddy_config_from_php_common() {
    local socket_path="${1:-/run/php/php8.4-fpm.sock}"
    local script_index="${2:-[CADDY_CONFIG]}"
    local core_node_dir=$(get_core_node_dir)
    local shells_root="${3:-$core_node_dir/scripts/shells}"
    
    print_step_from_common_functions "$script_index Updating Caddy configuration for PHP"
    
    if ! command -v caddy >/dev/null 2>&1; then
        print_info_from_common_functions "$script_index Caddy not installed, skipping configuration"
        return 0
    fi
    
    # Update Caddy configuration
    local caddy_config="$shells_root/linux/debian/caddy/Caddyfile"
    if [ -f "$caddy_config" ]; then
        print_step_from_common_functions "$script_index Updating Caddyfile with PHP socket"
        
        # Update fastcgi directives
        $USE_SUDO sed -i "s|fastcgi unix .*|fastcgi unix $socket_path|g" "$caddy_config"
        
        print_success_from_common_functions "$script_index Caddy configuration updated"
    fi
    
    return 0
}

# Configure PHP for Laravel with proper open_basedir
configure_php_for_laravel_from_php_common() {
    local script_index="${1:-[LARAVEL_CONFIG]}"
    
    print_step_from_common_functions "$script_index Configuring PHP for Laravel requirements"
    
    for ini_file in "${PHP_INI_FILES[@]}"; do
        if [ -f "$ini_file" ]; then
            print_step_from_common_functions "$script_index Configuring $ini_file"
            
            # Backup original
            $USE_SUDO cp "$ini_file" "${ini_file}.backup.$(date +%Y%m%d_%H%M%S)"
            
            # Enable shell execution for Laravel
            $USE_SUDO sed -i 's/^disable_functions.*/disable_functions = /' "$ini_file"
            
            # Set memory limits for Laravel
            $USE_SUDO sed -i 's/^memory_limit.*/memory_limit = 512M/' "$ini_file"
            
            # Set upload limits
            $USE_SUDO sed -i 's/^upload_max_filesize.*/upload_max_filesize = 64M/' "$ini_file"
            $USE_SUDO sed -i 's/^post_max_size.*/post_max_size = 64M/' "$ini_file"
            
            # Set execution time
            $USE_SUDO sed -i 's/^max_execution_time.*/max_execution_time = 300/' "$ini_file"
            
            # Enable opcache for performance
            $USE_SUDO sed -i 's/^;opcache.enable=.*/opcache.enable=1/' "$ini_file"
            $USE_SUDO sed -i 's/^;opcache.memory_consumption.*/opcache.memory_consumption=256/' "$ini_file"
            
            # Disable open_basedir for maximum compatibility
            # Remove any existing open_basedir settings
            $USE_SUDO sed -i '/^open_basedir/d' "$ini_file"
            $USE_SUDO sed -i '/^;open_basedir/d' "$ini_file"
            # Add new open_basedir = none setting
            echo "open_basedir = none" | $USE_SUDO tee -a "$ini_file" > /dev/null
            
            print_success_from_common_functions "$script_index Configured $ini_file"
        fi
    done
    
    print_success_from_common_functions "$script_index PHP Laravel configuration completed"
    
    # Force reload PHP-FPM to apply new configuration
    force_reload_php_fpm_from_php_common "$script_index"
    
    return 0
}

# Force reload PHP-FPM service to apply configuration changes
force_reload_php_fpm_from_php_common() {
    local script_index="${1:-[PHP_RELOAD]}"
    
    print_step_from_common_functions "$script_index Forcing PHP-FPM reload to apply configuration changes"
    
    # Restart PHP-FPM service
    if $USE_SUDO systemctl restart php8.4-fpm; then
        print_success_from_common_functions "$script_index PHP-FPM service restarted successfully"
    else
        print_warning_from_common_functions "$script_index PHP-FPM restart failed, but continuing"
    fi
    
    # Wait a moment for service to stabilize
    sleep 2
    
    # Verify service is running
    if systemctl is-active --quiet php8.4-fpm; then
        print_success_from_common_functions "$script_index PHP-FPM service is active and running"
    else
        print_error_from_common_functions "$script_index PHP-FPM service is not running after restart"
        return 1
    fi
    
    return 0
}

# Verify open_basedir configuration
verify_open_basedir_config_from_php_common() {
    local script_index="${1:-[VERIFY_OPEN_BASEDIR]}"
    
    print_step_from_common_functions "$script_index Verifying open_basedir configuration"
    
    # Check CLI configuration
    local cli_open_basedir=$(php -i 2>/dev/null | grep "open_basedir" | head -1 | cut -d'>' -f2 | xargs || echo "not found")
    print_info_from_common_functions "$script_index CLI open_basedir: $cli_open_basedir"
    
    # Check FPM configuration
    local fpm_open_basedir=$(php-fpm8.4 -i 2>/dev/null | grep "open_basedir" | head -1 | cut -d'>' -f2 | xargs || echo "not found")
    print_info_from_common_functions "$script_index FPM open_basedir: $fpm_open_basedir"
    
    # Test if open_basedir is properly disabled
    if [ "$cli_open_basedir" = "no value" ] || [ "$cli_open_basedir" = "none" ] || [ -z "$cli_open_basedir" ]; then
        print_success_from_common_functions "$script_index CLI open_basedir is properly disabled"
    else
        print_warning_from_common_functions "$script_index CLI open_basedir is still restricted: $cli_open_basedir"
    fi
    
    if [ "$fpm_open_basedir" = "no value" ] || [ "$fpm_open_basedir" = "none" ] || [ -z "$fpm_open_basedir" ]; then
        print_success_from_common_functions "$script_index FPM open_basedir is properly disabled"
    else
        print_warning_from_common_functions "$script_index FPM open_basedir is still restricted: $fpm_open_basedir"
    fi
    
    return 0
}
