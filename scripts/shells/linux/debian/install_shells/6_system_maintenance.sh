#!/bin/bash
# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

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
# Merged system maintenance: replaces former index 6/7/9 scripts.
#   1. APT mirror policy (region-aware; never deletes distro-shipped sources).
#   2. Automatic systemd journal size cap (cron).
#   3. Disable Ubuntu/Debian automatic & unattended updates (+ kernel holds).
# Fully non-interactive and idempotent: each step detects existing state and
# skips work that is already done.

# Variable Declarations (declared at top per project rules)
SCRIPT_INDEX="6"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SELECTED_REGION=""
CLOUD_PROVIDER=""
SET_MIRROR=false
JOURNAL_CLEAN_CRON="0 3 * * * /usr/bin/journalctl --vacuum-size=100M"
PERIODIC_CONFIG="/etc/apt/apt.conf.d/10periodic"
AUTO_UPGRADES_CONFIG="/etc/apt/apt.conf.d/20auto-upgrades"
UNATTENDED_CONFIG="/etc/apt/apt.conf.d/50unattended-upgrades"
UPDATES_AVAILABLE="/var/lib/update-notifier/updates-available"
OS_ID=""

# Source global variables + shared memory-governance lib (owns the zram recipe
# and its ZRAM_PERCENT/ZRAM_PRIORITY/ZRAM_CONFIG tunables; browsers 30/35 use it too)
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/memory_governance.sh"
if [ -f /etc/environment ]; then
    set -a
    # shellcheck disable=SC1091
    source /etc/environment
    set +a
fi

# -----------------------------------------------------------------------------
# Step 1: APT mirror policy
# -----------------------------------------------------------------------------
configure_mirrors() {
    echo "[$SCRIPT_INDEX] === APT mirror policy ==="

    SELECTED_REGION="$(get_var "SELECTED_REGION")"
    CLOUD_PROVIDER="${CLOUD_PROVIDER:-$(get_var "CLOUD_PROVIDER")}"

    if [ "$SELECTED_REGION" = "China" ]; then
        SET_MIRROR=true
    fi

    echo "[$SCRIPT_INDEX]   CLOUD_PROVIDER: $CLOUD_PROVIDER"
    echo "[$SCRIPT_INDEX]   SELECTED_REGION: $SELECTED_REGION"
    echo "[$SCRIPT_INDEX]   SET_MIRROR: $SET_MIRROR"

    if [ "$SET_MIRROR" = true ]; then
        echo "[$SCRIPT_INDEX]   Region is China; ensuring https transport prerequisites..."
        $USE_SUDO apt-get install -y apt-transport-https ca-certificates >/dev/null 2>&1 || true

        # IMPORTANT (per project APT-repo policy): never delete the distro's own
        # sources (/etc/apt/sources.list.d/debian*.sources etc.). A China mirror,
        # when implemented, must be written to a SEPARATE mirror file and must not
        # remove distro-shipped sources -- otherwise the system is left with no
        # working repositories. Mirror switching is not yet implemented.
        echo "[$SCRIPT_INDEX]   China mirror configuration not yet implemented; leaving system sources untouched."
        echo "[$SCRIPT_INDEX]   Refreshing package lists..."
        $USE_SUDO apt clean >/dev/null 2>&1 || true
        $USE_SUDO apt update >/dev/null 2>&1 || true
    else
        echo "[$SCRIPT_INDEX]   Region is not China; keeping original mirrors (no apt changes)."
    fi
}

# -----------------------------------------------------------------------------
# Step 2: automatic journal cleanup cron
# -----------------------------------------------------------------------------
configure_journal_cleanup() {
    echo "[$SCRIPT_INDEX] === Automatic journal cleanup ==="

    if $USE_SUDO crontab -l 2>/dev/null | grep -q "journalctl --vacuum-size=100M"; then
        echo "[$SCRIPT_INDEX]   Journal cleanup cron already configured, skipping."
        return 0
    fi

    echo "[$SCRIPT_INDEX]   Adding journal cleanup cron job (daily 03:00, vacuum to 100M)..."
    local current_crontab
    current_crontab="$($USE_SUDO crontab -l 2>/dev/null || echo "")"
    if [ -n "$current_crontab" ]; then
        printf '%s\n%s\n' "$current_crontab" "$JOURNAL_CLEAN_CRON" | $USE_SUDO crontab -
    else
        printf '%s\n' "$JOURNAL_CLEAN_CRON" | $USE_SUDO crontab -
    fi

    if $USE_SUDO crontab -l 2>/dev/null | grep -q "journalctl --vacuum-size=100M"; then
        echo "[$SCRIPT_INDEX]   [OK] Journal cleanup cron active."
    else
        echo "[$SCRIPT_INDEX]   [WARN] Failed to verify journal cleanup cron."
    fi
}

# -----------------------------------------------------------------------------
# Step 3: disable automatic / unattended updates
# -----------------------------------------------------------------------------
backup_config_once() {
    local config_file="$1"
    if [ -s "$config_file" ] && [ ! -s "${config_file}.bak" ]; then
        $USE_SUDO cp "$config_file" "${config_file}.bak"
        echo "[$SCRIPT_INDEX]   Backed up $config_file"
    fi
}

write_zeroed_periodic() {
    local config_file="$1"
    backup_config_once "$config_file"
    if [ ! -s "$config_file" ]; then
        $USE_SUDO tee "$config_file" >/dev/null <<'EOF'
APT::Periodic::Update-Package-Lists "0";
APT::Periodic::Download-Upgradeable-Packages "0";
APT::Periodic::AutocleanInterval "0";
APT::Periodic::Unattended-Upgrade "0";
EOF
        echo "[$SCRIPT_INDEX]   Created $config_file (all periodic values 0)."
    elif grep -qE '"[12]"' "$config_file"; then
        $USE_SUDO sed -i 's/"[12]"/"0"/g' "$config_file"
        echo "[$SCRIPT_INDEX]   Zeroed periodic values in $config_file."
    else
        echo "[$SCRIPT_INDEX]   $config_file already disabled, skipping."
    fi
}

disable_auto_updates() {
    echo "[$SCRIPT_INDEX] === Disable automatic / unattended updates ==="

    if [ ! -s /etc/os-release ]; then
        echo "[$SCRIPT_INDEX]   Cannot detect OS (no /etc/os-release); skipping update-disable step."
        return 0
    fi
    # shellcheck disable=SC1091
    . /etc/os-release
    OS_ID="$ID"
    if [ "$OS_ID" != "ubuntu" ] && [ "$OS_ID" != "debian" ] && [ "$OS_ID" != "kali" ] && [[ " ${ID_LIKE:-} " != *" debian "* ]]; then
        echo "[$SCRIPT_INDEX]   Non-Debian-family OS ($OS_ID); skipping update-disable step."
        return 0
    fi
    echo "[$SCRIPT_INDEX]   Detected: $OS_ID ${VERSION_ID:-}"

    write_zeroed_periodic "$PERIODIC_CONFIG"
    write_zeroed_periodic "$AUTO_UPGRADES_CONFIG"

    # Stop/disable the unattended-upgrades service if present.
    if systemctl list-units --type=service --all 2>/dev/null | grep -q "unattended-upgrades"; then
        if systemctl is-active --quiet unattended-upgrades 2>/dev/null || systemctl is-enabled --quiet unattended-upgrades 2>/dev/null; then
            $USE_SUDO systemctl stop unattended-upgrades 2>/dev/null || true
            $USE_SUDO systemctl disable unattended-upgrades 2>/dev/null || true
            echo "[$SCRIPT_INDEX]   Stopped & disabled unattended-upgrades service."
        else
            echo "[$SCRIPT_INDEX]   unattended-upgrades service already inactive, skipping."
        fi
    fi

    # Hold kernel packages to avoid driver/kernel version mismatches.
    $USE_SUDO apt-mark hold linux-generic linux-image-generic linux-headers-generic >/dev/null 2>&1 || true
    local installed_kernels kernel
    installed_kernels="$(dpkg --list 2>/dev/null | grep -E "^ii.*linux-image-[0-9]" | awk '{print $2}' | grep -v generic)"
    for kernel in $installed_kernels; do
        $USE_SUDO apt-mark hold "$kernel" >/dev/null 2>&1 || true
    done
    echo "[$SCRIPT_INDEX]   Kernel packages marked on hold."

    # Add kernel blacklist to unattended-upgrades config if that file exists.
    if [ -s "$UNATTENDED_CONFIG" ] && ! grep -q "Package-Blacklist" "$UNATTENDED_CONFIG"; then
        backup_config_once "$UNATTENDED_CONFIG"
        $USE_SUDO tee -a "$UNATTENDED_CONFIG" >/dev/null <<'EOF'

Unattended-Upgrade::Package-Blacklist {
    "linux-generic";
    "linux-image-generic";
    "linux-headers-generic";
};
EOF
        echo "[$SCRIPT_INDEX]   Added kernel packages to unattended-upgrades blacklist."
    fi

    # Clear stale update notifications.
    if [ -s "$UPDATES_AVAILABLE" ]; then
        $USE_SUDO rm -f "$UPDATES_AVAILABLE" 2>/dev/null || true
        echo "[$SCRIPT_INDEX]   Cleared update-notifier cache."
    fi
}

# -----------------------------------------------------------------------------
# Step 4: zram compressed-RAM swap (memory headroom)
# -----------------------------------------------------------------------------
# Delegates to the shared common/memory_governance.sh recipe (zram + tuned vm
# sysctls; never restarts an active device, never clobbers a working custom
# config). Browsers 30/35 call the same function at install time.
configure_zram_swap() {
    ensure_zram_swap || true
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
echo "[$SCRIPT_INDEX] Running system maintenance (mirrors / journal / auto-updates / zram)..."
echo ""
configure_mirrors
echo ""
configure_journal_cleanup
echo ""
disable_auto_updates
echo ""
configure_zram_swap
echo ""
echo "[$SCRIPT_INDEX] System maintenance completed."
