#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3Check Macro Controller
Main controller for Diablo 3 Macro application.
本类为 Diablo3MacroUI 的单一创建者，仅在此处实例化一次。
"""

import os
import sys
import threading
import time
import logging
from pathlib import Path
from typing import Optional, Callable

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from providor.providor_index import CONFIG, load_config, queue_config_save, CONFIG_USER_PATH, get_config_value_safe
from pycore.pyfoundations.color_print import ColorPrint
from ui.diablo3_macro_ui import Diablo3MacroUI
from controller.game_interface_controller import GameInterfaceController, get_game_interface_controller
from d3utils.i18n_manager import i18n_manager
from d3utils.main_function_thread import get_main_function_thread
from d3utils.auxiliary_function_thread import get_auxiliary_function_thread
from d3utils.d3_extension_thread import get_d3_extension_thread
from d3utils.d4_extension_thread import get_d4_extension_thread
from d3utils.log_analyzer import register_login_try_callback
from d3utils.d3u_common.hotkey_registry import set_assistant_callback
from controller.login_try_screenshot_controller import get_login_try_screenshot_controller
from controller.d4_controller import get_d4_controller
from runtime import (
    get_thread_registry,
    register_extension_handlers,
    trigger_extension_main_start_macro,
    trigger_extension_main_stop_macro,
    execute_shutdown,
)
from share.game_interface_data import get_game_interface_data
from ui.utils.app_root import get_ui_panel
from providor.constants.ui import PANEL_KEY_ROSBOT, TAB_INDEX_ROSBOT
import timers.window_monitor_timer as window_monitor
import timers.timer_manager as timer_manager
from share.values.config_change_hub import get_config_change_hub


class MacroLoopThread(threading.Thread):
    """Fallback macro loop thread (native run() logic; no wrapper). Created via controller.create_macro_fallback_thread()."""

    def __init__(self, controller: "D3MacroController"):
        super().__init__(daemon=True, name="MacroLoopFallback")
        self._controller = controller

    def run(self) -> None:
        c = self._controller
        while c.macro_running:
            skill_config = CONFIG.get('macro_configs', {}).get('skill_configs', {}).get(c.current_skill_config, {})
            auxiliary_config = CONFIG.get('macro_configs', {}).get('auxiliary_config', {})
            config = {**skill_config, **auxiliary_config}
            skills = config.get('skills', {})

            for skill_name, sk_cfg in skills.items():
                if not c.macro_running:
                    break
                if sk_cfg.get('strategy') == '禁用':  # Disabled (legacy CN config value)
                    continue
                c._execute_skill(skill_name, sk_cfg)
                time.sleep(0.01)
            time.sleep(0.1)


class D3MacroController:
    """Main controller for Diablo 3 Macro application"""
    
    def __init__(self):
        """Initialize the controller"""
        self.logger = logging.getLogger(__name__)
        
        # Game interface controller
        self.game_interface_controller = get_game_interface_controller()

        # Wire d3utils/timers callbacks (d3utils and timers must not import controller)
        _login_ctrl = get_login_try_screenshot_controller()
        register_login_try_callback(lambda: _login_ctrl.handle_login_try())
        set_assistant_callback(lambda: self.game_interface_controller.run_assistant_auto_use())
        from timers.one_shot_tasks import register_login_controller_actions
        register_login_controller_actions(
            _login_ctrl.ensure_battlenet_started_and_login_check,
            _login_ctrl.ensure_d3_running_from_battlenet_no_rosbot,
            _login_ctrl.ensure_battlenet_only,
        )

        # UI instance
        self.ui: Optional[Diablo3MacroUI] = None
        
        # Macro state
        self.macro_running = False
        # Macro fallback thread is owned by ThreadRegistry; no self.macro_thread
        self.current_skill_config = 'config1'
        
        # Callbacks
        self.on_macro_start: Optional[Callable] = None
        self.on_macro_stop: Optional[Callable] = None
        self.on_config_change: Optional[Callable] = None

        # Language change control
        self._last_language_change_time = 0
        self._language_change_debounce_ms = 500  # 500ms debounce
    
    def start_macro(self):
        """Start the macro (sends command to MainFunctionThread if available). Called from UI when running."""
        if self.macro_running:
            self.ui.show_message("Warning", "Macro is already running.", "warning")
            return

        main_thread = get_main_function_thread()
        if main_thread:
            main_thread.set_current_skill_config(self.current_skill_config)
        trigger_extension_main_start_macro()
        self.macro_running = True
        if not main_thread:
            self.macro_running = True
            get_thread_registry().start_macro_fallback(self)

        self.ui.show_message("Info", "Macro started.", "info")
        if self.on_macro_start:
            self.on_macro_start()

    def stop_macro(self):
        """Stop the macro (sends command to MainFunctionThread if available). Called from UI when running."""
        if not self.macro_running:
            self.ui.show_message("Warning", "Macro is not running.", "warning")
            return

        trigger_extension_main_stop_macro()
        self.macro_running = False
        get_thread_registry().stop_macro_fallback()

        self.ui.show_message("Info", "Macro stopped.", "info")
        if self.on_macro_stop:
            self.on_macro_stop()

    def create_macro_fallback_thread(self) -> MacroLoopThread:
        """Create the fallback macro thread instance. ThreadRegistry calls this."""
        return MacroLoopThread(self)

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
        queue_config_save()
        self.logger.info(f"Updated skill configuration: {config_name}")

    def update_auxiliary_config(self, config_data: dict):
        """Update auxiliary configuration"""
        CONFIG['macro_configs']['auxiliary_config'].update(config_data)
        queue_config_save()
        self.logger.info("Updated auxiliary configuration")
    
    def on_ui_macro_start(self):
        """Handle UI macro start request"""
        self.start_macro()
    
    def on_ui_macro_stop(self):
        """Handle UI macro stop request"""
        self.stop_macro()
    
    def on_ui_config_change(self):
        """Handle UI configuration change. Called from UI when running. Prefer apply_config_sync from deferred hub path to avoid main-thread block."""
        current_skill_config = self.ui.get_skill_config(self.current_skill_config)
        current_auxiliary_config = self.ui.get_auxiliary_config()
        self.update_skill_config(self.current_skill_config, current_skill_config)
        self.update_auxiliary_config(current_auxiliary_config)

    def apply_config_sync(self, skill_config_dict: dict, auxiliary_config_dict: dict) -> None:
        """Apply config sync from pre-fetched data (called on main thread). Avoids blocking main thread on get_config_value_safe in hub path."""
        if skill_config_dict is not None:
            self.update_skill_config(self.current_skill_config, skill_config_dict)
        if auxiliary_config_dict is not None:
            self.update_auxiliary_config(auxiliary_config_dict)

    def _on_config_change_from_hub(self, key_path: Optional[str] = None) -> None:
        """Hub callback: defer config read to timer thread so main thread does not block on get_config_value_safe."""
        timer_manager.submit_one_shot(self._deferred_config_sync)

    def _deferred_config_sync(self) -> None:
        """Run in timer thread: fetch config then schedule apply on main thread."""
        skill_configs = get_config_value_safe("macro_configs.skill_configs", {})
        skill_dict = skill_configs.get(self.current_skill_config, {}) if isinstance(skill_configs, dict) else {}
        aux = get_config_value_safe("macro_configs.auxiliary_config", {})
        aux_dict = dict(aux) if isinstance(aux, dict) else {}
        root = self.ui.root
        if root is not None and (not hasattr(root, "winfo_exists") or root.winfo_exists()):
            root.after(0, lambda: self.apply_config_sync(skill_dict, aux_dict))

    def on_ui_skill_config_switch(self, config_name: str):
        """Handle UI skill configuration switch"""
        self.switch_skill_config(config_name)

    def _register_language_listener(self):
        """Register language change listener at controller level (top-level)"""
        i18n_manager.add_language_change_listener(self._on_language_changed)
        ColorPrint.blue("[Controller] Registered top-level language change listener")

    def _on_language_changed(self, new_language: str):
        """Handle language change at controller level with debouncing"""
        current_time = time.time() * 1000  # Convert to milliseconds

        # Debouncing: ignore rapid successive calls
        if current_time - self._last_language_change_time < self._language_change_debounce_ms:
            ColorPrint.yellow(f"[Controller] Language change to {new_language} debounced (too soon)")
            return

        self._last_language_change_time = current_time
        ColorPrint.green(f"[Controller] Language changed to: {new_language}")

        self.ui._on_language_changed(new_language)

    def _ensure_rosbot_content_if_selected(self):
        """If current tab is ROSBOT and content was not created at startup (submit_one_shot ignored), ensure content now. See docs/ui_5."""
        if self.ui is None or not self.ui.root.winfo_exists():
            return
        try:
            nb = self.ui.main_notebook
            if not nb.winfo_exists():
                return
            idx = nb.index(nb.select())
            if idx != TAB_INDEX_ROSBOT:
                return
            panel = get_ui_panel(PANEL_KEY_ROSBOT)
            if panel is None or (hasattr(panel, "_content_created") and panel._content_created):
                return
            panel.ensure_content()
        except Exception:
            pass

    def run(self):
        """Run the application and return UI instance"""
        if not self.game_interface_controller.initialize_game_interface():
            self.logger.error("Failed to initialize game interface")
            return None

        self.ui = Diablo3MacroUI(self.current_skill_config)

        try:
            self.ui.set_macro_start_callback(self.on_ui_macro_start)
            self.ui.set_macro_stop_callback(self.on_ui_macro_stop)
            self.ui.set_config_change_callback(self.on_ui_config_change)
            self.ui.set_skill_config_switch_callback(self.on_ui_skill_config_switch)
            get_config_change_hub(self.ui.root).subscribe(self._on_config_change_from_hub)
            self._register_language_listener()
            callback = self.ui.get_window_status_callback()
            window_monitor.add_callback(callback)
            ColorPrint.green("[Controller] Registered UI window status callback to window monitor")

            schedule = lambda f: self.ui.root.after(0, f)
            panel = get_ui_panel(PANEL_KEY_ROSBOT)
            panel.set_register_status_ui_fn(lambda: window_monitor.register_status_ui(panel.get_status_ui_callback()))
            panel.set_refresh_status_fn(window_monitor.refresh_window_status_if_inactive)
            # Register bottom bar for state updates from first poll so test mode row (F3/ROSBOT_FLOW_MERMAID) updates every tick even when ROSBOT tab content not yet created
            window_monitor.register_status_ui(self.ui.bottom_bar.update_status_from_state)
            get_game_interface_data().start_main_thread_poll(self.ui.root.after, 100)

            get_thread_registry().create_extension_threads(
                schedule,
                panel,
                self.current_skill_config,
                battlenet_login_check_provider=lambda: get_login_try_screenshot_controller().ensure_battlenet_started_and_login_check(for_f2_only=True),
                d4_process_fn=get_d4_controller().process,
            )
            register_extension_handlers(
                self.ui,
                panel,
                get_main_function_thread,
                get_auxiliary_function_thread,
                get_d3_extension_thread,
                get_d4_extension_thread,
            )
            ColorPrint.green("[Controller] Extension threads and event center registered")
            get_thread_registry().start_timer_loop_after_ui_ready()
            self.ui.root.after(0, self.ui.ensure_current_tab_content_if_needed)
            self.ui.start_system_tray_if_needed()
            self.ui.run()
            execute_shutdown()
            return self.ui
        finally:
            self.macro_running = False
            get_thread_registry().stop_macro_fallback()
            self.game_interface_controller.shutdown_game_interface()
    
    def shutdown(self):
        """Shutdown the controller gracefully - use unified exit"""
        try:
            self.logger.info("Starting controller shutdown...")
            
            # Fallback to manual shutdown
            self.logger.info("Using fallback shutdown method...")
            
            # Stop macro if running
            if self.macro_running:
                self.logger.info("Stopping macro...")
                self.stop_macro()
            
            # Shutdown game interface first (always set in __init__)
            self.logger.info("Shutting down game interface...")
            self.game_interface_controller.shutdown_game_interface()

            # Stop system tray when UI was created (run() was called)
            if self.ui is not None:
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
