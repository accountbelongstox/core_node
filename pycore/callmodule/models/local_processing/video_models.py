# -*- coding: utf-8 -*-
"""
Video Models

Models for video processing and audio extraction.
"""

from typing import Optional, List, Literal
from pydantic import BaseModel, Field


AudioFormatType = Literal['wav', 'mp3', 'flac']
VideoFormatType = Literal['mp4', 'avi', 'mkv', 'mov']
SubtitleFormatType = Literal['srt', 'vtt', 'ass']


class VideoProcessRequest(BaseModel):
    """Video processing request (extract audio + generate subtitle)"""
    video_data: Optional[str] = Field(None, description="Base64 encoded video data")
    video_path: Optional[str] = Field(None, description="Local video file path")
    video_url: Optional[str] = Field(None, description="Video URL")
    extract_audio: bool = Field(default=True, description="Extract audio from video")
    audio_format: AudioFormatType = Field(default='wav', description="Audio format for extraction")
    generate_subtitle: bool = Field(default=True, description="Generate subtitle from audio")
    subtitle_format: SubtitleFormatType = Field(default='srt', description="Subtitle format")
    transcribe_language: Optional[str] = Field(None, description="Transcription language")
    compress_video: bool = Field(default=False, description="Compress video file")
    compress_crf: Optional[int] = Field(None, ge=0, le=51, description="Compression CRF value (0-51)")
    auto_upload: bool = Field(default=True, description="Automatically upload result")

    class Config:
        schema_extra = {
            "example": {
                "video_path": "/tmp/video.mp4",
                "extract_audio": True,
                "audio_format": "wav",
                "generate_subtitle": True,
                "subtitle_format": "srt",
                "transcribe_language": "en",
                "compress_video": False,
                "auto_upload": True
            }
        }


class VideoMetadata(BaseModel):
    """Video metadata"""
    duration: float = Field(..., description="Duration in seconds")
    width: int
    height: int
    fps: float = Field(..., description="Frames per second")
    codec: Optional[str] = None
    bitrate: Optional[int] = Field(None, description="Bitrate in kbps")
    file_size: int = Field(..., description="File size in bytes")


class VideoProcessResponse(BaseModel):
    """Video processing response"""
    success: bool
    message: str
    process_id: Optional[str] = None
    video_metadata: Optional[VideoMetadata] = None
    extracted_audio_path: Optional[str] = Field(None, description="Extracted audio file path")
    extracted_audio_format: Optional[str] = None
    subtitle_path: Optional[str] = Field(None, description="Generated subtitle file path")
    subtitle_format: Optional[str] = None
    compressed_video_path: Optional[str] = Field(None, description="Compressed video file path")
    transcription_text: Optional[str] = Field(None, description="Full transcription text")
    upload_result: Optional[dict] = Field(None, description="Upload result if auto_upload is True")
    execution_time: float = Field(..., description="Execution time in seconds")
    error: Optional[str] = None

    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "Video processed successfully",
                "process_id": "video_20251207_143000",
                "video_metadata": {
                    "duration": 120.5,
                    "width": 1920,
                    "height": 1080,
                    "fps": 30.0,
                    "codec": "h264",
                    "bitrate": 5000,
                    "file_size": 102400000
                },
                "extracted_audio_path": "/tmp/video_audio.wav",
                "extracted_audio_format": "wav",
                "subtitle_path": "/tmp/video_subtitle.srt",
                "subtitle_format": "srt",
                "compressed_video_path": None,
                "transcription_text": "Hello, this is the video content...",
                "upload_result": {"uploaded": True, "upload_id": "upload_123"},
                "execution_time": 45.2,
                "error": None
            }
        }


class VideoExtractAudioRequest(BaseModel):
    """Video audio extraction request (only extract audio, no transcription)"""
    video_data: Optional[str] = Field(None, description="Base64 encoded video data")
    video_path: Optional[str] = Field(None, description="Local video file path")
    video_url: Optional[str] = Field(None, description="Video URL")
    audio_format: AudioFormatType = Field(default='wav', description="Audio format for extraction")
    sample_rate: Optional[int] = Field(None, description="Audio sample rate (e.g., 16000, 44100)")
    channels: Optional[int] = Field(None, description="Number of audio channels (1=mono, 2=stereo)")
    auto_upload: bool = Field(default=True, description="Automatically upload result")


class VideoExtractAudioResponse(BaseModel):
    """Video audio extraction response"""
    success: bool
    message: str
    extract_id: Optional[str] = None
    audio_path: Optional[str] = Field(None, description="Extracted audio file path")
    audio_format: Optional[str] = None
    audio_duration: Optional[float] = Field(None, description="Audio duration in seconds")
    audio_size: Optional[int] = Field(None, description="Audio file size in bytes")
    sample_rate: Optional[int] = None
    channels: Optional[int] = None
    upload_result: Optional[dict] = None
    execution_time: float = Field(..., description="Execution time in seconds")
    error: Optional[str] = None
