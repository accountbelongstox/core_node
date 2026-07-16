#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cross-platform auto-start (boot/login) manager factory.

Returns the OS-native startup manager so each platform uses its own native
mechanism (Windows: a .lnk shortcut in the common Startup folder; Linux: an XDG
.desktop autostart entry). All managers share the same interface:
``is_enabled()``, ``enable()``, ``disable()``, ``toggle()``, ``get_status()``.
"""

import platform

from pycore.callmodule.platform.windows_startup_manager import WindowsStartupManager
from pycore.callmodule.platform.autostart_target import read_preference, normalize_mechanism
from pycore.callmodule.platform.systemd_user_startup_manager import SystemdUserStartupManager
from pycore.callmodule.platform.linux_startup_manager import LinuxStartupManager



class _UnsupportedStartupManager:
    """No-op manager for platforms without an implemented native mechanism."""

    def __init__(self, system: str):
        self._system = system or "unknown"

    def is_enabled(self) -> bool:
        return False

    def _unsupported(self) -> dict:
        return {"success": False, "enabled": False, "supported": False,
                "platform": self._system.lower(),
                "message": f"Auto-start is not supported on {self._system}."}

    def enable(self) -> dict:
        return self._unsupported()

    def disable(self) -> dict:
        return self._unsupported()

    def toggle(self) -> dict:
        return self._unsupported()

    def refresh(self) -> bool:
        return False

    def get_status(self) -> dict:
        return {"enabled": False, "supported": False,
                "platform": self._system.lower(),
                "message": f"Auto-start is not supported on {self._system}."}


def get_startup_manager(app_name: str = "PyCore_RPC_Server", target=None, mechanism=None):
    """Return the native startup manager for the current OS.

    ``target`` (pyservice/launcher/both) chooses WHAT auto-start launches;
    ``mechanism`` (Linux only: xdg/systemd) chooses HOW it registers. When either
    is omitted the persisted preference (target.json) supplies it, so callers like
    ``refresh_startup_launcher`` (no args) recover the user's last choice.
    """
    system = platform.system()
    if system == "Windows":
        return WindowsStartupManager(app_name, target=target)
    if system == "Linux":
        mech = normalize_mechanism(mechanism if mechanism is not None else read_preference()["mechanism"])
        if mech == "systemd":
            mgr = SystemdUserStartupManager(app_name, target=target)
            if mgr.is_supported():
                return mgr
        return LinuxStartupManager(app_name, target=target, mechanism="xdg")
    return _UnsupportedStartupManager(system)


def refresh_startup_launcher(app_name: str = "PyCore_RPC_Server") -> bool:
    """Self-heal the auto-start launcher script (best-effort, never raises).

    If auto-start is enabled, regenerate the fixed launcher script so the next
    boot runs the CURRENT canonical entry point (pyservice.ps1 / pyservice.sh =
    dashboard UI dev server + worker). This upgrades launchers written by older
    versions (which launched the bare worker only, so the boot-mode UI never
    started) without the user toggling auto-start off and on. Called on every
    service start; returns True if the script was rewritten.
    """
    try:
        return bool(get_startup_manager(app_name).refresh())
    except Exception:
        return False
