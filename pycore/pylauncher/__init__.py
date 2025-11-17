#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyLauncher - Modular Service Launcher

Purpose: Launch application services selectively (UI, RPC, Speech, Heartbeat)

Usage:
    # Modern modular approach
    from pycore.pylauncher import launch_services, ServiceConfig

    # Launch RPC only (for pyctl/speech)
    instances = launch_services(ServiceConfig.rpc_only(port=8080))

    # Launch UI with Speech
    instances = launch_services(ServiceConfig(enable_ui=True, enable_speech=True))

    # Legacy UI launcher
    from pycore.pylauncher import NativeUILauncher, LaunchMode

    launcher = NativeUILauncher(app_id="my_app")
    result = launcher.launch(
        app_name="My Application",
        main_entry=main_function,
        mode=LaunchMode.DEBUG_WITH_TRAY
    )
"""

from pycore.pylauncher.launcher import (
    # Modern Service Launcher
    ServiceConfig,
    ServiceInstances,
    launch_services,
    stop_services,
    get_rpc_server_from_launcher,
    create_speech_service_config,

    # Legacy UI Launcher
    NativeUILauncher,
    LaunchMode,
    LaunchResult,
    launch_native_ui,

    # Speech Launcher
    launch_speech_only,
    start_speech_thread,
    launch_speech_service
)

__all__ = [
    # Modern Service Launcher
    'ServiceConfig',
    'ServiceInstances',
    'launch_services',
    'stop_services',
    'get_rpc_server_from_launcher',
    'create_speech_service_config',

    # Legacy UI Launcher
    'NativeUILauncher',
    'LaunchMode',
    'LaunchResult',
    'launch_native_ui',

    # Speech Launcher
    'launch_speech_only',
    'start_speech_thread',
    'launch_speech_service',
]

__version__ = '2.0.0'
