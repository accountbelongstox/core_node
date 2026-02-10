#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Game Interface Controller
Handles initialization and management of game interface functionality
"""

import os
import sys
import time
import threading
from typing import Dict, List, Optional, Callable
from pathlib import Path

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

# Direct pycore imports (no secondary encapsulation)
from pycore.pyfoundations.color_print import ColorPrint
from d3utils.global_hotkey_manager import get_global_hotkey_manager, register_hotkey, unregister_hotkey
from providor.providor_index import CONFIG
from controller.game_assistant_controller import GameAssistantController, get_game_assistant_controller
from runtime import get_thread_registry


class GameInterfaceMacroThread(threading.Thread):
    """Game interface macro loop thread (native run() logic; no wrapper). Created via controller.create_macro_thread()."""

    def __init__(self, controller: "GameInterfaceController", skill_config: Dict):
        super().__init__(daemon=True, name="GameInterfaceMacro")
        self._controller = controller
        self._skill_config = skill_config

    def run(self) -> None:
        c = self._controller
        cfg = self._skill_config
        try:
            ColorPrint.blue("[MACRO] Macro loop started")
            while c.macro_running:
                if not c._is_diablo_running():
                    ColorPrint.yellow("[MACRO] Diablo III not running, pausing...")
                    time.sleep(1.0)
                    continue
                c._execute_skill_sequence(cfg)
                time.sleep(0.1)
            ColorPrint.blue("[MACRO] Macro loop ended")
        except Exception as e:
            ColorPrint.red(f"[ERROR] Macro loop error: {e}")
        finally:
            c.macro_running = False


class GameInterfaceController:
    """
    Controller for initializing and managing game interface functionality
    """
    
    def __init__(self):
        """Initialize game interface controller"""
        self.hotkey_manager = get_global_hotkey_manager()
        self.registered_hotkeys: Dict[str, str] = {}  # hotkey -> description mapping
        self.initialized = False
        self.macro_running = False
        # Macro thread owned by ThreadRegistry; no self.macro_thread

        # Initialize game assistant controller (lazy)
        self.assistant_controller: Optional[GameAssistantController] = None

        # Load hotkey configuration
        self._load_hotkey_config()

        ColorPrint.green("[INIT] GameInterfaceController initialized")
    
    def run_assistant_auto_use(self) -> None:
        """Run assistant auto-use interface function (used by hotkey callback from d3utils)."""
        if self.assistant_controller is None:
            self.assistant_controller = get_game_assistant_controller()
        self.assistant_controller.auto_use_interface_function()

    def _load_hotkey_config(self):
        """Load hotkey configuration from CONFIG"""
        try:
            # Get current configuration
            auxiliary_config = CONFIG.get('macro_configs', {}).get('auxiliary_config', {})

            # Extract hotkey settings
            self.macro_start_hotkey = auxiliary_config.get('macro_start_hotkey', 'F9')
            self.assistant_hotkey = auxiliary_config.get('assistant_hotkey', 'F10')

            ColorPrint.blue(f"[CONFIG] Loaded hotkeys:")
            ColorPrint.blue(f"  Macro Start: {self.macro_start_hotkey}")
            ColorPrint.blue(f"  Assistant: {self.assistant_hotkey}")

        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to load hotkey config: {e}")
            raise e  # Re-raise the error since we don't want defaults
    
    def initialize_game_interface(self) -> bool:
        """
        Initialize game interface functionality
        
        Returns:
            True if initialized successfully, False otherwise
        """
        if self.initialized:
            ColorPrint.yellow("[WARN] Game interface already initialized")
            return True
        
        try:
            ColorPrint.blue("[INIT] Initializing game interface...")
            
            # Register hotkeys
            
            # Start hotkey listening
            if not self.hotkey_manager.hotkey_listener.start_listening():
                ColorPrint.red("[ERROR] Failed to start hotkey listening")
                return False
            
            self.initialized = True
            ColorPrint.green("[SUCCESS] Game interface initialized successfully")
            return True
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to initialize game interface: {e}")
            return False
    
    def shutdown_game_interface(self) -> bool:
        """
        Shutdown game interface functionality
        
        Returns:
            True if shutdown successfully, False otherwise
        """
        if not self.initialized:
            ColorPrint.yellow("[WARN] Game interface not initialized")
            return True
        
        try:
            ColorPrint.blue("[SHUTDOWN] Shutting down game interface...")
            
            # Stop macro if running
            if self.macro_running:
                self.stop_macro()
            
            # Unregister hotkeys
            self._unregister_hotkeys()
            
            # Stop hotkey listening
            self.hotkey_manager.hotkey_listener.stop_listening()
            
            self.initialized = False
            ColorPrint.green("[SUCCESS] Game interface shutdown successfully")
            return True
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to shutdown game interface: {e}")
            return False
    
    
    def _unregister_hotkeys(self):
        """Unregister all hotkeys from the global manager"""
        try:
            for hotkey in list(self.registered_hotkeys.keys()):
                unregister_hotkey(hotkey, "game_interface_controller")
            
            self.registered_hotkeys.clear()
            ColorPrint.blue("[UNREGISTER] Unregistered all hotkeys")
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to unregister hotkeys: {e}")
    
    def _on_macro_start(self):
        """Handle macro start/stop hotkey"""
        try:
            if self.macro_running:
                self.stop_macro()
            else:
                self.start_macro()
        except Exception as e:
            ColorPrint.red(f"[ERROR] Macro start/stop error: {e}")
    
    def _on_macro_pause(self):
        """Handle macro pause/resume hotkey"""
        try:
            if self.macro_running:
                ColorPrint.yellow("[HOTKEY] Macro pause/resume - Not implemented yet")
            else:
                ColorPrint.yellow("[HOTKEY] Macro not running, cannot pause")
        except Exception as e:
            ColorPrint.red(f"[ERROR] Macro pause/resume error: {e}")
    
    def _on_combat_trigger(self):
        """Handle combat functions hotkey"""
        try:
            ColorPrint.blue("[HOTKEY] Combat functions triggered")
            # TODO: Implement combat functions
            self._execute_combat_functions()
        except Exception as e:
            ColorPrint.red(f"[ERROR] Combat functions error: {e}")
    
    def start_macro(self) -> bool:
        """
        Start macro execution
        
        Returns:
            True if started successfully, False otherwise
        """
        if self.macro_running:
            ColorPrint.yellow("[WARN] Macro already running")
            return True
        
        try:
            ColorPrint.blue("[MACRO] Starting macro execution...")
            
            # Get current skill configuration
            current_config_name = 'config1'  # Default config
            skill_config = CONFIG.get('macro_configs', {}).get('skill_configs', {}).get(current_config_name, {})
            
            self.macro_running = True
            get_thread_registry().start_game_interface_macro(self, skill_config)

            ColorPrint.green("[SUCCESS] Macro started")
            return True
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to start macro: {e}")
            return False
    
    def stop_macro(self) -> bool:
        """
        Stop macro execution
        
        Returns:
            True if stopped successfully, False otherwise
        """
        if not self.macro_running:
            ColorPrint.yellow("[WARN] Macro not running")
            return True
        
        try:
            ColorPrint.blue("[MACRO] Stopping macro execution...")
            
            self.macro_running = False
            get_thread_registry().stop_game_interface_macro()
            
            ColorPrint.green("[SUCCESS] Macro stopped")
            return True
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to stop macro: {e}")
            return False

    def create_macro_thread(self, skill_config: Dict) -> GameInterfaceMacroThread:
        """Create the macro thread instance. ThreadRegistry calls this."""
        return GameInterfaceMacroThread(self, skill_config)
    
    def _is_diablo_running(self) -> bool:
        """
        Check if Diablo III is running
        
        Returns:
            True if Diablo III is running, False otherwise
        """
        try:
            # TODO: Implement Diablo III process check
            # This is a placeholder implementation
            return True
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to check Diablo III status: {e}")
            return False
    
    def _execute_skill_sequence(self, skill_config: Dict):
        """
        Execute skill sequence based on configuration
        
        Args:
            skill_config: Skill configuration dictionary
        """
        try:
            # TODO: Implement skill execution logic
            # This is a placeholder implementation
            pass
        except Exception as e:
            ColorPrint.red(f"[ERROR] Skill sequence execution error: {e}")
    
    def get_status(self) -> Dict:
        """
        Get current controller status
        
        Returns:
            Dictionary with status information
        """
        return {
            "initialized": self.initialized,
            "macro_running": self.macro_running,
            "registered_hotkeys": len(self.registered_hotkeys),
            "hotkeys": self.registered_hotkeys.copy()
        }

def main():
    """Main function for testing"""
    ColorPrint.blue("=== Game Interface Controller Test ===")
    
    controller = get_game_interface_controller()
    
    # Initialize
    if controller.initialize_game_interface():
        ColorPrint.green("[TEST] Game interface initialized successfully")
        
        # Show status
        status = controller.get_status()
        ColorPrint.blue(f"[STATUS] {status}")
        
        # Test hotkey update
        ColorPrint.blue("[TEST] Testing hotkey update...")
        
        ColorPrint.blue("[TEST] Press registered hotkeys to test functionality")
        ColorPrint.blue("[TEST] Press Ctrl+C to exit...")
        
        try:
            while True:
                time.sleep(0.1)
        except KeyboardInterrupt:
            ColorPrint.yellow("\n[TEST] Shutting down...")
            controller.shutdown_game_interface()
            ColorPrint.green("[TEST] Test completed")
    else:
        ColorPrint.red("[TEST] Failed to initialize game interface")


_game_interface_controller_instance: Optional[GameInterfaceController] = None


def get_game_interface_controller() -> GameInterfaceController:
    """Return the global GameInterfaceController instance (singleton). 导出前实例化."""
    global _game_interface_controller_instance
    if _game_interface_controller_instance is None:
        _game_interface_controller_instance = GameInterfaceController()
    return _game_interface_controller_instance


if __name__ == "__main__":
    main()
