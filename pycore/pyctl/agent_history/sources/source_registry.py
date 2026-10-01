# -*- coding: utf-8 -*-
"""The one prompt-source registry: tool declarations x source formats.

Shared by the extract service, live scan, the extract probe and the root
spool process. A discovered source descriptor is
``{path, mtime, bytes, tool, source, format}`` where ``source`` indexes the
tool's ``SourceSpec`` list; ``parse`` dispatches on it.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyctl.agent_history.sources.formats import (
    block_transcript,
    chat_session_file,
    content_block_log,
    markdown_artifacts,
    message_list,
    project_temp_json,
    response_item_log,
    typed_entry_log,
    typed_history,
    wire_event_log,
)
from pycore.pyctl.agent_history.sources.formats.prompt_store_sqlite import sqlite_prompt_store
from pycore.pyctl.agent_history.sources.source_specs import (
    FALLBACK_HOME,
    FALLBACK_NONE,
    FALLBACK_ROOT,
    SourceSpec,
    ToolSpec,
    discover_spec,
)
from pycore.pyctl.agent_history.sources.tool_specs import (
    FORMAT_BLOCK_TRANSCRIPT,
    FORMAT_CHAT_SESSION_FILE,
    FORMAT_CONTENT_BLOCK_LOG,
    FORMAT_RESPONSE_ITEM_LOG,
    FORMAT_PROJECT_TEMP_JSON,
    FORMAT_WIRE_EVENT_LOG,
    FORMAT_MARKDOWN_ARTIFACTS,
    FORMAT_MESSAGE_LIST,
    FORMAT_TYPED_ENTRY_LOG,
    FORMAT_PROMPT_STORE_SQLITE,
    FORMAT_TYPED_HISTORY,
    TOOL_SPECS,
)
from pycore.pyfoundations.agent_paths import AGENT_HISTORY_OFFICIAL_HOME_MARKERS

Parser = Callable[[str, str, str, SourceSpec], List[Dict[str, Any]]]
Describer = Callable[[str], Optional[Dict[str, Any]]]

FORMAT_PARSERS: Dict[str, Parser] = {
    FORMAT_BLOCK_TRANSCRIPT: block_transcript.parse,
    FORMAT_CHAT_SESSION_FILE: chat_session_file.parse,
    FORMAT_CONTENT_BLOCK_LOG: content_block_log.parse,
    FORMAT_RESPONSE_ITEM_LOG: response_item_log.parse,
    FORMAT_PROJECT_TEMP_JSON: project_temp_json.parse,
    FORMAT_WIRE_EVENT_LOG: wire_event_log.parse,
    FORMAT_MARKDOWN_ARTIFACTS: markdown_artifacts.parse,
    FORMAT_MESSAGE_LIST: message_list.parse,
    FORMAT_TYPED_ENTRY_LOG: typed_entry_log.parse,
    FORMAT_PROMPT_STORE_SQLITE: sqlite_prompt_store.parse,
    FORMAT_TYPED_HISTORY: typed_history.parse,
}
FORMAT_DESCRIBERS: Dict[str, Describer] = {
    FORMAT_MARKDOWN_ARTIFACTS: markdown_artifacts.describe,
}


class SourceRegistry:
    """Discovery and parse dispatch over the declared tool specs."""

    def __init__(self, specs: Tuple[ToolSpec, ...]) -> None:
        by_tool = {spec.tool: spec for spec in specs}
        markers = set(AGENT_HISTORY_OFFICIAL_HOME_MARKERS)
        unknown_formats = sorted({s.format for t in specs for s in t.sources} - set(FORMAT_PARSERS))
        if set(by_tool) != markers or len(by_tool) != len(specs) or unknown_formats:
            raise RuntimeError(
                "Agent-history tool specs do not match agent_paths.AGENT_HISTORY_OFFICIAL_HOME_MARKERS: "
                f"specs={sorted(t.tool for t in specs)} markers={sorted(markers)} "
                f"unknown_formats={unknown_formats}"
            )
        self._specs = by_tool
        # Registry tools in the marker table's UI display order.
        self.tools: Tuple[str, ...] = tuple(tool for tool in AGENT_HISTORY_OFFICIAL_HOME_MARKERS if tool in by_tool)

    def has_tool(self, tool: str) -> bool:
        return tool in self._specs

    def discover(self, home: str, user: str, tool: str) -> List[Dict[str, Any]]:
        """Sources of one tool in one home; fallback specs per their scope."""
        found: Dict[str, Dict[str, Any]] = {}
        primary_roots: set[str] = set()
        for index, spec in enumerate(self._specs[tool].sources):
            for root, descriptors in discover_spec(spec, home, user, FORMAT_DESCRIBERS.get(spec.format)).items():
                if spec.fallback == FALLBACK_HOME and primary_roots:
                    continue
                if spec.fallback == FALLBACK_ROOT and root in primary_roots:
                    continue
                for desc in descriptors:
                    if desc["path"] in found:
                        continue
                    if spec.fallback == FALLBACK_NONE:
                        primary_roots.add(root)
                    found[desc["path"]] = {**desc, "tool": tool, "source": index, "format": spec.format}
        return list(found.values())

    def discover_all(self, home: str, user: str) -> List[Dict[str, Any]]:
        return [desc for tool in self.tools for desc in self.discover(home, user, tool)]

    def parse(self, path: str, user: str, tool: str, source: int) -> List[Dict[str, Any]]:
        sources = self._specs[tool].sources if tool in self._specs else ()
        if not 0 <= int(source) < len(sources):
            return []
        spec = sources[int(source)]
        return FORMAT_PARSERS[spec.format](path, user, tool, spec)


source_registry = SourceRegistry(TOOL_SPECS)


__all__ = ["FORMAT_PARSERS", "SourceRegistry", "source_registry"]
