#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Share = 共用区，分为数据区（values/）与公区功能区（common/），见 PROJECT_STANDARDS.md §1.3。
数据区目录名用 values，禁止用 data/store/cache 等易被 gitignore 的目录名。

- 数据区 share/values/：仅共享数据与数据访问 API，无 run_*/do_*。
  例：game_interface_data, project_path, oauth_callback, asia_credentials, template_match_debug。
- 公区功能区 share/common/：两游戏共用的工具函数、基类。
  例：scaled_template_matcher_base, coordinate_helper, battlenet_ui_common, battlenet_window_finder。

禁止把 share 整体当“功能区”堆业务逻辑。直接导入：from share.game_interface_data import ... ；from share.project_path import ...
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
