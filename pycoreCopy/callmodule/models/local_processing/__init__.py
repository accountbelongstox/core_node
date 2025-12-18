# -*- coding: utf-8 -*-
"""
Local Processing Models Package
"""

from .screenshot_models import (
    ScreenshotRequest,
    ScreenshotResponse,
    ScreenshotConfig,
)

from .image_models import (
    ImageOCRRequest,
    ImageOCRResponse,
    ImageProcessRequest,
    ImageProcessResponse,
)

from .audio_models import (
    AudioTranscribeRequest,
    AudioTranscribeResponse,
    AudioSubtitleRequest,
    AudioSubtitleResponse,
)

from .file_models import (
    FileAnalyzeRequest,
    FileAnalyzeResponse,
    PDFExtractRequest,
    PDFExtractResponse,
)

from .video_models import (
    VideoProcessRequest,
    VideoProcessResponse,
    VideoExtractAudioRequest,
    VideoExtractAudioResponse,
)

__all__ = [
    # Screenshot models
    "ScreenshotRequest",
    "ScreenshotResponse",
    "ScreenshotConfig",

    # Image models
    "ImageOCRRequest",
    "ImageOCRResponse",
    "ImageProcessRequest",
    "ImageProcessResponse",

    # Audio models
    "AudioTranscribeRequest",
    "AudioTranscribeResponse",
    "AudioSubtitleRequest",
    "AudioSubtitleResponse",

    # File models
    "FileAnalyzeRequest",
    "FileAnalyzeResponse",
    "PDFExtractRequest",
    "PDFExtractResponse",

    # Video models
    "VideoProcessRequest",
    "VideoProcessResponse",
    "VideoExtractAudioRequest",
    "VideoExtractAudioResponse",
]
