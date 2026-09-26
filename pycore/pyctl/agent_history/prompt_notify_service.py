# -*- coding: utf-8 -*-
"""New-prompt tray/desktop notification watcher (Windows + Linux).

Subscribes the ``agent_history.prompt.new`` THREAD_BUS event emitted by
``AgentHistoryService._emit_prompt_new`` (the same choke point as the
"[AgentHistory] New prompt detected" log line and the Linux EN-derive watcher)
and pops one aggregated system notification per event — agent names, prompt
count, and a snippet of the newest prompt.

Unlike the EN-derive path this watcher is platform-independent and does NOT
depend on an AI call: a failed/quota-exhausted derivation no longer silences
the desktop signal. Disabled by the ``prompt_new_notify`` agent-history config
flag (tray menu toggle / WEB UI settings operate the same switch).
"""

from __future__ import annotations

import re
from typing import Any, Dict, List

from pycore.pyctl.agent_history.pipeline.config import get_config
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedValue
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.desktop.system_notification import show_system_notification
from pycore.pyutils.native_ui.step0_i18n.i18n_keys import I18nKeys
from pycore.pyutils.native_ui.step0_i18n.i18n_manager import i18n

_SERVICE_STARTED = SerializedValue(False, "PromptNotifyServiceStateThread")
# Fixed-length prompt excerpt shown in the notification body: only the first
# PROMPT_EXCERPT_LEN characters of the newest prompt, with an ellipsis when
# truncated (requirement: never show the full prompt text in a notification).
PROMPT_EXCERPT_LEN = 50
ELLIPSIS = "…"


def _fixed_excerpt(text: str) -> str:
    """First PROMPT_EXCERPT_LEN chars of the prompt, ellipsis when truncated."""
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    if len(text) > PROMPT_EXCERPT_LEN:
        return text[:PROMPT_EXCERPT_LEN].rstrip() + ELLIPSIS
    return text


def _on_prompt_new(event_data: Any) -> None:
    """Event handler (async dispatch thread): one notification per event."""
    try:
        if not isinstance(event_data, dict):
            return
        if not bool(get_config().get("prompt_new_notify", True)):
            return
        prompts: List[Dict[str, Any]] = [
            p for p in (event_data.get("prompts") or [])
            if isinstance(p, dict)
        ]
        tools = [str(t) for t in (event_data.get("tools") or []) if str(t).strip()]
        if not tools:
            tools = sorted({str(p.get("tool")) for p in prompts if p.get("tool")})
        count = int(event_data.get("prompt_count") or len(prompts) or 0)
        if count <= 0 and not prompts:
            return
        excerpt = _fixed_excerpt(prompts[0].get("text")) if prompts else ""
        title = i18n.get(I18nKeys.TOAST_PROMPT_NEW_TITLE)
        header = f"{', '.join(tools) or 'agent'}: {count or len(prompts)}"
        message = f"{header}\n{excerpt}" if excerpt else header
        show_system_notification(title, message)
    except Exception as exc:  # noqa: BLE001 — notification must never break the event bus
        ColorPrint.yellow(f"[PromptNotify] notification failed: {exc}")


def start_prompt_notify_service() -> bool:
    """Start the watcher once per process. Both platforms; idempotent."""
    if not _SERVICE_STARTED.compare_and_set(False, True):
        return True
    THREAD_BUS.register_event_handler(
        BusSignals.AGENT_HISTORY_PROMPT_NEW,
        _on_prompt_new,
    )
    ColorPrint.green("[PromptNotify] new-prompt tray/desktop notification watcher active")
    return True


__all__ = ["start_prompt_notify_service"]
