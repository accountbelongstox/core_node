# -*- coding: utf-8 -*-
"""Single extractor registry shared by the service and the root spool helper."""

from __future__ import annotations

from typing import List

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


def build_extractors() -> List[BaseExtractor]:
    return [
        ClaudeCodeExtractor(),
        CodexExtractor(),
        PiExtractor(),
        GeminiExtractor(),
        CursorExtractor(),
        KimiExtractor(),
        AntigravityExtractor(),
        ClineExtractor(),
        GenericAgentExtractor(),
    ]


__all__ = ["build_extractors"]
