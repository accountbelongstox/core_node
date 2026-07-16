#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install_launcher.sh - Prerequisite installer for the multi-terminal grid
#   launcher (pycore/pyutils/launcher: linux_terminal_launcher.py). It arranges
#   a grid of native terminals across the display and is the `launcher` autostart
#   target (python -m pycore.pyutils.launcher --mode windows). The autostart
#   `target` selection lives in pycore/callmodule/platform/autostart_target.py.
#
# Invoked sequentially by prepare_pycore_prerequisites.sh (pyservice; scripts never call siblings).
# Installs the system tools the launcher needs:
#
#     wmctrl   -> primary window positioner (preferred over xdotool)
#     xdotool  -> fallback window positioner (linux_terminal_launcher: wmctrl > xdotool)
#     tmux     -> single-window paned-grid fallback when no X11 positioner is usable
#     xterm    -> universal last-resort emulator (only installed when NONE of
#                 xfce4-terminal/gnome-terminal/konsole/qterminal/xterm is present)
#
# Debian/Ubuntu/Kali only (apt). The launcher target needs a graphical session
# ($DISPLAY / Wayland); these tools are still safe to pre-install on a box that
# gains a display later.
#
# IDEMPOTENT: each tool is skipped when already on PATH. NON-FATAL: a missing apt
# or a failed install just leaves that capability degraded (the launcher falls
# back to tmux/kitty paned grids or N separate unpositioned windows).
#
# Usage:
#   ./install_launcher.sh --python /usr/bin/python3   # --python ignored (system pkgs)
#   ./install_launcher.sh --force                     # reinstall even if present
# ---------------------------------------------------------------------------
set -uo pipefail

PYTHON="python3"
FORCE=0
SUDO=""
NEED=()
HAVE_EMULATOR=0
EMULATOR_CANDIDATES=("xfce4-terminal" "gnome-terminal" "konsole" "qterminal" "xterm" "kitty")

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="${2:-}"; shift; [ $# -gt 0 ] && shift ;;   # accepted for prepare_pycore_prerequisites.sh compat; unused (guard $2 under set -u)
        --force)  FORCE=1;     shift   ;;
        *) shift ;;                          # ignore unknown args (prepare_pycore_prerequisites.sh may pass extras)
    esac
done

echo "============================================================"
echo " Installing multi-terminal launcher prerequisites"
echo "============================================================"

if ! command -v apt-get >/dev/null 2>&1; then
    echo "[i] apt-get not found (non-Debian); skipping. Install wmctrl/xdotool/tmux + a terminal emulator manually for the grid launcher."
    exit 0
fi

# Positioners + paned engine: install any that are missing (or all when --force).
for tool in wmctrl xdotool tmux; do
    if command -v "$tool" >/dev/null 2>&1 && [[ "$FORCE" -eq 0 ]]; then
        echo "[OK] $tool already present; skipping."
    else
        NEED+=("$tool")
    fi
done

# Monitor-geometry tools used by the launcher to enumerate displays / lay out the
# grid. The binary name differs from the apt package, so use a binary:package map.
# wlr-randr (Wayland) only exists in newer repos; a failed install is non-fatal.
for map in "xrandr:x11-xserver-utils" "xdpyinfo:x11-utils" "wlr-randr:wlr-randr"; do
    geom_bin="${map%%:*}"
    geom_pkg="${map##*:}"
    if command -v "$geom_bin" >/dev/null 2>&1 && [[ "$FORCE" -eq 0 ]]; then
        echo "[OK] $geom_bin already present; skipping."
    else
        NEED+=("$geom_pkg")
    fi
done

# Emulator: the launcher needs at least one terminal emulator. Only add xterm
# (the universal last resort) when none of the known emulators is on PATH.
for emu in "${EMULATOR_CANDIDATES[@]}"; do
    if command -v "$emu" >/dev/null 2>&1; then
        HAVE_EMULATOR=1
        echo "[OK] terminal emulator present: $emu"
        break
    fi
done
if [[ "$HAVE_EMULATOR" -eq 0 ]]; then
    echo "[i] no terminal emulator found; adding xterm (universal fallback)."
    NEED+=("xterm")
fi

# On a graphical session, also ensure a nicer emulator for the grid launcher when
# none of the preferred ones is present: xfce4-terminal (lightest cross-DE) plus
# kitty (its paned-grid path). xterm above stays the guaranteed fallback. Headless
# hosts (no DISPLAY / WAYLAND_DISPLAY) skip this cleanly. Non-fatal.
if [[ -n "${DISPLAY:-}" || -n "${WAYLAND_DISPLAY:-}" ]]; then
    HAVE_PREFERRED=0
    for pref in xfce4-terminal gnome-terminal konsole qterminal kitty; do
        if command -v "$pref" >/dev/null 2>&1; then
            HAVE_PREFERRED=1
            echo "[OK] preferred terminal emulator present: $pref"
            break
        fi
    done
    if [[ "$HAVE_PREFERRED" -eq 0 ]]; then
        echo "[i] graphical session, no preferred emulator; adding xfce4-terminal + kitty."
        NEED+=("xfce4-terminal" "kitty")
    fi
else
    echo "[i] no graphical session (DISPLAY/WAYLAND_DISPLAY unset); skipping preferred-emulator install."
fi

if [[ ${#NEED[@]} -eq 0 ]]; then
    echo "[OK] launcher prerequisites already satisfied."
    exit 0
fi

if [[ "$(id -u)" -ne 0 ]]; then
    command -v sudo >/dev/null 2>&1 && SUDO="sudo"
fi

echo "[..] apt-get install: ${NEED[*]}"
$SUDO apt-get update >/dev/null 2>&1 || true
if $SUDO apt-get install -y "${NEED[@]}" >/dev/null 2>&1; then
    echo "[OK] launcher prerequisites installed: ${NEED[*]}"
else
    echo "[!] Some launcher prerequisites failed to install (${NEED[*]}); the grid launcher will degrade to available positioners/emulators."
fi

# Non-fatal by design: the service and launcher still run with whatever is present.
echo "[OK] multi-terminal launcher prerequisites complete."
exit 0
