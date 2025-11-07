# -*- coding: utf-8 -*-
"""
Singleton RPC Example and Entry Point

This file demonstrates how to use the SingletonBackendDetector with WebSocket RPC.
It implements a complete example of:
1. Singleton backend detection
2. WebSocket RPC server (only in primary instance)
3. WebSocket RPC client communication (in all instances)

Usage:
    # Start first instance (becomes primary):
    python singleton_rpc_example.py

    # Start second instance (becomes secondary, reuses backend):
    python singleton_rpc_example.py

Copy this implementation to your client project and modify as needed.
"""

import asyncio
import time
import sys
from typing import Optional

from .singleton_backend import SingletonBackendDetector
from .ws_rpc_server import WsRpcServer
from .ws_rpc_client import WsRpcClient


class SingletonRpcBackend(SingletonBackendDetector):
    """
    Singleton RPC Backend Implementation

    Combines singleton detection with WebSocket RPC functionality.
    Only the primary instance runs the RPC server, while all instances
    can communicate with it via RPC client.

    IMPORTANT: Copy this class to your project and implement your own logic.
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

    def _log(self, message: str, level: str = 'INFO'):
        """Override to add RPC prefix"""
        if self.debug or level in ['ERROR', 'WARNING']:
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
        self._log("=== Starting RPC Backend Server ===")

        # Create new event loop for this thread
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)

        # Initialize RPC server
        self.rpc_server = WsRpcServer({
            'host': self.rpc_host,
            'port': self.rpc_port,
            'debug': self.debug
        })

        # Register RPC routes
        self._register_backend_routes()

        # Run server
        try:
            self._log(f"RPC Server listening on ws://{self.rpc_host}:{self.rpc_port}")
            self._loop.run_until_complete(self.rpc_server.start())

        except Exception as e:
            self._log(f"RPC Server error: {e}", 'ERROR')

        finally:
            self._log("RPC Backend Server stopped")
            if self._loop:
                self._loop.close()

    def _register_backend_routes(self):
        """Register backend RPC routes (customize for your needs)"""

        @self.rpc_server.route('echo')
        async def echo(params):
            """Echo test route"""
            return {
                'success': True,
                'message': params.get('message', ''),
                'timestamp': time.time()
            }

        @self.rpc_server.route('get_status')
        async def get_status(params):
            """Get backend status"""
            return {
                'success': True,
                'status': 'running',
                'is_primary': self._is_primary_instance,
                'uptime': time.time(),
                'clients_connected': len(self.rpc_server.clients)
            }

        @self.rpc_server.route('process_task')
        async def process_task(params):
            """Process a task (example)"""
            task_id = params.get('task_id')
            task_data = params.get('data')

            self._log(f"Processing task: {task_id}")

            # Simulate task processing
            await asyncio.sleep(0.5)

            return {
                'success': True,
                'task_id': task_id,
                'result': f"Task {task_id} completed",
                'processed_at': time.time()
            }

        @self.rpc_server.route('shutdown')
        async def shutdown(params):
            """Shutdown the backend"""
            self._log("Received shutdown request via RPC", 'WARNING')
            self._running = False
            return {'success': True, 'message': 'Shutting down...'}

        self._log(f"Registered {len(self.rpc_server.routes)} backend routes")

    # ============================================
    # Client Communication (All Instances)
    # ============================================

    def run_client_communication(self):
        """
        Run client communication thread (all instances)

        This handles communication between the client and backend RPC server.
        Runs in all instances (both primary and secondary).
        """
        self._log("=== Starting Client Communication ===")

        # Create new event loop for this thread
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)

        try:
            # Connect to RPC server
            self._loop.run_until_complete(self._client_communication_loop())

        except Exception as e:
            self._log(f"Client communication error: {e}", 'ERROR')

        finally:
            self._log("Client Communication stopped")
            if self._loop:
                self._loop.close()

    async def _client_communication_loop(self):
        """Async client communication loop"""

        # Wait a bit for server to start (if primary instance)
        if self._is_primary_instance:
            self._log("Waiting for RPC server to start...")
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
            self._log("RPC Client connected to backend")

            # Register client routes (if needed)
            self._register_client_routes()

            # Example: Send periodic requests
            await self._client_task_loop()

        except Exception as e:
            self._log(f"Client connection error: {e}", 'ERROR')

        finally:
            if self.rpc_client:
                await self.rpc_client.disconnect()

    def _register_client_routes(self):
        """Register client-side RPC routes (customize for your needs)"""

        @self.rpc_client.route('notify')
        async def handle_notify(params):
            """Handle notification from backend"""
            self._log(f"Received notification: {params.get('message')}")
            return {'success': True}

        @self.rpc_client.route('update')
        async def handle_update(params):
            """Handle update from backend"""
            self._log(f"Received update: {params}")
            return {'success': True}

        self._log(f"Registered {len(self.rpc_client.routes)} client routes")

    async def _client_task_loop(self):
        """Client task loop - send periodic requests (example)"""
        counter = 0

        while self._running:
            try:
                counter += 1

                # Example: Send echo request every 5 seconds
                if counter % 5 == 0:
                    result = await self.rpc_client.call('echo', {
                        'message': f'Hello from client #{counter}'
                    })
                    self._log(f"Echo response: {result.get('message')}")

                # Example: Get status every 10 seconds
                if counter % 10 == 0:
                    status = await self.rpc_client.call('get_status', {})
                    self._log(f"Backend status: {status}")

                await asyncio.sleep(1)

            except Exception as e:
                self._log(f"Client task error: {e}", 'ERROR')
                await asyncio.sleep(5)  # Wait before retry


# ============================================
# Entry Point
# ============================================

def main():
    """
    Main entry point for Singleton RPC application

    This can be launched multiple times. The first instance becomes
    the primary (runs backend), subsequent instances become secondary
    (only run client communication).
    """
    print("=" * 60)
    print("Singleton WebSocket RPC Example")
    print("=" * 60)
    print()

    # Configuration
    SINGLETON_PORT = 19999  # Port for singleton detection
    RPC_PORT = 8765        # Port for RPC server
    DEBUG = True           # Enable debug output

    # Create singleton RPC backend
    backend = SingletonRpcBackend(
        singleton_host='localhost',
        singleton_port=SINGLETON_PORT,
        rpc_host='localhost',
        rpc_port=RPC_PORT,
        debug=DEBUG
    )

    # Set event callbacks
    backend.on_primary_started(lambda: print("\n✓ Started as PRIMARY instance (running backend)\n"))
    backend.on_secondary_started(lambda: print("\n✓ Started as SECONDARY instance (reusing backend)\n"))
    backend.on_shutdown(lambda: print("\n✓ Shutting down...\n"))

    # Start the backend
    if backend.start():
        try:
            print("Application running. Press Ctrl+C to stop.")
            print()

            if backend.is_primary_instance():
                print(f"→ RPC Server: ws://localhost:{RPC_PORT}")
                print(f"→ Singleton Detection: localhost:{SINGLETON_PORT}")
            else:
                print(f"→ Connected to existing backend at ws://localhost:{RPC_PORT}")

            print()
            print("You can start multiple instances - they will share the same backend.")
            print()

            # Keep main thread alive
            while backend.is_running():
                time.sleep(1)

        except KeyboardInterrupt:
            print("\n\nReceived interrupt signal")

        finally:
            backend.stop()
            print("\nApplication stopped.")

    else:
        print("ERROR: Failed to start application!")
        sys.exit(1)


# Alternative: Simple example without RPC integration
class SimpleExample(SingletonBackendDetector):
    """
    Simple example without RPC (for reference)

    Use this if you don't need WebSocket RPC functionality.
    """

    def run_backend(self):
        """Simple backend logic"""
        print("Backend thread started (primary instance only)")
        counter = 0
        while self._running:
            counter += 1
            print(f"  Backend task #{counter} executing...")
            time.sleep(3)
        print("Backend thread stopped")

    def run_client_communication(self):
        """Simple client communication"""
        print("Client communication thread started (all instances)")
        counter = 0
        while self._running:
            counter += 1
            print(f"  Client task #{counter} executing...")
            time.sleep(2)
        print("Client communication thread stopped")


def simple_main():
    """Simple example entry point"""
    print("=== Simple Singleton Example (No RPC) ===\n")

    launcher = SimpleExample(
        host='localhost',
        port=19999,
        debug=True
    )

    launcher.on_primary_started(lambda: print("✓ Primary instance"))
    launcher.on_secondary_started(lambda: print("✓ Secondary instance"))

    if launcher.start():
        try:
            print("\nRunning. Press Ctrl+C to stop.\n")
            while launcher.is_running():
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n\nStopping...")
        finally:
            launcher.stop()


if __name__ == '__main__':
    # Run the full RPC example
    main()

    # Or run the simple example:
    # simple_main()
