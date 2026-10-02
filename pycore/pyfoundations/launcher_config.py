#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LauncherConfig — unified service launcher configuration dataclass.

Extracted from pycore.pylauncher.launcher to pyfoundations so that both
pylauncher and pyutils.native_ui.step3_launcher can import it without
creating a circular import chain.
"""

from typing import Dict, Any, Optional
from dataclasses import dataclass, field


@dataclass
class LauncherConfig:
    """Unified service launcher configuration: ``services`` maps a service name to its config."""
    services: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    app_id: str = "default_app"
    app_name: str = "Application"
    singleton: bool = False
    singleton_port_start: int = 54000
    singleton_port_range: int = 100
    force_launch: bool = False
    shutdown_existing: bool = False

    # Tray Configuration (Cross-platform)
    enable_tray: bool = False
    tray_backend: str = "auto"          # "auto", "pystray", "pyside6"
    tray_icon_path: Optional[str] = None
    tray_menu_items: list = field(default_factory=list)

    @classmethod
    def rpc_only(cls, port: int = 58100, singleton: bool = False):
        """Quick config for RPC only."""
        return cls(
            app_id="rpc_app",
            app_name="RPC Service",
            singleton=singleton,
            services={
                'heartbeat': {},
                'rpc': {'port': port, 'host': '0.0.0.0', 'debug': True}
            }
        )

    @classmethod
    def tray_only(cls, app_id: str = "tray_app", app_name: str = "Tray Application",
                  icon_path: Optional[str] = None, menu_items: Optional[list] = None,
                  tray_backend: str = "auto"):
        """Quick config for tray-only application."""
        return cls(
            app_id=app_id,
            app_name=app_name,
            enable_tray=True,
            tray_backend=tray_backend,
            tray_icon_path=icon_path,
            tray_menu_items=menu_items or [],
            services={'heartbeat': {}}
        )
