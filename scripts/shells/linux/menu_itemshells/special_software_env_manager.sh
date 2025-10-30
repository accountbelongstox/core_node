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
GLOBAL_SCRIPTS_DIR="$COMPILE_DIR/env_scripts"

# Source common functions if available
if [ -f "$LINUX_COMMON_DIR/common_functions.sh" ]; then
    source "$LINUX_COMMON_DIR/common_functions.sh"
fi

if [ -f "$LINUX_COMMON_DIR/gvar_common.sh" ]; then
    source "$LINUX_COMMON_DIR/gvar_common.sh"
fi

# Smart Recognition Helper Functions
test_string_has_whitespace_in_middle() {
    local input_string="$1"
    
    # Check if string contains whitespace, newlines, or carriage returns in the middle
    local trimmed=$(echo "$input_string" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    if [ ${#trimmed} -ne ${#input_string} ]; then
        return 0  # Has leading/trailing whitespace
    fi
    
    # Check for whitespace characters in the middle
    if echo "$input_string" | grep -q '[[:space:]]'; then
        return 0
    fi
    
    # Check for newlines or carriage returns
    if echo "$input_string" | grep -q '[\r\n]'; then
        return 0
    fi
    
    return 1
}

extract_api_url_and_token() {
    local input_text="$1"
    
    # Clean up the text: remove extra whitespace and normalize line breaks
    local cleaned_text=$(echo "$input_text" | tr '\r\n' ' ' | sed 's/[[:space:]]\+/ /g' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    # Split using whitespace pattern
    local tokens=($(echo "$cleaned_text" | tr ' ' '\n' | grep -v '^$'))
    
    # Extract API URLs and Tokens
    EXTRACTED_API_URLS=()
    EXTRACTED_TOKENS=()
    CLEANED_INPUT_TEXT="$cleaned_text"
    
    for token in "${tokens[@]}"; do
        if echo "$token" | grep -q '^https\?://'; then
            EXTRACTED_API_URLS+=("$token")
        elif [ ${#token} -gt 37 ]; then
            EXTRACTED_TOKENS+=("$token")
        fi
    done
    
    echo "Extraction Results:"
    echo "Total segments: ${#tokens[@]}"
    
    if [ ${#EXTRACTED_API_URLS[@]} -gt 0 ]; then
        echo "Found API URLs:"
        for url in "${EXTRACTED_API_URLS[@]}"; do
            echo "  - $url"
        done
    fi
    
    if [ ${#EXTRACTED_TOKENS[@]} -gt 0 ]; then
        echo "Found Tokens (length > 37):"
        for token in "${EXTRACTED_TOKENS[@]}"; do
            echo "  - $token"
        done
    fi
}

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

# Smart recognition variables
SMART_RECOGNITION_ENABLED=false
EXTRACTED_API_URLS=()
EXTRACTED_TOKENS=()
CLEANED_INPUT_TEXT=""

# User input tracking variables (Linux equivalent of PowerShell tracking)
declare -A USER_INPUT_VALUES
declare -A INPUT_TYPE_INDEX_TRACKER

# Smart Input Processing Functions
get_smart_input_for_variable() {
    local var_name="$1"
    local var_display="$2"
    local var_description="$3"
    local has_current_value="$4"
    local is_first_variable="$5"
    local input_type="$6"
    local default_value="$7"
    
    # Build prompt
    local prompt=""
    if [ "$has_current_value" = "true" ]; then
        prompt="Please enter $var_display (or press Enter to keep current value):"
    else
        prompt="Please enter $var_display (or press Enter to skip):"
    fi
    
    if [ -n "$var_description" ]; then
        prompt="$prompt\nDescription: $var_description"
    fi
    
    # Add default value information if available
    if [ -n "$default_value" ]; then
        prompt="$prompt\nDefault value: $default_value"
    fi
    
    # Add smart recognition hint if enabled and this is the first variable
    if [ "$SMART_RECOGNITION_ENABLED" = "true" ] && [ "$is_first_variable" = "true" ]; then
        prompt="$prompt\nNote: Multi-line input is supported and will be intelligently parsed."
        prompt="$prompt\nIf input contains spaces or line breaks, smart extraction will be applied."
        prompt="$prompt\nSubsequent variables may be auto-filled if both URL and Token are detected."
    fi
    
    echo -e "$prompt"
    
    # Get user input (support multi-line)
    local user_input=""
    local line
    while IFS= read -r line; do
        if [ -z "$user_input" ]; then
            user_input="$line"
        else
            user_input="$user_input\n$line"
        fi
    done
    
    # Check if input is empty
    if [ -z "$user_input" ]; then
        # If there's a default value, use it
        if [ -n "$default_value" ]; then
            echo "$default_value"
            return 0
        fi
        return 1
    fi
    
    # Check if smart recognition should be applied
    if [ "$SMART_RECOGNITION_ENABLED" = "true" ] && [ "$is_first_variable" = "true" ]; then
        # Check if input has whitespace/newlines in the middle
        if test_string_has_whitespace_in_middle "$user_input"; then
            echo "Multi-line input detected. Applying smart recognition..."
            
            # Extract API URLs and tokens
            extract_api_url_and_token "$user_input"
            
            echo ""
            echo "Press Enter to continue with smart extraction, or any other key to return to manual input:"
            read -n 1 confirm_key
            
            if [ "$confirm_key" != "" ]; then
                # User pressed a key other than Enter, return to manual input
                echo "Returning to manual input..."
                echo "$user_input"
                return 0
            fi
            
            # Continue with smart extraction
            echo "Continuing with smart extraction..."
            
            # Determine the value for current variable based on InputType
            local final_value=""
            if [ "$input_type" = "Url" ] && [ ${#EXTRACTED_API_URLS[@]} -gt 0 ]; then
                final_value="${EXTRACTED_API_URLS[0]}"
                echo "Using first API URL: $final_value"
            elif [ "$input_type" = "Token" ] && [ ${#EXTRACTED_TOKENS[@]} -gt 0 ]; then
                final_value="${EXTRACTED_TOKENS[0]}"
                echo "Using first Token: $final_value"
            else
                # Fallback to original input
                final_value="$user_input"
                echo "Using original input (no matching type found)"
            fi
            
            echo "$final_value"
            return 0
        fi
    fi
    
    echo "$user_input"
    return 0
}

# Get default value for variable (Linux equivalent of PowerShell function)
get_default_value_for_variable() {
    local var_name="$1"
    local default_var_name="$2"
    
    if [ -n "$default_var_name" ]; then
        # First check user input values (for current session)
        if [ -n "${USER_INPUT_VALUES[$default_var_name]}" ]; then
            echo "${USER_INPUT_VALUES[$default_var_name]}"
            return 0
        fi
        
        # Then check environment variables
        local default_value=$(get_env_variable "$default_var_name")
        if [ -n "$default_value" ]; then
            echo "$default_value"
            return 0
        fi
    fi
    
    return 1
}

# Reset input type index tracker (Linux equivalent of PowerShell function)
reset_input_type_index_tracker() {
    INPUT_TYPE_INDEX_TRACKER=()
}

# Reset user input values (Linux equivalent of PowerShell function)
reset_user_input_values() {
    USER_INPUT_VALUES=()
}

# Get value for next variable (Linux equivalent of PowerShell function)
get_value_for_next_variable() {
    local var_name="$1"
    local input_type="$2"
    local default_var_name="$3"
    
    # Check for DefaultValue first
    if [ -n "$default_var_name" ]; then
        local default_value=$(get_default_value_for_variable "$var_name" "$default_var_name")
        if [ -n "$default_value" ]; then
            echo "$default_value"
            return 0
        fi
    fi
    
    if [ -z "$input_type" ]; then
        return 1
    fi
    
    # Check if there's a user input value for the same InputType
    for key in "${!USER_INPUT_VALUES[@]}"; do
        # This is a simplified check - in a full implementation, you'd need to track input types
        if [ -n "${USER_INPUT_VALUES[$key]}" ]; then
            echo "${USER_INPUT_VALUES[$key]}"
            return 0
        fi
    done
    
    # Initialize tracker for this InputType if not exists
    if [ -z "${INPUT_TYPE_INDEX_TRACKER[$input_type]}" ]; then
        INPUT_TYPE_INDEX_TRACKER[$input_type]=0
    fi
    
    # Get current index for this InputType
    local current_index=${INPUT_TYPE_INDEX_TRACKER[$input_type]}
    
    # Get the appropriate array based on InputType
    local value_array=()
    case "$input_type" in
        "Url")
            value_array=("${EXTRACTED_API_URLS[@]}")
            ;;
        "Token")
            value_array=("${EXTRACTED_TOKENS[@]}")
            ;;
        *)
            # For unknown types, try Tokens as fallback
            value_array=("${EXTRACTED_TOKENS[@]}")
            ;;
    esac
    
    if [ ${#value_array[@]} -gt 0 ]; then
        # Use current index, or last index if current index is out of bounds
        local target_index=$current_index
        if [ $target_index -ge ${#value_array[@]} ]; then
            target_index=$((${#value_array[@]} - 1))
        fi
        
        local selected_value="${value_array[$target_index]}"
        
        # Increment index for next variable of same type
        INPUT_TYPE_INDEX_TRACKER[$input_type]=$((current_index + 1))
        
        echo "$selected_value"
        return 0
    fi
    
    return 1
}

# Environment Variables Configuration (Enhanced structure matching PowerShell version)
declare -A ENVIRONMENT_CONFIGS

# Claude AI Configuration
ENVIRONMENT_CONFIGS["Claude AI"]="title=Claude AI Environment Variables;description=Set up Claude AI environment variables for API access;common=claude;command_prefix=claude;smart_recognition=true;vars=ANTHROPIC_BASE_URL,ANTHROPIC_AUTH_TOKEN,ANTHROPIC_API_KEY;secrets=ANTHROPIC_AUTH_TOKEN,ANTHROPIC_API_KEY;input_types=Url,Token,Token;default_values=,,ANTHROPIC_AUTH_TOKEN"

# Alibaba Cloud Configuration  
ENVIRONMENT_CONFIGS["Alibaba Cloud"]="title=Alibaba Cloud Environment Variables;description=Set up Alibaba Cloud environment variables for API access;common=alibaba;command_prefix=aliyun;smart_recognition=false;vars=ALIBABA_CLOUD_ACCESS_KEY_ID,ALIBABA_CLOUD_ACCESS_KEY_SECRET;secrets=ALIBABA_CLOUD_ACCESS_KEY_SECRET;input_types=AccessKeyId,Token;default_values=,"

# Factory AI Droid Configuration
ENVIRONMENT_CONFIGS["Factory AI Droid"]="title=Factory AI Droid Environment Variables;description=Set up Factory AI Droid environment variables for API access;common=droid;command_prefix=droid;smart_recognition=true;vars=FACTORY_API_KEY;secrets=FACTORY_API_KEY;input_types=Token;default_values="

# OpenAI Configuration (uncommented and enhanced)
ENVIRONMENT_CONFIGS["OpenAI"]="title=OpenAI Environment Variables;description=Set up OpenAI environment variables for API access;common=openai;command_prefix=openai;smart_recognition=true;vars=OPENAI_API_KEY,OPENAI_BASE_URL,OPENAI_ORG_ID;secrets=OPENAI_API_KEY;input_types=Token,Url,Token;default_values=,,OPENAI_API_KEY"

# Action to Config Mapping (Linux equivalent of PowerShell mapping)
declare -A ACTION_TO_CONFIG_MAPPING
ACTION_TO_CONFIG_MAPPING["claude"]="Claude AI"
ACTION_TO_CONFIG_MAPPING["alibaba"]="Alibaba Cloud"
ACTION_TO_CONFIG_MAPPING["droid"]="Factory AI Droid"
ACTION_TO_CONFIG_MAPPING["openai"]="OpenAI"

# Get full config name (Linux equivalent of PowerShell function)
get_full_config_name() {
    local action="$1"
    if [ -n "${ACTION_TO_CONFIG_MAPPING[$action]}" ]; then
        echo "${ACTION_TO_CONFIG_MAPPING[$action]}"
    else
        echo "$action"
    fi
}

# Helper Functions
# Environment Variable Management Functions
set_environment_variable() {
    local var_name="$1"
    local var_value="$2"
    local delete_flag="$3"
    
    if [ "$delete_flag" = "true" ]; then
        # Delete the environment variable
        unset "$var_name"
        # Remove from shell profile files
        sed -i "/export $var_name=/d" ~/.bashrc 2>/dev/null || true
        sed -i "/export $var_name=/d" ~/.profile 2>/dev/null || true
        sed -i "/export $var_name=/d" ~/.bash_profile 2>/dev/null || true
        echo "Environment variable $var_name deleted"
    else
        # Set the environment variable
        export "$var_name=$var_value"
        # Add to shell profile files
        echo "export $var_name=\"$var_value\"" >> ~/.bashrc
        echo "export $var_name=\"$var_value\"" >> ~/.profile
        echo "Environment variable $var_name set to: $var_value"
    fi
    return 0
}

get_environment_variable() {
    local var_name="$1"
    echo "${!var_name}"
}

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

# Enhanced configuration parsing functions (Linux equivalent of PowerShell functions)
get_config_display_name() {
    local config_name="$1"
    get_config_value "$config_name" "title"
}

get_smart_recognition_enabled() {
    local config_name="$1"
    local smart_recognition=$(get_config_value "$config_name" "smart_recognition")
    [ "$smart_recognition" = "true" ]
}

get_config_variables() {
    local config_name="$1"
    local vars_str=$(get_config_value "$config_name" "vars")
    if [ -n "$vars_str" ]; then
        echo "$vars_str" | tr ',' ' '
    fi
}

get_config_secrets() {
    local config_name="$1"
    local secrets_str=$(get_config_value "$config_name" "secrets")
    if [ -n "$secrets_str" ]; then
        echo "$secrets_str" | tr ',' ' '
    fi
}

get_config_input_types() {
    local config_name="$1"
    local input_types_str=$(get_config_value "$config_name" "input_types")
    if [ -n "$input_types_str" ]; then
        echo "$input_types_str" | tr ',' ' '
    fi
}

get_config_default_values() {
    local config_name="$1"
    local default_values_str=$(get_config_value "$config_name" "default_values")
    if [ -n "$default_values_str" ]; then
        echo "$default_values_str" | tr ',' ' '
    fi
}

# Check if variable is secret
is_variable_secret() {
    local config_name="$1"
    local var_name="$2"
    local secrets=($(get_config_secrets "$config_name"))
    for secret in "${secrets[@]}"; do
        if [ "$var_name" = "$secret" ]; then
            return 0
        fi
    done
    return 1
}

# Get input type for variable
get_variable_input_type() {
    local config_name="$1"
    local var_name="$2"
    local vars=($(get_config_variables "$config_name"))
    local input_types=($(get_config_input_types "$config_name"))
    
    for i in "${!vars[@]}"; do
        if [ "${vars[$i]}" = "$var_name" ]; then
            if [ $i -lt ${#input_types[@]} ]; then
                echo "${input_types[$i]}"
                return 0
            fi
        fi
    done
    return 1
}

# Get default value for variable
get_variable_default_value() {
    local config_name="$1"
    local var_name="$2"
    local vars=($(get_config_variables "$config_name"))
    local default_values=($(get_config_default_values "$config_name"))
    
    for i in "${!vars[@]}"; do
        if [ "${vars[$i]}" = "$var_name" ]; then
            if [ $i -lt ${#default_values[@]} ]; then
                echo "${default_values[$i]}"
                return 0
            fi
        fi
    done
    return 1
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

generate_global_command() {
    local config_name="$1"
    local target_file_path="$2"
    
    local command_prefix=$(get_command_prefix "$config_name")
    local title=$(get_config_value "$config_name" "title")
    
    if [ -z "$command_prefix" ]; then
        print_color red "No command prefix found for $config_name"
        return 1
    fi
    
    # Create global scripts directory
    if [ -n "$USE_SUDO" ]; then
        $USE_SUDO mkdir -p "$GLOBAL_SCRIPTS_DIR"
    else
        mkdir -p "$GLOBAL_SCRIPTS_DIR"
    fi
    
    # Generate script content
    local script_content="#!/bin/bash\n"
    script_content+="# $title\n"
    script_content+="# Generated by Special Software Environment Variables Manager\n\n"
    
    # Add environment variable exports
    local vars_str=$(get_config_value "$config_name" "vars")
    if [ -n "$vars_str" ]; then
        IFS=',' read -ra vars <<< "$vars_str"
        for var in "${vars[@]}"; do
            local var_value=$(get_env_variable "$var")
            if [ -n "$var_value" ]; then
                script_content+="export $var=\"$var_value\"\n"
            fi
        done
    fi
    
    script_content+="\n# Execute command with environment variables\n"
    script_content+="exec \"\$@\"\n"
    
    # Determine output file in global scripts directory
    local script_file
    if [ -n "$target_file_path" ]; then
        # Extract filename from target path and use it in global scripts directory
        local script_name=$(basename "$target_file_path")
        script_file="$GLOBAL_SCRIPTS_DIR/$script_name"
    else
        local file_number=1
        while [ -f "$GLOBAL_SCRIPTS_DIR/${command_prefix}${file_number}" ]; do
            ((file_number++))
        done
        script_file="$GLOBAL_SCRIPTS_DIR/${command_prefix}${file_number}"
    fi
    
    # Write script content to global scripts directory
    if [ -n "$USE_SUDO" ]; then
        echo -e "$script_content" | $USE_SUDO tee "$script_file" >/dev/null
        $USE_SUDO chmod +x "$script_file"
    else
        echo -e "$script_content" > "$script_file"
        chmod +x "$script_file"
    fi
    
    # Create symbolic link in /usr/local/bin
    local link_name=$(basename "$script_file")
    local link_path="$LINUX_ENVS_DIR/$link_name"
    
    # Remove existing link if it exists
    if [ -L "$link_path" ] || [ -f "$link_path" ]; then
        if [ -n "$USE_SUDO" ]; then
            $USE_SUDO rm -f "$link_path"
        else
            rm -f "$link_path"
        fi
    fi
    
    # Create symbolic link
    if [ -n "$USE_SUDO" ]; then
        $USE_SUDO ln -s "$script_file" "$link_path"
    else
        ln -s "$script_file" "$link_path"
    fi
    
    print_color green "Global command script generated: $script_file"
    print_color green "Symbolic link created: $link_path -> $script_file"
    return 0
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
    
    # Get user input for each variable using smart input processing
    declare -A new_values
    declare -a empty_variables
    declare -a temporarily_cleared
    
    # Enable smart recognition if configured
    if get_smart_recognition_enabled "$config_name"; then
        SMART_RECOGNITION_ENABLED=true
    else
        SMART_RECOGNITION_ENABLED=false
    fi
    
    # Reset tracking variables for this session
    reset_input_type_index_tracker
    reset_user_input_values
    
    # Store extracted data for auto-filling next variables
    local extracted_data=""
    local skip_next=false
    
    for i in "${!var_names[@]}"; do
        local var_name="${var_names[$i]}"
        local has_current_value="${current_values[$var_name]}"
        local is_first_variable=false
        if [ $i -eq 0 ]; then
            is_first_variable=true
        fi
        
        # Check if we should skip this variable (auto-filled from previous extraction)
        if [ "$skip_next" = "true" ]; then
            skip_next=false
            local input_type=$(get_variable_input_type "$config_name" "$var_name")
            local default_var_name=$(get_variable_default_value "$config_name" "$var_name")
            local auto_value=$(get_value_for_next_variable "$var_name" "$input_type" "$default_var_name")
            if [ -n "$auto_value" ]; then
                new_values["$var_name"]="$auto_value"
                print_color green "Auto-filled $var_name: $auto_value"
                USER_INPUT_VALUES["$var_name"]="$auto_value"
                continue
            fi
        fi
        
        # Get variable properties
        local var_display="$var_name"
        local var_description=$(get_config_value "$config_name" "description")
        local input_type=$(get_variable_input_type "$config_name" "$var_name")
        local default_var_name=$(get_variable_default_value "$config_name" "$var_name")
        local default_value=""
        if [ -n "$default_var_name" ]; then
            default_value=$(get_default_value_for_variable "$var_name" "$default_var_name")
        fi
        
        # Use smart input processing
        local user_input=$(get_smart_input_for_variable "$var_name" "$var_display" "$var_description" "$has_current_value" "$is_first_variable" "$input_type" "$default_value")
        
        # Check for default value if user input is empty
        if [ -z "$user_input" ]; then
            if [ -n "$default_value" ]; then
                user_input="$default_value"
                print_color green "Using default value for $var_display: $default_value"
            fi
        fi
        
        if [ -n "$user_input" ]; then
            # Check if this was smart extraction and should skip next
            if [ "$SMART_RECOGNITION_ENABLED" = "true" ] && [ "$is_first_variable" = "true" ] && [ ${#EXTRACTED_API_URLS[@]} -gt 0 ] && [ ${#EXTRACTED_TOKENS[@]} -gt 0 ]; then
                # Check if next variable is different type
                if [ $((i + 1)) -lt ${#var_names[@]} ]; then
                    local next_var_name="${var_names[$((i + 1))]}"
                    local next_input_type=$(get_variable_input_type "$config_name" "$next_var_name")
                    if [ "$input_type" != "$next_input_type" ]; then
                        skip_next=true
                        print_color green "Both URL and Token found. Next variable will be auto-filled."
                    fi
                fi
            fi
            
            new_values["$var_name"]="$user_input"
            USER_INPUT_VALUES["$var_name"]="$user_input"
            
            if is_variable_secret "$config_name" "$var_name"; then
                print_color green "New value set: [HIDDEN]"
            else
                print_color green "New value set: $user_input"
            fi
        else
            if [ -n "$has_current_value" ]; then
                print_color green "Variable has current value. Choose action:"
                print_color green "1. Keep current value"
                print_color green "2. Set to empty (delete)"
                print_color green "3. Temporarily clear (current session only)"

                read -p "Enter choice (1-3, default: 1): " choice

                if [ -z "$choice" ]; then
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
                        if is_variable_secret "$config_name" "$var_name"; then
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

    # Enable smart recognition if configured
    if get_smart_recognition_enabled "$config_name"; then
        SMART_RECOGNITION_ENABLED=true
    else
        SMART_RECOGNITION_ENABLED=false
    fi
    
    # Reset tracking variables for this session
    reset_input_type_index_tracker
    reset_user_input_values
    
    # Store extracted data for auto-filling next variables
    local extracted_data=""
    local skip_next=false

    for i in "${!var_names[@]}"; do
        local var_name="${var_names[$i]}"
        local is_first_variable=false
        if [ $i -eq 0 ]; then
            is_first_variable=true
        fi
        
        # Check if we should skip this variable (auto-filled from previous extraction)
        if [ "$skip_next" = "true" ]; then
            skip_next=false
            local input_type=$(get_variable_input_type "$config_name" "$var_name")
            local default_var_name=$(get_variable_default_value "$config_name" "$var_name")
            local auto_value=$(get_value_for_next_variable "$var_name" "$input_type" "$default_var_name")
            if [ -n "$auto_value" ]; then
                env_commands+=("echo \"Setting $var_name=[AUTO-FILLED]\"")
                env_commands+=("export $var_name=\"$auto_value\"")
                env_exports+=("export $var_name=\"$auto_value\"")
                print_color green "Auto-filled $var_name: $auto_value"
                USER_INPUT_VALUES["$var_name"]="$auto_value"
                continue
            fi
        fi
        
        # Get variable properties
        local var_display="$var_name"
        local var_description=$(get_config_value "$config_name" "description")
        local input_type=$(get_variable_input_type "$config_name" "$var_name")
        local default_var_name=$(get_variable_default_value "$config_name" "$var_name")
        local default_value=""
        if [ -n "$default_var_name" ]; then
            default_value=$(get_default_value_for_variable "$var_name" "$default_var_name")
        fi
        
        # Use smart input processing
        local user_input=$(get_smart_input_for_variable "$var_name" "$var_display" "$var_description" "false" "$is_first_variable" "$input_type" "$default_value")
        
        # Check for default value if user input is empty
        if [ -z "$user_input" ]; then
            if [ -n "$default_value" ]; then
                user_input="$default_value"
                print_color green "Using default value for $var_display: $default_value"
            fi
        fi
        
        if [ -n "$user_input" ]; then
            # Check if this was smart extraction and should skip next
            if [ "$SMART_RECOGNITION_ENABLED" = "true" ] && [ "$is_first_variable" = "true" ] && [ ${#EXTRACTED_API_URLS[@]} -gt 0 ] && [ ${#EXTRACTED_TOKENS[@]} -gt 0 ]; then
                # Check if next variable is different type
                if [ $((i + 1)) -lt ${#var_names[@]} ]; then
                    local next_var_name="${var_names[$((i + 1))]}"
                    local next_input_type=$(get_variable_input_type "$config_name" "$next_var_name")
                    if [ "$input_type" != "$next_input_type" ]; then
                        skip_next=true
                        print_color green "Both URL and Token found. Next variable will be auto-filled."
                    fi
                fi
            fi
            
            env_commands+=("echo \"Setting $var_name=$user_input\"")
            env_commands+=("export $var_name=\"$user_input\"")
            env_exports+=("export $var_name=\"$user_input\"")
            USER_INPUT_VALUES["$var_name"]="$user_input"
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
            $'\n'|$'\r'|'')
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

# Sub-menu for each configuration (1:1 match with PowerShell Show-SubMenu function)
show_config_submenu() {
    local config_name="$1"
    local config_display_name=$(get_config_display_name "$config_name")

    local menu_options=(
        "Add $config_display_name Global Command"
        "Set $config_display_name Environment Variables"
        "View $config_display_name Scripts"
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
        print_color green "$config_display_name - Sub Menu"
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
            $'\n'|$'\r'|'')
                local selected_option="${menu_options[$selected_index]}"
                # Restore terminal settings before executing action
                stty "$old_settings"
                case "$selected_option" in
                    "Add $config_display_name Global Command")
                        # Show file management menu first (1:1 match with PowerShell behavior)
                        local existing_files=$(get_existing_scripts "$config_name")
                        show_existing_files_menu "$config_name" "$existing_files"
                        # Use global variables to determine action (matching PowerShell logic)
                        if [[ "$IS_REPLACING_FILE" == "true" ]]; then
                            generate_global_command "$config_name" "$TARGET_FILE_PATH"
                        else
                            generate_global_command "$config_name"
                        fi
                        ;;
                    "Set $config_display_name Environment Variables")
                        set_environment_variables "$config_name"
                        ;;
                    "View $config_display_name Scripts")
                        show_list_scripts "$config_name"
                        ;;
                    "Back to Main Menu")
                        trap - EXIT
                        return
                        ;;
                esac
                # Restore terminal settings for menu navigation
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

# Helper function to check if menu item is a config name
is_config_item() {
    local item="$1"
    [[ -n "${ENVIRONMENT_CONFIGS[$item]}" ]]
}

# Main Menu for this script (1:1 match with PowerShell version)
main_special_env_menu() {
    # Build menu options dynamically from ENVIRONMENT_CONFIGS (matching PowerShell structure)
    local menu_options=()
    
    # Add configuration-based menu items (matching PowerShell Show-SpecialSoftwareEnvMenu)
    for config_name in "${!ENVIRONMENT_CONFIGS[@]}"; do
        local common=$(get_config_value "$config_name" "common")
        menu_options+=("$config_name|$common|true")  # Format: "DisplayName|Action|HasSubMenu"
    done
    
    # Sort config names alphabetically for consistent display
    IFS=$'\n' menu_options=($(sort <<<"${menu_options[*]}"))
    unset IFS
    
    # Add utility menu items (matching PowerShell structure)
    menu_options+=("View All Environment Variables|viewall|false")
    menu_options+=("Refresh Current Terminal Environment|refresh|false")
    menu_options+=("Back to Main Menu|back|false")
    menu_options+=("Exit|exit|false")
    
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
            local display_name=$(echo "$menu_item" | cut -d'|' -f1)
            local action=$(echo "$menu_item" | cut -d'|' -f2)
            local has_submenu=$(echo "$menu_item" | cut -d'|' -f3)
            
            if [[ "$i" -eq "$selected_index" ]]; then
                if [[ "$has_submenu" == "true" ]]; then
                    print_color yellow "> $display_name >"
                else
                    print_color yellow "> $display_name"
                fi
            else
                if [[ "$has_submenu" == "true" ]]; then
                    print_color green "  $display_name >"
                else
                    print_color green "  $menu_item"
                fi
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
            $'\n'|$'\r'|'')
                local selected_option="${menu_options[$selected_index]}"
                local display_name=$(echo "$selected_option" | cut -d'|' -f1)
                local action=$(echo "$selected_option" | cut -d'|' -f2)
                local has_submenu=$(echo "$selected_option" | cut -d'|' -f3)
                
                # Restore terminal settings before executing action
                stty "$old_settings"
                
                if [[ "$has_submenu" == "true" ]]; then
                    # Convert action to full config name (matching PowerShell behavior)
                    local full_config_name=$(get_full_config_name "$action")
                    show_config_submenu "$full_config_name"
                else
                    # Handle fixed menu options (matching PowerShell switch statement)
                    case "$action" in
                        'viewall')
                            show_all_environment_variables
                            ;;
                        'refresh')
                            refresh_current_terminal_environment
                            ;;
                        'back')
                            trap - EXIT
                            return
                            ;;
                        'exit')
                            trap - EXIT
                            exit 0
                            ;;
                    esac
                fi
                
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
