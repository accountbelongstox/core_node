# -*- coding: utf-8 -*-
"""
E – ROSBOT run flow (ROSBOT_FLOW_MERMAID.md).
All E-block steps defined here for alignment with doc.
E1 -> E2 -> E3 -> E3a-E3f or E4 -> E5 -> E5a1-E5a5 -> E6 -> F3.
"""
import time
from enum import Enum
from typing import Callable, Any

from providor.providor_index import CONFIG

from d3utils.rosbot_manager import get_rosbot_manager


class EBlockStep(str, Enum):
    """E block steps (ROSBOT_FLOW_MERMAID.md E ROSBOT run flow)."""
    E1_Kill = "E1_Kill"
    E2_Sleep = "E2_Sleep"
    E3_StartRosbot = "E3_StartRosbot"
    E3a_FindZip = "E3a_FindZip"
    E3b_Newer = "E3b_Newer"
    E3c_Extract = "E3c_Extract"
    E3d_CopyConfig = "E3d_CopyConfig"
    E3e_UpdatePath = "E3e_UpdatePath"
    E3f_Launch = "E3f_Launch"
    E4_Start = "E4_Start"
    E5_Init = "E5_Init"
    E5a_WaitWin = "E5a_WaitWin"
    E5a_WaitSrv = "E5a_WaitSrv"
    E5a_PollUI = "E5a_PollUI"
    E5a_ClickProfile = "E5a_ClickProfile"
    E5a_ClickStart = "E5a_ClickStart"
    E6_Done = "E6_Done"


def run_e1_kill() -> None:
    """[E1] Kill existing ROSBOT."""
    get_rosbot_manager().kill_if_running()


def run_e2_sleep(seconds: float = 1.0) -> None:
    """[E2] Sleep (default 1s)."""
    time.sleep(seconds)


def run_e3_config_check() -> bool:
    """[E3] Start ROSBOT? (config auto_start_rosbot). Diagram: No/skip -> E4; Yes -> E3a (zip update, TODO). Returns True if should start."""
    return bool(CONFIG.get("ros_settings", {}).get("auto_start_rosbot", True))


def run_e4_start() -> bool:
    """[E4] Start ROSBOT process. Returns True if started."""
    return get_rosbot_manager().start()


def run_e5_init(start_rosbot_task_fn: Callable[[], Any]) -> None:
    """[E5] Task init: start_rosbot_task (log file, set_rosbot_running, etc.)."""
    start_rosbot_task_fn()


def run_e5a_wait_win_srv_poll_click(run_after_rosbot_start_fn: Callable[..., Any], **kwargs: Any) -> None:
    """[E5a1-E5a5] Wait window, wait server, poll UI, click main profile, click Start botting!. Delegates to run_after_rosbot_start."""
    run_after_rosbot_start_fn(**kwargs)


def run_e6_done() -> None:
    """[E6] Main thread wrap-up, log. Caller (panel) enables periodic task and updates UI."""
    pass
