# -*- coding: utf-8 -*-
"""Screenshot Router"""
from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()
from ...controllers.local_processing import ScreenshotController
from ...models.local_processing.screenshot_models import ScreenshotRequest, ScreenshotResponse

router = fastapi.APIRouter(prefix="/api/local/screenshot", tags=["Local Processing - Screenshot"])
controller = ScreenshotController()

@router.post("/capture", response_model=ScreenshotResponse)
async def capture_screenshot(request: ScreenshotRequest):
    """Capture screenshot with optional OCR and upload"""
    return controller.capture(request)
