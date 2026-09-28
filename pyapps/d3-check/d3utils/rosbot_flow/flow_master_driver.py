# -*- coding: utf-8 -*-
"""
Flow-master flow library (ROSBOT flow master, flow_master_enabled).

Contract (docs/FLOW_ARCHITECTURE_DIRECTORY.md §5):
- Defines: FlowMasterStep, F0Action, ExtensionStepResult; last F0/extension/F3 state; tick_flow_master().
- Uses extension_flow_state for phase (is_idle); does not duplicate extension phase enum.
- Tick entry (rosbot_task_processor) only calls tick_flow_master(); this module calls refresh/notify and third-party libs.

Architecture (ROSBOT_FLOW_MERMAID): after teleport enter ROSBOT startup env, then only F3 timeout loop.
- Gate: when D3 and ROSBOT both present (running/paused) -> F3 timeout only, never run C branch (no extension_flow_tick_step).
- Each tick: routing refresh (light D3 + ROSBOT) first, then branch by state: F3-only -> extension (C branch) -> F0 (B1/B2/C1).
"""
from enum import Enum
from typing import Callable, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from share.game_interface_data import get_game_interface_data
from d3utils.rosbot_flow_state import get_flow_master_enabled
from d3utils.d3_status_provider import _refresh_d3_status_internal
from d3utils.battlenet_status_provider import _refresh_battlenet_status_internal
from d3utils.rosbot_status_provider import _refresh_rosbot_status_internal
from d3utils.rosbot_flow_battlenet import tick_battlenet_ready_flow
from d3utils.rosbot_flow.flow_bn_block_state import (
    get_bn_flow_ever_confirmed,
    set_battlenet_tick_confirmed,
    enter_battlenet_at_b2,
)
_FM_BN = False  # Flow-master uses for_bn_only=False
from d3utils.rosbot_flow_f0_entry import run_f0_prejudge_entry
from d3utils.rosbot_flow_f3_log_timeout import run_f3_log_timeout, get_last_f3_short_status
from d3utils.f3_refresh_line import (
    set_f3_refresh_silent,
    build_f3_only_refresh_line,
)
from d3utils.rosbot_flow_f4_close_d3_send_f7 import run_f4_close_d3_send_f7
from d3utils.rosbot_flow_rosbot_exit_state import increment_total_restart_count
from d3utils.rosbot_flow.extension_flow_state import (
    is_idle as extension_flow_is_idle,
    reset_state as extension_reset_state,
    is_in_action_group,
)
from d3utils.rosbot_flow.extension_flow_tick_step import (
    extension_flow_tick_step,
    start_extension_flow_c_branch,
)
from d3utils.event_center import trigger_extension_rosbot_start
from d3utils.event_signals import trigger_extension_rosbot_started


class FlowMasterStep(str, Enum):
    """All steps executed within one flow-master tick (order depends on branch)."""
    RE_READ_ABORT = "re_read_abort"
    REFRESH_FOR_ROUTING = "refresh_for_routing"  # Light D3 + ROSBOT for gate and F0
    F3_ONLY_MODE = "f3_only_mode"                 # D3+ROSBOT both present -> F3 only, no C
    EXTENSION_TICK = "extension_tick"
    F0_PREJUDGE = "f0_prejudge"
    F0_ACTION_B1 = "f0_action_b1"
    F0_ACTION_B2 = "f0_action_b2"
    F0_ACTION_C1 = "f0_action_c1"
    F0_C1_EXTENSION = "f0_c1_extension"
    F3_F4 = "f3_f4"


class FBlockStep(str, Enum):
    """F block steps (ROSBOT_FLOW_MERMAID.md F pre-judge). Node logic: F2 yes->F3_Baseline->F3_LogTimeout; F3_LogTimeout not timed out->loop, timed out->F3_ProcessGone->F4a; Test count=1 50%%->F4a, count>=2 recorded->F3_Test->E2 1s."""
    F_Entry = "F_Entry"             # F0 pre-judge entry
    F1_HasD3 = "F1_HasD3"           # F1 is D3 online?
    F1c_EndD3 = "F1c_EndD3"        # F1c end D3 process
    F1d_Offline = "F1d_Offline"    # F1d detected disconnect
    F2_RosbotOnline = "F2_RosbotOnline"  # F2 is ROSBOT online?
    F3_Baseline = "F3_Baseline"    # Baseline: mtime when present; started_at when fresh start (UI duration). Done inside run_f3_log_timeout().
    F3_LogTimeout = "F3_LogTimeout"      # [F3] ROSBOT timeout? Returns f3_stay | f4.
    F3_ProcessGone = "F3_ProcessGone"    # Process gone: F7 sent=normal_pause else=test_debug_exit. mark_* in f3 when timeout+!is_running().
    F3_Test = "F3_Test"            # Test: count=1 and 50%%->F4a; count>=2 and elapsed>=recorded->F7, then 50%%->[E2] 1s. Branches inside run_f3_log_timeout().
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
# F3-only mode refresh throttling: refresh every N ticks (default 5 = 10s at 2s/tick)
_f3_only_refresh_counter: int = 0
_F3_ONLY_REFRESH_INTERVAL_TICKS: int = 5
# In F3-only, when D3+ROSBOT already present, refresh ROSBOT only every M refresh cycles to reduce lookup (D3 still every 5 ticks)
_f3_only_rosbot_refresh_cycle: int = 0
_F3_ONLY_ROSBOT_REFRESH_EVERY_N_CYCLES: int = 2


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


def _is_f3_only_mode() -> bool:
    """Doc F2->F3: when D3 and ROSBOT both present (running/paused) enter F3 timeout loop, do not run C branch."""
    g = get_game_interface_data()
    return bool(g.d3_running and g.rosbot_extended_status in ("running", "paused"))


def tick_flow_master(tick_count: int, start_rosbot_task: Callable[[], None], status_prefix: Optional[str] = None) -> None:
    """
    Per-tick order: routing refresh -> F3-only gate -> extension (C branch) -> F0 (B1/B2/C1).
    Gate: when D3+ROSBOT both present only run F3 timeout, never extension_flow_tick_step (no C match/teleport).
    status_prefix: when set (e.g. "[A2/A3] Tick #N dt=Xs | "), F3-only path prints one gray_refresh line instead of separate lines.
    """
    g = get_game_interface_data()

    if not get_flow_master_enabled():
        return

    # Step: F3_ONLY_MODE — Architecture gate: after teleport D3+ROSBOT both present -> F3 only, no C
    # Optimize: refresh D3 every N ticks; ROSBOT only every M refresh cycles (state stable, manager cache also reduces lookup)
    if _is_f3_only_mode():
        extension_reset_state()
        global _f3_only_refresh_counter, _f3_only_rosbot_refresh_cycle
        _f3_only_refresh_counter += 1
        should_refresh = (_f3_only_refresh_counter % _F3_ONLY_REFRESH_INTERVAL_TICKS == 0)
        if should_refresh:
            _f3_only_rosbot_refresh_cycle += 1
            do_rosbot_refresh = (_f3_only_rosbot_refresh_cycle % _F3_ONLY_ROSBOT_REFRESH_EVERY_N_CYCLES == 1)
            set_f3_refresh_silent(True)
            try:
                _, d3_changed = _refresh_d3_status_internal(skip_dynamic=True)
                rosbot_changed = False
                if do_rosbot_refresh:
                    _, rosbot_changed = _refresh_rosbot_status_internal()
                if d3_changed or rosbot_changed:
                    g.notify_state_sync()
            finally:
                set_f3_refresh_silent(False)
        step = run_f3_log_timeout(verbose=False)
        _set_last_f3_result(step)
        prefix = status_prefix if status_prefix else f"[FlowMaster] step={FlowMasterStep.F3_ONLY_MODE.value} | "
        d3_ok = g.d3_running
        rosbot_status = g.rosbot_extended_status or "not_found"
        line = build_f3_only_refresh_line(prefix, d3_ok, rosbot_status, get_last_f3_short_status())
        ColorPrint.gray_refresh(line)
        # ROSBOT_FLOW_MERMAID: Check for ROSBOT disconnect (game_state set by analyzer)
        if g.get_and_clear_rosbot_disconnected_from_log():
            ColorPrint.yellow("[FlowMaster] ROSBOT disconnect detected -> F4 -> B2_HasWin")
            increment_total_restart_count()  # Count restart triggered by disconnect
            run_f4_close_d3_send_f7()
            _, _d4 = _refresh_d3_status_internal(skip_dynamic=True)
            _, _r4 = _refresh_rosbot_status_internal()
            if _d4 or _r4:
                g.notify_state_sync()
            enter_battlenet_at_b2(_FM_BN)
            return
        if step == "f4":
            ColorPrint.gray("[FlowMaster] F3: timeout -> F4 -> B2_HasWin")
            run_f4_close_d3_send_f7()
            # ROSBOT_FLOW_MERMAID: F4b -> B2. Next tick must see D3/ROSBOT gone so gate leaves F3-only and goes F0->B2 (no duplicate F3 50%%).
            _, _d4 = _refresh_d3_status_internal(skip_dynamic=True)
            _, _r4 = _refresh_rosbot_status_internal()
            if _d4 or _r4:
                g.notify_state_sync()
            enter_battlenet_at_b2(_FM_BN)
        return

    # Step: REFRESH_FOR_ROUTING — Light D3 + ROSBOT for this tick's gate and F0. Inside action group do not refresh (one step per tick only); see ACTION_GROUPS_DESIGN.md.
    in_action = not extension_flow_is_idle() and is_in_action_group()
    if not in_action:
        ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.REFRESH_FOR_ROUTING.value}: light D3 + ROSBOT...")
        prev_rosbot_status = g.rosbot_extended_status
        _, d3_changed = _refresh_d3_status_internal(skip_dynamic=True)
        _, rosbot_changed = _refresh_rosbot_status_internal()
        # ROSBOT_FLOW_MERMAID: Check for ROSBOT disconnect (game_state set by analyzer)
        if g.get_and_clear_rosbot_disconnected_from_log():
            ColorPrint.yellow("[FlowMaster] ROSBOT disconnect detected -> F4 -> B2_HasWin")
            increment_total_restart_count()  # Count restart triggered by disconnect
            run_f4_close_d3_send_f7()
            _, _d4 = _refresh_d3_status_internal(skip_dynamic=True)
            _, _r4 = _refresh_rosbot_status_internal()
            if _d4 or _r4:
                g.notify_state_sync()
            enter_battlenet_at_b2(_FM_BN)
            return
        # ROSBOT_FLOW_MERMAID: If ROSBOT was running/paused and now not_found, check F3 timeout (process gone before timeout check ran)
        if prev_rosbot_status in ("running", "paused") and g.rosbot_extended_status == "not_found" and g.d3_running:
            ColorPrint.gray("[FlowMaster] ROSBOT disappeared, check F3 timeout...")
            step = run_f3_log_timeout()
            _set_last_f3_result(step)
            if step == "f4":
                ColorPrint.gray("[FlowMaster] F3: timeout detected after ROSBOT gone -> F4 -> B2_HasWin")
                run_f4_close_d3_send_f7()
                _, _d4 = _refresh_d3_status_internal(skip_dynamic=True)
                _, _r4 = _refresh_rosbot_status_internal()
                if _d4 or _r4:
                    g.notify_state_sync()
                enter_battlenet_at_b2(_FM_BN)
                return
        if d3_changed or rosbot_changed:
            g.notify_state_sync()

    # Step: EXTENSION_TICK — Run C branch when not in F3-only and extension not idle. Inside action group skip full refresh, run one action step per tick.
    if not extension_flow_is_idle():
        if is_in_action_group():
            ColorPrint.gray("[FlowMaster] in action group, skip refresh, extension_flow_tick_step (one step) only")
        else:
            ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.EXTENSION_TICK.value}: full D3+ROSBOT, extension_flow_tick_step...")
            _, d3_changed = _refresh_d3_status_internal(skip_dynamic=False)
            _, rosbot_changed = _refresh_rosbot_status_internal()
            if d3_changed or rosbot_changed:
                g.notify_state_sync()
        result = extension_flow_tick_step(tick_count, start_rosbot_task)
        _set_last_extension_result(result)
        if result == ExtensionStepResult.SUCCESS.value:
            trigger_extension_rosbot_started(True, ran_e_block=False)
            return
        if result == ExtensionStepResult.FALLTHROUGH.value:
            trigger_extension_rosbot_started(False, ran_e_block=False)
            return
        if _is_f3_only_mode():
            ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.F3_F4.value}: F3 timeout (D3+ROSBOT both present)...")
            step = run_f3_log_timeout()
            _set_last_f3_result(step)
            if step == "f4":
                ColorPrint.gray("[FlowMaster] F3: timeout -> F4 -> B2_HasWin")
                run_f4_close_d3_send_f7()
                _, _d4 = _refresh_d3_status_internal(skip_dynamic=True)
                _, _r4 = _refresh_rosbot_status_internal()
                if _d4 or _r4:
                    g.notify_state_sync()
                enter_battlenet_at_b2(_FM_BN)
        return

    # Step: F0_PREJUDGE (d3_running / rosbot for this tick already from routing refresh)
    ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.F0_PREJUDGE.value}: run_f0_prejudge_entry...")
    action = run_f0_prejudge_entry()
    _set_last_f0_action(action)
    ColorPrint.gray(f"[FlowMaster] F0 pre-judge -> {action} (b1=B2, c1=C1, b2=enter B2)")

    if action == F0Action.B1.value:
        # Battle.net: refresh BN only, skip D3 full and ROSBOT
        ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.F0_ACTION_B1.value}: refresh BN only (skip D3 full, ROSBOT)...")
        _, bn_changed = _refresh_battlenet_status_internal()
        if bn_changed:
            g.notify_state_sync()
        ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.F0_ACTION_B1.value}: tick_battlenet_ready_flow(no_activate=False)...")
        done, result = tick_battlenet_ready_flow(no_activate=False)
        if done and result == "confirmed":
            set_battlenet_tick_confirmed(_FM_BN)
            trigger_extension_rosbot_start()
    elif action == F0Action.B2.value:
        ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.F0_ACTION_B2.value}: refresh BN only, enter_battlenet_at_b2...")
        _, bn_changed = _refresh_battlenet_status_internal()
        if bn_changed:
            g.notify_state_sync()
        ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.F0_ACTION_B2.value}: enter_battlenet_at_b2...")
        enter_battlenet_at_b2(_FM_BN)
    elif action == F0Action.C1.value:
        # D3/ROSBOT flow: refresh D3+ROSBOT only, skip BN full
        ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.F0_ACTION_C1.value}: refresh D3+ROSBOT only (skip BN)...")
        _, d3_changed = _refresh_d3_status_internal(skip_dynamic=False)
        _, rosbot_changed = _refresh_rosbot_status_internal()
        if d3_changed or rosbot_changed:
            g.notify_state_sync()
        # Enter C branch (teleport + start ROS) only when extension idle, D3 present, ROSBOT not yet running; after teleport and ROS start do not re-enter C, only F3 timeout
        need_c_branch = (
            extension_flow_is_idle()
            and get_bn_flow_ever_confirmed(_FM_BN)
            and g.d3_running
            and g.rosbot_extended_status not in ("running", "paused")
        )
        if need_c_branch:
            d3_just_entered = g.get_and_clear_d3_just_entered_from_d13()
            if d3_just_entered:
                ColorPrint.gray("[FlowMaster] D13 just entered game -> start_extension_flow_c_branch(d3_just_entered=True) for C7a map teleport (ROSBOT_FLOW_MERMAID)")
            ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.F0_C1_EXTENSION.value}: start_extension_flow_c_branch, extension_flow_tick_step...")
            start_extension_flow_c_branch(d3_just_entered=d3_just_entered)
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

        if _is_f3_only_mode():
            ColorPrint.gray(f"[FlowMaster] step={FlowMasterStep.F3_F4.value}: F3 timeout (D3+ROSBOT both present)...")
            step = run_f3_log_timeout()
            _set_last_f3_result(step)
            if step == "f4":
                ColorPrint.gray("[FlowMaster] F3: timeout -> F4 -> B2_HasWin")
                run_f4_close_d3_send_f7()
                _, _d4 = _refresh_d3_status_internal(skip_dynamic=True)
                _, _r4 = _refresh_rosbot_status_internal()
                if _d4 or _r4:
                    g.notify_state_sync()
                enter_battlenet_at_b2(_FM_BN)
