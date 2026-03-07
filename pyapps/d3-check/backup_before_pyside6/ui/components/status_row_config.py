#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Status row config: two rows, (label_i18n_key, var_key, default_fg).
default_fg: None or color key; BottomBar sets value label fg from state.
"""

# Row 1: battlenet (merged with region in value), ros, d3, map, stage (stage after map). No separate battlenet_region column.
STATUS_ROW_1 = [
    ("rosbot.battlenet_status", "battlenet", None),
    ("rosbot.ros_label", "ros", None),
    ("rosbot.d3_status", "d3", None),
    ("rosbot.map_status", "map", None),
    ("rosbot.stage", "stage", None),
]
# Row 2
STATUS_ROW_2 = [
    ("rosbot.oauth_script_status", "oauth", None),
    ("ui.status_bar.window_size", "window_size", None),
]
# Row 3: test mode — one label only (no "label: value"); built in BottomBarStatusBlock._build_test_mode_row, not in STATUS_ROW_*
