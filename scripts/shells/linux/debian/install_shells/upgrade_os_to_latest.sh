#!/bin/bash
# Include common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
source "$COMMON_DIR/common_functions.sh"

#
# upgrade_os_to_latest.sh - one-step, resumable OS upgrader (Debian and
# Ubuntu). Generalizes the former upgrade_to_debian_13.sh: same proven steps
# and self-heals (backup, preflight, point-release update, sources reset,
# minimal-then-full upgrade), extended to hop every Debian major one at a
# time and to drive Ubuntu's official do-release-upgrade path.
#
# Official paths only:
#   Debian: one major release per hop, per the "Upgrades from Debian N"
#     chapter of each release's release notes (11 bullseye -> 12 bookworm ->
#     13 trixie -- this script's current DEBIAN_HOP_FLOOR..DEBIAN_LATEST_MAJOR
#     range). non-free-firmware is only added to sources.list from bookworm
#     (12) onward (it did not exist as a separate component in bullseye/11).
#       Debian 12 release notes (upgrading): https://www.debian.org/releases/bookworm/amd64/release-notes/ch-upgrading.en.html
#       Debian 13 release notes (upgrading): https://www.debian.org/releases/trixie/release-notes/upgrading.en.html
#   Ubuntu: the official do-release-upgrade tool (update-manager-core
#     package); it moves exactly one sequential release per invocation and
#     cannot skip a release. Prompt=lts (LTS hosts; a new LTS is only offered
#     once its first point release is out, e.g. 26.04.1) or Prompt=normal
#     (interim hosts) in /etc/update-manager/release-upgrades;
#     `apt-get dist-upgrade -o APT::Get::Always-Include-Phased-Updates=true`
#     runs before each hop; unattended resume uses
#     `-f DistUpgradeViewNonInteractive`.
#       How to upgrade your release: https://ubuntu.com/server/docs/how-to/software/upgrade-your-release/
#       Upgrade introduction:        https://ubuntu.com/server/docs/upgrade-introduction
#       do-release-upgrade(8):       https://manpages.ubuntu.com/manpages/noble/en/man8/do-release-upgrade.8.html
#       Release feed (next-hop):     https://changelogs.ubuntu.com/meta-release[-lts]
#
# Multi-hop + reboot: a hop that leaves the host needing a reboot registers a
# one-shot systemd unit (ncore-os-upgrade-resume.service, After=network-online,
# Wants=network-online.target) that re-runs this script with --resume; the
# interactive caller is prompted to reboot (a --resume run reboots itself
# automatically -- no one is at the console to answer a prompt). Resume
# continues hop after hop until the latest supported release, or gives up
# after 3 failed attempts -- either way the unit, its state
# (/var/lib/core_node/os-upgrade/) and temporary artifacts are removed
# (mandatory cleanup). Every step is idempotent: re-running / resuming
# detects and continues from the current state. Logs:
# /var/log/core_node-os-upgrade.log.
#
# State-file contract (read by other components, e.g. the Windows WSL Debian
# wrapper, via `--status`): /var/lib/core_node/os-upgrade/state holds
# key=value lines, rewritten atomically (tmp file + mv) at every transition:
#   STATUS=<in-progress|reboot-required|failed|done>
#   CURRENT=<id version>   e.g. "debian 12" / "ubuntu 24.04"
#   TARGET=<id version>    e.g. "debian 13" / "ubuntu 26.04"
#   ATTEMPTS=<n>           failed hop attempts since the last success
# The file is kept until a run reaches STATUS=done, at which point that same
# run performs the mandatory cleanup (removes the state dir + resume unit).
#
# Usage:
#   ./upgrade_os_to_latest.sh              # interactive: one hop, then prompt to reboot
#   ./upgrade_os_to_latest.sh --resume     # unattended continuation (run by the resume unit)
#   ./upgrade_os_to_latest.sh --status     # read-only: print the state file and exit
#   OS_UPGRADE_ASSUME_YES=1 ./upgrade_os_to_latest.sh   # unattended first hop too
#

# Variable Declarations (declared at top per project rules)
SCRIPT_INDEX="OSUP"
LOG_TAG="$SCRIPT_INDEX"
STATE_DIR="/var/lib/core_node/os-upgrade"
STATE_FILE="$STATE_DIR/state"
LOG_FILE="/var/log/core_node-os-upgrade.log"
RESUME_UNIT_NAME="ncore-os-upgrade-resume.service"
RESUME_UNIT_PATH="/etc/systemd/system/$RESUME_UNIT_NAME"
SELF_SCRIPT_PATH="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"
BACKUP_ROOT="/var/backups/core_node-os-upgrade"
BACKUP_DIR=""
CONFIRM=""
APT_SOURCE_FILES=""
# Unattended mode for the very first (interactive) hop: OS_UPGRADE_ASSUME_YES=1
# skips the confirmation prompt, answers yes to apt, keeps existing conffiles.
# A --resume run is always unattended regardless of this variable.
ASSUME_YES="${OS_UPGRADE_ASSUME_YES:-0}"
APT_YES=""
DPKG_KEEP_CONF=""
f=""
url=""
host=""
src=""
round=0
update_output=""
OS_UPGRADE_DONE=0
OS_UPGRADE_NEEDS_REBOOT=0

# Debian hop chain this upgrader supports (official "Upgrades from Debian N"
# chapters). DEBIAN_HOP_FLOOR is the lowest starting major this script drives
# through the chain; DEBIAN_LATEST_MAJOR/CODENAME is the final target.
DEBIAN_HOP_FLOOR=11
DEBIAN_LATEST_MAJOR=13
DEBIAN_LATEST_CODENAME="trixie"

# Ubuntu latest LTS this upgrader targets (26.04, "resolute" -- confirmed via
# the official release feed https://changelogs.ubuntu.com/meta-release-lts,
# 26.04.1 point release out, verified 2026-09-28).
UBUNTU_LATEST_LTS_VERSION="26.04"

# Ensure sudo is available and set USE_SUDO (mirrors 97_install_tailscale.sh).
if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
else
    USE_SUDO=""
fi

# ---------------------------------------------------------------------------
# Logging + state-file helpers
# ---------------------------------------------------------------------------

log_line() {
    local msg="[$LOG_TAG] $*"
    echo "$msg"
    $USE_SUDO mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$msg" | $USE_SUDO tee -a "$LOG_FILE" >/dev/null 2>&1 || true
}

# Echoes the value of key $1 in the state file, or empty.
os_upgrade_state_get() {
    [ -f "$STATE_FILE" ] || return 0
    sed -n "s/^$1=//p" "$STATE_FILE" 2>/dev/null | tail -n1
}

# Rewrites key $1=$2 atomically (tmp file + mv), preserving every other key.
os_upgrade_state_set() {
    local key="$1" value="$2" tmp=""
    $USE_SUDO mkdir -p "$STATE_DIR"
    tmp="$(mktemp "${STATE_DIR}/.state.tmp.XXXXXX" 2>/dev/null || echo "${STATE_DIR}/.state.tmp.$$")"
    {
        [ -f "$STATE_FILE" ] && grep -v "^${key}=" "$STATE_FILE" 2>/dev/null
        printf '%s=%s\n' "$key" "$value"
    } | $USE_SUDO tee "$tmp" >/dev/null
    $USE_SUDO mv "$tmp" "$STATE_FILE"
}

# "<id> <version>" for the current host, e.g. "debian 12" / "ubuntu 24.04".
os_upgrade_current_id_version() {
    local os_id="" os_version_id=""
    os_id="$(. /etc/os-release 2>/dev/null; echo "$ID")"
    os_version_id="$(. /etc/os-release 2>/dev/null; echo "$VERSION_ID")"
    printf '%s %s' "$os_id" "$os_version_id"
}

# "<id> <version>" for this upgrader's final target on the current host.
os_upgrade_target_id_version() {
    local os_id=""
    os_id="$(. /etc/os-release 2>/dev/null; echo "$ID")"
    case "$os_id" in
        debian) printf '%s %s' "$os_id" "$DEBIAN_LATEST_MAJOR" ;;
        ubuntu) printf '%s %s' "$os_id" "$UBUNTU_LATEST_LTS_VERSION" ;;
        *) printf '%s ?' "$os_id" ;;
    esac
}

# Read-only: print the state file's raw key=value lines (STATUS=/CURRENT=/
# TARGET=/ATTEMPTS=) to stdout and exit -- no decoration, so a machine reader
# (e.g. the Windows WSL Debian wrapper) can parse it directly. Never mutates
# anything; prints nothing (exit 0) when no upgrade is in progress. Falls back
# to a sudo read since the state dir is root-owned.
os_upgrade_print_status() {
    if [ -r "$STATE_FILE" ]; then
        cat "$STATE_FILE"
    elif [ -f "$STATE_FILE" ]; then
        $USE_SUDO cat "$STATE_FILE" 2>/dev/null
    fi
    return 0
}

# ---------------------------------------------------------------------------
# Menu-label predicates (also usable standalone; linux_management.sh keeps a
# cheap local copy of these two thresholds so the submenu never has to shell
# out here just to render its label -- see that file's own comment).
# ---------------------------------------------------------------------------

os_upgrade_available() {
    local os_id="" os_version_id=""
    [ -f /etc/os-release ] || return 1
    os_id="$(. /etc/os-release 2>/dev/null; echo "$ID")"
    os_version_id="$(. /etc/os-release 2>/dev/null; echo "$VERSION_ID")"
    [ -n "$os_version_id" ] || return 1
    case "$os_id" in
        debian) [ "$os_version_id" -lt "$DEBIAN_LATEST_MAJOR" ] 2>/dev/null ;;
        ubuntu) dpkg --compare-versions "$os_version_id" lt "$UBUNTU_LATEST_LTS_VERSION" 2>/dev/null ;;
        *) return 1 ;;
    esac
}

os_upgrade_menu_label() {
    local os_id="" os_version_id="" target=""
    os_id="$(. /etc/os-release 2>/dev/null; echo "$ID")"
    os_version_id="$(. /etc/os-release 2>/dev/null; echo "$VERSION_ID")"
    case "$os_id" in
        debian) target="$DEBIAN_LATEST_MAJOR ($DEBIAN_LATEST_CODENAME)" ;;
        ubuntu) target="$UBUNTU_LATEST_LTS_VERSION" ;;
        *) target="latest" ;;
    esac
    printf '%s -> %s' "${os_version_id:-?}" "$target"
}

# ---------------------------------------------------------------------------
# systemd resume unit
# ---------------------------------------------------------------------------

install_resume_unit() {
    log_line "Installing resume unit: $RESUME_UNIT_PATH"
    $USE_SUDO tee "$RESUME_UNIT_PATH" >/dev/null <<EOF
[Unit]
Description=core_node OS upgrade resume (one-shot, continues after reboot)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/bin/bash $SELF_SCRIPT_PATH --resume
StandardOutput=append:$LOG_FILE
StandardError=append:$LOG_FILE

[Install]
WantedBy=multi-user.target
EOF
    $USE_SUDO systemctl daemon-reload
    $USE_SUDO systemctl enable "$RESUME_UNIT_NAME"
}

remove_resume_unit() {
    $USE_SUDO systemctl disable "$RESUME_UNIT_NAME" >/dev/null 2>&1 || true
    $USE_SUDO rm -f "$RESUME_UNIT_PATH"
    $USE_SUDO systemctl daemon-reload >/dev/null 2>&1 || true
}

# Mandatory cleanup: resume unit + state dir + temporary artifacts. Backups
# under BACKUP_ROOT are intentionally NOT removed (they are not temporary --
# they are the pre-hop safety copies an operator may still need).
cleanup_os_upgrade_artifacts() {
    log_line "Cleaning up OS upgrade artifacts (resume unit + state dir)"
    remove_resume_unit
    $USE_SUDO rm -rf "$STATE_DIR"
}

# After a successful major-version hop, the OS packages are on the new
# release but every /www/_<os>_<old_ver> tool dir (node/python/pipx/certbot/
# poetry/uv/omp symlinks, PostgreSQL, the RustDesk relay server - see
# debian_tooldir_migration.sh) is still exactly where it was. Idempotent and
# self-contained: no-ops when there is nothing to migrate, never deletes the
# old copy, and a failure here does not fail the OS upgrade itself (the
# upgrade already succeeded; a stuck tool dir is fixed by re-running this
# step, including by hand from the dd.sh Linux Management menu).
run_post_upgrade_tooldir_migration() {
    local migration_script="$(dirname "$(dirname "$SCRIPT_DIR")")/common/debian_tooldir_migration.sh"
    if [ -s "$migration_script" ]; then
        log_line "Checking for a legacy tool directory to migrate to the new OS version ..."
        bash "$migration_script" || log_line "[WARN] Tool-dir migration reported issues; re-run $migration_script by hand (or via dd.sh Linux Management > Linux System Tools) after investigating."
    else
        log_line "[WARN] Tool-dir migration script not found at $migration_script; skipping (no tool dirs were moved)"
    fi
}

# ---------------------------------------------------------------------------
# Shared steps (generalized from the former upgrade_to_debian_13.sh)
# ---------------------------------------------------------------------------

# Back up /etc, the dpkg selection list and the APT extended states (Debian
# release notes 4.1.1 equivalent). Timestamped per run; a re-run adds a fresh
# snapshot.
backup_system_state() {
    log_line "=== Backup ==="
    BACKUP_DIR="$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)"
    $USE_SUDO mkdir -p "$BACKUP_DIR"
    $USE_SUDO tar -czf "$BACKUP_DIR/etc.tar.gz" /etc 2>/dev/null || true
    dpkg --get-selections '*' | $USE_SUDO tee "$BACKUP_DIR/dpkg-selections.txt" >/dev/null
    if [ -f /var/lib/apt/extended_states ]; then
        $USE_SUDO cp /var/lib/apt/extended_states "$BACKUP_DIR/extended_states"
    fi
    log_line "Backup written to: $BACKUP_DIR"
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
    log_line "Fixing base-files /lib64 diversion record (divert-to mismatch blocks trixie base-files)"
    $USE_SUDO dpkg-divert --quiet --package base-files --no-rename --divert /lib64.usr-is-merged --remove /lib64 || return 1
    $USE_SUDO dpkg-divert --quiet --package base-files --no-rename --divert /.lib64.usr-is-merged --add /lib64 || return 1
    log_line "Diversion re-recorded: /lib64 -> /.lib64.usr-is-merged"
}

# Debian release notes 4.2.4/4.2.12 equivalent: the package database must be
# clean and hold-free before a hop.
preflight_package_checks() {
    log_line "=== Preflight package checks ==="
    local audit="" holds=""
    fix_base_files_lib64_diversion || log_line "WARNING: /lib64 diversion fix failed"
    audit="$(dpkg --audit 2>/dev/null)"
    if [ -n "$audit" ]; then
        log_line "WARNING: dpkg --audit reports problems:"
        echo "$audit" | sed "s/^/[$SCRIPT_INDEX]   /"
        log_line "Attempting repair (dpkg --configure -a / apt-get -f install)..."
        $USE_SUDO dpkg --configure -a || true
        $USE_SUDO apt-get $APT_YES $DPKG_KEEP_CONF -f install || true
        audit="$(dpkg --audit 2>/dev/null)"
        if [ -n "$audit" ]; then
            log_line "ERROR: package database still broken after repair:"
            echo "$audit" | sed "s/^/[$SCRIPT_INDEX]   /"
            return 1
        fi
        log_line "Package database repaired"
    else
        log_line "dpkg --audit: clean"
    fi
    holds="$(apt-mark showhold 2>/dev/null)"
    if [ -n "$holds" ]; then
        log_line "WARNING: held packages (upgrade may fail; unhold if not needed):"
        echo "$holds" | sed "s/^/[$SCRIPT_INDEX]   /"
    else
        log_line "No held packages"
    fi
}

# Debian release notes 4.2.2 equivalent: bring the current release to its
# latest point release first. disable_broken_third_party_repos runs first so
# a resumed run (sources already on the target codename, a third-party repo
# without it still enabled) cannot abort here.
update_current_release() {
    local current_codename="$1"
    log_line "=== Update Debian ($current_codename) to latest point release ==="
    disable_broken_third_party_repos "$current_codename" "current" || return 1
    $USE_SUDO dpkg --configure -a || true
    $USE_SUDO apt-get $APT_YES $DPKG_KEEP_CONF -f install || return 1
    $USE_SUDO apt-get $APT_YES $DPKG_KEEP_CONF full-upgrade || return 1
}

# FULL RESET of the official Debian APT sources to the canonical set for the
# hop's target codename (Debian release notes "Adjusting sources for apt").
# Every current source file is backed up first; /etc/apt/sources.list is
# rewritten with the canonical entries for the target release.
# non-free-firmware is only included from bookworm(12) onward (it did not
# exist as a separate component in bullseye/11 -- verified against the
# official Debian 12 release notes).
reset_apt_sources_to_target() {
    local target_major="$1" target_codename="$2" previous_codename="$3"
    local mirror="" security="" components=""
    log_line "=== Reset official APT sources to Debian $target_major ($target_codename) ==="
    $USE_SUDO mkdir -p "$BACKUP_DIR/apt-sources"

    # Self-heal: migrate side-by-side backups created by earlier versions of
    # this script out of the live APT config directory.
    for f in /etc/apt/sources.list.d/*.bak-debian12 /etc/apt/sources.list.d/*.bak-debian13; do
        [ -f "$f" ] || continue
        $USE_SUDO mv "$f" "$BACKUP_DIR/apt-sources/$(basename "$f")"
        log_line "Migrated legacy backup out of sources.list.d: $(basename "$f")"
    done

    APT_SOURCE_FILES=""
    for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
        [ -f "$f" ] || continue
        APT_SOURCE_FILES="$APT_SOURCE_FILES $f"
        if [ ! -f "$BACKUP_DIR/apt-sources/$(basename "$f")" ]; then
            $USE_SUDO cp "$f" "$BACKUP_DIR/apt-sources/$(basename "$f")"
            log_line "Backed up: $BACKUP_DIR/apt-sources/$(basename "$f")"
        fi
    done

    mirror="$( { $USE_SUDO grep -hE '^[[:space:]]*deb([[:space:]]|\[)' /etc/apt/sources.list /etc/apt/sources.list.d/*.list 2>/dev/null; $USE_SUDO grep -hE '^[[:space:]]*URIs:' /etc/apt/sources.list.d/*.sources 2>/dev/null; } | grep -oE 'https?://[^[:space:]]+' | grep '/debian' | grep -v 'debian-security' | head -1 )"
    [ -z "$mirror" ] && mirror="http://deb.debian.org/debian"
    security="$( { $USE_SUDO grep -hE '^[[:space:]]*deb([[:space:]]|\[)' /etc/apt/sources.list /etc/apt/sources.list.d/*.list 2>/dev/null; $USE_SUDO grep -hE '^[[:space:]]*URIs:' /etc/apt/sources.list.d/*.sources 2>/dev/null; } | grep -oE 'https?://[^[:space:]]+' | grep 'debian-security' | head -1 )"
    [ -z "$security" ] && security="http://security.debian.org/debian-security"

    components="main contrib non-free"
    [ "$target_major" -ge 12 ] 2>/dev/null && components="main contrib non-free non-free-firmware"

    log_line "Writing canonical $target_codename sources (mirror: $mirror; components: $components)"
    printf '%s\n' \
        "deb $mirror $target_codename $components" \
        "deb $mirror $target_codename-updates $components" \
        "deb $security $target_codename-security $components" \
        | $USE_SUDO tee /etc/apt/sources.list >/dev/null

    if [ -n "$previous_codename" ] && [ "$previous_codename" != "$target_codename" ]; then
        for f in $APT_SOURCE_FILES; do
            [ "$f" = "/etc/apt/sources.list" ] && continue
            if $USE_SUDO grep -q "$previous_codename" "$f" 2>/dev/null; then
                $USE_SUDO sed -i "s/$previous_codename/$target_codename/g" "$f"
                log_line "Repointed third-party file: $f"
            fi
        done
    fi
}

# Debian release notes 4.2.10 equivalent (unofficial sources): a third-party
# repo that does not publish the target codename makes `apt-get update` fail
# and would abort the whole hop (seen with e.g. a vendor repo 404ing on
# dists/<codename>). Self-heal: run apt-get update; on failure extract the
# failing repository host, find the source file that carries it and disable
# it (rename to *.disabled-<suffix>, reversible), then retry. Official Debian
# hosts are never disabled -- a failure there aborts instead.
disable_broken_third_party_repos() {
    local target_codename="$1" suffix="$2"
    log_line "Checking APT sources reachability (disabling repos without $target_codename support)..."
    round=0
    while [ "$round" -lt 5 ]; do
        round=$((round + 1))
        update_output="$($USE_SUDO apt-get update 2>&1)"
        if [ $? -eq 0 ]; then
            log_line "apt-get update: OK"
            return 0
        fi
        url="$(printf '%s\n' "$update_output" | grep "Failed to fetch" | grep -oE 'https?://[^ ]+' | head -1)"
        if [ -z "$url" ]; then
            url="$(printf '%s\n' "$update_output" | grep "does not have a Release file" | grep -oE "https?://[^']+" | head -1)"
        fi
        if [ -z "$url" ]; then
            log_line "ERROR: apt-get update failed without an identifiable repository URL:"
            printf '%s\n' "$update_output" | tail -20 | sed "s/^/[$SCRIPT_INDEX]   /"
            return 1
        fi
        host="$(printf '%s' "$url" | sed 's|https\?://||; s|/.*||')"
        case "$host" in
            deb.debian.org|security.debian.org|*.debian.org|ftp.*.debian.org)
                log_line "ERROR: official Debian repository failed ($host); not disabling it"
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
            log_line "ERROR: cannot find the source file for failing repository host: $host"
            return 1
        fi
        log_line "Repository '$host' has no $target_codename distribution -> disabling: $src"
        $USE_SUDO mv "$src" "${src}.disabled-${suffix}"
    done
    log_line "ERROR: apt-get update still failing after disabling 5 repositories"
    return 1
}

# Debian release notes 4.4 equivalent: refresh lists, minimal upgrade, then
# full upgrade.
perform_upgrade() {
    local target_codename="$1" target_major="$2"
    log_line "=== Upgrade packages (-> Debian $target_major / $target_codename) ==="
    disable_broken_third_party_repos "$target_codename" "debian${target_major}" || return 1
    log_line "Minimal system upgrade (apt-get upgrade --without-new-pkgs)..."
    $USE_SUDO apt-get $APT_YES $DPKG_KEEP_CONF upgrade --without-new-pkgs || return 1
    log_line "Full system upgrade (apt-get full-upgrade)..."
    $USE_SUDO apt-get $APT_YES $DPKG_KEEP_CONF full-upgrade || return 1
}

# Debian release notes 4.7/4.8 equivalent: drop redundant packages and the
# download cache.
cleanup_after_upgrade() {
    log_line "=== Cleanup ==="
    $USE_SUDO apt-get -y autoremove || true
    $USE_SUDO apt-get clean || true
}

# ---------------------------------------------------------------------------
# Debian hop chain
# ---------------------------------------------------------------------------

debian_codename_for_major() {
    case "$1" in
        11) printf 'bullseye' ;;
        12) printf 'bookworm' ;;
        13) printf 'trixie' ;;
        *) return 1 ;;
    esac
}

debian_next_major() {
    case "$1" in
        11) printf '12' ;;
        12) printf '13' ;;
        *) return 1 ;;
    esac
}

# Resolves what to do next. Prints one of:
#   "complete <major> <codename>"                       - finish an interrupted hop
#   "hop <cur_major> <cur_codename> <next_major> <next_codename>"  - start/resume a hop
#   "done <major> <codename>"                            - already at DEBIAN_LATEST_MAJOR
#   "unsupported <major>"                                - below DEBIAN_HOP_FLOOR / not Debian
debian_resolve_hop() {
    local major="" codename=""
    major="$(. /etc/os-release 2>/dev/null; echo "$VERSION_ID")"
    if [ -z "$major" ]; then
        echo "unsupported ?"
        return 1
    fi
    codename="$(debian_codename_for_major "$major" 2>/dev/null)"
    if [ "$major" -ge "$DEBIAN_LATEST_MAJOR" ] 2>/dev/null; then
        if [ -n "$(dpkg --audit 2>/dev/null)" ] || [ "$($USE_SUDO apt-get -s full-upgrade 2>/dev/null | grep -c '^Inst ')" -gt 0 ]; then
            echo "complete $major ${codename:-$DEBIAN_LATEST_CODENAME}"
        else
            echo "done $major ${codename:-$DEBIAN_LATEST_CODENAME}"
        fi
        return 0
    fi
    if [ "$major" -lt "$DEBIAN_HOP_FLOOR" ] 2>/dev/null; then
        echo "unsupported $major"
        return 1
    fi
    local next_major="" next_codename=""
    next_major="$(debian_next_major "$major")" || { echo "unsupported $major"; return 1; }
    next_codename="$(debian_codename_for_major "$next_major")"
    echo "hop $major $codename $next_major $next_codename"
}

# Finishes a hop that reported the target major in /etc/os-release (base-files
# configures early) while packages were still half-configured/pending -- the
# exact state a --resume run finds right after the reboot that follows a hop.
debian_complete_interrupted_hop() {
    local major="$1" codename="$2"
    log_line "PARTIAL upgrade detected (half-configured or pending packages) -> completing hop to Debian $major ($codename)"
    preflight_package_checks || { log_line "ERROR: preflight repair failed"; return 1; }
    update_current_release "$codename" || { log_line "ERROR: completing the upgrade failed; re-run to resume"; return 1; }
    cleanup_after_upgrade
    reset_apt_sources_to_target "$major" "$codename" "$codename"
    disable_broken_third_party_repos "$codename" "debian${major}" || true
    log_line "Hop to Debian $major ($codename) completed."
}

debian_perform_one_hop() {
    local current_major="$1" current_codename="$2" target_major="$3" target_codename="$4"

    log_line "Current system: Debian $current_major (${current_codename:-unknown})"
    if command -v fuser >/dev/null 2>&1 && $USE_SUDO fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; then
        log_line "ERROR: another apt/dpkg process holds the package lock"
        $USE_SUDO fuser -v /var/lib/dpkg/lock-frontend 2>&1 | sed "s/^/[$SCRIPT_INDEX]   /"
        return 1
    fi

    backup_system_state
    preflight_package_checks || { log_line "ERROR: preflight repair failed"; return 1; }
    update_current_release "$current_codename" || { log_line "ERROR: point-release update failed"; return 1; }
    reset_apt_sources_to_target "$target_major" "$target_codename" "$current_codename"
    perform_upgrade "$target_codename" "$target_major" || { log_line "ERROR: upgrade failed; re-run to resume"; return 1; }
    cleanup_after_upgrade

    log_line "Hop finished: Debian $current_major -> $target_major. Release marker: $(cat /etc/debian_version 2>/dev/null)"
    log_line "Backup of pre-hop state: $BACKUP_DIR"
}

debian_run_step() {
    local resolution="" action="" a2="" a3="" a4="" a5=""
    resolution="$(debian_resolve_hop)"
    action="$(printf '%s' "$resolution" | awk '{print $1}')"
    case "$action" in
        unsupported)
            log_line "ERROR: unsupported Debian version for this upgrader (need >= $DEBIAN_HOP_FLOOR)."
            return 1
            ;;
        done)
            log_line "Already at Debian $DEBIAN_LATEST_MAJOR ($DEBIAN_LATEST_CODENAME); nothing to do."
            OS_UPGRADE_DONE=1
            ;;
        complete)
            a2="$(printf '%s' "$resolution" | awk '{print $2}')"
            a3="$(printf '%s' "$resolution" | awk '{print $3}')"
            debian_complete_interrupted_hop "$a2" "$a3" || return 1
            if [ "$a2" -ge "$DEBIAN_LATEST_MAJOR" ] 2>/dev/null; then
                OS_UPGRADE_DONE=1
            else
                OS_UPGRADE_NEEDS_REBOOT=1
            fi
            ;;
        hop)
            a2="$(printf '%s' "$resolution" | awk '{print $2}')"
            a3="$(printf '%s' "$resolution" | awk '{print $3}')"
            a4="$(printf '%s' "$resolution" | awk '{print $4}')"
            a5="$(printf '%s' "$resolution" | awk '{print $5}')"
            debian_perform_one_hop "$a2" "$a3" "$a4" "$a5" || return 1
            OS_UPGRADE_NEEDS_REBOOT=1
            ;;
        *)
            log_line "ERROR: could not resolve Debian upgrade state"
            return 1
            ;;
    esac
    return 0
}

# ---------------------------------------------------------------------------
# Ubuntu do-release-upgrade chain
# ---------------------------------------------------------------------------

ubuntu_version_below() {
    local target="$1" current=""
    current="$(. /etc/os-release 2>/dev/null; echo "$VERSION_ID")"
    [ -n "$current" ] || return 1
    dpkg --compare-versions "$current" lt "$target" 2>/dev/null
}

# Prompt=lts for an LTS host (release notes: "You can only upgrade from one
# LTS release directly to the next sequential LTS release"), Prompt=normal
# for an interim host -- detected from the VERSION field of /etc/os-release
# ("24.04.4 LTS (Noble Numbat)" vs "25.10").
ubuntu_prompt_mode() {
    if [ -r /etc/os-release ] && grep -q 'LTS' /etc/os-release 2>/dev/null; then
        printf 'lts'
    else
        printf 'normal'
    fi
}

ubuntu_ensure_update_manager_core() {
    dpkg -s update-manager-core >/dev/null 2>&1 && return 0
    log_line "Installing update-manager-core (provides do-release-upgrade)..."
    $USE_SUDO apt-get update -qq || true
    $USE_SUDO apt-get $APT_YES install -y update-manager-core
}

ubuntu_set_release_upgrades_prompt() {
    local prompt_mode="$1" conf="/etc/update-manager/release-upgrades"
    log_line "Setting Prompt=$prompt_mode in $conf"
    if [ -f "$conf" ]; then
        if grep -q '^Prompt=' "$conf" 2>/dev/null; then
            $USE_SUDO sed -i "s/^Prompt=.*/Prompt=$prompt_mode/" "$conf"
        else
            printf 'Prompt=%s\n' "$prompt_mode" | $USE_SUDO tee -a "$conf" >/dev/null
        fi
    else
        printf '[DEFAULT]\nPrompt=%s\n' "$prompt_mode" | $USE_SUDO tee "$conf" >/dev/null
    fi
}

ubuntu_perform_one_hop() {
    local prompt_mode="$1" current=""
    current="$(. /etc/os-release 2>/dev/null; echo "$VERSION_ID")"
    log_line "Current system: Ubuntu $current"

    ubuntu_ensure_update_manager_core || { log_line "ERROR: could not install update-manager-core"; return 1; }
    ubuntu_set_release_upgrades_prompt "$prompt_mode"

    log_line "Updating and phased-upgrading the current release before the release upgrade"
    $USE_SUDO apt-get update || return 1
    $USE_SUDO apt-get dist-upgrade $APT_YES -o APT::Get::Always-Include-Phased-Updates=true || return 1

    log_line "Running do-release-upgrade (unattended frontend: DistUpgradeViewNonInteractive)"
    $USE_SUDO DEBIAN_FRONTEND=noninteractive do-release-upgrade -f DistUpgradeViewNonInteractive
    return $?
}

ubuntu_run_step() {
    local current="" prompt_mode=""
    current="$(. /etc/os-release 2>/dev/null; echo "$VERSION_ID")"
    if ! ubuntu_version_below "$UBUNTU_LATEST_LTS_VERSION"; then
        log_line "Already at Ubuntu $current (>= $UBUNTU_LATEST_LTS_VERSION); nothing to do."
        OS_UPGRADE_DONE=1
        return 0
    fi
    prompt_mode="$(ubuntu_prompt_mode)"
    ubuntu_perform_one_hop "$prompt_mode" || return 1
    OS_UPGRADE_NEEDS_REBOOT=1
    return 0
}

# ---------------------------------------------------------------------------
# Reboot / resume scheduling
# ---------------------------------------------------------------------------

record_failed_attempt() {
    local attempts=""
    attempts="$(os_upgrade_state_get ATTEMPTS)"
    [ -n "$attempts" ] || attempts=0
    attempts=$((attempts + 1))
    os_upgrade_state_set ATTEMPTS "$attempts"
    os_upgrade_state_set STATUS "failed"
    log_line "Hop attempt failed ($attempts/3)."
    if [ "$attempts" -ge 3 ]; then
        log_line "3 failed resume attempts; giving up and cleaning up (unit, state, temp artifacts)."
        cleanup_os_upgrade_artifacts
    fi
}

schedule_reboot_and_resume() {
    local resume_flag="$1" confirm=""
    install_resume_unit
    os_upgrade_state_set ATTEMPTS 0
    os_upgrade_state_set STATUS "reboot-required"
    echo ""
    log_line "This hop is complete. A REBOOT is required to continue the upgrade."
    log_line "Resume service installed: $RESUME_UNIT_NAME (runs automatically after each boot until finished)."
    if [ "$resume_flag" = "1" ]; then
        log_line "Unattended resume: rebooting now to continue automatically."
        $USE_SUDO systemctl reboot 2>/dev/null || $USE_SUDO reboot
        return 0
    fi
    if [ "$ASSUME_YES" = "1" ]; then
        log_line "Unattended mode: not rebooting automatically -- reboot manually to continue."
        return 0
    fi
    printf "[$SCRIPT_INDEX] Reboot now to continue the upgrade? [y/N]: "
    read -r confirm
    case "$confirm" in
        [Yy]*) $USE_SUDO systemctl reboot 2>/dev/null || $USE_SUDO reboot ;;
        *) log_line "Reboot skipped -- reboot manually; the resume service finishes the upgrade automatically once you do." ;;
    esac
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

main() {
    local os_id="" resume_flag="0"

    case "${1:-}" in
        --status) os_upgrade_print_status; return 0 ;;
        --resume) resume_flag="1" ;;
    esac

    [ -f /etc/os-release ] || { echo "[$SCRIPT_INDEX] ERROR: /etc/os-release not found; cannot detect OS"; return 1; }
    os_id="$(. /etc/os-release 2>/dev/null; echo "$ID")"

    if [ "$resume_flag" != "1" ]; then
        if ! os_upgrade_available; then
            echo "[$SCRIPT_INDEX] This host is already at the latest supported release for this upgrader."
            echo "[$SCRIPT_INDEX] Nothing to hop, but a previous hop can leave the per-OS tool directory"
            echo "[$SCRIPT_INDEX] (/www/_<os>_<ver>) behind - running the idempotent follow-up now (no-op if"
            echo "[$SCRIPT_INDEX] nothing is pending)."
            run_post_upgrade_tooldir_migration
            return 0
        fi
        echo "[$SCRIPT_INDEX] ============================================"
        echo "[$SCRIPT_INDEX] OS Upgrade Helper - $(os_upgrade_menu_label)"
        echo "[$SCRIPT_INDEX] ============================================"
        echo "[$SCRIPT_INDEX] This performs an IN-PLACE, official-path upgrade, one release per hop."
        echo "[$SCRIPT_INDEX] Services will be stopped/restarted; reboot(s) are required between hops."
        echo "[$SCRIPT_INDEX] If upgrading over SSH, run this inside screen/tmux."
        echo ""
        if [ "$ASSUME_YES" = "1" ]; then
            echo "[$SCRIPT_INDEX] OS_UPGRADE_ASSUME_YES=1 -> unattended mode"
        else
            printf "[$SCRIPT_INDEX] Type UPGRADE to continue: "
            read -r CONFIRM
            if [ "$CONFIRM" != "UPGRADE" ]; then
                echo "[$SCRIPT_INDEX] Aborted by user"
                return 0
            fi
        fi
    else
        log_line "=== Resuming OS upgrade (--resume) ==="
    fi

    if [ "$ASSUME_YES" = "1" ] || [ "$resume_flag" = "1" ]; then
        APT_YES="-y"
        DPKG_KEEP_CONF="-o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold"
    fi

    os_upgrade_state_set STATUS "in-progress"
    os_upgrade_state_set CURRENT "$(os_upgrade_current_id_version)"
    os_upgrade_state_set TARGET "$(os_upgrade_target_id_version)"

    OS_UPGRADE_DONE=0
    OS_UPGRADE_NEEDS_REBOOT=0
    case "$os_id" in
        debian) debian_run_step ;;
        ubuntu) ubuntu_run_step ;;
        *) log_line "ERROR: unsupported OS: $os_id"; return 1 ;;
    esac
    if [ $? -ne 0 ]; then
        record_failed_attempt
        return 1
    fi

    os_upgrade_state_set CURRENT "$(os_upgrade_current_id_version)"

    if [ "$OS_UPGRADE_DONE" = "1" ]; then
        os_upgrade_state_set STATUS "done"
        log_line "Upgrade complete ($(os_upgrade_current_id_version)). Cleaning up resume artifacts."
        cleanup_os_upgrade_artifacts
        run_post_upgrade_tooldir_migration
        return 0
    fi

    if [ "$OS_UPGRADE_NEEDS_REBOOT" = "1" ]; then
        schedule_reboot_and_resume "$resume_flag"
        return 0
    fi
    return 0
}

main "$@"
