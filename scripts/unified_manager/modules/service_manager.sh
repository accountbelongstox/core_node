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

# Get script directory and root directory
# IMPORTANT: When sourced, use ROOT_DIR from parent if available
if [ -z "$ROOT_DIR" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
    echo -e "\033[33m[service_manager.sh] ROOT_DIR not set, calculated: $ROOT_DIR\033[0m" >&2
else
    echo -e "\033[32m[service_manager.sh] Using ROOT_DIR from parent: $ROOT_DIR\033[0m" >&2
fi

# Save ROOT_DIR before sourcing core_lib (which may reset it)
SAVED_ROOT_DIR="$ROOT_DIR"

# Source core library
CORE_LIB="$ROOT_DIR/scripts/unified_manager/lib/core_lib.sh"
if [ -f "$CORE_LIB" ]; then
    source "$CORE_LIB"
else
    echo -e "\033[31m[service_manager.sh] Core library not found: $CORE_LIB\033[0m" >&2
fi

# Restore ROOT_DIR after sourcing
ROOT_DIR="$SAVED_ROOT_DIR"
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
        echo -e "  \033[90m‚Ä?$service.service\033[0m"
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

    echo -e "\033[32m‚ú?Compiled services stopped\033[0m"
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
        echo -e "\033[32m‚ú?SSL certificate found for $domain\033[0m"
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
            echo -e "\033[32m‚ú?Nginx configuration created and loaded\033[0m"

            if [ "$ssl_available" = true ]; then
                echo -e "\033[36müîí HTTPS: https://$domain\033[0m"
                echo -e "\033[36müìÑ HTTP: http://$domain (redirects to HTTPS)\033[0m"
            else
                echo -e "\033[36müìÑ HTTP: http://$domain\033[0m"
                echo -e "\033[33müí° Tip: Install SSL certificate for HTTPS support\033[0m"
            fi
            echo -e "\033[90müìÅ Config: $nginx_config\033[0m"
        else
            echo -e "\033[31m‚ú?Nginx configuration test failed\033[0m"
            sudo rm -f "$nginx_config" "$nginx_enabled"
        fi
    else
        echo -e "\033[33m‚ö?Could not create nginx configuration (permissions?)\033[0m"
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
        echo -e "\033[33m‚ö?Service $service_name already exists\033[0m"
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
            echo -e "\033[32m‚ú?Existing service cleaned up\033[0m"
        else
            echo -e "\033[33mKeeping existing service, operation cancelled\033[0m"
            return 0
        fi
    fi

    # Auto-replace existing compiled services if in debug mode
    auto_replace_debug_service "$app_name" "$app_path" "$framework_type" "$port" "$domain" "$debug_mode"

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

    echo -e "\033[32m‚ú?Launcher script generated\033[0m"
    echo -e "\033[90mService Name: $service_name\033[0m"
    echo -e "\033[90mLauncher Script: $launcher_script\033[0m"
    echo ""

    # Display launcher script content
    echo -e "\033[36m=== Launcher Script Content ===\033[0m"
    echo -e "\033[90m$(cat "$launcher_script")\033[0m"
    echo ""

    # Service command points to launcher script
    local service_command="$launcher_script"

    # Source common service manager
    local common_service_manager="$ROOT_DIR/scripts/shells/linux/common/debian_service_manager.sh"
    if [ ! -f "$common_service_manager" ]; then
        echo -e "\033[31mError: Common service manager not found at $common_service_manager\033[0m"
        return 1
    fi
    source "$common_service_manager"

    # Source firewall manager
    local firewall_manager="$ROOT_DIR/scripts/shells/linux/common/firewall_manager.sh"
    if [ -f "$firewall_manager" ]; then
        source "$firewall_manager"
        echo -e "\033[32mFirewall manager loaded\033[0m"
    fi

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
        echo -e "\033[32m‚ú?Service created successfully\033[0m"

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
            echo -e "\033[32m‚ú?Service registered in systemd\033[0m"
        else
            echo -e "\033[31m‚ú?Service not found in systemd\033[0m"
        fi

        # Add firewall rule for port
        if command -v firewall_allow_port >/dev/null 2>&1; then
            echo ""
            echo -e "\033[36m=== Configuring Firewall ===\033[0m"
            echo -e "\033[90mOpening port $port for $app_name service...\033[0m"
            firewall_allow_port "$port" "tcp" "$app_name service"
            echo -e "\033[32m‚ú?Firewall rule configured\033[0m"
        else
            echo ""
            echo -e "\033[33m‚ö?Firewall manager function not available\033[0m"
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
            echo -e "\033[32m‚ú?Service is running\033[0m"
            local status_output=$(systemctl status "$service_name" --no-pager -l | head -10)
            echo -e "\033[90m$status_output\033[0m"
        else
            echo -e "\033[31m‚ú?Service failed to start\033[0m"
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
            echo -e "\033[36müåê Domain Access: http://$domain\033[0m"
            echo -e "\033[36müîó Direct Access: http://localhost:$port\033[0m"
        else
            echo ""
            echo -e "\033[36mDirect Access: http://localhost:$port\033[0m"
        fi

        return 0
    else
        echo -e "\033[31m‚ú?Failed to create service\033[0m"
        return 1
    fi
}