# -*- coding: utf-8 -*-
"""Shared new-prompt AI transform watcher.

Subscribes the ``agent_history.prompt.new`` THREAD_BUS event emitted by
``AgentHistoryService._emit_prompt_new`` (the "[AgentHistory] New prompt
detected" choke point). Each configured watcher sends the newest prompts of
an event through ONE free-tier transform (EN derivation, EN rewrite, ...),
mirrors the result into its read-only ``prompt_transform_cache`` feed, pushes
it to the UI on its bus topic, and runs its feature hook (desktop toast,
audio orchestration submit, ...).

Transforms serialize on the watcher's own worker queue (fire-and-forget
messages, no response signals) so a burst of new prompts never fires
parallel AI calls and never blocks the extract lane or the event dispatcher.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Callable, Dict, List

from pycore.pyctl.agent_history.agent_history_service import agent_history_service
from pycore.pyctl.agent_history.pipeline.config import get_config
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedWorkerThread, SerializedValue
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals

# Quota protection: one extraction tick can surface many new prompts; only the
# newest few are transformed per event (the full feed stays in prompt_new_cache).
TRANSFORM_PROMPTS_PER_EVENT_CAP = 3
TRANSFORM_SOURCE_TEXT_CAP = 4000


def _full_texts_by_id(prompt_ids: List[str]) -> Dict[str, str]:
    """Materialize full prompt text from the session txt store.

    The prompt.new event carries a 200-char snippet only; transforms need
    the complete prompt, resolved here by id (same-process store read).
    """
    page = agent_history_service.read_prompt_page(prompt_ids)
    return {
        str(item.get("id") or ""): str(item.get("text") or "")
        for item in (page.get("items") or [])
        if isinstance(item, dict) and item.get("id")
    }


class PromptTransformWatcher:
    """One configured new-prompt transform feed (worker + cache + bus topic)."""

    def __init__(
        self,
        tag: str,
        queue_name: str,
        source: str,
        cache: Any,
        bus_signal: str,
        transform: Callable[[str, Dict[str, Any], str], Dict[str, Any]],
        enabled: Callable[[Dict[str, Any]], bool],
        on_result: Callable[[Dict[str, Any], Dict[str, Any]], None],
    ) -> None:
        self.tag = tag
        self.source = source
        self._queue_name = queue_name
        self._cache = cache
        self._bus_signal = bus_signal
        self._transform = transform
        self._enabled = enabled
        self._on_result = on_result
        self._worker = SerializedWorkerThread(queue_name, f"{tag}Thread")
        self._started = SerializedValue(False, f"{tag}StateThread")

    def _transform_event_prompts(self, event_data: Dict[str, Any]) -> None:
        """Worker-queue body: transform the newest prompts of one prompt.new event."""
        prompts = [
            p for p in (event_data.get("prompts") or [])
            if isinstance(p, dict) and p.get("id")
        ][:TRANSFORM_PROMPTS_PER_EVENT_CAP]
        if not prompts:
            return
        text_by_id = _full_texts_by_id([str(p["id"]) for p in prompts])
        config = get_config()
        for prompt in prompts:
            pid = str(prompt["id"])
            text = (text_by_id.get(pid) or str(prompt.get("text") or "")).strip()[:TRANSFORM_SOURCE_TEXT_CAP]
            if not text:
                continue
            tool = str(prompt.get("tool") or "?")
            result = self._transform(text, config, self.source)
            if not result.get("success"):
                ColorPrint.yellow(
                    f"[{self.tag}] transform failed agent={tool} "
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
                "source_text": text,
                "derived_text": derived,
                "model": str(result.get("model") or ""),
                "provider": str(result.get("provider") or ""),
                "derived_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "audio_task_id": "",
            }
            self._on_result(entry, config)
            self._cache.append(entry)
            ColorPrint.green(
                f"[{self.tag}] new prompt agent={tool} "
                f"original=\"{text[:200]}\" result=\"{derived}\""
            )
            THREAD_BUS.trigger_event(self._bus_signal, {"item": entry}, async_mode=True)

    def _on_prompt_new(self, event_data: Any) -> None:
        """Event handler (async dispatch thread): enqueue, never block on AI."""
        if not isinstance(event_data, dict):
            return
        if not isinstance(event_data.get("prompts"), list) or not event_data["prompts"]:
            return
        if not self._enabled(get_config()):
            return
        THREAD_BUS.send_message(self._queue_name, {
            "callback": self._transform_event_prompts,
            "args": (event_data,),
            "kwargs": {},
        })

    def start(self) -> bool:
        """Start the watcher once per process; idempotent."""
        if not self._started.compare_and_set(False, True):
            return True
        self._worker.start()
        THREAD_BUS.register_event_handler(BusSignals.AGENT_HISTORY_PROMPT_NEW, self._on_prompt_new)
        ColorPrint.green(f"[{self.tag}] new-prompt transform watcher active (source={self.source})")
        return True


__all__ = ["PromptTransformWatcher"]
