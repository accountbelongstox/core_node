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

FRANKENPHP_INSTALL_MODE_COMPILE="compiled"
FRANKENPHP_INSTALL_MODE_GIT="git"
FRANKENPHP_INSTALL_MODE_APT="apt"
FRANKENPHP_INSTALL_MODE_PREBUILT="prebuilt"

FRANKENPHP_DNS01_MODE_ACME_SH="acme-sh"
FRANKENPHP_DNS01_MODE_EMBEDDED="embedded"
FRANKENPHP_DNS01_MODE_BUILTIN="builtin"
FRANKENPHP_INSTALL_MODE_DEFAULT="$FRANKENPHP_INSTALL_MODE_APT"
FRANKENPHP_INSTALL_MODE_MENU_APT="1"
FRANKENPHP_INSTALL_MODE_MENU_COMPILE="2"
FRANKENPHP_INSTALL_MODE_MENU_GIT="3"

FRANKENPHP_INSTALL_93_INDEX="93"
FRANKENPHP_INSTALL_PIPELINE_DEFAULT_NO_MUTEX="false"

FRANKENPHP_INSTALL_PIPELINE_INDEX="93-install"
FRANKENPHP_INSTALL_PIPELINE_COMPILE_INDEX="93-install-compile"
FRANKENPHP_INSTALL_PIPELINE_PREBUILT_INDEX="93-install-prebuilt"
FRANKENPHP_INSTALL_PIPELINE_SYSTEM_INDEX="93-install-system"
FRANKENPHP_INSTALL_PIPELINE_CLEANUP_COMPILE_INDEX="93-install-cleanup-compile"
FRANKENPHP_INSTALL_PIPELINE_CLEANUP_PREBUILT_INDEX="93-install-cleanup-prebuilt"
FRANKENPHP_INSTALL_PIPELINE_CLEANUP_SYSTEM_INDEX="93-install-cleanup-system"

FRANKENPHP_INSTALL_PIPELINE_COMPILE_SCRIPT_NAME="frankenphp_install_pipeline_compile.sh"
FRANKENPHP_INSTALL_PIPELINE_PREBUILT_SCRIPT_NAME="frankenphp_install_pipeline_prebuilt.sh"
FRANKENPHP_INSTALL_PIPELINE_SYSTEM_SCRIPT_NAME="frankenphp_install_apt.sh"
FRANKENPHP_INSTALL_PIPELINE_CLEANUP_COMPILE_SCRIPT_NAME="frankenphp_install_pipeline_cleanup_compile.sh"
FRANKENPHP_INSTALL_PIPELINE_CLEANUP_PREBUILT_SCRIPT_NAME="frankenphp_install_pipeline_cleanup_prebuilt.sh"
FRANKENPHP_INSTALL_PIPELINE_CLEANUP_SYSTEM_SCRIPT_NAME="frankenphp_install_pipeline_cleanup_apt.sh"

# Official FrankenPHP deb repository (frankenphp.dev/docs "deb packages"):
# static-php repo serves distro-agnostic deb packages (suite "php-zts"),
# so the same lines work on Debian, Ubuntu and Kali. Extensions follow the
# php-zts-<ext> naming; PostgreSQL support = php-zts-pgsql + php-zts-pdo-pgsql.
# mbstring / curl / dom / xml / simplexml / xmlwriter are compiled INTO the
# static binary and are NOT shipped as php-zts-* deb packages (the repo
# offers only the optional extras: xsl, soap, gd, redis, ...).
FRANKENPHP_APT_PHP_VERSION="85"
FRANKENPHP_APT_KEY_URL="https://pkg.henderkes.com/api/packages/${FRANKENPHP_APT_PHP_VERSION}/debian/repository.key"
FRANKENPHP_APT_KEY_PATH="/etc/apt/keyrings/static-php${FRANKENPHP_APT_PHP_VERSION}.asc"
FRANKENPHP_APT_REPO_LINE="deb [signed-by=${FRANKENPHP_APT_KEY_PATH}] https://pkg.henderkes.com/api/packages/${FRANKENPHP_APT_PHP_VERSION}/debian php-zts main"
FRANKENPHP_APT_SOURCES_FILE="/etc/apt/sources.list.d/static-php${FRANKENPHP_APT_PHP_VERSION}.list"
FRANKENPHP_APT_PACKAGES=("frankenphp" "php-zts-pgsql" "php-zts-pdo-pgsql" "php-zts-zip" "php-zts-bcmath" "php-zts-intl" "php-zts-sqlite3")

frankenphp_install_mode_normalize() {
    local raw_mode=""
    local normalized_mode=""

    raw_mode="$1"
    case "$raw_mode" in
        "$FRANKENPHP_INSTALL_MODE_APT"|$FRANKENPHP_INSTALL_MODE_MENU_APT|apt|1)
            normalized_mode="$FRANKENPHP_INSTALL_MODE_APT"
            ;;
        "$FRANKENPHP_INSTALL_MODE_COMPILE"|$FRANKENPHP_INSTALL_MODE_MENU_COMPILE|compile|2)
            normalized_mode="$FRANKENPHP_INSTALL_MODE_COMPILE"
            ;;
        "$FRANKENPHP_INSTALL_MODE_PREBUILT"|$FRANKENPHP_INSTALL_MODE_GIT|$FRANKENPHP_INSTALL_MODE_MENU_GIT|git|3)
            normalized_mode="$FRANKENPHP_INSTALL_MODE_PREBUILT"
            ;;
        *)
            normalized_mode=""
            ;;
    esac
    printf '%s' "$normalized_mode"
}

frankenphp_install_mode_label() {
    local mode=""
    local label=""

    mode="$1"
    case "$mode" in
        "$FRANKENPHP_INSTALL_MODE_COMPILE")
            label="compile"
            ;;
        "$FRANKENPHP_INSTALL_MODE_APT")
            label="apt"
            ;;
        "$FRANKENPHP_INSTALL_MODE_GIT"|"$FRANKENPHP_INSTALL_MODE_PREBUILT")
            label="prebuilt"
            ;;
        *)
            label="unknown"
            ;;
    esac
    printf '%s' "$label"
}

# Resolve one binary path to its real executable target.
fm_resolve_binary_path() {
    local candidate=""
    local resolved=""

    candidate="$1"
    if [ -z "$candidate" ]; then
        echo ""
        return
    fi
    resolved="$(readlink -f "$candidate" 2>/dev/null || true)"
    if [ -n "$resolved" ] && [ -x "$resolved" ]; then
        echo "$resolved"
        return
    fi
    if [ -x "$candidate" ]; then
        echo "$candidate"
        return
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
        return
    fi
    for candidate in $FRANKENPHP_BIN_CANDIDATES; do
        candidate="$(fm_resolve_binary_path "$candidate")"
        if [ -n "$candidate" ]; then
            echo "$candidate"
            return
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
        return
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
        return
    fi
    canonical_target="$(fm_resolve_binary_path "$FRANKENPHP_LINK_PATH")"
    if [ -n "$canonical_target" ] && [ "$canonical_target" = "$binary" ]; then
        return
    fi
    $USE_SUDO ln -sf "$binary" "$FRANKENPHP_LINK_PATH"
    echo "[$SCRIPT_INDEX] linked ${FRANKENPHP_LINK_PATH} -> ${binary}"
    return
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
        return
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

fm_embedded_php_eval() {
    local binary=""
    local php_code=""
    local probe_extension=""
    local probe_file=""
    local probe_output=""

    binary="$1"
    php_code="$2"
    probe_extension="${3:-}"
    if [ -z "$binary" ] || [ ! -x "$binary" ] || [ -z "$php_code" ]; then
        echo ""
        return
    fi
    probe_file="$(mktemp "${TMPDIR:-/tmp}/frankenphp-php-probe.XXXXXX.php")"
    printf '%s' "$php_code" > "$probe_file"
    probe_output="$(
        PHP_INI_SCAN_DIR="$(fm_php_ini_scan_path)" \
            FM_PROBE_EXTENSION="$probe_extension" \
            "$binary" php-cli "$probe_file" 2>/dev/null
    )"
    rm -f "$probe_file"
    printf '%s' "$probe_output"
}

# Embedded PHP version ("8.5"); empty when the binary is absent. The
# frankenphp plane's ONLY PHP runtime (no apt PHP).
fm_php_version_of() {
    local binary=""

    binary="$1"
    if [ -n "$binary" ]; then
        fm_embedded_php_eval "$binary" '<?php echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;'
    fi
}

fm_php_version() {
    fm_php_version_of "$(fm_get_binary)"
}

# Full embedded PHP version (for package/tool metadata that requires the patch
# component). Keep the major.minor probe above as the static builder contract.
fm_php_full_version_of() {
    local binary=""

    binary="$1"
    if [ -n "$binary" ]; then
        fm_embedded_php_eval "$binary" '<?php echo PHP_VERSION;'
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
        return
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
        return
    fi
    fm_ensure_local_bin_link "$FM_RUNTIME_BINARY"
    fm_ensure_php_cli_shim "$FM_RUNTIME_BINARY"
    fm_php_ini_ensure
    if [ "$(fm_runtime_contract_ready "$variant")" != "yes" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] selected FrankenPHP variant '${variant:-unrecorded}' does not satisfy the runtime PHP extension/configuration contract"
        FM_RUNTIME_BINARY=""
        return
    fi
    echo "[$SCRIPT_INDEX] runtime converged: ${variant:-unrecorded} -> ${FM_RUNTIME_BINARY}"
    return
}
