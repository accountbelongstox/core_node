# -*- coding: utf-8 -*-
"""
[F0] Pre-judge entry (ROSBOT_FLOW_MERMAID.md F block).
Diagram: F_Entry -> F1 only; F1 No -> B2_HasWin, F1 Yes -> C1_Entry. F2 is entered from A8_Success only.
This module runs F1 only; returns "b1" (go B2) or "c1" (go C1). F2/F3/F4 run after A8_Success in tick driver.
"""
from typing import Literal

from pycore.pyfoundations.color_print import ColorPrint

from d3utils.rosbot_flow_f1_d3_online import run_f1_d3_online


def run_f0_prejudge_entry() -> Literal["b1", "c1"]:
    """[F0] Pre-judge entry: F1 only. F1 No -> B2_HasWin, F1 Yes -> C1_Entry. F2/F3/F4 run from A8 path."""
    ColorPrint.gray("[F0] Pre-judge entry -> F1")
    step = run_f1_d3_online()
    if step == "b1":
        ColorPrint.gray("[F0] F1: D3 not online -> B2_HasWin")
        return "b1"
    ColorPrint.gray("[F0] F1: D3 online -> C1_Entry")
    return "c1"
