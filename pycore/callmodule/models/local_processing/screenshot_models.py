# -*- coding: utf-8 -*-
"""
Screenshot Models

Models for screenshot capture and processing.
"""

from typing import Optional, Literal
from pydantic import BaseModel, Field


ImageFormatType = Literal['png', 'jpg', 'bmp']


class ScreenshotConfig(BaseModel):
    """Screenshot configuration"""
    format: ImageFormatType = 'png'
    quality: int = Field(default=90, ge=1, le=100, description="Image quality (1-100)")
    auto_ocr: bool = Field(default=False, description="Automatically perform OCR after screenshot")
    region: Optional[dict] = Field(None, description="Capture region {x, y, width, height}")


class ScreenshotRequest(BaseModel):
    """Screenshot capture request"""
    format: Optional[ImageFormatType] = Field(None, description="Image format, defaults to config")
    quality: Optional[int] = Field(None, ge=1, le=100, description="Image quality, defaults to config")
    auto_ocr: Optional[bool] = Field(None, description="Auto OCR, defaults to config")
    region: Optional[dict] = Field(None, description="Capture region {x, y, width, height}")
    auto_upload: bool = Field(default=True, description="Automatically upload after capture")

    class Config:
        json_schema_extra = {
            "example": {
                "format": "png",
                "quality": 90,
                "auto_ocr": True,
                "region": {"x": 0, "y": 0, "width": 1920, "height": 1080},
                "auto_upload": True
            }
        }


class ScreenshotResponse(BaseModel):
    """Screenshot capture response"""
    success: bool
    message: str
    screenshot_id: Optional[str] = Field(None, description="Screenshot ID")
    file_path: Optional[str] = Field(None, description="Local file path")
    file_size: Optional[int] = Field(None, description="File size in bytes")
    image_data: Optional[str] = Field(None, description="Base64 encoded image data")
    ocr_result: Optional[dict] = Field(None, description="OCR result if auto_ocr is True")
    upload_result: Optional[dict] = Field(None, description="Upload result if auto_upload is True")
    execution_time: float = Field(..., description="Execution time in seconds")
    error: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Screenshot captured successfully",
                "screenshot_id": "screenshot_20251207_143000",
                "file_path": "/tmp/screenshot_20251207_143000.png",
                "file_size": 1024000,
                "image_data": None,
                "ocr_result": {
                    "text": "Hello World",
                    "confidence": 0.95
                },
                "upload_result": {
                    "uploaded": True,
                    "upload_id": "upload_123"
                },
                "execution_time": 2.5,
                "error": None
            }
        }
