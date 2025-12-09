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
VAR_DIR="${PROJECT_ROOT}/.build_vars"
CMD_DIR="${VAR_DIR}/commands"
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

    local type_file="${CMD_DIR}/${APP_PREFIX}_COMMAND_${index}_${FIELD_CMD_TYPE}"
    local desc_file="${CMD_DIR}/${APP_PREFIX}_COMMAND_${index}_${FIELD_CMD_DESC}"
    local workdir_file="${CMD_DIR}/${APP_PREFIX}_COMMAND_${index}_${FIELD_CMD_WORKDIR}"

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
            initialize_capacitor "$arg1" "$arg2"
            ;;
        add_android_platform)
            add_android_platform
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
        build_android_apk)
            build_android_apk
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
    local app_name="$1"
    local package_id="$2"

    print_section "Initializing Capacitor"

    local project_root=$(get_var_value "$KEY_PROJECT_ROOT")
    local display_name_en=$(get_var_value "$KEY_DISPLAY_NAME_EN")
    local display_name_cn=$(get_var_value "DISPLAY_NAME_CN")
    local description=$(get_var_value "DESCRIPTION")

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

    cd "$project_root"

    print_command "npx cap init \"$app_name\" \"$package_id\""

    # Capture output to check for errors
    local output
    output=$(npx cap init "$app_name" "$package_id" 2>&1)
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        print_color "$COLOR_RED" "[ERROR] Capacitor initialization failed"
        echo "$output"

        # Check if error is about non-JSON config file
        if echo "$output" | grep -q "non-JSON configuration file\|capacitor.config.ts"; then
            echo ""
            print_color "$COLOR_YELLOW" "[Warning] Found existing Capacitor configuration file(s)"

            local config_files=()
            if [ -f "$project_root/capacitor.config.ts" ]; then
                config_files+=("capacitor.config.ts")
            fi
            if [ -f "$project_root/capacitor.config.js" ]; then
                config_files+=("capacitor.config.js")
            fi

            if [ ${#config_files[@]} -gt 0 ]; then
                print_color "$COLOR_CYAN" "[Info] Found: ${config_files[*]}"
                echo ""
                echo "Capacitor requires a JSON configuration file for initialization."
                echo "The existing TypeScript/JavaScript config will be removed."
                echo ""

                # Prompt user
                read -p "Delete config file(s) and reinitialize? [Y/n]: " confirmation

                if [[ "$confirmation" =~ ^[Yy]$ ]] || [ -z "$confirmation" ]; then
                    echo ""
                    print_color "$COLOR_YELLOW" "[Action] Removing existing configuration files..."

                    # Remove existing config files
                    for config_file in "${config_files[@]}"; do
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
                    print_color "$COLOR_YELLOW" "[Capacitor] Retrying initialization..."

                    # Retry initialization
                    print_command "npx cap init \"$app_name\" \"$package_id\""
                    if npx cap init "$app_name" "$package_id"; then
                        print_color "$COLOR_GREEN" "[Success] Capacitor initialized successfully"
                    else
                        print_color "$COLOR_RED" "[ERROR] Capacitor initialization failed again"
                    fi
                else
                    echo ""
                    print_color "$COLOR_YELLOW" "[Skipped] Capacitor initialization cancelled by user"
                    print_color "$COLOR_CYAN" "[Info] You can manually delete the config files and run initialization again"
                fi
            fi
        fi
    else
        print_color "$COLOR_GREEN" "[Success] Capacitor initialized successfully"
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

    print_command "./gradlew assembleDebug"
    if ./gradlew assembleDebug; then
        print_color "$COLOR_GREEN" "[Success] Android build completed"
        print_color "$COLOR_CYAN" "[Output] APK location: android/app/build/outputs/apk/debug/"
    else
        print_color "$COLOR_RED" "[ERROR] Android build failed"
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

# Check for errors
error_msg=$(get_var_value "$KEY_ERROR")

if [ -n "$error_msg" ]; then
    print_color "$COLOR_RED" "[ERROR] Python reported error: $error_msg"
    exit 1
fi

# Get command count
command_count=$(get_command_count)

if [ "$command_count" -eq 0 ]; then
    print_color "$COLOR_YELLOW" "[WARNING] No commands to execute"
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
