# -*- coding: utf-8 -*-
"""
ROSBOT flow steps (ROSBOT_FLOW_MERMAID.md).
Step-to-module index: docs/ROSBOT_FLOW_STEP_INDEX.md (flow transitions, A/B/F/C/D/E/TM, TODOs).

A: flow_a_entry_timer. B: rosbot_flow_battlenet. BN-only: flow_bn_only (bn_only_enabled).
F: rosbot_flow_f0_entry, f1, f2, f3, f4, flow_f1c_f1d. C: flow_c_d3_direct. D: flow_d_launch_from_bn. E: flow_e_rosbot_run. TM: flow_tm_backend.
"""
from d3utils.rosbot_flow.flow_bn_only import tick_bn_only_flow
from d3utils.rosbot_flow.flow_bn_only_state import (
    BnOnlyTickStep as BnOnlyStep,
    BnOnlyBlockResult as BnOnlyResult,
    get_last_bn_result,
)
from d3utils.rosbot_flow.flow_bn_block_state import BNStep
from d3utils.rosbot_flow.flow_master_driver import (
    tick_flow_master,
    FlowMasterStep,
    FBlockStep,
    F0Action,
    ExtensionStepResult,
    get_last_f0_action,
    get_last_extension_result,
    get_last_f3_result,
)
from d3utils.rosbot_flow.flow_a_entry_timer import (
    ABlockStep,
    step_a3_tick_has_direction,
)
from d3utils.rosbot_flow.extension_flow_state import ExtensionPhase
from d3utils.rosbot_flow.flow_c_d3_direct import (
    CBlockStep,
    run_c1_entry,
    run_c2_resize,
    run_c3_screenshot_state,
    run_c4_branch_result,
    run_c4_disconnect_then_f1d_f1c,
    run_c12_end_d3,
)
from d3utils.rosbot_flow.flow_d_launch_from_bn import (
    DBlockStep,
    run_d1_entry,
    run_d2_start_bn_if_needed,
    run_d3_end_d3_if_running,
    run_d4_activate_bn,
    run_d6_has_win,
    run_d13_has_d3_win,
    run_d18_kill_then_start_rosbot,
)
from d3utils.rosbot_flow.flow_e_rosbot_run import (
    EBlockStep,
    run_e1_kill,
    run_e2_sleep,
    run_e3_config_check,
    run_e4_start,
    run_e5_init,
    run_e5a_wait_win_srv_poll_click,
    run_e6_done,
)
from d3utils.rosbot_flow.flow_f1c_f1d import (
    run_f1c_end_d3,
    run_f1d_on_disconnect,
)
from d3utils.rosbot_flow.flow_tm_backend import (
    is_oauth_done,
    reset_oauth_done,
    # TODO: oauth_step1_received endpoint for T2.2 if needed
)

__all__ = [
    "tick_bn_only_flow",
    "tick_flow_master",
    "BNStep",
    "BnOnlyStep",
    "BnOnlyResult",
    "get_last_bn_result",
    "FlowMasterStep",
    "FBlockStep",
    "F0Action",
    "ExtensionStepResult",
    "ABlockStep",
    "ExtensionPhase",
    "CBlockStep",
    "DBlockStep",
    "EBlockStep",
    "get_last_f0_action",
    "get_last_extension_result",
    "get_last_f3_result",
    "step_a3_tick_has_direction",
    "run_c1_entry",
    "run_c2_resize",
    "run_c3_screenshot_state",
    "run_c4_branch_result",
    "run_c4_disconnect_then_f1d_f1c",
    "run_c12_end_d3",
    "run_d1_entry",
    "run_d2_start_bn_if_needed",
    "run_d3_end_d3_if_running",
    "run_d4_activate_bn",
    "run_d6_has_win",
    "run_d13_has_d3_win",
    "run_d18_kill_then_start_rosbot",
    "run_e1_kill",
    "run_e2_sleep",
    "run_e3_config_check",
    "run_e4_start",
    "run_e5_init",
    "run_e5a_wait_win_srv_poll_click",
    "run_e6_done",
    "run_f1c_end_d3",
    "run_f1d_on_disconnect",
    "is_oauth_done",
    "reset_oauth_done",
]
