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

# Nginx Integrator Module - Handles Nginx configuration via Laravel Artisan
# This module integrates Laravel application with Nginx web server
# Uses ServerManagerV1 CLI commands for Nginx configuration

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Standard paths consistent with system scripts
NGINX_CONFIG_DIR="/www/nginxconfig"
WWW_ROOT="/www/wwwroot"
PHP_FPM_SOCKET="/var/run/php/php-fpm.sock"

# Check if artisan file exists and is executable
verify_artisan_command() {
    echo "Checking Laravel artisan command availability..."

    if [ ! -f "artisan" ]; then
        echo "ERROR: artisan file not found in current directory" >&2
        return 1
    fi

    if [ ! -x "artisan" ]; then
        chmod +x artisan
        echo "Fixed artisan executable permission"
    fi

    echo "Laravel artisan command verified"
    return 0
}

# Test if Laravel artisan is callable
test_laravel_artisan() {
    echo "Testing Laravel artisan command..."

    if ! php artisan --version >/dev/null 2>&1; then
        echo "ERROR: php artisan command is not callable" >&2
        return 1
    fi

    echo "Laravel artisan command is working"
    return 0
}

# Get Laravel application name and path
get_laravel_app_config() {
    echo "Retrieving Laravel application configuration..."

    local app_name="${1:-laravel_main}"
    local app_path="$(pwd)"
    local app_domain="${2:-localhost}"

    echo "  Application Name: $app_name"
    echo "  Application Path: $app_path"
    echo "  Application Domain: $app_domain"

    # Export for use in other functions
    export LARAVEL_APP_NAME="$app_name"
    export LARAVEL_APP_PATH="$app_path"
    export LARAVEL_APP_DOMAIN="$app_domain"

    return 0
}

# Check if ServerManagerV1 artisan command exists
check_servermanager_command() {
    echo "Checking ServerManagerV1 artisan commands..."

    if ! php artisan list | grep -q "servermanager" 2>/dev/null; then
        echo "WARNING: ServerManagerV1 commands not available" >&2
        return 1
    fi

    echo "ServerManagerV1 commands found"
    return 0
}

# Register Laravel application with Nginx using ServerManagerV1 command
register_with_nginx_via_artisan() {
    local app_name="$1"
    local app_path="$2"
    local app_domain="$3"
    local php_version="${4:-8.4}"

    echo ""
    echo "Registering Laravel application with Nginx..."
    echo "  Application: $app_name"
    echo "  Path: $app_path"
    echo "  Domain: $app_domain"
    echo ""

    # Ensure Nginx config directory exists
    if [ ! -d "$NGINX_CONFIG_DIR" ]; then
        echo "Creating Nginx config directory: $NGINX_CONFIG_DIR"
        mkdir -p "$NGINX_CONFIG_DIR"
        chmod 755 "$NGINX_CONFIG_DIR"
    fi

    # Try to use ServerManagerV1 artisan command
    if php artisan list | grep -q "servermanager:website:add" 2>/dev/null; then
        echo "Using ServerManagerV1 website:add command..."
        php artisan servermanager:website:add \
            --name="$app_name" \
            --domain="$app_domain" \
            --path="$app_path/public" \
            --type="laravel" \
            --php-version="$php_version" 2>&1 | tee -a /tmp/artisan_output.log

        local exit_code=$?
        if [ $exit_code -eq 0 ]; then
            echo "Successfully registered with Nginx via artisan"
            return 0
        else
            echo "WARNING: ServerManagerV1 artisan command failed (exit code: $exit_code)" >&2
        fi
    fi

    # Fallback: Manual Nginx configuration
    return 2  # Signal fallback needed
}

# Create Nginx configuration manually (fallback)
create_nginx_config_manual() {
    local app_name="$1"
    local app_path="$2"
    local app_domain="$3"
    local php_version="${4:-8.4}"

    echo ""
    echo "Creating Nginx configuration manually..."
    echo "  Configuration will be created at: $NGINX_CONFIG_DIR/${app_name}.conf"

    # Determine PHP FPM socket path
    local php_socket="/var/run/php/php${php_version}-fpm.sock"
    if [ ! -S "$php_socket" ]; then
        php_socket="/var/run/php/php-fpm.sock"
    fi

    # Create Nginx configuration
    cat > "$NGINX_CONFIG_DIR/${app_name}.conf" << 'EOF'
upstream laravel_backend {
    server unix:PHP_FPM_SOCKET fail_timeout=0;
}

server {
    listen 80;
    server_name APP_DOMAIN;
    root APP_PATH;

    index index.php;

    # Logging
    access_log /var/log/nginx/APP_NAME.access.log;
    error_log /var/log/nginx/APP_NAME.error.log;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/rss+xml application/javascript application/json;
    gzip_min_length 1024;
    gzip_vary on;
    gzip_disable "msie6";

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Disable access to sensitive files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~ /\.env {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Laravel public folder routing
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # Pass PHP files to FastCGI
    location ~ \.php$ {
        fastcgi_pass laravel_backend;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_intercept_errors off;
        fastcgi_request_buffering off;
        fastcgi_read_timeout 300s;
        fastcgi_connect_timeout 75s;
    }

    # Static files caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

    # Replace placeholders
    sed -i "s|PHP_FPM_SOCKET|$php_socket|g" "$NGINX_CONFIG_DIR/${app_name}.conf"
    sed -i "s|APP_DOMAIN|$app_domain|g" "$NGINX_CONFIG_DIR/${app_name}.conf"
    sed -i "s|APP_PATH|$app_path/public|g" "$NGINX_CONFIG_DIR/${app_name}.conf"
    sed -i "s|APP_NAME|$app_name|g" "$NGINX_CONFIG_DIR/${app_name}.conf"

    # Set proper permissions
    chmod 644 "$NGINX_CONFIG_DIR/${app_name}.conf"

    echo "Nginx configuration created at: $NGINX_CONFIG_DIR/${app_name}.conf"
    echo "Configuration file:"
    cat "$NGINX_CONFIG_DIR/${app_name}.conf"

    return 0
}

# Verify Nginx configuration syntax
verify_nginx_config() {
    local app_name="$1"

    echo ""
    echo "Verifying Nginx configuration syntax..."

    if ! command -v nginx >/dev/null 2>&1; then
        echo "WARNING: nginx command not available - skipping syntax verification" >&2
        return 0
    fi

    if nginx -t 2>&1 | grep -q "successful"; then
        echo "Nginx configuration is valid"
        return 0
    else
        echo "ERROR: Nginx configuration has syntax errors" >&2
        nginx -t
        return 1
    fi
}

# Reload Nginx to apply new configuration
reload_nginx() {
    echo ""
    echo "Reloading Nginx to apply new configuration..."

    if ! command -v nginx >/dev/null 2>&1; then
        echo "WARNING: nginx command not available - cannot reload" >&2
        return 0
    fi

    if ! command -v systemctl >/dev/null 2>&1; then
        echo "WARNING: systemctl command not available" >&2
        return 0
    fi

    # Check if Nginx service is running
    if systemctl is-active --quiet nginx; then
        if systemctl reload nginx 2>&1; then
            echo "Nginx reloaded successfully"
            return 0
        else
            echo "ERROR: Failed to reload Nginx" >&2
            return 1
        fi
    else
        echo "INFO: Nginx service is not running - starting it"
        if systemctl start nginx 2>&1; then
            echo "Nginx started successfully"
            return 0
        else
            echo "ERROR: Failed to start Nginx" >&2
            return 1
        fi
    fi
}

# Register domain binding with ServerManagerV1
register_domain_binding_with_servermanager() {
    local app_name="${1:-laravel_main}"
    local app_path="${2:-.}"
    local app_domain="${3:-localhost}"
    local php_version="${4:-8.4}"

    echo ""
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}  ServerManagerV1 Domain Binding${NC}"
    echo -e "${BLUE}======================================${NC}"

    # Verify database and artisan are available
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}WARNING: .env file not found - skipping ServerManagerV1 binding${NC}"
        return 0
    fi

    if ! php artisan list 2>/dev/null | grep -q "servermanager:website:add"; then
        echo -e "${YELLOW}INFO: ServerManagerV1 website:add command not available${NC}"
        echo -e "${YELLOW}      This may mean vendor dependencies are not installed${NC}"
        return 0
    fi

    # Show real-time output from artisan command
    echo -e "${CYAN}Executing: php artisan servermanager:website:add${NC}"
    echo "  --name=$app_name"
    echo "  --domain=$app_domain"
    echo "  --path=$app_path/public"
    echo "  --type=laravel"
    echo "  --php-version=$php_version"
    echo ""

    # Run the command with real-time output
    if php artisan servermanager:website:add \
        --name="$app_name" \
        --domain="$app_domain" \
        --path="$app_path/public" \
        --type="laravel" \
        --php-version="$php_version" 2>&1; then

        echo ""
        echo -e "${GREEN}[SUCCESS] Domain binding registered with ServerManagerV1${NC}"
        echo -e "${GREEN}  Application: $app_name${NC}"
        echo -e "${GREEN}  Domain: $app_domain${NC}"
        echo -e "${GREEN}  Path: $app_path/public${NC}"

        return 0
    else
        local exit_code=$?
        echo ""
        echo -e "${YELLOW}[WARNING] ServerManagerV1 binding failed (exit code: $exit_code)${NC}"
        echo -e "${YELLOW}Domain binding may need manual configuration${NC}"
        return 0  # Don't fail deployment, just warn
    fi
}

# Complete Nginx integration setup
integrate_with_nginx() {
    local app_name="${1:-laravel_main}"
    local app_path="${2:-.}"
    local app_domain="${3:-localhost}"
    local php_version="${4:-8.4}"

    echo "Starting Nginx integration for Laravel application"
    echo "======================================="

    # Verify artisan is available
    verify_artisan_command || return 1

    # Test artisan command
    test_laravel_artisan || return 1

    # Get application configuration
    get_laravel_app_config "$app_name" "$app_domain"

    # Check if ServerManagerV1 command is available
    check_servermanager_command

    # Register with Nginx
    if register_with_nginx_via_artisan "$app_name" "$app_path" "$app_domain" "$php_version"; then
        echo "Successfully registered with Nginx via ServerManagerV1"
    else
        # Use manual fallback configuration
        echo "Using manual Nginx configuration fallback..."
        create_nginx_config_manual "$app_name" "$app_path" "$app_domain" "$php_version" || return 1
    fi

    # Register domain binding with ServerManagerV1
    register_domain_binding_with_servermanager "$app_name" "$app_path" "$app_domain" "$php_version"

    # Verify configuration
    verify_nginx_config "$app_name" || echo "WARNING: Nginx config verification failed"

    # Reload Nginx
    reload_nginx || echo "WARNING: Nginx reload failed"

    echo ""
    echo "Nginx integration completed"
    echo "  Config directory: $NGINX_CONFIG_DIR"
    echo "  Application accessible at: http://$app_domain"

    return 0
}

# Export functions
export -f verify_artisan_command
export -f test_laravel_artisan
export -f get_laravel_app_config
export -f check_servermanager_command
export -f register_with_nginx_via_artisan
export -f create_nginx_config_manual
export -f verify_nginx_config
export -f reload_nginx
export -f register_domain_binding_with_servermanager
export -f integrate_with_nginx
