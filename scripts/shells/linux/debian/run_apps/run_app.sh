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

# App Management Script

# Save original working directory
ORIGINAL_DIR=$(pwd)

# Get script directory (dd.sh location)
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
DD_SH_DIR="$(cd "$SCRIPT_DIR/../../../../" && pwd)"
APPS_DIR="$DD_SH_DIR/apps"
POLY_APPS_DIR="$DD_SH_DIR/poly_apps"
COMPOSER_VENDOR_COMMON="$(cd "${SCRIPT_DIR}/../../common" && pwd)/composer_vendor_common.sh"
RUN_APP_RUNTIMES="$SCRIPT_DIR/run_app_runtimes.sh"
RUN_APP_ARROW_MENU="$(cd "${SCRIPT_DIR}/../.." && pwd)/common/arrow_menu.sh"

. "$COMPOSER_VENDOR_COMMON"
. "$RUN_APP_ARROW_MENU"
. "$RUN_APP_RUNTIMES"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to restore original directory on exit
cleanup_and_exit() {
    cd "$ORIGINAL_DIR"
    exit ${1:-0}
}

# Trap to ensure directory restoration
trap 'cleanup_and_exit 1' ERR
trap 'cleanup_and_exit 0' EXIT

# Initialize environment status as constant (check once at startup)
ENV_STATUS=""
CURRENT_APP_STARTUP_INFO=""

# Function to scan for startup scripts in app directory
scan_startup_scripts() {
    local app_dir="$1"
    local scripts=()
    
    if [ -d "$app_dir" ]; then
        # Find all .sh files in the app directory (excluding hidden files)
        while IFS= read -r -d '' script; do
            local script_name=$(basename "$script")
            # Skip common non-startup scripts
            if [[ ! "$script_name" =~ ^(install|setup|build|test|deploy|clean)\.sh$ ]]; then
                scripts+=("$script")
            fi
        done < <(find "$app_dir" -maxdepth 1 -name "*.sh" -type f -print0 2>/dev/null)
    fi
    
    printf '%s\n' "${scripts[@]}"
}

# Function to generate startup info for current app
generate_startup_info() {
    local app_name="$1"
    local app_dir="$APPS_DIR/$app_name"
    local scripts
    
    scripts=($(scan_startup_scripts "$app_dir"))
    
    if [ ${#scripts[@]} -gt 0 ]; then
        CURRENT_APP_STARTUP_INFO="${YELLOW}Startup scripts found: ${#scripts[@]} script(s) - Traditional + Custom options available${NC}"
    else
        CURRENT_APP_STARTUP_INFO="${YELLOW}No startup scripts found - Using traditional startup method${NC}"
    fi
}

# Function to show startup method selection (interactive)
show_startup_selection() {
    local app_name="$1"
    local project_type="$2"
    shift 2
    local args=("$@")
    local app_dir="$APPS_DIR/$app_name"
    local scripts
    
    scripts=($(scan_startup_scripts "$app_dir"))
    
    # If no scripts found, use traditional startup
    if [ ${#scripts[@]} -eq 0 ]; then
        log_info "No startup scripts found. Using traditional startup method."
        return 1
    fi
    
    # Prepare menu options
    local options=()
    options+=("Traditional startup (default)")
    for script in "${scripts[@]}"; do
        local script_name=$(basename "$script")
        options+=("Custom script: $script_name")
    done
    options+=("Return to App Menu")
    options+=("Exit Program")
    
    local selected=0
    local total=${#options[@]}
    
    # Save current terminal settings
    local old_settings=$(stty -g)
    # Configure terminal for single character input
    stty -icanon -echo
    
    # Ensure terminal settings are restored on any exit
    trap 'stty "$old_settings"; exit' EXIT
    
    while true; do
        # Clear screen and show header
        printf "\033c"
        log_info "Startup Method Selection for: $app_name ($project_type)"
        echo "Use Up/Down arrows to navigate, Enter to select:"
        echo ""
        echo "Found ${#scripts[@]} startup script(s):"
        
        # Display options with selection highlighting
        for i in "${!options[@]}"; do
            if [ "$i" -eq "$selected" ]; then
                printf "\033[47m\033[30m> %-50s\033[0m\n" "${options[$i]}"
            else
                printf "  %-50s\n" "${options[$i]}"
            fi
        done
        
        echo ""
        echo "Press Ctrl+C to force exit"
        
        # Read a single character
        local char
        char=$(dd bs=1 count=1 2>/dev/null)
        
        case "$char" in
            $'\x1B')  # ESC sequence
                read -r -t 0.1 -d '' seq
                case "$seq" in
                    '[A')  # Up arrow
                        ((selected--))
                        [ "$selected" -lt 0 ] && selected=$((total - 1))
                        ;;
                    '[B')  # Down arrow
                        ((selected++))
                        [ "$selected" -ge "$total" ] && selected=0
                        ;;
                esac
                ;;
            '')  # Enter key
                stty "$old_settings"
                
                if [ "$selected" -eq 0 ]; then
                    # Traditional startup
                    log_info "Using traditional startup method"
                    return 1
                elif [ "$selected" -lt $((${#scripts[@]} + 1)) ]; then
                    # Custom script selected
                    local script_index=$((selected - 1))
                    local selected_script="${scripts[$script_index]}"
                    log_info "Using custom startup script: $(basename "$selected_script")"
                    
                    # Change to app directory and run the script with arguments
                    cd "$app_dir" || {
                        log_error "Failed to change to directory: $app_dir"
                        return 1
                    }
                    
                    log_info "Running: bash $(basename "$selected_script") ${args[*]}"
                    if [ ${#args[@]} -gt 0 ]; then
                        bash "$selected_script" "${args[@]}" || {
                            log_error "Failed to run startup script: $(basename "$selected_script")"
                            return 1
                        }
                    else
                        bash "$selected_script" || {
                            log_error "Failed to run startup script: $(basename "$selected_script")"
                            return 1
                        }
                    fi
                    return 0
                elif [ "$selected" -eq $((${#scripts[@]} + 1)) ]; then
                    # Return to App Menu
                    log_info "Returning to App Menu..."
                    return 1
                elif [ "$selected" -eq $((${#scripts[@]} + 2)) ]; then
                    # Exit Program
                    log_info "Exiting program..."
                    exit 0
                fi
                
                stty -icanon -echo
                ;;
        esac
    done
}

# Function to initialize environment status
init_env_status() {
    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version 2>/dev/null | sed 's/v//' || echo "?")
        ENV_STATUS+="Node [$node_version]"
    else
        ENV_STATUS+="Node [X]"
    fi
    
    # Check Python
    if command -v python3 >/dev/null 2>&1; then
        local python_version=$(python3 --version 2>/dev/null | cut -d' ' -f2 || echo "?")
        ENV_STATUS+=" / Python [$python_version]"
    elif command -v python >/dev/null 2>&1; then
        local python_version=$(python --version 2>/dev/null | cut -d' ' -f2 || echo "?")
        ENV_STATUS+=" / Python [$python_version]"
    else
        ENV_STATUS+=" / Python [X]"
    fi
    
    # Check Java
    if command -v java >/dev/null 2>&1; then
        local java_version=$(java -version 2>&1 | head -n1 | cut -d'"' -f2 | cut -d'.' -f1-2 || echo "?")
        ENV_STATUS+=" / Java [$java_version]"
    else
        ENV_STATUS+=" / Java [X]"
    fi
    
    # Check Flutter
    if command -v flutter >/dev/null 2>&1; then
        local flutter_version=$(flutter --version 2>/dev/null | head -n1 | cut -d' ' -f2 || echo "?")
        ENV_STATUS+=" / Flutter [$flutter_version]"
    else
        ENV_STATUS+=" / Flutter [X]"
    fi
    
    # Check Chrome/Chromium
    if command -v google-chrome >/dev/null 2>&1; then
        ENV_STATUS+=" / Chrome [OK]"
    elif command -v chromium >/dev/null 2>&1; then
        ENV_STATUS+=" / Chrome [Chromium]"
    elif command -v chrome >/dev/null 2>&1; then
        ENV_STATUS+=" / Chrome [OK]"
    else
        ENV_STATUS+=" / Chrome [X]"
    fi
    
    # Check PHP
    if command -v php >/dev/null 2>&1; then
        local php_version=$(php --version 2>/dev/null | head -n1 | cut -d' ' -f2 | cut -d'.' -f1-2 || echo "?")
        ENV_STATUS+=" / PHP [$php_version]"
    else
        ENV_STATUS+=" / PHP [X]"
    fi
}



# Function to check if directory contains package.json
is_vue_project() {
    local dir="$1"
    if [ -f "$dir/package.json" ]; then
        # Check for Vue-specific dependencies or scripts
        if grep -q -E "(vue|@vue|vite.*vue|nuxt)" "$dir/package.json" 2>/dev/null; then
            return 0
        fi
        # Check for common Vue development scripts
        if grep -q -E "\"(dev|serve|start)\".*:" "$dir/package.json" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Function to check if directory contains Laravel project
is_laravel_project() {
    local dir="$1"
    if [ -f "$dir/artisan" ] && [ -f "$dir/composer.json" ]; then
        if grep -q "laravel/framework" "$dir/composer.json" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Function to check if directory contains Node.js project with main.js
is_nodejs_project() {
    local dir="$1"
    if [ -f "$dir/main.js" ]; then
        return 0
    fi
    return 1
}

# Function to check if directory contains Flutter project
is_flutter_project() {
    local dir="$1"
    if [ -f "$dir/pubspec.yaml" ]; then
        if grep -q "flutter:" "$dir/pubspec.yaml" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Function to check if directory contains Python project with main.py
is_python_project() {
    local dir="$1"
    if [ -f "$dir/main.py" ]; then
        return 0
    fi
    return 1
}

# Function to detect project type
detect_project_type() {
    local dir="$1"
    
    if is_laravel_project "$dir"; then
        echo "Laravel"
    elif is_flutter_project "$dir"; then
        echo "Flutter"
    elif is_python_project "$dir"; then
        echo "Python"
    elif is_vue_project "$dir"; then
        echo "Vue"
    elif is_nodejs_project "$dir"; then
        echo "Node.js"
    else
        echo "Unknown"
    fi
}

# Function to scan poly apps directory and return list with .sh scripts
scan_poly_apps_directory() {
    local poly_apps=()

    if [ ! -d "$POLY_APPS_DIR" ]; then
        log_warning "Poly apps directory not found: $POLY_APPS_DIR"
        return 0
    fi

    log_info "Scanning poly apps directory: $POLY_APPS_DIR"

    # Find all first-level directories in poly_apps folder
    for app_dir in "$POLY_APPS_DIR"/*; do
        if [ -d "$app_dir" ]; then
            local app_name=$(basename "$app_dir")
            # Count .sh scripts in the directory
            local script_count=$(find "$app_dir" -maxdepth 1 -name "*.sh" -type f 2>/dev/null | wc -l)
            poly_apps+=("$app_name:PolyApp:$script_count")
        fi
    done

    printf '%s\n' "${poly_apps[@]}"
}

# Function to scan apps directory and return list
scan_apps_directory() {
    local apps=()

    if [ ! -d "$APPS_DIR" ]; then
        log_error "Apps directory not found: $APPS_DIR"
        return 1
    fi

    log_info "Scanning apps directory: $APPS_DIR"

    # Find all first-level directories in apps folder
    for app_dir in "$APPS_DIR"/*; do
        if [ -d "$app_dir" ]; then
            local app_name=$(basename "$app_dir")
            local project_type=$(detect_project_type "$app_dir")
            apps+=("$app_name:$project_type")
        fi
    done

    printf '%s\n' "${apps[@]}"
}




# Function to show interactive application menu
show_app_menu() {
    local apps_count=0
    local args=()
    
    # Parse arguments: first determine how many are apps vs additional args
    # Apps are in format "name:type", additional args don't contain ":"
    for arg in "$@"; do
        if [[ "$arg" == *":"* ]]; then
            ((apps_count++))
        else
            args+=("$arg")
        fi
    done
    
    # Extract apps array
    local apps=("${@:1:$apps_count}")
    # Extract remaining arguments (skip the apps)
    if [ $apps_count -gt 0 ]; then
        args=("${@:$((apps_count + 1))}")
    fi
    
    while true; do
        # Clear screen and show header
        printf "\033c"
        log_info "App Management System"
        echo "$ENV_STATUS"
        echo ""
        
        # Display apps table
        echo -e "${CYAN}Available Applications:${NC}"
        printf "%-4s %-30s %-15s %-10s\n" "No." "Application Name" "Project Type" "Scripts"

        local i=1
        for app in "${apps[@]}"; do
            local app_name=$(echo "$app" | cut -d':' -f1)
            local project_type=$(echo "$app" | cut -d':' -f2)
            local script_info=""

            # Check if it's a poly app (has script count)
            if [[ "$app" == *":"*":"* ]]; then
                local script_count=$(echo "$app" | cut -d':' -f3)
                script_info="${script_count} .sh"
            else
                script_info="ncore"
            fi

            printf " %-3s %-30s %-15s %-10s\n" "$i" "$app_name" "$project_type" "$script_info"
            ((i++))
        done
        
        echo ""
        echo "Additional Options:"
        printf " %-3s %-30s\n" "b" "Return to DD.sh Menu"
        printf " %-3s %-30s\n" "q" "Exit Program"
        echo ""
        echo "Enter app number (1-${#apps[@]}), 'b' to go back, or 'q' to quit:"
        
        # Read user input
        echo -n "Your choice: "
        read -r user_input
        
        case "$user_input" in
            [bB])  # B to go back
                log_info "Returning to DD.sh main menu..."
                return 0
                ;;
            [qQ])  # Q to quit
                log_info "Exiting program..."
                exit 0
                ;;
            [1-9]*)  # Number input
                # Validate number is within range
                if [[ "$user_input" =~ ^[0-9]+$ ]] && [ "$user_input" -ge 1 ] && [ "$user_input" -le ${#apps[@]} ]; then
                    local app_index=$((user_input - 1))
                    local app_info="${apps[$app_index]}"
                    local app_name=$(echo "$app_info" | cut -d':' -f1)
                    local project_type=$(echo "$app_info" | cut -d':' -f2)
                    
                    printf "\033c"
                    log_info "Selected: $app_name ($project_type)"
                    
                    # Run app based on type
                    run_app_by_type "$app_name" "$project_type" "${args[@]}"
                    
                    echo ""
                    echo "Press any key to continue..."
                    read -n 1
                else
                    echo "Invalid app number: '$user_input'"
                    echo "Please enter a number between 1 and ${#apps[@]}."
                    echo "Press any key to continue..."
                    read -n 1
                fi
                ;;
            "")  # Empty input
                echo "Please enter an app number, 'b' to go back, or 'q' to quit."
                echo "Press any key to continue..."
                read -n 1
                ;;
            *)  # Invalid input
                echo "Invalid input: '$user_input'"
                echo "Please enter an app number (1-${#apps[@]}), 'b' to go back, or 'q' to quit."
                echo "Press any key to continue..."
                read -n 1
                ;;
        esac
    done
}

# Function to run application by type
run_app_by_type() {
    local app_name="$1"
    local project_type="$2"
    shift 2
    local args=("$@")  # Capture all remaining arguments

    # Check if it's a poly app
    if [ "$project_type" = "PolyApp" ]; then
        run_poly_app "$app_name" "${args[@]}"
        return $?
    fi

    local app_dir="$APPS_DIR/$app_name"

    # Verify app exists
    if [ ! -d "$app_dir" ]; then
        log_error "Application directory not found: $app_dir"
        return 1
    fi
    
    log_info "Starting $project_type application: $app_name"
    if [ ${#args[@]} -gt 0 ]; then
        log_info "Arguments: ${args[*]}"
    fi
    
    # Check for startup scripts and show selection menu
    if show_startup_selection "$app_name" "$project_type" "${args[@]}"; then
        # User selected and ran a custom startup script successfully
        return 0
    fi
    
    # Continue with traditional startup if no custom script was selected or if it failed
    log_info "Using traditional startup method for $project_type application"
    
    # Run based on project type
    case "$project_type" in
        "Vue")
            if is_vue_project "$app_dir"; then
                run_vue_debug "$app_dir" "${args[@]}"
            else
                log_error "$app_name is not a valid Vue project"
            fi
            ;;
        "Laravel")
            if is_laravel_project "$app_dir"; then
                run_laravel_app "$app_dir" "${args[@]}"
            else
                log_error "$app_name is not a valid Laravel project"
            fi
            ;;
        "Node.js")
            if is_nodejs_project "$app_dir"; then
                run_nodejs_app "$app_name" "${args[@]}"
            else
                log_error "$app_name does not have main.js for Node.js execution"
            fi
            ;;
        "Flutter")
            if is_flutter_project "$app_dir"; then
                run_flutter_app "$app_dir" "${args[@]}"
            else
                log_error "$app_name is not a valid Flutter project"
            fi
            ;;
        "Python")
            if is_python_project "$app_dir"; then
                run_python_app "$app_dir" "${args[@]}"
            else
                log_error "$app_name is not a valid Python project"
            fi
            ;;
        "Unknown")
            log_warning "Unknown project type for $app_name"
            local manual_options=(
                "Try as Vue project"
                "Try as Laravel project"
                "Try as Node.js project"
                "Try as Flutter project"
                "Try as Python project"
                "Cancel"
            )
            arrow_menu_select "Select Project Runtime" manual_options 0 5
            manual_choice="$ARROW_MENU_SELECTED_INDEX"
            
            case $manual_choice in
                0) run_vue_debug "$app_dir" "${args[@]}" ;;
                1) run_laravel_app "$app_dir" "${args[@]}" ;;
                2) run_nodejs_app "$app_name" "${args[@]}" ;;
                3) run_flutter_app "$app_dir" "${args[@]}" ;;
                4) run_python_app "$app_dir" "${args[@]}" ;;
                5) log_info "Cancelled" ;;
            esac
            ;;
        *)
            log_error "Unsupported project type: $project_type"
            ;;
    esac
}

# Function to run selected application (legacy function, kept for compatibility)
run_selected_app() {
    local run_type="$1"
    local app_input="$2"
    shift 2
    local apps=("$@")
    
    local app_name=""
    local app_dir=""
    
    # Check if input is a number
    if [[ "$app_input" =~ ^[0-9]+$ ]]; then
        local app_index=$((app_input - 1))
        if [ $app_index -ge 0 ] && [ $app_index -lt ${#apps[@]} ]; then
            app_name=$(echo "${apps[$app_index]}" | cut -d':' -f1)
        else
            log_error "Invalid application number: $app_input"
            read -p "Press Enter to continue..."
            return 1
        fi
    else
        # Input is app name
        app_name="$app_input"
    fi
    
    app_dir="$APPS_DIR/$app_name"
    
    # Verify app exists
    if [ ! -d "$app_dir" ]; then
        log_error "Application directory not found: $app_dir"
        read -p "Press Enter to continue..."
        return 1
    fi
    
    log_info "Selected application: $app_name"
    
    # Run based on type
    case $run_type in
        "vue")
            if is_vue_project "$app_dir"; then
                run_vue_debug "$app_dir"
            else
                log_error "$app_name is not a Vue project"
            fi
            ;;
        "laravel")
            if is_laravel_project "$app_dir"; then
                run_laravel_app "$app_dir"
            else
                log_error "$app_name is not a Laravel project"
            fi
            ;;
        "nodejs")
            if is_nodejs_project "$app_dir"; then
                run_nodejs_app "$app_name"
            else
                log_error "$app_name does not have main.js for Node.js execution"
            fi
            ;;
        "flutter")
            if is_flutter_project "$app_dir"; then
                run_flutter_app "$app_dir"
            else
                log_error "$app_name is not a Flutter project"
            fi
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
}

# Main function
main() {
    # Initialize environment status once at startup
    init_env_status
    
    log_info "App Management System Starting..."
    log_info "Original directory: $ORIGINAL_DIR"
    log_info "DD.sh directory: $DD_SH_DIR"
    log_info "Apps directory: $APPS_DIR"
    log_info "Poly Apps directory: $POLY_APPS_DIR"

    # Scan for traditional applications
    local apps_list
    apps_list=$(scan_apps_directory)

    # Scan for poly applications
    local poly_apps_list
    poly_apps_list=$(scan_poly_apps_directory)

    # Combine both lists
    local combined_list=""
    if [ -n "$apps_list" ]; then
        combined_list="$apps_list"
    fi
    if [ -n "$poly_apps_list" ]; then
        if [ -n "$combined_list" ]; then
            combined_list="$combined_list"$'\n'"$poly_apps_list"
        else
            combined_list="$poly_apps_list"
        fi
    fi

    if [ -z "$combined_list" ]; then
        log_error "No applications found in both apps and poly_apps directories. Exiting..."
        return 1
    fi

    # Convert to array
    local apps=()
    while IFS= read -r line; do
        [ -n "$line" ] && apps+=("$line")
    done <<< "$combined_list"

    # Count traditional and poly apps
    local traditional_count=0
    local poly_count=0
    for app in "${apps[@]}"; do
        if [[ "$app" == *":PolyApp:"* ]]; then
            ((poly_count++))
        else
            ((traditional_count++))
        fi
    done

    log_success "Found ${#apps[@]} application(s) total: $traditional_count traditional apps, $poly_count poly apps"
    
    # Show application menu with additional arguments
    show_app_menu "${apps[@]}" "$@"
    
    log_info "App management completed."
}

# Execute main function
main "$@"
