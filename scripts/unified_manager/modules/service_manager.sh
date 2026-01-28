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

# Service Manager Module (Refactored)
# Uses core library for service management and configuration

# Get absolute path of script directory using standard bash pattern
SERVICE_MANAGER_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Calculate ROOT_DIR (3 levels up from modules/)
SERVICE_MANAGER_ROOT_DIR="$( cd "$SERVICE_MANAGER_DIR/../../.." && pwd )"

# Pre-calculate all paths before sourcing (prevent variable pollution)
GVAR_COMMON_PATH="$SERVICE_MANAGER_DIR/../../shells/linux/common/gvar_common.sh"
GET_REAL_USER_PATH="$SERVICE_MANAGER_DIR/../../shells/linux/common/get_real_user.sh"
CORE_LIB_PATH="$SERVICE_MANAGER_DIR/../lib/core_lib.sh"
DEBIAN_SERVICE_MANAGER_PATH="$SERVICE_MANAGER_DIR/../../shells/linux/common/debian_service_manager.sh"
FIREWALL_MANAGER_PATH="$SERVICE_MANAGER_DIR/../../shells/linux/common/firewall_manager.sh"
PERMISSIONS_FIXER_PATH="$SERVICE_MANAGER_DIR/../../shells/linux/common/permissions_fixer_lib.sh"

# Temporarily disable error propagation for sourcing
set +e

# Source all required files (trust-based coding)
source "$GVAR_COMMON_PATH" 2>/dev/null
source "$GET_REAL_USER_PATH" 2>/dev/null
source "$CORE_LIB_PATH" 2>/dev/null
source "$DEBIAN_SERVICE_MANAGER_PATH" 2>/dev/null
source "$FIREWALL_MANAGER_PATH" 2>/dev/null
source "$PERMISSIONS_FIXER_PATH" 2>/dev/null

# Re-enable error propagation
set -e

# Restore and export ROOT_DIR after sourcing (prevent overwrite)
ROOT_DIR="$SERVICE_MANAGER_ROOT_DIR"
export ROOT_DIR

# Get fixed port for specific app (using core library)
get_app_fixed_port() {
    local app_name="$1"

    # Find app index in global arrays
    local app_index=-1
    for i in "${!APPS_NAME[@]}"; do
        if [ "${APPS_NAME[$i]}" = "$app_name" ]; then
            app_index=$i
            break
        fi
    done

    # Use core library port management
    get_app_port "$app_name" "$app_index"
}

# Auto-assign port for service
get_available_port() {
    local start_port=10000
    local end_port=11000
    local port=$start_port

    while [ $port -le $end_port ]; do
        if ! ss -tuln | grep -q ":$port "; then
            echo $port
            return 0
        fi
        ((port++))
    done

    echo $start_port
}

# Check if service should run in debug mode (using core library)
should_use_debug_mode() {
    local app_path="$1"
    local framework_type="$2"

    log_header "Debug Mode Detection"
    log_info "Analyzing: $app_path"

    # Use core library debug detection
    local debug_result=$(check_debug_indicators "$app_path" "$framework_type")

    if [ "$debug_result" = "true" ]; then
        log_success "Development environment detected"
    else
        log_info "No clear development indicators found, using production mode"
    fi

    echo "$debug_result"
}

# Scan for daemon service script
scan_daemon_service() {
    local app_path="$1"

    local search_locations=(
        "$app_path/scripts/daemon.sh"
        "$app_path/scripts/daemon.py"
        "$app_path/scripts/daemon.cjs"
        "$app_path/scripts/daemon.js"
        "$app_path/scripts/Daemon.sh"
        "$app_path/scripts/Daemon.py"
        "$app_path/scripts/Daemon.cjs"
        "$app_path/scripts/Daemon.js"
        "$app_path/scripts/DAEMON.sh"
        "$app_path/scripts/DAEMON.py"
        "$app_path/scripts/DAEMON.cjs"
        "$app_path/scripts/DAEMON.js"
        "$app_path/daemon.sh"
        "$app_path/daemon.py"
        "$app_path/daemon.cjs"
        "$app_path/daemon.js"
    )

    for location in "${search_locations[@]}"; do
        if [ -f "$location" ]; then
            echo "$location"
            return 0
        fi
    done

    echo ""
    return 1
}

# Calculate daemon service resources (1/4 of main service)
calculate_daemon_resources() {
    local main_cpu="$1"
    local main_memory="$2"

    local daemon_cpu=""
    local daemon_memory=""

    # Calculate CPU (1/4 of main)
    if [[ "$main_cpu" =~ ^([0-9]+)%$ ]]; then
        local cpu_value="${BASH_REMATCH[1]}"
        local daemon_cpu_value=$((cpu_value / 4))
        if [ $daemon_cpu_value -lt 10 ]; then
            daemon_cpu_value=10
        fi
        daemon_cpu="${daemon_cpu_value}%"
    else
        daemon_cpu="10%"
    fi

    # Calculate Memory (1/4 of main)
    if [[ "$main_memory" =~ ^([0-9]+)G$ ]]; then
        local mem_value="${BASH_REMATCH[1]}"
        local daemon_mem_value=$((mem_value * 1024 / 4))
        daemon_memory="${daemon_mem_value}M"
    elif [[ "$main_memory" =~ ^([0-9]+)M$ ]]; then
        local mem_value="${BASH_REMATCH[1]}"
        local daemon_mem_value=$((mem_value / 4))
        if [ $daemon_mem_value -lt 128 ]; then
            daemon_mem_value=128
        fi
        daemon_memory="${daemon_mem_value}M"
    else
        daemon_memory="128M"
    fi

    echo "$daemon_cpu $daemon_memory"
}

# Create daemon service
create_daemon_service() {
    local app_name="$1"
    local app_path="$2"
    local daemon_script_path="$3"
    local main_service_name="$4"
    local main_cpu="$5"
    local main_memory="$6"
    local debug_mode="$7"

    echo ""
    echo -e "\033[36m=== Creating Daemon Service ===\033[0m"
    echo -e "\033[90mDaemon script: $daemon_script_path\033[0m"

    local daemon_service_name="webapp-${app_name}-daemon"

    # Check if daemon service already exists (idempotent operation)
    if systemctl list-unit-files "$daemon_service_name.service" >/dev/null 2>&1; then
        echo ""
        echo -e "\033[33m⚠ Daemon service already exists: $daemon_service_name\033[0m"
        echo -e "\033[90mRemoving existing daemon service for rebuild...\033[0m"

        # Stop daemon service if running
        if systemctl is-active "$daemon_service_name" >/dev/null 2>&1; then
            echo -e "\033[90mStopping daemon service...\033[0m"
            sudo systemctl stop "$daemon_service_name" 2>/dev/null || true
            sleep 1
        fi

        # Disable daemon service
        if systemctl is-enabled "$daemon_service_name" >/dev/null 2>&1; then
            echo -e "\033[90mDisabling daemon service...\033[0m"
            sudo systemctl disable "$daemon_service_name" 2>/dev/null || true
        fi

        # Remove daemon service file
        echo -e "\033[90mRemoving daemon service file...\033[0m"
        sudo rm -f "/etc/systemd/system/$daemon_service_name.service"
        sudo systemctl daemon-reload

        echo -e "\033[32m✓ Existing daemon service cleaned up\033[0m"
    fi

    # Calculate daemon resources (1/4 of main)
    read daemon_cpu daemon_memory <<< $(calculate_daemon_resources "$main_cpu" "$main_memory")

    echo -e "\033[90mDaemon CPU limit: $daemon_cpu (main: $main_cpu)\033[0m"
    echo -e "\033[90mDaemon Memory limit: $daemon_memory (main: $main_memory)\033[0m"

    # Generate daemon launcher script
    local launcher_generator="$ROOT_DIR/scripts/unified_manager/core/launcher_generator.py"

    local python_debug_mode="False"
    if [ "$debug_mode" = "true" ] || [ "$debug_mode" = "True" ]; then
        python_debug_mode="True"
    fi

    export PYTHONPATH="$ROOT_DIR/scripts/unified_manager/core:$PYTHONPATH"
    local daemon_launcher_script=$(python3 -c "
from launcher_generator import LauncherGenerator

generator = LauncherGenerator()
launcher_path = generator.generate_daemon_launcher(
    service_name='$daemon_service_name',
    daemon_script_path='$daemon_script_path',
    app_path='$app_path',
    debug_mode=$python_debug_mode
)
print(launcher_path)
" 2>&1)

    local gen_result=$?

    if [ $gen_result -ne 0 ] || [ -z "$daemon_launcher_script" ] || [ ! -f "$daemon_launcher_script" ]; then
        echo -e "\033[31m✗ Failed to generate daemon launcher script\033[0m"
        echo -e "\033[90mError: $daemon_launcher_script\033[0m"
        return 1
    fi

    echo -e "\033[32m✓ Daemon launcher script generated\033[0m"
    echo -e "\033[90m$daemon_launcher_script\033[0m"

    # Fix permissions for daemon access using permissions_fixer_lib
    echo ""
    fix_permissions_build_dir
    echo ""
    fix_permissions_app_dir "$app_name"
    echo ""

    # Create daemon service (depends on main service)
    local daemon_description="$app_name daemon service - Auto-generated by Unified Manager"
    local daemon_command="$daemon_launcher_script"
    local working_dir="$app_path"

    # Create systemd service with dependency
    local service_file="/etc/systemd/system/$daemon_service_name.service"

    echo -e "\033[90mCreating daemon systemd service...\033[0m"

    cat > "$service_file" << EOF
[Unit]
Description=$daemon_description
After=network.target
Requires=$main_service_name.service
After=$main_service_name.service

[Service]
Type=simple
User=root
WorkingDirectory=$working_dir
ExecStart=$daemon_command
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
CPUQuota=$daemon_cpu
MemoryMax=$daemon_memory
MemoryHigh=0M

# Security (service runs as root, ProtectSystem provides protection)
PrivateTmp=true
NoNewPrivileges=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF

    if [ $? -eq 0 ]; then
        echo -e "\033[32m✓ Daemon service file created\033[0m"
        systemctl daemon-reload

        # Enable and start daemon service
        echo -e "\033[90mEnabling daemon service...\033[0m"
        sudo systemctl enable "$daemon_service_name"

        echo -e "\033[90mStarting daemon service...\033[0m"
        sudo systemctl start "$daemon_service_name"

        sleep 1

        # Check daemon service status
        if systemctl is-active "$daemon_service_name" >/dev/null 2>&1; then
            echo -e "\033[32m✓ Daemon service is running\033[0m"
            local daemon_status=$(systemctl status "$daemon_service_name" --no-pager -l | head -8)
            echo -e "\033[90m$daemon_status\033[0m"

            echo ""
            echo -e "\033[36m=== Daemon Service Management ===\033[0m"
            echo -e "  Status:  sudo systemctl status $daemon_service_name"
            echo -e "  Logs:    sudo journalctl -u $daemon_service_name -f"
            echo -e "  Stop:    sudo systemctl stop $daemon_service_name"
            echo -e "  Restart: sudo systemctl restart $daemon_service_name"
        else
            echo -e "\033[31m✗ Daemon service failed to start\033[0m"
            local daemon_logs=$(sudo journalctl -u "$daemon_service_name" --no-pager -l --since="1 minute ago" | tail -10)
            echo -e "\033[90m$daemon_logs\033[0m"
            echo ""
            echo -e "\033[33m💡 Check daemon script: $daemon_script_path\033[0m"
        fi

        return 0
    else
        echo -e "\033[31m✗ Failed to create daemon service file\033[0m"
        return 1
    fi
}

# Delete service with daemon service cleanup
delete_unified_service() {
    local app_name="$1"
    local framework_type="$2"

    echo ""
    echo -e "\033[36m=== Deleting SystemD Services ===\033[0m"

    # Determine main service name based on framework
    local main_service_name=""
    case "$framework_type" in
        "reactStart"|"vueStart")
            main_service_name="webapp-$app_name"
            ;;
        "nuxtStart")
            main_service_name="nuxt-$app_name"
            ;;
        "laravelStart")
            main_service_name="laravel-$app_name"
            ;;
        "flutterStart")
            main_service_name="flutter-$app_name"
            ;;
        *)
            main_service_name="app-$app_name"
            ;;
    esac

    local daemon_service_name="webapp-${app_name}-daemon"
    local services_deleted=0

    # Delete daemon service first (if exists)
    if systemctl list-unit-files "$daemon_service_name.service" >/dev/null 2>&1; then
        echo ""
        echo -e "\033[33m--- Deleting Daemon Service ---\033[0m"
        echo -e "\033[90mService: $daemon_service_name\033[0m"

        # Stop daemon service
        if systemctl is-active "$daemon_service_name" >/dev/null 2>&1; then
            echo -e "\033[90mStopping daemon service...\033[0m"
            sudo systemctl stop "$daemon_service_name" 2>/dev/null || true
        fi

        # Disable daemon service
        if systemctl is-enabled "$daemon_service_name" >/dev/null 2>&1; then
            echo -e "\033[90mDisabling daemon service...\033[0m"
            sudo systemctl disable "$daemon_service_name" 2>/dev/null || true
        fi

        # Remove daemon service file
        echo -e "\033[90mRemoving daemon service file...\033[0m"
        sudo rm -f "/etc/systemd/system/$daemon_service_name.service"

        echo -e "\033[32m✓ Daemon service deleted\033[0m"
        services_deleted=$((services_deleted + 1))
    fi

    # Delete main service
    if systemctl list-unit-files "$main_service_name.service" >/dev/null 2>&1; then
        echo ""
        echo -e "\033[33m--- Deleting Main Service ---\033[0m"
        echo -e "\033[90mService: $main_service_name\033[0m"

        # Stop main service
        if systemctl is-active "$main_service_name" >/dev/null 2>&1; then
            echo -e "\033[90mStopping main service...\033[0m"
            sudo systemctl stop "$main_service_name" 2>/dev/null || true
        fi

        # Disable main service
        if systemctl is-enabled "$main_service_name" >/dev/null 2>&1; then
            echo -e "\033[90mDisabling main service...\033[0m"
            sudo systemctl disable "$main_service_name" 2>/dev/null || true
        fi

        # Remove main service file
        echo -e "\033[90mRemoving main service file...\033[0m"
        sudo rm -f "/etc/systemd/system/$main_service_name.service"

        echo -e "\033[32m✓ Main service deleted\033[0m"
        services_deleted=$((services_deleted + 1))
    fi

    # Reload systemd if any service was deleted
    if [ $services_deleted -gt 0 ]; then
        echo ""
        echo -e "\033[90mReloading systemd daemon...\033[0m"
        sudo systemctl daemon-reload
        echo -e "\033[32m✓ Total services deleted: $services_deleted\033[0m"
        return 0
    else
        echo ""
        echo -e "\033[33m⚠ No services found for $app_name\033[0m"
        return 1
    fi
}

# Auto-replace existing compiled services with debug mode if detected
auto_replace_debug_service() {
    local app_name="$1"
    local app_path="$2"
    local framework_type="$3"
    local port="$4"
    local domain="$5"
    local debug_mode="$6"

    if [ "$debug_mode" = "false" ]; then
        return 0  # Not in debug mode, no replacement needed
    fi

    echo ""
    echo -e "\033[36m=== Auto Debug Service Replacement ===\033[0m"
    echo -e "\033[33mDetected development environment for $app_name\033[0m"

    # Check for existing production services
    local service_patterns=("webapp-$app_name" "react-$app_name" "vue-$app_name" "nuxt-$app_name" "laravel-$app_name" "flutter-$app_name" "app-$app_name")
    local found_services=()

    for pattern in "${service_patterns[@]}"; do
        if systemctl list-unit-files "$pattern.service" 2>/dev/null | grep -q "$pattern.service"; then
            found_services+=("$pattern")
        fi
    done

    if [ ${#found_services[@]} -eq 0 ]; then
        echo -e "\033[90mNo existing compiled services found for $app_name\033[0m"
        return 0
    fi

    echo -e "\033[33mFound existing compiled services:\033[0m"
    for service in "${found_services[@]}"; do
        echo -e "  \033[90m�?$service.service\033[0m"
    done

    # Automatically stop and replace with debug version
    echo -e "\033[32mStopping compiled services and replacing with debug version...\033[0m"

    for service in "${found_services[@]}"; do
        if systemctl is-active "$service" >/dev/null 2>&1; then
            echo -e "\033[90mStopping $service.service...\033[0m"
            sudo systemctl stop "$service"
        fi

        if systemctl is-enabled "$service" >/dev/null 2>&1; then
            echo -e "\033[90mDisabling $service.service...\033[0m"
            sudo systemctl disable "$service"
        fi
    done

    echo -e "\033[32m�?Compiled services stopped\033[0m"
    echo -e "\033[32mCreating debug service replacement...\033[0m"

    return 0
}

# Create nginx reverse proxy configuration with SSL support
create_nginx_config() {
    local app_name="$1"
    local domain="$2"
    local port="$3"

    echo ""
    echo -e "\033[32m=== Nginx Reverse Proxy Configuration ===\033[0m"
    echo -e "\033[33mDomain: $domain\033[0m"
    echo -e "\033[33mTarget: localhost:$port\033[0m"

    local nginx_config="/etc/nginx/sites-available/$domain"
    local nginx_enabled="/etc/nginx/sites-enabled/$domain"

    # Check if SSL certificate exists
    local ssl_available=false
    local ssl_cert_path="/etc/ssl/certs/${domain}.crt"
    local ssl_key_path="/etc/ssl/private/${domain}.key"

    if [ -f "$ssl_cert_path" ] && [ -f "$ssl_key_path" ]; then
        ssl_available=true
        echo -e "\033[32m�?SSL certificate found for $domain\033[0m"
    else
        echo -e "\033[33m! No SSL certificate found, creating HTTP-only configuration\033[0m"
        echo -e "\033[90m  SSL files would be: $ssl_cert_path, $ssl_key_path\033[0m"
    fi

    # Create nginx configuration
    cat > "/tmp/$domain.conf" << EOF
# Nginx configuration for $app_name
# Generated by Unified App Manager Service Manager
# Domain: $domain
# Port: $port

server {
    listen 80;
    server_name $domain;
$(if [ "$ssl_available" = true ]; then
    echo "    return 301 https://\$server_name\$request_uri;"
else
    cat << 'EOF_HTTP'

    # Proxy configuration for HTTP
    location / {
        proxy_pass http://127.0.0.1:PORT_PLACEHOLDER;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support for dev servers
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Increase timeout for development servers
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;

        # Handle large uploads
        client_max_body_size 100M;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            proxy_pass http://127.0.0.1:PORT_PLACEHOLDER;
            proxy_set_header Host $host;
        }

        # Hot reload support for development
        location /sockjs-node {
            proxy_pass http://127.0.0.1:PORT_PLACEHOLDER;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }

        # Vite HMR support
        location /@vite {
            proxy_pass http://127.0.0.1:PORT_PLACEHOLDER;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
EOF_HTTP
fi)
}

$(if [ "$ssl_available" = true ]; then
    cat << 'EOF_HTTPS'
server {
    listen 443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;

    # SSL configuration
    ssl_certificate SSL_CERT_PATH;
    ssl_certificate_key SSL_KEY_PATH;

    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Proxy configuration for HTTPS
    location / {
        proxy_pass http://127.0.0.1:PORT_PLACEHOLDER;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        # WebSocket support for dev servers
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Increase timeout for development servers
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;

        # Handle large uploads
        client_max_body_size 100M;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            proxy_pass http://127.0.0.1:PORT_PLACEHOLDER;
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-Proto https;
        }

        # Hot reload support for development
        location /sockjs-node {
            proxy_pass http://127.0.0.1:PORT_PLACEHOLDER;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-Proto https;
        }

        # Vite HMR support
        location /@vite {
            proxy_pass http://127.0.0.1:PORT_PLACEHOLDER;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header X-Forwarded-Proto https;
        }
    }
}
EOF_HTTPS
fi)
EOF

    # Replace placeholders with actual values
    sed -i "s/PORT_PLACEHOLDER/$port/g" "/tmp/$domain.conf"
    sed -i "s/DOMAIN_PLACEHOLDER/$domain/g" "/tmp/$domain.conf"
    sed -i "s|SSL_CERT_PATH|$ssl_cert_path|g" "/tmp/$domain.conf"
    sed -i "s|SSL_KEY_PATH|$ssl_key_path|g" "/tmp/$domain.conf"

    # Install nginx configuration
    if sudo cp "/tmp/$domain.conf" "$nginx_config"; then
        sudo ln -sf "$nginx_config" "$nginx_enabled" 2>/dev/null

        # Test nginx configuration
        if sudo nginx -t 2>/dev/null; then
            sudo systemctl reload nginx
            echo -e "\033[32m�?Nginx configuration created and loaded\033[0m"

            if [ "$ssl_available" = true ]; then
                echo -e "\033[36m🔒 HTTPS: https://$domain\033[0m"
                echo -e "\033[36m📄 HTTP: http://$domain (redirects to HTTPS)\033[0m"
            else
                echo -e "\033[36m📄 HTTP: http://$domain\033[0m"
                echo -e "\033[33m💡 Tip: Install SSL certificate for HTTPS support\033[0m"
            fi
            echo -e "\033[90m📁 Config: $nginx_config\033[0m"
        else
            echo -e "\033[31m�?Nginx configuration test failed\033[0m"
            sudo rm -f "$nginx_config" "$nginx_enabled"
        fi
    else
        echo -e "\033[33m�?Could not create nginx configuration (permissions?)\033[0m"
    fi

    rm -f "/tmp/$domain.conf"

    # Show hosts file instruction
    echo ""
    echo -e "\033[36m=== Local Testing Setup ===\033[0m"
    echo -e "\033[33mAdd to your /etc/hosts file for local testing:\033[0m"
    echo -e "\033[90m127.0.0.1 $domain\033[0m"
    echo ""
    echo -e "\033[33mOr add to Windows hosts file (C:\\Windows\\System32\\drivers\\etc\\hosts):\033[0m"
    echo -e "\033[90m127.0.0.1 $domain\033[0m"
}

# Main service creation function - UNIFIED AND CLEANED
create_unified_service() {
    local app_name="$1"
    local app_path="$2"
    local app_type="$3"
    local framework_type="$4"
    local port="$5"
    local domain="$6"
    local debug_mode="$7"

    echo ""
    echo -e "\033[36m=== SystemD Service Creation ===\033[0m"
    echo -e "\033[33mApp Name:\033[0m $app_name"
    echo -e "\033[33mFramework:\033[0m $framework_type"

    # Use fixed port for app if no specific port provided
    if [ -z "$port" ] || [ "$port" = "auto" ]; then
        port=$(get_app_fixed_port "$app_name")
        echo -e "\033[33mAssigned Fixed Port:\033[0m $port (mapped to $app_name)"
    else
        echo -e "\033[33mSpecified Port:\033[0m $port"
    fi

    echo -e "\033[33mDomain:\033[0m $domain"
    echo -e "\033[33mMode:\033[0m $([ "$debug_mode" = "true" ] && echo "Debug (source)" || echo "Production (build)")"

    # Special handling for Laravel - use poly app deployment method
    # IMPORTANT: Laravel has ONLY ONE instance (laravel_main) with FIXED port 9000
    if [ "$framework_type" = "laravelStart" ]; then
        echo ""
        echo -e "\033[36m=== Laravel Service (Poly App Method) ===\033[0m"
        echo -e "\033[33mUsing unified Laravel service manager (poly app deployment)\033[0m"
        echo -e "\033[33mNOTE: Laravel has ONLY ONE instance (laravel_main) with FIXED port 9000\033[0m"
        
        local laravel_service_manager="$SERVICE_MANAGER_ROOT_DIR/scripts/unified_manager/modules/laravel_service_manager.sh"
        
        if [ ! -f "$laravel_service_manager" ]; then
            echo -e "\033[31mError: Laravel service manager not found: $laravel_service_manager\033[0m"
            return 1
        fi
        
        # Source the Laravel service manager (pass USE_SUDO if available)
        if [ -n "${USE_SUDO:-}" ]; then
            export USE_SUDO
        fi
        source "$laravel_service_manager"
        
        # Install Laravel service using poly app method
        if install_laravel_service "$app_name"; then
            echo -e "\033[32m✓ Laravel service installed successfully (poly app method)\033[0m"
            echo -e "\033[32m✓ Service name: octane-poly-9000 (FIXED port 9000)\033[0m"
            
            # If domain is provided, also add website configuration
            if [ -n "$domain" ]; then
                echo ""
                echo -e "\033[36m=== Adding Laravel Website Configuration ===\033[0m"
                if add_laravel_website "$domain" "auto"; then
                    echo -e "\033[32m✓ Laravel website added successfully: $domain\033[0m"
                else
                    echo -e "\033[33m⚠ Laravel website addition failed (service is still installed)\033[0m"
                fi
            fi
            
            return 0
        else
            echo -e "\033[31m✗ Laravel service installation failed\033[0m"
            return 1
        fi
    fi

    # Check if service already exists
    local service_name=""
    case "$framework_type" in
        "reactStart"|"vueStart")
            service_name="webapp-$app_name"
            ;;
        "nuxtStart")
            service_name="nuxt-$app_name"
            ;;
        "laravelStart")
            service_name="laravel-$app_name"
            ;;
        "flutterStart")
            service_name="flutter-$app_name"
            ;;
        "reactNativeStart")
            echo -e "\033[33mReact Native apps typically don't run as system services\033[0m"
            echo -e "\033[33mUse mobile development tools for deployment\033[0m"
            return 0
            ;;
        *)
            service_name="app-$app_name"
            ;;
    esac

    # Check if service already exists and handle it
    if systemctl list-unit-files "$service_name.service" >/dev/null 2>&1; then
        echo ""
        echo -e "\033[33m�?Service $service_name already exists\033[0m"
        echo -ne "\033[36mReplace existing service? (Y/n): \033[0m"
        read replace_choice

        if [[ ! "$replace_choice" =~ ^[Nn]$ ]]; then
            echo -e "\033[90mStopping existing service...\033[0m"
            sudo systemctl stop "$service_name" 2>/dev/null || true
            echo -e "\033[90mDisabling existing service...\033[0m"
            sudo systemctl disable "$service_name" 2>/dev/null || true
            echo -e "\033[90mRemoving existing service file...\033[0m"
            sudo rm -f "/etc/systemd/system/$service_name.service"
            sudo systemctl daemon-reload
            echo -e "\033[32m�?Existing service cleaned up\033[0m"
        else
            echo -e "\033[33mKeeping existing service, operation cancelled\033[0m"
            return 0
        fi
    fi

    # Auto-replace existing compiled services if in debug mode
    auto_replace_debug_service "$app_name" "$app_path" "$framework_type" "$port" "$domain" "$debug_mode"

    # Scan for daemon service
    local daemon_script_path=""
    daemon_script_path=$(scan_daemon_service "$app_path")

    # Clean up orphaned daemon service if daemon script no longer exists
    local daemon_service_name="webapp-${app_name}-daemon"
    if [ -z "$daemon_script_path" ] || [ ! -f "$daemon_script_path" ]; then
        if systemctl list-unit-files "$daemon_service_name.service" >/dev/null 2>&1; then
            echo ""
            echo -e "\033[33m⚠ Daemon script not found, but daemon service exists\033[0m"
            echo -e "\033[90mCleaning up orphaned daemon service: $daemon_service_name\033[0m"

            # Stop and remove orphaned daemon service
            if systemctl is-active "$daemon_service_name" >/dev/null 2>&1; then
                sudo systemctl stop "$daemon_service_name" 2>/dev/null || true
            fi

            if systemctl is-enabled "$daemon_service_name" >/dev/null 2>&1; then
                sudo systemctl disable "$daemon_service_name" 2>/dev/null || true
            fi

            sudo rm -f "/etc/systemd/system/$daemon_service_name.service"
            sudo systemctl daemon-reload

            echo -e "\033[32m✓ Orphaned daemon service removed\033[0m"
        fi
    fi

    # Generate launcher script using Python launcher generator FIRST
    echo ""
    echo -e "\033[36m=== Generating Launcher Script ===\033[0m"
    echo -e "\033[90mROOT_DIR: $ROOT_DIR\033[0m"

    local launcher_generator="$ROOT_DIR/scripts/unified_manager/core/launcher_generator.py"
    local launcher_script=""
    local working_dir="$app_path"

    # Check if launcher_generator exists
    if [ ! -f "$launcher_generator" ]; then
        echo -e "\033[31mLauncher generator not found: $launcher_generator\033[0m"
        return 1
    fi

    echo -e "\033[90mLauncher generator: $launcher_generator\033[0m"

    # Convert bash boolean to Python boolean
    local python_debug_mode="False"
    if [ "$debug_mode" = "true" ] || [ "$debug_mode" = "True" ]; then
        python_debug_mode="True"
    fi

    echo -e "\033[90mDebug mode (bash): $debug_mode -> Python: $python_debug_mode\033[0m"

    # Call Python launcher generator using python3 with proper PYTHONPATH
    # Use export to ensure PYTHONPATH is set in subshell
    export PYTHONPATH="$ROOT_DIR/scripts/unified_manager/core:$PYTHONPATH"
    launcher_script=$(python3 -c "
from launcher_generator import LauncherGenerator

generator = LauncherGenerator()
launcher_path = generator.generate_launcher(
    service_name='$service_name',
    app_path='$app_path',
    framework_type='$framework_type',
    port=$port,
    debug_mode=$python_debug_mode
)
print(launcher_path)
" 2>&1)

    local gen_result=$?

    if [ $gen_result -ne 0 ] || [ -z "$launcher_script" ]; then
        echo -e "\033[31mFailed to generate launcher script\033[0m"
        echo -e "\033[90mError output: $launcher_script\033[0m"
        return 1
    fi

    if [ ! -f "$launcher_script" ]; then
        echo -e "\033[31mLauncher script was not created: $launcher_script\033[0m"
        return 1
    fi

    echo -e "\033[32m�?Launcher script generated\033[0m"
    echo -e "\033[90mService Name: $service_name\033[0m"
    echo -e "\033[90mLauncher Script: $launcher_script\033[0m"
    echo ""

    # Display launcher script content
    echo -e "\033[36m=== Launcher Script Content ===\033[0m"
    echo -e "\033[90m$(cat "$launcher_script")\033[0m"
    echo ""

    # Service command points to launcher script
    local service_command="$launcher_script"

    # Create service using common service manager
    local service_description="$app_name ($framework_type) - Auto-generated by Unified Manager"

    echo -e "\033[33m=== Creating SystemD Service ===\033[0m"
    echo -e "\033[90mCalling create_systemd_service function...\033[0m"

    # Call the function from common service manager directly
    create_systemd_service "$service_name" "$service_description" "$service_command" "$working_dir" "root" "always" "5" "50%" "1G"
    local result=$?

    echo ""
    echo -e "\033[36m=== Service Creation Status ===\033[0m"
    if [ $result -eq 0 ]; then
        echo -e "\033[32m�?Service created successfully\033[0m"

        # Display service file content
        local service_file="/etc/systemd/system/$service_name.service"
        if [ -f "$service_file" ]; then
            echo ""
            echo -e "\033[36m=== Service Configuration ===\033[0m"
            echo -e "\033[33mFile: $service_file\033[0m"
            echo -e "\033[90m$(cat "$service_file")\033[0m"
        fi

        # Check service status
        echo ""
        echo -e "\033[36m=== Service Registration Check ===\033[0m"
        if systemctl list-unit-files "$service_name.service" >/dev/null 2>&1; then
            echo -e "\033[32m�?Service registered in systemd\033[0m"
        else
            echo -e "\033[31m�?Service not found in systemd\033[0m"
        fi

        # Add firewall rule for port
        if command -v firewall_allow_port >/dev/null 2>&1; then
            echo ""
            echo -e "\033[36m=== Configuring Firewall ===\033[0m"
            echo -e "\033[90mOpening port $port for $app_name service...\033[0m"
            firewall_allow_port "$port" "tcp" "$app_name service"
            echo -e "\033[32m�?Firewall rule configured\033[0m"
        else
            echo ""
            echo -e "\033[33m�?Firewall manager function not available\033[0m"
            echo -e "\033[90mManual firewall configuration may be required for port $port\033[0m"
        fi

        # Create nginx configuration if domain provided
        if [ -n "$domain" ]; then
            create_nginx_config "$app_name" "$domain" "$port"
        fi

        # Start the service
        echo ""
        echo -e "\033[36m=== Starting Service ===\033[0m"
        echo -e "\033[90mEnabling service...\033[0m"
        sudo systemctl enable "$service_name"

        echo -e "\033[90mStarting service...\033[0m"
        sudo systemctl start "$service_name"

        sleep 2

        # Check service status
        echo ""
        echo -e "\033[36m=== Service Status Check ===\033[0m"
        if systemctl is-active "$service_name" >/dev/null 2>&1; then
            echo -e "\033[32m�?Service is running\033[0m"
            local status_output=$(systemctl status "$service_name" --no-pager -l | head -10)
            echo -e "\033[90m$status_output\033[0m"
        else
            echo -e "\033[31m�?Service failed to start\033[0m"
            echo -e "\033[33mChecking logs...\033[0m"
            local error_logs=$(sudo journalctl -u "$service_name" --no-pager -l --since="1 minute ago" | tail -5)
            echo -e "\033[90m$error_logs\033[0m"
        fi

        echo ""
        echo -e "\033[36mService Management Commands:\033[0m"
        echo -e "  Start:   sudo systemctl start $service_name"
        echo -e "  Stop:    sudo systemctl stop $service_name"
        echo -e "  Status:  sudo systemctl status $service_name"
        echo -e "  Logs:    sudo journalctl -u $service_name -f"

        if [ -n "$domain" ]; then
            echo ""
            echo -e "\033[36m🌐 Domain Access: http://$domain\033[0m"
            echo -e "\033[36m🔗 Direct Access: http://localhost:$port\033[0m"
        else
            echo ""
            echo -e "\033[36mDirect Access: http://localhost:$port\033[0m"
        fi

        # Create daemon service if daemon script exists
        if [ -n "$daemon_script_path" ] && [ -f "$daemon_script_path" ]; then
            echo ""
            echo -e "\033[33m📦 Found daemon script: $(basename $daemon_script_path)\033[0m"
            create_daemon_service "$app_name" "$app_path" "$daemon_script_path" "$service_name" "50%" "1G" "$debug_mode"
        else
            echo ""
            echo -e "\033[90m💡 No daemon script found (checked: scripts/daemon.{sh,py,js})\033[0m"
        fi

        return 0
    else
        echo -e "\033[31m�?Failed to create service\033[0m"
        return 1
    fi
}