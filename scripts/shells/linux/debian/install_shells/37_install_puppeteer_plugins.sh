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

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="37"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Get USE_SUDO variable
USE_SUDO=$(get_var "USE_SUDO")
if [ -z "$USE_SUDO" ]; then
    USE_SUDO="sudo"
fi

echo "[$SCRIPT_INDEX] Installing Puppeteer Anti-Detection Plugins..."

# Install xvfb for virtual display (required for puppeteer-real-browser on Linux)
echo "[$SCRIPT_INDEX] Installing xvfb for virtual display..."
$USE_SUDO apt-get update
$USE_SUDO apt-get install -y xvfb

# Install required system dependencies for Chromium
echo "[$SCRIPT_INDEX] Installing Chromium dependencies..."

# For Ubuntu 24.04+, libasound2 is replaced by pipewire-audio
if $USE_SUDO apt-cache show pipewire-audio >/dev/null 2>&1; then
    AUDIO_PACKAGE="pipewire-audio"
elif $USE_SUDO apt-cache show libasound2 >/dev/null 2>&1; then
    AUDIO_PACKAGE="libasound2"
else
    AUDIO_PACKAGE=""
    echo "[$SCRIPT_INDEX] Warning: No audio package found, continuing without it..."
fi

# Build package list
CHROMIUM_DEPS="libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libatspi2.0-0"

if [ -n "$AUDIO_PACKAGE" ]; then
    CHROMIUM_DEPS="$CHROMIUM_DEPS $AUDIO_PACKAGE"
fi

$USE_SUDO apt-get install -y $CHROMIUM_DEPS

# Ensure pnpm is available and PATH is set
echo "[$SCRIPT_INDEX] Configuring pnpm environment..."

# Idempotency: this script may run under no TTY (installer / systemd). Auto-confirm pnpm's
# node_modules format-purge so `pnpm add -g` below recreates the store instead of aborting
# with ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY on a re-run after a pnpm version change.
export npm_config_confirm_modules_purge="${npm_config_confirm_modules_purge:-false}"

# Get pnpm global bin directory
PNPM_GLOBAL_BIN=$(get_var "PNPM_GLOBAL_BIN_DIR" 2>/dev/null)

if [ -z "$PNPM_GLOBAL_BIN" ]; then
    # Fallback: try to get from pnpm config
    if command -v pnpm >/dev/null 2>&1; then
        PNPM_GLOBAL_BIN=$(pnpm config get global-bin-dir 2>/dev/null)
    fi
fi

# Export PATH to include pnpm global bin
if [ -n "$PNPM_GLOBAL_BIN" ]; then
    echo "[$SCRIPT_INDEX] Adding pnpm global bin to PATH: $PNPM_GLOBAL_BIN"
    export PATH="$PNPM_GLOBAL_BIN:$PATH"
else
    echo "[$SCRIPT_INDEX] Warning: Could not determine pnpm global bin directory"
fi

# Verify pnpm is accessible
if ! command -v pnpm >/dev/null 2>&1; then
    echo "[$SCRIPT_INDEX] ERROR: pnpm not found in PATH"
    echo "[$SCRIPT_INDEX] Please run 29_ensure_pnpm_packages.sh first"
    exit 1
fi

echo "[$SCRIPT_INDEX] pnpm version: $(pnpm --version)"
echo "[$SCRIPT_INDEX] pnpm location: $(which pnpm)"

# Function to install pnpm package
install_pnpm_package() {
    local package=$1
    # Idempotency: skip if the global package is already installed so re-runs are
    # fast no-ops and never re-resolve the whole global store.
    if pnpm list -g "$package" >/dev/null 2>&1 && pnpm list -g "$package" 2>/dev/null | grep -q "$package"; then
        echo "[$SCRIPT_INDEX] $package already installed, skipping"
        return 0
    fi
    echo "[$SCRIPT_INDEX] Installing $package..."
    # npm_config_confirm_modules_purge=false is already exported at script top (no-TTY purge guard).
    if pnpm add -g "$package"; then
        echo "[$SCRIPT_INDEX] $package installed successfully"
        return 0
    else
        echo "[$SCRIPT_INDEX] Failed to install $package"
        return 1
    fi
}

# Install rebrowser packages (best anti-detection)
echo "[$SCRIPT_INDEX] Installing rebrowser packages..."
install_pnpm_package "rebrowser-puppeteer-core"
install_pnpm_package "rebrowser-puppeteer"

# Install puppeteer-real-browser
echo "[$SCRIPT_INDEX] Installing puppeteer-real-browser..."
install_pnpm_package "puppeteer-real-browser"

# Install puppeteer-extra and plugins
echo "[$SCRIPT_INDEX] Installing puppeteer-extra and plugins..."
install_pnpm_package "puppeteer-extra"
install_pnpm_package "puppeteer-extra-plugin-stealth"
install_pnpm_package "puppeteer-extra-plugin-adblocker"
install_pnpm_package "puppeteer-extra-plugin-anonymize-ua"
install_pnpm_package "puppeteer-extra-plugin-user-preferences"
install_pnpm_package "puppeteer-extra-plugin-recaptcha"
install_pnpm_package "puppeteer-extra-plugin-block-resources"

# Apply rebrowser patches to puppeteer-core if installed
echo "[$SCRIPT_INDEX] Applying rebrowser patches..."
if pnpm list -g puppeteer-core >/dev/null 2>&1; then
    echo "[$SCRIPT_INDEX] Patching puppeteer-core with rebrowser-patches..."
    pnpm dlx rebrowser-patches@latest patch --packageName puppeteer-core || true
fi

echo "[$SCRIPT_INDEX] Puppeteer anti-detection plugins installation completed"
echo "[$SCRIPT_INDEX] Installed packages:"
echo "[$SCRIPT_INDEX]   - rebrowser-puppeteer-core (best anti-detection)"
echo "[$SCRIPT_INDEX]   - rebrowser-puppeteer"
echo "[$SCRIPT_INDEX]   - puppeteer-real-browser"
echo "[$SCRIPT_INDEX]   - puppeteer-extra + stealth, adblocker, anonymize-ua plugins"
