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
BATTLE_NET_D3_SMALL_MAP_SOURCE_FILENAME = "ScreenShot_2026-01-29_225845_569.png"
BATTLE_NET_D3_SMALL_MAP_TEMPLATE_NAME = "battlenet_d3_small_map"

# ---------------------------------------------------------------------------
# ROSBOT / flow
# ---------------------------------------------------------------------------
ROSBOT_LOG_TIMEOUT_SECONDS_DEFAULT = 300

# ---------------------------------------------------------------------------
# D3 in-game
# ---------------------------------------------------------------------------
D3_START_GAME_BUTTON_TEMPLATE_NAME = "d3_start_game_button"
D3_GAME_TOOL_TEMPLATE_NAME = "d3_game_tool"
D3_BOUNTY_PROGRESS_TEMPLATE_NAME = "d3_bounty_progress"
D3_DISCONNECTED_TEMPLATE_NAME = "d3_disconnected"
D3_CONNECTING_TEMPLATE_NAME = "d3_connecting"
D3_CONNECTING_ALT_TEMPLATE_NAME = "d3_connecting_alt"
D3_MAP_MINIMIZE_CLICK = (751, 413)
D3_TELEPORT_CLICK = (610, 126)
C7B_WAIT_AFTER_CLICK_SEC = 2.0
D3_GAME_TOOL_AFTER_M_DELAY_SEC = 2.0
D3_START_GAME_WAIT_INTERVAL_SEC = 2.0
D3_START_GAME_MAX_ATTEMPTS = 10
D3_GAME_TOOL_MAX_ATTEMPTS = 10
D3_FRAGMENT1_WAIT_GAME_TOOL_ATTEMPTS = 5
D3_FRAGMENT2_DISAPPEAR_ATTEMPTS = 5
C3_C3W_TIMEOUT_SEC = 60.0
C3_DEADLINE_TICKS = 30
C3W_WAIT_SEC = 2.0
D3_ONLINE_SIMILARITY_THRESHOLD = 0.98
D3_ONLINE_SIMILARITY_RESIZE = (64, 64)

# ---------------------------------------------------------------------------
# Path scan (D3 / ROSBOT)
# ---------------------------------------------------------------------------
DIABLO_III_EXE_NAME = "Diablo III.exe"
ROSBOT_EXE_PATTERNS = ("ros-bot*.exe", "RoS-BoT*.exe")

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
