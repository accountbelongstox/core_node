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

# FrankenPHP Manager (common area; the frankenphp-plane analog of
# nginx_manager.sh). Every primitive is idempotent and self-probing with
# STRING contracts only ("yes"/"no"/path/"" - functions never signal via
# exit codes; callers trust the run result and re-probe files):
#   fm_get_binary / fm_binary_usable / fm_version   binary file probes
#   fm_version_tag_of / fm_version_tag              frankenphp release tag
#   fm_list_modules / fm_has_module                  embedded Caddy modules
#   fm_embedded_extension_loaded                     embedded PHP extension
#   fm_binary_compile_complete                       module + extension floor
#   fm_variant / fm_variant_set                      variant record
#   fm_variant_ready                                 candidate readiness probe
#   fm_runtime_contract_ready                        committed owner probe
#   fm_variant_commit                                atomic owner convergence
#   fm_compile_baseline_ensure                       build bootstrap ensure
#   fm_ensure_dnspod_module                          compile-variant convergence
#   fm_dnspod_candidate_install                      staged candidate install
#   fm_caddyfile_ensure                              canonical Caddyfile render
#   fm_store_info / fm_verify                        state + verification
#
# VARIANT MODEL: one packaging strategy owns the plane at a time:
#   apt      = official deb packages at /usr/bin with php-zts extensions
#   compiled = official build-static.sh binaries (runtime/compiled) with
#              the dnspod DNS-01 module embedded (93 --compile intent)
#   prebuilt = GitHub release binaries (runtime/prebuilt) + acme.sh DNS-01
#              (93 --prebuilt intent)
# The record (FRANKENPHP_VARIANT global var) is written ONLY by the 93
# pipeline dispatch and the manual `dnspod` CLI (explicit intent);
# fm_variant falls back to canonical-link inference for unrecorded hosts.
# The selected variant is authoritative at runtime. Retained payloads from
# other variants are build inputs or rollback artifacts, never runtime
# fallbacks.
#
# PLANE MODEL (DESIGN_20260817_2115 PART_0): one octane:frankenphp process
# on 443 (h2/h3) with the built-in Mercure hub; nginx/certbot are disabled
# (NOT uninstalled) via their plane-disable companions. The plane constant
# is the shared web_server_plane() in gvar_common.sh.
#
# SECRETS: the Mercure HS256 publisher and subscriber keys are read from the
# RuntimeConfigurationStore and embedded as LITERAL publisher_jwt /
# subscriber_jwt values (official flat syntax of the embedded
# mercure/caddy module v0.24.x) - the 0600 Caddyfile is the only on-disk
# copy next to the store itself; no process env, no .env. The keys are
# provisioned (never rotated) by the laravel_main provisioner
# (RelayHubKeyProvisioner) through the runtime_config_common adapter.
#
# SYNC CONTRACT: Caddyfile/mercure semantics are shared with the Laravel end
# (ServerManagerV1FrankenPhpCaddyfileBuilder); change both ends together.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_INDEX="${SCRIPT_INDEX:-frankenphp-mgr}"
FRANKENPHP_RUNTIME_COMMON_SCRIPT="$SCRIPT_CURRENT_DIR/frankenphp_runtime_common.sh"

source "$SCRIPT_CURRENT_DIR/gvar_common.sh"
# shellcheck source=/dev/null
source "$SCRIPT_CURRENT_DIR/service_contract_common.sh"
# shellcheck source=/dev/null
source "$SCRIPT_CURRENT_DIR/web_access_common.sh"
# shellcheck source=/dev/null
source "$SCRIPT_CURRENT_DIR/frankenphp_install_modes.sh"
# shellcheck source=/dev/null
source "$SCRIPT_CURRENT_DIR/frankenphp_static_builder.sh"
source "$FRANKENPHP_RUNTIME_COMMON_SCRIPT"

FRANKENPHP_LINK_PATH="/usr/local/bin/frankenphp"
FRANKENPHP_INSTALL_URL="https://frankenphp.dev/install.sh"
FRANKENPHP_VARIANT_KEY="FRANKENPHP_VARIANT"
# Pin rationale: the newest caddy-dns/dnspod TAG (v0.0.4, 2022) still
# targets libdns v0, which no longer compiles against the libdns v1 API
# required by Caddy v2.11.4 (frankenphp v1.12.7); the master-branch
# rewrite implements the libdns v1 interfaces. Drop "@master" once a
# libdns-v1 tag is released.
FRANKENPHP_DNSPOD_IMPORT="github.com/caddy-dns/dnspod@master"
FRANKENPHP_DNSPOD_MODULE="dns.providers.dnspod"
FRANKENPHP_DNSPOD_TOKEN_KEY="DNSPOD_TOKEN"
# Secret-file keys (.secret_keys/.secret_ignore via the common_functions
# reader): the DNSPod API token "id,token" + the ACME account email -
# shared by the compiled variant (Caddy dns provider) and the prebuilt
# variant (acme.sh dns_dp DNS-01).
FRANKENPHP_DNSPOD_TOKEN_SECRET_KEY="DNS_DNSPOD_API_TOKENS"
FRANKENPHP_DNSPOD_EMAIL_SECRET_KEY="DNSPOD_EMAILS"
FRANKENPHP_FRANKENPHP_IMPORT="github.com/dunglas/frankenphp"
# Mercure hub module version follows the central runtime contract.
FRANKENPHP_MERCURE_VERSION="$(sc_require versions.mercure)"
PHP_RUNTIME_UPLOAD_MAX_FILESIZE="$(sc_require php_runtime.upload_max_filesize)"
PHP_RUNTIME_POST_MAX_SIZE="$(sc_require php_runtime.post_max_size)"
PHP_RUNTIME_MAX_EXECUTION_TIME="$(sc_require php_runtime.max_execution_time_seconds)"
PHP_RUNTIME_MAX_INPUT_TIME="$(sc_require php_runtime.max_input_time_seconds)"
FRANKENPHP_REQUEST_BODY_TIMEOUT="$(sc_require php_runtime.request_body_timeout)"
# Official static-build xcaddy args (frankenphp.dev/docs/static): a custom
# XCADDY_ARGS must re-include the modules the Caddyfile relies on - the
# mercure hub directive and the official build's vulcain + cbrotli set -
# plus the dnspod DNS-01 provider.
FRANKENPHP_STATIC_XCADDY_ARGS="--with ${FRANKENPHP_DNSPOD_IMPORT} --with github.com/dunglas/mercure/caddy@${FRANKENPHP_MERCURE_VERSION} --with github.com/dunglas/vulcain/caddy --with github.com/dunglas/caddy-cbrotli"
FRANKENPHP_STATIC_REPO="https://github.com/php/frankenphp"
FRANKENPHP_BACKUP_SUFFIX=".pre-dnspod"
FRANKENPHP_PHP_SHIM_DIR="/usr/local/bin"
FRANKENPHP_PHP_SHIM_PATH="${FRANKENPHP_PHP_SHIM_DIR}/php"
FRANKENPHP_PHP_CLI_SHIM_PATH="${FRANKENPHP_PHP_SHIM_DIR}/php-cli"
FRANKENPHP_COMPOSER_RUNTIME_SHIM="${FRANKENPHP_PHP_SHIM_DIR}/composer-php-runtime"
FRANKENPHP_PHP_RUNTIME_SUBCMD="php-cli"
FRANKENPHP_PHP_INI_DIR="/etc/frankenphp/php-conf.d"
FRANKENPHP_PHP_INI_SCAN_PATH=":${FRANKENPHP_PHP_INI_DIR}"
FRANKENPHP_APT_BINARY_PATH="/usr/bin/frankenphp"
FRANKENPHP_BIN_CANDIDATES="${FRANKENPHP_COMPILED_BINARY_PATH} ${FRANKENPHP_PREBUILT_BINARY_PATH} ${FRANKENPHP_APT_BINARY_PATH}"
FRANKENPHP_RUNTIME_REQUIRED_PHP_EXTENSIONS=("pdo" "pdo_pgsql" "phar" "simplexml" "pcntl")
FM_RUNTIME_BINARY=""
FM_MERCURE_STANZA=""
FM_OCTANE_PHP_SERVER_STANZA=""
FM_CADDYFILE_RENDERED=""
FM_CADDYFILE_READY="no"


# Persist state for downstream consumers (Laravel ServerManager, 132).
fm_store_info() {
    local binary=""
    binary="$(fm_get_binary)"
    if [ -n "$binary" ]; then
        set_global_var FRANKENPHP_BINARY_PATH "$binary" 'false'
    fi
    set_global_var FRANKENPHP_HTTPS_PORT "$(sc_get ports.frankenphp_https)" 'false'
    set_global_var FRANKENPHP_ADMIN_PORT "$(sc_get ports.frankenphp_admin)" 'false'
}

# DNS-01 readiness summary (booleans only - never the token value).
fm_dns01_status() {
    local dns01_mode=""
    local variant=""

    variant="$(fm_variant)"
    dns01_mode="$(fm_variant_dns01_mode "$variant")"
    case "$dns01_mode" in
        "$FRANKENPHP_DNS01_MODE_ACME_SH")
            echo "acme.sh dns_dp pre-flight (${variant} variant; embedded module not applicable)"
            return
            ;;
    esac
    if [ "$(fm_has_module "$FRANKENPHP_DNSPOD_MODULE")" != "yes" ]; then
        echo "module missing (run: frankenphp_manager.sh dnspod)"
        return
    fi
    if [ -z "$(fm_dnspod_token_value)" ]; then
        echo "module embedded, token not set (built-in ACME active)"
        return
    fi
    echo "ready (module embedded + token stored)"
}

# Certificate readiness summary for the service-start log: module/token/
# account-email booleans plus the per-apex prebuilt cert state (presence
# and the 30-day expiry window). Secrets never print - booleans and file
# state only. Args: 1 site_host 2 routes_dir
fm_cert_status() {
    local site_host="$1"
    local routes_dir="$2"
    local prefix=""
    local apex=""
    local route_file=""
    local cert_dir=""
    local state=""
    local apex_list=""
    local dns01_mode=""
    local variant=""

    [ -n "$site_host" ] || site_host="localhost"
    prefix="${DOMAIN_API_PREFIX:-}"
    if [ -z "$prefix" ]; then
        prefix="$(get_global_var "DOMAIN_API_REGION_PREFIX" "")"
    fi

    echo "[$SCRIPT_INDEX] Certificate readiness (booleans only):"
    variant="$(fm_variant)"
    dns01_mode="$(fm_variant_dns01_mode "$variant")"
    if [ "$dns01_mode" = "$FRANKENPHP_DNS01_MODE_ACME_SH" ]; then
        echo "  - dnspod module: not applicable (${variant} variant; acme.sh DNS-01 path)"
    elif [ "$(fm_has_module "$FRANKENPHP_DNSPOD_MODULE")" = "yes" ]; then
        echo "  - dnspod module: embedded (fallback path)"
    else
        echo "  - dnspod module: missing"
    fi
    if [ -n "$(fm_dnspod_token_value)" ]; then
        echo "  - dnspod token: stored (id,token)"
    else
        echo "  - dnspod token: absent"
    fi
    if [ -n "$(get_secret_key_from_common_functions "$FRANKENPHP_DNSPOD_EMAIL_SECRET_KEY" 2>/dev/null)" ]; then
        echo "  - ACME account email: stored"
    else
        echo "  - ACME account email: absent"
    fi

    apex_list=" "
    if [ "$site_host" != "localhost" ]; then
        apex="${site_host#api.${prefix}.}"
        if [ -n "$apex" ] && [ "$apex" != "localhost" ]; then
            apex_list="${apex_list}${apex} "
        fi
    fi
    if [ -n "$routes_dir" ] && [ -d "$routes_dir" ]; then
        for route_file in "$routes_dir"/*.caddy; do
            [ -f "$route_file" ] || continue
            apex="$(basename "$route_file" .caddy)"
            case "$apex_list" in *" $apex "*) continue ;; esac
            apex_list="${apex_list}${apex} "
        done
    fi
    for apex in $apex_list; do
        cert_dir="${FRANKENPHP_ACME_CERT_DIR}/${apex}"
        state="missing"
        if [ -f "${cert_dir}/fullchain.pem" ] && [ -f "${cert_dir}/key.pem" ]; then
            state="present"
            if ! openssl x509 -checkend 2592000 -noout -in "${cert_dir}/fullchain.pem" >/dev/null 2>&1; then
                state="present, renewal due (<30d left)"
            fi
        fi
        echo "  - prebuilt cert ${apex}: ${state} (${cert_dir})"
    done
    echo "  - caddy data dir: ${XDG_DATA_HOME:-/root/.local/share}/caddy"
    if [ -n "$variant" ]; then
        echo "  - frankenphp variant: ${variant} (DNS-01 owner: ${dns01_mode})"
    else
        echo "  - frankenphp variant: unrecorded (fm_variant inference fallback)"
    fi
    if [ -x /usr/local/bin/acme.sh ] || [ -x "${FRANKENPHP_ACME_DIR}/home/acme.sh" ]; then
        echo "  - acme.sh: installed (${FRANKENPHP_ACME_DIR}/home)"
    else
        echo "  - acme.sh: not installed yet (bootstrap runs at the next pre-flight)"
    fi
    if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
        echo "  - renewal timer: $(systemctl is-active ncore-acme-cert.timer 2>/dev/null || echo inactive) / enabled: $(systemctl is-enabled ncore-acme-cert.timer 2>/dev/null || echo no)"
    fi
}

# Idempotent DNS-01 certificate readiness (compile variant): converge the
# module + the token pair. The certificate itself is issued and renewed by
# Caddy ACME at every octane start once both hold; the token is the only
# manual credential and is normally seeded from the secret file.
fm_dns01_ensure() {
    local dns01_mode=""
    local variant=""

    variant="$(fm_variant)"
    dns01_mode="$(fm_variant_dns01_mode "$variant")"
    case "$dns01_mode" in
        "$FRANKENPHP_DNS01_MODE_ACME_SH")
            fm_dnspod_token_ensure
            echo "[$SCRIPT_INDEX] DNS-01: acme.sh dns_dp pre-flight owns issuance/renewal (${variant} variant)"
            return
            ;;
    esac
    fm_dnspod_token_ensure
    if [ "$(fm_has_module "$FRANKENPHP_DNSPOD_MODULE")" != "yes" ]; then
        echo "[$SCRIPT_INDEX] DNS-01 deferred: dnspod module not embedded yet (built-in HTTP-01/TLS-ALPN-01 stays active)"
        return
    fi
    if [ -z "$(fm_dnspod_token_value)" ]; then
        echo "[$SCRIPT_INDEX] DNS-01 pending: DNSPod API token not stored; add it once via"
        echo "[$SCRIPT_INDEX]   $0 dnspod-token '<id,token>'   (or the ${FRANKENPHP_DNSPOD_TOKEN_SECRET_KEY} secret file)"
        return
    fi
    echo "[$SCRIPT_INDEX] DNS-01 ready: dnspod module embedded + token stored (wildcard issues at next octane start)"
    return
}

fm_verify() {
    local binary=""
    local dns01_mode=""
    local variant=""

    binary="$(fm_get_binary)"
    if [ -z "$binary" ]; then
        echo "[$SCRIPT_INDEX] [VERIFY] frankenphp binary: MISSING"
        return
    fi
    echo "[$SCRIPT_INDEX] [VERIFY] binary: $binary ($(fm_version))"
    echo "[$SCRIPT_INDEX] [VERIFY] embedded PHP: $(fm_php_version)"
    echo "[$SCRIPT_INDEX] [VERIFY] PHP ini scan path: $(fm_php_ini_scan_path)"
    echo "[$SCRIPT_INDEX] [VERIFY] runtime PHP extensions: $(fm_php_runtime_extensions_ready "$binary")"
    variant="$(fm_variant)"
    dns01_mode="$(fm_variant_dns01_mode "$variant")"
    echo "[$SCRIPT_INDEX] [VERIFY] variant: ${variant}"
    if [ "$dns01_mode" = "$FRANKENPHP_DNS01_MODE_ACME_SH" ]; then
        echo "[$SCRIPT_INDEX] [VERIFY] dnspod module: not applicable (${variant} variant)"
        echo "[$SCRIPT_INDEX] [VERIFY] DNS-01: acme.sh dns_dp pre-flight owns issuance/renewal (prebuilt certs pinned via tls-file gate)"
    else
        echo "[$SCRIPT_INDEX] [VERIFY] dnspod module: $([ "$(fm_has_module "$FRANKENPHP_DNSPOD_MODULE")" = "yes" ] && echo embedded || echo missing)"
        echo "[$SCRIPT_INDEX] [VERIFY] DNS-01 (dnspod): $(fm_dns01_status)"
    fi
    echo "[$SCRIPT_INDEX] [VERIFY] php-cli shim: $([ -x "${FRANKENPHP_PHP_SHIM_DIR}/php" ] && echo present || echo missing)"
    echo "[$SCRIPT_INDEX] [VERIFY] plane: $(web_server_plane)"
}

# Management CLI:
#   verify | status | dnspod | caddyfile <public_dir> <host> <https> <admin> <path>
if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    case "${1:-verify}" in
        dnspod)
            fm_ensure_dnspod_module
            if [ "$(fm_variant_ready "$FRANKENPHP_INSTALL_MODE_COMPILE")" = "yes" ]; then
                fm_variant_commit "$FRANKENPHP_INSTALL_MODE_COMPILE"
            fi
            if [ "$(fm_runtime_contract_ready "$FRANKENPHP_INSTALL_MODE_COMPILE")" = "yes" ]; then
                fm_store_info
            fi
            ;;
        dnspod-token)
            if [ -z "${2:-}" ]; then
                echo "usage: $0 dnspod-token '<id,token>'"
            else
                fm_dnspod_token_put "$2"
            fi
            ;;
        caddyfile)
            shift
            fm_caddyfile_ensure "$@"
            ;;
        status|verify|*)
            fm_verify
            ;;
    esac
fi
