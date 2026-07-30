# -*- coding: utf-8 -*-
"""Compatibility view for auxiliary callbacks owned by Assist user settings."""

from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
from pycore.pyctl.assist.assist_settings import (
    assist_callback_states,
    assist_settings_exist,
)
from pycore.pyctl.translation.http_event_client_service import (
    translation_http_event_client,
)

_AUX_CALLBACKS = (
    "translation_queue_monitor",
    "translation_http_event_client",
)


def restore_persisted_heartbeat_prefs() -> None:
    """Apply canonical Assist settings; legacy auxiliary sections are ignored."""
    heartbeat = shared_heartbeat_system
    states = assist_callback_states()
    for callback_name in _AUX_CALLBACKS:
        enabled = states[callback_name]
        try:
            if enabled:
                heartbeat.enable_callback(callback_name)
            else:
                heartbeat.disable_callback(callback_name)
            if not enabled and callback_name == "translation_http_event_client":
                translation_http_event_client.stop()
            ColorPrint.blue(
                f"[HeartbeatPrefs] Restored {callback_name} enabled={enabled}"
            )
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(
                f"[HeartbeatPrefs] restore {callback_name} failed ({exc})"
            )


def apply_callback_enabled(callback_name: str, enabled: bool) -> Dict[str, Any]:
    """Reject the retired duplicate control path; Queue Center owns lifecycle."""
    if callback_name not in _AUX_CALLBACKS:
        return {"ok": False, "error": f"Unknown callback: {callback_name}"}
    return {
        "ok": False,
        "error": "Auxiliary callbacks are derived from Queue Center user settings",
    }


def get_auxiliary_status() -> Dict[str, Any]:
    """Status for monitor + stream callbacks derived from Assist settings."""
    heartbeat = shared_heartbeat_system
    states = assist_callback_states()
    out: Dict[str, Any] = {}
    for callback_name in _AUX_CALLBACKS:
        configured = states[callback_name]
        live = False
        try:
            live = bool(heartbeat.is_callback_enabled(callback_name))
        except Exception:
            pass
        out[callback_name] = {
            "persisted": configured,
            "enabled": live,
            "configured": assist_settings_exist(),
        }
    return out
