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
#   2. Preflight package-database checks (dpkg --audit, apt-mark showhold),
#      plus the base-files /lib64 diversion-mismatch fix.
#   3. Update bookworm to its latest point release.
#   4. FULL RESET of the official APT sources to the canonical trixie set
#      (existing mirror reused; third-party files kept/backed up).
#   5. apt-get update -> minimal upgrade (upgrade --without-new-pkgs)
#      -> full-upgrade -> autoremove/clean.
# Idempotent self-heal: every step detects its state, so a re-run resumes an
# interrupted upgrade instead of starting over. Third-party repositories
# without a trixie distribution are disabled automatically (reversible).

# Variable Declarations (declared at top per project rules)
SCRIPT_INDEX="D13"
OS_ID=""
OS_VERSION_ID=""
BACKUP_ROOT="/var/backups/debian-upgrade-13"
BACKUP_DIR=""
CONFIRM=""
APT_SOURCE_FILES=""
# Non-interactive mode for unattended resume: DEBIAN13_ASSUME_YES=1 skips the
# confirmation prompts, answers yes to apt, and keeps existing config files on
# conffile prompts (dpkg --force-confdef/confold).
ASSUME_YES="${DEBIAN13_ASSUME_YES:-0}"
APT_YES=""
DPKG_KEEP_CONF=""
f=""
url=""
host=""
src=""
round=0
update_output=""

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

# Self-heal for the known trixie base-files failure:
#   dpkg-divert: error: mismatch on divert-to
#     when removing 'diversion of /lib64 to /.lib64.usr-is-merged by base-files'
#     found 'diversion of /lib64 to /lib64.usr-is-merged by base-files'
# The trixie postinst removes the temporary DEP17 M4 diversion recorded as
# /.lib64.usr-is-merged, but some bookworm systems recorded the divert-to as
# /lib64.usr-is-merged. Re-record it with the divert-to the postinst expects.
# Record-only (--no-rename on both sides): /lib64 stays the usr/lib64 symlink.
fix_base_files_lib64_diversion() {
    command -v dpkg-divert >/dev/null 2>&1 || return 0
    if dpkg-divert --list 2>/dev/null | grep -qF "diversion of /lib64 to /.lib64.usr-is-merged by base-files"; then
        return 0
    fi
    if ! dpkg-divert --list 2>/dev/null | grep -qF "diversion of /lib64 to /lib64.usr-is-merged by base-files"; then
        return 0
    fi
    echo "[$SCRIPT_INDEX] Fixing base-files /lib64 diversion record (divert-to mismatch blocks trixie base-files)"
    $USE_SUDO dpkg-divert --quiet --package base-files --no-rename --divert /lib64.usr-is-merged --remove /lib64 || return 1
    $USE_SUDO dpkg-divert --quiet --package base-files --no-rename --divert /.lib64.usr-is-merged --add /lib64 || return 1
    echo "[$SCRIPT_INDEX] Diversion re-recorded: /lib64 -> /.lib64.usr-is-merged"
}

# Official 4.2.4/4.2.12: the package database must be clean and hold-free.
preflight_package_checks() {
    echo "[$SCRIPT_INDEX] === Step 2: Preflight package checks ==="
    local audit=""
    local holds=""
    fix_base_files_lib64_diversion || echo "[$SCRIPT_INDEX] WARNING: /lib64 diversion fix failed"
    audit="$(dpkg --audit 2>/dev/null)"
    if [ -n "$audit" ]; then
        echo "[$SCRIPT_INDEX] WARNING: dpkg --audit reports problems:"
        echo "$audit" | sed "s/^/[$SCRIPT_INDEX]   /"
        echo "[$SCRIPT_INDEX] Attempting repair (dpkg --configure -a / apt-get -f install)..."
        $USE_SUDO dpkg --configure -a || true
        $USE_SUDO apt-get $APT_YES $DPKG_KEEP_CONF -f install || true
        audit="$(dpkg --audit 2>/dev/null)"
        if [ -n "$audit" ]; then
            echo "[$SCRIPT_INDEX] ERROR: package database still broken after repair:"
            echo "$audit" | sed "s/^/[$SCRIPT_INDEX]   /"
            return 1
        fi
        echo "[$SCRIPT_INDEX] Package database repaired"
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
# disable_broken_third_party_repos runs first so a RESUMED run (sources already
# on trixie, a third-party repo without trixie still enabled) cannot abort here.
# dpkg --configure -a + apt-get -f install repair a half-configured state left
# by a previously interrupted run (idempotent: no-op when the database is clean).
update_current_release() {
    echo "[$SCRIPT_INDEX] === Step 3: Update Debian $OS_VERSION_ID to latest point release ==="
    disable_broken_third_party_repos || return 1
    $USE_SUDO dpkg --configure -a || true
    $USE_SUDO apt-get $APT_YES $DPKG_KEEP_CONF -f install || return 1
    $USE_SUDO apt-get $APT_YES $DPKG_KEEP_CONF full-upgrade || return 1
}

# FULL RESET of the official Debian APT sources to a canonical trixie set
# (official 4.3). Every current source file is backed up to
# $BACKUP_DIR/apt-sources first (NOT alongside the source: a *.bak-* file in
# sources.list.d makes apt warn "invalid filename extension"), then
# /etc/apt/sources.list is rewritten with the three canonical trixie entries.
# The mirror already in use is reused (region-aware mirrors survive the
# reset); components are the full set main/contrib/non-free/non-free-firmware.
# Third-party files under sources.list.d are KEPT; any still referencing
# bookworm are sed-repointed, and ones without a trixie distribution are
# disabled later by disable_broken_third_party_repos (official 4.2.10).
reset_apt_sources_to_trixie() {
    echo "[$SCRIPT_INDEX] === Step 4: Reset official APT sources to Debian 13 (trixie) ==="
    local mirror=""
    local security=""
    $USE_SUDO mkdir -p "$BACKUP_DIR/apt-sources"

    # Self-heal: migrate side-by-side backups created by earlier versions of
    # this script out of the live APT config directory.
    for f in /etc/apt/sources.list.d/*.bak-debian12; do
        [ -f "$f" ] || continue
        $USE_SUDO mv "$f" "$BACKUP_DIR/apt-sources/$(basename "$f")"
        echo "[$SCRIPT_INDEX] Migrated backup out of sources.list.d: $(basename "$f")"
    done

    # Back up every current source file once (first backup wins, re-runs keep it).
    APT_SOURCE_FILES=""
    for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
        [ -f "$f" ] || continue
        APT_SOURCE_FILES="$APT_SOURCE_FILES $f"
        if [ ! -f "$BACKUP_DIR/apt-sources/$(basename "$f")" ]; then
            $USE_SUDO cp "$f" "$BACKUP_DIR/apt-sources/$(basename "$f")"
            echo "[$SCRIPT_INDEX] Backed up: $BACKUP_DIR/apt-sources/$(basename "$f")"
        fi
    done

    # Detect the mirror in use from the first official main line (legacy .list
    # "deb URI suite ..." and deb822 .sources "URIs: URI"), falling back to the
    # Debian CDN. Security repo is detected the same way.
    mirror="$( {
        $USE_SUDO grep -hE '^[[:space:]]*deb([[:space:]]|\[)' /etc/apt/sources.list /etc/apt/sources.list.d/*.list 2>/dev/null
        $USE_SUDO grep -hE '^[[:space:]]*URIs:' /etc/apt/sources.list.d/*.sources 2>/dev/null
    } | grep -oE 'https?://[^[:space:]]+' | grep '/debian' | grep -v 'debian-security' | head -1 )"
    [ -z "$mirror" ] && mirror="http://deb.debian.org/debian"
    security="$( {
        $USE_SUDO grep -hE '^[[:space:]]*deb([[:space:]]|\[)' /etc/apt/sources.list /etc/apt/sources.list.d/*.list 2>/dev/null
        $USE_SUDO grep -hE '^[[:space:]]*URIs:' /etc/apt/sources.list.d/*.sources 2>/dev/null
    } | grep -oE 'https?://[^[:space:]]+' | grep 'debian-security' | head -1 )"
    [ -z "$security" ] && security="http://security.debian.org/debian-security"

    echo "[$SCRIPT_INDEX] Writing canonical trixie sources (mirror: $mirror)"
    printf '%s\n' \
        "deb $mirror trixie main contrib non-free non-free-firmware" \
        "deb $mirror trixie-updates main contrib non-free non-free-firmware" \
        "deb $security trixie-security main contrib non-free non-free-firmware" \
        | $USE_SUDO tee /etc/apt/sources.list >/dev/null

    # Any remaining bookworm references in third-party files get repointed too.
    for f in $APT_SOURCE_FILES; do
        [ "$f" = "/etc/apt/sources.list" ] && continue
        if $USE_SUDO grep -q "bookworm" "$f" 2>/dev/null; then
            $USE_SUDO sed -i 's/bookworm/trixie/g' "$f"
            echo "[$SCRIPT_INDEX] Repointed third-party file: $f"
        fi
    done
    for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
        [ -f "$f" ] || continue
        if $USE_SUDO grep -q "bookworm" "$f" 2>/dev/null; then
            echo "[$SCRIPT_INDEX] WARNING: APT file still references bookworm: $f"
        fi
    done
}

# Official 4.2.10 (unofficial sources): a third-party repo that does not
# publish a trixie distribution makes `apt-get update` fail and aborts the
# whole upgrade (seen with the MariaDB 10.11 repo: 404 on dists/trixie).
# Self-heal: run apt-get update; on failure extract the failing repository
# host, find the source file that carries it and disable it (rename to
# *.disabled-debian13, reversible), then retry. Official Debian hosts are
# never disabled -- a failure there aborts instead.
disable_broken_third_party_repos() {
    echo "[$SCRIPT_INDEX] Checking APT sources reachability (disabling repos without trixie support)..."
    round=0
    while [ "$round" -lt 5 ]; do
        round=$((round + 1))
        update_output="$($USE_SUDO apt-get update 2>&1)"
        if [ $? -eq 0 ]; then
            echo "[$SCRIPT_INDEX] apt-get update: OK"
            return 0
        fi
        url="$(printf '%s\n' "$update_output" | grep "Failed to fetch" | grep -oE 'https?://[^ ]+' | head -1)"
        if [ -z "$url" ]; then
            url="$(printf '%s\n' "$update_output" | grep "does not have a Release file" | grep -oE "https?://[^']+" | head -1)"
        fi
        if [ -z "$url" ]; then
            echo "[$SCRIPT_INDEX] ERROR: apt-get update failed without an identifiable repository URL:"
            printf '%s\n' "$update_output" | tail -20 | sed "s/^/[$SCRIPT_INDEX]   /"
            return 1
        fi
        host="$(printf '%s' "$url" | sed 's|https\?://||; s|/.*||')"
        case "$host" in
            deb.debian.org|security.debian.org|*.debian.org|ftp.*.debian.org)
                echo "[$SCRIPT_INDEX] ERROR: official Debian repository failed ($host); not disabling it"
                return 1
                ;;
        esac
        src=""
        for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
            [ -f "$f" ] || continue
            if $USE_SUDO grep -q "$host" "$f" 2>/dev/null; then
                src="$f"
                break
            fi
        done
        if [ -z "$src" ]; then
            echo "[$SCRIPT_INDEX] ERROR: cannot find the source file for failing repository host: $host"
            return 1
        fi
        echo "[$SCRIPT_INDEX] Repository '$host' has no trixie distribution -> disabling: $src"
        $USE_SUDO mv "$src" "${src}.disabled-debian13"
    done
    echo "[$SCRIPT_INDEX] ERROR: apt-get update still failing after disabling 5 repositories"
    return 1
}

# Official 4.4: refresh lists, minimal upgrade, then full upgrade. The two
# upgrade stages stay interactive so proposed removals can be reviewed, unless
# DEBIAN13_ASSUME_YES=1 (unattended resume: -y + keep existing conffiles).
perform_upgrade() {
    echo "[$SCRIPT_INDEX] === Step 5: Upgrade packages (bookworm -> trixie) ==="
    disable_broken_third_party_repos || return 1
    echo "[$SCRIPT_INDEX] Minimal system upgrade (apt-get upgrade --without-new-pkgs)..."
    $USE_SUDO apt-get $APT_YES $DPKG_KEEP_CONF upgrade --without-new-pkgs || return 1
    echo "[$SCRIPT_INDEX] Full system upgrade (apt-get full-upgrade)..."
    $USE_SUDO apt-get $APT_YES $DPKG_KEEP_CONF full-upgrade || return 1
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
            echo "[$SCRIPT_INDEX] System is already Debian $OS_VERSION_ID"
            if [ "$ASSUME_YES" = "1" ]; then
                APT_YES="-y"
                DPKG_KEEP_CONF="-o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold"
            fi
            BACKUP_DIR="$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)"
            # base-files is among the FIRST packages trixie configures, so an
            # interrupted upgrade already reports os-release 13 while most
            # packages are still pending. Detect the partial state and finish
            # the upgrade instead of stopping at the repo reset.
            if [ -n "$(dpkg --audit 2>/dev/null)" ] || [ "$(apt-get -s full-upgrade 2>/dev/null | grep -c '^Inst ')" -gt 0 ]; then
                echo "[$SCRIPT_INDEX] PARTIAL upgrade detected (half-configured or pending packages) -> completing it"
                preflight_package_checks || { echo "[$SCRIPT_INDEX] ERROR: preflight repair failed"; return 1; }
                update_current_release || { echo "[$SCRIPT_INDEX] ERROR: completing the upgrade failed; re-run to resume"; return 1; }
                cleanup_after_upgrade
            fi
            reset_apt_sources_to_trixie
            disable_broken_third_party_repos || true
            echo "[$SCRIPT_INDEX] Done. Current release: $(cat /etc/debian_version 2>/dev/null)"
            echo "[$SCRIPT_INDEX] A REBOOT is required to load the trixie kernel."
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

    # Guard against concurrent runs: a second instance while another apt/dpkg
    # (e.g. this same script still upgrading in the background) holds the
    # frontend lock would fail midway through Step 3.
    if command -v fuser >/dev/null 2>&1 && $USE_SUDO fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] ERROR: another apt/dpkg process holds the package lock:"
        $USE_SUDO fuser -v /var/lib/dpkg/lock-frontend 2>&1 | sed "s/^/[$SCRIPT_INDEX]   /"
        echo "[$SCRIPT_INDEX] If an upgrade is already running (background/menu), wait for it"
        echo "[$SCRIPT_INDEX] to finish, then re-run this script to resume if needed."
        return 1
    fi

    echo "[$SCRIPT_INDEX] This performs an IN-PLACE upgrade to Debian 13 (trixie)."
    echo "[$SCRIPT_INDEX] Services will be stopped/restarted during the upgrade and a"
    echo "[$SCRIPT_INDEX] REBOOT is required afterwards. If upgrading over SSH, run this"
    echo "[$SCRIPT_INDEX] inside screen/tmux so a dropped connection cannot interrupt it."
    echo ""
    if [ "$ASSUME_YES" = "1" ]; then
        APT_YES="-y"
        DPKG_KEEP_CONF="-o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold"
        echo "[$SCRIPT_INDEX] DEBIAN13_ASSUME_YES=1 -> unattended mode (auto-yes, keep existing conffiles)"
    else
        printf "[$SCRIPT_INDEX] Type UPGRADE to continue: "
        read -r CONFIRM
        if [ "$CONFIRM" != "UPGRADE" ]; then
            echo "[$SCRIPT_INDEX] Aborted by user"
            return 0
        fi
    fi

    backup_system_state
    preflight_package_checks || { echo "[$SCRIPT_INDEX] ERROR: preflight repair failed"; return 1; }
    update_current_release || { echo "[$SCRIPT_INDEX] ERROR: point-release update failed"; return 1; }
    reset_apt_sources_to_trixie
    perform_upgrade || { echo "[$SCRIPT_INDEX] ERROR: upgrade failed; re-run this script to resume"; return 1; }
    cleanup_after_upgrade

    echo "[$SCRIPT_INDEX] ============================================"
    echo "[$SCRIPT_INDEX] Upgrade finished. Current release: $(cat /etc/debian_version 2>/dev/null)"
    echo "[$SCRIPT_INDEX] Backup of pre-upgrade state: $BACKUP_DIR"
    echo "[$SCRIPT_INDEX] A REBOOT is required to load the trixie kernel."
    if [ "$ASSUME_YES" = "1" ]; then
        echo "[$SCRIPT_INDEX] Unattended mode: not rebooting automatically - reboot manually"
        return 0
    fi
    printf "[$SCRIPT_INDEX] Reboot now? [y/N]: "
    read -r CONFIRM
    case "$CONFIRM" in
        [Yy]*) $USE_SUDO systemctl reboot 2>/dev/null || $USE_SUDO reboot ;;
        *) echo "[$SCRIPT_INDEX] Reboot skipped - reboot manually before production use" ;;
    esac
}

main "$@"
