#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Audio Utilities for Whisper STT

Provides audio processing utilities:
- Format conversion (to WAV 16kHz mono)
- Audio download from URL
- Video to audio extraction
- Audio compression

Dependencies:
- ffmpeg (command line tool, must be installed on system)
"""

from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import APP_CACHE_DIR
from pycore.pyfoundations.third_party.api import get_third_package_requests
from pycore.pyutils.common.ffmpeg.ffmpeg_command import ffmpeg_command_builder
from pycore.pyutils.common.ffmpeg.ffmpeg_probe import ffmpeg_output_validator
from pycore.pyutils.common.ffmpeg.ffmpeg_runtime import ffmpeg_runtime

import time



# Whisper-compatible audio format settings
WHISPER_SAMPLE_RATE = 16000
WHISPER_CHANNELS = 1
WHISPER_FORMAT = "wav"


def get_whisper_cache_dir() -> Path:
    """
    Get cache directory for Whisper STT

    Returns:
        Path: Cache directory for Whisper STT files
    """
    cache_dir = APP_CACHE_DIR / "whisper_stt"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def get_ffmpeg_path() -> Optional[str]:
    """
    Get ffmpeg executable path

    Returns:
        str: Path to ffmpeg executable, or None if not found
    """
    binaries = ffmpeg_runtime.binaries()
    if binaries.ffmpeg is not None:
        return str(binaries.ffmpeg)

    ColorPrint.red("[AudioUtils] ffmpeg not found in PATH")
    ColorPrint.yellow("[AudioUtils] Please install ffmpeg:")
    ColorPrint.yellow("  Windows: choco install ffmpeg")
    ColorPrint.yellow("  Linux: sudo apt install ffmpeg")
    ColorPrint.yellow("  MacOS: brew install ffmpeg")
    return None


def convert_to_whisper_format(
    input_path: Path,
    output_path: Optional[Path] = None,
    sample_rate: int = WHISPER_SAMPLE_RATE,
    channels: int = WHISPER_CHANNELS
) -> Optional[Path]:
    """
    Convert audio file to Whisper-compatible format (WAV 16kHz mono)

    Args:
        input_path: Path to input audio file
        output_path: Optional output path, auto-generated if not provided
        sample_rate: Output sample rate (default: 16000)
        channels: Output channels (default: 1 for mono)

    Returns:
        Path to converted audio file, or None on failure
    """
    if not input_path.exists():
        ColorPrint.red(f"[AudioUtils] Input file not found: {input_path}")
        return None

    if not get_ffmpeg_path():
        return None

    # Generate output path if not provided
    if output_path is None:
        cache_dir = get_whisper_cache_dir()
        output_path = cache_dir / f"{input_path.stem}_converted.{WHISPER_FORMAT}"

    ColorPrint.blue(f"[AudioUtils] Converting {input_path.name} to Whisper format...")
    arguments = ffmpeg_command_builder.convert_pcm(input_path, sample_rate, channels)
    result = ffmpeg_runtime.execute_output_step(
        arguments,
        output_path,
        expected_streams=("audio",),
        output_validator=ffmpeg_output_validator.audio("pcm_s16le", sample_rate, channels),
    )
    if not result.success:
        detail = result.process.stderr if result.process else result.error_code
        ColorPrint.red(f"[AudioUtils] Conversion failed: {detail}")
        return None

    ColorPrint.green(f"[AudioUtils] Converted: {output_path}")
    return output_path


def extract_audio_from_video(
    video_path: Path,
    output_path: Optional[Path] = None,
    compress: bool = True
) -> Optional[Path]:
    """
    Extract audio from video file

    Args:
        video_path: Path to video file
        output_path: Optional output path, auto-generated if not provided
        compress: Whether to compress audio (lower bitrate)

    Returns:
        Path to extracted audio file, or None on failure
    """
    if not video_path.exists():
        ColorPrint.red(f"[AudioUtils] Video file not found: {video_path}")
        return None

    if not get_ffmpeg_path():
        return None

    # Generate output path if not provided
    if output_path is None:
        cache_dir = get_whisper_cache_dir()
        output_path = cache_dir / f"{video_path.stem}_audio.{WHISPER_FORMAT}"

    ColorPrint.blue(f"[AudioUtils] Extracting audio from {video_path.name}...")
    arguments = ffmpeg_command_builder.convert_pcm(
        video_path,
        WHISPER_SAMPLE_RATE,
        WHISPER_CHANNELS,
    )
    result = ffmpeg_runtime.execute_output_step(
        arguments,
        output_path,
        expected_streams=("audio",),
        output_validator=ffmpeg_output_validator.audio(
            "pcm_s16le", WHISPER_SAMPLE_RATE, WHISPER_CHANNELS),
    )
    if not result.success:
        detail = result.process.stderr if result.process else result.error_code
        ColorPrint.red(f"[AudioUtils] Audio extraction failed: {detail}")
        return None

    ColorPrint.green(f"[AudioUtils] Extracted audio: {output_path}")
    return output_path


def download_audio_from_url(
    url: str,
    output_path: Optional[Path] = None,
    convert: bool = True
) -> Optional[Path]:
    """
    Download audio from URL

    Args:
        url: Audio URL
        output_path: Optional output path, auto-generated if not provided
        convert: Whether to convert to Whisper format

    Returns:
        Path to downloaded (and optionally converted) audio file, or None on failure
    """
    requests = get_third_package_requests()
    if requests is None:
        ColorPrint.red("[AudioUtils] requests package not available")
        return None

    # Parse URL to get filename
    parsed = urlparse(url)
    filename = Path(parsed.path).name or "downloaded_audio"

    # Generate output path if not provided
    cache_dir = get_whisper_cache_dir()
    if output_path is None:
        output_path = cache_dir / filename

    ColorPrint.blue(f"[AudioUtils] Downloading audio from {url}...")

    response = requests.get(url, stream=True, timeout=60)

    if response.status_code != 200:
        ColorPrint.red(f"[AudioUtils] Download failed: HTTP {response.status_code}")
        return None

    # Write to file
    with open(output_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

    ColorPrint.green(f"[AudioUtils] Downloaded: {output_path}")

    # Convert to Whisper format if requested
    if convert:
        converted_path = convert_to_whisper_format(output_path)
        if converted_path:
            # Remove original if different from converted
            if converted_path != output_path:
                output_path.unlink(missing_ok=True)
            return converted_path

    return output_path


def get_audio_duration(audio_path: Path) -> Optional[float]:
    """
    Get audio duration in seconds

    Args:
        audio_path: Path to audio file

    Returns:
        Duration in seconds, or None on failure
    """
    if not get_ffmpeg_path():
        return None
    result = ffmpeg_runtime.probe(audio_path)
    return result.duration if result.success else None


def is_audio_file(file_path: Path) -> bool:
    """
    Check if file is an audio file based on extension

    Args:
        file_path: Path to file

    Returns:
        True if file appears to be an audio file
    """
    audio_extensions = {
        ".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac",
        ".wma", ".opus", ".webm", ".aiff", ".aif"
    }
    return file_path.suffix.lower() in audio_extensions


def is_video_file(file_path: Path) -> bool:
    """
    Check if file is a video file based on extension

    Args:
        file_path: Path to file

    Returns:
        True if file appears to be a video file
    """
    video_extensions = {
        ".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv",
        ".webm", ".m4v", ".mpeg", ".mpg", ".3gp"
    }
    return file_path.suffix.lower() in video_extensions


def needs_conversion(audio_path: Path) -> bool:
    """
    Check if audio file needs conversion for Whisper

    Args:
        audio_path: Path to audio file

    Returns:
        True if file needs conversion
    """
    # WAV files might still need conversion for sample rate/channels
    # Always convert non-WAV files
    if audio_path.suffix.lower() != ".wav":
        return True

    # Check WAV file properties (simplified - always convert to be safe)
    return True


def cleanup_cache(max_age_hours: int = 24) -> int:
    """
    Clean up old files from cache directory

    Args:
        max_age_hours: Maximum age of files in hours

    Returns:
        Number of files deleted
    """

    cache_dir = get_whisper_cache_dir()
    deleted = 0
    max_age_seconds = max_age_hours * 3600
    current_time = time.time()

    for file_path in cache_dir.iterdir():
        if file_path.is_file():
            file_age = current_time - file_path.stat().st_mtime
            if file_age > max_age_seconds:
                file_path.unlink(missing_ok=True)
                deleted += 1

    if deleted > 0:
        ColorPrint.blue(f"[AudioUtils] Cleaned up {deleted} old cache files")

    return deleted


__all__ = [
    'WHISPER_SAMPLE_RATE',
    'WHISPER_CHANNELS',
    'WHISPER_FORMAT',
    'get_whisper_cache_dir',
    'get_ffmpeg_path',
    'convert_to_whisper_format',
    'extract_audio_from_video',
    'download_audio_from_url',
    'get_audio_duration',
    'is_audio_file',
    'is_video_file',
    'needs_conversion',
    'cleanup_cache',
]
