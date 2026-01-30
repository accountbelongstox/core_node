#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3Check Macro Controller
Main controller for Diablo 3 Macro application
"""

import os
import sys
import threading
import time
import logging
from pathlib import Path
from typing import Optional, Callable

# Add the current directory to Python path
current_dir = Path(__file__).parent.parent
sys.path.insert(0, str(current_dir))

from providor.providor_index import CONFIG, load_config, save_config, CONFIG_USER_PATH
from providor.common_imports import ColorPrint
from ui.diablo3_macro_ui import Diablo3MacroUI
from controller.game_interface_controller import GameInterfaceController
from d3utils.i18n_manager import i18n_manager
from d3utils.main_function_thread import (
    MainFunctionThread,
    get_main_function_thread,
    set_main_function_thread,
)
from d3utils.auxiliary_function_thread import (
    AuxiliaryFunctionThread,
    get_auxiliary_function_thread,
    set_auxiliary_function_thread,
)
from d3utils.d3_extension_thread import D3ExtensionThread, get_d3_extension_thread, set_d3_extension_thread
from d3utils.d4_extension_thread import D4ExtensionThread, get_d4_extension_thread, set_d4_extension_thread
from d3utils.event_center import (
    register_extension_handlers,
    trigger_extension_main_start_macro,
    trigger_extension_main_stop_macro,
)
from d3utils.shutdown_manager import execute_shutdown
import timers.window_monitor_timer as window_monitor


class D3MacroController:
    """Main controller for Diablo 3 Macro application"""
    
    def __init__(self):
        """Initialize the controller"""
        self.logger = logging.getLogger(__name__)
        
        # Game interface controller
        self.game_interface_controller = GameInterfaceController()
        
        # UI instance
        self.ui: Optional[Diablo3MacroUI] = None
        
        # Macro state
        self.macro_running = False
        self.macro_thread: Optional[threading.Thread] = None
        self.current_skill_config = 'config1'
        
        # Callbacks
        self.on_macro_start: Optional[Callable] = None
        self.on_macro_stop: Optional[Callable] = None
        self.on_config_change: Optional[Callable] = None

        # Language change control
        self._last_language_change_time = 0
        self._language_change_debounce_ms = 500  # 500ms debounce
    
    def start_macro(self):
        """Start the macro (sends command to MainFunctionThread if available)."""
        if self.macro_running:
            if self.ui:
                self.ui.show_message("警告", "宏已经在运行中！", "warning")
            return

        main_thread = get_main_function_thread()
        if main_thread:
            main_thread.set_current_skill_config(self.current_skill_config)
        trigger_extension_main_start_macro()
        self.macro_running = True
        if not main_thread:
            self.macro_running = True
            self.macro_thread = threading.Thread(target=self._macro_loop_fallback, daemon=True)
            self.macro_thread.start()

        if self.ui:
            self.ui.show_message("信息", "宏已启动！", "info")
        if self.on_macro_start:
            self.on_macro_start()

    def stop_macro(self):
        """Stop the macro (sends command to MainFunctionThread if available)."""
        if not self.macro_running:
            if self.ui:
                self.ui.show_message("警告", "宏没有在运行！", "warning")
            return

        trigger_extension_main_stop_macro()
        self.macro_running = False
        main_thread = get_main_function_thread()
        if self.macro_thread:
            self.macro_thread.join(timeout=1)
            self.macro_thread = None

        if self.ui:
            self.ui.show_message("信息", "宏已停止！", "info")
        if self.on_macro_stop:
            self.on_macro_stop()

    def _macro_loop_fallback(self):
        """Fallback macro loop when MainFunctionThread not used."""
        while self.macro_running:
            try:
                skill_config = CONFIG.get('macro_configs', {}).get('skill_configs', {}).get(self.current_skill_config, {})
                auxiliary_config = CONFIG.get('macro_configs', {}).get('auxiliary_config', {})
                config = {**skill_config, **auxiliary_config}
                skills = config.get('skills', {})

                for skill_name, skill_config in skills.items():
                    if not self.macro_running:
                        break
                    if skill_config.get('strategy') == '禁用':
                        continue
                    self._execute_skill(skill_name, skill_config)
                    time.sleep(0.01)
                time.sleep(0.1)
            except Exception as e:
                self.logger.error("Macro error: %s", e)
                time.sleep(1)

    def _execute_skill(self, skill_name: str, skill_config: dict):
        """Execute a single skill (placeholder)."""
        self.logger.debug(
            "Executing %s: %s - Key: %s",
            skill_name,
            skill_config.get('strategy'),
            skill_config.get('key'),
        )
    
    def switch_skill_config(self, config_name: str):
        """Switch skill configuration namespace"""
        if config_name not in ['config1', 'config2', 'config3', 'config4']:
            raise ValueError(f"Invalid config name: {config_name}")

        self.current_skill_config = config_name
        main_thread = get_main_function_thread()
        if main_thread:
            main_thread.set_current_skill_config(config_name)
        self.logger.info("Switched to skill configuration: %s", config_name)

        if self.on_config_change:
            self.on_config_change(config_name)
    
    def get_current_config(self) -> dict:
        """Get current merged configuration"""
        skill_config = CONFIG.get('macro_configs', {}).get('skill_configs', {}).get(self.current_skill_config, {})
        auxiliary_config = CONFIG.get('macro_configs', {}).get('auxiliary_config', {})
        return {**skill_config, **auxiliary_config}
    
    def get_skill_config(self, config_name: str = None) -> dict:
        """Get skill configuration"""
        if config_name is None:
            config_name = self.current_skill_config
        return CONFIG.get('macro_configs', {}).get('skill_configs', {}).get(config_name, {})
    
    def get_auxiliary_config(self) -> dict:
        """Get auxiliary configuration"""
        return CONFIG.get('macro_configs', {}).get('auxiliary_config', {})
    
    def update_skill_config(self, config_name: str, config_data: dict):
        """Update skill configuration"""
        CONFIG['macro_configs']['skill_configs'][config_name] = config_data
        save_config()
        self.logger.info(f"Updated skill configuration: {config_name}")

    def update_auxiliary_config(self, config_data: dict):
        """Update auxiliary configuration"""
        CONFIG['macro_configs']['auxiliary_config'].update(config_data)
        save_config()
        self.logger.info("Updated auxiliary configuration")
    
    def on_ui_macro_start(self):
        """Handle UI macro start request"""
        self.start_macro()
    
    def on_ui_macro_stop(self):
        """Handle UI macro stop request"""
        self.stop_macro()
    
    def on_ui_config_change(self):
        """Handle UI configuration change"""
        if self.ui:
            # Get current UI state and update configuration
            current_skill_config = self.ui.get_skill_config(self.current_skill_config)
            current_auxiliary_config = self.ui.get_auxiliary_config()
            
            # Update configurations
            self.update_skill_config(self.current_skill_config, current_skill_config)
            self.update_auxiliary_config(current_auxiliary_config)
            
    
    def on_ui_skill_config_switch(self, config_name: str):
        """Handle UI skill configuration switch"""
        self.switch_skill_config(config_name)

    def _register_language_listener(self):
        """Register language change listener at controller level (top-level)"""
        try:
            i18n_manager.add_language_change_listener(self._on_language_changed)
            ColorPrint.blue("[Controller] Registered top-level language change listener")
        except Exception as e:
            ColorPrint.red(f"[Controller] Failed to register language listener: {e}")

    def _on_language_changed(self, new_language: str):
        """Handle language change at controller level with debouncing"""
        try:
            current_time = time.time() * 1000  # Convert to milliseconds

            # Debouncing: ignore rapid successive calls
            if current_time - self._last_language_change_time < self._language_change_debounce_ms:
                ColorPrint.yellow(f"[Controller] Language change to {new_language} debounced (too soon)")
                return

            self._last_language_change_time = current_time
            ColorPrint.green(f"[Controller] Language changed to: {new_language}")

            if self.ui and hasattr(self.ui, '_on_language_changed'):
                # Call UI's language change method directly
                self.ui._on_language_changed(new_language)
            else:
                ColorPrint.yellow("[Controller] UI not available for language change")
        except Exception as e:
            ColorPrint.red(f"[Controller] Error handling language change: {e}")
    
    def run(self):
        """Run the application and return UI instance"""
        try:
            # Initialize game interface
            if not self.game_interface_controller.initialize_game_interface():
                self.logger.error("Failed to initialize game interface")
                return None

            # Create UI
            self.ui = Diablo3MacroUI(self.current_skill_config)

            # Set UI callbacks
            self.ui.set_macro_start_callback(self.on_ui_macro_start)
            self.ui.set_macro_stop_callback(self.on_ui_macro_stop)
            self.ui.set_config_change_callback(self.on_ui_config_change)
            self.ui.set_skill_config_switch_callback(self.on_ui_skill_config_switch)

            # Register language change listener at controller level (top-level)
            self._register_language_listener()

            # Register window status callback to window monitor (static global)
            # UI calls request_shutdown directly when close/exit is requested
            if hasattr(self.ui, 'get_window_status_callback'):
                callback = self.ui.get_window_status_callback()
                window_monitor.add_callback(callback)
                ColorPrint.green("[Controller] Registered UI window status callback to window monitor")

            # Create and start all 4 extension threads (UI ready; commands via queue, shared data thread-safe)
            schedule = lambda f: self.ui.root.after(0, f)
            panel = self.ui.rosbot_extension_panel

            main_thread = MainFunctionThread(schedule_on_main_thread=schedule)
            main_thread.set_current_skill_config(self.current_skill_config)
            set_main_function_thread(main_thread)
            main_thread.start()

            aux_thread = AuxiliaryFunctionThread()
            set_auxiliary_function_thread(aux_thread)
            aux_thread.start()

            d3_thread = D3ExtensionThread()
            set_d3_extension_thread(d3_thread)
            panel.set_d3_extension_thread(d3_thread)
            d3_thread.start()

            d4_thread = D4ExtensionThread()
            set_d4_extension_thread(d4_thread)
            d4_thread.start()

            register_extension_handlers(
                self.ui,
                panel,
                get_main_function_thread,
                get_auxiliary_function_thread,
                get_d3_extension_thread,
                get_d4_extension_thread,
            )

            ColorPrint.green("[Controller] All 4 extension threads started; event center handlers registered")

            # Run UI (BLOCKING)
            self.ui.run()

            # After mainloop ends, run full shutdown (hotkey/timer stop, UI destroy, process exit)
            execute_shutdown()

            # Return UI instance for main.py global variable
            return self.ui

        except Exception as e:
            self.logger.error(f"Application error: {e}")
            raise
        finally:
            # Cleanup
            self.macro_running = False
            if self.macro_thread:
                self.macro_thread.join(timeout=1)

            # Shutdown game interface
            self.game_interface_controller.shutdown_game_interface()
    
    def shutdown(self):
        """Shutdown the controller gracefully - use unified exit"""
        try:
            self.logger.info("Starting controller shutdown...")
            
            # Use UI's unified exit method if available
            if self.ui and hasattr(self.ui, '_unified_exit'):
                self.logger.info("Using UI unified exit method...")
                self.ui._unified_exit()
                return
            
            # Fallback to manual shutdown
            self.logger.info("Using fallback shutdown method...")
            
            # Stop macro if running
            if self.macro_running:
                self.logger.info("Stopping macro...")
                self.stop_macro()
            
            # Shutdown game interface first
            if hasattr(self, 'game_interface_controller'):
                self.logger.info("Shutting down game interface...")
                self.game_interface_controller.shutdown_game_interface()
            
            # Stop system tray if available
            if self.ui and hasattr(self.ui, 'system_tray') and self.ui.system_tray:
                try:
                    self.logger.info("Stopping system tray...")
                    self.ui.system_tray.stop()
                    time.sleep(0.3)  # Wait for tray to stop
                    self.logger.info("System tray stopped")
                except Exception as e:
                    self.logger.error(f"Error stopping system tray: {e}")
            
            # Force exit
            self.logger.info("Forcing application exit...")
            os._exit(0)

        except Exception as e:
            self.logger.error(f"Error during controller shutdown: {e}")
            # Force exit even on error
            os._exit(1)

    def get_config_info(self) -> dict:
        """Get configuration information"""
        config_file = Path(CONFIG_USER_PATH)
        return {
            'data_dir': str(config_file.parent),
            'config_file': str(config_file),
            'file_exists': config_file.exists(),
            'file_size': config_file.stat().st_size if config_file.exists() else 0,
            'available_configs': ['config1', 'config2', 'config3', 'config4']
        }


# Example usage
if __name__ == "__main__":
    # Setup logging
    logging.basicConfig(level=logging.INFO)
    
    # Create and run controller
    controller = D3MacroController()
    controller.run()
