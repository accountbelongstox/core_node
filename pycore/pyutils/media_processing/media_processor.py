from pathlib import Path
from typing import Optional, Tuple

from pycore.pyutils.common.ffmpeg.ffmpeg_command import ffmpeg_command_builder
from pycore.pyutils.common.ffmpeg.ffmpeg_constants import OPUS_SAMPLE_RATES
from pycore.pyutils.common.ffmpeg.ffmpeg_models import (
    FFmpegCommandResult,
    MediaProbeResult,
)
from pycore.pyutils.common.ffmpeg.ffmpeg_probe import ffmpeg_output_validator
from pycore.pyutils.common.ffmpeg.ffmpeg_runtime import ffmpeg_runtime


class MediaProcessor:
    def available(self) -> bool:
        return ffmpeg_runtime.available()

    def probe(self, media_path: str | Path) -> MediaProbeResult:
        return ffmpeg_runtime.probe(media_path)

    def duration(self, media_path: str | Path) -> float:
        return self.probe(media_path).duration

    def has_audio_stream(self, media_path: str | Path) -> Optional[bool]:
        probe = self.probe(media_path)
        return probe.has_stream("audio") if probe.success else None

    def is_tiny_video(self, media_path: str | Path) -> bool:
        stream = self.probe(media_path).first_stream("video")
        return stream is not None and stream.width <= 4 and stream.height <= 4

    def supports_encoder(self, encoder: str) -> bool:
        return ffmpeg_runtime.supports_encoder(encoder)

    def extract_audio(
        self,
        source: str | Path,
        output: str | Path,
        encoder: str,
        bitrate: str,
        sample_rate: int,
        mono: bool,
    ) -> FFmpegCommandResult:
        arguments = ffmpeg_command_builder.extract_audio(
            source,
            encoder,
            bitrate,
            sample_rate,
            mono,
        )
        output_rate = min(OPUS_SAMPLE_RATES, key=lambda rate: abs(rate - sample_rate)) if encoder == "libopus" else sample_rate
        codec_name = {
            "aac": "aac",
            "libmp3lame": "mp3",
            "libopus": "opus",
            "libvorbis": "vorbis",
        }.get(encoder, encoder)
        validator = ffmpeg_output_validator.audio(codec_name, output_rate, 1 if mono else 2)
        return ffmpeg_runtime.execute_output_step(
            arguments,
            output,
            expected_streams=("audio",),
            output_validator=validator,
        )

    def convert_pcm(
        self,
        source: str | Path,
        output: str | Path,
        sample_rate: int = 16000,
        channels: int = 1,
        start: float = 0.0,
    ) -> FFmpegCommandResult:
        arguments = ffmpeg_command_builder.convert_pcm(source, sample_rate, channels, start)
        validator = ffmpeg_output_validator.audio("pcm_s16le", sample_rate, channels)
        return ffmpeg_runtime.execute_output_step(
            arguments,
            output,
            expected_streams=("audio",),
            output_validator=validator,
        )

    def make_tiny_video(
        self,
        source: str | Path,
        output: str | Path,
        bitrate: str,
        sample_rate: int,
        mono: bool,
    ) -> FFmpegCommandResult:
        arguments = ffmpeg_command_builder.make_tiny_video(
            source,
            bitrate,
            sample_rate,
            mono,
        )
        return ffmpeg_runtime.execute_output_step(
            arguments,
            output,
            expected_streams=("video", "audio"),
            output_validator=ffmpeg_output_validator.tiny_video(sample_rate, 1 if mono else 2),
        )

    def compress_video(
        self,
        source: str | Path,
        output: str | Path,
        encoder: str = "libx264",
        preset: str = "veryfast",
        quality: int = 28,
        resolution: Optional[Tuple[int, int]] = None,
        audio_codec: str = "aac",
        audio_bitrate: str = "96k",
    ) -> FFmpegCommandResult:
        arguments = ffmpeg_command_builder.compress_video(
            source,
            encoder=encoder,
            preset=preset,
            quality=quality,
            resolution=resolution,
            audio_codec=audio_codec,
            audio_bitrate=audio_bitrate,
        )
        codec_name = "hevc" if encoder in {"libx265", "hevc_nvenc"} else "h264"
        validator = ffmpeg_output_validator.video(codec_name, resolution)
        return ffmpeg_runtime.execute_output_step(
            arguments,
            output,
            expected_streams=("video",),
            output_validator=validator,
        )

    def compress_full_video(
        self,
        source: str | Path,
        output: str | Path,
    ) -> FFmpegCommandResult:
        arguments = ffmpeg_command_builder.compress_full_video(source)
        return ffmpeg_runtime.execute_output_step(
            arguments,
            output,
            expected_streams=("video",),
            output_validator=ffmpeg_output_validator.video("h264", maximum_height=720),
        )

    def cut_video(
        self,
        source: str | Path,
        output: str | Path,
        start: float,
        duration: float,
        quality: int = 28,
        audio_bitrate: str = "96k",
        include_audio: bool = True,
    ) -> FFmpegCommandResult:
        arguments = ffmpeg_command_builder.cut_video(
            source,
            start,
            duration,
            quality,
            audio_bitrate,
            include_audio,
        )
        expected_streams = ("video", "audio") if include_audio else ("video",)
        return ffmpeg_runtime.execute_output_step(
            arguments,
            output,
            expected_streams=expected_streams,
            output_validator=ffmpeg_output_validator.duration(duration),
        )

    def cut_audio(
        self,
        source: str | Path,
        output: str | Path,
        start: float,
        duration: float,
        copy_stream: bool = True,
    ) -> FFmpegCommandResult:
        arguments = ffmpeg_command_builder.cut_audio(source, start, duration, copy_stream)
        return ffmpeg_runtime.execute_output_step(
            arguments,
            output,
            expected_streams=("audio",),
            output_validator=ffmpeg_output_validator.duration(duration),
        )


media_processor = MediaProcessor()
