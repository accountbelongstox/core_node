# -*- coding: utf-8 -*-
"""
[F1] Is D3 online? (ROSBOT_FLOW_MERMAID.md F block).
Diagram: F1 No -> B2_HasWin, F1 Yes -> C1_Entry.
使用本 tick 已刷新的 d3_running，避免重复 find_windows（切面：F0 前只做 D3 轻量刷新）。
"""
from typing import Literal

from share.game_interface_data import get_game_interface_data


def run_f1_d3_online() -> Literal["b1", "f2"]:
    """[F1] Is D3 online? 读本 tick refresh_d3_status(light) 写入的 d3_running。No -> B2_HasWin, Yes -> C1_Entry."""
    has_d3 = get_game_interface_data().d3_running
    if has_d3:
        return "f2"
    return "b1"
