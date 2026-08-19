#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# FrankenPHP installation entry. This script orchestrates by mode
# and dispatches to exactly one mode implementation script.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
COMMON_DIR="$(dirname "$PARENT_DIR_LEVEL_1")/common"
REPO_ROOT="$(cd "$SCRIPT_CURRENT_DIR/../../../.." && pwd)"

FRANKENPHP_INSTALL_MODE=""
FRANKENPHP_INSTALL_SELECTION=""
FRANKENPHP_INSTALL_OPTION=""
FRANKENPHP_INSTALL_NO_MUTEX=""
FRANKENPHP_INSTALL_PREBUILT_VERSION=""

source "$COMMON_DIR/frankenphp_install_modes.sh"
source "$COMMON_DIR/gvar_common.sh"
source "$COMMON_DIR/common_functions.sh"
source "$COMMON_DIR/step_state.sh"
source "$COMMON_DIR/service_contract_common.sh"
source "$COMMON_DIR/frankenphp_manager.sh"

FRANKENPHP_INSTALL_INDEX="$FRANKENPHP_INSTALL_93_INDEX"
FRANKENPHP_INSTALL_COMPILE_SCRIPT="${COMMON_DIR}/${FRANKENPHP_INSTALL_PIPELINE_COMPILE_SCRIPT_NAME}"
FRANKENPHP_INSTALL_APT_SCRIPT="${COMMON_DIR}/${FRANKENPHP_INSTALL_PIPELINE_SYSTEM_SCRIPT_NAME}"
FRANKENPHP_INSTALL_PREBUILT_SCRIPT="${COMMON_DIR}/${FRANKENPHP_INSTALL_PIPELINE_PREBUILT_SCRIPT_NAME}"
FRANKENPHP_INSTALL_CLEANUP_COMPILE_SCRIPT="${COMMON_DIR}/${FRANKENPHP_INSTALL_PIPELINE_CLEANUP_COMPILE_SCRIPT_NAME}"
FRANKENPHP_INSTALL_CLEANUP_APT_SCRIPT="${COMMON_DIR}/${FRANKENPHP_INSTALL_PIPELINE_CLEANUP_SYSTEM_SCRIPT_NAME}"
FRANKENPHP_INSTALL_CLEANUP_PREBUILT_SCRIPT="${COMMON_DIR}/${FRANKENPHP_INSTALL_PIPELINE_CLEANUP_PREBUILT_SCRIPT_NAME}"

FRANKENPHP_CADDYFILE_DIR="${REPO_ROOT}/poly_apps/laravel_main/storage/frankenphp"
FRANKENPHP_SITE_HOST="${FRANKENPHP_SITE_HOST:-$(fm_site_host)}"
FRANKENPHP_SITE_PORT="${FRANKENPHP_SITE_PORT:-$(sc_get ports.frankenphp_https)}"
FRANKENPHP_ADMIN_PORT="${FRANKENPHP_ADMIN_PORT:-$(sc_get ports.frankenphp_admin)}"
FRANKENPHP_LARAVEL_PUBLIC_DIR="${REPO_ROOT}/poly_apps/laravel_main/public"

NGINX_PLANE_DISABLE_SCRIPT="${COMMON_DIR}/nginx_plane_disable.sh"
CERTBOT_PLANE_DISABLE_SCRIPT="${COMMON_DIR}/certbot_plane_disable.sh"

frankenphp_install_mode_resolve() {
    local arg=""

    for arg in "$@"; do
        case "$arg" in
            --compile|--mode=compile|1|compile|"$FRANKENPHP_INSTALL_MODE_MENU_COMPILE")
                FRANKENPHP_INSTALL_MODE="$FRANKENPHP_INSTALL_MODE_COMPILE"
                ;;
            --apt|--mode=apt|2|apt|"$FRANKENPHP_INSTALL_MODE_MENU_APT")
                FRANKENPHP_INSTALL_MODE="$FRANKENPHP_INSTALL_MODE_APT"
                ;;
            --git|--prebuilt|--mode=prebuilt|--mode=git|3|git|prebuilt|"$FRANKENPHP_INSTALL_MODE_MENU_GIT")
                FRANKENPHP_INSTALL_MODE="$FRANKENPHP_INSTALL_MODE_PREBUILT"
                ;;
            --mode=*)
                FRANKENPHP_INSTALL_OPTION="${arg#*=}"
                FRANKENPHP_INSTALL_MODE="$(frankenphp_install_mode_normalize "$FRANKENPHP_INSTALL_OPTION")"
                ;;
            --prebuilt-version=*)
                FRANKENPHP_INSTALL_MODE="$FRANKENPHP_INSTALL_MODE_PREBUILT"
                FRANKENPHP_INSTALL_PREBUILT_VERSION="${arg#*=}"
                ;;
            --no-mutex)
                FRANKENPHP_INSTALL_NO_MUTEX="true"
                ;;
        esac
    done

    if [ -z "$FRANKENPHP_INSTALL_MODE" ] && [ -t 0 ] && [ -r /dev/tty ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] Select FrankenPHP installation mode:"
        echo "[${FRANKENPHP_INSTALL_INDEX}]   [${FRANKENPHP_INSTALL_MODE_MENU_COMPILE}] Compile (default)"
        echo "[${FRANKENPHP_INSTALL_INDEX}]   [${FRANKENPHP_INSTALL_MODE_MENU_APT}] apt install php-zts-dev php-zts-pgsql php-zts-pdo-pgsql"
        echo "[${FRANKENPHP_INSTALL_INDEX}]   [${FRANKENPHP_INSTALL_MODE_MENU_GIT}] GitHub prebuilt binary"
        echo -n "[${FRANKENPHP_INSTALL_INDEX}] Choose mode (1/2/3, default 1): "
        read -r FRANKENPHP_INSTALL_SELECTION < /dev/tty || FRANKENPHP_INSTALL_SELECTION=""
        FRANKENPHP_INSTALL_MODE="$(frankenphp_install_mode_normalize "$FRANKENPHP_INSTALL_SELECTION")"
    fi

    FRANKENPHP_INSTALL_MODE="$(frankenphp_install_mode_normalize "$FRANKENPHP_INSTALL_MODE")"
    FRANKENPHP_INSTALL_MODE="${FRANKENPHP_INSTALL_MODE:-$FRANKENPHP_INSTALL_MODE_DEFAULT}"
}

frankenphp_install_frankenphp_planes() {
    if [ "$FRANKENPHP_INSTALL_NO_MUTEX" != "true" ]; then
        bash "$NGINX_PLANE_DISABLE_SCRIPT"
        bash "$CERTBOT_PLANE_DISABLE_SCRIPT"
        set_web_server_plane "frankenphp"
    else
        echo "[${FRANKENPHP_INSTALL_INDEX}] [WARN] --no-mutex: nginx/certbot left untouched; manage the plane manually"
    fi
}

frankenphp_install_frankenphp_dispatch() {
    local selected_script=""

    case "$FRANKENPHP_INSTALL_MODE" in
        "$FRANKENPHP_INSTALL_MODE_COMPILE")
            selected_script="$FRANKENPHP_INSTALL_COMPILE_SCRIPT"
            ;;
        "$FRANKENPHP_INSTALL_MODE_APT")
            selected_script="$FRANKENPHP_INSTALL_APT_SCRIPT"
            ;;
        "$FRANKENPHP_INSTALL_MODE_PREBUILT")
            selected_script="$FRANKENPHP_INSTALL_PREBUILT_SCRIPT"
            ;;
        *)
            selected_script="$FRANKENPHP_INSTALL_COMPILE_SCRIPT"
            ;;
    esac

    if [ -f "$selected_script" ]; then
        bash "$selected_script" "$@"
    else
        echo "[${FRANKENPHP_INSTALL_INDEX}] ERROR: missing mode script: $selected_script"
    fi
}

frankenphp_install_frankenphp_cleanup() {
    case "$FRANKENPHP_INSTALL_MODE" in
        "$FRANKENPHP_INSTALL_MODE_COMPILE")
            bash "$FRANKENPHP_INSTALL_CLEANUP_APT_SCRIPT"
            bash "$FRANKENPHP_INSTALL_CLEANUP_PREBUILT_SCRIPT"
            ;;
        "$FRANKENPHP_INSTALL_MODE_APT")
            bash "$FRANKENPHP_INSTALL_CLEANUP_COMPILE_SCRIPT"
            bash "$FRANKENPHP_INSTALL_CLEANUP_PREBUILT_SCRIPT"
            ;;
        "$FRANKENPHP_INSTALL_MODE_PREBUILT")
            bash "$FRANKENPHP_INSTALL_CLEANUP_COMPILE_SCRIPT"
            bash "$FRANKENPHP_INSTALL_CLEANUP_APT_SCRIPT"
            ;;
    esac
}

frankenphp_install_frankenphp_finalize() {
    local start_web_server=""

    start_web_server="$(get_global_var "START_WEB_SERVER" "frankenphp")"
    if [ "$start_web_server" != "frankenphp" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] SKIP: START_WEB_SERVER=${start_web_server} (nginx plane active); frankenphp not installed"
        return
    fi

    echo "[$FRANKENPHP_INSTALL_INDEX] FrankenPHP Installation Script (Mercure plane, HTTP/3 ready)"
    echo "[$FRANKENPHP_INSTALL_INDEX] Web server choice: $start_web_server | mode: $(frankenphp_install_mode_label "$FRANKENPHP_INSTALL_MODE") | no-mutex: ${FRANKENPHP_INSTALL_NO_MUTEX:-false}"

    frankenphp_install_frankenphp_planes

    fm_caddyfile_ensure \
        "$FRANKENPHP_LARAVEL_PUBLIC_DIR" \
        "$FRANKENPHP_SITE_HOST" \
        "$FRANKENPHP_SITE_PORT" \
        "$FRANKENPHP_ADMIN_PORT" \
        "${FRANKENPHP_CADDYFILE_DIR}/Caddyfile"

    fm_store_info
    fm_verify

    echo "[$FRANKENPHP_INSTALL_INDEX] =============================================="
    echo "[$FRANKENPHP_INSTALL_INDEX] FRANKENPHP PLANE READY: $(fm_version)"
    echo "[$FRANKENPHP_INSTALL_INDEX] Caddyfile: ${FRANKENPHP_CADDYFILE_DIR}/Caddyfile (Mercure hub: /.well-known/mercure on :${FRANKENPHP_SITE_PORT})"
    echo "[$FRANKENPHP_INSTALL_INDEX] Runtime entry: 175_laravel_main_start.sh (frankenphp branch)"
    echo "[$FRANKENPHP_INSTALL_INDEX] =============================================="
}

frankenphp_install_frankenphp() {
    frankenphp_install_mode_resolve "$@"
    frankenphp_install_frankenphp_cleanup
    frankenphp_install_frankenphp_dispatch "$@"

    if [ "$FRANKENPHP_INSTALL_MODE" = "$FRANKENPHP_INSTALL_MODE_COMPILE" ] || [ "$FRANKENPHP_INSTALL_MODE" = "$FRANKENPHP_INSTALL_MODE_PREBUILT" ]; then
        frankenphp_install_frankenphp_finalize
    fi
}

frankenphp_install_frankenphp "$@"
