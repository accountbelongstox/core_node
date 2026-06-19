# -*- coding: utf-8 -*-
"""
Code Sync Router - FastAPI endpoints for code synchronization

Provides HTTP endpoints for code sync server/client communication.
Mounted at /code-sync/*
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
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
    received_count: Optional[int] = 0  # Number of files client received
    skipped_count: Optional[int] = 0   # Number of files client skipped


class ChangesResponse(BaseModel):
    success: bool
    files: List[Dict]


class DownloadRequest(BaseModel):
    client_id: str
    file_path: str  # Relative file path


# Peer mesh request models
class PeerConfigRequest(BaseModel):
    peers: List[Dict]
    version: int
    updated_at: float


class PeerAddRequest(BaseModel):
    name: str
    host: str
    port: int = 59000
    role: str = "client"


class PeerRemoveRequest(BaseModel):
    id: str


class PeerUpdateRequest(BaseModel):
    id: str
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    role: Optional[str] = None


class RoleRequest(BaseModel):
    role: str


class DistributeRequest(BaseModel):
    enabled: bool


class SkipUpdateRequest(BaseModel):
    enabled: bool


# Endpoints

@router.get("/ping")
async def ping():
    """Ping endpoint for server discovery"""
    return {"status": "ok", "service": "code-sync"}


@router.post("/register", response_model=RegisterResponse)
async def register_client(request: RegisterRequest, http_request: Request):
    """
    Register a client connection

    Returns whether client needs initial sync
    """
    from pycore.pyutils.codesync import get_code_sync_manager

    manager = get_code_sync_manager()

    if not manager.is_server_mode():
        raise HTTPException(status_code=503, detail="Not in server mode")

    server = manager.get_server()
    if not server:
        raise HTTPException(status_code=503, detail="Server not available")

    # Extract client IP from request
    client_ip = http_request.client.host if http_request.client else "unknown"

    needs_initial_sync = server.register_client(request.client_id, client_ip)

    return RegisterResponse(
        success=True,
        needs_initial_sync=needs_initial_sync,
        message=f"Client registered: {request.client_id}"
    )


@router.post("/initial-sync", response_model=InitialSyncResponse)
async def initial_sync(request: InitialSyncRequest):
    """Get all files for initial sync"""
    from pycore.pyutils.codesync import get_code_sync_manager

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


@router.post("/changes", response_model=ChangesResponse)
async def get_changes(request: ChangesRequest):
    """Get changed files for incremental sync"""
    from pycore.pyutils.codesync import get_code_sync_manager

    manager = get_code_sync_manager()

    if not manager.is_server_mode():
        raise HTTPException(status_code=503, detail="Not in server mode")

    server = manager.get_server()
    if not server:
        raise HTTPException(status_code=503, detail="Server not available")

    # Update client statistics if provided
    if request.received_count > 0 or request.skipped_count > 0:
        server.update_client_stats(
            request.client_id,
            received_count=request.received_count,
            skipped_count=request.skipped_count
        )

    files = server.get_changed_files(request.client_id)

    return ChangesResponse(
        success=True,
        files=files
    )


@router.get("/status")
async def get_status():
    """Get full code sync status (role, distributing, peers, version)."""
    from pycore.pyutils.codesync import get_code_sync_manager

    return get_code_sync_manager().get_status()


# ---- Peer mesh endpoints ---------------------------------------------------- #

@router.get("/peer/status")
async def peer_status():
    """
    Lightweight self status, probed frequently by other peers on every mesh tick.

    Must be fast and never raise - returns a minimal dict on any error.
    """
    try:
        from pycore.pyutils.codesync import get_code_sync_manager
        return get_code_sync_manager().get_local_peer_status()
    except Exception as exc:
        return {"role": "client", "distributing": False, "error": str(exc)}


@router.post("/peer/config")
async def peer_config(request: PeerConfigRequest):
    """Apply a replicated peer-config update from another peer (last-writer-wins)."""
    from pycore.pyutils.codesync import get_code_sync_manager

    manager = get_code_sync_manager()
    return manager.apply_remote_config(request.peers, request.version, request.updated_at)


@router.post("/peer/heartbeat")
async def peer_heartbeat(request: Request):
    """Inbound presence: a peer (often behind NAT) reports its own status here. We
    record it and return our current peer-config so the sender converges (LWW)."""
    from pycore.pyutils.codesync import get_code_sync_manager

    try:
        payload = await request.json()
    except Exception:
        payload = {}
    src = request.client.host if request.client else None
    return get_code_sync_manager().receive_heartbeat(payload, src)


@router.get("/peers")
async def get_peers():
    """Get the current peer list (self + peers + config version)."""
    from pycore.pyutils.codesync import get_code_sync_manager

    return get_code_sync_manager().get_peers()


@router.get("/settings")
async def get_sync_settings():
    """Filter settings (excluded dirs/files/extensions/path-substrings + gitignore):
    code presets overlaid by the per-machine .data override."""
    from pycore.pyutils.codesync import get_code_sync_manager

    return get_code_sync_manager().get_sync_settings()


@router.post("/settings")
async def set_sync_settings(request: Request):
    """Update filter settings; the patch is written to the per-machine override."""
    from pycore.pyutils.codesync import get_code_sync_manager

    try:
        patch = await request.json()
    except Exception:
        patch = {}
    return get_code_sync_manager().set_sync_settings(patch or {})


@router.post("/settings/reset")
async def reset_sync_settings():
    """Drop the per-machine override -> back to the code presets."""
    from pycore.pyutils.codesync import get_code_sync_manager

    return get_code_sync_manager().reset_sync_settings()


@router.get("/logs")
async def get_sync_logs(limit: int = 100):
    """Recent sync activity for the UI log panel."""
    from pycore.pyutils.codesync import get_code_sync_manager

    return get_code_sync_manager().get_sync_logs(limit)


@router.get("/file-tree")
async def get_file_tree():
    """Nested file tree of the live synced set (for the UI file-structure panel)."""
    from pycore.pyutils.codesync import get_code_sync_manager

    return get_code_sync_manager().get_file_tree()


@router.get("/peer-file-tree")
async def get_peer_file_tree(peer_id: str):
    """Dev-side view of a specific client's received tree + drift summary vs this
    dev's synced set (compared by canonical content hash)."""
    from pycore.pyutils.codesync import get_code_sync_manager

    if not peer_id:
        raise HTTPException(status_code=400, detail="peer_id required")
    return get_code_sync_manager().get_peer_file_tree(peer_id)


@router.post("/peers/add")
async def add_peer(request: PeerAddRequest):
    """Add a peer to the committed config (replicated across the mesh)."""
    from pycore.pyutils.codesync import get_code_sync_manager

    manager = get_code_sync_manager()
    return manager.add_peer(request.name, request.host, request.port, request.role)


@router.post("/peers/remove")
async def remove_peer(request: PeerRemoveRequest):
    """Remove a peer from the committed config (replicated across the mesh)."""
    from pycore.pyutils.codesync import get_code_sync_manager

    manager = get_code_sync_manager()
    return manager.remove_peer(request.id)


@router.post("/peers/update")
async def update_peer(request: PeerUpdateRequest):
    """Update fields of an existing peer (replicated across the mesh)."""
    from pycore.pyutils.codesync import get_code_sync_manager

    fields = request.dict(exclude_none=True)
    fields.pop("id", None)
    manager = get_code_sync_manager()
    return manager.update_peer(request.id, fields)


@router.post("/role")
async def set_role(request: RoleRequest):
    """Set this machine's role ('dev' or 'client'); replicated across the mesh."""
    from pycore.pyutils.codesync import get_code_sync_manager

    manager = get_code_sync_manager()
    return {"success": True, "role": manager.set_role(request.role)}


@router.post("/distribute")
async def set_distribute(request: DistributeRequest):
    """Enable/disable code distribution (dev only; OFF by default each startup)."""
    from pycore.pyutils.codesync import get_code_sync_manager

    manager = get_code_sync_manager()
    return manager.set_distributing(request.enabled)


@router.post("/skip-update")
async def set_skip_update(request: SkipUpdateRequest):
    """Temporarily reject (skip) incoming code updates on this client; the status
    mesh keeps running so peers still see this node and its skip state."""
    from pycore.pyutils.codesync import get_code_sync_manager

    manager = get_code_sync_manager()
    return manager.set_skip_update(request.enabled)


@router.post("/discover")
async def discover():
    """Discover candidate peers on the LAN."""
    from pycore.pyutils.codesync import get_code_sync_manager

    return get_code_sync_manager().discover()


@router.post("/set-server")
async def set_server_mode():
    """Deprecated: use POST /role {role:'dev'}. Kept via back-compat shims."""
    from pycore.pyutils.codesync import get_code_sync_manager

    manager = get_code_sync_manager()
    manager.set_server_mode()

    return {"success": True, "message": "Switched to server mode"}


@router.post("/set-client")
async def set_client_mode():
    """Deprecated: use POST /role {role:'client'}. Kept via back-compat shims."""
    from pycore.pyutils.codesync import get_code_sync_manager

    manager = get_code_sync_manager()
    manager.set_client_mode()

    return {"success": True, "message": "Switched to client mode"}


@router.post("/stop")
async def stop_sync():
    """Deprecated: use POST /distribute {enabled:false}. Kept via back-compat shims."""
    from pycore.pyutils.codesync import get_code_sync_manager

    manager = get_code_sync_manager()
    manager.stop()

    return {"success": True, "message": "Code sync stopped"}


@router.post("/download")
async def download_file(request: DownloadRequest):
    """Download file content from server"""
    from pycore.pyutils.codesync import get_code_sync_manager

    manager = get_code_sync_manager()

    if not manager.is_server_mode():
        raise HTTPException(status_code=503, detail="Not in server mode")

    server = manager.get_server()
    if not server:
        raise HTTPException(status_code=503, detail="Server not available")

    # Normalize file path - convert Windows backslashes to forward slashes
    normalized_path = request.file_path.replace('\\', '/')

    # Contain the read strictly under root_dir: reject "../" traversal and absolute
    # paths (pathlib drops the left side when the right is absolute, which would
    # otherwise serve any file on disk to an unauthenticated peer).
    from pathlib import Path
    base = Path(server.root_dir).resolve()
    try:
        file_path = (base / normalized_path).resolve()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    if file_path != base and base not in file_path.parents:
        raise HTTPException(status_code=400, detail="Invalid path")

    if not file_path.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {normalized_path}")

    # Read file content
    with open(file_path, 'rb') as f:
        content = f.read()

    # Return file content
    return Response(content=content, media_type='application/octet-stream')


@router.post("/toggle-backup")
async def toggle_backup(request: Dict):
    """Toggle backup setting for client"""
    from pycore.pyutils.codesync import get_code_sync_manager

    manager = get_code_sync_manager()

    if not manager.is_client_mode():
        raise HTTPException(status_code=503, detail="Not in client mode")

    client = manager.get_client()
    if not client:
        raise HTTPException(status_code=503, detail="Client not available")

    # Toggle backup setting
    enabled = request.get('enabled', True)
    client.enable_backup = enabled

    ColorPrint.blue(f"[CodeSync] Backup {('enabled' if enabled else 'disabled')}")

    return {"success": True, "enabled": enabled}
