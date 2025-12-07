# -*- coding: utf-8 -*-
<<<<<<< HEAD
"""Upload Router - Complete upload management endpoints"""
from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()
from ...controllers.upload import UploadController

router = fastapi.APIRouter(prefix="/api/upload", tags=["Upload Management"])
controller = UploadController()

# ============= Basic Endpoints =============

@router.get("/tasks")
async def get_upload_tasks(status: str = None, limit: int = 50):
    """Get upload tasks list with optional status filter"""
    return controller.get_tasks(status=status, limit=limit)
=======
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
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522

@router.get("/servers")
async def get_servers():
    """Get configured upload servers"""
    return controller.get_servers()
<<<<<<< HEAD

# ============= Progress & Control =============

@router.get("/progress/{upload_id}")
async def get_upload_progress(upload_id: str):
    """Get upload progress for specific task"""
    return controller.get_progress(upload_id)

@router.delete("/cancel/{upload_id}")
async def cancel_upload(upload_id: str):
    """Cancel ongoing upload task"""
    return controller.cancel_task(upload_id)

# ============= History & Stats =============

@router.get("/history")
async def get_upload_history(limit: int = 50):
    """Get upload history records"""
    return controller.get_history(limit=limit)

@router.get("/stats")
async def get_upload_stats():
    """Get upload statistics"""
    return controller.get_stats()

# ============= Server Management =============

@router.post("/servers")
async def add_server(server: dict):
    """Add new upload server"""
    return controller.add_server(server)

@router.put("/servers/{name}")
async def update_server(name: str, updates: dict):
    """Update upload server configuration"""
    return controller.update_server(name, updates)

@router.delete("/servers/{name}")
async def delete_server(name: str):
    """Delete upload server"""
    return controller.delete_server(name)

@router.post("/servers/{name}/test")
async def test_server(name: str):
    """Test server connection"""
    return controller.test_server(name)
=======
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522
