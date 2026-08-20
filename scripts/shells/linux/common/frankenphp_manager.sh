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
# SECRETS: the Mercure HS256 keys are read from the
# RuntimeConfigurationStore and embedded as LITERAL publisher_jwt /
# subscriber_jwt values (official flat syntax of the embedded
# mercure/caddy module v0.24.x) - the 0600 Caddyfile is the only on-disk
# copy next to the store itself; no process env, no .env. Keys are
# provisioned (never rotated) by the laravel_main provisioner
# (RelayHubKeyProvisioner) through the runtime_config_common adapter.
#
# SYNC CONTRACT: Caddyfile/mercure semantics are shared with the Laravel end
# (ServerManagerV1FrankenPhpCaddyfileBuilder); change both ends together.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_INDEX="${SCRIPT_INDEX:-frankenphp-mgr}"

source "$SCRIPT_CURRENT_DIR/gvar_common.sh"
# shellcheck source=/dev/null
source "$SCRIPT_CURRENT_DIR/service_contract_common.sh"
# shellcheck source=/dev/null
source "$SCRIPT_CURRENT_DIR/frankenphp_install_modes.sh"
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
# Mercure hub module version follows the central runtime contract.
FRANKENPHP_MERCURE_VERSION="$(sc_require versions.mercure)"
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

# Canonical payload path for one variant. This is the only mapping between
# variant state and executable location.
fm_variant_binary_path() {
    local variant=""

    variant="${1:-$(fm_variant)}"
    case "$variant" in
        "$FRANKENPHP_INSTALL_MODE_APT") echo "$FRANKENPHP_APT_BINARY_PATH" ;;
        "$FRANKENPHP_INSTALL_MODE_COMPILE") echo "$FRANKENPHP_COMPILED_BINARY_PATH" ;;
        "$FRANKENPHP_INSTALL_MODE_PREBUILT") echo "$FRANKENPHP_PREBUILT_BINARY_PATH" ;;
        *) echo "" ;;
    esac
}

# Staged path for variants that can prepare an executable independently from
# their live canonical payload. Deb packages own /usr/bin directly and have no
# separate promotion path.
fm_variant_candidate_path() {
    local variant=""

    variant="$1"
    case "$variant" in
        "$FRANKENPHP_INSTALL_MODE_COMPILE") echo "$FRANKENPHP_COMPILED_CANDIDATE_PATH" ;;
        "$FRANKENPHP_INSTALL_MODE_PREBUILT") echo "$FRANKENPHP_PREBUILT_CANDIDATE_PATH" ;;
        *) echo "" ;;
    esac
}

# DNS-01 ownership policy for one variant.
fm_variant_dns01_mode() {
    local variant=""

    variant="${1:-$(fm_variant)}"
    case "$variant" in
        "$FRANKENPHP_INSTALL_MODE_APT"|"$FRANKENPHP_INSTALL_MODE_PREBUILT")
            echo "$FRANKENPHP_DNS01_MODE_ACME_SH"
            ;;
        "$FRANKENPHP_INSTALL_MODE_COMPILE")
            echo "$FRANKENPHP_DNS01_MODE_EMBEDDED"
            ;;
        *)
            echo "$FRANKENPHP_DNS01_MODE_BUILTIN"
            ;;
    esac
}

# Unselected binary discovery exists only for the first compiled build's
# version/PHP bootstrap. Runtime code never calls this resolver.
fm_get_bootstrap_binary() {
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

# Exact active binary. Once a variant is recorded, missing payloads remain
# missing instead of falling through to retained files from another mode.
fm_get_binary() {
    local variant=""
    local variant_path=""

    variant="$(fm_variant)"
    variant_path="$(fm_variant_binary_path "$variant")"
    if [ -n "$variant_path" ]; then
        fm_resolve_binary_path "$variant_path"
        return 0
    fi
    fm_get_bootstrap_binary
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
    local candidate=""
    local version_line=""

    candidate="$1"
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
        version_line="$("$candidate" version 2>/dev/null | sed -n '1p')"
    fi
    case "$version_line" in
        FrankenPHP*) echo "yes" ;;
        *) echo "no" ;;
    esac
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
        "$FRANKENPHP_INSTALL_MODE_COMPILE"|"$FRANKENPHP_INSTALL_MODE_PREBUILT"|"$FRANKENPHP_INSTALL_MODE_APT") echo "$variant" ;;
        *)
            resolved="$(fm_resolve_binary_path "$FRANKENPHP_LINK_PATH")"
            if [ -n "$resolved" ] \
                && [ "$resolved" = "$(fm_resolve_binary_path "$FRANKENPHP_COMPILED_BINARY_PATH")" ]; then
                echo "$FRANKENPHP_INSTALL_MODE_COMPILE"
            elif [ -n "$resolved" ] \
                && [ "$resolved" = "$(fm_resolve_binary_path "$FRANKENPHP_PREBUILT_BINARY_PATH")" ]; then
                echo "$FRANKENPHP_INSTALL_MODE_PREBUILT"
            elif [ -x /usr/bin/frankenphp ]; then
                echo "$FRANKENPHP_INSTALL_MODE_APT"
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
        "$FRANKENPHP_INSTALL_MODE_COMPILE"|"$FRANKENPHP_INSTALL_MODE_PREBUILT"|"$FRANKENPHP_INSTALL_MODE_APT")
            set_global_var "$FRANKENPHP_VARIANT_KEY" "$1" 'false'
            ;;
    esac
}

# Installed-state probe for one deb package. Package preparation and cleanup
# both use this string contract so each package is an independent idempotent
# step; no aggregate command status becomes lifecycle state.
fm_apt_package_installed() {
    local package=""
    local package_state=""

    package="$1"
    package_state="$(dpkg-query -W -f='${Status}' "$package" 2>/dev/null)"
    if [ "$package_state" = "install ok installed" ]; then
        echo "yes"
    else
        echo "no"
    fi
}

# Candidate readiness is intentionally stricter than file presence. The apt
# variant owns every declared package, the compiled variant owns the custom
# module and embedded-runtime floor, and the prebuilt variant owns a usable
# release binary. This probe never consults the current owner record.
fm_variant_binary_ready() {
    local variant=""
    local binary=""
    local package=""
    local ready="yes"
    local requested_version=""
    local prepared_version=""
    local binary_version=""

    variant="$1"
    binary="$(fm_resolve_binary_path "$2")"
    if [ "$(fm_binary_usable "$binary")" != "yes" ]; then
        echo "no"
        return
    fi

    case "$variant" in
        "$FRANKENPHP_INSTALL_MODE_APT")
            for package in "${FRANKENPHP_APT_PACKAGES[@]}"; do
                if [ "$(fm_apt_package_installed "$package")" != "yes" ]; then
                    ready="no"
                fi
            done
            ;;
        "$FRANKENPHP_INSTALL_MODE_COMPILE")
            ready="$(fm_binary_compile_complete "$binary")"
            ;;
        "$FRANKENPHP_INSTALL_MODE_PREBUILT")
            if [ -f "$FRANKENPHP_PREBUILT_REQUEST_STATE" ]; then
                requested_version="$(cat "$FRANKENPHP_PREBUILT_REQUEST_STATE" 2>/dev/null)"
                prepared_version="$(cat "$FRANKENPHP_PREBUILT_READY_STATE" 2>/dev/null)"
                binary_version="$(fm_version_tag_of "$binary")"
                if [ -z "$requested_version" ] || [ "$prepared_version" != "$requested_version" ]; then
                    ready="no"
                elif [ "$requested_version" != "latest" ] && [ "$binary_version" != "$requested_version" ]; then
                    ready="no"
                fi
            fi
            ;;
        *)
            ready="no"
            ;;
    esac
    if [ "$ready" = "yes" ] && [ "$(fm_php_runtime_extensions_ready "$binary")" != "yes" ]; then
        ready="no"
    fi
    echo "$ready"
}

fm_variant_prepared_binary() {
    local variant=""
    local candidate=""
    local canonical=""

    variant="$1"
    candidate="$(fm_resolve_binary_path "$(fm_variant_candidate_path "$variant")")"
    canonical="$(fm_resolve_binary_path "$(fm_variant_binary_path "$variant")")"
    if [ -n "$candidate" ] && [ "$(fm_variant_binary_ready "$variant" "$candidate")" = "yes" ]; then
        echo "$candidate"
    else
        echo "$canonical"
    fi
}

fm_variant_ready() {
    local variant=""
    local prepared_binary=""

    variant="$1"
    prepared_binary="$(fm_variant_prepared_binary "$variant")"
    fm_variant_binary_ready "$variant" "$prepared_binary"
}

# The runtime contract is file-backed: selected owner, canonical executable
# target and both embedded-PHP shims must agree. Callers use this probe after
# commit and before retiring any non-owner payload.
fm_runtime_contract_ready() {
    local variant=""
    local binary=""
    local linked_binary=""
    local shim=""
    local shim_content=""
    local scan_path=""
    local ready="yes"

    variant="${1:-$(fm_variant)}"
    binary="$(fm_resolve_binary_path "$(fm_variant_binary_path "$variant")")"
    linked_binary="$(fm_resolve_binary_path "$FRANKENPHP_LINK_PATH")"
    scan_path="$(fm_php_ini_scan_path)"
    if [ "$(fm_variant)" != "$variant" ] || [ -z "$binary" ] || [ "$linked_binary" != "$binary" ] \
        || [ "$(fm_variant_binary_ready "$variant" "$binary")" != "yes" ]; then
        ready="no"
    fi
    for shim in "$FRANKENPHP_PHP_SHIM_PATH" "$FRANKENPHP_PHP_CLI_SHIM_PATH"; do
        shim_content=""
        if [ -f "$shim" ]; then
            shim_content="$(cat "$shim" 2>/dev/null)"
        fi
        case "$shim_content" in
            *"exec ${binary} ${FRANKENPHP_PHP_RUNTIME_SUBCMD}"*) ;;
            *) ready="no" ;;
        esac
        case "$shim_content" in
            *"export PHP_INI_SCAN_DIR=\"${scan_path}\""*) ;;
            *) ready="no" ;;
        esac
    done
    echo "$ready"
}

# Commit one prepared candidate. The candidate is re-probed before any owner
# mutation. Links and shims converge first, then the file-backed owner record
# is written last. A failed record write restores the previous runtime paths;
# inactive payload cleanup is deliberately a separate post-commit phase.
fm_variant_commit() {
    local target_variant=""
    local previous_variant=""
    local target_binary=""
    local previous_binary=""
    local prepared_binary=""
    local candidate_path=""
    local previous_payload=""
    local restored_version=""

    target_variant="$1"
    previous_variant="$(fm_variant)"
    target_binary="$(fm_variant_binary_path "$target_variant")"
    prepared_binary="$(fm_variant_prepared_binary "$target_variant")"
    candidate_path="$(fm_variant_candidate_path "$target_variant")"
    previous_payload="${target_binary}.previous"
    previous_binary="$(fm_resolve_binary_path "$(fm_variant_binary_path "$previous_variant")")"

    if [ "$(fm_variant_ready "$target_variant")" != "yes" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] candidate is not ready; owner remains ${previous_variant:-unrecorded}: ${target_variant}"
        return
    fi

    if [ -n "$candidate_path" ] && [ "$prepared_binary" = "$(fm_resolve_binary_path "$candidate_path")" ]; then
        $USE_SUDO mkdir -p "$(dirname "$target_binary")"
        if [ -x "$target_binary" ]; then
            $USE_SUDO cp "$target_binary" "$previous_payload"
            $USE_SUDO chmod 755 "$previous_payload"
        fi
        $USE_SUDO mv -f "$candidate_path" "$target_binary"
    fi
    target_binary="$(fm_resolve_binary_path "$target_binary")"
    if [ "$(fm_variant_binary_ready "$target_variant" "$target_binary")" != "yes" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] candidate promotion failed; owner remains ${previous_variant:-unrecorded}"
        if [ -x "$previous_payload" ]; then
            $USE_SUDO mv -f "$previous_payload" "$(fm_variant_binary_path "$target_variant")"
        fi
        return
    fi

    fm_unlink_frankenphp_runtime
    fm_ensure_local_bin_link "$target_binary"
    fm_ensure_php_cli_shim "$target_binary"
    fm_php_ini_ensure
    fm_variant_set "$target_variant"

    if [ "$(fm_runtime_contract_ready "$target_variant")" = "yes" ]; then
        if [ -f "$previous_payload" ]; then
            $USE_SUDO rm -f "$previous_payload"
        fi
        echo "[$SCRIPT_INDEX] variant committed: ${target_variant} -> ${target_binary}"
        return
    fi

    echo "[$SCRIPT_INDEX] [ERROR] owner commit did not converge; restoring ${previous_variant:-unrecorded} runtime paths"
    if [ "$previous_variant" = "$target_variant" ] && [ -x "$previous_payload" ]; then
        $USE_SUDO mv -f "$previous_payload" "$(fm_variant_binary_path "$target_variant")"
        previous_binary="$(fm_resolve_binary_path "$(fm_variant_binary_path "$previous_variant")")"
        if [ "$previous_variant" = "$FRANKENPHP_INSTALL_MODE_PREBUILT" ]; then
            restored_version="$(fm_version_tag_of "$previous_binary")"
            printf '%s\n' "$restored_version" | $USE_SUDO tee "$FRANKENPHP_PREBUILT_REQUEST_STATE" >/dev/null
            printf '%s\n' "$restored_version" | $USE_SUDO tee "$FRANKENPHP_PREBUILT_READY_STATE" >/dev/null
        fi
        fm_variant_set "$previous_variant"
        fm_ensure_local_bin_link "$previous_binary"
        fm_ensure_php_cli_shim "$previous_binary"
        return
    fi
    if [ -n "$previous_variant" ] && [ "$(fm_variant_ready "$previous_variant")" = "yes" ]; then
        fm_variant_set "$previous_variant"
        fm_ensure_local_bin_link "$previous_binary"
        fm_ensure_php_cli_shim "$previous_binary"
    fi
}

# Exact binary owned by the selected variant. Runtime launchers use this
# strict resolver so a missing selected payload fails closed instead of
# executing a retained payload from another installation mode.
fm_variant_binary() {
    local variant_path=""

    variant_path="$(fm_variant_binary_path)"
    if [ -n "$variant_path" ]; then
        fm_resolve_binary_path "$variant_path"
        return 0
    fi
    fm_get_binary
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
fm_php_version_of() {
    local binary="$1"
    local tmp=""

    if [ -n "$binary" ]; then
        # File mode only: the static php-cli runner accepts neither -r nor -v.
        tmp="$(mktemp "${TMPDIR:-/tmp}/fm_php_ver.XXXXXX.php")"
        printf '<?php echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;' > "$tmp"
        "$binary" php-cli "$tmp" 2>/dev/null
        rm -f "$tmp"
    fi
}

fm_php_version() {
    fm_php_version_of "$(fm_get_binary)"
}

# Full embedded PHP version (for package/tool metadata that requires the patch
# component). Keep the major.minor probe above as the static builder contract.
fm_php_full_version_of() {
    local binary=""
    local tmp=""

    binary="$1"
    if [ -n "$binary" ]; then
        tmp="$(mktemp "${TMPDIR:-/tmp}/fm_php_full_ver.XXXXXX.php")"
        printf '<?php echo PHP_VERSION;' > "$tmp"
        PHP_INI_SCAN_DIR="$(fm_php_ini_scan_path)" "$binary" php-cli "$tmp" 2>/dev/null
        rm -f "$tmp"
    fi
}

fm_php_full_version() {
    fm_php_full_version_of "$(fm_get_binary)"
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
    local size=""
    local tmp_shim=""

    binary="$(fm_resolve_binary_path "${1:-$(fm_get_binary)}")"
    if [ -z "$binary" ]; then
        echo "[$SCRIPT_INDEX] [WARN] no selected frankenphp binary; php-cli shim not created (run step 93 first)"
        return 0
    fi
    for shim in php php-cli; do
        wanted="#!/usr/bin/env bash
args=()
export PHP_INI_SCAN_DIR=\"${FRANKENPHP_PHP_INI_SCAN_PATH}\"
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

exec ${binary} php-cli \"\${args[@]}\""
        existing=""
        if [ -f "${FRANKENPHP_PHP_SHIM_DIR}/${shim}" ]; then
            # Only read if it's a small file (likely our shim) to avoid null byte warnings from binaries
            size=$(wc -c < "${FRANKENPHP_PHP_SHIM_DIR}/${shim}" 2>/dev/null || echo 0)
            if [ "$size" -lt 1000 ]; then
                existing="$(cat "${FRANKENPHP_PHP_SHIM_DIR}/${shim}" 2>/dev/null | tr -d '\0')"
            fi
        fi
        if [ "$existing" = "$wanted" ]; then
            continue
        fi
        tmp_shim="${FRANKENPHP_PHP_SHIM_DIR}/.${shim}.tmp.$$"
        printf '%s\n' "$wanted" > "$tmp_shim"
        chmod 755 "$tmp_shim"
        mv -f "$tmp_shim" "${FRANKENPHP_PHP_SHIM_DIR}/${shim}"
        echo "[$SCRIPT_INDEX] php-cli shim installed: ${FRANKENPHP_PHP_SHIM_DIR}/${shim} -> ${binary} php-cli"
    done
}

# Runtime-only convergence. Installation, compilation, package cleanup and
# service mutex changes remain owned by step 93 and never run from a process
# supervisor's start command.
fm_runtime_converge() {
    local variant=""

    FM_RUNTIME_BINARY=""
    variant="$(fm_variant)"
    FM_RUNTIME_BINARY="$(fm_variant_binary)"
    if [ "$(fm_binary_usable "$FM_RUNTIME_BINARY")" != "yes" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] selected FrankenPHP variant '${variant:-unrecorded}' has no usable runtime binary"
        FM_RUNTIME_BINARY=""
        return 0
    fi
    fm_ensure_local_bin_link "$FM_RUNTIME_BINARY"
    fm_ensure_php_cli_shim "$FM_RUNTIME_BINARY"
    fm_php_ini_ensure
    if [ "$(fm_runtime_contract_ready "$variant")" != "yes" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] selected FrankenPHP variant '${variant:-unrecorded}' does not satisfy the runtime PHP extension/configuration contract"
        FM_RUNTIME_BINARY=""
        return 0
    fi
    echo "[$SCRIPT_INDEX] runtime converged: ${variant:-unrecorded} -> ${FM_RUNTIME_BINARY}"
    return 0
}

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
upload_max_filesize = 64M
post_max_size = 64M
max_execution_time = 300
opcache.enable_cli = 1"
    existing=""
    [ -f "${ini_dir}/99-core-node.ini" ] && existing="$(cat "${ini_dir}/99-core-node.ini")"
    if [ "$existing" = "$rendered" ]; then
        echo "[$SCRIPT_INDEX] PHP ini already canonical: ${ini_dir}/99-core-node.ini"
        return 0
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
        return 0
    fi

    curl_binary="$(command -v curl 2>/dev/null)"
    if [ -z "$curl_binary" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] curl is required for the frankenphp installer"
        return 0
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
        return 0
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
        return 0
    fi
    if [ -z "$PHP_BIN" ] || [ -z "$VENDOR_AUTOLOAD" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] runtime store context required (PHP_BIN, VENDOR_AUTOLOAD)"
        return 0
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
    [ -n "$file_token" ] || return 0
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
    local loaded=""

    if [ -z "$binary" ] || [ ! -x "$binary" ]; then
        echo "no"
        return 0
    fi
    probe="$(mktemp)"
    printf '<?php echo extension_loaded(getenv("FM_PROBE_EXTENSION")) ? "yes" : "no";' > "$probe"
    loaded="$(PHP_INI_SCAN_DIR="$(fm_php_ini_scan_path)" FM_PROBE_EXTENSION="$extension" "$binary" php-cli "$probe" 2>/dev/null)"
    rm -f "$probe"
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

    command -v systemctl >/dev/null 2>&1 || return 0
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
    return 0
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
        return 0
    fi

    # Candidate sanity BEFORE touching the live runtime: must execute and
    # carry the module + the phar floor.
    if [ "$(fm_binary_usable "$candidate")" != "yes" ] \
        || [ "$(fm_module_in_bin "$candidate" "$FRANKENPHP_DNSPOD_MODULE")" != "yes" ] \
        || [ "$(fm_embedded_extension_loaded "$candidate" phar)" != "yes" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] rebuilt binary failed the version/module/phar probe; keeping $binary"
        rm -rf "$(dirname "$candidate")"
        echo ""
        return 0
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

# Mercure hub stanza: literal HS256 keys from the RuntimeConfigurationStore
# (official flat syntax of the embedded mercure/caddy module v0.24.x).
# Sets FM_MERCURE_STANZA (printf -v preserves the trailing blank line -
# $(...) capture would strip it and glue php_server onto the closing
# brace). Empty when the store is unreadable (e.g. an install-time render
# before 175 provisioning - no runtime_config adapter context) or the keys
# are not provisioned yet. SYNC CONTRACT:
# ServerManagerV1FrankenPhpCaddyfileBuilder::mercureStanza renders the
# identical stanza.
fm_mercure_stanza() {
    local publisher_key=""
    local subscriber_key=""
    local cookie_name=""

    FM_MERCURE_STANZA=""
    if [ "$(type -t runtime_config_get)" != "function" ] \
        || [ -z "${VENDOR_AUTOLOAD:-}" ] || [ ! -f "$VENDOR_AUTOLOAD" ] \
        || [ -z "${BOOTSTRAP_APP:-}" ] || [ ! -f "$BOOTSTRAP_APP" ]; then
        return 0
    fi
    publisher_key="$(runtime_config_get "MERCURE_PUBLISHER_JWT" 2>/dev/null)"
    subscriber_key="$(runtime_config_get "MERCURE_SUBSCRIBER_JWT" 2>/dev/null)"
    if [ -z "$publisher_key" ] || [ -z "$subscriber_key" ]; then
        return 0
    fi
    cookie_name="$(sc_require realtime.mercure_cookie)"
    printf -v FM_MERCURE_STANZA '\tmercure {\n\t\tpublisher_jwt %s HS256\n\t\tsubscriber_jwt %s HS256\n\t\tcookie_name %s\n\t}\n\n' \
        "$publisher_key" "$subscriber_key" "$cookie_name"
}

fm_octane_php_server_stanza() {
    printf -v FM_OCTANE_PHP_SERVER_STANZA '\tphp_server {\n\t\tindex frankenphp-worker.php\n\t\ttry_files {path} frankenphp-worker.php\n\t\tresolve_root_symlink\n\t}\n'
}

# Canonical Caddyfile render. The Mercure keys
# are embedded as literal publisher_jwt/subscriber_jwt values from the
# store (fm_mercure_stanza); the stanza is omitted when the keys are not
# available yet.
# Args: 1 laravel_public_dir 2 site_host 3 https_port 4 admin_port 5 caddyfile_path
fm_caddyfile_render() {
    local laravel_public_dir="$1"
    local site_host="$2"
    local https_port="$3"
    local admin_port="$4"
    local caddyfile_path="$5"
    local caddyfile_dir=""
    local rendered=""
    local dnspod_tls=""
    local acme_tls=""
    local acme_cert_dir=""
    local mercure_stanza=""
    local routes_dir=""
    local backend_port=""
    local import_stanza=""
    local octane_php_server_stanza=""

    caddyfile_dir="$(dirname "$caddyfile_path")"
    # Prebuilt-cert gate FIRST: the acme.sh DNS-01 certificates on disk are
    # pinned explicitly (the service-start pre-flight provisions them BEFORE
    # the server binds the HTTPS port - acme_sh_preflight_for_service). The
    # embedded dnspod DNS-01 stanza stays the fallback for builds whose
    # module works; neither gate matching -> Caddy built-in ACME
    # (HTTP-01/TLS-ALPN-01) stays in charge. Sync contract: the Laravel
    # builder renders the identical gates.
    acme_tls=""
    acme_cert_dir="$(fm_acme_cert_dir_for_host "$site_host")"
    if [ -n "$acme_cert_dir" ] \
        && [ -f "${acme_cert_dir}/fullchain.pem" ] \
        && [ -f "${acme_cert_dir}/key.pem" ]; then
        acme_tls="	tls ${acme_cert_dir}/fullchain.pem ${acme_cert_dir}/key.pem

"
    fi

    # DNS-01 fallback stanza renders ONLY when no prebuilt cert holds and
    # all truths hold: the site host is a public domain (NOT the localhost
    # fallback - certmagic rejects localhost for public certs, which would
    # loop ACME retries forever; a localhost site falls back to Caddy's
    # internal CA), the module is embedded in the binary AND the DNSPod
    # token is stored (env placeholder only - the token itself never enters
    # the file). Sync contract: the Laravel builder renders the identical
    # gate.
    dnspod_tls=""
    if [ -z "$acme_tls" ] \
        && [ "$site_host" != "localhost" ] \
        && [ "$(fm_has_module "$FRANKENPHP_DNSPOD_MODULE")" = "yes" ] \
        && [ -n "$(fm_dnspod_token_value)" ]; then
        dnspod_tls="	tls {
		dns dnspod {env.${FRANKENPHP_DNSPOD_TOKEN_KEY}}
	}

"
    fi

    # Mercure stanza: literal HS256 keys from the store; empty (block
    # omitted) when the store is unreadable or the keys are missing.
    # printf -v capture keeps the trailing blank line ($( ) strips it).
    fm_mercure_stanza
    mercure_stanza="$FM_MERCURE_STANZA"
    fm_octane_php_server_stanza
    octane_php_server_stanza="$FM_OCTANE_PHP_SERVER_STANZA"

    # Direct HTTP backend block for LAN and local machine clients + the
    # per-domain route import (same routes dir the domain
    # renderer writes; gated on file presence - caddy errors on an
    # unmatched import glob). Byte-synced with the Laravel builder.
    routes_dir="${caddyfile_dir}/routes"
    backend_port="$(sc_require ports.laravel_api_backend)"
    import_stanza=""
    if compgen -G "${routes_dir}/*.caddy" > /dev/null 2>&1; then
        import_stanza="

# Per-domain route files (managed by fm_domain_ensure_route_file)
import ${routes_dir}/*.caddy"
    fi

    rendered="# Managed by frankenphp_manager.sh (SYNC: ServerManagerV1FrankenPhpManagerCtl)
{
	admin localhost:${admin_port}
	auto_https disable_redirects

	frankenphp {
		worker {
			file "${laravel_public_dir}/frankenphp-worker.php"
			{\$CADDY_SERVER_WORKER_DIRECTIVE}
			{\$CADDY_SERVER_WATCH_DIRECTIVES}
		}
	}
}

https://${site_host}:${https_port} {
	root * ${laravel_public_dir}
	encode zstd gzip

${dnspod_tls}${acme_tls}${mercure_stanza}${octane_php_server_stanza}}

# Direct HTTP catch-all backend (LAN and local machine clients)
:${backend_port} {
	root * ${laravel_public_dir}
	encode zstd gzip
${octane_php_server_stanza}}${import_stanza}"

    FM_CADDYFILE_RENDERED="$rendered"
}

# Idempotent writer for the canonical render. Every caller uses this one
# fine-grained content comparison; a matching file never blocks later setup.
fm_caddyfile_ensure() {
    local laravel_public_dir="$1"
    local site_host="$2"
    local https_port="$3"
    local admin_port="$4"
    local caddyfile_path="$5"
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
        fm_caddyfile_render "$laravel_public_dir" "$site_host" "$https_port" "$admin_port" "$caddyfile_path"
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
            return 0
            ;;
    esac
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
            return 0
            ;;
    esac
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
    local dns01_mode=""
    local variant=""

    binary="$(fm_get_binary)"
    if [ -z "$binary" ]; then
        echo "[$SCRIPT_INDEX] [VERIFY] frankenphp binary: MISSING"
        return 0
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
