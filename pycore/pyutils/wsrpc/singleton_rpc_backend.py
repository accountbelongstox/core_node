# -*- coding: utf-8 -*-
"""
Singleton RPC Backend

Combines singleton detection with WebSocket RPC functionality.
Only the primary instance runs the RPC server, while all instances
can communicate with it via RPC client.
"""

import asyncio
import time
from typing import Optional

from pycore.pyutils.wsrpc.singleton_backend import SingletonBackendDetector
from pycore.pyutils.wsrpc.ws_rpc_server import WsRpcServer
from pycore.pyutils.wsrpc.ws_rpc_client import WsRpcClient


class SingletonRpcBackend(SingletonBackendDetector):
    """
    Singleton RPC Backend Implementation

    Combines singleton detection with WebSocket RPC functionality.
    Only the primary instance runs the RPC server, while all instances
    can communicate with it via RPC client.

    Usage:
        ```python
        class MyBackend(SingletonRpcBackend):
            def _register_backend_routes(self):
                @self.rpc_server.route('my_route')
                async def my_route(params):
                    return {'result': 'processed'}

        backend = MyBackend(rpc_port=8765)
        backend.start()
        ```
    """

    def __init__(
        self,
        singleton_host: str = 'localhost',
        singleton_port: int = 19999,
        rpc_host: str = 'localhost',
        rpc_port: int = 8765,
        debug: bool = False
    ):
        """
        Initialize Singleton RPC Backend

        Args:
            singleton_host: Host for singleton detection (default: localhost)
            singleton_port: Port for singleton detection (default: 19999)
            rpc_host: Host for RPC server (default: localhost)
            rpc_port: Port for RPC server (default: 8765)
            debug: Enable debug output
        """
        super().__init__(
            host=singleton_host,
            port=singleton_port,
            debug=debug
        )

        self.rpc_host = rpc_host
        self.rpc_port = rpc_port

        # RPC components
        self.rpc_server: Optional[WsRpcServer] = None
        self.rpc_client: Optional[WsRpcClient] = None

        # Async event loop (for RPC)
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def _log(self, message: str, level: str = 'INFO', force: bool = False):
        """
        Override to add RPC prefix

        Args:
            message: Log message
            level: Log level (INFO, WARNING, ERROR, CRITICAL)
            force: Force output regardless of debug setting
        """
        # Always output: ERROR, WARNING, CRITICAL, or forced messages
        if force or level in ['ERROR', 'WARNING', 'CRITICAL'] or self.debug:
            timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{timestamp}] [{level}] SingletonRPC: {message}")

    # ============================================
    # Backend Implementation (Primary Instance Only)
    # ============================================

    def run_backend(self):
        """
        Run backend with RPC server (primary instance only)

        This starts a WebSocket RPC server that handles all client requests.
        Only runs in the primary (first launched) instance.
        """
        self._log("=== Starting RPC Backend Server ===", force=True)

        # Create new event loop for this thread
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)

        # Initialize RPC server
        self.rpc_server = WsRpcServer({
            'host': self.rpc_host,
            'port': self.rpc_port,
            'debug': self.debug
        })

        # Register RPC routes (override this method in subclass)
        self._register_backend_routes()

        # Run server
        try:
            self._log(f"RPC Server listening on ws://{self.rpc_host}:{self.rpc_port}", force=True)
            self._loop.run_until_complete(self.rpc_server.start())

        except Exception as e:
            self._log(f"RPC Server error: {e}", 'ERROR')

        finally:
            self._log("RPC Backend Server stopped", force=True)
            if self._loop:
                self._loop.close()

    def _register_backend_routes(self):
        """
        Register backend RPC routes

        Override this method in subclass to register your routes.

        Example:
            ```python
            def _register_backend_routes(self):
                @self.rpc_server.route('my_route')
                async def my_route(params):
                    return {'result': 'processed'}
            ```
        """
        # Default: no routes registered
        # Subclasses should override this method
        pass

    # ============================================
    # Client Communication (All Instances)
    # ============================================

    def run_client_communication(self):
        """
        Run client communication thread (all instances)

        This handles communication between the client and backend RPC server.
        Runs in all instances (both primary and secondary).
        """
        self._log("=== Starting Client Communication ===", force=True)

        # Create new event loop for this thread
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)

        try:
            # Connect to RPC server
            self._loop.run_until_complete(self._client_communication_loop())

        except Exception as e:
            self._log(f"Client communication error: {e}", 'ERROR')

        finally:
            self._log("Client Communication stopped", force=True)
            if self._loop:
                self._loop.close()

    async def _client_communication_loop(self):
        """Async client communication loop"""

        # Wait a bit for server to start (if primary instance)
        if self._is_primary_instance:
            self._log("Waiting for RPC server to start...", force=True)
            await asyncio.sleep(2)

        # Initialize RPC client
        rpc_url = f"ws://{self.rpc_host}:{self.rpc_port}"
        self.rpc_client = WsRpcClient(rpc_url, {
            'debug': self.debug,
            'reconnect': True,
            'reconnect_interval': 3
        })

        # Connect to server
        try:
            await self.rpc_client.connect()
            self._log("RPC Client connected to backend", force=True)

            # Register client routes (if needed)
            self._register_client_routes()

            # Run client task loop
            await self._client_task_loop()

        except Exception as e:
            self._log(f"Client connection error: {e}", 'ERROR')

        finally:
            if self.rpc_client:
                await self.rpc_client.disconnect()

    def _register_client_routes(self):
        """
        Register client-side RPC routes

        Override this method in subclass to register client routes.

        Example:
            ```python
            def _register_client_routes(self):
                @self.rpc_client.route('notify')
                async def handle_notify(params):
                    return {'success': True}
            ```
        """
        # Default: no routes registered
        # Subclasses should override this method
        pass

    async def _client_task_loop(self):
        """
        Client task loop

        Override this method in subclass to implement client-side logic.

        Example:
            ```python
            async def _client_task_loop(self):
                while self._running:
                    result = await self.rpc_client.call('my_route', {})
                    await asyncio.sleep(1)
            ```
        """
        # Default: just keep connection alive
        while self._running:
            await asyncio.sleep(1)
