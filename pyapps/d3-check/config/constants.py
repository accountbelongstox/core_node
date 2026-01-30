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

# CN region Battle.net login flow: agree text, NetEase login/register text, then Login button (OCR keywords)
BATTLE_NET_CN_AGREE_KEYWORDS = ("您同意",)
BATTLE_NET_CN_NETEASE_LOGIN_KEYWORDS = ("使用网易账号登录或注册",)
BATTLE_NET_CN_LOGIN_BUTTON_KEYWORDS = ("登陆", "登录")

# CN login fallback: fixed ratio click positions when OCR returns no boxes. Base window size 362x599.
BATTLE_NET_CN_LOGIN_BASE_W = 362
BATTLE_NET_CN_LOGIN_BASE_H = 599
# Agree checkbox click (window coords at base size)
BATTLE_NET_CN_AGREE_CLICK_X = 31
BATTLE_NET_CN_AGREE_CLICK_Y = 288
# NetEase login/register button click (window coords at base size)
BATTLE_NET_CN_NETEASE_CLICK_X = 137
BATTLE_NET_CN_NETEASE_CLICK_Y = 378

# Battle.net UI: D3 small map = template match (login success); Play = fixed coordinates only
BATTLE_NET_D3_SMALL_MAP_SOURCE_FILENAME = "ScreenShot_2026-01-29_225845_569.png"
BATTLE_NET_D3_SMALL_MAP_TEMPLATE_NAME = "battlenet_d3_small_map"

# D3 in-game: "Start Game" button (after Battle.net Play + resize); SIFT match then click, wait 2s then start ROSBOT
D3_START_GAME_BUTTON_FILENAME = "d3_start_game_button.png"  # was ScreenShot_2026-01-30_020734_401.png
D3_START_GAME_BUTTON_TEMPLATE_NAME = "d3_start_game_button"

# D3 in-game: "Game tool" indicator (after Start Game click); wait every 2s until found, then send M key and click (602,94) at base 1300x800
D3_GAME_TOOL_FILENAME = "d3_game_tool.png"  # was ScreenShot_2026-01-30_021420_159.png
D3_GAME_TOOL_TEMPLATE_NAME = "d3_game_tool"
# D3 in-game: bounty progress UI (悬赏任务进度图); Fragment2 checks this after pressing M twice; both screenshots missing = timeout.
D3_BOUNTY_PROGRESS_FILENAME = "d3_bounty_progress.png"
D3_BOUNTY_PROGRESS_TEMPLATE_NAME = "d3_bounty_progress"
D3_GAME_TOOL_CLICK_STANDARD = (602, 113 + 7)  # after M: click dropdown 7 (下拉7), y=113+7 at 1300x800
D3_GAME_TOOL_CLICK_SECOND = (749, 421)  # second click 1s after first, standard 1300x800
D3_GAME_TOOL_CLICK_THIRD = (715, 608)  # third click after second, standard 1300x800
# After M key, wait this long before first click (only when d3_game_tool already visible)
D3_GAME_TOOL_AFTER_M_DELAY_SEC = 2.0
# Wait mode: poll every 2s; 10 attempts each for Start Game and Game tool; if not found restart and retry from step 1
D3_START_GAME_WAIT_INTERVAL_SEC = 2.0
D3_START_GAME_MAX_ATTEMPTS = 10
D3_GAME_TOOL_MAX_ATTEMPTS = 10
# D3 already-running path: fragment1 wait game_tool 5×2s after click start; fragment2 poll 5×2s for game_tool disappear after M
D3_FRAGMENT1_WAIT_GAME_TOOL_ATTEMPTS = 5
D3_FRAGMENT2_DISAPPEAR_ATTEMPTS = 5

# Click speed (move duration and pause after move only; does not affect caller wait/sleep)
CLICK_MOVE_DURATION_SEC = 0.0
CLICK_PAUSE_AFTER_MOVE_SEC = 0.02

# Play button: fixed position only (left 177px, 97px from bottom, window coords)
BATTLE_NET_PLAY_BUTTON_LEFT_PX = 177
BATTLE_NET_PLAY_BUTTON_BOTTOM_PX = 97

# D3 small map fixed position fallback: (438, 117); when UI width < 1079 use (423, 116)
BATTLE_NET_D3_SMALL_MAP_X = 438
BATTLE_NET_D3_SMALL_MAP_Y = 117
BATTLE_NET_D3_SMALL_MAP_X_NARROW = 423
BATTLE_NET_D3_SMALL_MAP_Y_NARROW = 116
BATTLE_NET_UI_WIDTH_NARROW_THRESHOLD = 1079

# ---------------------------------------------------------------------------
# Path scan (ROSBOT / Battle.net one-click scan)
# ---------------------------------------------------------------------------
BATTLE_NET_EXE_NAME = "Battle.net.exe"
DIABLO_III_EXE_NAME = "Diablo III.exe"
ROSBOT_EXE_PATTERNS = ("ros-bot*.exe", "RoS-BoT*.exe")
# Depth from drive root; e.g. D:\a\b\c\d = 4 levels, D:\a\b\c\d\e = 5. Set 6 to cover typical installs.
PATH_SCAN_MAX_DEPTH = 6
# Preferred order for sorting fixed drives (C last). Actual list is dynamic via d3utils.drive_order.
PATH_SCAN_PREFERRED_ORDER = ("D", "E", "F", "G", "H", "C")
