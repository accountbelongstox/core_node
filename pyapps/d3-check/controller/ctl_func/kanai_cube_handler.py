#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Kanai Cube Handler. Thin wrapper over d3utils.kanai (run_upgrade_operation, run_reforge_operation).
Keeps existing API for callers that use get_kanai_cube_handler().
"""
from typing import Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from share.game_interface_data import get_game_interface_data
from d3utils.kanai import run_upgrade_operation, run_reforge_operation


class KanaiCubeHandler:
    """
    Kanai Cube operation handler. Delegates to d3utils.kanai.
    """

    def __init__(self):
        ColorPrint.green("[KanaiCubeHandler] Initialized")

    def handle_upgrade_operation(self) -> bool:
        """Handle Kanai upgrade (yellow items). Delegates to d3utils.kanai.run_upgrade_operation."""
        shared_data = get_game_interface_data()
        return run_upgrade_operation(shared_data)

    def handle_reforge_operation(self) -> bool:
        """Handle Kanai reforge. Delegates to d3utils.kanai.run_reforge_operation."""
        shared_data = get_game_interface_data()
        return run_reforge_operation(shared_data)


_kanai_cube_handler_instance: Optional[KanaiCubeHandler] = None


def get_kanai_cube_handler() -> KanaiCubeHandler:
    """Get singleton Kanai Cube handler instance."""
    global _kanai_cube_handler_instance
    if _kanai_cube_handler_instance is None:
        _kanai_cube_handler_instance = KanaiCubeHandler()
    return _kanai_cube_handler_instance
