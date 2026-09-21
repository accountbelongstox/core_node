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

# =============================================================================
# Index 2 - Base System Setup: Disk Detection, Mount Management, and Mail Service Control
# =============================================================================

set -e

# Privileged helpers (usermod, groupadd, chpasswd, visudo) live in */sbin; runs
# that inherit a minimal PATH (cron, su without -, restricted shells) otherwise
# hit "usermod: command not found". Normalize once; idempotent.
case ":$PATH:" in
    *:/usr/sbin:*) ;;
    *) PATH="/usr/local/sbin:/usr/sbin:/sbin:$PATH"; export PATH ;;
esac

SCRIPT_INDEX="3"

# Color codes
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[36m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
POSTFIX_CLEANUP_COMMON="$PARENT_DIR_LEVEL_2/common/postfix_cleanup_common.sh"
DESKTOP_SYSTEM_POLICY="$PARENT_DIR_LEVEL_2/common/desktop_system_policy.sh"
POSTFIX_LOG_PREFIX="[$SCRIPT_INDEX] [POSTFIX]"

# Source gvar_common.sh (trust-based coding)
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/fs_perm_helpers.sh"
source "$POSTFIX_CLEANUP_COMMON"
# Mount library: single fstab entry per UUID, real-time remount
source "$PARENT_DIR_LEVEL_2/common/mount_common.sh"
source "$DESKTOP_SYSTEM_POLICY"
# Repository manager (merged from former 12_update.sh: repo repair + management).
source "$PARENT_DIR_LEVEL_2/common/apt_repository_manager.sh"
# Native apt sources restore (distro-aware self-heal for polluted
# sources.list; consumed here and by frankenphp_static_prereq.sh).
source "$PARENT_DIR_LEVEL_2/common/apt_sources_restore.sh"
MOUNT_LOG_PREFIX="[2]"

# PID of the background sudo keepalive loop (empty when not started / as root)
SUDO_KEEPALIVE_PID=""

# =============================================================================
# Logging Functions
# =============================================================================

log() {
    echo -e "${GREEN}[$SCRIPT_INDEX] $1${NC}"
}

info() {
    echo -e "${BLUE}[$SCRIPT_INDEX] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$SCRIPT_INDEX] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$SCRIPT_INDEX] ERROR: $1${NC}"
}

# read_default / prompt_read_default come from gvar_common.sh (single definition):
# TTY-guarded, foreground-checked, 30s timeout, then the documented default.

# =============================================================================
# Sudo Session Keepalive
# =============================================================================

# Prime the sudo credential cache once and keep it warm for the whole run. Every
# privileged op here goes through `$USE_SUDO` (= sudo) including `sudo -u <user>`
# drops; sudo's timestamp lapses (~15 min, per-tty) so otherwise a later command
# re-prompts mid-run. No-op when already root or when there is no terminal to
# prompt on. The refresher is a child of this script and is reaped on exit.
start_sudo_keepalive() {
    [ "$(id -u)" -eq 0 ] && return 0            # root: nothing to authenticate
    [ -n "$USE_SUDO" ] || return 0              # no sudo binary: nothing to do
    [ -t 0 ] || [ -r /dev/tty ] || return 0     # no terminal: cannot prompt
    log "Caching sudo credentials once for the whole base setup..."
    sudo -v || { warning "sudo authentication failed; per-command prompts may still appear."; return 0; }
    ( while kill -0 "$$" 2>/dev/null; do sudo -n true 2>/dev/null || exit 0; sleep 50; done ) &
    SUDO_KEEPALIVE_PID=$!
    trap 'stop_sudo_keepalive' EXIT INT TERM
    return 0
}

# Stop the background refresher (idempotent).
stop_sudo_keepalive() {
    [ -n "$SUDO_KEEPALIVE_PID" ] && kill "$SUDO_KEEPALIVE_PID" 2>/dev/null
    SUDO_KEEPALIVE_PID=""
}

# =============================================================================
# NTFS Support Functions
# =============================================================================

ensure_ntfs_support() {
    if ! command -v ntfs-3g >/dev/null 2>&1; then
        warning "ntfs-3g not installed, installing..."
        $USE_SUDO apt-get update
        if $USE_SUDO apt-get install -y ntfs-3g; then
            log "ntfs-3g installed successfully"
            return 0
        else
            error "Failed to install ntfs-3g"
            return 1
        fi
    else
        info "ntfs-3g is already installed"
        return 0
    fi
}

# =============================================================================
# Original Mail Service Control Functions (Encapsulated)
# =============================================================================

stop_mail_services() {
    log "Stopping and disabling mail services..."

    # Stop exim4 service
    if systemctl list-units --full -all | grep -Fq "exim4.service"; then
        info "exim4.service exists, stopping the service..."
        $USE_SUDO systemctl stop exim4.service 2>/dev/null || true
    else
        info "exim4.service does not exist, skipping."
    fi

    # Disable exim4 service
    if systemctl list-units --full -all | grep -Fq "exim4.service"; then
        info "exim4.service exists, disabling the service..."
        $USE_SUDO systemctl disable exim4.service 2>/dev/null || true
    else
        info "exim4.service does not exist, skipping."
    fi

    # Legacy service command support
    if [ -x "$(command -v service)" ]; then
        if [ -f "/etc/init.d/exim4" ]; then
            info "exim4.service exists (init.d), stopping the service..."
            service exim4 stop 2>/dev/null || true
        fi

    fi

    postfix_stop_and_disable

    log "Mail service control completed"
}

# =============================================================================
# Disk Label and Mount Point Functions

# =============================================================================
# Sudo + system update/init (merged from former 11_install_sudo.sh / 12_update.sh)
# =============================================================================

# Ensure sudo is installed and the invoking user is in the sudo group (was 11).
ensure_sudo_installed() {
    local current_user distro
    local sudoers_dropin="/etc/sudoers.d/90-core-node-sudo"
    # Resolve the real login user even when this script runs as root: SUDO_USER
    # first, then USER, then the first uid>=1000 account (same rule as
    # ensure_system_user_password).
    current_user=${SUDO_USER:-${USER:-$(whoami)}}
    if [ "$current_user" = "root" ] || [ -z "$current_user" ]; then
        current_user="$(getent passwd | awk -F: '$3>=1000 && $3<60000 {print $1; exit}')"
    fi
    distro=$(lsb_release -is 2>/dev/null || echo "Unknown")
    log "Ensuring sudo is installed for $distro..."

    if [ "$(id -u)" -ne 0 ] && [ -z "$USE_SUDO" ]; then
        error "This step needs root/sudo to install sudo; skipping."
        return 1
    fi

    if command -v sudo >/dev/null 2>&1; then
        info "sudo is already installed."
    else
        info "Installing sudo package..."
        if [ "$(id -u)" -eq 0 ]; then
            apt-get update || true
            apt-get install -y sudo || { error "Failed to install sudo package."; return 1; }
        else
            $USE_SUDO apt-get update || true
            $USE_SUDO apt-get install -y sudo || { error "Failed to install sudo package."; return 1; }
        fi
        log "sudo installed successfully."
    fi

    if ! getent group sudo >/dev/null 2>&1; then
        info "Creating sudo group..."
        if [ "$(id -u)" -eq 0 ]; then groupadd sudo || true; else $USE_SUDO groupadd sudo || true; fi
    fi

    # Without a %sudo rule in sudoers, group membership has no effect and every
    # sudo call fails with "user is not in the sudoers file". Idempotent drop-in.
    if ! grep -Eq '^[[:space:]]*%sudo[[:space:]]+ALL' /etc/sudoers /etc/sudoers.d/* 2>/dev/null; then
        info "sudoers has no %sudo rule; installing $sudoers_dropin..."
        if [ "$(id -u)" -eq 0 ]; then
            echo '%sudo ALL=(ALL:ALL) ALL' > "$sudoers_dropin"
            chmod 0440 "$sudoers_dropin"
        else
            echo '%sudo ALL=(ALL:ALL) ALL' | $USE_SUDO tee "$sudoers_dropin" >/dev/null
            $USE_SUDO chmod 0440 "$sudoers_dropin"
        fi
        if command -v visudo >/dev/null 2>&1; then
            if [ "$(id -u)" -eq 0 ]; then
                visudo -cf "$sudoers_dropin" >/dev/null 2>&1 || { error "sudoers drop-in failed syntax check; removing."; rm -f "$sudoers_dropin"; }
            else
                $USE_SUDO visudo -cf "$sudoers_dropin" >/dev/null 2>&1 || { error "sudoers drop-in failed syntax check; removing."; $USE_SUDO rm -f "$sudoers_dropin"; }
            fi
        fi
    fi

    if [ -n "$current_user" ] && [ "$current_user" != "root" ]; then
        if id -nG "$current_user" | grep -qw "sudo"; then
            info "User $current_user is already in the sudo group."
        else
            info "Adding user $current_user to sudo group..."
            if [ "$(id -u)" -eq 0 ]; then
                usermod -aG sudo "$current_user" || warning "Failed to add $current_user to sudo group."
            else
                $USE_SUDO usermod -aG sudo "$current_user" || warning "Failed to add $current_user to sudo group."
            fi
        fi

        # Verify sudoers actually resolves for the account (root check, no
        # password needed): membership in /etc/group is useless when no %sudo
        # rule matches.
        if [ "$(id -u)" -eq 0 ]; then
            if sudo -l -U "$current_user" >/dev/null 2>&1; then
                info "sudoers resolution for $current_user: OK."
            else
                warning "sudoers still rejects $current_user; check /etc/sudoers and /etc/sudoers.d."
            fi
        fi

        # usermod cannot patch a RUNNING session: Linux snapshots group
        # membership at login, so shells opened before the change keep failing
        # with "not in the sudoers file" even though the account is fixed.
        # Detect any live process of the user whose credential set still lacks
        # the sudo group and print the exact remedy.
        local sudo_gid stale_pid p
        sudo_gid="$(getent group sudo 2>/dev/null | cut -d: -f3)"
        stale_pid=""
        if [ -n "$sudo_gid" ]; then
            for p in $(pgrep -u "$current_user" 2>/dev/null); do
                if ! grep "^Groups:" "/proc/$p/status" 2>/dev/null | tr '\t ' '\n\n' | grep -qx "$sudo_gid"; then
                    stale_pid="$p"
                    break
                fi
            done
        fi
        if [ -n "$stale_pid" ]; then
            warning "Live $current_user sessions (e.g. pid $stale_pid) predate the group change and still lack the sudo group."
            warning "In those sessions run:  newgrp sudo   (or log out and back in), then retry sudo."
        fi
    else
        info "Running as root with no non-root login user; skipping sudo group setup."
    fi

    log "Sudo installation and configuration completed."
    return 0
}

# Converge the primary login user's password to the canonical value stored in
# the project secret store (key SYSTEM_USER_PASSWORD). When the local shadow
# drifts from the documented password every sudo/su prompt fails (observed:
# dd.sh and `sudo tailscale up` rejecting the expected password). Idempotent:
# the shadow hash is compared first (perl crypt, libcrypt handles yescrypt)
# and chpasswd only runs on mismatch; when perl is unavailable chpasswd runs
# unconditionally (setting the same password again is harmless). Skips with an
# info message when the key is absent or the user cannot be resolved.
ensure_system_user_password() {
    local target_user canonical_pw current_hash
    target_user="${SUDO_USER:-${USER:-$(whoami)}}"
    if [ "$target_user" = "root" ] || [ -z "$target_user" ]; then
        target_user="$(getent passwd | awk -F: '$3>=1000 && $3<60000 {print $1; exit}')"
    fi
    if [ -z "$target_user" ] || ! getent passwd "$target_user" >/dev/null 2>&1; then
        info "No non-root login user resolved; skipping password convergence."
        return 0
    fi

    canonical_pw="$(get_secret_content "SYSTEM_USER_PASSWORD" 2>/dev/null | head -n1)"
    if [ -z "$canonical_pw" ]; then
        info "SYSTEM_USER_PASSWORD not set in secret store; skipping password convergence for $target_user."
        return 0
    fi

    if [ "$(id -u)" -ne 0 ] && [ -z "$USE_SUDO" ]; then
        warning "Password convergence for $target_user needs root/sudo; skipping."
        return 0
    fi

    current_hash="$($USE_SUDO getent shadow "$target_user" 2>/dev/null | cut -d: -f2)"
    if [ -n "$current_hash" ] && command -v perl >/dev/null 2>&1; then
        if [ "$(perl -e 'print((crypt($ARGV[0],$ARGV[1]) eq $ARGV[1])?"match":"mismatch")' "$canonical_pw" "$current_hash")" = "match" ]; then
            info "Password for $target_user already matches SYSTEM_USER_PASSWORD."
            return 0
        fi
    fi

    info "Converging password for $target_user to SYSTEM_USER_PASSWORD..."
    if echo "$target_user:$canonical_pw" | $USE_SUDO chpasswd; then
        log "Password for $target_user converged."
    else
        warning "Failed to set password for $target_user."
    fi
    return 0
}

# Initialize core_node shared directories (was 12).
initialize_core_node_directories() {
    local CORE_NODE_BASE="${CORE_NODE_DATA_DIR}"
    local SHARED_DOWNLOADS="${CORE_NODE_SHARED_DOWNLOADS}"

    echo "Initializing core_node shared directories..."
    echo "[SAFE_PATH] CORE_NODE_BASE=$CORE_NODE_BASE SHARED_DOWNLOADS=$SHARED_DOWNLOADS"
    _safe_dir() {
        local d="$1"
        [ -z "$d" ] && return 1
        [[ "$d" != /* ]] && return 1
        case "$d" in
            /|/usr|/usr/*|/etc|/etc/*|/bin|/bin/*|/sbin|/sbin/*|/lib|/lib/*) return 1 ;;
            /var) return 1 ;;
            *) return 0 ;;
        esac
    }
    if _safe_dir "$CORE_NODE_BASE" && ensure_owned_tree_777 "$CORE_NODE_BASE"; then
        echo "Created base directory: $CORE_NODE_BASE"
    else
        echo "[SKIP] Refusing chmod on system or invalid path: $CORE_NODE_BASE"
    fi
    if _safe_dir "$SHARED_DOWNLOADS" && ensure_owned_tree_777 "$SHARED_DOWNLOADS"; then
        echo "Created shared downloads directory: $SHARED_DOWNLOADS"
    else
        echo "[SKIP] Refusing chmod on system or invalid path: $SHARED_DOWNLOADS"
    fi
}

# Install packages with fine-grained idempotency: skip packages that are already
# installed (dpkg -s), skip packages apt cannot install on this distro (checked via
# a per-package `apt-get -s install` simulation, which also resolves virtual names
# like libncurses5-dev -> libncurses-dev, while apt-cache show would report them as
# missing), batch-install the rest, and on batch failure retry per-package so one
# bad package cannot block the others. Never aborts the caller.
install_packages_idempotent() {
    local pkg
    local already=0 installed=0 skipped=0 failed=0
    local -a to_install=()
    for pkg in "$@"; do
        if dpkg -s "$pkg" >/dev/null 2>&1; then
            info "$pkg already installed"
            already=$((already + 1))
            continue
        fi
        if ! $USE_SUDO apt-get -s install "$pkg" >/dev/null 2>&1; then
            warning "$pkg not available on this distro, skipping"
            skipped=$((skipped + 1))
            continue
        fi
        to_install+=("$pkg")
    done
    if [ ${#to_install[@]} -gt 0 ]; then
        info "Installing ${#to_install[@]} missing package(s): ${to_install[*]}"
        # Installs always stream their real output (no redirection), so progress
        # and failures are visible live.
        if $USE_SUDO apt-get install -y "${to_install[@]}"; then
            installed=${#to_install[@]}
        else
            warning "Batch install failed; retrying per-package..."
            for pkg in "${to_install[@]}"; do
                if $USE_SUDO apt-get install -y "$pkg"; then
                    installed=$((installed + 1))
                else
                    error "Failed to install $pkg"
                    failed=$((failed + 1))
                fi
            done
        fi
    fi
    echo "Package summary: already installed: $already, newly installed: $installed, skipped unavailable: $skipped, failed: $failed"
    return 0
}

# Install essential packages and configure Git (was 12).
install_packages_and_configure_git() {
    echo "Installing essential packages..."
    install_packages_idempotent lsof cron curl vim git build-essential rsync htop \
        nano wget openssl libssl-dev zlib1g-dev libbz2-dev \
        libreadline-dev libsqlite3-dev llvm libncurses5-dev libncursesw5-dev \
        xz-utils tk-dev libffi-dev liblzma-dev make software-properties-common \
        dnsutils libvips-dev cpulimit expect tar gzip procps
    # xdg-utils provides xdg-open (used by pycore to open files/URLs). Idempotent,
    # non-fatal: only installs when xdg-open is missing. Output streams live.
    if ! command -v xdg-open >/dev/null 2>&1; then $USE_SUDO apt-get install -y xdg-utils || true; fi
    git config --global http.sslVerify "false" || true
    git config --global user.name "prop-dev" || true
    git config --global user.email "prop-dev@serve.com" || true
    echo "Essential packages installed."
}

# Fix temporary directory permissions (was 12).
fix_temp_permissions() {
    echo "Fixing temporary directory permissions..."
    $USE_SUDO chmod 1777 /tmp || true
    $USE_SUDO chown root:root /tmp || true
    $USE_SUDO mkdir -p /var/cache/apt/archives/partial || true
    $USE_SUDO mkdir -p /var/lib/apt/lists/partial || true
    $USE_SUDO mkdir -p /var/log/apt || true
    $USE_SUDO chmod 755 /var/cache/apt/archives/partial || true
    $USE_SUDO chmod 755 /var/lib/apt/lists/partial || true
    $USE_SUDO chmod 755 /var/log/apt || true
    $USE_SUDO rm -f /tmp/apt.conf.* 2>/dev/null || true
    $USE_SUDO rm -f /tmp/apt-key.* 2>/dev/null || true
    echo "Temporary directory permissions fixed"
}

# =============================================================================
# Main Function
# =============================================================================

main() {
    # Check if running in WSL environment (skip disk setup in WSL)
    if [ "${IS_WSL:-false}" = "true" ]; then
        log "WSL environment detected - skipping disk setup"
        log "WSL manages disk mounts automatically via /mnt/c, /mnt/d, etc."
        # Don't exit, just return from main function
        # The calling script (dd.sh) will continue execution
        return 0
    fi

    log "Starting base system setup..."

    # Step 0: ensure sudo is installed (merged from former 11_install_sudo.sh).
    ensure_sudo_installed || warning "sudo setup incomplete (continuing base setup)"
    # Step 0a: converge the login user's password so sudo/su prompts accept the
    # documented password (needs sudo installed for non-root runs).
    ensure_system_user_password
    # gvar_common sets USE_SUDO once at source time (only if the sudo binary then
    # existed). If ensure_sudo_installed just installed it, refresh USE_SUDO now so
    # every later `$USE_SUDO -u <user>` resolves to `sudo -u <user>` instead of a
    # bare `-u` (command not found) -- which would silently skip all per-user
    # desktop config on a root install that started without sudo.
    command -v sudo >/dev/null 2>&1 && USE_SUDO="sudo"

    # Authenticate sudo once up front and keep the ticket warm, so the many later
    # `sudo`/`sudo -u` calls don't each re-prompt when running as a non-root user.
    start_sudo_keepalive

    # Step 0b: system update + initialization (merged from former 12_update.sh).
    # Run with `set +e` so a failing apt/git/repo step never aborts the base setup.
    log "System update and initialization (merged from former 12_update.sh)..."
    set +e
    initialize_core_node_directories
    fix_temp_permissions
    # Ensure the distro archive signing key is present BEFORE any apt update so a
    # rotated/missing key (e.g. Kali's sqv "Missing key ..." breakage) cannot abort
    # the base setup. Idempotent; runs before repair so repair's apt update succeeds.
    if command -v ensure_distro_archive_keyring_from_apt_repository_manager >/dev/null 2>&1; then
        ensure_distro_archive_keyring_from_apt_repository_manager
    fi
    if command -v repair_repositories_from_apt_repository_manager >/dev/null 2>&1; then
        echo "=== Repository Repair and Verification ==="
        repair_repositories_from_apt_repository_manager
        verify_repository_health_from_apt_repository_manager
    fi
    if command -v manage_repositories_from_apt_repository_manager >/dev/null 2>&1; then
        manage_repositories_from_apt_repository_manager
    fi
    # Native sources self-heal AFTER repository repair: repair may restore a
    # polluted "original" backup (foreign suites); this converges the native
    # distro sources as the final writer before the apt update below.
    # apt output streams live (no redirection) so update progress/errors are visible.
    if command -v apt_sources_restore_ensure >/dev/null 2>&1; then
        apt_sources_restore_ensure
        if [ "$APT_SOURCES_RESTORE_CHANGED" = "true" ]; then
            $USE_SUDO apt-get update || true
        fi
    fi
    $USE_SUDO apt update || $USE_SUDO apt update --allow-unauthenticated || true
    install_packages_and_configure_git
    $USE_SUDO sysctl fs.inotify.max_user_watches=524288 2>/dev/null || true
    $USE_SUDO sysctl -p 2>/dev/null || true
    $USE_SUDO rm -rf /tmp/apt.* /tmp/apt-key.* 2>/dev/null || true
    set -e

    # Step 1: Disk detection and mount management
    log "Step 1: Disk detection and mount management"
    echo ""

    local ntfs_disks=$(detect_ntfs_disks)
    local has_ntfs=$?

    if [ $has_ntfs -eq 0 ]; then
        log "Processing NTFS disks..."

        for device in $ntfs_disks; do
            handle_ntfs_disk "$device"
            echo ""
        done
    fi

    local data_disks=$(detect_data_disks)
    local has_data=$?

    if [ $has_data -eq 0 ]; then
        log "Processing data disks..."

        for device in $data_disks; do
            handle_data_disk "$device"
            echo ""
        done
    fi

    if command -v systemctl >/dev/null 2>&1; then
        # Guard: in a chroot/container/WSL where systemctl exists but systemd is not
        # PID 1, daemon-reload exits non-zero ("Failed to connect to bus") and would
        # abort the run under set -e before the remaining steps.
        $USE_SUDO systemctl daemon-reload 2>/dev/null || true
    fi

    log "Disk setup completed!"

    # Persist base data directory so project and all scripts use the same path (center)
    if command -v persist_base_data_directory >/dev/null 2>&1; then
        persist_base_data_directory "$(get_base_data_directory)"
    fi

    # Converge the canonical /www path: plain dir when root fs wins (case A),
    # bind-mount to the selected NTFS/data disk when that disk has more free
    # space (cases B/C, largest free wins). Idempotent; fstab + real-time mount.
    if command -v ensure_www_base_mount >/dev/null 2>&1; then
        ensure_www_base_mount || warning "/www base convergence incomplete (continuing base setup)"
    fi

    # Persist the canonical WWW path in the var center: /www/www when a shared
    # NTFS/data disk is bound (the Windows D:\www equivalent), /www on
    # Linux-only machines. All scripts read this instead of re-deriving it.
    if command -v map_web_path >/dev/null 2>&1 && command -v set_env_and_var >/dev/null 2>&1; then
        set_env_and_var "WWW_PATH" "$(map_web_path www)" || true
        log "WWW_PATH persisted: $(map_web_path www)"
    fi

    echo ""
    log "Current mount points:"
    df -h | grep -E "^/dev/(sd|nvme|vd)" | awk '{printf "  %-20s %-15s %-10s %s\n", $1, $6, $3, $5}'

    # Step 2: Mail service control
    echo ""
    log "Step 2: Mail service control"
    stop_mail_services

    # Step 3: Desktop system optimization (if desktop environment detected)
    echo ""
    log "Step 3: Desktop system optimization"
    configure_desktop_system
    # Keep the desktop fully awake (merged from former 4_set_desktop_power.sh):
    # no suspend/hibernate, no display blank, no disk spindown.
    configure_desktop_power_policy

    log "Base system setup completed!"

    # Mark disk setup as completed
    if [ -n "$GLOBAL_VAR_DIR" ]; then
        echo "[2] echo \"\$(date +%Y%m%d_%H%M%S)\" | $USE_SUDO tee $GLOBAL_VAR_DIR/DISK_SETUP_COMPLETED"
        echo "$(date +%Y%m%d_%H%M%S)" | $USE_SUDO tee "$GLOBAL_VAR_DIR/DISK_SETUP_COMPLETED" >/dev/null
        log "Disk setup completion flag saved"
    fi
}

main
