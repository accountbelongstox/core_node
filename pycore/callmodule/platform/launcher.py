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
    from pycore import ColorPrint
    from pycore.pylauncher import ServiceLauncher, LauncherConfig

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

    # Start ServiceLauncher (handles singleton detection)
    launcher = ServiceLauncher(config)
    success = launcher.start()

    if not success:
        # Singleton detection failed (existing instance busy or other error)
        ColorPrint.yellow("[Launcher] Failed to start (singleton conflict or error)")
        return

    # Get singleton info from detection result
    singleton_port = launcher.detection_result.port if launcher.detection_result else None

    ColorPrint.green(f"[Launcher] Singleton OK, launching platform-specific UI...")

    # Launch platform-specific UI
    if IS_WINDOWS:
        from .windows_tray import launch_windows_tray
        launch_windows_tray(
            host=host,
            port=port,
            debug=debug,
            launcher=launcher,
            singleton_port=singleton_port
        )
    else:
        from .linux_service import launch_linux_service
        launch_linux_service(
            host=host,
            port=port,
            debug=debug,
            launcher=launcher,
            singleton_port=singleton_port
        )
