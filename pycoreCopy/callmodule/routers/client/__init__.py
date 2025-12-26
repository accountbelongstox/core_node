# -*- coding: utf-8 -*-
"""Client Router"""
from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()
from ...controllers.client import ClientController
router = fastapi.APIRouter(prefix="/api/client", tags=["Remote Client"])
controller = ClientController()

@router.post("/forward")
async def forward_request(endpoint: str, method: str = "POST", data: dict = None):
    """Forward request to remote server"""
    return controller.forward(endpoint, method, data)

@router.get("/connection-status")
async def get_connection_status():
    """Get connection status to remote server"""
    return controller.get_connection_status()
