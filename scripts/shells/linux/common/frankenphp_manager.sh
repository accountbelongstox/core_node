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
#   fm_install                                       baseline binary ensure
#   fm_ensure_dnspod_module                          compile-variant convergence
#   fm_dnspod_candidate_install                      staged candidate install
#   fm_caddyfile_ensure                              canonical Caddyfile render
#   fm_store_info / fm_verify                        state + verification
#
# VARIANT MODEL: one packaging strategy owns the plane at a time:
#   compiled = official build-static.sh binaries (runtime/compiled) with
#              the dnspod DNS-01 module embedded (93 --compile intent)
#   prebuilt = GitHub release binaries (runtime/prebuilt) + acme.sh DNS-01
#              (93 --prebuilt intent)
# The record (FRANKENPHP_VARIANT global var) is written ONLY by the 93
# pipeline dispatch and the manual `dnspod` CLI (explicit intent);
# fm_variant falls back to canonical-link inference for unrecorded hosts.
# A baseline binary (official installer deb at /usr/bin/frankenphp) is a
# shared version-pin/fallback source - it is never a variant itself.
#
# PLANE MODEL (DESIGN_20260817_2115 PART_0): one octane:frankenphp process
# on 443 (h2/h3) with the built-in Mercure hub; nginx/certbot are disabled
# (NOT uninstalled) via their plane-disable companions. The plane constant
# is the shared web_server_plane() in gvar_common.sh.
#
# SECRETS: the Caddyfile carries ONLY {$ENV} placeholders for the Mercure
# JWT keys - actual values are injected as process env by the runtime
# (132 frankenphp branch) from the RuntimeConfigurationStore; they never
# live in the Caddyfile.
#
# SYNC CONTRACT: Caddyfile/mercure semantics are shared with the Laravel end
# (ServerManagerV1FrankenPhpManagerCtl); change both ends together.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_INDEX="frankenphp-mgr"

source "$SCRIPT_CURRENT_DIR/gvar_common.sh"
# shellcheck source=/dev/null
source "$SCRIPT_CURRENT_DIR/service_contract_common.sh"
# shellcheck source=/dev/null
source "$SCRIPT_CURRENT_DIR/frankenphp_static_builder.sh"

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
# Mercure hub module version, matched to the release frankenphp v1.12.7
# pins in its own go.mod (v0.24.2) so a rebuild never drags in a newer
# hub major behind the running binary's back.
FRANKENPHP_MERCURE_VERSION="v0.24.2"
# Official static-build xcaddy args (frankenphp.dev/docs/static): a custom
# XCADDY_ARGS must re-include the modules the Caddyfile relies on - the
# mercure hub directive and the official build's vulcain + cbrotli set -
# plus the dnspod DNS-01 provider.
FRANKENPHP_STATIC_XCADDY_ARGS="--with ${FRANKENPHP_DNSPOD_IMPORT} --with github.com/dunglas/mercure/caddy --with github.com/dunglas/vulcain/caddy --with github.com/dunglas/caddy-cbrotli"
FRANKENPHP_STATIC_REPO="https://github.com/php/frankenphp"
FRANKENPHP_BACKUP_SUFFIX=".pre-dnspod"
FRANKENPHP_PHP_SHIM_DIR="/usr/local/bin"
FRANKENPHP_PHP_SHIM_PATH="${FRANKENPHP_PHP_SHIM_DIR}/php"
FRANKENPHP_PHP_CLI_SHIM_PATH="${FRANKENPHP_PHP_SHIM_DIR}/php-cli"
FRANKENPHP_COMPOSER_RUNTIME_SHIM="${FRANKENPHP_PHP_SHIM_DIR}/composer-php-runtime"
FRANKENPHP_PHP_RUNTIME_SUBCMD="php-cli"
FRANKENPHP_PHP_INI_DIR="/etc/frankenphp/php-conf.d"
FRANKENPHP_BIN_CANDIDATES="${FRANKENPHP_COMPILED_BINARY_PATH} ${FRANKENPHP_PREBUILT_BINARY_PATH} /usr/bin/frankenphp"

# Resolve one binary path to its real executable target.
fm_resolve_binary_path() {
    local candidate=""
    local resolved=""

    candidate="$1"
    if [ -z "$candidate" ]; then
        echo ""
        return 0
    fi
    resolved="$(readlink -f "$candidate" 2>/dev/null || true)"
    if [ -n "$resolved" ] && [ -x "$resolved" ]; then
        echo "$resolved"
        return 0
    fi
    if [ -x "$candidate" ]; then
        echo "$candidate"
        return 0
    fi
    echo ""
}

# Binary path (empty string when absent) - real executable target from the
# canonical link first, then strategy-specific binaries, then /usr/bin.
fm_get_binary() {
    local candidate=""

    candidate="$(fm_resolve_binary_path "$FRANKENPHP_LINK_PATH")"
    if [ -n "$candidate" ]; then
        echo "$candidate"
        return 0
    fi
    for candidate in $FRANKENPHP_BIN_CANDIDATES; do
        candidate="$(fm_resolve_binary_path "$candidate")"
        if [ -n "$candidate" ]; then
            echo "$candidate"
            return 0
        fi
    done
    echo ""
}

# Ensure the canonical /usr/local/bin link (PATH precedence over
# /usr/bin): an INDEPENDENT fine-grained step - it runs on every ensure
# pass, not only after a fresh download, so a usable binary discovered
# elsewhere gets linked without compiling anything. No-op when the
# canonical path is already the binary itself or a link resolving to it.
fm_ensure_local_bin_link() {
    local binary=""
    local canonical_target=""

    binary="$(fm_resolve_binary_path "${1:-$(fm_get_binary)}")"
    if [ -z "$binary" ]; then
        echo "[$SCRIPT_INDEX] [WARN] no frankenphp binary; ${FRANKENPHP_LINK_PATH} link not created"
        return 0
    fi
    canonical_target="$(fm_resolve_binary_path "$FRANKENPHP_LINK_PATH")"
    if [ -n "$canonical_target" ] && [ "$canonical_target" = "$binary" ]; then
        return 0
    fi
    $USE_SUDO ln -sf "$binary" "$FRANKENPHP_LINK_PATH"
    echo "[$SCRIPT_INDEX] linked ${FRANKENPHP_LINK_PATH} -> ${binary}"
    return 0
}

# Health probe for one candidate binary (string contract: yes/no) - the
# file must exist, be executable and answer its embedded `version`
# command. This is the ONLY usability gate; presence alone is not enough.
fm_binary_usable() {
    local candidate="$1"

    if [ -n "$candidate" ] && [ -x "$candidate" ] \
        && "$candidate" version >/dev/null 2>&1; then
        echo "yes"
    else
        echo "no"
    fi
}

# Active variant (string contract: compiled|prebuilt|""). Record first, then
# canonical-link inference (compiled/prebuilt path targets). Empty when
# unrecorded AND the link points elsewhere (baseline deb or nothing) -
# such a host never surprises a service start with a static build.
fm_variant() {
    local variant=""
    local resolved=""

    variant="$(get_global_var "$FRANKENPHP_VARIANT_KEY" "")"
    case "$variant" in
        compiled|prebuilt) echo "$variant" ;;
        *)
            resolved="$(fm_resolve_binary_path "$FRANKENPHP_LINK_PATH")"
            if [ -n "$resolved" ] \
                && [ "$resolved" = "$(fm_resolve_binary_path "$FRANKENPHP_COMPILED_BINARY_PATH")" ]; then
                echo "compiled"
            elif [ -n "$resolved" ] \
                && [ "$resolved" = "$(fm_resolve_binary_path "$FRANKENPHP_PREBUILT_BINARY_PATH")" ]; then
                echo "prebuilt"
            else
                echo ""
            fi
            ;;
    esac
}

# Record the plane-owning variant (single writer: the 93 pipeline dispatch
# and the manual `dnspod` CLI; silent, idempotent).
fm_variant_set() {
    case "$1" in
        compiled|prebuilt) set_global_var "$FRANKENPHP_VARIANT_KEY" "$1" 'false' ;;
    esac
}

fm_version() {
    local binary=""
    binary="$(fm_get_binary)"
    if [ -n "$binary" ]; then
        "$binary" version 2>/dev/null
    fi
}

# Embedded PHP version ("8.5"); empty when the binary is absent. The
# frankenphp plane's ONLY PHP runtime (no apt PHP).
fm_php_version() {
    local binary=""
    local tmp=""
    binary="$(fm_get_binary)"
    if [ -n "$binary" ]; then
        # File mode only: the static php-cli runner accepts neither -r nor -v.
        tmp="$(mktemp "${TMPDIR:-/tmp}/fm_php_ver.XXXXXX.php")"
        printf '<?php echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;' > "$tmp"
        "$binary" php-cli "$tmp" 2>/dev/null
        rm -f "$tmp"
    fi
}

# Ensure the `php` / `php-cli` command shims route to the embedded PHP
# (frankenphp plane PHP runtime; file-probe idempotent - a shim already
# execing this binary stays untouched). /usr/local/bin precedes /usr/bin
# in PATH, so the shim is the effective `php` even if an apt PHP lingers.
fm_ensure_php_cli_shim() {
    local binary=""
    local shim=""
    local wanted=""
    local existing=""

    binary="$(fm_get_binary)"
    if [ -z "$binary" ]; then
        echo "[$SCRIPT_INDEX] [WARN] no frankenphp binary; php-cli shim not created (run fm_install first)"
        return 0
    fi
    for shim in php php-cli; do
        wanted="#!/usr/bin/env bash
args=()
while [ \"\$#\" -gt 0 ]; do
    case \"\$1\" in
        --)
            shift
            ;;
        -d)
            shift
            if [ \"\$#\" -gt 0 ]; then
                shift
            fi
            ;;
        -d*)
            shift
            ;;
        *)
            args+=(\"\$1\")
            shift
            ;;
    esac
done

exec ${binary} php-cli \"\${args[@]}\"
"
        existing=""
        if [ -f "${FRANKENPHP_PHP_SHIM_DIR}/${shim}" ]; then
            # Only read if it's a small file (likely our shim) to avoid null byte warnings from binaries
            local size=$(wc -c < "${FRANKENPHP_PHP_SHIM_DIR}/${shim}" 2>/dev/null || echo 0)
            if [ "$size" -lt 1000 ]; then
                existing="$(cat "${FRANKENPHP_PHP_SHIM_DIR}/${shim}" 2>/dev/null | tr -d '\0')"
            fi
        fi
        if [ "$existing" = "$wanted" ]; then
            continue
        fi
        local tmp_shim="${FRANKENPHP_PHP_SHIM_DIR}/.${shim}.tmp.$$"
        printf '%s\n' "$wanted" > "$tmp_shim"
        chmod 755 "$tmp_shim"
        mv -f "$tmp_shim" "${FRANKENPHP_PHP_SHIM_DIR}/${shim}"
        echo "[$SCRIPT_INDEX] php-cli shim installed: ${FRANKENPHP_PHP_SHIM_DIR}/${shim} -> ${binary} php-cli"
    done
}

# Caddyfile-adjacent PHP ini directory (frankenphp plane config target for
# 96_configure_php85.sh; the runtime exports it as PHP_INI_SCAN_DIR).
fm_php_ini_dir() {
    echo "$FRANKENPHP_PHP_INI_DIR"
}

# Ensure the ini scan directory exists with the canonical memory/time
# overrides (idempotent content render, mirrors the system-plane ini).
fm_php_ini_ensure() {
    local ini_dir=""
    local rendered=""
    local existing=""

    ini_dir="$(fm_php_ini_dir)"
    mkdir -p "$ini_dir"
    rendered="; Managed by frankenphp_manager.sh (frankenphp plane PHP ini)
memory_limit = 512M
upload_max_filesize = 64M
post_max_size = 64M
max_execution_time = 300
opcache.enable_cli = 1
"
    existing=""
    [ -f "${ini_dir}/99-core-node.ini" ] && existing="$(cat "${ini_dir}/99-core-node.ini")"
    if [ "$existing" = "$rendered" ]; then
        echo "[$SCRIPT_INDEX] PHP ini already canonical: ${ini_dir}/99-core-node.ini"
        return 0
    fi
    printf '%s\n' "$rendered" > "${ini_dir}/99-core-node.ini"
    echo "[$SCRIPT_INDEX] PHP ini rendered: ${ini_dir}/99-core-node.ini"
}

# Baseline binary ensure - the frankenphp plane needs ONE usable binary
# (any variant) before anything else can converge. Fine-grained probes,
# each an independent step:
#   1) compiled-variant binary usable -> link ensure, done
#   2) ANY candidate usable (link/prebuilt/deb) -> link ensure, done
#      (the official installer never runs when a baseline already exists)
#   3) nothing usable -> official installer bootstrap, then re-probe by
#      FILE state only (on debian/ubuntu/kali it installs the static-php
#      deb - the binary is /usr/bin/frankenphp, NEVER a cwd file)
#   4) the deb-enabled frankenphp.service gets retired right after the
#      installer (the plane runtime is the 175-supervised octane process)
fm_install() {
    local binary=""
    local installed_version=""

    binary="$(fm_resolve_binary_path "$FRANKENPHP_COMPILED_BINARY_PATH")"
    if [ "$(fm_binary_usable "$binary")" = "yes" ]; then
        installed_version="$("$binary" version 2>/dev/null | sed -n '1p')"
        echo "[$SCRIPT_INDEX] frankenphp already installed: $binary (${installed_version})"
        fm_ensure_local_bin_link "$binary"
        return 0
    fi

    binary="$(fm_get_binary)"
    if [ "$(fm_binary_usable "$binary")" = "yes" ]; then
        installed_version="$("$binary" version 2>/dev/null | sed -n '1p')"
        echo "[$SCRIPT_INDEX] frankenphp baseline binary present: $binary (${installed_version})"
        fm_ensure_local_bin_link "$binary"
        return 0
    fi

    if ! command -v curl >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] [ERROR] curl is required for the frankenphp installer"
        return 0
    fi
    echo "[$SCRIPT_INDEX] Installing frankenphp (official installer)"
    curl -fsSL "$FRANKENPHP_INSTALL_URL" | $USE_SUDO sh
    binary="$(fm_get_binary)"
    if [ "$(fm_binary_usable "$binary")" = "yes" ]; then
        installed_version="$("$binary" version 2>/dev/null | sed -n '1p')"
        echo "[$SCRIPT_INDEX] frankenphp installed: $binary (${installed_version})"
        # The deb-enabled frankenphp.service runs its own Caddyfile on the
        # HTTP(S) ports - retire it so the plane's octane runtime owns them.
        fm_unlink_frankenphp_runtime
        fm_ensure_local_bin_link "$binary"
        return 0
    fi
    echo "[$SCRIPT_INDEX] [ERROR] no usable frankenphp binary after the official installer"
    return 0
}

# Embedded Caddy module list (caddy standard module enumeration).
fm_list_modules() {
    local binary=""
    binary="$(fm_get_binary)"
    if [ -n "$binary" ]; then
        "$binary" list-modules 2>/dev/null
    fi
}

# Module probe against the LIVE binary (string contract: yes/no).
fm_has_module() {
    fm_module_in_bin "$(fm_get_binary)" "$1"
}

# Module probe against an explicit binary (fm_has_module targets the live
# one; rebuild verification targets the candidate before it is installed).
# String contract: yes/no.
fm_module_in_bin() {
    local binary="$1"
    local module_name="$2"

    if [ -n "$binary" ] && [ -x "$binary" ] \
        && "$binary" list-modules 2>/dev/null | grep -q "^${module_name}$"; then
        echo "yes"
    else
        echo "no"
    fi
}

# Version tag of an arbitrary binary ("v1.12.7"; empty when unparsable) -
# anchored at the line start so the frankenphp tag wins over the Caddy
# vX.Y.Z that also appears later in the version string.
fm_version_tag_of() {
    local binary="$1"

    if [ -n "$binary" ] && [ -x "$binary" ]; then
        "$binary" version 2>/dev/null | sed -n 's/^FrankenPHP \(v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\).*/\1/p' | head -n 1
    fi
}

# Version tag of the RUNNING binary - pins rebuilds to the SAME frankenphp
# release.
fm_version_tag() {
    fm_version_tag_of "$(fm_get_binary)"
}

# Official static rebuild via ./build-static.sh - the docker-LESS primary
# path (implemented in frankenphp_static_builder.sh): fully self-contained
# toolchains (static-php-cli builds its own PHP/libphp; spc installs its
# own xcaddy, with the pinned host Go as the ONLY host tool consulted),
# pinned to the RUNNING binary's frankenphp tag + embedded PHP version,
# musl fully static (runs on ubuntu/debian/kali alike). Echoes the staged
# candidate binary path on stdout (empty on failure; all logs go to
# stderr); the caller probes it before installing.
fm_dnspod_build_static() {
    fm_static_build
}

# DNSPod API token from the shared RuntimeConfigurationStore (format
# "id,token"; the VALUE is never logged and never rendered into the
# Caddyfile - only the {env.DNSPOD_TOKEN} placeholder is). Empty when unset
# or when the Laravel app context is not available yet (fresh install);
# the runtime branch re-renders the Caddyfile once it is.
fm_dnspod_token_value() {
    local stored=""
    if [ -n "$PHP_BIN" ] && [ -x "$PHP_BIN" ] \
        && [ -n "$VENDOR_AUTOLOAD" ] && [ -f "$VENDOR_AUTOLOAD" ]; then
        stored="$(runtime_config_get "$FRANKENPHP_DNSPOD_TOKEN_KEY" 2>/dev/null || true)"
    fi
    if [ -n "$stored" ]; then
        echo "$stored"
        return 0
    fi
    get_secret_key_from_common_functions "$FRANKENPHP_DNSPOD_TOKEN_SECRET_KEY"
}

# Persist the DNSPod API token (id,token) into the shared store. Requires
# the runtime context (PHP_BIN + VENDOR_AUTOLOAD + BOOTSTRAP_APP) or a
# Laravel-side writer (ServerManager frankenphp API).
fm_dnspod_token_put() {
    local token="$1"
    if [ -z "$token" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] token value required (format: id,token)"
        return 0
    fi
    if [ -z "$PHP_BIN" ] || [ -z "$VENDOR_AUTOLOAD" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] runtime store context required (PHP_BIN, VENDOR_AUTOLOAD)"
        return 0
    fi
    runtime_config_put "$FRANKENPHP_DNSPOD_TOKEN_KEY" "$token"
    echo "[$SCRIPT_INDEX] DNSPod token stored (DNS-01 engages on the next Caddyfile render)"
}

# Mirror the secret-file token (${FRANKENPHP_DNSPOD_TOKEN_SECRET_KEY}) into
# the Laravel RuntimeConfigurationStore - the canonical store the app and
# the Caddyfile {env.DNSPOD_TOKEN} chain read. Idempotent: a non-empty
# stored value always wins; no secret file or no runtime context -> no-op.
fm_dnspod_token_ensure() {
    local file_token=""
    local stored=""

    file_token="$(get_secret_key_from_common_functions "$FRANKENPHP_DNSPOD_TOKEN_SECRET_KEY")"
    [ -n "$file_token" ] || return 0
    if [ -n "$PHP_BIN" ] && [ -x "$PHP_BIN" ] \
        && [ -n "$VENDOR_AUTOLOAD" ] && [ -f "$VENDOR_AUTOLOAD" ]; then
        stored="$(runtime_config_get "$FRANKENPHP_DNSPOD_TOKEN_KEY" 2>/dev/null || true)"
        if [ -z "$stored" ]; then
            fm_dnspod_token_put "$file_token" >/dev/null 2>&1 || true
            echo "[$SCRIPT_INDEX] DNSPod token seeded into the runtime store (from ${FRANKENPHP_DNSPOD_TOKEN_SECRET_KEY})"
        fi
    fi
    return 0
}

# Shared site host - single source for the 93 pipeline, the 175 plane
# branches and the Mercure issuer wiring: first configured
# api.<region>.<domain>, else localhost. An already-set FRANKENPHP_SITE_HOST
# env wins over the resolver. The region prefix and domain list self-resolve
# from the shared file-backed store (DOMAIN_API_REGION_PREFIX /
# DOMAINS_LISTS_CONTENT, written by domain_setup_persist_state on BOTH
# planes), so callers in separate processes never re-pass them as env.
fm_site_host() {
    local first_domain=""
    local prefix="${DOMAIN_API_PREFIX:-}"
    local domains="${DOMAIN_DOMAINS_LIST:-}"

    if [ -z "$prefix" ]; then
        prefix="$(get_global_var "DOMAIN_API_REGION_PREFIX" "")"
    fi
    if [ -z "$domains" ]; then
        domains="$(get_global_var "DOMAINS_LISTS_CONTENT" "")"
    fi

    if [ "${DOMAIN_SCOPE:-none}" != "none" ] && [ -n "$prefix" ] && [ -n "$domains" ]; then
        first_domain="$(printf '%s\n' "$domains" | head -n1)"
        if [ -n "$first_domain" ]; then
            echo "api.${prefix}.${first_domain}"
            return 0
        fi
    fi
    echo "localhost"
}

# Certificate directory (prebuilt/acme.sh variant) serving the given site
# host: keyed by the registrable apex (api.<region>. prefix stripped).
# Empty string when the apex cannot be derived.
fm_acme_cert_dir_for_host() {
    local apex=""
    local prefix="${DOMAIN_API_PREFIX:-}"
    if [ -z "$prefix" ]; then
        prefix="$(get_global_var "DOMAIN_API_REGION_PREFIX" "")"
    fi
    apex="${1#api.${prefix}.}"
    [ -n "$apex" ] || return 0
    echo "${FRANKENPHP_ACME_CERT_DIR}/${apex}"
}

# Legacy PHP runtime mutex (frankenphp plane): once the static binary
# carries the dnspod module it is the verified PHP runtime, and the
# Swoole-based app servers plus the old apt PHP services are mutually
# exclusive leftovers. FINE-GRAINED idempotency - every step probes and
# no-ops independently, and no step's no-op blocks the next:
#   1) systemd units whose RUNNING command is the swoole octane runtime
#      get disable --now. Judged by the runtime command, NEVER by unit
#      name: 175_laravel_main_start.sh re-creates the same laravel units
#      for the frankenphp plane (octane:frankenphp) - those stay untouched.
#      Orphan units whose ExecStart script vanished (retired steps) are
#      disabled too: they can only crash-loop (exit 127) forever.
#   2) swoole_http_server / swoole octane processes outside systemd are
#      stopped gracefully (TERM, then KILL for survivors).
#   3) every loaded php*-fpm unit stops + disables (fm_static_apt_php_cleanup
#      purges the packages afterwards).
#   4) verify: no swoole_http_server master remains.
# Runs as no-op before the dnspod binary is verified (gate below).
fm_disable_legacy_php_runtime() {
    local binary=""
    local unit=""
    local main_pid=""
    local unit_cmd=""
    local leftovers=""
    local pid=""

    binary="$(fm_get_binary)"
    # Gate on the dd.sh plane CONSTANT (web_server_plane = frankenphp), not
    # on the compile result: the mutex belongs to the selected plane, and
    # both variants (dnspod-compiled and prebuilt/acme.sh) converge onto it.
    # The binary stays a usability floor only (version probe, never a module
    # probe - a prebuilt binary without dnspod still owns the plane).
    if [ "$(web_server_plane)" != "frankenphp" ]; then
        echo "[$SCRIPT_INDEX] legacy-runtime disable skipped: web server plane is not frankenphp"
        return 0
    fi
    if [ "$(fm_binary_usable "$binary")" != "yes" ]; then
        echo "[$SCRIPT_INDEX] legacy-runtime disable skipped: no usable frankenphp binary yet"
        return 0
    fi
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] legacy-runtime disable skipped: systemctl unavailable"
        return 0
    fi

    for unit in $(systemctl list-units --type=service --all --no-legend 2>/dev/null \
        | awk '{print $1}' | grep -iE 'laravel|octane|swoole|app-manager'); do
        main_pid="$(systemctl show -p MainPID --value "$unit" 2>/dev/null)"
        unit_cmd=""
        if [ -n "$main_pid" ] && [ "$main_pid" != "0" ]; then
            unit_cmd="$(ps -p "$main_pid" -o args= 2>/dev/null)"
        fi
        [ -z "$unit_cmd" ] && unit_cmd="$(systemctl show -p ExecStart --value "$unit" 2>/dev/null)"
        if echo "$unit_cmd" | grep -qiE 'swoole_http_server|--server=swoole'; then
            echo "[$SCRIPT_INDEX] disabling legacy swoole unit: $unit"
            $USE_SUDO systemctl disable --now "$unit" >/dev/null 2>&1 || true
            # A matching trigger timer re-starts a disabled unit - stop and
            # disable the timer together with the service it drives.
            if systemctl list-unit-files --type=timer --no-legend 2>/dev/null | awk '{print $1}' | grep -qx "${unit}.timer"; then
                echo "[$SCRIPT_INDEX] disabling legacy swoole trigger timer: ${unit}.timer"
                $USE_SUDO systemctl disable --now "${unit}.timer" >/dev/null 2>&1 || true
            fi
            continue
        fi
        # Orphan legacy unit: its ExecStart references a script that no longer
        # exists (e.g. renamed install steps) - it can only crash-loop (127)
        # forever, never reaching the running-command check above. Such a
        # unit belongs to a retired plane and is disabled as leftover cleanup;
        # a frankenphp-plane unit always points at a live script.
        for exec_path in $(printf '%s\n' "$unit_cmd" | grep -oE '/[A-Za-z0-9_./-]+\.sh' || true); do
            if [ ! -e "$exec_path" ]; then
                echo "[$SCRIPT_INDEX] disabling orphan legacy unit (missing exec): $unit"
                $USE_SUDO systemctl disable --now "$unit" >/dev/null 2>&1 || true
                break
            fi
        done
    done

    leftovers="$(pgrep -f 'swoole_http_server|octane:start --server=swoole' 2>/dev/null || true)"
    if [ -n "$leftovers" ]; then
        echo "[$SCRIPT_INDEX] stopping legacy swoole processes: $(echo "$leftovers" | tr '\n' ' ')"
        for pid in $leftovers; do
            kill "$pid" 2>/dev/null || $USE_SUDO kill "$pid" 2>/dev/null || true
        done
        sleep 2
        leftovers="$(pgrep -f 'swoole_http_server|octane:start --server=swoole' 2>/dev/null || true)"
        for pid in $leftovers; do
            $USE_SUDO kill -9 "$pid" 2>/dev/null || true
        done
    fi

    for unit in $(systemctl list-units --type=service --all --no-legend 2>/dev/null \
        | awk '{print $1}' | grep -E 'php[0-9.]*-fpm'); do
        if systemctl is-active --quiet "$unit" 2>/dev/null; then
            echo "[$SCRIPT_INDEX] stopping legacy php-fpm unit: $unit"
        fi
        $USE_SUDO systemctl disable --now "$unit" >/dev/null 2>&1 || true
    done

    if pgrep -f 'swoole_http_server' >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] [WARN] swoole_http_server still present after mutex disable"
    else
        echo "[$SCRIPT_INDEX] legacy swoole/php runtime disabled (frankenphp plane mutex)"
    fi
    return 0
}

# Probe a runtime extension inside a frankenphp binary's embedded PHP
# (script-file mode: the embedded php-cli accepts no -r/-d flags).
# String contract: yes/no.
fm_embedded_extension_loaded() {
    local binary="$1"
    local extension="$2"
    local probe=""
    local rc=""

    if [ -z "$binary" ] || [ ! -x "$binary" ]; then
        echo "no"
        return 0
    fi
    probe="$(mktemp)"
    printf '<?php exit(extension_loaded(getenv("FM_PROBE_EXTENSION")) ? 0 : 1);' > "$probe"
    FM_PROBE_EXTENSION="$extension" "$binary" php-cli "$probe" >/dev/null 2>&1
    rc=$?
    rm -f "$probe"
    if [ "$rc" -eq 0 ]; then
        echo "yes"
    else
        echo "no"
    fi
}

# Embedded-runtime completeness floor for a compile-variant binary (string
# contract: yes/no): the dnspod DNS-01 module plus the extensions the
# operating scripts depend on (phar+simplexml: composer, pcntl: worker
# control). A binary missing any of them is a rebuild trigger.
fm_binary_compile_complete() {
    local binary="$1"

    if [ "$(fm_module_in_bin "$binary" "$FRANKENPHP_DNSPOD_MODULE")" = "yes" ] \
        && [ "$(fm_embedded_extension_loaded "$binary" phar)" = "yes" ] \
        && [ "$(fm_embedded_extension_loaded "$binary" simplexml)" = "yes" ] \
        && [ "$(fm_embedded_extension_loaded "$binary" pcntl)" = "yes" ]; then
        echo "yes"
    else
        echo "no"
    fi
}

# Idempotent unlink of a live FrankenPHP runtime BEFORE the central binary
# is replaced: retire every unit that executes a frankenphp binary (plus its
# trigger timer). Replace-only semantics - the prebuilt cache, the staging
# tree and the whole static build tree are never touched here.
fm_unlink_frankenphp_runtime() {
    local unit=""
    local unit_cmd=""

    command -v systemctl >/dev/null 2>&1 || return 0
    for unit in $(systemctl list-unit-files --type=service --no-legend 2>/dev/null \
        | awk '{print $1}' | grep -Ei 'frankenphp|octane|app-manager' | grep -v '@'); do
        unit_cmd="$(systemctl show -p ExecStart "$unit" 2>/dev/null || true)"
        # Discriminator (judged by the EXECUTED command, NEVER by unit
        # name): only a unit EXECUTING a frankenphp binary directly (the
        # deb's own `frankenphp run` Caddy server) is retired. The plane's
        # own runtime - artisan `octane:start --server=frankenphp` - merely
        # NAMES frankenphp as a flag; those units stay untouched.
        case "$unit_cmd" in
            *frankenphp*)
                if echo "$unit_cmd" | grep -qiE 'octane|artisan'; then
                    continue
                fi
                echo "[$SCRIPT_INDEX] unlink: disabling frankenphp unit ${unit}"
                $USE_SUDO systemctl disable --now "$unit" >/dev/null 2>&1 || true
                if systemctl list-unit-files --type=timer --no-legend 2>/dev/null \
                    | awk '{print $1}' | grep -qx "${unit}.timer"; then
                    $USE_SUDO systemctl disable --now "${unit}.timer" >/dev/null 2>&1 || true
                fi
                ;;
        esac
    done
    systemctl daemon-reload >/dev/null 2>&1 || true
    return 0
}

# Staged candidate install (compile variant): build the dnspod binary via
# the official static builder, verify the candidate, then atomically
# install it at the compiled-variant path. Echoes the installed binary
# path on success (empty on failure); every failure path keeps the live
# binary untouched. On a fresh host (no compiled path yet) the baseline
# is ANY usable binary - the official installer deb or the prebuilt
# cache - and the compiled path is created on first install.
fm_dnspod_candidate_install() {
    local binary=""
    local candidate=""
    local target=""

    target="$FRANKENPHP_COMPILED_BINARY_PATH"
    binary="$(fm_resolve_binary_path "$target")"
    [ -n "$binary" ] || binary="$(fm_get_binary)"

    candidate="$(fm_dnspod_build_static)"
    if [ -z "$candidate" ]; then
        echo "[$SCRIPT_INDEX] [WARN] dnspod module deferred (official static build failed; the stderr log above carries the kept workdir path)"
        echo ""
        return 0
    fi

    # Candidate sanity BEFORE touching the live runtime: must execute and
    # carry the module + the phar floor.
    if ! "$candidate" version >/dev/null 2>&1 \
        || [ "$(fm_module_in_bin "$candidate" "$FRANKENPHP_DNSPOD_MODULE")" != "yes" ] \
        || [ "$(fm_embedded_extension_loaded "$candidate" phar)" != "yes" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] rebuilt binary failed the version/module/phar probe; keeping $binary"
        rm -rf "$(dirname "$candidate")"
        echo ""
        return 0
    fi

    # One-time backup of the pre-dnspod binary; atomic replace via mv (a
    # running octane keeps its old mapping - no ETXTBSY).
    $USE_SUDO mkdir -p "$(dirname "$target")"
    if [ -f "$target" ] && [ ! -f "${target}${FRANKENPHP_BACKUP_SUFFIX}" ]; then
        $USE_SUDO cp "$target" "${target}${FRANKENPHP_BACKUP_SUFFIX}"
    fi
    $USE_SUDO cp "$candidate" "${target}.dnspod-new"
    $USE_SUDO chmod 755 "${target}.dnspod-new"
    $USE_SUDO mv -f "${target}.dnspod-new" "$target"
    rm -rf "$(dirname "$candidate")"
    echo "[$SCRIPT_INDEX] dnspod module embedded (backup: ${target}${FRANKENPHP_BACKUP_SUFFIX}) ($("$target" version 2>/dev/null | sed -n '1p'))"
    # Variant mutex: the compiled variant now owns the plane - remove stale
    # prebuilt variant backup artifacts to keep one active runtime contract.
    rm -f "${FRANKENPHP_PREBUILT_BINARY_PATH}${FRANKENPHP_BACKUP_SUFFIX}"
    echo "$target"
}

# Ensure the dnspod ACME DNS-01 module is embedded in the frankenphp
# binary (compile-variant convergence; the prebuilt variant converges via
# acme.sh DNS-01 instead and never rebuilds). Order (each step its own
# idempotent probe): prebuilt guard -> token mirror -> baseline ensure
# (fm_install) -> completeness probe -> engagement gate -> staged rebuild
# + install. A failed build defers with a warning - the built-in ACME
# (TLS-ALPN-01/HTTP-01) keeps issuing certificates meanwhile. Once the
# module has converged, the apt PHP stack is purged
# (fm_static_apt_php_cleanup): the static binary is the frankenphp
# plane's ONLY PHP runtime.
fm_ensure_dnspod_module() {
    local binary=""
    local candidate=""

    # Prebuilt guard (record OR link inference): the prebuilt variant owns
    # the plane via acme.sh DNS-01 (93 --prebuilt intent) - a runtime start
    # on a prebuilt host must NEVER trigger a static rebuild, and a
    # leftover compiled binary must not take the plane back through the
    # satisfied probe below.
    if [ "$(fm_variant)" = "prebuilt" ]; then
        echo "[$SCRIPT_INDEX] dnspod module convergence skipped: prebuilt variant owns the plane (acme.sh DNS-01)"
        return 0
    fi

    # Mirror the shared secret-file token into the runtime store first
    # (idempotent; covers the 93 compile path, 175 re-uses fm_dns01_ensure).
    fm_dnspod_token_ensure
    fm_install
    binary="$(fm_resolve_binary_path "$FRANKENPHP_COMPILED_BINARY_PATH")"
    if [ -n "$binary" ] && [ "$(fm_binary_compile_complete "$binary")" = "yes" ]; then
        echo "[$SCRIPT_INDEX] dnspod module already embedded (phar/pcntl present)"
        fm_ensure_local_bin_link "$binary"
        fm_disable_legacy_php_runtime
        fm_static_apt_php_cleanup
        return 0
    fi

    # Engagement gate (explicit intent): ONLY the compiled variant converges
    # via rebuild. An UNRECORDED host (baseline deb via the official
    # installer, no 93 intent recorded yet) defers instead of surprising a
    # service start with a multi-minute static build (systemd would kill it
    # at its start timeout). The explicit `dnspod` CLI re-records the
    # variant to compiled before calling here, so manual convergence still
    # works.
    if [ "$(fm_variant)" != "compiled" ]; then
        echo "[$SCRIPT_INDEX] dnspod module not embedded; no rebuild on variant '$(fm_variant)' (prebuilt keeps acme.sh DNS-01; run 93_install_frankenphp.sh --compile or frankenphp_manager.sh dnspod for the static build)"
        return 0
    fi

    candidate="$(fm_dnspod_candidate_install)"
    if [ -z "$candidate" ]; then
        return 0
    fi

    fm_ensure_local_bin_link "$candidate"
    # The binary identity changed - the php/php-cli shims must re-target it
    # (a stale shim keeps exec'ing the previous binary path, which the apt
    # purge may remove altogether).
    fm_ensure_php_cli_shim
    fm_disable_legacy_php_runtime
    fm_static_apt_php_cleanup
    return 0
}

# Canonical Caddyfile render (content-hash idempotent). Mercure JWT values
# stay {$ENV} placeholders; the runtime injects them as process env.
# Args: 1 laravel_public_dir 2 site_host 3 https_port 4 admin_port 5 caddyfile_path
fm_caddyfile_ensure() {
    local laravel_public_dir="$1"
    local site_host="$2"
    local https_port="$3"
    local admin_port="$4"
    local caddyfile_path="$5"
    local caddyfile_dir=""
    local rendered=""
    local existing=""
    local dnspod_tls=""
    local acme_tls=""
    local acme_cert_dir=""

    caddyfile_dir="$(dirname "$caddyfile_path")"
    if [ ! -d "$caddyfile_dir" ]; then
        mkdir -p "$caddyfile_dir"
    fi

    # DNS-01 stanza renders ONLY when both truths hold: the module is
    # embedded in the binary AND the DNSPod token is stored (env placeholder
    # only - the token itself never enters the file). Sync contract: the
    # Laravel builder renders the identical gate.
    dnspod_tls=""
    if [ "$(fm_has_module "$FRANKENPHP_DNSPOD_MODULE")" = "yes" ] && [ -n "$(fm_dnspod_token_value)" ]; then
        dnspod_tls="	tls {
		dns dnspod {env.${FRANKENPHP_DNSPOD_TOKEN_KEY}}
	}

"
    fi

    # Prebuilt variant gate: when the dnspod module is NOT embedded but the
    # acme.sh DNS-01 certificates are on disk, pin them explicitly. Neither
    # gate matching -> Caddy built-in ACME (HTTP-01/TLS-ALPN-01) stays in
    # charge. Sync contract: the Laravel builder renders the identical gates.
    if [ -z "$dnspod_tls" ]; then
        acme_cert_dir="$(fm_acme_cert_dir_for_host "$site_host")"
        if [ -n "$acme_cert_dir" ] \
            && [ -f "${acme_cert_dir}/fullchain.pem" ] \
            && [ -f "${acme_cert_dir}/key.pem" ]; then
            acme_tls="	tls ${acme_cert_dir}/fullchain.pem ${acme_cert_dir}/key.pem

"
        fi
    fi

    rendered="# Managed by frankenphp_manager.sh (SYNC: ServerManagerV1FrankenPhpManagerCtl)
{
	admin localhost:${admin_port}
	auto_https disable_redirects
}

https://${site_host}:${https_port} {
	root * ${laravel_public_dir}
	encode zstd gzip

${dnspod_tls}${acme_tls}	mercure {
		issuer {env.MERCURE_TRUSTED_ISSUERS} {
			publisher {
				jwt {env.MERCURE_PUBLISHER_JWT_KEY} {env.MERCURE_PUBLISHER_JWT_ALG}
			}
			subscriber {
				jwt {env.MERCURE_SUBSCRIBER_JWT_KEY} {env.MERCURE_SUBSCRIBER_JWT_ALG}
			}
		}
	}

	php_server
	file_server
}
"

    existing=""
    [ -f "$caddyfile_path" ] && existing="$(cat "$caddyfile_path")"
    if [ "$existing" = "$rendered" ]; then
        echo "[$SCRIPT_INDEX] Caddyfile already canonical: $caddyfile_path"
        return 0
    fi

    printf '%s\n' "$rendered" > "$caddyfile_path"
    chmod 600 "$caddyfile_path"
    echo "[$SCRIPT_INDEX] Caddyfile rendered: $caddyfile_path (secrets stay env placeholders)"
}

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
    if [ "$(fm_has_module "$FRANKENPHP_DNSPOD_MODULE")" != "yes" ]; then
        echo "module missing (run: frankenphp_manager.sh dnspod)"
        return 0
    fi
    if [ -z "$(fm_dnspod_token_value)" ]; then
        echo "module embedded, token not set (built-in ACME active)"
        return 0
    fi
    echo "ready (module embedded + token stored)"
}

# Idempotent DNS-01 certificate readiness (compile variant): converge the
# module + the token pair. The certificate itself is issued and renewed by
# Caddy ACME at every octane start once both hold; the token is the only
# manual credential and is normally seeded from the secret file.
fm_dns01_ensure() {
    fm_dnspod_token_ensure
    if [ "$(fm_has_module "$FRANKENPHP_DNSPOD_MODULE")" != "yes" ]; then
        echo "[$SCRIPT_INDEX] DNS-01 deferred: dnspod module not embedded yet (built-in HTTP-01/TLS-ALPN-01 stays active)"
        return 0
    fi
    if [ -z "$(fm_dnspod_token_value)" ]; then
        echo "[$SCRIPT_INDEX] DNS-01 pending: DNSPod API token not stored; add it once via"
        echo "[$SCRIPT_INDEX]   $0 dnspod-token '<id,token>'   (or the ${FRANKENPHP_DNSPOD_TOKEN_SECRET_KEY} secret file)"
        return 0
    fi
    echo "[$SCRIPT_INDEX] DNS-01 ready: dnspod module embedded + token stored (wildcard issues at next octane start)"
    return 0
}

fm_verify() {
    local binary=""
    binary="$(fm_get_binary)"
    if [ -z "$binary" ]; then
        echo "[$SCRIPT_INDEX] [VERIFY] frankenphp binary: MISSING"
        return 0
    fi
    echo "[$SCRIPT_INDEX] [VERIFY] binary: $binary ($(fm_version))"
    echo "[$SCRIPT_INDEX] [VERIFY] embedded PHP: $(fm_php_version)"
    echo "[$SCRIPT_INDEX] [VERIFY] variant: $(fm_variant)"
    echo "[$SCRIPT_INDEX] [VERIFY] dnspod module: $([ "$(fm_has_module "$FRANKENPHP_DNSPOD_MODULE")" = "yes" ] && echo embedded || echo missing)"
    echo "[$SCRIPT_INDEX] [VERIFY] DNS-01 (dnspod): $(fm_dns01_status)"
    echo "[$SCRIPT_INDEX] [VERIFY] php-cli shim: $([ -x "${FRANKENPHP_PHP_SHIM_DIR}/php" ] && echo present || echo missing)"
    echo "[$SCRIPT_INDEX] [VERIFY] plane: $(web_server_plane)"
}

# Management CLI (same surface the log advertises):
#   install | verify | status | dnspod | caddyfile <public_dir> <host> <https> <admin> <path>
if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    case "${1:-verify}" in
        install)
            fm_install
            ;;
        dnspod)
            fm_variant_set compiled
            fm_ensure_dnspod_module
            fm_store_info
            ;;
        dnspod-token)
            if [ -z "${2:-}" ]; then
                echo "usage: $0 dnspod-token '<id,token>'"
                exit 1
            fi
            fm_dnspod_token_put "$2"
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
