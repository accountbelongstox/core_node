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
FRANKENPHP_FRANKENPHP_IMPORT="github.com/dunglas/frankenphp"
XCADDY_BIN_CANDIDATES="/usr/local/bin/xcaddy /usr/bin/xcaddy"
GO_BIN_CANDIDATES="/usr/local/bin/go /usr/bin/go /usr/lib/go/bin/go"
FRANKENPHP_BACKUP_SUFFIX=".pre-dnspod"

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
    local modules=""
    modules="$(fm_list_modules)"
    [ -n "$modules" ] && echo "$modules" | grep -q "^${module_name}\$"
}

# Rebuild the binary with the DNSPod ACME DNS module when missing. Requires
# a Go toolchain; skips with a warning when absent (HTTP-01 still works via
# the built-in ACME while DNS-01 waits for the toolchain).
fm_ensure_dnspod_module() {
    local binary=""
    local xcaddy_bin=""
    local go_bin=""
    local build_tmp=""

    binary="$(fm_get_binary)"
    if [ -z "$binary" ]; then
        echo "[$SCRIPT_INDEX] [WARN] no frankenphp binary; run fm_install first"
        return 1
    fi
    if fm_has_module "$FRANKENPHP_DNSPOD_MODULE"; then
        echo "[$SCRIPT_INDEX] dnspod module already embedded"
        return 0
    fi

    for go_bin in $GO_BIN_CANDIDATES; do
        [ -x "$go_bin" ] && break
    done
    if [ ! -x "$go_bin" ]; then
        echo "[$SCRIPT_INDEX] [WARN] no Go toolchain found; dnspod module build skipped (install golang-go and re-run)"
        return 1
    fi

    for xcaddy_bin in $XCADDY_BIN_CANDIDATES; do
        [ -x "$xcaddy_bin" ] && break
    done
    if [ ! -x "$xcaddy_bin" ]; then
        echo "[$SCRIPT_INDEX] Installing xcaddy via go install"
        "$go_bin" install github.com/caddyserver/xcaddy/cmd/xcaddy@latest
        for xcaddy_bin in $XCADDY_BIN_CANDIDATES; do
            [ -x "$xcaddy_bin" ] && break
        done
    fi
    if [ ! -x "$xcaddy_bin" ]; then
        echo "[$SCRIPT_INDEX] [WARN] xcaddy unavailable; dnspod module build skipped"
        return 1
    fi

    echo "[$SCRIPT_INDEX] Building frankenphp with dnspod module (xcaddy)"
    build_tmp="$(mktemp -d)"
    "$xcaddy_bin" build \
        --with "$FRANKENPHP_FRANKENPHP_IMPORT" \
        --with "$FRANKENPHP_DNSPOD_IMPORT" \
        --output "$build_tmp/frankenphp"
    if [ -x "$build_tmp/frankenphp" ]; then
        $USE_SUDO cp "$binary" "${binary}${FRANKENPHP_BACKUP_SUFFIX}"
        $USE_SUDO cp "$build_tmp/frankenphp" "$binary"
        rm -rf "$build_tmp"
        if fm_has_module "$FRANKENPHP_DNSPOD_MODULE"; then
            echo "[$SCRIPT_INDEX] dnspod module embedded (previous binary kept at ${binary}${FRANKENPHP_BACKUP_SUFFIX})"
        else
            echo "[$SCRIPT_INDEX] [ERROR] rebuilt binary still lacks the dnspod module"
            return 1
        fi
    else
        rm -rf "$build_tmp"
        echo "[$SCRIPT_INDEX] [ERROR] xcaddy build produced no binary"
        return 1
    fi
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

    caddyfile_dir="$(dirname "$caddyfile_path")"
    if [ ! -d "$caddyfile_dir" ]; then
        mkdir -p "$caddyfile_dir"
    fi

    rendered="# Managed by frankenphp_manager.sh (SYNC: ServerManagerV1FrankenPhpManagerCtl)
{
	admin localhost:${admin_port}
	auto_https disable_redirects
}

https://${site_host}:${https_port} {
	root * ${laravel_public_dir}
	encode zstd gzip

	mercure {
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

fm_verify() {
    local binary=""
    binary="$(fm_get_binary)"
    if [ -z "$binary" ]; then
        echo "[$SCRIPT_INDEX] [VERIFY] frankenphp binary: MISSING"
        return 1
    fi
    echo "[$SCRIPT_INDEX] [VERIFY] binary: $binary ($(fm_version))"
    echo "[$SCRIPT_INDEX] [VERIFY] dnspod module: $(fm_has_module "$FRANKENPHP_DNSPOD_MODULE" && echo embedded || echo missing)"
    echo "[$SCRIPT_INDEX] [VERIFY] plane: $(web_server_plane)"
}
