# -*- coding: utf-8 -*-
"""
C - D3 already running direct (ROSBOT_FLOW_MERMAID.md).
All C-block step names for diagram alignment; phase state in extension_flow_state.ExtensionPhase.
"""
from enum import Enum
from typing import Optional

from providor.providor_index import DIABLO_III_WINDOW_TITLES


class CBlockStep(str, Enum):
    """C block steps (ROSBOT_FLOW_MERMAID.md C D3 already running direct)."""
    C1_Entry = "C1_Entry"
    C2_Resize = "C2_Resize"
    C3_Step = "C3_Step"
    C3_Result = "C3_Result"
    C3_GameToolOrigin = "C3_GameToolOrigin"  # Just entered game (D13) or already in game at start (F1) -> skip C6/C10 or C6->C10
    C3w_Wait = "C3w_Wait"
    C5_StartGame = "C5_StartGame"
    C5w_Wait = "C5w_Wait"
    C6_GameTool = "C6_GameTool"
    C7a_PressM = "C7a_PressM"
    C7w_Wait = "C7w_Wait"
    C7b_Teleport = "C7b_Teleport"
    C8_Result = "C8_Result"
    C10_Check = "C10_Check"
    C10_Result = "C10_Result"
    C12_EndD3 = "C12_EndD3"


from providor.constants.d3 import D3_STANDARD_RESOLUTION_WIDTH, D3_STANDARD_RESOLUTION_HEIGHT
from pycore.pyutils.common.window_finder import WindowFinder

from d3utils.window_resizer import resize_window_by_titles_to_client_size
from d3utils.d3_manager import get_d3_manager
from d3utils.d3_start_game_and_teleport_waiter import (
    detect_d3_already_running_state,
    check_d3_online_by_m_similarity,
    try_fragment1_click_start_game_wait_game_tool,
    try_fragment2_game_tool_press_m_then_clicks,
    send_m_then_teleport_three_clicks,
)
from d3utils.rosbot_flow.flow_f1c_f1d import run_f1d_on_disconnect, run_f1c_end_d3


def run_c1_entry(has_bn_confirmed: bool, has_d3_process: bool) -> bool:
    """[C1] Entry. Returns True if C branch should run (BN confirmed + D3 process exists)."""
    return bool(has_bn_confirmed and has_d3_process)


def run_c2_resize() -> None:
    """[C2] Resize D3 window to standard resolution."""
    resize_window_by_titles_to_client_size(
        DIABLO_III_WINDOW_TITLES,
        D3_STANDARD_RESOLUTION_WIDTH,
        D3_STANDARD_RESOLUTION_HEIGHT,
    )
    WindowFinder.invalidate_window_cache(list(DIABLO_III_WINDOW_TITLES))


def run_c3_screenshot_state():
    """[C3] One step: screenshot -> match (all templates). Branch on start/game_tool/disconnected; wait on connecting/alt; else no-match. On timeout caller calls once more for final full detection."""
    return detect_d3_already_running_state()


def run_c4_branch_result(state: Optional[str]) -> str:
    """
    [C3_Result] Branch on C3_Step result. Returns: 'start'|'game_tool'|'disconnect'|'wait'|'other'.
    disconnect -> F1d_Offline (caller runs F1d then F1c). start -> C5_StartGame. game_tool -> C6_GameTool.
    wait -> C3w_Wait (caller loops). other -> C12_EndD3.
    """
    if state == "disconnect":
        return "disconnect"
    if state == "wait":
        return "wait"
    if state == "game_tool":
        if not check_d3_online_by_m_similarity():  # [C10a/C10b] screenshot, M, screenshot, similarity
            return "disconnect"
        return "game_tool"
    if state == "start":
        return "start"
    return "other"


def run_c12_end_d3() -> None:
    """[C12] End D3 process, enter D flow."""
    get_d3_manager().kill_if_running()


def run_c4_disconnect_then_f1d_f1c() -> None:
    """When C4 detects disconnect: F1d then F1c (ROSBOT_FLOW_MERMAID)."""
    run_f1d_on_disconnect()
    run_f1c_end_d3()


# C5/C5w: try_fragment1_click_start_game_wait_game_tool
# C6/C7a-C8: try_fragment2_game_tool_press_m_then_clicks, send_m_then_teleport_three_clicks
# Callers use d3_start_game_and_teleport_waiter directly for C5, C6, C7, C8.
