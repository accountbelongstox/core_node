# -*- coding: utf-8 -*-
"""
Local Config Router - Local processing configuration endpoints
"""

from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()

from ...controllers.management import LocalProcessingController
from ...models.management.local_processing_models import LocalProcessingConfig

APIRouter = fastapi.APIRouter
router = APIRouter(prefix="/api/manage/local", tags=["Local Processing Management"])

# Initialize controller
controller = LocalProcessingController()


@router.get("/config", response_model=LocalProcessingConfig)
async def get_config():
    """
    Get local processing configuration.

    Returns configuration for:
    - Screenshot settings (format, quality, hotkey)
    - OCR settings (engine, language, threshold, GPU)
    - Audio settings (engine, model, language, device)
    - Video settings (format, compression)
    - Upload settings (auto-upload, server URL, retry)
    """
    return controller.get_config()


@router.post("/config")
async def update_config(config: LocalProcessingConfig):
    """
    Update local processing configuration.

    Args:
        config: New local processing configuration to apply

    Returns:
        Success status and updated configuration
    """
    return controller.update_config(config)
