#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Video WebSocket Routes

Direct WebSocket endpoints for H.264 and YUV video streaming.
These are NOT RPC routes - they are direct WebSocket connections.

Endpoints:
- ws://localhost:48000/video/{serial} - H.264 streaming
- ws://localhost:48000/video/yuv/{serial}?hwaccel=cuda - YUV streaming
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional

from pycore import ColorPrint
from pyapps.matrix.services import VideoStreamService


# Create router for video WebSocket endpoints
router = APIRouter(tags=["Video Streaming"])


@router.websocket("/video/{serial}")
async def h264_video_stream(websocket: WebSocket, serial: str):
    """
    H.264 video streaming endpoint (scrcpy_web_test compatible)

    WebSocket endpoint for direct H.264 frame streaming.
    This uses the PROVEN protocol from scrcpy_web_test.

    Args:
        websocket: WebSocket connection
        serial: Device serial number

    Protocol (from scrcpy_web_test/server.py:375-393):
        [serial_len(1 byte)][serial(N bytes)][pts(8 bytes)][size(4 bytes)][H.264 data]

        pts (8 bytes, big-endian uint64):
            - Bit 63 (0x8000000000000000): is_config frame
            - Bit 62 (0x4000000000000000): is_keyframe
            - Bits 0-61: Presentation timestamp

        size (4 bytes, big-endian uint32): Frame data length
    """
    ColorPrint.blue("=" * 80)
    ColorPrint.blue(f"[VideoWebSocket] H.264 stream connection request received")
    ColorPrint.blue(f"  - Serial: {serial}")
    ColorPrint.blue(f"  - Protocol: scrcpy_web_test compatible")
    ColorPrint.blue(f"  - Client: {websocket.client}")
    ColorPrint.blue("=" * 80)

    try:
        await websocket.accept()
        ColorPrint.green(f"[VideoWebSocket] ✓ H.264 WebSocket accepted for {serial}")
    except Exception as e:
        ColorPrint.red(f"[VideoWebSocket] ✗ Failed to accept WebSocket for {serial}: {e}")
        import traceback
        traceback.print_exc()
        return

    try:
        video_service = VideoStreamService.instance()
        await video_service.stream_to_websocket(serial, websocket)
    except WebSocketDisconnect:
        ColorPrint.yellow(f"[VideoWebSocket] H.264 stream disconnected for {serial}")
    except Exception as e:
        ColorPrint.red(f"[VideoWebSocket] H.264 stream error for {serial}: {e}")
        import traceback
        traceback.print_exc()
        try:
            await websocket.close(code=1011, reason=str(e))
        except:
            pass


@router.websocket("/video/yuv/{serial}")
async def yuv_video_stream(
    websocket: WebSocket,
    serial: str,
    hwaccel: Optional[str] = Query(None, description="Hardware acceleration (cuda/qsv/dxva2/vaapi)")
):
    """
    YUV420P video streaming endpoint (WebGL-optimized)

    WebSocket endpoint for YUV streaming with backend FFmpeg decoding.

    Args:
        websocket: WebSocket connection
        serial: Device serial number
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
        ws://localhost:48000/video/yuv/ABC123
        ws://localhost:48000/video/yuv/ABC123?hwaccel=cuda
    """
    ColorPrint.blue("=" * 80)
    ColorPrint.blue(f"[VideoWebSocket] YUV stream connection request received")
    ColorPrint.blue(f"  - Serial: {serial}")
    ColorPrint.blue(f"  - Hardware Acceleration: {hwaccel or 'None'}")
    ColorPrint.blue(f"  - Client: {websocket.client}")
    ColorPrint.blue("=" * 80)

    try:
        await websocket.accept()
        ColorPrint.green(f"[VideoWebSocket] ✓ YUV WebSocket accepted for {serial}")
    except Exception as e:
        ColorPrint.red(f"[VideoWebSocket] ✗ Failed to accept WebSocket for {serial}: {e}")
        import traceback
        traceback.print_exc()
        return

    try:
        video_service = VideoStreamService.instance()
        await video_service.stream_yuv_to_websocket(serial, websocket, hwaccel=hwaccel)
    except WebSocketDisconnect:
        ColorPrint.yellow(f"[VideoWebSocket] YUV stream disconnected for {serial}")
    except Exception as e:
        ColorPrint.red(f"[VideoWebSocket] YUV stream error for {serial}: {e}")
        import traceback
        traceback.print_exc()
        try:
            await websocket.close(code=1011, reason=str(e))
        except:
            pass


# Export router
__all__ = ['router']
