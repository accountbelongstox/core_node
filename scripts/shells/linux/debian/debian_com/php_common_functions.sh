#!/bin/bash

PHP_COMMON_FUNCTIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PHP_COMMON_FUNCTIONS_COMMON_DIR="$(cd "$PHP_COMMON_FUNCTIONS_DIR/../../common" && pwd)"

source "$PHP_COMMON_FUNCTIONS_DIR/php_common_vars.sh"
source "$PHP_COMMON_FUNCTIONS_COMMON_DIR/gvar_common.sh"
source "$PHP_COMMON_FUNCTIONS_COMMON_DIR/common_functions.sh"
source "$PHP_COMMON_FUNCTIONS_COMMON_DIR/service_contract_common.sh"
source "$PHP_COMMON_FUNCTIONS_COMMON_DIR/frankenphp_manager.sh"

PHP_COMMON_PERMISSION_READY="no"
PHP_COMMON_LARAVEL_CONFIG_READY="no"
PHP_COMMON_LARAVEL_CONFIG_SEEN="no"
PHP_CONFIGURATION_READY="no"
PHP_CONFIGURATION_RUNTIME_READY="no"
PHP_RUNTIME_UPLOAD_MAX_FILESIZE="$(sc_require php_runtime.upload_max_filesize)"
PHP_RUNTIME_POST_MAX_SIZE="$(sc_require php_runtime.post_max_size)"
PHP_RUNTIME_MAX_EXECUTION_TIME="$(sc_require php_runtime.max_execution_time_seconds)"
PHP_RUNTIME_MAX_INPUT_TIME="$(sc_require php_runtime.max_input_time_seconds)"

# Set directory permissions for web applications
set_directory_permissions_from_php_common() {
    local target_dir="${1:-$(map_web_path "wwwroot")}"
    local script_index="${2:-[PERMISSIONS]}"
    local target_user=""
    local target_group=""
    local permission_ready=""

    PHP_COMMON_PERMISSION_READY="no"
    print_step_from_common_functions "$script_index Setting directory permissions for: $target_dir"

    # Create directory if it doesn't exist
    if [ ! -d "$target_dir" ]; then
        print_step_from_common_functions "$script_index Creating directory: $target_dir"
        $USE_SUDO mkdir -p "$target_dir"
    fi

    resolve_active_permission_owner >/dev/null
    target_user="$ACTIVE_PERMISSION_USER"
    target_group="$ACTIVE_PERMISSION_GROUP"
    print_step_from_common_functions "$script_index Setting owner $target_user:$target_group and mode 777"
    permission_ready="$(owned_entry_777_ready "$target_dir" "$target_user" "$target_group")"
    if [ "$permission_ready" != "yes" ]; then
        print_step_from_common_functions "$script_index Repairing the managed directory root"
        repair_owned_entry_777 "$target_dir" "$target_user" "$target_group"
        permission_ready="$(owned_entry_777_ready "$target_dir" "$target_user" "$target_group")"
    fi

    if [ "$permission_ready" = "yes" ]; then
        PHP_COMMON_PERMISSION_READY="yes"
        print_success_from_common_functions "$script_index Directory root permissions are ready"
    else
        print_error_from_common_functions "$script_index Directory root permissions are not ready"
    fi
}

php_laravel_ini_ready_from_php_common() {
    local ini_file="$1"
    local ready="yes"
    local expected_line=""

    if [ ! -f "$ini_file" ]; then
        ready="no"
    fi
    for expected_line in \
        'disable_functions =' \
        'memory_limit = 512M' \
        "upload_max_filesize = $PHP_RUNTIME_UPLOAD_MAX_FILESIZE" \
        "post_max_size = $PHP_RUNTIME_POST_MAX_SIZE" \
        "max_execution_time = $PHP_RUNTIME_MAX_EXECUTION_TIME" \
        "max_input_time = $PHP_RUNTIME_MAX_INPUT_TIME" \
        'opcache.enable = 1' \
        'opcache.memory_consumption = 256' \
        'open_basedir = none'; do
        if [ "$ready" = "yes" ] && [ -z "$(grep -F -x "$expected_line" "$ini_file" 2>/dev/null)" ]; then
            ready="no"
        fi
    done
    expected_line="error_log = \"$PHP_ERROR_LOG_PATH\""
    if [ "$ready" = "yes" ] && [ -z "$(grep -F -x "$expected_line" "$ini_file" 2>/dev/null)" ]; then
        ready="no"
    fi
    printf '%s' "$ready"
}

# Configure PHP for Laravel with proper open_basedir
configure_php_for_laravel_from_php_common() {
    local script_index="${1:-[LARAVEL_CONFIG]}"
    local ini_file=""
    local rendered_file=""
    local backup_file=""
    local managed_block=""
    
    PHP_COMMON_LARAVEL_CONFIG_READY="yes"
    PHP_COMMON_LARAVEL_CONFIG_SEEN="no"
    print_step_from_common_functions "$script_index Configuring PHP for Laravel requirements"
    
    for ini_file in "${PHP_INI_FILES[@]}"; do
        if [ -f "$ini_file" ]; then
            PHP_COMMON_LARAVEL_CONFIG_SEEN="yes"
            print_step_from_common_functions "$script_index Configuring $ini_file"
            rendered_file="$(mktemp)"
            backup_file="${ini_file}.backup.$(date +%Y%m%d_%H%M%S)"
            managed_block="disable_functions =
memory_limit = 512M
upload_max_filesize = $PHP_RUNTIME_UPLOAD_MAX_FILESIZE
post_max_size = $PHP_RUNTIME_POST_MAX_SIZE
max_execution_time = $PHP_RUNTIME_MAX_EXECUTION_TIME
max_input_time = $PHP_RUNTIME_MAX_INPUT_TIME
opcache.enable = 1
opcache.memory_consumption = 256
open_basedir = none
error_log = \"$PHP_ERROR_LOG_PATH\""
            awk '
                /^[[:space:]]*;?[[:space:]]*(disable_functions|memory_limit|upload_max_filesize|post_max_size|max_execution_time|max_input_time|opcache\.enable|opcache\.memory_consumption|open_basedir|error_log)[[:space:]]*=/ { next }
                /^[[:space:]]*$/ { trailing = trailing $0 ORS; next }
                { printf "%s", trailing; trailing = ""; print }
            ' "$ini_file" > "$rendered_file"
            printf '\n%s\n' "$managed_block" >> "$rendered_file"
            if cmp -s "$rendered_file" "$ini_file"; then
                print_success_from_common_functions "$script_index Already canonical: $ini_file"
            else
                $USE_SUDO cp "$ini_file" "$backup_file"
                $USE_SUDO cp "$rendered_file" "$ini_file"
                print_success_from_common_functions "$script_index Configured $ini_file"
            fi
            rm -f "$rendered_file"
            if [ "$(php_laravel_ini_ready_from_php_common "$ini_file")" != "yes" ]; then
                PHP_COMMON_LARAVEL_CONFIG_READY="no"
            fi
        else
            PHP_COMMON_LARAVEL_CONFIG_READY="no"
            print_error_from_common_functions "$script_index PHP configuration file not found: $ini_file"
        fi
    done

    if [ "$PHP_COMMON_LARAVEL_CONFIG_SEEN" != "yes" ]; then
        PHP_COMMON_LARAVEL_CONFIG_READY="no"
    fi
    if [ "$PHP_COMMON_LARAVEL_CONFIG_READY" = "yes" ]; then
        print_success_from_common_functions "$script_index PHP Laravel configuration completed"
    else
        print_error_from_common_functions "$script_index PHP Laravel configuration remains incomplete"
    fi
}

# Converge the PHP ini contract of the active runtime plane (frankenphp scan-dir
# ini or the system php.ini managed block) plus the web root permissions.
php_configuration_ensure() {
    local script_index="${1:-[PHP_CONFIG]}"
    local plane=""
    local ini_file=""
    local expected_line=""
    local lines_ready="yes"

    PHP_CONFIGURATION_READY="no"
    PHP_CONFIGURATION_RUNTIME_READY="no"
    plane="$(php_runtime_plane)"
    print_step_from_common_functions "$script_index PHP ${PHP_VERSION} configuration convergence (plane: $plane)"

    if [ "$plane" = "frankenphp" ]; then
        ini_file="$(fm_php_ini_dir)/99-core-node.ini"
        fm_php_ini_ensure
        for expected_line in \
            'memory_limit = 512M' \
            "upload_max_filesize = $PHP_RUNTIME_UPLOAD_MAX_FILESIZE" \
            "post_max_size = $PHP_RUNTIME_POST_MAX_SIZE" \
            "max_execution_time = $PHP_RUNTIME_MAX_EXECUTION_TIME" \
            "max_input_time = $PHP_RUNTIME_MAX_INPUT_TIME"; do
            if ! grep -Fq "$expected_line" "$ini_file" 2>/dev/null; then
                lines_ready="no"
            fi
        done
        PHP_CONFIGURATION_RUNTIME_READY="$lines_ready"
    else
        configure_php_for_laravel_from_php_common "$script_index"
        PHP_CONFIGURATION_RUNTIME_READY="$PHP_COMMON_LARAVEL_CONFIG_READY"
    fi

    set_directory_permissions_from_php_common "$(map_web_path "wwwroot")" "$script_index"
    if [ "$PHP_CONFIGURATION_RUNTIME_READY" = "yes" ] && [ "$PHP_COMMON_PERMISSION_READY" = "yes" ]; then
        PHP_CONFIGURATION_READY="yes"
        print_success_from_common_functions "$script_index PHP configuration is canonical"
    else
        print_error_from_common_functions "$script_index PHP configuration remains incomplete"
    fi
}
