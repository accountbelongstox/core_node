#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Special Software Environment Variables Manager for Linux
# This script provides a menu interface for setting environment variables for special software like AI tools.

# Variable Declarations
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LINUX_COMMON_DIR="$(dirname "$SCRIPT_DIR")/common"
LINUX_ENVS_DIR="/usr/local/bin"
TEMP_SCRIPTS_DIR="/tmp/.core_node/env_scripts"

# Source common functions if available
if [ -f "$LINUX_COMMON_DIR/common_functions.sh" ]; then
    source "$LINUX_COMMON_DIR/common_functions.sh"
fi

if [ -f "$LINUX_COMMON_DIR/gvar_common.sh" ]; then
    source "$LINUX_COMMON_DIR/gvar_common.sh"
fi

# Global variables for file management
SELECTED_FILE_ACTION=""
SELECTED_FILE_TEXT=""
SELECTED_FILE_INDEX=-1
IS_REPLACING_FILE=false
TARGET_FILE_PATH=""

# Global variables for current operation
CURRENT_CONFIG_NAME=""
CURRENT_CONFIG=""
CURRENT_COMMAND_PREFIX=""
CURRENT_FILE_NUMBER=1
CURRENT_FILE_NAME=""
CURRENT_SCRIPT_CONTENT=""

# Environment Variables Configuration
declare -A ENVIRONMENT_CONFIGS
ENVIRONMENT_CONFIGS["Claude AI"]="title=Claude AI Environment Variables;description=Set up Claude AI environment variables for API access;common=claude;command_prefix=claude;vars=ANTHROPIC_BASE_URL,ANTHROPIC_AUTH_TOKEN;secrets=ANTHROPIC_AUTH_TOKEN"
ENVIRONMENT_CONFIGS["Alibaba Cloud"]="title=Alibaba Cloud Environment Variables;description=Set up Alibaba Cloud environment variables for API access;common=alibaba;command_prefix=aliyun;vars=ALIBABA_CLOUD_ACCESS_KEY_ID,ALIBABA_CLOUD_ACCESS_KEY_SECRET;secrets=ALIBABA_CLOUD_ACCESS_KEY_SECRET"
# Example: Add new service configuration
# ENVIRONMENT_CONFIGS["OpenAI"]="title=OpenAI Environment Variables;description=Set up OpenAI environment variables for API access;common=openai;command_prefix=openai;vars=OPENAI_API_KEY,OPENAI_BASE_URL;secrets=OPENAI_API_KEY"

# Helper Functions
test_admin_privileges() {
    [ "$EUID" -eq 0 ]
}

# Print colored text: $1=color (yellow/red/green), $2=message
print_color() {
    local color="$1"
    local message="$2"
    local code=""
    case "$color" in
        yellow) code='\033[33m' ;;
        red)    code='\033[31m' ;;
        green)  code='\033[32m' ;;
        *)      code='' ;;
    esac
    echo -e "${code}${message}\033[0m"
}

ensure_array() {
    local input="$1"
    if [ -z "$input" ]; then
        echo ""
    else
        echo "$input"
    fi
}

get_config_value() {
    local config_name="$1"
    local key="$2"
    local config_str="${ENVIRONMENT_CONFIGS[$config_name]}"
    echo "$config_str" | grep -o "${key}=[^;]*" | cut -d= -f2
}

get_command_prefix() {
    local config_name="$1"
    local command_prefix=$(get_config_value "$config_name" "command_prefix")
    if [ -n "$command_prefix" ]; then
        echo "$command_prefix"
    else
        get_config_value "$config_name" "common"
    fi
}

get_list_script_name() {
    local config_name="$1"
    local command_prefix=$(get_command_prefix "$config_name")
    if [ -n "$command_prefix" ]; then
        echo "${command_prefix}list"
    fi
}

set_env_variable() {
    local var_name="$1"
    local var_value="$2"
    local delete_flag="$3"

    if [ "$delete_flag" = "delete" ]; then
        # Remove from global vars
        local var_file="$GLOBAL_VAR_DIR/$var_name"
        if [ -f "$var_file" ]; then
            if [ -n "$USE_SUDO" ]; then
                $USE_SUDO rm -f "$var_file"
            else
                rm -f "$var_file"
            fi
        fi
        # Unset from current session
        unset "$var_name"
        return 0
    else
        # Use the set_global_var function from dd.sh or gvar_common.sh
        if command -v set_global_var >/dev/null 2>&1; then
            set_global_var "$var_name" "$var_value"
        else
            # Fallback implementation
            if [ ! -d "$GLOBAL_VAR_DIR" ]; then
                if [ -n "$USE_SUDO" ]; then
                    $USE_SUDO mkdir -p "$GLOBAL_VAR_DIR"
                else
                    mkdir -p "$GLOBAL_VAR_DIR"
                fi
            fi
            echo "$var_value" | tr -d '\0' > "$GLOBAL_VAR_DIR/$var_name"
        fi
        local status=$?

        if [[ $status -eq 0 ]]; then
            # Persist in current shell session as well
            export "$var_name=$var_value"
        fi

        return $status
    fi
}

get_env_variable() {
    local var_name="$1"
    # Use the get_global_var function from dd.sh or gvar_common.sh
    if command -v get_global_var >/dev/null 2>&1; then
        get_global_var "$var_name"
    else
        # Fallback implementation
        local file_path="$GLOBAL_VAR_DIR/$var_name"
        if [ -f "$file_path" ]; then
            local value
            value=$(cat "$file_path" 2>/dev/null | tr -d '\0' | head -n 1)
            if [ -n "$value" ]; then
                echo "$value"
            fi
        fi
    fi
}

# Script Generation Functions
get_existing_scripts() {
    local config_name="$1"
    local list_script_name=$(get_list_script_name "$config_name")
    if [ -z "$list_script_name" ]; then
        return
    fi

    if [ ! -d "$LINUX_ENVS_DIR" ]; then
        return
    fi

    local pattern="${list_script_name}*"
    find "$LINUX_ENVS_DIR" -name "$pattern" -type f 2>/dev/null | sort
}

show_existing_scripts_menu() {
    local config_name="$1"
    local scripts_list="$2"

    if [ -z "$scripts_list" ]; then
        echo "new"
        return
    fi

    local -a menu_items=("Create new script")
    local -a menu_actions=("new")

    while IFS= read -r script_path; do
        if [ -n "$script_path" ]; then
            local script_name=$(basename "$script_path")
            menu_items+=("Replace: $script_name")
            menu_actions+=("$script_path")
        fi
    done <<< "$scripts_list"

    local selected_index=0
    local total_items=${#menu_items[@]}

    while true; do
        clear
        print_color green "Script Management for $config_name"
        print_color green "Use Up/Down arrows to navigate, Enter to select"
        print_color green "================================================"

        for i in "${!menu_items[@]}"; do
            if [ "$i" -eq "$selected_index" ]; then
                print_color yellow "> ${menu_items[$i]}"
            else
                print_color green "  ${menu_items[$i]}"
            fi
        done

        local key
        if ! IFS= read -rsn1 key; then
            continue
        fi

        case "$key" in
            $'\x1b')
                local seq=""
                local next
                if IFS= read -rsn1 -t 0.05 next; then
                    if [[ "$next" == "[" ]]; then
                        local final
                        if IFS= read -rsn1 -t 0.05 final; then
                            seq="[${final}"
                        fi
                    fi
                fi

                case "$seq" in
                    '[A')
                        selected_index=$(( (selected_index - 1 + total_items) % total_items ))
                        ;;
                    '[B')
                        selected_index=$(( (selected_index + 1) % total_items ))
                        ;;
                esac
                ;;
            $'\n')
                echo "${menu_actions[$selected_index]}"
                return
                ;;
        esac
    done
}

# Generic Environment Variables Functions
set_environment_variables() {
    local config_name="$1"

    if [[ -z "${ENVIRONMENT_CONFIGS[$config_name]}" ]]; then
        print_color red "Configuration '$config_name' not found."
        return
    fi

    local config_str="${ENVIRONMENT_CONFIGS[$config_name]}"
    local title=$(get_config_value "$config_name" "title")
    local description=$(get_config_value "$config_name" "description")
    local vars_str=$(get_config_value "$config_name" "vars")
    local secrets_str=$(get_config_value "$config_name" "secrets")

    local -a var_names=($(echo "$vars_str" | tr ',' ' '))
    local -a secret_vars=($(echo "$secrets_str" | tr ',' ' '))

    clear
    print_color green "$title"
    print_color green "$description"
    print_color green "$(printf '='%.0s $(seq 1 ${#title}))"

    # Check admin privileges
    if ! test_admin_privileges; then
        print_color red "This operation requires root privileges."
        print_color yellow "Please run dd.sh as root or with sudo to manage system environment variables."
        print_color green "Press any key to continue..."
        read -n 1
    fi
    
    # Get current values
    declare -A current_values
    print_color green "Current environment variable status:"
    for var_name in "${var_names[@]}"; do
        local current_value=$(get_env_variable "$var_name")
        current_values["$var_name"]="$current_value"
        
        local is_secret=0
        for secret_var in "${secret_vars[@]}"; do
            if [[ "$var_name" == "$secret_var" ]]; then
                is_secret=1
                break
            fi
        done

        if [[ -n "$current_value" ]]; then
            if [[ "$is_secret" -eq 1 ]]; then
                print_color green "$var_name: [HIDDEN - Already set]"
            else
                print_color green "$var_name: $current_value"
            fi
        else
            print_color yellow "$var_name: [Not set - Will be configured]"
        fi
    done
    
    print_color green "Now you will be prompted to enter values for each environment variable."
    print_color green "If a variable is already set, you can press Enter to keep the current value or skip setting."
    print_color green "If a variable is not set, you can press Enter to skip setting it."
    
    # Get user input for each variable
    declare -A new_values
    declare -a empty_variables
    declare -a temporarily_cleared

    for var_name in "${var_names[@]}"; do
        local has_current_value="${current_values[$var_name]}"
        local prompt_msg

        local is_secret=0
        for secret_var in "${secret_vars[@]}"; do
            if [[ "$var_name" == "$secret_var" ]]; then
                is_secret=1
                break
            fi
        done

        if [[ -n "$has_current_value" ]]; then
            prompt_msg="Please enter $var_name (or press Enter to keep current value):"
        else
            prompt_msg="Please enter $var_name (or press Enter to skip):"
        fi

        local var_description=$(get_config_value "$config_name" "description")
        if [[ -n "$var_description" ]]; then
            prompt_msg+="\nDescription: $var_description"
        fi

        print_color green "$prompt_msg"
        read -p "$var_name: " user_input

        if [[ -z "$user_input" ]]; then
            if [[ -n "$has_current_value" ]]; then
                print_color green "Variable has current value. Choose action:"
                print_color green "1. Keep current value"
                print_color green "2. Set to empty (delete)"
                print_color green "3. Temporarily clear (current session only)"

                read -p "Enter choice (1-3, default: 1): " choice

                if [[ -z "$choice" ]]; then
                    choice="1"
                fi

                case "$choice" in
                    "2")
                        new_values["$var_name"]="__DELETE__"
                        print_color green "Setting $var_name to empty (deleting)"
                        ;;
                    "3")
                        temporarily_cleared+=("$var_name")
                        print_color green "Marked $var_name for temporary clearing"
                        print_color green "System environment variable unchanged"
                        ;;
                    *)
                        new_values["$var_name"]="$has_current_value"
                        if [[ "$is_secret" -eq 1 ]]; then
                            print_color green "Keeping current value: [HIDDEN]"
                        else
                            print_color green "Keeping current value: $has_current_value"
                        fi
                        ;;
                esac
            else
                print_color yellow "Skipping $var_name - no value entered"
                empty_variables+=("$var_name")
            fi
        else
            new_values["$var_name"]="$user_input"
            if [[ "$is_secret" -eq 1 ]]; then
                print_color green "New value set: [HIDDEN]"
            else
                print_color green "New value set: $user_input"
            fi
        fi
    done
    
    # Handle empty variables menu if needed
    if [ ${#empty_variables[@]} -gt 0 ]; then
        if [ ${#empty_variables[@]} -eq 1 ]; then
            print_color yellow "One variable was left empty. Please choose how to handle it:"
        else
            print_color yellow "Multiple variables were left empty. Please choose how to handle them:"
        fi
        print_color green "Empty variables:"
        for var in "${empty_variables[@]}"; do
            print_color green "  - $var"
        done

        print_color green "1. Keep old values for empty variables"
        print_color green "2. Delete empty variables"
        print_color green "3. Set empty variables to empty values"
        read -p "Enter choice (1-3): " empty_choice

        case "$empty_choice" in
            "1")
                print_color green "Keeping old values for empty variables..."
                for var in "${empty_variables[@]}"; do
                    if [[ -n "${current_values[$var]}" ]]; then
                        new_values["$var"]="${current_values[$var]}"
                        print_color green "Keeping $var: ${current_values[$var]}"
                    fi
                done
                ;;
            "2")
                print_color green "Deleting empty variables..."
                for var in "${empty_variables[@]}"; do
                    new_values["$var"]="__DELETE__"
                    print_color green "Deleting $var"
                done
                ;;
            "3")
                print_color green "Setting empty variables to empty values..."
                for var in "${empty_variables[@]}"; do
                    new_values["$var"]=""
                    print_color green "Setting $var to empty"
                done
                ;;
        esac
    fi

    # Set environment variables
    if [ ${#new_values[@]} -gt 0 ]; then
        print_color green "Setting environment variables..."

        local success_count=0
        local total_count=${#new_values[@]}

        for var_name in "${var_names[@]}"; do
            if [[ -n "${new_values[$var_name]}" ]]; then
                if [[ "${new_values[$var_name]}" == "__DELETE__" ]]; then
                    if set_env_variable "$var_name" "" "delete"; then
                        success_count=$((success_count + 1))
                        print_color green "Deleted $var_name"
                    fi
                else
                    if set_env_variable "$var_name" "${new_values[$var_name]}"; then
                        success_count=$((success_count + 1))
                        local is_secret=0
                        for secret_var in "${secret_vars[@]}"; do
                            if [[ "$var_name" == "$secret_var" ]]; then
                                is_secret=1
                                break
                            fi
                        done
                        if [[ "$is_secret" -eq 1 ]]; then
                            print_color green "Set $var_name: [HIDDEN]"
                        else
                            print_color green "Set $var_name: ${new_values[$var_name]}"
                        fi
                    fi
                fi
            fi
        done
    else
        print_color green "No system environment variables to set (all variables were temporarily cleared or skipped)"
        success_count=0
        total_count=0
    fi

    if [[ $success_count -eq $total_count ]]; then
        print_color green "Environment variables processed successfully!"
        for var_name in "${var_names[@]}"; do
            if [[ -n "${new_values[$var_name]}" ]]; then
                if [[ "${new_values[$var_name]}" == "__DELETE__" ]]; then
                    print_color green "$var_name: [DELETED]"
                else
                    local is_secret=0
                    for secret_var in "${secret_vars[@]}"; do
                        if [[ "$var_name" == "$secret_var" ]]; then
                            is_secret=1
                            break
                        fi
                    done
                    if [[ "$is_secret" -eq 1 ]]; then
                        print_color green "$var_name: [HIDDEN]"
                    else
                        print_color green "$var_name: ${new_values[$var_name]}"
                    fi
                fi
            elif [[ " ${temporarily_cleared[*]} " =~ " $var_name " ]]; then
                print_color green "$var_name: [TEMPORARILY CLEARED]"
            fi
        done

        # Handle temporary clearing
        if [ ${#temporarily_cleared[@]} -gt 0 ]; then
            print_color green "Clearing environment variables in current session..."

            local cleared_count=0
            for var_name in "${temporarily_cleared[@]}"; do
                unset "$var_name"
                cleared_count=$((cleared_count + 1))
                print_color green "Cleared $var_name"
            done

            print_color green "Manual commands to clear variables (copy and paste):"
            echo ""
            for var_name in "${temporarily_cleared[@]}"; do
                echo "  unset $var_name"
            done
            echo ""
            print_color green "Or run this single command:"
            local all_clear_commands=""
            for var_name in "${temporarily_cleared[@]}"; do
                if [ -n "$all_clear_commands" ]; then
                    all_clear_commands="$all_clear_commands; "
                fi
                all_clear_commands="${all_clear_commands}unset $var_name"
            done
            echo "  $all_clear_commands"
            echo ""
        fi

        print_color green "Environment variables have been saved and verified."
        print_color yellow "Note: You may need to restart your terminal or applications to use the new environment variables."
    else
        print_color red "Some environment variables could not be set."
        print_color yellow "Please check permissions or retry setting the values."
    fi

    print_color green "Press any key to continue..."
    read -n 1
}

generate_global_command() {
    local config_name="$1"
    local target_command_path="$2"

    if [[ -z "${ENVIRONMENT_CONFIGS[$config_name]}" ]]; then
        print_color red "Configuration '$config_name' not found."
        return 1
    fi

    # Initialize global variables for current operation
    CURRENT_CONFIG_NAME="$config_name"
    CURRENT_CONFIG="${ENVIRONMENT_CONFIGS[$config_name]}"
    CURRENT_COMMAND_PREFIX=$(get_command_prefix "$config_name")
    CURRENT_FILE_NUMBER=1

    local title=$(get_config_value "$config_name" "title")
    local description=$(get_config_value "$config_name" "description")
    local vars_str=$(get_config_value "$config_name" "vars")
    local secrets_str=$(get_config_value "$config_name" "secrets")
    local common=$(get_config_value "$config_name" "common")

    local -a var_names=($(echo "$vars_str" | tr ',' ' '))
    local -a secret_vars=($(echo "$secrets_str" | tr ',' ' '))

    # Validate configuration
    if [[ -z "$CURRENT_COMMAND_PREFIX" ]]; then
        print_color red "No command prefix found for $config_name"
        return 1
    fi

    clear
    print_color green "Generate $title Global Command"
    print_color green "$description"
    print_color green "$(printf '='%.0s $(seq 1 ${#title}))"

    # Display operation type
    if [[ "$IS_REPLACING_FILE" == "true" ]]; then
        local target_file_name=$(basename "$TARGET_FILE_PATH")
        print_color yellow "Operation: Replacing existing file '$target_file_name'"
    else
        print_color green "Operation: Creating new file"
    fi
    echo ""

    # Initialize environment variables for script
    local env_commands=()
    local env_exports=()

    env_commands+=("# Environment variables for $title")
    env_commands+=("# Generated on $(date '+%Y-%m-%d %H:%M:%S')")
    env_commands+=("")

    for var_name in "${var_names[@]}"; do
        local prompt="Please enter $var_name:"
        local var_description=$(get_config_value "$config_name" "description")
        if [[ -n "$var_description" ]]; then
            prompt+="\nDescription: $var_description"
        fi

        print_color green "$prompt"
        read -p "$var_name: " user_input

        if [[ -n "$user_input" ]]; then
            env_commands+=("echo \"Setting $var_name=$user_input\"")
            env_commands+=("export $var_name=\"$user_input\"")
            env_exports+=("export $var_name=\"$user_input\"")
        else
            env_commands+=("echo \"Skipping $var_name (not set)\"")
            env_commands+=("# export $var_name=\"\"  # Not set")
        fi
    done

    # Use the Common value from config as the command to execute
    if [[ -z "$common" ]]; then
        print_color red "No command specified in configuration."
        return 1
    fi

    print_color green "Command to execute: $common"

    # Ensure target directory exists
    if [[ ! -d "$LINUX_ENVS_DIR" ]]; then
        if [ -n "$USE_SUDO" ]; then
            $USE_SUDO mkdir -p "$LINUX_ENVS_DIR"
        elif [ -n "$sudo" ]; then
            $sudo mkdir -p "$LINUX_ENVS_DIR"
        else
            mkdir -p "$LINUX_ENVS_DIR"
        fi
        print_color green "Created directory: $LINUX_ENVS_DIR"
    fi

    # Determine file generation mode
    if [[ "$IS_REPLACING_FILE" == "true" ]]; then
        print_color green "Replacing existing file using global variables"
        CURRENT_FILE_NAME=$(basename "$TARGET_FILE_PATH")
        target_command_path="$TARGET_FILE_PATH"

        # Extract file number from filename for display purposes
        if [[ "$CURRENT_FILE_NAME" =~ ^${CURRENT_COMMAND_PREFIX}([0-9]+)$ ]]; then
            CURRENT_FILE_NUMBER="${BASH_REMATCH[1]}"
        else
            CURRENT_FILE_NUMBER=1
        fi
    else
        print_color green "Creating new file using global variables"
        # Generate new file number - find the first available number starting from 1
        local existing_scripts=$(get_existing_scripts "$CURRENT_CONFIG_NAME")
        CURRENT_FILE_NUMBER=1
        local existing_numbers=()

        # Extract existing file numbers
        while IFS= read -r script_path; do
            if [[ -n "$script_path" ]]; then
                local script_name=$(basename "$script_path")
                if [[ "$script_name" =~ ^${CURRENT_COMMAND_PREFIX}([0-9]+)$ ]]; then
                    existing_numbers+=("${BASH_REMATCH[1]}")
                fi
            fi
        done <<< "$existing_scripts"

        # Find the first available number starting from 1
        while [[ " ${existing_numbers[*]} " =~ " $CURRENT_FILE_NUMBER " ]]; do
            CURRENT_FILE_NUMBER=$((CURRENT_FILE_NUMBER + 1))
        done

        CURRENT_FILE_NAME="${CURRENT_COMMAND_PREFIX}${CURRENT_FILE_NUMBER}"
        target_command_path="$LINUX_ENVS_DIR/$CURRENT_FILE_NAME"
        print_color green "Generated new file: $CURRENT_FILE_NAME (number: $CURRENT_FILE_NUMBER)"
    fi

    # Create shell script content
    local env_exports_string=""
    for export_cmd in "${env_exports[@]}"; do
        if [[ -n "$env_exports_string" ]]; then
            env_exports_string="$env_exports_string; "
        fi
        env_exports_string="$env_exports_string$export_cmd"
    done

    CURRENT_SCRIPT_CONTENT="#!/bin/bash
# $title Global File #$CURRENT_FILE_NUMBER
# Generated on $(date '+%Y-%m-%d %H:%M:%S')

# Set environment variables
$(printf '%s\n' "${env_commands[@]}")

# Execute command with environment variables
echo \"Executing: $common\"
echo \"\"
echo \"Command: $env_exports_string; $common\"
echo \"\"
echo \"Press any key to continue...\"
read -n 1
$env_exports_string; $common

echo \"\"
echo \"Press any key to continue...\"
read -n 1"

    # Preview the generated content
    print_color green "\nPreview of generated shell script:"
    print_color green "File: $target_command_path"
    print_color green "$(printf '='%.0s $(seq 1 50))"
    echo "$CURRENT_SCRIPT_CONTENT"
    print_color green "$(printf '='%.0s $(seq 1 50))"

    # Ask for confirmation
    print_color green "Press Enter to generate, any other key to cancel"
    read -p "Confirm: " confirm
    if [[ -n "$confirm" ]]; then
        print_color yellow "Command generation cancelled."
        return 1
    fi

    # Write shell script
    if [ -n "$USE_SUDO" ]; then
        echo "$CURRENT_SCRIPT_CONTENT" | $USE_SUDO tee "$target_command_path" >/dev/null
        $USE_SUDO chmod +x "$target_command_path"
    elif [ -n "$sudo" ]; then
        echo "$CURRENT_SCRIPT_CONTENT" | $sudo tee "$target_command_path" >/dev/null
        $sudo chmod +x "$target_command_path"
    else
        echo "$CURRENT_SCRIPT_CONTENT" > "$target_command_path"
        chmod +x "$target_command_path"
    fi

    print_color green "Global command generated successfully: $target_command_path"
    print_color green "File written to $LINUX_ENVS_DIR directory and made executable"

    # Verify file was created
    if [[ -f "$target_command_path" ]]; then
        print_color green "File verification: SUCCESS"
    else
        print_color red "File verification: FAILED"
    fi

    # Generate or update list script
    generate_list_script "$CURRENT_CONFIG_NAME"

    return 0
}

show_environment_variables() {
    local config_name="$1"
    
    if [[ -z "${ENVIRONMENT_CONFIGS[$config_name]}" ]]; then
        print_color red "Configuration '$config_name' not found."
        return
    fi
    
    local config_str="${ENVIRONMENT_CONFIGS[$config_name]}"
    local title=$(echo "$config_str" | grep -o 'title=[^;]*' | cut -d= -f2)
    local description=$(echo "$config_str" | grep -o 'description=[^;]*' | cut -d= -f2)
    local vars_str=$(echo "$config_str" | grep -o 'vars=[^;]*' | cut -d= -f2)
    local secrets_str=$(echo "$config_str" | grep -o 'secrets=[^;]*' | cut -d= -f2)
    
    local -a var_names=($(echo "$vars_str" | tr ',' ' '))
    local -a secret_vars=($(echo "$secrets_str" | tr ',' ' '))

    clear
    print_color green "$title"
    print_color green "$description"
    print_color green "$(printf '='%.0s $(seq 1 ${#title}))"
    
    for var_name in "${var_names[@]}"; do
        local value=$(get_env_variable "$var_name")
        
        local is_secret=0
        for secret_var in "${secret_vars[@]}"; do
            if [[ "$var_name" == "$secret_var" ]]; then
                is_secret=1
                break
            fi
        done

        print_color green "$var_name: "
        if [[ -n "$value" ]]; then
            if [[ "$is_secret" -eq 1 ]]; then
                print_color green "[HIDDEN - Set]"
            else
                print_color green "$value"
            fi
        else
            print_color yellow "[Not set]"
        fi
    done
    
    print_color green "Press any key to continue..."
    read -n 1
}

generate_list_script() {
    local config_name="$1"

    if [[ -z "${ENVIRONMENT_CONFIGS[$config_name]}" ]]; then
        print_color red "Configuration '$config_name' not found."
        return 1
    fi

    local title=$(get_config_value "$config_name" "title")
    local command_prefix=$(get_command_prefix "$config_name")
    if [[ -z "$command_prefix" ]]; then
        print_color red "No command prefix found for $config_name"
        return 1
    fi

    if [[ ! -d "$LINUX_ENVS_DIR" ]]; then
        print_color red "$LINUX_ENVS_DIR directory not found"
        return 1
    fi

    # Find all existing files
    local existing_scripts=$(get_existing_scripts "$config_name")
    local file_count=0
    while IFS= read -r script_path; do
        if [[ -n "$script_path" ]]; then
            file_count=$((file_count + 1))
        fi
    done <<< "$existing_scripts"

    # Generate list script content
    local list_script_name="${command_prefix}list"
    local list_script_path="$LINUX_ENVS_DIR/$list_script_name"

    local list_script_content="#!/bin/bash
# $title Command List with Delete Function
# Generated on $(date '+%Y-%m-%d %H:%M:%S')

echo \"\"
echo \"$title Available Commands:\"
echo \"=====================================\"
echo \"\"

if ! ls \"$LINUX_ENVS_DIR/${command_prefix}\"* >/dev/null 2>&1; then
    echo \"No ${command_prefix} commands found.\"
    echo \"\"
    echo \"Press any key to continue...\"
    read -n 1
    exit 0
fi

counter=0
declare -a files
for file in \"$LINUX_ENVS_DIR/${command_prefix}\"*; do
    if [[ -f \"\$file\" && \"\$(basename \"\$file\")\" != \"$list_script_name\" ]]; then
        counter=\$((counter + 1))
        files[\$counter]=\"\$file\"
        echo \"  \$counter. \$(basename \"\$file\")\"
    fi
done

echo \"\"
echo \"Total: $file_count files available\"
echo \"\"
echo \"=====================================\"
echo \"File Management Options:\"
echo \"=====================================\"
echo \"1. Delete a file (enter file number)\"
echo \"2. Exit\"
echo \"\"
read -p \"Enter your choice (1-2): \" choice

case \"\$choice\" in
    1)
        echo \"\"
        read -p \"Enter file number to delete: \" file_num
        if [[ -z \"\$file_num\" ]]; then
            exit 0
        fi

        if [[ \"\$file_num\" -ge 1 && \"\$file_num\" -le \"\$counter\" ]]; then
            file_to_delete=\"\${files[\$file_num]}\"
            echo \"\"
            echo \"File to delete: \$(basename \"\$file_to_delete\")\"
            read -p \"Are you sure you want to delete this file? (Y/N): \" confirm
            if [[ \"\$confirm\" == \"Y\" || \"\$confirm\" == \"y\" ]]; then
                rm -f \"\$file_to_delete\"
                echo \"File deleted successfully: \$(basename \"\$file_to_delete\")\"
            else
                echo \"Deletion cancelled.\"
            fi
            echo \"\"
            echo \"Press any key to continue...\"
            read -n 1
        else
            echo \"File number \$file_num not found.\"
            echo \"Press any key to continue...\"
            read -n 1
        fi
        ;;
    2)
        echo \"Exiting...\"
        ;;
    *)
        echo \"Invalid choice. Please try again.\"
        echo \"Press any key to continue...\"
        read -n 1
        ;;
esac

echo \"\"
echo \"Press any key to exit...\"
read -n 1"

    if [ -n "$USE_SUDO" ]; then
        echo "$list_script_content" | $USE_SUDO tee "$list_script_path" >/dev/null
        $USE_SUDO chmod +x "$list_script_path"
    elif [ -n "$sudo" ]; then
        echo "$list_script_content" | $sudo tee "$list_script_path" >/dev/null
        $sudo chmod +x "$list_script_path"
    else
        echo "$list_script_content" > "$list_script_path"
        chmod +x "$list_script_path"
    fi
    print_color green "List script generated: $list_script_path"
    return 0
}

show_existing_files_menu() {
    local config_name="$1"
    local existing_scripts="$2"

    local command_prefix=$(get_command_prefix "$config_name")
    if [[ -z "$command_prefix" ]]; then
        print_color red "No command prefix found for $config_name"
        echo "new"
        return
    fi

    # If no files exist, directly create new file
    if [[ -z "$existing_scripts" ]]; then
        echo "new"
        return
    fi

    # Calculate next available file number
    local next_file_number=1
    local existing_numbers=()

    # Extract existing file numbers
    while IFS= read -r script_path; do
        if [[ -n "$script_path" ]]; then
            local script_name=$(basename "$script_path")
            if [[ "$script_name" =~ ^${command_prefix}([0-9]+)$ ]]; then
                existing_numbers+=("${BASH_REMATCH[1]}")
            fi
        fi
    done <<< "$existing_scripts"

    # Find the first available number starting from 1
    while [[ " ${existing_numbers[*]} " =~ " $next_file_number " ]]; do
        next_file_number=$((next_file_number + 1))
    done

    local next_file_name="${command_prefix}${next_file_number}"

    local -a menu_items=("Create new file: $next_file_name (auto-increment)")
    local -a menu_actions=("new")

    # Add options to replace existing files
    while IFS= read -r script_path; do
        if [[ -n "$script_path" ]]; then
            local script_name=$(basename "$script_path")
            menu_items+=("Replace existing: $script_name")
            menu_actions+=("$script_path")
        fi
    done <<< "$existing_scripts"

    local selected_index=0
    local total_items=${#menu_items[@]}

    while true; do
        clear
        print_color green "File Management for $config_name Files"
        print_color green "Use Up/Down arrows to navigate, Enter to select"
        print_color green "================================================"

        for i in "${!menu_items[@]}"; do
            if [[ "$i" -eq "$selected_index" ]]; then
                print_color yellow "> ${menu_items[$i]}"
            else
                print_color green "  ${menu_items[$i]}"
            fi
        done

        local key
        if ! IFS= read -rsn1 key; then
            continue
        fi

        case "$key" in
            $'\x1b')
                local seq=""
                local next
                if IFS= read -rsn1 -t 0.05 next; then
                    if [[ "$next" == "[" ]]; then
                        local final
                        if IFS= read -rsn1 -t 0.05 final; then
                            seq="[${final}"
                        fi
                    fi
                fi

                case "$seq" in
                    '[A')
                        selected_index=$(( (selected_index - 1 + total_items) % total_items ))
                        ;;
                    '[B')
                        selected_index=$(( (selected_index + 1) % total_items ))
                        ;;
                esac
                ;;
            $'\n')
                SELECTED_FILE_ACTION="${menu_actions[$selected_index]}"
                SELECTED_FILE_TEXT="${menu_items[$selected_index]}"
                SELECTED_FILE_INDEX="$selected_index"

                # Set replacement mode flags
                if [[ "$SELECTED_FILE_ACTION" == "new" ]]; then
                    IS_REPLACING_FILE=false
                    TARGET_FILE_PATH=""
                else
                    IS_REPLACING_FILE=true
                    TARGET_FILE_PATH="$SELECTED_FILE_ACTION"
                fi

                print_color green "Selected file menu item: '$SELECTED_FILE_TEXT'"
                print_color green "Selected file action: '$SELECTED_FILE_ACTION'"
                print_color green "Is replacing file: $IS_REPLACING_FILE"
                print_color green "Target file path: '$TARGET_FILE_PATH'"
                print_color green "Press any key to continue..."
                read -n 1

                return
                ;;
        esac
    done
}

show_all_environment_variables() {
    clear
    print_color green "All Environment Variables Status"
    print_color green "==============================="
    
    for config_name in "${!ENVIRONMENT_CONFIGS[@]}"; do
        local config_str="${ENVIRONMENT_CONFIGS[$config_name]}"
        local title=$(echo "$config_str" | grep -o 'title=[^;]*' | cut -d= -f2)
        local vars_str=$(echo "$config_str" | grep -o 'vars=[^;]*' | cut -d= -f2)
        local secrets_str=$(echo "$config_str" | grep -o 'secrets=[^;]*' | cut -d= -f2)
        
        local -a var_names=($(echo "$vars_str" | tr ',' ' '))
        local -a secret_vars=($(echo "$secrets_str" | tr ',' ' '))

        echo ""
        print_color green "$title"
        print_color green "$(printf '-'%.0s $(seq 1 ${#title}))"
        
        for var_name in "${var_names[@]}"; do
            local value=$(get_env_variable "$var_name")
            
            local is_secret=0
            for secret_var in "${secret_vars[@]}"; do
                if [[ "$var_name" == "$secret_var" ]]; then
                    is_secret=1
                    break
                fi
            done

            print_color green "$var_name: "
            if [[ -n "$value" ]]; then
                if [[ "$is_secret" -eq 1 ]]; then
                    print_color green "[HIDDEN - Set]"
                else
                    print_color green "$value"
                fi
            else
                print_color yellow "[Not set]"
            fi
        done
    done
    
    print_color green "Press any key to continue..."
    read -n 1
}

# Show scripts functionality (Linux equivalent of Windows View Scripts)
show_list_scripts() {
    local config_name="$1"

    local command_prefix=$(get_command_prefix "$config_name")
    if [[ -z "$command_prefix" ]]; then
        print_color red "No command prefix found for $config_name"
        return
    fi

    if [[ ! -d "$LINUX_ENVS_DIR" ]]; then
        print_color red "$LINUX_ENVS_DIR directory not found"
        return
    fi

    local existing_scripts=$(get_existing_scripts "$config_name")

    clear
    print_color green "Available Files for $config_name"
    print_color green "Pattern: ${command_prefix}*"
    print_color green "$(printf '='%.0s $(seq 1 50))"

    if [[ -z "$existing_scripts" ]]; then
        print_color yellow "No files found matching pattern: ${command_prefix}*"
    else
        while IFS= read -r script_path; do
            if [[ -n "$script_path" ]]; then
                local script_name=$(basename "$script_path")
                print_color green "  $script_name"
            fi
        done <<< "$existing_scripts"
    fi

    local list_script_name="${command_prefix}list"
    print_color green "\nList script: $list_script_name"
    print_color green "Press any key to continue..."
    read -n 1
}

# Refresh Current Terminal Environment (Linux equivalent of Windows functionality)
refresh_current_terminal_environment() {
    clear
    print_color green "Refresh Current Terminal Environment"
    print_color green "===================================="
    print_color green "This will refresh all environment variables in the current terminal session."
    print_color green "No system changes will be made - only current terminal will be updated."
    echo ""

    print_color green "Refreshing all environment variables..."

    # Reload environment variables from global var directory
    if [[ -d "$GLOBAL_VAR_DIR" ]]; then
        local refreshed_count=0
        for var_file in "$GLOBAL_VAR_DIR"/*; do
            if [[ -f "$var_file" ]]; then
                local var_name=$(basename "$var_file")
                local var_value=$(cat "$var_file" 2>/dev/null | tr -d '\0' | head -n 1)
                if [[ -n "$var_value" ]]; then
                    export "$var_name=$var_value"
                    refreshed_count=$((refreshed_count + 1))
                fi
            fi
        done

        if [[ $refreshed_count -gt 0 ]]; then
            print_color green "Environment variables refreshed successfully!"
            print_color green "Refreshed $refreshed_count environment variables in current session."

            # Show status of all configured environment variables
            echo ""
            print_color green "Current status of configured environment variables:"
            print_color green "================================================="

            for config_name in "${!ENVIRONMENT_CONFIGS[@]}"; do
                local config_str="${ENVIRONMENT_CONFIGS[$config_name]}"
                local title=$(get_config_value "$config_name" "title")
                local vars_str=$(get_config_value "$config_name" "vars")
                local secrets_str=$(get_config_value "$config_name" "secrets")

                local -a var_names=($(echo "$vars_str" | tr ',' ' '))
                local -a secret_vars=($(echo "$secrets_str" | tr ',' ' '))

                print_color green "$title:"

                for var_name in "${var_names[@]}"; do
                    local current_value=$(get_env_variable "$var_name")
                    if [[ -n "$current_value" ]]; then
                        local is_secret=0
                        for secret_var in "${secret_vars[@]}"; do
                            if [[ "$var_name" == "$secret_var" ]]; then
                                is_secret=1
                                break
                            fi
                        done
                        if [[ "$is_secret" -eq 1 ]]; then
                            print_color green "  $var_name: [HIDDEN - Set]"
                        else
                            print_color green "  $var_name: $current_value"
                        fi
                    else
                        print_color yellow "  $var_name: [Not set]"
                    fi
                done
                echo ""
            done
        else
            print_color yellow "No environment variables found to refresh."
        fi
    else
        print_color red "Global variable directory not found: $GLOBAL_VAR_DIR"
    fi

    echo ""
    print_color green "Press any key to continue..."
    read -n 1
}

# Sub-menu for each configuration (1:1 match with Windows submenu structure)
show_config_submenu() {
    local config_name="$1"
    local title=$(get_config_value "$config_name" "title")

    local menu_options=(
        "Add $title Global Command"
        "Set $title Environment Variables"
        "View $title Scripts"
        "Back to Main Menu"
    )

    local selected_index=0
    local num_options=${#menu_options[@]}

    # Save current terminal settings
    local old_settings=$(stty -g)
    stty -icanon -echo
    trap 'stty "$old_settings"' EXIT

    while true; do
        clear
        print_color green "$title - Sub Menu"
        print_color green "Use Up/Down arrows to navigate, Enter to select"
        print_color green "=============================================="

        for i in "${!menu_options[@]}"; do
            if [[ "$i" -eq "$selected_index" ]]; then
                print_color yellow "> ${menu_options[$i]}"
            else
                print_color green "  ${menu_options[$i]}"
            fi
        done

        local key
        if ! IFS= read -rsn1 key; then
            continue
        fi

        case "$key" in
            $'\x1b')
                local seq=""
                local next
                if IFS= read -rsn1 -t 0.05 next; then
                    if [[ "$next" == "[" ]]; then
                        local final
                        if IFS= read -rsn1 -t 0.05 final; then
                            seq="[${final}"
                        else
                            seq="["
                        fi
                    else
                        seq="$next"
                    fi
                fi

                case "$seq" in
                    '[A')
                        selected_index=$(( (selected_index - 1 + num_options) % num_options ))
                        ;;
                    '[B')
                        selected_index=$(( (selected_index + 1) % num_options ))
                        ;;
                esac
                ;;
            $'\n')
                local selected_option="${menu_options[$selected_index]}"
                stty "$old_settings"
                case "$selected_option" in
                    "Add $title Global Command")
                        # Show file management menu first (1:1 match with Windows behavior)
                        local existing_scripts=$(get_existing_scripts "$config_name")
                        show_existing_files_menu "$config_name" "$existing_scripts"
                        # Use global variables to determine action
                        if [[ "$IS_REPLACING_FILE" == "true" ]]; then
                            generate_global_command "$config_name" "$TARGET_FILE_PATH"
                        else
                            generate_global_command "$config_name"
                        fi
                        ;;
                    "Set $title Environment Variables")
                        set_environment_variables "$config_name"
                        ;;
                    "View $title Scripts")
                        show_list_scripts "$config_name"
                        ;;
                    "Back to Main Menu")
                        trap - EXIT
                        return
                        ;;
                esac
                stty -icanon -echo
                trap 'stty "$old_settings"' EXIT
                ;;
            $'\x03'|$'\x1a')
                trap - EXIT
                stty "$old_settings"
                exit 0
                ;;
        esac
    done
}

# Main Menu for this script (Updated to match Windows structure 1:1)
main_special_env_menu() {
    local menu_options=(
        "Claude AI"
        "Alibaba Cloud"
        "View All Environment Variables"
        "Refresh Current Terminal Environment"
        "Back to Main Menu"
        "Exit"
    )
    
    local selected_index=0
    local num_options=${#menu_options[@]}
    
    # Save current terminal settings
    local old_settings=$(stty -g)
    stty -icanon -echo
    trap 'stty "$old_settings"' EXIT

    while true; do
        clear
        print_color green "Special Software Environment Variables Manager"
        print_color green "Use Up/Down arrows to navigate, Enter to select"
        print_color green "=============================================="

        for i in "${!menu_options[@]}"; do
            local menu_item="${menu_options[$i]}"
            # Add submenu indicator for services (1:1 match with Windows behavior)
            case "$menu_item" in
                "Claude AI"|"Alibaba Cloud")
                    if [[ "$i" -eq "$selected_index" ]]; then
                        print_color yellow "> $menu_item >"
                    else
                        print_color green "  $menu_item >"
                    fi
                    ;;
                *)
                    if [[ "$i" -eq "$selected_index" ]]; then
                        print_color yellow "> $menu_item"
                    else
                        print_color green "  $menu_item"
                    fi
                    ;;
            esac
        done
        
        local key
        if ! IFS= read -rsn1 key; then
            continue
        fi

        case "$key" in
            $'\x1b')
                local seq=""
                local next
                if IFS= read -rsn1 -t 0.05 next; then
                    if [[ "$next" == "[" ]]; then
                        local final
                        if IFS= read -rsn1 -t 0.05 final; then
                            seq="[${final}"
                        else
                            seq="["
                        fi
                    else
                        seq="$next"
                    fi
                fi

                case "$seq" in
                    '[A')
                        selected_index=$(( (selected_index - 1 + num_options) % num_options ))
                        ;;
                    '[B')
                        selected_index=$(( (selected_index + 1) % num_options ))
                        ;;
                esac
                ;;
            $'\n')
                local selected_option="${menu_options[$selected_index]}"
                stty "$old_settings"
                case "$selected_option" in
                    "Claude AI")
                        # Show submenu for Claude AI (1:1 match with Windows behavior)
                        show_config_submenu "Claude AI"
                        ;;
                    "Alibaba Cloud")
                        # Show submenu for Alibaba Cloud (1:1 match with Windows behavior)
                        show_config_submenu "Alibaba Cloud"
                        ;;
                    "View All Environment Variables")
                        show_all_environment_variables
                        ;;
                    "Refresh Current Terminal Environment")
                        refresh_current_terminal_environment
                        ;;
                    "Back to Main Menu")
                        trap - EXIT
                        return
                        ;;
                    "Exit")
                        trap - EXIT
                        exit 0
                        ;;
                esac
                stty -icanon -echo
                trap 'stty "$old_settings"' EXIT
                ;;
            $'\x03'|$'\x1a')
                trap - EXIT
                stty "$old_settings"
                exit 0
                ;;
        esac
    done
}

# Main Execution for this script
# Check if running as root (admin privileges)
if ! test_admin_privileges; then
    print_color red "This script requires root privileges to manage system environment variables."
    print_color yellow "Please run dd.sh with sudo or as root."
    print_color green "Press any key to continue..."
    read -n 1
fi

# Show main menu for special environment variables
main_special_env_menu
