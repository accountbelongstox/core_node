#!/bin/bash
# Window Launcher Shortcut Installer (terminal grid + apps)
#
# Creates a cross-desktop-environment shortcut (application menu + every user's
# Desktop) named "Window Launcher" - the Linux counterpart of the Windows
# "Window Launcher.lnk" desktop shortcut. Clicking it opens ONE native terminal
# running the same interactive startup menu as Windows (pycore.pyutils.launcher:
# [1] layout only, [2] pycore module only, [3] both, [M] configuration).
#
# Why a helper instead of the freedesktop Terminal=true key: the Desktop Entry
# Specification defines Terminal only as "the program runs in a terminal window"
# and deliberately leaves emulator choice to the DE (GNOME/KDE/Xfce all differ);
# the helper spawns a KNOWN emulator itself (xfce4-terminal > gnome-terminal >
# konsole > qterminal > xterm, the central TERMINAL_EMULATOR_CANDIDATES list in
# common_functions.sh, mirroring LinuxTerminalArgv.FALLBACK_EMULATORS),
# so the menu renders identically on Debian / Ubuntu / Kali, X11 or Wayland.
#
# Clipboard mouse functions: xfce4-terminal gets copy-on-select +
# right-click-paste via the real user's terminalrc (configure_terminal_mouse_functions);
# xterm gets the same via X resources baked into the helper and into every
# launcher-spawned xterm (LinuxTerminalArgv.XTERM_XRM_ARGS); gnome-terminal /
# konsole / qterminal expose copy/paste through their own context menus.
#
# Apps are launched by the launcher itself from its config.json, resolved through
# AppFinder's central-constant chain (shell gvar store -> compile_dir/applications
# -> fixed bin dirs -> PATH), so non-root desktop users never hit the pkexec /
# systemd-run --system polkit password prompts that self-elevating wrappers
# (cursor, *-rlimit system scope) would otherwise raise.
#
# IDEMPOTENT: the helper is overwritten in place, the .desktop entry is upserted by
# the shared desktop_shortcut_manager, and prerequisites are skipped when present.
# NON-FATAL: a missing tool/python only degrades the launch; install never aborts.
#
# Usage:
#   ./193_install_terminal_grid_shortcut.sh
#
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

set -o pipefail

# Script identification and path setup
SCRIPT_INDEX="193"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables and shared helpers
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/app_paths.sh"
source "$PARENT_DIR_LEVEL_2/common/desktop_shortcut_manager.sh"
source "$PARENT_DIR_LEVEL_2/common/get_real_user.sh"

# Initialize global variables (sets USE_SUDO, etc.)
init_global_vars

# ---- variable declarations (all at top) -------------------------------------
GRID_COLUMNS=4
GRID_ROWS=3
GRID_TOTAL=$((GRID_COLUMNS * GRID_ROWS))
CORE_NODE_ROOT="$CORE_NODE_ROOT_FROM_SCRIPTS"
LAUNCHER_PY="$CORE_NODE_ROOT/pycore/pyutils/launcher/launcher.py"
ICON_PATH="$CORE_NODE_ROOT/pycore/pyutils/launcher/icon.png"
HELPER_PATH="/usr/local/bin/devlauncher"
SHORTCUT_ID="window-launcher"
SHORTCUT_NAME="Window Launcher"
OLD_SHORTCUT_IDS=("pylauncher" "core-node-terminal-grid")
OLD_HELPER_PATHS=("/usr/local/bin/core-node-terminal-grid")
# Central emulator preference list (common_functions.sh), baked into the
# generated helper at install time.
EMULATOR_CANDIDATES=("${TERMINAL_EMULATOR_CANDIDATES[@]}")
PYTHON_BIN=""
SUDO=""
OLD_ID=""
EMULATOR=""
REAL_USER_NAME=""
REAL_USER_HOME=""
XFCE_CFG_DIR=""
XFCE_CFG=""
XFCE_KV=""
XFCE_KEY=""

# Privilege prefix: prefer the gvar_common-provided USE_SUDO; else derive it.
if [ -n "${USE_SUDO+x}" ]; then
    SUDO="$USE_SUDO"
elif [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
fi

# Resolve the interpreter: prefer the project venv python, fall back to python3.
if [ -x /usr/local/bin/python ]; then
    PYTHON_BIN="/usr/local/bin/python"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
else
    PYTHON_BIN="python3"
fi

# ---- functions --------------------------------------------------------------

# Install grid shortcut prerequisites inline (launcher is a separate script in the
# numbered sweep / prepare_pycore_prerequisites.sh - do not call it from here).
ensure_launcher_prerequisites() {
    for EMULATOR in "${EMULATOR_CANDIDATES[@]}"; do
        if command -v "$EMULATOR" >/dev/null 2>&1; then
            echo "[grid] terminal emulator present: $EMULATOR"
            return 0
        fi
    done
    echo "[grid] [i] no terminal emulator found; run 119_install_launcher.sh or prepare_pycore_prerequisites.sh separately."
    return 0
}

# Write the launch helper that the .desktop Exec points at. Clicking the icon must
# show the SAME interactive startup menu as the Windows console (launcher.py main):
# a desktop click has no TTY, so the helper spawns a known terminal emulator running
# ITSELF; the re-entrant copy then has a TTY and execs the launcher inline.
write_launch_helper() {
    # Header: shebang + baked configuration (expanded at install time).
    $SUDO tee "$HELPER_PATH" >/dev/null <<EOF
#!/bin/bash
# Core Node "Window Launcher" helper (generated by ${SCRIPT_INDEX}_install_terminal_grid_shortcut.sh).
# Re-run that installer to refresh. Baked configuration:
CORE_NODE_ROOT="${CORE_NODE_ROOT}"
PYTHON_BIN="${PYTHON_BIN}"
HELPER_PATH="${HELPER_PATH}"
# Baked from common_functions.sh: central emulator preference list, plus the
# xterm X resources that give it select-to-copy (CLIPBOARD) and right-click
# paste (its stock defaults do neither).
EMULATOR_CANDIDATES=(${EMULATOR_CANDIDATES[*]@Q})
XTERM_MOUSE_XRM_ARGS=(${XTERM_MOUSE_XRM_ARGS[*]@Q})
EOF
    # Body: literal logic (appended verbatim; references the vars baked above).
    $SUDO tee -a "$HELPER_PATH" >/dev/null <<'EOF'
# Behavior (Debian / Ubuntu / Kali, X11 or Wayland):
#   - Clicked from a desktop icon (no TTY): open ONE terminal emulator window
#     running the interactive launcher menu (1:1 with the Windows console menu:
#     [1] layout only, [2] pycore module only, [3] both, [M] configuration).
#   - Run from an existing terminal: exec the launcher inline (same menu).
#   - --mode/--no-pause or no display: headless passthrough (autostart path;
#     launcher.py auto-selects "both" when stdin is not a TTY).
set -o pipefail
HEADLESS=0
EMULATOR=""

case " $* " in
    *" --mode "*|*" --no-pause "*) HEADLESS=1 ;;
esac
if [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ]; then
    HEADLESS=1
fi

run_launcher() {
    cd "$CORE_NODE_ROOT" 2>/dev/null || true
    # PYCORE_SKIP_DEP_CHECK=1: importing pycore triggers third_party.py's import-time
    # dependency check (which can kick off the multi-GB torch (re)install). The launcher
    # only opens terminal windows and needs no heavy deps.
    PYCORE_SKIP_DEP_CHECK=1 PYTHONPATH="$CORE_NODE_ROOT${PYTHONPATH:+:$PYTHONPATH}" \
        exec "$PYTHON_BIN" -m pycore.pyutils.launcher "$@"
}

if [ "$HEADLESS" = "1" ] || [ -t 0 ]; then
    run_launcher "$@"
fi

# No TTY (desktop click): spawn the first available terminal emulator running this
# helper again; the inner copy gets a TTY and takes the run_launcher path above.
# A non-zero exit holds the window so an instant failure stays readable.
INNER_CMD="\"$HELPER_PATH\"; _ec=\$?; if [ \$_ec -ne 0 ]; then echo; read -r -p \"Window Launcher exited (\$_ec). Press Enter to close...\"; fi"
for EMULATOR in "${EMULATOR_CANDIDATES[@]}"; do
    command -v "$EMULATOR" >/dev/null 2>&1 || continue
    case "$EMULATOR" in
        xfce4-terminal) exec "$EMULATOR" --command="bash -lc '$INNER_CMD'" ;;
        gnome-terminal) exec "$EMULATOR" -- bash -lc "$INNER_CMD" ;;
        xterm)          exec "$EMULATOR" "${XTERM_MOUSE_XRM_ARGS[@]}" -e bash -lc "$INNER_CMD" ;;
        *)              exec "$EMULATOR" -e bash -lc "$INNER_CMD" ;;
    esac
done

echo "[window-launcher] no terminal emulator found (looked for: ${EMULATOR_CANDIDATES[*]})." >&2
echo "[window-launcher] install one, e.g.: sudo apt-get install -y gnome-terminal" >&2
exit 1
EOF
    $SUDO chmod 0755 "$HELPER_PATH" 2>/dev/null || true
    echo "[grid] Launch helper: $HELPER_PATH"
}

# Remove artifacts from the previous shortcut ids / helper paths (rename
# migrations), so re-running does not leave stale entries/helpers behind.
remove_old_artifacts() {
    for OLD_ID in "${OLD_SHORTCUT_IDS[@]}"; do
        [ "$OLD_ID" != "$SHORTCUT_ID" ] || continue
        if command -v remove_desktop_shortcut_from_desktop_shortcut_manager >/dev/null 2>&1; then
            remove_desktop_shortcut_from_desktop_shortcut_manager --id "$OLD_ID" >/dev/null 2>&1 || true
        fi
    done
    for OLD_ID in "${OLD_HELPER_PATHS[@]}"; do
        [ -e "$OLD_ID" ] && { $SUDO rm -f "$OLD_ID" 2>/dev/null || true; }
    done
}

# Enable the clipboard mouse functions for xfce4-terminal (the first-choice
# emulator) in the real user's terminalrc: copy-on-select (select-to-copy into
# CLIPBOARD) and right-click paste. xterm gets the same behavior through the
# baked X resources in the helper; gnome-terminal/konsole/qterminal provide
# copy/paste through their own context menus. Unknown keys are ignored by older
# xfce4-terminal. NON-FATAL.
configure_terminal_mouse_functions() {
    command -v xfce4-terminal >/dev/null 2>&1 || return 0
    REAL_USER_HOME="$(get_real_user_home 2>/dev/null || true)"
    [ -n "$REAL_USER_HOME" ] || return 0
    XFCE_CFG_DIR="$REAL_USER_HOME/.config/xfce4/terminal"
    XFCE_CFG="$XFCE_CFG_DIR/terminalrc"
    mkdir -p "$XFCE_CFG_DIR" 2>/dev/null || return 0
    if [ ! -f "$XFCE_CFG" ]; then
        printf '[Configuration]\nMiscCopyOnSelect=TRUE\nMiscRightClickAction=paste\n' > "$XFCE_CFG" 2>/dev/null || return 0
    else
        grep -q '^\[Configuration\]' "$XFCE_CFG" || printf '\n[Configuration]\n' >> "$XFCE_CFG"
        for XFCE_KV in "MiscCopyOnSelect=TRUE" "MiscRightClickAction=paste"; do
            XFCE_KEY="${XFCE_KV%%=*}"
            if grep -q "^${XFCE_KEY}=" "$XFCE_CFG"; then
                sed -i "s|^${XFCE_KEY}=.*|${XFCE_KV}|" "$XFCE_CFG" 2>/dev/null || true
            else
                printf '%s\n' "$XFCE_KV" >> "$XFCE_CFG"
            fi
        done
    fi
    REAL_USER_NAME="$(get_real_user 2>/dev/null || true)"
    if [ -n "$REAL_USER_NAME" ] && [ "$(id -u)" -eq 0 ] && [ "$REAL_USER_NAME" != "root" ]; then
        chown -R "$REAL_USER_NAME:$REAL_USER_NAME" "$XFCE_CFG_DIR" 2>/dev/null || true
    fi
    echo "[grid] xfce4-terminal mouse functions enabled (copy-on-select, right-click paste): $XFCE_CFG"
}

# Create (or idempotently update) the cross-DE shortcut: app menu + every user's
# Desktop. Terminal=false: the helper spawns the terminal emulator itself, so the
# DE must not wrap it again.
create_grid_shortcut() {
    local icon_arg
    if ! command -v create_desktop_shortcut_from_desktop_shortcut_manager >/dev/null 2>&1; then
        echo "[grid] desktop_shortcut_manager not loaded; skipping shortcut." >&2
        return 0
    fi
    if [ -f "$ICON_PATH" ]; then
        icon_arg="$ICON_PATH"
    else
        icon_arg="utilities-terminal"
    fi
    create_desktop_shortcut_from_desktop_shortcut_manager \
        --id "$SHORTCUT_ID" \
        --name "$SHORTCUT_NAME" \
        --generic "Developer Workspace" \
        --comment "Open the interactive launcher menu (terminal grid + apps, same as Windows)" \
        --exec "$HELPER_PATH" \
        --icon "$icon_arg" \
        --categories "System;Utility;TerminalEmulator;Development;" \
        --keywords "terminal;grid;launcher;pycore;workspace;window;${GRID_COLUMNS}x${GRID_ROWS};" \
        --desktop all
}

# ---- main -------------------------------------------------------------------
main() {
    echo "============================================================"
    echo " Installing \"$SHORTCUT_NAME\" shortcut -> $HELPER_PATH"
    echo " (click opens the interactive launcher menu in a terminal)"
    echo "============================================================"

    if [ ! -f "$LAUNCHER_PY" ]; then
        echo "[grid] Launcher module not found at $LAUNCHER_PY; nothing to do." >&2
        exit 0
    fi

    ensure_launcher_prerequisites
    remove_old_artifacts
    write_launch_helper
    configure_terminal_mouse_functions
    create_grid_shortcut

    echo "[grid] Done. Launch from the application menu or the desktop icon: \"$SHORTCUT_NAME\"."
    exit 0
}

main "$@"
