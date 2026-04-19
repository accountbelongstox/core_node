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

# Common Functions Module for Special Software Environment Manager
# Contains all shared functions and utilities used by AI tool menu modules

# Variable Declarations
declare -g SECRET_MANAGER_PASSWORD=""
declare -gA AUTO_FILLED_VARIABLES=()
declare -gA USER_INPUT_VALUES=()
declare -gA INPUT_TYPE_INDEX_TRACKER=()

# Helper Functions

print_color() {
    local message="$1"
    local type="${2:-Info}"
    local no_newline="${3:-false}"

    local color=""
    case "$type" in
        "Error") color="\033[31m" ;;
        "Warning") color="\033[33m" ;;
        "Success") color="\033[32m" ;;
        "Info") color="\033[36m" ;;
        *) color="\033[37m" ;;
    esac

    if [ "$no_newline" = "true" ]; then
        echo -ne "${color}${message}\033[0m"
    else
        echo -e "${color}${message}\033[0m"
    fi
}

test_admin_privileges() {
    if [ "$EUID" -eq 0 ]; then
        return 0
    else
        return 1
    fi
}

get_node_absolute_path() {
    if [ -n "${NODE_BIN:-}" ] && [ -f "$NODE_BIN" ]; then
        echo "$NODE_BIN"
    elif [ -n "${NODE_INSTALL_DIR:-}" ] && [ -d "$NODE_INSTALL_DIR" ]; then
        local found_node=$(find "$NODE_INSTALL_DIR" -name "node" -type f -executable 2>/dev/null | head -n 1)
        if [ -n "$found_node" ]; then
            echo "$found_node"
        else
            command -v node 2>/dev/null || echo "node"
        fi
    else
        command -v node 2>/dev/null || echo "node"
    fi
}

get_npm_global_bin_path() {
    local node_path
    node_path=$(get_node_absolute_path)

    local node_dir
    node_dir=$(dirname "$node_path")

    echo "$node_dir"
}

set_environment_variable() {
    local variable_name="$1"
    local variable_value="${2:-}"
    local delete="${3:-false}"

    if [ "$delete" = "true" ]; then
        unset "$variable_name"
        $USE_SUDO sed -i "/^export ${variable_name}=/d" /etc/environment 2>/dev/null || true
    else
"$variable_name=$variable_value"

        if grep -q "^export ${variable_name}=" /etc/environment 2>/dev/null; then
            $USE_SUDO sed -i "s|^export ${variable_name}=.*|export ${variable_name}=\"${variable_value}\"|" /etc/environment
        else
            echo "export ${variable_name}=\"${variable_value}\"" | $USE_SUDO tee -a /etc/environment >/dev/null
        fi
    fi
    return 0
}

get_environment_variable() {
    local variable_name="$1"

    eval echo \$$variable_name
}

save_secret_to_manager() {
    local key_name="$1"
    local value="$2"
    local password="${3:-}"
    local skip_encryption="${4:-false}"

    if [ -z "$key_name" ] || [ -z "$value" ]; then
        return 1
    fi

    if ! command -v secret_set_key >/dev/null 2>&1; then
        print_color "SecretManager not loaded. Please ensure secret_manager.sh is sourced." "Error"
        return 1
    fi

    if [ "$skip_encryption" = "true" ]; then
        secret_set_key "$key_name" "$value" --skip-encryption
    elif [ -n "$password" ]; then
        secret_set_key "$key_name" "$value" --password "$password"
        if [ $? -eq 0 ]; then
            SECRET_MANAGER_PASSWORD="$password"
        fi
    else
        if [ -n "$SECRET_MANAGER_PASSWORD" ]; then
            password="$SECRET_MANAGER_PASSWORD"
        fi
        secret_set_key "$key_name" "$value" --password "$password"
        if [ $? -eq 0 ]; then
            SECRET_MANAGER_PASSWORD="$password"
        fi
    fi

    return $?
}

# Smart Recognition Helper Functions

test_string_has_whitespace_in_middle() {
    local input_string="$1"

    local trimmed=$(echo "$input_string" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    if [ ${#trimmed} -ne ${#input_string} ]; then
        return 0
    fi

    if echo "$input_string" | grep -q '[[:space:]]'; then
        return 0
    fi

    if echo "$input_string" | grep -q '[\r\n]'; then
        return 0
    fi

    return 1
}

extract_api_url_and_token() {
    local input_text="$1"

    local cleaned_text=$(echo "$input_text" | tr '\r\n' ' ' | sed 's/[[:space:]]\+/ /g' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

    local -a tokens
    IFS=' ' read -ra tokens <<< "$cleaned_text"

    local -a api_urls=()
    local -a found_tokens=()
    local -a access_key_ids=()

    for token in "${tokens[@]}"; do
        if [[ "$token" =~ ^https?:// ]]; then
            api_urls+=("$token")
        elif [[ "$token" =~ ^[A-Z0-9]{16,}$ ]]; then
            access_key_ids+=("$token")
        elif [ ${#token} -gt 37 ]; then
            found_tokens+=("$token")
        fi
    done

    echo "API_URLS:${api_urls[*]}"
    echo "TOKENS:${found_tokens[*]}"
    echo "ACCESS_KEY_IDS:${access_key_ids[*]}"
    echo "CLEANED_TEXT:$cleaned_text"
    echo "TOTAL_SEGMENTS:${#tokens[@]}"
}

# Smart Input Processing Functions

get_default_value_for_variable() {
    local -n var_ref=$1

    if [ -n "${var_ref[DefaultValue]:-}" ]; then
        local default_var_name="${var_ref[DefaultValue]}"

        if [ -n "${USER_INPUT_VALUES[$default_var_name]:-}" ]; then
            echo "${USER_INPUT_VALUES[$default_var_name]}"
            return 0
        fi

        local default_value=$(get_environment_variable "$default_var_name")
        if [ -n "$default_value" ]; then
            echo "$default_value"
            return 0
        fi
    fi

    return 1
}

reset_input_type_index_tracker() {
    INPUT_TYPE_INDEX_TRACKER=()
}

reset_user_input_values() {
    USER_INPUT_VALUES=()
    AUTO_FILLED_VARIABLES=()
}

get_value_for_next_variable() {
    local -n var_ref=$1
    local -n extracted_data_ref=$2
    local token_fill_strategy="${3:-all}"
    local target_token_variable_name="${4:-}"

    local default_value
    default_value=$(get_default_value_for_variable var_ref)
    if [ -n "$default_value" ]; then
        echo "$default_value"
        return 0
    fi

    local input_type="${var_ref[InputType]:-}"

    if [ -z "$input_type" ]; then
        return 1
    fi

    if [ "$input_type" = "Token" ] && [ "$token_fill_strategy" = "single" ] && [ -n "$target_token_variable_name" ]; then
        if [ "${var_ref[Name]}" != "$target_token_variable_name" ]; then
            return 1
        fi
    fi

    for key in "${!USER_INPUT_VALUES[@]}"; do
        local existing_var_input_type="${CURRENT_CONFIG_VARIABLES_${key}_InputType:-}"
        if [ "$existing_var_input_type" = "$input_type" ]; then
            echo "${USER_INPUT_VALUES[$key]}"
            return 0
        fi
    done

    if [ -z "${INPUT_TYPE_INDEX_TRACKER[$input_type]:-}" ]; then
        INPUT_TYPE_INDEX_TRACKER[$input_type]=0
    fi

    local current_index=${INPUT_TYPE_INDEX_TRACKER[$input_type]}

    local -a value_array=()
    case "$input_type" in
        "Url")
            IFS=':' read -ra value_array <<< "${extracted_data_ref[API_URLS]:-}"
            ;;
        "Token")
            IFS=':' read -ra value_array <<< "${extracted_data_ref[TOKENS]:-}"
            ;;
        "AccessKeyId")
            IFS=':' read -ra value_array <<< "${extracted_data_ref[ACCESS_KEY_IDS]:-}"
            if [ ${#value_array[@]} -eq 0 ]; then
                IFS=':' read -ra value_array <<< "${extracted_data_ref[TOKENS]:-}"
            fi
            ;;
        *)
            IFS=':' read -ra value_array <<< "${extracted_data_ref[TOKENS]:-}"
            ;;
    esac

    if [ ${#value_array[@]} -gt 0 ]; then
        local target_index=$current_index
        if [ $target_index -ge ${#value_array[@]} ]; then
            target_index=$((${#value_array[@]} - 1))
        fi

        local selected_value="${value_array[$target_index]}"
        INPUT_TYPE_INDEX_TRACKER[$input_type]=$((current_index + 1))

        echo "$selected_value"
        return 0
    fi

    return 1
}

get_smart_input_for_variable() {
    local var_index="$1"
    local config_name="$2"
    local has_current_value="${3:-false}"
    local is_required="${4:-false}"

    local var_name=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Variables_${var_index}_Name:-}")
    local var_display_name=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Variables_${var_index}_DisplayName:-}")
    local var_description=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Variables_${var_index}_Description:-}")
    local var_input_type=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Variables_${var_index}_InputType:-}")

    local prompt_suffix=""
    if [ "$has_current_value" = "true" ]; then
        prompt_suffix="(or press Enter to keep current value)"
    elif [ "$is_required" = "true" ]; then
        prompt_suffix="(required)"
    else
        prompt_suffix="(or press Enter to skip)"
    fi

    local prompt="Please enter $var_display_name $prompt_suffix"
    if [ -n "$var_description" ]; then
        prompt="$prompt\nDescription: $var_description"
    fi

    echo -e "$prompt"
    read -r user_input

    echo "$user_input"
}

# Script Generation Functions

ensure_array() {
    local -n arr_ref=$1

    if [ ! -v arr_ref ]; then
        arr_ref=()
    fi
}

get_common_name() {
    local config_name="$1"

    eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Common:-}"
}

get_list_script_name() {
    local config_name="$1"

    local command_prefix
    command_prefix=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_CommandPrefix:-}")

    if [ -n "$command_prefix" ]; then
        echo "${command_prefix}list"
    else
        local common
        common=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Common:-}")
        if [ -n "$common" ]; then
            echo "${common}list"
        fi
    fi
}

get_existing_scripts() {
    local config_name="$1"

    local list_script_name
    list_script_name=$(get_list_script_name "$config_name")

    if [ -z "$list_script_name" ]; then
        return 0
    fi

    if [ ! -d "$GLOBAL_SCRIPTS_DIR" ]; then
        return 0
    fi

    find "$GLOBAL_SCRIPTS_DIR" -name "${list_script_name}*" -type f 2>/dev/null | sort
}

# Environment Variables Generic Functions

show_all_environment_variables() {
    clear
    print_color "All Environment Variables Status" "Info"
    print_color "===============================" "Info"

    for config_name in "${ENVIRONMENT_CONFIGS_KEYS[@]}"; do
        local title=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Title:-}")

        echo ""
        print_color "$title" "Info"
        print_color "$(printf '%*s' ${#title} | tr ' ' '-')" "Info"

        local var_count=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Variables_Count:-0}")
        for ((i=0; i<var_count; i++)); do
            local var_name=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Variables_${i}_Name:-}")
            local var_display_name=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Variables_${i}_DisplayName:-}")

            local value=$(get_environment_variable "$var_name")

            if [ -n "$value" ]; then
                print_color "$var_display_name: $value" "Success"
            else
                print_color "$var_display_name: [Not set]" "Warning"
            fi
        done
    done

    echo ""
    print_color "Press any key to continue..." "Info"
    read -n 1 -s
}

refresh_current_terminal_environment() {
    clear
    print_color "Refresh Current Terminal Environment" "Info"
    print_color "====================================" "Info"
    print_color "This will refresh all environment variables in the current terminal session." "Info"
    print_color "No system changes will be made - only current terminal will be updated." "Info"
    echo ""

    print_color "Refreshing all environment variables..." "Info"

    if [ -f /etc/environment ]; then
        set -a
        source /etc/environment 2>/dev/null || true
        set +a

        print_color "All environment variables refreshed successfully!" "Success"
        print_color "Current terminal session now has the latest environment variables." "Success"

        echo ""
        print_color "Current status of configured environment variables:" "Info"
        print_color "=================================================" "Info"

        for config_name in "${ENVIRONMENT_CONFIGS_KEYS[@]}"; do
            local title=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Title:-}")

            print_color "$title:" "Info"

            local var_count=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Variables_Count:-0}")
            for ((i=0; i<var_count; i++)); do
                local var_name=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Variables_${i}_Name:-}")
                local var_display_name=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Variables_${i}_DisplayName:-}")

                local current_value=$(get_environment_variable "$var_name")
                if [ -n "$current_value" ]; then
                    print_color "  $var_display_name: $current_value" "Success"
                else
                    print_color "  $var_display_name: [Not set]" "Warning"
                fi
            done
            echo ""
        done
    else
        print_color "Error: /etc/environment not found" "Error"
    fi

    echo ""
    print_color "Press any key to continue..." "Info"
    read -n 1 -s
}

# Empty Variables Menu Function

show_empty_variables_menu() {
    local -a menu_items=(
        "keep:Keep old values (default)"
        "delete:Delete variables"
        "empty:Set to empty values"
    )

    local selected_index=0

    while true; do
        clear
        print_color "Empty Variables Handling Options" "Info"
        print_color "Use Up/Down arrows to navigate, Enter to select" "Info"
        print_color "=" "Info"

        for i in "${!menu_items[@]}"; do
            IFS=':' read -r action text <<< "${menu_items[$i]}"
            if [ $i -eq $selected_index ]; then
                echo -e "\033[33m> $text\033[0m"
            else
                echo "  $text"
            fi
        done

        read -rsn1 key
        case "$key" in
            $'\x1b')
                read -rsn2 key
                case "$key" in
                    '[A') ((selected_index--)); [ $selected_index -lt 0 ] && selected_index=$((${#menu_items[@]} - 1)) ;;
                    '[B') ((selected_index++)); [ $selected_index -ge ${#menu_items[@]} ] && selected_index=0 ;;
                esac
                ;;
            '')
                IFS=':' read -r action text <<< "${menu_items[$selected_index]}"
                echo "$action"
                return 0
                ;;
        esac
    done
}

# Global Command Generation Functions

get_command_prefix() {
    local config_name="$1"
    local command_prefix=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_CommandPrefix:-}")
    if [ -n "$command_prefix" ]; then
        echo "$command_prefix"
    else
        eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Common:-}"
    fi
}

get_existing_files() {
    local config_name="$1"
    local file_prefix
    file_prefix=$(get_command_prefix "$config_name")

    if [ -z "$file_prefix" ]; then
        return 0
    fi

    if [ ! -d "$GLOBAL_SCRIPTS_DIR" ]; then
        return 0
    fi

    find "$GLOBAL_SCRIPTS_DIR" -name "${file_prefix}*" -type f 2>/dev/null | sort
}

show_existing_files_menu() {
    local config_name="$1"
    local file_prefix
    file_prefix=$(get_command_prefix "$config_name")

    if [ -z "$file_prefix" ]; then
        print_color "No file prefix found for $config_name" "Error"
        return 0
    fi

    local -a files=()
    if [ -d "$GLOBAL_SCRIPTS_DIR" ]; then
        mapfile -t files < <(find "$GLOBAL_SCRIPTS_DIR" -name "${file_prefix}*" -type f 2>/dev/null | sort)
    fi

    if [ ${#files[@]} -eq 0 ]; then
        IS_REPLACING_FILE="false"
        TARGET_FILE_PATH=""
        return 0
    fi

    local next_file_number=1
    local -a existing_numbers=()

    for file in "${files[@]}"; do
        local basename=$(basename "$file")
        if [[ "$basename" =~ ^${file_prefix}([0-9]+)\.sh$ ]]; then
            existing_numbers+=("${BASH_REMATCH[1]}")
        fi
    done

    while [[ " ${existing_numbers[@]} " =~ " ${next_file_number} " ]]; do
        ((next_file_number++))
    done

    local next_filename="${file_prefix}${next_file_number}.sh"

    local -a menu_items=()
    menu_items+=("new:Create new file: $next_filename (auto-increment)")

    for file in "${files[@]}"; do
        local basename=$(basename "$file")
        menu_items+=("$file:Replace existing: $basename")
    done

    local selected_index=0

    while true; do
        clear
        print_color "File Management for $config_name Files" "Info"
        print_color "Use Up/Down arrows to navigate, Enter to select" "Info"
        print_color "=" "Info"

        for i in "${!menu_items[@]}"; do
            IFS=':' read -r action text <<< "${menu_items[$i]}"
            if [ $i -eq $selected_index ]; then
                echo -e "\033[33m> $text\033[0m"
            else
                echo "  $text"
            fi
        done

        read -rsn1 key
        case "$key" in
            $'\x1b')
                read -rsn2 key
                case "$key" in
                    '[A') ((selected_index--)); [ $selected_index -lt 0 ] && selected_index=$((${#menu_items[@]} - 1)) ;;
                    '[B') ((selected_index++)); [ $selected_index -ge ${#menu_items[@]} ] && selected_index=0 ;;
                esac
                ;;
            '')
                IFS=':' read -r action text <<< "${menu_items[$selected_index]}"
                SELECTED_FILE_ACTION="$action"
                SELECTED_FILE_TEXT="$text"
                SELECTED_FILE_INDEX="$selected_index"

                if [ "$action" = "new" ]; then
                    IS_REPLACING_FILE="false"
                    TARGET_FILE_PATH=""
                else
                    IS_REPLACING_FILE="true"
                    TARGET_FILE_PATH="$action"
                fi

                return 0
                ;;
        esac
    done
}

generate_global_command() {
    local config_name="$1"

    CURRENT_CONFIG_NAME="$config_name"
    CURRENT_COMMAND_PREFIX=$(get_command_prefix "$config_name")
    CURRENT_FILE_NUMBER=1

    if [ -z "$GLOBAL_SCRIPTS_DIR" ]; then
        GLOBAL_SCRIPTS_DIR="/var/_core_node/gloe/ai_tools"
    fi

    $USE_SUDO mkdir -p "$GLOBAL_SCRIPTS_DIR" 2>/dev/null || true
    $USE_SUDO mkdir -p "/usr/local/bin" 2>/dev/null || true

    if [ -z "$CURRENT_COMMAND_PREFIX" ]; then
        print_color "No command prefix found for $config_name" "Error"
        return 1
    fi

    if [ "$IS_REPLACING_FILE" = "true" ]; then
        local temp_filename=$(basename "$TARGET_FILE_PATH")
        if [[ "$temp_filename" =~ ^${CURRENT_COMMAND_PREFIX}([0-9]+)\.sh$ ]]; then
            CURRENT_FILE_NUMBER="${BASH_REMATCH[1]}"
        else
            CURRENT_FILE_NUMBER=1
        fi
    else
        local -a existing_files
        mapfile -t existing_files < <(get_existing_files "$config_name")

        CURRENT_FILE_NUMBER=1
        local -a existing_numbers=()

        for file in "${existing_files[@]}"; do
            local basename=$(basename "$file")
            if [[ "$basename" =~ ^${CURRENT_COMMAND_PREFIX}([0-9]+)\.sh$ ]]; then
                existing_numbers+=("${BASH_REMATCH[1]}")
            fi
        done

        while [[ " ${existing_numbers[@]} " =~ " ${CURRENT_FILE_NUMBER} " ]]; do
            ((CURRENT_FILE_NUMBER++))
        done
    fi

    clear
    local title=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Title:-}")
    local description=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Description:-}")

    print_color "Generate $title Global Command" "Info"
    print_color "$description" "Info"
    print_color "$(printf '%*s' ${#title} | tr ' ' '=')" "Info"

    if [ "$IS_REPLACING_FILE" = "true" ]; then
        local target_filename=$(basename "$TARGET_FILE_PATH")
        print_color "Operation: Replacing existing file '$target_filename'" "Warning"
    else
        print_color "Operation: Creating new file" "Success"
        print_color "File will be: ${CURRENT_COMMAND_PREFIX}${CURRENT_FILE_NUMBER}.sh" "Info"
    fi

    echo ""

    local node_path
    node_path=$(get_node_absolute_path)

    local npm_bin_path
    npm_bin_path=$(get_npm_global_bin_path)

    local -a env_commands=()
    env_commands+=("#!/bin/bash")
    env_commands+=("# Environment variables for $title")
    env_commands+=("# Generated on $(date '+%Y-%m-%d %H:%M:%S')")
    env_commands+=("")

    local var_count=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Variables_Count:-0}")

    reset_input_type_index_tracker
    reset_user_input_values

    for ((i=0; i<var_count; i++)); do
        local var_name=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Variables_${i}_Name:-}")
        local var_display_name=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Variables_${i}_DisplayName:-}")

        local user_input
        user_input=$(get_smart_input_for_variable "$i" "$config_name" "false" "false")

        if [ -n "$user_input" ]; then
            env_commands+=("export $var_name=\"$user_input\"")
            USER_INPUT_VALUES[$var_name]="$user_input"
        else
            env_commands+=("# export $var_name=\"\"  # Not set")
        fi
    done

    env_commands+=("")
    env_commands+=("# Execute command using absolute node path")

    local common=$(eval "echo \${ENVIRONMENT_CONFIGS_${config_name}_Common:-}")
    env_commands+=("\"$node_path\" \"$npm_bin_path/$common\" \"\$@\"")

    if [ "$IS_REPLACING_FILE" = "true" ]; then
        CURRENT_FILE_NAME=$(basename "$TARGET_FILE_PATH")
    else
        CURRENT_FILE_NAME="${CURRENT_COMMAND_PREFIX}${CURRENT_FILE_NUMBER}.sh"
    fi

    local target_command_path="$GLOBAL_SCRIPTS_DIR/$CURRENT_FILE_NAME"

    printf "%s\n" "${env_commands[@]}" | $USE_SUDO tee "$target_command_path" > /dev/null
    $USE_SUDO chmod +x "$target_command_path"

    print_color "Global command generated successfully: $target_command_path" "Success"
    print_color "File written to scripts directory" "Success"

    if [ -f "$target_command_path" ]; then
        print_color "File verification: SUCCESS" "Success"

        local link_name=$(basename "$CURRENT_FILE_NAME" .sh)
        local link_path="/usr/local/bin/$link_name"

        if [ -L "$link_path" ]; then
            $USE_SUDO rm -f "$link_path"
        fi

        $USE_SUDO ln -s "$target_command_path" "$link_path"

        if [ -L "$link_path" ]; then
            print_color "Symbolic link created: $link_path -> $target_command_path" "Success"
            print_color "You can now run '$link_name' from anywhere without setting environment variables" "Info"
        else
            print_color "Failed to create symbolic link to /usr/local/bin" "Warning"
        fi
    else
        print_color "File verification: FAILED" "Error"
    fi

    return 0
}

show_list_scripts() {
    local config_name="$1"
    local command_prefix
    command_prefix=$(get_command_prefix "$config_name")

    if [ -z "$command_prefix" ]; then
        print_color "No command prefix found for $config_name" "Error"
        return
    fi

    if [ ! -d "$GLOBAL_SCRIPTS_DIR" ]; then
        print_color "Scripts directory not found" "Error"
        return
    fi

    local -a files
    mapfile -t files < <(get_existing_files "$config_name")

    clear
    print_color "Available Files for $config_name" "Info"
    print_color "Pattern: ${command_prefix}*" "Info"
    print_color "$(printf '%*s' 50 | tr ' ' '=')" "Info"

    if [ ${#files[@]} -eq 0 ]; then
        print_color "No files found matching pattern: ${command_prefix}*" "Warning"
    else
        for file in "${files[@]}"; do
            print_color "  $(basename "$file")" "Info"
        done
    fi

    echo ""
    print_color "Press any key to continue..." "Info"
    read -n 1 -s
}
