# -*- coding: utf-8 -*-
"""
[F1] Is D3 online? (ROSBOT_FLOW_MERMAID.md F block).
Diagram: F1 No -> B2_HasWin, F1 Yes -> C1_Entry.
Uses d3_running already refreshed this tick to avoid duplicate find_windows (F0 does light D3 refresh only).
"""
from typing import Literal

from share.game_interface_data import get_game_interface_data


def run_f1_d3_online() -> Literal["b1", "f2"]:
    """[F1] Is D3 online? Reads d3_running written by this tick's refresh_d3_status(light). No -> B2_HasWin, Yes -> C1_Entry."""
    has_d3 = get_game_interface_data().d3_running
    if has_d3:
        return "f2"
    return "b1"
