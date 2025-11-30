#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyLauncher - Modular Application Launcher with Singleton Detection

Provides configuration-driven service launching with singleton detection.

Core Components:
- LauncherConfig: Unified configuration (supports modern dict API and legacy flags)
- ServiceLauncher: Main service launcher
- SingletonDetector: Cross-process singleton detection

Singleton Detection:
- SingletonDetector is a sub-module of pylauncher
- Uses only Python standard library (socket, json, threading, etc.)
- Provides port-based protocol verification for instance detection

Usage:
    # Modern API - Launch services with singleton detection
    from pycore.pylauncher import LauncherConfig, ServiceLauncher

    config = LauncherConfig(
        app_id="my_app",
        singleton=True,
        shutdown_existing=True,
        services={
            'rpc_v2': {'port': 58100},
            'speech': {'mode': 'single'}
        }
    )

    launcher = ServiceLauncher(config)
    launcher.start()

    # Get service instance to extend functionality
    rpc = launcher.get_service('rpc_v2')
    rpc.server.route('custom', handler_func, sync=True)

    # Legacy API - Still supported
    config = LauncherConfig(
        enable_rpc_v2=True,
        rpc_v2_port=58100,
        singleton_check=True
    )
    launcher = ServiceLauncher(config)
    launcher.start()

    # Direct singleton detection
    from pycore.pylauncher import SingletonDetector
    detector = SingletonDetector(app_id="my_app", port_start=54000, port_range=100)
    result = detector.detect_and_bind()
"""

# Import main launcher components
from pycore.pylauncher.launcher import (
    LauncherConfig,
    ServiceLauncher,
    launch_services,
    stop_services,
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
    # Service Launcher
    'LauncherConfig',
    'ServiceLauncher',
    'launch_services',
    'stop_services',

    # Singleton Detection
    'SingletonDetector',
    'DetectionResult',
    'ProtocolVersion',
    'MessageType',
    'detect_singleton',
]

__version__ = '2.0.0'
