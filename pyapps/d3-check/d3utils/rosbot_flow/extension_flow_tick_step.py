# -*- coding: utf-8 -*-
"""
Extension flow state machine: one step per tick (no thread, no time.sleep).
Driven by rosbot_task + flow_master; all timing by tick count (deadline_tick = current_tick + N).
"""
from typing import Callable, Optional, Tuple

from pycore.pyfoundations.color_print import ColorPrint
from providor.providor_index import CONFIG, DIABLO_III_WINDOW_TITLES
from share.game_interface_data import get_game_interface_data
from d3utils.d3_manager import get_d3_manager
from d3utils.rosbot_manager import get_rosbot_manager
from d3utils.screenshot_provider import get_screenshot_provider
from d3utils.d3_start_game_and_teleport_waiter import (
    click_start_game_button_if_found,
    detect_d3_already_running_state,
    step_c10_send_m,
    step_c10_compare,
    step_c7a_send_m,
    step_c7b_minimize_only,
    step_c7b_teleport_only,
)
from d3utils.rosbot_flow.extension_flow_state import (
    ExtensionPhase,
    get_phase,
    set_phase,
    get_wait_ticks_remaining,
    set_wait_ticks_remaining,
    get_deadline_tick,
    set_deadline_tick,
    get_payload,
    set_payload,
    get_last_c3_state,
    set_last_c3_state,
    reset_state,
)
from d3utils.rosbot_flow.flow_c_d3_direct import (
    run_c1_entry,
    run_c2_resize,
    run_c3_screenshot_state,
    run_c4_branch_result,
    run_c4_disconnect_then_f1d_f1c,
    run_c12_end_d3,
)
from d3utils.rosbot_ui_automation import run_after_rosbot_start
from providor.constants.d3 import C3_DEADLINE_TICKS


def extension_flow_tick_step(
    current_tick: int,
    start_rosbot_task_fn: Callable[[], None],
) -> str:
    """
    Run one step of extension flow state machine. Call every 2s tick when flow is running.
    Returns: "idle" | "running" | "success" | "fallthrough".
    """
    phase = get_phase()
    if phase == ExtensionPhase.IDLE.value:
        return "idle"

    # Wait phases: decrement then transition
    wait_phases = (ExtensionPhase.C_C3_WAIT, ExtensionPhase.C_C3_DISCONFIRM, ExtensionPhase.C_C10_WAIT,
                   ExtensionPhase.C_C7a_WAIT, ExtensionPhase.C_C7b_WAIT)
    if phase in (p.value for p in wait_phases):
        w = get_wait_ticks_remaining() - 1
        set_wait_ticks_remaining(max(0, w))
        if w > 0:
            return "running"
        if phase == ExtensionPhase.C_C3_WAIT.value:
            set_phase(ExtensionPhase.C_C3_LOOP.value)
            return "running"
        if phase == ExtensionPhase.C_C3_DISCONFIRM.value:
            state2 = run_c3_screenshot_state()
            if state2 == "disconnect":
                set_phase(ExtensionPhase.C_C4_BRANCH.value)
                set_payload("branch_result", "disconnect")
            else:
                set_last_c3_state(None)
                set_phase(ExtensionPhase.C_C3_LOOP.value)
            return "running"
        if phase == ExtensionPhase.C_C10_WAIT.value:
            set_phase(ExtensionPhase.C_C10_COMPARE.value)
            return "running"
        if phase == ExtensionPhase.C_C7a_WAIT.value:
            set_phase(ExtensionPhase.C_C7b_MINIMIZE.value)
            return "running"
        if phase == ExtensionPhase.C_C7b_WAIT.value:
            set_phase(ExtensionPhase.C_C7b_TELEPORT.value)
            return "running"

    if phase == ExtensionPhase.C_ENTRY.value:
        if not run_c1_entry(True, True):
            reset_state()
            return "fallthrough"
        ColorPrint.gray("[ExtensionFlow] [C1] entry -> [C2] Resize -> [C3] loop (tick-driven)")
        run_c2_resize()
        set_phase(ExtensionPhase.C_C3_LOOP.value)
        set_deadline_tick(current_tick + C3_DEADLINE_TICKS)
        return "running"

    if phase == ExtensionPhase.C_C3_LOOP.value:
        state = run_c3_screenshot_state()
        deadline = get_deadline_tick()
        if current_tick >= deadline:
            set_phase(ExtensionPhase.C_C4_BRANCH.value)
            set_payload("branch_result", state if state else "other")
            return "running"
        if state == "disconnect":
            set_last_c3_state("disconnect")
            set_phase(ExtensionPhase.C_C3_DISCONFIRM.value)
            set_wait_ticks_remaining(1)
            return "running"
        if state == "game_tool":
            set_phase(ExtensionPhase.C_C4_BRANCH.value)
            set_payload("branch_result", "game_tool")
            return "running"
        if state == "start":
            if click_start_game_button_if_found():
                set_deadline_tick(current_tick + C3_DEADLINE_TICKS)
            set_phase(ExtensionPhase.C_C3_WAIT.value)
            set_wait_ticks_remaining(1)
            return "running"
        set_phase(ExtensionPhase.C_C3_WAIT.value)
        set_wait_ticks_remaining(1)
        return "running"

    if phase == ExtensionPhase.C_F1_WAIT_GAME_TOOL.value:
        if current_tick >= get_deadline_tick():
            ColorPrint.yellow("[ExtensionFlow][Fragment1] C5w timeout -> C12")
            run_c12_end_d3()
            reset_state()
            return "fallthrough"
        state = detect_d3_already_running_state(
            window_titles=tuple(get_payload().get("titles", list(DIABLO_III_WINDOW_TITLES))) or DIABLO_III_WINDOW_TITLES
        )
        if state == "game_tool":
            ColorPrint.green("[ExtensionFlow][Fragment1] d3_game_tool appeared after Start Game click")
            set_phase(ExtensionPhase.C_C10_SEND_M.value)
            return "running"
        if state == "disconnect":
            ColorPrint.yellow("[ExtensionFlow][Fragment1] d3_disconnected during C5w -> C12")
            run_c12_end_d3()
            reset_state()
            return "fallthrough"
        return "running"

    if phase == ExtensionPhase.C_C4_BRANCH.value:
        branch_result = get_payload().get("branch_result", "other")
        if branch_result == "disconnect":
            ColorPrint.yellow("[ExtensionFlow][C4] D3 disconnected, F1d+F1c then C12->D1")
            run_c4_disconnect_then_f1d_f1c()
            reset_state()
            return "fallthrough"
        if branch_result == "start":
            set_payload("titles", list(DIABLO_III_WINDOW_TITLES))
            set_deadline_tick(current_tick + 5)
            set_phase(ExtensionPhase.C_F1_WAIT_GAME_TOOL.value)
            return "running"
        if branch_result == "game_tool":
            set_payload("titles", list(DIABLO_III_WINDOW_TITLES))
            set_phase(ExtensionPhase.C_C10_SEND_M.value)
            return "running"
        run_c12_end_d3()
        reset_state()
        return "fallthrough"

    if phase == ExtensionPhase.C_C10_SEND_M.value:
        titles = tuple(get_payload().get("titles", list(DIABLO_III_WINDOW_TITLES)))
        if not titles:
            set_payload("titles", list(DIABLO_III_WINDOW_TITLES))
            titles = DIABLO_III_WINDOW_TITLES
        if not step_c10_send_m(window_titles=titles):
            run_c12_end_d3()
            reset_state()
            return "fallthrough"
        set_phase(ExtensionPhase.C_C10_WAIT.value)
        set_wait_ticks_remaining(1)
        return "running"

    if phase == ExtensionPhase.C_C10_COMPARE.value:
        titles = tuple(get_payload().get("titles", list(DIABLO_III_WINDOW_TITLES))) or DIABLO_III_WINDOW_TITLES
        result = step_c10_compare(window_titles=titles)
        if result is False:
            run_c12_end_d3()
            reset_state()
            return "fallthrough"
        if result is not True:
            run_c12_end_d3()
            reset_state()
            return "fallthrough"
        set_phase(ExtensionPhase.C_C7a_SEND_M.value)
        return "running"

    if phase == ExtensionPhase.C_C7a_SEND_M.value:
        titles = tuple(get_payload().get("titles", list(DIABLO_III_WINDOW_TITLES))) or DIABLO_III_WINDOW_TITLES
        if not step_c7a_send_m(window_titles=titles):
            run_c12_end_d3()
            reset_state()
            return "fallthrough"
        set_phase(ExtensionPhase.C_C7a_WAIT.value)
        set_wait_ticks_remaining(1)
        return "running"

    if phase == ExtensionPhase.C_C7b_MINIMIZE.value:
        titles = tuple(get_payload().get("titles", list(DIABLO_III_WINDOW_TITLES))) or DIABLO_III_WINDOW_TITLES
        provider = get_screenshot_provider()
        sd = provider.gen(use_optimized_capture=True, window_titles=list(titles))
        if not sd or not sd.game_window_image:
            run_c12_end_d3()
            reset_state()
            return "fallthrough"
        window_offset = sd.window_offset or (0, 0)
        game_window_size = sd.game_window_size or (sd.game_window_image.width, sd.game_window_image.height)
        is_windowed = get_game_interface_data().is_windowed_mode()
        if not step_c7b_minimize_only(provider, titles, window_offset, game_window_size, is_windowed):
            run_c12_end_d3()
            reset_state()
            return "fallthrough"
        set_phase(ExtensionPhase.C_C7b_WAIT.value)
        set_wait_ticks_remaining(1)
        return "running"

    if phase == ExtensionPhase.C_C7b_TELEPORT.value:
        titles = tuple(get_payload().get("titles", list(DIABLO_III_WINDOW_TITLES))) or DIABLO_III_WINDOW_TITLES
        provider = get_screenshot_provider()
        sd = provider.gen(use_optimized_capture=True, window_titles=list(titles))
        if not sd or not sd.game_window_image:
            reset_state()
            return "fallthrough"
        window_offset = sd.window_offset or (0, 0)
        game_window_size = sd.game_window_size or (sd.game_window_image.width, sd.game_window_image.height)
        is_windowed = get_game_interface_data().is_windowed_mode()
        if not step_c7b_teleport_only(provider, titles, window_offset, game_window_size, is_windowed):
            reset_state()
            return "fallthrough"
        get_game_interface_data().set_d3_status(True)
        get_rosbot_manager().kill_if_running()
        if CONFIG.get("ros_settings", {}).get("auto_start_rosbot", True) and get_rosbot_manager().start():
            start_rosbot_task_fn()
            run_after_rosbot_start(do_debug=True, do_tab=True, do_start_botting=True)
        reset_state()
        return "success"

    return "running"


def start_extension_flow_c_branch() -> None:
    """Start extension flow from C branch (D3 already running, BN confirmed). Call when F0 gives c1 and has_d3 and bn_confirmed."""
    set_phase(ExtensionPhase.C_ENTRY.value)
