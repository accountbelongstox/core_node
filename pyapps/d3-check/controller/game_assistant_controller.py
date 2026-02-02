#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Game Assistant Function Controller
Controls game assistant functions like Kanai's Cube operations
"""

import os
import sys

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)

sys.path.insert(0, project_root)

from pycore.pyfoundations.color_print import ColorPrint
from d3utils.interface_manager import D3InterfaceManager
from share.game_interface_data import get_game_interface_data
from providor.providor_index import (
    can_start_assistant,
    set_assistant_running,
    should_stop_assistant,
    reset_assistant_state
)
from controller.ctl_func import get_blacksmith_handler, get_kanai_cube_handler

class GameAssistantController:
    """
    Game Assistant Function Controller

    Handles:
    - Interface detection and initialization
    - Delegates to specialized handlers for operations
    """

    def __init__(self):
        """Initialize game assistant controller"""
        ColorPrint.green("[GameAssistantController] Initializing...")
        self.interface_manager = D3InterfaceManager()
        ColorPrint.green("[GameAssistantController] Initialized")

    def auto_use_interface_function(self) -> bool:
        """
        Auto use game interface function

        This function detects the current interface type and branches to the appropriate handler:
        - Kanai Cube: Execute upgrade logic (click next page 2 times)
        - Blacksmith: Execute salvage operation
        - No interface: Show error and instructions

        Supports interruption via hotkey toggle.

        Returns:
            True if operation successful, False otherwise
        """
        # Check if can start
        if not can_start_assistant():
            ColorPrint.yellow("[AutoUseInterface] Cannot start: already running or disabled")
            return False

        # Mark as running immediately
        set_assistant_running(True)

        ColorPrint.blue("\n" + "="*80)
        ColorPrint.blue("[AutoUseInterface] Starting auto use interface function...")
        ColorPrint.blue("[AutoUseInterface] Press hotkey again to stop")
        ColorPrint.blue("="*80)

        # Check if stopped before collecting data
        if should_stop_assistant():
            ColorPrint.yellow("[AutoUseInterface] Execution stopped by user")
            return False

        # Step 1: Collect interface information (only once!)
        ColorPrint.blue("[AutoUseInterface] Step 1: Detecting interface type...")
        bag_success = self.interface_manager.collect_bag_info_quik()
        if not bag_success:
            ColorPrint.red("[AutoUseInterface] Failed to collect interface info")
            return False

        # Check if stopped after collecting data
        if should_stop_assistant():
            ColorPrint.yellow("[AutoUseInterface] Execution stopped by user")
            return False

        # Step 2: Get shared data and check interface type
        shared_data = get_game_interface_data()
        interface_type = shared_data.interface_type

        ColorPrint.green(f"[AutoUseInterface] Interface type detected: {interface_type if interface_type else 'None'}")

        # Step 3: Branch to appropriate handler based on interface type
        result = False
        if interface_type == "kanai_cube":
            result = self._handle_kanai_cube_upgrade(shared_data)
        elif interface_type == "blacksmith":
            result = self._handle_blacksmith_upgrade()
        else:
            result = self._handle_no_interface_upgrade()

        # Always reset state to idle
        reset_assistant_state()
        ColorPrint.blue("[AutoUseInterface] Execution finished, state reset")

        return result

    def _handle_kanai_cube_upgrade(self, shared_data) -> bool:
        """
        Handle Kanai Cube upgrade yellow items

        Delegates to KanaiCubeHandler for upgrade operation.

        Args:
            shared_data: Shared game interface data (already collected)

        Returns:
            True if operation successful, False otherwise
        """
        ColorPrint.blue("\n[AutoUpgrade] Interface type: Kanai Cube")
        ColorPrint.blue("[AutoUpgrade] Executing Kanai Cube upgrade logic...")
        
        # Get Kanai Cube handler
        kanai_handler = get_kanai_cube_handler()
        
        # Execute upgrade operation
        result = kanai_handler.handle_upgrade_operation()
        
        if result:
            ColorPrint.green("[AutoUpgrade] Kanai Cube upgrade operation completed")
        else:
            ColorPrint.red("[AutoUpgrade] Kanai Cube upgrade operation failed")
        
        return result

    def _handle_blacksmith_upgrade(self) -> bool:
        """
        Handle blacksmith salvage operation

        Blacksmith does not have upgrade function.
        Instead, this will perform salvage operation.

        Returns:
            True if operation successful, False otherwise
        """
        ColorPrint.blue("\n[AutoUpgrade] Interface type: Blacksmith")
        ColorPrint.blue("[AutoUpgrade] Blacksmith does not have upgrade function")
        ColorPrint.blue("[AutoUpgrade] Executing salvage operation instead...")

        # Get handler instance
        blacksmith_handler = get_blacksmith_handler()

        # Execute salvage operation
        result = blacksmith_handler.handle_salvage_operation()

        if result:
            ColorPrint.green("[AutoUpgrade] Blacksmith salvage operation completed")
        else:
            ColorPrint.red("[AutoUpgrade] Blacksmith salvage operation failed")

        return result

    def _handle_no_interface_upgrade(self) -> bool:
        """
        Handle upgrade when no functional interface is opened

        Returns:
            False (cannot proceed)
        """
        ColorPrint.red("\n[AutoUpgrade] No functional interface detected")
        ColorPrint.red("[AutoUpgrade] Please open Kanai's Cube to use upgrade function")
        ColorPrint.yellow("[AutoUpgrade] Steps:")
        ColorPrint.yellow("[AutoUpgrade]   1. Open inventory (press 'I')")
        ColorPrint.yellow("[AutoUpgrade]   2. Click Kanai's Cube icon")
        ColorPrint.yellow("[AutoUpgrade]   3. Wait for interface to fully load")
        ColorPrint.yellow("[AutoUpgrade]   4. Run this function again")
        return False