# -*- coding: utf-8 -*-
"""
Sync assist_laravel capabilities to live heartbeat workers + TTS auto-start flags.

When master ``enabled`` is on and a capability is checked, the matching workers
run automatically (no separate Word/Sentence auto-start toggles required).
"""

from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_user_data_store
from pycore.pyheartbeat import get_heartbeat_system


def _toggle_callback(name: str, want: bool) -> Tuple[bool, Optional[str]]:
    """Enable/disable a heartbeat callback. Returns (ok, error_or_None)."""
    heartbeat = get_heartbeat_system()
    try:
        ok = (
            heartbeat.enable_callback(name)
            if want
            else heartbeat.disable_callback(name)
        )
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


def _mirror_auto_start(section: str, enabled: bool) -> None:
    """Keep one worker's persisted auto-start flag aligned with Assist."""
    store = get_user_data_store()
    try:
        current = store.get_section(section) or {}
        current["auto_start"] = bool(enabled)
        store.set_section(section, current)
    except Exception:  # noqa: BLE001
        pass


def apply_assist_runtime(config: Dict[str, Any]) -> Dict[str, Any]:
    """Apply assist config to all related heartbeat callbacks.

    Returns ``{"ok": bool, "errors": [...]}`` so callers can surface heartbeat
    registration failures instead of treating a yellow log as success.
    """
    enabled = bool(config.get("enabled"))
    caps = config.get("capabilities") if isinstance(config.get("capabilities"), dict) else {}

    want_translation = enabled and bool(caps.get("translation", True))
    want_ai_translate = enabled and bool(caps.get("ai_translate", True))
    want_word_audio = enabled and bool(caps.get("tts", True))
    want_sentence_audio = enabled and bool(caps.get("sentence_audio", True))
    want_subtitle = enabled and bool(caps.get("subtitle", False))
    want_stt = enabled and bool(caps.get("stt", False))
    want_translation_worker = (
        want_translation or want_ai_translate or want_subtitle or want_stt
    )
    want_realtime = (
        want_translation_worker or want_word_audio or want_sentence_audio
    )

    errors: List[str] = []
    toggles = (
        ("translation_worker", want_translation_worker),
        ("translation_queue_monitor", want_translation or want_ai_translate),
        ("translation_ws_client", want_realtime),
        ("tts_queue_poller", want_word_audio),
        ("tts_sentence_worker", want_sentence_audio),
        ("subtitle_search_worker", want_subtitle),
    )
    for name, want in toggles:
        ok, error = _toggle_callback(name, want)
        if not ok and error:
            errors.append(error)

    _mirror_auto_start("word_tts_auto", want_word_audio)
    _mirror_auto_start("sentence_audio_auto", want_sentence_audio)

    ColorPrint.blue(
        f"[AssistSync] runtime applied master={enabled} "
        f"translation={want_translation} word_audio={want_word_audio} "
        f"sentence_audio={want_sentence_audio} stt={want_stt}"
    )
    return {"ok": not errors, "errors": errors}
