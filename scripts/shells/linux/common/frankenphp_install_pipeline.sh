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

# Public orchestrator for FrankenPHP installation in 93_install_frankenphp.
# It keeps the old skip/plane behavior and dispatches either:
# - compile mode: existing official installer + static build flow (dnspod rebuild path)
# - prebuilt mode: release asset install + acme.sh installation

FRANKENPHP_INSTALL_INDEX="93"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
REPO_ROOT="$(cd "$SCRIPT_CURRENT_DIR/../../../.." && pwd)"
SCRIPT_INDEX="93"
FRANKENPHP_INSTALL_NAMESPACE="93_install_frankenphp"

FRANKENPHP_STEP_NAMESPACE="93_install_frankenphp"
FRANKENPHP_CADDYFILE_DIR="${REPO_ROOT}/poly_apps/laravel_main/storage/frankenphp"
FRANKENPHP_SITE_HOST="${FRANKENPHP_SITE_HOST:-}"
FRANKENPHP_SITE_PORT=""
FRANKENPHP_ADMIN_PORT=""
FRANKENPHP_LARAVEL_PUBLIC_DIR="${REPO_ROOT}/poly_apps/laravel_main/public"
FRANKENPHP_PREBUILT_VERSION="${FRANKENPHP_PREBUILT_VERSION:-latest}"
FRANKENPHP_INSTALL_MODE="${FRANKENPHP_INSTALL_MODE:-}"
FRANKENPHP_NO_MUTEX="false"

source "$SCRIPT_CURRENT_DIR/gvar_common.sh"
source "$SCRIPT_CURRENT_DIR/common_functions.sh"
source "$SCRIPT_CURRENT_DIR/step_state.sh"
source "$SCRIPT_CURRENT_DIR/service_contract_common.sh"
source "$SCRIPT_CURRENT_DIR/frankenphp_manager.sh"

FRANKENPHP_SITE_PORT="${FRANKENPHP_SITE_PORT:-$(sc_get ports.frankenphp_https)}"
FRANKENPHP_ADMIN_PORT="${FRANKENPHP_ADMIN_PORT:-$(sc_get ports.frankenphp_admin)}"
# Shared site-host resolver (manager single source; env FRANKENPHP_SITE_HOST wins).
FRANKENPHP_SITE_HOST="${FRANKENPHP_SITE_HOST:-$(fm_site_host)}"

NGINX_PLANE_DISABLE_SCRIPT="${SCRIPT_CURRENT_DIR}/nginx_plane_disable.sh"
CERTBOT_PLANE_DISABLE_SCRIPT="${SCRIPT_CURRENT_DIR}/certbot_plane_disable.sh"

frankenphp_install_pipeline_read_mode() {
    local arg=""
    local selected_mode=""
    local parsed_mode=""
    local tty_choice=""
    local version_input=""

    for arg in "$@"; do
        case "$arg" in
            --no-mutex)
                FRANKENPHP_NO_MUTEX="true"
                ;;
            --compile)
                FRANKENPHP_INSTALL_MODE="compile"
                ;;
            --prebuilt|--binary=prebuilt|--source=prebuilt)
                FRANKENPHP_INSTALL_MODE="prebuilt"
                ;;
            --prebuilt-version=*)
                FRANKENPHP_PREBUILT_VERSION="${arg#*=}"
                FRANKENPHP_INSTALL_MODE="prebuilt"
                ;;
            --mode=*)
                parsed_mode="${arg#*=}"
                case "$parsed_mode" in
                    compile|prebuilt)
                        FRANKENPHP_INSTALL_MODE="$parsed_mode"
                        ;;
                esac
                ;;
        esac
    done

    selected_mode="$FRANKENPHP_INSTALL_MODE"
    if [ -z "$selected_mode" ]; then
        if [ -t 0 ] && [ -r /dev/tty ]; then
            echo -n "[${FRANKENPHP_INSTALL_INDEX}] Use prebuilt FrankenPHP binary install? (Y/n): "
            read -r tty_choice < /dev/tty || tty_choice=""
        else
            tty_choice=""
        fi
        selected_mode="$(printf '%s' "$tty_choice" | tr '[:upper:]' '[:lower:]')"
        case "$selected_mode" in
            n|no)
                FRANKENPHP_INSTALL_MODE="compile"
                ;;
            y|yes|"")
                FRANKENPHP_INSTALL_MODE="prebuilt"
                ;;
            *)
                FRANKENPHP_INSTALL_MODE="compile"
                ;;
        esac
    fi

    if [ "$FRANKENPHP_INSTALL_MODE" = "prebuilt" ] && [ -t 0 ] && [ -r /dev/tty ]; then
        echo -n "[${FRANKENPHP_INSTALL_INDEX}] Use default prebuilt version ${FRANKENPHP_PREBUILT_VERSION:-latest}? (Y/n): "
        read -r tty_choice < /dev/tty || tty_choice=""
        selected_mode="$(printf '%s' "$tty_choice" | tr '[:upper:]' '[:lower:]')"
        if [ "$selected_mode" = "n" ] || [ "$selected_mode" = "no" ]; then
            echo -n "[${FRANKENPHP_INSTALL_INDEX}] Enter prebuilt version (e.g. latest or 1.12.7): "
            read -r version_input < /dev/tty || version_input=""
            if [ -n "$version_input" ]; then
                FRANKENPHP_PREBUILT_VERSION="$version_input"
            fi
        fi
    fi

    FRANKENPHP_INSTALL_MODE="${FRANKENPHP_INSTALL_MODE:-prebuilt}"
    export FRANKENPHP_INSTALL_MODE
    export FRANKENPHP_PREBUILT_VERSION
}

frankenphp_install_pipeline_planes() {
    if [ "$FRANKENPHP_NO_MUTEX" != "true" ]; then
        bash "$NGINX_PLANE_DISABLE_SCRIPT"
        bash "$CERTBOT_PLANE_DISABLE_SCRIPT"
        set_web_server_plane "frankenphp"
    else
        echo "[$FRANKENPHP_INSTALL_INDEX] [WARN] --no-mutex: nginx/certbot left untouched; manage the plane manually"
    fi
}

frankenphp_install_pipeline_run_binary() {
    # Idempotent unlink first: retire any live frankenphp units so the central
    # binary can be replaced safely; caches and build intermediates are
    # intentionally kept (replace-only semantics).
    fm_unlink_frankenphp_runtime
    # Variant record (single writer): the dispatch intent itself - the
    # selected packaging strategy owns the plane from here on.
    if [ "$FRANKENPHP_INSTALL_MODE" = "prebuilt" ]; then
        fm_variant_set prebuilt
        source "$SCRIPT_CURRENT_DIR/frankenphp_install_prebuilt.sh"
        frankenphp_install_prebuilt
        return
    fi

    fm_variant_set compiled
    source "$SCRIPT_CURRENT_DIR/frankenphp_install_compile.sh"
    frankenphp_install_compile
}

frankenphp_install_pipeline_run_caddyfile() {
    # Direct self-probing call: fm_caddyfile_ensure compares rendered content
    # every run (no stale step-state layer can hide a deleted Caddyfile).
    fm_caddyfile_ensure \
        "$FRANKENPHP_LARAVEL_PUBLIC_DIR" \
        "$FRANKENPHP_SITE_HOST" \
        "$FRANKENPHP_SITE_PORT" \
        "$FRANKENPHP_ADMIN_PORT" \
        "${FRANKENPHP_CADDYFILE_DIR}/Caddyfile"
}

frankenphp_install_pipeline_finalize() {
    fm_store_info
    fm_verify
}

frankenphp_install_pipeline() {
    local start_web_server=""

    start_web_server="$(get_global_var "START_WEB_SERVER" "frankenphp")"
    if [ "$start_web_server" != "frankenphp" ]; then
        echo "[$FRANKENPHP_INSTALL_INDEX] SKIP: START_WEB_SERVER=${start_web_server} (nginx plane active); frankenphp not installed"
        return 0
    fi

    frankenphp_install_pipeline_read_mode "$@"

    echo "[$FRANKENPHP_INSTALL_INDEX] FrankenPHP Installation Script (Mercure plane, HTTP/3 ready)"
    echo "[$FRANKENPHP_INSTALL_INDEX] Web server choice: $start_web_server | mode: ${FRANKENPHP_INSTALL_MODE:-prebuilt} | no-mutex: ${FRANKENPHP_NO_MUTEX:-false}"

    frankenphp_install_pipeline_planes
    frankenphp_install_pipeline_run_binary
    frankenphp_install_pipeline_run_caddyfile
    frankenphp_install_pipeline_finalize

    echo "[$FRANKENPHP_INSTALL_INDEX] =============================================="
    echo "[$FRANKENPHP_INSTALL_INDEX] FRANKENPHP PLANE READY: $(fm_version)"
    echo "[$FRANKENPHP_INSTALL_INDEX] Caddyfile: ${FRANKENPHP_CADDYFILE_DIR}/Caddyfile (Mercure hub: /.well-known/mercure on :${FRANKENPHP_SITE_PORT})"
    echo "[$FRANKENPHP_INSTALL_INDEX] Runtime entry: 175_laravel_main_start.sh (frankenphp branch)"
    echo "[$FRANKENPHP_INSTALL_INDEX] =============================================="
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    frankenphp_install_pipeline "$@"
fi
