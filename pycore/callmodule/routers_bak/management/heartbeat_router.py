# -*- coding: utf-8 -*-
"""
Heartbeat Router - PyHeartbeat callback control endpoints

Provides API endpoints to control PyHeartbeat callbacks via interceptor pattern.
Designed for idempotent operation.
"""

from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()

from typing import Dict, Any
from pycore.pyheartbeat import get_heartbeat_system
from pycore import ColorPrint

APIRouter = fastapi.APIRouter
HTTPException = fastapi.HTTPException

# Response models
try:
    from pydantic import BaseModel
except ImportError:
    BaseModel = object


class HeartbeatResponse(BaseModel):
    """Heartbeat operation response"""
    success: bool
    message: str
    callback_name: str
    enabled: bool


class HeartbeatStatsResponse(BaseModel):
    """Heartbeat statistics response"""
    success: bool
    stats: Dict[str, Any]


# Router configuration
router = APIRouter(prefix="/api/heartbeat", tags=["Heartbeat Control"])


@router.post("/enable/{callback_name}", response_model=HeartbeatResponse)
async def enable_callback(callback_name: str):
    """
    Enable heartbeat callback (interceptor allows execution)

    This endpoint enables a previously registered heartbeat callback,
    allowing it to execute on its scheduled interval.

    Idempotent: Calling this multiple times has the same effect as calling once.

    Args:
        callback_name: Name of callback to enable

    Returns:
        Success response with callback state

    Example:
        POST /api/heartbeat/enable/tts_queue_poller
    """
    try:
        heartbeat = get_heartbeat_system()
        if not heartbeat.enable_callback(callback_name):
            raise HTTPException(
                status_code=404,
                detail=f"Callback '{callback_name}' not found",
            )

        ColorPrint.green(f"[HeartbeatAPI] Enabled callback: {callback_name}")

        return HeartbeatResponse(
            success=True,
            message=f"Callback '{callback_name}' enabled successfully",
            callback_name=callback_name,
            enabled=True
        )

    except Exception as e:
        ColorPrint.red(f"[HeartbeatAPI] Failed to enable callback: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/disable/{callback_name}", response_model=HeartbeatResponse)
async def disable_callback(callback_name: str):
    """
    Disable heartbeat callback (interceptor blocks execution)

    This endpoint disables a heartbeat callback, preventing it from
    executing even though the heartbeat system continues running.

    Idempotent: Calling this multiple times has the same effect as calling once.

    Args:
        callback_name: Name of callback to disable

    Returns:
        Success response with callback state

    Example:
        POST /api/heartbeat/disable/tts_queue_poller
    """
    try:
        heartbeat = get_heartbeat_system()
        if not heartbeat.disable_callback(callback_name):
            raise HTTPException(
                status_code=404,
                detail=f"Callback '{callback_name}' not found",
            )

        ColorPrint.yellow(f"[HeartbeatAPI] Disabled callback: {callback_name}")

        return HeartbeatResponse(
            success=True,
            message=f"Callback '{callback_name}' disabled successfully",
            callback_name=callback_name,
            enabled=False
        )

    except Exception as e:
        ColorPrint.red(f"[HeartbeatAPI] Failed to disable callback: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats", response_model=HeartbeatStatsResponse)
async def get_heartbeat_stats():
    """
    Get PyHeartbeat statistics

    Returns detailed statistics about the heartbeat system including:
    - Total ticks
    - Uptime
    - Registered callbacks and their states
    - Execution counts

    Idempotent: This is a read-only operation.

    Returns:
        Heartbeat statistics

    Example:
        GET /api/heartbeat/stats
    """
    try:
        heartbeat = get_heartbeat_system()
        stats = heartbeat.get_stats()

        return HeartbeatStatsResponse(
            success=True,
            stats=stats
        )

    except Exception as e:
        ColorPrint.red(f"[HeartbeatAPI] Failed to get stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{callback_name}")
async def get_callback_status(callback_name: str):
    """
    Get status of a specific callback

    Idempotent: This is a read-only operation.

    Args:
        callback_name: Name of callback to query

    Returns:
        Callback status information

    Example:
        GET /api/heartbeat/status/tts_queue_poller
    """
    try:
        heartbeat = get_heartbeat_system()
        stats = heartbeat.get_stats()

        # Callbacks are nested under stats['heartbeat']['callbacks']
        heartbeat_stats = stats.get('heartbeat', {})
        callbacks = heartbeat_stats.get('callbacks', {})

        if callback_name not in callbacks:
            raise HTTPException(
                status_code=404,
                detail=f"Callback '{callback_name}' not found"
            )

        callback_info = callbacks[callback_name]

        return {
            'success': True,
            'callback_name': callback_name,
            'enabled': callback_info.get('enabled', False),
            'interval': callback_info.get('interval', 0),
            'run_count': callback_info.get('run_count', 0),
            'last_run_tick': callback_info.get('last_run_tick', 0),
            'ticks_until_next': callback_info.get('ticks_until_next', 0)
        }

    except HTTPException:
        raise
    except Exception as e:
        ColorPrint.red(f"[HeartbeatAPI] Failed to get callback status: {e}")
        raise HTTPException(status_code=500, detail=str(e))
