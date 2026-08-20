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

# Canonical three-variant lifecycle. Preparation repairs only the requested
# candidate. The file-backed owner is committed after an independent readiness
# probe, and non-owner payloads retire only after the runtime contract is
# re-probed. No phase consumes a command or function exit status as state.

FRANKENPHP_INSTALL_INDEX="93"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_CURRENT_DIR/../../../.." && pwd)"
FRANKENPHP_INSTALL_MODE=""
FRANKENPHP_INSTALL_SELECTION=""
FRANKENPHP_INSTALL_OPTION=""
FRANKENPHP_INSTALL_NO_MUTEX="false"
FRANKENPHP_INSTALL_PREBUILT_VERSION=""
FRANKENPHP_CADDYFILE_DIR="${REPO_ROOT}/poly_apps/laravel_main/storage/frankenphp"
FRANKENPHP_SITE_HOST="${FRANKENPHP_SITE_HOST:-}"
FRANKENPHP_SITE_PORT=""
FRANKENPHP_ADMIN_PORT=""
FRANKENPHP_LARAVEL_PUBLIC_DIR="${REPO_ROOT}/poly_apps/laravel_main/public"
FRANKENPHP_INSTALL_COMPILE_SCRIPT=""
FRANKENPHP_INSTALL_APT_SCRIPT=""
FRANKENPHP_INSTALL_PREBUILT_SCRIPT=""
FRANKENPHP_INSTALL_CLEANUP_COMPILE_SCRIPT=""
FRANKENPHP_INSTALL_CLEANUP_APT_SCRIPT=""
FRANKENPHP_INSTALL_CLEANUP_PREBUILT_SCRIPT=""
FRANKENPHP_ACME_INSTALL_SCRIPT="${SCRIPT_CURRENT_DIR}/frankenphp_acme_sh_install.sh"
NGINX_PLANE_DISABLE_SCRIPT="${SCRIPT_CURRENT_DIR}/nginx_plane_disable.sh"
CERTBOT_PLANE_DISABLE_SCRIPT="${SCRIPT_CURRENT_DIR}/certbot_plane_disable.sh"

source "$SCRIPT_CURRENT_DIR/frankenphp_install_modes.sh"
source "$SCRIPT_CURRENT_DIR/gvar_common.sh"
source "$SCRIPT_CURRENT_DIR/common_functions.sh"
source "$SCRIPT_CURRENT_DIR/service_contract_common.sh"
source "$SCRIPT_CURRENT_DIR/frankenphp_manager.sh"

FRANKENPHP_INSTALL_COMPILE_SCRIPT="${SCRIPT_CURRENT_DIR}/${FRANKENPHP_INSTALL_PIPELINE_COMPILE_SCRIPT_NAME}"
FRANKENPHP_INSTALL_APT_SCRIPT="${SCRIPT_CURRENT_DIR}/${FRANKENPHP_INSTALL_PIPELINE_SYSTEM_SCRIPT_NAME}"
FRANKENPHP_INSTALL_PREBUILT_SCRIPT="${SCRIPT_CURRENT_DIR}/${FRANKENPHP_INSTALL_PIPELINE_PREBUILT_SCRIPT_NAME}"
FRANKENPHP_INSTALL_CLEANUP_COMPILE_SCRIPT="${SCRIPT_CURRENT_DIR}/${FRANKENPHP_INSTALL_PIPELINE_CLEANUP_COMPILE_SCRIPT_NAME}"
FRANKENPHP_INSTALL_CLEANUP_APT_SCRIPT="${SCRIPT_CURRENT_DIR}/${FRANKENPHP_INSTALL_PIPELINE_CLEANUP_SYSTEM_SCRIPT_NAME}"
FRANKENPHP_INSTALL_CLEANUP_PREBUILT_SCRIPT="${SCRIPT_CURRENT_DIR}/${FRANKENPHP_INSTALL_PIPELINE_CLEANUP_PREBUILT_SCRIPT_NAME}"
FRANKENPHP_SITE_HOST="${FRANKENPHP_SITE_HOST:-$(fm_site_host)}"
FRANKENPHP_SITE_PORT="$(sc_get ports.frankenphp_https)"
FRANKENPHP_ADMIN_PORT="$(sc_get ports.frankenphp_admin)"

frankenphp_install_pipeline_read_mode() {
    local arg=""

    for arg in "$@"; do
        case "$arg" in
            --apt|--mode=apt|1|apt)
                FRANKENPHP_INSTALL_MODE="$FRANKENPHP_INSTALL_MODE_APT"
                ;;
            --compile|--mode=compile|2|compile)
                FRANKENPHP_INSTALL_MODE="$FRANKENPHP_INSTALL_MODE_COMPILE"
                ;;
            --git|--prebuilt|--mode=prebuilt|--mode=git|3|git|prebuilt)
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
        echo "[${FRANKENPHP_INSTALL_INDEX}]   [1] apt install - official deb repo + php-zts extensions incl. PostgreSQL (default)"
        echo "[${FRANKENPHP_INSTALL_INDEX}]   [2] Compile (dnspod DNS-01 module embedded)"
        echo "[${FRANKENPHP_INSTALL_INDEX}]   [3] GitHub prebuilt binary"
        echo -n "[${FRANKENPHP_INSTALL_INDEX}] Choose mode (1/2/3, default 1): "
        read -r FRANKENPHP_INSTALL_SELECTION < /dev/tty
        FRANKENPHP_INSTALL_MODE="$(frankenphp_install_mode_normalize "$FRANKENPHP_INSTALL_SELECTION")"
    fi
    FRANKENPHP_INSTALL_MODE="$(frankenphp_install_mode_normalize "$FRANKENPHP_INSTALL_MODE")"
    FRANKENPHP_INSTALL_MODE="${FRANKENPHP_INSTALL_MODE:-$FRANKENPHP_INSTALL_MODE_DEFAULT}"
}

frankenphp_install_pipeline_prepare() {
    case "$FRANKENPHP_INSTALL_MODE" in
        "$FRANKENPHP_INSTALL_MODE_APT")
            bash "$FRANKENPHP_INSTALL_APT_SCRIPT" "$@"
            ;;
        "$FRANKENPHP_INSTALL_MODE_COMPILE")
            bash "$FRANKENPHP_INSTALL_COMPILE_SCRIPT" "$@"
            ;;
        "$FRANKENPHP_INSTALL_MODE_PREBUILT")
            bash "$FRANKENPHP_INSTALL_PREBUILT_SCRIPT" "$@"
            ;;
    esac
}

frankenphp_install_pipeline_planes_ensure() {
    if [ "$FRANKENPHP_INSTALL_NO_MUTEX" = "true" ]; then
        echo "[$FRANKENPHP_INSTALL_INDEX] [WARN] --no-mutex: nginx/certbot left untouched; manage the plane manually"
        return
    fi
    bash "$NGINX_PLANE_DISABLE_SCRIPT"
    bash "$CERTBOT_PLANE_DISABLE_SCRIPT"
    set_web_server_plane "frankenphp"
}

frankenphp_install_pipeline_mode_support_ensure() {
    case "$FRANKENPHP_INSTALL_MODE" in
        "$FRANKENPHP_INSTALL_MODE_APT"|"$FRANKENPHP_INSTALL_MODE_PREBUILT")
            source "$FRANKENPHP_ACME_INSTALL_SCRIPT"
            acme_sh_ensure_install
            acme_sh_ensure_domains
            ;;
        "$FRANKENPHP_INSTALL_MODE_COMPILE")
            fm_dnspod_token_ensure
            ;;
    esac
    fm_disable_legacy_php_runtime
}

frankenphp_install_pipeline_retire_nonowners() {
    case "$FRANKENPHP_INSTALL_MODE" in
        "$FRANKENPHP_INSTALL_MODE_APT")
            bash "$FRANKENPHP_INSTALL_CLEANUP_COMPILE_SCRIPT"
            bash "$FRANKENPHP_INSTALL_CLEANUP_PREBUILT_SCRIPT"
            ;;
        "$FRANKENPHP_INSTALL_MODE_COMPILE")
            bash "$FRANKENPHP_INSTALL_CLEANUP_APT_SCRIPT"
            bash "$FRANKENPHP_INSTALL_CLEANUP_PREBUILT_SCRIPT"
            ;;
        "$FRANKENPHP_INSTALL_MODE_PREBUILT")
            bash "$FRANKENPHP_INSTALL_CLEANUP_APT_SCRIPT"
            bash "$FRANKENPHP_INSTALL_CLEANUP_COMPILE_SCRIPT"
            ;;
    esac
}

frankenphp_install_pipeline_finalize() {
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

frankenphp_install_pipeline() {
    local start_web_server=""
    local previous_variant=""

    start_web_server="$(get_global_var "START_WEB_SERVER" "frankenphp")"
    if [ "$start_web_server" != "frankenphp" ]; then
        echo "[$FRANKENPHP_INSTALL_INDEX] SKIP: START_WEB_SERVER=${start_web_server} (nginx plane active); frankenphp not installed"
        return
    fi

    frankenphp_install_pipeline_read_mode "$@"
    previous_variant="$(fm_variant)"
    echo "[$FRANKENPHP_INSTALL_INDEX] lifecycle: prepare -> probe -> commit -> support -> retire -> finalize"
    echo "[$FRANKENPHP_INSTALL_INDEX] requested: $(frankenphp_install_mode_label "$FRANKENPHP_INSTALL_MODE") | current: ${previous_variant:-unrecorded}"

    frankenphp_install_pipeline_prepare "$@"
    if [ "$(fm_variant_ready "$FRANKENPHP_INSTALL_MODE")" != "yes" ]; then
        echo "[$FRANKENPHP_INSTALL_INDEX] [ERROR] candidate preparation incomplete; owner remains ${previous_variant:-unrecorded}"
        return
    fi

    fm_variant_commit "$FRANKENPHP_INSTALL_MODE"
    if [ "$(fm_runtime_contract_ready "$FRANKENPHP_INSTALL_MODE")" != "yes" ]; then
        echo "[$FRANKENPHP_INSTALL_INDEX] [ERROR] commit incomplete; non-owner cleanup and finalization skipped"
        return
    fi

    frankenphp_install_pipeline_planes_ensure
    frankenphp_install_pipeline_mode_support_ensure
    frankenphp_install_pipeline_retire_nonowners
    if [ "$(fm_runtime_contract_ready "$FRANKENPHP_INSTALL_MODE")" != "yes" ]; then
        echo "[$FRANKENPHP_INSTALL_INDEX] [ERROR] runtime contract changed during retirement; finalization skipped"
        return
    fi
    frankenphp_install_pipeline_finalize
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    frankenphp_install_pipeline "$@"
fi
