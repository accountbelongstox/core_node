#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Share = shared area: data area (values/) and common utilities (common/). See PROJECT_STANDARDS.md §1.3.
Data directory must be named values; do not use data/store/cache etc. that may be gitignored.

- Data area share/values/: shared data and data access API only, no run_*/do_*.
  Examples: game_interface_data, project_path, oauth_callback, asia_credentials, template_match_debug.
- Common utilities share/common/: shared helpers and base classes for both games.
  Examples: scaled_template_matcher_base, coordinate_helper, battlenet_ui_common, battlenet_window_finder.

Do not treat share as a feature dump. Import directly: from share.game_interface_data import ... ; from share.project_path import ...
"""

from .project_path import get_project_root, ensure_d3_check_in_sys_path
from .game_interface_data import (
    D3InterfaceData,
    StandardCoordinates,
    STANDARD_COORDS,
    UIRegion,
    BagCoordinates,
    BagLayout,
    DetectionResult,
    get_game_interface_data,
    clear_game_interface_data,
    get_scaled_bag_region,
    get_scaled_blacksmith_salvage_button,
    get_scaled_blacksmith_tab_forge_weapon,
    get_scaled_blacksmith_tab_armor,
    get_scaled_blacksmith_tab_salvage_materials,
    get_scaled_blacksmith_tab_repair,
    get_scaled_blacksmith_tab_train,
    get_scaled_blacksmith_forge_weapon_craft_button,
    get_scaled_blacksmith_salvage_dialog_salvage_button,
    get_scaled_blacksmith_salvage_dialog_confirm,
    get_scaled_blacksmith_salvage_dialog_cancel,
    get_scaled_blacksmith_salvage_oneclick_white,
    get_scaled_blacksmith_salvage_oneclick_blue,
    get_scaled_blacksmith_salvage_oneclick_yellow,
    get_scaled_blacksmith_ui_coords,
    get_scaled_game_focus_click_point,
    get_scaled_reforge_region,
    get_scaled_kanai_put_material_button,
    get_scaled_conversion_button,
    get_scaled_kanai_right_panel_toggle,
    get_scaled_kanai_next_page_button,
    get_scaled_kanai_recipe_prev_page_button,
    update_global_scale,
    get_global_scale,
    get_screen_resolution,
    GLOBAL_SCALE_X,
    GLOBAL_SCALE_Y
)

__all__ = [
    'get_project_root',
    'ensure_d3_check_in_sys_path',
    'D3InterfaceData',
    'StandardCoordinates',
    'STANDARD_COORDS',
    'UIRegion',
    'BagCoordinates',
    'BagLayout',
    'DetectionResult',
    'get_game_interface_data',
    'clear_game_interface_data',
    'get_scaled_bag_region',
    'get_scaled_blacksmith_salvage_button',
    'get_scaled_blacksmith_tab_forge_weapon',
    'get_scaled_blacksmith_tab_armor',
    'get_scaled_blacksmith_tab_salvage_materials',
    'get_scaled_blacksmith_tab_repair',
    'get_scaled_blacksmith_tab_train',
    'get_scaled_blacksmith_forge_weapon_craft_button',
    'get_scaled_blacksmith_salvage_dialog_salvage_button',
    'get_scaled_blacksmith_salvage_dialog_confirm',
    'get_scaled_blacksmith_salvage_dialog_cancel',
    'get_scaled_blacksmith_salvage_oneclick_white',
    'get_scaled_blacksmith_salvage_oneclick_blue',
    'get_scaled_blacksmith_salvage_oneclick_yellow',
    'get_scaled_blacksmith_ui_coords',
    'get_scaled_game_focus_click_point',
    'get_scaled_reforge_region',
    'get_scaled_kanai_put_material_button',
    'get_scaled_conversion_button',
    'get_scaled_kanai_right_panel_toggle',
    'get_scaled_kanai_next_page_button',
    'get_scaled_kanai_recipe_prev_page_button',
    'update_global_scale',
    'get_global_scale',
    'get_screen_resolution',
    'GLOBAL_SCALE_X',
    'GLOBAL_SCALE_Y',
]
