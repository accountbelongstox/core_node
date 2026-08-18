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
# nginx_manager.sh). Every primitive is idempotent and self-probing:
#   fm_get_binary / fm_version                       binary file probes
#   fm_install                                       official installer
#   fm_list_modules / fm_has_module                  embedded Caddy modules
#   fm_ensure_dnspod_module                          official static build w/ dnspod
#   fm_caddyfile_ensure                              canonical Caddyfile render
#   fm_store_info / fm_verify                        state + verification
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

FRANKENPHP_BIN_CANDIDATES="/usr/local/bin/frankenphp /usr/bin/frankenphp"
FRANKENPHP_LINK_PATH="/usr/local/bin/frankenphp"
FRANKENPHP_INSTALL_URL="https://frankenphp.dev/install.sh"
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
FRANKENPHP_PHP_INI_DIR="/etc/frankenphp/php-conf.d"

# Binary path (empty string when absent) - file probing only, no command -v.
fm_get_binary() {
    local candidate=""
    for candidate in $FRANKENPHP_BIN_CANDIDATES; do
        if [ -x "$candidate" ]; then
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

    binary="$(fm_get_binary)"
    if [ -z "$binary" ]; then
        echo "[$SCRIPT_INDEX] [WARN] no frankenphp binary; ${FRANKENPHP_LINK_PATH} link not created"
        return 1
    fi
    if [ "$binary" = "$FRANKENPHP_LINK_PATH" ]; then
        return 0
    fi
    canonical_target="$(readlink -f "$FRANKENPHP_LINK_PATH" 2>/dev/null || true)"
    if [ "$canonical_target" = "$(readlink -f "$binary")" ]; then
        return 0
    fi
    $USE_SUDO ln -sf "$binary" "$FRANKENPHP_LINK_PATH"
    echo "[$SCRIPT_INDEX] linked ${FRANKENPHP_LINK_PATH} -> ${binary}"
    return 0
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
        return 1
    fi
    for shim in php php-cli; do
        wanted="#!/bin/sh
exec ${binary} php-cli \"\$@\""
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

# Official installer (frankenphp.dev); idempotent via the binary probe,
# and the canonical /usr/local/bin link is re-ensured on every pass.
fm_install() {
    local binary=""
    binary="$(fm_get_binary)"
    if [ -n "$binary" ]; then
        echo "[$SCRIPT_INDEX] frankenphp already installed: $binary ($(fm_version))"
        fm_ensure_local_bin_link
        return 0
    fi
    if ! command -v curl >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] [ERROR] curl is required for the frankenphp installer"
        return 1
    fi
    echo "[$SCRIPT_INDEX] Installing frankenphp (official installer)"
    curl -fsSL "$FRANKENPHP_INSTALL_URL" | $USE_SUDO sh
    if [ -f "frankenphp" ]; then
        $USE_SUDO mv frankenphp /usr/local/bin/frankenphp
        $USE_SUDO chmod +x /usr/local/bin/frankenphp
    fi
    binary="$(fm_get_binary)"
    if [ -n "$binary" ]; then
        echo "[$SCRIPT_INDEX] frankenphp installed: $binary ($(fm_version))"
        fm_ensure_local_bin_link
    else
        echo "[$SCRIPT_INDEX] [ERROR] frankenphp binary not found after install"
        return 1
    fi
}

# Embedded Caddy module list (caddy standard module enumeration).
fm_list_modules() {
    local binary=""
    binary="$(fm_get_binary)"
    if [ -n "$binary" ]; then
        "$binary" list-modules 2>/dev/null
    fi
}

fm_has_module() {
    local module_name="$1"
    local binary=""
    binary="$(fm_get_binary)"
    fm_module_in_bin "$binary" "$module_name"
}

# Module probe against an explicit binary (fm_has_module targets the live
# one; rebuild verification targets the candidate before it is installed).
fm_module_in_bin() {
    local binary="$1"
    local module_name="$2"
    [ -n "$binary" ] && [ -x "$binary" ] \
        && "$binary" list-modules 2>/dev/null | grep -q "^${module_name}\$"
}

# Version tag of the running binary ("v1.12.7"; empty when unparsable) -
# pins rebuilds to the SAME frankenphp release. Anchored at the line
# start so the frankenphp tag wins over the Caddy vX.Y.Z that also
# appears later in the version string.
fm_version_tag() {
    fm_version | sed -n 's/^FrankenPHP \(v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\).*/\1/p' | head -n 1
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
        return 1
    fi
    if [ -z "$PHP_BIN" ] || [ -z "$VENDOR_AUTOLOAD" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] runtime store context required (PHP_BIN, VENDOR_AUTOLOAD)"
        return 1
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

# Shared site host - single source for the 93 pipeline, the 175 dispatch and
# the Mercure issuer wiring: first configured api.<region>.<domain>, else
# localhost. An already-set FRANKENPHP_SITE_HOST env wins over the resolver.
fm_site_host() {
    local first_domain=""
    if [ "${DOMAIN_SCOPE:-none}" != "none" ] \
        && [ -n "${DOMAIN_API_PREFIX:-}" ] && [ -n "${DOMAIN_DOMAINS_LIST:-}" ]; then
        first_domain="$(printf '%s\n' "$DOMAIN_DOMAINS_LIST" | head -n1)"
        if [ -n "$first_domain" ]; then
            echo "api.${DOMAIN_API_PREFIX}.${first_domain}"
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
    apex="${1#api.${DOMAIN_API_PREFIX:-}.}"
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
    if [ -z "$binary" ] || ! "$binary" version >/dev/null 2>&1; then
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
        return 1
    fi
    echo "[$SCRIPT_INDEX] legacy swoole/php runtime disabled (frankenphp plane mutex)"
    return 0
}

# Ensure the dnspod ACME DNS-01 module is embedded in the frankenphp
# binary. Order (each step its own idempotent probe): already embedded ->
# official static rebuild (./build-static.sh, docker-LESS). A failed build
# defers with a warning - the built-in ACME (TLS-ALPN-01/HTTP-01) keeps
# issuing certificates meanwhile. Once the module has converged, the apt
# PHP stack is purged (fm_static_apt_php_cleanup): the static binary is
# the frankenphp plane's ONLY PHP runtime.
fm_ensure_dnspod_module() {
    local binary=""
    local candidate=""

    # Mirror the shared secret-file token into the runtime store first
    # (idempotent; covers the 93 compile path, 175 re-uses fm_dns01_ensure).
    fm_dnspod_token_ensure
    binary="$(fm_get_binary)"
    if [ -z "$binary" ]; then
        echo "[$SCRIPT_INDEX] [WARN] no frankenphp binary; run fm_install first"
        return 1
    fi
    if fm_module_in_bin "$binary" "$FRANKENPHP_DNSPOD_MODULE"; then
        echo "[$SCRIPT_INDEX] dnspod module already embedded"
        fm_ensure_local_bin_link
        fm_disable_legacy_php_runtime
        fm_static_apt_php_cleanup
        return 0
    fi

    candidate="$(fm_dnspod_build_static)"
    if [ -z "$candidate" ]; then
        echo "[$SCRIPT_INDEX] [WARN] dnspod module deferred (official static build failed; the stderr log above carries the kept workdir path)"
        return 1
    fi

    # Candidate sanity BEFORE replacing the live binary: must execute and
    # carry the module.
    if ! "$candidate" version >/dev/null 2>&1 \
        || ! fm_module_in_bin "$candidate" "$FRANKENPHP_DNSPOD_MODULE"; then
        echo "[$SCRIPT_INDEX] [ERROR] rebuilt binary failed the version/module probe; keeping $binary"
        rm -rf "$(dirname "$candidate")"
        return 1
    fi

    # One-time backup of the pre-dnspod binary; atomic replace via mv (a
    # running octane keeps its old mapping - no ETXTBSY).
    if [ ! -f "${binary}${FRANKENPHP_BACKUP_SUFFIX}" ]; then
        $USE_SUDO cp "$binary" "${binary}${FRANKENPHP_BACKUP_SUFFIX}"
    fi
    $USE_SUDO cp "$candidate" "${binary}.dnspod-new"
    $USE_SUDO chmod 755 "${binary}.dnspod-new"
    $USE_SUDO mv -f "${binary}.dnspod-new" "$binary"
    rm -rf "$(dirname "$candidate")"
    echo "[$SCRIPT_INDEX] dnspod module embedded (backup: ${binary}${FRANKENPHP_BACKUP_SUFFIX}) ($(fm_version))"
    # Variant mutex: the compiled variant now owns the link - drop a stale
    # prebuilt-variant backup left behind by an earlier prebuilt install.
    [ "$binary" = "$FRANKENPHP_LINK_PATH" ] && rm -f "${FRANKENPHP_LINK_PATH}.prebuilt"
    # The binary identity changed - the php/php-cli shims must re-target it
    # (a stale shim keeps exec'ing the previous binary path, which the apt
    # purge may remove altogether).
    fm_ensure_php_cli_shim
    fm_store_info
    fm_disable_legacy_php_runtime
    fm_static_apt_php_cleanup
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
    if fm_has_module "$FRANKENPHP_DNSPOD_MODULE" && [ -n "$(fm_dnspod_token_value)" ]; then
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
    if ! fm_has_module "$FRANKENPHP_DNSPOD_MODULE"; then
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
    if ! fm_has_module "$FRANKENPHP_DNSPOD_MODULE"; then
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
        return 1
    fi
    echo "[$SCRIPT_INDEX] [VERIFY] binary: $binary ($(fm_version))"
    echo "[$SCRIPT_INDEX] [VERIFY] embedded PHP: $(fm_php_version)"
    echo "[$SCRIPT_INDEX] [VERIFY] dnspod module: $(fm_has_module "$FRANKENPHP_DNSPOD_MODULE" && echo embedded || echo missing)"
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
            fm_ensure_dnspod_module
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
