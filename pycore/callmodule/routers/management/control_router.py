# -*- coding: utf-8 -*-
"""
Control Router - System control operation endpoints
"""

from pydantic import BaseModel

from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()

from ...controllers.management import SystemController
from ...models.management.system_models import ControlResponse
from ...platform.startup_manager import get_startup_manager

APIRouter = fastapi.APIRouter
Request = fastapi.Request
HTTPException = fastapi.HTTPException
router = APIRouter(prefix="/api/manage/control", tags=["System Management"])

# Loopback hosts allowed to issue destructive lifecycle actions (stop/restart).
# The RPC server binds 0.0.0.0, so without this guard any host on the LAN — or
# any web page via the CORS-* policy — could stop/restart the backend.
_LOOPBACK_HOSTS = {"127.0.0.1", "::1", "localhost"}


def _require_loopback(request: Request) -> None:
    """Reject destructive lifecycle calls that don't originate from this machine."""
    client = request.client
    host = client.host if client else None
    if host not in _LOOPBACK_HOSTS:
        raise HTTPException(
            status_code=403,
            detail="stop/restart is restricted to loopback (local) callers"
        )


class AutostartRequest(BaseModel):
    """Toggle auto-start on boot/login."""
    enabled: bool

# Initialize controller
controller = SystemController()


@router.post("/restart", response_model=ControlResponse)
async def restart_service(request: Request):
    """
    Restart the service.

    Initiates a graceful restart of the Pycore Module Caller service.
    Loopback-only (see _require_loopback).
    """
    _require_loopback(request)
    return controller.control("restart")


@router.post("/stop", response_model=ControlResponse)
async def stop_service(request: Request):
    """
    Stop the service.

    Initiates a graceful shutdown of the Pycore Module Caller service.
    Loopback-only (see _require_loopback).
    """
    _require_loopback(request)
    return controller.control("stop")


@router.post("/reload-config", response_model=ControlResponse)
async def reload_config():
    """
    Reload configuration.

    Reloads the configuration without restarting the service.
    """
    return controller.control("reload-config")


@router.post("/clear-cache", response_model=ControlResponse)
async def clear_cache():
    """
    Clear cache.

    Clears all cached data and temporary files.
    """
    return controller.control("clear-cache")


@router.get("/autostart")
async def get_autostart():
    """
    Auto-start (boot/login) status.

    Reports whether a native startup entry exists (Windows: a .lnk in the common
    Startup folder; Linux: an XDG .desktop autostart entry), and where.
    """
    return {"success": True, **get_startup_manager().get_status()}


@router.post("/autostart")
async def set_autostart(request: AutostartRequest):
    """
    Enable/disable auto-start on boot using the OS-native mechanism.

    Enable creates the native startup entry (common/all-users location first,
    per-user fallback); disable removes it. Detection is by the entry's existence.
    """
    manager = get_startup_manager()
    return manager.enable() if request.enabled else manager.disable()
