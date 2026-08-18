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

# Public prebuilt installer for FrankenPHP.
# It downloads a Linux binary from GitHub release assets and installs it to
# /usr/local/bin/frankenphp. Prebuilt mode intentionally skips dnspod module
# rebuilds and executes the shared acme.sh installer after installation.

FRANKENPHP_PREBUILT_INDEX="93-install-prebuilt"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRANKENPHP_PREBUILT_NAMESPACE="93_install_frankenphp"
FRANKENPHP_PREBUILT_PROJECT="php/frankenphp"
FRANKENPHP_PREBUILT_DEFAULT_VERSION="latest"
FRANKENPHP_PREBUILT_BACKUP_SUFFIX=".prebuilt"
FRANKENPHP_PREBUILT_ACME_INSTALL_SCRIPT="${SCRIPT_CURRENT_DIR}/frankenphp_acme_sh_install.sh"
FRANKENPHP_PREBUILT_GITHUB_REPO="https://github.com/${FRANKENPHP_PREBUILT_PROJECT}"
FRANKENPHP_PREBUILT_RELEASE_TAG=""
FRANKENPHP_PREBUILT_RELEASE_CHANNEL=""
FRANKENPHP_PREBUILT_RELEASE_URL=""
FRANKENPHP_PREBUILT_ARCH=""
FRANKENPHP_PREBUILT_ARCH_NAMES=()

source "$SCRIPT_CURRENT_DIR/gvar_common.sh"
source "$SCRIPT_CURRENT_DIR/common_functions.sh"
source "$SCRIPT_CURRENT_DIR/file_ops_common.sh"
source "$SCRIPT_CURRENT_DIR/step_state.sh"
source "$SCRIPT_CURRENT_DIR/frankenphp_manager.sh"

# Unified binary/link + cache/staging path family (single source in the
# manager + builder): FRANKENPHP_LINK_PATH, FRANKENPHP_PREBUILT_CACHE_DIR,
# FRANKENPHP_PREBUILT_STAGING_DIR.
FRANKENPHP_PREBUILT_INSTALL_BIN="${FRANKENPHP_LINK_PATH}"

frankenphp_prebuilt_set_release_tag() {
    local normalized_version=""

    normalized_version="$(printf '%s' "${FRANKENPHP_PREBUILT_VERSION:-$FRANKENPHP_PREBUILT_DEFAULT_VERSION}" | tr -d '[:space:]')"
    if [ "$normalized_version" = "latest" ]; then
        FRANKENPHP_PREBUILT_RELEASE_TAG="latest"
    else
        normalized_version="${normalized_version#v}"
        normalized_version="$(printf '%s' "$normalized_version" | sed -e 's/[^0-9.].*$//')"
        if [ -z "$normalized_version" ]; then
            normalized_version="$FRANKENPHP_PREBUILT_DEFAULT_VERSION"
        fi
        FRANKENPHP_PREBUILT_RELEASE_TAG="v${normalized_version}"
    fi

    if [ "$FRANKENPHP_PREBUILT_RELEASE_TAG" = "latest" ]; then
        FRANKENPHP_PREBUILT_RELEASE_CHANNEL="latest"
        FRANKENPHP_PREBUILT_RELEASE_URL="${FRANKENPHP_PREBUILT_GITHUB_REPO}/releases/latest/download"
    else
        FRANKENPHP_PREBUILT_RELEASE_CHANNEL="${FRANKENPHP_PREBUILT_RELEASE_TAG#v}"
        FRANKENPHP_PREBUILT_RELEASE_URL="${FRANKENPHP_PREBUILT_GITHUB_REPO}/releases/download/${FRANKENPHP_PREBUILT_RELEASE_TAG}"
    fi

    export FRANKENPHP_PREBUILT_RELEASE_TAG
    export FRANKENPHP_PREBUILT_RELEASE_CHANNEL
    export FRANKENPHP_PREBUILT_RELEASE_URL
}

frankenphp_prebuilt_detect_arch() {
    local machine_arch=""

    machine_arch="$(uname -m 2>/dev/null || echo "x86_64")"
    FRANKENPHP_PREBUILT_ARCH_NAMES=()
    case "$machine_arch" in
        x86_64|amd64)
            FRANKENPHP_PREBUILT_ARCH="x86_64"
            FRANKENPHP_PREBUILT_ARCH_NAMES=("x86_64" "amd64")
            ;;
        aarch64|arm64)
            FRANKENPHP_PREBUILT_ARCH="aarch64"
            FRANKENPHP_PREBUILT_ARCH_NAMES=("aarch64" "arm64")
            ;;
        armv7l|armhf)
            FRANKENPHP_PREBUILT_ARCH="armv7l"
            FRANKENPHP_PREBUILT_ARCH_NAMES=("armv7l" "armhf")
            ;;
        *)
            FRANKENPHP_PREBUILT_ARCH="$machine_arch"
            FRANKENPHP_PREBUILT_ARCH_NAMES=("$machine_arch")
            ;;
    esac
}

frankenphp_prebuilt_is_glibc() {
    if getconf GNU_LIBC_VERSION >/dev/null 2>&1; then
        echo "yes"
    else
        echo "no"
    fi
}

frankenphp_prebuilt_expected_tag() {
    echo "$FRANKENPHP_PREBUILT_RELEASE_TAG"
}

frankenphp_prebuilt_existing_version() {
    fm_version_tag
}

frankenphp_prebuilt_is_expected_binary() {
    local expected_tag=""
    local current_tag=""

    expected_tag="$(frankenphp_prebuilt_expected_tag)"
    current_tag="$(frankenphp_prebuilt_existing_version)"
    if [ -n "$current_tag" ] && [ "$current_tag" = "$expected_tag" ] && [ -x "$(fm_get_binary)" ]; then
        echo "yes"
    else
        echo "no"
    fi
}

frankenphp_prebuilt_url_exists() {
    local test_url=""
    local code=""

    test_url="$1"
    code="$(curl -sL -o /dev/null -I -w '%{http_code}' "$test_url" 2>/dev/null || true)"
    case "$code" in
        200|302|301)
            echo "yes"
            ;;
        *)
            echo "no"
            ;;
    esac
}

frankenphp_prebuilt_arch_candidates() {
    local candidate_base=""
    local candidates=""
    local include_legacy=""

    candidate_base="frankenphp-linux-${FRANKENPHP_PREBUILT_ARCH}"
    candidates="${candidates} ${candidate_base}"
    candidates="${candidates} ${candidate_base}.tgz"
    if [ "$(frankenphp_prebuilt_is_glibc)" = "yes" ]; then
        candidates="${candidates} ${candidate_base}-gnu"
        candidates="${candidates} ${candidate_base}-gnu.tgz"
    fi

    for include_legacy in "${FRANKENPHP_PREBUILT_ARCH_NAMES[@]}"; do
        if [ "$include_legacy" != "$FRANKENPHP_PREBUILT_ARCH" ]; then
            candidates="${candidates} frankenphp-linux-${include_legacy}"
            candidates="${candidates} frankenphp-linux-${include_legacy}.tgz"
        fi
    done

    printf '%s' "$candidates"
}

frankenphp_prebuilt_select_asset_url() {
    local candidate=""
    local candidate_url=""
    local candidate_file=""

    for candidate in $(frankenphp_prebuilt_arch_candidates); do
        candidate_url="${FRANKENPHP_PREBUILT_RELEASE_URL}/${candidate}"
        if [ "$(frankenphp_prebuilt_url_exists "$candidate_url")" = "yes" ]; then
            candidate_file="$candidate"
            printf '%s|%s' "$candidate_url" "$candidate_file"
            return 0
        fi
    done
    echo ""
}

frankenphp_prebuilt_download_asset() {
    local selected_url=""
    local selected_file=""
    local cache_file=""

    selected_url="${1%%|*}"
    selected_file="${1#*|}"
    if [ -z "$selected_url" ] || [ -z "$selected_file" ] || [ "$selected_file" = "$selected_url" ]; then
        echo ""
        return 0
    fi

    mkdir -p "${FRANKENPHP_PREBUILT_CACHE_DIR}/${FRANKENPHP_PREBUILT_RELEASE_CHANNEL}/${FRANKENPHP_PREBUILT_ARCH}"
    cache_file="${FRANKENPHP_PREBUILT_CACHE_DIR}/${FRANKENPHP_PREBUILT_RELEASE_CHANNEL}/${FRANKENPHP_PREBUILT_ARCH}/${selected_file}"
    if [ -s "$cache_file" ]; then
        echo "$cache_file"
        return 0
    fi

    curl -fsSL -o "$cache_file" "$selected_url" || true
    if [ -s "$cache_file" ]; then
        echo "$cache_file"
    else
        echo ""
    fi
}

frankenphp_prebuilt_unpack() {
    local archive_path=""
    local work_dir=""
    local archive_name=""
    local extracted=""

    archive_path="$1"
    work_dir="$2"
    archive_name="$(basename "$archive_path")"

    rm -rf "$work_dir"
    mkdir -p "$work_dir"

    if [ ! -f "$archive_path" ]; then
        echo ""
        return 0
    fi

    case "$archive_name" in
        *.tar.gz|*.tgz)
            tar -xzf "$archive_path" -C "$work_dir" >/dev/null 2>&1 || tar -xzf "$archive_path" -C "$work_dir"
            ;;
        *.zip)
            unzip -oq "$archive_path" -d "$work_dir" >/dev/null 2>&1 || true
            ;;
        *)
            cp "$archive_path" "$work_dir/frankenphp"
            ;;
    esac

    extracted="$(find "$work_dir" -type f \( -name frankenphp -o -name "${archive_name%-*}" -o -name "${archive_name%-gnu*}" \) 2>/dev/null | head -n 1)"
    if [ -z "$extracted" ]; then
        extracted="$(find "$work_dir" -type f | head -n 1)"
    fi
    echo "$extracted"
}

frankenphp_prebuilt_validate_binary() {
    local binary_path=""
    local candidate_tag=""

    binary_path="$1"
    if [ ! -f "$binary_path" ]; then
        echo "no"
        return 0
    fi
    chmod +x "$binary_path" 2>/dev/null || true
    candidate_tag="$("$binary_path" version 2>/dev/null | sed -n 's/^FrankenPHP \(v[0-9][^ ]*\).*/\1/p' | head -n 1)"
    if [ "$candidate_tag" = "$(frankenphp_prebuilt_expected_tag)" ]; then
        echo "yes"
    else
        echo "no"
    fi
}

frankenphp_prebuilt_install_binary() {
    local asset_info=""
    local cache_path=""
    local unpack_dir=""
    local extracted_binary=""
    local rc="0"

    if [ "$(frankenphp_prebuilt_is_expected_binary)" = "yes" ]; then
        echo "[$FRANKENPHP_PREBUILT_INDEX] [SKIP] prebuilt FrankenPHP already installed: $(frankenphp_prebuilt_existing_version) at $(fm_get_binary)"
        return 0
    fi

    asset_info="$(frankenphp_prebuilt_select_asset_url)"
    if [ -z "$asset_info" ] || [ "$asset_info" = "${asset_info#*|}" ]; then
        echo "[$FRANKENPHP_PREBUILT_INDEX] [WARN] no prebuilt asset could be selected for $FRANKENPHP_PREBUILT_RELEASE_TAG ($FRANKENPHP_PREBUILT_ARCH)"
        return 1
    fi

    cache_path="$(frankenphp_prebuilt_download_asset "$asset_info")"
    if [ ! -s "$cache_path" ]; then
        echo "[$FRANKENPHP_PREBUILT_INDEX] [WARN] prebuilt asset download failed: $asset_info"
        return 1
    fi

    unpack_dir="${FRANKENPHP_PREBUILT_STAGING_DIR}/${FRANKENPHP_PREBUILT_RELEASE_CHANNEL}-${FRANKENPHP_PREBUILT_ARCH}"
    extracted_binary="$(frankenphp_prebuilt_unpack "$cache_path" "$unpack_dir")"
    if [ -z "$extracted_binary" ] || [ ! -f "$extracted_binary" ]; then
        echo "[$FRANKENPHP_PREBUILT_INDEX] [WARN] prebuilt asset unpack did not produce a binary"
        return 1
    fi

    if [ "$(frankenphp_prebuilt_validate_binary "$extracted_binary")" != "yes" ]; then
        echo "[$FRANKENPHP_PREBUILT_INDEX] [WARN] prebuilt binary version does not match requested release: $(frankenphp_prebuilt_expected_tag)"
        return 1
    fi

    chmod +x "$extracted_binary"
    if [ -x "$FRANKENPHP_PREBUILT_INSTALL_BIN" ] && [ ! -f "${FRANKENPHP_PREBUILT_INSTALL_BIN}${FRANKENPHP_PREBUILT_BACKUP_SUFFIX}" ]; then
        $USE_SUDO cp "$FRANKENPHP_PREBUILT_INSTALL_BIN" "${FRANKENPHP_PREBUILT_INSTALL_BIN}${FRANKENPHP_PREBUILT_BACKUP_SUFFIX}" || return 1
    fi
    $USE_SUDO cp "$extracted_binary" "$FRANKENPHP_PREBUILT_INSTALL_BIN" || return 1
    $USE_SUDO chmod 755 "$FRANKENPHP_PREBUILT_INSTALL_BIN" || return 1
    fm_ensure_local_bin_link || return 1
    fm_ensure_php_cli_shim || return 1
    echo "[$FRANKENPHP_PREBUILT_INDEX] installed prebuilt FrankenPHP: $(frankenphp_prebuilt_expected_tag) from ${cache_path}"
    # Variant mutex: the prebuilt variant now owns the link - drop a stale
    # compiled-variant backup left behind by an earlier dnspod rebuild.
    rm -f "${FRANKENPHP_PREBUILT_INSTALL_BIN}.pre-dnspod"
    fm_store_info
    return 0
}

frankenphp_prebuilt_step_fingerprint() {
    local current_version=""

    current_version="$(frankenphp_prebuilt_existing_version)"
    echo "${FRANKENPHP_PREBUILT_RELEASE_CHANNEL}-${FRANKENPHP_PREBUILT_ARCH}-${current_version}"
}

frankenphp_install_prebuilt() {
    local prebuilt_fingerprint=""

    frankenphp_prebuilt_set_release_tag
    frankenphp_prebuilt_detect_arch
    prebuilt_fingerprint="$(frankenphp_prebuilt_step_fingerprint)"

    step_run "$FRANKENPHP_PREBUILT_NAMESPACE" "prebuilt-binary" "$prebuilt_fingerprint" \
        frankenphp_prebuilt_install_binary

    if [ -x "$FRANKENPHP_PREBUILT_INSTALL_BIN" ]; then
        source "$FRANKENPHP_PREBUILT_ACME_INSTALL_SCRIPT"
        acme_sh_ensure_install
        acme_sh_ensure_domains
        # Plane mutex + apt PHP cleanup behind a healthy binary - identical
        # gates to the compiled variant.
        fm_disable_legacy_php_runtime
        fm_static_apt_php_cleanup
    else
        echo "[$FRANKENPHP_PREBUILT_INDEX] [WARN] skip acme.sh install because $FRANKENPHP_PREBUILT_INSTALL_BIN is missing"
    fi
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    frankenphp_install_prebuilt "$@"
fi
