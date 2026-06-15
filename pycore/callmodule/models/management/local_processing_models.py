# -*- coding: utf-8 -*-
"""
Local Processing Models

Models for local processing capabilities, configuration, and statistics.
"""

from typing import Any, Dict, List, Optional, Literal
from pydantic import BaseModel, Field


# ========== Hardware Capabilities ==========

class CPUInfo(BaseModel):
    """CPU information"""
    model: str
    cores: int
    threads: int
    available: bool = True


class GPUInfo(BaseModel):
    """GPU information"""
    model: str
    memory: float = Field(..., description="GPU memory in MB")
    available: bool
    cuda_version: Optional[str] = None


class MemoryInfo(BaseModel):
    """Memory information"""
    total: float = Field(..., description="Total memory in MB")
    available: float = Field(..., description="Available memory in MB")


class HardwareCapabilities(BaseModel):
    """Hardware capabilities information"""
    cpu: CPUInfo
    gpu: GPUInfo
    memory: MemoryInfo


# ========== Processing Capabilities ==========

class ProcessingCapability(BaseModel):
    """Generic processing capability"""
    available: bool
    reason: Optional[str] = Field(None, description="Reason if not available")


class ScreenshotCapability(ProcessingCapability):
    """Screenshot capability"""
    supported_formats: List[str] = Field(default_factory=lambda: ["png", "jpg", "bmp"])
    max_resolution: str = "3840x2160"


class OCRCapability(ProcessingCapability):
    """OCR capability"""
    engines: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)


class AudioCapability(ProcessingCapability):
    """Audio transcription capability"""
    engines: List[str] = Field(default_factory=list)
    models: List[str] = Field(default_factory=list)
    supported_formats: List[str] = Field(default_factory=lambda: ["wav", "mp3", "flac"])


class VideoCapability(ProcessingCapability):
    """Video processing capability"""
    supported_formats: List[str] = Field(default_factory=lambda: ["mp4", "avi", "mkv"])


class LocalCapabilities(BaseModel):
    """Local processing capabilities response"""
    hardware: HardwareCapabilities
    capabilities: Dict[str, Dict[str, Any]] = Field(..., description="Processing capabilities map")

    class Config:
        json_schema_extra = {
            "example": {
                "hardware": {
                    "cpu": {
                        "model": "Intel Core i7-9700K",
                        "cores": 8,
                        "threads": 8,
                        "available": True
                    },
                    "gpu": {
                        "model": "NVIDIA GeForce RTX 3060",
                        "memory": 12288,
                        "available": True,
                        "cuda_version": "12.6"
                    },
                    "memory": {
                        "total": 16384,
                        "available": 8192
                    }
                },
                "capabilities": {
                    "screenshot": {
                        "available": True,
                        "supported_formats": ["png", "jpg", "bmp"],
                        "max_resolution": "3840x2160"
                    },
                    "ocr": {
                        "available": True,
                        "engines": ["paddleocr", "easyocr"],
                        "languages": ["en", "ch"]
                    },
                    "audio": {
                        "available": True,
                        "engines": ["whisper"],
                        "models": ["tiny", "base", "small", "medium"],
                        "supported_formats": ["wav", "mp3", "flac"]
                    },
                    "video": {
                        "available": False,
                        "reason": "FFmpeg not installed",
                        "supported_formats": []
                    }
                }
            }
        }


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


# ========== Processing Statistics ==========

class TaskTypeStats(BaseModel):
    """Statistics for a specific task type"""
    count: int
    success_rate: float = Field(..., description="Success rate percentage")
    average_time: float = Field(..., description="Average processing time in seconds")


class UploadStats(BaseModel):
    """Upload statistics"""
    total_uploaded: int
    upload_size: float = Field(..., description="Total upload size in MB")
    failed: int
    average_speed: float = Field(..., description="Average upload speed in MB/s")


class TimelineStats(BaseModel):
    """Timeline statistics entry"""
    date: str
    tasks: int
    success: int
    failed: int


class LocalProcessingStats(BaseModel):
    """Local processing statistics"""
    period: str
    summary: Dict[str, Any] = Field(..., description="Summary statistics")
    by_type: Dict[str, TaskTypeStats] = Field(default_factory=dict)
    upload_stats: UploadStats
    timeline: List[TimelineStats] = Field(default_factory=list)

    class Config:
        json_schema_extra = {
            "example": {
                "period": "today",
                "summary": {
                    "total_tasks": 100,
                    "completed": 95,
                    "failed": 5,
                    "average_time": 2.5,
                    "total_data_processed": 500.0
                },
                "by_type": {
                    "screenshot": {
                        "count": 40,
                        "success_rate": 95.0,
                        "average_time": 1.2
                    },
                    "ocr": {
                        "count": 30,
                        "success_rate": 96.7,
                        "average_time": 2.8
                    },
                    "audio": {
                        "count": 20,
                        "success_rate": 90.0,
                        "average_time": 5.5
                    },
                    "video": {
                        "count": 10,
                        "success_rate": 100.0,
                        "average_time": 15.3
                    }
                },
                "upload_stats": {
                    "total_uploaded": 95,
                    "upload_size": 450.0,
                    "failed": 3,
                    "average_speed": 2.5
                },
                "timeline": [
                    {
                        "date": "2025-12-07",
                        "tasks": 100,
                        "success": 95,
                        "failed": 5
                    }
                ]
            }
        }


# ========== Test Models ==========

TestType = Literal['screenshot', 'ocr', 'audio', 'video']


class TestRequest(BaseModel):
    """Test request model"""
    test_type: TestType
    test_data: Optional[str] = Field(None, description="Base64 encoded test data")


class TestResponse(BaseModel):
    """Test response model"""
    success: bool
    test_type: str
    result: Any
    execution_time: float = Field(..., description="Execution time in seconds")
    hardware_used: Dict[str, bool] = Field(..., description="Hardware usage (cpu, gpu)")
    error: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "test_type": "ocr",
                "result": {
                    "text": "Hello World",
                    "confidence": 0.95
                },
                "execution_time": 2.5,
                "hardware_used": {
                    "cpu": True,
                    "gpu": True
                },
                "error": None
            }
        }
