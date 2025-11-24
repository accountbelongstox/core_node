# -*- coding: utf-8 -*-
"""
Platform-Aware Launcher

Detects platform and launches appropriate mode:
- Windows: Tray mode with singleton detection
- Linux: Service mode
"""

import platform

IS_WINDOWS = platform.system() == 'Windows'
IS_LINUX = platform.system() == 'Linux'


def launch_platform_aware(host='0.0.0.0', port=59000, debug=False):
    """
    Launch service with platform-specific behavior.

    Args:
        host: Host to bind to
        port: Port to bind to
        debug: Enable debug mode
    """
    if IS_WINDOWS:
        from .windows_tray import launch_windows_tray
        launch_windows_tray(host=host, port=port, debug=debug)
    else:
        from .linux_service import launch_linux_service
        launch_linux_service(host=host, port=port, debug=debug)
