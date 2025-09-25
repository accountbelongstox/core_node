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

# Unified Manager Common Utilities - Shell
# Provides common functions for application management

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNIFIED_MANAGER_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$UNIFIED_MANAGER_DIR")")"
REGISTRY_FILE="$UNIFIED_MANAGER_DIR/app_registry.json"

# Function to check if jq is available
check_jq() {
    if ! command -v jq >/dev/null 2>&1; then
        echo "[ERROR] jq is required but not installed. Please install jq first."
        return 1
    fi
    return 0
}

# Function to load application registry
get_app_registry() {
    if [ ! -f "$REGISTRY_FILE" ]; then
        echo "[ERROR] Application registry not found: $REGISTRY_FILE"
        return 1
    fi
    
    if ! check_jq; then
        return 1
    fi
    
    cat "$REGISTRY_FILE"
}

# Function to get application by ID or name
get_app_by_id() {
    local app_id="$1"

    local registry
    registry=$(get_app_registry)
    if [ $? -ne 0 ]; then
        return 1
    fi

    # If app_id is numeric, search by ID
    if [[ "$app_id" =~ ^[0-9]+$ ]]; then
        echo "$registry" | jq -r --arg id "$app_id" '
            .apps | to_entries[] |
            select(.value.id == ($id | tonumber)) |
            .value + {name: .key}
        '
    else
        # Search by name
        echo "$registry" | jq -r --arg name "$app_id" '
            .apps[$name] + {name: $name}
        '
    fi
}

# Function to check if script files exist for an application
test_app_scripts() {
    local app_name="$1"
    local app_config="$2"

    if [ -z "$app_name" ] || [ -z "$app_config" ]; then
        write_error "Missing parameters for test_app_scripts"
        return 1
    fi

    local app_type
    app_type=$(echo "$app_config" | jq -r '.type')

    local scripts_exist=true
    local missing_scripts=()

    # Define script commands to check based on app type
    local scripts_to_check=()

    if [ "$app_type" = "ncore-app" ]; then
        # For ncore-app, scripts should be in apps/{appname}/scripts/
        scripts_to_check=("start_cmd" "install_cmd" "deploy_cmd" "stop_cmd")
    elif [[ "$app_type" == poly-* ]]; then
        # For poly apps, scripts should be in poly_apps/{appname}/scripts/
        scripts_to_check=("start_cmd" "install_cmd")
        if echo "$app_config" | jq -e '.deploy_cmd' >/dev/null 2>&1; then
            scripts_to_check+=("deploy_cmd")
        fi
        if echo "$app_config" | jq -e '.stop_cmd' >/dev/null 2>&1; then
            scripts_to_check+=("stop_cmd")
        fi
    else
        # For other types (python, etc.), check if commands exist as executables
        scripts_to_check=("start_cmd")
        if echo "$app_config" | jq -e '.install_cmd' >/dev/null 2>&1; then
            scripts_to_check+=("install_cmd")
        fi
    fi

    for script_type in "${scripts_to_check[@]}"; do
        local script_cmd
        script_cmd=$(echo "$app_config" | jq -r ".$script_type")

        if [ "$script_cmd" = "null" ] || [ -z "$script_cmd" ]; then
            scripts_exist=false
            missing_scripts+=("$script_type (not defined)")
            continue
        fi

        local script_exists=false

        if [ "$app_type" = "ncore-app" ]; then
            # Check for shell scripts in apps/{appname}/scripts/
            local app_path
            app_path=$(echo "$app_config" | jq -r '.path')
            local scripts_dir="$PROJECT_ROOT/$app_path/scripts"

            case "$script_cmd" in
                *start.sh*) script_exists=$([ -f "$scripts_dir/start.sh" ] && echo true || echo false) ;;
                *install.sh*) script_exists=$([ -f "$scripts_dir/install.sh" ] && echo true || echo false) ;;
                *deploy.sh*) script_exists=$([ -f "$scripts_dir/deploy.sh" ] && echo true || echo false) ;;
                *stop.sh*) script_exists=$([ -f "$scripts_dir/stop.sh" ] && echo true || echo false) ;;
            esac
        elif [[ "$app_type" == poly-* ]]; then
            # Check for scripts in poly_apps/{appname}/scripts/
            local app_path
            app_path=$(echo "$app_config" | jq -r '.path')
            local scripts_dir="$PROJECT_ROOT/$app_path/scripts"

            # For poly apps, we expect both .ps1 and .sh scripts
            local script_name="${script_type%_cmd}"
            local ps1_script="$scripts_dir/$script_name.ps1"
            local sh_script="$scripts_dir/$script_name.sh"

            script_exists=$([ -f "$ps1_script" ] || [ -f "$sh_script" ] && echo true || echo false)
        else
            # For other types, assume command exists if it's defined
            script_exists=true
        fi

        if [ "$script_exists" != "true" ]; then
            scripts_exist=false
            missing_scripts+=("$script_type")
        fi
    done

    # Output results in JSON format
    local missing_json
    missing_json=$(printf '%s\n' "${missing_scripts[@]}" | jq -R . | jq -s .)

    jq -n \
        --arg app_name "$app_name" \
        --arg app_type "$app_type" \
        --argjson all_exist "$scripts_exist" \
        --argjson missing "$missing_json" \
        '{
            app_name: $app_name,
            type: $app_type,
            all_scripts_exist: $all_exist,
            missing_scripts: $missing
        }'
}

# Function to check all applications scripts
test_all_app_scripts() {
    write_info "Checking script files for all applications..."

    local registry
    registry=$(get_app_registry)
    if [ $? -ne 0 ]; then
        write_error "Failed to load application registry"
        return 1
    fi

    local total_apps=0
    local apps_with_all_scripts=0
    local apps_with_missing_scripts=0
    local results=()

    # Process each application
    while IFS= read -r app_name; do
        local app_config
        app_config=$(echo "$registry" | jq -r ".apps.\"$app_name\"")

        local result
        result=$(test_app_scripts "$app_name" "$app_config")
        results+=("$result")

        total_apps=$((total_apps + 1))

        local all_exist
        all_exist=$(echo "$result" | jq -r '.all_scripts_exist')
        if [ "$all_exist" = "true" ]; then
            apps_with_all_scripts=$((apps_with_all_scripts + 1))
        else
            apps_with_missing_scripts=$((apps_with_missing_scripts + 1))
        fi
    done < <(echo "$registry" | jq -r '.apps | keys[]')

    # Generate summary report
    write_info "Script Check Summary:"
    write_info "  Total Applications: $total_apps"
    write_success "  Apps with all scripts: $apps_with_all_scripts"
    if [ $apps_with_missing_scripts -gt 0 ]; then
        write_warning "  Apps with missing scripts: $apps_with_missing_scripts"
    fi

    # Show detailed results for apps with missing scripts
    if [ $apps_with_missing_scripts -gt 0 ]; then
        write_warning "Applications with missing scripts:"
        for result in "${results[@]}"; do
            local all_exist
            all_exist=$(echo "$result" | jq -r '.all_scripts_exist')
            if [ "$all_exist" = "false" ]; then
                local app_name app_type
                app_name=$(echo "$result" | jq -r '.app_name')
                app_type=$(echo "$result" | jq -r '.type')
                write_warning "  $app_name ($app_type):"

                local missing_scripts
                missing_scripts=$(echo "$result" | jq -r '.missing_scripts[]')
                while IFS= read -r missing; do
                    write_warning "    - Missing: $missing"
                done <<< "$missing_scripts"
            fi
        done
    fi

    # Return summary
    jq -n \
        --argjson total "$total_apps" \
        --argjson with_all "$apps_with_all_scripts" \
        --argjson with_missing "$apps_with_missing_scripts" \
        '{
            total: $total,
            with_all_scripts: $with_all,
            with_missing_scripts: $with_missing
        }'
}

# Function to get application configuration (updated for new structure)
get_app_config() {
    local app_identifier="$1"
    get_app_by_id "$app_identifier"
}

# Function to list all applications with numbers
get_all_apps_with_numbers() {
    local registry
    registry=$(get_app_registry)
    if [ $? -ne 0 ]; then
        return 1
    fi

    echo "$registry" | jq -r '
        .apps | to_entries[] |
        "\(.value.id)|\(.key)|\(.value.type)|\(.value.category)|\(.value.description)"
    ' | sort -n
}

# Function to convert input to app IDs
convert_to_app_ids() {
    local input="$1"
    local app_ids=()

    # Split input by spaces
    IFS=' ' read -ra parts <<< "$input"

    for part in "${parts[@]}"; do
        if [[ "$part" =~ ^[0-9]+$ ]]; then
            # Single number
            app_ids+=("$part")
        elif [[ "$part" =~ ^([0-9]+)-([0-9]+)$ ]]; then
            # Range (e.g., 1-5)
            local start="${BASH_REMATCH[1]}"
            local end="${BASH_REMATCH[2]}"
            for ((i=start; i<=end; i++)); do
                app_ids+=("$i")
            done
        else
            # Preset name or app name
            local preset_config
            preset_config=$(get_preset_config "$part")
            if [ $? -eq 0 ]; then
                local preset_apps
                preset_apps=$(echo "$preset_config" | jq -r '.apps[]')
                while read -r app_id; do
                    if [ -n "$app_id" ]; then
                        app_ids+=("$app_id")
                    fi
                done <<< "$preset_apps"
            else
                # Try as app name
                local app
                app=$(get_app_by_id "$part")
                if [ $? -eq 0 ]; then
                    local app_id
                    app_id=$(echo "$app" | jq -r '.id')
                    app_ids+=("$app_id")
                fi
            fi
        fi
    done

    # Remove duplicates and sort
    printf '%s\n' "${app_ids[@]}" | sort -nu
}

# Function to get application path
get_app_path() {
    local app_identifier="$1"

    local app_config
    app_config=$(get_app_config "$app_identifier")
    if [ $? -ne 0 ]; then
        return 1
    fi

    local app_path
    app_path=$(echo "$app_config" | jq -r '.path')
    echo "$PROJECT_ROOT/$app_path"
}

# Function to check if application exists
test_app_exists() {
    local app_identifier="$1"

    local app_config
    app_config=$(get_app_config "$app_identifier")
    if [ $? -ne 0 ]; then
        return 1
    fi

    local app_path
    app_path=$(get_app_path "$app_identifier")
    if [ $? -ne 0 ]; then
        return 1
    fi

    [ -d "$app_path" ]
}

# Function to display applications with numbers
show_apps_with_numbers() {
    local title="${1:-Available Applications}"

    write_info "$title"

    local apps
    apps=$(get_all_apps_with_numbers)

    while IFS='|' read -r id name type category description; do
        if [ -n "$id" ]; then
            echo "$id. $name (Type: $type)"
            echo "    Category: $category"
            echo "    Description: $description"
            echo ""
        fi
    done <<< "$apps"
}

# Function to get preset configuration
get_preset_config() {
    local preset_name="$1"
    
    local registry
    registry=$(get_app_registry)
    if [ $? -ne 0 ]; then
        return 1
    fi
    
    local preset_config
    preset_config=$(echo "$registry" | jq -r ".presets.\"$preset_name\"")
    if [ "$preset_config" = "null" ]; then
        echo "[ERROR] Preset not found: $preset_name"
        return 1
    fi
    
    echo "$preset_config"
}

# Function to list all applications
get_all_apps() {
    local registry
    registry=$(get_app_registry)
    if [ $? -ne 0 ]; then
        return 1
    fi
    
    echo "$registry" | jq -r '
        .apps | to_entries[] | 
        if .value.sub_apps then
            (.value.sub_apps | keys[] | "\(.key):\(.)")
        else
            .key
        end
    ' | while read -r app; do
        echo "$app"
    done
}

# Function to list all presets
get_all_presets() {
    local registry
    registry=$(get_app_registry)
    if [ $? -ne 0 ]; then
        return 1
    fi
    
    echo "$registry" | jq -r '.presets | keys[]'
}

# Function to write colored output
write_info() {
    echo -e "\033[32m[INFO]\033[0m $1"
}

write_warning() {
    echo -e "\033[33m[WARN]\033[0m $1"
}

write_error() {
    echo -e "\033[31m[ERROR]\033[0m $1"
}

write_success() {
    echo -e "\033[36m[SUCCESS]\033[0m $1"
}

# Function to execute command in specific directory
invoke_in_directory() {
    local target_dir="$1"
    shift
    local command="$@"
    
    local original_dir="$(pwd)"
    cd "$target_dir" || return 1
    
    eval "$command"
    local exit_code=$?
    
    cd "$original_dir"
    return $exit_code
}

# Function to check if command exists
test_command() {
    command -v "$1" >/dev/null 2>&1
}

# Function to validate dependencies
test_dependencies() {
    local required_commands=("$@")
    local missing=()
    
    for cmd in "${required_commands[@]}"; do
        if ! test_command "$cmd"; then
            missing+=("$cmd")
        fi
    done
    
    if [ ${#missing[@]} -gt 0 ]; then
        write_error "Missing required commands: ${missing[*]}"
        return 1
    fi
    
    return 0
}

# Function to get app type specific commands
get_type_commands() {
    local app_type="$1"
    
    case "$app_type" in
        "node")
            echo "node npm"
            ;;
        "python")
            echo "python pip"
            ;;
        "poly")
            echo "node npm"  # Base requirements, specific tools checked per app
            ;;
        *)
            echo ""
            ;;
    esac
}

# Function to check app specific dependencies
check_app_dependencies() {
    local app_config="$1"
    local app_type
    app_type=$(echo "$app_config" | jq -r '.type')
    
    local required_commands
    required_commands=$(get_type_commands "$app_type")
    
    if [ -n "$required_commands" ]; then
        test_dependencies $required_commands
        return $?
    fi
    
    return 0
}
