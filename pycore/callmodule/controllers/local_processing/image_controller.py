# -*- coding: utf-8 -*-
"""Image Controller"""
from pycore.callmodule.services.processors.ocr_processor import OCRProcessor
from ...models.local_processing.image_models import ImageOCRRequest, ImageOCRResponse, ImageProcessRequest, ImageProcessResponse

class ImageController:
    def __init__(self):
        self.ocr_processor = OCRProcessor()
    
    def ocr(self, request: ImageOCRRequest) -> ImageOCRResponse:
        image_path = request.image_path or request.image_url
        config = {"engine": request.engine, "language": request.language, "confidence_threshold": request.confidence_threshold}
        result = self.ocr_processor.process_image(image_path, config)
        return ImageOCRResponse(
            success=result.get("success", False),
            message=result.get("message", "OCR completed"),
            full_text=result.get("full_text"),
            text_blocks=result.get("text_blocks"),
            language=result.get("language"),
            engine_used=result.get("engine_used"),
            average_confidence=result.get("average_confidence"),
            execution_time=result.get("execution_time", 0.0),
            error=result.get("error")
        )
    
    def process(self, request: ImageProcessRequest) -> ImageProcessResponse:
        return ImageProcessResponse(
            success=True,
            message="Image processing not yet fully implemented",
            execution_time=0.0
        )
