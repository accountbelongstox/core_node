# -*- coding: utf-8 -*-
"""
Singleton Control Router - RPC v2 endpoints for singleton management

Provides HTTP endpoints for querying and controlling singleton instances:
- Query status (busy/idle)
- Request graceful shutdown
- Check if can shutdown

Integrated with THREAD_BUS for global state management.

Usage:
    from pycore.callmodule.routers.singleton_router import singleton_router

    app.include_router(singleton_router)

    # Query status
    curl -X POST http://localhost:59000/singleton/status

    # Request shutdown
    curl -X POST http://localhost:59000/singleton/shutdown
"""

from typing import Dict, Any
from pycore.pyfoundations.third_party import get_third_package_fastapi

fastapi = get_third_package_fastapi()
APIRouter = fastapi.APIRouter

from pycore import THREAD_BUS, ColorPrint

# Create router with /singleton prefix
singleton_router = APIRouter(prefix="/singleton", tags=["Singleton Control"])


# ============================================================
# Singleton Status Endpoints
# ============================================================

@singleton_router.post("/status")
async def get_singleton_status(params: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Get current singleton instance status

    Returns application state including:
    - busy: Whether application is processing tasks
    - busy_reason: Reason for busy state
    - can_shutdown: Whether shutdown is allowed

    Returns:
        {
            "success": true,
            "busy": false,
            "busy_reason": "",
            "can_shutdown": true,
            "message": "Application is idle"
        }

    Example:
        curl -X POST http://localhost:59000/singleton/status
    """
    try:
        is_busy = THREAD_BUS.is_busy()
        busy_reason = THREAD_BUS.get_busy_reason() if is_busy else ""

        return {
            "success": True,
            "busy": is_busy,
            "busy_reason": busy_reason,
            "can_shutdown": not is_busy,
            "message": busy_reason if is_busy else "Application is idle"
        }

    except Exception as e:
        ColorPrint.red(f"[Singleton] Error getting status: {e}")
        return {
            "success": False,
            "error": str(e),
            "busy": False,
            "can_shutdown": True
        }


@singleton_router.post("/can_shutdown")
async def check_can_shutdown(params: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Check if application can shutdown gracefully

    Returns:
        {
            "success": true,
            "can_shutdown": true,
            "reason": "Application is idle"
        }

    Example:
        curl -X POST http://localhost:59000/singleton/can_shutdown
    """
    try:
        is_busy = THREAD_BUS.is_busy()

        return {
            "success": True,
            "can_shutdown": not is_busy,
            "reason": THREAD_BUS.get_busy_reason() if is_busy else "Application is idle"
        }

    except Exception as e:
        ColorPrint.red(f"[Singleton] Error checking shutdown: {e}")
        return {
            "success": False,
            "error": str(e),
            "can_shutdown": True,
            "reason": "Error checking state, allowing shutdown"
        }


@singleton_router.post("/shutdown")
async def request_shutdown(params: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Request graceful shutdown of this instance

    Checks if application is busy:
    - If idle: Accepts shutdown request
    - If busy: Rejects shutdown request

    Args:
        params: {
            "force": false,  # Optional: Force shutdown even if busy
            "reason": ""     # Optional: Reason for shutdown
        }

    Returns:
        {
            "success": true,
            "accepted": true,
            "reason": "Shutdown request accepted"
        }

    Example:
        curl -X POST http://localhost:59000/singleton/shutdown -H "Content-Type: application/json" -d "{}"
    """
    if params is None:
        params = {}

    try:
        force = params.get("force", False)
        reason = params.get("reason", "Remote shutdown request")

        is_busy = THREAD_BUS.is_busy()

        # Check if shutdown is allowed
        if is_busy and not force:
            busy_reason = THREAD_BUS.get_busy_reason()
            ColorPrint.yellow(f"[Singleton] Shutdown rejected: {busy_reason}")
            return {
                "success": True,
                "accepted": False,
                "reason": f"Application is busy: {busy_reason}",
                "busy": True
            }

        # Accept shutdown
        ColorPrint.yellow(f"[Singleton] Shutdown accepted: {reason}")

        # Request shutdown via THREAD_BUS
        # Note: Actual shutdown execution is handled by the application's shutdown handlers
        THREAD_BUS.request_shutdown(reason, execute_handlers=True)

        return {
            "success": True,
            "accepted": True,
            "reason": "Shutdown request accepted",
            "force": force
        }

    except Exception as e:
        ColorPrint.red(f"[Singleton] Error during shutdown: {e}")
        return {
            "success": False,
            "accepted": False,
            "error": str(e)
        }


# ============================================================
# Busy State Management Endpoints
# ============================================================

@singleton_router.post("/set_busy")
async def set_busy_state(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Set application busy state (for debugging/testing)

    Args:
        params: {
            "busy": true,
            "reason": "Processing important task"
        }

    Returns:
        {
            "success": true,
            "busy": true,
            "reason": "Processing important task"
        }

    Note:
        In production, tasks should set busy state directly:
        THREAD_BUS.set_busy(True, "Processing task")

    Example:
        curl -X POST http://localhost:59000/singleton/set_busy -H "Content-Type: application/json" -d '{"busy": true, "reason": "Testing"}'
    """
    try:
        busy = params.get("busy", False)
        reason = params.get("reason", "Manual busy state")

        THREAD_BUS.set_busy(busy, reason)

        ColorPrint.blue(f"[Singleton] Busy state set: {busy} - {reason}")

        return {
            "success": True,
            "busy": busy,
            "reason": reason
        }

    except Exception as e:
        ColorPrint.red(f"[Singleton] Error setting busy state: {e}")
        return {
            "success": False,
            "error": str(e)
        }


__all__ = ['singleton_router']
