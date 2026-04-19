# -*- coding: utf-8 -*-
"""
Kanai Cube operations: panel toggle, reset to first page, navigate, upgrade/reforge. Reuses shared_data and state_aware_click_handler.
"""
import time
from typing import Any

from pycore.pyfoundations.color_print import ColorPrint
from share.game_interface_data import (
    get_scaled_kanai_put_material_button,
    get_scaled_kanai_right_panel_toggle,
    get_scaled_conversion_button,
    get_scaled_kanai_next_page_button,
)
from d3utils.state_aware_click_handler import get_state_aware_click_handler
from providor.constants.d3 import KANAI_UPGRADE_PAGE_CLICKS, KANAI_REFORGE_PAGE_CLICKS
from providor.providor_index import should_stop_assistant


def _click_right_panel_toggle(shared_data: Any) -> bool:
    """Click right-panel toggle and update shared_data.kanai_right_page_opened."""
    window_offset = shared_data.window_offset
    if not window_offset:
        return False
    ox, oy = window_offset[0], window_offset[1]
    btn = get_scaled_kanai_right_panel_toggle()
    sx, sy = btn[0] + ox, btn[1] + oy
    click = get_state_aware_click_handler()
    if not click.left_click(sx, sy, 0.1):
        return False
    if shared_data.kanai_right_page_opened is not None:
        shared_data.kanai_right_page_opened = not shared_data.kanai_right_page_opened
    time.sleep(0.5)
    return True


def reset_panel_to_first_page(shared_data: Any) -> bool:
    """Reset Kanai right panel to first page and keep it opened."""
    if shared_data.kanai_right_page_opened is None:
        return False
    if not shared_data.kanai_right_page_opened:
        return _click_right_panel_toggle(shared_data)
    if not _click_right_panel_toggle(shared_data):
        return False
    time.sleep(0.3)
    return _click_right_panel_toggle(shared_data)


def navigate_to_page(shared_data: Any, page_clicks: int) -> bool:
    """Click next-page button page_clicks times from first page."""
    if not shared_data.kanai_right_page_opened or not shared_data.window_offset:
        return False
    ox, oy = shared_data.window_offset[0], shared_data.window_offset[1]
    btn = get_scaled_kanai_next_page_button()
    sx, sy = btn[0] + ox, btn[1] + oy
    click = get_state_aware_click_handler()
    for i in range(page_clicks):
        if should_stop_assistant():
            return False
        if not click.left_click(sx, sy, 0.1):
            return False
        time.sleep(0.3)
    return True


def process_yellow_items(shared_data: Any) -> bool:
    """Process all rare (yellow) items: right-click item -> put material -> conversion -> wait 2s -> conversion again."""
    if not shared_data.window_offset or not shared_data.bag_layout:
        return False
    ox, oy = shared_data.window_offset[0], shared_data.window_offset[1]
    material_btn = get_scaled_kanai_put_material_button()
    conversion_btn = get_scaled_conversion_button()
    material_screen = (material_btn[0] + ox, material_btn[1] + oy)
    conversion_screen = (conversion_btn[0] + ox, conversion_btn[1] + oy)
    bag_coords = shared_data.bag_coordinates
    if not bag_coords:
        return False
    slot_w = bag_coords.width / bag_coords.cols
    slot_h = bag_coords.height / bag_coords.rows
    top_left = bag_coords.top_left
    rare_items = [
        (row, col, info)
        for (row, col), info in shared_data.bag_layout.items.items()
        if info.get("quality") == "rare"
    ]
    if not rare_items:
        ColorPrint.gray("[Kanai] No rare (yellow) items to process")
        return True
    click = get_state_aware_click_handler()
    for idx, (row, col, item_info) in enumerate(rare_items, 1):
        if should_stop_assistant():
            return False
        cx = int(top_left[0] + (col + 0.5) * slot_w)
        cy = int(top_left[1] + (row + 0.5) * slot_h)
        screen_x, screen_y = cx + ox, cy + oy
        if not click.right_click(screen_x, screen_y, 0):
            continue
        time.sleep(0.3)
        if not click.left_click(material_screen[0], material_screen[1], 0):
            continue
        time.sleep(0.3)
        if not click.left_click(conversion_screen[0], conversion_screen[1], 0):
            continue
        time.sleep(2.0)
        if not click.left_click(conversion_screen[0], conversion_screen[1], 0):
            continue
        time.sleep(0.5)
    return True


def run_upgrade_operation(shared_data: Any) -> bool:
    """Run upgrade flow: validate -> reset panel -> navigate to upgrade page -> process yellow items."""
    if shared_data.interface_type != "kanai_cube":
        ColorPrint.red("[Kanai] interface_type is not kanai_cube")
        return False
    if not shared_data.bag_layout:
        ColorPrint.red("[Kanai] No bag layout")
        return False
    if not reset_panel_to_first_page(shared_data):
        return False
    if not navigate_to_page(shared_data, KANAI_UPGRADE_PAGE_CLICKS):
        return False
    return process_yellow_items(shared_data)


def run_reforge_operation(shared_data: Any) -> bool:
    """Run reforge flow: validate -> reset panel -> navigate to reforge page -> process yellow items."""
    if shared_data.interface_type != "kanai_cube":
        ColorPrint.red("[Kanai] interface_type is not kanai_cube")
        return False
    if not shared_data.bag_layout:
        ColorPrint.red("[Kanai] No bag layout")
        return False
    if not reset_panel_to_first_page(shared_data):
        return False
    if not navigate_to_page(shared_data, KANAI_REFORGE_PAGE_CLICKS):
        return False
    return process_yellow_items(shared_data)
