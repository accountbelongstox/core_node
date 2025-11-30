#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WebSocket RPC Client Thread

Native threading.Thread based RPC client implementation
"""

import threading
import asyncio
import time
from typing import Dict, Optional, Callable, Any
from pycore.pyfoundations.color_print import ColorPrint

# Import the original WsRpcClient
from pycore.pyutils.wsrpc.ws_rpc_client import WsRpcClient


class WsRpcClientThread(threading.Thread):
    """
    WebSocket RPC Client Thread

    Native threading.Thread based implementation.
    Connects to WebSocket RPC server and handles communication in separate thread.

    Usage:
        ```python
        # Create client thread
        client_thread = WsRpcClientThread(
            url='ws://localhost:8765',
            auto_connect=True,
            thread_name='RpcClient'
        )

        # Register event handlers
        @client_thread.on('connected')
        async def on_connected(data):
            print(f"Connected: {data}")

        # Start the thread
        client_thread.start()

        # Call RPC method
        result = client_thread.call('echo', {'text': 'hello'}, timeout=5.0)

        # Stop the thread
        client_thread.stop()
        ```
    """

    def __init__(
        self,
        url: str = 'ws://localhost:8765',
        options: Optional[Dict[str, Any]] = None,
        auto_connect: bool = True,
        auto_reconnect: bool = True,
        debug: bool = False,
        thread_name: str = 'WsRpcClientThread',
        daemon: bool = True
    ):
        """
        Initialize WsRpc Client Thread

        Args:
            url: WebSocket server URL
            options: Additional client options (see WsRpcClient)
            auto_connect: Automatically connect on start
            auto_reconnect: Automatically reconnect on disconnection
            debug: Enable debug mode
            thread_name: Thread name
            daemon: Run as daemon thread
        """
        # Initialize threading.Thread
        threading.Thread.__init__(self, name=thread_name, daemon=daemon)

        # Client configuration
        self.url = url
        self.auto_connect = auto_connect
        self.auto_reconnect = auto_reconnect
        self.debug = debug

        # Merge options
        self.options = options or {}
        self.options.update({
            'url': url,
            'debug': debug,
            'auto_reconnect': auto_reconnect
        })

        # Client instance
        self.client: Optional[WsRpcClient] = None

        # Event loop
        self._loop: Optional[asyncio.AbstractEventLoop] = None

        # Thread control
        self._running = False
        self._connected = False
        self._stop_event = threading.Event()

        # Pending items (registered before client is created)
        self._pending_events: Dict[str, list] = {}
        self._pending_middleware: list = []

        ColorPrint.green(f"[{self.name}] Client thread initialized: {self.url}")

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

            # Create client instance
            self.client = WsRpcClient(self.options)

            # Register pending events/middleware
            self._register_pending_items()

            # Auto-connect if enabled
            if self.auto_connect:
                self._loop.run_until_complete(self._connect_with_retry())

            # Keep event loop running
            ColorPrint.blue(f"[{self.name}] Client event loop running")
            self._run_event_loop()

        except Exception as e:
            ColorPrint.red(f"[{self.name}] Thread error: {e}")
            import traceback
            traceback.print_exc()

        finally:
            self._running = False
            self._cleanup()
            ColorPrint.yellow(f"[{self.name}] Thread stopped")

    def _run_event_loop(self):
        """Run event loop until stopped"""
        try:
            while not self._stop_event.is_set():
                # Run pending coroutines
                self._loop.run_until_complete(asyncio.sleep(0.1))

        except asyncio.CancelledError:
            ColorPrint.yellow(f"[{self.name}] Event loop cancelled")

    async def _connect_with_retry(self, max_retries: int = 3):
        """Connect with retry logic"""
        retries = 0

        while retries < max_retries and not self._stop_event.is_set():
            try:
                ColorPrint.blue(f"[{self.name}] Connecting to {self.url}...")
                await self.client.connect()
                self._connected = True
                ColorPrint.green(f"[{self.name}] Connected successfully")
                return

            except Exception as e:
                retries += 1
                ColorPrint.yellow(
                    f"[{self.name}] Connection failed (attempt {retries}/{max_retries}): {e}"
                )

                if retries < max_retries:
                    await asyncio.sleep(2 ** retries)  # Exponential backoff

        if not self._connected:
            ColorPrint.red(f"[{self.name}] Failed to connect after {max_retries} attempts")

    def stop(self, timeout: float = 5.0):
        """
        Stop the client thread gracefully

        Args:
            timeout: Maximum time to wait for thread to stop (seconds)
        """
        if not self._running:
            ColorPrint.yellow(f"[{self.name}] Already stopped")
            return

        ColorPrint.yellow(f"[{self.name}] Stopping client...")

        # Signal stop
        self._stop_event.set()

        # Disconnect client if running
        if self.client and self._loop and self._connected:
            try:
                # Schedule disconnect on the event loop
                asyncio.run_coroutine_threadsafe(
                    self.client.disconnect(),
                    self._loop
                )
            except Exception as e:
                ColorPrint.yellow(f"[{self.name}] Error during disconnect: {e}")

        # Wait for thread to finish
        self.join(timeout=timeout)

        if self.is_alive():
            ColorPrint.red(f"[{self.name}] Thread did not stop within timeout")
        else:
            ColorPrint.green(f"[{self.name}] Client stopped successfully")

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
    # Event Registration
    # ============================================

    def on(self, event: str):
        """
        Decorator to register event handler

        Args:
            event: Event name

        Example:
            ```python
            @client_thread.on('connected')
            async def on_connected(data):
                print(f"Connected: {data}")
            ```
        """
        def decorator(func: Callable):
            if self.client:
                self.client.on(event)(func)
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
        if self.client:
            self.client.use(middleware)
        else:
            self._pending_middleware.append(middleware)

    def _register_pending_items(self):
        """Register all pending events/middleware"""
        if not self.client:
            return

        # Register events
        for event, handlers in self._pending_events.items():
            for handler in handlers:
                self.client.on(event)(handler)

        # Register middleware
        for middleware in self._pending_middleware:
            self.client.use(middleware)

        # Clear pending items
        self._pending_events.clear()
        self._pending_middleware.clear()

    # ============================================
    # RPC Operations (Thread-safe)
    # ============================================

    def call(self, route: str, params: Optional[Dict] = None, timeout: float = 10.0) -> Any:
        """
        Call RPC method (blocking, thread-safe)

        Args:
            route: RPC route path
            params: Parameters to send
            timeout: Request timeout in seconds

        Returns:
            RPC result

        Raises:
            RuntimeError: If client not running or not connected
            TimeoutError: If request times out
        """
        if not self._running or not self.client:
            raise RuntimeError("Client not running")

        if not self._connected:
            raise RuntimeError("Client not connected")

        # Schedule call on event loop and wait for result
        future = asyncio.run_coroutine_threadsafe(
            self.client.call(route, params),
            self._loop
        )

        try:
            result = future.result(timeout=timeout)
            return result

        except asyncio.TimeoutError:
            raise TimeoutError(f"RPC call to '{route}' timed out after {timeout}s")

    async def call_async(self, route: str, params: Optional[Dict] = None) -> Any:
        """
        Call RPC method (async, must be called from async context)

        Args:
            route: RPC route path
            params: Parameters to send

        Returns:
            RPC result
        """
        if not self.client:
            raise RuntimeError("Client not running")

        return await self.client.call(route, params)

    def emit(self, event: str, data: Any):
        """
        Emit event to server (non-blocking)

        Args:
            event: Event name
            data: Event data
        """
        if not self.client or not self._loop or not self._connected:
            ColorPrint.yellow(f"[{self.name}] Not connected, cannot emit event")
            return

        # Schedule emit on event loop
        asyncio.run_coroutine_threadsafe(
            self.client.emit(event, data),
            self._loop
        )

    # ============================================
    # Connection Management
    # ============================================

    def connect(self, timeout: float = 10.0):
        """
        Connect to server (blocking, thread-safe)

        Args:
            timeout: Connection timeout in seconds

        Raises:
            RuntimeError: If client not running
            TimeoutError: If connection times out
        """
        if not self._running or not self.client:
            raise RuntimeError("Client not running")

        if self._connected:
            ColorPrint.yellow(f"[{self.name}] Already connected")
            return

        # Schedule connect on event loop
        future = asyncio.run_coroutine_threadsafe(
            self._connect_with_retry(),
            self._loop
        )

        try:
            future.result(timeout=timeout)
        except asyncio.TimeoutError:
            raise TimeoutError(f"Connection to {self.url} timed out after {timeout}s")

    def disconnect(self, timeout: float = 5.0):
        """
        Disconnect from server (blocking, thread-safe)

        Args:
            timeout: Disconnect timeout in seconds
        """
        if not self._running or not self.client:
            ColorPrint.yellow(f"[{self.name}] Client not running")
            return

        if not self._connected:
            ColorPrint.yellow(f"[{self.name}] Already disconnected")
            return

        # Schedule disconnect on event loop
        future = asyncio.run_coroutine_threadsafe(
            self.client.disconnect(),
            self._loop
        )

        try:
            future.result(timeout=timeout)
            self._connected = False
            ColorPrint.green(f"[{self.name}] Disconnected")

        except asyncio.TimeoutError:
            ColorPrint.yellow(f"[{self.name}] Disconnect timeout")

    # ============================================
    # Status and Info
    # ============================================

    def is_running(self) -> bool:
        """Check if client is running"""
        return self._running and self.is_alive()

    def is_connected(self) -> bool:
        """Check if client is connected"""
        return self._connected

    def get_status(self) -> Dict[str, Any]:
        """Get client status"""
        return {
            'name': self.name,
            'url': self.url,
            'running': self._running,
            'connected': self._connected,
            'alive': self.is_alive(),
        }
