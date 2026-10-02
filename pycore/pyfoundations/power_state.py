# -*- coding: utf-8 -*-
"""Battery state shared library: psutil first, /sys/class/power_supply fallback."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from pycore.pyfoundations.third_party.api import get_third_package_psutil

POWER_SUPPLY_DIR = Path("/sys/class/power_supply")
SUPPLY_TYPE_FILE = "type"
SUPPLY_TYPE_BATTERY = "battery"
SUPPLY_SCOPE_FILE = "scope"
SUPPLY_SCOPE_DEVICE = "device"
SUPPLY_CAPACITY_FILE = "capacity"
SUPPLY_STATUS_FILE = "status"
STATUS_DISCHARGING = "discharging"
MAX_PERCENT = 100.0


@dataclass(frozen=True)
class PowerState:
    percent: float
    plugged: bool
    present: bool

    @property
    def discharging(self) -> bool:
        return self.present and not self.plugged

    def at_or_below(self, percent: float) -> bool:
        return self.discharging and self.percent <= percent


NO_BATTERY = PowerState(percent=MAX_PERCENT, plugged=True, present=False)


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def _psutil_state() -> Optional[PowerState]:
    try:
        battery = get_third_package_psutil().sensors_battery()
    except Exception:  # noqa: BLE001 - psutil raises platform-specific errors
        return None
    if battery is None:
        return None
    plugged = battery.power_plugged
    return PowerState(
        percent=float(battery.percent),
        plugged=True if plugged is None else bool(plugged),
        present=True,
    )


def _sysfs_state() -> Optional[PowerState]:
    try:
        supplies = sorted(POWER_SUPPLY_DIR.iterdir())
    except OSError:
        return None
    for supply in supplies:
        if _read_text(supply / SUPPLY_TYPE_FILE).lower() != SUPPLY_TYPE_BATTERY:
            continue
        if _read_text(supply / SUPPLY_SCOPE_FILE).lower() == SUPPLY_SCOPE_DEVICE:
            continue
        capacity = _read_text(supply / SUPPLY_CAPACITY_FILE)
        if not capacity.isdigit():
            continue
        status = _read_text(supply / SUPPLY_STATUS_FILE).lower()
        return PowerState(
            percent=float(capacity),
            plugged=status != STATUS_DISCHARGING,
            present=True,
        )
    return None


def read_power_state() -> PowerState:
    return _psutil_state() or _sysfs_state() or NO_BATTERY


__all__ = ["NO_BATTERY", "PowerState", "read_power_state"]
