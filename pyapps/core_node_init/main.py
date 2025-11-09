"""
Core Node Init - Python MCP Server Entry Point

This application provides web automation and IT tools integration through MCP protocol.
"""

import asyncio
import signal
import sys
from typing import Optional

from pycore import ColorPrint
from pycore.pyutils.pybrowser import create_spider_engine

from pyapps.core_node_init.controller.mcp_server_controller import CoreNodeInitMCPServer
from pyapps.core_node_init.controller.singleton_launcher import CoreNodeSingletonLauncher
from pyapps.core_node_init.config import Config


class CoreNodeInitApp:
    def __init__(self):
        self.launcher: Optional[CoreNodeSingletonLauncher] = None
        self.shutdown_event = asyncio.Event()

    async def start(self):
        """
        Main entry point for the application
        """
        try:
            ColorPrint.print_info('=' * 80)
            ColorPrint.print_info('Core Node Init - Python MCP Server')
            ColorPrint.print_info('=' * 80)

            self.launcher = CoreNodeSingletonLauncher()

            # Register event handlers
            self.launcher.on('launched', self._on_launched)
            self.launcher.on('backend_started', self._on_backend_started)
            self.launcher.on('client_connected', self._on_client_connected)
            self.launcher.on('launch_error', self._on_launch_error)

            # Launch the system
            await self.launcher.launch()

            # Display status
            status = self.launcher.get_detailed_status()
            ColorPrint.print_info('[CoreNode] Launch complete')
            ColorPrint.print_info(f'[CoreNode] Mode: {status["client"]["mode"]}')
            ColorPrint.print_info(f'[CoreNode] Backend running: {status["backend_server_running"]}')
            ColorPrint.print_info(f'[CoreNode] Client connected: {status["client_connected"]}')

            # Setup signal handlers
            self._setup_signal_handlers()

            # Wait for shutdown event
            await self.shutdown_event.wait()

            return self.launcher

        except Exception as error:
            ColorPrint.print_error(f'Failed to start Core Node Init: {error}')
            sys.exit(1)

    def _on_launched(self, info):
        ColorPrint.print_info(f'[CoreNode] System launched successfully: {info}')

    def _on_backend_started(self, info):
        ColorPrint.print_info(f'[CoreNode] Backend MCP server is running: {info}')

    def _on_client_connected(self, info):
        ColorPrint.print_info(f'[CoreNode] Client is connected: {info}')

    def _on_launch_error(self, error):
        ColorPrint.print_error(f'[CoreNode] Launch error: {error}')

    def _setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        def signal_handler(sig, frame):
            ColorPrint.print_info('\n[CoreNode] Received shutdown signal, shutting down gracefully...')
            asyncio.create_task(self.shutdown())

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

    async def shutdown(self):
        """Shutdown the application gracefully"""
        if self.launcher:
            await self.launcher.shutdown()
        self.shutdown_event.set()


def start():
    """
    Application entry point called from external launcher
    """
    app = CoreNodeInitApp()

    try:
        asyncio.run(app.start())
    except KeyboardInterrupt:
        ColorPrint.print_info('\nApplication interrupted by user')
    except Exception as e:
        ColorPrint.print_error(f'Fatal error: {e}')
        sys.exit(1)


if __name__ == '__main__':
    start()
