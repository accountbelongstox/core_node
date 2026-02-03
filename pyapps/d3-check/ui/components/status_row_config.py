#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Status row config: two rows, (label_i18n_key, var_key, default_fg).
default_fg: None or color key; BottomBar sets value label fg from state.
"""

# Row 1: (label_i18n_key, var_key, default_fg)
STATUS_ROW_1 = [
    ("rosbot.battlenet_status", "battlenet", None),
    ("rosbot.ros_status", "ros", None),
    ("rosbot.d3_status", "d3", None),
    ("rosbot.map_status", "map", None),
]
# Row 2
STATUS_ROW_2 = [
    ("rosbot.stage", "stage", None),
    ("rosbot.oauth_script_status", "oauth", None),
    ("ui.status_bar.game_status", "game_status", "error"),
    ("ui.status_bar.window_size", "window_size", None),
]
