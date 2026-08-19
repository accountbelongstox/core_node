#!/bin/bash
# Script: 94_install_composer.sh
# Description: Dedicated Composer installation with fine-grained PHP 8.5 dependency repair
# Author: System Administrator
# Version: 3.0

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_INDEX="[94_COMPOSER]"

# Source dependencies
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
LINUX_PATH_FUNCTION="$PARENT_DIR_LEVEL_2/common/linux_path_function.sh"
LARAVEL_INSTALLER_PACKAGE="laravel/installer"
LARAVEL_INSTALLER_BINARY_NAME="laravel"
LARAVEL_INSTALLER_BIN_DIR=""
LARAVEL_INSTALLER_HOME=""
LARAVEL_INSTALLER_BINARY_PATH=""
LARAVEL_INSTALLER_LINK_PATH="/usr/local/bin/$LARAVEL_INSTALLER_BINARY_NAME"
LARAVEL_INSTALLER_UPDATE_STAMP="/usr/local/etc/.laravel_installer_update_stamp"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/octane_service_manager.sh"
source "$PARENT_DIR_LEVEL_2/common/frankenphp_manager.sh"

# Source PHP common variables and functions
source "$PARENT_DIR_LEVEL_1/debian_com/php_common_vars.sh"
source "$PARENT_DIR_LEVEL_1/debian_com/php_common_functions.sh"

# Configuration - using variables from php_common_vars.sh
PHP_BINARY="$TARGET_LINK_PATH"
COMPOSER_RUNTIME_PHP="$PHP_BINARY"
COMPOSER_RUNTIME_SUBCMD=""
COMPOSER_RUNTIME_PLANE=""
COMPOSER_RUNTIME_CANDIDATES_LOG=""
COMPOSER_RUNTIME_PHAR_STATUS="unknown"
COMPOSER_RUNTIME_PHP_WRAPPER="${FRANKENPHP_COMPOSER_RUNTIME_SHIM}"
COMPOSER_PATH_DIR="$(dirname "$COMPOSER_TARGET_PATH")"

# Version requirements
MIN_COMPOSER_VERSION_MAJOR=2
MIN_COMPOSER_VERSION_MINOR=7
MIN_COMPOSER_VERSION_PATCH=0
MIN_COMPOSER_VERSION="2.7.0"

# PHP version tracking file
PHP_VERSION_TRACK_FILE="/usr/local/etc/.composer_php_version"

# Set Composer environment based on user privileges
if [ "$EUID" -eq 0 ]; then
    # Auto-allow Composer to run as root without interactive prompt
    export COMPOSER_ALLOW_SUPERUSER=1
    export COMPOSER_NO_INTERACTION=1
    echo -e "${YELLOW}$SCRIPT_INDEX Running as root - Composer warnings automatically handled${NC}"
else
    # Ensure non-interactive mode for consistency
    export COMPOSER_NO_INTERACTION=1
fi

# Execute with the selected composer runtime form.
# For frankenPHP plane this becomes `frankenphp php-cli`.
composer_runtime_exec() {
    if [ -z "$COMPOSER_RUNTIME_PHP" ]; then
        return 1
    fi

    if [ "$COMPOSER_RUNTIME_SUBCMD" = "php-cli" ]; then
        "$COMPOSER_RUNTIME_PHP" php-cli "$@"
    else
        "$COMPOSER_RUNTIME_PHP" "$@"
    fi
}

# Execute composer using the selected runtime and composer.original.
# Keep this helper to avoid passing PHP CLI flags into frankenphp php-cli mode.
composer_run_original_runtime() {
    local composer_args=("$@")

    if [ "$COMPOSER_RUNTIME_SUBCMD" = "php-cli" ]; then
        COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 composer_runtime_exec "${COMPOSER_TARGET_PATH}.original" "${composer_args[@]}"
    else
        COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 composer_runtime_exec -d "open_basedir=none" "${COMPOSER_TARGET_PATH}.original" "${composer_args[@]}"
    fi
}

# Run composer command through a prepared wrapper when possible.
run_composer_wrapper_command() {
    local wrapper_path="$1"
    shift
    local wrapper_args=("$@")

    if [ -x "$wrapper_path" ] && [ -f "$wrapper_path" ] && [ "$(wrapper_points_to_runtime_php "$wrapper_path")" = "yes" ]; then
        COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$wrapper_path" "${wrapper_args[@]}"
        return $?
    fi
    return 1
}

# Run composer through the main wrapper when possible, fallback to runtime+original binary.
run_composer_command() {
    local composer_args=("$@")

    if run_composer_wrapper_command "$COMPOSER_TARGET_PATH" "${composer_args[@]}"; then
        return $?
    fi

    if [ -f "${COMPOSER_TARGET_PATH}.original" ] && [ -x "${COMPOSER_TARGET_PATH}.original" ]; then
        composer_run_original_runtime "${composer_args[@]}"
        return $?
    fi

    return 1
}

# Get Composer version from original binary
get_composer_version() {
    local composer_version="not_installed"

    if [ -f "${COMPOSER_TARGET_PATH}.original" ] && [ -x "${COMPOSER_TARGET_PATH}.original" ]; then
        composer_version="$(composer_run_original_runtime --version 2>/dev/null | grep -oP 'Composer version \K[0-9]+\.[0-9]+\.[0-9]+' || true)"
        if [ -n "$composer_version" ]; then
            echo "$composer_version"
            return
        fi
    fi

    echo "unknown"
}

# Compare version strings (returns 0 if version1 >= version2)
version_compare() {
    local version1=$1
    local version2=$2

    if [ "$version1" = "unknown" ] || [ "$version1" = "not_installed" ]; then
        echo "false"
        return
    fi

    local IFS=.
    local ver1=($version1)
    local ver2=($version2)

    for ((i=0; i<3; i++)); do
        local num1=${ver1[i]:-0}
        local num2=${ver2[i]:-0}

        if ((num1 > num2)); then
            echo "true"
            return
        elif ((num1 < num2)); then
            echo "false"
            return
        fi
    done

    echo "true"
}

# Check if Composer has deprecation warnings (indicates old version)
check_composer_errors() {
    local test_output
    test_output=$(composer_run_original_runtime --version 2>&1)

    if echo "$test_output" | grep -qi "deprecated\|warning\|error"; then
        echo "true"
    else
        echo "false"
    fi
}

# Get current PHP version
get_current_php_version() {
    local php_probe=""
    local version_output=""

    if [ -x "$COMPOSER_RUNTIME_PHP" ]; then
        if [ "$COMPOSER_RUNTIME_SUBCMD" = "php-cli" ]; then
            php_probe="$(mktemp)"
            printf '<?php echo PHP_VERSION;' > "$php_probe"
            version_output="$(composer_runtime_exec "$php_probe" 2>/dev/null | tr -d '[:space:]' || true)"
            rm -f "$php_probe"
        else
            version_output="$(composer_runtime_exec -v 2>/dev/null | tr -d '[:space:]' | head -n1 || true)"
        fi
        echo "$version_output" | grep -oP '[0-9]+\.[0-9]+\.[0-9]+' | head -n1 || echo "unknown"
    else
        echo "not_found"
    fi
}

# Store current PHP version
store_php_version() {
    local php_version=$(get_current_php_version)
    if [ "$php_version" != "unknown" ] && [ "$php_version" != "not_found" ]; then
        $USE_SUDO mkdir -p "$(dirname "$PHP_VERSION_TRACK_FILE")"
        echo "$php_version" | $USE_SUDO tee "$PHP_VERSION_TRACK_FILE" > /dev/null
        echo -e "${GREEN}$SCRIPT_INDEX Stored PHP version: $php_version${NC}"
    fi
}

# Check whether a runtime php binary includes the required phar extension.
composer_runtime_supports_phar() {
    local candidate_binary="$1"
    local candidate_subcmd="${2:-}"
    local probe_script=""
    local probe_result=""
    local supported="no"

    if [ -z "$candidate_binary" ] || [ ! -x "$candidate_binary" ]; then
        echo "no"
        return
    fi

    probe_script="$(mktemp)"
    printf '<?php echo extension_loaded("phar") ? "yes" : "no";\n' > "$probe_script"

    if [ "$candidate_subcmd" = "php-cli" ]; then
        probe_result="$($candidate_binary php-cli "$probe_script" 2>/dev/null | tr -d '[:space:]' || true)"
    else
        probe_result="$($candidate_binary "$probe_script" 2>/dev/null | tr -d '[:space:]' || true)"
    fi

    rm -f "$probe_script"

    case "$probe_result" in
        *yes*)
            supported="yes"
            ;;
    esac

    echo "$supported"
}

# Resolve composer runtime binary with extension-first preference.
# On frankenPHP plane, prefer official embedded runtime usage and skip system php8.5 checks
# that are intentionally unused by this plane.
resolve_composer_runtime_php() {
    local runtime_plane=""
    local candidate=""
    local candidate_subcmd=""
    local fallback_candidate=""
    local fallback_subcmd=""
    local candidate_log=""

    COMPOSER_RUNTIME_PHP=""
    COMPOSER_RUNTIME_SUBCMD=""
    COMPOSER_RUNTIME_CANDIDATES_LOG=""
    COMPOSER_RUNTIME_PHAR_STATUS="unknown"

    runtime_plane="$(php_runtime_plane)"
    COMPOSER_RUNTIME_PLANE="$runtime_plane"

    if [ "$runtime_plane" = "frankenphp" ]; then
        echo -e "${CYAN}$SCRIPT_INDEX Runtime plane: frankenphp - use embedded frankenPHP CLI runtime per official docs and keep the PHP_BINARY shim contract for Composer.${NC}"
        fm_ensure_php_cli_shim

        candidate="$FRANKENPHP_PHP_CLI_SHIM_PATH"
        candidate_subcmd=""
        if [ -x "$candidate" ]; then
            candidate_log="${candidate_log}${candidate_log:+ }${candidate}(${candidate_subcmd})"
            if [ -z "$fallback_candidate" ]; then
                fallback_candidate="$candidate"
                fallback_subcmd="$candidate_subcmd"
            fi
            if [ -z "$COMPOSER_RUNTIME_PHP" ] && [ "$(composer_runtime_supports_phar "$candidate" "$candidate_subcmd")" = "yes" ]; then
                COMPOSER_RUNTIME_PHP="$candidate"
                COMPOSER_RUNTIME_SUBCMD="$candidate_subcmd"
            fi
        fi

        candidate="$FRANKENPHP_PHP_SHIM_PATH"
        candidate_subcmd=""
        if [ -x "$candidate" ]; then
            candidate_log="${candidate_log}${candidate_log:+ }${candidate}(${candidate_subcmd})"
            if [ -z "$fallback_candidate" ]; then
                fallback_candidate="$candidate"
                fallback_subcmd="$candidate_subcmd"
            fi
            if [ -z "$COMPOSER_RUNTIME_PHP" ] && [ "$(composer_runtime_supports_phar "$candidate" "$candidate_subcmd")" = "yes" ]; then
                COMPOSER_RUNTIME_PHP="$candidate"
                COMPOSER_RUNTIME_SUBCMD="$candidate_subcmd"
            fi
        fi

        candidate="$(fm_get_binary)"
        candidate_subcmd="$FRANKENPHP_PHP_RUNTIME_SUBCMD"
        if [ -n "$candidate" ] && [ -x "$candidate" ]; then
            candidate_log="${candidate_log}${candidate_log:+ }${candidate}(${candidate_subcmd})"
            if [ -z "$fallback_candidate" ]; then
                fallback_candidate="$candidate"
                fallback_subcmd="$candidate_subcmd"
            fi
            if [ -z "$COMPOSER_RUNTIME_PHP" ] && [ "$(composer_runtime_supports_phar "$candidate" "$candidate_subcmd")" = "yes" ]; then
                COMPOSER_RUNTIME_PHP="$candidate"
                COMPOSER_RUNTIME_SUBCMD="$candidate_subcmd"
            fi
        fi

        candidate="/usr/bin/php"
        candidate_subcmd=""
        if [ -x "$candidate" ]; then
            candidate_log="${candidate_log}${candidate_log:+ }${candidate}(direct)"
            if [ -z "$fallback_candidate" ]; then
                fallback_candidate="$candidate"
                fallback_subcmd="$candidate_subcmd"
            fi
            if [ -z "$COMPOSER_RUNTIME_PHP" ] && [ "$(composer_runtime_supports_phar "$candidate" "$candidate_subcmd")" = "yes" ]; then
                COMPOSER_RUNTIME_PHP="$candidate"
                COMPOSER_RUNTIME_SUBCMD="$candidate_subcmd"
            fi
        fi
    else
        echo -e "${CYAN}$SCRIPT_INDEX Runtime plane: system${NC}"

        candidate="/usr/bin/php${PHP_VERSION}"
        candidate_subcmd=""
        if [ -x "$candidate" ]; then
            candidate_log="${candidate_log}${candidate_log:+ }${candidate}(direct)"
            if [ -z "$fallback_candidate" ]; then
                fallback_candidate="$candidate"
                fallback_subcmd="$candidate_subcmd"
            fi
            if [ -z "$COMPOSER_RUNTIME_PHP" ] && [ "$(composer_runtime_supports_phar "$candidate" "$candidate_subcmd")" = "yes" ]; then
                COMPOSER_RUNTIME_PHP="$candidate"
                COMPOSER_RUNTIME_SUBCMD="$candidate_subcmd"
            fi
        fi

        candidate="$FRANKENPHP_PHP_SHIM_PATH"
        candidate_subcmd=""
        if [ -x "$candidate" ]; then
            candidate_log="${candidate_log}${candidate_log:+ }${candidate}(direct)"
            if [ -z "$fallback_candidate" ]; then
                fallback_candidate="$candidate"
                fallback_subcmd="$candidate_subcmd"
            fi
            if [ -z "$COMPOSER_RUNTIME_PHP" ] && [ "$(composer_runtime_supports_phar "$candidate" "$candidate_subcmd")" = "yes" ]; then
                COMPOSER_RUNTIME_PHP="$candidate"
                COMPOSER_RUNTIME_SUBCMD="$candidate_subcmd"
            fi
        fi

        candidate="/usr/bin/php"
        candidate_subcmd=""
        if [ -x "$candidate" ]; then
            candidate_log="${candidate_log}${candidate_log:+ }${candidate}(direct)"
            if [ -z "$fallback_candidate" ]; then
                fallback_candidate="$candidate"
                fallback_subcmd="$candidate_subcmd"
            fi
            if [ -z "$COMPOSER_RUNTIME_PHP" ] && [ "$(composer_runtime_supports_phar "$candidate" "$candidate_subcmd")" = "yes" ]; then
                COMPOSER_RUNTIME_PHP="$candidate"
                COMPOSER_RUNTIME_SUBCMD="$candidate_subcmd"
            fi
        fi
    fi

    candidate="$(command -v php 2>/dev/null || true)"
    candidate_subcmd=""
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
        if [[ "$candidate_log" != *"$candidate"* ]]; then
            candidate_log="${candidate_log}${candidate_log:+ }${candidate}(command)"
        fi
        if [ -z "$fallback_candidate" ]; then
            fallback_candidate="$candidate"
            fallback_subcmd="$candidate_subcmd"
        fi
        if [ -z "$COMPOSER_RUNTIME_PHP" ] && [ "$(composer_runtime_supports_phar "$candidate" "$candidate_subcmd")" = "yes" ]; then
            COMPOSER_RUNTIME_PHP="$candidate"
            COMPOSER_RUNTIME_SUBCMD="$candidate_subcmd"
        fi
    fi

    if [ -z "$COMPOSER_RUNTIME_PHP" ] && [ -n "$fallback_candidate" ]; then
        COMPOSER_RUNTIME_PHP="$fallback_candidate"
        COMPOSER_RUNTIME_SUBCMD="$fallback_subcmd"
    fi

    if [ -z "$COMPOSER_RUNTIME_PHP" ]; then
        COMPOSER_RUNTIME_PHP="$PHP_BINARY"
        COMPOSER_RUNTIME_SUBCMD=""
    fi

    COMPOSER_RUNTIME_PHAR_STATUS="$(composer_runtime_supports_phar "$COMPOSER_RUNTIME_PHP" "$COMPOSER_RUNTIME_SUBCMD")"
    COMPOSER_RUNTIME_CANDIDATES_LOG="${candidate_log:-none}"
    PHP_BINARY="$COMPOSER_RUNTIME_PHP"
}

wrapper_points_to_runtime_php() {
    local wrapper_path="$1"

    if [ ! -x "$wrapper_path" ]; then
        echo "no"
        return
    fi

    if ! grep -F -q "RUNTIME_CMD=\"$COMPOSER_RUNTIME_PHP\"" "$wrapper_path" 2>/dev/null; then
        echo "no"
        return
    fi
    if ! grep -F -q "RUNTIME_CMD_SUBCMD=\"$COMPOSER_RUNTIME_SUBCMD\"" "$wrapper_path" 2>/dev/null; then
        echo "no"
        return
    fi
    if ! grep -F -q "export PHP_BINARY=\"$COMPOSER_RUNTIME_PHP_WRAPPER\"" "$wrapper_path" 2>/dev/null; then
        echo "no"
        return
    fi

    if ! "$wrapper_path" --version >/dev/null 2>&1; then
        echo "no"
        return
    fi

    echo "yes"
}

write_composer_runtime_php_wrapper() {
    echo -e "${CYAN}$SCRIPT_INDEX Repairing Composer runtime PHP wrapper...${NC}"
    $USE_SUDO cat > "$COMPOSER_RUNTIME_PHP_WRAPPER" << EOF
#!/bin/bash
# Runtime helper used as PHP_BINARY for Composer script handlers.
# In frankenphp-php-cli mode, Composer injects -d flags into command strings,
# which that mode does not always accept directly.

RUNTIME_CMD="${COMPOSER_RUNTIME_PHP}"
RUNTIME_CMD_SUBCMD="${COMPOSER_RUNTIME_SUBCMD}"

if [ -z "\$RUNTIME_CMD" ] || [ ! -x "\$RUNTIME_CMD" ]; then
    exit 1
fi

if [ -z "\$RUNTIME_CMD_SUBCMD" ]; then
    exec "\$RUNTIME_CMD" "\$@"
fi

if [ "\$RUNTIME_CMD_SUBCMD" != "php-cli" ]; then
    exec "\$RUNTIME_CMD" "\$RUNTIME_CMD_SUBCMD" "\$@"
fi

ARGS=()
while [ "\$#" -gt 0 ]; do
    case "\$1" in
        -d)
            shift
            if [ "\$#" -gt 0 ]; then
                shift
            fi
            ;;
        -d*)
            shift
            ;;
        *)
            ARGS+=("\$1")
            shift
            ;;
    esac
done

exec "\$RUNTIME_CMD" "\$RUNTIME_CMD_SUBCMD" "\${ARGS[@]}"
EOF
    $USE_SUDO chmod +x "$COMPOSER_RUNTIME_PHP_WRAPPER"
}

write_composer_safe_wrapper() {
    echo -e "${CYAN}$SCRIPT_INDEX Repairing composer-safe wrapper...${NC}"
    $USE_SUDO cat > "$COMPOSER_SAFE_PATH" << EOF
#!/bin/bash
# Global Composer wrapper that handles root warnings and open_basedir restrictions
# Usage: composer-safe [composer-arguments]

RUNTIME_CMD="${COMPOSER_RUNTIME_PHP}"
RUNTIME_CMD_SUBCMD="${COMPOSER_RUNTIME_SUBCMD}"
PHP_COMPOSER="${COMPOSER_TARGET_PATH}.original"
export PHP_BINARY="${COMPOSER_RUNTIME_PHP_WRAPPER}"

export COMPOSER_ALLOW_SUPERUSER=1
export COMPOSER_NO_INTERACTION=1

if [ -n "\$RUNTIME_CMD_SUBCMD" ]; then
    if [ "\$RUNTIME_CMD_SUBCMD" = "php-cli" ]; then
        exec "\$RUNTIME_CMD" "\$RUNTIME_CMD_SUBCMD" "\$PHP_COMPOSER" "\$@"
    fi

    if "\$RUNTIME_CMD" "\$RUNTIME_CMD_SUBCMD" -d display_errors=0 /dev/null >/dev/null 2>&1; then
        exec "\$RUNTIME_CMD" "\$RUNTIME_CMD_SUBCMD" -d "open_basedir=none" "\$PHP_COMPOSER" "\$@"
    fi
    exec "\$RUNTIME_CMD" "\$RUNTIME_CMD_SUBCMD" "\$PHP_COMPOSER" "\$@"
fi

if "\$RUNTIME_CMD" -d display_errors=0 /dev/null >/dev/null 2>&1; then
    exec "\$RUNTIME_CMD" -d "open_basedir=none" "\$PHP_COMPOSER" "\$@"
fi
exec "\$RUNTIME_CMD" "\$PHP_COMPOSER" "\$@"
EOF
    $USE_SUDO chmod +x "$COMPOSER_SAFE_PATH"
}

write_composer_main_wrapper() {
    echo -e "${CYAN}$SCRIPT_INDEX Repairing Composer wrapper...${NC}"
    $USE_SUDO cat > "$COMPOSER_TARGET_PATH" << EOF
#!/bin/bash
# Composer wrapper with automatic environment handling

RUNTIME_CMD="${COMPOSER_RUNTIME_PHP}"
RUNTIME_CMD_SUBCMD="${COMPOSER_RUNTIME_SUBCMD}"
PHP_COMPOSER="${COMPOSER_TARGET_PATH}.original"
export PHP_BINARY="${COMPOSER_RUNTIME_PHP_WRAPPER}"

if [ "\$EUID" -eq 0 ]; then
    export COMPOSER_ALLOW_SUPERUSER=1
    export COMPOSER_NO_INTERACTION=1
fi

if [ -n "\$RUNTIME_CMD_SUBCMD" ]; then
    if [ "\$RUNTIME_CMD_SUBCMD" = "php-cli" ]; then
        exec "\$RUNTIME_CMD" "\$RUNTIME_CMD_SUBCMD" "\$PHP_COMPOSER" "\$@"
    fi

    if "\$RUNTIME_CMD" "\$RUNTIME_CMD_SUBCMD" -d display_errors=0 /dev/null >/dev/null 2>&1; then
        exec "\$RUNTIME_CMD" "\$RUNTIME_CMD_SUBCMD" -d "open_basedir=none" "\$PHP_COMPOSER" "\$@"
    fi
    exec "\$RUNTIME_CMD" "\$RUNTIME_CMD_SUBCMD" "\$PHP_COMPOSER" "\$@"
fi

if "\$RUNTIME_CMD" -d display_errors=0 /dev/null >/dev/null 2>&1; then
    exec "\$RUNTIME_CMD" -d "open_basedir=none" "\$PHP_COMPOSER" "\$@"
fi
exec "\$RUNTIME_CMD" "\$PHP_COMPOSER" "\$@"
EOF
    $USE_SUDO chmod +x "$COMPOSER_TARGET_PATH"
}

repair_composer_wrappers() {
    write_composer_runtime_php_wrapper

    if [ ! -f "$COMPOSER_TARGET_PATH" ] || [ ! -x "$COMPOSER_TARGET_PATH" ] || [ "$(wrapper_points_to_runtime_php "$COMPOSER_TARGET_PATH")" != "yes" ]; then
        write_composer_main_wrapper
        if [ ! -f "$COMPOSER_TARGET_PATH" ] || [ ! -x "$COMPOSER_TARGET_PATH" ]; then
            echo -e "${RED}$SCRIPT_INDEX Composer wrapper is unavailable after repair${NC}"
        fi
    else
        echo -e "${GREEN}$SCRIPT_INDEX Composer wrapper is already ready${NC}"
    fi

    if [ ! -f "$COMPOSER_SAFE_PATH" ] || [ ! -x "$COMPOSER_SAFE_PATH" ] || [ "$(wrapper_points_to_runtime_php "$COMPOSER_SAFE_PATH")" != "yes" ]; then
        write_composer_safe_wrapper
        if [ ! -f "$COMPOSER_SAFE_PATH" ] || [ ! -x "$COMPOSER_SAFE_PATH" ]; then
            echo -e "${RED}$SCRIPT_INDEX composer-safe wrapper is unavailable after repair${NC}"
        fi
    else
        echo -e "${GREEN}$SCRIPT_INDEX composer-safe wrapper is already ready${NC}"
    fi
}

repair_composer_path() {
    echo -e "${CYAN}$SCRIPT_INDEX Ensuring Composer is in PATH...${NC}"
    bash "$LINUX_PATH_FUNCTION" addpath "$COMPOSER_PATH_DIR" || true
    echo -e "${GREEN}$SCRIPT_INDEX Composer PATH repair completed: $COMPOSER_PATH_DIR${NC}"
}

resolve_laravel_installer_paths() {
    local detected_home=""
    local detected_bin_dir=""

    detected_home="${COMPOSER_HOME:-}"
    detected_home="$(run_composer_command config --global home --no-ansi 2>/dev/null | awk '/^\// { print $0; exit }')"

    if [ -z "$detected_home" ]; then
        if [ -z "${COMPOSER_HOME:-}" ]; then
            detected_home="$HOME/.config/composer"
        else
            detected_home="${COMPOSER_HOME}"
        fi
    fi

    detected_bin_dir="$(run_composer_command global config bin-dir --absolute --no-ansi 2>/dev/null | awk '/^\// { path=$0 } END { print path }')"
    if [ -z "$detected_bin_dir" ]; then
        detected_bin_dir="$detected_home/vendor/bin"
    fi

    LARAVEL_INSTALLER_HOME="$detected_home"
    LARAVEL_INSTALLER_BIN_DIR="$detected_bin_dir"
    LARAVEL_INSTALLER_BINARY_PATH="$LARAVEL_INSTALLER_BIN_DIR/$LARAVEL_INSTALLER_BINARY_NAME"
}

ensure_laravel_installer_usrbin_link() {
    if [ ! -x "$LARAVEL_INSTALLER_BINARY_PATH" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Laravel Installer binary is not executable; skip /usr/local/bin link repair${NC}"
        return
    fi

    local current_link_target=""
    current_link_target="$(readlink -f "$LARAVEL_INSTALLER_LINK_PATH" 2>/dev/null || true)"

    if [ -L "$LARAVEL_INSTALLER_LINK_PATH" ] && [ -x "$LARAVEL_INSTALLER_LINK_PATH" ] && [ "$current_link_target" = "$LARAVEL_INSTALLER_BINARY_PATH" ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Laravel Installer link already points to $LARAVEL_INSTALLER_LINK_PATH${NC}"
        return
    fi

    if [ -e "$LARAVEL_INSTALLER_LINK_PATH" ]; then
        $USE_SUDO rm -f "$LARAVEL_INSTALLER_LINK_PATH"
    fi

    $USE_SUDO ln -s "$LARAVEL_INSTALLER_BINARY_PATH" "$LARAVEL_INSTALLER_LINK_PATH"
    if [ -L "$LARAVEL_INSTALLER_LINK_PATH" ] && [ -x "$LARAVEL_INSTALLER_LINK_PATH" ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Laravel Installer link ready: $LARAVEL_INSTALLER_LINK_PATH${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Laravel Installer link is not executable immediately: $LARAVEL_INSTALLER_LINK_PATH${NC}"
    fi
}

print_laravel_installer_version() {
    local current_installer_version=""

    if [ ! -x "$LARAVEL_INSTALLER_BINARY_PATH" ]; then
        return
    fi

    current_installer_version="$($LARAVEL_INSTALLER_BINARY_PATH --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1 || true)"
    if [ -n "$current_installer_version" ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Laravel Installer version detected: $current_installer_version${NC}"
    fi
}

print_runtime_capability_summary() {
    local runtime_invocation=""
    local composer_version="not_installed"
    local laravel_installer_version="not_installed"
    local wrapper_main_state="missing"
    local wrapper_safe_state="missing"

    runtime_invocation="$COMPOSER_RUNTIME_PHP"
    if [ -n "$COMPOSER_RUNTIME_SUBCMD" ]; then
        runtime_invocation="$runtime_invocation $COMPOSER_RUNTIME_SUBCMD"
    fi

    if [ -f "${COMPOSER_TARGET_PATH}.original" ] && [ -x "${COMPOSER_TARGET_PATH}.original" ]; then
        composer_version="$(get_composer_version)"
    fi

    if [ -f "$COMPOSER_TARGET_PATH" ] && [ -x "$COMPOSER_TARGET_PATH" ] && [ "$(wrapper_points_to_runtime_php "$COMPOSER_TARGET_PATH")" = "yes" ]; then
        wrapper_main_state="ready"
    fi

    if [ -f "$COMPOSER_SAFE_PATH" ] && [ -x "$COMPOSER_SAFE_PATH" ] && [ "$(wrapper_points_to_runtime_php "$COMPOSER_SAFE_PATH")" = "yes" ]; then
        wrapper_safe_state="ready"
    fi

    if [ -x "$COMPOSER_TARGET_PATH" ]; then
        resolve_laravel_installer_paths
        if [ -x "$LARAVEL_INSTALLER_BINARY_PATH" ]; then
            laravel_installer_version="$($LARAVEL_INSTALLER_BINARY_PATH --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1 || true)"
            laravel_installer_version="${laravel_installer_version:-not_installed}"
        fi
    fi

    echo -e "${CYAN}$SCRIPT_INDEX Runtime capability summary:${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX   Runtime plane      : $COMPOSER_RUNTIME_PLANE${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX   Runtime candidates : $COMPOSER_RUNTIME_CANDIDATES_LOG${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX   Runtime invocation : $runtime_invocation${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX   Runtime phar support: $COMPOSER_RUNTIME_PHAR_STATUS${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX   Composer version   : $composer_version${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX   Composer wrappers  : main=$wrapper_main_state, safe=$wrapper_safe_state${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX   Laravel Installer : $laravel_installer_version${NC}"
}

install_laravel_installer() {
    local current_week=""

    # Step 1: resolve composer globals -> binary home and bin directory by file path first.
    resolve_laravel_installer_paths

    # Step 2: ensure global directories exist for deterministic binary inspection.
    if [ -d "$LARAVEL_INSTALLER_HOME" ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Laravel installer home exists: $LARAVEL_INSTALLER_HOME${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Creating Laravel installer home: $LARAVEL_INSTALLER_HOME${NC}"
        $USE_SUDO mkdir -p "$LARAVEL_INSTALLER_HOME"
    fi

    if [ -d "$LARAVEL_INSTALLER_BIN_DIR" ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Laravel installer bin directory exists: $LARAVEL_INSTALLER_BIN_DIR${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Creating Laravel installer bin directory: $LARAVEL_INSTALLER_BIN_DIR${NC}"
        $USE_SUDO mkdir -p "$LARAVEL_INSTALLER_BIN_DIR"
    fi

    # Step 3: trust git when composer touches checked-out vendor directories.
    if command -v git >/dev/null 2>&1; then
        $USE_SUDO git config --global --add safe.directory '*' 2>/dev/null || true
    fi

    # Step 4: install only when missing (idempotent binary existence check).
    if [ -x "$LARAVEL_INSTALLER_BINARY_PATH" ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Laravel Installer is already installed: $LARAVEL_INSTALLER_BINARY_PATH${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Installing Laravel Installer (global)...${NC}"
        COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 run_composer_command global require "$LARAVEL_INSTALLER_PACKAGE" --no-interaction --no-progress --no-scripts || true
    fi

    # Step 5: keep PATH repair independent from binary install/update state.
    echo -e "${CYAN}$SCRIPT_INDEX Ensuring Laravel Installer path is in PATH...${NC}"
    bash "$LINUX_PATH_FUNCTION" addpath "$LARAVEL_INSTALLER_BIN_DIR" || true
    ensure_laravel_installer_usrbin_link

    if [ ! -x "$LARAVEL_INSTALLER_BINARY_PATH" ]; then
        echo -e "${RED}$SCRIPT_INDEX Laravel Installer binary is unavailable after install step, skipping refresh and version check.${NC}"
    else
        echo -e "${GREEN}$SCRIPT_INDEX Laravel Installer PATH repair completed: $LARAVEL_INSTALLER_BIN_DIR and $LARAVEL_INSTALLER_LINK_PATH${NC}"

        # Step 6: refresh weekly; this is idempotent and independent from install.
        current_week="$(date +%G-W%V)"
        if [ "$FORCE_REINSTALL" = true ] || [ "$(cat "$LARAVEL_INSTALLER_UPDATE_STAMP" 2>/dev/null)" != "$current_week" ]; then
            echo -e "${CYAN}$SCRIPT_INDEX Refreshing Laravel Installer (weekly, idempotent)...${NC}"
            if COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 run_composer_command global update "$LARAVEL_INSTALLER_PACKAGE" --no-interaction --no-progress; then
                $USE_SUDO mkdir -p "$(dirname "$LARAVEL_INSTALLER_UPDATE_STAMP")"
                echo "$current_week" | $USE_SUDO tee "$LARAVEL_INSTALLER_UPDATE_STAMP" > /dev/null
            else
                echo -e "${YELLOW}$SCRIPT_INDEX Laravel Installer refresh failed; keeping the installed version${NC}"
            fi
        else
            echo -e "${GREEN}$SCRIPT_INDEX Laravel Installer refresh already completed this week.${NC}"
        fi

        # Step 7: show installed version for traceability.
        print_laravel_installer_version
        echo -e "${GREEN}$SCRIPT_INDEX Laravel scaffolding command (docs): laravel new <app_name>${NC}"
    fi
}
# Check command line arguments
FORCE_REINSTALL=false
if [ "$1" = "--force" ] || [ "$1" = "-f" ]; then
    FORCE_REINSTALL=true
    echo -e "${YELLOW}$SCRIPT_INDEX Force reinstall requested${NC}"
elif [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Composer Installation Script for PHP 8.5 (Server Edition)${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Version: 3.0 - Fine-Grained Repair${NC}"
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}Usage: $0 [options]${NC}"
    echo -e "${CYAN}${NC}"
    echo -e "${CYAN}Options:${NC}"
    echo -e "${CYAN}  --force, -f    Force reinstall the Composer core binary${NC}"
    echo -e "${CYAN}  --help, -h     Show this help message${NC}"
    echo -e "${CYAN}${NC}"
    echo -e "${CYAN}This script will:${NC}"
    echo -e "${CYAN}  1. Install the Composer core binary only when missing or forced${NC}"
    echo -e "${CYAN}  2. Repair each missing Composer wrapper independently${NC}"
    echo -e "${CYAN}  3. Repair Composer and Laravel PATH entries independently${NC}"
    echo -e "${CYAN}  4. Install Laravel Installer when missing and refresh it weekly (latest available)${NC}"
    echo -e "${CYAN}${NC}"
    echo -e "${CYAN}Fine-Grained Repair Features:${NC}"
    echo -e "${CYAN}  - Composer core binary existence check${NC}"
    echo -e "${CYAN}  - Independent main and safe wrapper repair${NC}"
    echo -e "${CYAN}  - Independent Composer PATH repair${NC}"
    echo -e "${CYAN}  - Independent Laravel binary and PATH repair${NC}"
    echo -e "${CYAN}${NC}"
    echo -e "${CYAN}Created files:${NC}"
    echo -e "${CYAN}  /usr/local/bin/composer            (main wrapper)${NC}"
    echo -e "${CYAN}  $COMPOSER_SAFE_PATH       (explicit safe wrapper)${NC}"
    echo -e "${CYAN}  /usr/local/bin/composer.original   (original Composer binary)${NC}"
    echo -e "${CYAN}  /usr/local/etc/.composer_php_version (PHP version tracking)${NC}"
    echo -e "${CYAN}${NC}"
    echo -e "${CYAN}Server-Optimized Features:${NC}"
    echo -e "${CYAN}  �?Automatic retry on download failures${NC}"
    echo -e "${CYAN}  �?Non-interactive mode by default${NC}"
    echo -e "${CYAN}  �?Root user handling without prompts${NC}"
    echo -e "${CYAN}  �?Comprehensive error detection${NC}"
    echo -e "${CYAN}============================================================================${NC}"
    exit 0
fi

# Simple installation check
main() {
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Composer Installation for PHP 8.5 (Server Edition)${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Version: 3.0 - Fine-Grained Repair${NC}"
    echo -e "${CYAN}============================================================================${NC}"

    # Resolve Composer runtime PHP before any Composer invocation.
    resolve_composer_runtime_php

    # Check PHP runtime availability and capability.
    if [ ! -x "$PHP_BINARY" ]; then
        echo -e "${RED}$SCRIPT_INDEX Runtime binary is not executable: $PHP_BINARY${NC}"
        echo -e "${YELLOW}$SCRIPT_INDEX Please run 43_ensure_php85_intelligent.sh (system plane) or 93_install_frankenphp.sh (frankenphp plane) first${NC}"
        return
    fi

    local php_version=$(get_current_php_version)
    if [ "$php_version" = "not_found" ]; then
        echo -e "${RED}$SCRIPT_INDEX $PHP_BINARY is not readable (composer runtime detection failed)${NC}"
        return
    fi
    if [ "$php_version" = "unknown" ] && [ "$COMPOSER_RUNTIME_PLANE" != "frankenphp" ]; then
        echo -e "${RED}$SCRIPT_INDEX $PHP_BINARY is not readable (composer runtime detection failed)${NC}"
        return
    fi

    if [ "$COMPOSER_RUNTIME_PLANE" = "frankenphp" ]; then
        echo -e "${CYAN}$SCRIPT_INDEX Runtime plane frankenphp: skipping strict PHP ${PHP_VERSION} comparison and using embedded runtime path by design.${NC}"
    else
        case "$php_version" in
            ${PHP_VERSION}.*)
                ;;
            *)
                echo -e "${RED}$SCRIPT_INDEX $PHP_BINARY is not PHP ${PHP_VERSION}${NC}"
                return
                ;;
        esac
    fi

    if [ "$COMPOSER_RUNTIME_PHAR_STATUS" != "yes" ]; then
        echo -e "${RED}$SCRIPT_INDEX $PHP_BINARY does not expose the required phar extension; Composer cannot run on this runtime${NC}"
        return
    fi

    echo -e "${GREEN}$SCRIPT_INDEX Composer runtime binary: $PHP_BINARY${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX PHP runtime version: $php_version confirmed at $PHP_BINARY${NC}"
    print_runtime_capability_summary

    # Independent Composer core-binary check
    local current_version=$(get_composer_version)
    local auto_fix_needed=false

    if [ "$FORCE_REINSTALL" = true ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX [FORCE MODE] Force reinstall requested${NC}"
        auto_fix_needed=true
    elif [ -f "${COMPOSER_TARGET_PATH}.original" ] && [ -x "${COMPOSER_TARGET_PATH}.original" ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Composer core binary is already present (version: $current_version)${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX �?Original: ${COMPOSER_TARGET_PATH}.original${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX �?PHP version tracking: $php_version${NC}"
        repair_composer_wrappers
        repair_composer_path
        install_laravel_installer
        print_runtime_capability_summary
        return
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Composer core binary is missing or broken, proceeding with installation${NC}"
        auto_fix_needed=true
    fi

    if [ "$auto_fix_needed" = false ]; then
        return
    fi

    # Show environment configuration
    if [ "$EUID" -eq 0 ]; then
        echo -e "${CYAN}$SCRIPT_INDEX Root user detected - Composer warnings will be automatically handled${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Environment: COMPOSER_ALLOW_SUPERUSER=1, COMPOSER_NO_INTERACTION=1${NC}"
    else
        echo -e "${CYAN}$SCRIPT_INDEX Non-interactive mode enabled: COMPOSER_NO_INTERACTION=1${NC}"
    fi

    # Download and install the Composer core binary only
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX [INSTALLATION] Downloading latest Composer (>= $MIN_COMPOSER_VERSION)${NC}"
    echo -e "${CYAN}============================================================================${NC}"

    # Create temp directory
    local temp_dir=$(mktemp -d)
    local original_dir=$(pwd)
    cd "$temp_dir"

    # Download installer with retry logic
    local download_attempts=0
    local max_attempts=3
    local download_success=false

    while [ $download_attempts -lt $max_attempts ]; do
        download_attempts=$((download_attempts + 1))
        echo -e "${CYAN}$SCRIPT_INDEX Downloading Composer installer (attempt $download_attempts/$max_attempts)...${NC}"

        if curl -fsSL "$COMPOSER_DOWNLOAD_URL" -o composer-setup.php 2>/dev/null; then
            download_success=true
            echo -e "${GREEN}$SCRIPT_INDEX �?Download successful${NC}"
            break
        else
            echo -e "${YELLOW}$SCRIPT_INDEX Download attempt $download_attempts failed${NC}"
            sleep 2
        fi
    done

    if [ "$download_success" = false ]; then
        echo -e "${RED}$SCRIPT_INDEX Failed to download Composer installer after $max_attempts attempts${NC}"
        cd "$original_dir"
        rm -rf "$temp_dir"
        return
    fi

    # Verify the installer's authenticity BEFORE executing it as root (it runs below with
    # open_basedir=none). Composer publishes the expected SHA-384 of composer-setup.php at
    # https://composer.github.io/installer.sig; a mismatch means a corrupted or tampered
    # download (TLS-MITM, CDN/DNS compromise) -- refuse to run it. Mirrors the SHA256
    # verification ensure_php_compat_libs_from_apt_repository_manager applies to .debs.
    local expected_sig actual_sig
    expected_sig="$(curl -fsSL https://composer.github.io/installer.sig 2>/dev/null | tr -d '[:space:]')"
    local composer_installer_hash_probe=""
    composer_installer_hash_probe="$(mktemp)"
    printf "<?php echo hash_file('sha384', 'composer-setup.php');" > "$composer_installer_hash_probe"
    actual_sig="$(composer_runtime_exec "$composer_installer_hash_probe" 2>/dev/null)"
    rm -f "$composer_installer_hash_probe"
    if [ -z "$expected_sig" ]; then
        echo -e "${RED}$SCRIPT_INDEX Could not fetch the Composer installer signature; refusing to run an unverified installer as root${NC}"
        cd "$original_dir"; rm -rf "$temp_dir"; return
    fi
    if [ "$expected_sig" != "$actual_sig" ]; then
        echo -e "${RED}$SCRIPT_INDEX Composer installer SHA-384 mismatch (expected ${expected_sig:0:16}..., got ${actual_sig:0:16}...); aborting${NC}"
        cd "$original_dir"; rm -rf "$temp_dir"; return
    fi
    echo -e "${GREEN}$SCRIPT_INDEX Composer installer SHA-384 verified${NC}"

    # Install with open_basedir disabled and environment variables set
    echo -e "${CYAN}$SCRIPT_INDEX Installing Composer with PHP 8.5 compatibility...${NC}"
    local install_output
    if [ "$COMPOSER_RUNTIME_SUBCMD" = "php-cli" ]; then
        install_output=$($USE_SUDO COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$COMPOSER_RUNTIME_PHP" php-cli composer-setup.php --install-dir="$COMPOSER_PATH_DIR" --filename=composer.original 2>&1)
    else
        install_output=$($USE_SUDO COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$COMPOSER_RUNTIME_PHP" -d "open_basedir=none" composer-setup.php --install-dir="$COMPOSER_PATH_DIR" --filename=composer.original 2>&1)
    fi
    local install_status=$?

    if [ $install_status -eq 0 ]; then
        echo -e "${GREEN}$SCRIPT_INDEX �?Composer installed successfully${NC}"

        # Show installed version
        local installed_version
        installed_version="$(composer_run_original_runtime --version 2>/dev/null | grep -oP 'Composer version \K[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")"
        echo -e "${GREEN}$SCRIPT_INDEX �?Installed version: $installed_version${NC}"

        if ! version_compare "$installed_version" "$MIN_COMPOSER_VERSION"; then
            echo -e "${RED}$SCRIPT_INDEX WARNING: Installed version $installed_version may be too old for PHP 8.5${NC}"
            echo -e "${YELLOW}$SCRIPT_INDEX Minimum recommended: $MIN_COMPOSER_VERSION${NC}"
        fi
    else
        echo -e "${RED}$SCRIPT_INDEX Composer installation failed${NC}"
        echo -e "${RED}$SCRIPT_INDEX Error output:${NC}"
        echo "$install_output"
        cd "$original_dir"
        rm -rf "$temp_dir"
        return
    fi

    # Make executable
    $USE_SUDO chmod +x "${COMPOSER_TARGET_PATH}.original"

    # Clean up temp directory
    cd "$original_dir"
    rm -rf "$temp_dir"

    repair_composer_wrappers

    # Verify all wrappers are working correctly
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX [VERIFICATION] Testing all components...${NC}"
    echo -e "${CYAN}============================================================================${NC}"

    local all_checks_passed=true

    # Test main composer wrapper
    echo -e "${CYAN}$SCRIPT_INDEX Testing main composer wrapper...${NC}"
    if run_composer_command --version >/dev/null 2>&1; then
        echo -e "${GREEN}$SCRIPT_INDEX �?Main composer wrapper: OK${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX �?Main composer wrapper: FAILED${NC}"
        all_checks_passed=false
    fi

    # Test composer-safe wrapper
    echo -e "${CYAN}$SCRIPT_INDEX Testing composer-safe wrapper...${NC}"
    if run_composer_wrapper_command "$COMPOSER_SAFE_PATH" --version >/dev/null 2>&1; then
        echo -e "${GREEN}$SCRIPT_INDEX �?Composer-safe wrapper: OK${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX �?Composer-safe wrapper: FAILED${NC}"
        all_checks_passed=false
    fi

    # Test original composer binary
    echo -e "${CYAN}$SCRIPT_INDEX Testing original composer binary...${NC}"
    if composer_run_original_runtime --version >/dev/null 2>&1; then
        echo -e "${GREEN}$SCRIPT_INDEX �?Original composer binary: OK${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX �?Original composer binary: FAILED${NC}"
        all_checks_passed=false
    fi

    # Check for deprecation warnings
    echo -e "${CYAN}$SCRIPT_INDEX Checking for deprecation warnings...${NC}"
    if check_composer_errors; then
        echo -e "${GREEN}$SCRIPT_INDEX �?No deprecation warnings detected${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX ! Deprecation warnings present (may need newer Composer version)${NC}"
    fi

    if [ "$all_checks_passed" = false ]; then
        echo -e "${RED}$SCRIPT_INDEX [FAIL] Some verification checks failed${NC}"
        return
    fi

    # Store PHP version metadata
    store_php_version

    repair_composer_path
    install_laravel_installer

    # Final verification with environment variables
    local final_version=$(get_composer_version)
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX ✓✓ Composer installation completed ✓✓${NC}"
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX Composer Version: $final_version${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX PHP Version: $(get_current_php_version)${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX Main wrapper: $COMPOSER_TARGET_PATH${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX Safe wrapper: $COMPOSER_SAFE_PATH${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX Original binary: ${COMPOSER_TARGET_PATH}.original${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX PHP tracking file: $PHP_VERSION_TRACK_FILE${NC}"
    print_runtime_capability_summary
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Usage:${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX   composer --version         (auto-handles root + open_basedir)${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX   composer-safe --version    (explicit safe wrapper)${NC}"
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${YELLOW}$SCRIPT_INDEX Features:${NC}"
    echo -e "${YELLOW}$SCRIPT_INDEX   Automatic root warning suppression${NC}"
    echo -e "${YELLOW}$SCRIPT_INDEX   open_basedir=none for maximum compatibility${NC}"
    echo -e "${YELLOW}$SCRIPT_INDEX   - Fine-grained binary and PATH repair${NC}"
    echo -e "${CYAN}============================================================================${NC}"
}

# Execute main function
# Keep plane resolution explicit here and do not load octane command-mode scripts in this Composer-only path.
if [ "$(php_runtime_plane)" = "frankenphp" ]; then
    echo -e "${CYAN}$SCRIPT_INDEX PHP runtime plane: frankenphp - enabling php-cli shim for embedded runtime integration${NC}"
    fm_ensure_php_cli_shim
fi

main "$@"
