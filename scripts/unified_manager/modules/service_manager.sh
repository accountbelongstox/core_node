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
NGINX_MANAGER_PATH="$SERVICE_MANAGER_DIR/../../shells/linux/common/nginx_manager.sh"
UNIFIED_DAEMON_SERVICE_PATH="$SERVICE_MANAGER_DIR/unified_daemon_service.sh"

# Source all required files (trust-based coding)
source "$GVAR_COMMON_PATH"
source "$GET_REAL_USER_PATH"
source "$CORE_LIB_PATH"
source "$DEBIAN_SERVICE_MANAGER_PATH"
source "$FIREWALL_MANAGER_PATH"
source "$PERMISSIONS_FIXER_PATH"
source "$NGINX_MANAGER_PATH"
source "$UNIFIED_DAEMON_SERVICE_PATH"

# Restore and export ROOT_DIR after sourcing (prevent overwrite)
ROOT_DIR="$SERVICE_MANAGER_ROOT_DIR"


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

    if systemctl list-unit-files "$daemon_service_name.service" >/dev/null 2>&1; then
        echo ""
        echo -e "\033[33m--- Deleting Daemon Service ---\033[0m"
        echo -e "\033[90mService: $daemon_service_name\033[0m"

        remove_systemd_service "$daemon_service_name"
        [ "$SYSTEMD_OPERATION_READY" = true ] && services_deleted=$((services_deleted + 1))
    fi

    # Delete main service
    if systemctl list-unit-files "$main_service_name.service" >/dev/null 2>&1; then
        echo ""
        echo -e "\033[33m--- Deleting Main Service ---\033[0m"
        echo -e "\033[90mService: $main_service_name\033[0m"

        remove_systemd_service "$main_service_name"
        [ "$SYSTEMD_OPERATION_READY" = true ] && services_deleted=$((services_deleted + 1))
    fi

    # Reload systemd if any service was deleted
    if [ $services_deleted -gt 0 ]; then
        echo ""
        echo -e "\033[32m[OK] Total services deleted: $services_deleted\033[0m"
    else
        echo ""
        echo -e "\033[33m[WARN] No services found for $app_name\033[0m"
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
        return
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
        return
    fi

    echo -e "\033[33mFound existing compiled services:\033[0m"
    for service in "${found_services[@]}"; do
        echo -e "  \033[90m$service.service\033[0m"
    done

    # Automatically stop and replace with debug version
    echo -e "\033[32mStopping compiled services and replacing with debug version...\033[0m"

    for service in "${found_services[@]}"; do
        if systemctl is-active "$service" >/dev/null 2>&1; then
            echo -e "\033[90mStopping $service.service...\033[0m"
            $USE_SUDO systemctl stop "$service"
        fi

        if systemctl is-enabled "$service" >/dev/null 2>&1; then
            echo -e "\033[90mDisabling $service.service...\033[0m"
            $USE_SUDO systemctl disable "$service"
        fi
    done

    echo -e "\033[32mCompiled services stopped\033[0m"
    echo -e "\033[32mCreating debug service replacement...\033[0m"

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

    # Special handling for Laravel - use unified laravel_service_manager.sh
    # Laravel projects get dedicated ports starting from 9000 (sorted alphabetically)
    if [ "$framework_type" = "laravelStart" ]; then
        echo ""
        echo -e "\033[36m=== Laravel Service (Unified Manager) ===\033[0m"
        echo -e "\033[33mUsing unified Laravel service manager (start_service.sh -> Octane)\033[0m"
        
        local laravel_service_manager="$SERVICE_MANAGER_ROOT_DIR/scripts/unified_manager/modules/laravel_service_manager.sh"
        
        source "$laravel_service_manager"
        
        # Install Laravel service using poly app method
        install_laravel_service "$app_name"
        if [ "$LARAVEL_SERVICE_READY" = true ]; then
            echo -e "\033[32m[OK] Laravel service installed successfully (poly app method)\033[0m"
            local _lport
            _lport=$(get_laravel_port "$app_name" 2>/dev/null || echo "9000")
            echo -e "\033[32m[OK] Service name: app-manager-$app_name (port $_lport)\033[0m"

            # If domain is provided, also add website configuration
            if [ -n "$domain" ]; then
                echo ""
                echo -e "\033[36m=== Adding Laravel Website Configuration ===\033[0m"
                add_laravel_website "$app_name" "$domain" "auto"
                if [ "$LARAVEL_WEBSITE_READY" = true ]; then
                    echo -e "\033[32m[OK] Laravel website added successfully: $domain\033[0m"
                else
                    echo -e "\033[33m[WARN] Laravel website addition failed (service is still installed)\033[0m"
                fi
            fi
            
        else
            echo -e "\033[31m[ERROR] Laravel service installation failed\033[0m"
        fi
        return
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
            return
            ;;
        *)
            service_name="app-$app_name"
            ;;
    esac

    # Check if service already exists and handle it
    if systemctl list-unit-files "$service_name.service" >/dev/null 2>&1; then
        echo ""
        echo -e "\033[33mService $service_name already exists\033[0m"
        echo -ne "\033[36mReplace existing service? (Y/n): \033[0m"
        read replace_choice

        if [[ ! "$replace_choice" =~ ^[Nn]$ ]]; then
            echo -e "\033[90mStopping existing service...\033[0m"
            remove_systemd_service "$service_name"
            echo -e "\033[32mExisting service cleaned up\033[0m"
        else
            echo -e "\033[33mKeeping existing service, operation cancelled\033[0m"
            return
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
            echo -e "\033[33m[WARN] Daemon script not found, but daemon service exists\033[0m"
            echo -e "\033[90mCleaning up orphaned daemon service: $daemon_service_name\033[0m"

            remove_systemd_service "$daemon_service_name"
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
        return
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
" 2>&1 || true)

    if [ -z "$launcher_script" ]; then
        echo -e "\033[31mFailed to generate launcher script\033[0m"
        echo -e "\033[90mError output: $launcher_script\033[0m"
        return
    fi

    if [ ! -f "$launcher_script" ]; then
        echo -e "\033[31mLauncher script was not created: $launcher_script\033[0m"
        return
    fi

    echo -e "\033[32mLauncher script generated\033[0m"
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

    echo ""
    echo -e "\033[36m=== Service Creation Status ===\033[0m"
    if [ "$SYSTEMD_SERVICE_FILE_READY" = true ]; then
        echo -e "\033[32mService created successfully\033[0m"

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
            echo -e "\033[32mService registered in systemd\033[0m"
        else
            echo -e "\033[31mService not found in systemd\033[0m"
        fi

        # Add firewall rule for port
        if command -v firewall_allow_port >/dev/null 2>&1; then
            echo ""
            echo -e "\033[36m=== Configuring Firewall ===\033[0m"
            echo -e "\033[90mOpening port $port for $app_name service...\033[0m"
            firewall_allow_port "$port" "tcp" "$app_name service"
            echo -e "\033[32mFirewall rule configured\033[0m"
        else
            echo ""
            echo -e "\033[33mFirewall manager function not available\033[0m"
            echo -e "\033[90mManual firewall configuration may be required for port $port\033[0m"
        fi

        # Create nginx configuration if domain provided
        if [ -n "$domain" ]; then
            nm_site_add "$domain" "proxy" "http://127.0.0.1:$port" "$domain"
        fi

        # Start the service
        echo ""
        echo -e "\033[36m=== Starting Service ===\033[0m"
        echo -e "\033[90mEnabling service...\033[0m"
        $USE_SUDO systemctl enable "$service_name"

        echo -e "\033[90mStarting service...\033[0m"
        $USE_SUDO systemctl start "$service_name"

        sleep 2

        # Check service status
        echo ""
        echo -e "\033[36m=== Service Status Check ===\033[0m"
        if systemctl is-active "$service_name" >/dev/null 2>&1; then
            echo -e "\033[32mService is running\033[0m"
            local status_output=$(systemctl status "$service_name" --no-pager -l | head -10)
            echo -e "\033[90m$status_output\033[0m"
        else
            echo -e "\033[31mService failed to start\033[0m"
            echo -e "\033[33mChecking logs...\033[0m"
            local error_logs=$($USE_SUDO journalctl -u "$service_name" --no-pager -l --since="1 minute ago" | tail -5)
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
            echo -e "\033[36m Domain Access: http://$domain\033[0m"
            echo -e "\033[36m Direct Access: http://localhost:$port\033[0m"
        else
            echo ""
            echo -e "\033[36mDirect Access: http://localhost:$port\033[0m"
        fi

        # Create daemon service if daemon script exists
        if [ -n "$daemon_script_path" ] && [ -f "$daemon_script_path" ]; then
            echo ""
            echo -e "\033[33m Found daemon script: $(basename $daemon_script_path)\033[0m"
            create_daemon_service "$app_name" "$app_path" "$daemon_script_path" "$service_name" "50%" "1G" "$debug_mode"
        else
            echo ""
            echo -e "\033[90m No daemon script found (checked: scripts/daemon.{sh,py,js})\033[0m"
        fi

    else
        echo -e "\033[31mFailed to create service\033[0m"
    fi
}
