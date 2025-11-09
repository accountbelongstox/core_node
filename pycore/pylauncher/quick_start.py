#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Launcher - Quick Start Script

Quick start script with predefined configurations
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pylauncher import (
    UnifiedLauncher,
    LauncherConfig,
    WebServiceConfig,
    MCPServiceConfig,
    UIServiceConfig,
    SeleniumServiceConfig
)


def main():
    """Quick start main function"""
    ColorPrint.green("=" * 70)
    ColorPrint.green(" Unified Launcher - Quick Start")
    ColorPrint.green("=" * 70)

    ColorPrint.blue("\nPredefined Configurations:")
    ColorPrint.blue("  1. Full Stack (All Services)")
    ColorPrint.blue("  2. Backend Only (Web + MCP)")
    ColorPrint.blue("  3. Development Mode (Web + MCP + UI)")
    ColorPrint.blue("  4. Production Mode (HTTPS + MCP)")
    ColorPrint.blue("  5. Custom Configuration")

    choice = input("\nSelect configuration (1-5) [1]: ").strip() or "1"

    config = None

    if choice == "1":
        # Full stack - all services enabled
        ColorPrint.blue("\n>>> Full Stack Mode: All services enabled")
        config = LauncherConfig(
            web_service=WebServiceConfig(
                host="localhost",
                http_port=8000,
                ws_port=8001,
                enabled=True
            ),
            mcp_service=MCPServiceConfig(
                singleton_port=19997,
                rpc_port=8767,
                debug=True,
                enabled=True
            ),
            ui_service=UIServiceConfig(
                app_name="Full Stack Application",
                window_size=(1280, 800),
                enabled=True
            ),
            selenium_service=SeleniumServiceConfig(
                browser_type="chrome",
                headless=False,
                enabled=True
            )
        )

    elif choice == "2":
        # Backend only
        ColorPrint.blue("\n>>> Backend Only Mode: Web + MCP services")
        config = LauncherConfig(
            web_service=WebServiceConfig(
                host="0.0.0.0",  # Listen on all interfaces
                http_port=8000,
                ws_port=8001,
                enabled=True
            ),
            mcp_service=MCPServiceConfig(
                singleton_port=19997,
                rpc_port=8767,
                debug=True,
                enabled=True
            ),
            ui_service=UIServiceConfig(enabled=False),
            selenium_service=SeleniumServiceConfig(enabled=False)
        )

    elif choice == "3":
        # Development mode
        ColorPrint.blue("\n>>> Development Mode: Web + MCP + UI")
        config = LauncherConfig(
            web_service=WebServiceConfig(
                host="localhost",
                http_port=8000,
                ws_port=8001,
                reload=True,  # Auto-reload in dev mode
                enabled=True
            ),
            mcp_service=MCPServiceConfig(
                singleton_port=19997,
                rpc_port=8767,
                debug=True,
                enabled=True
            ),
            ui_service=UIServiceConfig(
                app_name="Development Application",
                window_size=(1280, 800),
                ui_source="http://localhost:8000",  # Connect to web service
                debug=True,
                enabled=True
            ),
            selenium_service=SeleniumServiceConfig(enabled=False)
        )

    elif choice == "4":
        # Production mode
        ColorPrint.blue("\n>>> Production Mode: HTTPS + MCP")
        ColorPrint.yellow("Note: Requires SSL certificates")

        config = LauncherConfig(
            web_service=WebServiceConfig(
                host="0.0.0.0",
                http_port=443,
                ws_port=8001,
                enable_https=True,
                ssl_cert_path="/path/to/cert.pem",  # Update with actual path
                ssl_key_path="/path/to/key.pem",    # Update with actual path
                workers=4,  # Multiple workers for production
                log_level="warning",
                enabled=True
            ),
            mcp_service=MCPServiceConfig(
                singleton_port=19997,
                rpc_port=8767,
                debug=False,  # Disable debug in production
                enabled=True
            ),
            ui_service=UIServiceConfig(enabled=False),
            selenium_service=SeleniumServiceConfig(enabled=False)
        )

    elif choice == "5":
        # Custom configuration
        ColorPrint.blue("\n>>> Custom Configuration Mode")
        ColorPrint.blue("Enter configuration (or press Enter for defaults):")

        http_port = input("  HTTP Port [8000]: ").strip() or "8000"
        ws_port = input("  WebSocket Port [8001]: ").strip() or "8001"
        mcp_port = input("  MCP RPC Port [8767]: ").strip() or "8767"

        enable_ui = input("  Enable UI? (y/n) [y]: ").strip().lower() or "y"
        enable_selenium = input("  Enable Selenium? (y/n) [n]: ").strip().lower() or "n"

        config = LauncherConfig(
            web_service=WebServiceConfig(
                http_port=int(http_port),
                ws_port=int(ws_port),
                enabled=True
            ),
            mcp_service=MCPServiceConfig(
                rpc_port=int(mcp_port),
                enabled=True
            ),
            ui_service=UIServiceConfig(
                enabled=(enable_ui == "y")
            ),
            selenium_service=SeleniumServiceConfig(
                enabled=(enable_selenium == "y")
            )
        )

    else:
        ColorPrint.red("Invalid choice, using default configuration")
        config = LauncherConfig()

    # Display configuration
    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green(" Configuration Summary")
    ColorPrint.green("=" * 70)

    enabled_services = config.get_enabled_services()
    ColorPrint.blue(f"Enabled Services: {', '.join(enabled_services)}")

    if config.web_service.enabled:
        ColorPrint.blue(f"  Web Service: http://{config.web_service.host}:{config.web_service.http_port}")
        ColorPrint.blue(f"  WebSocket: ws://{config.web_service.host}:{config.web_service.ws_port}")

    if config.mcp_service.enabled:
        ColorPrint.blue(f"  MCP Service: RPC Port {config.mcp_service.rpc_port}")

    if config.ui_service.enabled:
        ColorPrint.blue(f"  UI Service: {config.ui_service.app_name}")

    if config.selenium_service.enabled:
        ColorPrint.blue(f"  Selenium: {config.selenium_service.browser_type}")

    ColorPrint.green("=" * 70)

    # Confirm start
    confirm = input("\nStart services? (y/n) [y]: ").strip().lower() or "y"

    if confirm != "y":
        ColorPrint.yellow("Cancelled")
        return

    # Create and start launcher
    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green(" Starting Services...")
    ColorPrint.green("=" * 70 + "\n")

    try:
        launcher = UnifiedLauncher(config)
        launcher.start_all()

        ColorPrint.green("\n" + "=" * 70)
        ColorPrint.green(" All Services Running")
        ColorPrint.green(" Press Ctrl+C to stop")
        ColorPrint.green("=" * 70 + "\n")

        # Wait for services
        launcher.wait()

    except KeyboardInterrupt:
        ColorPrint.yellow("\n\nShutting down...")
    except Exception as e:
        ColorPrint.red(f"\nError: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
