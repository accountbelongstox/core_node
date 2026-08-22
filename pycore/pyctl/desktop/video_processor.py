# -*- coding: utf-8 -*-
"""
Legacy video-processing orchestration service.
"""

import time
from typing import Dict, Any
from pathlib import Path

from pycore.pyfoundations.system_paths import get_app_temp_dir

from pycore.pyutils.whisper_stt.audio_processor import AudioProcessor
from pycore.pyutils.common.ffmpeg.ffmpeg_constants import ERROR_BINARY_NOT_FOUND
from pycore.pyutils.media_processing.media_processor import media_processor



class VideoProcessor:
    """Processor for video processing and audio extraction"""

    def __init__(self):
        self.output_dir = get_app_temp_dir() / "video"
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def process_video(self, video_path: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process video file (extract audio, generate subtitle).

        Args:
            video_path: Path to video file
            config: Processing configuration
                - extract_audio: Extract audio flag
                - audio_format: Audio format
                - generate_subtitle: Generate subtitle flag
                - subtitle_format: Subtitle format
                - transcribe_language: Transcription language
                - compress_video: Compress video flag
                - compress_crf: Compression CRF value

        Returns:
            Dictionary with processing result
        """
        start_time = time.time()

        try:
            # Check if video exists
            if not Path(video_path).exists():
                return {
                    "success": False,
                    "error": f"Video file not found: {video_path}",
                    "execution_time": time.time() - start_time
                }

            if not media_processor.available():
                return {
                    "success": False,
                    "error": ERROR_BINARY_NOT_FOUND,
                    "execution_time": time.time() - start_time
                }

            result = {
                "success": True,
                "video_path": video_path
            }

            # Extract video metadata
            metadata = self._get_video_metadata(video_path)
            result["video_metadata"] = metadata

            # Extract audio if requested
            extracted_audio_path = None
            if config.get("extract_audio", True):
                audio_format = config.get("audio_format", "wav")
                audio_result = self.extract_audio(video_path, audio_format)
                if audio_result.get("success"):
                    extracted_audio_path = audio_result.get("audio_path")
                    result["extracted_audio_path"] = extracted_audio_path
                    result["extracted_audio_format"] = audio_format
                else:
                    result["audio_extraction_error"] = audio_result.get("error")

            # Generate subtitle if requested
            if config.get("generate_subtitle", True) and extracted_audio_path:

                audio_processor = AudioProcessor()
                subtitle_format = config.get("subtitle_format", "srt")
                transcribe_language = config.get("transcribe_language", "en")

                transcribe_config = {
                    "engine": "whisper",
                    "model": "base",
                    "language": transcribe_language,
                    "generate_subtitle": True,
                    "subtitle_format": subtitle_format
                }

                transcribe_result = audio_processor.transcribe(extracted_audio_path, transcribe_config)
                if transcribe_result.get("success"):
                    result["subtitle_path"] = transcribe_result.get("subtitle_path")
                    result["subtitle_format"] = subtitle_format
                    result["transcription_text"] = transcribe_result.get("full_text")
                else:
                    result["subtitle_generation_error"] = transcribe_result.get("error")

            # Compress video if requested
            if config.get("compress_video", False):
                compress_crf = config.get("compress_crf", 23)
                compress_result = self.compress_video(video_path, compress_crf)
                if compress_result.get("success"):
                    result["compressed_video_path"] = compress_result.get("output_path")
                else:
                    result["compression_error"] = compress_result.get("error")

            result["execution_time"] = time.time() - start_time
            return result

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "execution_time": time.time() - start_time
            }

    def extract_audio(self, video_path: str, audio_format: str = "wav") -> Dict[str, Any]:
        """Extract audio from video"""
        try:

            # Determine output path
            video_name = Path(video_path).stem
            audio_path = self.output_dir / f"{video_name}_audio.{audio_format}"

            if audio_format == "wav":
                process_result = media_processor.convert_pcm(
                    video_path, audio_path, sample_rate=44100, channels=2)
            else:
                codec = {
                    "aac": ("aac", "128k"),
                    "m4a": ("aac", "128k"),
                    "mp3": ("libmp3lame", "192k"),
                    "ogg": ("libvorbis", "160k"),
                    "opus": ("libopus", "96k"),
                }.get(audio_format, ("libmp3lame", "192k"))
                process_result = media_processor.extract_audio(
                    video_path, audio_path, codec[0], codec[1], 44100, False)
            if not process_result.success:
                return {"success": False, "error": process_result.error_code}

            probe = media_processor.probe(audio_path)
            audio_duration = probe.duration
            audio_size = probe.size

            return {
                "success": True,
                "audio_path": str(audio_path),
                "audio_format": audio_format,
                "audio_duration": audio_duration,
                "audio_size": audio_size
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Audio extraction error: {str(e)}"
            }

    def compress_video(self, video_path: str, crf: int = 23) -> Dict[str, Any]:
        """Compress video using H.264"""
        try:

            # Determine output path
            video_name = Path(video_path).stem
            output_path = self.output_dir / f"{video_name}_compressed.mp4"

            process_result = media_processor.compress_video(
                video_path,
                output_path,
                encoder="libx264",
                preset="medium",
                quality=crf,
            )
            if not process_result.success:
                return {"success": False, "error": process_result.error_code}

            # Get file sizes
            original_size = Path(video_path).stat().st_size
            compressed_size = output_path.stat().st_size
            compression_ratio = (1 - compressed_size / original_size) * 100

            return {
                "success": True,
                "output_path": str(output_path),
                "original_size": original_size,
                "compressed_size": compressed_size,
                "compression_ratio": round(compression_ratio, 2)
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Video compression error: {str(e)}"
            }

    def _get_video_metadata(self, video_path: str) -> Dict[str, Any]:
        """Get video metadata using ffprobe"""
        try:

            probe = media_processor.probe(video_path)
            video_stream = probe.first_stream("video")

            if not video_stream:
                return {}

            return {
                "duration": probe.duration,
                "width": video_stream.width,
                "height": video_stream.height,
                "fps": video_stream.frame_rate,
                "codec": video_stream.codec_name,
                "bitrate": probe.bit_rate // 1000,
                "file_size": probe.size,
            }

        except Exception as e:
            return {"error": str(e)}
