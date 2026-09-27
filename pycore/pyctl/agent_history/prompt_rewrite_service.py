# -*- coding: utf-8 -*-
"""New-prompt EN rewrite watcher (Windows + Linux).

Every genuinely new prompt detected by the realtime prompt monitor
(``agent_history.prompt.new``) is rewritten into standard English through the
same free-tier OpenRouter client as the article pipeline
(:func:`pycore.pyctl.ai.prompt_derive.rewrite_prompt_en`, usage source
``agent_history_prompt_rewrite``): code blocks are replaced by short plain
descriptions. The rewrite is mirrored into ``prompt_rewrite_cache``, pushed to
the UI as ``agent_history.prompt.rewritten``, and — when
``prompt_rewrite_audio`` is on — submitted at once to the global audio
orchestration library (source ``prompt_rewrite``) for immediate generation.

Switches (agent-history config): ``prompt_rewrite_enabled``,
``prompt_rewrite_audio``; preset system prompt: ``prompt_rewrite_en``.
"""

from __future__ import annotations

from typing import Any, Dict

from pycore.pyctl.agent_history.ai_sources import AI_SOURCE_PROMPT_REWRITE
from pycore.pyctl.agent_history.prompt_transform_cache import prompt_rewrite_cache
from pycore.pyctl.agent_history.prompt_transform_service import PromptTransformWatcher
from pycore.pyctl.ai.prompt_derive import rewrite_prompt_en
from pycore.pyctl.audio_orchestration import orch_service
from pycore.pyctl.audio_orchestration.orch_sources import ORCH_SOURCE_PROMPT_REWRITE
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus_constants import BusSignals


def _submit_audio(entry: Dict[str, Any], config: Dict[str, Any]) -> None:
    """Submit the rewrite to audio orchestration; records the task id."""
    if not bool(config.get("prompt_rewrite_audio", True)):
        return
    result = orch_service.submit_text_task(
        ORCH_SOURCE_PROMPT_REWRITE,
        [{"text": entry["derived_text"], "language": "en"}],
        name=f"prompt_{entry['tool']}_{str(entry.get('time') or '').replace(' ', '_')}_{entry['id'][:8]}",
        source_ref={
            "prompt_id": entry["id"],
            "tool": entry["tool"],
            "os_user": entry["os_user"],
            "session_id": entry["session_id"],
            "ts": entry["ts"],
        },
        source_text=str(entry.get("source_text") or ""),
    )
    if not result.get("success"):
        ColorPrint.yellow(f"[PromptRewrite] audio submit failed id={entry['id']} error={result.get('error')}")
        return
    entry["audio_task_id"] = str((result.get("task") or {}).get("task_id") or "")


prompt_rewrite_watcher = PromptTransformWatcher(
    tag="PromptRewrite",
    queue_name="pyctl.agent_history.prompt_rewrite",
    source=AI_SOURCE_PROMPT_REWRITE,
    cache=prompt_rewrite_cache,
    bus_signal=BusSignals.AGENT_HISTORY_PROMPT_REWRITTEN,
    transform=lambda text, config, source: rewrite_prompt_en(text, config=config, source=source),
    enabled=lambda config: bool(config.get("prompt_rewrite_enabled", True)),
    on_result=_submit_audio,
)


def start_prompt_rewrite_service() -> bool:
    """Start the watcher once per process. Both platforms; idempotent."""
    return prompt_rewrite_watcher.start()


__all__ = ["prompt_rewrite_watcher", "start_prompt_rewrite_service"]
