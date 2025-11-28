# -*- coding: utf-8 -*-
"""
Platform-Aware Launcher

Detects platform and launches appropriate mode:
- Windows: Tray mode with singleton detection
- Linux: Service mode

ARCHITECTURE:
- Uses ServiceLauncher (pycore.pylauncher.launcher) for singleton detection
- ServiceLauncher internally uses SingletonDetector for protocol negotiation
- Platform-specific code (windows_tray, linux_service) only handles UI/startup
"""

import platform

from pycore import ColorPrint, THREAD_BUS
from pycore.pylauncher import ServiceLauncher, LauncherConfig
from pycore.callmodule.platform.windows_tray import launch_windows_tray
from pycore.callmodule.platform.linux_service import launch_linux_service

IS_WINDOWS = platform.system() == 'Windows'
IS_LINUX = platform.system() == 'Linux'


def launch_platform_aware(host='0.0.0.0', port=59000, debug=False):
    """
    Launch service with platform-specific behavior.

    Uses ServiceLauncher for singleton detection and service management.

    Args:
        host: Host to bind to
        port: Port to bind to
        debug: Enable debug mode
    """
    # Create launcher configuration
    config = LauncherConfig(
        app_id="pycore_module_caller",
        app_name="Pycore Module Caller",
        singleton=True,              # Enable singleton detection
        shutdown_existing=True,      # Try to replace idle instances
        singleton_port_start=59100,
        singleton_port_range=100,
        services={
            'heartbeat': {},  # Always enable heartbeat
            # Note: RPC v2 server is started by platform-specific code (tray/service)
            # ServiceLauncher only handles singleton detection here
        }
    )

    # Start ServiceLauncher (handles singleton detection) - Only call once
    launcher = ServiceLauncher(config)
    if not launcher.start():
        return  # Singleton conflict, exit

    # Get singleton info from detection result
    singleton_port = launcher.detection_result.port if launcher.detection_result else None

    ColorPrint.green(f"[Launcher] Singleton OK, launching platform-specific UI...")

    # Voice subtitle player is now handled by HTML UI (no Python pygame player needed)
    # HTML UI uses HTML5 <audio> element for playback
    ColorPrint.blue("[Launcher] Voice subtitle playback handled by HTML UI")

    # Start voice subtitle UI (always start, hidden initially)
    ColorPrint.blue("[Launcher] Starting voice subtitle UI...")
    from pycore.pyctl.desktop.ui import start_voice_subtitle_ui
    ui_thread = start_voice_subtitle_ui()
    ColorPrint.green("[Launcher] Voice subtitle UI thread started")

    # Launch platform-specific UI
    if IS_WINDOWS:
        launch_windows_tray(
            host=host,
            port=port,
            debug=debug,
            launcher=launcher,
            singleton_port=singleton_port
        )
    else:
        launch_linux_service(
            host=host,
            port=port,
            debug=debug,
            launcher=launcher,
            singleton_port=singleton_port
        )
