# -*- coding: utf-8 -*-
"""
Offset input: top, left, bottom, right four numbers as comma-separated string.
- Loses focus: set to comma-separated top,left,bottom,right; any non-numeric treated as separator and merged.
"""

import re
from typing import Tuple


class OffsetInputHelper:
    """Parse and format four offset values (top, left, bottom, right). Non-numeric → one separator, auto-merged."""

    def __init__(self, min_val: int = -500, max_val: int = 500):
        self.min_val = min_val
        self.max_val = max_val

    def parse(self, raw: str) -> Tuple[int, int, int, int]:
        """Parse raw string to (top, left, bottom, right). Extract numbers; non-numeric treated as one separator and merged."""
        s = (raw or "").strip()
        parts = re.findall(r"-?\d+", s)
        out = []
        for i in range(4):
            try:
                v = int(parts[i]) if i < len(parts) else 0
            except (ValueError, TypeError):
                v = 0
            out.append(max(self.min_val, min(self.max_val, v)))
        return (out[0], out[1], out[2], out[3])

    def format_display(self, raw: str) -> str:
        """Normalize raw to display string 't,l,b,r'. Use after focus loss."""
        t, l, b, r = self.parse(raw)
        return f"{t},{l},{b},{r}"
