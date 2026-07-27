# -*- coding: utf-8 -*-
"""Upload Router"""
from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()
from ...controllers.upload import UploadController
router = fastapi.APIRouter(prefix="/api/upload", tags=["Upload Management"])
controller = UploadController()

@router.get("/tasks")
async def get_upload_tasks():
    """Get current upload tasks"""
    return controller.get_tasks()

@router.get("/servers")
async def get_servers():
    """Get configured upload servers"""
    return controller.get_servers()
