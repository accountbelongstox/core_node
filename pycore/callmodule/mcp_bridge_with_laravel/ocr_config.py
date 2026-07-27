#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OCR Service Configuration and Resource Limits
Defines constants and limits for different OCR providers
"""

# OCR Provider Resource Limits
class OCRLimits:
    """OCR service resource limits and quotas"""

    # Free OCR (OCR.space) Limits
    FREE_OCR = {
        "requests_per_month": 25000,  # Monthly request limit
        "file_size_limit": 1024 * 1024,  # 1 MB in bytes
        "pdf_page_limit": 3,  # Maximum pages per PDF
        "supported_formats": ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.bmp', '.tiff'],
        "max_image_resolution": (1280, 720),  # Max 720p resolution
        "image_quality": 85,  # JPEG compression quality
        "timeout": 30,  # Request timeout in seconds
        "rate_limit": 500  # Daily rate limit fallback
    }

    # PaddleOCR Local Engine Limits
    PADDLE_OCR = {
        "requests_per_month": 999999,  # No limit for local processing
        "file_size_limit": 50 * 1024 * 1024,  # 50 MB in bytes
        "pdf_page_limit": 100,  # Maximum pages per PDF
        "supported_formats": ['.jpg', '.jpeg', '.png', '.bmp', '.pdf', '.tiff', '.webp'],
        "max_image_resolution": (4096, 4096),  # High resolution support
        "timeout": 60,  # Longer timeout for local processing
        "rate_limit": 1000,  # High rate limit for local
        "requires_init": True,  # Needs initialization step
        "model_download_size": "500MB",  # Approximate model size
        "cpu_optimized": True,
        "gpu_support": True
    }

    # General Settings
    GENERAL = {
        "max_queue_size": 100,  # Maximum items in processing queue
        "max_batch_size": 10,  # Maximum items per batch
        "temp_file_retention": 300,  # Seconds to keep temp files
        "retry_attempts": 3,  # Number of retry attempts
        "backoff_factor": 2,  # Exponential backoff multiplier
    }

# Default API Keys
class APIKeys:
    """Default API keys for OCR services"""

    DEFAULT_FREE_OCR_API_KEY = "K84414795888957"

    # Environment variable names
    ENV_FREE_OCR_KEY = "OCRSPACE_API_KEY"
    ENV_PADDLE_MODEL_DIR = "PADDLE_OCR_MODEL_DIR"

# OCR Engine Priority Configuration
class OCRStrategy:
    """OCR engine selection and fallback strategy"""

    # Engine priority based on content type
    ENGINE_PRIORITY = {
        "chinese_text": ["paddle", "free"],
        "english_text": ["free", "paddle"],
        "mixed_content": ["paddle", "free"],
        "handwriting": ["paddle"],
        "document_scan": ["paddle", "free"],
        "receipt": ["paddle"],
        "general": ["free", "paddle"]
    }

    # Auto-selection criteria
    AUTO_SELECTION_RULES = {
        "file_size_large": "paddle",  # > 1MB files
        "pdf_multi_page": "paddle",   # > 3 pages
        "high_accuracy_needed": "paddle",
        "batch_processing": "free",     # For large batches
        "offline_needed": "paddle",     # When network is unavailable
        "default": "free"
    }

# Processing Configuration
class ProcessingConfig:
    """File processing and optimization settings"""

    # Image compression settings
    IMAGE_COMPRESSION = {
        "max_width": 1280,
        "max_height": 720,
        "quality": 85,
        "format": "JPEG",
        "optimize": True,
        "progressive": True
    }

    # PDF processing settings
    PDF_PROCESSING = {
        "max_pages_per_chunk": 3,
        "dpi": 300,  # DPI for PDF to image conversion
        "image_format": "PNG",
        "compression": "zip"
    }

    # Queue processing settings
    QUEUE_CONFIG = {
        "max_concurrent_requests": 5,
        "batch_delay": 1.0,  # Seconds between batches
        "priority_levels": ["high", "normal", "low"],
        "timeout_per_item": 60,  # Seconds per queue item
        "max_retries": 3
    }
