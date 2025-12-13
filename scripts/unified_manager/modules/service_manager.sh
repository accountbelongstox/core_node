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

# Service Manager Module
# Provides systemd service creation and nginx reverse proxy for unified manager

# Service creation for poly apps
create_systemd_service() {
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
    echo -e "\033[33mPort:\033[0m $port"
    echo -e "\033[33mDomain:\033[0m $domain"
    echo -e "\033[33mMode:\033[0m $([ "$debug_mode" = "true" ] && echo "Debug (source)" || echo "Production (build)")"

    # Find Laravel service manager
    local laravel_path="$ROOT_DIR/poly_apps/laravel_main"
    if [ ! -d "$laravel_path" ]; then
        echo -e "\033[31mError: Laravel service manager not found at $laravel_path\033[0m"
        return 1
    fi

    # Create service based on framework type
    case "$framework_type" in
        "reactStart"|"vueStart")
            create_web_framework_service "$app_name" "$app_path" "$port" "$domain" "$debug_mode" "$laravel_path"
            ;;
        "nuxtStart")
            create_nuxt_service "$app_name" "$app_path" "$port" "$domain" "$debug_mode" "$laravel_path"
            ;;
        "laravelStart")
            create_laravel_service "$app_name" "$app_path" "$port" "$domain" "$debug_mode" "$laravel_path"
            ;;
        "reactNativeStart")
            echo -e "\033[33mReact Native apps typically don't run as system services\033[0m"
            echo -e "\033[33mUse mobile development tools for deployment\033[0m"
            return 0
            ;;
        "flutterStart")
            create_flutter_web_service "$app_name" "$app_path" "$port" "$domain" "$debug_mode" "$laravel_path"
            ;;
        *)
            echo -e "\033[33mGeneric service creation for $framework_type\033[0m"
            create_generic_service "$app_name" "$app_path" "$port" "$domain" "$debug_mode" "$laravel_path"
            ;;
    esac
}

# Create Nuxt service using existing Laravel command
create_nuxt_service() {
    local app_name="$1"
    local app_path="$2"
    local port="$3"
    local domain="$4"
    local debug_mode="$5"
    local laravel_path="$6"

    echo -e "\033[32mCreating Nuxt service...\033[0m"

    cd "$laravel_path"
    local cmd="php artisan servermanager:nuxt add $app_name --port=$port --domain=$domain"
    if [ "$debug_mode" = "true" ]; then
        cmd="$cmd --debug"
    fi

    echo -e "\033[90m$cmd\033[0m"
    $cmd
}

# Create React/Vue service
create_web_framework_service() {
    local app_name="$1"
    local app_path="$2"
    local port="$3"
    local domain="$4"
    local debug_mode="$5"
    local laravel_path="$6"

    echo -e "\033[32mCreating web framework service...\033[0m"

    # Create systemd service file
    local service_name="webapp-$app_name"
    local service_file="/etc/systemd/system/$service_name.service"

    # Generate service content
    local exec_start
    if [ "$debug_mode" = "true" ]; then
        exec_start="$ROOT_DIR/scripts/unified_manager/launchers/react_launcher.sh \"$app_path\" \"$app_name\" start"
    else
        exec_start="bash -c 'cd \"$app_path\" && pnpm run build && pnpm run start'"
    fi

    echo -e "\033[90mCreating service file: $service_file\033[0m"

    # Create service file content
    cat > "/tmp/$service_name.service" << EOF
[Unit]
Description=$app_name Web Framework Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$app_path
ExecStart=$exec_start
Restart=always
RestartSec=5
Environment=PORT=$port
Environment=HOST=0.0.0.0
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    # Install service file
    if sudo cp "/tmp/$service_name.service" "$service_file"; then
        echo -e "\033[32m✓ Service file created\033[0m"
        sudo systemctl daemon-reload

        # Create nginx configuration if domain provided
        if [ -n "$domain" ]; then
            create_nginx_config "$app_name" "$domain" "$port"
        fi

        echo ""
        echo -e "\033[36mService Management Commands:\033[0m"
        echo -e "  Start:   sudo systemctl start $service_name"
        echo -e "  Stop:    sudo systemctl stop $service_name"
        echo -e "  Status:  sudo systemctl status $service_name"
        echo -e "  Enable:  sudo systemctl enable $service_name"
        echo -e "  Logs:    sudo journalctl -u $service_name -f"

    else
        echo -e "\033[31m✗ Failed to create service file\033[0m"
        return 1
    fi

    rm -f "/tmp/$service_name.service"
}

# Create Laravel service
create_laravel_service() {
    local app_name="$1"
    local app_path="$2"
    local port="$3"
    local domain="$4"
    local debug_mode="$5"
    local laravel_path="$6"

    echo -e "\033[32mCreating Laravel service...\033[0m"

    cd "$laravel_path"
    local cmd="php artisan servermanager:octane add $app_name --port=$port --domain=$domain"
    if [ "$debug_mode" = "true" ]; then
        cmd="$cmd --debug"
    fi

    echo -e "\033[90m$cmd\033[0m"
    $cmd 2>/dev/null || {
        echo -e "\033[33mLaravel Octane service not available, creating generic Laravel service\033[0m"
        create_generic_laravel_service "$app_name" "$app_path" "$port" "$domain" "$debug_mode"
    }
}

# Create generic Laravel service without Octane
create_generic_laravel_service() {
    local app_name="$1"
    local app_path="$2"
    local port="$3"
    local domain="$4"
    local debug_mode="$5"

    local service_name="laravel-$app_name"
    local service_file="/etc/systemd/system/$service_name.service"

    local exec_start
    if [ "$debug_mode" = "true" ]; then
        exec_start="bash -c 'cd \"$app_path\" && php artisan serve --host=0.0.0.0 --port=$port'"
    else
        exec_start="bash -c 'cd \"$app_path\" && php artisan serve --host=0.0.0.0 --port=$port --env=production'"
    fi

    cat > "/tmp/$service_name.service" << EOF
[Unit]
Description=$app_name Laravel Service
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=$app_path
ExecStart=$exec_start
Restart=always
RestartSec=5
Environment=APP_ENV=$([ "$debug_mode" = "true" ] && echo "local" || echo "production")
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    if sudo cp "/tmp/$service_name.service" "$service_file"; then
        echo -e "\033[32m✓ Laravel service created\033[0m"
        sudo systemctl daemon-reload

        if [ -n "$domain" ]; then
            create_nginx_config "$app_name" "$domain" "$port"
        fi

        echo ""
        echo -e "\033[36mLaravel Service Management:\033[0m"
        echo -e "  Start:   sudo systemctl start $service_name"
        echo -e "  Stop:    sudo systemctl stop $service_name"
        echo -e "  Status:  sudo systemctl status $service_name"
        echo -e "  Logs:    sudo journalctl -u $service_name -f"
    fi

    rm -f "/tmp/$service_name.service"
}

# Create Flutter web service
create_flutter_web_service() {
    local app_name="$1"
    local app_path="$2"
    local port="$3"
    local domain="$4"
    local debug_mode="$5"
    local laravel_path="$6"

    echo -e "\033[32mCreating Flutter web service...\033[0m"

    local service_name="flutter-$app_name"
    local service_file="/etc/systemd/system/$service_name.service"

    local exec_start
    if [ "$debug_mode" = "true" ]; then
        exec_start="bash -c 'cd \"$app_path\" && flutter run -d web-server --web-hostname=0.0.0.0 --web-port=$port'"
    else
        exec_start="bash -c 'cd \"$app_path\" && flutter build web && python3 -m http.server $port --bind 0.0.0.0 --directory build/web'"
    fi

    cat > "/tmp/$service_name.service" << EOF
[Unit]
Description=$app_name Flutter Web Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$app_path
ExecStart=$exec_start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    if sudo cp "/tmp/$service_name.service" "$service_file"; then
        echo -e "\033[32m✓ Flutter service created\033[0m"
        sudo systemctl daemon-reload

        if [ -n "$domain" ]; then
            create_nginx_config "$app_name" "$domain" "$port"
        fi
    fi

    rm -f "/tmp/$service_name.service"
}

# Create generic service for unknown frameworks
create_generic_service() {
    local app_name="$1"
    local app_path="$2"
    local port="$3"
    local domain="$4"
    local debug_mode="$5"
    local laravel_path="$6"

    echo -e "\033[33mCreating generic application service...\033[0m"

    local service_name="app-$app_name"
    local service_file="/etc/systemd/system/$service_name.service"

    # Try to detect package.json scripts
    local exec_start=""
    if [ -f "$app_path/package.json" ]; then
        if grep -q '"dev"' "$app_path/package.json" 2>/dev/null; then
            exec_start="bash -c 'cd \"$app_path\" && HOST=0.0.0.0 PORT=$port pnpm run dev'"
        elif grep -q '"start"' "$app_path/package.json" 2>/dev/null; then
            exec_start="bash -c 'cd \"$app_path\" && HOST=0.0.0.0 PORT=$port pnpm start'"
        fi
    fi

    if [ -z "$exec_start" ]; then
        echo -e "\033[33mNo suitable start command found, creating placeholder service\033[0m"
        exec_start="bash -c 'echo \"Service for $app_name not configured\" && sleep 3600'"
    fi

    cat > "/tmp/$service_name.service" << EOF
[Unit]
Description=$app_name Generic Application Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$app_path
ExecStart=$exec_start
Restart=always
RestartSec=5
Environment=PORT=$port
Environment=HOST=0.0.0.0
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    if sudo cp "/tmp/$service_name.service" "$service_file"; then
        echo -e "\033[32m✓ Generic service created\033[0m"
        sudo systemctl daemon-reload

        if [ -n "$domain" ]; then
            create_nginx_config "$app_name" "$domain" "$port"
        fi
    fi

    rm -f "/tmp/$service_name.service"
}

# Create nginx reverse proxy configuration
create_nginx_config() {
    local app_name="$1"
    local domain="$2"
    local port="$3"

    echo -e "\033[32mCreating nginx reverse proxy...\033[0m"

    local nginx_config="/etc/nginx/sites-available/$domain"
    local nginx_enabled="/etc/nginx/sites-enabled/$domain"

    cat > "/tmp/$domain.conf" << EOF
server {
    listen 80;
    server_name $domain;

    location / {
        proxy_pass http://127.0.0.1:$port;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        # Increase timeout for dev servers
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
}
EOF

    if sudo cp "/tmp/$domain.conf" "$nginx_config"; then
        sudo ln -sf "$nginx_config" "$nginx_enabled" 2>/dev/null
        sudo nginx -t && sudo systemctl reload nginx

        echo -e "\033[32m✓ Nginx configuration created\033[0m"
        echo -e "\033[36mDomain: http://$domain\033[0m"
        echo -e "\033[90mConfig: $nginx_config\033[0m"
    else
        echo -e "\033[33mWarning: Could not create nginx configuration (permissions?)\033[0m"
    fi

    rm -f "/tmp/$domain.conf"
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

# Check if service should run in debug mode
should_use_debug_mode() {
    local app_path="$1"
    local framework_type="$2"

    # Check if this is development environment
    if [ -f "$app_path/.env" ] && grep -q "APP_ENV=local\|NODE_ENV=development" "$app_path/.env" 2>/dev/null; then
        echo "true"
        return 0
    fi

    # Check for development indicators
    if [ -f "$app_path/vite.config.js" ] || [ -f "$app_path/vite.config.ts" ]; then
        echo "true"
        return 0
    fi

    if [ -f "$app_path/package.json" ] && grep -q '"dev"' "$app_path/package.json" 2>/dev/null; then
        echo "true"
        return 0
    fi

    echo "false"
}