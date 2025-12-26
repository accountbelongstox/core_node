# -*- coding: utf-8 -*-
"""
Image Models

Models for image OCR and processing.
"""

from typing import Optional, List, Literal
from pydantic import BaseModel, Field


OCREngineType = Literal['paddleocr', 'easyocr', 'tesseract']


class ImageOCRRequest(BaseModel):
    """Image OCR request"""
    image_data: Optional[str] = Field(None, description="Base64 encoded image data")
    image_path: Optional[str] = Field(None, description="Local image file path")
    image_url: Optional[str] = Field(None, description="Image URL")
    engine: Optional[OCREngineType] = Field(None, description="OCR engine, defaults to config")
    language: Optional[str] = Field(None, description="Language code, defaults to config")
    confidence_threshold: Optional[float] = Field(None, ge=0.0, le=1.0, description="Confidence threshold")
    auto_upload: bool = Field(default=True, description="Automatically upload result")

    class Config:
        schema_extra = {
            "example": {
                "image_path": "/tmp/screenshot.png",
                "engine": "paddleocr",
                "language": "ch",
                "confidence_threshold": 0.5,
                "auto_upload": True
            }
        }


class OCRTextBlock(BaseModel):
    """OCR text block"""
    text: str
    confidence: float
    bbox: List[int] = Field(..., description="Bounding box [x, y, width, height]")


class ImageOCRResponse(BaseModel):
    """Image OCR response"""
    success: bool
    message: str
    ocr_id: Optional[str] = None
    full_text: Optional[str] = Field(None, description="Complete extracted text")
    text_blocks: Optional[List[OCRTextBlock]] = Field(None, description="Text blocks with positions")
    language: Optional[str] = None
    engine_used: Optional[str] = None
    average_confidence: Optional[float] = None
    upload_result: Optional[dict] = Field(None, description="Upload result if auto_upload is True")
    execution_time: float = Field(..., description="Execution time in seconds")
    error: Optional[str] = None

    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "OCR completed successfully",
                "ocr_id": "ocr_20251207_143000",
                "full_text": "Hello World\nThis is a test",
                "text_blocks": [
                    {
                        "text": "Hello World",
                        "confidence": 0.95,
                        "bbox": [10, 10, 200, 30]
                    }
                ],
                "language": "ch",
                "engine_used": "paddleocr",
                "average_confidence": 0.95,
                "upload_result": {"uploaded": True, "upload_id": "upload_123"},
                "execution_time": 3.2,
                "error": None
            }
        }


class ImageProcessRequest(BaseModel):
    """Image processing request (resize, compress, format conversion)"""
    image_data: Optional[str] = Field(None, description="Base64 encoded image data")
    image_path: Optional[str] = Field(None, description="Local image file path")
    operation: Literal['resize', 'compress', 'convert'] = Field(..., description="Processing operation")
    target_format: Optional[str] = Field(None, description="Target format for conversion")
    max_width: Optional[int] = Field(None, description="Max width for resize")
    max_height: Optional[int] = Field(None, description="Max height for resize")
    quality: Optional[int] = Field(None, ge=1, le=100, description="Compression quality")
    auto_upload: bool = Field(default=True, description="Automatically upload result")


class ImageProcessResponse(BaseModel):
    """Image processing response"""
    success: bool
    message: str
    process_id: Optional[str] = None
    output_path: Optional[str] = Field(None, description="Output file path")
    output_size: Optional[int] = Field(None, description="Output file size in bytes")
    output_data: Optional[str] = Field(None, description="Base64 encoded output data")
    original_size: Optional[int] = Field(None, description="Original file size in bytes")
    compression_ratio: Optional[float] = Field(None, description="Compression ratio")
    upload_result: Optional[dict] = None
    execution_time: float = Field(..., description="Execution time in seconds")
    error: Optional[str] = None
