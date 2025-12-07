# -*- coding: utf-8 -*-
"""Client Router - Remote server forwarding and management"""
from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()
from ...controllers.client import ClientController

router = fastapi.APIRouter(prefix="/api/client", tags=["Remote Client"])
controller = ClientController()

# ============= Request Forwarding =============

@router.post("/forward")
async def forward_request(endpoint: str, method: str = "POST", data: dict = None):
    """Forward request to remote server"""
    return controller.forward(endpoint, method, data)

@router.post("/encode-request")
async def encode_request(data: dict):
    """Encode request data for URL transmission"""
    return controller.encode_request(data)

# ============= Connection Status =============

@router.get("/connection-status")
async def get_connection_status():
    """Get connection status to remote servers"""
    return controller.get_connection_status()

@router.post("/test-connection/{name}")
async def test_connection(name: str):
    """Test connection to specific server"""
    return controller.test_connection(name)

# ============= Server Configuration Management =============

@router.get("/server-config")
async def get_server_config():
    """Get all server configurations"""
    return controller.get_server_config()

@router.post("/server-config")
async def add_server(server: dict):
    """Add new server configuration"""
    return controller.add_server(server)

@router.put("/server-config/{name}")
async def update_server(name: str, updates: dict):
    """Update server configuration"""
    return controller.update_server(name, updates)

@router.delete("/server-config/{name}")
async def delete_server(name: str):
    """Delete server configuration"""
    return controller.delete_server(name)
