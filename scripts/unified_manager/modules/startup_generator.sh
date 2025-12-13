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

# Startup Generation Module
# Provides startup command generation for unified manager

# Step 4: Generate native startup commands
step4_generate_native_startup() {
    local app_list=("$@")

    echo -e "\033[36mStep 4: Generating native startup commands...\033[0m" >&2

    for app_data in "${app_list[@]}"; do
        IFS='|' read -r app_name app_path app_type <<< "$app_data"

        local available_scripts=()
        local current_script=""
        local script_index=0
        local found_native=0

        # Check native files
        read -r has_main_py has_main_js has_pubspec has_composer has_nuxt_config has_index_php has_package_json has_gradle <<< "$(check_native_files "$app_path")"

        # Priority 1: Add Ncore/Pycore/Installer for both ncoreApp and pycoreApp
        if [ "$app_type" = "ncoreApp" ] || [ "$app_type" = "pycoreApp" ]; then
            local unified_cmd="$(get_unified_installer_command "$app_path" "$app_type")"
            if [ -n "$unified_cmd" ]; then
                available_scripts+=("Ncore/Pycore/Installer")
                current_script="Ncore/Pycore/Installer"
                script_index=0
                found_native=1
                echo -e "  \033[35m$app_name: Ncore/Pycore/Installer (unified) - $unified_cmd\033[0m" >&2
            fi
        fi

        # Priority 2: Framework-specific starts for poly_apps
        if [ "$app_type" = "poly_apps" ]; then
            # Use unified poly launcher for all poly_apps
            local poly_launcher="$SCRIPT_PATH/../../poly_apps/poly_launcher.sh"
            if [ -f "$poly_launcher" ]; then
                available_scripts+=("polyLauncher")
                current_script="polyLauncher"
                script_index=0
                found_native=1
                echo -e "  \033[35m$app_name: polyLauncher - bash \"$poly_launcher\" $app_name start\033[0m" >&2
            else
                # Fallback to individual framework detection
                # Flutter
                if [ "$has_pubspec" -eq 1 ]; then
                    local cmd="$(get_flutter_start_command "$app_path")"
                    if [ -n "$cmd" ]; then
                        if [ "$found_native" -eq 0 ]; then
                            available_scripts+=("flutterStart")
                            current_script="flutterStart"
                            script_index=0
                            found_native=1
                        else
                            available_scripts+=("flutterStart")
                        fi
                        echo -e "  \033[35m$app_name: flutterStart - $cmd\033[0m" >&2
                    fi
                fi

                # Laravel
                if [ "$has_composer" -eq 1 ] && [ -f "$app_path/public/index.php" ]; then
                    local cmd="$(get_laravel_start_command "$app_path")"
                    if [ -n "$cmd" ]; then
                        if [ "$found_native" -eq 0 ]; then
                            available_scripts+=("laravelStart")
                            current_script="laravelStart"
                            script_index=0
                            found_native=1
                        else
                            available_scripts+=("laravelStart")
                        fi
                        echo -e "  \033[35m$app_name: laravelStart - $cmd\033[0m" >&2
                    fi
                fi

                # Nuxt
                if [ "$has_nuxt_config" -eq 1 ]; then
                    local cmd="$(get_nuxt_start_command "$app_path")"
                    if [ -n "$cmd" ]; then
                        if [ "$found_native" -eq 0 ]; then
                            available_scripts+=("nuxtStart")
                            current_script="nuxtStart"
                            script_index=0
                            found_native=1
                        else
                            available_scripts+=("nuxtStart")
                        fi
                        echo -e "  \033[35m$app_name: nuxtStart - $cmd\033[0m" >&2
                    fi
                fi

                # Other frameworks...
                # (Keep existing framework detection as fallback)
            fi
        fi

        # Priority 3: pyStart for main.py (for general Python apps in poly_apps)
        if [ "$has_main_py" -eq 1 ] && [ "$app_type" = "poly_apps" ] && [ "$found_native" -eq 0 ]; then
            local cmd="$(get_py_start_command "$app_path")"
            if [ -n "$cmd" ]; then
                available_scripts+=("pyStart")
                current_script="pyStart"
                script_index=0
                found_native=1
                echo -e "  \033[35m$app_name: pyStart - $cmd\033[0m" >&2
            fi
        fi

        # Output: name|path|type|scripts|current|index
        local scripts_str="$(IFS=','; echo "${available_scripts[*]}")"
        echo "$app_name|$app_path|$app_type|$scripts_str|$current_script|$script_index"
    done
}