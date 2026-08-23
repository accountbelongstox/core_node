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

SCRIPT_INDEX="2"

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

# Default mount base directory
DEFAULT_MOUNT_BASE="/mnt"

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

# TTY-guarded prompt read. Echoes the user's reply, or $1 (the prompt's documented
# default) when there is no interactive terminal -- so a piped/orchestrated re-run
# proceeds with the intended default instead of letting `read` hit EOF and abort
# the whole script under `set -e`. Empty interactive input also yields the default,
# matching the "(Y/n)"/"(y/N)" convention. Usage: confirm="$(read_default y)"
read_default() {
    local default="$1" reply=""
    if [ -t 0 ] && [ -r /dev/tty ]; then
        read -r reply < /dev/tty || reply=""
    fi
    printf '%s' "${reply:-$default}"
}

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
        $USE_SUDO apt-get update -qq
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
    current_user=${USER:-$(whoami)}
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

    if [ -n "$current_user" ] && [ "$current_user" != "root" ]; then
        if id -nG "$current_user" | grep -qw "sudo"; then
            info "User $current_user is already in the sudo group."
        else
            info "Adding user $current_user to sudo group..."
            if [ "$(id -u)" -eq 0 ]; then
                usermod -aG sudo "$current_user" && info "User $current_user added (re-login for effect)." || warning "Failed to add $current_user to sudo group."
            else
                $USE_SUDO usermod -aG sudo "$current_user" && info "User $current_user added (re-login for effect)." || warning "Failed to add $current_user to sudo group."
            fi
        fi
    else
        info "Running as root user, no need to add to sudo group."
    fi

    log "Sudo installation and configuration completed."
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

# Install essential packages and configure Git (was 12).
install_packages_and_configure_git() {
    echo "Installing essential packages..."
    $USE_SUDO apt install -y lsof cron curl vim git build-essential rsync htop \
        nano wget openssl libssl-dev zlib1g-dev libbz2-dev \
        libreadline-dev libsqlite3-dev llvm libncurses5-dev libncursesw5-dev \
        xz-utils tk-dev libffi-dev liblzma-dev make software-properties-common \
        cron dnsutils libvips-dev cpulimit expect tar gzip procps || true
    # xdg-utils provides xdg-open (used by pycore to open files/URLs). Idempotent,
    # non-fatal: only installs when xdg-open is missing.
    if ! command -v xdg-open >/dev/null 2>&1; then $USE_SUDO apt-get install -y xdg-utils >/dev/null 2>&1 || true; fi
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
    if command -v apt_sources_restore_ensure >/dev/null 2>&1; then
        apt_sources_restore_ensure
        if [ "$APT_SOURCES_RESTORE_CHANGED" = "true" ]; then
            $USE_SUDO apt-get update 2>/dev/null || true
        fi
    fi
    $USE_SUDO apt update 2>/dev/null || $USE_SUDO apt update --allow-unauthenticated 2>/dev/null || true
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
