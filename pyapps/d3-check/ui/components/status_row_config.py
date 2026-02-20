#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Status row config: two rows, (label_i18n_key, var_key, default_fg).
default_fg: None or color key; BottomBar sets value label fg from state.
"""

# Row 1: (label_i18n_key, var_key, default_fg). ROS: one column, label "ROS:", value = short (window title or status).
STATUS_ROW_1 = [
    ("rosbot.battlenet_status", "battlenet", None),
    ("rosbot.battlenet_region_label", "battlenet_region", None),
    ("rosbot.ros_label", "ros", None),
    ("rosbot.d3_status", "d3", None),
    ("rosbot.map_status", "map", None),
]
# Row 2
STATUS_ROW_2 = [
    ("rosbot.stage", "stage", None),
    ("rosbot.oauth_script_status", "oauth", None),
    ("ui.status_bar.window_size", "window_size", None),
]
# Row 3: test mode — one label only (no "label: value"); built in BottomBarStatusBlock._build_test_mode_row, not in STATUS_ROW_* (cursor_AI_反思_测试模式底栏只用一个label_1000字)
