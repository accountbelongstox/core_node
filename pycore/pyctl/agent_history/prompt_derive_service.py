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

Queueing, caching, and bus push are the shared PromptTransformWatcher
(prompt_transform_service); this module only configures the derive feed.
"""

from __future__ import annotations

import sys
from typing import Any, Dict

from pycore.pyctl.agent_history.ai_sources import AI_SOURCE_PROMPT_DERIVE
from pycore.pyctl.agent_history.pipeline.config import get_config
from pycore.pyctl.agent_history.prompt_transform_cache import prompt_derived_cache
from pycore.pyctl.agent_history.prompt_transform_service import PromptTransformWatcher
from pycore.pyctl.ai.prompt_derive import derive_prompt_en
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.audio_utils.notification_sound import play_notification_sound
from pycore.pyutils.desktop.toast_stack import show_desktop_toast
from pycore.pyutils.native_ui.step0_i18n.i18n_keys import I18nKeys
from pycore.pyutils.native_ui.step0_i18n.i18n_manager import i18n


def _notify_desktop(entry: Dict[str, Any], _config: Dict[str, Any]) -> None:
    """Bottom-right stacked desktop toast (click copies EN) + optional sound.

    The sound flag is read from the shared agent-history config so the WEB UI
    toggle (persistAgentHistoryArticleConfig prompt_derive_sound) and the tray
    menu toggle operate this same switch on the pycore side.
    """
    derived = str(entry.get("derived_text") or "")
    show_desktop_toast(
        title=f"{i18n.get(I18nKeys.TOAST_PROMPT_DERIVED_TITLE)} · {entry.get('tool')}",
        message=derived,
        copy_text=derived,
    )
    # Re-read at playback time: a toggle made during a slow derivation applies.
    if bool(get_config().get("prompt_derive_sound", True)):
        play_notification_sound()


prompt_derive_watcher = PromptTransformWatcher(
    tag="PromptDerive",
    queue_name="pyctl.agent_history.prompt_derive",
    source=AI_SOURCE_PROMPT_DERIVE,
    cache=prompt_derived_cache,
    bus_signal=BusSignals.AGENT_HISTORY_PROMPT_DERIVED,
    transform=lambda text, config, source: derive_prompt_en(text, config=config, source=source),
    enabled=lambda _config: True,
    on_result=_notify_desktop,
)


def start_prompt_derive_service() -> bool:
    """Start the watcher once per process. Linux only; idempotent."""
    if not sys.platform.startswith("linux"):
        ColorPrint.blue("[PromptDerive] skipped: new-prompt EN derivation runs on Linux only")
        return False
    return prompt_derive_watcher.start()


__all__ = ["prompt_derive_watcher", "start_prompt_derive_service"]
