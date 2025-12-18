#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WebSocket RPC Server Thread

Native threading.Thread based RPC server implementation
Inspired by SeleniumThread pattern
"""

import threading
import asyncio
import time
from typing import Dict, Optional, Callable, Any
from pycore.pyfoundations.color_print import ColorPrint

# Import the original WsRpcServer
from pycore.pyutils.wsrpc.ws_rpc_server import WsRpcServer


class WsRpcServerThread(threading.Thread):
    """
    WebSocket RPC Server Thread

    Native threading.Thread based implementation.
    Runs WebSocket RPC server in a separate thread with asyncio event loop.

    Usage:
        ```python
        # Create thread with configuration
        server_thread = WsRpcServerThread(
            host='localhost',
            port=8765,
            debug=True,
            thread_name='RpcServer'
        )

        # Register routes before starting
        @server_thread.route('echo')
        async def echo(params):
            return {'message': params.get('text')}

        # Start the thread
        server_thread.start()

        # Stop the thread
        server_thread.stop()
        ```
    """

    def __init__(
        self,
        host: str = 'localhost',
        port: int = 8765,
        options: Optional[Dict[str, Any]] = None,
        debug: bool = False,
        thread_name: str = 'WsRpcServerThread',
        daemon: bool = True
    ):
        """
        Initialize WsRpc Server Thread

        Args:
            host: Server host address
            port: Server port
            options: Additional server options (see WsRpcServer)
            debug: Enable debug mode
            thread_name: Thread name
            daemon: Run as daemon thread
        """
        # Initialize threading.Thread
        threading.Thread.__init__(self, name=thread_name, daemon=daemon)

        # Server configuration
        self.host = host
        self.port = port
        self.debug = debug

        # Merge options
        self.options = options or {}
        self.options.update({
            'host': host,
            'port': port,
            'debug': debug
        })

        # Server instance
        self.server: Optional[WsRpcServer] = None

        # Event loop
        self._loop: Optional[asyncio.AbstractEventLoop] = None

        # Thread control
        self._running = False
        self._stop_event = threading.Event()

        # Routes to register (stored until server is created)
        self._pending_routes: Dict[str, Callable] = {}
        self._pending_events: Dict[str, list] = {}
        self._pending_middleware: list = []

        ColorPrint.green(f"[{self.name}] Server thread initialized: ws://{self.host}:{self.port}")

    # ============================================
    # Thread Lifecycle
    # ============================================

    def run(self):
        """
        Thread entry point - runs the asyncio event loop

        This method is called automatically when thread.start() is invoked.
        """
        try:
            self._running = True
            ColorPrint.green(f"[{self.name}] Thread started")

            # Create new event loop for this thread
            self._loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._loop)

            # Create server instance
            self.server = WsRpcServer(self.options)

            # Register pending routes/events/middleware
            self._register_pending_items()

            # Run server until stopped
            ColorPrint.blue(f"[{self.name}] Starting WebSocket RPC server on ws://{self.host}:{self.port}")

            # Start server (blocking call)
            self._loop.run_until_complete(self._run_server())

        except Exception as e:
            ColorPrint.red(f"[{self.name}] Thread error: {e}")
            import traceback
            traceback.print_exc()

        finally:
            self._running = False
            self._cleanup()
            ColorPrint.yellow(f"[{self.name}] Thread stopped")

    async def _run_server(self):
        """Run server and handle graceful shutdown"""
        try:
            # Start server
            await self.server.start()

            # Wait for stop signal
            while not self._stop_event.is_set():
                await asyncio.sleep(0.1)

        except asyncio.CancelledError:
            ColorPrint.yellow(f"[{self.name}] Server cancelled")

        finally:
            # Stop server
            if self.server:
                await self.server.stop()

    def stop(self, timeout: float = 5.0):
        """
        Stop the server thread gracefully

        Args:
            timeout: Maximum time to wait for thread to stop (seconds)
        """
        if not self._running:
            ColorPrint.yellow(f"[{self.name}] Already stopped")
            return

        ColorPrint.yellow(f"[{self.name}] Stopping server...")

        # Signal stop
        self._stop_event.set()

        # Stop server if running
        if self.server and self._loop:
            try:
                # Schedule stop on the event loop
                asyncio.run_coroutine_threadsafe(
                    self.server.stop(),
                    self._loop
                )
            except Exception as e:
                ColorPrint.yellow(f"[{self.name}] Error during stop: {e}")

        # Wait for thread to finish
        self.join(timeout=timeout)

        if self.is_alive():
            ColorPrint.red(f"[{self.name}] Thread did not stop within timeout")
        else:
            ColorPrint.green(f"[{self.name}] Server stopped successfully")

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
    # Route Registration (Pre-start)
    # ============================================

    def route(self, path: str):
        """
        Decorator to register RPC route

        Can be used before or after thread is started.

        Args:
            path: Route path

        Example:
            ```python
            server_thread = WsRpcServerThread(port=8765)

            @server_thread.route('echo')
            async def echo(params):
                return {'message': params.get('text')}

            server_thread.start()
            ```
        """
        def decorator(func: Callable):
            if self.server:
                # Server already created, register directly
                self.server.route(path)(func)
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
            if self.server:
                self.server.on(event)(func)
            else:
                if event not in self._pending_events:
                    self._pending_events[event] = []
                self._pending_events[event].append(func)
            return func
        return decorator

    def use(self, middleware: Callable):
        """
        Add middleware

        Args:
            middleware: Middleware function
        """
        if self.server:
            self.server.use(middleware)
        else:
            self._pending_middleware.append(middleware)

    def _register_pending_items(self):
        """Register all pending routes/events/middleware"""
        if not self.server:
            return

        # Register routes
        for path, func in self._pending_routes.items():
            self.server.route(path, func)

        # Register events
        for event, handlers in self._pending_events.items():
            for handler in handlers:
                self.server.on(event, handler)

        # Register middleware
        for middleware in self._pending_middleware:
            self.server.use(middleware)

        # Clear pending items
        self._pending_routes.clear()
        self._pending_events.clear()
        self._pending_middleware.clear()

    # ============================================
    # Runtime Operations
    # ============================================

    def call(self, route: str, params: Optional[Dict] = None) -> Any:
        """
        Call a route directly (for testing/internal use)

        Args:
            route: Route path
            params: Parameters

        Returns:
            Route result
        """
        if not self.server:
            raise RuntimeError("Server not started")

        # This would need to be implemented in WsRpcServer
        # For now, just raise an error
        raise NotImplementedError("Direct route calling not yet implemented")

    def broadcast(self, event: str, data: Any):
        """
        Broadcast event to all clients

        Args:
            event: Event name
            data: Event data
        """
        if not self.server or not self._loop:
            ColorPrint.yellow(f"[{self.name}] Server not running, cannot broadcast")
            return

        # Schedule broadcast on event loop
        asyncio.run_coroutine_threadsafe(
            self.server.emit(event, data),
            self._loop
        )

    # ============================================
    # Status and Info
    # ============================================

    def is_running(self) -> bool:
        """Check if server is running"""
        return self._running and self.is_alive()

    def get_status(self) -> Dict[str, Any]:
        """Get server status"""
        return {
            'name': self.name,
            'host': self.host,
            'port': self.port,
            'running': self._running,
            'alive': self.is_alive(),
            'clients_connected': len(self.server.clients) if self.server else 0,
        }

    def get_clients(self) -> Dict:
        """Get connected clients"""
        if not self.server:
            return {}
        return self.server.clients
