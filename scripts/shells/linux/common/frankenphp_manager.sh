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
#   fm_get_binary / fm_installed / fm_version        binary file probes
#   fm_install                                       official installer
#   fm_list_modules / fm_has_module                  embedded Caddy modules
#   fm_ensure_dnspod_module                          xcaddy build w/ dnspod
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

FRANKENPHP_BIN_CANDIDATES="/usr/local/bin/frankenphp /usr/bin/frankenphp"
FRANKENPHP_INSTALL_URL="https://frankenphp.dev/install.sh"
FRANKENPHP_DNSPOD_IMPORT="github.com/caddy-dns/dnspod"
FRANKENPHP_DNSPOD_MODULE="dns.providers.dnspod"
FRANKENPHP_DNSPOD_TOKEN_KEY="DNSPOD_TOKEN"
FRANKENPHP_FRANKENPHP_IMPORT="github.com/dunglas/frankenphp"
# Official static-build xcaddy args (frankenphp.dev/docs/static): a custom
# XCADDY_ARGS must re-include the modules the Caddyfile relies on - the
# mercure hub directive - plus the dnspod DNS-01 provider.
FRANKENPHP_STATIC_XCADDY_ARGS="--with github.com/caddy-dns/dnspod --with github.com/dunglas/mercure/caddy"
FRANKENPHP_STATIC_REPO="https://github.com/php/frankenphp"
XCADDY_BIN_CANDIDATES="/usr/local/bin/xcaddy /usr/bin/xcaddy"
XCADDY_GO_MODULE="github.com/caddyserver/xcaddy/cmd/xcaddy"
GO_BIN_CANDIDATES="/usr/local/bin/go /usr/local/go/bin/go /usr/bin/go /usr/lib/go/bin/go"
DOCKER_BIN_CANDIDATES="/usr/bin/docker /usr/local/bin/docker"
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

fm_installed() {
    local binary=""
    binary="$(fm_get_binary)"
    [ -n "$binary" ]
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
    binary="$(fm_get_binary)"
    if [ -n "$binary" ]; then
        "$binary" php-cli -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;' 2>/dev/null
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
# 34_configure_php85.sh; the runtime exports it as PHP_INI_SCAN_DIR).
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

# Official installer (frankenphp.dev); idempotent via the binary probe.
fm_install() {
    local binary=""
    binary="$(fm_get_binary)"
    if [ -n "$binary" ]; then
        echo "[$SCRIPT_INDEX] frankenphp already installed: $binary ($(fm_version))"
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

# Go toolchain path (empty when absent) - file probing only.
fm_go_bin() {
    local candidate=""
    for candidate in $GO_BIN_CANDIDATES; do
        if [ -x "$candidate" ]; then
            echo "$candidate"
            return 0
        fi
    done
    echo ""
}

# GOPATH root (where `go install` places module binaries by default).
fm_go_gopath() {
    local go_bin=""
    go_bin="$(fm_go_bin)"
    if [ -n "$go_bin" ]; then
        "$go_bin" env GOPATH 2>/dev/null
        return 0
    fi
    echo "${HOME:-/root}/go"
}

# xcaddy binary path (empty when absent); probes the fixed candidates plus
# the GOPATH bin location.
fm_xcaddy_bin() {
    local candidate=""
    local gopath_bin=""
    for candidate in $XCADDY_BIN_CANDIDATES; do
        if [ -x "$candidate" ]; then
            echo "$candidate"
            return 0
        fi
    done
    gopath_bin="$(fm_go_gopath)/bin/xcaddy"
    if [ -x "$gopath_bin" ]; then
        echo "$gopath_bin"
        return 0
    fi
    echo ""
}

# Ensure xcaddy exists. Idempotent per step: probe -> go probe ->
# GOBIN=/usr/local/bin install -> re-probe (including the GOPATH bin spot
# for non-root installs). Trusts the file probe after each step.
fm_ensure_xcaddy() {
    local go_bin=""
    local xcaddy_bin=""

    xcaddy_bin="$(fm_xcaddy_bin)"
    if [ -n "$xcaddy_bin" ]; then
        echo "[$SCRIPT_INDEX] xcaddy already installed: $xcaddy_bin"
        return 0
    fi
    go_bin="$(fm_go_bin)"
    if [ -z "$go_bin" ]; then
        echo "[$SCRIPT_INDEX] [WARN] no Go toolchain found (golang not installed); xcaddy not installed"
        return 1
    fi
    echo "[$SCRIPT_INDEX] Installing xcaddy (go install -> /usr/local/bin)"
    $USE_SUDO env GOBIN=/usr/local/bin "$go_bin" install "${XCADDY_GO_MODULE}@latest"
    xcaddy_bin="$(fm_xcaddy_bin)"
    if [ -n "$xcaddy_bin" ]; then
        echo "[$SCRIPT_INDEX] xcaddy installed: $xcaddy_bin"
        return 0
    fi
    echo "[$SCRIPT_INDEX] [WARN] xcaddy unavailable after go install"
    return 1
}

# Version tag of the running binary ("v1.12.7"; empty when unparsable) -
# pins the static rebuild to the SAME frankenphp release.
fm_version_tag() {
    fm_version | sed -n 's/.*\(v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\).*/\1/p' | head -n 1
}

# Docker availability probe (binary present + daemon responding).
fm_docker_ready() {
    local candidate=""
    for candidate in $DOCKER_BIN_CANDIDATES; do
        if [ -x "$candidate" ]; then
            "$candidate" info >/dev/null 2>&1 && return 0
            return 1
        fi
    done
    return 1
}

# Official static rebuild (frankenphp.dev/docs/static) - THE standard path:
# docker buildx bake static-builder-musl with XCADDY_ARGS carrying the
# dnspod module. Fully self-contained - the builder image ships its own
# golang + static-php toolchains (GOTOOLCHAIN=local), so NOTHING on the
# host (Go, PHP headers) is consulted - while the source checkout is
# pinned to the tag of the RUNNING host binary (fm_version_tag), so the
# rebuild always matches the installed version exactly. The musl
# fully-static binary runs on ubuntu/debian/kali alike and keeps the
# embedded PHP. Echoes the candidate binary path (empty on failure); the
# caller probes it before installing.
fm_dnspod_build_static() {
    local version_tag=""
    local work_dir=""
    local arch=""
    local container_name=""

    version_tag="$(fm_version_tag)"
    work_dir="$(mktemp -d)"
    arch="$(uname -m)"
    container_name="frankenphp-static-builder-$$"

    echo "[$SCRIPT_INDEX] [dnspod] official static build (docker buildx bake static-builder-musl${version_tag:+ " at ${version_tag}"})"
    if ! git clone --quiet --depth 1 ${version_tag:+--branch "$version_tag"} \
        "$FRANKENPHP_STATIC_REPO" "$work_dir/src" 2>/dev/null; then
        echo "[$SCRIPT_INDEX] [dnspod] [WARN] frankenphp source clone failed"
        rm -rf "$work_dir"
        return 1
    fi
    if ! (cd "$work_dir/src" && docker buildx bake --load \
        ${version_tag:+--set "static-builder-musl.args.FRANKENPHP_VERSION=$version_tag"} \
        --set "static-builder-musl.args.XCADDY_ARGS=$FRANKENPHP_STATIC_XCADDY_ARGS" \
        static-builder-musl); then
        echo "[$SCRIPT_INDEX] [dnspod] [WARN] docker buildx bake failed"
        rm -rf "$work_dir"
        return 1
    fi
    $USE_SUDO docker rm -f "$container_name" >/dev/null 2>&1
    if ! $USE_SUDO docker create --name "$container_name" dunglas/frankenphp:static-builder-musl >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] [dnspod] [WARN] baked image container create failed"
        rm -rf "$work_dir"
        return 1
    fi
    $USE_SUDO docker cp "$container_name:/go/src/app/dist/frankenphp-linux-${arch}" "$work_dir/frankenphp" >/dev/null 2>&1
    $USE_SUDO docker rm -f "$container_name" >/dev/null 2>&1
    if [ -x "$work_dir/frankenphp" ]; then
        echo "$work_dir/frankenphp"
    else
        echo "[$SCRIPT_INDEX] [dnspod] [WARN] static binary not found in the baked image"
        rm -rf "$work_dir"
        echo ""
    fi
}

# Native xcaddy rebuild (frankenphp.dev/docs/compile) - the docker-LESS
# FALLBACK only (the docker static build above is the official standard
# path); requires the host go >= 1.26 toolchain + libphp.so headers
# (php-config). Echoes the candidate binary path (empty on failure).
fm_dnspod_build_native() {
    local xcaddy_bin=""
    local php_config=""
    local build_dir=""

    fm_ensure_xcaddy || return 1
    xcaddy_bin="$(fm_xcaddy_bin)"
    if [ -z "$xcaddy_bin" ]; then
        return 1
    fi
    php_config=""
    if [ -x /usr/bin/php-config ]; then
        php_config="/usr/bin/php-config"
    elif [ -x /usr/local/bin/php-config ]; then
        php_config="/usr/local/bin/php-config"
    fi
    if [ -z "$php_config" ]; then
        echo "[$SCRIPT_INDEX] [dnspod] native build needs php-config (libphp.so toolchain); not present"
        return 1
    fi
    echo "[$SCRIPT_INDEX] [dnspod] native xcaddy build (libphp.so via $php_config)"
    build_dir="$(mktemp -d)"
    if ! (cd "$build_dir" && CGO_ENABLED=1 \
        XCADDY_GO_BUILD_FLAGS="-ldflags='-w -s' -tags=nobadger,nomysql,nopgx" \
        CGO_CFLAGS="$($php_config --includes)" \
        CGO_LDFLAGS="$($php_config --ldflags) $($php_config --libs)" \
        "$xcaddy_bin" build \
            --with "${FRANKENPHP_FRANKENPHP_IMPORT}/caddy" \
            --with "$FRANKENPHP_DNSPOD_IMPORT" \
            --output "$build_dir/frankenphp"); then
        echo "[$SCRIPT_INDEX] [dnspod] [WARN] native xcaddy build failed"
        rm -rf "$build_dir"
        return 1
    fi
    if [ -x "$build_dir/frankenphp" ]; then
        echo "$build_dir/frankenphp"
    else
        rm -rf "$build_dir"
        echo ""
    fi
}

# DNSPod API token from the shared RuntimeConfigurationStore (format
# "id,token"; the VALUE is never logged and never rendered into the
# Caddyfile - only the {env.DNSPOD_TOKEN} placeholder is). Empty when unset
# or when the Laravel app context is not available yet (fresh install);
# the runtime branch re-renders the Caddyfile once it is.
fm_dnspod_token_value() {
    if [ -n "$PHP_BIN" ] && [ -x "$PHP_BIN" ] \
        && [ -n "$VENDOR_AUTOLOAD" ] && [ -f "$VENDOR_AUTOLOAD" ]; then
        runtime_config_get "$FRANKENPHP_DNSPOD_TOKEN_KEY"
    fi
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

# Ensure the dnspod ACME DNS-01 module is embedded in the frankenphp
# binary. Order (each step its own idempotent probe): already embedded ->
# official docker static build -> native libphp rebuild. A failed path
# defers with a warning - the built-in ACME (TLS-ALPN-01/HTTP-01) keeps
# issuing certificates meanwhile.
fm_ensure_dnspod_module() {
    local binary=""
    local candidate=""

    binary="$(fm_get_binary)"
    if [ -z "$binary" ]; then
        echo "[$SCRIPT_INDEX] [WARN] no frankenphp binary; run fm_install first"
        return 1
    fi
    if fm_module_in_bin "$binary" "$FRANKENPHP_DNSPOD_MODULE"; then
        echo "[$SCRIPT_INDEX] dnspod module already embedded"
        return 0
    fi

    candidate=""
    if fm_docker_ready; then
        candidate="$(fm_dnspod_build_static)"
    else
        echo "[$SCRIPT_INDEX] [dnspod] docker not available; trying the native libphp build"
    fi
    if [ -z "$candidate" ]; then
        candidate="$(fm_dnspod_build_native)"
    fi
    if [ -z "$candidate" ]; then
        echo "[$SCRIPT_INDEX] [WARN] dnspod module deferred (needs docker for the official static build, or Go + php-config for a native rebuild)"
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
    fm_store_info
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

    rendered="# Managed by frankenphp_manager.sh (SYNC: ServerManagerV1FrankenPhpManagerCtl)
{
	admin localhost:${admin_port}
	auto_https disable_redirects
}

https://${site_host}:${https_port} {
	root * ${laravel_public_dir}
	encode zstd gzip

${dnspod_tls}	mercure {
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
        caddyfile)
            shift
            fm_caddyfile_ensure "$@"
            ;;
        status|verify|*)
            fm_verify
            ;;
    esac
fi
