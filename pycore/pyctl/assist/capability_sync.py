# -*- coding: utf-8 -*-
"""
Sync assist_laravel capabilities to live heartbeat workers + TTS auto-start flags.

When master ``enabled`` is on and a capability is checked, the matching workers
run automatically (no separate Word/Sentence auto-start toggles required).
"""

from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
from pycore.pyctl.assist.assist_settings import assist_callback_states
from pycore.pyctl.translation.http_event_client_service import (
    translation_http_event_client,
)


# Known callbacks that are only registered on some launcher paths; their
# registrars in pycore/pyctl/tts/heartbeat.py are idempotent, so an enable can
# attach them lazily (callback name -> registrar function name).
_LAZY_REGISTRARS = {
    "tts_queue_poller": "register_tts_queue_poller",
    "tts_sentence_worker": "register_tts_sentence_worker",
}


def _toggle_callback(name: str, want: bool) -> Tuple[bool, Optional[str]]:
    """Enable/disable a heartbeat callback. Returns (ok, error_or_None)."""
    heartbeat = shared_heartbeat_system
    try:
        ok = (
            heartbeat.enable_callback(name)
            if want
            else heartbeat.disable_callback(name)
        )
        if not ok and want and name in _LAZY_REGISTRARS:
            # Known callback that this launcher path never registered — attach
            # it on demand (the registrars are idempotent) instead of leaving
            # the persisted capability half-on. Local import: pycore.pyctl.tts
            # modules import THIS module (apply_assist_runtime), so a top-level
            # import would be circular.
            from pycore.pyctl.tts import heartbeat as tts_heartbeat

            if not heartbeat.is_running():
                heartbeat.start()
            getattr(tts_heartbeat, _LAZY_REGISTRARS[name])()
            ok = heartbeat.enable_callback(name)
        if not ok:
            # Not registered while disabling is already "off" — not a failure.
            if not want:
                return True, None
            error = f"{name} is not registered — voice toggle skipped"
            ColorPrint.yellow(f"[AssistSync] {error}")
            return False, error
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
    want_word_audio = states["tts_queue_poller"]
    want_sentence_audio = states["tts_sentence_worker"]
    want_realtime = states["translation_http_event_client"]
    want_translation = enabled and bool(caps.get("translation", True))
    want_stt = enabled and bool(caps.get("stt", False))

    errors: List[str] = []
    for name, want in states.items():
        ok, error = _toggle_callback(name, want)
        if not ok and error:
            errors.append(error)

    if want_realtime:
        translation_http_event_client.supervise()
    else:
        try:
            translation_http_event_client.stop()
        except Exception as exc:  # noqa: BLE001
            errors.append(f"translation_http_event_client stop failed ({exc})")

    ColorPrint.blue(
        f"[AssistSync] runtime applied master={enabled} "
        f"translation={want_translation} word_audio={want_word_audio} "
        f"sentence_audio={want_sentence_audio} stt={want_stt}"
    )
    return {"ok": not errors, "errors": errors}
