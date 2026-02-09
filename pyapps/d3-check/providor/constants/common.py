# -*- coding: utf-8 -*-
"""
Common (shared) constants. No D3_* or D4_* prefix.
Used by both games or by non-game modules (paths, window, Battle.net login/UI, grid, events).
"""
import colorsys
import os
from pathlib import Path

# Project root: providor/constants/common.py -> parent.parent.parent = pyapps/d3-check
_ROOT_PATH = Path(__file__).resolve().parent.parent.parent

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT_DIR = str(_ROOT_PATH)
TMP_DIR = Path.home() / ".core_node" / "pytools" / "tmp"
TAMPERMONKEY_SCRIPT_PATH = _ROOT_PATH / "scripts" / "d3check_oauth_login_tampermonkey.user.js"
TEMPLATE_DIR = os.path.join(ROOT_DIR, "images")
SCALED_TEMPLATES_CACHE_DIR = TMP_DIR / "scaled_templates"

LOGIN_TRY_SCREENSHOT_SUBDIR = "login_try_screenshots"
LOGIN_TRY_SCREENSHOT_PREFIX = "login_try"
LOGIN_TRY_SCREENSHOT_DIR = TMP_DIR / LOGIN_TRY_SCREENSHOT_SUBDIR
LOGIN_TRY_TRIGGER_DEFAULT = "Login try"

MATCH_DEBUG_DIR = TMP_DIR / "match_debug"
PATHFINDING_DIR = TMP_DIR / "pathfinding"
DEBUG_CAPTURE_DIR = TMP_DIR / "debug_capture"
DEBUG_BAG_LINE_DIR = TMP_DIR / "debug_bag_line"
UI_ANNOTATED_DIR = TMP_DIR / "ui_annotated"
VALIDATION_DIR = TMP_DIR / "validation"
ROSBOT_UI_DEBUG_DIR = TMP_DIR / "debug"

BN_FLOW_SNAPSHOTS_DIR = _ROOT_PATH / ".cache" / "bn_flow_snapshots"
# When False, save_ui_elements_snapshot skips file write and _enumerate_controls to avoid extra I/O and UI read each step.
DEBUG_SAVE_BN_FLOW_UI_SNAPSHOTS = False

YOLO_DATASET_BASE_DIR = Path(r"D:\applications\GameTools\Yolo")
YOLO_COLLECT_HUE_MIN = 0.0
YOLO_COLLECT_HUE_MAX = 360.0
YOLO_COLLECT_HUE_STEP = 17.0
YOLO_COLLECT_SATURATION = 0.85
YOLO_COLLECT_VALUE = 0.95


def get_yolo_collect_class_color(index: int) -> str:
    """Generate a distinct color for class index (HSV)."""
    h_min = YOLO_COLLECT_HUE_MIN
    h_max = YOLO_COLLECT_HUE_MAX
    step = YOLO_COLLECT_HUE_STEP
    span = max(1.0, h_max - h_min)
    n_slots = max(1, int(span / step))
    h = (h_min + (index % n_slots) * step) % 360.0
    s = YOLO_COLLECT_SATURATION
    v = YOLO_COLLECT_VALUE
    r, g, b = colorsys.hsv_to_rgb(h / 360.0, s, v)
    return "#{:02x}{:02x}{:02x}".format(int(r * 255), int(g * 255), int(b * 255))


DEFAULT_CLEANUP_MAX_AGE_SECONDS = 60

# ---------------------------------------------------------------------------
# Debug
# ---------------------------------------------------------------------------
DEBUG = True

# ---------------------------------------------------------------------------
# Window / UI (generic)
# ---------------------------------------------------------------------------
GLOBAL_SCALE_X = 1.0
GLOBAL_SCALE_Y = 1.0
TITLE_BAR_HEIGHT = 31
TITLE_BAR_TOP_OFFSET = -1
WINDOW_BORDER_LEFT = 8
WINDOW_BORDER_RIGHT = 8
WINDOW_BORDER_BOTTOM = 8
WINDOW_BORDER_WIDTH = 8
CLICK_MARGIN_DEFAULT = 10
CLICK_MARGIN_REGION = 5
OPTIMIZED_IMAGE_WIDTH = 570
OPTIMIZED_IMAGE_HEIGHT = 369
SEPARATOR_COLOR_TOLERANCE = 0.02
SEPARATOR_SCAN_HEIGHT_PERCENT = 0.20
SEPARATOR_SCAN_WIDTH_PERCENT = 0.80
BORDER_LINE_COLOR_TOLERANCE_PERCENT = 0.02

# ---------------------------------------------------------------------------
# Battle.net login / UI (shared by D3 and D4 BN client)
# ---------------------------------------------------------------------------
BATTLE_NET_NEED_LOGIN_KEYWORDS = ("需要登陆", "请登录", "登录")
BATTLE_NET_CN_AGREE_KEYWORDS = ("您同意",)
BATTLE_NET_CN_NETEASE_LOGIN_KEYWORDS = ("使用网易账号登录或注册",)
BATTLE_NET_CN_LOGIN_BUTTON_AUTOMATION_IDS = ()
BATTLE_NET_CN_LOGIN_BUTTON_KEYWORDS = ("登陆", "登录")
BATTLE_NET_BROWSER_LOGIN_WAIT_AUTOMATION_IDS = ()
BATTLE_NET_BROWSER_LOGIN_WAIT_MAIN_KEYWORDS = ("使用浏览器完成登录",)
BATTLE_NET_BROWSER_LOGIN_WAIT_KEYWORDS = ("使用浏览器完成登录", "取消")
BATTLE_NET_LOGIN_FAILED_PRIMARY_AUTOMATION_IDS = ()
BATTLE_NET_LOGIN_FAILED_SECONDARY_AUTOMATION_IDS = ()
BATTLE_NET_LOGIN_FAILED_KEYWORDS = ("Continue Offline", "继续离线", "Cancel", "取消")
BATTLE_NET_CONNECTING_AUTOMATION_IDS = ()
BATTLE_NET_CONNECTING_KEYWORDS = ("Connecting", "连接中")
BATTLE_NET_POPUP_CLOSE_AUTOMATION_IDS = ("winCloseButton",)
BATTLE_NET_POPUP_CLOSE_NAME_KEYWORDS = ("Close", "关闭")
BATTLE_NET_MAIN_WINDOW_FRAME_AUTOMATION_ID_SUBSTRINGS = ("topLayerContainer.TopLayer.buttonContainer",)
BATTLE_NET_DISCONNECT_AUTOMATION_IDS = ()
BATTLE_NET_DISCONNECT_KEYWORDS = ("Retry", "重试")

LOGIN_SCREEN_UI_KEYWORDS_STRICT = ("需要登陆", "请登录", "您同意", "使用网易账号登录或注册")
LOGIN_SCREEN_UI_KEYWORDS = BATTLE_NET_NEED_LOGIN_KEYWORDS + BATTLE_NET_CN_AGREE_KEYWORDS + BATTLE_NET_CN_NETEASE_LOGIN_KEYWORDS
LOGIN_WINDOW_AUTOMATION_ID_MARKERS = (
    "LoginWindow", "loginWidgetContainer", "loginWidget", "login-wrapper",
    "login-header", "legalAcceptance", "ntes", "connectAccounts",
)
LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA = (
    "LoginWindow", "loginWidgetContainer", "loginWidget", "login-wrapper",
    "login-header", "legalAcceptance", "connectAccounts",
)
LOGIN_SCREEN_UI_KEYWORDS_STRICT_ASIA = ("Log in", "Sign in", "請登入", "登入")

ASIA_LOGIN_ACCOUNT_AUTOMATION_IDS = ("accountName",)
ASIA_LOGIN_ACCOUNT_NAME_KEYWORDS = ("email", "電子郵件", "信箱", "account", "帳號", "phone", "電話")
ASIA_LOGIN_PASSWORD_AUTOMATION_IDS = ("password",)
ASIA_LOGIN_PASSWORD_NAME_KEYWORDS = ("密碼", "密码", "Password", "密碼欄位")
ASIA_LOGIN_SUBMIT_AUTOMATION_IDS = ("submit",)
ASIA_LOGIN_SUBMIT_NAME_KEYWORDS = ("登入", "登录", "Log in", "Sign in")
ASIA_LOGIN_CONTINUE_NAME_KEYWORDS = ("繼續", "继续", "Continue", "Next", "下一步")
ASIA_LOGIN_HEADER_KEYWORDS = ("Battle.net 帳號登入", "歡迎回來", "Welcome back", "登入", "Log in")
ASIA_LOGIN_SWITCH_ACCOUNT_KEYWORDS = ("切換帳號", "切换账号", "Switch account")
ASIA_LOGIN_DEBUG_INPUT = True

BATTLE_NET_CN_LOGIN_BASE_W = 362
BATTLE_NET_CN_LOGIN_BASE_H = 599
BATTLE_NET_CN_AGREE_CLICK_X = 31
BATTLE_NET_CN_AGREE_CLICK_Y = 288
BATTLE_NET_CN_NETEASE_CLICK_X = 137
BATTLE_NET_CN_NETEASE_CLICK_Y = 378
BATTLE_NET_CN_AFTER_NETEASE_CLICK_WAIT_SEC = 3.0
BATTLE_NET_CN_AFTER_NETEASE_CLICK_SETTLE_SEC = 0.5
BATTLE_NET_PLAY_BUTTON_LEFT_PX = 177
BATTLE_NET_PLAY_BUTTON_BOTTOM_PX = 97
BATTLE_NET_EXE_NAME = "Battle.net.exe"
BATTLE_NET_BUTTON_HEX = "#0074E0"
BATTLE_NET_BUTTON_RGB = (0, 116, 224)

BN_FLOW_WAIT_AFTER_START_SEC = 3.0
BN_FLOW_POLL_TIMEOUT_SEC = 120.0
BN_FLOW_OAUTH_WAIT_SEC = 120.0
BN_FLOW_EXIT_WAIT_SEC = 2.0
BN_CLICK_MOVE_DURATION_SEC = 0.0
BN_CLICK_PAUSE_AFTER_MOVE_SEC = 0.0

DEFAULT_BRIGHTNESS_TOL = 0.01
DEFAULT_BUTTON_W = 200
DEFAULT_BUTTON_H = 20

# ---------------------------------------------------------------------------
# Click / timer (generic)
# ---------------------------------------------------------------------------
CLICK_MOVE_DURATION_SEC = 0.0
CLICK_PAUSE_AFTER_MOVE_SEC = 0.02
DEBUG_BAG_HOVER_FOCUS_CLICK_DURATION_SEC = 0.0
DEBUG_BAG_HOVER_FOCUS_CLICK_PAUSE_AFTER_MOVE_SEC = 0.0
DEBUG_BAG_HOVER_FOCUS_CLICK_RETURN_TO_ORIGINAL = True
VK_I = 0x49
VK_M = 0x4D
ACTIVATE_BEFORE_CAPTURE_DELAY_SEC = 0.3

# ---------------------------------------------------------------------------
# Path scan (generic)
# ---------------------------------------------------------------------------
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
# Timers / intervals (generic)
# ---------------------------------------------------------------------------
DEFAULT_INTERVAL = 10.0

# ---------------------------------------------------------------------------
# Grid / skill config
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

UI_SETTINGS_WINDOW_GEOMETRY = "window_geometry"
DEFAULT_WINDOW_GEOMETRY = "670x550"
SMART_ECHO_OCR_TICK_MAX_SEC = 60.0

# ---------------------------------------------------------------------------
# Color sets
# ---------------------------------------------------------------------------
HARDCODED_INTERFERENCE_COLORS = {
    (0x09, 0x10, 0x11), (0x08, 0x0d, 0x0d), (0x01, 0x05, 0x09),
    (0x00, 0x04, 0x08), (0x00, 0x05, 0x09), (0x04, 0x10, 0x1c),
}
