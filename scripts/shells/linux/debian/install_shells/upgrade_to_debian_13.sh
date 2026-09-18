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
# Debian 12 (bookworm) -> 13 (trixie) in-place upgrade helper.
# Implements the official path from the Debian 13 release notes, chapter 4
# "Upgrades from Debian 12 (bookworm)":
#   https://www.debian.org/releases/trixie/release-notes/upgrading.en.html
#   1. Back up /etc + dpkg state.
#   2. Preflight package-database checks (dpkg --audit, apt-mark showhold).
#   3. Update bookworm to its latest point release.
#   4. Repoint APT sources bookworm -> trixie (legacy .list and deb822 .sources).
#   5. apt-get update -> minimal upgrade (upgrade --without-new-pkgs)
#      -> full-upgrade -> autoremove/clean.
# Idempotent self-heal: every step detects its state, so a re-run resumes an
# interrupted upgrade instead of starting over.

# Variable Declarations (declared at top per project rules)
SCRIPT_INDEX="D13"
OS_ID=""
OS_VERSION_ID=""
BACKUP_ROOT="/var/backups/debian-upgrade-13"
BACKUP_DIR=""
CONFIRM=""
APT_SOURCE_FILES=""
f=""

# True when the current system is Debian with VERSION_ID below the given major.
debian_version_below() {
    local max_ver="$1"
    [ -f /etc/os-release ] || return 1
    OS_ID="$(. /etc/os-release 2>/dev/null; echo "$ID")"
    OS_VERSION_ID="$(. /etc/os-release 2>/dev/null; echo "$VERSION_ID")"
    [ "$OS_ID" = "debian" ] || return 1
    [ -n "$OS_VERSION_ID" ] || return 1
    [ "$OS_VERSION_ID" -lt "$max_ver" ] 2>/dev/null
}

# Back up /etc, the dpkg selection list and the APT extended states (official
# 4.1.1). Timestamped per run; a re-run adds a fresh snapshot.
backup_system_state() {
    echo "[$SCRIPT_INDEX] === Step 1: Backup ==="
    BACKUP_DIR="$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)"
    $USE_SUDO mkdir -p "$BACKUP_DIR"
    $USE_SUDO tar -czf "$BACKUP_DIR/etc.tar.gz" /etc 2>/dev/null || true
    dpkg --get-selections '*' | $USE_SUDO tee "$BACKUP_DIR/dpkg-selections.txt" >/dev/null
    if [ -f /var/lib/apt/extended_states ]; then
        $USE_SUDO cp /var/lib/apt/extended_states "$BACKUP_DIR/extended_states"
    fi
    echo "[$SCRIPT_INDEX] Backup written to: $BACKUP_DIR"
}

# Official 4.2.4/4.2.12: the package database must be clean and hold-free.
preflight_package_checks() {
    echo "[$SCRIPT_INDEX] === Step 2: Preflight package checks ==="
    local audit=""
    local holds=""
    audit="$(dpkg --audit 2>/dev/null)"
    if [ -n "$audit" ]; then
        echo "[$SCRIPT_INDEX] WARNING: dpkg --audit reports problems:"
        echo "$audit" | sed "s/^/[$SCRIPT_INDEX]   /"
        echo "[$SCRIPT_INDEX] Fix these packages first (apt-get -f install / dpkg --configure -a)."
    else
        echo "[$SCRIPT_INDEX] dpkg --audit: clean"
    fi
    holds="$(apt-mark showhold 2>/dev/null)"
    if [ -n "$holds" ]; then
        echo "[$SCRIPT_INDEX] WARNING: held packages (upgrade may fail; unhold if not needed):"
        echo "$holds" | sed "s/^/[$SCRIPT_INDEX]   /"
    else
        echo "[$SCRIPT_INDEX] No held packages"
    fi
}

# Official 4.2.2: bring bookworm to its latest point release first.
update_current_release() {
    echo "[$SCRIPT_INDEX] === Step 3: Update Debian $OS_VERSION_ID to latest point release ==="
    $USE_SUDO apt-get update || return 1
    $USE_SUDO apt-get -y full-upgrade || return 1
}

# Official 4.3: repoint every APT source from bookworm to trixie. Covers both
# the legacy one-line format (.list, /etc/apt/sources.list) and the deb822
# format (.sources). bookworm-security -> trixie-security is handled by the
# same substitution. Each file is backed up once (.bak-debian12) and skipped
# when it no longer references bookworm (idempotent re-run).
repoint_apt_sources() {
    echo "[$SCRIPT_INDEX] === Step 4: Repoint APT sources bookworm -> trixie ==="
    APT_SOURCE_FILES=""
    for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
        [ -f "$f" ] || continue
        APT_SOURCE_FILES="$APT_SOURCE_FILES $f"
    done
    for f in $APT_SOURCE_FILES; do
        if ! $USE_SUDO grep -q "bookworm" "$f" 2>/dev/null; then
            echo "[$SCRIPT_INDEX] Already on trixie (or no bookworm refs): $f"
            continue
        fi
        if [ ! -f "${f}.bak-debian12" ]; then
            $USE_SUDO cp "$f" "${f}.bak-debian12"
            echo "[$SCRIPT_INDEX] Backed up: ${f}.bak-debian12"
        fi
        $USE_SUDO sed -i 's/bookworm/trixie/g' "$f"
        echo "[$SCRIPT_INDEX] Repointed: $f"
    done
    if $USE_SUDO grep -rl "bookworm" /etc/apt/sources.list /etc/apt/sources.list.d/ 2>/dev/null | grep -q .; then
        echo "[$SCRIPT_INDEX] WARNING: some APT files still reference bookworm:"
        $USE_SUDO grep -rl "bookworm" /etc/apt/sources.list /etc/apt/sources.list.d/ 2>/dev/null | sed "s/^/[$SCRIPT_INDEX]   /"
    fi
}

# Official 4.4: refresh lists, minimal upgrade, then full upgrade. The two
# upgrade stages stay interactive so proposed removals can be reviewed.
perform_upgrade() {
    echo "[$SCRIPT_INDEX] === Step 5: Upgrade packages (bookworm -> trixie) ==="
    $USE_SUDO apt-get update || return 1
    echo "[$SCRIPT_INDEX] Minimal system upgrade (apt-get upgrade --without-new-pkgs)..."
    $USE_SUDO apt-get upgrade --without-new-pkgs || return 1
    echo "[$SCRIPT_INDEX] Full system upgrade (apt-get full-upgrade)..."
    $USE_SUDO apt-get full-upgrade || return 1
}

# Official 4.7/4.8: drop redundant packages and the download cache.
cleanup_after_upgrade() {
    echo "[$SCRIPT_INDEX] === Step 6: Cleanup ==="
    $USE_SUDO apt-get -y autoremove || true
    $USE_SUDO apt-get clean || true
}

main() {
    echo "[$SCRIPT_INDEX] ============================================"
    echo "[$SCRIPT_INDEX] Debian -> 13 (trixie) Upgrade Helper"
    echo "[$SCRIPT_INDEX] ============================================"

    if ! debian_version_below 13; then
        OS_ID="$(. /etc/os-release 2>/dev/null; echo "$ID")"
        OS_VERSION_ID="$(. /etc/os-release 2>/dev/null; echo "$VERSION_ID")"
        if [ "$OS_ID" = "debian" ] && [ "$OS_VERSION_ID" -ge 13 ] 2>/dev/null; then
            echo "[$SCRIPT_INDEX] System is already Debian $OS_VERSION_ID - nothing to do"
        else
            echo "[$SCRIPT_INDEX] This helper only runs on Debian below 13 (current: $OS_ID $OS_VERSION_ID)"
        fi
        return 0
    fi
    if [ "$OS_VERSION_ID" -lt 12 ] 2>/dev/null; then
        echo "[$SCRIPT_INDEX] ERROR: only upgrades FROM Debian 12 are supported (current: $OS_VERSION_ID)."
        echo "[$SCRIPT_INDEX] Upgrade to Debian 12 first (see the Debian 12 release notes)."
        return 1
    fi

    echo "[$SCRIPT_INDEX] Current system: Debian $OS_VERSION_ID (bookworm)"
    echo "[$SCRIPT_INDEX] This performs an IN-PLACE upgrade to Debian 13 (trixie)."
    echo "[$SCRIPT_INDEX] Services will be stopped/restarted during the upgrade and a"
    echo "[$SCRIPT_INDEX] REBOOT is required afterwards. If upgrading over SSH, run this"
    echo "[$SCRIPT_INDEX] inside screen/tmux so a dropped connection cannot interrupt it."
    echo ""
    printf "[$SCRIPT_INDEX] Type UPGRADE to continue: "
    read -r CONFIRM
    if [ "$CONFIRM" != "UPGRADE" ]; then
        echo "[$SCRIPT_INDEX] Aborted by user"
        return 0
    fi

    backup_system_state
    preflight_package_checks
    update_current_release || { echo "[$SCRIPT_INDEX] ERROR: point-release update failed"; return 1; }
    repoint_apt_sources
    perform_upgrade || { echo "[$SCRIPT_INDEX] ERROR: upgrade failed; re-run this script to resume"; return 1; }
    cleanup_after_upgrade

    echo "[$SCRIPT_INDEX] ============================================"
    echo "[$SCRIPT_INDEX] Upgrade finished. Current release: $(cat /etc/debian_version 2>/dev/null)"
    echo "[$SCRIPT_INDEX] Backup of pre-upgrade state: $BACKUP_DIR"
    echo "[$SCRIPT_INDEX] A REBOOT is required to load the trixie kernel."
    printf "[$SCRIPT_INDEX] Reboot now? [y/N]: "
    read -r CONFIRM
    case "$CONFIRM" in
        [Yy]*) $USE_SUDO systemctl reboot 2>/dev/null || $USE_SUDO reboot ;;
        *) echo "[$SCRIPT_INDEX] Reboot skipped - reboot manually before production use" ;;
    esac
}

main "$@"
