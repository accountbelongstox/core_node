#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyLauncher - Modular Application Launcher with Singleton Detection

Provides modular service launching with singleton detection.

Core Components:
- launcher: Main service launcher (ServiceConfig, launch_services, etc.)
- singleton_detector: Cross-process singleton detection (sub-module of pylauncher)
- ServiceConfig: Configuration for service startup
- LaunchMode: UI launch mode settings
- NativeUILauncher: UI-specific launcher

Singleton Detection:
- SingletonDetector is a sub-module of pylauncher
- Does NOT depend on any external pycore classes
- Uses only Python standard library (socket, json, threading, etc.)
- Provides port-based protocol verification for instance detection

Usage:
    # Launch services with singleton detection
    from pycore.pylauncher import launch_services, ServiceConfig
    config = ServiceConfig(
        app_id="my_app",
        port_start=54000,
        port_range=100,
        singleton_check=True
    )
    instances = launch_services(config)

    # Direct singleton detection
    from pycore.pylauncher import SingletonDetector
    detector = SingletonDetector(app_id="my_app", port_start=54000, port_range=100)
    result = detector.detect_and_bind()

    # Native UI launcher
    from pycore.pylauncher import launch_native_ui, LaunchMode
    result = launch_native_ui(
        app_id="my_app",
        app_name="My Application",
        main_entry=main_function,
        mode=LaunchMode.DEBUG_WITH_TRAY
    )

    # Speech launcher
    from pycore.pylauncher import launch_speech_only
    launch_speech_only(enable_rpc=True, rpc_port=8080)
"""

# Import main launcher components
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

# Import singleton detector (sub-module of pylauncher)
from pycore.pylauncher.singleton_detector import (
    SingletonDetector,
    DetectionResult,
    ProtocolVersion,
    MessageType,
    detect_singleton
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

    # Singleton Detection (sub-module)
    'SingletonDetector',
    'DetectionResult',
    'ProtocolVersion',
    'MessageType',
    'detect_singleton',
]

__version__ = '2.0.0'
