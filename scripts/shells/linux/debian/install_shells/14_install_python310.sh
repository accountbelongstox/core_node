#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Isolated Python 3.10 runtime for CosyVoice / Fish Speech / VoxCPM2 / GPT-SoVITS / MeloTTS.
# Installs into a dedicated prefix and links python310 / pip310 into /usr/local/bin.
# The system /usr/bin/python3, apt alternatives and the default project venv are never touched.

# Declare all variables at the beginning
SCRIPT_CURRENT_DIR=""
PARENT_DIR_LEVEL_1=""
PARENT_DIR_LEVEL_2=""
PYTHON310_VERSION="3.10"
PYTHON310_SOURCE_RELEASE="3.10.21"
PYTHON310_TARBALL_NAME="Python-3.10.21.tgz"
PYTHON310_SOURCE_URL="https://www.python.org/ftp/python/3.10.21/Python-3.10.21.tgz"
PYTHON310_SOURCE_SHA256="f276987f06270ae6c1fb4da620bd105edf78c31368c2f7e85e6c1d51c560b04b"
PYTHON310_PREFIX=""
PYTHON310_BASE_BIN=""
PYTHON310_PIP_BIN=""
PYTHON310_BUILD_ROOT=""
PYTHON310_LINK_DIR="/usr/local/bin"
PYTHON310_LINK_PYTHON="/usr/local/bin/python310"
PYTHON310_LINK_PIP="/usr/local/bin/pip310"
PYTHON310_INSTALL_SOURCE=""
PYTHON310_TARBALL_PATH=""
BUILD_DEP_PACKAGES=()

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

PYTHON310_PREFIX="$COMPILE_DIR/python310"
PYTHON310_BASE_BIN="$PYTHON310_PREFIX/bin/python3.10"
PYTHON310_PIP_BIN="$PYTHON310_PREFIX/bin/pip3.10"
PYTHON310_BUILD_ROOT="/tmp/core_node_python310_build"

# Build dependencies for the official CPython source (compiler, make, OpenSSL,
# zlib, bz2, readline, sqlite, ffi, lzma development packages and certificates).
BUILD_DEP_PACKAGES=(
    build-essential
    make
    pkg-config
    libssl-dev
    zlib1g-dev
    libbz2-dev
    libreadline-dev
    libsqlite3-dev
    libffi-dev
    liblzma-dev
    libncurses-dev
    uuid-dev
    ca-certificates
    curl
)

python310_exe_reports_supported() {
    # $1 = candidate interpreter path; prints nothing; returns success when the
    # binary runs and reports major.minor == $PYTHON310_VERSION.
    local candidate="$1"
    local minor_text=""
    [ -n "$candidate" ] && [ -x "$candidate" ] || return 1
    minor_text="$("$candidate" -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || true)"
    [ "$minor_text" = "$PYTHON310_VERSION" ]
}

ensure_build_dependencies() {
    print_step_from_common_functions "Ensuring CPython build dependencies..."
    local missing_packages=()
    local pkg=""
    for pkg in "${BUILD_DEP_PACKAGES[@]}"; do
        if ! dpkg -s "$pkg" >/dev/null 2>&1; then
            missing_packages+=("$pkg")
        fi
    done
    if [ "${#missing_packages[@]}" -eq 0 ]; then
        print_success_from_common_functions "Build dependencies already present"
        return 0
    fi
    print_info_from_common_functions "Missing build dependencies: ${missing_packages[*]}"
    echo "[14] $USE_SUDO apt-get update"
    $USE_SUDO apt-get update || true
    echo "[14] $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y ${missing_packages[*]} --no-install-recommends"
    if ! $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y "${missing_packages[@]}" --no-install-recommends; then
        print_error_from_common_functions "STAGE=build_deps failed: apt could not install ${missing_packages[*]}"
        return 1
    fi
    return 0
}

download_source_tarball() {
    print_step_from_common_functions "Downloading CPython $PYTHON310_SOURCE_RELEASE source (official release tarball)..."
    mkdir -p "$PYTHON310_BUILD_ROOT"
    local tarball_path="$PYTHON310_BUILD_ROOT/$PYTHON310_TARBALL_NAME"
    local partial_path="$tarball_path.part"

    if [ -f "$tarball_path" ]; then
        if echo "$PYTHON310_SOURCE_SHA256  $tarball_path" | sha256sum -c - >/dev/null 2>&1; then
            print_info_from_common_functions "Source tarball already present with matching sha256; skipping download"
            PYTHON310_TARBALL_PATH="$tarball_path"
            return 0
        fi
        print_warning_from_common_functions "Existing tarball failed sha256 verification; re-downloading"
        rm -f "$tarball_path"
    fi

    rm -f "$partial_path"
    echo "[14] curl -fL $PYTHON310_SOURCE_URL -o $partial_path"
    if ! curl -fL "$PYTHON310_SOURCE_URL" -o "$partial_path"; then
        rm -f "$partial_path"
        print_error_from_common_functions "STAGE=download failed: $PYTHON310_SOURCE_URL"
        return 1
    fi
    if ! echo "$PYTHON310_SOURCE_SHA256  $partial_path" | sha256sum -c - >/dev/null 2>&1; then
        rm -f "$partial_path"
        print_error_from_common_functions "STAGE=download failed: sha256 mismatch for $PYTHON310_TARBALL_NAME"
        return 1
    fi
    mv "$partial_path" "$tarball_path"
    PYTHON310_TARBALL_PATH="$tarball_path"
    return 0
}

build_python310_from_source() {
    local tarball_path="$1"
    local source_dir="$PYTHON310_BUILD_ROOT/Python-$PYTHON310_SOURCE_RELEASE"

    print_step_from_common_functions "Building CPython $PYTHON310_SOURCE_RELEASE into isolated prefix $PYTHON310_PREFIX (arch: $(uname -m))..."
    if [ ! -d "$source_dir" ]; then
        echo "[14] tar -xzf $tarball_path -C $PYTHON310_BUILD_ROOT"
        if ! tar -xzf "$tarball_path" -C "$PYTHON310_BUILD_ROOT"; then
            print_error_from_common_functions "STAGE=extract failed: $tarball_path"
            return 1
        fi
    fi

    echo "[14] configure --prefix=$PYTHON310_PREFIX --with-ensurepip=install"
    if ! (cd "$source_dir" && ./configure --prefix="$PYTHON310_PREFIX" --with-ensurepip=install); then
        print_error_from_common_functions "STAGE=configure failed"
        return 1
    fi
    echo "[14] make -j$(nproc)"
    if ! (cd "$source_dir" && make -j"$(nproc)"); then
        print_error_from_common_functions "STAGE=make failed"
        return 1
    fi
    # altinstall semantics: never overwrites a python3 / python3-major link.
    echo "[14] make altinstall"
    if ! (cd "$source_dir" && $USE_SUDO make altinstall); then
        print_error_from_common_functions "STAGE=altinstall failed"
        return 1
    fi
    return 0
}

ensure_pip_for_base() {
    print_step_from_common_functions "Ensuring pip for the Python $PYTHON310_VERSION base interpreter..."
    if "$PYTHON310_BASE_BIN" -m pip --version >/dev/null 2>&1; then
        print_success_from_common_functions "pip present: $("$PYTHON310_BASE_BIN" -m pip --version 2>&1)"
        return 0
    fi
    echo "[14] $PYTHON310_BASE_BIN -m ensurepip --upgrade"
    "$PYTHON310_BASE_BIN" -m ensurepip --upgrade || true
    if "$PYTHON310_BASE_BIN" -m pip --version >/dev/null 2>&1; then
        print_success_from_common_functions "pip bootstrapped: $("$PYTHON310_BASE_BIN" -m pip --version 2>&1)"
        return 0
    fi
    print_error_from_common_functions "STAGE=pip failed: pip still unavailable for $PYTHON310_BASE_BIN"
    return 1
}

link_command() {
    # $1 = link path, $2 = target path. Existing links owned by others are kept
    # and reported as conflicts; only missing or self-owned links are repaired.
    local link_path="$1"
    local target_path="$2"

    if [ -L "$link_path" ]; then
        local current_target=""
        current_target="$(readlink -f "$link_path" 2>/dev/null || true)"
        if [ "$current_target" = "$target_path" ]; then
            print_info_from_common_functions "Link already correct: $link_path -> $target_path"
            return 0
        fi
        print_warning_from_common_functions "CONFLICT: $link_path points to $current_target (expected $target_path); leaving it untouched"
        return 1
    fi
    if [ -e "$link_path" ]; then
        print_warning_from_common_functions "CONFLICT: $link_path exists and is not a symlink; leaving it untouched"
        return 1
    fi
    echo "[14] $USE_SUDO ln -s $target_path $link_path"
    $USE_SUDO ln -s "$target_path" "$link_path"
    print_success_from_common_functions "Linked $link_path -> $target_path"
    return 0
}

ensure_command_links() {
    print_step_from_common_functions "Ensuring python310 / pip310 links in $PYTHON310_LINK_DIR..."
    link_command "$PYTHON310_LINK_PYTHON" "$PYTHON310_BASE_BIN" || true
    link_command "$PYTHON310_LINK_PIP" "$PYTHON310_PIP_BIN" || true
    # Convenience links for the versioned names; conflicts are reported, never forced.
    link_command "$PYTHON310_LINK_DIR/python3.10" "$PYTHON310_BASE_BIN" || true
    link_command "$PYTHON310_LINK_DIR/pip3.10" "$PYTHON310_PIP_BIN" || true
}

register_python310_storage() {
    print_step_from_common_functions "Registering Python $PYTHON310_VERSION paths in the global var store..."
    set_var "PYTHON310_EXE_PATH" "$PYTHON310_BASE_BIN"
    set_var "PYTHON310_PIP_PATH" "$PYTHON310_PIP_BIN"
    set_var "PYTHON310_VERSION" "$PYTHON310_VERSION"
    set_var "PYTHON310_INSTALL_SOURCE" "$PYTHON310_INSTALL_SOURCE"
    print_success_from_common_functions "Registered PYTHON310_EXE_PATH=$PYTHON310_BASE_BIN (source: $PYTHON310_INSTALL_SOURCE)"
}

main() {
    print_header_from_common_functions "Isolated Python $PYTHON310_VERSION Setup (keeps system python3 untouched)"

    # Stage 1: reuse the existing project prefix interpreter when healthy.
    if python310_exe_reports_supported "$PYTHON310_BASE_BIN"; then
        print_success_from_common_functions "Python $PYTHON310_VERSION already installed at $PYTHON310_BASE_BIN"
        PYTHON310_INSTALL_SOURCE="existing_prefix"
    else
        # Stage 2: adopt a trusted system-provided 3.10 absolute path (no rebuild).
        local system_candidate=""
        local adopted=0
        for system_candidate in /usr/bin/python3.10 /usr/local/bin/python3.10; do
            if python310_exe_reports_supported "$system_candidate"; then
                print_info_from_common_functions "Adopting system Python $PYTHON310_VERSION at $system_candidate (no rebuild)"
                PYTHON310_BASE_BIN="$system_candidate"
                PYTHON310_PIP_BIN="$(dirname "$system_candidate")/pip3.10"
                PYTHON310_INSTALL_SOURCE="system_binary"
                adopted=1
                break
            fi
        done

        # Stage 3: build from the official source release into the isolated prefix.
        if [ "$adopted" -eq 0 ]; then
            if ! command -v apt-get >/dev/null 2>&1; then
                print_error_from_common_functions "STAGE=detect failed: no system 3.10 binary and apt-get unavailable; cannot build from source on this distribution"
                return 0
            fi
            ensure_build_dependencies || return 0
            PYTHON310_TARBALL_PATH=""
            download_source_tarball || return 0
            [ -n "$PYTHON310_TARBALL_PATH" ] || return 0
            build_python310_from_source "$PYTHON310_TARBALL_PATH" || return 0
            PYTHON310_INSTALL_SOURCE="source_build_$PYTHON310_SOURCE_RELEASE"
        fi
    fi

    if ! python310_exe_reports_supported "$PYTHON310_BASE_BIN"; then
        print_error_from_common_functions "STAGE=detect failed: no usable Python $PYTHON310_VERSION interpreter"
        return 0
    fi

    ensure_pip_for_base || true
    ensure_command_links
    register_python310_storage

    print_success_from_common_functions "python310: $(command -v python310 || echo "$PYTHON310_LINK_PYTHON") -> $PYTHON310_BASE_BIN"
    print_info_from_common_functions "Default python3 / pip3 and the project venv are unchanged"
}

main
