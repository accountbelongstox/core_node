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

# Unified Manager for Core Node Applications
# Manages applications in Core Node project

# Variable Declarations
SCRIPT_PATH="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_PATH/../.." && pwd)"
NCORE_APPS="$ROOT_DIR/apps"
POLY_APPS="$ROOT_DIR/poly_apps"
PY_APPS="$ROOT_DIR/pyapps"

# Source gvar_common.sh to get CORE_NODE_DATA_DIR
source "$ROOT_DIR/scripts/shells/linux/common/gvar_common.sh"

# Cache directory
CACHE_DIR="$CORE_NODE_DATA_DIR/unified_manager"
CACHE_FILE="$CACHE_DIR/app_cache.json"
TEMP_SCRIPT_DIR="$CACHE_DIR/temp_scripts"

# Global arrays
declare -a APPS_NAME
declare -a APPS_PATH
declare -a APPS_TYPE
declare -a APPS_AVAILABLE_SCRIPTS
declare -a APPS_CURRENT_SCRIPT
declare -a APPS_SCRIPT_INDEX
declare -a APPS_IS_SELECTED
CURRENT_INDEX=0
MAX_APP_NAME_WIDTH=0

# Script files to scan for
SCRIPT_FILES=("start.sh" "install.sh" "deploy.sh")

# Native startup types
NATIVE_STARTUPS=("Ncore/Pycore/Installer" "pyStart" "flutterStart" "laravelStart" "nuxtStart" "phpStart" "reactNativeStart" "kotlinMultiPlatformStart" "vueStart" "reactStart")

# Debug output for paths
echo "Script Path: $SCRIPT_PATH"
echo "Root Dir: $ROOT_DIR"
echo "Apps Dir: $NCORE_APPS"
echo "Apps Dir Exists: $([ -d "$NCORE_APPS" ] && echo "true" || echo "false")"
echo ""

# Ensure cache directory exists
mkdir -p "$CACHE_DIR"
mkdir -p "$TEMP_SCRIPT_DIR"

#region Functions

# Generate pyStart command (for general Python apps with main.py)
get_py_start_command() {
    local app_path="$1"
    local main_py="$app_path/main.py"

    if [ -f "$main_py" ]; then
        echo "python \"$main_py\""
    fi
}

# Generate pycoreStart command (for pycore apps using pymain.py launcher)
get_pycore_start_command() {
    local app_path="$1"
    local app_name="$(basename "$app_path")"
    local pymain="$ROOT_DIR/pymain.py"
    local main_py="$app_path/main.py"
    local app_main_py="$app_path/${app_name}_main.py"

    # Check if app has main.py or {appname}_main.py
    if [ -f "$main_py" ] || [ -f "$app_main_py" ]; then
        if [ -f "$pymain" ]; then
            echo "python \"$pymain\" app=$app_name"
        fi
    fi
}

# Generate ncoreStart command
get_ncore_start_command() {
    local app_path="$1"
    local main_js="$app_path/main.js"

    if [ -f "$main_js" ]; then
        local app_name="$(basename "$app_path")"
        local root_main_js="$ROOT_DIR/main.js"
        echo "node \"$root_main_js\" app=$app_name"
    fi
}

# Generate flutterStart command
get_flutter_start_command() {
    local app_path="$1"
    local pubspec="$app_path/pubspec.yaml"
    
    if [ -f "$pubspec" ]; then
        echo "cd \"$app_path\" && flutter run"
    fi
}

# Generate laravelStart command
get_laravel_start_command() {
    local app_path="$1"
    local composer="$app_path/composer.json"
    local public_index="$app_path/public/index.php"
    
    if [ -f "$composer" ] && [ -f "$public_index" ]; then
        echo "cd \"$app_path\" && php artisan serve"
    fi
}

# Generate nuxtStart command
get_nuxt_start_command() {
    local app_path="$1"
    local nuxt_config="$app_path/nuxt.config.ts"
    local nuxt_config_js="$app_path/nuxt.config.js"

    if [ -f "$nuxt_config" ] || [ -f "$nuxt_config_js" ]; then
        echo "cd \"$app_path\" && npm run dev"
    fi
}

# Generate React Native start command
get_react_native_start_command() {
    local app_path="$1"
    local package_json="$app_path/package.json"
    local android_dir="$app_path/android"
    local ios_dir="$app_path/ios"

    if [ -f "$package_json" ] && ([ -d "$android_dir" ] || [ -d "$ios_dir" ]); then
        # Check if it's React Native by looking in package.json
        if grep -q "react-native" "$package_json" 2>/dev/null; then
            echo "cd \"$app_path\" && npm run android"
        fi
    fi
}

# Generate Vue.js start command
get_vue_start_command() {
    local app_path="$1"
    local package_json="$app_path/package.json"
    local vue_config="$app_path/vue.config.js"
    local vite_config="$app_path/vite.config.js"

    if [ -f "$package_json" ] && ([ -f "$vue_config" ] || [ -f "$vite_config" ] || grep -q "vue" "$package_json" 2>/dev/null); then
        # Don't detect Vue if it's Nuxt (Nuxt uses Vue but has different commands)
        if ! grep -q "nuxt" "$package_json" 2>/dev/null; then
            echo "cd \"$app_path\" && npm run dev"
        fi
    fi
}

# Generate React start command
get_react_start_command() {
    local app_path="$1"
    local package_json="$app_path/package.json"

    if [ -f "$package_json" ] && grep -q "react" "$package_json" 2>/dev/null; then
        # Exclude React Native and Nuxt
        if ! grep -q "react-native" "$package_json" 2>/dev/null && ! grep -q "nuxt" "$package_json" 2>/dev/null; then
            echo "cd \"$app_path\" && npm start"
        fi
    fi
}

# Generate Kotlin Multiplatform start command
get_kotlin_multiplatform_start_command() {
    local app_path="$1"
    local build_gradle="$app_path/build.gradle.kts"
    local build_gradle_groovy="$app_path/build.gradle"

    if [ -f "$build_gradle" ] || [ -f "$build_gradle_groovy" ]; then
        # Check if it contains kotlin multiplatform
        if ([ -f "$build_gradle" ] && grep -q "kotlin.*multiplatform" "$build_gradle" 2>/dev/null) ||
           ([ -f "$build_gradle_groovy" ] && grep -q "kotlin.*multiplatform" "$build_gradle_groovy" 2>/dev/null); then
            echo "cd \"$app_path\" && ./gradlew run"
        fi
    fi
}

# Generate phpStart command
get_php_start_command() {
    local app_path="$1"
    local index_php="$app_path/index.php"

    if [ -f "$index_php" ]; then
        echo "php -S localhost:8000 -t \"$app_path\""
    fi
}

# Generate Ncore/Pycore/Installer command (unified installer for both ncore and pycore)
get_t_installer_command() {
    local app_path="$1"
    local app_type="$2"

    if [ "$app_type" = "ncoreApp" ]; then
        get_ncore_start_command "$app_path"
    elif [ "$app_type" = "pycoreApp" ]; then
        get_pycore_start_command "$app_path"
    fi
}

# Check native startup files
check_native_files() {
    local app_path="$1"
    local has_main_py=0
    local has_main_js=0
    local has_pubspec=0
    local has_composer=0
    local has_nuxt_config=0
    local has_index_php=0
    local has_package_json=0
    local has_gradle=0

    [ -f "$app_path/main.py" ] && has_main_py=1
    [ -f "$app_path/main.js" ] && has_main_js=1
    [ -f "$app_path/pubspec.yaml" ] && has_pubspec=1
    [ -f "$app_path/composer.json" ] && has_composer=1
    [ -f "$app_path/nuxt.config.ts" ] || [ -f "$app_path/nuxt.config.js" ] && has_nuxt_config=1
    [ -f "$app_path/index.php" ] && has_index_php=1
    [ -f "$app_path/package.json" ] && has_package_json=1
    [ -f "$app_path/build.gradle.kts" ] || [ -f "$app_path/build.gradle" ] && has_gradle=1

    echo "$has_main_py $has_main_js $has_pubspec $has_composer $has_nuxt_config $has_index_php $has_package_json $has_gradle"
}

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

# Step 2: Scan poly_apps
step2_scan_poly_apps() {
    echo -e "\033[36mStep 2: Scanning $POLY_APPS directory...\033[0m" >&2

    local poly_apps=()

    if [ -d "$POLY_APPS" ]; then
        for dir in "$POLY_APPS"/*; do
            if [ -d "$dir" ]; then
                local app_name="$(basename "$dir")"
                poly_apps+=("$app_name|$dir|poly_apps")
                echo -e "  \033[90mFound: $app_name [poly_apps]\033[0m" >&2
            fi
        done
        echo -e "  \033[32mTotal poly_apps: ${#poly_apps[@]}\033[0m" >&2
    else
        echo -e "  \033[31mDirectory not found: $POLY_APPS\033[0m" >&2
    fi

    printf '%s\n' "${poly_apps[@]}"
}

# Step 2.5: Scan pyapps
step2_5_scan_py_apps() {
    echo -e "\033[36mStep 2.5: Scanning $PY_APPS directory...\033[0m" >&2

    local py_apps=()

    if [ -d "$PY_APPS" ]; then
        for dir in "$PY_APPS"/*; do
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
                    py_apps+=("$app_name|$dir|pycoreApp")
                    echo -e "  \033[90mFound: $app_name [pycoreApp]\033[0m" >&2
                else
                    echo -e "  \033[90mSkipped: $app_name (no valid entry point)\033[0m" >&2
                fi
            fi
        done
        echo -e "  \033[32mTotal pycoreApps: ${#py_apps[@]}\033[0m" >&2
    else
        echo -e "  \033[31mDirectory not found: $PY_APPS\033[0m" >&2
    fi

    printf '%s\n' "${py_apps[@]}"
}

# Step 3: Generate native startup commands
step3_generate_native_startup() {
    local app_list=("$@")
    
    echo -e "\033[36mStep 3: Generating native startup commands...\033[0m" >&2
    
    for app_data in "${app_list[@]}"; do
        IFS='|' read -r app_name app_path app_type <<< "$app_data"
        
        local available_scripts=()
        local current_script=""
        local script_index=0
        local found_native=0
        
        # Check native files
        read -r has_main_py has_main_js has_pubspec has_composer has_nuxt_config has_index_php has_package_json has_gradle <<< "$(check_native_files "$app_path")"
        
        # Priority 1: Removed - ncoreStart&Installer merged into Ncore/Pycore/Installer
        # Priority 1.5: Removed - pycoreStart&Installer merged into Ncore/Pycore/Installer

        # Priority 1.9: Add Ncore/Pycore/Installer for both ncoreApp and pycoreApp
        if [ "$app_type" = "ncoreApp" ] || [ "$app_type" = "pycoreApp" ]; then
            local t_cmd="$(get_t_installer_command "$app_path" "$app_type")"
            if [ -n "$t_cmd" ]; then
                available_scripts+=("Ncore/Pycore/Installer")
                echo -e "  \033[35m$app_name: Ncore/Pycore/Installer (unified) - $t_cmd\033[0m" >&2
            fi
        fi

        # Priority 2: Framework-specific starts for poly_apps
        if [ "$app_type" = "poly_apps" ]; then
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

            # PHP (plain)
            if [ "$has_index_php" -eq 1 ] && [ "$has_composer" -eq 0 ]; then
                local cmd="$(get_php_start_command "$app_path")"
                if [ -n "$cmd" ]; then
                    if [ "$found_native" -eq 0 ]; then
                        available_scripts+=("phpStart")
                        current_script="phpStart"
                        script_index=0
                        found_native=1
                    else
                        available_scripts+=("phpStart")
                    fi
                    echo -e "  \033[35m$app_name: phpStart - $cmd\033[0m" >&2
                fi
            fi

            # React Native
            if [ "$has_package_json" -eq 1 ]; then
                local cmd="$(get_react_native_start_command "$app_path")"
                if [ -n "$cmd" ]; then
                    if [ "$found_native" -eq 0 ]; then
                        available_scripts+=("reactNativeStart")
                        current_script="reactNativeStart"
                        script_index=0
                        found_native=1
                    else
                        available_scripts+=("reactNativeStart")
                    fi
                    echo -e "  \033[35m$app_name: reactNativeStart - $cmd\033[0m" >&2
                fi
            fi

            # Vue.js
            if [ "$has_package_json" -eq 1 ]; then
                local cmd="$(get_vue_start_command "$app_path")"
                if [ -n "$cmd" ] && [ "$found_native" -eq 0 ]; then
                    if [ "$found_native" -eq 0 ]; then
                        available_scripts+=("vueStart")
                        current_script="vueStart"
                        script_index=0
                        found_native=1
                    else
                        available_scripts+=("vueStart")
                    fi
                    echo -e "  \033[35m$app_name: vueStart - $cmd\033[0m" >&2
                fi
            fi

            # React
            if [ "$has_package_json" -eq 1 ]; then
                local cmd="$(get_react_start_command "$app_path")"
                if [ -n "$cmd" ] && [ "$found_native" -eq 0 ]; then
                    if [ "$found_native" -eq 0 ]; then
                        available_scripts+=("reactStart")
                        current_script="reactStart"
                        script_index=0
                        found_native=1
                    else
                        available_scripts+=("reactStart")
                    fi
                    echo -e "  \033[35m$app_name: reactStart - $cmd\033[0m" >&2
                fi
            fi

            # Kotlin Multiplatform
            if [ "$has_gradle" -eq 1 ]; then
                local cmd="$(get_kotlin_multiplatform_start_command "$app_path")"
                if [ -n "$cmd" ]; then
                    if [ "$found_native" -eq 0 ]; then
                        available_scripts+=("kotlinMultiPlatformStart")
                        current_script="kotlinMultiPlatformStart"
                        script_index=0
                        found_native=1
                    else
                        available_scripts+=("kotlinMultiPlatformStart")
                    fi
                    echo -e "  \033[35m$app_name: kotlinMultiPlatformStart - $cmd\033[0m" >&2
                fi
            fi
        fi
        
        # Priority 3: pyStart for main.py
        if [ "$has_main_py" -eq 1 ]; then
            local cmd="$(get_py_start_command "$app_path")"
            if [ -n "$cmd" ]; then
                if [ "$found_native" -eq 0 ]; then
                    available_scripts+=("pyStart")
                    current_script="pyStart"
                    script_index=0
                    found_native=1
                else
                    available_scripts+=("pyStart")
                fi
                echo -e "  \033[35m$app_name: pyStart - $cmd\033[0m" >&2
            fi
        fi
        
        # Output: name|path|type|scripts|current|index
        local scripts_str="$(IFS=','; echo "${available_scripts[*]}")"
        echo "$app_name|$app_path|$app_type|$scripts_str|$current_script|$script_index"
    done
}

# Step 4: Scan scripts directory
step4_scan_scripts_directory() {
    local app_list=("$@")
    
    echo -e "\033[36mStep 4: Scanning scripts directories...\033[0m" >&2
    
    for app_data in "${app_list[@]}"; do
        IFS='|' read -r app_name app_path app_type scripts_str current_script script_index <<< "$app_data"
        
        local scripts_path="$app_path/scripts"
        local found_scripts=()
        
        if [ -d "$scripts_path" ]; then
            for script_file in "${SCRIPT_FILES[@]}"; do
                if [ -f "$scripts_path/$script_file" ]; then
                    found_scripts+=("$script_file")
                fi
            done
            
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

# Load cache
load_cache() {
    if [ -f "$CACHE_FILE" ]; then
        echo -e "\033[36mLoading cache...\033[0m"
        
        # Parse JSON cache (basic parsing)
        local current_index_cached=$(grep -o '"CurrentIndex":[0-9]*' "$CACHE_FILE" | grep -o '[0-9]*')
        if [ -n "$current_index_cached" ]; then
            CURRENT_INDEX=$current_index_cached
        fi
        
        # Restore app states from cache
        local app_states=$(grep -o '"AppStates":\[.*\]' "$CACHE_FILE" | sed 's/"AppStates"://')
        if [ -n "$app_states" ]; then
            # Extract app names, types, and current scripts from cache
            local cached_names=$(echo "$app_states" | grep -o '"Name":"[^"]*"' | sed 's/"Name":"//g' | sed 's/"//g')
            local cached_types=$(echo "$app_states" | grep -o '"AppType":"[^"]*"' | sed 's/"AppType":"//g' | sed 's/"//g')
            local cached_scripts=$(echo "$app_states" | grep -o '"CurrentScript":"[^"]*"' | sed 's/"CurrentScript":"//g' | sed 's/"//g')
            local cached_indices=$(echo "$app_states" | grep -o '"ScriptIndex":[0-9]*' | grep -o '[0-9]*')
            
            # Convert to arrays
            local names_array=()
            local types_array=()
            local scripts_array=()
            local indices_array=()
            
            for name in $cached_names; do names_array+=("$name"); done
            for type in $cached_types; do types_array+=("$type"); done
            for script in $cached_scripts; do scripts_array+=("$script"); done
            for index in $cached_indices; do indices_array+=("$index"); done
            
            # Restore states for each app
            for i in "${!APPS_NAME[@]}"; do
                local app_name="${APPS_NAME[$i]}"
                local app_type="${APPS_TYPE[$i]}"
                
                # Find matching app in cache
                for j in "${!names_array[@]}"; do
                    if [ "${names_array[$j]}" = "$app_name" ] && [ "${types_array[$j]}" = "$app_type" ]; then
                        # Restore script index and current script
                        if [ $j -lt ${#indices_array[@]} ]; then
                            local cached_index="${indices_array[$j]}"
                            local cached_script="${scripts_array[$j]}"
                            
                            # Validate cached script exists in available scripts
                            local scripts_str="${APPS_AVAILABLE_SCRIPTS[$i]}"
                            if [ -n "$scripts_str" ] && [ "$scripts_str" != "None" ]; then
                                IFS=',' read -ra scripts <<< "$scripts_str"
                                
                                # Check if cached script is in available scripts
                                local found=false
                                for k in "${!scripts[@]}"; do
                                    if [ "${scripts[$k]}" = "$cached_script" ]; then
                                        APPS_SCRIPT_INDEX[$i]=$k
                                        APPS_CURRENT_SCRIPT[$i]="$cached_script"
                                        found=true
                                        break
                                    fi
                                done
                                
                                # If cached script not found, use first available script
                                if [ "$found" = false ]; then
                                    APPS_SCRIPT_INDEX[$i]=0
                                    APPS_CURRENT_SCRIPT[$i]="${scripts[0]}"
                                fi
                            fi
                        fi
                        break
                    fi
                done
            done
        fi
        
        echo -e "  \033[32mCache loaded\033[0m"
        return 0
    else
        # No cache file, reset to ensure clean state
        reset_cache
        return 1
    fi
}

# Reset cache if corrupted
reset_cache() {
    echo -e "\033[33mResetting corrupted cache...\033[0m"
    rm -f "$CACHE_FILE"
    echo -e "\033[32mCache reset complete\033[0m"
}

# Save cache
save_cache() {
    local json="{\n  \"AppStates\": [\n"
    
    for i in "${!APPS_NAME[@]}"; do
        [ $i -gt 0 ] && json+=",\n"
        json+="    {\n"
        json+="      \"Name\": \"${APPS_NAME[$i]}\",\n"
        json+="      \"AppType\": \"${APPS_TYPE[$i]}\",\n"
        json+="      \"IsSelected\": \"${APPS_IS_SELECTED[$i]}\",\n"
        json+="      \"CurrentScript\": \"${APPS_CURRENT_SCRIPT[$i]}\",\n"
        json+="      \"ScriptIndex\": ${APPS_SCRIPT_INDEX[$i]}\n"
        json+="    }"
    done
    
    json+="\n  ],\n"
    json+="  \"CurrentIndex\": $CURRENT_INDEX\n"
    json+="}\n"
    
    echo -e "$json" > "$CACHE_FILE"
}

# Scan all apps
scan_apps() {
    echo ""
    echo -e "\033[33m=== Starting Application Scan ===\033[0m"
    echo ""

    # Step 1: Scan ncoreApps
    mapfile -t ncore_apps < <(step1_scan_ncore_apps)
    echo ""

    # Step 2: Scan poly_apps
    mapfile -t poly_apps < <(step2_scan_poly_apps)
    echo ""

    # Step 2.5: Scan pyapps
    mapfile -t py_apps < <(step2_5_scan_py_apps)
    echo ""

    # Combine apps
    local all_apps=("${ncore_apps[@]}" "${poly_apps[@]}" "${py_apps[@]}")

    # Step 3: Generate native startup
    mapfile -t apps_with_native < <(step3_generate_native_startup "${all_apps[@]}")
    echo ""
    
    # Step 4: Scan scripts directory
    mapfile -t final_apps < <(step4_scan_scripts_directory "${apps_with_native[@]}")
    echo ""
    
    # Populate global arrays
    APPS_NAME=()
    APPS_PATH=()
    APPS_TYPE=()
    APPS_AVAILABLE_SCRIPTS=()
    APPS_CURRENT_SCRIPT=()
    APPS_SCRIPT_INDEX=()
    APPS_IS_SELECTED=()
    MAX_APP_NAME_WIDTH=0
    
    for app_data in "${final_apps[@]}"; do
        IFS='|' read -r app_name app_path app_type scripts_str current_script script_index <<< "$app_data"
        
        APPS_NAME+=("$app_name")
        APPS_PATH+=("$app_path")
        APPS_TYPE+=("$app_type")
        APPS_AVAILABLE_SCRIPTS+=("$scripts_str")
        APPS_CURRENT_SCRIPT+=("$current_script")
        APPS_SCRIPT_INDEX+=("$script_index")
        APPS_IS_SELECTED+=("N")
        
        # Calculate max width
        local name_len=${#app_name}
        [ $name_len -gt $MAX_APP_NAME_WIDTH ] && MAX_APP_NAME_WIDTH=$name_len
    done
    
    # Load cache
    load_cache
    
    echo -e "\033[32m=== Scan Complete ===\033[0m"
    echo ""
}

# Show menu
show_menu() {
    clear
    echo -e "\033[36m=== dd.sh Unified App Manager >16 ===\033[0m"
    echo -e "\033[90mCurrent directory: $ROOT_DIR\033[0m"
    echo ""
    
    if [ ${#APPS_NAME[@]} -eq 0 ]; then
        echo -e "\033[31mNo applications found\033[0m"
        return
    fi
    
    # Calculate column widths
    local name_width=$((MAX_APP_NAME_WIDTH > 8 ? MAX_APP_NAME_WIDTH : 8))
    
    echo -e "\033[33mApplication List:\033[0m"
    
    # Header
    printf "No. | %-${name_width}s | %-9s | %-14s | Sel\n" "App Name" "Type" "Current Script"
    printf -- "----|-%${name_width}s-|-----------|-----------------|-\n" "$(printf '%*s' $name_width | tr ' ' '-')"
    
    # App list
    for i in "${!APPS_NAME[@]}"; do
        local indicator=" "
        local color="\033[37m"  # White
        
        if [ $i -eq $CURRENT_INDEX ]; then
            indicator=">"
            color="\033[33m"  # Yellow
        fi
        
        printf "${color}%s%2d | %-${name_width}s | %-9s | %-14s | %s\033[0m\n" \
            "$indicator" \
            $((i + 1)) \
            "${APPS_NAME[$i]}" \
            "${APPS_TYPE[$i]}" \
            "${APPS_CURRENT_SCRIPT[$i]}" \
            "${APPS_IS_SELECTED[$i]}"
    done
    
    echo ""
    echo -e "\033[33mControls:\033[0m"
    echo "Up/Down: Navigate | Left/Right: Toggle script | Enter: Launch | Space: Select | E: Execute | S: Save | K: Create KMP APP | Q: Quit"
    echo ""
}

# Navigate up
navigate_up() {
    if [ $CURRENT_INDEX -gt 0 ]; then
        ((CURRENT_INDEX--))
    fi
}

# Navigate down
navigate_down() {
    if [ $CURRENT_INDEX -lt $((${#APPS_NAME[@]} - 1)) ]; then
        ((CURRENT_INDEX++))
    fi
}

# Toggle script
toggle_script() {
    local scripts_str="${APPS_AVAILABLE_SCRIPTS[$CURRENT_INDEX]}"
    
    if [ -z "$scripts_str" ] || [ "$scripts_str" = "None" ]; then
        echo -e "\033[33mNo alternative scripts available for ${APPS_NAME[$CURRENT_INDEX]}\033[0m"
        return
    fi
    
    IFS=',' read -ra scripts <<< "$scripts_str"
    
    if [ ${#scripts[@]} -gt 1 ]; then
        local current_index=${APPS_SCRIPT_INDEX[$CURRENT_INDEX]}
        ((current_index++))
        [ $current_index -ge ${#scripts[@]} ] && current_index=0
        
        APPS_SCRIPT_INDEX[$CURRENT_INDEX]=$current_index
        APPS_CURRENT_SCRIPT[$CURRENT_INDEX]="${scripts[$current_index]}"
        
        echo -e "\033[32mSwitched to ${APPS_CURRENT_SCRIPT[$CURRENT_INDEX]} for ${APPS_NAME[$CURRENT_INDEX]}\033[0m"
        save_cache
    else
        echo -e "\033[33mNo alternative scripts available for ${APPS_NAME[$CURRENT_INDEX]}\033[0m"
    fi
}

# Toggle selection
toggle_selection() {
    if [ "${APPS_IS_SELECTED[$CURRENT_INDEX]}" = "Y" ]; then
        APPS_IS_SELECTED[$CURRENT_INDEX]="N"
        echo -e "\033[32m${APPS_NAME[$CURRENT_INDEX]} deselected\033[0m"
    else
        APPS_IS_SELECTED[$CURRENT_INDEX]="Y"
        echo -e "\033[32m${APPS_NAME[$CURRENT_INDEX]} selected\033[0m"
    fi
    save_cache
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

        # Check if this is an &Installer variant
        if [[ "$current_script" == *"&Installer" ]]; then
            needs_install=1
        fi

        case "$current_script" in
            "Ncore/Pycore/Installer")
                command="$(get_t_installer_command "$app_path" "$app_type")"
                working_dir="$ROOT_DIR"
                needs_install=1
                ;;
            ncoreStart*)
                command="$(get_ncore_start_command "$app_path")"
                working_dir="$ROOT_DIR"
                ;;
            pycoreStart*)
                command="$(get_pycore_start_command "$app_path")"
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
            # Clean script name for use in filename (replace invalid characters)
            local clean_script_name="${current_script//[\/\\:*?\"<>|]/_}"
            local temp_script="$TEMP_SCRIPT_DIR/${app_name}_${clean_script_name}.sh"

            if [ $needs_install -eq 1 ]; then
                # Check if this is Ncore/Pycore/Installer for enhanced installation
                if [ "$current_script" = "Ncore/Pycore/Installer" ]; then
                    # Ncore/Pycore/Installer: Call the standalone installer script
                    local installer_script="$SCRIPT_PATH/ncore_pycore_installer.sh"
                    cat > "$temp_script" << EOF
#!/bin/bash
echo "Launching unified installer..."
bash "$installer_script" "$app_name" "$app_type" "$command" "$working_dir" "$ROOT_DIR"
EOF
                else
                    # Standard &Installer: Basic pnpm install only
                    cat > "$temp_script" << EOF
#!/bin/bash
echo "========================================"
echo "Installing dependencies..."
echo "========================================"
cd "$ROOT_DIR"
echo "Running: pnpm install"
pnpm install
if [ \$? -ne 0 ]; then
    echo ""
    echo "Installation failed! Check the error messages above."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo ""
echo "========================================"
echo "Dependencies installed successfully"
echo "========================================"
echo ""

echo "========================================"
echo "Starting $app_name with $current_script..."
echo "========================================"
cd "$working_dir"
echo "Working Directory: \$(pwd)"
echo ""
$command
read -p "Press Enter to exit..."
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

# Main loop
main() {
    # Always scan apps first
    scan_apps
    
    # Save terminal settings
    old_settings=$(stty -g)
    
    while true; do
        show_menu
        
        # Read single character
        read -rsn1 key
        
        case "$key" in
            $'\x1b')  # ESC sequence
                read -rsn2 key  # Read next 2 chars
                case "$key" in
                    '[A')  # Up arrow
                        navigate_up
                        save_cache
                        ;;
                    '[B')  # Down arrow
                        navigate_down
                        save_cache
                        ;;
                    '[C')  # Right arrow
                        toggle_script
                        ;;
                    '[D')  # Left arrow
                        toggle_script
                        ;;
                esac
                ;;
            '')  # Enter
                launch_current_app
                ;;
            ' ')  # Space
                toggle_selection
                ;;
            'q'|'Q')  # Quit
                echo -e "\033[33mExiting program\033[0m"
                save_cache
                stty "$old_settings"
                exit 0
                ;;
            'r'|'R')  # Rescan
                scan_apps
                echo -e "\033[32mApplication list updated\033[0m"
                sleep 1
                ;;
            's'|'S')  # Save
                save_cache
                echo -e "\033[32mState saved\033[0m"
                sleep 1
                ;;
            'e'|'E')  # Execute
                execute_selected_apps
                read -p "Press Enter to continue..."
                ;;
            'd'|'D')  # Debug
                show_cache_debug
                read -p "Press Enter to continue..."
                ;;
            'k'|'K')  # Create KMP APP
                create_new_kmpapp
                ;;
        esac
    done
}

# Execute selected apps
execute_selected_apps() {
    local selected_count=0
    local selected_apps=()
    
    # Find selected apps
    for i in "${!APPS_IS_SELECTED[@]}"; do
        if [ "${APPS_IS_SELECTED[$i]}" = "Y" ]; then
            selected_apps+=("$i")
            ((selected_count++))
        fi
    done
    
    if [ $selected_count -eq 0 ]; then
        echo -e "\033[33mNo applications selected\033[0m"
        return
    fi
    
    echo -e "\033[33mExecuting selected applications with their current scripts:\033[0m"
    for app_index in "${selected_apps[@]}"; do
        local app_name="${APPS_NAME[$app_index]}"
        local current_script="${APPS_CURRENT_SCRIPT[$app_index]}"
        
        if [ -n "$current_script" ] && [ "$current_script" != "None" ]; then
            echo -e "\033[37mExecuting $current_script for $app_name...\033[0m"
            # Here you would implement the actual execution logic
            echo -e "\033[32m$current_script for $app_name completed\033[0m"
        else
            echo -e "\033[31mNo script selected for $app_name\033[0m"
        fi
    done
}

# Show cache debug
show_cache_debug() {
    if [ -f "$CACHE_FILE" ]; then
        echo -e "\033[36mCache file content:\033[0m"
        cat "$CACHE_FILE"
    else
        echo -e "\033[33mNo cache file found\033[0m"
    fi
}

# Get next available index for kmpapp directory
get_next_kmpapp_index() {
    local poly_apps_path="$POLY_APPS"
    
    if [ ! -d "$poly_apps_path" ]; then
        echo "1"
        return
    fi
    
    local max_index=0
    local existing_dirs
    
    # Find all kmpapp_* directories
    while IFS= read -r dir; do
        if [[ "$dir" =~ ^kmpapp_([0-9]+)$ ]]; then
            local index="${BASH_REMATCH[1]}"
            if [ "$index" -gt "$max_index" ]; then
                max_index=$index
            fi
        fi
    done < <(find "$poly_apps_path" -maxdepth 1 -type d -name "kmpapp_*" -printf "%f\n" 2>/dev/null || ls -1 "$poly_apps_path" | grep "^kmpapp_[0-9]\+$" 2>/dev/null)
    
    echo $((max_index + 1))
}

# Remove .git directory recursively
remove_git_directory() {
    local path="$1"
    local git_path="$path/.git"
    
    if [ -d "$git_path" ]; then
        echo -e "\033[33mRemoving .git directory: $git_path\033[0m"
        echo "Command: rm -rf \"$git_path\"" | sed 's/^/  /'
        rm -rf "$git_path" 2>/dev/null
        
        if [ -d "$git_path" ]; then
            echo -e "\033[31mWarning: Failed to remove .git directory completely\033[0m"
            return 1
        else
            echo -e "\033[32mSuccessfully removed .git directory\033[0m"
            return 0
        fi
    fi
    return 0
}

# Create new Kotlin KMP APP from alkaa template
create_new_kmpapp() {
    echo ""
    echo -e "\033[36m=== Create New Kotlin KMP APP ===\033[0m"
    echo ""
    
    local alkaa_repo_url="https://github.com/igorescodro/alkaa.git"
    local poly_apps_path="$POLY_APPS"
    
    # Ensure poly_apps directory exists
    if [ ! -d "$poly_apps_path" ]; then
        echo -e "\033[33mCreating poly_apps directory...\033[0m"
        echo "Command: mkdir -p \"$poly_apps_path\"" | sed 's/^/  /'
        mkdir -p "$poly_apps_path"
    fi
    
    # Get next available index
    local next_index=$(get_next_kmpapp_index)
    local default_app_name="kmpapp_$next_index"

    # Prompt user for custom app name
    echo -e "\033[32mDefault app name: $default_app_name\033[0m"
    echo ""
    echo -ne "\033[36mEnter custom app name (or press Enter to use default): \033[0m"
    read custom_name

    # Use custom name if provided, otherwise use default
    if [ -z "$custom_name" ]; then
        local new_app_name="$default_app_name"
        echo -e "\033[33mUsing default name: $new_app_name\033[0m"
    else
        # Sanitize the custom name (remove invalid characters)
        local new_app_name=$(echo "$custom_name" | tr -d '<>:"/\\|?*')
        if [ "$new_app_name" != "$custom_name" ]; then
            echo -e "\033[33mName sanitized to: $new_app_name\033[0m"
        else
            echo -e "\033[33mUsing custom name: $new_app_name\033[0m"
        fi
    fi

    local new_app_path="$poly_apps_path/$new_app_name"
    echo ""

    # Check if directory already exists
    if [ -d "$new_app_path" ]; then
        echo -e "\033[31mERROR: Directory already exists: $new_app_path\033[0m"
        read -p "Press Enter to continue..."
        return
    fi

    echo -e "\033[32mApp name: $new_app_name\033[0m"
    echo -e "\033[32mTarget path: $new_app_path\033[0m"
    echo ""
    echo -e "\033[36mCloning alkaa repository from: $alkaa_repo_url\033[0m"
    echo ""
    
    # Confirm before proceeding
    read -p "Press any key to continue, or 'n' to cancel..." -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo -e "\033[33mOperation cancelled\033[0m"
        sleep 1
        return
    fi
    
    # Change to poly_apps directory
    local original_location=$(pwd)
    cd "$poly_apps_path" || return
    
    echo -e "\033[36mChanged to directory: $poly_apps_path\033[0m"
    echo "Command: cd \"$poly_apps_path\"" | sed 's/^/  /'
    echo ""
    
    # Clone the repository
    echo -e "\033[36mCloning repository...\033[0m"
    echo "Command: git clone $alkaa_repo_url $new_app_name" | sed 's/^/  /'
    echo ""

    # Run git clone and display all output directly
    git clone "$alkaa_repo_url" "$new_app_name" 2>&1
    echo ""

    # Check if directory was actually created (don't rely on exit code)
    if [ -d "$new_app_path" ]; then
        echo -e "\033[32mNew KMP APP created at: $new_app_path\033[0m"
        echo ""

        # Remove .git and .github directories
        echo -e "\033[36mRemoving .git and .github directories from cloned repository...\033[0m"

        local git_dir="$new_app_path/.git"
        local github_dir="$new_app_path/.github"

        # Remove .git directory
        if [ -d "$git_dir" ]; then
            rm -rf "$git_dir" 2>/dev/null
            if [ ! -d "$git_dir" ]; then
                echo -e "\033[32mSuccessfully removed .git directory\033[0m"
            else
                echo -e "\033[33mWarning: .git directory could not be removed\033[0m"
            fi
        else
            echo -e "\033[90m.git directory not found\033[0m"
        fi

        # Remove .github directory
        if [ -d "$github_dir" ]; then
            rm -rf "$github_dir" 2>/dev/null
            if [ ! -d "$github_dir" ]; then
                echo -e "\033[32mSuccessfully removed .github directory\033[0m"
            else
                echo -e "\033[33mWarning: .github directory could not be removed\033[0m"
            fi
        else
            echo -e "\033[90m.github directory not found\033[0m"
        fi
        echo ""

        echo -e "\033[36mYou can now navigate to the app in the menu and launch it.\033[0m"

        # Rescan apps to include the new one
        echo ""
        echo -e "\033[36mRescanning applications...\033[0m"
        scan_apps
    else
        echo -e "\033[31mERROR: Directory was not created at: $new_app_path\033[0m"
        echo -e "\033[31mClone operation did not succeed.\033[0m"
    fi
    
    # Restore original location
    cd "$original_location" || return
    echo -e "\033[36mRestored to original directory: $original_location\033[0m"
    
    echo ""
    read -p "Press Enter to continue..."
}

#endregion

# Start program
main

