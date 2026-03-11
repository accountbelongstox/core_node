# -*- coding: utf-8 -*-
"""
[F2] Is ROSBOT online? (ROSBOT_FLOW_MERMAID.md F block).
Diagram: entered from A8_Success. F2 No -> E1_Kill, F2 Yes -> F3_LogTimeout.
Uses same logic as UI: refresh_rosbot_status() then game_interface_data.rosbot_extended_status.
"""
from typing import Literal

from share.game_interface_data import get_game_interface_data
from d3utils.rosbot_status_provider import refresh_rosbot_status


def run_f2_rosbot_online() -> Literal["c1", "f3"]:
    """[F2] Is ROSBOT online? No -> E1, Yes -> F3. Same source as UI: refresh then read rosbot_extended_status (running|paused = online)."""
    refresh_rosbot_status()
    status = get_game_interface_data().rosbot_extended_status
    if status in ("running", "paused"):
        return "f3"
    return "c1"
