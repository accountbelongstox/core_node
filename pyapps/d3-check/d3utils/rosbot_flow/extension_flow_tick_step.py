# -*- coding: utf-8 -*-
"""
Extension flow state machine: one step per tick (no thread, no time.sleep).
Driven by rosbot_task + flow_master; all timing by tick count (deadline_tick = current_tick + N).
"""
import math
import time
from typing import Callable, Optional, Tuple

from pycore.pyfoundations.color_print import ColorPrint
from providor.constants.d3 import C7B_AFTER_BOUNTY_STABLE_SEC, C10_SKIP_AFTER_TELEPORT_SEC

# 2s per flow tick (rosbot_task_processor); map stable wait by tick count, no sleep
EXTENSION_TICK_INTERVAL_SEC = 2.0
C7B_AFTER_BOUNTY_STABLE_TICKS = max(1, int(math.ceil(C7B_AFTER_BOUNTY_STABLE_SEC / EXTENSION_TICK_INTERVAL_SEC)))
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
    step_c7a_verify_bounty_progress,
    step_c7b_minimize_only,
    step_c7b_teleport_only,
)
from d3utils.rosbot_flow.extension_flow_state import (
    ExtensionPhase,
    PAYLOAD_KEY_C7A_ROUND,
    PAYLOAD_KEY_D3_JUST_ENTERED,
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
    get_last_teleport_success_time,
    set_last_teleport_success_time,
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
from d3utils.rosbot_flow_f3_log_timeout import set_f3_rosbot_started_at
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

    # Wait phases: decrement then transition (all tick-driven, no time.sleep)
    wait_phases = (ExtensionPhase.C_C3_WAIT, ExtensionPhase.C_C3_DISCONFIRM, ExtensionPhase.C_C10_WAIT,
                   ExtensionPhase.C_C7a_WAIT, ExtensionPhase.C_C7b_AFTER_BOUNTY_WAIT, ExtensionPhase.C_C7b_WAIT)
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
            set_phase(ExtensionPhase.C_C7a_VERIFY_BOUNTY.value)
            return "running"
        if phase == ExtensionPhase.C_C7b_AFTER_BOUNTY_WAIT.value:
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
            ColorPrint.gray("[ExtensionFlow][C5] Before starting D3 try to end ROSBOT to avoid ROSBOT running while others not causing later log check to exit")
            get_rosbot_manager().kill_if_running()
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
            d3_just_entered = get_payload().get(PAYLOAD_KEY_D3_JUST_ENTERED)
            last_teleport = get_last_teleport_success_time()
            skip_c10_just_opened = last_teleport is not None and (time.time() - last_teleport) < C10_SKIP_AFTER_TELEPORT_SEC
            if d3_just_entered or skip_c10_just_opened:
                if skip_c10_just_opened and not d3_just_entered:
                    ColorPrint.gray("[ExtensionFlow][C3_GameToolOrigin] Teleport just completed, skip C10 (fresh game not check M disconnect) -> C7a")
                else:
                    ColorPrint.gray("[ExtensionFlow][C3_GameToolOrigin] Just entered game (D13), skip C6/C10 -> C7a")
                set_payload(PAYLOAD_KEY_C7A_ROUND, 1)
                set_phase(ExtensionPhase.C_C7a_SEND_M.value)
            else:
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
        set_payload(PAYLOAD_KEY_C7A_ROUND, 1)
        set_phase(ExtensionPhase.C_C7a_SEND_M.value)
        return "running"

    if phase == ExtensionPhase.C_C7a_VERIFY_BOUNTY.value:
        titles = tuple(get_payload().get("titles", list(DIABLO_III_WINDOW_TITLES))) or DIABLO_III_WINDOW_TITLES
        if step_c7a_verify_bounty_progress(window_titles=titles):
            ColorPrint.green(
                f"[ExtensionFlow][C7a] Bounty progress found, map open -> wait {C7B_AFTER_BOUNTY_STABLE_TICKS} ticks then C7b minimize (tick-driven, no sleep)"
            )
            set_phase(ExtensionPhase.C_C7b_AFTER_BOUNTY_WAIT.value)
            set_wait_ticks_remaining(C7B_AFTER_BOUNTY_STABLE_TICKS)
            return "running"
        c7a_round = get_payload().get(PAYLOAD_KEY_C7A_ROUND, 1)
        if c7a_round == 1:
            ColorPrint.gray("[ExtensionFlow][C7a] Round 1 no bounty progress, round 2 press M and detect again")
            set_payload(PAYLOAD_KEY_C7A_ROUND, 2)
            if not step_c7a_send_m(window_titles=titles):
                run_c12_end_d3()
                reset_state()
                return "fallthrough"
            set_phase(ExtensionPhase.C_C7a_WAIT.value)
            set_wait_ticks_remaining(1)
            return "running"
        ColorPrint.yellow("[ExtensionFlow][C7a] No bounty progress after two M rounds; per doc do not kill D3, still run C7b and try teleport")
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

    if phase == ExtensionPhase.C_C7a_SEND_M.value:
        titles = tuple(get_payload().get("titles", list(DIABLO_III_WINDOW_TITLES))) or DIABLO_III_WINDOW_TITLES
        # Pre-check: if map already open (bounty progress visible), do not press M, enter stable wait ticks then C7b (no sleep).
        if step_c7a_verify_bounty_progress(window_titles=titles):
            ColorPrint.green(
                f"[ExtensionFlow][C7a] Pre-check found bounty progress, map open -> wait {C7B_AFTER_BOUNTY_STABLE_TICKS} ticks then C7b minimize (tick-driven)"
            )
            set_phase(ExtensionPhase.C_C7b_AFTER_BOUNTY_WAIT.value)
            set_wait_ticks_remaining(C7B_AFTER_BOUNTY_STABLE_TICKS)
            return "running"
        if not step_c7a_send_m(window_titles=titles):
            run_c12_end_d3()
            reset_state()
            return "fallthrough"
        set_phase(ExtensionPhase.C_C7a_WAIT.value)
        set_wait_ticks_remaining(1)
        return "running"

    if phase == ExtensionPhase.C_C7b_MINIMIZE.value:
        # Doc requires C7b click only after 'map open confirmed'. If this phase is set it would skip C7a, so force C7a first (M -> wait 2s -> bounty check) then C7b.
        ColorPrint.gray("[ExtensionFlow][C7b] Received C_C7b_MINIMIZE, ensure map open first: redirect to C7a")
        set_payload(PAYLOAD_KEY_C7A_ROUND, 1)
        set_phase(ExtensionPhase.C_C7a_SEND_M.value)
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
            set_f3_rosbot_started_at()
            start_rosbot_task_fn()
            # Do not block tick with run_after_rosbot_start; extension thread will run it when in cooldown (game_tool + skip try_fragment2).
        set_last_teleport_success_time(time.time())
        reset_state()
        return "success"

    return "running"


def start_extension_flow_c_branch(d3_just_entered: bool = False) -> None:
    """Start extension flow from C branch (D3 already running, BN confirmed). Call when F0 gives c1 and has_d3 and bn_confirmed.
    d3_just_entered: True when entered from D13 (just entered game); then game_tool skips C6/C10 -> C7a (ROSBOT_FLOW_MERMAID)."""
    if d3_just_entered:
        set_payload(PAYLOAD_KEY_D3_JUST_ENTERED, True)
    set_phase(ExtensionPhase.C_ENTRY.value)


def start_extension_flow_from_d13() -> None:
    """Start extension flow from D13 (just entered game). Caller must have done C1+C2 before or they run in C_ENTRY. Sets d3_just_entered so game_tool -> C7a (skip C6/C10)."""
    set_payload(PAYLOAD_KEY_D3_JUST_ENTERED, True)
    set_phase(ExtensionPhase.C_ENTRY.value)
