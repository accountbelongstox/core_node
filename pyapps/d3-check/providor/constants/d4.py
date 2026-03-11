# -*- coding: utf-8 -*-
"""
D4-only constants. All symbols use D4_* or are specific to Diablo IV.
Import directly: from providor.constants.d4 import D4_TICK_INTERVAL, D4_SCREENSHOT_DIR
"""
from providor.constants.common import TMP_DIR

# ---------------------------------------------------------------------------
# D4 resolution
# ---------------------------------------------------------------------------
D4_STANDARD_RESOLUTION_WIDTH = 1763
D4_STANDARD_RESOLUTION_HEIGHT = 1126

# ---------------------------------------------------------------------------
# D4 paths
# ---------------------------------------------------------------------------
D4_SCREENSHOT_DIR = TMP_DIR / "d4_screenshots"
D4_ANNOTATED_DIR = TMP_DIR / "d4_annotated"

# ---------------------------------------------------------------------------
# D4 Battle.net tab / Play (CN and Asia)
# ---------------------------------------------------------------------------
D4_TAB_AUTOMATION_IDS = ("game-nav-btn-D4CN", "game-nav-btn-D4")
D4_TAB_NAME_KEYWORDS = ("Diablo IV", "暗黑破坏神IV", "暗黑破壞神IV", "IV》")
D4_START_GAME_AUTOMATION_IDS = ("play-btn-main", "play-btn")
D4_START_GAME_NAME_KEYWORDS = ("Play", "开始游戏", "開始遊戲", "Playing Now")
D4_TAB_AUTOMATION_IDS_ASIA = ("game-nav-btn-D4",)
D4_TAB_NAME_KEYWORDS_ASIA = ("Diablo IV", "暗黑破壞神IV", "IV》")
D4_START_GAME_AUTOMATION_IDS_ASIA = ("play-btn-main", "play-btn")
D4_START_GAME_NAME_KEYWORDS_ASIA = ("Play", "開始遊戲", "Playing Now")

# ---------------------------------------------------------------------------
# D4 timers / events
# ---------------------------------------------------------------------------
D4_TICK_INTERVAL = 3.0
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
