# -*- coding: utf-8 -*-
"""
RoS-BoT history.txt parser: blocks by leading TAB and content_indent.
Approach 1 (TAB + content_indent stack): Session/Rift/Step blocks, Success or Sucess + Duration,
4-tab repeat lines do not create new blocks.

Structure (from log):
- Block start: (leading tabs) + optional "YYYY-MM-DD HH:MM:SS[,mmm] INFO - " + (tabs) + "Session" | "Rift" | step name.
- Step names (fixed): Open Rift Invalid, Do Rift Invalid, Kill Boss Invalid, RiftItem Invalid, Urshi Invalid, Talk to Orek Invalid.
- Indent = number of leading tabs. Content at block_indent+1; Session with ts at 0 has content at 0.
- 4-tab line with same content as current step: repeat only, do not push new block.
- "Success: True|" / "Sucess: True|" / "Success: False|" + " Duration: HH:MM:SS.fffffff" parsed and stored on current block.
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

# Step names (fixed suffix " Invalid"); order does not matter for matching.
STEP_NAMES = (
    "Open Rift Invalid",
    "Do Rift Invalid",
    "Kill Boss Invalid",
    "RiftItem Invalid",
    "Urshi Invalid",
    "Talk to Orek Invalid",
)

# Success/Sucess + Duration: accept both spellings.
_SUCCESS_DURATION_RE = re.compile(
    r"^\s*(?:Success|Sucess)\s*:\s*(True|False)\s*\|\s*Duration:\s*(\d{2}:\d{2}:\d{2}\.\d+)\s*$",
    re.IGNORECASE,
)


def _indent(line: str) -> int:
    n = 0
    for c in line:
        if c != "\t":
            break
        n += 1
    return n


def _parse_ts(s: str) -> Optional[datetime]:
    s = s.strip()
    if len(s) < 19:
        return None
    if s[4] == "-" and s[7] == "-" and s[10] == " " and s[13] == ":" and s[16] == ":":
        try:
            if len(s) >= 23 and s[19] == ",":
                return datetime.strptime(s[:23], "%Y-%m-%d %H:%M:%S,%f")
            return datetime.strptime(s[:19], "%Y-%m-%d %H:%M:%S")
        except ValueError:
            pass
    return None


def _is_earned(line: str) -> bool:
    s = line.strip()
    if " Earned:" not in s:
        return False
    i = s.rfind(" Earned:")
    if i <= 0 or i + 9 >= len(s):
        return False
    return s[i + 9 :].strip().lstrip("-").isdigit()


def _parse_earned(line: str) -> Optional[Tuple[str, int]]:
    s = line.strip()
    if " Earned:" not in s:
        return None
    i = s.rfind(" Earned:")
    if i <= 0:
        return None
    key = s[:i].strip()
    rest = s[i + 9 :].strip()
    if not rest.lstrip("-").isdigit():
        return None
    return (key, int(rest))


def _block_start(line: str) -> Optional[Tuple[int, str, Optional[datetime], Optional[str]]]:
    """
    If line starts a block: (indent, "Session"|"Rift"|"Step", ts or None, step_name or None).
    Step names are fixed (e.g. Open Rift Invalid, Do Rift Invalid).
    """
    lead = _indent(line)
    rest = line[lead:]
    if not rest:
        return None
    ts = None
    if len(rest) > 0 and rest[0].isdigit() and " INFO - " in rest:
        idx = rest.find(" INFO - ")
        if idx >= 0:
            ts = _parse_ts(rest[: idx].strip())
            rest = rest[idx + 8 :].lstrip("\t").strip()
    else:
        rest = rest.strip()
    if rest == "Session":
        if lead == 0 and ts is None:
            return None
        return (lead, "Session", ts, None)
    if rest == "Rift":
        return (lead, "Rift", ts, None)
    for name in STEP_NAMES:
        if rest == name:
            return (lead, "Step", None, name)
    return None


def _content_indent(block_indent: int, kind: str, has_ts: bool) -> int:
    """Direct content of this block is at this indent. Session at 0 with ts: 0; else block_indent+1."""
    if block_indent == 0 and kind == "Session" and has_ts:
        return 0
    return block_indent + 1


def _parse_success_duration(line: str) -> Optional[Tuple[bool, str]]:
    """Return (success_bool, duration_str) or None. Accepts Success and Sucess."""
    m = _SUCCESS_DURATION_RE.match(line.strip())
    if not m:
        return None
    return (m.group(1).lower() == "true", m.group(2))


class Block:
    """One block: indent, kind (Session|Rift|Step), optional ts, earned dict, children; optional success, duration, step_name, entry_ts (epoch seconds for time-window filter)."""

    __slots__ = ("indent", "kind", "ts", "earned", "children", "success", "duration", "step_name", "entry_ts")

    def __init__(self, indent: int, kind: str, ts: Optional[datetime] = None, step_name: Optional[str] = None):
        self.indent = indent
        self.kind = kind
        self.ts = ts
        self.earned: Dict[str, int] = {}
        self.children: List[Block] = []
        self.success: Optional[bool] = None
        self.duration: Optional[str] = None
        self.step_name: Optional[str] = step_name
        self.entry_ts: Optional[float] = None  # epoch seconds of the log entry this block belongs to

    def get(self, key: str, default: int = 0) -> int:
        k = key.replace(" ", "")
        for ek, v in self.earned.items():
            if ek.replace(" ", "") == k:
                return v
        return default


def _is_4tab_repeat(line: str, indent: int, stack: List[Tuple[Block, int]], last_stripped: Optional[str]) -> bool:
    """True if line is 4-tab and content is repeat of current step or last line (do not push new block)."""
    if indent != 4:
        return False
    stripped = line.strip()
    if not stripped:
        return False
    if stack and stack[-1][0].kind == "Step" and stack[-1][0].step_name == stripped:
        return True
    if last_stripped is not None and stripped == last_stripped:
        return True
    if stripped in STEP_NAMES:
        return True
    return False


def parse_blocks(lines: List[str]) -> List[Block]:
    """
    Parse lines into a tree of Block. Stack holds (block, content_indent).
    - Block start at indent L: pop until stack[-1].indent < L, add new block, push (unless 4-tab repeat).
    - 4-tab line that repeats current step or same content: skip (no new block).
    - Success/Sucess + Duration: set current block's success and duration.
    - Earned lines: add to block.earned by content_indent.
    """
    roots: List[Block] = []
    stack: List[Tuple[Block, int]] = []
    last_stripped: Optional[str] = None

    for line in lines:
        i = _indent(line)
        stripped = line.strip()

        start = _block_start(line)
        if start is not None:
            lead, kind, ts, step_name = start
            if _is_4tab_repeat(line, i, stack, last_stripped):
                last_stripped = stripped
                continue
            while stack and stack[-1][0].indent >= lead:
                stack.pop()
            b = Block(lead, kind, ts, step_name)
            if ts is not None:
                b.entry_ts = ts.timestamp()
            elif stack:
                b.entry_ts = getattr(stack[-1][0], "entry_ts", None)
            if not stack:
                roots.append(b)
            else:
                stack[-1][0].children.append(b)
            cindent = _content_indent(lead, kind, ts is not None)
            stack.append((b, cindent))
            last_stripped = stripped
            continue

        sd = _parse_success_duration(line)
        if sd is not None and stack:
            stack[-1][0].success, stack[-1][0].duration = sd
            last_stripped = stripped
            continue

        if not stack:
            last_stripped = stripped
            continue

        if _is_4tab_repeat(line, i, stack, last_stripped):
            last_stripped = stripped
            continue

        block, cindent = stack[-1]
        if _is_earned(line):
            kv = _parse_earned(line)
            if kv:
                if i == cindent:
                    block.earned[kv[0]] = kv[1]
                    last_stripped = stripped
                    continue
                session_accept = (
                    i == 0 or (i == 1 and kv[0].replace(" ", "") != "Riftkeys")
                )
                if (
                    block.indent == 0
                    and block.kind == "Session"
                    and block.ts is not None
                    and session_accept
                ):
                    block.earned[kv[0]] = kv[1]
            last_stripped = stripped
            continue
        if i < block.indent:
            while stack and stack[-1][0].indent >= i:
                stack.pop()
            if stack and _is_earned(line):
                top_block, cind = stack[-1]
                kv = _parse_earned(line)
                if kv:
                    allow = (
                        i == cind
                        or (
                            top_block.indent == 0
                            and top_block.kind == "Session"
                            and top_block.ts is not None
                            and (i == 0 or (i == 1 and kv[0].replace(" ", "") != "Riftkeys"))
                        )
                    )
                    if allow:
                        top_block.earned[kv[0]] = kv[1]
            last_stripped = stripped
            continue
        if i > cindent:
            while stack and stack[-1][1] > i:
                stack.pop()
            if stack and _is_earned(line):
                top_block, cind = stack[-1]
                kv = _parse_earned(line)
                if kv:
                    allow = (
                        i == cind
                        or (
                            top_block.indent == 0
                            and top_block.kind == "Session"
                            and top_block.ts is not None
                            and (i == 0 or (i == 1 and kv[0].replace(" ", "") != "Riftkeys"))
                        )
                    )
                    if allow:
                        top_block.earned[kv[0]] = kv[1]
        last_stripped = stripped

    return roots


def parse_history_lines(lines: List[str]) -> List[Block]:
    return parse_blocks(lines)


def session_blocks_with_ts(roots: List[Block]) -> List[Tuple[datetime, Block]]:
    out: List[Tuple[datetime, Block]] = []

    def walk(nodes: List[Block]) -> None:
        for b in nodes:
            if b.kind == "Session" and b.ts is not None:
                out.append((b.ts, b))
            walk(b.children)

    walk(roots)
    out.sort(key=lambda x: x[0])
    return out


def baseline_rifkeys_sum(sessions: List[Tuple[datetime, Block]], before_ts: datetime) -> Optional[int]:
    total = 0
    found = False
    for ts, b in sessions:
        if ts >= before_ts:
            continue
        found = True
        total += b.get("Rift keys")
    return total if found else None


def current_session_earned(
    roots: List[Block], at_or_before_ts: datetime
) -> Optional[Tuple[Block, Dict[str, int]]]:
    sessions = session_blocks_with_ts(roots)
    cand = [(ts, b) for ts, b in sessions if ts <= at_or_before_ts]
    if not cand:
        return None
    _, b = max(cand, key=lambda x: x[0])
    return (b, b.earned)


def last_rift_block_with_earned(
    roots: List[Block], min_entry_ts: Optional[float] = None
) -> Optional[Block]:
    """
    Return the last Rift or Step block (in document order) that has at least one earned entry.
    If min_entry_ts is set, prefer blocks with entry_ts >= min_entry_ts; if none (e.g. tail chunk
    has no 0-tab timestamp so all entry_ts are None), fall back to last block regardless.
    """
    rifts_in_window: List[Block] = []
    rifts_any: List[Block] = []

    def collect(nodes: List[Block]) -> None:
        for b in nodes:
            if b.kind in ("Rift", "Step") and b.earned:
                rifts_any.append(b)
                if min_entry_ts is None:
                    rifts_in_window.append(b)
                else:
                    et = getattr(b, "entry_ts", None)
                    if et is not None and et >= min_entry_ts:
                        rifts_in_window.append(b)
            collect(b.children)

    collect(roots)
    if rifts_in_window:
        return rifts_in_window[-1]
    return rifts_any[-1] if rifts_any else None
