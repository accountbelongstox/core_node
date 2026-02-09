# -*- coding: utf-8 -*-
"""
[F1] Is D3 online? (ROSBOT_FLOW_MERMAID.md F block).
Diagram: F1 No -> B2_HasWin, F1 Yes -> C1_Entry.
Returns "b2" (go to B2) or "c1" (go to C1). Code uses "b1"/"f2" internally for F0 chain.
"""
from typing import Literal

from d3utils.d3_manager import get_d3_manager


def run_f1_d3_online() -> Literal["b1", "f2"]:
    """[F1] Is D3 online? No -> B2_HasWin (caller uses b1->enter B2), Yes -> C1_Entry (caller uses f2->may run F2 or c1)."""
    has_d3 = get_d3_manager().is_running()
    if has_d3:
        return "f2"
    return "b1"
