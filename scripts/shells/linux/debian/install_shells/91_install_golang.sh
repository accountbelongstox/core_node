#!/bin/bash
# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPENDERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or update test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables; Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Script: 91_install_golang.sh
# Description: Idempotent Go toolchain manager that converges $COMPILE_DIR/go
#   to the pinned GO_VERSION from gvar_common.sh (single source of truth):
#     - GO_BIN reports the pinned version  -> no-op (only env/symlink ensure)
#     - GO_BIN reports ANY other version  -> uninstall old GO_DIR, install pinned
#     - GO_BIN missing / broken           -> clean install
#   Convergence is bidirectional (older OR newer local toolchains are reset to
#   the pin) so xcaddy/frankenphp builds always see one deterministic toolchain.
#   This step is the Go prerequisite for 93_install_frankenphp.sh: the official
#   static build (./build-static.sh; spc go-xcaddy + frankenphp v1.12.7
#   module build, Caddy v2.11.4 / libdns v1) requires go >= 1.26.0, which
#   go1.22.x cannot satisfy.

# Source gvar_common.sh from parent directory
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

INSTALL_GO=$(get_var "INSTALL_GO")
INSTALL_MODE=$(get_var "INSTALL_MODE")

if [ "$INSTALL_GO" = "false" ]; then
    echo "Skipping Go installation,INSTALL_GO: $INSTALL_GO,INSTALL_MODE: $INSTALL_MODE"
    exit 0
fi

GO_TARGET_VERSION_TAG="go${GO_VERSION}"

# Get region information
SELECTED_REGION=$(get_var "SELECTED_REGION")
# Use global temporary directory structure
SCRIPT_TEMP_DIR=$(create_script_temp_dir "91_install_golang")
GO_TARBALL_PATH="$SCRIPT_TEMP_DIR/$GO_VERSION_AMD64_FILE.tar.gz"

# Report the local toolchain version of $GO_BIN ("1.26.6") or "" when the
# binary is missing/broken. Pure file probe - no PATH, no exit-code chaining.
go_local_version() {
    if [ -x "$GO_BIN" ]; then
        "$GO_BIN" version 2>/dev/null | awk '{print $3}' | sed 's/^go//'
    fi
}

go_tarball_size() {
    stat -c%s "$GO_TARBALL_PATH" 2>/dev/null || echo 0
}

# Acceptance gate: pinned size + pinned sha256 (gvar_common). File state
# only - never a curl exit code (no exit-code chaining). A hijacked or
# truncated payload cannot pass both pins.
go_tarball_integrity_ok() {
    local actual_size=""
    local actual_sha=""
    [ -f "$GO_TARBALL_PATH" ] || return 1
    actual_size="$(go_tarball_size)"
    [ "$actual_size" = "$GO_TARBALL_SIZE" ] || return 1
    if [ -n "$GO_TARBALL_SHA256" ]; then
        actual_sha="$(sha256sum "$GO_TARBALL_PATH" 2>/dev/null | awk '{print $1}')"
        [ "$actual_sha" = "$GO_TARBALL_SHA256" ] || return 1
    fi
    return 0
}

download_go_tarball() {
    local url=""
    local round=""
    local attempt=""
    local http_code=""
    echo "Downloading Go $GO_VERSION_AMD64_FILE..."
    mkdir -p "$SCRIPT_TEMP_DIR"
    echo "Cleaning up previous downloads..."
    rm -f "$GO_TARBALL_PATH"
    # Anti-hijack strategy over the ordered gvar_common GO_TAR_URLS chain
    # (aliyun first, NJU last) - three rules:
    #   1. NO curl -f: the REAL HTTP status code is captured via
    #      -w "%{http_code}" and judged manually, so transparent proxies
    #      rewriting responses cannot hide behind -f error semantics.
    #   2. curl -C - resume: Range requests (206) survive even when
    #      long-lived full streams are reset mid-body, so each retry
    #      continues the partial file instead of restarting from zero.
    #   3. Only 200/206 are keepers; any other code (404, 403, hijacked
    #      redirect, 000 connect failure) discards the partial file, and
    #      residue is removed before switching mirrors so resume never
    #      stitches bodies from two different origins together.
    # Final acceptance is ALWAYS the pinned size + sha256 above.
    for round in 1 2 3; do
        for url in "${GO_TAR_URLS[@]}"; do
            for attempt in 1 2 3; do
                if go_tarball_integrity_ok; then
                    echo "Download verified (size+sha256): $GO_TARBALL_PATH"
                    return 0
                fi
                echo "[round $round] [try $attempt] Fetching: $url"
                http_code="$($USE_SUDO curl -sS -L -C - --connect-timeout 10 --max-time 120 \
                    -w "%{http_code}" -o "$GO_TARBALL_PATH" "$url" | tail -n 1 | tr -d '[:space:]')"
                if [ "$http_code" != "200" ] && [ "$http_code" != "206" ]; then
                    echo "[round $round] [try $attempt] Rejected: real HTTP status '$http_code'"
                    rm -f "$GO_TARBALL_PATH"
                    break
                fi
                if go_tarball_integrity_ok; then
                    echo "Download verified (size+sha256): $GO_TARBALL_PATH"
                    return 0
                fi
                echo "[round $round] [try $attempt] Partial $(go_tarball_size)/$GO_TARBALL_SIZE bytes; resuming in 5s..."
                sleep 5
            done
            rm -f "$GO_TARBALL_PATH"
        done
        echo "[round $round] all sources failed so far; retrying chain in 15s..."
        sleep 15
    done
    echo "Error: all download sources failed after 3 rounds (last: $GO_TARBALL_PATH)."
    return 1
}

uninstall_old_go() {
    local old_version
    old_version="$(go_local_version)"
    if [ -d "$GO_DIR" ]; then
        if [ -n "$old_version" ]; then
            echo "Uninstalling old Go toolchain: $old_version (target: $GO_VERSION)"
        else
            echo "Removing broken/partial Go directory: $GO_DIR"
        fi
        # Drop stale symlinks first so nothing on PATH points at the tree
        # being removed; they are re-created after the pinned install.
        [ -L /usr/local/bin/go ] && $USE_SUDO rm -f /usr/local/bin/go
        [ -L /usr/local/bin/gofmt ] && $USE_SUDO rm -f /usr/local/bin/gofmt
        $USE_SUDO rm -rf "$GO_DIR"
        if [ -d "$GO_DIR" ]; then
            echo "Error: failed to remove old $GO_DIR"
            return 1
        fi
    fi
    return 0
}

install_pinned_go() {
    if ! go_tarball_integrity_ok; then
        echo "No verified tarball at $GO_TARBALL_PATH; downloading..."
        download_go_tarball
        if ! go_tarball_integrity_ok; then
            return 1
        fi
    fi
    echo "Tarball integrity verified: $GO_TARBALL_PATH"

    echo "Ensuring required directories exist..."
    if [ ! -d "$COMPILE_DIR" ]; then
        echo "Creating directory $COMPILE_DIR..."
        $USE_SUDO mkdir -p "$COMPILE_DIR"
    fi

    echo "Extracting Go tarball to $COMPILE_DIR..."
    $USE_SUDO tar -C "$COMPILE_DIR" -xzf "$GO_TARBALL_PATH"

    if [ ! -x "$GO_BIN" ]; then
        echo "Error: Extraction failed (no executable $GO_BIN)."
        echo "Target directory: $GO_DIR"
        return 1
    fi

    local installed_tag
    installed_tag="go$(go_local_version)"
    if [ "$installed_tag" != "$GO_TARGET_VERSION_TAG" ]; then
        echo "Error: installed toolchain is $installed_tag, expected $GO_TARGET_VERSION_TAG."
        return 1
    fi
    echo "Go $GO_VERSION installed at $GO_DIR"
    return 0
}

# --- Converge $GO_DIR to the pinned toolchain (idempotent) ---
LOCAL_GO_VERSION="$(go_local_version)"

if [ -n "$LOCAL_GO_VERSION" ] && [ "go$LOCAL_GO_VERSION" = "$GO_TARGET_VERSION_TAG" ]; then
    echo "Go $GO_VERSION (pinned version) already installed at $GO_BIN - nothing to do."
else
    if [ -n "$LOCAL_GO_VERSION" ]; then
        echo "Go version mismatch: found $LOCAL_GO_VERSION, pinned target is $GO_VERSION."
    else
        echo "Go not found at $GO_BIN. Starting installation process..."
    fi

    uninstall_old_go
    install_pinned_go
    if [ ! -x "$GO_BIN" ]; then
        # Hard abort: without a toolchain the proxy/symlink sections below
        # would operate on a missing tree (dangling /usr/local/bin links).
        echo "Error: Go $GO_VERSION not installed; aborting this step."
        exit 1
    fi
fi

# --- Configure GOPROXY based on selected region (idempotent) ---
echo "Configuring Go proxy settings based on region: $SELECTED_REGION"

if [ "$SELECTED_REGION" = "Global" ]; then
    echo "Region is Global - using default Go proxy settings"
    echo "GOPROXY will use Go's default proxy (proxy.golang.org)"

    CURRENT_GOPROXY=$("$GO_BIN" env GOPROXY 2>/dev/null)

    if [[ "$CURRENT_GOPROXY" == *"goproxy.cn"* ]]; then
        echo "Removing China proxy configuration..."
        $USE_SUDO "$GO_BIN" env -w GOPROXY=https://proxy.golang.org,direct
        echo "Reset GOPROXY to default: https://proxy.golang.org,direct"
    else
        echo "GOPROXY is already set to: $CURRENT_GOPROXY"
    fi
else
    # China or other regions - use China proxy
    PROXY_URL="https://goproxy.cn,direct"
    CURRENT_GOPROXY=$("$GO_BIN" env GOPROXY 2>/dev/null)

    if [[ "$CURRENT_GOPROXY" != *"goproxy.cn"* ]]; then
        echo "Setting Go proxy for China region..."
        echo "Configuring GOPROXY to $PROXY_URL"
        $USE_SUDO "$GO_BIN" env -w GO111MODULE=on
        $USE_SUDO "$GO_BIN" env -w GOPROXY=$PROXY_URL
        echo "GOPROXY configured to: $PROXY_URL"
    else
        echo "GOPROXY is already set to: $CURRENT_GOPROXY"
    fi
fi

# --- Always ensure symlinks are correctly set (full paths; ln -sf is idempotent) ---
echo "Ensuring Go symlinks are correctly set in /usr/local/bin..."

if [ "$(readlink /usr/local/bin/go 2>/dev/null)" != "$GO_DIR/bin/go" ]; then
    [ -L /usr/local/bin/go ] && $USE_SUDO rm -f /usr/local/bin/go
    $USE_SUDO ln -sf "$GO_DIR/bin/go" /usr/local/bin/go
fi
if [ "$(readlink /usr/local/bin/gofmt 2>/dev/null)" != "$GO_DIR/bin/gofmt" ]; then
    [ -L /usr/local/bin/gofmt ] && $USE_SUDO rm -f /usr/local/bin/gofmt
    $USE_SUDO ln -sf "$GO_DIR/bin/gofmt" /usr/local/bin/gofmt
fi

echo "Symlinks ensured:"
echo "  /usr/local/bin/go -> $GO_DIR/bin/go"
echo "  /usr/local/bin/gofmt -> $GO_DIR/bin/gofmt"

# --- Final verification via full path probes (no PATH reliance) ---
FINAL_GO_VERSION="$("$GO_BIN" version 2>/dev/null)"
if [ -z "$FINAL_GO_VERSION" ]; then
    echo "Go installation verification failed ($GO_BIN not executable)."
    echo "GO_DIR: $GO_DIR"
    echo "COMPILE_DIR: $COMPILE_DIR"
    echo "GO_VERSION_AMD64_FILE: $GO_VERSION_AMD64_FILE"
    exit 1
fi

echo "$FINAL_GO_VERSION"
echo "GOPROXY setting:"
"$GO_BIN" env GOPROXY
