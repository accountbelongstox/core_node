#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###
#
# =============================================================================
# memory_governance.sh - shared memory-governance recipe (zram swap + zram
# sysctls + systemd-oomd PSI backstop). Sourced like app_resource_limit.sh.
#
# WHY: on a no-swap box both naive browser states fail: unlimited -> the browser
# fills ALL RAM and freezes the system; tight cgroup caps -> breaching MemoryHigh
# can only reclaim the browser's own file/code pages (no anon pageout target), a
# refault storm that reads as "high CPU + frozen browser" (measured: memory.events
# high=35042, PSI full ~75%). cgroup soft limits are only graceful when reclaim
# has a swap destination, so zram is a PREREQUISITE for the caps applied by
# app_resource_limit.sh. Also used by 6_system_maintenance.sh (single source).
#
# Public API:
#   ensure_zram_swap    - install/configure/activate zram (zstd, % of RAM) and
#                         apply zram-tuned vm sysctls. NEVER restarts an ACTIVE
#                         zram device (swapoff decompresses everything back into
#                         RAM -> can OOM a loaded box) and never rewrites a
#                         custom config while zram works. Returns 0 when any
#                         swap is active afterwards, 1 when the box has none.
#   ensure_systemd_oomd - best-effort install+enable systemd-oomd; the launch
#                         wrapper opts the shared app slice into PSI kills via
#                         ManagedOOM* properties at every launch.
# Tunables (env): ZRAM_PERCENT (50), ZRAM_PRIORITY (100), ZRAM_CONFIG.
# =============================================================================

# ---- variable declarations (all at top) ------------------------------------
ZRAM_PERCENT="${ZRAM_PERCENT:-50}"           # zram size = this % of total RAM
ZRAM_PRIORITY="${ZRAM_PRIORITY:-100}"        # swap priority (above disk swap)
ZRAM_CONFIG="${ZRAM_CONFIG:-/etc/default/zramswap}"
ZRAM_SYSCTL_FILE="/etc/sysctl.d/99-corenode-zram.conf"

# Privilege prefix: honor a caller-set USE_SUDO (gvar_common); else derive it.
_mg_sudo() {
    if [ -n "${USE_SUDO+x}" ]; then printf '%s' "$USE_SUDO"; return 0; fi
    if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then printf 'sudo'; fi
}

# True when the box has ANY active swap (zram or disk).
_mg_swap_active() {
    [ "$(awk '/^SwapTotal:/{print $2}' /proc/meminfo 2>/dev/null)" -gt 0 ] 2>/dev/null
}

# zram-tuned vm sysctls (ArchWiki/Pop!_OS benchmarked set). swappiness>100 is
# only correct for in-RAM swap, so this is applied ONLY when zram is the sole
# swap device. Idempotent drop-in + immediate load.
_mg_apply_zram_sysctls() {
    local sudo desired
    sudo="$(_mg_sudo)"
    if swapon --show=NAME --noheadings 2>/dev/null | grep -v zram | grep -q .; then
        echo "[mg]   Non-zram swap present; keeping default vm sysctls."
        return 0
    fi
    desired="$(printf 'vm.swappiness=180\nvm.page-cluster=0\nvm.watermark_scale_factor=125\nvm.watermark_boost_factor=0\n')"
    if [ ! -f "$ZRAM_SYSCTL_FILE" ] || [ "$(cat "$ZRAM_SYSCTL_FILE" 2>/dev/null)" != "$desired" ]; then
        printf '%s' "$desired" | $sudo tee "$ZRAM_SYSCTL_FILE" >/dev/null
        echo "[mg]   Wrote $ZRAM_SYSCTL_FILE (zram-tuned reclaim)."
    fi
    $sudo sysctl -q -p "$ZRAM_SYSCTL_FILE" 2>/dev/null || true
}

ensure_zram_swap() {
    local sudo desired os_id os_like
    sudo="$(_mg_sudo)"
    echo "[mg] === zram compressed-RAM swap ==="

    if [ ! -s /etc/os-release ]; then
        echo "[mg]   Cannot detect OS; skipping zram."
        _mg_swap_active; return $?
    fi
    # Read os-release in subshells so ID/ID_LIKE never clobber caller globals.
    os_id="$(. /etc/os-release 2>/dev/null; printf '%s' "${ID:-}")"
    os_like="$(. /etc/os-release 2>/dev/null; printf '%s' "${ID_LIKE:-}")"
    if [ "$os_id" != "ubuntu" ] && [ "$os_id" != "debian" ] && [ "$os_id" != "kali" ] && [[ " $os_like " != *" debian "* ]]; then
        echo "[mg]   Non-Debian-family OS ($os_id); skipping zram."
        _mg_swap_active; return $?
    fi
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[mg]   systemd not present; skipping zram."
        _mg_swap_active; return $?
    fi

    # Already active: leave it alone. A restart means swapoff, which decompresses
    # the whole device back into RAM and can OOM a loaded box.
    if swapon --show=NAME --noheadings 2>/dev/null | grep -q '/dev/zram'; then
        echo "[mg]   [OK] zram already active: $(swapon --show=NAME,SIZE,PRIO --noheadings 2>/dev/null | grep zram | tr -s ' ' | tr '\n' ' ')"
        _mg_apply_zram_sysctls
        return 0
    fi

    # Install zram-tools if its service is not available yet (apt output stays
    # attached to the console per project run policy).
    if ! systemctl list-unit-files 2>/dev/null | grep -q '^zramswap\.service' \
       && ! dpkg -s zram-tools >/dev/null 2>&1; then
        echo "[mg]   Installing zram-tools..."
        $sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y zram-tools || {
            echo "[mg]   [WARN] could not install zram-tools; skipping zram."
            _mg_swap_active; return $?
        }
    fi

    # Desired config: zstd, % of RAM, priority above disk swap. Written only
    # while no zram device is active, so a working custom setup is never touched.
    desired="$(printf 'ALGO=zstd\nPERCENT=%s\nPRIORITY=%s\n' "$ZRAM_PERCENT" "$ZRAM_PRIORITY")"
    if [ ! -f "$ZRAM_CONFIG" ] || [ "$(cat "$ZRAM_CONFIG" 2>/dev/null)" != "$desired" ]; then
        printf '%s' "$desired" | $sudo tee "$ZRAM_CONFIG" >/dev/null
        echo "[mg]   Wrote $ZRAM_CONFIG (zstd, ${ZRAM_PERCENT}% RAM, priority ${ZRAM_PRIORITY})."
    else
        echo "[mg]   $ZRAM_CONFIG already set; skipping write."
    fi

    # Device is inactive here, so a (re)start cannot trigger the swapoff hazard.
    $sudo systemctl enable zramswap.service >/dev/null 2>&1 || true
    $sudo systemctl restart zramswap.service 2>/dev/null \
        || $sudo systemctl start zramswap.service 2>/dev/null || true

    if swapon --show=NAME --noheadings 2>/dev/null | grep -q '/dev/zram'; then
        echo "[mg]   [OK] zram active: $(swapon --show=NAME,SIZE,PRIO --noheadings 2>/dev/null | grep zram | tr -s ' ' | tr '\n' ' ')"
        _mg_apply_zram_sysctls
        return 0
    fi
    echo "[mg]   [WARN] zram device not active (check 'systemctl status zramswap')."
    _mg_swap_active
}

ensure_systemd_oomd() {
    local sudo
    sudo="$(_mg_sudo)"
    echo "[mg] === systemd-oomd PSI backstop ==="
    if ! command -v systemctl >/dev/null 2>&1 || [ ! -d /run/systemd/system ]; then
        echo "[mg]   systemd not running; skipping oomd."
        return 0
    fi
    if ! systemctl list-unit-files 2>/dev/null | grep -q '^systemd-oomd\.service'; then
        echo "[mg]   Installing systemd-oomd..."
        $sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y systemd-oomd || {
            echo "[mg]   [WARN] systemd-oomd unavailable; no PSI kill backstop."
            return 0
        }
    fi
    $sudo systemctl enable --now systemd-oomd.service >/dev/null 2>&1 || true
    if systemctl is-active --quiet systemd-oomd.service 2>/dev/null; then
        echo "[mg]   [OK] systemd-oomd active (app slice opts in at every wrapper launch)."
    else
        echo "[mg]   [WARN] systemd-oomd installed but not active."
    fi
}
