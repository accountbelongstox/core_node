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
                echo -e "\033[32m✓ package.json found\033[0m"
                if grep -q '"react"' "$app_path/package.json" 2>/dev/null; then
                    echo -e "  \033[90m→ React dependency detected\033[0m"
                fi
                if grep -q '"vue"' "$app_path/package.json" 2>/dev/null; then
                    echo -e "  \033[90m→ Vue dependency detected\033[0m"
                fi
                if grep -q '"nuxt"' "$app_path/package.json" 2>/dev/null; then
                    echo -e "  \033[90m→ Nuxt dependency detected\033[0m"
                fi
                if grep -q '"react-native"' "$app_path/package.json" 2>/dev/null; then
                    echo -e "  \033[90m→ React Native dependency detected\033[0m"
                fi

                echo -e "  \033[90mAvailable scripts:\033[0m"
                if grep -q '"start"' "$app_path/package.json" 2>/dev/null; then
                    echo -e "    \033[90m• start\033[0m"
                fi
                if grep -q '"dev"' "$app_path/package.json" 2>/dev/null; then
                    echo -e "    \033[90m• dev\033[0m"
                fi
                if grep -q '"build"' "$app_path/package.json" 2>/dev/null; then
                    echo -e "    \033[90m• build\033[0m"
                fi
                if grep -q '"serve"' "$app_path/package.json" 2>/dev/null; then
                    echo -e "    \033[90m• serve\033[0m"
                fi
            fi

            if [ -f "$app_path/vite.config.ts" ]; then
                echo -e "\033[32m✓ vite.config.ts found\033[0m"
            elif [ -f "$app_path/vite.config.js" ]; then
                echo -e "\033[32m✓ vite.config.js found\033[0m"
            fi

            if [ -f "$app_path/tsconfig.json" ]; then
                echo -e "\033[32m✓ tsconfig.json found (TypeScript)\033[0m"
            fi

            if [ -f "$app_path/composer.json" ]; then
                echo -e "\033[32m✓ composer.json found (PHP/Laravel)\033[0m"
            fi

            if [ -f "$app_path/artisan" ]; then
                echo -e "\033[32m✓ artisan found (Laravel)\033[0m"
            fi

            if [ -f "$app_path/pubspec.yaml" ]; then
                echo -e "\033[32m✓ pubspec.yaml found (Flutter)\033[0m"
            fi

            if [ -f "$app_path/nuxt.config.ts" ]; then
                echo -e "\033[32m✓ nuxt.config.ts found\033[0m"
            elif [ -f "$app_path/nuxt.config.js" ]; then
                echo -e "\033[32m✓ nuxt.config.js found\033[0m"
            fi

            if [ -d "$app_path/node_modules" ]; then
                echo -e "\033[32m✓ node_modules exists\033[0m"
            else
                echo -e "\033[33m⚠ node_modules missing (will install)\033[0m"
            fi

            echo -e "\033[36m========================================\033[0m"
            echo ""

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
echo ""
echo "Process completed."
EOF
            fi

            chmod +x "$temp_script"

            echo -e "\033[32mLaunching $app_name...\033[0m"

            # Run in current terminal instead of new terminal
            bash "$temp_script"

            # Wait for user input after execution
            echo ""
            echo -e "\033[36mApplication finished. Press any key to return to menu...\033[0m"
            read -n 1 -r
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

            # Run script in current terminal
            bash "$script_path"

            # Wait for user input after script execution
            echo ""
            echo -e "\033[36mScript finished. Press any key to return to menu...\033[0m"
            read -n 1 -r
        else
            echo -e "\033[31mScript not found: $script_path\033[0m"
            read -p "Press Enter to continue..."
        fi
    fi
}