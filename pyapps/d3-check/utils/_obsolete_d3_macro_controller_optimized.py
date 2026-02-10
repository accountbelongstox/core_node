#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OBSOLETE: D3Check Macro Controller - Optimized Version
- Duplicate of D3MacroController; never wired into main.py or http_bridge.
- Depends on non-existent ui.diablo3_macro_ui_optimized.Diablo3MacroUIOptimized.
- Use controller.d3_macro_controller.D3MacroController instead.
"""

import sys
import threading
import time
import logging
from pathlib import Path
from typing import Optional, Callable

# Add project root to Python path when run from utils/
_current_dir = Path(__file__).resolve().parent
_project_root = _current_dir.parent
sys.path.insert(0, str(_project_root))

# Direct pycore imports (no secondary encapsulation)
from pycore.pyfoundations.color_print import ColorPrint
from providor.providor_index import CONFIG, load_config
from controller.game_interface_controller import GameInterfaceController

# Diablo3MacroUIOptimized does not exist; this module is obsolete.
# from ui.diablo3_macro_ui_optimized import Diablo3MacroUIOptimized


class D3MacroControllerOptimized:
    """
    OBSOLETE. Use D3MacroController. Kept only for reference.
    """

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.game_interface_controller = GameInterfaceController()
        self.ui: Optional[object] = None
        self.macro_running = False
        self.macro_thread: Optional[threading.Thread] = None
        self.current_skill_config = 'config1'
        self.shutdown_requested = False
        ColorPrint.yellow("[OBSOLETE] D3MacroControllerOptimized is deprecated; use D3MacroController")

    def start_macro(self):
        pass

    def stop_macro(self):
        pass

    def switch_skill_config(self, config_name: str):
        pass

    def run(self):
        ColorPrint.red("[OBSOLETE] D3MacroControllerOptimized.run() not supported; use main.py with D3MacroController")
