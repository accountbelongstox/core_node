# -*- coding: utf-8 -*-
"""
Persisted enable flags for auxiliary heartbeat callbacks (queue monitor, WS).

When the user toggles these in the Queue Center worker strip, the choice is
stored in user_data.json and restored on the next pycore boot.
"""

from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_user_data_store
from pycore.pyheartbeat import get_heartbeat_system

_MONITOR_SECTION = "translation_monitor_auto"
_WS_SECTION = "translation_ws_auto"
_ENABLED_KEY = "enabled"

_PREFS: Dict[str, str] = {
    "translation_queue_monitor": _MONITOR_SECTION,
    "translation_ws_client": _WS_SECTION,
}


def _read_enabled(section_key: str) -> Optional[bool]:
    section = get_user_data_store().get_section(section_key)
    if section is None:
        return None
    return bool(section.get(_ENABLED_KEY, False))


def _write_enabled(section_key: str, enabled: bool) -> None:
    get_user_data_store().update_section(section_key, {_ENABLED_KEY: bool(enabled)})


def restore_persisted_heartbeat_prefs() -> None:
    """Apply saved monitor/WS toggles when sections exist."""
    heartbeat = get_heartbeat_system()
    for callback_name, section_key in _PREFS.items():
        enabled = _read_enabled(section_key)
        if enabled is None:
            continue
        try:
            if enabled:
                heartbeat.enable_callback(callback_name)
            else:
                heartbeat.disable_callback(callback_name)
            ColorPrint.blue(
                f"[HeartbeatPrefs] Restored {callback_name} enabled={enabled}"
            )
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(
                f"[HeartbeatPrefs] restore {callback_name} failed ({exc})"
            )


def apply_callback_enabled(callback_name: str, enabled: bool) -> Dict[str, Any]:
    """Persist + apply one auxiliary heartbeat callback."""
    section_key = _PREFS.get(callback_name)
    if not section_key:
        return {"ok": False, "error": f"Unknown callback: {callback_name}"}

    _write_enabled(section_key, enabled)
    heartbeat = get_heartbeat_system()
    try:
        if enabled:
            heartbeat.enable_callback(callback_name)
        else:
            heartbeat.disable_callback(callback_name)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}

    return {"ok": True, "callback_name": callback_name, "enabled": enabled}


def get_auxiliary_status() -> Dict[str, Any]:
    """Status for monitor + WS callbacks (persisted flag + live heartbeat)."""
    heartbeat = get_heartbeat_system()
    out: Dict[str, Any] = {}
    for callback_name, section_key in _PREFS.items():
        persisted = _read_enabled(section_key)
        live = False
        try:
            live = bool(heartbeat.is_callback_enabled(callback_name))
        except Exception:
            pass
        out[callback_name] = {
            "persisted": persisted,
            "enabled": live,
            "configured": persisted is not None,
        }
    return out
