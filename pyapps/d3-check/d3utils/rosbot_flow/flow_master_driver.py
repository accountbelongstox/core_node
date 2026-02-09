# -*- coding: utf-8 -*-
"""
Flow-master flow library (ROSBOT flow master, flow_master_enabled).

Contract (docs/FLOW_ARCHITECTURE_DIRECTORY.md §5):
- Defines: FlowMasterStep, F0Action, ExtensionStepResult; last F0/extension/F3 state; tick_flow_master().
- Uses extension_flow_state for phase (is_idle); does not duplicate extension phase enum.
- Tick entry (rosbot_task_processor) only calls tick_flow_master(); this module calls refresh/notify and third-party libs.
"""
from enum import Enum
from typing import Callable, Optional

from pycore.pyfoundations.color_print import ColorPrint

from share.game_interface_data import get_game_interface_data
from d3utils.rosbot_flow_state import get_flow_master_enabled
from d3utils.d3_manager import get_d3_manager
from d3utils.d3_status_provider import refresh_d3_status
from d3utils.battlenet_status_provider import refresh_battlenet_status
from d3utils.rosbot_status_provider import refresh_rosbot_status
from d3utils.rosbot_flow_battlenet import tick_battlenet_ready_flow
from d3utils.rosbot_flow.flow_bn_block_state import (
    get_bn_flow_ever_confirmed,
    set_battlenet_tick_confirmed,
    enter_battlenet_at_b2,
)
_FM_BN = False  # Flow-master uses for_bn_only=False
from d3utils.rosbot_flow_f0_entry import run_f0_prejudge_entry
from d3utils.rosbot_flow_f3_log_timeout import run_f3_log_timeout
from d3utils.rosbot_flow_f4_close_d3_send_f7 import run_f4_close_d3_send_f7
from d3utils.rosbot_flow.extension_flow_state import is_idle as extension_flow_is_idle
from d3utils.rosbot_flow.extension_flow_tick_step import (
    extension_flow_tick_step,
    start_extension_flow_c_branch,
)
from d3utils.event_center import trigger_extension_rosbot_start
from d3utils.event_signals import trigger_extension_rosbot_started


class FlowMasterStep(str, Enum):
    """All steps executed within one flow-master tick (order depends on branch)."""
    REFRESH_NOTIFY = "refresh_notify"
    RE_READ_ABORT = "re_read_abort"
    EXTENSION_TICK = "extension_tick"
    F0_PREJUDGE = "f0_prejudge"
    F0_ACTION_B1 = "f0_action_b1"
    F0_ACTION_B2 = "f0_action_b2"
    F0_ACTION_C1 = "f0_action_c1"
    F0_C1_EXTENSION = "f0_c1_extension"
    F3_F4 = "f3_f4"


class FBlockStep(str, Enum):
    """F block steps (ROSBOT_FLOW_MERMAID.md F pre-judge)."""
    F_Entry = "F_Entry"             # F0 pre-judge entry
    F1_HasD3 = "F1_HasD3"           # F1 is D3 online?
    F1c_EndD3 = "F1c_EndD3"        # F1c end D3 process
    F1d_Offline = "F1d_Offline"    # F1d detected disconnect
    F2_RosbotOnline = "F2_RosbotOnline"  # F2 is ROSBOT online?
    F3_LogTimeout = "F3_LogTimeout"      # F3 log timeout?
    F4a_EndD3 = "F4a_EndD3"        # F4a close D3
    F4b_SendF7 = "F4b_SendF7"      # F4b send F7 to system to close ROSBOT


class F0Action(str, Enum):
    """F0 pre-judge return value from run_f0_prejudge_entry()."""
    B1 = "b1"
    B2 = "b2"
    C1 = "c1"


class ExtensionStepResult(str, Enum):
    """extension_flow_tick_step() return value."""
    SUCCESS = "success"
    FALLTHROUGH = "fallthrough"


# --- State owned by this flow library (updated from third-party return values) ---
_last_f0_action: Optional[str] = None
_last_extension_result: Optional[str] = None
_last_f3_result: Optional[str] = None


def get_last_f0_action() -> Optional[str]:
    return _last_f0_action


def get_last_extension_result() -> Optional[str]:
    return _last_extension_result


def get_last_f3_result() -> Optional[str]:
    return _last_f3_result


def _set_last_f0_action(action: Optional[str]) -> None:
    global _last_f0_action
    _last_f0_action = action


def _set_last_extension_result(result: Optional[str]) -> None:
    global _last_extension_result
    _last_extension_result = result


def _set_last_f3_result(result: Optional[str]) -> None:
    global _last_f3_result
    _last_f3_result = result


def tick_flow_master(tick_count: int, start_rosbot_task: Callable[[], None]) -> None:
    """
    Run one tick of the flow-master flow. Executes steps in order; updates state from
    third-party return values. All steps and state are defined in this module.
    """
    # Step: REFRESH_NOTIFY
    try:
        ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.REFRESH_NOTIFY.value}: refresh_battlenet_status...")
        refresh_battlenet_status()
        if get_bn_flow_ever_confirmed(_FM_BN):
            ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.REFRESH_NOTIFY.value}: refresh_d3_status, refresh_rosbot_status...")
            refresh_d3_status()
            refresh_rosbot_status()
        g = get_game_interface_data()
        g.notify_state_sync()
    except Exception as e:
        ColorPrint.red(f"[FlowMaster] step={FlowMasterStep.REFRESH_NOTIFY.value} error: {e}")
        return

    # Step: RE_READ_ABORT
    if not get_flow_master_enabled():
        return

    # Step: EXTENSION_TICK (if extension not idle)
    ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.EXTENSION_TICK.value} (if not idle)")
    if not extension_flow_is_idle():
        result = extension_flow_tick_step(tick_count, start_rosbot_task)
        _set_last_extension_result(result)
        if result == ExtensionStepResult.SUCCESS.value:
            trigger_extension_rosbot_started(True, ran_e_block=False)
            return
        if result == ExtensionStepResult.FALLTHROUGH.value:
            trigger_extension_rosbot_started(False, ran_e_block=False)
            return

    # Step: F0_PREJUDGE
    ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.F0_PREJUDGE.value}: run_f0_prejudge_entry...")
    action = run_f0_prejudge_entry()
    _set_last_f0_action(action)
    ColorPrint.gray(f"[FlowMaster] F0 pre-judge -> {action} (b1=B2, c1=C1, b2=enter B2)")

    if action == F0Action.B1.value:
        # Step: F0_ACTION_B1
        ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.F0_ACTION_B1.value}: tick_battlenet_ready_flow(no_activate=False)...")
        done, result = tick_battlenet_ready_flow(no_activate=False)
        if done and result == "confirmed":
            set_battlenet_tick_confirmed(_FM_BN)
            trigger_extension_rosbot_start()()
    elif action == F0Action.B2.value:
        # Step: F0_ACTION_B2
        ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.F0_ACTION_B2.value}: enter_battlenet_at_b2...")
        enter_battlenet_at_b2(_FM_BN)
    elif action == F0Action.C1.value:
        # Step: F0_ACTION_C1 / F0_C1_EXTENSION
        if extension_flow_is_idle() and get_bn_flow_ever_confirmed(_FM_BN) and get_d3_manager().is_running():
            ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.F0_C1_EXTENSION.value}: start_extension_flow_c_branch, extension_flow_tick_step...")
            start_extension_flow_c_branch()
            step_result = extension_flow_tick_step(tick_count, start_rosbot_task)
            _set_last_extension_result(step_result)
            if step_result == ExtensionStepResult.SUCCESS.value:
                trigger_extension_rosbot_started(True, ran_e_block=False)
                return
            if step_result == ExtensionStepResult.FALLTHROUGH.value:
                trigger_extension_rosbot_started(False, ran_e_block=False)
                return
        else:
            ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.F0_ACTION_C1.value}: trigger_extension_rosbot_start...")
            trigger_extension_rosbot_start()

    # Step: F3_F4 (when ROSBOT extended running/paused)
    g = get_game_interface_data()
    if g.rosbot_extended_status in ("running", "paused"):
        ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.F3_F4.value}: run_f3_log_timeout...")
        step = run_f3_log_timeout()
        _set_last_f3_result(step)
        if step == "f4":
            ColorPrint.gray("[FlowMaster] F3: log timeout -> F4 -> B2_HasWin")
            run_f4_close_d3_send_f7()
            enter_battlenet_at_b2(_FM_BN)
