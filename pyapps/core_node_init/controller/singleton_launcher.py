"""
Singleton Launcher for Core Node Init

Manages the lifecycle of the application in singleton mode.
"""

import asyncio
from typing import Dict, Any, Optional, Callable
from datetime import datetime

from pycore import ColorPrint, EventBus

from pyapps.core_node_init.controller.mcp_server_controller import CoreNodeInitMCPServer
from pyapps.core_node_init.config import config


class CoreNodeSingletonLauncher:
    """
    Singleton launcher that ensures only one instance of the application runs
    """

    def __init__(self):
        self.mcp_server: Optional[CoreNodeInitMCPServer] = None
        self.backend_server_running = False
        self.client_connected = False
        self.client_mode = 'singleton'
        self.launch_time: Optional[datetime] = None
        self.event_handlers = {}

    def on(self, event_name: str, handler: Callable):
        """Register event handler"""
        if event_name not in self.event_handlers:
            self.event_handlers[event_name] = []
        self.event_handlers[event_name].append(handler)

    def emit(self, event_name: str, data: Any = None):
        """Emit event to registered handlers"""
        if event_name in self.event_handlers:
            for handler in self.event_handlers[event_name]:
                try:
                    handler(data)
                except Exception as e:
                    ColorPrint.print_error(f'Error in event handler for {event_name}: {e}')

    async def launch(self):
        """Launch the application in singleton mode"""
        try:
            self.launch_time = datetime.now()

            # Initialize MCP server
            self.mcp_server = CoreNodeInitMCPServer()
            await self.mcp_server.initialize()

            self.backend_server_running = True
            self.client_connected = True

            # Emit events
            self.emit('backend_started', {
                'time': self.launch_time.isoformat(),
                'mode': self.client_mode
            })

            self.emit('client_connected', {
                'time': datetime.now().isoformat(),
                'mode': self.client_mode
            })

            self.emit('launched', {
                'time': self.launch_time.isoformat(),
                'mode': self.client_mode,
                'backend_running': self.backend_server_running,
                'client_connected': self.client_connected
            })

            ColorPrint.print_success('Singleton launcher initialized successfully')
            return True

        except Exception as error:
            self.emit('launch_error', {
                'error': str(error),
                'time': datetime.now().isoformat()
            })
            ColorPrint.print_error(f'Failed to launch singleton: {error}')
            raise

    async def shutdown(self):
        """Shutdown the application gracefully"""
        try:
            ColorPrint.print_info('Shutting down singleton launcher...')

            if self.mcp_server:
                await self.mcp_server.cleanup()

            self.backend_server_running = False
            self.client_connected = False

            ColorPrint.print_success('Singleton launcher shutdown complete')

        except Exception as error:
            ColorPrint.print_error(f'Error during shutdown: {error}')

    def get_status(self) -> Dict[str, Any]:
        """Get current launcher status"""
        return {
            'backend_server_running': self.backend_server_running,
            'client_connected': self.client_connected,
            'client_mode': self.client_mode,
            'launch_time': self.launch_time.isoformat() if self.launch_time else None
        }

    def get_detailed_status(self) -> Dict[str, Any]:
        """Get detailed launcher status"""
        uptime = None
        if self.launch_time:
            uptime = (datetime.now() - self.launch_time).total_seconds()

        return {
            'backend_server_running': self.backend_server_running,
            'client_connected': self.client_connected,
            'client': {
                'mode': self.client_mode,
                'connected': self.client_connected
            },
            'backend': {
                'running': self.backend_server_running,
                'mcp_server_initialized': self.mcp_server.initialized if self.mcp_server else False
            },
            'timing': {
                'launch_time': self.launch_time.isoformat() if self.launch_time else None,
                'uptime_seconds': uptime
            }
        }
