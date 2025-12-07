# -*- coding: utf-8 -*-
"""
Status Router - System status endpoints
"""

from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()

from ...controllers.management import SystemController
from ...models.management.system_models import SystemStatus

APIRouter = fastapi.APIRouter
router = APIRouter(prefix="/api/manage", tags=["System Management"])

# Initialize controller
controller = SystemController()


@router.get("/status", response_model=SystemStatus)
async def get_status():
    """
    Get comprehensive system status.

    Returns system information including:
    - System status and uptime
    - Service status
    - Resource usage
    - Local processing capabilities and statistics
    """
    return controller.get_status()
