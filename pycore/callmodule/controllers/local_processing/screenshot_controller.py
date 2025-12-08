# -*- coding: utf-8 -*-
"""Screenshot Controller"""
from ...services.processors import ScreenshotProcessor
from ...models.local_processing.screenshot_models import ScreenshotRequest, ScreenshotResponse

class ScreenshotController:
    def __init__(self):
        self.processor = ScreenshotProcessor()
    
    def capture(self, request: ScreenshotRequest) -> ScreenshotResponse:
        config = request.dict(exclude_unset=True)
        result = self.processor.capture(config)
        return ScreenshotResponse(
            success=result.get("success", False),
            message=result.get("message", "Screenshot operation completed"),
            screenshot_id=result.get("screenshot_id"),
            file_path=result.get("file_path"),
            file_size=result.get("file_size"),
            image_data=result.get("image_data"),
            ocr_result=result.get("ocr_result"),
            upload_result=result.get("upload_result"),
            execution_time=result.get("execution_time", 0.0),
            error=result.get("error")
        )
