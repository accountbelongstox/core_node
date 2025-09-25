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

# Ensure dd.sh functions are available (this script is sourced by dd.sh)
# Functions like print_color, get_global_var, set_global_var are expected to be in scope.

# Environment Variables Configuration
declare -A ENVIRONMENT_CONFIGS
ENVIRONMENT_CONFIGS["Claude AI"]="title=Claude AI Environment Variables;description=Set up Claude AI environment variables for API access;vars=ANTHROPIC_BASE_URL,ANTHROPIC_AUTH_TOKEN;secrets=ANTHROPIC_AUTH_TOKEN"
ENVIRONMENT_CONFIGS["Alibaba Cloud"]="title=Alibaba Cloud Environment Variables;description=Set up Alibaba Cloud environment variables for API access;vars=ALIBABA_CLOUD_ACCESS_KEY_ID,ALIBABA_CLOUD_ACCESS_KEY_SECRET;secrets=ALIBABA_CLOUD_ACCESS_KEY_SECRET"
# Example: Add new service configuration
# ENVIRONMENT_CONFIGS["OpenAI"]="title=OpenAI Environment Variables;description=Set up OpenAI environment variables for API access;vars=OPENAI_API_KEY,OPENAI_BASE_URL;secrets=OPENAI_API_KEY"

# Helper Functions
test_admin_privileges() {
    [ "$EUID" -eq 0 ]
}

set_env_variable() {
    local var_name="$1"
    local var_value="$2"
    # Use the set_global_var function from dd.sh
    set_global_var "$var_name" "$var_value"
}

get_env_variable() {
    local var_name="$1"
    # Use the get_global_var function from dd.sh
    get_global_var "$var_name"
}

# Generic Environment Variables Functions
set_environment_variables() {
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
        
        local var_description=$(echo "$config_str" | grep -o "description=[^;]*" | cut -d= -f2)
        if [[ -n "$var_description" ]]; then
            prompt_msg+="\nDescription: $var_description"
        fi
        
        print_color green "$prompt_msg"
        read -p "$var_name: " user_input
        
        if [[ -z "$user_input" ]]; then
            if [[ -n "$has_current_value" ]]; then
                new_values["$var_name"]="$has_current_value"
                if [[ "$is_secret" -eq 1 ]]; then
                    print_color green "Keeping current value: [HIDDEN]"
                else
                    print_color green "Keeping current value: $has_current_value"
                fi
            else
                print_color yellow "Skipping $var_name - no value entered"
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
    
    # Set environment variables
    print_color green "Setting environment variables..."
    
    local success_count=0
    local total_count=${#var_names[@]}
    
    for var_name in "${var_names[@]}"; do
        if [[ -n "${new_values[$var_name]}" ]]; then
            set_env_variable "$var_name" "${new_values[$var_name]}"
            success_count=$((success_count + 1))
        fi
    done
    
    if [[ "$success_count" -eq "$total_count" ]]; then
        print_color green "Environment variables set successfully!"
        for var_name in "${var_names[@]}"; do
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
        done
        
        print_color green "Environment variables have been saved."
        print_color yellow "Note: You may need to restart your terminal or applications to use the new environment variables."
    else
        print_color red "Failed to set some environment variables. Please check the errors above."
        print_color yellow "This might be due to insufficient permissions or system restrictions."
    fi
    
    print_color green "Press any key to continue..."
    read -n 1
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

# Main Menu for this script
main_special_env_menu() {
    local menu_options=(
        "Set Claude AI Environment Variables"
        "Set Alibaba Cloud Environment Variables"
        "View All Environment Variables"
        "Back to Main Menu"
        "Exit"
    )
    
    local selected_index=0
    local num_options=${#menu_options[@]}
    
    # Save current terminal settings
    local old_settings=$(stty -g)
    stty -icanon -echo
    trap 'stty "$old_settings"; exit' EXIT

    while true; do
        clear
        print_color green "Special Software Environment Variables Manager"
        print_color green "Use Up/Down arrows to navigate, Enter to select"
        print_color green "=============================================="
        
        for i in "${!menu_options[@]}"; do
            if [[ "$i" -eq "$selected_index" ]]; then
                print_color yellow "> ${menu_options[$i]}"
            else
                print_color green "  ${menu_options[$i]}"
            fi
        done
        
        local key_input
        read -s -n 3 key_input # Read 3 characters for arrow keys
        
        case "$key_input" in
            $'\x1b[A') # Up arrow
                selected_index=$(( (selected_index - 1 + num_options) % num_options ))
                ;;
            $'\x1b[B') # Down arrow
                selected_index=$(( (selected_index + 1) % num_options ))
                ;;
            '') # Enter key (empty string from read -s -n 3)
                case "${menu_options[$selected_index]}" in
                    "Set Claude AI Environment Variables")
                        set_environment_variables "Claude AI"
                        ;;
                    "Set Alibaba Cloud Environment Variables")
                        set_environment_variables "Alibaba Cloud"
                        ;;
                    "View All Environment Variables")
                        show_all_environment_variables
                        ;;
                    "Back to Main Menu")
                        stty "$old_settings"
                        return
                        ;;
                    "Exit")
                        stty "$old_settings"
                        exit 0
                        ;;
                esac
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