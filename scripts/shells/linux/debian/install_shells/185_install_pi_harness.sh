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

SCRIPT_INDEX="141"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
LINUX_SHELLS_DIR="$(dirname "$PARENT_DIR_LEVEL_2")"
SHELLS_DIR="$(dirname "$LINUX_SHELLS_DIR")"
HARNESS_SETTINGS_SCRIPT="$SHELLS_DIR/common/pi_harness_settings.js"
PI_PACKAGE="@earendil-works/pi-coding-agent"
BUN_INSTALLER_URL="https://bun.com/install"
OMP_INSTALLER_URL="https://omp.sh/install"
TARGET_USER=""
TARGET_HOME=""
PI_BIN=""
PI_LINK="/usr/local/bin/pi"
OMP_INSTALL_DIR=""
OMP_BIN=""
OMP_LINK="/usr/local/bin/omp"
OMP_COMMAND=""
OMP_INSTALLER_PATH=""
BUN_INSTALLER_PATH=""
BUN_COMMAND=""
BUN_LINK="/usr/local/bin/bun"
KIMI_CODE_HOME_PATH=""
KIMI_SKILLS_PATH=""
DOWNLOAD_READY=0
DOWNLOAD_SOURCE_URL=""
DOWNLOAD_TARGET_PATH=""

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

TARGET_USER="${ACTUAL_DESKTOP_USER:-${SUDO_USER:-${USER:-$(id -un)}}}"
TARGET_HOME="$(getent passwd "$TARGET_USER" 2>/dev/null | cut -d: -f6)"
TARGET_HOME="${TARGET_HOME:-$HOME}"
PI_BIN="$PNPM_GLOBAL_BIN_DIR/pi"
OMP_INSTALL_DIR="$COMPILE_DIR/omp"
OMP_BIN="$OMP_INSTALL_DIR/omp"
OMP_INSTALLER_PATH="$OMP_INSTALL_DIR/install.sh"
BUN_INSTALLER_PATH="$BUN_INSTALL_DIR/install.sh"
KIMI_CODE_HOME_PATH="${KIMI_CODE_HOME:-$TARGET_HOME/.kimi-code}"
KIMI_SKILLS_PATH="$KIMI_CODE_HOME_PATH/skills"

run_as_target_user() {
    if [ "$(id -u)" -eq 0 ] && [ "$TARGET_USER" != "root" ]; then
        $USE_SUDO -u "$TARGET_USER" env HOME="$TARGET_HOME" "$@"
    else
        HOME="$TARGET_HOME" "$@"
    fi
}

download_file() {
    DOWNLOAD_SOURCE_URL="$1"
    DOWNLOAD_TARGET_PATH="$2"

    DOWNLOAD_READY=0
    if command -v curl >/dev/null 2>&1; then
        $USE_SUDO curl -fsSL "$DOWNLOAD_SOURCE_URL" -o "$DOWNLOAD_TARGET_PATH"
    elif command -v wget >/dev/null 2>&1; then
        $USE_SUDO wget -qO "$DOWNLOAD_TARGET_PATH" "$DOWNLOAD_SOURCE_URL"
    else
        echo "[$SCRIPT_INDEX] WARNING: curl or wget is required."
    fi
    if [ -s "$DOWNLOAD_TARGET_PATH" ]; then
        DOWNLOAD_READY=1
    fi
}

install_bun_prerequisite() {
    BUN_COMMAND="$BUN_BIN"
    if [ ! -x "$BUN_COMMAND" ] && [ -x "$BUN_LINK" ]; then
        BUN_COMMAND="$BUN_LINK"
    fi

    if [ -x "$BUN_COMMAND" ]; then
        echo "[$SCRIPT_INDEX] Bun is already installed: $BUN_COMMAND"
    else
        echo "[$SCRIPT_INDEX] Installing Bun for the OMP JavaScript worker..."
        $USE_SUDO mkdir -p "$BUN_INSTALL_DIR"
        if ! command -v curl >/dev/null 2>&1; then
            $USE_SUDO apt-get update
            $USE_SUDO apt-get install -y curl
        fi
        if ! command -v unzip >/dev/null 2>&1; then
            $USE_SUDO apt-get update
            $USE_SUDO apt-get install -y unzip
        fi
        download_file "$BUN_INSTALLER_URL" "$BUN_INSTALLER_PATH"
        if [ "$DOWNLOAD_READY" -eq 1 ]; then
            $USE_SUDO env HOME="$BUN_INSTALL_DIR" BUN_INSTALL="$BUN_INSTALL_DIR" bash "$BUN_INSTALLER_PATH"
        fi
    fi

    if [ -x "$BUN_BIN" ]; then
        $USE_SUDO ln -sf "$BUN_BIN" "$BUN_LINK"
        echo "[$SCRIPT_INDEX] Bun binary linked at $BUN_LINK."
    elif [ -x "$BUN_LINK" ]; then
        echo "[$SCRIPT_INDEX] Bun binary is ready: $BUN_LINK"
    else
        echo "[$SCRIPT_INDEX] WARNING: Bun binary is still missing; installation will retry next run."
    fi
}

install_pi_harness() {
    if [ -x "$PI_BIN" ] || [ -x "$PI_LINK" ]; then
        echo "[$SCRIPT_INDEX] Pi is already installed."
    elif [ ! -x "$PNPM_BIN" ]; then
        echo "[$SCRIPT_INDEX] WARNING: pnpm is unavailable. Run 16_install_node_24.sh first."
    else
        echo "[$SCRIPT_INDEX] Installing Pi with pnpm from the official package..."
        $USE_SUDO "$PNPM_BIN" add --global --ignore-scripts "$PI_PACKAGE"
    fi

    if [ -x "$PI_BIN" ]; then
        $USE_SUDO ln -sf "$PI_BIN" "$PI_LINK"
        echo "[$SCRIPT_INDEX] Pi binary linked at $PI_LINK."
    elif [ ! -x "$PI_LINK" ]; then
        echo "[$SCRIPT_INDEX] WARNING: Pi binary is still missing; installation will retry next run."
    fi
}

install_omp_harness() {
    if [ -x "$OMP_BIN" ] || [ -x "$OMP_LINK" ]; then
        echo "[$SCRIPT_INDEX] OMP is already installed."
    else
        echo "[$SCRIPT_INDEX] Installing OMP from the official binary installer..."
        $USE_SUDO mkdir -p "$OMP_INSTALL_DIR"
        download_file "$OMP_INSTALLER_URL" "$OMP_INSTALLER_PATH"
        if [ "$DOWNLOAD_READY" -eq 1 ]; then
            $USE_SUDO env PI_INSTALL_DIR="$OMP_INSTALL_DIR" BUN_INSTALL="$BUN_INSTALL_DIR" sh "$OMP_INSTALLER_PATH" --binary
        fi
    fi

    if [ -x "$OMP_BIN" ]; then
        $USE_SUDO ln -sf "$OMP_BIN" "$OMP_LINK"
        echo "[$SCRIPT_INDEX] OMP binary linked at $OMP_LINK."
    elif [ ! -x "$OMP_LINK" ]; then
        echo "[$SCRIPT_INDEX] WARNING: OMP binary is still missing; installation will retry next run."
    fi

    OMP_COMMAND="$OMP_BIN"
    if [ ! -x "$OMP_COMMAND" ] && [ -x "$OMP_LINK" ]; then
        OMP_COMMAND="$OMP_LINK"
    fi
}

merge_omp_settings() {
    if { [ -x "$OMP_BIN" ] || [ -x "$OMP_LINK" ]; } && [ -x "$NODE_BIN" ] && [ -d "$KIMI_CODE_HOME_PATH" ]; then
        run_as_target_user "$NODE_BIN" "$HARNESS_SETTINGS_SCRIPT" omp "$OMP_COMMAND" "$KIMI_SKILLS_PATH"
        echo "[$SCRIPT_INDEX] OMP Kimi skill compatibility settings merged."
    fi
}

echo "[$SCRIPT_INDEX] Installing Pi and OMP coding harnesses..."
install_bun_prerequisite
install_pi_harness
install_omp_harness
merge_omp_settings
echo "[$SCRIPT_INDEX] OMP automatically discovers Claude, Codex, and AGENTS.md providers."
echo "[$SCRIPT_INDEX] Pi harness installation step completed."
