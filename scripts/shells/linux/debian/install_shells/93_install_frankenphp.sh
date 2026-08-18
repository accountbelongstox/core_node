#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# FrankenPHP installation step (dd.sh chain). STEP-GRANULAR ORCHESTRATOR:
# every primitive lives in the shared management architecture
# (scripts/shells/linux/common/frankenphp_manager.sh); nothing is duplicated
# here. Installs the plane: binary + dnspod ACME module + canonical
# Caddyfile (Mercure hub on 443/h3) + plane constants.
#
# PLANE MUTUAL EXCLUSION (default ON, `--no-mutex` to skip): nginx and
# certbot are DISABLED via their common-area plane-disable companions -
# services stopped and state recorded only, packages/configs/certificates
# preserved. Re-running 33_install_nginx.sh restores the nginx plane (and
# disables this one) symmetrically.
#
# PREREQUISITE ORDERING: this step runs AFTER the PHP toolchain (43/45/47 -
# apt php8.5-dev provides php-config for native xcaddy builds) and AFTER
# 91_install_golang.sh (converges $GO_DIR to the pinned go >= 1.26 toolchain
# the dnspod rebuild needs). Renumbered 49 -> 93 for that ordering.
#
# The octane:frankenphp RUNTIME itself is started by the 132 frankenphp
# branch (or the plane-aware laravel service); this step installs and
# verifies the plane only. The merged selector constant START_WEB_SERVER
# (frankenphp | nginx, default frankenphp) is the single web-server choice
# every entry point reads - the plane constant it adopts here.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="93"
FRANKENPHP_STEP_NAMESPACE="93_install_frankenphp"
REPO_ROOT="$(dirname "$(dirname "$PARENT_DIR_LEVEL_2")")"
LARAVEL_MAIN_PUBLIC_DIR="${REPO_ROOT}/poly_apps/laravel_main/public"
FRANKENPHP_CADDYFILE_DIR="${REPO_ROOT}/poly_apps/laravel_main/storage/frankenphp"
FRANKENPHP_SITE_HOST="${FRANKENPHP_SITE_HOST:-localhost}"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/step_state.sh"
# shellcheck source=/dev/null
source "$PARENT_DIR_LEVEL_2/common/frankenphp_manager.sh"
# shellcheck source=/dev/null
source "$PARENT_DIR_LEVEL_2/common/service_contract_common.sh"

NGINX_PLANE_DISABLE_SCRIPT="${PARENT_DIR_LEVEL_2}/common/nginx_plane_disable.sh"
CERTBOT_PLANE_DISABLE_SCRIPT="${PARENT_DIR_LEVEL_2}/common/certbot_plane_disable.sh"
MUTEX_SKIP="false"
START_WEB_SERVER=""

for frankenphp_arg in "$@"; do
    case "$frankenphp_arg" in
        --no-mutex) MUTEX_SKIP="true" ;;
    esac
done

START_WEB_SERVER=""
START_WEB_SERVER=$(get_global_var "START_WEB_SERVER" "frankenphp")

# Plane skip (DESIGN_20260817_2115 PART_0 P0-A3): the frankenphp plane is
# the default; when nginx is the selected web server this step logs the
# skip and installs/adopts nothing (26 restores that plane).
if [ "$START_WEB_SERVER" != "frankenphp" ]; then
    echo "[$SCRIPT_INDEX] SKIP: START_WEB_SERVER=${START_WEB_SERVER} (nginx plane active); frankenphp not installed"
    exit 0
fi

echo "[$SCRIPT_INDEX] FrankenPHP Installation Script (Mercure plane, HTTP/3 ready)"
echo "[$SCRIPT_INDEX] Web server choice: $START_WEB_SERVER | mutex: $([ "$MUTEX_SKIP" = "true" ] && echo skipped || echo on)"

# STEP 1: plane mutual exclusion + plane constant adoption
if [ "$MUTEX_SKIP" != "true" ]; then
    bash "$NGINX_PLANE_DISABLE_SCRIPT"
    bash "$CERTBOT_PLANE_DISABLE_SCRIPT"
    set_web_server_plane "frankenphp"
else
    echo "[$SCRIPT_INDEX] [WARN] --no-mutex: nginx/certbot left untouched; manage the plane manually"
fi

# STEP 2: binary convergence - each probe independent and idempotent:
# usable binary -> no download (compile also skipped later); missing
# canonical link -> link only; canonical php/php-cli shims -> untouched.
fm_install
fm_ensure_local_bin_link
fm_ensure_php_cli_shim

# STEP 3: DNSPod ACME DNS module (official static rebuild; early-returns
# with zero compile when the module is already embedded in the binary)
fm_ensure_dnspod_module || echo "[$SCRIPT_INDEX] [WARN] dnspod module deferred"

# STEP 4: canonical Caddyfile (content-hash idempotent; Mercure hub on 443)
step_run "$FRANKENPHP_STEP_NAMESPACE" "caddyfile" "v1" \
    fm_caddyfile_ensure \
    "$LARAVEL_MAIN_PUBLIC_DIR" \
    "$FRANKENPHP_SITE_HOST" \
    "$(sc_get ports.frankenphp_https)" \
    "$(sc_get ports.frankenphp_admin)" \
    "${FRANKENPHP_CADDYFILE_DIR}/Caddyfile"

# STEP 5: persist state for downstream consumers (ServerManager, 132)
fm_store_info

# STEP 6: verification (informational)
fm_verify

echo "[$SCRIPT_INDEX] =============================================="
echo "[$SCRIPT_INDEX] FRANKENPHP PLANE READY: $(fm_version)"
echo "[$SCRIPT_INDEX] Caddyfile: ${FRANKENPHP_CADDYFILE_DIR}/Caddyfile (Mercure hub: /.well-known/mercure on :$(sc_get ports.frankenphp_https))"
echo "[$SCRIPT_INDEX] Runtime entry: 175_laravel_main_start.sh (frankenphp branch) or the plane-aware laravel service"
echo "[$SCRIPT_INDEX] Management CLI: $PARENT_DIR_LEVEL_2/common/frankenphp_manager.sh"
echo "[$SCRIPT_INDEX] =============================================="
