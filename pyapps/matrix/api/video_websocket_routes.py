#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Video WebSocket Routes

Direct WebSocket endpoints for H.264 and YUV video streaming.
These are NOT RPC routes - they are direct WebSocket connections.

Endpoints:
- ws://localhost:48000/video/{device_id} - H.264 streaming
- ws://localhost:48000/video/yuv/{device_id}?hwaccel=cuda - YUV streaming
"""

import sys
import json
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional

from pycore import ColorPrint
from pyapps.matrix.services import VideoStreamService, DeviceIDManager


# Create router for video WebSocket endpoints
router = APIRouter(tags=["Video Streaming"])


@router.websocket("/video/{device_id}")
async def h264_video_stream(websocket: WebSocket, device_id: str):
    """
    H.264 video streaming endpoint (scrcpy_web_test compatible)

    WebSocket endpoint for direct H.264 frame streaming.
    This uses the PROVEN protocol from scrcpy_web_test.

    Args:
        websocket: WebSocket connection
        device_id: Device ID (e.g., "device_1")

    Protocol (from scrcpy_web_test/server.py:375-393):
        [serial_len(1 byte)][serial(N bytes)][pts(8 bytes)][size(4 bytes)][H.264 data]

        pts (8 bytes, big-endian uint64):
            - Bit 63 (0x8000000000000000): is_config frame
            - Bit 62 (0x4000000000000000): is_keyframe
            - Bits 0-61: Presentation timestamp

        size (4 bytes, big-endian uint32): Frame data length
    """
    ColorPrint.blue("=" * 80)
    ColorPrint.blue(f"[VideoWebSocket] H.264 WebSocket connection request")
    ColorPrint.blue(f"  - Device ID: {device_id}")
    ColorPrint.blue(f"  - Client: {websocket.client}")
    ColorPrint.blue("=" * 80)

    # Resolve device_id to serial using DeviceIDManager
    device_id_manager = DeviceIDManager.instance()
    serial = device_id_manager.get_serial(device_id)

    if not serial:
        ColorPrint.red(f"[VideoWebSocket] device_id '{device_id}' not found in DeviceIDManager")
        ColorPrint.red(f"[VideoWebSocket] Current mappings: {device_id_manager.get_all_mappings()}")
        # Fallback: treat device_id as serial directly
        serial = device_id
        ColorPrint.yellow(f"[VideoWebSocket] Fallback: treating device_id as serial: {serial}")

    ColorPrint.blue(f"  - Resolved Serial: {serial}")

    await websocket.accept()
    ColorPrint.green(f"[VideoWebSocket] ✓ WebSocket accepted for {device_id} ({serial})")

    video_service = VideoStreamService.instance()

    # Track which serial this WebSocket is streaming (for cleanup)
    streaming_serial = None

    try:
        # Wait for client commands (FastAPI pattern with exception handling)
        while True:
            # Receive message from client (will raise WebSocketDisconnect on close)
            message = await websocket.receive_text()
            data = json.loads(message)
            command = data.get('command')

            ColorPrint.blue(f"[VideoWebSocket] Received command: {command}")

            if command == 'start_stream':
                # Get device_id from command and resolve to serial
                cmd_device_id = data.get('device_id')
                if not cmd_device_id:
                    ColorPrint.red(f"[VideoWebSocket] Missing device_id in start_stream command")
                    error_msg = {"type": "error", "message": "Missing device_id in start_stream command"}
                    await websocket.send_json(error_msg)
                    break

                # Resolve device_id to serial using DeviceIDManager
                device_id_manager = DeviceIDManager.instance()
                cmd_serial = device_id_manager.get_serial(cmd_device_id)

                if not cmd_serial:
                    ColorPrint.red(f"[VideoWebSocket] device_id '{cmd_device_id}' not found in DeviceIDManager")
                    ColorPrint.red(f"[VideoWebSocket] Current mappings: {device_id_manager.get_all_mappings()}")
                    # Fallback: treat device_id as serial directly
                    cmd_serial = cmd_device_id
                    ColorPrint.yellow(f"[VideoWebSocket] Fallback: treating device_id as serial: {cmd_serial}")

                ColorPrint.blue(f"[VideoWebSocket] Resolved device_id '{cmd_device_id}' -> serial '{cmd_serial}'")
                ColorPrint.green(f"[VideoWebSocket] Starting stream for {cmd_serial}...")

                # Start streaming (creates background task, returns immediately)
                success = await video_service.start_stream(cmd_serial, websocket)

                if success:
                    streaming_serial = cmd_serial  # Track for cleanup
                    # Send stream_started response
                    response = {
                        'type': 'stream_started',
                        'serial': cmd_serial
                    }
                    await websocket.send_json(response)
                    ColorPrint.green(f"[VideoWebSocket] Stream started for {cmd_serial}")
                else:
                    # Error already sent by start_stream
                    ColorPrint.red(f"[VideoWebSocket] Failed to start stream for {cmd_serial}")
                    break
            elif command == 'stop_stream':
                ColorPrint.yellow(f"[VideoWebSocket] Stop command received")
                break
            else:
                ColorPrint.yellow(f"[VideoWebSocket] Unknown command: {command}")
                error_msg = {
                    "type": "error",
                    "message": f"Unknown command: {command}"
                }
                await websocket.send_json(error_msg)

    except WebSocketDisconnect:
        # Normal disconnect - no error, just cleanup
        ColorPrint.blue(f"[VideoWebSocket] Client disconnected normally for {device_id}")

    finally:
        # Always cleanup streaming resources
        if streaming_serial:
            await video_service.stop_stream(streaming_serial, websocket)
            ColorPrint.blue(f"[VideoWebSocket] Cleaned up stream for {streaming_serial}")


@router.websocket("/video/yuv/{device_id}")
async def yuv_video_stream(
    websocket: WebSocket,
    device_id: str,
    hwaccel: Optional[str] = Query(None, description="Hardware acceleration (cuda/qsv/dxva2/vaapi)")
):
    """
    YUV420P video streaming endpoint (WebGL-optimized)

    WebSocket endpoint for YUV streaming with backend FFmpeg decoding.

    Args:
        websocket: WebSocket connection
        device_id: Device ID (e.g., "device_1")
        hwaccel: Hardware acceleration type (optional)
            - cuda: NVIDIA GPU
            - qsv: Intel Quick Sync Video
            - dxva2: DirectX Video Acceleration (Windows)
            - vaapi: Video Acceleration API (Linux)

    Protocol:
        - Initialization: JSON message with video info
        - Frames: Binary YUV data with custom protocol
        - Metadata: JSON message every 60 frames

    Example:
        ws://localhost:48000/video/yuv/device_1
        ws://localhost:48000/video/yuv/device_1?hwaccel=cuda
    """
    ColorPrint.blue("=" * 80)
    ColorPrint.blue(f"[VideoWebSocket] YUV stream connection request")
    ColorPrint.blue(f"  - Device ID: {device_id}")
    ColorPrint.blue(f"  - Client: {websocket.client}")
    ColorPrint.blue(f"  - Hardware Acceleration: {hwaccel or 'None'}")
    ColorPrint.blue("=" * 80)

    # Resolve device_id to serial (or use directly if already serial)
    device_id_manager = DeviceIDManager.instance()
    serial = device_id_manager.get_serial(device_id)

    # If not found in mapping, treat device_id as serial directly
    if not serial:
        ColorPrint.yellow(f"[VideoWebSocket] device_id '{device_id}' not in mapping, treating as serial")
        serial = device_id

    ColorPrint.blue(f"  - Resolved Serial: {serial}")

    await websocket.accept()
    ColorPrint.green(f"[VideoWebSocket] ✓ YUV WebSocket accepted for {device_id} ({serial})")

    video_service = VideoStreamService.instance()
    await video_service.stream_yuv_to_websocket(serial, websocket, hwaccel=hwaccel)


# Export router
__all__ = ['router']
