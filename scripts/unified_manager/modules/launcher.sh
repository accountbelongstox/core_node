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

# App Launcher Module
# Provides app launching functions for unified manager

# Show service installation options for current app
show_service_installation_options() {
    local app_name="$1"
    local app_path="$2"
    local app_type="$3"
    local current_script="$4"
    local working_dir="$5"
    local command="$6"

    echo -e "\033[36m=== Installation Options ================\033[0m"
    echo -e "\033[33m1)\033[0m Just run temporarily (development mode)"
    echo -e "\033[33m2)\033[0m Install as system service"
    echo -e "\033[33m3)\033[0m Install as system service + Laravel reverse proxy (with domain)"
    echo -e "\033[33m4)\033[0m Back to main menu"
    echo ""
    echo -ne "\033[36mSelect installation option (1-4): \033[0m"

    while true; do
        read -n 1 -r option
        echo ""

        case "$option" in
            "1")
                echo -e "\033[32mRunning temporarily in development mode...\033[0m"
                run_app_temporarily "$app_name" "$app_path" "$current_script" "$working_dir" "$command"
                return 0
                ;;
            "2")
                echo -e "\033[32mInstalling as system service...\033[0m"
                install_as_system_service "$app_name" "$app_path" "$app_type" "$current_script"
                return 0
                ;;
            "3")
                echo -e "\033[32mInstalling as system service with Laravel reverse proxy...\033[0m"
                install_with_laravel_proxy "$app_name" "$app_path" "$app_type" "$current_script"
                return 0
                ;;
            "4")
                echo -e "\033[33mReturning to main menu...\033[0m"
                return 0
                ;;
            *)
                echo -e "\033[31mInvalid option. Please select 1-4.\033[0m"
                echo -ne "\033[36mSelect installation option (1-4): \033[0m"
                ;;
        esac
    done
}

# Run app temporarily without installing as service
run_app_temporarily() {
    local app_name="$1"
    local app_path="$2"
    local current_script="$3"
    local working_dir="$4"
    local command="$5"

    echo ""
    echo -e "\033[90mWorking Directory: $working_dir\033[0m"
    echo -e "\033[90mCommand: $command\033[0m"
    echo ""

    # Check if this is a persistent development server
    local is_persistent_service=0
    case "$current_script" in
        "reactStart"|"vueStart"|"nuxtStart"|"laravelStart"|"flutterStart")
            is_persistent_service=1
            ;;
    esac

    # Create temporary shell script
    local clean_script_name="${current_script//[\/\\:*?\"<>|]/_}"
    local temp_script="$TEMP_SCRIPT_DIR/${app_name}_${clean_script_name}.sh"

    if [ $is_persistent_service -eq 1 ]; then
        # For persistent development servers, run directly without wrapper
        cat > "$temp_script" << EOF
#!/bin/bash
cd "$working_dir"
echo -e "\033[33m=== Development Server Starting ===\033[0m"
echo -e "\033[33mApp: $app_name\033[0m"
echo -e "\033[33mMode: $current_script\033[0m"
echo -e "\033[33mWorking Directory: \$(pwd)\033[0m"
echo -e "\033[33mPress Ctrl+C to stop the server\033[0m"
echo ""
exec $command
EOF
    else
        # For one-time commands, use wrapper
        cat > "$temp_script" << EOF
#!/bin/bash
cd "$working_dir"
echo "Starting $app_name with $current_script..."
echo "Working Directory: \$(pwd)"
echo ""
$command
echo ""
echo "Process completed."
EOF
    fi

    chmod +x "$temp_script"

    echo -e "\033[32mLaunching $app_name...\033[0m"

    # Run in current terminal
    bash "$temp_script"

    # Only wait for user input if it was not a persistent service
    if [ $is_persistent_service -eq 0 ]; then
        echo ""
        echo -e "\033[36mApplication finished. Press any key to return to menu...\033[0m"
        read -n 1 -r
    else
        echo ""
        echo -e "\033[36mDevelopment server stopped. Press any key to return to menu...\033[0m"
        read -n 1 -r
    fi
}

# Install app as system service
install_as_system_service() {
    local app_name="$1"
    local app_path="$2"
    local app_type="$3"
    local current_script="$4"

    echo ""
    echo -e "\033[36m=== System Service Installation ===\033[0m"

    # Get port input
    local default_port=$(get_available_port)
    echo -ne "\033[33mPort (press Enter for auto-assigned port $default_port): \033[0m"
    read port_input
    local port="${port_input:-$default_port}"

    # Auto-detect debug mode
    local debug_mode=$(should_use_debug_mode "$app_path" "$current_script")

    echo ""
    echo -e "\033[33mInstalling system service without reverse proxy...\033[0m"

    # Create the service
    create_systemd_service "$app_name" "$app_path" "$app_type" "$current_script" "$port" "" "$debug_mode"
    local result=$?

    if [ $result -eq 0 ]; then
        echo ""
        echo -e "\033[32mâœ?System service installation completed!\033[0m"
        echo -e "\033[36mService: ${current_script%Start}-$app_name.service\033[0m"
        echo -e "\033[36mPort: $port\033[0m"
        echo ""
        echo -e "\033[33mService Management Commands:\033[0m"
        echo -e "  Start:   sudo systemctl start ${current_script%Start}-$app_name"
        echo -e "  Stop:    sudo systemctl stop ${current_script%Start}-$app_name"
        echo -e "  Status:  sudo systemctl status ${current_script%Start}-$app_name"
        echo -e "  Enable:  sudo systemctl enable ${current_script%Start}-$app_name"
        echo -e "  Logs:    sudo journalctl -u ${current_script%Start}-$app_name -f"
        echo ""
        echo -e "\033[36mDirect access: http://localhost:$port\033[0m"
    else
        echo -e "\033[31mâœ?System service installation failed\033[0m"
    fi

    echo ""
    echo -e "\033[33mPress any key to continue...\033[0m"
    read -n 1
}

# Install app with Laravel reverse proxy
install_with_laravel_proxy() {
    local app_name="$1"
    local app_path="$2"
    local app_type="$3"
    local current_script="$4"

    echo ""
    echo -e "\033[36m=== Laravel Reverse Proxy Installation ===\033[0m"

    # Get domain input
    echo -ne "\033[33mDomain (e.g., $app_name.local): \033[0m"
    read domain_input
    if [ -z "$domain_input" ]; then
        echo -e "\033[31mDomain is required for reverse proxy setup\033[0m"
        echo -e "\033[33mPress any key to continue...\033[0m"
        read -n 1
        return 1
    fi
    local domain="$domain_input"

    # Get port input
    local default_port=$(get_available_port)
    echo -ne "\033[33mPort (press Enter for auto-assigned port $default_port): \033[0m"
    read port_input
    local port="${port_input:-$default_port}"

    # Auto-detect debug mode
    local debug_mode=$(should_use_debug_mode "$app_path" "$current_script")

    echo ""
    echo -e "\033[33mInstalling system service with Laravel reverse proxy...\033[0m"
    echo -e "\033[33mDomain: $domain\033[0m"
    echo -e "\033[33mPort: $port\033[0m"

    # Create the service with Laravel integration
    if [ "$current_script" = "nuxtStart" ]; then
        # Use Laravel servermanager:nuxt command for Nuxt apps
        echo -e "\033[32mUsing Laravel Nuxt service manager...\033[0m"
        create_nuxt_service "$app_name" "$app_path" "$port" "$domain" "$debug_mode" "$ROOT_DIR/poly_apps/laravel_main"
    else
        # Create systemd service and nginx reverse proxy
        create_systemd_service "$app_name" "$app_path" "$app_type" "$current_script" "$port" "$domain" "$debug_mode"
    fi

    local result=$?

    if [ $result -eq 0 ]; then
        echo ""
        echo -e "\033[32mâœ?Laravel reverse proxy installation completed!\033[0m"
        echo -e "\033[36mService: ${current_script%Start}-$app_name.service\033[0m"
        echo -e "\033[36mDomain: http://$domain\033[0m"
        echo -e "\033[36mPort: $port\033[0m"
        echo ""
        echo -e "\033[33mService Management Commands:\033[0m"
        echo -e "  Start:   sudo systemctl start ${current_script%Start}-$app_name"
        echo -e "  Stop:    sudo systemctl stop ${current_script%Start}-$app_name"
        echo -e "  Status:  sudo systemctl status ${current_script%Start}-$app_name"
        echo -e "  Enable:  sudo systemctl enable ${current_script%Start}-$app_name"
        echo -e "  Logs:    sudo journalctl -u ${current_script%Start}-$app_name -f"
        echo ""
        echo -e "\033[36mðŸŒ Domain Access: http://$domain\033[0m"
        echo -e "\033[36mðŸ”— Direct Access: http://localhost:$port\033[0m"
        echo ""
        echo -e "\033[33mAdd to your /etc/hosts file for local testing:\033[0m"
        echo -e "\033[90m127.0.0.1 $domain\033[0m"
    else
        echo -e "\033[31mâœ?Laravel reverse proxy installation failed\033[0m"
    fi

    echo ""
    echo -e "\033[33mPress any key to continue...\033[0m"
    read -n 1
}

# Launch current app
launch_current_app() {
    local app_name="${APPS_NAME[$CURRENT_INDEX]}"
    local app_path="${APPS_PATH[$CURRENT_INDEX]}"
    local app_type="${APPS_TYPE[$CURRENT_INDEX]}"
    local current_script="${APPS_CURRENT_SCRIPT[$CURRENT_INDEX]}"

    if [ -z "$current_script" ] || [ "$current_script" = "None" ]; then
        echo -e "\033[31mNo startup script configured for $app_name\033[0m"
        read -p "Press Enter to continue..."
        return
    fi

    # Show launch details
    echo ""
    echo -e "\033[33m=== Launch Details ===\033[0m"
    echo -e "App Name: \033[37m$app_name\033[0m"
    echo -e "App Type: \033[37m$app_type\033[0m"
    echo -e "Startup Mode: \033[36m$current_script\033[0m"
    echo ""

    # Check if native startup
    local is_native=0
    for native in "${NATIVE_STARTUPS[@]}"; do
        if [ "$current_script" = "$native" ]; then
            is_native=1
            break
        fi
    done

    if [ $is_native -eq 1 ]; then
        # Native startup
        local command=""
        local working_dir=""
        local needs_install=0

        case "$current_script" in
            "Ncore/Pycore/Installer")
                command="$(get_unified_installer_command "$app_path" "$app_type")"
                working_dir="$ROOT_DIR"
                needs_install=1
                ;;
            "polyLauncher")
                local poly_launcher="$ROOT_DIR/poly_apps/poly_launcher.sh"
                command="bash \"$poly_launcher\" $app_name start"
                working_dir="$ROOT_DIR"
                ;;
            "pyStart")
                local launcher_script="$ROOT_DIR/scripts/unified_manager/launchers/python_launcher.sh"
                command="bash \"$launcher_script\" \"$app_path\" \"$app_name\" start"
                working_dir="$app_path"
                ;;
            "flutterStart")
                local launcher_script="$ROOT_DIR/scripts/unified_manager/launchers/flutter_launcher.sh"
                command="bash \"$launcher_script\" \"$app_path\" \"$app_name\" start"
                working_dir="$app_path"
                ;;
            "laravelStart")
                local launcher_script="$ROOT_DIR/scripts/unified_manager/launchers/laravel_launcher.sh"
                command="bash \"$launcher_script\" \"$app_path\" \"$app_name\" start"
                working_dir="$app_path"
                ;;
            "nuxtStart")
                local launcher_script="$ROOT_DIR/scripts/unified_manager/launchers/nuxt_launcher.sh"
                command="bash \"$launcher_script\" \"$app_path\" \"$app_name\" start"
                working_dir="$app_path"
                ;;
            "reactNativeStart")
                local launcher_script="$ROOT_DIR/scripts/unified_manager/launchers/react_native_launcher.sh"
                command="bash \"$launcher_script\" \"$app_path\" \"$app_name\" start"
                working_dir="$app_path"
                ;;
            "vueStart")
                local launcher_script="$ROOT_DIR/scripts/unified_manager/launchers/vue_launcher.sh"
                command="bash \"$launcher_script\" \"$app_path\" \"$app_name\" start"
                working_dir="$app_path"
                ;;
            "reactStart")
                local launcher_script="$ROOT_DIR/scripts/unified_manager/launchers/react_launcher.sh"
                command="bash \"$launcher_script\" \"$app_path\" \"$app_name\" start"
                working_dir="$app_path"
                ;;
            "kotlinMultiPlatformStart")
                local launcher_script="$ROOT_DIR/scripts/unified_manager/launchers/kotlin_multiplatform_launcher.sh"
                command="bash \"$launcher_script\" \"$app_path\" \"$app_name\" start"
                working_dir="$app_path"
                ;;
            "phpStart")
                local launcher_script="$ROOT_DIR/scripts/unified_manager/launchers/php_launcher.sh"
                command="bash \"$launcher_script\" \"$app_path\" \"$app_name\" start"
                working_dir="$app_path"
                ;;
        esac

        if [ -n "$command" ]; then
            echo ""
            echo -e "\033[36m=== Project Analysis ====================\033[0m"
            echo -e "\033[33mApp Name:\033[0m $app_name"
            echo -e "\033[33mApp Type:\033[0m $app_type"
            echo -e "\033[33mApp Path:\033[0m $app_path"
            echo -e "\033[33mStartup Mode:\033[0m $current_script"

            # Show launcher script path for framework-specific starters
            case "$current_script" in
                "reactStart")
                    local launcher_script="$ROOT_DIR/scripts/unified_manager/launchers/react_launcher.sh"
                    echo -e "\033[33mLauncher Script:\033[0m $launcher_script"
                    ;;
                "vueStart")
                    local launcher_script="$ROOT_DIR/scripts/unified_manager/launchers/vue_launcher.sh"
                    echo -e "\033[33mLauncher Script:\033[0m $launcher_script"
                    ;;
                "nuxtStart")
                    local launcher_script="$ROOT_DIR/scripts/unified_manager/launchers/nuxt_launcher.sh"
                    echo -e "\033[33mLauncher Script:\033[0m $launcher_script"
                    ;;
                "laravelStart")
                    local launcher_script="$ROOT_DIR/scripts/unified_manager/launchers/laravel_launcher.sh"
                    echo -e "\033[33mLauncher Script:\033[0m $launcher_script"
                    ;;
                "flutterStart")
                    local launcher_script="$ROOT_DIR/scripts/unified_manager/launchers/flutter_launcher.sh"
                    echo -e "\033[33mLauncher Script:\033[0m $launcher_script"
                    ;;
                "reactNativeStart")
                    local launcher_script="$ROOT_DIR/scripts/unified_manager/launchers/react_native_launcher.sh"
                    echo -e "\033[33mLauncher Script:\033[0m $launcher_script"
                    ;;
                "kotlinMultiPlatformStart")
                    local launcher_script="$ROOT_DIR/scripts/unified_manager/launchers/kotlin_multiplatform_launcher.sh"
                    echo -e "\033[33mLauncher Script:\033[0m $launcher_script"
                    ;;
                "phpStart")
                    local launcher_script="$ROOT_DIR/scripts/unified_manager/launchers/php_launcher.sh"
                    echo -e "\033[33mLauncher Script:\033[0m $launcher_script"
                    ;;
            esac

            echo -e "\033[33mWorking Directory:\033[0m $working_dir"
            echo -e "\033[33mGenerated Command:\033[0m $command"

            # Show project files detected
            echo ""
            echo -e "\033[36m=== Project Files Detected ==============\033[0m"
            if [ -f "$app_path/package.json" ]; then
                echo -e "\033[32mâœ?package.json found\033[0m"
                if grep -q '"react"' "$app_path/package.json" 2>/dev/null; then
                    echo -e "  \033[90mâ†?React dependency detected\033[0m"
                fi
                if grep -q '"vue"' "$app_path/package.json" 2>/dev/null; then
                    echo -e "  \033[90mâ†?Vue dependency detected\033[0m"
                fi
                if grep -q '"nuxt"' "$app_path/package.json" 2>/dev/null; then
                    echo -e "  \033[90mâ†?Nuxt dependency detected\033[0m"
                fi
                if grep -q '"react-native"' "$app_path/package.json" 2>/dev/null; then
                    echo -e "  \033[90mâ†?React Native dependency detected\033[0m"
                fi

                echo -e "  \033[90mAvailable scripts:\033[0m"
                if grep -q '"start"' "$app_path/package.json" 2>/dev/null; then
                    echo -e "    \033[90mâ€?start\033[0m"
                fi
                if grep -q '"dev"' "$app_path/package.json" 2>/dev/null; then
                    echo -e "    \033[90mâ€?dev\033[0m"
                fi
                if grep -q '"build"' "$app_path/package.json" 2>/dev/null; then
                    echo -e "    \033[90mâ€?build\033[0m"
                fi
                if grep -q '"serve"' "$app_path/package.json" 2>/dev/null; then
                    echo -e "    \033[90mâ€?serve\033[0m"
                fi
            fi

            if [ -f "$app_path/vite.config.ts" ]; then
                echo -e "\033[32mâœ?vite.config.ts found\033[0m"
            elif [ -f "$app_path/vite.config.js" ]; then
                echo -e "\033[32mâœ?vite.config.js found\033[0m"
            fi

            if [ -f "$app_path/tsconfig.json" ]; then
                echo -e "\033[32mâœ?tsconfig.json found (TypeScript)\033[0m"
            fi

            if [ -f "$app_path/composer.json" ]; then
                echo -e "\033[32mâœ?composer.json found (PHP/Laravel)\033[0m"
            fi

            if [ -f "$app_path/artisan" ]; then
                echo -e "\033[32mâœ?artisan found (Laravel)\033[0m"
            fi

            if [ -f "$app_path/pubspec.yaml" ]; then
                echo -e "\033[32mâœ?pubspec.yaml found (Flutter)\033[0m"
            fi

            if [ -f "$app_path/nuxt.config.ts" ]; then
                echo -e "\033[32mâœ?nuxt.config.ts found\033[0m"
            elif [ -f "$app_path/nuxt.config.js" ]; then
                echo -e "\033[32mâœ?nuxt.config.js found\033[0m"
            fi

            if [ -d "$app_path/node_modules" ]; then
                echo -e "\033[32mâœ?node_modules exists\033[0m"
            else
                echo -e "\033[33mâš?node_modules missing (will install)\033[0m"
            fi

            echo -e "\033[36m========================================\033[0m"
            echo ""

            # Show installation and service options
            show_service_installation_options "$app_name" "$app_path" "$app_type" "$current_script" "$working_dir" "$command"
        else
            echo -e "\033[31mFailed to generate startup command\033[0m"
            read -p "Press Enter to continue..."
        fi
    else
        # Script-based startup
        local script_path="$app_path/scripts/$current_script"

        if [ -f "$script_path" ]; then
            echo ""
            echo -e "\033[36m=== Script Execution =====================\033[0m"
            echo -e "\033[33mScript Path:\033[0m $script_path"
            echo ""
            echo -e "\033[33mScript Execution Options:\033[0m"
            echo -e "\033[33m1)\033[0m Run script directly"
            echo -e "\033[33m2)\033[0m Back to main menu"
            echo ""
            echo -ne "\033[36mSelect option (1-2): \033[0m"

            while true; do
                read -n 1 -r option
                echo ""

                case "$option" in
                    "1")
                        echo -e "\033[32mExecuting script...\033[0m"
                        echo ""

                        # Run script in current terminal
                        bash "$script_path"

                        # Wait for user input after script execution
                        echo ""
                        echo -e "\033[36mScript finished. Press any key to return to menu...\033[0m"
                        read -n 1 -r
                        return 0
                        ;;
                    "2")
                        echo -e "\033[33mReturning to main menu...\033[0m"
                        return 0
                        ;;
                    *)
                        echo -e "\033[31mInvalid option. Please select 1 or 2.\033[0m"
                        echo -ne "\033[36mSelect option (1-2): \033[0m"
                        ;;
                esac
            done
        else
            echo -e "\033[31mScript not found: $script_path\033[0m"
            read -p "Press Enter to continue..."
        fi
    fi
}