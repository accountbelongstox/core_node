#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Task Models - Unified data structures for TTS/STT operations

Provides standardized task data structures for:
- Text-to-Speech (TTS)
- Speech-to-Text (STT)
- Task results

Integrates with PyHeartbeat GlobalTaskQueue and Task system.

Usage:
    from pycore.pyutils.common.speech_task_models import TTSTaskData, TTSTaskResult
    from pycore.pyfoundations import Task

    # Create task data
    task_data = TTSTaskData(text="Hello", language="en-US")

    # Create task
    task = Task(
        task_type='tts',
        task_data=task_data.to_dict(),
        priority=TaskPriority.NORMAL
    )

    # Submit to queue
    get_global_task_queue().put(task)
"""

from dataclasses import dataclass, field, asdict
from typing import Optional, Dict, Any
from enum import Enum


class SpeechTaskType(Enum):
    """Speech task types"""
    TTS = "tts"                    # Text-to-Speech
    STT = "stt"                    # Speech-to-Text
    TTS_CACHE = "tts_cache"        # TTS with caching
    STT_STREAM = "stt_stream"      # Streaming STT


@dataclass
class TTSTaskData:
    """
    TTS task data structure

    Standardized input data for Text-to-Speech tasks
    """
    text: str
    language: str = "zh-CN"
    voice: Optional[str] = None
    provider: str = "edge"              # edge, azure, auto
    return_base64: bool = False
    enable_cache: bool = True
    request_id: Optional[str] = None
    client_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {k: v for k, v in asdict(self).items() if v is not None}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TTSTaskData':
        """Create from dictionary"""
        valid_keys = {f.name for f in cls.__dataclass_fields__.values()}
        filtered_data = {k: v for k, v in data.items() if k in valid_keys}
        return cls(**filtered_data)


@dataclass
class STTTaskData:
    """
    STT task data structure

    Standardized input data for Speech-to-Text tasks
    """
    audio_file: Optional[str] = None
    audio_base64: Optional[str] = None
    language: str = "zh-CN"
    provider: str = "auto"              # azure, local, auto
    request_id: Optional[str] = None
    client_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {k: v for k, v in asdict(self).items() if v is not None}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'STTTaskData':
        """Create from dictionary"""
        valid_keys = {f.name for f in cls.__dataclass_fields__.values()}
        filtered_data = {k: v for k, v in data.items() if k in valid_keys}
        return cls(**filtered_data)


@dataclass
class TTSTaskResult:
    """
    TTS task result structure

    Standardized output data from Text-to-Speech tasks
    """
    success: bool
    audio_file: Optional[str] = None
    audio_base64: Optional[str] = None
    audio_url: Optional[str] = None
    language: Optional[str] = None
    provider: Optional[str] = None
    voice: Optional[str] = None
    cached: bool = False
    duration: Optional[float] = None
    file_size: Optional[int] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {k: v for k, v in asdict(self).items() if v is not None}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TTSTaskResult':
        """Create from dictionary"""
        valid_keys = {f.name for f in cls.__dataclass_fields__.values()}
        filtered_data = {k: v for k, v in data.items() if k in valid_keys}
        return cls(**filtered_data)


@dataclass
class STTTaskResult:
    """
    STT task result structure

    Standardized output data from Speech-to-Text tasks
    """
    success: bool
    text: Optional[str] = None
    language: Optional[str] = None
    provider: Optional[str] = None
    confidence: float = 0.0
    duration: Optional[float] = None
    segments: Optional[list] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {k: v for k, v in asdict(self).items() if v is not None}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'STTTaskResult':
        """Create from dictionary"""
        valid_keys = {f.name for f in cls.__dataclass_fields__.values()}
        filtered_data = {k: v for k, v in data.items() if k in valid_keys}
        return cls(**filtered_data)


# Helper functions to create Task objects
def create_tts_task(data: TTSTaskData, priority = None):
    """
    Create TTS task for GlobalTaskQueue

    Args:
        data: TTSTaskData instance
        priority: TaskPriority (default: NORMAL)

    Returns:
        Task instance
    """
    from pycore.pyfoundations import Task, TaskPriority

    if priority is None:
        priority = TaskPriority.NORMAL

    return Task(
        task_type=SpeechTaskType.TTS.value,
        task_data=data.to_dict(),
        priority=priority
    )


def create_stt_task(data: STTTaskData, priority = None):
    """
    Create STT task for GlobalTaskQueue

    Args:
        data: STTTaskData instance
        priority: TaskPriority (default: NORMAL)

    Returns:
        Task instance
    """
    from pycore.pyfoundations import Task, TaskPriority

    if priority is None:
        priority = TaskPriority.NORMAL

    return Task(
        task_type=SpeechTaskType.STT.value,
        task_data=data.to_dict(),
        priority=priority
    )


__all__ = [
    'SpeechTaskType',
    'TTSTaskData',
    'STTTaskData',
    'TTSTaskResult',
    'STTTaskResult',
    'create_tts_task',
    'create_stt_task'
]
