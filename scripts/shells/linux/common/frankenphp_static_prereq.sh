#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# FrankenPHP Static Build Prerequisites (common area) - converges the full
# host toolchain the official ./build-static.sh (static-php-cli) needs on
# Debian/Ubuntu/Kali: the apt-sources self-heal lives in the shared
# apt_sources_restore.sh (single source of truth, also used by
# 3_setting_base.sh), this file adds the package-set convergence around
# it (what spc doctor checks: bison/re2c/flex plus the C toolchain and
# the build systems some source libs fall back to). Idempotent: a
# satisfied system no-ops without touching apt at all.
#
# STDOUT CONTRACT: all logs go to stderr; fm_static_prereq_ensure
# echoes ONLY "ok" / "failed" on stdout (string contract, never an exit
# code) so fm_static_build can capture it safely.
# Sourced by frankenphp_static_builder.sh; standalone: ensure | check.

FM_STATIC_PREREQ_TAG="frankenphp-static-prereq"
FM_STATIC_PREREQ_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Full toolchain set (Debian/Ubuntu/Kali common names): download/base
# tools, the C toolchain, the php-src generators spc doctor checks
# (bison/re2c/flex), autotools, and the build systems some source libs
# fall back to (cmake/ninja).
FM_STATIC_PREREQ_PKGS="ca-certificates curl wget git xz-utils unzip bzip2 zip tar gzip file patch perl pkg-config build-essential autoconf automake libtool m4 bison re2c flex cmake ninja-build"

# Shared apt-sources self-heal (distro detection + native restore).
# shellcheck source=/dev/null
source "${FM_STATIC_PREREQ_CURRENT_DIR}/apt_sources_restore.sh"

# Installed probe for one package (dpkg "install ok installed" state).
fm_static_prereq_pkg_installed() {
    dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q '^install ok installed$'
}

# Repository-candidate probe for one package (apt-cache finds a version).
fm_static_prereq_pkg_candidate() {
    local candidate=""
    candidate="$(apt-cache policy "$1" 2>/dev/null | sed -n 's/^  Candidate: //p')"
    [ -n "$candidate" ] && [ "$candidate" != "(none)" ]
}

# Subset of $1 (package list) that is NOT installed.
fm_static_prereq_missing() {
    local pkg=""
    for pkg in $1; do
        fm_static_prereq_pkg_installed "$pkg" || echo "$pkg"
    done
}

# Subset of $1 (package list) with NO repository candidate.
fm_static_prereq_no_candidate() {
    local pkg=""
    for pkg in $1; do
        fm_static_prereq_pkg_candidate "$pkg" || echo "$pkg"
    done
}

# Converge the full static-build toolchain (string contract: ok/failed on
# stdout, logs on stderr, exit code always 0). Fast path: everything
# installed -> no apt invocation at all. Repair path: native sources
# heal (apt_sources_restore) -> apt-get update when lists changed or
# candidates are missing -> install only the missing subset -> verify.
fm_static_prereq_ensure() {
    local os_id=""
    local codename=""
    local missing=""
    local no_cand=""

    os_id="$(apt_sources_restore_os_id)"
    case "$os_id" in
        debian|ubuntu|kali) ;;
        *)
            echo "[$FM_STATIC_PREREQ_TAG] [ERROR] unsupported OS id '${os_id:-unknown}' (need debian/ubuntu/kali)" >&2
            echo "failed"
            return 0
            ;;
    esac
    codename="$(apt_sources_restore_codename)"
    if [ -z "$codename" ]; then
        echo "[$FM_STATIC_PREREQ_TAG] [ERROR] cannot resolve the ${os_id} release codename" >&2
        echo "failed"
        return 0
    fi

    missing="$(fm_static_prereq_missing "$FM_STATIC_PREREQ_PKGS")"
    if [ -z "$missing" ]; then
        echo "[$FM_STATIC_PREREQ_TAG] prerequisites already satisfied (no apt action)" >&2
        echo "ok"
        return 0
    fi
    echo "[$FM_STATIC_PREREQ_TAG] missing packages: $(echo "$missing" | tr '\n' ' ')" >&2

    apt_sources_restore_ensure 1>&2 || true
    no_cand="$(fm_static_prereq_no_candidate "$missing")"
    if [ -n "$no_cand" ] || [ "$APT_SOURCES_RESTORE_CHANGED" = "true" ]; then
        if [ -n "$no_cand" ]; then
            echo "[$FM_STATIC_PREREQ_TAG] packages without repository candidate: $(echo "$no_cand" | tr '\n' ' ')" >&2
        fi
        echo "[$FM_STATIC_PREREQ_TAG] refreshing apt package lists" >&2
        if ! $USE_SUDO apt-get update 1>&2; then
            echo "[$FM_STATIC_PREREQ_TAG] [WARN] apt-get update reported errors (continuing)" >&2
        fi
        no_cand="$(fm_static_prereq_no_candidate "$missing")"
        if [ -n "$no_cand" ]; then
            echo "[$FM_STATIC_PREREQ_TAG] [ERROR] still no installation candidate after sources heal: $(echo "$no_cand" | tr '\n' ' ')" >&2
            echo "failed"
            return 0
        fi
    fi

    # shellcheck disable=SC2086
    if ! $USE_SUDO apt-get install -y $missing 1>&2; then
        echo "[$FM_STATIC_PREREQ_TAG] [ERROR] apt-get install failed" >&2
        echo "failed"
        return 0
    fi

    missing="$(fm_static_prereq_missing "$FM_STATIC_PREREQ_PKGS")"
    if [ -n "$missing" ]; then
        echo "[$FM_STATIC_PREREQ_TAG] [ERROR] packages still missing after install: $(echo "$missing" | tr '\n' ' ')" >&2
        echo "failed"
        return 0
    fi
    echo "[$FM_STATIC_PREREQ_TAG] prerequisites satisfied (spc doctor --auto-fix will find a ready host)" >&2
    echo "ok"
    return 0
}


# Read-only report: distro, missing packages, candidate gaps, sources state.
fm_static_prereq_check() {
    local os_id=""
    local missing=""

    os_id="$(apt_sources_restore_os_id)"
    echo "[$FM_STATIC_PREREQ_TAG] os: ${os_id:-unknown} $(apt_sources_restore_codename)" >&2
    missing="$(fm_static_prereq_missing "$FM_STATIC_PREREQ_PKGS")"
    if [ -z "$missing" ]; then
        echo "[$FM_STATIC_PREREQ_TAG] all toolchain packages installed" >&2
    else
        echo "[$FM_STATIC_PREREQ_TAG] missing: $(echo "$missing" | tr '\n' ' ')" >&2
        echo "[$FM_STATIC_PREREQ_TAG] no candidate: $(fm_static_prereq_no_candidate "$missing" | tr '\n' ' ')" >&2
    fi
    apt_sources_restore_check
}

# Management CLI (same surface style as frankenphp_manager.sh):
#   ensure (default) | check
if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    USE_SUDO="${USE_SUDO:-}"
    case "${1:-ensure}" in
        check)
            fm_static_prereq_check
            ;;
        ensure|*)
            fm_static_prereq_ensure
            ;;
    esac
fi
