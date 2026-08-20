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
# It downloads a Linux binary from GitHub release assets and installs it to the
# dedicated prebuilt candidate path. The central lifecycle promotes it only
# after validation; this preparer never changes owner, links or packages.

FRANKENPHP_PREBUILT_INDEX="93-install-prebuilt"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRANKENPHP_PREBUILT_PROJECT="php/frankenphp"
FRANKENPHP_PREBUILT_DEFAULT_VERSION="latest"
FRANKENPHP_PREBUILT_GITHUB_REPO="https://github.com/${FRANKENPHP_PREBUILT_PROJECT}"
FRANKENPHP_PREBUILT_RELEASE_TAG=""
FRANKENPHP_PREBUILT_RELEASE_CHANNEL=""
FRANKENPHP_PREBUILT_RELEASE_URL=""
FRANKENPHP_PREBUILT_ARCH=""
FRANKENPHP_PREBUILT_ARCH_NAMES=()
FRANKENPHP_PREBUILT_INSTALL_BIN=""
FRANKENPHP_PREBUILT_CANDIDATE_BIN=""

source "$SCRIPT_CURRENT_DIR/gvar_common.sh"
source "$SCRIPT_CURRENT_DIR/frankenphp_manager.sh"

# Prebuilt binary lives in its own runtime directory; only the canonical link is
# shared.
FRANKENPHP_PREBUILT_INSTALL_BIN="${FRANKENPHP_PREBUILT_BINARY_PATH}"
FRANKENPHP_PREBUILT_CANDIDATE_BIN="${FRANKENPHP_PREBUILT_CANDIDATE_PATH}"

frankenphp_prebuilt_set_release_tag() {
    local normalized_version=""
    local effective_url=""
    local resolved_tag=""

    normalized_version="$(printf '%s' "${FRANKENPHP_PREBUILT_VERSION:-$FRANKENPHP_PREBUILT_DEFAULT_VERSION}" | tr -d '[:space:]')"
    if [ "$normalized_version" = "latest" ]; then
        effective_url="$(curl -Ls -o /dev/null -w '%{url_effective}' "${FRANKENPHP_PREBUILT_GITHUB_REPO}/releases/latest" 2>/dev/null)"
        resolved_tag="${effective_url##*/}"
        case "$resolved_tag" in
            v[0-9]*) FRANKENPHP_PREBUILT_RELEASE_TAG="$resolved_tag" ;;
            *) FRANKENPHP_PREBUILT_RELEASE_TAG="latest" ;;
        esac
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
    local version=""

    if [ -x "$FRANKENPHP_PREBUILT_INSTALL_BIN" ]; then
        version="$("$FRANKENPHP_PREBUILT_INSTALL_BIN" version 2>/dev/null | sed -n 's/^FrankenPHP \(v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\).*/\1/p' | head -n 1)"
        printf '%s' "$version"
    fi
}

frankenphp_prebuilt_candidate_version() {
    local version=""

    if [ -x "$FRANKENPHP_PREBUILT_CANDIDATE_BIN" ]; then
        version="$("$FRANKENPHP_PREBUILT_CANDIDATE_BIN" version 2>/dev/null | sed -n 's/^FrankenPHP \(v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\).*/\1/p' | head -n 1)"
    fi
    printf '%s' "$version"
}

frankenphp_prebuilt_is_expected_binary() {
    local expected_tag=""
    local current_tag=""

    expected_tag="$(frankenphp_prebuilt_expected_tag)"
    if [ ! -x "$FRANKENPHP_PREBUILT_INSTALL_BIN" ]; then
        echo "no"
        return 0
    fi
    if [ "$expected_tag" = "latest" ]; then
        current_tag="$(frankenphp_prebuilt_existing_version)"
        if [ -n "$current_tag" ]; then
            echo "yes"
        else
            echo "no"
        fi
        return 0
    fi
    current_tag="$(frankenphp_prebuilt_existing_version)"
    if [ -n "$current_tag" ] && [ "$current_tag" = "$expected_tag" ]; then
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

# User-facing landing dir for the prebuilt binary temp file (reused across
# runs): <invoking user>/Downloads, falling back to the persistent build-root
# cache when the home directory is not writable.
frankenphp_prebuilt_downloads_dir() {
    local user_name=""
    local user_home=""
    local downloads_dir=""

    user_name="${SUDO_USER:-${USER:-$(id -un 2>/dev/null)}}"
    user_home="$(getent passwd "$user_name" 2>/dev/null | cut -d: -f6)"
    [ -n "$user_home" ] || user_home="${HOME:-/root}"
    downloads_dir="${user_home}/Downloads"
    if mkdir -p "$downloads_dir" 2>/dev/null && [ -w "$downloads_dir" ]; then
        echo "$downloads_dir"
    else
        echo "${FRANKENPHP_PREBUILT_CACHE_DIR}/downloads"
    fi
}

frankenphp_prebuilt_download_asset() {
    local selected_url=""
    local selected_file=""
    local downloads_dir=""
    local cache_file=""

    selected_url="${1%%|*}"
    selected_file="${1#*|}"
    if [ -z "$selected_url" ] || [ -z "$selected_file" ] || [ "$selected_file" = "$selected_url" ]; then
        echo ""
        return 0
    fi

    downloads_dir="$(frankenphp_prebuilt_downloads_dir)"
    mkdir -p "${downloads_dir}/frankenphp/${FRANKENPHP_PREBUILT_RELEASE_CHANNEL}/${FRANKENPHP_PREBUILT_ARCH}"
    cache_file="${downloads_dir}/frankenphp/${FRANKENPHP_PREBUILT_RELEASE_CHANNEL}/${FRANKENPHP_PREBUILT_ARCH}/${selected_file}"
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
    local requested_tag=""

    binary_path="$1"
    requested_tag="$(frankenphp_prebuilt_expected_tag)"
    if [ ! -x "$binary_path" ]; then
        echo "no"
        return 0
    fi
    candidate_tag="$("$binary_path" version 2>/dev/null | sed -n 's/^FrankenPHP \(v[0-9][^ ]*\).*/\1/p' | head -n 1)"
    if [ "$requested_tag" = "latest" ]; then
        if [ -n "$candidate_tag" ]; then
            echo "yes"
        else
            echo "no"
        fi
        return 0
    fi
    if [ "$candidate_tag" = "$requested_tag" ]; then
        echo "yes"
    else
        echo "no"
    fi
}

frankenphp_prebuilt_executable_ensure() {
    local binary_path=""

    binary_path="$1"
    if [ -f "$binary_path" ] && [ ! -x "$binary_path" ]; then
        chmod 755 "$binary_path" 2>/dev/null
    fi
    if [ -x "$binary_path" ]; then
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
    local staged_binary=""

    if [ "$(frankenphp_prebuilt_validate_binary "$FRANKENPHP_PREBUILT_CANDIDATE_BIN")" = "yes" ]; then
        echo "[$FRANKENPHP_PREBUILT_INDEX] prebuilt candidate already ready: $(frankenphp_prebuilt_candidate_version)"
        return
    fi
    if [ "$(frankenphp_prebuilt_is_expected_binary)" = "yes" ]; then
        echo "[$FRANKENPHP_PREBUILT_INDEX] canonical prebuilt payload already matches: $(frankenphp_prebuilt_existing_version)"
        return
    fi

    asset_info="$(frankenphp_prebuilt_select_asset_url)"
    if [ -z "$asset_info" ] || [ "$asset_info" = "${asset_info#*|}" ]; then
        echo "[$FRANKENPHP_PREBUILT_INDEX] [WARN] no prebuilt asset could be selected for $FRANKENPHP_PREBUILT_RELEASE_TAG ($FRANKENPHP_PREBUILT_ARCH)"
        return
    fi

    cache_path="$(frankenphp_prebuilt_download_asset "$asset_info")"
    if [ ! -s "$cache_path" ]; then
        echo "[$FRANKENPHP_PREBUILT_INDEX] [WARN] prebuilt asset download failed: $asset_info"
        return
    fi

    unpack_dir="${FRANKENPHP_PREBUILT_STAGING_DIR}/${FRANKENPHP_PREBUILT_RELEASE_CHANNEL}-${FRANKENPHP_PREBUILT_ARCH}"
    extracted_binary="$(frankenphp_prebuilt_unpack "$cache_path" "$unpack_dir")"
    if [ -z "$extracted_binary" ] || [ ! -f "$extracted_binary" ]; then
        echo "[$FRANKENPHP_PREBUILT_INDEX] [WARN] prebuilt asset unpack did not produce a binary"
        return
    fi

    frankenphp_prebuilt_executable_ensure "$extracted_binary" >/dev/null
    if [ "$(frankenphp_prebuilt_validate_binary "$extracted_binary")" != "yes" ]; then
        echo "[$FRANKENPHP_PREBUILT_INDEX] [WARN] prebuilt binary version does not match requested release: $(frankenphp_prebuilt_expected_tag)"
        return
    fi

    $USE_SUDO mkdir -p "$(dirname "$FRANKENPHP_PREBUILT_CANDIDATE_BIN")"
    staged_binary="${FRANKENPHP_PREBUILT_CANDIDATE_BIN}.new"
    $USE_SUDO cp "$extracted_binary" "$staged_binary"
    $USE_SUDO chmod 755 "$staged_binary"
    if [ "$(frankenphp_prebuilt_validate_binary "$staged_binary")" = "yes" ]; then
        $USE_SUDO mv -f "$staged_binary" "$FRANKENPHP_PREBUILT_CANDIDATE_BIN"
    fi
    if [ "$(frankenphp_prebuilt_validate_binary "$FRANKENPHP_PREBUILT_CANDIDATE_BIN")" = "yes" ]; then
        echo "[$FRANKENPHP_PREBUILT_INDEX] prebuilt candidate staged: $(frankenphp_prebuilt_expected_tag) from ${cache_path}"
    else
        echo "[$FRANKENPHP_PREBUILT_INDEX] [WARN] prebuilt candidate staging did not converge"
    fi
}

frankenphp_install_prebuilt() {
    local prepared_binary=""

    frankenphp_prebuilt_set_release_tag
    frankenphp_prebuilt_detect_arch
    $USE_SUDO mkdir -p "$FRANKENPHP_PREBUILT_RUNTIME_DIR"
    printf '%s\n' "$FRANKENPHP_PREBUILT_RELEASE_TAG" | $USE_SUDO tee "$FRANKENPHP_PREBUILT_REQUEST_STATE" >/dev/null
    frankenphp_prebuilt_install_binary

    prepared_binary="$(fm_variant_prepared_binary "$FRANKENPHP_INSTALL_MODE_PREBUILT")"
    if [ "$(frankenphp_prebuilt_validate_binary "$prepared_binary")" = "yes" ]; then
        printf '%s\n' "$FRANKENPHP_PREBUILT_RELEASE_TAG" | $USE_SUDO tee "$FRANKENPHP_PREBUILT_READY_STATE" >/dev/null
    fi
    if [ "$(fm_variant_ready "$FRANKENPHP_INSTALL_MODE_PREBUILT")" = "yes" ]; then
        echo "[$FRANKENPHP_PREBUILT_INDEX] prebuilt candidate ready: ${prepared_binary}"
    else
        echo "[$FRANKENPHP_PREBUILT_INDEX] [ERROR] prebuilt candidate incomplete; active owner was not changed"
    fi
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    frankenphp_install_prebuilt "$@"
fi
