# -*- coding: utf-8 -*-
"""
Config Router - System configuration endpoints
"""

from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()

from ...controllers.management import SystemController
from ...models.management.system_models import SystemConfig

APIRouter = fastapi.APIRouter
router = APIRouter(prefix="/api/manage", tags=["System Management"])

# Initialize controller
controller = SystemController()


@router.get("/config", response_model=SystemConfig)
async def get_config():
    """
    Get current system configuration.

    Returns:
    - System-level configuration (debug mode, log level, max connections)
    - Local processing configuration
    """
    return controller.get_config()


@router.post("/config")
async def update_config(config: SystemConfig):
    """
    Update system configuration.

    Args:
        config: New system configuration to apply

    Returns:
        Success status and updated configuration
    """
    return controller.update_config(config)
