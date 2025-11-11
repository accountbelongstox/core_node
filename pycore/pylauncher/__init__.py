#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyLauncher - Simple Application Launcher

Purpose: Forward parameters and start applications with singleton detection

Usage:
    from pycore.pylauncher import NativeUILauncher, LaunchMode

    launcher = NativeUILauncher(
        app_id="my_app",
        port_start=54000
    )

    result = launcher.launch(
        app_name="My Application",
        main_entry=main_function,
        mode=LaunchMode.DEBUG_WITH_TRAY
    )

    if not result.success:
        print(f"Launch failed: {result.message}")
"""

from pycore.pylauncher.launcher import (
    NativeUILauncher,
    LaunchMode,
    LaunchResult,
    launch_native_ui
)

__all__ = [
    'NativeUILauncher',
    'LaunchMode',
    'LaunchResult',
    'launch_native_ui',
]

__version__ = '1.0.0'
