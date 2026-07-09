#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
System Service Manager - install/remove the SYSTEM systemd units for pycore and
its dashboard UI (ncore-nexus-dash), reusing the existing shell helpers.

This complements :class:`SystemdUserStartupManager` (a per-user auto-start unit)
by managing the canonical SYSTEM units the dd.sh installer chain creates:

    pycore              <- scripts/shells/linux/common/pycore_service.sh
    ncore-nexus-dash    <- poly_apps/pycore_laravel_wordflow_ui/scripts/start.sh

It is the backend for the tray "Run as system service" toggle on Linux: enabling
installs BOTH units (pycore headless worker + the dashboard UI); disabling
removes ONLY the pycore unit and leaves the UI unit untouched (but prints the
exact command to remove the UI unit too, so the user is never left guessing).

All subprocess calls are guarded; nothing here raises. System units need root,
so commands are run via ``sudo`` when the current process is not root.
"""

import os
import shutil
import subprocess
from pathlib import Path

from pycore import ColorPrint

# This file lives at pycore/callmodule/platform/system_service_manager.py, so the
# repo root is 4 parents up.
REPO_ROOT = Path(__file__).resolve().parents[3]
PYCORE_SERVICE_SH = REPO_ROOT / "scripts" / "shells" / "linux" / "common" / "pycore_service.sh"
UI_START_SH = REPO_ROOT / "poly_apps" / "pycore_laravel_wordflow_ui" / "scripts" / "start.sh"

PYCORE_UNIT = "pycore"
UI_UNIT = "ncore-nexus-dash"


def _is_root() -> bool:
    return hasattr(os, "geteuid") and os.geteuid() == 0


def _sudo_prefix():
    """Return ['sudo'] when not root and sudo exists, else [] (already root)."""
    if _is_root():
        return []
    if shutil.which("sudo") is not None:
        return ["sudo"]
    return []


def _run(args, timeout=60):
    """Run a command (captured), never raises. Returns CompletedProcess or None."""
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    except Exception:
        return None


def _run_shell(script_path: Path, script_args, timeout=300):
    """Run one of the repo's service shell scripts (root via sudo when needed).

    The scripts already self-elevate internally, but prefixing sudo here lets them
    run as root directly so their inner $USE_SUDO no-ops and SUDO_USER is set for
    pycore_resolve_user() to pick the real desktop user.
    """
    if not script_path.exists():
        return None
    cmd = _sudo_prefix() + ["bash", str(script_path)] + list(script_args)
    return _run(cmd, timeout=timeout)


def is_supported() -> bool:
    """True on Linux with systemctl available (system units are a Linux concept)."""
    if shutil.which("systemctl") is None:
        return False
    return os.path.exists("/run/systemd/system")


def unit_is_enabled(unit: str) -> bool:
    res = _run(["systemctl", "is-enabled", unit], timeout=10)
    if res is None or res.returncode != 0:
        return False
    return (res.stdout or "").strip() == "enabled"


def unit_is_active(unit: str) -> bool:
    res = _run(["systemctl", "is-active", "--quiet", unit], timeout=10)
    return res is not None and res.returncode == 0


def pycore_service_enabled() -> bool:
    return unit_is_enabled(PYCORE_UNIT)


def pycore_service_active() -> bool:
    return unit_is_active(PYCORE_UNIT)


def ui_service_active() -> bool:
    return unit_is_active(UI_UNIT)


def install_pycore_service() -> dict:
    """Install + enable + start the pycore system unit (headless worker)."""
    res = _run_shell(PYCORE_SERVICE_SH, ["install"], timeout=300)
    ok = res is not None and res.returncode == 0
    out = ((res.stdout or "") + (res.stderr or "")) if res else ""
    if not ok and not pycore_service_enabled():
        ColorPrint.red(f"[ServiceManager] pycore install failed:\n{out}")
    return {
        "success": ok or pycore_service_enabled(),
        "unit": PYCORE_UNIT,
        "enabled": pycore_service_enabled(),
        "active": pycore_service_active(),
        "output": out,
    }


def uninstall_pycore_service() -> dict:
    """Stop + disable + remove ONLY the pycore unit. The UI unit is left alone."""
    res = _run_shell(PYCORE_SERVICE_SH, ["uninstall"], timeout=120)
    out = ((res.stdout or "") + (res.stderr or "")) if res else ""
    ok = not pycore_service_enabled()
    return {
        "success": ok,
        "unit": PYCORE_UNIT,
        "enabled": pycore_service_enabled(),
        "active": pycore_service_active(),
        "output": out,
    }


def install_ui_service() -> dict:
    """Install + enable + start the ncore-nexus-dash UI unit (dev server).

    Delegates to the wordflow UI start.sh with --service --no-backend --dev so it
    registers ONLY the frontend unit (laravel_main backend is a separate unit and
    is not touched here). Idempotent: node/pnpm deps are ensured in place.
    """
    res = _run_shell(UI_START_SH, ["--service", "--no-backend", "--dev"], timeout=600)
    ok = res is not None and res.returncode == 0
    out = ((res.stdout or "") + (res.stderr or "")) if res else ""
    if not ok and not unit_is_enabled(UI_UNIT):
        ColorPrint.red(f"[ServiceManager] UI install failed:\n{out}")
    return {
        "success": ok or unit_is_enabled(UI_UNIT),
        "unit": UI_UNIT,
        "enabled": unit_is_enabled(UI_UNIT),
        "active": ui_service_active(),
        "output": out,
    }


def ui_unit_remove_command() -> str:
    """The exact shell command to remove the UI unit (printed when the user
    disables pycore but the UI unit is left running, per the tray-toggle spec)."""
    unit_file = f"/etc/systemd/system/{UI_UNIT}.service"
    return (
        f"sudo systemctl disable --now {UI_UNIT} && "
        f"sudo rm -f {unit_file} && sudo systemctl daemon-reload"
    )


def enable_both() -> dict:
    """Tray-toggle ON: install pycore AND the UI unit. Returns a combined result."""
    ColorPrint.blue("[ServiceManager] Installing pycore + UI system services ...")
    py = install_pycore_service()
    ui = install_ui_service()
    return {
        "success": py.get("enabled") and ui.get("enabled"),
        "pycore": py,
        "ui": ui,
        "ui_remove_command": ui_unit_remove_command(),
    }


def disable_pycore_only() -> dict:
    """Tray-toggle OFF: remove ONLY pycore; leave the UI unit running, but surface
    its removal command so the user can clean it up explicitly."""
    ColorPrint.blue("[ServiceManager] Removing pycore system service (UI left untouched) ...")
    py = uninstall_pycore_service()
    ui_still_active = ui_service_active()
    if ui_still_active:
        ColorPrint.yellow(
            f"[ServiceManager] UI service '{UI_UNIT}' is still running/enabled. "
            "pycore was removed but the UI was NOT. To remove the UI too:"
        )
        ColorPrint.yellow(f"    {ui_unit_remove_command()}")
    return {
        "success": py.get("success"),
        "pycore": py,
        "ui_unit": UI_UNIT,
        "ui_left_running": ui_still_active,
        "ui_remove_command": ui_unit_remove_command() if ui_still_active else "",
    }
