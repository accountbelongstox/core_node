# -*- coding: utf-8 -*-
"""Image Router"""
from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()
from ...controllers.local_processing import ImageController
from ...models.local_processing.image_models import ImageOCRRequest, ImageOCRResponse, ImageProcessRequest, ImageProcessResponse

router = fastapi.APIRouter(prefix="/api/local/image", tags=["Local Processing - Image"])
controller = ImageController()

@router.post("/ocr", response_model=ImageOCRResponse)
async def image_ocr(request: ImageOCRRequest):
    """Perform OCR on image"""
    return controller.ocr(request)

@router.post("/process", response_model=ImageProcessResponse)
async def image_process(request: ImageProcessRequest):
    """Process image (resize, compress, convert)"""
    return controller.process(request)
