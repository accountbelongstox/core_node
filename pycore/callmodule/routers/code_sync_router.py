# -*- coding: utf-8 -*-
"""
Code Sync Router - FastAPI endpoints for code synchronization

Provides HTTP endpoints for code sync server/client communication.
Mounted at /code-sync/*
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict

from pycore import ColorPrint

router = APIRouter(prefix="/code-sync", tags=["code-sync"])


# Request/Response models
class RegisterRequest(BaseModel):
    client_id: str


class RegisterResponse(BaseModel):
    success: bool
    needs_initial_sync: bool
    message: str


class InitialSyncRequest(BaseModel):
    client_id: str


class InitialSyncResponse(BaseModel):
    success: bool
    files: List[Dict]


class ChangesRequest(BaseModel):
    client_id: str


class ChangesResponse(BaseModel):
    success: bool
    files: List[Dict]


class StatusResponse(BaseModel):
    mode: str  # "server", "client", or "disabled"
    server_status: Optional[Dict] = None
    client_status: Optional[Dict] = None


# Endpoints

@router.get("/ping")
async def ping():
    """Ping endpoint for server discovery"""
    return {"status": "ok", "service": "code-sync"}


@router.post("/register", response_model=RegisterResponse)
async def register_client(request: RegisterRequest):
    """
    Register a client connection

    Returns whether client needs initial sync
    """
    try:
        from pycore.pyutils.device_sync.code_sync_manager import get_code_sync_manager

        manager = get_code_sync_manager()

        if not manager.is_server_mode():
            raise HTTPException(status_code=503, detail="Not in server mode")

        server = manager.get_server()
        if not server:
            raise HTTPException(status_code=503, detail="Server not available")

        # Extract client IP from request
        # Note: In production, use request.client.host
        client_ip = "unknown"

        needs_initial_sync = server.register_client(request.client_id, client_ip)

        return RegisterResponse(
            success=True,
            needs_initial_sync=needs_initial_sync,
            message=f"Client registered: {request.client_id}"
        )

    except HTTPException:
        raise
    except Exception as e:
        ColorPrint.red(f"[CodeSync Router] Error registering client: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/initial-sync", response_model=InitialSyncResponse)
async def initial_sync(request: InitialSyncRequest):
    """Get all files for initial sync"""
    try:
        from pycore.pyutils.device_sync.code_sync_manager import get_code_sync_manager

        manager = get_code_sync_manager()

        if not manager.is_server_mode():
            raise HTTPException(status_code=503, detail="Not in server mode")

        server = manager.get_server()
        if not server:
            raise HTTPException(status_code=503, detail="Server not available")

        files = server.get_initial_sync_files(request.client_id)

        return InitialSyncResponse(
            success=True,
            files=files
        )

    except HTTPException:
        raise
    except Exception as e:
        ColorPrint.red(f"[CodeSync Router] Error in initial sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/changes", response_model=ChangesResponse)
async def get_changes(request: ChangesRequest):
    """Get changed files for incremental sync"""
    try:
        from pycore.pyutils.device_sync.code_sync_manager import get_code_sync_manager

        manager = get_code_sync_manager()

        if not manager.is_server_mode():
            raise HTTPException(status_code=503, detail="Not in server mode")

        server = manager.get_server()
        if not server:
            raise HTTPException(status_code=503, detail="Server not available")

        files = server.get_changed_files(request.client_id)

        return ChangesResponse(
            success=True,
            files=files
        )

    except HTTPException:
        raise
    except Exception as e:
        ColorPrint.red(f"[CodeSync Router] Error getting changes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status", response_model=StatusResponse)
async def get_status():
    """Get code sync status"""
    try:
        from pycore.pyutils.device_sync.code_sync_manager import get_code_sync_manager

        manager = get_code_sync_manager()
        mode = manager.get_mode()

        response = StatusResponse(mode=mode)

        if mode == "server":
            server = manager.get_server()
            if server:
                response.server_status = server.get_status()

        elif mode == "client":
            client = manager.get_client()
            if client:
                response.client_status = client.get_status()

        return response

    except Exception as e:
        ColorPrint.red(f"[CodeSync Router] Error getting status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/set-server")
async def set_server_mode():
    """Switch to server mode"""
    try:
        from pycore.pyutils.device_sync.code_sync_manager import get_code_sync_manager

        manager = get_code_sync_manager()
        manager.set_server_mode()

        return {"success": True, "message": "Switched to server mode"}

    except Exception as e:
        ColorPrint.red(f"[CodeSync Router] Error setting server mode: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/set-client")
async def set_client_mode():
    """Switch to client mode"""
    try:
        from pycore.pyutils.device_sync.code_sync_manager import get_code_sync_manager

        manager = get_code_sync_manager()
        manager.set_client_mode()

        return {"success": True, "message": "Switched to client mode"}

    except Exception as e:
        ColorPrint.red(f"[CodeSync Router] Error setting client mode: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop")
async def stop_sync():
    """Stop code sync (both server and client)"""
    try:
        from pycore.pyutils.device_sync.code_sync_manager import get_code_sync_manager

        manager = get_code_sync_manager()
        manager.stop()

        return {"success": True, "message": "Code sync stopped"}

    except Exception as e:
        ColorPrint.red(f"[CodeSync Router] Error stopping: {e}")
        raise HTTPException(status_code=500, detail=str(e))
