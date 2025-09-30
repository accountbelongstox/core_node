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

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

# Add ncore path for pytools
ncore_path = os.path.join(os.path.dirname(os.path.dirname(current_dir)), "ncore")
sys.path.insert(0, ncore_path)

from pytools.pyfoundations.color_print import ColorPrint
from pytools.pyutils.hotkey_listener import get_global_hotkey_listener, register_global_hotkey, unregister_global_hotkey
from providor.providor_index import CONFIG
from controller.game_assistant_controller import GameAssistantController


class GameInterfaceController:
    """
    Controller for initializing and managing game interface functionality
    """
    
    def __init__(self):
        """Initialize game interface controller"""
        self.hotkey_listener = get_global_hotkey_listener()
        self.registered_hotkeys: Dict[str, str] = {}  # hotkey -> description mapping
        self.initialized = False
        self.macro_running = False
        self.macro_thread: Optional[threading.Thread] = None

        # Initialize game assistant controller
        self.assistant_controller: Optional[GameAssistantController] = None

        # Load hotkey configuration
        self._load_hotkey_config()

        ColorPrint.green("[INIT] GameInterfaceController initialized")
    
    def _load_hotkey_config(self):
        """Load hotkey configuration from CONFIG"""
        try:
            # Get current configuration
            auxiliary_config = CONFIG.get('macro_configs', {}).get('auxiliary_config', {})
            
            # Extract hotkey settings
            self.macro_start_hotkey = auxiliary_config.get('macro_start_hotkey', 'F9')
            self.macro_pause_hotkey = auxiliary_config.get('macro_pause_hotkey', 'F10')
            self.combat_hotkey = auxiliary_config.get('combat_hotkey', 'F11')
            self.assistant_hotkey = auxiliary_config.get('assistant_hotkey', 'F12')
            
            ColorPrint.blue(f"[CONFIG] Loaded hotkeys:")
            ColorPrint.blue(f"  Macro Start: {self.macro_start_hotkey}")
            ColorPrint.blue(f"  Macro Pause: {self.macro_pause_hotkey}")
            ColorPrint.blue(f"  Combat: {self.combat_hotkey}")
            ColorPrint.blue(f"  Assistant: {self.assistant_hotkey}")
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to load hotkey config: {e}")
            # Use default hotkeys
            self.macro_start_hotkey = 'F9'
            self.macro_pause_hotkey = 'F10'
            self.combat_hotkey = 'F11'
            self.assistant_hotkey = 'F12'
    
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
            self._register_hotkeys()
            
            # Start hotkey listening
            if not self.hotkey_listener.start_listening():
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
            self.hotkey_listener.stop_listening()
            
            self.initialized = False
            ColorPrint.green("[SUCCESS] Game interface shutdown successfully")
            return True
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to shutdown game interface: {e}")
            return False
    
    def update_hotkeys(self) -> bool:
        """
        Update hotkey bindings from configuration
        
        Returns:
            True if updated successfully, False otherwise
        """
        try:
            ColorPrint.blue("[UPDATE] Updating hotkey bindings...")
            
            # Load new configuration
            self._load_hotkey_config()
            
            # Unregister old hotkeys
            self._unregister_hotkeys()
            
            # Register new hotkeys
            self._register_hotkeys()
            
            ColorPrint.green("[SUCCESS] Hotkey bindings updated")
            return True
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to update hotkeys: {e}")
            return False
    
    def _register_hotkeys(self):
        """Register all hotkeys with the listener"""
        try:
            # Register macro start hotkey
            register_global_hotkey(
                self.macro_start_hotkey,
                self._on_macro_start,
                "Start/Stop Macro",
                priority=10,
                enabled=True
            )
            self.registered_hotkeys[self.macro_start_hotkey] = "Start/Stop Macro"
            
            # Register macro pause hotkey
            register_global_hotkey(
                self.macro_pause_hotkey,
                self._on_macro_pause,
                "Pause/Resume Macro",
                priority=9,
                enabled=True
            )
            self.registered_hotkeys[self.macro_pause_hotkey] = "Pause/Resume Macro"
            
            # Register combat hotkey
            register_global_hotkey(
                self.combat_hotkey,
                self._on_combat_trigger,
                "Combat Functions",
                priority=8,
                enabled=True
            )
            self.registered_hotkeys[self.combat_hotkey] = "Combat Functions"
            
            # Register assistant hotkey
            register_global_hotkey(
                self.assistant_hotkey,
                self._on_assistant_trigger,
                "Assistant Functions",
                priority=7,
                enabled=True
            )
            self.registered_hotkeys[self.assistant_hotkey] = "Assistant Functions"
            
            ColorPrint.green(f"[REGISTER] Registered {len(self.registered_hotkeys)} hotkey(s)")
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to register hotkeys: {e}")
    
    def _unregister_hotkeys(self):
        """Unregister all hotkeys from the listener"""
        try:
            for hotkey in list(self.registered_hotkeys.keys()):
                unregister_global_hotkey(hotkey)
            
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
    
    def _on_assistant_trigger(self):
        """Handle assistant functions hotkey"""
        try:
            ColorPrint.blue("[HOTKEY] Assistant functions triggered")
            # TODO: Implement assistant functions
            self._execute_assistant_functions()
        except Exception as e:
            ColorPrint.red(f"[ERROR] Assistant functions error: {e}")
    
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
            
            # Start macro thread
            self.macro_thread = threading.Thread(
                target=self._macro_loop,
                args=(skill_config,),
                daemon=True
            )
            self.macro_running = True
            self.macro_thread.start()
            
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
            
            # Wait for macro thread to finish
            if self.macro_thread and self.macro_thread.is_alive():
                self.macro_thread.join(timeout=2.0)
            
            ColorPrint.green("[SUCCESS] Macro stopped")
            return True
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to stop macro: {e}")
            return False
    
    def _macro_loop(self, skill_config: Dict):
        """
        Main macro execution loop
        
        Args:
            skill_config: Skill configuration dictionary
        """
        try:
            ColorPrint.blue("[MACRO] Macro loop started")
            
            while self.macro_running:
                # TODO: Implement actual macro logic
                # This is a placeholder implementation
                
                # Check if Diablo III is running
                if not self._is_diablo_running():
                    ColorPrint.yellow("[MACRO] Diablo III not running, pausing...")
                    time.sleep(1.0)
                    continue
                
                # Execute skill sequence
                self._execute_skill_sequence(skill_config)
                
                # Wait before next iteration
                time.sleep(0.1)
            
            ColorPrint.blue("[MACRO] Macro loop ended")
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Macro loop error: {e}")
        finally:
            self.macro_running = False
    
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
    
    def _execute_assistant_functions(self):
        """Execute assistant-related functions using GameAssistantController"""
        try:
            ColorPrint.blue("[ASSISTANT] Executing assistant functions...")

            # Create assistant controller if needed
            if self.assistant_controller is None:
                ColorPrint.blue("[ASSISTANT] Creating GameAssistantController...")
                self.assistant_controller = GameAssistantController()

            # Execute assistant functions
            success = self.assistant_controller.execute_assistant_functions()

            if success:
                ColorPrint.green("[ASSISTANT] Assistant functions executed successfully")
            else:
                ColorPrint.yellow("[ASSISTANT] Assistant functions execution incomplete")

        except Exception as e:
            ColorPrint.red(f"[ERROR] Assistant functions error: {e}")
            import traceback
            traceback.print_exc()
    
    def _execute_combat_functions(self):
        """Execute combat-related functions"""
        try:
            # TODO: Implement combat functions
            ColorPrint.blue("[COMBAT] Executing combat functions...")
            # Placeholder for combat logic
        except Exception as e:
            ColorPrint.red(f"[ERROR] Combat functions error: {e}")
    
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
    
    # Create controller
    controller = GameInterfaceController()
    
    # Initialize
    if controller.initialize_game_interface():
        ColorPrint.green("[TEST] Game interface initialized successfully")
        
        # Show status
        status = controller.get_status()
        ColorPrint.blue(f"[STATUS] {status}")
        
        # Test hotkey update
        ColorPrint.blue("[TEST] Testing hotkey update...")
        controller.update_hotkeys()
        
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


if __name__ == "__main__":
    main()
