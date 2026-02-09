# -*- coding: utf-8 -*-
"""
F1c / F1d (ROSBOT_FLOW_MERMAID.md). Used when C4 detects game disconnect.
F1d: Detect disconnect -> set state, reset BN flow, then F1c.
F1c: End D3 process -> then F_Entry (next tick).
"""
from pycore.pyfoundations.color_print import ColorPrint

from share.game_interface_data import get_game_interface_data
from d3utils.d3_manager import get_d3_manager
from d3utils.rosbot_flow_battlenet import reset_flow_master_bn_block


def run_f1d_on_disconnect() -> None:
    """[F1d] On disconnect: set d3_disconnected, reset BN flow state. Caller then calls run_f1c_end_d3."""
    get_game_interface_data().set_d3_dynamic_status(on_login_screen=False, disconnected=True, in_game=False)
    reset_flow_master_bn_block()
    ColorPrint.yellow("[F1d] Disconnect detected, flow reset")


def run_f1c_end_d3() -> None:
    """[F1c] End D3 process. Next tick enters F_Entry."""
    get_d3_manager().kill_if_running()
    ColorPrint.blue("[F1c] D3 process ended, next tick F_Entry")
