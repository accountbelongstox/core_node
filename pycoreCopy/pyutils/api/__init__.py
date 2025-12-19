"""
pyutils.api - FastAPI utility module

Features:
- WebSocket connection management
- Connection grouping (by device serial, etc.)
- Broadcast messaging
- Automatic cleanup of disconnected connections
- Thread-safe operations

Dependencies:
- Standard library: typing, asyncio
- Third-party: fastapi

Characteristics:
- Generic tools (not business-specific)
- Easy to use in any FastAPI project
- Async/await support

Example:
    from fastapi import FastAPI, WebSocket
    from pycore.pyutils.api import WebSocketManager

    app = FastAPI()
    ws_manager = WebSocketManager()

    @app.websocket("/ws/{device_id}")
    async def websocket_endpoint(websocket: WebSocket, device_id: str):
        await ws_manager.connect(device_id, websocket)

        try:
            while True:
                data = await websocket.receive_bytes()
                # Broadcast to all connections of this device
                await ws_manager.broadcast(device_id, data)
        except:
            await ws_manager.disconnect(device_id, websocket)
"""

from .websocket_manager import WebSocketManager

__all__ = [
    'WebSocketManager'
]

__version__ = '1.0.0'
