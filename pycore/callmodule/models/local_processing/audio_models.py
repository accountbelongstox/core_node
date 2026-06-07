# -*- coding: utf-8 -*-
"""
Audio Models

Models for audio transcription and subtitle generation.
"""

from typing import Optional, List, Literal
from pydantic import BaseModel, Field


AudioEngineType = Literal['whisper', 'vosk']
WhisperModelType = Literal['tiny', 'base', 'small', 'medium', 'large']
SubtitleFormatType = Literal['srt', 'vtt', 'ass']


class AudioTranscribeRequest(BaseModel):
    """Audio transcription request"""
    audio_data: Optional[str] = Field(None, description="Base64 encoded audio data")
    audio_path: Optional[str] = Field(None, description="Local audio file path")
    audio_url: Optional[str] = Field(None, description="Audio URL")
    engine: Optional[AudioEngineType] = Field(None, description="Transcription engine, defaults to config")
    model: Optional[WhisperModelType] = Field(None, description="Model size for Whisper, defaults to config")
    language: Optional[str] = Field(None, description="Language code (e.g., 'en', 'zh'), defaults to config")
    generate_subtitle: bool = Field(default=False, description="Generate subtitle file")
    subtitle_format: Optional[SubtitleFormatType] = Field(None, description="Subtitle format if generate_subtitle is True")
    auto_upload: bool = Field(default=True, description="Automatically upload result")

    class Config:
        json_schema_extra = {
            "example": {
                "audio_path": "/tmp/audio.wav",
                "engine": "whisper",
                "model": "base",
                "language": "en",
                "generate_subtitle": True,
                "subtitle_format": "srt",
                "auto_upload": True
            }
        }


class TranscriptionSegment(BaseModel):
    """Transcription segment with timing"""
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")
    text: str = Field(..., description="Transcribed text")
    confidence: Optional[float] = Field(None, description="Confidence score")


class AudioTranscribeResponse(BaseModel):
    """Audio transcription response"""
    success: bool
    message: str
    transcribe_id: Optional[str] = None
    full_text: Optional[str] = Field(None, description="Complete transcribed text")
    segments: Optional[List[TranscriptionSegment]] = Field(None, description="Transcription segments with timing")
    language: Optional[str] = None
    engine_used: Optional[str] = None
    model_used: Optional[str] = None
    subtitle_path: Optional[str] = Field(None, description="Subtitle file path if generated")
    audio_duration: Optional[float] = Field(None, description="Audio duration in seconds")
    upload_result: Optional[dict] = Field(None, description="Upload result if auto_upload is True")
    execution_time: float = Field(..., description="Execution time in seconds")
    error: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Transcription completed successfully",
                "transcribe_id": "transcribe_20251207_143000",
                "full_text": "Hello, this is a test audio file.",
                "segments": [
                    {
                        "start": 0.0,
                        "end": 2.5,
                        "text": "Hello, this is a test audio file.",
                        "confidence": 0.95
                    }
                ],
                "language": "en",
                "engine_used": "whisper",
                "model_used": "base",
                "subtitle_path": "/tmp/audio.srt",
                "audio_duration": 10.5,
                "upload_result": {"uploaded": True, "upload_id": "upload_123"},
                "execution_time": 5.2,
                "error": None
            }
        }


class AudioSubtitleRequest(BaseModel):
    """Audio subtitle generation request (from existing transcription)"""
    transcribe_id: Optional[str] = Field(None, description="Existing transcription ID")
    audio_path: Optional[str] = Field(None, description="Audio file path (will transcribe if transcribe_id not provided)")
    segments: Optional[List[TranscriptionSegment]] = Field(None, description="Transcription segments")
    subtitle_format: SubtitleFormatType = Field(default='srt', description="Subtitle format")
    auto_upload: bool = Field(default=True, description="Automatically upload result")


class AudioSubtitleResponse(BaseModel):
    """Audio subtitle generation response"""
    success: bool
    message: str
    subtitle_id: Optional[str] = None
    subtitle_path: Optional[str] = Field(None, description="Generated subtitle file path")
    subtitle_content: Optional[str] = Field(None, description="Subtitle file content")
    subtitle_format: Optional[str] = None
    segment_count: Optional[int] = Field(None, description="Number of subtitle segments")
    upload_result: Optional[dict] = None
    execution_time: float = Field(..., description="Execution time in seconds")
    error: Optional[str] = None
