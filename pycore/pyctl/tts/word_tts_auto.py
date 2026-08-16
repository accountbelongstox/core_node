# -*- coding: utf-8 -*-
"""
Word-dictionary TTS auto-start (Queue Center toggle).

When enabled, turns on Pycore's persistent word-audio pull worker.
"""

from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.user_data_store import user_data_store
from pycore.pyctl.assist.assist_settings import (
    load_assist_settings,
    set_assist_capability,
)
from pycore.pyctl.assist.capability_sync import apply_assist_runtime

from pycore.pyctl.tts.laravel_audio_worker import (
    laravel_word_audio_worker,
)


_SECTION = "word_tts_auto"
_CONCURRENCY_KEY = "concurrency"


def get_config() -> Dict[str, Any]:
    section = user_data_store.get_section(_SECTION) or {}
    assist = load_assist_settings()
    try:
        concurrency = int(section.get(_CONCURRENCY_KEY, 0) or 0)
    except (TypeError, ValueError):
        concurrency = 0
    return {
        "auto_start": bool(
            assist.get("enabled") and (assist.get("capabilities") or {}).get("tts")
        ),
        # 0 = use the per-engine recommended value.
        "concurrency": concurrency,
    }


def restore_persisted_auto_start() -> None:
    """Apply persisted concurrency before the pull callback starts."""
    try:
        laravel_word_audio_worker.set_concurrency(get_config()["concurrency"])
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[WordTtsAuto] restore concurrency failed ({exc})")


def apply_auto_start(enabled: bool, concurrency: Optional[int] = None) -> Dict[str, Any]:
    """Persist toggle (+ optional concurrency override) and apply live.

    ``concurrency`` None leaves the persisted value untouched; 0 means "use the
    per-engine recommended value". The capability transition itself flows
    through the shared assist control plane (set_assist_capability +
    apply_assist_runtime), which also drives the lane lifecycle."""
    updates: Dict[str, Any] = {}
    if concurrency is not None:
        updates[_CONCURRENCY_KEY] = max(0, int(concurrency))
    store = user_data_store
    if updates:
        store.update_section(_SECTION, updates)

    if concurrency is not None:
        try:
            laravel_word_audio_worker.set_concurrency(max(0, int(concurrency)))
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(f"[WordTtsAuto] live concurrency apply failed ({exc})")

    settings = set_assist_capability("tts", bool(enabled))
    runtime = apply_assist_runtime(settings)
    errors = list(runtime.get("errors") or [])

    ColorPrint.blue(f"[WordTtsAuto] auto_start set to {bool(enabled)}")
    status = get_status()
    if errors:
        status["error"] = "; ".join(errors)
    return status


def get_status() -> Dict[str, Any]:
    cfg = get_config()
    worker_status: Dict[str, Any] = {}
    try:
        worker_status = laravel_word_audio_worker.get_status()
    except Exception:
        pass
    concurrency_status: Dict[str, Any] = {}
    try:
        concurrency_status = laravel_word_audio_worker.concurrency_status()
    except Exception:
        pass
    return {
        "auto_start": cfg["auto_start"],
        "concurrency": concurrency_status.get("concurrency", cfg["concurrency"]),
        "concurrency_recommended": concurrency_status.get("concurrency_recommended", 0),
        "processor_enabled": cfg["auto_start"],
        "heartbeat_enabled": cfg["auto_start"],
        "worker": worker_status,
    }
