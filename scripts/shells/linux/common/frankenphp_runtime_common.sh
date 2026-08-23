#!/bin/bash

# Effective PHP ini scan path. The leading empty component preserves the
# binary's compiled scan directory before applying the project overrides.
fm_php_ini_scan_path() {
    echo "$FRANKENPHP_PHP_INI_SCAN_PATH"
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
upload_max_filesize = ${PHP_RUNTIME_UPLOAD_MAX_FILESIZE}
post_max_size = ${PHP_RUNTIME_POST_MAX_SIZE}
max_execution_time = ${PHP_RUNTIME_MAX_EXECUTION_TIME}
max_input_time = ${PHP_RUNTIME_MAX_INPUT_TIME}
opcache.enable_cli = 1"
    existing=""
    [ -f "${ini_dir}/99-core-node.ini" ] && existing="$(cat "${ini_dir}/99-core-node.ini")"
    if [ "$existing" = "$rendered" ]; then
        echo "[$SCRIPT_INDEX] PHP ini already canonical: ${ini_dir}/99-core-node.ini"
        return
    fi
    printf '%s\n' "$rendered" > "${ini_dir}/99-core-node.ini"
    echo "[$SCRIPT_INDEX] PHP ini rendered: ${ini_dir}/99-core-node.ini"
}

# Compile-only bootstrap. The static builder needs an upstream FrankenPHP
# release and embedded PHP version before the first compiled payload exists.
# It may read a retained package/prebuilt binary for that metadata, but this
# binary never becomes the selected runtime contract.
fm_compile_baseline_ensure() {
    local binary=""
    local curl_binary=""
    local installed_version=""

    binary="$(fm_get_bootstrap_binary)"
    if [ "$(fm_binary_usable "$binary")" = "yes" ]; then
        installed_version="$("$binary" version 2>/dev/null | sed -n '1p')"
        echo "[$SCRIPT_INDEX] frankenphp baseline binary present: $binary (${installed_version})"
        return
    fi

    curl_binary="$(command -v curl 2>/dev/null)"
    if [ -z "$curl_binary" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] curl is required for the frankenphp installer"
        return
    fi
    echo "[$SCRIPT_INDEX] Installing frankenphp (official installer)"
    curl -fsSL "$FRANKENPHP_INSTALL_URL" | $USE_SUDO sh
    binary="$(fm_get_bootstrap_binary)"
    if [ "$(fm_binary_usable "$binary")" = "yes" ]; then
        installed_version="$("$binary" version 2>/dev/null | sed -n '1p')"
        echo "[$SCRIPT_INDEX] frankenphp installed: $binary (${installed_version})"
        return
    fi
    echo "[$SCRIPT_INDEX] [ERROR] no usable frankenphp binary after the official installer"
    return
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
    local matched_module=""

    if [ -n "$binary" ] && [ -x "$binary" ]; then
        matched_module="$("$binary" list-modules 2>/dev/null | awk -v wanted="$module_name" '$0 == wanted {print; exit}')"
    fi
    if [ "$matched_module" = "$module_name" ]; then
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
        return
    fi
    get_secret_key_from_common_functions "$FRANKENPHP_DNSPOD_TOKEN_SECRET_KEY"
}

# Persist the DNSPod API token (id,token) into the shared store. Requires
# the runtime context (PHP_BIN + VENDOR_AUTOLOAD + BOOTSTRAP_APP) or a
# Laravel-side writer (ServerManager frankenphp API).
fm_dnspod_token_put() {
    local token="$1"
    local stored=""
    if [ -z "$token" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] token value required (format: id,token)"
        return
    fi
    if [ -z "$PHP_BIN" ] || [ -z "$VENDOR_AUTOLOAD" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] runtime store context required (PHP_BIN, VENDOR_AUTOLOAD)"
        return
    fi
    runtime_config_put "$FRANKENPHP_DNSPOD_TOKEN_KEY" "$token" >/dev/null
    stored="$(runtime_config_get "$FRANKENPHP_DNSPOD_TOKEN_KEY" 2>/dev/null)"
    if [ "$stored" = "$token" ]; then
        echo "[$SCRIPT_INDEX] DNSPod token stored (DNS-01 engages on the next Caddyfile render)"
    else
        echo "[$SCRIPT_INDEX] [ERROR] DNSPod token was not persisted"
    fi
}

# Mirror the secret-file token (${FRANKENPHP_DNSPOD_TOKEN_SECRET_KEY}) into
# the Laravel RuntimeConfigurationStore - the canonical store the app and
# the Caddyfile {env.DNSPOD_TOKEN} chain read. Idempotent: a non-empty
# stored value always wins; no secret file or no runtime context -> no-op.
fm_dnspod_token_ensure() {
    local file_token=""
    local stored=""

    file_token="$(get_secret_key_from_common_functions "$FRANKENPHP_DNSPOD_TOKEN_SECRET_KEY")"
    if [ -z "$file_token" ]; then
        return
    fi
    if [ -n "$PHP_BIN" ] && [ -x "$PHP_BIN" ] \
        && [ -n "$VENDOR_AUTOLOAD" ] && [ -f "$VENDOR_AUTOLOAD" ]; then
        stored="$(runtime_config_get "$FRANKENPHP_DNSPOD_TOKEN_KEY" 2>/dev/null || true)"
        if [ -z "$stored" ]; then
            fm_dnspod_token_put "$file_token" >/dev/null 2>&1
            stored="$(runtime_config_get "$FRANKENPHP_DNSPOD_TOKEN_KEY" 2>/dev/null)"
            if [ "$stored" = "$file_token" ]; then
                echo "[$SCRIPT_INDEX] DNSPod token seeded into the runtime store (from ${FRANKENPHP_DNSPOD_TOKEN_SECRET_KEY})"
            fi
        fi
    fi
    return
}

# Shared site host - single source for the 93 pipeline, the 175 plane
# branches and the Mercure issuer wiring: first configured
# api.<region>.<domain>, else localhost. The region prefix and domain list
# resolve from the service contract and its generated runtime view so a stale
# service environment cannot select a different issuer.
fm_site_host() {
    local first_domain=""
    local prefix=""

    web_access_resolve
    prefix="$WEB_ACCESS_API_REGION_PREFIX"
    if [ -n "$prefix" ]; then
        first_domain="$(web_access_first_domain)"
        if [ -n "$first_domain" ]; then
            echo "api.${prefix}.${first_domain}"
            return
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
    if [ -z "$apex" ]; then
        return
    fi
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
#   3) every loaded php*-fpm unit stops + disables.
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
        return
    fi
    if [ "$(fm_binary_usable "$binary")" != "yes" ]; then
        echo "[$SCRIPT_INDEX] legacy-runtime disable skipped: no usable frankenphp binary yet"
        return
    fi
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] legacy-runtime disable skipped: systemctl unavailable"
        return
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
    return
}

# Probe a runtime extension inside a frankenphp binary's embedded PHP
# (script-file mode: the embedded php-cli accepts no -r/-d flags).
# String contract: yes/no.
fm_embedded_extension_loaded() {
    local binary=""
    local extension=""
    local loaded=""

    binary="$1"
    extension="$2"
    if [ -z "$binary" ] || [ ! -x "$binary" ]; then
        echo "no"
        return
    fi
    loaded="$(fm_embedded_php_eval \
        "$binary" \
        '<?php echo extension_loaded(getenv("FM_PROBE_EXTENSION")) ? "yes" : "no";' \
        "$extension")"
    if [ "$loaded" = "yes" ]; then
        echo "yes"
    else
        echo "no"
    fi
}

# Shared runtime extension floor for every packaging variant. The application
# always uses PostgreSQL, while Composer and Octane require the remaining
# extensions before a variant can own the runtime plane.
fm_php_runtime_extensions_ready() {
    local binary=""
    local extension=""
    local ready="yes"

    binary="$1"
    for extension in "${FRANKENPHP_RUNTIME_REQUIRED_PHP_EXTENSIONS[@]}"; do
        if [ "$(fm_embedded_extension_loaded "$binary" "$extension")" != "yes" ]; then
            ready="no"
        fi
    done
    echo "$ready"
}

# Embedded-runtime completeness floor for a compile-variant binary (string
# contract: yes/no): the dnspod DNS-01 module plus the shared runtime
# extension floor. A binary missing any of them is a rebuild trigger.
fm_binary_compile_complete() {
    local binary="$1"

    if [ "$(fm_module_in_bin "$binary" "$FRANKENPHP_DNSPOD_MODULE")" = "yes" ] \
        && [ "$(fm_php_runtime_extensions_ready "$binary")" = "yes" ]; then
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

    if [ -z "$(command -v systemctl 2>/dev/null)" ]; then
        return
    fi
    for unit in $(systemctl list-unit-files --type=service --no-legend 2>/dev/null \
        | awk '{print $1}' | grep -Ei 'frankenphp|octane|app-manager' | grep -v '@'); do
        unit_cmd="$(systemctl show -p ExecStart "$unit" 2>/dev/null || true)"
        # Discriminator (judged by the EXECUTED command, NEVER by unit
        # name): only a unit EXECUTING a frankenphp binary directly (the
        # deb's own `frankenphp run` Caddy server) is retired. The plane's
        # own runtime - artisan `octane:frankenphp` - merely
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
    return
}

# Staged candidate install (compile variant): build the dnspod binary via
# the official static builder, verify the candidate, then atomically
# install it at the compiled candidate path. Echoes the candidate binary
# path on success (empty on failure); every failure path keeps the live
# binary untouched. On a fresh host (no compiled path yet) the baseline
# is ANY usable binary - the official installer deb or the prebuilt
# cache - and the compiled path is created on first install.
fm_dnspod_candidate_install() {
    local binary=""
    local candidate=""
    local target=""

    target="$FRANKENPHP_COMPILED_CANDIDATE_PATH"
    binary="$(fm_resolve_binary_path "$FRANKENPHP_COMPILED_BINARY_PATH")"
    [ -n "$binary" ] || binary="$(fm_get_bootstrap_binary)"

    candidate="$(fm_dnspod_build_static)"
    if [ -z "$candidate" ]; then
        echo "[$SCRIPT_INDEX] [WARN] dnspod module deferred (official static build failed; the stderr log above carries the kept workdir path)"
        echo ""
        return
    fi

    # Candidate sanity BEFORE touching the live runtime: must execute and
    # carry the module + the phar floor.
    if [ "$(fm_binary_usable "$candidate")" != "yes" ] \
        || [ "$(fm_module_in_bin "$candidate" "$FRANKENPHP_DNSPOD_MODULE")" != "yes" ] \
        || [ "$(fm_embedded_extension_loaded "$candidate" phar)" != "yes" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] rebuilt binary failed the version/module/phar probe; keeping $binary"
        rm -rf "$(dirname "$candidate")"
        echo ""
        return
    fi

    # Candidate replacement is isolated from the canonical payload. The
    # central commit performs the only live-path promotion.
    $USE_SUDO mkdir -p "$(dirname "$target")"
    $USE_SUDO cp "$candidate" "${target}.dnspod-new"
    $USE_SUDO chmod 755 "${target}.dnspod-new"
    $USE_SUDO mv -f "${target}.dnspod-new" "$target"
    rm -rf "$(dirname "$candidate")"
    echo "[$SCRIPT_INDEX] compiled candidate staged ($("$target" version 2>/dev/null | sed -n '1p'))"
    echo "$target"
}

# Ensure the dnspod ACME DNS-01 module is embedded in the frankenphp
# binary (compile-variant convergence; the prebuilt variant converges via
# acme.sh DNS-01 instead and never rebuilds). Order (each step its own
# idempotent probe): variant policy -> token mirror -> compile bootstrap ->
# completeness probe -> staged rebuild
# + install. This is candidate preparation only: it never changes the owner,
# runtime links, services or packages. The central lifecycle commits and
# retires variants after this probe converges.
fm_ensure_dnspod_module() {
    local binary=""
    local candidate=""

    # Mirror the shared secret-file token into the runtime store first
    # (idempotent; covers the 93 compile path, 175 re-uses fm_dns01_ensure).
    fm_dnspod_token_ensure
    fm_compile_baseline_ensure
    binary="$(fm_resolve_binary_path "$FRANKENPHP_COMPILED_CANDIDATE_PATH")"
    if [ -n "$binary" ] && [ "$(fm_binary_compile_complete "$binary")" = "yes" ]; then
        echo "[$SCRIPT_INDEX] compiled candidate already ready (phar/pcntl/dnspod present)"
        return
    fi
    binary="$(fm_resolve_binary_path "$FRANKENPHP_COMPILED_BINARY_PATH")"
    if [ -n "$binary" ] && [ "$(fm_binary_compile_complete "$binary")" = "yes" ]; then
        echo "[$SCRIPT_INDEX] dnspod module already embedded (phar/pcntl present)"
        return
    fi

    candidate="$(fm_dnspod_candidate_install)"
    if [ -z "$candidate" ]; then
        return
    fi
    echo "[$SCRIPT_INDEX] compiled candidate prepared: ${candidate}"
}

# Single Mercure hub stanza: literal HS256 keys from the
# RuntimeConfigurationStore (official flat syntax of the embedded
# mercure/caddy module v0.24.x). It is rendered once on the direct backend;
# HTTPS and managed domains proxy the well-known path to that same hub.
# SYNC CONTRACT: ServerManagerV1FrankenPhpCaddyfileBuilder renders the
# identical stanza and proxy.
fm_mercure_config() {
    local mercure_transport=""
    local publisher_key=""
    local subscriber_key=""
    local cookie_name=""
    local cors_origins=""

    FM_MERCURE_STANZA=""
    if [ "$(type -t runtime_config_get)" != "function" ] \
        || [ -z "${VENDOR_AUTOLOAD:-}" ] || [ ! -f "$VENDOR_AUTOLOAD" ] \
        || [ -z "${BOOTSTRAP_APP:-}" ] || [ ! -f "$BOOTSTRAP_APP" ]; then
        return
    fi
    publisher_key="$(runtime_config_get "MERCURE_PUBLISHER_JWT" 2>/dev/null)"
    subscriber_key="$(runtime_config_get "MERCURE_SUBSCRIBER_JWT" 2>/dev/null)"
    if [ -z "$publisher_key" ] || [ -z "$subscriber_key" ]; then
        return
    fi
    cookie_name="$(sc_require realtime.mercure_cookie)"
    mercure_transport="$(sc_require realtime.mercure_transport)"
    cors_origins="$(web_access_config_list corsOrigins)"
    if [ -z "$cookie_name" ] || [ -z "$mercure_transport" ] || [ -z "$cors_origins" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] Mercure service contract is incomplete"
    else
        printf -v FM_MERCURE_STANZA '\tmercure {\n\t\ttransport %s\n\t\tpublisher_jwt %s HS256\n\t\tsubscriber_jwt %s HS256\n\t\tcors_origins %s\n\t\tcookie_name %s\n\t}\n\n' \
            "$mercure_transport" "$publisher_key" "$subscriber_key" "$cors_origins" "$cookie_name"
    fi
}

fm_octane_php_server_stanza() {
    printf -v FM_OCTANE_PHP_SERVER_STANZA '\tphp_server {\n\t\tindex frankenphp-worker.php\n\t\ttry_files {path} frankenphp-worker.php\n\t\trequest_body_timeout %s\n\t\tresolve_root_symlink\n\t}\n' \
        "$FRANKENPHP_REQUEST_BODY_TIMEOUT"
}

fm_caddy_reverse_proxy_handlers_render() {
    local upstream="$1"
    local early_hints_link="${2:-}"

    if [ -n "$early_hints_link" ]; then
        cat <<EOF
	route {
		@early_hints header Accept *text/html*
		header @early_hints Link "${early_hints_link}"
		respond @early_hints 103
		reverse_proxy ${upstream}
	}
EOF
        return
    fi

    printf '\treverse_proxy %s\n' "$upstream"
}

# Canonical Caddyfile render. The contract-owned internal TLS site is kept
# separate from public domain routes; one backend hub owns the Mercure
# transport and HTTPS routes proxy the well-known path to it.
# Args: 1 laravel_public_dir 2 https_port 3 admin_port 4 caddyfile_path
fm_caddyfile_render() {
    local laravel_public_dir="$1"
    local https_port="$2"
    local admin_port="$3"
    local caddyfile_path="$4"
    local caddyfile_dir=""
    local rendered=""
    local mercure_stanza=""
    local mercure_proxy=""
    local routes_dir=""
    local backend_port=""
    local import_stanza=""
    local internal_tls_host=""
    local octane_php_server_stanza=""
    local bind_host=""

    caddyfile_dir="$(dirname "$caddyfile_path")"
    internal_tls_host="$(sc_require hosts.localhost)"
    bind_host="$(sc_require hosts.any)"
    backend_port="$(sc_require ports.laravel_api_backend)"
    # One direct-backend hub owns the transport and native PHP publisher.
    fm_mercure_config
    mercure_stanza="$FM_MERCURE_STANZA"
    printf -v mercure_proxy '\troute {\n\t\t@mercure path /.well-known/mercure*\n\t\treverse_proxy @mercure http://%s:%s\n\t\tphp_server {\n\t\t\tindex frankenphp-worker.php\n\t\t\ttry_files {path} frankenphp-worker.php\n\t\t\trequest_body_timeout %s\n\t\t\tresolve_root_symlink\n\t\t}\n\t}\n' \
        "$(sc_require hosts.loopback)" "$backend_port" "$FRANKENPHP_REQUEST_BODY_TIMEOUT"
    fm_octane_php_server_stanza
    octane_php_server_stanza="$FM_OCTANE_PHP_SERVER_STANZA"

    # Direct HTTP backend block for LAN and local machine clients + the
    # per-domain route import (same routes dir the domain
    # renderer writes; gated on file presence - caddy errors on an
    # unmatched import glob). Byte-synced with the Laravel builder.
    routes_dir="${caddyfile_dir}/routes"
    import_stanza=""
    if compgen -G "${routes_dir}/*.caddy" > /dev/null 2>&1; then
        import_stanza="

# Per-domain route files (managed by fm_domain_ensure_route_file)
import ${routes_dir}/*.caddy"
    fi

    rendered="# Managed by core_node FrankenPHP Caddyfile contract
{
	admin localhost:${admin_port}
	auto_https disable_redirects
	grace_period 10s
	default_bind ${bind_host}
	servers ${bind_host}:${backend_port} {
		protocols h1
	}
	servers ${bind_host}:${https_port} {
		protocols h1 h2 h3
	}

	frankenphp {
		worker {
			file "${laravel_public_dir}/frankenphp-worker.php"
			{\$CADDY_SERVER_WORKER_DIRECTIVE}
			{\$CADDY_SERVER_WATCH_DIRECTIVES}
		}
	}
}

https://${internal_tls_host}:${https_port} {
	root * ${laravel_public_dir}
	encode zstd gzip

${mercure_proxy}}

# Direct HTTP catch-all backend (LAN and local machine clients)
:${backend_port} {
	root * ${laravel_public_dir}
	encode zstd gzip
${mercure_stanza}${octane_php_server_stanza}}${import_stanza}"

    FM_CADDYFILE_RENDERED="$rendered"
}

# Idempotent writer for the canonical render. Every caller uses this one
# fine-grained content comparison; a matching file never blocks later setup.
fm_caddyfile_ensure() {
    local laravel_public_dir="$1"
    local https_port="$2"
    local admin_port="$3"
    local caddyfile_path="$4"
    local caddyfile_dir=""
    local rendered=""
    local existing=""
    local file_mode=""

    FM_CADDYFILE_READY="no"
    caddyfile_dir="$(dirname "$caddyfile_path")"
    if [ ! -d "$caddyfile_dir" ]; then
        mkdir -p "$caddyfile_dir"
    fi
    if [ ! -d "$caddyfile_dir" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] Caddyfile directory was not created: $caddyfile_dir"
    else
        fm_caddyfile_render "$laravel_public_dir" "$https_port" "$admin_port" "$caddyfile_path"
        rendered="$FM_CADDYFILE_RENDERED"
        [ -f "$caddyfile_path" ] && existing="$(cat "$caddyfile_path")"
        if [ "$existing" != "$rendered" ]; then
            printf '%s\n' "$rendered" > "$caddyfile_path"
        fi

        # File permission is an independent idempotent step: canonical
        # content never suppresses repair of a drifted secret-file mode.
        if [ -f "$caddyfile_path" ]; then
            chmod 600 "$caddyfile_path"
            existing="$(cat "$caddyfile_path")"
            file_mode="$(stat -c '%a' "$caddyfile_path" 2>/dev/null)"
        fi
        if [ "$existing" = "$rendered" ] && [ "$file_mode" = "600" ]; then
            FM_CADDYFILE_READY="yes"
            echo "[$SCRIPT_INDEX] Caddyfile canonical with private permissions: $caddyfile_path"
        else
            echo "[$SCRIPT_INDEX] [ERROR] Caddyfile convergence failed: $caddyfile_path"
        fi
    fi
}

