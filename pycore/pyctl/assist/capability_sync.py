# -*- coding: utf-8 -*-
"""
Sync assist_laravel capabilities to live heartbeat workers.

Exchange-hub note (FIX_20260802_UI_EXCHANGE_HUB_ARCHITECTURE.md): the queue
workers (translation / TTS word / TTS sentence) no longer run pycore-side pull
loops — the UI pump dispatches tasks to pycore over RPC — so their former
heartbeat callbacks are gone. Toggling one of those names is a harmless no-op;
any remaining registered callbacks still toggle normally.
"""

from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
from pycore.pyctl.assist.assist_settings import assist_callback_states


def _toggle_callback(name: str, want: bool) -> Tuple[bool, Optional[str]]:
    """Enable/disable a heartbeat callback. Returns (ok, error_or_None).

    An unregistered callback is not an failure in either direction: disabling
    is already "off", and the retired queue-worker callbacks no longer exist
    (their lifecycle moved to the UI task pump).
    """
    heartbeat = shared_heartbeat_system
    try:
        ok = (
            heartbeat.enable_callback(name)
            if want
            else heartbeat.disable_callback(name)
        )
        if not ok:
            if not want:
                return True, None
            ColorPrint.blue(f"[AssistSync] {name} not registered — skipped (pump-driven)")
            return True, None
        ColorPrint.blue(f"[AssistSync] {name} {'enabled' if want else 'disabled'}")
        return True, None
    except Exception as exc:  # noqa: BLE001
        error = f"{name} toggle failed ({exc})"
        ColorPrint.yellow(f"[AssistSync] {error}")
        return False, error


def apply_assist_runtime(config: Dict[str, Any]) -> Dict[str, Any]:
    """Apply assist config to all related heartbeat callbacks.

    Returns ``{"ok": bool, "errors": [...]}`` so callers can surface heartbeat
    registration failures instead of treating a yellow log as success.
    """
    enabled = bool(config.get("enabled"))
    caps = config.get("capabilities") if isinstance(config.get("capabilities"), dict) else {}
    states = assist_callback_states(config)
    want_word_audio = states.get("tts_queue_poller", False)
    want_sentence_audio = states.get("tts_sentence_worker", False)
    want_translation = enabled and bool(caps.get("translation", True))
    want_stt = enabled and bool(caps.get("stt", False))

    errors: List[str] = []
    for name, want in states.items():
        ok, error = _toggle_callback(name, want)
        if not ok and error:
            errors.append(error)

    ColorPrint.blue(
        f"[AssistSync] runtime applied master={enabled} "
        f"translation={want_translation} word_audio={want_word_audio} "
        f"sentence_audio={want_sentence_audio} stt={want_stt}"
    )
    return {"ok": not errors, "errors": errors}
