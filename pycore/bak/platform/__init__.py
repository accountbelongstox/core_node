# -*- coding: utf-8 -*-
"""
Platform-Specific Launchers

Handle platform differences for running the callmodule service:
- Windows: System tray + singleton detection
- Linux: Service mode (systemd compatible)
"""

from .launcher import launch_platform_aware

__all__ = ['launch_platform_aware']
