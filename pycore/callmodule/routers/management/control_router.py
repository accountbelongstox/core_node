# -*- coding: utf-8 -*-
"""
Control Router - System control operation endpoints
"""

from typing import Optional

from pydantic import BaseModel

from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()

from ...controllers.management import SystemController
from ...models.management.system_models import ControlResponse
from ...platform.startup_manager import get_startup_manager
from ...platform.autostart_target import VALID_TARGETS, VALID_MECHANISMS

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
    """Toggle auto-start on boot/login.

    ``target`` = WHAT to launch (pyservice/launcher/both); ``mechanism`` =
    HOW Linux registers it (xdg/systemd). Both optional: a bare {"enabled": true}
    still validates and falls back to the persisted preference.
    """
    enabled: bool
    target: Optional[str] = None
    mechanism: Optional[str] = None

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
    Startup folder; Linux: an XDG .desktop autostart entry), and where, plus the
    selected target/mechanism and the valid options for each.
    """
    status = get_startup_manager().get_status()
    status.setdefault("targets", list(VALID_TARGETS))
    status.setdefault("mechanisms", list(VALID_MECHANISMS))
    return {"success": True, **status}


@router.post("/autostart")
async def set_autostart(request: AutostartRequest):
    """
    Enable/disable auto-start on boot using the OS-native mechanism.

    ``target`` (pyservice/launcher/both) and ``mechanism`` (Linux: xdg/systemd)
    pick what is launched and how it registers; both fall back to the persisted
    preference when omitted. Enable creates the native startup entry (common/
    all-users location first, per-user fallback); disable removes it.
    """
    manager = get_startup_manager(target=request.target, mechanism=request.mechanism)
    return manager.enable() if request.enabled else manager.disable()
