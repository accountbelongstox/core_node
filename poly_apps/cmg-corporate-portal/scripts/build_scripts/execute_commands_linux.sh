#!/bin/bash
# ============================================
# Linux Variable Reader and Command Executor (Refactored)
# Reads file variables directly (no JSON, no Python)
# Each variable is a separate file: filename=KEY, content=VALUE
# ============================================

set -e

# ============================================
# VARIABLE DECLARATIONS
# ============================================

PROJECT_ROOT="$1"

# Determine global variable directory based on permissions
GLOBAL_VAR_DIR="/var/_core_node/_build_global_vars"

# Check if we have write permission to /var/_core_node or /var
if [ -w "/var/_core_node" ] 2>/dev/null || [ -w "/var" ] 2>/dev/null; then
    VAR_DIR="$GLOBAL_VAR_DIR"
else
    # Fallback to user home if no permission
    VAR_DIR="$HOME/.core_node/.build_global_vars"
    echo "[WARNING] No write permission to /var, using fallback: $VAR_DIR"
fi

# Ensure directory exists
mkdir -p "$VAR_DIR"
echo "[FileVarSystem] Global variable directory: $VAR_DIR"

APP_PREFIX=""

# Colors
COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[0;33m'
COLOR_CYAN='\033[0;36m'
COLOR_GRAY='\033[0;90m'
COLOR_RESET='\033[0m'

# ============================================
# KEY CENTER - Shared with Python and Windows
# ============================================

# Import key definitions from key_center.py
KEY_PROJECT_ROOT="PROJECT_ROOT"
KEY_ANDROID_PATH="ANDROID_PATH"
KEY_PACKAGE_JSON_PATH="PACKAGE_JSON_PATH"
KEY_PACKAGE_JSON_BACKUP_PATH="PACKAGE_JSON_BACKUP_PATH"

KEY_APP_NAME="APP_NAME"
KEY_DISPLAY_NAME_EN="DISPLAY_NAME_EN"
KEY_PACKAGE_ID="PACKAGE_ID"

KEY_COMMAND_COUNT="COMMAND_COUNT"

KEY_PYTHON_SUCCESS="PYTHON_SUCCESS"
KEY_ERROR="ERROR"

# Command fields
FIELD_CMD_TYPE="TYPE"
FIELD_CMD_DESC="DESC"
FIELD_CMD_WORKDIR="WORKDIR"

# ============================================
# UTILITY FUNCTIONS
# ============================================

print_color() {
    local color=$1
    shift
    echo -e "${color}$@${COLOR_RESET}"
}

print_header() {
    echo ""
    print_color "$COLOR_CYAN" "============================================"
    print_color "$COLOR_CYAN" "$1"
    print_color "$COLOR_CYAN" "============================================"
    echo ""
}

print_section() {
    echo ""
    print_color "$COLOR_YELLOW" "--------------------------------------------"
    print_color "$COLOR_YELLOW" "$1"
    print_color "$COLOR_YELLOW" "--------------------------------------------"
}

# ============================================
# VARIABLE SYSTEM FUNCTIONS (NO JSON, NO PYTHON)
# ============================================

find_app_prefix() {
    if [ ! -d "$VAR_DIR" ]; then
        return 1
    fi

    # Find first variable file (not command file)
    local var_file=$(find "$VAR_DIR" -maxdepth 1 -type f ! -name "*COMMAND*" | head -n 1)
    if [ -z "$var_file" ]; then
        return 1
    fi

    local filename=$(basename "$var_file")

    # Extract prefix (e.g., "CMG_PORTAL_APP_NAME" -> "CMG_PORTAL")
    # Try to find where known key starts
    if [[ "$filename" =~ _PROJECT_ROOT$ ]]; then
        APP_PREFIX="${filename%_PROJECT_ROOT}"
    elif [[ "$filename" =~ _APP_NAME$ ]]; then
        APP_PREFIX="${filename%_APP_NAME}"
    elif [[ "$filename" =~ _PACKAGE_ID$ ]]; then
        APP_PREFIX="${filename%_PACKAGE_ID}"
    elif [[ "$filename" =~ _ANDROID_PATH$ ]]; then
        APP_PREFIX="${filename%_ANDROID_PATH}"
    else
        # Fallback: assume prefix is everything before last underscore
        APP_PREFIX="${filename%_*}"
    fi

    return 0
}

get_var_value() {
    # Read a variable value from file
    local key="$1"
    local var_file="${VAR_DIR}/${APP_PREFIX}_${key}"

    if [ ! -f "$var_file" ]; then
        echo ""
        return 1
    fi

    cat "$var_file" | tr -d '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

get_var_as_list() {
    # Read a variable as a list (newline-separated values)
    local key="$1"
    local var_file="${VAR_DIR}/${APP_PREFIX}_${key}"

    if [ ! -f "$var_file" ]; then
        return 1
    fi

    # Read file and return space-separated values
    cat "$var_file" | grep -v '^[[:space:]]*$' | tr '\n' ' ' | sed 's/[[:space:]]*$//'
}

get_command_count() {
    # Get the number of commands
    local count_str=$(get_var_value "$KEY_COMMAND_COUNT")

    if [ -z "$count_str" ]; then
        echo "0"
        return
    fi

    echo "$count_str"
}

get_command() {
    # Get a command by index
    local index="$1"

    local type_file="${VAR_DIR}/${APP_PREFIX}_COMMAND_${index}_${FIELD_CMD_TYPE}"
    local desc_file="${VAR_DIR}/${APP_PREFIX}_COMMAND_${index}_${FIELD_CMD_DESC}"
    local workdir_file="${VAR_DIR}/${APP_PREFIX}_COMMAND_${index}_${FIELD_CMD_WORKDIR}"

    if [ ! -f "$type_file" ]; then
        return 1
    fi

    local cmd_type=$(cat "$type_file" | tr -d '\n')
    local cmd_desc=""
    local cmd_workdir=""

    if [ -f "$desc_file" ]; then
        cmd_desc=$(cat "$desc_file" | tr -d '\n')
    fi

    if [ -f "$workdir_file" ]; then
        cmd_workdir=$(cat "$workdir_file" | tr -d '\n')
    fi

    # Output as pipe-separated values
    echo "${cmd_type}|${cmd_desc}|${cmd_workdir}"
}

# ============================================
# COMMAND EXECUTION FUNCTIONS
# ============================================

print_command() {
    # Print command before execution
    local cmd_text="$1"
    print_color "$COLOR_GRAY" "[CMD] $cmd_text"
}

# ============================================
# HELPER FUNCTIONS (Code Reuse)
# ============================================

invoke_project_command() {
    # Execute a command in project directory with automatic error handling
    local command="$1"
    local description="$2"
    local work_dir="${3:-$(get_var_value "$KEY_PROJECT_ROOT")}"
    local no_error_check="${4:-false}"

    cd "$work_dir"

    print_command "$command"

    if eval "$command"; then
        if [ "$no_error_check" != "true" ]; then
            print_color "$COLOR_GREEN" "[Success] $description completed"
        fi
        return 0
    else
        if [ "$no_error_check" != "true" ]; then
            print_color "$COLOR_RED" "[ERROR] $description failed"
        fi
        return 1
    fi
}

test_required_path() {
    # Verify that a required path exists
    local path="$1"
    local description="$2"
    local type="${3:-file}"

    if [ "$type" = "file" ]; then
        if [ ! -f "$path" ]; then
            print_color "$COLOR_RED" "[ERROR] $description not found at: $path"
            return 1
        fi
    else
        if [ ! -d "$path" ]; then
            print_color "$COLOR_RED" "[ERROR] $description not found at: $path"
            return 1
        fi
    fi

    return 0
}

confirm_user_action() {
    # Ask user for confirmation with Y/N prompt
    local prompt_message="$1"
    local warning_message="$2"
    local default_answer="${3:-N}"

    if [ -n "$warning_message" ]; then
        echo ""
        print_color "$COLOR_YELLOW" "$warning_message"
        echo ""
    fi

    local prompt_suffix
    if [ "$default_answer" = "Y" ]; then
        prompt_suffix="[Y/n]"
    else
        prompt_suffix="[y/N]"
    fi

    read -p "$prompt_message $prompt_suffix: " confirmation

    if [ "$default_answer" = "Y" ]; then
        if [[ "$confirmation" =~ ^[Nn]$ ]]; then
            return 1
        else
            return 0
        fi
    else
        if [[ "$confirmation" =~ ^[Yy]$ ]]; then
            return 0
        else
            return 1
        fi
    fi
}

backup_path_with_timestamp() {
    # Create timestamped backup of file or directory
    local source_path="$1"
    local type="${2:-file}"
    local use_rename="${3:-false}"

    if [ ! -e "$source_path" ]; then
        print_color "$COLOR_YELLOW" "[Backup] Source not found, skipping: $source_path"
        return 1
    fi

    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_path="${source_path}_backup_$timestamp"

    if [ -e "$backup_path" ]; then
        print_color "$COLOR_YELLOW" "[Backup] Backup already exists: $backup_path"
        echo "$backup_path"
        return 0
    fi

    if [ "$use_rename" = "true" ]; then
        print_command "mv \"$source_path\" \"$backup_path\""
        mv "$source_path" "$backup_path"
    else
        print_command "cp -r \"$source_path\" \"$backup_path\""
        cp -r "$source_path" "$backup_path"
    fi

    if [ $? -eq 0 ]; then
        print_color "$COLOR_GREEN" "[Backup] Created: $(basename "$backup_path")"
        echo "$backup_path"
        return 0
    else
        print_color "$COLOR_RED" "[ERROR] Backup failed"
        return 1
    fi
}

# ============================================
# COMMAND EXECUTOR
# ============================================

execute_command() {
    local command_type="$1"

    # Parse command type (pipe-separated)
    IFS='|' read -r cmd arg1 arg2 <<< "$command_type"

    case "$cmd" in
        pnpm_install)
            run_pnpm_install
            ;;
        backup_package_json)
            backup_package_json
            ;;
        init_capacitor)
            # No parameter parsing - all data read from file variables
            initialize_capacitor
            ;;
        add_android_platform)
            add_android_platform
            ;;
        remove_android_platform)
            remove_android_platform
            ;;
        start_dev_server)
            start_dev_server
            ;;
        build_web)
            build_web
            ;;
        sync_capacitor_android)
            sync_capacitor_android
            ;;
        pnpm_remove)
            # Parse command: pnpm_remove|package1 package2 package3
            packages="${cmd_type#*|}"
            print_section "Removing Capacitor Packages"
            project_root=$(get_var_value "$KEY_PROJECT_ROOT")
            print_color "$COLOR_GRAY" "[Work Dir] $project_root"
            cd "$project_root"
            echo "[CMD] pnpm remove $packages"
            # Pass packages as separate arguments
            pnpm remove $packages
            ;;
        pnpm_add)
            # Parse command: pnpm_add|package1@latest package2@latest
            packages="${cmd_type#*|}"
            print_section "Installing Capacitor Packages"
            project_root=$(get_var_value "$KEY_PROJECT_ROOT")
            print_color "$COLOR_GRAY" "[Work Dir] $project_root"
            cd "$project_root"
            echo "[CMD] pnpm add $packages"
            # Pass packages as separate arguments
            pnpm add $packages
            ;;
        build_android_apk)
            build_android_apk
            ;;
        capacitor_assets_generate)
            generate_capacitor_assets
            ;;
        *)
            print_color "$COLOR_YELLOW" "[WARNING] Unknown command: $cmd"
            ;;
    esac
}

run_pnpm_install() {
    print_section "Installing Packages"

    local project_root=$(get_var_value "$KEY_PROJECT_ROOT")
    local packages_added=$(get_var_value "PACKAGES_ADDED")
    local packages_existing=$(get_var_value "PACKAGES_EXISTING")

    print_color "$COLOR_CYAN" "[Install] Installing $packages_added new Capacitor packages..."
    if [ "$packages_existing" -gt 0 ]; then
        print_color "$COLOR_GRAY" "[Install] ($packages_existing packages already in package.json)"
    fi

    cd "$project_root"

    print_command "pnpm install"
    if pnpm install; then
        print_color "$COLOR_GREEN" "[Success] All packages installed successfully"
    else
        print_color "$COLOR_RED" "[ERROR] pnpm install failed"
    fi
}

backup_package_json() {
    local package_json=$(get_var_value "$KEY_PACKAGE_JSON_PATH")
    local backup_path=$(get_var_value "$KEY_PACKAGE_JSON_BACKUP_PATH")

    if [ -f "$backup_path" ]; then
        print_color "$COLOR_GREEN" "[Backup] package.json.backup already exists, skipping"
    else
        if [ -f "$package_json" ]; then
            print_command "cp \"$package_json\" \"$backup_path\""
            cp "$package_json" "$backup_path"
            print_color "$COLOR_GREEN" "[Backup] Created package.json.backup"
        fi
    fi
}

initialize_capacitor() {
    print_section "Initializing Capacitor"

    # Read all variables from file system (no direct parameter passing)
    local project_root=$(get_var_value "$KEY_PROJECT_ROOT")
    local app_name=$(get_var_value "$KEY_APP_NAME")
    local package_id=$(get_var_value "$KEY_PACKAGE_ID")
    local display_name_en=$(get_var_value "$KEY_DISPLAY_NAME_EN")
    local display_name_cn=$(get_var_value "DISPLAY_NAME_CN")
    local description=$(get_var_value "DESCRIPTION")

    local capacitor_config_ts="$project_root/capacitor.config.ts"
    local capacitor_config_js="$project_root/capacitor.config.js"

    print_color "$COLOR_CYAN" "[Config] App Name (Technical): $app_name"
    if [ -n "$display_name_en" ]; then
        print_color "$COLOR_CYAN" "[Config] Display Name (EN): $display_name_en"
    fi
    if [ -n "$display_name_cn" ]; then
        print_color "$COLOR_CYAN" "[Config] Display Name (CN): $display_name_cn"
    fi
    print_color "$COLOR_CYAN" "[Config] Package ID: $package_id"
    if [ -n "$description" ]; then
        print_color "$COLOR_GRAY" "[Config] Description: $description"
    fi

    # Check for existing non-JSON config files before running init
    local existing_configs=()
    if [ -f "$capacitor_config_ts" ]; then
        existing_configs+=("capacitor.config.ts")
    fi
    if [ -f "$capacitor_config_js" ]; then
        existing_configs+=("capacitor.config.js")
    fi

    # If non-JSON config exists, ask user to delete first
    if [ ${#existing_configs[@]} -gt 0 ]; then
        echo ""
        print_color "$COLOR_YELLOW" "[Warning] Found existing Capacitor configuration file(s)"
        print_color "$COLOR_CYAN" "[Info] Found: ${existing_configs[*]}"
        echo ""
        echo "Capacitor requires a JSON configuration file for initialization."
        echo "The existing TypeScript/JavaScript config will be removed."
        echo ""

        # Prompt user (default No)
        read -p "Delete config file(s) and reinitialize? [y/N]: " confirmation

        if [[ "$confirmation" =~ ^[Yy]$ ]]; then
            echo ""
            print_color "$COLOR_YELLOW" "[Action] Removing existing configuration files..."

            # Remove existing config files
            for config_file in "${existing_configs[@]}"; do
                local full_path="$project_root/$config_file"
                if [ -f "$full_path" ]; then
                    # Backup first
                    print_command "cp \"$full_path\" \"$full_path.backup\""
                    cp "$full_path" "$full_path.backup"
                    print_color "$COLOR_GREEN" "[Backup] Created backup: $config_file.backup"

                    print_command "rm -f \"$full_path\""
                    rm -f "$full_path"
                    print_color "$COLOR_GREEN" "[Removed] Deleted: $config_file"
                fi
            done
            echo ""
        else
            echo ""
            print_color "$COLOR_YELLOW" "[Skipped] Capacitor initialization cancelled by user"
            print_color "$COLOR_CYAN" "[Info] You can manually delete the config files and run initialization again"
            return
        fi
    fi

    # Execute Capacitor init command (no exit code checking)
    cd "$project_root"
    print_command "npx cap init \"$app_name\" \"$package_id\""
    npx cap init "$app_name" "$package_id"
    echo ""
}

remove_android_platform() {
    print_section "Removing Android Platform"

    local project_root=$(get_var_value "$KEY_PROJECT_ROOT")
    local android_path="$project_root/android"

    if [ ! -d "$android_path" ]; then
        print_color "$COLOR_YELLOW" "[Info] Android folder does not exist. Nothing to remove."
        return
    fi

    print_color "$COLOR_YELLOW" "[Action] Removing Android platform folder..."
    print_color "$COLOR_GRAY" "[Path] $android_path"

    # Delete the folder (as recommended by Capacitor community)
    # Reference: https://forum.ionicframework.com/t/how-to-remove-android-platform/211263
    print_command "rm -rf \"$android_path\""
    if rm -rf "$android_path"; then
        print_color "$COLOR_GREEN" "[Success] Android folder removed successfully"
        print_color "$COLOR_CYAN" "[Info] You can now run 'npx cap add android' to create a fresh Android project"
    else
        print_color "$COLOR_RED" "[ERROR] Failed to remove android directory"
        print_color "$COLOR_YELLOW" "[TIP] Close Android Studio and try again"
        return 1
    fi
}

add_android_platform() {
    print_section "Adding Android Platform"

    local project_root=$(get_var_value "$KEY_PROJECT_ROOT")
    local android_path="$project_root/android"

    cd "$project_root"

    # Check if Android platform already exists
    if [ -d "$android_path" ]; then
        echo ""
        print_color "$COLOR_YELLOW" "[Warning] Android platform already exists at: ./android"
        echo ""
        echo "To re-add this platform, the existing android directory must be removed."
        echo "WARNING: Your native Android project will be completely removed."
        echo ""

        # Prompt user
        read -p "Remove existing android directory and re-add platform? [y/N]: " confirmation

        if [[ "$confirmation" =~ ^[Yy]$ ]]; then
            echo ""
            print_color "$COLOR_YELLOW" "[Action] Removing existing Android platform..."

            # Backup directory name
            local timestamp=$(date +"%Y%m%d_%H%M%S")
            local backup_path="${android_path}_backup_$timestamp"

            # Rename instead of delete for safety
            print_command "mv \"$android_path\" \"$backup_path\""
            if mv "$android_path" "$backup_path"; then
                print_color "$COLOR_GREEN" "[Backup] Moved to: ./android_backup_$timestamp"
            else
                print_color "$COLOR_RED" "[ERROR] Failed to remove android directory"
                return 1
            fi

            echo ""
            print_color "$COLOR_YELLOW" "[Capacitor] Adding Android platform..."
            print_command "npx cap add android"
            if npx cap add android; then
                print_color "$COLOR_GREEN" "[Success] Android platform added successfully"
            else
                print_color "$COLOR_RED" "[ERROR] Failed to add Android platform"
                return 1
            fi
        else
            echo ""
            print_color "$COLOR_CYAN" "[Info] Android platform addition cancelled by user"
            return 0
        fi
    else
        # Android platform doesn't exist, add it normally
        print_command "npx cap add android"
        if npx cap add android; then
            print_color "$COLOR_GREEN" "[Success] Android platform added successfully"
        else
            print_color "$COLOR_RED" "[ERROR] Failed to add Android platform"
            return 1
        fi
    fi

    # After successful addition, scan and preview resources
    if [ -d "$android_path" ]; then
        echo ""
        print_color "$COLOR_CYAN" "[Preview] Scanning Android resources..."

        # Get build scripts directory
        local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        local scanner_script="$script_dir/resource_scanner.py"

        if [ -f "$scanner_script" ]; then
            # Run Python script to scan and preview
            print_command "python3 -c \"<scan and preview resources>\""
            python3 -c "
import sys
sys.path.insert(0, r'$script_dir')
from resource_scanner import ResourceScanner
from web_preview_server import show_preview

scanner = ResourceScanner(r'$android_path')
resource_data = scanner.get_full_report()

print('\n[Preview] Launching resource preview server...')
show_preview(resource_data, port=8899)
"
            echo ""
            print_color "$COLOR_GREEN" "[Preview] Preview closed"
        fi
    fi
}

generate_capacitor_assets() {
    print_section "Generating Capacitor Assets"

    local project_root=$(get_var_value "$KEY_PROJECT_ROOT")
    local run_assets=$(get_var_value "RUN_CAPACITOR_ASSETS")

    if [ "$run_assets" != "true" ]; then
        print_color "$COLOR_YELLOW" "[Skip] Capacitor assets generation skipped (no valid icon provided)"
        return
    fi

    cd "$project_root"

    print_color "$COLOR_CYAN" "[Assets] Generating Android resources using Capacitor official tool..."
    print_command "npx @capacitor/assets generate --android"

    if npx @capacitor/assets generate --android; then
        print_color "$COLOR_GREEN" "[Success] Capacitor assets generated successfully"
        print_color "$COLOR_GRAY" "[Info] All Android icon densities have been auto-generated"
    else
        print_color "$COLOR_RED" "[ERROR] Capacitor assets generation failed"
        print_color "$COLOR_YELLOW" "[INFO] Make sure @capacitor/assets is installed: pnpm add -D @capacitor/assets"
    fi
}

start_dev_server() {
    print_header "Starting Development Server"

    local project_root=$(get_var_value "$KEY_PROJECT_ROOT")

    cd "$project_root"

    print_command "pnpm run dev"
    pnpm run dev
}

build_web() {
    print_section "Building Web Assets"

    invoke_project_command "pnpm run build" "Web build"
}

sync_capacitor_android() {
    print_section "Syncing Capacitor"

    invoke_project_command "npx cap sync android" "Capacitor sync"
}

build_android_apk() {
    print_section "Building Android APK"

    local android_path=$(get_var_value "$KEY_ANDROID_PATH")
    local gradlew_path="${android_path}/gradlew"

    if ! test_required_path "$gradlew_path" "Gradle wrapper" "file"; then
        return 1
    fi

    cd "$android_path"

    # Check if we should stop Gradle Daemon before build (prevents cache corruption)
    local stop_daemon_flag=$(get_var_value "STOP_GRADLE_DAEMON_BEFORE_BUILD")
    if [ "$stop_daemon_flag" = "true" ]; then
        print_color "$COLOR_CYAN" "[Gradle] Stopping Gradle Daemon to prevent cache issues..."
        print_command "./gradlew --stop"
        ./gradlew --stop
        sleep 2
        print_color "$COLOR_GREEN" "[Gradle] Daemon stopped successfully"
        echo ""
    fi

    # First attempt
    print_command "./gradlew assembleDebug"
    if ./gradlew assembleDebug; then
        print_color "$COLOR_GREEN" "[Success] Android build completed"
    else
        print_color "$COLOR_RED" "[ERROR] Android build failed"
        print_color "$COLOR_YELLOW" "[INFO] Attempting to clean Gradle cache and retry..."

        # Step 1: Stop all Gradle Daemon processes (official solution)
        echo ""
        print_color "$COLOR_CYAN" "[Gradle] Stopping all Gradle Daemon processes..."
        print_command "./gradlew --stop"
        ./gradlew --stop
        sleep 2

        # Step 2: Clean build directory
        echo ""
        print_color "$COLOR_CYAN" "[Gradle] Cleaning build directory..."
        print_command "./gradlew clean"
        ./gradlew clean

        # Step 3: Clean Gradle user cache (common location for corrupted files)
        local gradle_cache_dir="$HOME/.gradle/caches"
        if [ -d "$gradle_cache_dir" ]; then
            print_color "$COLOR_CYAN" "[Gradle] Clearing Gradle caches at: $gradle_cache_dir"
            rm -rf "$gradle_cache_dir"/* 2>/dev/null
            if [ $? -eq 0 ]; then
                print_color "$COLOR_GREEN" "[Gradle] Cache cleared successfully"
            else
                print_color "$COLOR_YELLOW" "[Gradle] Warning: Could not fully clear cache (some files may be in use)"
            fi
        fi

        # Step 4: Retry build
        echo ""
        print_color "$COLOR_CYAN" "[Gradle] Retrying build..."
        print_command "./gradlew assembleDebug"
        if ./gradlew assembleDebug; then
            print_color "$COLOR_GREEN" "[Success] Android APK built successfully after retry"
        else
            print_color "$COLOR_RED" "[ERROR] Android build failed after cache cleanup"
            print_color "$COLOR_YELLOW" "[SOLUTION] Try manually running:"
            print_color "$COLOR_GRAY" "  cd android"
            print_color "$COLOR_GRAY" "  ./gradlew --stop"
            print_color "$COLOR_GRAY" "  ./gradlew clean build --refresh-dependencies"
        fi
    fi

    # Show APK location if exists
    local apk_path="app/build/outputs/apk/debug/app-debug.apk"
    if [ -f "$apk_path" ]; then
        local full_path=$(readlink -f "$apk_path")
        echo ""
        print_color "$COLOR_GREEN" "[APK] $full_path"

        # Print adb install commands
        echo ""
        print_color "$COLOR_CYAN" "=== ADB Install Commands ==="
        print_color "$COLOR_YELLOW" "Install APK to device:"
        echo "  adb install -r \"$full_path\""
        echo ""
        print_color "$COLOR_YELLOW" "Push APK to device storage:"
        echo "  adb push \"$full_path\" /sdcard/Download/"
        echo ""
        print_color "$COLOR_YELLOW" "Install from device storage:"
        echo "  adb shell pm install -r /sdcard/Download/app-debug.apk"
        print_color "$COLOR_CYAN" "============================"
        echo ""
    else
        print_color "$COLOR_CYAN" "[Output] APK location: android/app/build/outputs/apk/debug/"
    fi
}

# ============================================
# MAIN EXECUTION
# ============================================

print_header "Linux Command Executor (Refactored)"

# Find app prefix
if ! find_app_prefix; then
    print_color "$COLOR_RED" "[ERROR] No variable files found in: $VAR_DIR"
    print_color "$COLOR_RED" "[ERROR] Did Python controller run successfully?"
    exit 1
fi

print_color "$COLOR_GREEN" "[Shell] Found app prefix: $APP_PREFIX"

# Check for Python success
python_success=$(get_var_value "$KEY_PYTHON_SUCCESS")

if [ "$python_success" != "true" ]; then
    print_color "$COLOR_RED" "[ERROR] Python controller did not complete successfully"
    exit 1
fi

# Get command count
command_count=$(get_command_count)

if [ "$command_count" -eq 0 ]; then
    print_color "$COLOR_CYAN" "[INFO] No commands to execute (user may have cancelled)"
    exit 0
fi

print_color "$COLOR_CYAN" "[Shell] Executing $command_count commands..."
echo ""

# Execute each command
for (( i=0; i<$command_count; i++ )); do
    cmd_info=$(get_command $i)

    if [ -n "$cmd_info" ]; then
        IFS='|' read -r cmd_type cmd_desc cmd_workdir <<< "$cmd_info"

        if [ -n "$cmd_desc" ]; then
            print_color "$COLOR_CYAN" "[Execute] $cmd_desc"
        fi

        execute_command "$cmd_type"
    fi
done

echo ""
print_header "Execution Complete"
