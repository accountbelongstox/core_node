# -*- coding: utf-8 -*-
"""
Machine-unique identifiers (stdlib only).

Two scopes:
  get_machine_id()          -- OS installation (MachineGuid / /etc/machine-id).
                               Stable across reboots on the same OS install; differs
                               between Windows and Linux on dual-boot hardware.
  get_hardware_machine_id() -- SMBIOS product UUID (firmware). Same physical machine
                               yields the same id on Windows and Linux when firmware
                               exposes a valid UUID. Falls back to get_machine_id()
                               when SMBIOS is missing or placeholder (some VMs).
"""
import hashlib
import platform
import re
import subprocess
import sys
import uuid
from typing import Optional

_INVALID_SMBIOS_UUIDS = frozenset({
    "00000000-0000-0000-0000-000000000000",
    "ffffffff-ffff-ffff-ffff-ffffffffffff",
})
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)


def _normalize_uuid(value: str) -> str:
    return value.strip().lower()


def _is_valid_smbios_uuid(value: Optional[str]) -> bool:
    if not value:
        return False
    norm = _normalize_uuid(value)
    if norm in _INVALID_SMBIOS_UUIDS:
        return False
    if norm.replace("-", "") == "0" * 32:
        return False
    return bool(_UUID_RE.match(norm))


def _digest(prefix: str, raw: str) -> str:
    return hashlib.sha256(f"{prefix}{raw}".encode("utf-8", errors="replace")).hexdigest()


def _fallback_node_mac() -> str:
    return f"{platform.node()}|{uuid.getnode()}"


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


def _subprocess_no_window() -> int:
    return subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0


def _windows_smbios_uuid() -> Optional[str]:
    """SMBIOS product UUID via wmic (Win32_ComputerSystemProduct.UUID)."""
    try:
        if sys.platform != "win32":
            return None
        out = subprocess.run(
            ["wmic", "csproduct", "get", "uuid"],
            capture_output=True,
            text=True,
            timeout=10,
            creationflags=_subprocess_no_window(),
        )
        if out.returncode != 0 or not out.stdout:
            return None
        lines = [l.strip() for l in out.stdout.splitlines()
                 if l.strip() and l.strip().lower() != "uuid"]
        return lines[0] if lines else None
    except Exception:
        return None


def _linux_smbios_uuid() -> Optional[str]:
    """SMBIOS product UUID from sysfs (same source as dmidecode -s system-uuid)."""
    if not sys.platform.startswith("linux"):
        return None
    for path in ("/sys/class/dmi/id/product_uuid",
                 "/sys/devices/virtual/dmi/id/product_uuid"):
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                value = (fh.read() or "").strip()
                if value:
                    return value
        except Exception:
            continue
    return None


def _macos_smbios_uuid() -> Optional[str]:
    """SMBIOS hardware UUID via ioreg (IOPlatformUUID)."""
    try:
        if sys.platform != "darwin":
            return None
        out = subprocess.run(
            ["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if out.returncode != 0 or not out.stdout:
            return None
        for line in out.stdout.splitlines():
            if "IOPlatformUUID" not in line:
                continue
            parts = line.split('"')
            if len(parts) >= 2:
                return parts[-2].strip()
        return None
    except Exception:
        return None


def _read_smbios_product_uuid() -> Optional[str]:
    if sys.platform == "win32":
        return _windows_smbios_uuid()
    if sys.platform.startswith("linux"):
        return _linux_smbios_uuid()
    if sys.platform == "darwin":
        return _macos_smbios_uuid()
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
    OS-installation id (hex SHA256).

    Windows: Registry MachineGuid, then SMBIOS UUID; Linux: /etc/machine-id.
    Fallback: hostname + MAC node id.
    """
    raw: Optional[str] = None
    if sys.platform == "win32":
        raw = _windows_machine_guid() or _windows_smbios_uuid()
    elif sys.platform.startswith("linux"):
        raw = _linux_machine_id()
    if not raw:
        raw = _fallback_node_mac()
    return _digest("", raw)


def get_hardware_machine_id() -> str:
    """
    Cross-platform hardware id from SMBIOS product UUID (hex SHA256).

    Dual-boot: same firmware UUID on Windows and Linux yields the same digest.
    VM clones may share the same SMBIOS UUID (mirror of MachineGuid clone issue).
    When SMBIOS is unavailable or placeholder, falls back to get_machine_id().
    """
    raw = _read_smbios_product_uuid()
    if raw and _is_valid_smbios_uuid(raw):
        return _digest("smbios:", _normalize_uuid(raw))
    return get_machine_id()


__all__ = ["get_machine_id", "get_hardware_machine_id"]
