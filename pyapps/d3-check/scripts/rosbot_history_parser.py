# -*- coding: utf-8 -*-
"""
RoS-BoT history.txt parser: one big block, under it smaller blocks by indent.

Structure (from log):
- Block start: line = (leading tabs) + optional "YYYY-MM-DD HH:MM:SS[,mmm] INFO - " + (tabs) + "Session" or "Rift".
- Indent = number of leading tabs. Child blocks and direct content both at indent+1.
- Exception: top-level Session ("INFO - Session", no tab before Session): direct content at indent 0.
- Top-level Rift ("INFO - \\tRift"): content at indent 1. Nested "\\tRift", "\\t\\tRift": content at 2, 3, ...
- Content "X Earned: N" belongs to the block whose content_indent equals that line's indent.

Example:
  0 tabs: 2026-02-05 11:00:06 INFO - Session   -> Session block (indent 0, content at 0)
  0 tabs: Gold Earned: ... / Rift keys Earned: 1287   -> Session content
  1 tab:  \\tRift   -> child Rift (indent 1, content at 2)
  2 tabs: \\t\\tGold Earned: ...   -> that Rift's content
"""
from datetime import datetime
from typing import List, Optional, Tuple, Dict


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
    return s[i + 9:].strip().lstrip("-").isdigit()


def _parse_earned(line: str) -> Optional[Tuple[str, int]]:
    s = line.strip()
    if " Earned:" not in s:
        return None
    i = s.rfind(" Earned:")
    if i <= 0:
        return None
    key = s[:i].strip()
    rest = s[i + 9:].strip()
    if not rest.lstrip("-").isdigit():
        return None
    return (key, int(rest))


def _block_start(line: str) -> Optional[Tuple[int, str, Optional[datetime]]]:
    """
    If line starts a block: (indent, "Session"|"Rift", ts or None).
    Block start = (tabs) + optional "DATE INFO - " + (tabs) + "Session" or "Rift".
    """
    lead = _indent(line)
    rest = line[lead:]
    if not rest:
        return None
    ts = None
    if len(rest) > 0 and rest[0].isdigit() and " INFO - " in rest:
        idx = rest.find(" INFO - ")
        if idx >= 0:
            ts = _parse_ts(rest[:idx].strip())
            rest = rest[idx + 8:].lstrip("\t").strip()
    else:
        rest = rest.strip()
    if rest == "Session":
        if lead == 0 and ts is None:
            return None
        return (lead, "Session", ts)
    if rest == "Rift":
        return (lead, "Rift", ts)
    return None


def _content_indent(block_indent: int, kind: str, has_ts: bool) -> int:
    """Direct content of this block is at this indent. Session at 0 with ts: 0; else block_indent+1."""
    if block_indent == 0 and kind == "Session" and has_ts:
        return 0
    return block_indent + 1


class Block:
    """One block: indent, kind (Session|Rift), optional ts, earned dict, children."""
    __slots__ = ("indent", "kind", "ts", "earned", "children")

    def __init__(self, indent: int, kind: str, ts: Optional[datetime] = None):
        self.indent = indent
        self.kind = kind
        self.ts = ts
        self.earned: Dict[str, int] = {}
        self.children: List[Block] = []

    def get(self, key: str, default: int = 0) -> int:
        k = key.replace(" ", "")
        for ek, v in self.earned.items():
            if ek.replace(" ", "") == k:
                return v
        return default


def parse_blocks(lines: List[str]) -> List[Block]:
    """
    Parse lines into a tree of Block. Stack holds (block, content_indent).
    - Block start at indent L: pop until stack[-1].indent < L, add new block, push.
    - Other line at indent I: pop until stack[-1].indent < I. Then if stack and I == stack[-1].content_indent,
      treat as content of stack[-1].block (earned line -> add to block.earned).
    """
    roots: List[Block] = []
    stack: List[Tuple[Block, int]] = []  # (block, content_indent)

    for line in lines:
        i = _indent(line)
        start = _block_start(line)
        if start is not None:
            lead, kind, ts = start
            while stack and stack[-1][0].indent >= lead:
                stack.pop()
            b = Block(lead, kind, ts)
            if not stack:
                roots.append(b)
            else:
                stack[-1][0].children.append(b)
            cindent = _content_indent(lead, kind, ts is not None)
            stack.append((b, cindent))
            continue
        if not stack:
            continue
        block, cindent = stack[-1]
        if _is_earned(line):
            kv = _parse_earned(line)
            if kv:
                if i == cindent:
                    block.earned[kv[0]] = kv[1]
                    continue
                # Session at 0: content at 0 or 1; but "Rift keys" only at indent 0 (indent 1 = inside Rift block).
                session_accept = (i == 0 or (i == 1 and kv[0].replace(" ", "") != "Riftkeys"))
                if block.indent == 0 and block.kind == "Session" and block.ts is not None and session_accept:
                    block.earned[kv[0]] = kv[1]
            continue
        if i < block.indent:
            while stack and stack[-1][0].indent >= i:
                stack.pop()
            if stack and _is_earned(line):
                top_block, cind = stack[-1]
                kv = _parse_earned(line)
                if kv:
                    allow = i == cind or (top_block.indent == 0 and top_block.kind == "Session" and top_block.ts is not None and (i == 0 or (i == 1 and kv[0].replace(" ", "") != "Riftkeys")))
                    if allow:
                        top_block.earned[kv[0]] = kv[1]
            continue
        if i > cindent:
            while stack and stack[-1][1] > i:
                stack.pop()
            if stack and _is_earned(line):
                top_block, cind = stack[-1]
                kv = _parse_earned(line)
                if kv:
                    allow = i == cind or (top_block.indent == 0 and top_block.kind == "Session" and top_block.ts is not None and (i == 0 or (i == 1 and kv[0].replace(" ", "") != "Riftkeys")))
                    if allow:
                        top_block.earned[kv[0]] = kv[1]

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


def current_session_earned(roots: List[Block], at_or_before_ts: datetime) -> Optional[Tuple[Block, Dict[str, int]]]:
    sessions = session_blocks_with_ts(roots)
    cand = [(ts, b) for ts, b in sessions if ts <= at_or_before_ts]
    if not cand:
        return None
    _, b = max(cand, key=lambda x: x[0])
    return (b, b.earned)
