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
                command="$(get_py_start_command "$app_path")"
                working_dir="$app_path"
                ;;
            "flutterStart")
                command="$(get_flutter_start_command "$app_path")"
                working_dir="$app_path"
                ;;
            "laravelStart")
                command="$(get_laravel_start_command "$app_path")"
                working_dir="$app_path"
                ;;
            "nuxtStart")
                command="$(get_nuxt_start_command "$app_path")"
                working_dir="$app_path"
                ;;
            "reactNativeStart")
                command="$(get_react_native_start_command "$app_path")"
                working_dir="$app_path"
                ;;
            "vueStart")
                command="$(get_vue_start_command "$app_path")"
                working_dir="$app_path"
                ;;
            "reactStart")
                command="$(get_react_start_command "$app_path")"
                working_dir="$app_path"
                ;;
            "kotlinMultiPlatformStart")
                command="$(get_kotlin_multiplatform_start_command "$app_path")"
                working_dir="$app_path"
                ;;
            "phpStart")
                command="$(get_php_start_command "$app_path")"
                working_dir="$app_path"
                ;;
        esac

        if [ -n "$command" ]; then
            echo -e "\033[90mWorking Directory: $working_dir\033[0m"
            echo -e "\033[90mCommand: $command\033[0m"
            echo ""
            read -p "Press any key to continue, or 'n' to cancel..." -n 1 -r
            echo ""

            if [[ $REPLY =~ ^[Nn]$ ]]; then
                echo -e "\033[33mLaunch cancelled\033[0m"
                sleep 1
                return
            fi

            # Create temporary shell script
            local clean_script_name="${current_script//[\/\\:*?\"<>|]/_}"
            local temp_script="$TEMP_SCRIPT_DIR/${app_name}_${clean_script_name}.sh"

            if [ $needs_install -eq 1 ]; then
                # Use the standalone installer script for Ncore/Pycore/Installer
                if [ "$current_script" = "Ncore/Pycore/Installer" ]; then
                    local installer_script="$ROOT_DIR/scripts/unified_manager/ncore_pycore_installer.sh"
                    cat > "$temp_script" << EOF
#!/bin/bash
echo "Launching unified installer..."
bash "$installer_script" "$app_name" "$app_type" "$command" "$working_dir" "$ROOT_DIR"
EOF
                fi
            else
                # No installation needed
                cat > "$temp_script" << EOF
#!/bin/bash
cd "$working_dir"
echo "Starting $app_name with $current_script..."
echo "Working Directory: \$(pwd)"
echo ""
$command
read -p "Press Enter to exit..."
EOF
            fi

            chmod +x "$temp_script"

            echo -e "\033[32mLaunching $app_name...\033[0m"

            # Launch in new terminal
            if command -v gnome-terminal &> /dev/null; then
                gnome-terminal -- bash -c "$temp_script"
            elif command -v xterm &> /dev/null; then
                xterm -e "bash $temp_script" &
            else
                bash "$temp_script"
            fi

            sleep 1
        else
            echo -e "\033[31mFailed to generate startup command\033[0m"
            read -p "Press Enter to continue..."
        fi
    else
        # Script-based startup
        local script_path="$app_path/scripts/$current_script"

        if [ -f "$script_path" ]; then
            echo -e "\033[90mScript Path: $script_path\033[0m"
            echo ""
            read -p "Press any key to continue, or 'n' to cancel..." -n 1 -r
            echo ""

            if [[ $REPLY =~ ^[Nn]$ ]]; then
                echo -e "\033[33mLaunch cancelled\033[0m"
                sleep 1
                return
            fi

            echo -e "\033[32mLaunching $app_name with $current_script...\033[0m"

            # Launch script
            if command -v gnome-terminal &> /dev/null; then
                gnome-terminal -- bash -c "bash '$script_path'; read -p 'Press Enter to exit...'"
            elif command -v xterm &> /dev/null; then
                xterm -e "bash '$script_path'; read -p 'Press Enter to exit...'" &
            else
                bash "$script_path"
            fi

            sleep 1
        else
            echo -e "\033[31mScript not found: $script_path\033[0m"
            read -p "Press Enter to continue..."
        fi
    fi
}