"""Monitoring related configuration objects."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class MonitoringPreferences:
    """Settings controlling the behaviour of the monitoring subsystem."""

    idle_timeout_seconds: float = 30.0
    rescan_interval_seconds: float = 30.0
    enable_keyboard_activity: bool = False
    config_path: Path | None = None

    @classmethod
    def from_dict(cls, payload: dict | None = None) -> "MonitoringPreferences":
        if not payload:
            return cls()

        return cls(
            idle_timeout_seconds=float(payload.get("idle_timeout_seconds", cls.idle_timeout_seconds)),
            rescan_interval_seconds=float(payload.get("rescan_interval_seconds", cls.rescan_interval_seconds)),
            enable_keyboard_activity=bool(payload.get("enable_keyboard_activity", cls.enable_keyboard_activity)),
            config_path=Path(payload["config_path"]).expanduser().resolve()
            if payload.get("config_path")
            else None,
        )
