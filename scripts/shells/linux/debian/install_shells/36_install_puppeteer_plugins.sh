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
SCRIPT_INDEX="36"

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
$USE_SUDO apt-get install -y \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0

# Function to install pnpm package
install_pnpm_package() {
    local package=$1
    echo "[$SCRIPT_INDEX] Installing $package..."
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
