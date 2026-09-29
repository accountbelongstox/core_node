#!/bin/bash
# Cross-device claudeteam profile: device name (Tailscale), profile
# (gpu | server | desktop), slot role, session name and Remote Control support.
# Profiles live in config/claude_team_roles.json device_profiles.

if [ "${CLAUDE_DEVICE_PROFILE_COMMON_LOADED:-0}" = "1" ]; then
    return 0 2>/dev/null || exit 0
fi
CLAUDE_DEVICE_PROFILE_COMMON_LOADED="1"

CLAUDE_DEVICE_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DEVICE_CATALOG_PATH="$(cd "$CLAUDE_DEVICE_COMMON_DIR/../../../.." && pwd)/config/claude_team_roles.json"
CLAUDE_DEVICE_OS="linux"

. "$CLAUDE_DEVICE_COMMON_DIR/tailscale_common.sh"
. "$CLAUDE_DEVICE_COMMON_DIR/base_libs/lib_gpu.sh"

# Tailscale MagicDNS host label, else the hostname; lowercase, [a-z0-9-] only.
claude_device_name() {
    local name=""
    name="$(ts_self_dnsname)"
    name="${name%%.*}"
    [ -n "$name" ] || name="$(hostname 2>/dev/null)"
    printf '%s' "$name" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9-' '-' | sed 's/^-*//; s/-*$//'
}

claude_device_ipv4() {
    net_detect_tailscale_ipv4 2>/dev/null
}

# True when a display manager service is running (a real graphical desktop).
claude_device_display_manager_active() {
    local service=""
    for service in gdm gdm3 sddm lightdm lxdm; do
        if systemctl is-active --quiet "$service" 2>/dev/null; then
            return 0
        fi
    done
    return 1
}

# gpu: NVIDIA hardware; server: no graphical interface (no display in this
# session and no running display manager); desktop: everything else.
# CLAUDE_DEVICE_PROFILE overrides the detection.
claude_device_profile() {
    case "${CLAUDE_DEVICE_PROFILE:-}" in
        gpu|server|desktop) printf '%s' "$CLAUDE_DEVICE_PROFILE"; return 0 ;;
    esac
    if gpu_hardware_present; then
        printf 'gpu'
        return 0
    fi
    if [ -z "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] && ! claude_device_display_manager_active; then
        printf 'server'
        return 0
    fi
    printf 'desktop'
}

# One [DEBUG] block with every signal behind the profile decision.
claude_device_debug() {
    local service=""
    local states=""
    local state=""
    for service in gdm gdm3 sddm lightdm lxdm; do
        state="$(systemctl is-active "$service" 2>/dev/null)"
        states="$states $service=${state:-n/a}"
    done
    echo "[DEBUG] device: name=$(claude_device_name) ipv4=$(claude_device_ipv4) os=$CLAUDE_DEVICE_OS user=$(id -un) uid=$(id -u)"
    echo "[DEBUG] profile signals: override=${CLAUDE_DEVICE_PROFILE:-<none>} gpu_hardware_present=$(gpu_hardware_present && echo yes || echo no) DISPLAY=${DISPLAY:-<unset>} WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-<unset>} default_target=$(systemctl get-default 2>/dev/null || echo n/a)"
    echo "[DEBUG] display managers:$states"
    echo "[DEBUG] profile result: $(claude_device_profile) (catalog $CLAUDE_DEVICE_CATALOG_PATH)"
}

# One [DEBUG] line with every signal behind the Remote Control decision.
claude_device_remote_control_debug() {
    local helpHasFlag="no"
    claude --help 2>/dev/null | grep -q -- '--remote-control' && helpHasFlag="yes"
    echo "[DEBUG] remote-control: session=$1 ANTHROPIC_API_KEY=$([ -n "${ANTHROPIC_API_KEY:-}" ] && echo set || echo unset) ANTHROPIC_BASE_URL=$([ -n "${ANTHROPIC_BASE_URL:-}" ] && echo set || echo unset) claude_help_has_flag=$helpHasFlag supported=$(claude_device_remote_control_supported && echo yes || echo no)"
}

# Role for 1-based slot <n> of <profile>; empty = plain Claude Code.
claude_device_slot_role() {
    python3 - "$CLAUDE_DEVICE_CATALOG_PATH" "$1" "$2" "$CLAUDE_DEVICE_OS" <<'PY' 2>/dev/null
import json, sys
path, profile, slot, os_name = sys.argv[1:5]
with open(path, encoding="utf-8-sig") as handle:
    roles = ((json.load(handle).get("device_profiles") or {}).get(profile) or [])
index = int(slot) - 1
if 0 <= index < len(roles):
    print(roles[index].replace("{os}", os_name))
PY
}

# Role abbreviation: the initial of each hyphen-separated word.
claude_device_role_abbr() {
    printf '%s' "$1" | tr '-' '\n' | cut -c1 | tr -d '\n'
}

claude_device_session_name() {
    printf '%s-%s-%s' "$(claude_device_name)" "$1" "$(claude_device_role_abbr "$1")"
}

# --remote-control at launch needs a CLI that has the flag and a claude.ai
# login (no API key / custom base URL).
claude_device_remote_control_supported() {
    [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -z "${ANTHROPIC_BASE_URL:-}" ] || return 1
    claude --help 2>/dev/null | grep -q -- '--remote-control'
}
