#!/bin/bash

# Central Android build environment library (single source of truth) for the
# Capacitor/AGP toolchain on Linux/Debian/WSL. Consumers:
#   debian/install_shells/187_install_android_sdk.sh (dd idempotent step)
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
ANDROID_BUILD_LICENSE_FILE="licenses/android-sdk-license"
ANDROID_BUILD_SDK_GATE="INSTALL_ANDROID_SDK"
ANDROID_BUILD_JAVA_GATE="INSTALL_JAVA"
# Node toolchain commands and the project files the Capacitor Android build needs
# (paths relative to the UI project root / its native/<app>/android directory).
ANDROID_BUILD_NODE_COMMANDS=(node npx bun)
ANDROID_BUILD_NODE_DEP_MARKERS=(
    "node_modules/vite/bin/vite.js"
    "node_modules/@capacitor/cli/bin/capacitor"
    "node_modules/@capacitor/core/package.json"
    "node_modules/@capacitor/android/capacitor/build.gradle"
)
ANDROID_BUILD_PLATFORM_MARKERS=(
    "gradlew"
    "gradle/wrapper/gradle-wrapper.jar"
    "gradle/wrapper/gradle-wrapper.properties"
    "app/build.gradle"
    "capacitor.settings.gradle"
)

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

# Fill ANDROID_BUILD_JAVA_HOME by BINARY EXISTENCE with the first candidate whose
# major version meets ANDROID_BUILD_REQUIRED_JAVA_MAJOR (same rule as
# Resolve-AndroidBuildJavaHome): env JAVA_HOME -> /etc/environment JAVA_HOME
# (written by 92_install_java.sh) -> PATH java -> compile-dir JDKs (dd constant
# COMPILE_DIR + conventional mirrors) -> distro JVMs.
android_build_resolve_java_home() {
    local candidate="" env_home="" java_bin="" major=""
    local candidates=()
    ANDROID_BUILD_JAVA_HOME=""
    ANDROID_BUILD_JAVA_MAJOR=0
    [ -n "${JAVA_HOME:-}" ] && candidates+=("$JAVA_HOME")
    env_home="$(grep -m1 '^JAVA_HOME=' /etc/environment 2>/dev/null | cut -d= -f2 | tr -d '"')"
    [ -n "$env_home" ] && candidates+=("$env_home")
    java_bin="$(command -v java 2>/dev/null)"
    if [ -n "$java_bin" ]; then
        java_bin="$(readlink -f "$java_bin" 2>/dev/null || printf '%s' "$java_bin")"
        candidates+=("$(cd "$(dirname "$java_bin")/.." && pwd)")
    fi
    for candidate in "${COMPILE_DIR:-/nonexistent}/java"/jdk-* \
                     /www/compile/java/jdk-* /mnt/*/www/compile/java/jdk-* \
                     /opt/jdk-* /usr/lib/jvm/*temurin* /usr/lib/jvm/*openjdk*; do
        [ -e "$candidate" ] && candidates+=("$candidate")
    done
    for candidate in "${candidates[@]}"; do
        android_build_valid_java_home "$candidate" || continue
        major="$(android_build_java_major_of "$candidate/bin/java")"
        [ "${major:-0}" -ge "$ANDROID_BUILD_REQUIRED_JAVA_MAJOR" ] 2>/dev/null || continue
        ANDROID_BUILD_JAVA_HOME="$candidate"
        ANDROID_BUILD_JAVA_MAJOR="$major"
        return 0
    done
    return 0
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

# True when the SDK license file recorded by `sdkmanager --licenses` exists.
android_build_sdk_licenses_ready() {
    [ -n "$ANDROID_BUILD_SDK_ROOT" ] && [ -f "$ANDROID_BUILD_SDK_ROOT/$ANDROID_BUILD_LICENSE_FILE" ]
}

# Print each missing node toolchain command, one per line (nothing when ready).
android_build_missing_node_commands() {
    local command_name=""
    for command_name in "${ANDROID_BUILD_NODE_COMMANDS[@]}"; do
        command -v "$command_name" >/dev/null 2>&1 || printf '%s\n' "$command_name"
    done
}

# Print each missing node dependency marker under the UI project root $1.
android_build_missing_node_deps() {
    local project_root="$1" marker=""
    for marker in "${ANDROID_BUILD_NODE_DEP_MARKERS[@]}"; do
        [ -f "${project_root}/${marker}" ] || printf '%s\n' "$marker"
    done
}

# Print each missing file of the Capacitor Android platform directory $1
# (native/<app>/android); the whole list when the directory is missing.
android_build_missing_platform_files() {
    local android_dir="$1" marker=""
    for marker in "${ANDROID_BUILD_PLATFORM_MARKERS[@]}"; do
        [ -f "${android_dir}/${marker}" ] || printf '%s\n' "$marker"
    done
}

# Value of a dd install gate (ANDROID_BUILD_JAVA_GATE / ANDROID_BUILD_SDK_GATE);
# empty when the gvar store is not loaded. Windows has no such gates.
android_build_install_gate() {
    declare -F get_var >/dev/null 2>&1 || return 0
    get_var "$1"
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
