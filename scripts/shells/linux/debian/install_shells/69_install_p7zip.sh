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

# Install 7z (p7zip) on Debian/Ubuntu (Ubuntu reuses the debian install_shells).
# Rationale: the AppQyV1 dictionary initialization (php artisan sys:init -> Step 2)
# extracts split 7z archives under init_data/AppQyV1/VoiceStaticServer/translate/*.js
# into olddb.txt using the external 7z binary. Without it the translations are lost
# and every dictionary word ends up has_translation=0 (UI shows Translated = 0).
# Idempotent: exits early when a 7z-compatible binary is already present.

# --- All variables declared at top ---
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
GVAR_COMMON="$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
COMMON_FUNCTIONS="$PARENT_DIR_LEVEL_2/common/common_functions.sh"
DISTRO=""
SEVENZIP_PRIMARY_PACKAGE="p7zip-full"
SEVENZIP_FALLBACK_PACKAGE="p7zip"

# Source global variables and shared print/sudo helpers
source "$GVAR_COMMON"
source "$COMMON_FUNCTIONS"

DISTRO=$(lsb_release -is 2>/dev/null || echo "Unknown")

print_step_from_common_functions "Installing 7z (p7zip) for $DISTRO..."

# Idempotent: any 7z-compatible binary is enough
if command -v 7z >/dev/null 2>&1 || command -v 7za >/dev/null 2>&1 || command -v 7zr >/dev/null 2>&1; then
    print_success_from_common_functions "7z is already installed."
    exit 0
fi

# Require root or sudo to install packages
if [ "$(id -u)" -ne 0 ] && [ -z "$USE_SUDO" ]; then
    print_error_from_common_functions "This script must be run as root or with sudo to install $SEVENZIP_PRIMARY_PACKAGE!"
    echo "Please run one of the following:"
    echo "  sudo bash $0"
    echo "Or manually: sudo apt-get install -y $SEVENZIP_PRIMARY_PACKAGE"
    exit 1
fi

# Install p7zip-full (provides /usr/bin/7z and 7za); fall back to p7zip (7zr only)
if [ "$(id -u)" -eq 0 ]; then
    apt-get update
    if ! apt-get install -y "$SEVENZIP_PRIMARY_PACKAGE"; then
        print_warning_from_common_functions "$SEVENZIP_PRIMARY_PACKAGE unavailable, trying $SEVENZIP_FALLBACK_PACKAGE..."
        apt-get install -y "$SEVENZIP_FALLBACK_PACKAGE"
    fi
else
    $USE_SUDO apt-get update
    if ! $USE_SUDO apt-get install -y "$SEVENZIP_PRIMARY_PACKAGE"; then
        print_warning_from_common_functions "$SEVENZIP_PRIMARY_PACKAGE unavailable, trying $SEVENZIP_FALLBACK_PACKAGE..."
        $USE_SUDO apt-get install -y "$SEVENZIP_FALLBACK_PACKAGE"
    fi
fi

# Verify
if command -v 7z >/dev/null 2>&1 || command -v 7za >/dev/null 2>&1 || command -v 7zr >/dev/null 2>&1; then
    print_success_from_common_functions "7z (p7zip) installed successfully."
else
    print_error_from_common_functions "Failed to install 7z (p7zip). Dictionary translations will NOT import."
    exit 1
fi
