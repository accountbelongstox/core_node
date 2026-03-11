# -*- coding: utf-8 -*-
"""
Kanai Cube library. Separate from blacksmith UI (AUTO_USE_INTERFACE_BLACKSMITH_FLOW).
Constants live in providor.constants.d3. Modules: detection, operations, flow.
"""
from providor.constants.d3 import (
    KANAI_CUBE_LEFT_PANEL_INDICATOR_TEMPLATE_NAME,
    KANAI_RIGHT_PAGE_INDICATOR_TEMPLATE_NAME,
    KANAI_UPGRADE_PAGE_CLICKS,
    KANAI_REFORGE_PAGE_CLICKS,
)
from .detection import detect_kanai_left_panel, detect_kanai_right_page_opened
from .operations import (
    run_upgrade_operation,
    run_reforge_operation,
    reset_panel_to_first_page,
    navigate_to_page,
    process_yellow_items,
)
from .flow import run_kanai_upgrade_flow, run_kanai_reforge_flow

__all__ = [
    "KANAI_CUBE_LEFT_PANEL_INDICATOR_TEMPLATE_NAME",
    "KANAI_RIGHT_PAGE_INDICATOR_TEMPLATE_NAME",
    "KANAI_UPGRADE_PAGE_CLICKS",
    "KANAI_REFORGE_PAGE_CLICKS",
    "detect_kanai_left_panel",
    "detect_kanai_right_page_opened",
    "run_upgrade_operation",
    "run_reforge_operation",
    "reset_panel_to_first_page",
    "navigate_to_page",
    "process_yellow_items",
    "run_kanai_upgrade_flow",
    "run_kanai_reforge_flow",
]
