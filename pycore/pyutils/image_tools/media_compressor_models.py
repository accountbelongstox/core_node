#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Media Compressor - Data Models

Pure dataclasses describing the compression data contracts (stats / task /
queue stats). Extracted from media_compressor.py so the data shapes can be
imported without pulling in OpenCV / FFmpeg / CUDA detection. Zero behavioural
dependency.
"""
from pathlib import Path
from typing import Optional, Dict, Callable
from dataclasses import dataclass, field


@dataclass
class CompressionStats:
    """Statistics for compression operations"""
    original_size: int = 0
    compressed_size: int = 0
    compression_ratio: float = 0.0
    processing_time: float = 0.0
    used_gpu: bool = False


@dataclass
class CompressionTask:
    """Compression task definition"""
    task_id: str
    input_path: Path
    output_path: Path
    task_type: str  # 'image' or 'video'
    options: Dict = field(default_factory=dict)
    callback: Optional[Callable] = None


@dataclass
class QueueStats:
    """Queue processing statistics"""
    total_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    total_original_size: int = 0
    total_compressed_size: int = 0
    start_time: float = 0.0
    end_time: float = 0.0
