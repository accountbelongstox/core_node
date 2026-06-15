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


def get_startup_manager(app_name: str = "PyCore_RPC_Server"):
    """Return the native startup manager for the current OS."""
    system = platform.system()
    if system == "Windows":
        from pycore.callmodule.platform.windows_startup_manager import WindowsStartupManager
        return WindowsStartupManager(app_name)
    if system == "Linux":
        from pycore.callmodule.platform.linux_startup_manager import LinuxStartupManager
        return LinuxStartupManager(app_name)
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
