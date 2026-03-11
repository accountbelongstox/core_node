# -*- coding: utf-8 -*-
"""
Machine-unique identifier for binding secrets to the current machine.

Provides a stable, reproducible value derived from hardware/OS so that
encrypted data can only be decrypted on the same machine.
Uses only stdlib; no third-party deps.
"""
import hashlib
import platform
import subprocess
import sys
import uuid
from typing import Optional


def _windows_machine_guid() -> Optional[str]:
    """Read MachineGuid from Windows registry (stable across reboots)."""
    try:
        if sys.platform != "win32":
            return None
        import winreg
        key = winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\Cryptography",
            0,
            winreg.KEY_READ
        )
        guid, _ = winreg.QueryValueEx(key, "MachineGuid")
        winreg.CloseKey(key)
        return (guid or "").strip()
    except Exception:
        return None


def _windows_wmic_uuid() -> Optional[str]:
    """Fallback: UUID from wmic csproduct (Windows)."""
    try:
        if sys.platform != "win32":
            return None
        out = subprocess.run(
            ["wmic", "csproduct", "get", "uuid"],
            capture_output=True,
            text=True,
            timeout=10,
            creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
        )
        if out.returncode != 0 or not out.stdout:
            return None
        lines = [l.strip() for l in out.stdout.splitlines() if l.strip() and l.strip().lower() != "uuid"]
        return lines[0] if lines else None
    except Exception:
        return None


def _linux_machine_id() -> Optional[str]:
    """Read machine-id from /etc/machine-id or /var/lib/dbus/machine-id."""
    for path in ("/etc/machine-id", "/var/lib/dbus/machine-id"):
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                mid = (f.read() or "").strip()
                if mid:
                    return mid
        except Exception:
            continue
    return None


def get_machine_id() -> str:
    """
    Return a stable, machine-unique string (hex digest).

    Prefer: Windows Registry MachineGuid, then wmic UUID; Linux /etc/machine-id.
    Fallback: SHA256(platform.node() + str(uuid.getnode())) so the same machine
    yields the same id across runs.
    """
    raw: Optional[str] = None
    if sys.platform == "win32":
        raw = _windows_machine_guid() or _windows_wmic_uuid()
    elif sys.platform.startswith("linux"):
        raw = _linux_machine_id()
    if not raw:
        raw = f"{platform.node()}|{uuid.getnode()}"
    return hashlib.sha256(raw.encode("utf-8", errors="replace")).hexdigest()


__all__ = ["get_machine_id"]
