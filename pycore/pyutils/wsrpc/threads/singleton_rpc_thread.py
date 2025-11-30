#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Singleton RPC Backend Thread

Combines singleton detection with RPC server/client in a native thread
"""

import threading
import asyncio
import time
from typing import Dict, Optional, Callable, Any
from pycore.pyfoundations.color_print import ColorPrint

# Import base classes
from pycore.pyutils.wsrpc.singleton_backend import SingletonBackendDetector
from pycore.pyutils.wsrpc.ws_rpc_server import WsRpcServer
from pycore.pyutils.wsrpc.ws_rpc_client import WsRpcClient


class SingletonRpcBackendThread(threading.Thread):
    """
    Singleton RPC Backend Thread

    Native threading.Thread implementation combining:
    - Singleton instance detection
    - RPC server (primary instance only)
    - RPC client communication (all instances)

    Usage:
        ```python
        # Create backend thread
        backend = SingletonRpcBackendThread(
            singleton_port=19999,
            rpc_port=8765,
            thread_name='SingletonRPC'
        )

        # Register routes (before starting)
        @backend.route('echo')
        async def echo(params):
            return {'message': params.get('text')}

        # Start thread
        backend.start()

        # Check if this is primary instance
        if backend.is_primary():
            print("This is the primary instance")

        # Call RPC method
        result = backend.call('echo', {'text': 'hello'}, timeout=5.0)

        # Stop thread
        backend.stop()
        ```
    """

    def __init__(
        self,
        singleton_host: str = 'localhost',
        singleton_port: int = 19999,
        rpc_host: str = 'localhost',
        rpc_port: int = 8765,
        debug: bool = False,
        thread_name: str = 'SingletonRpcBackend',
        daemon: bool = True
    ):
        """
        Initialize Singleton RPC Backend Thread

        Args:
            singleton_host: Host for singleton detection
            singleton_port: Port for singleton detection
            rpc_host: Host for RPC server
            rpc_port: Port for RPC server
            debug: Enable debug mode
            thread_name: Thread name
            daemon: Run as daemon thread
        """
        # Initialize threading.Thread
        threading.Thread.__init__(self, name=thread_name, daemon=daemon)

        # Configuration
        self.singleton_host = singleton_host
        self.singleton_port = singleton_port
        self.rpc_host = rpc_host
        self.rpc_port = rpc_port
        self.debug = debug

        # Singleton detector
        self.detector = SingletonBackendDetector(
            host=singleton_host,
            port=singleton_port,
            debug=debug
        )

        # RPC components
        self.rpc_server: Optional[WsRpcServer] = None
        self.rpc_client: Optional[WsRpcClient] = None

        # Event loop
        self._loop: Optional[asyncio.AbstractEventLoop] = None

        # Thread control
        self._running = False
        self._is_primary = False
        self._stop_event = threading.Event()

        # Pending routes (registered before start)
        self._pending_routes: Dict[str, Callable] = {}
        self._pending_events: Dict[str, list] = {}

        ColorPrint.green(f"[{self.name}] Singleton RPC backend initialized")

    # ============================================
    # Thread Lifecycle
    # ============================================

    def run(self):
        """
        Thread entry point

        Detects if this is primary instance and starts appropriate services.
        """
        try:
            self._running = True
            ColorPrint.green(f"[{self.name}] Thread started")

            # Detect if this is primary instance
            self._is_primary = self.detector.detect_instance()

            if self._is_primary:
                ColorPrint.blue(f"[{self.name}] PRIMARY INSTANCE - Starting RPC server")
                self._run_primary_instance()
            else:
                ColorPrint.blue(f"[{self.name}] SECONDARY INSTANCE - Connecting to RPC server")
                self._run_secondary_instance()

        except Exception as e:
            ColorPrint.red(f"[{self.name}] Thread error: {e}")
            import traceback
            traceback.print_exc()

        finally:
            self._running = False
            self._cleanup()
            ColorPrint.yellow(f"[{self.name}] Thread stopped")

    def _run_primary_instance(self):
        """Run as primary instance (with RPC server)"""
        # Create event loop
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)

        # Create RPC server
        self.rpc_server = WsRpcServer({
            'host': self.rpc_host,
            'port': self.rpc_port,
            'debug': self.debug
        })

        # Register pending routes
        self._register_pending_routes()

        # Also create client (for self-communication)
        self.rpc_client = WsRpcClient({
            'url': f'ws://{self.rpc_host}:{self.rpc_port}',
            'debug': self.debug
        })

        # Run server
        try:
            ColorPrint.green(f"[{self.name}] RPC Server starting on ws://{self.rpc_host}:{self.rpc_port}")

            # Start server and keep running until stopped
            self._loop.run_until_complete(self._run_server_loop())

        except Exception as e:
            ColorPrint.red(f"[{self.name}] Server error: {e}")

    def _run_secondary_instance(self):
        """Run as secondary instance (client only)"""
        # Create event loop
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)

        # Create RPC client
        self.rpc_client = WsRpcClient({
            'url': f'ws://{self.rpc_host}:{self.rpc_port}',
            'debug': self.debug,
            'auto_reconnect': True
        })

        # Run client
        try:
            ColorPrint.green(f"[{self.name}] Connecting to RPC server at ws://{self.rpc_host}:{self.rpc_port}")

            # Connect and keep running until stopped
            self._loop.run_until_complete(self._run_client_loop())

        except Exception as e:
            ColorPrint.red(f"[{self.name}] Client error: {e}")

    async def _run_server_loop(self):
        """Run server loop with graceful shutdown"""
        try:
            # Start server
            server_task = asyncio.create_task(self.rpc_server.start())

            # Wait a bit for server to start
            await asyncio.sleep(0.5)

            # Connect client to self
            await self.rpc_client.connect()

            # Wait for stop signal
            while not self._stop_event.is_set():
                await asyncio.sleep(0.1)

            # Cancel server task
            server_task.cancel()

            try:
                await server_task
            except asyncio.CancelledError:
                pass

        finally:
            # Stop server
            if self.rpc_server:
                await self.rpc_server.stop()

            # Disconnect client
            if self.rpc_client:
                await self.rpc_client.disconnect()

    async def _run_client_loop(self):
        """Run client loop with reconnection"""
        try:
            # Connect to server
            await self.rpc_client.connect()

            # Keep running until stopped
            while not self._stop_event.is_set():
                await asyncio.sleep(0.1)

        finally:
            # Disconnect
            if self.rpc_client:
                await self.rpc_client.disconnect()

    def stop(self, timeout: float = 5.0):
        """
        Stop the backend thread gracefully

        Args:
            timeout: Maximum time to wait for thread to stop (seconds)
        """
        if not self._running:
            ColorPrint.yellow(f"[{self.name}] Already stopped")
            return

        ColorPrint.yellow(f"[{self.name}] Stopping backend...")

        # Signal stop
        self._stop_event.set()

        # Stop detector
        self.detector.stop()

        # Wait for thread to finish
        self.join(timeout=timeout)

        if self.is_alive():
            ColorPrint.red(f"[{self.name}] Thread did not stop within timeout")
        else:
            ColorPrint.green(f"[{self.name}] Backend stopped successfully")

    def _cleanup(self):
        """Cleanup resources"""
        if self._loop:
            try:
                # Cancel all pending tasks
                pending = asyncio.all_tasks(self._loop)
                for task in pending:
                    task.cancel()

                # Close the loop
                self._loop.close()

            except Exception as e:
                ColorPrint.yellow(f"[{self.name}] Cleanup error: {e}")

    # ============================================
    # Route Registration (Pre-start only)
    # ============================================

    def route(self, path: str):
        """
        Decorator to register RPC route (primary instance only)

        Args:
            path: Route path

        Example:
            ```python
            @backend.route('echo')
            async def echo(params):
                return {'message': params.get('text')}
            ```

        Note:
            Routes are only active on primary instance.
            Secondary instances can call routes but not register them.
        """
        def decorator(func: Callable):
            if self.rpc_server:
                # Server already created, register directly
                self.rpc_server.route(path)(func)
            else:
                # Store for later registration
                self._pending_routes[path] = func
            return func
        return decorator

    def on(self, event: str):
        """
        Decorator to register event handler

        Args:
            event: Event name
        """
        def decorator(func: Callable):
            if self.rpc_client:
                self.rpc_client.on(event)(func)
            else:
                if event not in self._pending_events:
                    self._pending_events[event] = []
                self._pending_events[event].append(func)
            return func
        return decorator

    def _register_pending_routes(self):
        """Register all pending routes"""
        if not self.rpc_server:
            return

        for path, func in self._pending_routes.items():
            self.rpc_server.route(path)(func)

        self._pending_routes.clear()

    # ============================================
    # RPC Operations (Thread-safe)
    # ============================================

    def call(self, route: str, params: Optional[Dict] = None, timeout: float = 10.0) -> Any:
        """
        Call RPC method (blocking, thread-safe)

        Works in both primary and secondary instances.

        Args:
            route: RPC route path
            params: Parameters to send
            timeout: Request timeout in seconds

        Returns:
            RPC result

        Raises:
            RuntimeError: If backend not running
            TimeoutError: If request times out
        """
        if not self._running or not self.rpc_client:
            raise RuntimeError("Backend not running")

        # Schedule call on event loop and wait for result
        future = asyncio.run_coroutine_threadsafe(
            self.rpc_client.call(route, params),
            self._loop
        )

        try:
            result = future.result(timeout=timeout)
            return result

        except asyncio.TimeoutError:
            raise TimeoutError(f"RPC call to '{route}' timed out after {timeout}s")

    def emit(self, event: str, data: Any):
        """
        Emit event to server (non-blocking)

        Args:
            event: Event name
            data: Event data
        """
        if not self.rpc_client or not self._loop:
            ColorPrint.yellow(f"[{self.name}] Backend not running, cannot emit event")
            return

        # Schedule emit on event loop
        asyncio.run_coroutine_threadsafe(
            self.rpc_client.emit(event, data),
            self._loop
        )

    def broadcast(self, event: str, data: Any):
        """
        Broadcast event to all clients (primary instance only)

        Args:
            event: Event name
            data: Event data
        """
        if not self._is_primary:
            ColorPrint.yellow(f"[{self.name}] Only primary instance can broadcast")
            return

        if not self.rpc_server or not self._loop:
            ColorPrint.yellow(f"[{self.name}] Server not running, cannot broadcast")
            return

        # Schedule broadcast on event loop
        asyncio.run_coroutine_threadsafe(
            self.rpc_server.emit(event, data),
            self._loop
        )

    # ============================================
    # Status and Info
    # ============================================

    def is_running(self) -> bool:
        """Check if backend is running"""
        return self._running and self.is_alive()

    def is_primary(self) -> bool:
        """Check if this is primary instance"""
        return self._is_primary

    def get_status(self) -> Dict[str, Any]:
        """Get backend status"""
        status = {
            'name': self.name,
            'running': self._running,
            'alive': self.is_alive(),
            'is_primary': self._is_primary,
            'singleton_port': self.singleton_port,
            'rpc_port': self.rpc_port,
        }

        if self._is_primary and self.rpc_server:
            status['clients_connected'] = len(self.rpc_server.clients)

        return status
