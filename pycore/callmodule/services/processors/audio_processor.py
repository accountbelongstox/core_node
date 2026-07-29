# -*- coding: utf-8 -*-
"""
Audio Processor - Core logic for audio transcription and subtitle generation
"""

import time
from typing import Dict, Any, List
from pathlib import Path
from datetime import timedelta

from pycore.pyfoundations.system_paths import get_app_temp_dir

from pycore.pyutils.whisper_stt.whisper_provider import WhisperSTTProvider



class AudioProcessor:
    """Processor for audio transcription and subtitle generation"""

    def __init__(self):
        self._whisper_model = None
        self._vosk_model = None
        self.output_dir = get_app_temp_dir() / "audio"
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _get_whisper_provider(self):
        """Lazy load Whisper provider"""
        if self._whisper_model is None:
            try:
                self._whisper_model = WhisperSTTProvider()
            except ImportError:
                raise RuntimeError("Whisper provider not available. Check pycore.pyutils.whisper_stt")
        return self._whisper_model

    def _get_vosk_model(self):
        """Lazy load Vosk model"""
        try:
            # TODO: Initialize Vosk model
            raise NotImplementedError("Vosk integration not yet implemented")
        except ImportError:
            raise RuntimeError("Vosk not available. Install with: pip install vosk")

    def transcribe(self, audio_path: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transcribe audio file.

        Args:
            audio_path: Path to audio file
            config: Transcription configuration
                - engine: Transcription engine (whisper, vosk)
                - model: Model size for Whisper
                - language: Language code
                - generate_subtitle: Generate subtitle flag

        Returns:
            Dictionary with transcription result
        """
        start_time = time.time()

        try:
            # Check if audio exists
            if not Path(audio_path).exists():
                return {
                    "success": False,
                    "error": f"Audio file not found: {audio_path}",
                    "execution_time": time.time() - start_time
                }

            engine = config.get("engine", "whisper")
            model = config.get("model", "base")
            language = config.get("language", "en")
            generate_subtitle = config.get("generate_subtitle", False)

            # Perform transcription based on engine
            if engine == "whisper":
                result = self._transcribe_with_whisper(audio_path, model, language)
            elif engine == "vosk":
                result = self._transcribe_with_vosk(audio_path, language)
            else:
                return {
                    "success": False,
                    "error": f"Unknown transcription engine: {engine}",
                    "execution_time": time.time() - start_time
                }

            # Generate subtitle if requested
            if result.get("success") and generate_subtitle:
                subtitle_format = config.get("subtitle_format", "srt")
                subtitle_result = self.generate_subtitle(
                    result.get("segments", []),
                    subtitle_format,
                    audio_path
                )
                result["subtitle_path"] = subtitle_result.get("subtitle_path")

            result["execution_time"] = time.time() - start_time
            result["engine_used"] = engine
            result["model_used"] = model

            return result

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "execution_time": time.time() - start_time
            }

    def _transcribe_with_whisper(self, audio_path: str, model: str, language: str) -> Dict[str, Any]:
        """Transcribe using Whisper"""
        try:
            whisper_provider = self._get_whisper_provider()
            if not whisper_provider.initialize(model_name=model):
                return {
                    "success": False,
                    "error": "Failed to initialize Whisper",
                }

            result = whisper_provider.recognize_from_file(Path(audio_path), language=language)

            if not result or not result.get("success"):
                return {
                    "success": False,
                    "error": result.get("error", "Whisper transcription failed") if result else "Whisper transcription failed",
                }

            # Extract segments
            segments = []
            full_text_parts = []

            for seg in result.get("segments", []):
                segment = {
                    "start": seg.get("start", 0.0),
                    "end": seg.get("end", 0.0),
                    "text": seg.get("text", "").strip(),
                    "confidence": seg.get("confidence")
                }
                segments.append(segment)
                full_text_parts.append(segment["text"])

            return {
                "success": True,
                "full_text": result.get("text") or " ".join(full_text_parts),
                "segments": segments,
                "language": result.get("language", language),
                "audio_duration": None,
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Whisper error: {str(e)}"
            }

    def _transcribe_with_vosk(self, audio_path: str, language: str) -> Dict[str, Any]:
        """Transcribe using Vosk"""
        try:
            # TODO: Implement Vosk transcription
            return {
                "success": False,
                "error": "Vosk integration not yet implemented"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Vosk error: {str(e)}"
            }

    def generate_subtitle(self, segments: List[Dict], subtitle_format: str, base_name: str) -> Dict[str, Any]:
        """
        Generate subtitle file from transcription segments.

        Args:
            segments: List of transcription segments
            subtitle_format: Subtitle format (srt, vtt, ass)
            base_name: Base file name (without extension)

        Returns:
            Dictionary with subtitle generation result
        """
        try:
            # Determine output path
            base_path = Path(base_name).stem
            subtitle_path = self.output_dir / f"{base_path}.{subtitle_format}"

            if subtitle_format == "srt":
                content = self._generate_srt(segments)
            elif subtitle_format == "vtt":
                content = self._generate_vtt(segments)
            elif subtitle_format == "ass":
                content = self._generate_ass(segments)
            else:
                return {
                    "success": False,
                    "error": f"Unknown subtitle format: {subtitle_format}"
                }

            # Write subtitle file
            with open(subtitle_path, "w", encoding="utf-8") as f:
                f.write(content)

            return {
                "success": True,
                "subtitle_path": str(subtitle_path),
                "subtitle_format": subtitle_format,
                "segment_count": len(segments)
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Subtitle generation error: {str(e)}"
            }

    def _generate_srt(self, segments: List[Dict]) -> str:
        """Generate SRT subtitle format"""
        lines = []
        for i, seg in enumerate(segments, 1):
            start = self._format_srt_time(seg["start"])
            end = self._format_srt_time(seg["end"])
            text = seg["text"]

            lines.append(f"{i}")
            lines.append(f"{start} --> {end}")
            lines.append(text)
            lines.append("")  # Empty line between segments

        return "\n".join(lines)

    def _generate_vtt(self, segments: List[Dict]) -> str:
        """Generate WebVTT subtitle format"""
        lines = ["WEBVTT", ""]

        for seg in segments:
            start = self._format_vtt_time(seg["start"])
            end = self._format_vtt_time(seg["end"])
            text = seg["text"]

            lines.append(f"{start} --> {end}")
            lines.append(text)
            lines.append("")

        return "\n".join(lines)

    def _generate_ass(self, segments: List[Dict]) -> str:
        """Generate ASS subtitle format"""
        # Basic ASS header
        header = """[Script Info]
Title: Generated Subtitle
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

        lines = [header]
        for seg in segments:
            start = self._format_ass_time(seg["start"])
            end = self._format_ass_time(seg["end"])
            text = seg["text"]

            lines.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}")

        return "\n".join(lines)

    def _format_srt_time(self, seconds: float) -> str:
        """Format time for SRT (HH:MM:SS,mmm)"""
        td = timedelta(seconds=seconds)
        hours = td.seconds // 3600
        minutes = (td.seconds % 3600) // 60
        secs = td.seconds % 60
        millis = td.microseconds // 1000
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    def _format_vtt_time(self, seconds: float) -> str:
        """Format time for VTT (HH:MM:SS.mmm)"""
        td = timedelta(seconds=seconds)
        hours = td.seconds // 3600
        minutes = (td.seconds % 3600) // 60
        secs = td.seconds % 60
        millis = td.microseconds // 1000
        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"

    def _format_ass_time(self, seconds: float) -> str:
        """Format time for ASS (H:MM:SS.cc)"""
        td = timedelta(seconds=seconds)
        hours = td.seconds // 3600
        minutes = (td.seconds % 3600) // 60
        secs = td.seconds % 60
        centis = td.microseconds // 10000
        return f"{hours}:{minutes:02d}:{secs:02d}.{centis:02d}"
