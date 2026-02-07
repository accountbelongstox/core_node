# -*- coding: utf-8 -*-
"""
Single constants file for d3-check. All literal constants and paths live here.
"""

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths (no import from providor_index to avoid cycles)
# ---------------------------------------------------------------------------
_ROOT_PATH = Path(__file__).resolve().parent.parent
ROOT_DIR = str(_ROOT_PATH)
TMP_DIR = Path.home() / ".core_node" / "pytools" / "tmp"
# Tampermonkey script for Battle.net OAuth login (open with Notepad for copy)
TAMPERMONKEY_SCRIPT_PATH = _ROOT_PATH / "scripts" / "d3check_oauth_login_tampermonkey.user.js"
TEMPLATE_DIR = os.path.join(ROOT_DIR, "images")
SCALED_TEMPLATES_CACHE_DIR = TMP_DIR / "scaled_templates"

# Login try screenshot
LOGIN_TRY_SCREENSHOT_SUBDIR = "login_try_screenshots"
LOGIN_TRY_SCREENSHOT_PREFIX = "login_try"
LOGIN_TRY_SCREENSHOT_DIR = TMP_DIR / LOGIN_TRY_SCREENSHOT_SUBDIR
LOGIN_TRY_TRIGGER_DEFAULT = "Login try"

# Screenshot category dirs
D4_SCREENSHOT_DIR = TMP_DIR / "d4_screenshots"
D4_ANNOTATED_DIR = TMP_DIR / "d4_annotated"
MATCH_DEBUG_DIR = TMP_DIR / "match_debug"
PATHFINDING_DIR = TMP_DIR / "pathfinding"
DEBUG_CAPTURE_DIR = TMP_DIR / "debug_capture"
UI_ANNOTATED_DIR = TMP_DIR / "ui_annotated"
VALIDATION_DIR = TMP_DIR / "validation"
ROSBOT_UI_DEBUG_DIR = TMP_DIR / "debug"

# BN flow UI snapshots: pyapps/d3-check/.cache/bn_flow_snapshots (fixed step filenames only)
BN_FLOW_SNAPSHOTS_DIR = _ROOT_PATH / ".cache" / "bn_flow_snapshots"

DEFAULT_CLEANUP_MAX_AGE_SECONDS = 60

# ---------------------------------------------------------------------------
# Debug
# ---------------------------------------------------------------------------
DEBUG = True

# ---------------------------------------------------------------------------
# Resolution (template matching base)
# ---------------------------------------------------------------------------
STANDARD_RESOLUTION_WIDTH = 1300
STANDARD_RESOLUTION_HEIGHT = 800
D4_STANDARD_RESOLUTION_WIDTH = 1763
D4_STANDARD_RESOLUTION_HEIGHT = 1126
BATTLENET_STANDARD_RESOLUTION_WIDTH = 960
BATTLENET_STANDARD_RESOLUTION_HEIGHT = 540

KANAI_NEXT_PAGE_BUTTON_RIGHT_RATIO = 0.20

# ---------------------------------------------------------------------------
# Window / UI (game_interface_data)
# ---------------------------------------------------------------------------
GLOBAL_SCALE_X = 1.0
GLOBAL_SCALE_Y = 1.0
TITLE_BAR_HEIGHT = 31
TITLE_BAR_TOP_OFFSET = -1
WINDOW_BORDER_LEFT = 9
WINDOW_BORDER_RIGHT = 7
WINDOW_BORDER_BOTTOM = 8
WINDOW_BORDER_WIDTH = 8
D3_STANDARD_OUTER_WIDTH = STANDARD_RESOLUTION_WIDTH + WINDOW_BORDER_LEFT + WINDOW_BORDER_RIGHT
D3_STANDARD_OUTER_HEIGHT = STANDARD_RESOLUTION_HEIGHT + TITLE_BAR_HEIGHT + WINDOW_BORDER_BOTTOM
CLICK_MARGIN_DEFAULT = 10
CLICK_MARGIN_REGION = 5
OPTIMIZED_IMAGE_WIDTH = 570
OPTIMIZED_IMAGE_HEIGHT = 369
SEPARATOR_COLOR_TOLERANCE = 0.02
SEPARATOR_SCAN_HEIGHT_PERCENT = 0.20
SEPARATOR_SCAN_WIDTH_PERCENT = 0.80
BORDER_LINE_COLOR_TOLERANCE_PERCENT = 0.02

# ---------------------------------------------------------------------------
# Battle.net login / UI
# ---------------------------------------------------------------------------
BATTLE_NET_DISCONNECT_KEYWORDS = ("Retry", "重试")
BATTLE_NET_NEED_LOGIN_KEYWORDS = ("需要登陆", "请登录", "登录")
BATTLE_NET_CN_AGREE_KEYWORDS = ("您同意",)
BATTLE_NET_CN_NETEASE_LOGIN_KEYWORDS = ("使用网易账号登录或注册",)
BATTLE_NET_CN_LOGIN_BUTTON_KEYWORDS = ("登陆", "登录")
# Browser-login-wait popup: detect by main text only (do not use Cancel alone).
BATTLE_NET_BROWSER_LOGIN_WAIT_MAIN_KEYWORDS = ("使用浏览器完成登录",)
BATTLE_NET_BROWSER_LOGIN_WAIT_KEYWORDS = ("使用浏览器完成登录", "取消")
# Login-failed dialog: primary (Continue Offline / CN) then secondary (Cancel / CN). Maximized: require both primary [0:2] and secondary [2:4] present.
BATTLE_NET_LOGIN_FAILED_KEYWORDS = ("Continue Offline", "继续离线", "Cancel", "取消")
# Connecting: control name (e.g. Connecting…) means not logged in yet; flow keeps wait.
BATTLE_NET_CONNECTING_KEYWORDS = ("Connecting", "连接中")
# Login screen: strict long phrases only to avoid false match.
LOGIN_SCREEN_UI_KEYWORDS_STRICT = ("需要登陆", "请登录", "您同意", "使用网易账号登录或注册")
LOGIN_SCREEN_UI_KEYWORDS = BATTLE_NET_NEED_LOGIN_KEYWORDS + BATTLE_NET_CN_AGREE_KEYWORDS + BATTLE_NET_CN_NETEASE_LOGIN_KEYWORDS
LOGIN_WINDOW_AUTOMATION_ID_MARKERS = (
    "LoginWindow", "loginWidgetContainer", "loginWidget", "login-wrapper",
    "login-header", "legalAcceptance", "ntes", "connectAccounts",
)
D3_TAB_AUTOMATION_IDS = ("game-nav-btn-D3CN", "game-nav-btn-D3")
D3_TAB_NAME_KEYWORDS = ("Diablo III", "暗黑破坏神", "暗黑破壞神", "Diablo")
START_GAME_AUTOMATION_IDS = ("play-btn-main", "play-btn")
START_GAME_NAME_KEYWORDS = ("Play", "开始游戏", "開始遊戲", "Playing Now")

BATTLE_NET_CN_LOGIN_BASE_W = 362
BATTLE_NET_CN_LOGIN_BASE_H = 599
BATTLE_NET_CN_AGREE_CLICK_X = 31
BATTLE_NET_CN_AGREE_CLICK_Y = 288
BATTLE_NET_CN_NETEASE_CLICK_X = 137
BATTLE_NET_CN_NETEASE_CLICK_Y = 378
BATTLE_NET_CN_AFTER_NETEASE_CLICK_WAIT_SEC = 3.0  # legacy; web agreement now polled in BN_Login2 (30s timeout)
BATTLE_NET_CN_AFTER_NETEASE_CLICK_SETTLE_SEC = 0.5  # short settle after click; BN_Login2 polls is_oauth_done() each 2s until 30s
BATTLE_NET_D3_SMALL_MAP_SOURCE_FILENAME = "ScreenShot_2026-01-29_225845_569.png"
BATTLE_NET_D3_SMALL_MAP_TEMPLATE_NAME = "battlenet_d3_small_map"
BATTLE_NET_PLAY_BUTTON_LEFT_PX = 177
BATTLE_NET_PLAY_BUTTON_BOTTOM_PX = 97
BATTLE_NET_EXE_NAME = "Battle.net.exe"
BATTLE_NET_BUTTON_HEX = "#0074E0"
BATTLE_NET_BUTTON_RGB = (0, 116, 224)
# Battle.net ready flow (tick-driven, ROSBOT_FLOW_MERMAID.md). All wait timeouts 2 min.
BN_FLOW_WAIT_AFTER_START_SEC = 3.0
BN_FLOW_POLL_TIMEOUT_SEC = 120.0   # 2 min: B7 poll elements / no UI found
BN_FLOW_OAUTH_WAIT_SEC = 120.0    # 2 min: B11 OAuth return
BN_FLOW_EXIT_WAIT_SEC = 2.0
DEFAULT_BRIGHTNESS_TOL = 0.01
DEFAULT_BUTTON_W = 200
DEFAULT_BUTTON_H = 20

# ---------------------------------------------------------------------------
# D3 in-game
# ---------------------------------------------------------------------------
D3_START_GAME_BUTTON_TEMPLATE_NAME = "d3_start_game_button"
D3_GAME_TOOL_TEMPLATE_NAME = "d3_game_tool"
D3_BOUNTY_PROGRESS_TEMPLATE_NAME = "d3_bounty_progress"
D3_DISCONNECTED_TEMPLATE_NAME = "d3_disconnected"
D3_GAME_TOOL_CLICK_STANDARD = (602, 113 + 7)
D3_GAME_TOOL_CLICK_SECOND = (749, 421)
D3_GAME_TOOL_CLICK_THIRD = (715, 608)
D3_GAME_TOOL_AFTER_M_DELAY_SEC = 2.0
D3_START_GAME_WAIT_INTERVAL_SEC = 2.0
D3_START_GAME_MAX_ATTEMPTS = 10
D3_GAME_TOOL_MAX_ATTEMPTS = 10
D3_FRAGMENT1_WAIT_GAME_TOOL_ATTEMPTS = 5
D3_FRAGMENT2_DISAPPEAR_ATTEMPTS = 5
# A5 D3 online check (ROSBOT_FLOW_MERMAID.md): screenshot A -> M -> screenshot B -> similarity; >= threshold = disconnected
D3_ONLINE_SIMILARITY_THRESHOLD = 0.98
D3_ONLINE_SIMILARITY_RESIZE = (64, 64)
CLICK_MOVE_DURATION_SEC = 0.0
CLICK_PAUSE_AFTER_MOVE_SEC = 0.02
# Battle.net flow: instant click (duration=0), no visible move, return mouse to original after click
BN_CLICK_MOVE_DURATION_SEC = 0.0
BN_CLICK_PAUSE_AFTER_MOVE_SEC = 0.0
VK_M = 0x4D
ACTIVATE_BEFORE_CAPTURE_DELAY_SEC = 0.3

# ---------------------------------------------------------------------------
# Path scan
# ---------------------------------------------------------------------------
DIABLO_III_EXE_NAME = "Diablo III.exe"
ROSBOT_EXE_PATTERNS = ("ros-bot*.exe", "RoS-BoT*.exe")
PATH_SCAN_MAX_DEPTH = 6
DRIVE_REMOVABLE = 2
DRIVE_FIXED = 3
DRIVE_REMOTE = 4
DRIVE_CDROM = 5

# ---------------------------------------------------------------------------
# OAuth / Tampermonkey
# ---------------------------------------------------------------------------
OAUTH_SCRIPT_PING_TIMEOUT_SEC = 30.0

# ---------------------------------------------------------------------------
# Thread / event command names
# ---------------------------------------------------------------------------
CMD_START_MACRO = "start_macro"
CMD_STOP_MACRO = "stop_macro"
CMD_SHUTDOWN = "shutdown"
CMD_START_ROSBOT = "start_rosbot"
CMD_STOP_ROSBOT = "stop_rosbot"
APP_EXIT = "app.exit"
APP_RESTART = "app.restart"
WINDOW_SHOW = "window.show"
WINDOW_MINIMIZE = "window.minimize"
WINDOW_MAXIMIZE = "window.maximize"
EXTENSION_MAIN_START_MACRO = "extension.main.start_macro"
EXTENSION_MAIN_STOP_MACRO = "extension.main.stop_macro"
EXTENSION_ROSBOT_START = "extension.rosbot.start"
EXTENSION_ROSBOT_STOP = "extension.rosbot.stop"
EXTENSION_SHUTDOWN = "extension.shutdown"
EXTENSION_ROSBOT_STARTED = "extension.rosbot.started"
EXTENSION_ROSBOT_STOPPED = "extension.rosbot.stopped"

# ---------------------------------------------------------------------------
# Timers / intervals
# ---------------------------------------------------------------------------
DEFAULT_INTERVAL = 10.0
D4_TICK_INTERVAL = 3.0

# ---------------------------------------------------------------------------
# ROSBOT UI automation
# ---------------------------------------------------------------------------
TAB_MAIN_PROFILE_NAMES = ("主档案", "主檔案", "Main Profile")
START_BUTTON_NAMES = ("Start botting", "Start botting!", "開始掛機", "开始挂机")
START_BUTTON_AUTOMATION_ID = "btnStart"
UI_OPERATION_DELAY = 1.0
SERVER_WAIT_SECONDS = 10
MAIN_UI_POLL_TIMEOUT_SECONDS = 50
MAIN_UI_POLL_INTERVAL_SECONDS = 2

# ---------------------------------------------------------------------------
# Grid / skill config (unified_config)
# ---------------------------------------------------------------------------
GRID_ROWS = 18
GRID_COLS = 18
TOTAL_GRID_CELLS = GRID_ROWS * GRID_COLS
GRID_TYPE_NINE = "9grid"
GRID_TYPE_CUSTOM = "18x18grid"
GRID_DESCRIPTION = f"{GRID_ROWS} rows x {GRID_COLS} columns = {TOTAL_GRID_CELLS} cells"
COMMON_KEY_OPTIONS = ["1", "2", "3", "4", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"]
COMMON_STRATEGY_OPTIONS = ["continuous", "single", "hold"]
MAIN_FUNCTIONS_SUB_TABS_KEY = "main_functions_sub_tabs"

# UI settings keys (CONFIG["ui_settings"][...])
UI_SETTINGS_WINDOW_GEOMETRY = "window_geometry"

# SmartEcho: OCR game region every 3s. If no Chinese text → resume immediately. Timeout 60s → resume immediately.
SMART_ECHO_OCR_TICK_MAX_SEC = 60.0

# ---------------------------------------------------------------------------
# D4 event keys (game_interface_data, d4 event_manager)
# ---------------------------------------------------------------------------
D4_EVENT_KEYS = {
    "EXP_FARMING_STARTED": "exp_farming_started",
    "EXP_FARMING_STOPPED": "exp_farming_stopped",
    "EXP_FARMING_TICK_COMPLETED": "exp_farming_tick_completed",
    "TEAM_HEALTH_DETECTED": "team_health_detected",
    "TEAM_MEMBER_JOINED": "team_member_joined",
    "TEAM_MEMBER_LEFT": "team_member_left",
    "TEAM_HEALTH_CHANGED": "team_health_changed",
    "SCREEN_SIZE_CHANGED": "screen_size_changed",
    "SCREEN_COORDINATES_CHANGED": "screen_coordinates_changed",
    "DISPLAY_MODE_CHANGED": "display_mode_changed",
    "GAME_STATE_CHANGED": "game_state_changed",
    "CURRENT_MAP_CHANGED": "current_map_changed",
    "DUNGEON_PROGRESS_CHANGED": "dungeon_progress_changed",
}

# ---------------------------------------------------------------------------
# Color sets (game_interface_data uses this; full HARDCODED_COLOR_REFS/QUALITY_COLOR_IMAGES stay in game_interface_data)
# ---------------------------------------------------------------------------
HARDCODED_INTERFERENCE_COLORS = {
    (0x09, 0x10, 0x11), (0x08, 0x0d, 0x0d), (0x01, 0x05, 0x09),
    (0x00, 0x04, 0x08), (0x00, 0x05, 0x09), (0x04, 0x10, 0x1c),
}
