# -*- coding: utf-8 -*-
"""
AUTO_USE_INTERFACE_KANAI_FLOW entry. Caller must have run capture + collect_bag_info and shared_data.interface_type == "kanai_cube".
Separate from AUTO_USE_INTERFACE_BLACKSMITH_FLOW.
"""
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from share.game_interface_data import get_game_interface_data

from .operations import run_upgrade_operation, run_reforge_operation


def run_kanai_upgrade_flow() -> bool:
    """Run Kanai upgrade (yellow items). Precondition: interface_type == kanai_cube and bag collected."""
    shared_data = get_game_interface_data()
    if shared_data.interface_type != "kanai_cube":
        ColorPrint.yellow("[KanaiFlow] Not Kanai Cube interface, skip")
        return False
    ColorPrint.blue("[KanaiFlow] Running Kanai upgrade operation...")
    return run_upgrade_operation(shared_data)


def run_kanai_reforge_flow() -> bool:
    """Run Kanai reforge. Precondition: same as upgrade."""
    shared_data = get_game_interface_data()
    if shared_data.interface_type != "kanai_cube":
        ColorPrint.yellow("[KanaiFlow] Not Kanai Cube interface, skip")
        return False
    ColorPrint.blue("[KanaiFlow] Running Kanai reforge operation...")
    return run_reforge_operation(shared_data)
