# -*- coding: utf-8 -*-
"""
Sync assist_laravel capabilities to live heartbeat workers + TTS auto-start flags.

When master ``enabled`` is on and a capability is checked, the matching workers
run automatically (no separate Word/Sentence auto-start toggles required).
"""

from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_user_data_store
from pycore.pyheartbeat import get_heartbeat_system


def _toggle_callback(name: str, want: bool) -> None:
    heartbeat = get_heartbeat_system()
    try:
        ok = (
            heartbeat.enable_callback(name)
            if want
            else heartbeat.disable_callback(name)
        )
        if not ok:
            ColorPrint.yellow(
                f"[AssistSync] {name} is not registered — voice toggle skipped"
            )
            return
        ColorPrint.blue(f"[AssistSync] {name} {'enabled' if want else 'disabled'}")
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AssistSync] {name} toggle failed ({exc})")


def _mirror_auto_start(section: str, enabled: bool) -> None:
    """Keep one worker's persisted auto-start flag aligned with Assist."""
    store = get_user_data_store()
    try:
        current = store.get_section(section) or {}
        current["auto_start"] = bool(enabled)
        store.set_section(section, current)
    except Exception:  # noqa: BLE001
        pass


def apply_assist_runtime(config: Dict[str, Any]) -> None:
    """Apply assist config to all related heartbeat callbacks."""
    enabled = bool(config.get("enabled"))
    caps = config.get("capabilities") if isinstance(config.get("capabilities"), dict) else {}

    want_translation = enabled and bool(caps.get("translation", True))
    want_ai_translate = enabled and bool(caps.get("ai_translate", True))
    want_word_audio = enabled and bool(caps.get("tts", True))
    want_sentence_audio = enabled and bool(caps.get("sentence_audio", True))
    want_subtitle = enabled and bool(caps.get("subtitle", False))

    _toggle_callback("translation_worker", want_translation or want_ai_translate)
    _toggle_callback("translation_queue_monitor", want_translation or want_ai_translate)
    _toggle_callback("translation_ws_client", want_translation or want_ai_translate)

    _toggle_callback("tts_queue_poller", want_word_audio)
    _toggle_callback("tts_sentence_worker", want_sentence_audio)
    _mirror_auto_start("word_tts_auto", want_word_audio)
    _mirror_auto_start("sentence_audio_auto", want_sentence_audio)

    _toggle_callback("subtitle_search_worker", want_subtitle)

    ColorPrint.blue(
        f"[AssistSync] runtime applied master={enabled} "
        f"translation={want_translation} word_audio={want_word_audio} "
        f"sentence_audio={want_sentence_audio}"
    )
