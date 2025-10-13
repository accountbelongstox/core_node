#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
System Initializer
Handles system-wide initialization including configuration, hotkeys, and signal handling
"""

import sys
import os
import signal
from typing import Optional

# Add project paths
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

# Import from common_imports (unified public library imports)
from providor.common_imports import ColorPrint, HotkeyListener
from providor.providor_index import initialize_config

# Import static global modules
import timers.timer_manager as timer_manager
import timers.window_monitor_timer as window_monitor
from d3utils.shutdown_manager import request_shutdown, is_shutdown_requested, register_hotkey_listener
import d3utils.log_monitor as log_monitor_module
from d3utils.task_thread_manager import get_task_manager, register_task, start_all_tasks, TaskStatus
import d3utils.rosbot_task_processor as rosbot_processor

class SystemInitializer:
    """System-wide initialization manager"""

    def __init__(self):
        """Initialize the system initializer"""
        self.initialized = False
        self.hotkey_listener = None
        self.timer_initialized = False

    def _signal_handler(self, signum, frame):
        """Handle system signals (Ctrl+C, etc.) - Request shutdown only"""
        ColorPrint.yellow(f"[SYSTEM] Received signal {signum}, requesting shutdown...")
        request_shutdown()

    def _setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        try:
            # Handle Ctrl+C (SIGINT) and SIGTERM
            signal.signal(signal.SIGINT, self._signal_handler)
            signal.signal(signal.SIGTERM, self._signal_handler)

            # On Windows, also handle SIGBREAK
            if hasattr(signal, 'SIGBREAK'):
                signal.signal(signal.SIGBREAK, self._signal_handler)

            ColorPrint.blue("[SYSTEM] Signal handlers registered for graceful shutdown")

        except Exception as e:
            ColorPrint.red(f"[SYSTEM] Failed to setup signal handlers: {e}")

    def _setup_ctrl_c_hotkey(self):
        """Setup Ctrl+C hotkey using hotkey_listener"""
        try:
            # Create hotkey listener instance
            self.hotkey_listener = HotkeyListener()

            # Register to shutdown manager
            register_hotkey_listener(self.hotkey_listener)

            # Register Ctrl+C hotkey
            success = self.hotkey_listener.register_hotkey(
                hotkey="ctrl+c",
                callback=self._on_ctrl_c_pressed,
                description="System shutdown hotkey",
                priority=100,  # High priority
                enabled=True
            )

            if success:
                # Start listening for hotkeys
                if self.hotkey_listener.start_listening():
                    ColorPrint.blue("[SYSTEM] Ctrl+C hotkey registered and listening started")
                    return True
                else:
                    ColorPrint.red("[SYSTEM] Failed to start hotkey listening")
                    return False
            else:
                ColorPrint.red("[SYSTEM] Failed to register Ctrl+C hotkey")
                return False

        except Exception as e:
            ColorPrint.red(f"[SYSTEM] Failed to setup Ctrl+C hotkey: {e}")
            return False

    def _on_ctrl_c_pressed(self):
        """Handle Ctrl+C hotkey press - Request shutdown only"""
        ColorPrint.yellow("[SYSTEM] Ctrl+C hotkey pressed, requesting shutdown...")
        request_shutdown()

    def initialize_configuration(self):
        """Initialize system configuration"""
        try:
            ColorPrint.blue("[INIT] Initializing system configuration...")
            initialize_config()
            ColorPrint.green("[INIT] Configuration initialized successfully")
            return True

        except Exception as e:
            ColorPrint.red(f"[INIT] Failed to initialize configuration: {e}")
            return False

    def initialize_timer_system(self):
        """
        Initialize timer system with window monitoring

        Note: Timer system can only be initialized once.
        Multiple calls will be ignored.

        Returns:
            True if initialized successfully or already initialized, False on error
        """
        if self.timer_initialized:
            ColorPrint.yellow("[INIT] Timer system already initialized")
            return True

        try:
            ColorPrint.blue("[INIT] Initializing timer system...")

            # Initialize task thread manager
            self._init_task_thread_manager()

            # Initialize window monitor and register with timer manager (static global)
            window_monitor.initialize_and_register(
                interval=10.0,  # Check every 10 seconds
                enabled=True
            )

            # Register log monitor with timer manager (static global, always enabled with interceptor)
            timer_manager.register_task(
                name='log_monitor',
                interval=1.5,  # Always 1.5 seconds
                callback=log_monitor_module.check_logs,
                enabled=True  # Always enabled, controlled by interceptor
            )
            
            # Set default interceptor (10-second throttling when ROSBOT not running)
            timer_manager.set_task_interceptor('log_monitor', log_monitor_module.get_default_interceptor())

            # Start timer manager (static global)
            timer_manager.start()

            self.timer_initialized = True
            ColorPrint.green("[INIT] Timer system initialized successfully")
            return True

        except Exception as e:
            ColorPrint.red(f"[INIT] Failed to initialize timer system: {e}")
            return False

    def _init_task_thread_manager(self):
        """Initialize task thread manager"""
        try:
            ColorPrint.blue("[INIT] Initializing task thread manager...")
            
            # Register ROSBOT task
            register_task(
                name='rosbot_task',
                task_func=rosbot_processor.process_rosbot_task,
                interval=1.0  # Check every second
            )
            
            # Start all task threads
            start_all_tasks()
            
            ColorPrint.green("[INIT] Task thread manager initialized successfully")
            
        except Exception as e:
            ColorPrint.red(f"[INIT] Failed to initialize task thread manager: {e}")
            raise

    def initialize_system(self):
        """Initialize the entire system"""
        if self.initialized:
            ColorPrint.yellow("[INIT] System already initialized")
            return True

        try:
            ColorPrint.blue("[INIT] Starting system initialization...")

            # Setup signal handlers first
            self._setup_signal_handlers()

            # Setup Ctrl+C hotkey using hotkey_listener
            if not self._setup_ctrl_c_hotkey():
                ColorPrint.yellow("[INIT] Ctrl+C hotkey setup failed")

            # Initialize configuration
            if not self.initialize_configuration():
                return False

            # Initialize hotkeys (imported from hotkey_registry)
            from d3utils.d3u_common.hotkey_registry import initialize_hotkeys
            if not initialize_hotkeys():
                ColorPrint.yellow("[INIT] Hotkey initialization had issues, but continuing...")

            # Initialize timer system
            if not self.initialize_timer_system():
                ColorPrint.yellow("[INIT] Timer system initialization failed, but continuing...")

            self.initialized = True
            ColorPrint.green("[INIT] System initialization completed successfully")
            return True

        except Exception as e:
            ColorPrint.red(f"[INIT] System initialization failed: {e}")
            return False

    def request_shutdown(self):
        """Request application shutdown - delegates to shutdown manager"""
        request_shutdown()

    def is_shutdown_requested(self) -> bool:
        """Check if shutdown has been requested"""
        return is_shutdown_requested()

    def register_ui_instance(self, ui_instance):
        """
        Register UI instance for window monitoring
        (UI is automatically stored in ENCYCLOPEDIA on creation)

        Args:
            ui_instance: UI instance

        Returns:
            True if registered successfully, False otherwise
        """
        # Register window status callback to window monitor (static global)
        if hasattr(ui_instance, 'get_window_status_callback'):
            callback = ui_instance.get_window_status_callback()
            window_monitor.add_callback(callback)
            ColorPrint.green("[SYSTEM] UI callback registered to window_monitor")

        ColorPrint.green("[SYSTEM] UI instance registered to system")
        return True

# Global system initializer instance
_system_initializer: Optional[SystemInitializer] = None

def get_system_initializer() -> SystemInitializer:
    """Get the global system initializer instance (singleton)"""
    global _system_initializer
    if _system_initializer is None:
        _system_initializer = SystemInitializer()
    return _system_initializer
