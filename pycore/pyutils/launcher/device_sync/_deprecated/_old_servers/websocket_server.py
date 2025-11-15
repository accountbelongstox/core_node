# -*- coding: utf-8 -*-
"""
WebSocket Server - Real-time Device Communication

WebSocket server for real-time communication between devices.

Port: 58923 (same as HTTP server)

Features:
- Real-time device status updates
- Primary device notifications
- Bidirectional communication
- Auto-reconnect support
"""

import asyncio
import json
import time
from typing import Set, Dict, Optional, Callable

from pycore.pyfoundations.third_party import websockets

WebSocketServerProtocol = websockets.server.WebSocketServerProtocol

from .logging_config import setup_logging

logger = setup_logging(__name__)

DEFAULT_WS_PORT = 58923


class WebSocketDeviceServer:
    """
    WebSocket server for real-time device communication.

    Handles WebSocket connections and message broadcasting.
    """

    def __init__(self, port: int = DEFAULT_WS_PORT):
        """
        Initialize WebSocket server.

        Args:
            port: WebSocket server port
        """
        self.port = port
        self.clients: Set[WebSocketServerProtocol] = set()
        self.server = None
        self.loop: Optional[asyncio.AbstractEventLoop] = None

        # Callbacks
        self.on_message: Optional[Callable] = None

    async def start(self):
        """Start WebSocket server."""
        logger.info(f"Starting WebSocket server on port {self.port}")

        self.server = await websockets.serve(
            self.handle_client,
            '0.0.0.0',
            self.port,
            ping_interval=30,
            ping_timeout=10
        )

        logger.info("WebSocket server started")

    async def stop(self):
        """Stop WebSocket server."""
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            logger.info("WebSocket server stopped")

    async def handle_client(self, websocket: WebSocketServerProtocol, path: str):
        """
        Handle WebSocket client connection.

        Args:
            websocket: WebSocket connection
            path: Request path
        """
        # Add client to set
        self.clients.add(websocket)
        client_addr = websocket.remote_address
        logger.info(f"WebSocket client connected: {client_addr}")

        try:
            # Send welcome message
            await websocket.send(json.dumps({
                'type': 'welcome',
                'message': 'Connected to Device Sync WebSocket server',
                'timestamp': time.time()
            }))

            # Handle messages
            async for message in websocket:
                try:
                    data = json.loads(message)
                    logger.debug(f"Received message: {data}")

                    # Trigger callback
                    if self.on_message:
                        try:
                            await self.on_message(websocket, data)
                        except Exception as e:
                            logger.error(f"Message callback error: {e}", exc_info=True)

                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON: {message}")
                except Exception as e:
                    logger.error(f"Message handling error: {e}", exc_info=True)

        except websockets.exceptions.ConnectionClosed:
            logger.info(f"WebSocket client disconnected: {client_addr}")
        except Exception as e:
            logger.error(f"WebSocket error: {e}", exc_info=True)
        finally:
            # Remove client from set
            self.clients.discard(websocket)

    async def broadcast(self, message: dict, exclude: Optional[WebSocketServerProtocol] = None):
        """
        Broadcast message to all connected clients.

        Args:
            message: Message dict to broadcast
            exclude: Optional client to exclude from broadcast
        """
        if not self.clients:
            return

        # Add timestamp
        if 'timestamp' not in message:
            message['timestamp'] = time.time()

        # Serialize message
        message_json = json.dumps(message)

        # Send to all clients
        disconnected = set()
        for client in self.clients:
            if client == exclude:
                continue

            try:
                await client.send(message_json)
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)
            except Exception as e:
                logger.error(f"Broadcast error: {e}")
                disconnected.add(client)

        # Remove disconnected clients
        self.clients -= disconnected

    async def send_to_client(self, websocket: WebSocketServerProtocol, message: dict):
        """
        Send message to specific client.

        Args:
            websocket: Target client
            message: Message dict to send
        """
        # Add timestamp
        if 'timestamp' not in message:
            message['timestamp'] = time.time()

        try:
            await websocket.send(json.dumps(message))
        except Exception as e:
            logger.error(f"Send error: {e}", exc_info=True)


# Standalone server runner (for testing)
async def run_standalone_server():
    """Run standalone WebSocket server for testing."""
    server = WebSocketDeviceServer()

    async def handle_message(websocket, data):
        """Echo messages back."""
        logger.info(f"Received: {data}")
        await server.send_to_client(websocket, {
            'type': 'echo',
            'data': data
        })

    server.on_message = handle_message

    await server.start()

    # Keep running
    try:
        await asyncio.Future()  # Run forever
    except KeyboardInterrupt:
        await server.stop()


if __name__ == '__main__':
    asyncio.run(run_standalone_server())
