# -*- coding: utf-8 -*-
"""
Control Router - System control operation endpoints
"""

from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()

from ...controllers.management import SystemController
from ...models.management.system_models import ControlResponse

APIRouter = fastapi.APIRouter
router = APIRouter(prefix="/api/manage/control", tags=["System Management"])

# Initialize controller
controller = SystemController()


@router.post("/restart", response_model=ControlResponse)
async def restart_service():
    """
    Restart the service.

    Initiates a graceful restart of the Pycore Module Caller service.
    """
    return controller.control("restart")


@router.post("/stop", response_model=ControlResponse)
async def stop_service():
    """
    Stop the service.

    Initiates a graceful shutdown of the Pycore Module Caller service.
    """
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
