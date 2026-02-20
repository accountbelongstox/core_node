#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Log State Reader library.
Singleton per log_path via get_log_state_reader(log_path); do not instantiate elsewhere.

Concepts aligned with docs (see docs/LOG_INDENT_SPEC.md, docs/LOG_ALL_STATES.md):
- Indent component (tab component): canonical representation of leading TAB/spaces, e.g. "tabs=0, U+0020=0".
- Message type: line content classification, e.g. info_msg_Vendor_loop, cont_System.
- State combination (full state): indent component + message type, key format "indent | message_type".

Given a log path, scan and read all state info (indent list, message types, state combos with counts/samples);
provide level, parent level per state, and child blocks for top-level states (get_state_level, get_state_parent_level, get_state_child_blocks).
After a given time, read blocks after that time and relation to older blocks (get_blocks_after).
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

from d3utils.history_indent_spec import (
    analyze_log_blocks,
    get_blocks_after as _get_blocks_after_spec,
    get_full_state,
    get_line_indent_state,
    indent_key_to_level,
    parse_line_timestamp,
    get_space_type_name,
)


class LogStateReader:
    """
    Log state reader.

    Scans a log file, aggregates indent components, message types and state combinations,
    provides APIs to read all state info. Terminology matches docs/LOG_ALL_STATES.md.
    """

    def __init__(self, log_path: str) -> None:
        """
        Build reader; does not scan immediately.

        :param log_path: Log file path (e.g. providor LOGS_FILE_PATH).
        """
        self._log_path = log_path
        self._loaded = False
        self._total_non_empty: int = 0
        self._indent_states_seen: List[str] = []
        self._message_types_seen: List[str] = []
        self._state_to_count: Dict[str, int] = {}
        self._state_to_sample: Dict[str, str] = {}
        self._state_level: Dict[str, int] = {}
        self._state_parent_level: Dict[str, Optional[int]] = {}
        self._state_child_keys: Dict[str, List[str]] = {}
        self._path_resolved: Optional[str] = None
        self._error: Optional[str] = None

    def load(self, max_lines: int = 0) -> bool:
        """
        Scan log file and fill all state info (level, parent level, top-level child blocks).

        :param max_lines: Max non-empty lines to scan; 0 = no limit.
        :return: True if load succeeded (file exists and readable); else False, see get_error().
        """
        self._loaded = False
        self._error = None
        if not os.path.isfile(self._log_path):
            self._error = "file not found"
            return False
        try:
            result = analyze_log_blocks(self._log_path, max_lines=max_lines)
        except Exception as e:
            self._error = str(e)
            return False
        if "error" in result:
            self._error = result["error"]
            return False
        self._path_resolved = result.get("path", self._log_path)
        self._total_non_empty = result.get("total_non_empty", 0)
        self._indent_states_seen = result.get("indent_states_seen", [])
        self._message_types_seen = result.get("message_types_seen", [])
        self._state_to_count = result.get("state_to_count", {})
        self._state_to_sample = result.get("state_to_sample", {})
        self._state_level = result.get("state_level", {})
        self._state_parent_level = result.get("state_parent_level", {})
        self._state_child_keys = result.get("state_child_keys", {})
        self._loaded = True
        return True

    def is_loaded(self) -> bool:
        """Whether load() has been run successfully."""
        return self._loaded

    def get_error(self) -> Optional[str]:
        """Error reason when load failed; None when successful."""
        return self._error

    def get_log_path(self) -> str:
        """Currently bound log path."""
        return self._log_path

    def total_non_empty(self) -> int:
        """Total non-empty lines scanned (matches doc 'total non-empty')."""
        return self._total_non_empty

    def num_full_states(self) -> int:
        """Number of state combinations (e.g. '66 kinds' in doc)."""
        return len(self._state_to_count)

    # ---------- Read all state info (aligned with doc) ----------

    def get_indent_states(self) -> List[str]:
        """
        All indent (tab) component keys.

        Matches doc section on Tab components; each item is canonical key e.g. "tabs=0, U+0020=0".
        """
        return list(self._indent_states_seen)

    def get_message_types(self) -> List[str]:
        """
        All message type keys.

        Matches doc section on message_type; includes info_xxx, warn_xxx, cont_xxx, msg_info_other, etc.
        """
        return list(self._message_types_seen)

    def get_state_to_count(self) -> Dict[str, int]:
        """
        State combination -> line count mapping.

        Key = full state key (indent | message_type), value = number of lines for that state.
        """
        return dict(self._state_to_count)

    def get_state_to_sample(self) -> Dict[str, str]:
        """
        State combination -> sample line mapping.

        Each state maps to one sample (stripped, truncated to ~100 chars).
        """
        return dict(self._state_to_sample)

    def get_all_full_states(self) -> List[Tuple[str, int, str]]:
        """
        All state combinations: state key, count, sample.

        :return: [(full_state_key, count, sample), ...], sorted by count descending.
        """
        items = [
            (key, self._state_to_count[key], self._state_to_sample.get(key, ""))
            for key in self._state_to_count
        ]
        items.sort(key=lambda x: -x[1])
        return items

    # ---------- Level, parent level, top-level child blocks (aligned with doc) ----------

    def get_state_level(self, full_state_key: str) -> int:
        """
        Level of this state. 0 = top (main line at column 0), 1 = child (continuation line).

        Matches doc block rule: indent tabs=0,U+0020=0 is 0, others 1.
        """
        return self._state_level.get(full_state_key, 0)

    def get_state_parent_level(self, full_state_key: str) -> Optional[int]:
        """
        Parent level of this state. None for top level, 0 for child.
        """
        return self._state_parent_level.get(full_state_key)

    def get_state_child_blocks(self, full_state_key: str) -> List[str]:
        """
        All child block state keys for this top-level state.

        Only meaningful for level 0: returns state keys that appeared as continuation lines right after this state (unique, ordered).
        Returns empty list for non-top-level states.
        """
        return list(self._state_child_keys.get(full_state_key, []))

    def get_all_states_with_hierarchy(
        self,
    ) -> List[Tuple[str, int, Optional[int], List[str], int, str]]:
        """
        All states with hierarchy: state key, level, parent level, child keys, count, sample.

        :return: [(full_state_key, level, parent_level, child_keys, count, sample), ...], sorted by count descending.
        """
        items = []
        for key in self._state_to_count:
            level = self._state_level.get(key, 0)
            parent = self._state_parent_level.get(key)
            children = list(self._state_child_keys.get(key, []))
            count = self._state_to_count[key]
            sample = self._state_to_sample.get(key, "")
            items.append((key, level, parent, children, count, sample))
        items.sort(key=lambda x: -x[4])
        return items

    def get_indent_state_for_line(self, line: str) -> Tuple[int, Dict[str, int], str]:
        """
        Indent state for a single line (does not require load).

        Same as history_indent_spec.get_line_indent_state; returns (n_tabs, space_component, indent_state_key).
        """
        return get_line_indent_state(line)

    def get_line_level(self, line: str) -> int:
        """
        Level for a single line (does not require load). 0 = top, 1 = continuation.
        """
        _, _, indent_key = get_line_indent_state(line)
        return indent_key_to_level(indent_key)

    def get_full_state_for_line(self, line: str) -> Tuple[str, str, str]:
        """
        Full state for a single line (does not require load).

        Same as history_indent_spec.get_full_state; returns (indent_key, message_type, full_state_key).
        """
        return get_full_state(line)

    # ---------- Read blocks by time and relation to older blocks ----------

    def get_blocks_after(
        self,
        after_time: Union[float, datetime, str],
        max_lines: int = 0,
    ) -> Dict[str, Any]:
        """
        Read all blocks after the given time and mark relation to blocks before that time.

        :param after_time: Cutoff. Epoch (float), datetime, or log timestamp string (e.g. "2025-12-31 06:38:57,103").
        :param max_lines: Max non-empty lines to scan; 0 = no limit.
        :return: Dict with blocks_after (blocks with head_time > after_time), trailing_old_block (if last block before cutoff has continuation lines), after_time_epoch, path, total_blocks; or error if file missing.
        """
        if not os.path.isfile(self._log_path):
            return {"error": "file not found", "path": self._log_path}
        return _get_blocks_after_spec(self._log_path, after_time, max_lines=max_lines)

    def parse_line_timestamp(self, line: str) -> Optional[float]:
        """
        Extract timestamp (epoch seconds) from a top-level log line. Continuation lines have no timestamp, return None.
        """
        return parse_line_timestamp(line)


# get_space_type_name is imported from history_indent_spec above; matches LOG_INDENT_SPEC special-space table.

# Singleton per log_path; use get_log_state_reader only
_readers_cache: Dict[str, LogStateReader] = {}


def get_log_state_reader(log_path: str) -> LogStateReader:
    """Return cached LogStateReader for log_path (singleton per path)."""
    if log_path not in _readers_cache:
        _readers_cache[log_path] = LogStateReader(log_path)
    return _readers_cache[log_path]
