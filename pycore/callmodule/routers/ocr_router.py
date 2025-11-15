# -*- coding: utf-8 -*-
"""
OCR Router - Direct OCR API endpoints

Provides direct API endpoints for OCR operations without needing to pass module paths.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

# Import OCR manager from pyutils
try:
    from pycore.pyutils import ocr_manager, OCR_AVAILABLE
except Exception as e:
    ocr_manager = None
    OCR_AVAILABLE = False

ocr_router = APIRouter(prefix="/ocr", tags=["OCR"])


class OCRResponse(BaseModel):
    """Base OCR response"""
    success: bool
    result: Optional[dict] = None
    error: Optional[str] = None


@ocr_router.get("/models", response_model=OCRResponse)
async def get_available_models():
    """
    Get all available OCR models.

    Returns:
        OCRResponse: Available OCR models and their configurations
    """
    if not OCR_AVAILABLE or ocr_manager is None:
        raise HTTPException(status_code=503, detail="OCR service not available")

    try:
        models = ocr_manager.get_available_models()
        return OCRResponse(success=True, result=models)
    except Exception as e:
        return OCRResponse(success=False, error=str(e))


@ocr_router.get("/models/{model_type}", response_model=OCRResponse)
async def get_model_info(model_type: str):
    """
    Get information about a specific OCR model.

    Args:
        model_type: Model type (e.g., 'scene', 'doc', 'number')

    Returns:
        OCRResponse: Model information
    """
    if not OCR_AVAILABLE or ocr_manager is None:
        raise HTTPException(status_code=503, detail="OCR service not available")

    try:
        info = ocr_manager.get_model_info(model_type)
        return OCRResponse(success=True, result=info)
    except Exception as e:
        return OCRResponse(success=False, error=str(e))


@ocr_router.get("/models/{model_type}/loaded", response_model=OCRResponse)
async def check_model_loaded(model_type: str):
    """
    Check if a model is currently loaded.

    Args:
        model_type: Model type to check

    Returns:
        OCRResponse: Whether the model is loaded
    """
    if not OCR_AVAILABLE or ocr_manager is None:
        raise HTTPException(status_code=503, detail="OCR service not available")

    try:
        is_loaded = ocr_manager.is_model_loaded(model_type)
        return OCRResponse(success=True, result={"loaded": is_loaded})
    except Exception as e:
        return OCRResponse(success=False, error=str(e))


@ocr_router.get("/status", response_model=OCRResponse)
async def get_ocr_status():
    """
    Get OCR service status.

    Returns:
        OCRResponse: OCR service availability and loaded models
    """
    if not OCR_AVAILABLE or ocr_manager is None:
        return OCRResponse(
            success=False,
            result={"available": False, "error": "OCR service not available"}
        )

    try:
        # Get all available models
        available_models = ocr_manager.get_available_models()

        # Check which models are loaded
        loaded_models = []
        for model_type in available_models.get('available_model_types', []):
            if ocr_manager.is_model_loaded(model_type):
                loaded_models.append(model_type)

        return OCRResponse(
            success=True,
            result={
                "available": True,
                "available_models": available_models.get('available_model_types', []),
                "loaded_models": loaded_models
            }
        )
    except Exception as e:
        return OCRResponse(success=False, error=str(e))
