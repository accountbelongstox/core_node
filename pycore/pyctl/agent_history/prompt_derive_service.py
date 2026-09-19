# -*- coding: utf-8 -*-
"""Linux-only new-prompt EN derivation watcher.

Subscribes the ``agent_history.prompt.new`` THREAD_BUS event emitted by
``AgentHistoryService._emit_prompt_new`` (the same "[AgentHistory] New prompt
detected" log line). On LINUX only, every genuinely new prompt is derived
into standard English through the shared free-tier library
(:mod:`pycore.pyctl.ai.prompt_derive`), the result is printed immediately,
mirrored into the read-only ``prompt_derived_cache`` side store, pushed
to the UI as ``agent_history.prompt.derived``, and surfaced on the desktop
as a bottom-right stacked toast (click copies the EN text) plus an optional
notification sound (config flag ``prompt_derive_sound``).

Derivations serialize on one worker queue (fire-and-forget messages, no
response signals) so a burst of new prompts never fires parallel AI calls
and never blocks the extract lane or the event dispatcher.
"""

from __future__ import annotations

import sys
from datetime import datetime
from typing import Any, Dict, List

import pycore.pyctl.agent_history.prompt_derived_cache as prompt_derived_cache
from pycore.pyctl.agent_history.agent_history_service import agent_history_service
from pycore.pyctl.agent_history.pipeline.config import get_config
from pycore.pyctl.ai.prompt_derive import derive_prompt_en
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedWorkerThread, SerializedValue
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.audio_utils.notification_sound import play_notification_sound
from pycore.pyutils.desktop.toast_stack import show_desktop_toast
from pycore.pyutils.native_ui.step0_i18n.i18n_keys import I18nKeys
from pycore.pyutils.native_ui.step0_i18n.i18n_manager import i18n

DERIVE_QUEUE = "pyctl.agent_history.prompt_derive"
DERIVE_SOURCE = "agent_history_prompt_derive"
# Quota protection: one extraction tick can surface many new prompts; only the
# newest few are derived per event (the full feed stays in prompt_new_cache).
DERIVE_PROMPTS_PER_EVENT_CAP = 3
DERIVE_SOURCE_TEXT_CAP = 4000

_DERIVE_WORKER = SerializedWorkerThread(DERIVE_QUEUE, "PromptDeriveThread")
_SERVICE_STARTED = SerializedValue(False, "PromptDeriveServiceStateThread")


def _full_texts_by_id(prompt_ids: List[str]) -> Dict[str, str]:
    """Materialize full prompt text from the session txt store.

    The prompt.new event carries a 200-char snippet only; derivation needs
    the complete prompt, resolved here by id (same-process store read).
    """
    page = agent_history_service.read_prompt_page(prompt_ids)
    return {
        str(item.get("id") or ""): str(item.get("text") or "")
        for item in (page.get("items") or [])
        if isinstance(item, dict) and item.get("id")
    }


def _derive_event_prompts(event_data: Dict[str, Any]) -> None:
    """Worker-queue body: derive the newest prompts of one prompt.new event."""
    prompts = [
        p for p in (event_data.get("prompts") or [])
        if isinstance(p, dict) and p.get("id")
    ][:DERIVE_PROMPTS_PER_EVENT_CAP]
    if not prompts:
        return
    text_by_id = _full_texts_by_id([str(p["id"]) for p in prompts])
    config = get_config()
    for prompt in prompts:
        pid = str(prompt["id"])
        text = (text_by_id.get(pid) or str(prompt.get("text") or "")).strip()
        if not text:
            continue
        tool = str(prompt.get("tool") or "?")
        result = derive_prompt_en(
            text[:DERIVE_SOURCE_TEXT_CAP],
            config=config,
            source=DERIVE_SOURCE,
        )
        if not result.get("success"):
            ColorPrint.yellow(
                f"[PromptDerive] derivation failed agent={tool} "
                f"id={pid} error={result.get('error')}"
            )
            continue
        derived = str(result.get("derived") or "")
        entry = {
            "id": pid,
            "tool": tool,
            "os_user": str(prompt.get("os_user") or ""),
            "session_id": str(prompt.get("session_id") or ""),
            "ts": int(prompt.get("ts") or 0),
            "time": str(prompt.get("time") or ""),
            "source_text": text[:DERIVE_SOURCE_TEXT_CAP],
            "derived_text": derived,
            "model": str(result.get("model") or ""),
            "provider": str(result.get("provider") or ""),
            "derived_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        prompt_derived_cache.append_derived(entry)
        ColorPrint.green(
            f"[PromptDerive] linux new prompt agent={tool} "
            f"original=\"{text[:200]}\" derived=\"{derived}\""
        )
        THREAD_BUS.trigger_event(
            BusSignals.AGENT_HISTORY_PROMPT_DERIVED,
            {"item": entry},
            async_mode=True,
        )
        _notify_desktop(tool, derived, config)


def _notify_desktop(tool: str, derived: str, config: Dict[str, Any]) -> None:
    """Bottom-right stacked desktop toast (click copies EN) + optional sound.

    The sound flag is read from the shared agent-history config so the WEB UI
    toggle (persistAgentHistoryArticleConfig prompt_derive_sound) and the tray
    menu toggle operate this same switch on the pycore side.
    """
    show_desktop_toast(
        title=f"{i18n.get(I18nKeys.TOAST_PROMPT_DERIVED_TITLE)} · {tool}",
        message=derived,
        copy_text=derived,
    )
    if bool(config.get("prompt_derive_sound", True)):
        play_notification_sound()


def _on_prompt_new(event_data: Any) -> None:
    """Event handler (async dispatch thread): enqueue, never block on AI."""
    if not isinstance(event_data, dict):
        return
    if not isinstance(event_data.get("prompts"), list) or not event_data["prompts"]:
        return
    THREAD_BUS.send_message(DERIVE_QUEUE, {
        "callback": _derive_event_prompts,
        "args": (event_data,),
        "kwargs": {},
    })


def start_prompt_derive_service() -> bool:
    """Start the watcher once per process. Linux only; idempotent."""
    if not sys.platform.startswith("linux"):
        ColorPrint.blue("[PromptDerive] skipped: new-prompt EN derivation runs on Linux only")
        return False
    if not _SERVICE_STARTED.compare_and_set(False, True):
        return True
    _DERIVE_WORKER.start()
    THREAD_BUS.register_event_handler(
        BusSignals.AGENT_HISTORY_PROMPT_NEW,
        _on_prompt_new,
    )
    ColorPrint.green("[PromptDerive] linux new-prompt EN derivation watcher active")
    return True


__all__ = ["start_prompt_derive_service"]
