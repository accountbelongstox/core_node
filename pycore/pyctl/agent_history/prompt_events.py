# -*- coding: utf-8 -*-
"""New-prompt announcement: the "[AgentHistory] New prompt detected" choke point.

``emit_prompt_new`` logs the newest genuinely new prompts (ids the txt store
had never seen), broadcasts ``BusSignals.AGENT_HISTORY_PROMPT_NEW`` (consumed
by the prompt transform watchers and the notify service) and stores them in
the ``new`` prompt record feed.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List

from pycore.pyctl.agent_history.agent_history_records import newest_prompts_first
from pycore.pyctl.agent_history.prompt_records import prompt_records
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals

PROMPT_NEW_EVENT_CAP = 20
PROMPT_NEW_TEXT_SNIPPET = 200
LOG_SNIPPET_EDGE = 10


def _log_snippet(text: Any) -> str:
    flat = re.sub(r"\s+", " ", str(text or "")).strip()
    if len(flat) <= 2 * LOG_SNIPPET_EDGE:
        return flat
    return f"{flat[:LOG_SNIPPET_EDGE]}...{flat[-LOG_SNIPPET_EDGE:]}"


def emit_prompt_new(new_prompts: List[Dict[str, Any]], generated_at: str) -> None:
    """Broadcast genuinely new prompts, newest first, capped."""
    if not new_prompts:
        return
    newest = newest_prompts_first(new_prompts)[:PROMPT_NEW_EVENT_CAP]
    for p in newest:
        ColorPrint.green(
            f"[AgentHistory] New prompt detected agent={p.get('tool') or '?'} "
            f"user={p.get('os_user') or '?'} prompt=\"{_log_snippet(p.get('text'))}\""
        )
    tools = sorted({str(p.get("tool") or "") for p in new_prompts if p.get("tool")})
    THREAD_BUS.trigger_event(
        BusSignals.AGENT_HISTORY_PROMPT_NEW,
        {
            "generated_at": generated_at,
            "tools": tools,
            "prompt_count": len(new_prompts),
            "prompts": [
                {
                    "id": p.get("id"),
                    "tool": p.get("tool"),
                    "os_user": p.get("os_user"),
                    "session_id": p.get("session_id"),
                    "ts": int(p.get("ts") or 0),
                    "time": p.get("time") or "",
                    "text": str(p.get("text") or "")[:PROMPT_NEW_TEXT_SNIPPET],
                }
                for p in newest
            ],
        },
        async_mode=True,
    )
    # Stored after the log lines and the event, so a store failure never hides them.
    prompt_records.append_new(new_prompts)


__all__ = ["emit_prompt_new"]
