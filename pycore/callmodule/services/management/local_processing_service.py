# -*- coding: utf-8 -*-
"""
Local Processing Service - Business logic for local processing management
"""

import platform
import psutil
from typing import Dict, Any, Optional

from ...models.management.local_processing_models import (
    LocalCapabilities,
    LocalProcessingConfig,
    LocalProcessingStats,
    TestRequest,
    TestResponse,
    HardwareCapabilities,
    CPUInfo,
    GPUInfo,
    MemoryInfo,
    UploadStats,
)


class LocalProcessingService:
    """Service for local processing management operations"""

    def __init__(self):
        self._config: Optional[LocalProcessingConfig] = None
        self._load_config()

    def _load_config(self):
        """Load local processing configuration"""
        # TODO: Load from actual configuration file
        self._config = LocalProcessingConfig()

    def _save_config(self):
        """Save local processing configuration"""
        # TODO: Save to actual configuration file
        pass

    def get_capabilities(self) -> LocalCapabilities:
        """
        Get local processing capabilities including hardware info.

        Returns:
            LocalCapabilities model with all capability information
        """
        # Get CPU info
        cpu_count = psutil.cpu_count(logical=False) or 1
        cpu_threads = psutil.cpu_count(logical=True) or 1

        cpu_info = CPUInfo(
            model=platform.processor() or "Unknown",
            cores=cpu_count,
            threads=cpu_threads,
            available=True
        )

        # Get GPU info
        gpu_available = self._check_gpu_availability()
        gpu_info = GPUInfo(
            model=self._get_gpu_model(),
            memory=0.0,
            available=gpu_available,
            cuda_version=self._get_cuda_version() if gpu_available else None
        )

        # Get memory info
        memory = psutil.virtual_memory()
        memory_info = MemoryInfo(
            total=round(memory.total / (1024 * 1024), 2),
            available=round(memory.available / (1024 * 1024), 2)
        )

        hardware = HardwareCapabilities(
            cpu=cpu_info,
            gpu=gpu_info,
            memory=memory_info
        )

        # Check processing capabilities
        capabilities = {
            "screenshot": {
                "available": True,
                "supported_formats": ["png", "jpg", "bmp"],
                "max_resolution": "3840x2160"
            },
            "ocr": {
                "available": self._check_ocr_availability(),
                "engines": self._get_available_ocr_engines(),
                "languages": ["en", "ch"]
            },
            "audio": {
                "available": self._check_audio_availability(),
                "engines": self._get_available_audio_engines(),
                "models": ["tiny", "base", "small", "medium"],
                "supported_formats": ["wav", "mp3", "flac"]
            },
            "video": {
                "available": self._check_video_availability(),
                "reason": None if self._check_video_availability() else "FFmpeg not installed",
                "supported_formats": ["mp4", "avi", "mkv"] if self._check_video_availability() else []
            }
        }

        return LocalCapabilities(
            hardware=hardware,
            capabilities=capabilities
        )

    def _check_gpu_availability(self) -> bool:
        """Check if GPU is available"""
        try:
            # Try importing torch to check CUDA availability
            import torch
            return torch.cuda.is_available()
        except:
            return False

    def _get_gpu_model(self) -> str:
        """Get GPU model name"""
        try:
            import torch
            if torch.cuda.is_available():
                return torch.cuda.get_device_name(0)
        except:
            pass
        return "None"

    def _get_cuda_version(self) -> Optional[str]:
        """Get CUDA version"""
        try:
            import torch
            if torch.cuda.is_available():
                return torch.version.cuda
        except:
            pass
        return None

    def _check_ocr_availability(self) -> bool:
        """Check if OCR is available"""
        try:
            from pycore.pyutils.ocr_cluster import ocr_manager
            return True
        except:
            return False

    def _get_available_ocr_engines(self) -> list:
        """Get available OCR engines"""
        engines = []
        try:
            import paddleocr
            engines.append("paddleocr")
        except:
            pass
        try:
            import easyocr
            engines.append("easyocr")
        except:
            pass
        return engines

    def _check_audio_availability(self) -> bool:
        """Check if audio transcription is available"""
        try:
            from pycore.pyutils.whisper_stt import WhisperProvider
            return True
        except:
            return False

    def _get_available_audio_engines(self) -> list:
        """Get available audio transcription engines"""
        engines = []
        try:
            import whisper
            engines.append("whisper")
        except:
            pass
        return engines

    def _check_video_availability(self) -> bool:
        """Check if video processing is available"""
        try:
            import ffmpeg
            return True
        except:
            return False

    def get_config(self) -> LocalProcessingConfig:
        """
        Get current local processing configuration.

        Returns:
            LocalProcessingConfig model
        """
        return self._config

    def update_config(self, config: LocalProcessingConfig) -> Dict[str, Any]:
        """
        Update local processing configuration.

        Args:
            config: New configuration to apply

        Returns:
            Dictionary with success status and message
        """
        try:
            self._config = config
            self._save_config()
            return {
                "success": True,
                "message": "Configuration updated successfully",
                "config": config
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to update configuration: {str(e)}"
            }

    def get_stats(self, period: str = "today", start_date: Optional[str] = None,
                  end_date: Optional[str] = None) -> LocalProcessingStats:
        """
        Get local processing statistics.

        Args:
            period: Time period (today, week, month, all, custom)
            start_date: Start date for custom period (YYYY-MM-DD)
            end_date: End date for custom period (YYYY-MM-DD)

        Returns:
            LocalProcessingStats model
        """
        # TODO: Implement actual statistics gathering from database
        # For now, return mock data
        summary = {
            "total_tasks": 0,
            "completed": 0,
            "failed": 0,
            "average_time": 0.0,
            "total_data_processed": 0.0,
        }

        by_type = {}

        upload_stats = UploadStats(
            total_uploaded=0,
            upload_size=0.0,
            failed=0,
            average_speed=0.0
        )

        timeline = []

        return LocalProcessingStats(
            period=period,
            summary=summary,
            by_type=by_type,
            upload_stats=upload_stats,
            timeline=timeline
        )

    def test_processing(self, request: TestRequest) -> TestResponse:
        """
        Test local processing capability.

        Args:
            request: TestRequest with test type and data

        Returns:
            TestResponse with test results
        """
        import time
        start_time = time.time()

        try:
            # TODO: Implement actual testing logic for each type
            result = {
                "message": f"Test for {request.test_type} not yet implemented",
                "status": "pending"
            }

            execution_time = time.time() - start_time

            return TestResponse(
                success=True,
                test_type=request.test_type,
                result=result,
                execution_time=execution_time,
                hardware_used={
                    "cpu": True,
                    "gpu": False
                },
                error=None
            )
        except Exception as e:
            execution_time = time.time() - start_time
            return TestResponse(
                success=False,
                test_type=request.test_type,
                result={},
                execution_time=execution_time,
                hardware_used={
                    "cpu": False,
                    "gpu": False
                },
                error=str(e)
            )
