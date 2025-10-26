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
SCRIPT_INDEX="25"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Variables
INSTALL_NGINX=$(get_global_var "INSTALL_NGINX" "false")
INSTALL_MODE=$(get_global_var "INSTALL_MODE" "base")
NGINX_PORT="80"

# Use path mapping from gvar_common.sh to support WSL Windows directories
WWW_ROOT=$(map_web_path "wwwroot")
DEFAULT_SITE_DIR="$WWW_ROOT/default"
NGINX_CONFIG_DIR=$(map_web_path "nginxconfig")

echo "[$SCRIPT_INDEX] Nginx Installation Script"
echo "[$SCRIPT_INDEX] INSTALL_NGINX: $INSTALL_NGINX"
echo "[$SCRIPT_INDEX] INSTALL_MODE: $INSTALL_MODE"

# Function to disable nginx service
disable_nginx() {
    echo "[$SCRIPT_INDEX] Disabling Nginx service..."

    # Check if nginx is installed
    if ! command -v nginx >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] Nginx is not installed"
        return 0
    fi

    echo "[$SCRIPT_INDEX] Nginx is installed, proceeding to disable services..."

    if systemctl is-active --quiet nginx 2>/dev/null; then
        echo "[$SCRIPT_INDEX] Stopping Nginx service..."
        $USE_SUDO systemctl stop nginx
    else
        echo "[$SCRIPT_INDEX] Nginx service is not running"
    fi

    if systemctl is-enabled --quiet nginx 2>/dev/null; then
        echo "[$SCRIPT_INDEX] Disabling Nginx service from auto-start..."
        $USE_SUDO systemctl disable nginx
    else
        echo "[$SCRIPT_INDEX] Nginx service is not enabled for auto-start"
    fi

    echo "[$SCRIPT_INDEX] Nginx service disabled successfully"
    return 0
}

# Check if Nginx installation is enabled
if [ "$INSTALL_NGINX" != "true" ]; then
    echo "[$SCRIPT_INDEX] Nginx installation is disabled (INSTALL_NGINX: $INSTALL_NGINX)"

    if [ "$INSTALL_NGINX" = "false" ]; then
        echo "[$SCRIPT_INDEX] Checking for existing Nginx services to disable..."
        disable_nginx
    fi

    exit 0
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to remove Caddy if it exists
remove_caddy_if_exists() {
    echo "[$SCRIPT_INDEX] Checking for existing Caddy installation..."
    
    if command_exists caddy; then
        echo "[$SCRIPT_INDEX] Caddy found, removing it..."
        
        # Stop Caddy service
        if systemctl is-active --quiet caddy; then
            echo "[$SCRIPT_INDEX] Stopping Caddy service..."
            $USE_SUDO systemctl stop caddy
        fi
        
        # Disable Caddy service
        if systemctl is-enabled --quiet caddy; then
            echo "[$SCRIPT_INDEX] Disabling Caddy service..."
            $USE_SUDO systemctl disable caddy
        fi
        
        # Remove Caddy package
        echo "[$SCRIPT_INDEX] Removing Caddy package..."
        $USE_SUDO apt remove --purge -y caddy
        
        # Remove Caddy repository
        if [ -f "/etc/apt/sources.list.d/caddy-stable.list" ]; then
            echo "[$SCRIPT_INDEX] Removing Caddy repository..."
            $USE_SUDO rm -f /etc/apt/sources.list.d/caddy-stable.list
        fi
        
        if [ -f "/usr/share/keyrings/caddy-stable-archive-keyring.gpg" ]; then
            $USE_SUDO rm -f /usr/share/keyrings/caddy-stable-archive-keyring.gpg
        fi
        
        # Clean up Caddy configuration files (optional, keep /usr/wwwroot)
        if [ -d "/etc/caddy" ]; then
            echo "[$SCRIPT_INDEX] Removing Caddy configuration directory..."
            $USE_SUDO rm -rf /etc/caddy
        fi
        
        # Clean up Caddy data directory
        if [ -d "/var/lib/caddy" ]; then
            echo "[$SCRIPT_INDEX] Removing Caddy data directory..."
            $USE_SUDO rm -rf /var/lib/caddy
        fi
        
        # Clean up Caddy log directory
        if [ -d "/var/log/caddy" ]; then
            echo "[$SCRIPT_INDEX] Removing Caddy log directory..."
            $USE_SUDO rm -rf /var/log/caddy
        fi
        
        # Update package list
        $USE_SUDO apt update
        
        echo "[$SCRIPT_INDEX] Caddy has been completely removed"
    else
        echo "[$SCRIPT_INDEX] No Caddy installation found"
    fi
}

# Function to detect and disable conflicting web servers
disable_conflicting_web_servers() {
    echo "[$SCRIPT_INDEX] Detecting and disabling conflicting web servers..."

    local conflicting_services=(
        "apache2"
        "httpd"
        "lighttpd"
        "caddy"
        "traefik"
        "haproxy"
    )

    local disabled_services=()

    for service in "${conflicting_services[@]}"; do
        # Check if service exists and is installed
        if systemctl list-unit-files | grep -q "^$service.service"; then
            echo "[$SCRIPT_INDEX] Found conflicting service: $service"

            # Stop the service if running
            if systemctl is-active --quiet $service 2>/dev/null; then
                echo "[$SCRIPT_INDEX] Stopping $service service..."
                $USE_SUDO systemctl stop $service
                disabled_services+=("$service (stopped)")
            fi

            # Disable the service
            if systemctl is-enabled --quiet $service 2>/dev/null; then
                echo "[$SCRIPT_INDEX] Disabling $service service..."
                $USE_SUDO systemctl disable $service
                disabled_services+=("$service (disabled)")
            fi

            # Mask the service to prevent accidental restart
            echo "[$SCRIPT_INDEX] Masking $service service to prevent restart..."
            $USE_SUDO systemctl mask $service 2>/dev/null || true
        fi
    done

    # Remove Apache2 packages if installed (they cause PHP conflicts)
    if dpkg -l | grep -q "^ii.*apache2"; then
        echo "[$SCRIPT_INDEX] Apache2 packages detected, removing to prevent PHP conflicts..."
        $USE_SUDO apt remove --purge apache2* libapache2-mod-* -y 2>/dev/null || true
        $USE_SUDO apt autoremove -y 2>/dev/null || true
        disabled_services+=("apache2 (removed)")
    fi

    if [ ${#disabled_services[@]} -gt 0 ]; then
        echo "[$SCRIPT_INDEX] Disabled conflicting services: ${disabled_services[*]}"
    else
        echo "[$SCRIPT_INDEX] No conflicting web servers found"
    fi
}

# Function to force stop services on port 80
force_stop_port_80_services() {
    echo "[$SCRIPT_INDEX] Checking for services using port 80..."

    # Use global WSL detection from gvar_common.sh
    if [ "$IS_WSL" = true ]; then
        echo "[$SCRIPT_INDEX] WSL environment detected"
    fi

    local port_80_pids=$(lsof -ti:80 2>/dev/null || netstat -tlnp 2>/dev/null | grep ":80 " | awk '{print $7}' | cut -d'/' -f1 | grep -v '^-$' | sort -u)

    if [ -n "$port_80_pids" ]; then
        echo "[$SCRIPT_INDEX] Found services using port 80, checking details..."

        # Show which processes are using port 80
        echo "[$SCRIPT_INDEX] Processes using port 80:"
        lsof -i:80 2>/dev/null || netstat -tlnp 2>/dev/null | grep ":80 "

        # If in WSL, provide Windows IIS disable instructions
        if [ "$IS_WSL" = true ]; then
            echo ""
            echo "======================================================================"
            echo "⚠️  WSL ENVIRONMENT DETECTED - Port 80 Conflict"
            echo "======================================================================"
            echo ""
            echo "Port 80 is being used, likely by Windows IIS or another Windows service."
            echo ""
            echo "To disable IIS in Windows (run in PowerShell as Administrator):"
            echo ""
            echo "  # Method 1: Disable IIS Service"
            echo "  Stop-Service -Name W3SVC -Force"
            echo "  Set-Service -Name W3SVC -StartupType Disabled"
            echo ""
            echo "  # Method 2: Disable IIS completely via Windows Features"
            echo "  Disable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole"
            echo ""
            echo "  # Method 3: Stop all IIS-related services"
            echo "  Stop-Service -Name 'W3SVC','WAS','IISADMIN' -Force -ErrorAction SilentlyContinue"
            echo "  Set-Service -Name 'W3SVC','WAS','IISADMIN' -StartupType Disabled -ErrorAction SilentlyContinue"
            echo ""
            echo "  # Method 4: Check what's using port 80 in Windows"
            echo "  netstat -ano | findstr :80"
            echo "  # Then kill the process (replace <PID> with actual process ID):"
            echo "  taskkill /PID <PID> /F"
            echo ""
            echo "After disabling IIS in Windows, restart WSL:"
            echo "  # In PowerShell:"
            echo "  wsl --shutdown"
            echo "  # Then restart WSL and run this script again"
            echo ""
            echo "======================================================================"
            echo ""

            # Prompt user
            read -p "Have you disabled IIS/Windows services? Press Enter to continue or Ctrl+C to abort..."
        fi

        # Force kill processes using port 80 (for Linux services)
        local remaining_pids=$(lsof -ti:80 2>/dev/null)
        if [ -n "$remaining_pids" ]; then
            echo "[$SCRIPT_INDEX] Attempting to force kill Linux processes on port 80: $remaining_pids"

            # Try graceful kill first
            echo "$remaining_pids" | xargs -r $USE_SUDO kill -TERM 2>/dev/null || true
            sleep 2

            # Force kill if still running
            remaining_pids=$(lsof -ti:80 2>/dev/null)
            if [ -n "$remaining_pids" ]; then
                echo "[$SCRIPT_INDEX] Force killing remaining processes: $remaining_pids"
                echo "$remaining_pids" | xargs -r $USE_SUDO kill -9 2>/dev/null || true
            fi
        fi

        # Wait and verify
        sleep 2
        if lsof -ti:80 2>/dev/null; then
            echo "[$SCRIPT_INDEX] ⚠️  WARNING: Port 80 is still in use!"
            echo "[$SCRIPT_INDEX] This may be a Windows service (IIS, HTTP.sys, etc.)"
            echo "[$SCRIPT_INDEX] Please disable Windows services using the commands above"

            if [ "$IS_WSL" = true ]; then
                echo ""
                echo "[$SCRIPT_INDEX] Quick check - Run this in PowerShell (as Admin):"
                echo "  Get-Service W3SVC,WAS,IISADMIN | Select-Object Name,Status,StartType"
                echo ""
            fi

            # Don't fail, just warn
            return 1
        else
            echo "[$SCRIPT_INDEX] �?Port 80 cleared for Nginx"
        fi
    else
        echo "[$SCRIPT_INDEX] �?Port 80 is available"
    fi

    return 0
}

# Function to check if Nginx is already installed
check_nginx() {
    if command_exists nginx; then
        return 0
    fi
    return 1
}

# Function to install Nginx
install_nginx() {
    echo "[$SCRIPT_INDEX] Installing Nginx..."

    # Disable conflicting web servers first
    disable_conflicting_web_servers

    # Force stop any remaining services using port 80
    force_stop_port_80_services

    # Update package list
    $USE_SUDO apt update

    # Install Nginx with no recommends to avoid extra packages
    $USE_SUDO apt install -y nginx --no-install-recommends

    # Enable and start Nginx service
    $USE_SUDO systemctl enable nginx
    $USE_SUDO systemctl start nginx

    echo "[$SCRIPT_INDEX] Nginx installed successfully"
}

# Function to create website root directory structure
create_website_structure() {
    echo "[$SCRIPT_INDEX] Creating website directory structure..."

    # Create main www root directory with maximum permissions
    $USE_SUDO mkdir -p "$WWW_ROOT"
    $USE_SUDO mkdir -p "$DEFAULT_SITE_DIR"
    $USE_SUDO mkdir -p "$NGINX_CONFIG_DIR/sites-available"
    $USE_SUDO mkdir -p "$NGINX_CONFIG_DIR/sites-enabled"
    $USE_SUDO mkdir -p "$NGINX_CONFIG_DIR/conf.d"

    # Set maximum permissions for WWW_ROOT
    $USE_SUDO chmod -R 777 "$WWW_ROOT"
    $USE_SUDO chown -R www-data:www-data "$WWW_ROOT"

    # Set proper permissions for nginx config
    $USE_SUDO chmod -R 755 "$NGINX_CONFIG_DIR"
    $USE_SUDO chown -R www-data:www-data "$NGINX_CONFIG_DIR"

    echo "[$SCRIPT_INDEX] Website directory structure created with maximum permissions"
}

# Function to create basic default HTML page (fallback)
create_default_html() {
    echo "[$SCRIPT_INDEX] Creating basic default HTML page..."
    create_default_html_with_ips
}

# Function to clean up broken Nginx configurations
cleanup_broken_configs() {
    echo "[$SCRIPT_INDEX] Cleaning up any broken Nginx configurations..."

    # First, ensure we only use one sites-enabled directory to avoid conflicts
    # We'll use /www/nginxconfig/sites-enabled as the primary directory

    # Remove ALL default server configurations from both directories
    local config_dirs=(
        "/etc/nginx/sites-enabled"
        "/www/nginxconfig/sites-enabled"
    )

    echo "[$SCRIPT_INDEX] Removing all existing default server configurations to prevent conflicts..."

    for config_dir in "${config_dirs[@]}"; do
        if [ -d "$config_dir" ]; then
            echo "[$SCRIPT_INDEX] Checking configurations in $config_dir"
            # Remove all files that might contain default_server
            for config_file in "$config_dir"/*; do
                if [ -f "$config_file" ] || [ -L "$config_file" ]; then
                    # Check if this config contains default_server
                    if grep -q "default_server" "$config_file" 2>/dev/null; then
                        echo "[$SCRIPT_INDEX] Removing conflicting default server config: $config_file"
                        $USE_SUDO rm -f "$config_file"
                    fi
                fi
            done
        fi
    done

    # Specifically remove the system default configuration to avoid conflicts
    # We'll manage our own default configuration in /www/nginxconfig
    local system_defaults=(
        "/etc/nginx/sites-available/default"
        "/etc/nginx/sites-enabled/default"
    )

    for default_config in "${system_defaults[@]}"; do
        if [ -f "$default_config" ] || [ -L "$default_config" ]; then
            echo "[$SCRIPT_INDEX] Removing system default config to prevent conflicts: $default_config"
            $USE_SUDO rm -f "$default_config"
        fi
    done

    # Also remove old port-specific configurations
    local old_configs=(
        "$NGINX_CONFIG_DIR/sites-available/default-18880"
        "$NGINX_CONFIG_DIR/sites-enabled/default-18880"
        "$NGINX_CONFIG_DIR/sites-available/default-8080"
        "$NGINX_CONFIG_DIR/sites-enabled/default-8080"
        "/etc/nginx/sites-available/default-ssl"
        "/etc/nginx/sites-enabled/default-ssl"
    )

    for old_config in "${old_configs[@]}"; do
        if [ -f "$old_config" ] || [ -L "$old_config" ]; then
            echo "[$SCRIPT_INDEX] Removing old config: $old_config"
            $USE_SUDO rm -f "$old_config"
        fi
    done

    # Test nginx configuration after cleanup
    echo "[$SCRIPT_INDEX] Testing Nginx configuration after cleanup..."
    if $USE_SUDO nginx -t; then
        echo "[$SCRIPT_INDEX] Nginx configuration is now clean"
    else
        echo "[$SCRIPT_INDEX] Nginx configuration still has issues, continuing with fresh config"
        # Show the error for debugging
        echo "[$SCRIPT_INDEX] Nginx test output:"
        $USE_SUDO nginx -t 2>&1 || true
    fi
}

# Function to configure Nginx for port 80 with PHP support
configure_nginx_port() {
    echo "[$SCRIPT_INDEX] Configuring Nginx to listen on port $NGINX_PORT..."

    # Clean up any broken configurations first
    cleanup_broken_configs

    local site_config="$NGINX_CONFIG_DIR/sites-available/default"
    local site_enabled="$NGINX_CONFIG_DIR/sites-enabled/default"
    
    # Create site configuration with PHP support
    $USE_SUDO tee "$site_config" > /dev/null << EOF
server {
    listen $NGINX_PORT default_server;
    listen [::]:$NGINX_PORT default_server;

    root $WWW_ROOT;
    index index.php index.html index.htm index.nginx-debian.html;

    server_name _;

    # Main location block
    location / {
        try_files \$uri \$uri/ =404;
    }

    # PHP processing
    location ~ \.php\$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
    }

    # Deny access to .htaccess files
    location ~ /\.ht {
        deny all;
    }

    # Allow Let's Encrypt challenges
    location ^~ /.well-known/acme-challenge/ {
        allow all;
        root $WWW_ROOT;
        try_files \$uri =404;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # Cache static files
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    # Enable the site
    $USE_SUDO ln -sf "$site_config" "$site_enabled"

    # Note: nginx.conf update is handled by update_nginx_conf function
    
    # Test Nginx configuration
    echo "[$SCRIPT_INDEX] Testing Nginx configuration before applying..."
    if $USE_SUDO nginx -t; then
        echo "[$SCRIPT_INDEX] Nginx configuration test passed"
        # Reload Nginx only if test passes
        echo "[$SCRIPT_INDEX] Reloading Nginx service..."
        if $USE_SUDO systemctl reload nginx; then
            echo "[$SCRIPT_INDEX] Nginx configuration reloaded successfully"
        else
            echo "[$SCRIPT_INDEX] Error: Nginx reload failed"
            # Try restart instead
            echo "[$SCRIPT_INDEX] Attempting restart instead..."
            $USE_SUDO systemctl restart nginx
        fi
    else
        echo "[$SCRIPT_INDEX] Error: Nginx configuration test failed"
        echo "[$SCRIPT_INDEX] Configuration test output:"
        $USE_SUDO nginx -t 2>&1 || true
        return 1
    fi
    
    echo "[$SCRIPT_INDEX] Nginx configured to listen on port $NGINX_PORT"
}

# Function to store Nginx information in global variables
store_nginx_info() {
    echo "[$SCRIPT_INDEX] Storing Nginx information in global variables..."

    # Store binary path
    set_global_var "NGINX_BIN" "$(which nginx)"

    # Store version
    set_global_var "NGINX_VERSION" "$(nginx -v 2>&1 | cut -d' ' -f3 | cut -d'/' -f2)"

    # Store website root directory
    set_global_var "NGINX_WWW_ROOT" "$WWW_ROOT"

    # Store default site directory
    set_global_var "NGINX_DEFAULT_SITE" "$DEFAULT_SITE_DIR"

    # Store config directories
    set_global_var "NGINX_CONFIG_DIR" "$NGINX_CONFIG_DIR"
    set_global_var "NGINX_SITES_AVAILABLE" "$NGINX_CONFIG_DIR/sites-available"
    set_global_var "NGINX_SITES_ENABLED" "$NGINX_CONFIG_DIR/sites-enabled"

    # Store main config file
    set_global_var "NGINX_CONFIG_FILE" "/etc/nginx/nginx.conf"

    # Store service file
    set_global_var "NGINX_SERVICE_FILE" "/lib/systemd/system/nginx.service"

    # Store user and group
    set_global_var "NGINX_USER" "www-data"
    set_global_var "NGINX_GROUP" "www-data"

    # Store log directory
    set_global_var "NGINX_LOG_DIR" "/var/log/nginx"

    # Store service status
    set_global_var "NGINX_SERVICE_STATUS" "$(systemctl is-active nginx)"

    # Store port
    set_global_var "NGINX_PORT" "$NGINX_PORT"

    echo "[$SCRIPT_INDEX] Nginx information stored successfully"
}

# Function to create nginx symlink in /usr/local/bin
create_nginx_symlink() {
    echo "[$SCRIPT_INDEX] Creating/fixing Nginx symlink in /usr/local/bin..."
    
    local target_link="/usr/local/bin/nginx"
    local nginx_binary=""
    
    # Find the actual nginx binary (not symlinks)
    local possible_paths=(
        "/usr/sbin/nginx"
        "/usr/bin/nginx"
        "/sbin/nginx"
        "/bin/nginx"
    )
    
    for path in "${possible_paths[@]}"; do
        if [ -f "$path" ] && [ -x "$path" ] && [ ! -L "$path" ]; then
            nginx_binary="$path"
            echo "[$SCRIPT_INDEX] Found Nginx binary at: $nginx_binary"
            break
        fi
    done
    
    if [ -n "$nginx_binary" ]; then
        # Remove existing symlink (even if broken)
        if [ -L "$target_link" ]; then
            echo "[$SCRIPT_INDEX] Removing existing symlink: $target_link"
            $USE_SUDO rm -f "$target_link"
        elif [ -f "$target_link" ]; then
            echo "[$SCRIPT_INDEX] Removing existing file: $target_link"
            $USE_SUDO rm -f "$target_link"
        fi
        
        # Use common function to set up environment and symlinks
        # Add Nginx installation directory to global path
        add_to_global_path_from_common_functions "$(dirname "$(dirname "$nginx_binary")")"
        
        # Add Nginx binary to global path and create symlinks
        add_to_global_path_from_common_functions "$nginx_binary"
        
        echo "[$SCRIPT_INDEX] Nginx environment setup completed"
        return 0
    else
        echo "[$SCRIPT_INDEX] [FAIL] Nginx binary not found in standard locations"
        return 1
    fi
}

# Function to force reinstall Nginx (nuclear option)
force_reinstall_nginx() {
    echo "[$SCRIPT_INDEX] [WARNING] FORCE REINSTALL: Completely removing and reinstalling Nginx..."

    # Backup configurations from /www/nginxconfig (these should be preserved)
    SCRIPT_TEMP_DIR=$(create_script_temp_dir "25_install_nginx")
    local backup_dir="$SCRIPT_TEMP_DIR/nginx_config_backup_$(date +%s)"
    if [ -d "/www/nginxconfig" ]; then
        echo "[$SCRIPT_INDEX] Backing up /www/nginxconfig to $backup_dir"
        $USE_SUDO cp -r /www/nginxconfig "$backup_dir"
    fi

    # Stop nginx service
    $USE_SUDO systemctl stop nginx 2>/dev/null || true
    $USE_SUDO systemctl disable nginx 2>/dev/null || true

    # Remove nginx packages completely
    echo "[$SCRIPT_INDEX] Removing nginx packages..."
    $USE_SUDO apt remove --purge -y nginx nginx-common nginx-core nginx-full 2>/dev/null || true
    $USE_SUDO apt autoremove -y 2>/dev/null || true

    # Remove configuration files (but preserve /www/nginxconfig)
    echo "[$SCRIPT_INDEX] Cleaning up system nginx configurations..."
    $USE_SUDO rm -rf /etc/nginx 2>/dev/null || true
    $USE_SUDO rm -rf /var/log/nginx 2>/dev/null || true
    $USE_SUDO rm -f /usr/local/bin/nginx 2>/dev/null || true

    # Clean package cache
    $USE_SUDO apt clean
    $USE_SUDO apt update

    # Reinstall nginx
    echo "[$SCRIPT_INDEX] Reinstalling nginx..."
    install_nginx

    # Restore configurations if backup exists
    if [ -d "$backup_dir" ]; then
        echo "[$SCRIPT_INDEX] Restoring configurations from backup..."
        $USE_SUDO cp -r "$backup_dir"/* /www/nginxconfig/ 2>/dev/null || true
        $USE_SUDO chown -R www-data:www-data /www/nginxconfig
        $USE_SUDO rm -rf "$backup_dir"
    fi

    echo "[$SCRIPT_INDEX] Force reinstall completed"
}

# Function to detect and fix configuration conflicts
fix_configuration_conflicts() {
    echo "[$SCRIPT_INDEX] Detecting and fixing configuration conflicts..."

    # Check for duplicate default servers
    if [ -d "/www/nginxconfig/sites-enabled" ]; then
        local duplicate_defaults=$(grep -r "default_server" /www/nginxconfig/sites-enabled/ 2>/dev/null | wc -l)
        if [ "$duplicate_defaults" -gt 1 ]; then
            echo "[$SCRIPT_INDEX] [WARNING] Found $duplicate_defaults default servers, fixing..."

            # Keep only one default server (prefer default-18880)
            for file in /www/nginxconfig/sites-enabled/*; do
                if [ -f "$file" ] && [ "$(basename "$file")" != "default-18880" ]; then
                    if grep -q "default_server" "$file"; then
                        echo "[$SCRIPT_INDEX] Removing default_server from $(basename "$file")"
                        $USE_SUDO sed -i 's/default_server//g' "$file"
                    fi
                fi
            done
        fi
    fi

    # Check for port conflicts
    local port_conflicts=$(netstat -tlnp 2>/dev/null | grep ":80 " | grep -v nginx | wc -l)
    if [ "$port_conflicts" -gt 0 ]; then
        echo "[$SCRIPT_INDEX] [WARNING] Port 80 conflict detected, checking services..."
        netstat -tlnp 2>/dev/null | grep ":80 " | grep -v nginx

        # Try to stop Apache if it's running
        if systemctl is-active --quiet apache2 2>/dev/null; then
            echo "[$SCRIPT_INDEX] Stopping Apache2 service..."
            $USE_SUDO systemctl stop apache2
            $USE_SUDO systemctl disable apache2
        fi
    fi

    # Fix file permissions
    if [ -d "/www/nginxconfig" ]; then
        $USE_SUDO chown -R www-data:www-data /www/nginxconfig
        $USE_SUDO chmod -R 755 /www/nginxconfig
    fi

    echo "[$SCRIPT_INDEX] Configuration conflict fixes completed"
}

# Function to check and fix duplicate default_server declarations
check_and_fix_duplicate_default_servers() {
    echo "[$SCRIPT_INDEX] Checking for duplicate default_server declarations..."

    # Test nginx configuration first
    if $USE_SUDO nginx -t 2>&1 | grep -q "duplicate default server"; then
        echo "[$SCRIPT_INDEX] [WARNING] Found duplicate default_server declarations, fixing..."

        # Get all enabled site configurations
        local enabled_configs=()
        if [ -d "/etc/nginx/sites-enabled" ]; then
            for config in /etc/nginx/sites-enabled/*; do
                [ -f "$config" ] && enabled_configs+=("$config")
            done
        fi
        if [ -d "/www/nginxconfig/sites-enabled" ]; then
            for config in /www/nginxconfig/sites-enabled/*; do
                [ -f "$config" ] && enabled_configs+=("$config")
            done
        fi

        # Count default_server declarations
        local default_server_count=0
        local configs_with_default=()

        for config in "${enabled_configs[@]}"; do
            if grep -q "default_server" "$config" 2>/dev/null; then
                default_server_count=$((default_server_count + 1))
                configs_with_default+=("$config")
            fi
        done

        echo "[$SCRIPT_INDEX] Found $default_server_count configurations with default_server"

        if [ $default_server_count -gt 1 ]; then
            # Keep only our custom default configuration, remove others
            for config in "${configs_with_default[@]}"; do
                # Keep /www/nginxconfig/sites-enabled/default, remove others
                if [[ "$config" != "/www/nginxconfig/sites-enabled/default" ]]; then
                    echo "[$SCRIPT_INDEX] Removing duplicate default_server config: $config"
                    $USE_SUDO rm -f "$config"
                fi
            done

            # Test configuration again
            if $USE_SUDO nginx -t; then
                echo "[$SCRIPT_INDEX] [OK] Duplicate default_server issue resolved"
                return 0
            else
                echo "[$SCRIPT_INDEX] [WARNING] Still have configuration issues after cleanup"
                return 1
            fi
        else
            echo "[$SCRIPT_INDEX] [OK] No duplicate default_server declarations found"
            return 0
        fi
    else
        echo "[$SCRIPT_INDEX] [OK] No duplicate default_server issues detected"
        return 0
    fi
}

# Function to fix Nginx service
fix_nginx_service() {
    echo "[$SCRIPT_INDEX] Checking and fixing Nginx service..."
    
    # Check if service exists
    if ! systemctl list-unit-files | grep -q "nginx.service"; then
        echo "[$SCRIPT_INDEX] [FAIL] Nginx service not found, reinstalling..."
        return 1
    fi
    
    # Enable service if not enabled
    if ! systemctl is-enabled --quiet nginx; then
        echo "[$SCRIPT_INDEX] Enabling Nginx service..."
        $USE_SUDO systemctl enable nginx
    fi
    
    # Start service if not active
    if ! systemctl is-active --quiet nginx; then
        echo "[$SCRIPT_INDEX] Starting Nginx service..."
        $USE_SUDO systemctl start nginx
        
        # Wait a moment and check again
        sleep 2
        if ! systemctl is-active --quiet nginx; then
            echo "[$SCRIPT_INDEX] [FAIL] Nginx service failed to start, checking configuration..."
            echo "[$SCRIPT_INDEX] Configuration test output:"
            $USE_SUDO nginx -t || true
            return 1
        fi
    fi
    
    echo "[$SCRIPT_INDEX] [OK] Nginx service is running properly"
    return 0
}

# Function to detect all server IPs
detect_server_ips() {
    echo "[$SCRIPT_INDEX] Detecting server IP addresses..."
    
    local ips=()
    
    # Get all IPv4 addresses (excluding loopback)
    while IFS= read -r ip; do
        if [ -n "$ip" ] && [ "$ip" != "127.0.0.1" ]; then
            ips+=("$ip")
        fi
    done < <(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$')
    
    # Alternative method using ip command
    if [ ${#ips[@]} -eq 0 ]; then
        while IFS= read -r line; do
            local ip=$(echo "$line" | grep -oE 'inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | cut -d' ' -f2)
            if [ -n "$ip" ] && [ "$ip" != "127.0.0.1" ]; then
                ips+=("$ip")
            fi
        done < <(ip addr show 2>/dev/null | grep -E 'inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+')
    fi
    
    # Alternative method using ifconfig
    if [ ${#ips[@]} -eq 0 ] && command_exists ifconfig; then
        while IFS= read -r line; do
            local ip=$(echo "$line" | grep -oE 'inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | cut -d' ' -f2)
            if [ -n "$ip" ] && [ "$ip" != "127.0.0.1" ]; then
                ips+=("$ip")
            fi
        done < <(ifconfig 2>/dev/null | grep -E 'inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+')
    fi
    
    # Remove duplicates and store
    local unique_ips=($(printf '%s\n' "${ips[@]}" | sort -u))
    
    if [ ${#unique_ips[@]} -gt 0 ]; then
        echo "[$SCRIPT_INDEX] Detected IP addresses: ${unique_ips[*]}"
        # Store in global variable
        set_global_var "NGINX_SERVER_IPS" "${unique_ips[*]}"
        echo "${unique_ips[@]}"
    else
        echo "[$SCRIPT_INDEX] [WARN] No external IP addresses detected"
        set_global_var "NGINX_SERVER_IPS" "localhost"
        echo "localhost"
    fi
}

# Function to fix directory structure and permissions
fix_directory_structure() {
    echo "[$SCRIPT_INDEX] Checking and fixing directory structure..."
    
    # Create directories if they don't exist
    local dirs_to_create=(
        "$WWW_ROOT"
        "$DEFAULT_SITE_DIR"
        "/www/nginxconfig/sites-available"
        "/www/nginxconfig/sites-enabled"
        "/var/log/nginx"
    )
    
    for dir in "${dirs_to_create[@]}"; do
        if [ ! -d "$dir" ]; then
            echo "[$SCRIPT_INDEX] Creating directory: $dir"
            $USE_SUDO mkdir -p "$dir"
        fi
    done
    
    # Fix ownership and permissions
    echo "[$SCRIPT_INDEX] Fixing ownership and permissions..."
    $USE_SUDO chown -R www-data:www-data "$WWW_ROOT"
    $USE_SUDO chmod -R 755 "$WWW_ROOT"
    
    # Ensure nginx user can access log directory
    $USE_SUDO chown -R www-data:adm /var/log/nginx
    $USE_SUDO chmod -R 750 /var/log/nginx
    
    echo "[$SCRIPT_INDEX] [OK] Directory structure and permissions fixed"
}

# Function to fix default HTML page
fix_default_html() {
    echo "[$SCRIPT_INDEX] Checking and fixing default HTML page..."
    
    local html_file="$DEFAULT_SITE_DIR/index.html"
    local needs_update=false
    
    # Check if file exists
    if [ ! -f "$html_file" ]; then
        needs_update=true
        echo "[$SCRIPT_INDEX] Default HTML file missing, creating..."
    else
        # Check if file contains current server IPs
        local server_ips=($(detect_server_ips))
        local found_current_ips=false
        
        for ip in "${server_ips[@]}"; do
            if grep -q "$ip" "$html_file"; then
                found_current_ips=true
                break
            fi
        done
        
        if [ "$found_current_ips" = false ]; then
            needs_update=true
            echo "[$SCRIPT_INDEX] Default HTML file needs IP update..."
        fi
    fi
    
    if [ "$needs_update" = true ]; then
        create_default_html_with_ips
    else
        echo "[$SCRIPT_INDEX] [OK] Default HTML file is up to date"
    fi
}

# Function to create default HTML with detected IPs
create_default_html_with_ips() {
    echo "[$SCRIPT_INDEX] Creating default HTML page with detected IPs..."
    
    local html_file="$DEFAULT_SITE_DIR/index.html"
    local server_ips=($(detect_server_ips))
    local ip_list=""
    
    # Generate IP list HTML
    for ip in "${server_ips[@]}"; do
        if [ "$ip" != "localhost" ]; then
            ip_list="$ip_list<li><a href=\"http://$ip:$NGINX_PORT\" target=\"_blank\">http://$ip:$NGINX_PORT</a></li>"
        fi
    done
    
    if [ -z "$ip_list" ]; then
        ip_list="<li>http://your-server-ip:$NGINX_PORT</li>"
    fi
    
    $USE_SUDO tee "$html_file" > /dev/null << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nginx Installation Successful</title>
</head>
<body>
    <h1>Nginx Installation Successful!</h1>
    <p>Your Nginx web server is running successfully.</p>

    <h2>Server Information:</h2>
    <ul>
        <li><strong>Server Status:</strong> Active</li>
        <li><strong>Port:</strong> $NGINX_PORT</li>
        <li><strong>WWW Root:</strong> $WWW_ROOT</li>
        <li><strong>Default Site:</strong> $DEFAULT_SITE_DIR</li>
        <li><strong>Config Directory:</strong> $NGINX_CONFIG_DIR</li>
        <li><strong>Server:</strong> Nginx</li>
    </ul>

    <h2>Access URLs:</h2>
    <ul>
        $ip_list
    </ul>

    <h2>System Information:</h2>
    <ul>
        <li><strong>Page generated:</strong> $(date)</li>
        <li><strong>Server IPs detected:</strong> ${server_ips[*]}</li>
        <li><strong>PHP Support:</strong> Available (if PHP-FPM is installed)</li>
        <li><strong>SSL Support:</strong> Available (via Certbot)</li>
    </ul>

    <hr>
    <p><em>This is the default page for your Nginx installation. You can replace this file at $html_file</em></p>
</body>
</html>
EOF
    
    # Set proper ownership and permissions
    $USE_SUDO chown www-data:www-data "$html_file"
    $USE_SUDO chmod 644 "$html_file"
    
    echo "[$SCRIPT_INDEX] [OK] Default HTML page created with detected IPs: ${server_ips[*]}"
}

# Function to verify Nginx installation with comprehensive checks
verify_nginx_installation() {
    echo "[$SCRIPT_INDEX] Performing comprehensive Nginx verification..."
    
    local verification_passed=true
    
    # Check 1: Nginx binary exists
    if ! command_exists nginx; then
        echo "[$SCRIPT_INDEX] [FAIL] Nginx binary not found"
        verification_passed=false
    else
        echo "[$SCRIPT_INDEX] [OK] Nginx binary found: $(which nginx)"
    fi
    
    # Check 2: Nginx service is active
    if ! systemctl is-active --quiet nginx; then
        echo "[$SCRIPT_INDEX] [FAIL] Nginx service is not active"
        verification_passed=false
    else
        echo "[$SCRIPT_INDEX] [OK] Nginx service is active"
    fi
    
    # Check 3: Port is listening
    local port_listening=false
    if netstat -tuln 2>/dev/null | grep -q ":$NGINX_PORT "; then
        port_listening=true
    elif ss -tuln 2>/dev/null | grep -q ":$NGINX_PORT "; then
        port_listening=true
    fi
    
    if [ "$port_listening" = false ]; then
        echo "[$SCRIPT_INDEX] [FAIL] Nginx is not listening on port $NGINX_PORT"
        verification_passed=false
    else
        echo "[$SCRIPT_INDEX] [OK] Nginx is listening on port $NGINX_PORT"
    fi
    
    # Check 4: Default HTML file exists
    if [ ! -f "$DEFAULT_SITE_DIR/index.html" ]; then
        echo "[$SCRIPT_INDEX] [FAIL] Default HTML file not found"
        verification_passed=false
    else
        echo "[$SCRIPT_INDEX] [OK] Default HTML file exists"
    fi
    
    # Check 5: Symlink exists
    if [ ! -L "/usr/local/bin/nginx" ] || [ ! -x "/usr/local/bin/nginx" ]; then
        echo "[$SCRIPT_INDEX] [FAIL] Nginx symlink in /usr/local/bin is missing or broken"
        verification_passed=false
    else
        echo "[$SCRIPT_INDEX] [OK] Nginx symlink in /usr/local/bin is working"
    fi
    
    # Check 6: Configuration test
    echo "[$SCRIPT_INDEX] Testing Nginx configuration..."
    if $USE_SUDO nginx -t; then
        echo "[$SCRIPT_INDEX] [OK] Nginx configuration test passed"
    else
        echo "[$SCRIPT_INDEX] [FAIL] Nginx configuration test failed"
        echo "[$SCRIPT_INDEX] Configuration error details:"
        $USE_SUDO nginx -t 2>&1 || true
        verification_passed=false
    fi
    
    if [ "$verification_passed" = true ]; then
        echo "[$SCRIPT_INDEX] [OK] All Nginx verification checks passed"
        return 0
    else
        echo "[$SCRIPT_INDEX] [FAIL] Some Nginx verification checks failed"
        return 1
    fi
}

# Function to setup Laravel ServerManager compatibility
setup_laravel_compatibility() {
    echo "[$SCRIPT_INDEX] Setting up Laravel ServerManager compatibility..."

    # Map paths using gvar_common.sh function for WSL support
    local www_root=$(map_web_path "wwwroot")
    local nginx_config_dir=$(map_web_path "nginxconfig")
    local backup_dir=$(map_web_path "backup" "nginx-configs")

    # Create necessary directories for Laravel ServerManager
    local laravel_dirs=(
        "$nginx_config_dir/sites-available"
        "$nginx_config_dir/sites-enabled"
        "$backup_dir"
        "$www_root"
    )

    for dir in "${laravel_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            $USE_SUDO mkdir -p "$dir"
            echo "[$SCRIPT_INDEX] Created directory: $dir"
        fi
    done

    # Set proper permissions (skip chown in WSL as Windows filesystem doesn't support it)
    if [ "$IS_WSL" = false ]; then
        $USE_SUDO chown -R www-data:www-data "$www_root" 2>/dev/null || true
    fi
    $USE_SUDO chmod 755 "$www_root" 2>/dev/null || true

    # Create a basic sites-available/sites-enabled structure if not exists
    local default_site="$nginx_config_dir/sites-available/default"
    if [ ! -f "$default_site" ]; then
        echo "[$SCRIPT_INDEX] Creating basic sites-available/default configuration..."
        $USE_SUDO tee "$default_site" > /dev/null << EOF
# Default server configuration for Laravel ServerManager compatibility
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root $www_root;
    index index.html index.htm index.nginx-debian.html;

    server_name _;

    location / {
        try_files \$uri \$uri/ =404;
    }

    # Allow Let's Encrypt challenges
    location ^~ /.well-known/acme-challenge/ {
        allow all;
        root $www_root;
        try_files \$uri =404;
    }
}
EOF
    fi

    # Enable the default site if not already enabled
    local default_enabled="$nginx_config_dir/sites-enabled/default"
    if [ ! -L "$default_enabled" ]; then
        $USE_SUDO ln -sf "$default_site" "$default_enabled"
        echo "[$SCRIPT_INDEX] Enabled default site configuration"
    fi

    # Update nginx.conf (always run this)
    update_nginx_conf

    # Create backup directory with proper permissions
    $USE_SUDO mkdir -p "$backup_dir"
    $USE_SUDO chmod 755 "$backup_dir" 2>/dev/null || true

    echo "[$SCRIPT_INDEX] Laravel ServerManager compatibility setup completed"
}

# Function to update nginx.conf with proper includes
update_nginx_conf() {
    echo "[$SCRIPT_INDEX] Updating nginx.conf with proper includes..."
    local nginx_conf="/etc/nginx/nginx.conf"

    # Get mapped path for WSL support
    local nginx_config_sites=$(map_web_path "nginxconfig" "sites-enabled")

    if [ ! -f "$nginx_conf" ]; then
        echo "[$SCRIPT_INDEX] [FAIL] nginx.conf not found at $nginx_conf"
        return 1
    fi

    # Replace the default sites-enabled include with our custom one to avoid conflicts
    # This prevents duplicate default_server declarations

    # First, remove any existing mapped path includes to avoid duplicates
    local escaped_path=$(echo "$nginx_config_sites" | sed 's/\//\\\//g')
    if grep -q "include $nginx_config_sites/\*;" "$nginx_conf"; then
        echo "[$SCRIPT_INDEX] Removing existing $nginx_config_sites/* include to prevent duplicates..."
        $USE_SUDO sed -i "/include ${escaped_path}\/\*;/d" "$nginx_conf"
    fi

    # Replace the system sites-enabled include with our custom one
    if grep -q "include /etc/nginx/sites-enabled/\*;" "$nginx_conf"; then
        echo "[$SCRIPT_INDEX] Replacing system sites-enabled include with custom one..."
        $USE_SUDO sed -i "s|include /etc/nginx/sites-enabled/\*;|include $nginx_config_sites/*;|" "$nginx_conf"
        echo "[$SCRIPT_INDEX] Replaced /etc/nginx/sites-enabled/* with $nginx_config_sites/*"
    else
        # Add our include if no sites-enabled exists
        echo "[$SCRIPT_INDEX] Adding $nginx_config_sites/* include to nginx.conf..."
        $USE_SUDO sed -i "/include \/etc\/nginx\/conf\.d\/\*\.conf;/a\\\\tinclude $nginx_config_sites/*;" "$nginx_conf"
        echo "[$SCRIPT_INDEX] Added $nginx_config_sites/* to nginx.conf"
    fi

    # Test nginx configuration
    echo "[$SCRIPT_INDEX] Testing nginx configuration after update..."
    if $USE_SUDO nginx -t; then
        echo "[$SCRIPT_INDEX] [OK] nginx configuration test passed after update"
    else
        echo "[$SCRIPT_INDEX] [FAIL] nginx configuration test failed after update"
        echo "[$SCRIPT_INDEX] Configuration error details:"
        $USE_SUDO nginx -t 2>&1 || true
        return 1
    fi

    echo "[$SCRIPT_INDEX] nginx.conf updated successfully"
    return 0
}

# Function to create symbolic links from /etc/nginx to /www/nginxconfig
create_nginx_config_symlinks() {
    echo "[$SCRIPT_INDEX] Creating symbolic links from /etc/nginx to /www/nginxconfig..."
    
    # Ensure /www/nginxconfig exists
    $USE_SUDO mkdir -p "$NGINX_CONFIG_DIR"
    
    # Define the directories and files to link
    local nginx_etc_dir="/etc/nginx"
    local nginx_config_items=(
        "nginx.conf"
        "mime.types"
        "sites-available"
        "sites-enabled"
        "conf.d"
        "snippets"
        "modules-available"
        "modules-enabled"
    )
    
    # Create symlinks for each item
    for item in "${nginx_config_items[@]}"; do
        local source_path="$nginx_etc_dir/$item"
        local target_path="$NGINX_CONFIG_DIR/$item"
        
        # Check if source exists
        if [ -e "$source_path" ]; then
            # Remove existing symlink or file if it exists
            if [ -L "$target_path" ] || [ -e "$target_path" ]; then
                echo "[$SCRIPT_INDEX] Removing existing $target_path"
                $USE_SUDO rm -rf "$target_path"
            fi
            
            # Create the symlink
            echo "[$SCRIPT_INDEX] Creating symlink: $target_path -> $source_path"
            $USE_SUDO ln -sf "$source_path" "$target_path"
            
            # Verify the symlink was created correctly
            if [ -L "$target_path" ] && [ -e "$target_path" ]; then
                echo "[$SCRIPT_INDEX] [OK] Symlink created successfully: $item"
            else
                echo "[$SCRIPT_INDEX] [FAIL] Failed to create symlink: $item"
            fi
        else
            echo "[$SCRIPT_INDEX] [WARN] Source not found, skipping: $source_path"
        fi
    done
    
    # Set proper permissions for the symlinks
    $USE_SUDO chown -h www-data:www-data "$NGINX_CONFIG_DIR"/* 2>/dev/null || true
    $USE_SUDO chmod 755 "$NGINX_CONFIG_DIR"
    
    # Create a README file explaining the symlinks
    $USE_SUDO tee "$NGINX_CONFIG_DIR/README.md" > /dev/null << 'EOF'
# Nginx Configuration Symlinks

This directory contains symbolic links to the actual Nginx configuration files in `/etc/nginx/`.

## Structure
- `nginx.conf` -> `/etc/nginx/nginx.conf` (Main configuration)
- `mime.types` -> `/etc/nginx/mime.types` (MIME type definitions)
- `sites-available/` -> `/etc/nginx/sites-available/` (Available site configurations)
- `sites-enabled/` -> `/etc/nginx/sites-enabled/` (Enabled site configurations)
- `conf.d/` -> `/etc/nginx/conf.d/` (Additional configuration files)
- `snippets/` -> `/etc/nginx/snippets/` (Configuration snippets)
- `modules-available/` -> `/etc/nginx/modules-available/` (Available modules)
- `modules-enabled/` -> `/etc/nginx/modules-enabled/` (Enabled modules)

## Usage
- Edit files in this directory to modify Nginx configuration
- Changes will be reflected in the actual `/etc/nginx/` directory
- Always test configuration with `sudo nginx -t` before reloading
- Reload Nginx with `sudo systemctl reload nginx` after changes

## Management
- These symlinks are automatically created and maintained by the installation script
- Running the script multiple times will fix any broken symlinks
- Do not delete these symlinks manually as they will be recreated
EOF
    
    echo "[$SCRIPT_INDEX] Nginx configuration symlinks setup completed"
    echo "[$SCRIPT_INDEX] Configuration files are now accessible at: $NGINX_CONFIG_DIR"
}

# Function to verify and fix symlinks
verify_and_fix_symlinks() {
    echo "[$SCRIPT_INDEX] Verifying nginx configuration symlinks..."
    
    local nginx_etc_dir="/etc/nginx"
    local broken_links=()
    local missing_links=()
    
    # Check each expected symlink
    local nginx_config_items=(
        "nginx.conf"
        "mime.types"
        "sites-available"
        "sites-enabled"
        "conf.d"
        "snippets"
        "modules-available"
        "modules-enabled"
    )
    
    for item in "${nginx_config_items[@]}"; do
        local target_path="$NGINX_CONFIG_DIR/$item"
        local source_path="$nginx_etc_dir/$item"
        
        if [ -L "$target_path" ]; then
            # Check if symlink is broken
            if [ ! -e "$target_path" ]; then
                echo "[$SCRIPT_INDEX] [WARN] Broken symlink detected: $item"
                broken_links+=("$item")
            else
                echo "[$SCRIPT_INDEX] [OK] Symlink OK: $item"
            fi
        elif [ -e "$target_path" ]; then
            # Check if it's a regular file/directory (not a symlink)
            echo "[$SCRIPT_INDEX] [WARN] Regular file/directory found instead of symlink: $item"
            broken_links+=("$item")
        else
            # Check if source exists and should be linked
            if [ -e "$source_path" ]; then
                echo "[$SCRIPT_INDEX] [WARN] Missing symlink: $item"
                missing_links+=("$item")
            else
                echo "[$SCRIPT_INDEX] [INFO] Source not available: $item"
            fi
        fi
    done
    
    # Fix broken or missing symlinks
    if [ ${#broken_links[@]} -gt 0 ] || [ ${#missing_links[@]} -gt 0 ]; then
        echo "[$SCRIPT_INDEX] Fixing broken/missing symlinks..."
        create_nginx_config_symlinks
    else
        echo "[$SCRIPT_INDEX] All symlinks are working correctly"
    fi
}

# Main installation and repair logic
echo "[$SCRIPT_INDEX] NGINX INSTALLATION & REPAIR PROCESS"

# Step 0: Disable conflicting web servers before any installation
disable_conflicting_web_servers

# Step 1: Remove Caddy if exists (only on first run)
remove_caddy_if_exists

# Step 2: Ensure Nginx is installed
echo "[$SCRIPT_INDEX] Checking Nginx installation..."
if check_nginx; then
    echo "[$SCRIPT_INDEX] [OK] Nginx is already installed: $(nginx -v 2>&1)"
else
    echo "[$SCRIPT_INDEX] Installing Nginx..."
    install_nginx
    if ! check_nginx; then
        echo "[$SCRIPT_INDEX] [FAIL] Nginx installation failed"
        exit 1
    fi
    echo "[$SCRIPT_INDEX] [OK] Nginx installed successfully: $(nginx -v 2>&1)"
fi

# Step 3: Fix directory structure and permissions (always run)
fix_directory_structure

# Step 4: Fix Nginx service (always run)
fix_nginx_service

# Step 5: Create/fix Nginx symlink (always run)
create_nginx_symlink

# Step 6: Configure Nginx for port 80 (always run)
echo "[$SCRIPT_INDEX] Configuring Nginx for port $NGINX_PORT..."
configure_nginx_port

# Step 7: Fix default HTML page with current IPs (always run)
fix_default_html

# Step 8: Setup Laravel ServerManager compatibility
echo "[$SCRIPT_INDEX] Setting up Laravel ServerManager compatibility..."
setup_laravel_compatibility

# Step 8.5: Update nginx.conf (always run)
echo "[$SCRIPT_INDEX] Updating nginx.conf configuration..."
update_nginx_conf

# Step 8.6: Check and fix duplicate default_server declarations (always run)
echo "[$SCRIPT_INDEX] Checking for duplicate default_server declarations..."
check_and_fix_duplicate_default_servers

# Step 9: Create nginx configuration symlinks
echo "[$SCRIPT_INDEX] Setting up nginx configuration symlinks..."
create_nginx_config_symlinks

# Step 10: Verify and fix symlinks (always run)
verify_and_fix_symlinks

# Step 11: Store/update Nginx information (always run)
store_nginx_info

# Step 12: Comprehensive verification and final repair attempt
echo "[$SCRIPT_INDEX] COMPREHENSIVE VERIFICATION"

if ! verify_nginx_installation; then
    echo "[$SCRIPT_INDEX] [WARN] Initial verification failed, attempting repairs..."

    # Repair attempt 1: Clean up configs and test
    echo "[$SCRIPT_INDEX] Attempting to clean up configurations..."
    cleanup_broken_configs

    # Check for duplicate default_server declarations
    check_and_fix_duplicate_default_servers

    # Test configuration before restart
    echo "[$SCRIPT_INDEX] Testing configuration before restart..."
    if $USE_SUDO nginx -t; then
        echo "[$SCRIPT_INDEX] [OK] Configuration test passed, restarting service..."
        $USE_SUDO systemctl restart nginx
        sleep 3
    else
        echo "[$SCRIPT_INDEX] [FAIL] Configuration test failed even after cleanup"
        echo "[$SCRIPT_INDEX] Configuration error details:"
        $USE_SUDO nginx -t 2>&1 || true
    fi

    # Repair attempt 2: Fix configuration and restart
    if ! verify_nginx_installation; then
        echo "[$SCRIPT_INDEX] Reconfiguring and restarting..."
        configure_nginx_port
        # Only restart if config test passes
        if $USE_SUDO nginx -t; then
            $USE_SUDO systemctl restart nginx
            sleep 3
        fi
    fi

    # Final check
    if ! verify_nginx_installation; then
        echo "[$SCRIPT_INDEX] [FAIL] Nginx repair attempts failed"
        echo "[$SCRIPT_INDEX] Manual intervention may be required"
        echo "[$SCRIPT_INDEX] Check the Nginx error log: sudo journalctl -xeu nginx.service"
        exit 1
    fi
fi

# Step 10: Success report with detected IPs and integration info
print_final_summary() {
    local server_ips=($(detect_server_ips))
    echo ""
    echo "[$SCRIPT_INDEX] =============================================="
    echo "[$SCRIPT_INDEX] NGINX INSTALLATION COMPLETED SUCCESSFULLY"
    echo "[$SCRIPT_INDEX] =============================================="
    echo "[$SCRIPT_INDEX] "
    echo "[$SCRIPT_INDEX] Nginx Installation Status:"
    echo "[$SCRIPT_INDEX] -------------------------"
    echo "[$SCRIPT_INDEX] Version: $(nginx -v 2>&1 | cut -d' ' -f3)"
    echo "[$SCRIPT_INDEX] Service Status: $(systemctl is-active nginx)"
    echo "[$SCRIPT_INDEX] Service Enabled: $(systemctl is-enabled nginx)"
    echo "[$SCRIPT_INDEX] Listening Port: $NGINX_PORT"
    echo "[$SCRIPT_INDEX] Website Root: $WWW_ROOT (Permissions: 777)"
    echo "[$SCRIPT_INDEX] Config Directory: $NGINX_CONFIG_DIR"
    echo "[$SCRIPT_INDEX] Binary Path: $(which nginx)"
    echo "[$SCRIPT_INDEX] Symlink: /usr/local/bin/nginx -> $(readlink /usr/local/bin/nginx 2>/dev/null || echo 'Not found')"
    echo "[$SCRIPT_INDEX] "
    echo "[$SCRIPT_INDEX] Detected Server IPs: ${server_ips[*]}"
    echo "[$SCRIPT_INDEX] Access URLs (Copy for testing):"
    for ip in "${server_ips[@]}"; do
        if [ "$ip" != "localhost" ]; then
            echo "[$SCRIPT_INDEX]   http://$ip:$NGINX_PORT"
        fi
    done
    echo "[$SCRIPT_INDEX] "
    echo "[$SCRIPT_INDEX] Integration Status:"
    echo "[$SCRIPT_INDEX] ------------------"

    # Check PHP integration
    if command -v php >/dev/null 2>&1 && systemctl is-active --quiet php8.4-fpm 2>/dev/null; then
        echo "[$SCRIPT_INDEX] PHP Integration: ACTIVE (PHP-FPM running)"
        echo "[$SCRIPT_INDEX]   - PHP files will be processed automatically"
        echo "[$SCRIPT_INDEX]   - Test with: echo '<?php phpinfo(); ?>' > $WWW_ROOT/info.php"
    else
        echo "[$SCRIPT_INDEX] PHP Integration: NOT ACTIVE"
        echo "[$SCRIPT_INDEX]   - Run 31_ensure_php84_intelligent.sh to enable PHP support"
    fi

    # Check Certbot integration
    if command -v certbot >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] Certbot Integration: AVAILABLE"
        echo "[$SCRIPT_INDEX]   - SSL certificates can be obtained via Certbot"
        echo "[$SCRIPT_INDEX]   - Run 26_install_certbot.sh for SSL setup"
        echo "[$SCRIPT_INDEX]   - Nginx is configured for Let's Encrypt challenges"
    else
        echo "[$SCRIPT_INDEX] Certbot Integration: NOT INSTALLED"
        echo "[$SCRIPT_INDEX]   - Run 26_install_certbot.sh to enable SSL support"
    fi

    echo "[$SCRIPT_INDEX] "
    echo "[$SCRIPT_INDEX] Management Commands:"
    echo "[$SCRIPT_INDEX] -------------------"
    echo "[$SCRIPT_INDEX] Start:    sudo systemctl start nginx"
    echo "[$SCRIPT_INDEX] Stop:     sudo systemctl stop nginx"
    echo "[$SCRIPT_INDEX] Restart:  sudo systemctl restart nginx"
    echo "[$SCRIPT_INDEX] Status:   sudo systemctl status nginx"
    echo "[$SCRIPT_INDEX] Test:     sudo nginx -t"
    echo "[$SCRIPT_INDEX] Disable:  Press 'D' in selector menu"
    echo "[$SCRIPT_INDEX] "
    echo "[$SCRIPT_INDEX] Configuration Files:"
    echo "[$SCRIPT_INDEX] -------------------"
    echo "[$SCRIPT_INDEX] Main Config: /etc/nginx/nginx.conf"
    echo "[$SCRIPT_INDEX] Site Config: $NGINX_CONFIG_DIR/sites-available/default"
    echo "[$SCRIPT_INDEX] Enabled Sites: $NGINX_CONFIG_DIR/sites-enabled/"
    echo "[$SCRIPT_INDEX] Symlinked Config: $NGINX_CONFIG_DIR/ (symlinks to /etc/nginx/)"
    echo "[$SCRIPT_INDEX] "
    echo "[$SCRIPT_INDEX] Script can be run repeatedly for maintenance and repairs"
    echo "[$SCRIPT_INDEX] =============================================="
}

print_final_summary
