#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Launcher-owned cross-platform auto-start manager factory.

Returns the OS-native startup manager so each platform uses its own native
mechanism (Windows: a logon scheduled task, Startup-folder .lnk as fallback;
Linux: a systemd --user unit or an XDG .desktop autostart entry). All managers share the same interface:
``is_enabled()``, ``enable()``, ``disable()``, ``toggle()``, ``get_status()``.
"""

import platform
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pylauncher.platform.autostart_target import (
    normalize_mechanism,
    read_preference,
)
from pycore.pyfoundations.system_service_state import (
    STATE_ABSENT,
    systemd_available,
    systemd_unit_enabled,
    windows_service_state,
)


PLATFORM_SYSTEM = platform.system()
SUPPORTED_PLATFORMS = ("Windows", "Linux")
# The headless system service (NSSM on Windows, systemd on Linux) installed by
# `pyservice install`; when present it already owns boot start.
PYCORE_SYSTEM_SERVICE_NAME = "pycore"

if PLATFORM_SYSTEM == "Windows":
    from pycore.pylauncher.platform.windows_startup_manager import WindowsStartupManager
elif PLATFORM_SYSTEM == "Linux":
    from pycore.pylauncher.platform.linux_startup_manager import LinuxStartupManager
    from pycore.pylauncher.platform.systemd_user_startup_manager import (
        SystemdUserStartupManager,
    )



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
    is omitted the persisted unified user setting supplies it, so callers like
    ``ensure_startup_launcher`` recover the user's last choice.
    """
    system = PLATFORM_SYSTEM
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


def _pycore_system_service_installed() -> bool:
    if PLATFORM_SYSTEM == "Windows":
        return windows_service_state(PYCORE_SYSTEM_SERVICE_NAME) != STATE_ABSENT
    return systemd_available() and systemd_unit_enabled(PYCORE_SYSTEM_SERVICE_NAME)


def ensure_startup_launcher(app_name: str = "PyCore_RPC_Server") -> str:
    """Keep pyservice registered for boot (best-effort, never raises).

    Called on every service start. Auto-start is ON by default: unless the user
    explicitly disabled it, a missing registration is created (Windows: logon
    task; Linux: systemd --user unit with linger, XDG entry as fallback) and an
    existing one is refreshed so the next boot runs the CURRENT entry point. A
    host with the ``pycore`` system service installed needs neither.
    Returns "registered", "refreshed" or "" (nothing done).
    """
    try:
        if PLATFORM_SYSTEM not in SUPPORTED_PLATFORMS:
            return ""
        pref = read_preference()
        if pref["enabled"] is False:
            return ""
        if _pycore_system_service_installed():
            return ""
        mechanism = None if pref["mechanism_chosen"] else "systemd"
        manager = get_startup_manager(app_name, mechanism=mechanism)
        if manager.is_enabled():
            return "refreshed" if manager.refresh() else ""
        result = manager.enable(start_now=False)
        if not result.get("success"):
            ColorPrint.yellow(f"[StartupManager] register auto-start failed: {result.get('message')}")
            return ""
        return "registered"
    except OSError as exc:
        ColorPrint.yellow(f"[StartupManager] ensure auto-start for {app_name} failed: {exc}")
        return ""
