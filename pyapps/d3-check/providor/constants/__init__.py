# -*- coding: utf-8 -*-
"""
Constants namespace. Direct reference only; no aggregation re-export.

Usage:
  from providor.constants import common, d3, d4
  from providor.constants.common import TMP_DIR, DEBUG
  from providor.constants.d3 import D3_STANDARD_RESOLUTION_WIDTH
  from providor.constants.d4 import D4_TICK_INTERVAL, D4_SCREENSHOT_DIR
  from providor.constants.ui import TAB_INDEX_MAIN, PANEL_KEY_ROSBOT
"""
from . import common
from . import d3
from . import d4
from . import ui

__all__ = ["common", "d3", "d4", "ui"]
