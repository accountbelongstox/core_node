"""
Unified WebSocket endpoint compliant with FRONTEND_API_SPECIFICATION.md

Single endpoint: /ws
Command-driven architecture using JSON commands to distinguish operations
Supports:
- start_stream / stop_stream
- touch_event
- Binary frame broadcasting (H.264 video data)
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import json
import struct
import asyncio
from typing import Dict, Set, Optional
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState

from pycore import ColorPrint
from pycore.pyutils.api import WebSocketManager
from pyapps.matrix.services import DeviceService, VideoStreamService, ControlService

router = APIRouter(tags=["websocket"])

# WebSocket connection manager
ws_manager = WebSocketManager()

# Track which clients are subscribed to which device streams
device_subscribers: Dict[str, Set[WebSocket]] = {}


def create_message(msg_type: str, data: dict, serial: Optional[str] = None) -> str:
    """
    Create WebSocket JSON message

    Args:
        msg_type: Message type
        data: Message data
        serial: Optional device serial

    Returns:
        JSON string
    """
    message = {
        "type": msg_type,
        "timestamp": int(datetime.now().timestamp() * 1000)
    }

    if serial:
        message["serial"] = serial

    if data:
        message.update(data)

    return json.dumps(message)


async def broadcast_binary_frame(serial: str, frame_data: bytes, pts: int, is_config: bool, is_keyframe: bool):
    """
    Broadcast binary video frame to all subscribers of a device

    Frame format (per FRONTEND_API_SPECIFICATION.md):
    +-------------------+------------------+------------------+------------------+------------------+
    | Serial Length (1) | Serial (N bytes) | PTS (8 bytes)    | Size (4 bytes)   | H.264 Data (N)   |
    +-------------------+------------------+------------------+------------------+------------------+

    PTS flags:
    - Bit 63: CONFIG_FRAME (SPS/PPS)
    - Bit 62: KEY_FRAME (I-frame)
    - Bits 0-61: Actual PTS

    Args:
        serial: Device serial number
        frame_data: H.264 raw data
        pts: Presentation timestamp
        is_config: Is config frame (SPS/PPS)
        is_keyframe: Is keyframe (I-frame)
    """
    if serial not in device_subscribers or not device_subscribers[serial]:
        return

    # Encode serial
    serial_bytes = serial.encode('utf-8')
    serial_length = len(serial_bytes)

    # Set PTS flags
    FLAG_CONFIG_FRAME = 0x8000000000000000
    FLAG_KEY_FRAME = 0x4000000000000000
    PTS_MASK = 0x3FFFFFFFFFFFFFFF

    pts_with_flags = pts & PTS_MASK
    if is_config:
        pts_with_flags |= FLAG_CONFIG_FRAME
    if is_keyframe:
        pts_with_flags |= FLAG_KEY_FRAME

    # Pack binary frame
    frame_size = len(frame_data)
    header = struct.pack(">BQI", serial_length, pts_with_flags, frame_size)
    payload = header + serial_bytes + frame_data

    # Broadcast to all subscribers
    dead_connections = []
    for websocket in device_subscribers[serial]:
        if websocket.client_state != WebSocketState.CONNECTED:
            dead_connections.append(websocket)
            continue

        await websocket.send_bytes(payload)

    # Clean up dead connections
    for ws in dead_connections:
        device_subscribers[serial].discard(ws)


async def start_stream_for_device(serial: str, websocket: WebSocket, enable_recording: bool = False):
    """
    Start video stream for a device

    Args:
        serial: Device serial number
        websocket: WebSocket connection
        enable_recording: Enable MP4 recording

    Returns:
        Response message dict
    """
    device_service = DeviceService.instance()

    # Check if device is connected
    if not device_service.is_connected(serial):
        ColorPrint.red(f"[WS] Device {serial} not connected")
        return {
            "type": "stream_error",
            "serial": serial,
            "message": f"Failed to start stream for {serial}"
        }

    # Add subscriber
    if serial not in device_subscribers:
        device_subscribers[serial] = set()

    device_subscribers[serial].add(websocket)

    # Get device info
    device_info = await device_service.get_device_info(serial)

    if not device_info:
        ColorPrint.red(f"[WS] Cannot get device info for {serial}")
        return {
            "type": "stream_error",
            "serial": serial,
            "message": f"Cannot get device info for {serial}"
        }

    # Determine if this is a new stream or attach to existing
    is_new_stream = len(device_subscribers[serial]) == 1

    response_type = "stream_started" if is_new_stream else "stream_attached"

    response = {
        "type": response_type,
        "serial": serial,
        "info": {
            "serial": device_info.serial,
            "model": device_info.model,
            "resolution": {
                "width": device_info.resolution.width,
                "height": device_info.resolution.height
            },
            "dpi": device_info.dpi,
            "android_version": device_info.android_version,
            "sdk_version": device_info.sdk_version
        }
    }

    ColorPrint.green(f"[WS] {response_type} for {serial}")
    return response


async def stop_stream_for_device(serial: str, websocket: WebSocket):
    """
    Stop video stream for a device

    Args:
        serial: Device serial number
        websocket: WebSocket connection

    Returns:
        Response message dict
    """
    if serial not in device_subscribers:
        return {
            "type": "stream_error",
            "serial": serial,
            "message": f"Device {serial} not streaming"
        }

    # Remove subscriber
    device_subscribers[serial].discard(websocket)

    # Check if there are still subscribers
    if len(device_subscribers[serial]) == 0:
        # No more subscribers - stop stream completely
        del device_subscribers[serial]
        ColorPrint.yellow(f"[WS] stream_stopped for {serial} (no more subscribers)")
        return {
            "type": "stream_stopped",
            "serial": serial
        }
    else:
        # Other subscribers still exist
        ColorPrint.yellow(f"[WS] stream_detached for {serial} (other subscribers remain)")
        return {
            "type": "stream_detached",
            "serial": serial
        }


async def handle_touch_event(serial: str, touch_data: dict):
    """
    Handle touch event

    Args:
        serial: Device serial number
        touch_data: Touch event data with action, x, y, pressure, pointerId

    Returns:
        Response message dict or None
    """
    device_service = DeviceService.instance()

    if not device_service.is_connected(serial):
        return {
            "type": "error",
            "serial": serial,
            "message": "Device is not streaming"
        }

    # Validate touch data
    required_fields = ["action", "x", "y"]
    for field in required_fields:
        if field not in touch_data:
            return {
                "type": "error",
                "serial": serial,
                "message": f"Invalid touch payload: missing {field}"
            }

    # Send touch event via control service
    control_service = ControlService.instance()
    success = await control_service.send_touch_event(serial, touch_data)

    if not success:
        return {
            "type": "error",
            "serial": serial,
            "message": "Failed to send touch event"
        }

    # Touch events don't need explicit response (fire and forget)
    return None


@router.websocket("/ws")
async def unified_websocket_endpoint(websocket: WebSocket):
    """
    Unified WebSocket endpoint (API Specification compliant)

    Endpoint: ws://localhost:8000/ws

    Supports commands:
    - start_stream: Start video stream for device
    - stop_stream: Stop video stream for device
    - touch_event: Send touch event to device

    Binary frames:
    - H.264 video data with header (serial, PTS, size)
    """
    await websocket.accept()

    connection_id = f"ws_{id(websocket)}"
    ColorPrint.green(f"[WS] Client connected: {connection_id}")

    # Register connection
    await ws_manager.connect(connection_id, websocket)

    # Track subscribed devices for this connection
    subscribed_devices: Set[str] = set()

    # Main message loop
    while websocket.client_state == WebSocketState.CONNECTED:
        # Check if websocket is still connected before receiving
        if websocket.client_state != WebSocketState.CONNECTED:
            break

        data = await websocket.receive()

        # Check for disconnect message
        if "type" in data and data["type"] == "websocket.disconnect":
            ColorPrint.yellow(f"[WS] Received disconnect message for {connection_id}")
            break

        # Handle text messages (JSON commands)
        if "text" in data:
            message = json.loads(data["text"])
            command = message.get("command")

            if command == "start_stream":
                serial = message.get("serial")
                enable_recording = message.get("enable_recording", False)

                if not serial:
                    await websocket.send_text(create_message("error", {
                        "message": "Missing serial parameter"
                    }))
                    continue

                # Start stream
                response = await start_stream_for_device(serial, websocket, enable_recording)
                await websocket.send_text(json.dumps(response))

                # Track subscription
                subscribed_devices.add(serial)

            elif command == "stop_stream":
                serial = message.get("serial")

                if not serial:
                    await websocket.send_text(create_message("error", {
                        "message": "Missing serial parameter"
                    }))
                    continue

                # Stop stream
                response = await stop_stream_for_device(serial, websocket)
                await websocket.send_text(json.dumps(response))

                # Remove from subscriptions
                subscribed_devices.discard(serial)

            elif command == "touch_event":
                serial = message.get("serial")

                if not serial:
                    await websocket.send_text(create_message("error", {
                        "message": "Missing serial parameter"
                    }))
                    continue

                # Extract touch data
                touch_data = {
                    "action": message.get("action"),
                    "x": message.get("x"),
                    "y": message.get("y"),
                    "pressure": message.get("pressure", 1.0),
                    "pointerId": message.get("pointerId", 0)
                }

                # Handle touch event
                response = await handle_touch_event(serial, touch_data)
                if response:
                    await websocket.send_text(json.dumps(response))

            else:
                await websocket.send_text(create_message("error", {
                    "message": f"Invalid command: {command}"
                }))

    # Cleanup on disconnect
    ColorPrint.yellow(f"[WS] Client disconnected: {connection_id}")

    # Unsubscribe from all devices
    for serial in subscribed_devices:
        if serial in device_subscribers:
            device_subscribers[serial].discard(websocket)
            if len(device_subscribers[serial]) == 0:
                del device_subscribers[serial]

    await ws_manager.disconnect(connection_id, websocket)
