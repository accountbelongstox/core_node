# -*- coding: utf-8 -*-
"""
Local Test Router - Local processing test endpoint
"""

from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()

from ...controllers.management import LocalProcessingController
from ...models.management.local_processing_models import TestRequest, TestResponse

APIRouter = fastapi.APIRouter
router = APIRouter(prefix="/api/manage/local", tags=["Local Processing Management"])

# Initialize controller
controller = LocalProcessingController()


@router.post("/test", response_model=TestResponse)
async def test_processing(request: TestRequest):
    """
    Test local processing capability.

    Request body:
    - test_type: Type of test to run (screenshot, ocr, audio, video)
    - test_data: Optional base64 encoded test data

    Returns:
    - Test results including execution time and hardware usage
    - Error message if test failed
    """
    return controller.test(request)
