# -*- coding: utf-8 -*-
"""
Local Processing Models

Models for local processing configuration.
"""

from typing import Optional, Literal
from pycore.pyfoundations.third_party.api import get_third_package_pydantic


pydantic = get_third_package_pydantic()
BaseModel = pydantic.BaseModel
Field = pydantic.Field


# ========== Processing Configuration ==========

ImageFormatType = Literal['png', 'jpg', 'bmp']
OCREngineType = Literal['paddleocr', 'easyocr', 'tesseract']
AudioEngineType = Literal['whisper', 'vosk']
WhisperModelType = Literal['tiny', 'base', 'small', 'medium', 'large']
DeviceType = Literal['cuda', 'cpu']
AudioFormatType = Literal['wav', 'mp3', 'flac']
SubtitleFormatType = Literal['srt', 'vtt', 'ass']


class ScreenshotConfig(BaseModel):
    """Screenshot configuration"""
    enabled: bool = True
    format: ImageFormatType = 'png'
    quality: int = Field(default=90, ge=1, le=100)
    auto_ocr: bool = False
    hotkey: Optional[str] = None


class OCRConfig(BaseModel):
    """OCR configuration"""
    enabled: bool = True
    engine: OCREngineType = 'paddleocr'
    language: str = 'ch'
    confidence_threshold: float = Field(default=0.5, ge=0.0, le=1.0)
    gpu_enabled: bool = False


class AudioConfig(BaseModel):
    """Audio transcription configuration"""
    enabled: bool = True
    engine: AudioEngineType = 'whisper'
    model: WhisperModelType = 'base'
    language: str = 'en'
    device: DeviceType = 'cpu'


class VideoConfig(BaseModel):
    """Video processing configuration"""
    enabled: bool = False
    extract_audio_format: AudioFormatType = 'wav'
    subtitle_format: SubtitleFormatType = 'srt'
    compress_before_upload: bool = True
    compress_crf: int = Field(default=23, ge=0, le=51)


class UploadConfig(BaseModel):
    """Upload configuration"""
    auto_upload: bool = True
    server_url: str = ""
    compress_before_upload: bool = True
    retry_times: int = Field(default=3, ge=0, le=10)
    retry_delay: int = Field(default=5, ge=1, le=60, description="Retry delay in seconds")


class LocalProcessingConfig(BaseModel):
    """Local processing configuration"""
    screenshot: ScreenshotConfig = Field(default_factory=ScreenshotConfig)
    ocr: OCRConfig = Field(default_factory=OCRConfig)
    audio: AudioConfig = Field(default_factory=AudioConfig)
    video: VideoConfig = Field(default_factory=VideoConfig)
    upload: UploadConfig = Field(default_factory=UploadConfig)
