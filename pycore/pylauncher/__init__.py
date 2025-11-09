#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Launcher Package

Unified service launcher for:
- Web Service (FastAPI + WebSocket)
- MCP Service (Model Context Protocol)
- UI Service (Native UI Framework)
- Selenium Service (Browser Automation)

Each service runs in its own thread with unified lifecycle management.

Quick Start:
    ```python
    from pycore.pylauncher import UnifiedLauncher, LauncherConfig

    # Create default configuration
    config = LauncherConfig()

    # Create launcher
    launcher = UnifiedLauncher(config)

    # Start all enabled services
    launcher.start_all()

    # Wait for services to run
    launcher.wait()
    ```

Custom Configuration:
    ```python
    from pycore.pylauncher import (
        UnifiedLauncher,
        LauncherConfig,
        WebServiceConfig,
        MCPServiceConfig,
        UIServiceConfig,
        SeleniumServiceConfig
    )

    # Create custom configuration
    config = LauncherConfig(
        web_service=WebServiceConfig(
            http_port=8000,
            ws_port=8001,
            enabled=True
        ),
        mcp_service=MCPServiceConfig(
            rpc_port=8767,
            enabled=True
        ),
        ui_service=UIServiceConfig(
            app_name="My Application",
            window_size=(1280, 800),
            enabled=True
        ),
        selenium_service=SeleniumServiceConfig(
            browser_type="chrome",
            headless=False,
            enabled=False  # Disable selenium
        )
    )

    # Create and start launcher
    launcher = UnifiedLauncher(config)
    launcher.start_all()
    launcher.wait()
    ```

Individual Service Control:
    ```python
    launcher = UnifiedLauncher(config)

    # Start individual services
    launcher.start_service('web_service')
    launcher.start_service('mcp_service')

    # Get service status
    status = launcher.get_status()
    print(status)

    # Stop individual service
    launcher.stop_service('web_service')

    # Restart service
    launcher.restart_service('mcp_service')

    # Stop all services
    launcher.stop_all()
    ```
"""

from pycore.pylauncher.config import (
    LauncherConfig,
    WebServiceConfig,
    MCPServiceConfig,
    UIServiceConfig,
    SeleniumServiceConfig
)

from pycore.pylauncher.launcher import (
    UnifiedLauncher,
    ServiceThread
)

__all__ = [
    # Configuration classes
    'LauncherConfig',
    'WebServiceConfig',
    'MCPServiceConfig',
    'UIServiceConfig',
    'SeleniumServiceConfig',

    # Launcher classes
    'UnifiedLauncher',
    'ServiceThread',
]

__version__ = '1.0.0'
