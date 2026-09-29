#!/bin/bash

# =============================================================================
# Shared login (root <-> real desktop user) for AI CLI config directories.
# =============================================================================
# For every catalog tool whose OFFICIAL config-dir environment variable is
# known (ai_tools_catalog.sh "*_shareable" = yes/partial), this makes root and
# the real desktop user read/write the SAME config directory:
#   1. The directory lives under the real user's home and is owned by them.
#   2. The variable is exported for every shell via /etc/profile.d, and kept
#      across sudo via `Defaults env_keep` in /etc/sudoers.d (validated with
#      `visudo -c` before being installed).
#   3. Ownership is repaired (chown -R back to the real user) after root runs
#      a tool, in case root's run created root-owned files in the shared dir.
# Tools without an official variable are left alone ("not shareable").
# =============================================================================

AI_SHARED_LOGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_SHARED_LOGIN_PROFILE_FILE="/etc/profile.d/core_node_ai_shared_login.sh"
AI_SHARED_LOGIN_SUDOERS_FILE="/etc/sudoers.d/core_node_ai_shared_login"

if ! command -v ai_catalog_get >/dev/null 2>&1; then
    # shellcheck source=ai_tools_catalog.sh
    . "$AI_SHARED_LOGIN_DIR/ai_tools_catalog.sh"
fi
if [ -z "${USE_SUDO+x}" ] || [ -z "${ACTUAL_DESKTOP_USER_HOME:-}" ]; then
    # shellcheck source=gvar_common.sh
    . "$AI_SHARED_LOGIN_DIR/gvar_common.sh"
fi

# ai_shared_login_real_user / _home -> resolve once, memoized in globals.
ai_shared_login_real_user() {
    if [ -n "${ACTUAL_DESKTOP_USER:-}" ]; then
        printf '%s' "$ACTUAL_DESKTOP_USER"
        return 0
    fi
    if command -v detect_system_user >/dev/null 2>&1; then
        detect_system_user
        return 0
    fi
    printf '%s' "${SUDO_USER:-$(id -un)}"
}

ai_shared_login_real_home() {
    local user=""
    if [ -n "${ACTUAL_DESKTOP_USER_HOME:-}" ]; then
        printf '%s' "$ACTUAL_DESKTOP_USER_HOME"
        return 0
    fi
    user="$(ai_shared_login_real_user)"
    getent passwd "$user" 2>/dev/null | cut -d: -f6
}

# List of catalog keys with an official, shareable config-dir variable.
ai_shared_login_shareable_keys() {
    local key shareable
    while IFS= read -r key; do
        shareable="$(ai_catalog_get "$key" "shareable")"
        case "$shareable" in
            yes|partial) printf '%s\n' "$key" ;;
        esac
    done < <(ai_catalog_keys)
}

# Ensure one tool's shared config dir exists and is owned by the real user.
ai_shared_login_ensure_dir() {
    local key="$1" real_user="$2" real_home="$3" config_dir="" ancestor=""
    config_dir="$(ai_catalog_expand_config_dir "$key" "$real_home")"
    [ -n "$config_dir" ] || return 0
    $USE_SUDO mkdir -p "$config_dir"
    $USE_SUDO chown -R "$real_user:$real_user" "$config_dir" 2>/dev/null || true
    # A nested config dir (e.g. ~/.cline/data) may have created a root-owned
    # parent (~/.cline) via mkdir -p; repair every ancestor up to real_home.
    ancestor="$(dirname "$config_dir")"
    while [ "$ancestor" != "$real_home" ] && [ "$ancestor" != "/" ] && [ "${#ancestor}" -gt "${#real_home}" ]; do
        $USE_SUDO chown "$real_user:$real_user" "$ancestor" 2>/dev/null || true
        ancestor="$(dirname "$ancestor")"
    done
    printf '%s' "$config_dir"
}

# Repair ownership of every shareable tool's config dir back to the real user.
# Call after any root-run AI CLI invocation (99_install_ai_tools.sh does this
# automatically after each tool install/verify).
ai_shared_login_repair_ownership() {
    local real_user real_home key config_dir
    real_user="$(ai_shared_login_real_user)"
    real_home="$(ai_shared_login_real_home)"
    [ -n "$real_user" ] && [ -n "$real_home" ] || return 0
    while IFS= read -r key; do
        config_dir="$(ai_catalog_expand_config_dir "$key" "$real_home")"
        [ -n "$config_dir" ] && [ -d "$config_dir" ] || continue
        $USE_SUDO chown -R "$real_user:$real_user" "$config_dir" 2>/dev/null || true
    done < <(ai_shared_login_shareable_keys)
}

# Write /etc/profile.d + /etc/sudoers.d so root sees the same config-dir
# variables as the real user, then repair ownership. Idempotent (rewrites the
# two files with current catalog contents every time; harmless no-op when
# unchanged).
ai_shared_login_setup() {
    local real_user real_home key var config_dir
    local -a env_vars=()
    local profile_tmp sudoers_tmp

    real_user="$(ai_shared_login_real_user)"
    real_home="$(ai_shared_login_real_home)"
    if [ -z "$real_user" ] || [ -z "$real_home" ] || [ ! -d "$real_home" ]; then
        echo "[WARN] Could not resolve the real desktop user/home; skipping AI shared-login setup."
        return 1
    fi

    profile_tmp="$(mktemp)"
    {
        echo "#!/bin/sh"
        echo "# Managed by scripts/shells/linux/common/ai_shared_login.sh - do not edit by hand."
        echo "# Shares AI CLI config directories between root and the real desktop user ($real_user)."
    } > "$profile_tmp"

    while IFS= read -r key; do
        var="$(ai_catalog_get "$key" "config_env")"
        [ -n "$var" ] || continue
        config_dir="$(ai_shared_login_ensure_dir "$key" "$real_user" "$real_home")"
        [ -n "$config_dir" ] || continue
        printf 'export %s=%s\n' "$var" "$(printf '%q' "$config_dir")" >> "$profile_tmp"
        env_vars+=("$var")
    done < <(ai_shared_login_shareable_keys)

    if [ ${#env_vars[@]} -eq 0 ]; then
        echo "[INFO] No shareable AI CLI config-dir variables to configure."
        rm -f "$profile_tmp"
        return 0
    fi

    $USE_SUDO install -m 0644 "$profile_tmp" "$AI_SHARED_LOGIN_PROFILE_FILE"
    rm -f "$profile_tmp"
    echo "[OK] Wrote $AI_SHARED_LOGIN_PROFILE_FILE (${env_vars[*]})"

    sudoers_tmp="$(mktemp)"
    {
        echo "# Managed by scripts/shells/linux/common/ai_shared_login.sh - do not edit by hand."
        printf 'Defaults env_keep += "%s"\n' "${env_vars[*]}"
    } > "$sudoers_tmp"

    if visudo -c -f "$sudoers_tmp" >/dev/null 2>&1; then
        $USE_SUDO install -m 0440 "$sudoers_tmp" "$AI_SHARED_LOGIN_SUDOERS_FILE"
        echo "[OK] Wrote $AI_SHARED_LOGIN_SUDOERS_FILE (validated with visudo -c)"
    else
        echo "[WARN] Generated sudoers snippet failed visudo -c; not installed."
    fi
    rm -f "$sudoers_tmp"

    ai_shared_login_repair_ownership
    return 0
}

# Print a status matrix: tool | shareable | env var | config dir | exported?
ai_shared_login_status() {
    local real_home key var shareable config_dir exported
    real_home="$(ai_shared_login_real_home)"
    printf '%-14s %-9s %-20s %-30s %s\n' "TOOL" "SHAREABLE" "ENV VAR" "CONFIG DIR" "EXPORTED"
    while IFS= read -r key; do
        shareable="$(ai_catalog_get "$key" "shareable")"
        var="$(ai_catalog_get "$key" "config_env")"
        config_dir="$(ai_catalog_expand_config_dir "$key" "${real_home:-$HOME}")"
        exported="no"
        if [ -n "$var" ] && [ -f "$AI_SHARED_LOGIN_PROFILE_FILE" ] && grep -q "export $var=" "$AI_SHARED_LOGIN_PROFILE_FILE" 2>/dev/null; then
            exported="yes"
        fi
        [ "$shareable" = "no" ] && [ -z "$var" ] && continue
        printf '%-14s %-9s %-20s %-30s %s\n' "$key" "${shareable:-no}" "${var:-(none)}" "${config_dir:--}" "$exported"
    done < <(ai_catalog_keys)
}

export -f ai_shared_login_real_user ai_shared_login_real_home ai_shared_login_shareable_keys \
    ai_shared_login_ensure_dir ai_shared_login_repair_ownership ai_shared_login_setup \
    ai_shared_login_status 2>/dev/null || true
