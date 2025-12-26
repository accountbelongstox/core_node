#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Log WebSocket Routes

WebSocket endpoint for real-time log streaming to frontend.
"""

from fastapi import WebSocket, WebSocketDisconnect
from fastapi.routing import APIRouter

from pyapps.okx_price_monitor.services.log_broadcaster import get_log_broadcaster


# Create router for WebSocket routes
router = APIRouter()


@router.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket):
    """
    WebSocket endpoint for real-time log streaming

    Clients connect to this endpoint to receive real-time logs
    from the OKX system initialization and monitoring.

    URL: ws://localhost:58888/ws/logs
    """
    await websocket.accept()

    broadcaster = get_log_broadcaster()

    # Start broadcaster if not running
    await broadcaster.start()

    # Register this client
    await broadcaster.register_client(websocket)

    try:
        # Keep connection alive and handle client messages
        while True:
            # Wait for messages from client (mostly just keep-alive)
            data = await websocket.receive_text()

            # Echo back for keep-alive
            if data == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        print("[LogWebSocket] Client disconnected normally")
    except Exception as e:
        print(f"[LogWebSocket] Error: {e}")
    finally:
        # Unregister client
        await broadcaster.unregister_client(websocket)
