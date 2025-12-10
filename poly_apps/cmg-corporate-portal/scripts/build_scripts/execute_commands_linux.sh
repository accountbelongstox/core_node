#!/bin/bash
# ============================================
# Linux Variable Reader and Command Executor
# Reads file variables and executes commands
# ============================================

set -e

# ============================================
# VARIABLE DECLARATIONS
# ============================================

PROJECT_ROOT="$1"
VAR_DIR="${PROJECT_ROOT}/.build_vars"
APP_PREFIX=""

# Colors
COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[0;33m'
COLOR_CYAN='\033[0;36m'
COLOR_GRAY='\033[0;90m'
COLOR_RESET='\033[0m'

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
# VARIABLE SYSTEM FUNCTIONS
# ============================================

find_app_prefix() {
    if [ ! -d "$VAR_DIR" ]; then
        return 1
    fi

    local var_file=$(ls "${VAR_DIR}"/*_vars.json 2>/dev/null | head -n 1)
    if [ -z "$var_file" ]; then
        return 1
    fi

    local filename=$(basename "$var_file")
    APP_PREFIX="${filename%_vars.json}"
    return 0
}

load_variable() {
    local key="$1"
    local var_file="${VAR_DIR}/${APP_PREFIX}_vars.json"

    if [ ! -f "$var_file" ]; then
        echo ""
        return 1
    fi

    # Use python or jq to parse JSON
    if command -v python3 &> /dev/null; then
        python3 -c "import json; data=json.load(open('$var_file')); print(data.get('${APP_PREFIX}_${key}', ''))"
    elif command -v jq &> /dev/null; then
        jq -r ".${APP_PREFIX}_${key} // empty" "$var_file"
    else
        print_color "$COLOR_RED" "[ERROR] Neither python3 nor jq found for JSON parsing"
        return 1
    fi
}

load_all_variables() {
    local var_file="${VAR_DIR}/${APP_PREFIX}_vars.json"

    if [ ! -f "$var_file" ]; then
        print_color "$COLOR_RED" "[ERROR] Variable file not found: $var_file"
        return 1
    fi

    if command -v python3 &> /dev/null; then
        python3 -c "
import json
with open('$var_file') as f:
    data = json.load(f)
    for key, value in data.items():
        if key.startswith('${APP_PREFIX}_'):
            clean_key = key[len('${APP_PREFIX}_')+1:]
            # Export as environment variable
            print(f'export VAR_{clean_key}=\"{value}\"')
"
    else
        print_color "$COLOR_RED" "[ERROR] python3 required for variable loading"
        return 1
    fi
}

load_commands() {
    local cmd_file="${VAR_DIR}/${APP_PREFIX}_commands.json"

    if [ ! -f "$cmd_file" ]; then
        print_color "$COLOR_RED" "[ERROR] Command file not found: $cmd_file"
        return 1
    fi

    if command -v python3 &> /dev/null; then
        python3 -c "
import json
with open('$cmd_file') as f:
    commands = json.load(f)
    for i, cmd in enumerate(commands):
        print(f'{i}|{cmd[\"command\"]}|{cmd.get(\"description\", \"\")}|{cmd.get(\"working_dir\", \"\")}')
"
    else
        print_color "$COLOR_RED" "[ERROR] python3 required for command loading"
        return 1
    fi
}

# ============================================
# COMMAND EXECUTION FUNCTIONS
# ============================================

execute_command() {
    local command_type="$1"

    # Parse command
    IFS='|' read -r cmd arg1 arg2 <<< "$command_type"

    case "$cmd" in
        backup_package_json)
            backup_package_json
            ;;
        install_core_packages)
            install_core_packages
            ;;
        install_platform_packages)
            install_platform_packages
            ;;
        install_plugin_packages)
            install_plugin_packages
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

backup_package_json() {
    local package_json="$VAR_PACKAGE_JSON_PATH"
    local backup_path="$VAR_PACKAGE_JSON_BACKUP_PATH"

    if [ -f "$backup_path" ]; then
        print_color "$COLOR_GREEN" "[Backup] package.json.backup already exists, skipping"
    else
        if [ -f "$package_json" ]; then
            cp "$package_json" "$backup_path"
            print_color "$COLOR_GREEN" "[Backup] Created package.json.backup"
        fi
    fi
}

install_core_packages() {
    print_section "Installing Capacitor Core Packages"

    cd "$VAR_PROJECT_ROOT"

    # Parse JSON array to space-separated string
    local packages=$(echo "$VAR_CAPACITOR_CORE_PACKAGES" | python3 -c "import json, sys; print(' '.join(json.load(sys.stdin)))")

    print_color "$COLOR_CYAN" "[Install] Installing: $packages"

    if pnpm add $packages; then
        print_color "$COLOR_GREEN" "[Success] Core packages installed"
    else
        print_color "$COLOR_YELLOW" "[WARNING] Some packages failed to install"
    fi
}

install_platform_packages() {
    print_section "Installing Capacitor Platform Packages"

    cd "$VAR_PROJECT_ROOT"

    local packages=$(echo "$VAR_CAPACITOR_PLATFORM_PACKAGES" | python3 -c "import json, sys; print(' '.join(json.load(sys.stdin)))")

    print_color "$COLOR_CYAN" "[Install] Installing: $packages"

    if pnpm add $packages; then
        print_color "$COLOR_GREEN" "[Success] Platform packages installed"
    else
        print_color "$COLOR_YELLOW" "[WARNING] Some packages failed to install"
    fi
}

install_plugin_packages() {
    print_section "Installing Capacitor Plugin Packages"

    cd "$VAR_PROJECT_ROOT"

    local packages=$(echo "$VAR_CAPACITOR_PLUGIN_PACKAGES" | python3 -c "import json, sys; pkgs = json.load(sys.stdin); print(len(pkgs), ' '.join(pkgs))" | cut -d' ' -f2-)
    local package_count=$(echo "$VAR_CAPACITOR_PLUGIN_PACKAGES" | python3 -c "import json, sys; print(len(json.load(sys.stdin)))")

    print_color "$COLOR_CYAN" "[Install] Installing $package_count plugins..."
    print_color "$COLOR_GRAY" "[Install] This may take a moment..."

    if pnpm add $packages; then
        print_color "$COLOR_GREEN" "[Success] All plugin packages installed"
    else
        print_color "$COLOR_YELLOW" "[WARNING] Some packages failed to install"
    fi
}

initialize_capacitor() {
    local app_name="$1"
    local package_id="$2"

    print_section "Initializing Capacitor"

    print_color "$COLOR_CYAN" "[Config] App Name: $app_name"
    print_color "$COLOR_CYAN" "[Config] Package ID: $package_id"

    cd "$VAR_PROJECT_ROOT"

    print_color "$COLOR_GRAY" "[Capacitor] Running: npx cap init \"$app_name\" \"$package_id\""

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
            if [ -f "$VAR_PROJECT_ROOT/capacitor.config.ts" ]; then
                config_files+=("capacitor.config.ts")
            fi
            if [ -f "$VAR_PROJECT_ROOT/capacitor.config.js" ]; then
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
                        local full_path="$VAR_PROJECT_ROOT/$config_file"
                        if [ -f "$full_path" ]; then
                            # Backup first
                            cp "$full_path" "$full_path.backup"
                            print_color "$COLOR_GREEN" "[Backup] Created backup: $config_file.backup"

                            rm -f "$full_path"
                            print_color "$COLOR_GREEN" "[Removed] Deleted: $config_file"
                        fi
                    done

                    echo ""
                    print_color "$COLOR_YELLOW" "[Capacitor] Retrying initialization..."

                    # Retry initialization
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

    cd "$VAR_PROJECT_ROOT"

    npx cap add android && print_color "$COLOR_GREEN" "[Success] Android platform added" || print_color "$COLOR_YELLOW" "[WARNING] Failed to add Android platform"
}

start_dev_server() {
    print_header "Starting Development Server"

    cd "$VAR_PROJECT_ROOT"

    pnpm run dev
}

build_web() {
    print_section "Building Web Assets"

    cd "$VAR_PROJECT_ROOT"

    pnpm run build && print_color "$COLOR_GREEN" "[Success] Web build completed" || print_color "$COLOR_RED" "[ERROR] Web build failed"
}

sync_capacitor_android() {
    print_section "Syncing Capacitor"

    cd "$VAR_PROJECT_ROOT"

    npx cap sync android && print_color "$COLOR_GREEN" "[Success] Capacitor synced" || print_color "$COLOR_RED" "[ERROR] Capacitor sync failed"
}

build_android_apk() {
    print_section "Building Android APK"

    local android_path="$VAR_ANDROID_PATH"
    local gradlew_path="${android_path}/gradlew"

    if [ ! -f "$gradlew_path" ]; then
        print_color "$COLOR_RED" "[ERROR] Gradle wrapper not found at: $gradlew_path"
        return 1
    fi

    cd "$android_path"

    ./gradlew assembleDebug && {
        print_color "$COLOR_GREEN" "[Success] Android build completed"
        print_color "$COLOR_CYAN" "[Output] APK location: android/app/build/outputs/apk/debug/"
    } || print_color "$COLOR_RED" "[ERROR] Android build failed"
}

# ============================================
# MAIN EXECUTION
# ============================================

print_header "Linux Command Executor"

# Find app prefix
if ! find_app_prefix; then
    print_color "$COLOR_RED" "[ERROR] No variable files found in: $VAR_DIR"
    print_color "$COLOR_RED" "[ERROR] Did Python controller run successfully?"
    exit 1
fi

print_color "$COLOR_GREEN" "[Shell] Found app prefix: $APP_PREFIX"

# Load variables into environment
eval "$(load_all_variables)"

print_color "$COLOR_GREEN" "[Shell] Variables loaded"

# Check for Python success
if [ "$VAR_PYTHON_SUCCESS" != "true" ]; then
    print_color "$COLOR_RED" "[ERROR] Python controller did not complete successfully"
    exit 1
fi

# Check for errors
if [ -n "$VAR_ERROR" ]; then
    print_color "$COLOR_RED" "[ERROR] Python reported error: $VAR_ERROR"
    exit 1
fi

# Load and execute commands
print_color "$COLOR_CYAN" "[Shell] Loading commands..."

commands_output=$(load_commands)
if [ -z "$commands_output" ]; then
    print_color "$COLOR_YELLOW" "[WARNING] No commands to execute"
    exit 0
fi

echo ""

# Execute each command
while IFS='|' read -r idx cmd desc work_dir; do
    if [ -n "$desc" ]; then
        print_color "$COLOR_CYAN" "[Execute] $desc"
    fi

    execute_command "$cmd"
done <<< "$commands_output"

echo ""
print_header "Execution Complete"
