#!/bin/bash

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
            break
        fi
        ((port++))
    done
    [ "$port" -gt "$end_port" ] && port="$start_port"
    echo "$port"
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
    local location=""
    local daemon_script_path=""

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
            daemon_script_path="$location"
            break
        fi
    done
    echo "$daemon_script_path"
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
        echo -e "\033[33m[WARN] Daemon service already exists: $daemon_service_name\033[0m"
        echo -e "\033[90mRemoving existing daemon service for rebuild...\033[0m"

        remove_systemd_service "$daemon_service_name"
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
    local daemon_launcher_script=""
    daemon_launcher_script=$(python3 -c "
from launcher_generator import LauncherGenerator

generator = LauncherGenerator()
launcher_path = generator.generate_daemon_launcher(
    service_name='$daemon_service_name',
    daemon_script_path='$daemon_script_path',
    app_path='$app_path',
    debug_mode=$python_debug_mode
)
print(launcher_path)
" 2>&1 || true)

    if [ -z "$daemon_launcher_script" ] || [ ! -f "$daemon_launcher_script" ]; then
        echo -e "\033[31m[ERROR] Failed to generate daemon launcher script\033[0m"
        echo -e "\033[90mError: $daemon_launcher_script\033[0m"
        return
    fi

    echo -e "\033[32m[OK] Daemon launcher script generated\033[0m"
    echo -e "\033[90m$daemon_launcher_script\033[0m"

    # Fix permissions for daemon access using permissions_fixer_lib
    echo ""
    fix_permissions_build_dir
    echo ""
    fix_permissions_app_dir "$app_name"
    echo ""

    local daemon_description="$app_name daemon service - Auto-generated by Unified Manager"
    local daemon_command="$daemon_launcher_script"
    local working_dir="$app_path"

    echo -e "\033[90mCreating daemon systemd service...\033[0m"
    create_systemd_service "$daemon_service_name" "$daemon_description" "$daemon_command" "$working_dir" "root" "always" "5" "$daemon_cpu" "$daemon_memory" "" "" "yes" "" "" "$main_service_name.service" "yes"

    if [ "$SYSTEMD_SERVICE_FILE_READY" = true ]; then
        echo -e "\033[32m[OK] Daemon service file created\033[0m"

        echo -e "\033[90mEnabling daemon service...\033[0m"
        $USE_SUDO systemctl enable "$daemon_service_name"

        echo -e "\033[90mStarting daemon service...\033[0m"
        $USE_SUDO systemctl start "$daemon_service_name"

        sleep 1

        # Check daemon service status
        if systemctl is-active "$daemon_service_name" >/dev/null 2>&1; then
            echo -e "\033[32m[OK] Daemon service is running\033[0m"
            local daemon_status=$(systemctl status "$daemon_service_name" --no-pager -l | head -8)
            echo -e "\033[90m$daemon_status\033[0m"

            echo ""
            echo -e "\033[36m=== Daemon Service Management ===\033[0m"
            echo -e "  Status:  sudo systemctl status $daemon_service_name"
            echo -e "  Logs:    sudo journalctl -u $daemon_service_name -f"
            echo -e "  Stop:    sudo systemctl stop $daemon_service_name"
            echo -e "  Restart: sudo systemctl restart $daemon_service_name"
        else
            echo -e "\033[31m[ERROR] Daemon service failed to start\033[0m"
            local daemon_logs=$($USE_SUDO journalctl -u "$daemon_service_name" --no-pager -l --since="1 minute ago" | tail -10)
            echo -e "\033[90m$daemon_logs\033[0m"
            echo ""
            echo -e "\033[33m Check daemon script: $daemon_script_path\033[0m"
        fi

    else
        echo -e "\033[31m[ERROR] Failed to create daemon service file\033[0m"
    fi
}
