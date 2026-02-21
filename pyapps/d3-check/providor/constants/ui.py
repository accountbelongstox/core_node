# -*- coding: utf-8 -*-
"""
UI constants: tab indices and panel keys.
All main UI (tabs, panels) exist at startup; use these constants instead of magic numbers.
"""

# Main notebook tab indices (order: main, rosbot, d4, calibration, log)
TAB_INDEX_MAIN = 0
TAB_INDEX_ROSBOT = 1
TAB_INDEX_D4 = 2
TAB_INDEX_CALIBRATION = 3
TAB_INDEX_LOG = 4

TAB_COUNT = 5

# Panel keys for UI registry (share.ui_registry.get_panel(key)); all main panels exist after UI start
PANEL_KEY_MAIN = "main"
PANEL_KEY_ROSBOT = "rosbot"
PANEL_KEY_D4 = "d4"
PANEL_KEY_CALIBRATION = "calibration"
PANEL_KEY_LOG = "log"

# Popup keys for share.ui_registry (get_popup/register_popup/unregister_popup); create on demand
POPUP_KEY_DEBUG_WINDOW = "debug_window"
