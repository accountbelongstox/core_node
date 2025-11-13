#!/bin/bash
# Index9 Script - Disable Ubuntu Automatic Updates
# This script disables automatic updates, kernel updates, and unattended-upgrades
# to prevent kernel version mismatches with graphics drivers

# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY FORBIDDEN
# ### AI SPECIAL ATTENTION RULES END ###

set -e

# Script index for logging
SCRIPT_INDEX="9"

# Color codes
YELLOW='\033[33m'
RED='\033[31m'
GREEN='\033[32m'
NC='\033[0m'

# Simple output functions
log() {
    echo -e "${GREEN}[$SCRIPT_INDEX] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$SCRIPT_INDEX] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$SCRIPT_INDEX] ERROR: $1${NC}"
}

# Get script directory and calculate paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source gvar_common.sh to get necessary variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Configuration file paths
PERIODIC_CONFIG="/etc/apt/apt.conf.d/10periodic"
AUTO_UPGRADES_CONFIG="/etc/apt/apt.conf.d/20auto-upgrades"
UNATTENDED_CONFIG="/etc/apt/apt.conf.d/50unattended-upgrades"
UPDATES_AVAILABLE="/var/lib/update-notifier/updates-available"

# Function to backup configuration file
backup_config() {
    local config_file="$1"
    if [ -s "$config_file" ]; then
        if [ ! -s "${config_file}.bak" ]; then
            $USE_SUDO cp "$config_file" "${config_file}.bak"
            log "Backed up $config_file to ${config_file}.bak"
        fi
    fi
}

# Function to disable periodic updates
disable_periodic_updates() {
    log "Disabling periodic package list updates..."
    
    backup_config "$PERIODIC_CONFIG"
    
    # Create or modify 10periodic file
    if [ ! -s "$PERIODIC_CONFIG" ]; then
        $USE_SUDO tee "$PERIODIC_CONFIG" > /dev/null << 'EOF'
APT::Periodic::Update-Package-Lists "0";
APT::Periodic::Download-Upgradeable-Packages "0";
APT::Periodic::AutocleanInterval "0";
APT::Periodic::Unattended-Upgrade "0";
EOF
        log "Created $PERIODIC_CONFIG with all values set to 0"
    else
        # Replace all 1 and 2 with 0
        $USE_SUDO sed -i.bak 's/[12]/0/g' "$PERIODIC_CONFIG"
        log "Modified $PERIODIC_CONFIG: all values set to 0"
    fi
}

# Function to disable auto-upgrades
disable_auto_upgrades() {
    log "Disabling automatic upgrades..."
    
    backup_config "$AUTO_UPGRADES_CONFIG"
    
    # Create or modify 20auto-upgrades file
    if [ ! -s "$AUTO_UPGRADES_CONFIG" ]; then
        $USE_SUDO tee "$AUTO_UPGRADES_CONFIG" > /dev/null << 'EOF'
APT::Periodic::Update-Package-Lists "0";
APT::Periodic::Download-Upgradeable-Packages "0";
APT::Periodic::AutocleanInterval "0";
APT::Periodic::Unattended-Upgrade "0";
EOF
        log "Created $AUTO_UPGRADES_CONFIG with all values set to 0"
    else
        # Replace all 1 and 2 with 0
        $USE_SUDO sed -i.bak 's/[12]/0/g' "$AUTO_UPGRADES_CONFIG"
        log "Modified $AUTO_UPGRADES_CONFIG: all values set to 0"
    fi
}

# Function to stop and disable unattended-upgrades service
disable_unattended_service() {
    log "Stopping and disabling unattended-upgrades service..."
    
    if systemctl list-units --type=service --all 2>/dev/null | grep -q "unattended-upgrades"; then
        $USE_SUDO systemctl stop unattended-upgrades 2>/dev/null || true
        $USE_SUDO systemctl disable unattended-upgrades 2>/dev/null || true
        log "unattended-upgrades service stopped and disabled"
    else
        warning "unattended-upgrades service not found"
    fi
}

# Function to disable kernel updates
disable_kernel_updates() {
    log "Disabling kernel updates..."
    
    # Hold kernel packages to prevent updates
    $USE_SUDO apt-mark hold linux-generic linux-image-generic linux-headers-generic 2>/dev/null || true
    
    # Also hold specific kernel versions if they exist
    local installed_kernels=$(dpkg --list | grep -E "^ii.*linux-image-[0-9]" | awk '{print $2}' | grep -v generic)
    for kernel in $installed_kernels; do
        $USE_SUDO apt-mark hold "$kernel" 2>/dev/null || true
    done
    
    log "Kernel packages marked as hold (will not be updated)"
    
    # Add kernel packages to unattended-upgrades blacklist
    if [ -s "$UNATTENDED_CONFIG" ]; then
        backup_config "$UNATTENDED_CONFIG"
        
        # Check if Package-Blacklist section exists
        if ! grep -q "Package-Blacklist" "$UNATTENDED_CONFIG"; then
            # Add Package-Blacklist section
            $USE_SUDO tee -a "$UNATTENDED_CONFIG" > /dev/null << 'EOF'

Unattended-Upgrade::Package-Blacklist {
    "linux-generic";
    "linux-image-generic";
    "linux-headers-generic";
};
EOF
            log "Added kernel packages to unattended-upgrades blacklist"
        else
            # Add kernel packages to existing blacklist if not already present
            if ! grep -q "linux-generic" "$UNATTENDED_CONFIG"; then
                $USE_SUDO sed -i '/Unattended-Upgrade::Package-Blacklist {/a\    "linux-generic";\n    "linux-image-generic";\n    "linux-headers-generic";' "$UNATTENDED_CONFIG"
                log "Added kernel packages to existing blacklist"
            else
                log "Kernel packages already in blacklist"
            fi
        fi
    fi
}

# Function to clear update notifications
clear_update_notifications() {
    log "Clearing update notifications..."
    
    if [ -s "$UPDATES_AVAILABLE" ]; then
        $USE_SUDO rm -f "$UPDATES_AVAILABLE"
        log "Removed update notification file"
    else
        log "No update notification file found"
    fi
}

# Function to clean apt cache (optional)
clean_apt_cache() {
    log "Cleaning apt cache..."
    
    $USE_SUDO apt autoremove -y 2>/dev/null || true
    $USE_SUDO apt clean 2>/dev/null || true
    $USE_SUDO apt autoclean 2>/dev/null || true
    
    log "Apt cache cleaned"
}

# Function to show current status
show_status() {
    log "=========================================="
    log "Ubuntu Auto-Update Configuration Status"
    log "=========================================="
    
    echo ""
    log "Periodic Updates Configuration:"
    if [ -s "$PERIODIC_CONFIG" ]; then
        cat "$PERIODIC_CONFIG" | grep -E "APT::Periodic" || echo "  No periodic settings found"
    else
        echo "  File does not exist"
    fi
    
    echo ""
    log "Auto-Upgrades Configuration:"
    if [ -s "$AUTO_UPGRADES_CONFIG" ]; then
        cat "$AUTO_UPGRADES_CONFIG" | grep -E "APT::Periodic" || echo "  No auto-upgrade settings found"
    else
        echo "  File does not exist"
    fi
    
    echo ""
    log "Unattended-Upgrades Service Status:"
    if systemctl list-units --type=service --all 2>/dev/null | grep -q "unattended-upgrades"; then
        systemctl is-active unattended-upgrades 2>/dev/null && echo "  Active" || echo "  Inactive"
        systemctl is-enabled unattended-upgrades 2>/dev/null && echo "  Enabled" || echo "  Disabled"
    else
        echo "  Service not found"
    fi
    
    echo ""
    log "Kernel Packages Hold Status:"
    local held_packages=$(apt-mark showhold | grep -E "linux-" || echo "")
    if [ -n "$held_packages" ]; then
        echo "$held_packages" | while read -r pkg; do
            echo "  $pkg"
        done
    else
        echo "  No kernel packages on hold"
    fi
    
    log "=========================================="
}

# Main execution
main() {
    log "Starting Ubuntu auto-update disable process..."
    echo ""
    
    # Check if running on Ubuntu/Debian
    if [ ! -s /etc/os-release ]; then
        error "Cannot detect operating system (missing /etc/os-release)"
        exit 1
    fi
    
    . /etc/os-release
    if [ "$ID" != "ubuntu" ] && [ "$ID" != "debian" ]; then
        error "This script is designed for Ubuntu/Debian systems only"
        exit 1
    fi
    
    log "Detected: $ID $VERSION_ID"
    echo ""
    
    # Disable periodic updates
    disable_periodic_updates
    echo ""
    
    # Disable auto-upgrades
    disable_auto_upgrades
    echo ""
    
    # Stop and disable unattended-upgrades service
    disable_unattended_service
    echo ""
    
    # Disable kernel updates
    disable_kernel_updates
    echo ""
    
    # Clear update notifications
    clear_update_notifications
    echo ""
    
    # Optional: clean apt cache
    warning "Do you want to clean apt cache? (y/n): "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        clean_apt_cache
        echo ""
    fi
    
    # Show final status
    show_status
    
    log "Ubuntu auto-update disable process completed!"
    warning "Note: Disabling automatic updates may expose your system to security vulnerabilities."
    warning "Please manually update your system regularly to maintain security."
}

# Run main function
main

