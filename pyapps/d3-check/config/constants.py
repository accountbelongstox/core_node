#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Application constants.
"""

from pathlib import Path

from providor.providor_index import TMP_DIR

# ---------------------------------------------------------------------------
# Login Try Screenshot (log trigger "Login try" -> full-screen screenshot)
# ---------------------------------------------------------------------------
LOGIN_TRY_SCREENSHOT_SUBDIR = "login_try_screenshots"
LOGIN_TRY_SCREENSHOT_PREFIX = "login_try"
LOGIN_TRY_SCREENSHOT_DIR: Path = TMP_DIR / LOGIN_TRY_SCREENSHOT_SUBDIR

# Default log line trigger when config log_detection.login_try is missing
LOGIN_TRY_TRIGGER_DEFAULT = "Login try"

# Keywords on Battle.net window that indicate disconnect (trigger restart)
BATTLE_NET_DISCONNECT_KEYWORDS = ("Retry", "重试")
# Keywords on Battle.net window that indicate need login (screenshot trigger)
BATTLE_NET_NEED_LOGIN_KEYWORDS = ("需要登陆", "请登录", "登录")

# Battle.net UI login success: template names (D3 small map = login success; then click Play)
# Template image: copy/rename from this filename to d3_small_map.png under images/battlenet/
BATTLE_NET_D3_SMALL_MAP_SOURCE_FILENAME = "ScreenShot_2026-01-29_225845_569.png"
BATTLE_NET_D3_SMALL_MAP_TEMPLATE_NAME = "battlenet_d3_small_map"
# Play / 开始游戏: try both zh and en templates
BATTLE_NET_PLAY_BUTTON_TEMPLATE_NAMES = ("battlenet_play_button_zh", "battlenet_play_button_en")

# ---------------------------------------------------------------------------
# Path scan (ROSBOT / Battle.net one-click scan)
# ---------------------------------------------------------------------------
BATTLE_NET_EXE_NAME = "Battle.net.exe"
ROSBOT_EXE_PATTERNS = ("ros-bot*.exe", "RoS-BoT*.exe")
# Depth from drive root; e.g. D:\a\b\c\d = 4 levels, D:\a\b\c\d\e = 5. Set 6 to cover typical installs.
PATH_SCAN_MAX_DEPTH = 6
# Preferred order for sorting fixed drives (C last). Actual list is dynamic via d3utils.drive_order.
PATH_SCAN_PREFERRED_ORDER = ("D", "E", "F", "G", "H", "C")
