#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyLauncher - Unified Application Launcher

Centralized launcher for all applications.

Public API:
    LauncherConfig  - Configuration (parameters control everything)
    ServiceLauncher - Launcher (starts based on config parameters)
    AppExecutableLauncher - Searches and launches app executables

Usage:
    from pycore.pylauncher import ServiceLauncher, LauncherConfig

    config = LauncherConfig(
        app_id="my_app",
        app_name="My Application",
        frontend_enabled=True,  # Parameters control features
        rpc_enabled=True,
        show_ui=True,
        ...
    )

    launcher = ServiceLauncher(config)
    launcher.start()
"""

# Public API - Configuration and Launcher
from pycore.pylauncher.launcher import (
    LauncherConfig,
    ServiceLauncher,
    on_singleton_superseded,
    launch_services,
    stop_services,
)
from pycore.pylauncher.app_executable_launcher import (
    AppExecutableLauncher,
    get_app_executable_launcher,
)

# Register the executable-launcher provider with pyfoundations.app_launcher so
# AppLauncher can launch sidecar executables without importing UP into pylauncher
# (preserves the layer direction: higher layers import lower, never the reverse).
from pycore.pyfoundations.app_launcher import register_executable_launcher_provider
register_executable_launcher_provider(get_app_executable_launcher)

# Same seam for the ServiceLauncher class: register it DOWN into the pyfoundations
# provider so pyutils.native_ui can obtain it via get_service_launcher() with a
# plain top-level import, without a back-edge into pylauncher — this breaks the
# native_ui <-> pylauncher circular import (see service_launcher_provider.py).
from pycore.pyfoundations.service_launcher_provider import register_service_launcher_provider
register_service_launcher_provider(ServiceLauncher)

__all__ = [
    'LauncherConfig',   # Configuration
    'ServiceLauncher',  # Launcher
    'on_singleton_superseded',  # Old-instance hook: notified when a newer instance takes over
    'AppExecutableLauncher',  # App executable launcher
    'get_app_executable_launcher',  # Get singleton instance
    'launch_services',
    'stop_services',
]

__version__ = '3.0.0'
