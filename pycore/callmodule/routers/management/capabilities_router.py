# -*- coding: utf-8 -*-
"""
Capabilities Router - Local processing capabilities endpoint
"""

from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()

from ...controllers.management import LocalProcessingController
from ...models.management.local_processing_models import LocalCapabilities

APIRouter = fastapi.APIRouter
router = APIRouter(prefix="/api/manage/local", tags=["Local Processing Management"])

# Initialize controller
controller = LocalProcessingController()


@router.get("/capabilities", response_model=LocalCapabilities)
async def get_capabilities():
    """
    Get local processing capabilities.

    Returns detailed information about:
    - Hardware capabilities (CPU, GPU, Memory)
    - Processing capabilities (Screenshot, OCR, Audio, Video)
    - Available engines and models
    - Supported formats
    """
    return controller.get_capabilities()
