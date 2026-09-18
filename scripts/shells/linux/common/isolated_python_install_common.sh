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
install_isolated_python_runtime() (
    ISOLATED_PYTHON_VERSION="$1"
    ISOLATED_PYTHON_COMMAND="python${ISOLATED_PYTHON_VERSION//./}"
    ISOLATED_PIP_COMMAND="pip${ISOLATED_PYTHON_VERSION//./}"
    ISOLATED_RUNTIME_KEY="${ISOLATED_PYTHON_COMMAND^^}"
    ISOLATED_CONSTANT="${ISOLATED_RUNTIME_KEY}_SOURCE_RELEASE"
    ISOLATED_PYTHON_SOURCE_RELEASE="${!ISOLATED_CONSTANT}"
    ISOLATED_CONSTANT="${ISOLATED_RUNTIME_KEY}_SOURCE_SHA256"
    ISOLATED_PYTHON_SOURCE_SHA256="${!ISOLATED_CONSTANT}"
    ISOLATED_CONSTANT="${ISOLATED_RUNTIME_KEY}_SOURCE_URL"
    ISOLATED_PYTHON_SOURCE_URL="${!ISOLATED_CONSTANT}"
    ISOLATED_CONSTANT="${ISOLATED_RUNTIME_KEY}_DIR"
    ISOLATED_PYTHON_PREFIX="${!ISOLATED_CONSTANT}"
    ISOLATED_CONSTANT="${ISOLATED_RUNTIME_KEY}_EXE_PATH"
    ISOLATED_PYTHON_BASE_BIN="${!ISOLATED_CONSTANT}"
    ISOLATED_PYTHON_PIP_BIN="$ISOLATED_PYTHON_PREFIX/bin/pip$ISOLATED_PYTHON_VERSION"
    ISOLATED_PYTHON_TARBALL_NAME="Python-$ISOLATED_PYTHON_SOURCE_RELEASE.tgz"
    ISOLATED_PYTHON_BUILD_ROOT="${TMPDIR:-/tmp}/core_node_${ISOLATED_PYTHON_COMMAND}_build"
    ISOLATED_PYTHON_LINK_DIR="$PYTHON_RUNTIME_LINK_DIR"
    ISOLATED_PYTHON_LINK_PYTHON="$ISOLATED_PYTHON_LINK_DIR/$ISOLATED_PYTHON_COMMAND"
    ISOLATED_PYTHON_LINK_PIP="$ISOLATED_PYTHON_LINK_DIR/$ISOLATED_PIP_COMMAND"
    ISOLATED_PYTHON_PIP_WRAPPER="$ISOLATED_PYTHON_PREFIX/bin/$ISOLATED_PIP_COMMAND"
    ISOLATED_PYTHON_INSTALL_SOURCE=""
    ISOLATED_PYTHON_TARBALL_PATH=""
    BUILD_DEP_PACKAGES=(build-essential make pkg-config libssl-dev zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev libffi-dev liblzma-dev libncurses-dev uuid-dev ca-certificates curl)

isolated_python_exe_reports_supported() {
    # $1 = candidate interpreter path; prints nothing; returns success when the
    # binary runs and reports major.minor == $ISOLATED_PYTHON_VERSION.
    local candidate="$1"
    local minor_text=""
    [ -n "$candidate" ] && [ -x "$candidate" ] || return 1
    minor_text="$("$candidate" -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || true)"
    [ "$minor_text" = "$ISOLATED_PYTHON_VERSION" ]
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
    echo "[$SCRIPT_INDEX] $USE_SUDO apt-get update"
    $USE_SUDO apt-get update || true
    echo "[$SCRIPT_INDEX] $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y ${missing_packages[*]} --no-install-recommends"
    if ! $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y "${missing_packages[@]}" --no-install-recommends; then
        print_error_from_common_functions "STAGE=build_deps failed: apt could not install ${missing_packages[*]}"
        return 1
    fi
    return 0
}

download_source_tarball() {
    print_step_from_common_functions "Downloading CPython $ISOLATED_PYTHON_SOURCE_RELEASE source (official release tarball)..."
    mkdir -p "$ISOLATED_PYTHON_BUILD_ROOT"
    local tarball_path="$ISOLATED_PYTHON_BUILD_ROOT/$ISOLATED_PYTHON_TARBALL_NAME"
    local partial_path="$tarball_path.part"

    if [ -f "$tarball_path" ]; then
        if echo "$ISOLATED_PYTHON_SOURCE_SHA256  $tarball_path" | sha256sum -c - >/dev/null 2>&1; then
            print_info_from_common_functions "Source tarball already present with matching sha256; skipping download"
            ISOLATED_PYTHON_TARBALL_PATH="$tarball_path"
            return 0
        fi
        print_warning_from_common_functions "Existing tarball failed sha256 verification; re-downloading"
    fi

    echo "[$SCRIPT_INDEX] curl -fL $ISOLATED_PYTHON_SOURCE_URL -o $partial_path"
    if ! curl -fL "$ISOLATED_PYTHON_SOURCE_URL" -o "$partial_path"; then
        print_error_from_common_functions "STAGE=download failed: $ISOLATED_PYTHON_SOURCE_URL"
        return 1
    fi
    if ! echo "$ISOLATED_PYTHON_SOURCE_SHA256  $partial_path" | sha256sum -c - >/dev/null 2>&1; then
        print_error_from_common_functions "STAGE=download failed: sha256 mismatch for $ISOLATED_PYTHON_TARBALL_NAME"
        return 1
    fi
    mv "$partial_path" "$tarball_path"
    ISOLATED_PYTHON_TARBALL_PATH="$tarball_path"
    return 0
}

build_isolated_python_from_source() {
    local tarball_path="$1"
    local source_dir="$ISOLATED_PYTHON_BUILD_ROOT/Python-$ISOLATED_PYTHON_SOURCE_RELEASE"

    print_step_from_common_functions "Building CPython $ISOLATED_PYTHON_SOURCE_RELEASE into isolated prefix $ISOLATED_PYTHON_PREFIX (arch: $(uname -m))..."
    if [ ! -d "$source_dir" ]; then
        echo "[$SCRIPT_INDEX] tar -xzf $tarball_path -C $ISOLATED_PYTHON_BUILD_ROOT"
        if ! tar -xzf "$tarball_path" -C "$ISOLATED_PYTHON_BUILD_ROOT"; then
            print_error_from_common_functions "STAGE=extract failed: $tarball_path"
            return 1
        fi
    fi

    echo "[$SCRIPT_INDEX] configure --prefix=$ISOLATED_PYTHON_PREFIX --with-ensurepip=install"
    if ! (cd "$source_dir" && ./configure --prefix="$ISOLATED_PYTHON_PREFIX" --with-ensurepip=install); then
        print_error_from_common_functions "STAGE=configure failed"
        return 1
    fi
    echo "[$SCRIPT_INDEX] make -j$(nproc)"
    if ! (cd "$source_dir" && make -j"$(nproc)"); then
        print_error_from_common_functions "STAGE=make failed"
        return 1
    fi
    # altinstall semantics: never overwrites a python3 / python3-major link.
    echo "[$SCRIPT_INDEX] make altinstall"
    if ! (cd "$source_dir" && $USE_SUDO make altinstall); then
        print_error_from_common_functions "STAGE=altinstall failed"
        return 1
    fi
    return 0
}

ensure_pip_for_base() {
    print_step_from_common_functions "Ensuring pip for the Python $ISOLATED_PYTHON_VERSION base interpreter..."
    if "$ISOLATED_PYTHON_BASE_BIN" -m pip --version >/dev/null 2>&1; then
        print_success_from_common_functions "pip present: $("$ISOLATED_PYTHON_BASE_BIN" -m pip --version 2>&1)"
        return 0
    fi
    echo "[$SCRIPT_INDEX] $ISOLATED_PYTHON_BASE_BIN -m ensurepip --upgrade"
    "$ISOLATED_PYTHON_BASE_BIN" -m ensurepip --upgrade || true
    if "$ISOLATED_PYTHON_BASE_BIN" -m pip --version >/dev/null 2>&1; then
        print_success_from_common_functions "pip bootstrapped: $("$ISOLATED_PYTHON_BASE_BIN" -m pip --version 2>&1)"
        return 0
    fi
    print_error_from_common_functions "STAGE=pip failed: pip still unavailable for $ISOLATED_PYTHON_BASE_BIN"
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
    echo "[$SCRIPT_INDEX] $USE_SUDO ln -s $target_path $link_path"
    $USE_SUDO ln -s "$target_path" "$link_path"
    print_success_from_common_functions "Linked $link_path -> $target_path"
    return 0
}

ensure_command_links() {
    if [ ! -x "$ISOLATED_PYTHON_PIP_BIN" ]; then
        if [ ! -e "$ISOLATED_PYTHON_PIP_WRAPPER" ]; then
            $USE_SUDO mkdir -p "$ISOLATED_PYTHON_PREFIX/bin"
            printf '#!/bin/bash\nexec "%s" -m pip "$@"\n' "$ISOLATED_PYTHON_BASE_BIN" | $USE_SUDO tee "$ISOLATED_PYTHON_PIP_WRAPPER" >/dev/null
            $USE_SUDO chmod +x "$ISOLATED_PYTHON_PIP_WRAPPER"
        fi
        ISOLATED_PYTHON_PIP_BIN="$ISOLATED_PYTHON_PIP_WRAPPER"
    fi
    print_step_from_common_functions "Ensuring $ISOLATED_PYTHON_COMMAND / ${ISOLATED_PIP_COMMAND} links in $ISOLATED_PYTHON_LINK_DIR..."
    link_command "$ISOLATED_PYTHON_LINK_PYTHON" "$ISOLATED_PYTHON_BASE_BIN" || true
    link_command "$ISOLATED_PYTHON_LINK_PIP" "$ISOLATED_PYTHON_PIP_BIN" || true
    # Convenience links for the versioned names; conflicts are reported, never forced.
    link_command "$ISOLATED_PYTHON_LINK_DIR/python$ISOLATED_PYTHON_VERSION" "$ISOLATED_PYTHON_BASE_BIN" || true
    link_command "$ISOLATED_PYTHON_LINK_DIR/pip$ISOLATED_PYTHON_VERSION" "$ISOLATED_PYTHON_PIP_BIN" || true
}

register_isolated_python_storage() {
    print_step_from_common_functions "Registering Python $ISOLATED_PYTHON_VERSION paths in the global var store..."
    set_var "${ISOLATED_RUNTIME_KEY}_EXE_PATH" "$ISOLATED_PYTHON_BASE_BIN"
    set_var "${ISOLATED_RUNTIME_KEY}_PIP_PATH" "$ISOLATED_PYTHON_PIP_BIN"
    set_var "${ISOLATED_RUNTIME_KEY}_VERSION" "$ISOLATED_PYTHON_VERSION"
    set_var "${ISOLATED_RUNTIME_KEY}_INSTALL_SOURCE" "$ISOLATED_PYTHON_INSTALL_SOURCE"
    print_success_from_common_functions "Registered ${ISOLATED_RUNTIME_KEY}_EXE_PATH=$ISOLATED_PYTHON_BASE_BIN (source: $ISOLATED_PYTHON_INSTALL_SOURCE)"
}

main() {
    print_header_from_common_functions "Isolated Python $ISOLATED_PYTHON_VERSION Setup (keeps system python3 untouched)"

    # Stage 1: reuse the existing project prefix interpreter when healthy.
    if isolated_python_exe_reports_supported "$ISOLATED_PYTHON_BASE_BIN"; then
        print_success_from_common_functions "Python $ISOLATED_PYTHON_VERSION already installed at $ISOLATED_PYTHON_BASE_BIN"
        ISOLATED_PYTHON_INSTALL_SOURCE="existing_prefix"
    else
        # Stage 2: adopt a trusted system-provided $ISOLATED_PYTHON_VERSION absolute path (no rebuild).
        local system_candidate=""
        local adopted=0
        for system_candidate in /usr/bin/python$ISOLATED_PYTHON_VERSION /usr/local/bin/python$ISOLATED_PYTHON_VERSION; do
            if isolated_python_exe_reports_supported "$system_candidate"; then
                print_info_from_common_functions "Adopting system Python $ISOLATED_PYTHON_VERSION at $system_candidate (no rebuild)"
                ISOLATED_PYTHON_BASE_BIN="$system_candidate"
                ISOLATED_PYTHON_PIP_BIN="$(dirname "$system_candidate")/pip$ISOLATED_PYTHON_VERSION"
                ISOLATED_PYTHON_INSTALL_SOURCE="system_binary"
                adopted=1
                break
            fi
        done

        # Stage 3: build from the official source release into the isolated prefix.
        if [ "$adopted" -eq 0 ]; then
            if ! command -v apt-get >/dev/null 2>&1; then
                print_error_from_common_functions "STAGE=detect failed: no system $ISOLATED_PYTHON_VERSION binary and apt-get unavailable; cannot build from source on this distribution"
                return 0
            fi
            ensure_build_dependencies || return 0
            ISOLATED_PYTHON_TARBALL_PATH=""
            download_source_tarball || return 0
            [ -n "$ISOLATED_PYTHON_TARBALL_PATH" ] || return 0
            build_isolated_python_from_source "$ISOLATED_PYTHON_TARBALL_PATH" || return 0
            ISOLATED_PYTHON_INSTALL_SOURCE="source_build_$ISOLATED_PYTHON_SOURCE_RELEASE"
        fi
    fi

    if ! isolated_python_exe_reports_supported "$ISOLATED_PYTHON_BASE_BIN"; then
        print_error_from_common_functions "STAGE=detect failed: no usable Python $ISOLATED_PYTHON_VERSION interpreter"
        return 0
    fi

    ensure_pip_for_base || return 0
    ensure_command_links
    register_isolated_python_storage

    print_success_from_common_functions "$ISOLATED_PYTHON_COMMAND: $(command -v "$ISOLATED_PYTHON_COMMAND" || echo "$ISOLATED_PYTHON_LINK_PYTHON") -> $ISOLATED_PYTHON_BASE_BIN"
    print_info_from_common_functions "Default python3 / pip3 and the project venv are unchanged"
}

    main
)
