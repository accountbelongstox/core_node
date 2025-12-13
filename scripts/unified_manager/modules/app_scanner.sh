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

# App Scanning Module
# Provides app scanning functions for unified manager

# Step 1: Scan ncoreApps
step1_scan_ncore_apps() {
    echo -e "\033[36mStep 1: Scanning $NCORE_APPS directory...\033[0m" >&2

    local ncore_apps=()

    if [ -d "$NCORE_APPS" ]; then
        for dir in "$NCORE_APPS"/*; do
            if [ -d "$dir" ]; then
                local app_name="$(basename "$dir")"
                ncore_apps+=("$app_name|$dir|ncoreApp")
                echo -e "  \033[90mFound: $app_name [ncoreApp]\033[0m" >&2
            fi
        done
        echo -e "  \033[32mTotal ncoreApps: ${#ncore_apps[@]}\033[0m" >&2
    else
        echo -e "  \033[31mDirectory not found: $NCORE_APPS\033[0m" >&2
    fi

    # Return array as string (newline separated)
    printf '%s\n' "${ncore_apps[@]}"
}

# Step 2: Scan pycore apps
step2_scan_pycore_apps() {
    echo -e "\033[36mStep 2: Scanning $PYCORE_APPS directory...\033[0m" >&2

    local pycore_apps=()

    if [ -d "$PYCORE_APPS" ]; then
        for dir in "$PYCORE_APPS"/*; do
            if [ -d "$dir" ]; then
                local app_name="$(basename "$dir")"

                # Skip hidden and system directories
                if [[ "$app_name" == .* ]] || [[ "$app_name" == __* ]]; then
                    continue
                fi

                # Check if it has a valid entry point (main.py or {appname}_main.py)
                local main_py="$dir/main.py"
                local app_main_py="$dir/${app_name}_main.py"

                if [ -f "$main_py" ] || [ -f "$app_main_py" ]; then
                    pycore_apps+=("$app_name|$dir|pycoreApp")
                    echo -e "  \033[90mFound: $app_name [pycoreApp]\033[0m" >&2
                else
                    echo -e "  \033[90mSkipped: $app_name (no valid entry point)\033[0m" >&2
                fi
            fi
        done
        echo -e "  \033[32mTotal pycoreApps: ${#pycore_apps[@]}\033[0m" >&2
    else
        echo -e "  \033[31mDirectory not found: $PYCORE_APPS\033[0m" >&2
    fi

    printf '%s\n' "${pycore_apps[@]}"
}

# Step 3: Scan poly_apps
step3_scan_poly_apps() {
    echo -e "\033[36mStep 3: Scanning $POLY_APPS directory...\033[0m" >&2

    local poly_apps=()

    if [ -d "$POLY_APPS" ]; then
        for dir in "$POLY_APPS"/*; do
            if [ -d "$dir" ]; then
                local app_name="$(basename "$dir")"
                # Skip scripts directory
                if [ "$app_name" != "scripts" ]; then
                    poly_apps+=("$app_name|$dir|poly_apps")
                    echo -e "  \033[90mFound: $app_name [poly_apps]\033[0m" >&2
                fi
            fi
        done
        echo -e "  \033[32mTotal poly_apps: ${#poly_apps[@]}\033[0m" >&2
    else
        echo -e "  \033[31mDirectory not found: $POLY_APPS\033[0m" >&2
    fi

    printf '%s\n' "${poly_apps[@]}"
}

# Step 5: Scan scripts directory
step5_scan_scripts_directory() {
    local app_list=("$@")

    echo -e "\033[36mStep 5: Scanning scripts directories...\033[0m" >&2

    for app_data in "${app_list[@]}"; do
        IFS='|' read -r app_name app_path app_type scripts_str current_script script_index <<< "$app_data"

        local scripts_path="$app_path/scripts"
        local found_scripts=()

        if [ -d "$scripts_path" ]; then
            # Add standard script files
            for script_file in "${SCRIPT_FILES[@]}"; do
                if [ -f "$scripts_path/$script_file" ]; then
                    found_scripts+=("$script_file")
                fi
            done

            # Detect OS and scan for OS-specific scripts
            local os_type=""
            if [[ "$OSTYPE" == "linux-gnu"* ]]; then
                os_type="linux"
            elif [[ "$OSTYPE" == "darwin"* ]]; then
                os_type="macos"
            elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
                os_type="windows"
            else
                os_type="linux"  # Default fallback
            fi

            # Scan for all executable scripts in the scripts directory
            if command -v find >/dev/null 2>&1; then
                while IFS= read -r -d '' script_file; do
                    local basename_script=$(basename "$script_file")
                    # Skip if already in found_scripts
                    local skip=false
                    for existing in "${found_scripts[@]}"; do
                        if [ "$existing" = "$basename_script" ]; then
                            skip=true
                            break
                        fi
                    done

                    if [ "$skip" = false ]; then
                        # Filter by OS type
                        case "$os_type" in
                            "linux"|"macos")
                                if [[ "$basename_script" == *.sh ]] || [[ "$basename_script" == *.py ]]; then
                                    found_scripts+=("$basename_script")
                                fi
                                ;;
                            "windows")
                                if [[ "$basename_script" == *.bat ]] || [[ "$basename_script" == *.ps1 ]] || [[ "$basename_script" == *.cmd ]]; then
                                    found_scripts+=("$basename_script")
                                fi
                                ;;
                        esac
                    fi
                done < <(find "$scripts_path" -maxdepth 1 -type f -executable -print0 2>/dev/null)
            fi

            if [ ${#found_scripts[@]} -gt 0 ]; then
                echo -e "  \033[90m$app_name: ${found_scripts[*]}\033[0m" >&2
            fi
        fi

        # Merge scripts - add found scripts to existing scripts
        if [ -n "$scripts_str" ]; then
            if [ ${#found_scripts[@]} -gt 0 ]; then
                # Add found scripts to existing scripts
                for script in "${found_scripts[@]}"; do
                    # Check if script already exists
                    if [[ ! "$scripts_str" =~ $script ]]; then
                        scripts_str="$scripts_str,$script"
                    fi
                done
            fi
        else
            scripts_str="$(IFS=','; echo "${found_scripts[*]}")"
        fi

        # Set default if no scripts
        if [ -z "$scripts_str" ]; then
            current_script="None"
            script_index=0
        else
            # Always parse the scripts string and set the first one as current
            IFS=',' read -ra all_scripts <<< "$scripts_str"

            # Check if current_script is already set and is in the available scripts
            if [ -n "$current_script" ] && [ "$current_script" != "None" ]; then
                local found=false
                for i in "${!all_scripts[@]}"; do
                    if [ "${all_scripts[$i]}" = "$current_script" ]; then
                        script_index=$i
                        found=true
                        break
                    fi
                done
                if [ "$found" = false ]; then
                    # If current_script is not in the list, use the first one
                    current_script="${all_scripts[0]}"
                    script_index=0
                fi
            else
                # Use the first script
                current_script="${all_scripts[0]}"
                script_index=0
            fi
        fi

        echo "$app_name|$app_path|$app_type|$scripts_str|$current_script|$script_index"
    done
}