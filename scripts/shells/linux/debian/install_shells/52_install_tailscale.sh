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

# Variables (declare first)
SCRIPT_INDEX="52"
SCRIPT_CURRENT_DIR=""
PARENT_DIR_LEVEL_1=""
PARENT_DIR_LEVEL_2=""
SCRIPT_TEMP_DIR=""
LOG_FILE=""
# Official one-line installer (Debian/Ubuntu/etc). Binary -> /usr/bin/tailscale,
# daemon -> tailscaled. See https://tailscale.com/kb/1031/install-linux
TAILSCALE_INSTALL_URL="https://tailscale.com/install.sh"

# Paths setup
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source globals
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

SCRIPT_TEMP_DIR=$(create_script_temp_dir "52_install_tailscale")
LOG_FILE="$SCRIPT_TEMP_DIR/tailscale_install_$(date +%Y%m%d_%H%M%S).log"

# Logging
log_message() {
    local message="$1"
    echo "[$SCRIPT_INDEX][$(date '+%Y-%m-%d %H:%M:%S')] $message" | tee -a "$LOG_FILE"
}

command_exists() { command -v "$1" >/dev/null 2>&1; }

# Ensure curl exists (the official installer needs it).
ensure_curl() {
    if command_exists curl; then
        return 0
    fi
    log_message "curl not found. Installing curl..."
    timeout 300 $USE_SUDO apt-get update -qq || log_message "apt-get update failed (continuing)"
    timeout 300 $USE_SUDO apt-get install -y curl || {
        log_message "Failed to install curl"
        return 1
    }
}

# Symlink the binaries into /usr/local/bin so they are on PATH like the other tools
# (the apt install already puts tailscale on /usr/bin, this is for repo consistency).
ensure_path_symlink() {
    local b
    for b in tailscale tailscaled; do
        if [ -x "/usr/bin/$b" ]; then
            $USE_SUDO ln -sf "/usr/bin/$b" "/usr/local/bin/$b" 2>/dev/null || true
        fi
    done
}

# Enable + start the tailscaled daemon (no-op if systemd is unavailable).
enable_service() {
    if command_exists systemctl; then
        $USE_SUDO systemctl enable --now tailscaled 2>/dev/null || \
            log_message "Could not enable tailscaled (run as root): sudo systemctl enable --now tailscaled"
    fi
}

main() {
    log_message "=========================================="
    log_message "Tailscale Installation"
    log_message "=========================================="

    # Idempotent: already installed -> just ensure service + symlink, then exit.
    if command_exists tailscale; then
        log_message "Tailscale already installed: $(tailscale version 2>/dev/null | head -1)"
        ensure_path_symlink
        enable_service
        log_message "Note: connect this node with: sudo tailscale up"
        exit 0
    fi

    if ! ensure_curl; then
        log_message "All Tailscale installation methods failed (curl unavailable)"
        exit 1
    fi

    log_message "Installing Tailscale via official installer ($TAILSCALE_INSTALL_URL)..."
    if curl -fsSL "$TAILSCALE_INSTALL_URL" | $USE_SUDO sh; then
        log_message "Tailscale installed."
        ensure_path_symlink
        enable_service
        if command_exists tailscale; then
            log_message "Verified: $(tailscale version 2>/dev/null | head -1)"
        fi
        log_message "Next step: bring this node online with: sudo tailscale up"
        exit 0
    else
        log_message "Tailscale installation failed"
        exit 1
    fi
}

main "$@"
