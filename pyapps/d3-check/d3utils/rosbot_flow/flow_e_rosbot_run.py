# -*- coding: utf-8 -*-
"""
E – ROSBOT run flow (ROSBOT_FLOW_MERMAID.md).
All E-block steps defined here for alignment with doc.
E1 -> E2 -> E3 -> E3a-E3f or E4 -> E5 -> E5a1-E5a5 -> E6 -> F3.
"""
import time
from enum import Enum
from typing import Callable, Any, Optional, Tuple

from pycore.pyfoundations.color_print import ColorPrint
from providor.providor_index import CONFIG

from d3utils.rosbot_flow_f3_baseline import set_f3_rosbot_started_at
from d3utils.rosbot_manager import get_rosbot_manager
from d3utils.rosbot_update_check import run_rosbot_update_check, apply_rosbot_update


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
    """[E2] Sleep (default 1s). Non-tick thread only (extension thread); short sleep for process/UI stability per §4.1 exception."""
    time.sleep(seconds)


def run_e3_config_check() -> bool:
    """[E3] Start ROSBOT? (config auto_start_rosbot). Diagram: No/skip -> E4; Yes -> E3a (zip update). Returns True if should start."""
    return bool(CONFIG.get("ros_settings", {}).get("auto_start_rosbot", True))


def run_e3_update_flow(
    ask_confirm_callback: Optional[Callable[[str, Optional[str], str], bool]] = None,
) -> Tuple[bool, bool]:
    """
    [E3a-E3f] When config auto_enable_latest_ros: E3a find zip -> E3b newer? -> (confirm) -> E3c-E3e extract/copy ini/update path -> E3f proceed.
    ask_confirm_callback(zip_path, version_str, region) -> True to apply, False to skip. When None, apply without confirm (e.g. extension thread).
    Returns (proceed_to_e4, did_update).
    """
    if not CONFIG.get("ros_settings", {}).get("auto_enable_latest_ros", True):
        return (run_e3_config_check(), False)
    zip_path, is_newer, version_str, region = run_rosbot_update_check()
    if not is_newer or not zip_path or not region:
        return (run_e3_config_check(), False)
    if ask_confirm_callback is not None and not ask_confirm_callback(zip_path, version_str or "", region):
        ColorPrint.gray("[E3] User skipped update, proceed to E4 with current path")
        return (run_e3_config_check(), False)
    ColorPrint.blue("[E3] E3c-E3e apply update: extract, copy RoS-BoT.ini, update ros_directory")
    if not apply_rosbot_update(zip_path, region, version_str):
        ColorPrint.yellow("[E3] apply_rosbot_update failed, proceed to E4 with current path")
        return (run_e3_config_check(), False)
    ColorPrint.green("[E3] E3f update applied, ros_directory refreshed")
    return (run_e3_config_check(), True)


def run_e4_start() -> bool:
    """[E4] Start ROSBOT process. Returns True if started."""
    ok = get_rosbot_manager().start()
    if ok:
        set_f3_rosbot_started_at()
    return ok


def run_e5_init(start_rosbot_task_fn: Callable[[], Any]) -> None:
    """[E5] Task init: start_rosbot_task (file path, set_rosbot_running, etc.)."""
    start_rosbot_task_fn()


def run_e5a_wait_win_srv_poll_click(run_after_rosbot_start_fn: Callable[..., Any], **kwargs: Any) -> None:
    """[E5a1-E5a5] Wait window, wait server, poll UI, click main profile, click Start botting!. Delegates to run_after_rosbot_start."""
    run_after_rosbot_start_fn(**kwargs)


def run_e6_done() -> None:
    """[E6] Main thread wrap-up. Caller (panel) enables periodic task and updates UI."""
    pass
