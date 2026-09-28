# -*- coding: utf-8 -*-
"""Single extractor registry shared by the service and the root spool helper."""

from __future__ import annotations

from typing import List, Tuple, Type

from pycore.pyctl.agent_history.antigravity_extractor import AntigravityExtractor
from pycore.pyctl.agent_history.base_extractor import BaseExtractor
from pycore.pyctl.agent_history.claude_extractor import ClaudeCodeExtractor
from pycore.pyctl.agent_history.cline_extractor import ClineExtractor
from pycore.pyctl.agent_history.codex_extractor import CodexExtractor
from pycore.pyctl.agent_history.cursor_extractor import CursorExtractor
from pycore.pyctl.agent_history.gemini_extractor import GeminiExtractor
from pycore.pyctl.agent_history.generic_agent_extractor import GenericAgentExtractor
from pycore.pyctl.agent_history.kimi_extractor import KimiExtractor
from pycore.pyctl.agent_history.pi_extractor import PiExtractor
from pycore.pyfoundations.system_paths import AGENT_HISTORY_OFFICIAL_HOME_MARKERS

# Scan order of the extractors; the tool set they cover is the one source of
# truth for every agent-history tool list.
EXTRACTOR_CLASSES: Tuple[Type[BaseExtractor], ...] = (
    ClaudeCodeExtractor,
    CodexExtractor,
    PiExtractor,
    GeminiExtractor,
    CursorExtractor,
    KimiExtractor,
    AntigravityExtractor,
    ClineExtractor,
    GenericAgentExtractor,
)
_REGISTRY_TOOL_LIST = [extractor_class().tool() for extractor_class in EXTRACTOR_CLASSES]
_REGISTRY_TOOLS = frozenset(_REGISTRY_TOOL_LIST)
_MARKER_TOOLS = frozenset(AGENT_HISTORY_OFFICIAL_HOME_MARKERS)
if _REGISTRY_TOOLS != _MARKER_TOOLS or len(_REGISTRY_TOOLS) != len(_REGISTRY_TOOL_LIST):
    raise RuntimeError(
        "Agent-history extractor registry does not match "
        "system_paths.AGENT_HISTORY_OFFICIAL_HOME_MARKERS: "
        f"registry={sorted(_REGISTRY_TOOL_LIST)} markers={sorted(_MARKER_TOOLS)} "
        f"missing_marker={sorted(_REGISTRY_TOOLS - _MARKER_TOOLS)} "
        f"missing_extractor={sorted(_MARKER_TOOLS - _REGISTRY_TOOLS)}"
    )
# Registry tools in the marker table's UI display order.
EXTRACTOR_TOOLS: Tuple[str, ...] = tuple(
    tool for tool in AGENT_HISTORY_OFFICIAL_HOME_MARKERS if tool in _REGISTRY_TOOLS
)


def build_extractors() -> List[BaseExtractor]:
    return [extractor_class() for extractor_class in EXTRACTOR_CLASSES]


__all__ = ["EXTRACTOR_CLASSES", "EXTRACTOR_TOOLS", "build_extractors"]
