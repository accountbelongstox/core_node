# -*- coding: utf-8 -*-
"""
D3-only constants. All symbols use D3_* or are specific to Diablo III / ROSBOT / D3 Battle.net tab and play.
Import directly: from providor.constants.d3 import D3_STANDARD_RESOLUTION_WIDTH
"""
from providor.constants.common import (
    WINDOW_BORDER_LEFT,
    WINDOW_BORDER_RIGHT,
    TITLE_BAR_HEIGHT,
    WINDOW_BORDER_BOTTOM,
)

# ---------------------------------------------------------------------------
# D3 resolution / window
# ---------------------------------------------------------------------------
D3_STANDARD_RESOLUTION_WIDTH = 1300
D3_STANDARD_RESOLUTION_HEIGHT = 800
D3_BATTLENET_STANDARD_RESOLUTION_WIDTH = 960
D3_BATTLENET_STANDARD_RESOLUTION_HEIGHT = 540
D3_KANAI_NEXT_PAGE_BUTTON_RIGHT_RATIO = 0.20
# Interface indicator template keys (same as D3_TEMPLATE_CONFIGS in providor_index)
# 同一图标 bag_opened_indicator：靠左 30% 宽内 = 铁匠入口，靠右 = 仅背包已打开（不视为铁匠）
BAG_OPENED_INDICATOR_TEMPLATE_NAME = "bag_opened_indicator"
BLACKSMITH_INDICATOR_1_TEMPLATE_NAME = "blacksmith_indicator_1"
BLACKSMITH_INDICATOR_2_TEMPLATE_NAME = "blacksmith_indicator_2"
# 魔盒（卡奈）界面识别的唯一图标
KANAI_CUBE_LEFT_PANEL_INDICATOR_TEMPLATE_NAME = "kanai_cube_left_panel_indicator"
KANAI_RIGHT_PAGE_INDICATOR_TEMPLATE_NAME = "kanai_right_page_indicator"
# Kanai right-panel next-page clicks from first page (upgrade=2, reforge=1)
KANAI_UPGRADE_PAGE_CLICKS = 2
KANAI_REFORGE_PAGE_CLICKS = 1

D3_STANDARD_OUTER_WIDTH = D3_STANDARD_RESOLUTION_WIDTH + WINDOW_BORDER_LEFT + WINDOW_BORDER_RIGHT
D3_STANDARD_OUTER_HEIGHT = D3_STANDARD_RESOLUTION_HEIGHT + TITLE_BAR_HEIGHT + WINDOW_BORDER_BOTTOM

# ---------------------------------------------------------------------------
# D3 Battle.net tab / Play (CN and Asia)
# ---------------------------------------------------------------------------
D3_TAB_AUTOMATION_IDS = ("game-nav-btn-D3CN", "game-nav-btn-D3")
D3_TAB_NAME_KEYWORDS = ("Diablo III", "暗黑破坏神", "暗黑破壞神", "Diablo")
START_GAME_AUTOMATION_IDS = ("play-btn-main", "play-btn")
START_GAME_NAME_KEYWORDS = ("Play", "开始游戏", "開始遊戲", "Playing Now")
D3_TAB_AUTOMATION_IDS_ASIA = ("game-nav-btn-D3",)
D3_TAB_NAME_KEYWORDS_ASIA = ("Diablo III", "暗黑破壞神", "Diablo")
START_GAME_AUTOMATION_IDS_ASIA = ("play-btn-main", "play-btn")
START_GAME_NAME_KEYWORDS_ASIA = ("Play", "開始遊戲", "Playing Now")

# ---------------------------------------------------------------------------
# D3 Battle.net (D3-specific)
# ---------------------------------------------------------------------------
BATTLE_NET_D3_SMALL_MAP_SOURCE_FILENAME = "logo.png"
BATTLE_NET_D3_SMALL_MAP_TEMPLATE_NAME = "battlenet_d3_small_map"

# ---------------------------------------------------------------------------
# ROSBOT / flow
# ---------------------------------------------------------------------------
# F3 log timeout: default minutes (UI rosbot.timeout_minutes). Single source for default; F3 and panel use this.
ROSBOT_LOG_TIMEOUT_MINUTES_DEFAULT = 30
ROSBOT_LOG_TIMEOUT_SECONDS_DEFAULT = 300  # Legacy; prefer ROSBOT_LOG_TIMEOUT_MINUTES_DEFAULT * 60

# ---------------------------------------------------------------------------
# D3 in-game
# ---------------------------------------------------------------------------
D3_START_GAME_BUTTON_TEMPLATE_NAME = "d3_start_game_button"
D3_GAME_TOOL_TEMPLATE_NAME = "d3_game_tool"
D3_BOUNTY_PROGRESS_TEMPLATE_NAME = "d3_bounty_progress"
D3_DISCONNECTED_TEMPLATE_NAME = "d3_disconnected"
# Min good matches for d3_disconnected to avoid connecting screen mis-judged as disconnected
D3_DISCONNECTED_MIN_GOOD_MATCHES = 20
D3_CONNECTING_TEMPLATE_NAME = "d3_connecting"
D3_CONNECTING_ALT_TEMPLATE_NAME = "d3_connecting_alt"
D3_MAP_MINIMIZE_CLICK = (610, 126)
D3_TELEPORT_CLICK = (751, 413)       # Large/small map
D3_TELEPORT_CLICK_2 = (713, 611)    # Secret camp minimap
C7B_TELEPORT_CLICK_INTERVAL_SEC = 0.5  # Interval between two teleport clicks
C7B_WAIT_AFTER_CLICK_SEC = 2.0
# After bounty confirmed (map open), wait before minimize/teleport click so map UI is stable and teleport works
C7B_AFTER_BOUNTY_STABLE_SEC = 0.5
D3_GAME_TOOL_AFTER_M_DELAY_SEC = 2.0
D3_START_GAME_WAIT_INTERVAL_SEC = 2.0
D3_START_GAME_MAX_ATTEMPTS = 10
D3_GAME_TOOL_MAX_ATTEMPTS = 10
D3_FRAGMENT1_WAIT_GAME_TOOL_ATTEMPTS = 5
D3_FRAGMENT2_DISAPPEAR_ATTEMPTS = 5
C3_C3W_TIMEOUT_SEC = 180.0  # C3/C3w overall timeout (3 minutes)
# Extension flow deadline in flow ticks (2s per flow tick): 90 * 2s = 180s = 3 minutes
C3_DEADLINE_TICKS = 90
C3W_WAIT_SEC = 2.0
# Within this many seconds after teleport (C7b or D13 success) skip C10 (M-key disconnect check); doc: fresh game does not check M disconnect.
C10_SKIP_AFTER_TELEPORT_SEC = 90
# C10b disconnect threshold: if similarity of before/after M screenshot >= this value treat as 'M no response' -> disconnect. Only C10b (step_c10_compare).
# Reason: lower threshold causes false positive; when online with map state unchanged or small change similarity can be 0.98~0.99, 0.989 once false-disconnected.
# So 0.995: only when two images are almost identical judge as disconnect.
D3_ONLINE_SIMILARITY_THRESHOLD = 0.995
D3_ONLINE_SIMILARITY_RESIZE = (64, 64)

# ---------------------------------------------------------------------------
# Path scan (D3 / ROSBOT)
# ---------------------------------------------------------------------------
DIABLO_III_EXE_NAME = "Diablo III.exe"
ROSBOT_EXE_PATTERNS = ("ros-bot*.exe", "RoS-BoT*.exe")

# ROSBOT update check: GameTools base dir (ros-bot*.exe from here or config); Downloads dir for zip
ROSBOT_GAMETOOLS_BASE = r"D:\applications\GameTools"
ROSBOT_ZIP_MIN_SIZE_MB = 20
ROSBOT_ZIP_MAX_SIZE_MB = 50  # 压缩包大小范围 20–50MB
# Downloads zip match: 国际服=亚服，优先检测亚服（亚服包名可能同时含亚服和国服字样，归亚服）
ROSBOT_ZIP_KEYWORDS_ASIA = ("亚服", "asia", "Asia", "国际服", "global", "Global")
ROSBOT_ZIP_KEYWORDS_CN = ("国服", "cn", "CN")
# ROSBOT directory namespace: region-specific subdirectories under GameTools
ROSBOT_DIR_NAMESPACE_ASIA = "Asia"  # 亚服目录命名空间
ROSBOT_DIR_NAMESPACE_CN = "CN"      # 国服目录命名空间
# Region display names for UI
ROSBOT_REGION_DISPLAY_ASIA = "亚服"
ROSBOT_REGION_DISPLAY_CN = "国服"

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
