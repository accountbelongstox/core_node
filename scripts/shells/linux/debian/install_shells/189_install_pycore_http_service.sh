#!/bin/bash
# Install the Pycore Module Caller service.
#
# CONVERGENCE: this previously created a SECOND systemd unit ("pycore-module-caller",
# User=root, ExecStart=`python pycore/pycore_module_caller.py` directly) that competed with
# the canonical "pycore" unit from common/pycore_service.sh for port 59000 AND ran the worker
# with a different user + Python env (no PYTHONUSERBASE/PIP policy, no prepare step) — so
# which torch the worker imported and where packages installed depended on which installer
# was used. There must be ONE service definition, so this now DELEGATES to
# common/pycore_service.sh (unit: "pycore", ExecStart=`pyservice.sh run --no-ui --no-install`,
# real desktop user) and removes the legacy "pycore-module-caller" unit if present.

set -e

# --- Variable declarations (rule 5) -------------------------------------- #
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
PYCORE_SERVICE_HELPER="$PARENT_DIR_LEVEL_2/common/pycore_service.sh"
LEGACY_UNIT="pycore-module-caller"
SUDO=""

if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
fi

echo "Installing the Pycore Module Caller service (canonical 'pycore' unit on port 59000)..."

# Retire the legacy duplicate unit so two services don't fight over :59000 with divergent
# user/env. Safe no-op when it was never installed.
if command -v systemctl >/dev/null 2>&1 \
   && systemctl list-unit-files 2>/dev/null | grep -q "^${LEGACY_UNIT}\.service"; then
    echo "[150] Removing legacy duplicate unit '${LEGACY_UNIT}' ..."
    $SUDO systemctl stop "$LEGACY_UNIT" 2>/dev/null || true
    $SUDO systemctl disable "$LEGACY_UNIT" 2>/dev/null || true
    $SUDO rm -f "/etc/systemd/system/${LEGACY_UNIT}.service" 2>/dev/null || true
    $SUDO systemctl daemon-reload 2>/dev/null || true
fi

if [ ! -f "$PYCORE_SERVICE_HELPER" ]; then
    echo "Error: canonical service helper not found at $PYCORE_SERVICE_HELPER" >&2
    exit 1
fi

# Delegate to the single source of truth for the pycore systemd unit.
bash "$PYCORE_SERVICE_HELPER" install

echo "Installation complete (unit: pycore, port 59000)."
