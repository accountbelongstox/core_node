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
NATIVE_STARTUPS=("ncoreStart" "pyStart" "flutterStart" "laravelStart" "nuxtStart" "phpStart")

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

# Generate pyStart command
get_py_start_command() {
    local app_path="$1"
    local main_py="$app_path/main.py"
    
    if [ -f "$main_py" ]; then
        echo "python \"$main_py\""
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
    
    if [ -f "$nuxt_config" ]; then
        echo "cd \"$app_path\" && npm run dev"
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

# Check native startup files
check_native_files() {
    local app_path="$1"
    local has_main_py=0
    local has_main_js=0
    local has_pubspec=0
    local has_composer=0
    local has_nuxt_config=0
    local has_index_php=0
    
    [ -f "$app_path/main.py" ] && has_main_py=1
    [ -f "$app_path/main.js" ] && has_main_js=1
    [ -f "$app_path/pubspec.yaml" ] && has_pubspec=1
    [ -f "$app_path/composer.json" ] && has_composer=1
    [ -f "$app_path/nuxt.config.ts" ] && has_nuxt_config=1
    [ -f "$app_path/index.php" ] && has_index_php=1
    
    echo "$has_main_py $has_main_js $has_pubspec $has_composer $has_nuxt_config $has_index_php"
}

# Step 1: Scan ncoreApps
step1_scan_ncore_apps() {
    echo -e "\033[36mStep 1: Scanning $NCORE_APPS directory...\033[0m"
    
    local ncore_apps=()
    
    if [ -d "$NCORE_APPS" ]; then
        for dir in "$NCORE_APPS"/*; do
            if [ -d "$dir" ]; then
                local app_name="$(basename "$dir")"
                ncore_apps+=("$app_name|$dir|ncoreApp")
                echo -e "  \033[90mFound: $app_name [ncoreApp]\033[0m"
            fi
        done
        echo -e "  \033[32mTotal ncoreApps: ${#ncore_apps[@]}\033[0m"
    else
        echo -e "  \033[31mDirectory not found: $NCORE_APPS\033[0m"
    fi
    
    # Return array as string (newline separated)
    printf '%s\n' "${ncore_apps[@]}"
}

# Step 2: Scan poly_apps
step2_scan_poly_apps() {
    echo -e "\033[36mStep 2: Scanning $POLY_APPS directory...\033[0m"
    
    local poly_apps=()
    
    if [ -d "$POLY_APPS" ]; then
        for dir in "$POLY_APPS"/*; do
            if [ -d "$dir" ]; then
                local app_name="$(basename "$dir")"
                poly_apps+=("$app_name|$dir|poly_apps")
                echo -e "  \033[90mFound: $app_name [poly_apps]\033[0m"
            fi
        done
        echo -e "  \033[32mTotal poly_apps: ${#poly_apps[@]}\033[0m"
    else
        echo -e "  \033[31mDirectory not found: $POLY_APPS\033[0m"
    fi
    
    printf '%s\n' "${poly_apps[@]}"
}

# Step 3: Generate native startup commands
step3_generate_native_startup() {
    local app_list=("$@")
    
    echo -e "\033[36mStep 3: Generating native startup commands...\033[0m"
    
    for app_data in "${app_list[@]}"; do
        IFS='|' read -r app_name app_path app_type <<< "$app_data"
        
        local available_scripts=()
        local current_script=""
        local script_index=0
        local found_native=0
        
        # Check native files
        read -r has_main_py has_main_js has_pubspec has_composer has_nuxt_config has_index_php <<< "$(check_native_files "$app_path")"
        
        # Priority 1: ncoreStart for ncoreApp with main.js
        if [ "$app_type" = "ncoreApp" ] && [ "$has_main_js" -eq 1 ]; then
            local cmd="$(get_ncore_start_command "$app_path")"
            if [ -n "$cmd" ]; then
                available_scripts+=("ncoreStart")
                current_script="ncoreStart"
                script_index=0
                found_native=1
                echo -e "  \033[35m$app_name: ncoreStart - $cmd\033[0m"
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
                    echo -e "  \033[35m$app_name: flutterStart - $cmd\033[0m"
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
                    echo -e "  \033[35m$app_name: laravelStart - $cmd\033[0m"
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
                    echo -e "  \033[35m$app_name: nuxtStart - $cmd\033[0m"
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
                    echo -e "  \033[35m$app_name: phpStart - $cmd\033[0m"
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
                echo -e "  \033[35m$app_name: pyStart - $cmd\033[0m"
            fi
        fi
        
        # Output: name|path|type|scripts|current|index
        local scripts_str="$(IFS=','; echo "${available_scripts[*]}")"
        echo "$app_name|$app_path|$app_type|$scripts_str|$current_script|$script_index"
    done
}

# Step 4: Scan scripts directory
step4_scan_scripts_directory() {
    echo -e "\033[36mStep 4: Scanning scripts directories...\033[0m"
    
    while IFS='|' read -r app_name app_path app_type scripts_str current_script script_index; do
        local scripts_path="$app_path/scripts"
        local found_scripts=()
        
        if [ -d "$scripts_path" ]; then
            for script_file in "${SCRIPT_FILES[@]}"; do
                if [ -f "$scripts_path/$script_file" ]; then
                    found_scripts+=("$script_file")
                fi
            done
            
            if [ ${#found_scripts[@]} -gt 0 ]; then
                echo -e "  \033[90m$app_name: ${found_scripts[*]}\033[0m"
            fi
        fi
        
        # Merge scripts
        if [ -n "$scripts_str" ]; then
            IFS=',' read -ra existing_scripts <<< "$scripts_str"
            scripts_str="${existing_scripts[*]}"
            if [ ${#found_scripts[@]} -gt 0 ]; then
                scripts_str="$scripts_str,${found_scripts[*]}"
            fi
        else
            scripts_str="$(IFS=','; echo "${found_scripts[*]}")"
        fi
        
        # Set default if no scripts
        if [ -z "$scripts_str" ]; then
            current_script="None"
        elif [ -z "$current_script" ]; then
            IFS=',' read -ra all_scripts <<< "$scripts_str"
            current_script="${all_scripts[0]}"
            script_index=0
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
        
        echo -e "  \033[32mCache loaded\033[0m"
        return 0
    fi
    return 1
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
    
    # Combine apps
    local all_apps=("${ncore_apps[@]}" "${poly_apps[@]}")
    
    # Step 3: Generate native startup
    mapfile -t apps_with_native < <(step3_generate_native_startup "${all_apps[@]}")
    echo ""
    
    # Step 4: Scan scripts directory
    mapfile -t final_apps < <(echo "${apps_with_native[@]}" | step4_scan_scripts_directory)
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
    echo -e "\033[36m=== Core Node Unified Manager ===\033[0m"
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
    echo "Up/Down: Navigate | Left/Right: Toggle script | Enter: Launch | Space: Select | E: Execute | S: Save | Q: Quit"
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
        echo "No alternative scripts available"
        return
    fi
    
    IFS=',' read -ra scripts <<< "$scripts_str"
    
    if [ ${#scripts[@]} -gt 1 ]; then
        local current_index=${APPS_SCRIPT_INDEX[$CURRENT_INDEX]}
        ((current_index++))
        [ $current_index -ge ${#scripts[@]} ] && current_index=0
        
        APPS_SCRIPT_INDEX[$CURRENT_INDEX]=$current_index
        APPS_CURRENT_SCRIPT[$CURRENT_INDEX]="${scripts[$current_index]}"
        
        save_cache
    fi
}

# Toggle selection
toggle_selection() {
    if [ "${APPS_IS_SELECTED[$CURRENT_INDEX]}" = "Y" ]; then
        APPS_IS_SELECTED[$CURRENT_INDEX]="N"
    else
        APPS_IS_SELECTED[$CURRENT_INDEX]="Y"
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
        
        case "$current_script" in
            "ncoreStart")
                command="$(get_ncore_start_command "$app_path")"
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
            local temp_script="$TEMP_SCRIPT_DIR/${app_name}_${current_script}.sh"
            
            cat > "$temp_script" << EOF
#!/bin/bash
cd "$working_dir"
echo "Starting $app_name with $current_script..."
echo "Working Directory: \$(pwd)"
echo ""
$command
read -p "Press Enter to exit..."
EOF
            
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
    # Scan apps
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
                ;;
            's'|'S')  # Save
                save_cache
                echo -e "\033[32mState saved\033[0m"
                sleep 1
                ;;
        esac
    done
}

#endregion

# Start program
main

