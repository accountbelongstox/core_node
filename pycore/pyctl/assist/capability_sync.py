# -*- coding: utf-8 -*-
"""
Sync persisted Queue Center capabilities to Pycore's live pull workers.

The UI owns switches and endpoint selection; registered heartbeat callbacks
own Laravel pull/accept/result processing independently of the UI lifecycle.
"""

from typing import Any, Dict, List, Optional, Tuple

import importlib

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
from pycore.pyctl.assist.assist_settings import assist_callback_states

# Heartbeat callback name -> (module, singleton attribute) holding the worker
# whose request_pull() fires one immediate remote-first pull when the lane
# toggles on. Imported lazily: this module loads before worker singletons.
_LANE_WORKER_PROVIDERS = {
    "translation_worker": (
        "pycore.pyctl.translation.worker.worker",
        "translation_worker_service",
    ),
    "tts_queue_poller": (
        "pycore.pyctl.tts.laravel_audio_worker",
        "laravel_word_audio_worker",
    ),
    "tts_sentence_worker": (
        "pycore.pyctl.tts.laravel_audio_worker",
        "laravel_sentence_audio_worker",
    ),
}


def _wake_lane_worker(name: str) -> None:
    """Wake one lane's worker the moment its toggle turns on.

    The heartbeat callback would fire within its poll interval anyway; the
    wake makes the enable action pull the first bounded batch immediately.
    request_pull() is coalesced and capacity-aware, so a wake during an
    in-flight pull is a no-op.
    """
    provider = _LANE_WORKER_PROVIDERS.get(name)
    if provider is None:
        return
    module_name, attribute = provider
    try:
        module = importlib.import_module(module_name)
        worker = getattr(module, attribute, None)
        request_pull = getattr(worker, "request_pull", None)
        if callable(request_pull):
            request_pull(prefer_remote=True)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.yellow(f"[AssistSync] {name} immediate pull deferred ({exc})")


def _toggle_callback(name: str, want: bool) -> Tuple[bool, Optional[str]]:
    """Enable/disable a heartbeat callback. Returns (ok, error_or_None).

    An unregistered callback is not a failure while startup registration is
    still in progress; the persisted setting will be applied after registration.
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
            ColorPrint.blue(f"[AssistSync] {name} not registered - deferred")
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
        elif want:
            _wake_lane_worker(name)

    ColorPrint.blue(
        f"[AssistSync] runtime applied master={enabled} "
        f"translation={want_translation} word_audio={want_word_audio} "
        f"sentence_audio={want_sentence_audio} stt={want_stt}"
    )
    return {"ok": not errors, "errors": errors}
