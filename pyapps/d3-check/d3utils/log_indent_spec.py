#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Log line leading indent spec: TAB and space (including special Unicode spaces).
Used to chunk log lines: 0 indent = new entry, positive = continuation (e.g. stack trace).
Full state = indent (tab component) + message type (log content category).
"""
import os
import re
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

# Unicode space-like code points (name and whether to count as "leading indent")
# See: https://en.wikipedia.org/wiki/Whitespace_character
SPECIAL_SPACE_NAMES = {
    0x0020: "SPACE",           # normal space
    0x00A0: "NO-BREAK SPACE",
    0x1680: "OGHAM SPACE",
    0x2000: "EN QUAD",
    0x2001: "EM QUAD",
    0x2002: "EN SPACE",
    0x2003: "EM SPACE",
    0x2004: "THREE-PER-EM SPACE",
    0x2005: "FOUR-PER-EM SPACE",
    0x2006: "SIX-PER-EM SPACE",
    0x2007: "FIGURE SPACE",
    0x2008: "PUNCTUATION SPACE",
    0x2009: "THIN SPACE",
    0x200A: "HAIR SPACE",
    0x202F: "NARROW NO-BREAK SPACE",
    0x205F: "MEDIUM MATHEMATICAL SPACE",
    0x3000: "IDEOGRAPHIC SPACE",
    0xFEFF: "ZERO WIDTH NO-BREAK (BOM)",
}


def _classify_leading_run(line: str) -> Tuple[int, Dict[str, int]]:
    """
    Return (number of leading TABs, dict of space type -> count).
    Space type key: "U+0020", "U+00A0", etc. Only leading run is analyzed.
    """
    n_tabs = 0
    space_component: Dict[str, int] = defaultdict(int)
    i = 0
    while i < len(line):
        c = line[i]
        if c == "\t":
            n_tabs += 1
            i += 1
        elif c == " ":
            space_component["U+0020"] += 1
            i += 1
        elif len(c) == 1 and ord(c) in SPECIAL_SPACE_NAMES and ord(c) != 0x0020:
            key = "U+%04X" % ord(c)
            space_component[key] += 1
            i += 1
        elif c.isspace():
            # any other Unicode whitespace
            key = "U+%04X" % ord(c)
            space_component[key] += 1
            i += 1
        else:
            break
    return n_tabs, dict(space_component)


def get_line_indent_state(line: str) -> Tuple[int, Dict[str, int], str]:
    """
    Return (n_tabs, space_component, state_key).
    state_key is a canonical string for grouping, e.g. "tabs=0, U+0020=0" or "tabs=0, U+0020=3".
    """
    n_tabs, space_component = _classify_leading_run(line)
    parts = ["tabs=%d" % n_tabs]
    for k in sorted(space_component.keys()):
        parts.append("%s=%d" % (k, space_component[k]))
    if not space_component:
        parts.append("U+0020=0")
    state_key = ", ".join(parts)
    return n_tabs, space_component, state_key


# Timestamp + level at start: "2025-12-31 06:38:57,103 INFO - " or "WARN - "
_LOG_TS_RE = re.compile(r"^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})\s+(INFO|WARN)\s+-\s+(.*)$")
_LOG_TS_ONLY_RE = re.compile(r"^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})")


def parse_line_timestamp(line: str) -> Optional[float]:
    """
    Extract timestamp from a top-level log line; return epoch seconds. None if missing or invalid.
    Only top-level lines have timestamp; continuation lines do not.
    """
    s = line.strip()
    m = _LOG_TS_ONLY_RE.match(s)
    if not m:
        return None
    ts_str = m.group(1)
    try:
        dt = datetime.strptime(ts_str[:19], "%Y-%m-%d %H:%M:%S")
        ms = int(ts_str[20:23]) if len(ts_str) >= 23 else 0
        return dt.timestamp() + ms / 1000.0
    except (ValueError, IndexError):
        return None

# Message type: ordered (pattern, type_name). First match wins. Pattern is prefix or substring.
# Continuation lines (no timestamp)
_CONTINUATION_PATTERNS: List[Tuple[str, str]] = [
    ("   at ", "cont_at"),
    ("  at ", "cont_at_2sp"),
    ("at System.", "cont_System"),
    ("at ?????????", "cont_obfuscated"),
    ("File name: '", "cont_File_name"),
    ("WRN: Assembly", "cont_WRN_Assembly"),
    ("Note: There is", "cont_Note_There"),
    ("Note: Some", "cont_Note_Some"),
    ("To enable assembly", "cont_To_enable"),
    ("To turn this", "cont_To_turn"),
    ("To turn ... off", "cont_To_turn_off"),
]
# Content after "INFO - " or "WARN - " (top-level only)
_MESSAGE_PATTERNS: List[Tuple[str, str]] = [
    ("FastModeR loading", "msg_FastModeR_loading"),
    ("Initializing plugins", "msg_Initializing_plugins"),
    ("rsttcp.cfg", "msg_rsttcp_cfg"),
    ("TCPRst OnInitialize", "msg_TCPRst_OnInitialize"),
    ("TCPRst OnShutdown", "msg_TCPRst_OnShutdown"),
    ("WinDivert64.sys", "msg_WinDivert_sys"),
    ("WinDivert", "msg_WinDivert"),
    ("Exception thrown when loding", "msg_Exception_thrown_loding"),
    ("System.BadImageFormatException", "msg_System_BadImageFormat"),
    ("System.Exception:", "msg_System_Exception"),
    ("File name: '", "msg_File_name"),
    ("WRN: Assembly", "msg_WRN_Assembly"),
    ("Note: There is", "msg_Note_There"),
    ("Note: Some", "msg_Note_Some"),
    ("To enable assembly", "msg_To_enable"),
    ("To turn this", "msg_To_turn"),
    ("BWGComprehensivePlugin", "msg_BWGComprehensivePlugin"),
    ("ExtPickup OnInitialize", "msg_ExtPickup_OnInitialize"),
    ("HCHelpPlugin OnInitialize", "msg_HCHelpPlugin_OnInitialize"),
    ("extpick.cfg", "msg_extpick_cfg"),
    ("Installed plugins", "msg_Installed_plugins"),
    (" - Disabled", "msg_plugin_Disabled"),
    ("DropItems - Disabled", "msg_DropItems_Disabled"),
    ("plugin start.", "msg_plugin_start"),
    ("plugin stop.", "msg_plugin_stop"),
    ("Start a loop", "msg_Start_a_loop"),
    ("Botting !", "msg_Botting"),
    ("CancelRequested =>", "msg_CancelRequested"),
    ("end.", "msg_end"),
    ("Vendor loop", "msg_Vendor_loop"),
    ("Vendor loop done", "msg_Vendor_loop_done"),
    ("Running:", "msg_Running"),
    ("Open Rift Success", "msg_Open_Rift_Success"),
    ("Open Greater Rift Success", "msg_Open_Greater_Rift_Success"),
    ("Objective RunLogic:", "msg_Objective_RunLogic"),
    ("Take portal :", "msg_Take_portal"),
    ("portal > 10 move to portal", "msg_portal_move_to_portal"),
    ("take portal but actionfound", "msg_take_portal_actionfound"),
    ("move to portal success", "msg_move_to_portal_success"),
    ("Take portal ended", "msg_Take_portal_ended"),
    ("Take portal check ended", "msg_Take_portal_check_ended"),
    ("Interact PowerUpOrPool =>", "msg_Interact_PowerUpOrPool"),
    ("Interact end", "msg_Interact_end"),
    ("Dead", "msg_Dead"),
    ("Resurect", "msg_Resurect"),
    ("Disconnected", "msg_Disconnected"),
    ("DisconnectionEx thrown", "msg_DisconnectionEx_thrown"),
    ("Disconnection", "msg_Disconnection"),
    ("Return to town early", "msg_Return_to_town_early"),
    ("Town portal:", "msg_Town_portal"),
    ("Town portal done", "msg_Town_portal_done"),
    ("Objective RunLogic: Urshi", "msg_Objective_Urshi"),
    ("Objective RunLogic: Talk to Orek", "msg_Objective_Talk_Orek"),
    ("Objective RunLogic: Open Rift", "msg_Objective_Open_Rift"),
    ("Objective RunLogic: Do Rift", "msg_Objective_Do_Rift"),
    ("Objective RunLogic: Kill Boss", "msg_Objective_Kill_Boss"),
    ("Objective RunLogic: RiftItem", "msg_Objective_RiftItem"),
    ("Loading...", "msg_Loading"),
    ("Resume Game try nbr", "msg_Resume_Game_try"),
    ("[2] Start a loop", "msg_N_Start_a_loop"),
    ("Abnormal situation, exit game", "msg_Abnormal_situation"),
    ("Session Time out", "msg_Session_Time_out"),
    ("scan dont found", "msg_scan_dont_found"),
    ("move to boss ", "msg_move_to_boss"),
    ("fighting with warden", "msg_fighting_with_warden"),
    ("Start picking up items dropped", "msg_Start_picking_up"),
    ("GoNext Cacnel", "msg_GoNext_Cacnel"),
    ("RiftItem elapsed total", "msg_RiftItem_elapsed"),
    ("Finish picking up items dropped", "msg_Finish_picking_up"),
    ("Picking end", "msg_Picking_end"),
    ("BWGComprehensivePlugin OnShutdown", "msg_BWG_OnShutdown"),
    ("ExtPickup OnShutdown", "msg_ExtPickup_OnShutdown"),
    ("HCHelpPlugin OnShutdown", "msg_HCHelp_OnShutdown"),
]


def _get_message_type(content: str) -> str:
    """Classify message type from stripped line content (no leading indent)."""
    s = content.strip()
    if not s:
        return "msg_empty"
    # Timestamp line?
    m = _LOG_TS_RE.match(s)
    if m:
        level = m.group(2)
        rest = m.group(3)
        for pat, name in _MESSAGE_PATTERNS:
            if pat in rest or rest.startswith(pat):
                return ("%s_%s" % (level.lower(), name))
        # Fallback: first token or first 40 chars
        first = rest.split()[0] if rest.split() else rest[:40]
        return "msg_info_other" if level == "INFO" else "msg_warn_other"
    # Continuation
    for pat, name in _CONTINUATION_PATTERNS:
        if s.startswith(pat) or pat in s[:60]:
            return name
    if s.startswith("at "):
        return "cont_at_other"
    return "cont_other"


def get_full_state(line: str) -> Tuple[str, str, str]:
    """
    Return (indent_state_key, message_type, full_state_key).
    full_state_key = indent_state_key + " | " + message_type.
    """
    _, _, indent_key = get_line_indent_state(line)
    stripped = line.strip()
    msg_type = _get_message_type(stripped)
    full_key = indent_key + " | " + msg_type
    return indent_key, msg_type, full_key


# Level: no leading whitespace = 0, continuation (leading space/indent) = 1; extend to 2,3,... if multi-level later
_INDENT_TOP = "tabs=0, U+0020=0"


def indent_key_to_level(indent_key: str) -> int:
    """
    Level from indent key. Matches doc block rule: 0 = new log entry, 1 = continuation (belongs to previous).
    """
    if indent_key == _INDENT_TOP:
        return 0
    return 1


def analyze_log_all_states(
    log_path: str, max_lines: int = 0
) -> Dict[str, Any]:
    """
    Scan log and return every (indent_state, message_type) combination.
    max_lines=0 means no limit. Returns state_to_count, state_to_sample,
    indent_states_seen, message_types_seen, total_non_empty.
    """
    if not os.path.isfile(log_path):
        return {"error": "file not found", "path": log_path}
    state_to_count: Dict[str, int] = defaultdict(int)
    state_to_sample: Dict[str, str] = {}
    indent_states_seen: set = set()
    message_types_seen: set = set()
    total = 0
    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if max_lines and total >= max_lines:
                break
            s = line.rstrip("\n\r")
            if not s.strip():
                continue
            indent_k, msg_type, full_key = get_full_state(s)
            indent_states_seen.add(indent_k)
            message_types_seen.add(msg_type)
            state_to_count[full_key] += 1
            if full_key not in state_to_sample:
                sample = s.strip()[:100] + ("..." if len(s.strip()) > 100 else "")
                state_to_sample[full_key] = sample
            total += 1
    return {
        "path": log_path,
        "total_non_empty": total,
        "indent_states_seen": sorted(indent_states_seen),
        "message_types_seen": sorted(message_types_seen),
        "state_to_count": dict(state_to_count),
        "state_to_sample": state_to_sample,
        "num_full_states": len(state_to_count),
    }


def analyze_log_blocks(
    log_path: str, max_lines: int = 0
) -> Dict[str, Any]:
    """
    Scan log and add block structure on top of analyze_log_all_states: level, parent level, top-level child blocks.

    Aligned with doc:
    - Level: 0 = top (indent tabs=0,U+0020=0), 1 = child (continuation, e.g. U+0020=3).
    - Parent level: None for top, 0 for child.
    - Block: each top-level line starts a block; following continuation lines belong to it; top-level "all child blocks" = all state keys that appeared as its continuation (unique, ordered).

    Returns analyze_log_all_states fields plus:
    - state_level: full_state_key -> int (0 or 1)
    - state_parent_level: full_state_key -> Optional[int]
    - state_child_keys: full_state_key -> List[str], only for level 0, child state keys led by this top-level (unique, sorted).
    """
    if not os.path.isfile(log_path):
        return {"error": "file not found", "path": log_path}
    state_to_count: Dict[str, int] = defaultdict(int)
    state_to_sample: Dict[str, str] = {}
    indent_states_seen: set = set()
    message_types_seen: set = set()
    total = 0
    # Block structure: current block head, current children; accumulate head -> [child_key, ...]
    head_to_children: Dict[str, List[str]] = defaultdict(list)
    current_head: Optional[str] = None
    current_children: List[str] = []

    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if max_lines and total >= max_lines:
                break
            s = line.rstrip("\n\r")
            if not s.strip():
                continue
            indent_k, msg_type, full_key = get_full_state(s)
            level = indent_key_to_level(indent_k)
            indent_states_seen.add(indent_k)
            message_types_seen.add(msg_type)
            state_to_count[full_key] += 1
            if full_key not in state_to_sample:
                sample = s.strip()[:100] + ("..." if len(s.strip()) > 100 else "")
                state_to_sample[full_key] = sample
            total += 1

            if level == 0:
                if current_head is not None:
                    head_to_children[current_head].extend(current_children)
                current_head = full_key
                current_children = []
            else:
                if current_head is not None:
                    current_children.append(full_key)
        if current_head is not None:
            head_to_children[current_head].extend(current_children)

    all_keys = set(state_to_count.keys())
    state_level: Dict[str, int] = {}
    state_parent_level: Dict[str, Optional[int]] = {}
    state_child_keys: Dict[str, List[str]] = {}
    for k in all_keys:
        indent_k = k.split(" | ", 1)[0]
        state_level[k] = indent_key_to_level(indent_k)
        state_parent_level[k] = (state_level[k] - 1) if state_level[k] > 0 else None
    for head, children in head_to_children.items():
        state_child_keys[head] = sorted(set(children))
    for k in all_keys:
        if k not in state_child_keys:
            state_child_keys[k] = []

    return {
        "path": log_path,
        "total_non_empty": total,
        "indent_states_seen": sorted(indent_states_seen),
        "message_types_seen": sorted(message_types_seen),
        "state_to_count": dict(state_to_count),
        "state_to_sample": state_to_sample,
        "num_full_states": len(state_to_count),
        "state_level": state_level,
        "state_parent_level": state_parent_level,
        "state_child_keys": state_child_keys,
    }


def analyze_log_file_indent(log_path: str, max_lines: int = 1000) -> Dict[str, Any]:
    """
    Analyze first max_lines non-empty lines. Returns:
    - space_types_seen: set of space component keys (e.g. "U+0020", "U+00A0")
    - tab_levels_seen: set of tab counts
    - state_to_count: state_key -> number of lines
    - state_to_sample: state_key -> one sample line (stripped, truncated)
    """
    if not os.path.isfile(log_path):
        return {"error": "file not found", "path": log_path}
    space_types_seen = set()
    tab_levels_seen = set()
    state_to_count: Dict[str, int] = defaultdict(int)
    state_to_sample: Dict[str, str] = {}
    n_read = 0
    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if n_read >= max_lines:
                break
            s = line.rstrip("\n\r")
            if not s.strip():
                continue
            n_tabs, space_component, state_key = get_line_indent_state(s)
            tab_levels_seen.add(n_tabs)
            for k in space_component:
                space_types_seen.add(k)
            state_to_count[state_key] += 1
            if state_key not in state_to_sample:
                state_to_sample[state_key] = (s.strip()[:80] + "..." if len(s.strip()) > 80 else s.strip())
            n_read += 1
    return {
        "path": log_path,
        "lines_analyzed": n_read,
        "space_types_seen": sorted(space_types_seen),
        "tab_levels_seen": sorted(tab_levels_seen),
        "state_to_count": dict(state_to_count),
        "state_to_sample": state_to_sample,
    }


def get_space_type_name(code_hex: str) -> str:
    """e.g. 'U+0020' -> 'SPACE', 'U+00A0' -> 'NO-BREAK SPACE'."""
    try:
        code = int(code_hex.replace("U+", ""), 16)
        return SPECIAL_SPACE_NAMES.get(code, code_hex)
    except Exception:
        return code_hex


def _normalize_after_time(after_time: Union[float, datetime, str]) -> float:
    """Convert given time to epoch seconds for comparison with parse_line_timestamp."""
    if isinstance(after_time, (int, float)):
        return float(after_time)
    if isinstance(after_time, datetime):
        return after_time.timestamp()
    if isinstance(after_time, str):
        t = parse_line_timestamp(after_time.strip())
        if t is not None:
            return t
        try:
            dt = datetime.strptime(after_time.strip()[:19], "%Y-%m-%d %H:%M:%S")
            return dt.timestamp()
        except (ValueError, IndexError):
            pass
    raise ValueError("after_time must be float(epoch), datetime, or timestamp string")


def build_blocks_with_time(
    log_path: str, max_lines: int = 0
) -> Dict[str, Any]:
    """
    Scan log and output block structure; each block has head_time (top-level only), prev block info, for time-based slicing.

    Returns blocks: List[Dict] with:
    - head_time: Optional[float], top-level line timestamp (epoch)
    - head_full_key: str
    - head_sample: str
    - children: List[Tuple[str, str]], [(full_key, sample), ...]
    - prev_head_time: Optional[float], previous block top-level time
    - prev_head_key: Optional[str], previous block full_state_key
    """
    if not os.path.isfile(log_path):
        return {"error": "file not found", "path": log_path}
    blocks: List[Dict[str, Any]] = []
    current_head_time: Optional[float] = None
    current_head_key: Optional[str] = None
    current_head_sample: str = ""
    current_children: List[Tuple[str, str]] = []
    prev_head_time: Optional[float] = None
    prev_head_key: Optional[str] = None
    total = 0

    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if max_lines and total >= max_lines:
                break
            s = line.rstrip("\n\r")
            if not s.strip():
                continue
            total += 1
            indent_k, msg_type, full_key = get_full_state(s)
            level = indent_key_to_level(indent_k)
            sample = s.strip()[:100] + ("..." if len(s.strip()) > 100 else "")

            if level == 0:
                if current_head_key is not None:
                    blocks.append({
                        "head_time": current_head_time,
                        "head_full_key": current_head_key,
                        "head_sample": current_head_sample,
                        "children": list(current_children),
                        "prev_head_time": prev_head_time,
                        "prev_head_key": prev_head_key,
                    })
                head_ts = parse_line_timestamp(s.strip())
                prev_head_time = current_head_time
                prev_head_key = current_head_key
                current_head_time = head_ts
                current_head_key = full_key
                current_head_sample = sample
                current_children = []
            else:
                current_children.append((full_key, sample))
        if current_head_key is not None:
            blocks.append({
                "head_time": current_head_time,
                "head_full_key": current_head_key,
                "head_sample": current_head_sample,
                "children": list(current_children),
                "prev_head_time": prev_head_time,
                "prev_head_key": prev_head_key,
            })

    return {"path": log_path, "blocks": blocks, "total_non_empty": total}


def get_blocks_after(
    log_path: str,
    after_time: Union[float, datetime, str],
    max_lines: int = 0,
) -> Dict[str, Any]:
    """
    Read all blocks after after_time and mark relation to blocks before that time.

    Block: top-level line (with timestamp) is block head; following continuation lines are its children. Only blocks with head_time > after_time are "blocks after".

    Relation: if first line after cutoff is a continuation (no timestamp), those lines belong to "old block before time"; or a block's prev_head_* is before time, indicating order relation.
    Returns:
    - blocks_after: all blocks with head_time > after_time (each has head_time, head_full_key, head_sample, children, prev_head_time, prev_head_key)
    - trailing_old_block: if the last block with head_time <= after_time has children, return that block (continuation lines right after cutoff in file belong to this old block)
    - after_time_epoch: epoch value used for after_time
    """
    t_epoch = _normalize_after_time(after_time)
    result = build_blocks_with_time(log_path, max_lines=max_lines)
    if "error" in result:
        return result
    blocks = result["blocks"]
    blocks_after: List[Dict[str, Any]] = []
    trailing_old_block: Optional[Dict[str, Any]] = None
    last_before_idx: Optional[int] = None
    for i, b in enumerate(blocks):
        ht = b.get("head_time")
        if ht is None:
            continue
        if ht > t_epoch:
            blocks_after.append(b)
        else:
            last_before_idx = i
    if last_before_idx is not None and last_before_idx < len(blocks):
        old = blocks[last_before_idx]
        if old.get("children"):
            trailing_old_block = {
                "head_time": old.get("head_time"),
                "head_full_key": old.get("head_full_key"),
                "head_sample": old.get("head_sample"),
                "children": old.get("children", []),
                "note": "Block head time <= given time but its continuation lines appear after it in file; related to old block before time",
            }
    return {
        "path": result["path"],
        "after_time_epoch": t_epoch,
        "blocks_after": blocks_after,
        "trailing_old_block": trailing_old_block,
        "total_blocks": len(blocks),
    }
