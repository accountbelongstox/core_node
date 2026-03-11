# -*- coding: utf-8 -*-
"""
BN-only flow library (Ensure Battle.net only, bn_only_enabled).

All steps and state are defined in flow_bn_only_state. This module runs the tick:
calls third-party libs and updates state (FLOW_STATE_ARCHITECTURE).
"""
from pycore.pyfoundations.color_print import ColorPrint

from share.game_interface_data import get_game_interface_data
from d3utils.rosbot_flow_state import get_bn_only_enabled
from d3utils.battlenet_status_provider import _refresh_battlenet_status_internal
from d3utils.rosbot_flow.flow_bn_only_state import BnOnlyTickStep, set_last_bn_result
from d3utils.rosbot_flow.flow_bn_block_state import reset_confirmed_to_poll
_BN_ONLY = True  # BN-only flow uses for_bn_only=True
from d3utils.rosbot_flow_battlenet import tick_battlenet_ready_flow


def tick_bn_only_flow() -> None:
    """
    Run one tick of the BN-only flow. Executes steps in order; updates state from
    third-party return values. All steps and state are defined in this module.
    """
    # Step: REFRESH_NOTIFY
    try:
        ColorPrint.gray(f"[BNOnly] step={BnOnlyTickStep.REFRESH_NOTIFY.value}: refresh_battlenet_status...")
        _, bn_changed = _refresh_battlenet_status_internal()
        g = get_game_interface_data()
        if bn_changed:
            g.notify_state_sync()
    except Exception as e:
        ColorPrint.red(f"[BNOnly] step={BnOnlyTickStep.REFRESH_NOTIFY.value} error: {e}")
        return

    # Step: RE_READ_ABORT
    if not get_bn_only_enabled():
        return

    # Step: RUN_BN_TICK
    ColorPrint.gray(f"[BNOnly] step={BnOnlyTickStep.RUN_BN_TICK.value}: tick_battlenet_ready_flow(no_activate=True)...")
    done, result = tick_battlenet_ready_flow(no_activate=True)

    # Step: HANDLE_BN_RESULT — update state from third-party return
    set_last_bn_result(done, result)
    if done and result == "confirmed":
        reset_confirmed_to_poll(_BN_ONLY)
