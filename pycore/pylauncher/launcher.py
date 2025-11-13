#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyLauncher - Simple Parameter Forwarding Launcher

Purpose: Forward parameters and start applications with singleton detection
"""

import time
from typing import Callable, Optional, Any
from enum import Enum
from dataclasses import dataclass

from pycore import ColorPrint, THREAD_BUS
from pycore.pyutils.singleton_detector import SingletonDetector
from pycore.pyutils.native_ui import get_bus_manager


# ============================================================
# Launch Mode
# ============================================================

class LaunchMode(Enum):
    """Native UI launch modes"""
    DEBUG_ONLY = "debug_only"           # Debug window only (closes after init)
    DEBUG_WITH_TRAY = "debug_with_tray" # Debug window + Tray (tray persists)
    TRAY_ONLY = "tray_only"             # Tray only (no debug window)


# ============================================================
# Launch Result
# ============================================================

@dataclass
class LaunchResult:
    """Result of launch attempt"""
    success: bool
    is_primary: bool
    port: int
    existing_instance: bool
    existing_port: Optional[int]
    message: str
    detector: Optional[SingletonDetector]


# ============================================================
# Native UI Launcher (Parameter Forwarder)
# ============================================================

class NativeUILauncher:
    """
    Native UI Launcher - Simple Parameter Forwarder

    Purpose:
    - Forward parameters to native_ui
    - Add singleton detection
    - No complex logic
    """

    def __init__(
        self,
        app_id: str,
        port_start: int = 54000,
        port_range: int = 100,
        timeout: float = 1.0,
        debug: bool = True
    ):
        """Initialize launcher"""
        self.app_id = app_id
        self.port_start = port_start
        self.port_range = port_range
        self.timeout = timeout
        self.debug = debug
        self._detector: Optional[SingletonDetector] = None
        self._bus_mgr = get_bus_manager()

    def launch(
        self,
        app_name: str,
        main_entry: Callable,
        mode: LaunchMode = LaunchMode.DEBUG_WITH_TRAY,
        startup_width: int = 600,
        startup_height: int = 500,
        min_display_time: float = 2.0,
        icon_path: Optional[str] = None,
        logo_path: Optional[str] = None,
        enable_language_selector: bool = True,
        force: bool = False
    ) -> LaunchResult:
        """
        Launch application (forward parameters + singleton detection)

        Steps:
        1. Singleton detection
        2. Forward all parameters to native_ui
        3. Return result
        """
        # Step 1: Singleton detection
        self._detector = SingletonDetector(
            app_id=self.app_id,
            port_start=self.port_start,
            port_range=self.port_range,
            timeout=self.timeout,
            debug=self.debug
        )

        detection = self._detector.detect_and_bind()

        # Check existing instance
        if detection.existing_instance:
            if not force:
                return LaunchResult(
                    success=False,
                    is_primary=False,
                    port=0,
                    existing_instance=True,
                    existing_port=detection.existing_port,
                    message=f"Found existing instance at port {detection.existing_port}",
                    detector=None
                )

        # Check if became PRIMARY
        if not detection.is_primary:
            return LaunchResult(
                success=False,
                is_primary=False,
                port=0,
                existing_instance=False,
                existing_port=None,
                message="No available ports in range",
                detector=None
            )

        # Step 2: Forward parameters to native_ui
        from pycore.pyutils.native_ui import launch_app_with_startup

        enable_tray = (mode == LaunchMode.DEBUG_WITH_TRAY or mode == LaunchMode.TRAY_ONLY)

        # Store launcher info in THREAD_BUS
        THREAD_BUS.signal("ui.launcher.state", "starting")
        THREAD_BUS.signal("ui.launcher.port", detection.port)
        THREAD_BUS.signal("ui.launcher.app_id", self.app_id)

        # Forward to native_ui
        launch_app_with_startup(
            app_name=app_name,
            main_entry=main_entry,
            startup_width=startup_width,
            startup_height=startup_height,
            min_display_time=min_display_time,
            icon_path=icon_path,
            logo_path=logo_path,
            enable_language_selector=enable_language_selector,
            enable_tray=enable_tray
        )

        # Step 3: Return result
        THREAD_BUS.signal("ui.launcher.state", "running")

        return LaunchResult(
            success=True,
            is_primary=True,
            port=detection.port,
            existing_instance=False,
            existing_port=None,
            message=f"Launched successfully on port {detection.port}",
            detector=self._detector
        )

    def stop(self):
        """Stop launcher"""
        if self._detector:
            self._detector.stop()


# ============================================================
# Convenience Function
# ============================================================

def launch_native_ui(
    app_id: str,
    app_name: str,
    main_entry: Callable,
    mode: LaunchMode = LaunchMode.DEBUG_WITH_TRAY,
    port_start: int = 54000,
    **kwargs
) -> LaunchResult:
    """
    Convenience function for launching

    Args:
        app_id: Application ID
        app_name: Application name
        main_entry: Main entry function
        mode: Launch mode
        port_start: Starting port
        **kwargs: Additional parameters

    Returns:
        LaunchResult
    """
    launcher = NativeUILauncher(
        app_id=app_id,
        port_start=port_start,
        debug=True
    )
    return launcher.launch(
        app_name=app_name,
        main_entry=main_entry,
        mode=mode,
        **kwargs
    )
