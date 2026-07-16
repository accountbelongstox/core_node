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
    """
    Unified service launcher configuration.

    Supports both modern dict-based API and legacy boolean flags.
    Legacy flags automatically convert to services dict.

    Modern Usage:
        config = LauncherConfig(
            services={'rpc_v2': {'port': 58100}}
        )

    Legacy Usage (backward compatible):
        config = LauncherConfig(
            enable_rpc_v2=True,
            rpc_v2_port=58100
        )
    """
    # Modern API - Primary interface
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

    # Legacy API - Auto-converts to services dict
    enable_heartbeat: bool = True
    enable_rpc_v2: bool = False
    rpc_v2_port: int = 58100
    rpc_v2_host: str = "0.0.0.0"
    rpc_v2_debug: bool = True
    enable_speech: bool = False
    speech_mode: str = "single"
    enable_ui: bool = False
    singleton_check: bool = False  # Maps to 'singleton'

    def __post_init__(self):
        """Convert legacy flags to modern services dict."""
        legacy_used = (
            self.enable_rpc_v2 or
            self.enable_speech or
            self.enable_ui or
            not self.enable_heartbeat
        )

        if legacy_used and not self.services:
            if self.enable_heartbeat:
                self.services['heartbeat'] = {}

            if self.enable_rpc_v2:
                self.services['rpc_v2'] = {
                    'port': self.rpc_v2_port,
                    'host': self.rpc_v2_host,
                    'debug': self.rpc_v2_debug
                }

            if self.enable_speech:
                self.services['speech'] = {'mode': self.speech_mode}

            if self.enable_ui:
                self.services['ui'] = {}

            if self.singleton_check:
                self.singleton = True

    @classmethod
    def rpc_v2_only(cls, port: int = 58100, singleton: bool = False):
        """Quick config for RPC v2 only."""
        return cls(
            app_id="rpc_v2_app",
            app_name="RPC v2 Service",
            singleton=singleton,
            services={
                'heartbeat': {},
                'rpc_v2': {'port': port, 'host': '0.0.0.0', 'debug': True}
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
