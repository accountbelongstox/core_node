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

# Central Android build environment library (single source of truth) for the
# Capacitor/AGP toolchain on Linux/Debian/WSL. Consumers:
#   debian/install_shells/142_install_android_sdk.sh (dd idempotent step)
#   poly_apps/pycore_laravel_wordnew_ui/scripts/start_build.sh (build entry)
# All detection is by BINARY EXISTENCE; all shared state lives in ANDROID_BUILD_*
# globals so functions never depend on caller scope chains. Toolchain versions
# follow Capacitor 8 / AGP 8.13 (compile/targetSdk 36, build-tools 36.0.0, JDK 21).

ANDROID_BUILD_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# dd constants via gvar_common.sh (CORE_NODE_CACHE_DIR, COMPILE_DIR); source once.
if [ -z "${CORE_NODE_CACHE_DIR:-}" ]; then
    # shellcheck disable=SC1091
    source "${ANDROID_BUILD_LIB_DIR}/gvar_common.sh"
fi

# ---------- Central toolchain constants ----------
ANDROID_BUILD_REQUIRED_JAVA_MAJOR=21
ANDROID_BUILD_API=36
ANDROID_BUILD_TOOLS="36.0.0"
ANDROID_BUILD_CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-14742923_latest.zip"
ANDROID_BUILD_SDK_CACHE_ROOT="${CORE_NODE_CACHE_DIR:-/var/_core_node/cache}/pycore/android-build/android-sdk"

# ---------- Central shared state (filled by android_build_resolve_* detectors) ----------
ANDROID_BUILD_JAVA_HOME=""
ANDROID_BUILD_JAVA_MAJOR=0
ANDROID_BUILD_SDK_ROOT=""

# ---------- Detectors (pure; touch only ANDROID_BUILD_* globals or params) ----------

android_build_java_major_of() {
    local bin="$1" line=""
    line="$("$bin" -version 2>&1 | head -n1)" || return 0
    if printf '%s' "$line" | grep -qE 'version "1\.'; then
        printf '%s' "$line" | sed -E 's/.*version "1\.([0-9]+).*/\1/'
    else
        printf '%s' "$line" | sed -E 's/.*version "([0-9]+).*/\1/'
    fi
}

android_build_valid_java_home() { [ -n "$1" ] && [ -x "$1/bin/java" ]; }

# Fill ANDROID_BUILD_JAVA_HOME by BINARY EXISTENCE: env JAVA_HOME ->
# /etc/environment JAVA_HOME (written by 55_install_java.sh) -> PATH java ->
# compile-dir JDKs (dd constant COMPILE_DIR + conventional mirrors) -> distro JVMs.
android_build_resolve_java_home() {
    ANDROID_BUILD_JAVA_HOME="${JAVA_HOME:-}"
    if ! android_build_valid_java_home "$ANDROID_BUILD_JAVA_HOME"; then
        ANDROID_BUILD_JAVA_HOME="$(grep -m1 '^JAVA_HOME=' /etc/environment 2>/dev/null | cut -d= -f2 | tr -d '"')"
    fi
    if ! android_build_valid_java_home "$ANDROID_BUILD_JAVA_HOME"; then
        local java_bin=""
        java_bin="$(command -v java 2>/dev/null)"
        if [ -n "$java_bin" ]; then
            ANDROID_BUILD_JAVA_HOME="$(cd "$(dirname "$java_bin")/.." && pwd)"
        fi
    fi
    if ! android_build_valid_java_home "$ANDROID_BUILD_JAVA_HOME"; then
        local candidate=""
        for candidate in "${COMPILE_DIR:-/nonexistent}/java"/jdk-* \
                         /www/compile/java/jdk-* /mnt/*/www/compile/java/jdk-* \
                         /opt/jdk-* /usr/lib/jvm/*temurin* /usr/lib/jvm/*openjdk*; do
            [ -e "$candidate" ] || continue
            if android_build_valid_java_home "$candidate"; then
                ANDROID_BUILD_JAVA_HOME="$candidate"
                break
            fi
        done
    fi
    android_build_valid_java_home "$ANDROID_BUILD_JAVA_HOME" || ANDROID_BUILD_JAVA_HOME=""
    ANDROID_BUILD_JAVA_MAJOR=0
    if [ -n "$ANDROID_BUILD_JAVA_HOME" ]; then
        ANDROID_BUILD_JAVA_MAJOR="$(android_build_java_major_of "$ANDROID_BUILD_JAVA_HOME/bin/java")"
    fi
}

android_build_java_ready() {
    android_build_valid_java_home "$ANDROID_BUILD_JAVA_HOME" || return 1
    [ "${ANDROID_BUILD_JAVA_MAJOR:-0}" -ge "$ANDROID_BUILD_REQUIRED_JAVA_MAJOR" ]
}

android_build_valid_sdk_root() {
    [ -n "$1" ] || return 1
    [ -x "$1/cmdline-tools/latest/bin/sdkmanager" ] && return 0
    [ -x "$1/cmdline-tools/bin/sdkmanager" ] && return 0
    [ -x "$1/platform-tools/adb" ] && return 0
    return 1
}

# Fill ANDROID_BUILD_SDK_ROOT by BINARY EXISTENCE: env -> user default ->
# distro roots -> cache-constant fallback.
android_build_resolve_sdk_root() {
    ANDROID_BUILD_SDK_ROOT=""
    local candidate=""
    for candidate in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$HOME/Android/Sdk" \
                     /opt/android-sdk /usr/lib/android-sdk "$ANDROID_BUILD_SDK_CACHE_ROOT"; do
        if android_build_valid_sdk_root "$candidate"; then
            ANDROID_BUILD_SDK_ROOT="$candidate"
            return
        fi
    done
    ANDROID_BUILD_SDK_ROOT="$ANDROID_BUILD_SDK_CACHE_ROOT"
}

android_build_get_sdk_manager() {
    [ -n "$1" ] || return 0
    if [ -x "$1/cmdline-tools/latest/bin/sdkmanager" ]; then
        printf '%s' "$1/cmdline-tools/latest/bin/sdkmanager"
        return 0
    fi
    if [ -x "$1/cmdline-tools/bin/sdkmanager" ]; then
        printf '%s' "$1/cmdline-tools/bin/sdkmanager"
        return 0
    fi
    return 0
}

# True when sdkmanager + adb + platform android.jar + build-tools all exist.
android_build_test_sdk_ready() {
    [ -n "$ANDROID_BUILD_SDK_ROOT" ] || return 1
    local manager=""
    manager="$(android_build_get_sdk_manager "$ANDROID_BUILD_SDK_ROOT")"
    [ -n "$manager" ] || return 1
    [ -x "$ANDROID_BUILD_SDK_ROOT/platform-tools/adb" ] || return 1
    [ -f "$ANDROID_BUILD_SDK_ROOT/platforms/android-${ANDROID_BUILD_API}/android.jar" ] || return 1
    [ -d "$ANDROID_BUILD_SDK_ROOT/build-tools/${ANDROID_BUILD_TOOLS}" ] || return 1
    return 0
}

# Official Java proxy passthrough: HTTPS_PROXY/HTTP_PROXY -> JAVA_TOOL_OPTIONS,
# inherited by sdkmanager AND gradle (dependency downloads).
android_build_set_java_proxy() {
    local proxy_url="${HTTPS_PROXY:-${https_proxy:-${HTTP_PROXY:-${http_proxy:-}}}}"
    [ -n "$proxy_url" ] || return 1
    if printf '%s' "$proxy_url" | grep -qE '^(https?://)?[^:/]+:[0-9]+'; then
        local proxy_host="" proxy_port=""
        proxy_host="$(printf '%s' "$proxy_url" | sed -E 's#^(https?://)?([^:/]+):([0-9]+).*#\2#')"
        proxy_port="$(printf '%s' "$proxy_url" | sed -E 's#^(https?://)?([^:/]+):([0-9]+).*#\3#')"
        export JAVA_TOOL_OPTIONS="-Dhttps.proxyHost=${proxy_host} -Dhttps.proxyPort=${proxy_port} -Dhttp.proxyHost=${proxy_host} -Dhttp.proxyPort=${proxy_port}"
        return 0
    fi
    return 1
}
