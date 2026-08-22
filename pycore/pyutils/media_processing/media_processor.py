from pathlib import Path
from typing import Iterable, Optional, Tuple

from pycore.pyutils.common.ffmpeg.ffmpeg_command import ffmpeg_command_builder
from pycore.pyutils.common.ffmpeg.ffmpeg_constants import (
    AUDIO_ENCODER_CODECS,
    DEFAULT_MOBILE_VIDEO_RESOLUTION,
    DEFAULT_PROGRESS_BAR_HEIGHT,
    DEFAULT_PROGRESS_FILL_COLOR,
    DEFAULT_PROGRESS_TRACK_COLOR,
    DEFAULT_VIDEO_BACKGROUND_COLOR,
    DEFAULT_VIDEO_FRAME_RATE,
    ERROR_AUDIO_INPUT_INVALID,
    ERROR_SUBTITLE_INPUT_INVALID,
    OPUS_PROBE_SAMPLE_RATE,
    OPUS_SAMPLE_RATES,
    VIDEO_ENCODER_CODECS,
)
from pycore.pyutils.common.ffmpeg.ffmpeg_models import (
    FFmpegCommandResult,
    MediaProbeResult,
    SubtitleRenderSource,
    TimedTextCue,
    TimedTextStyle,
)
from pycore.pyutils.common.ffmpeg.ffmpeg_probe import ffmpeg_output_validator
from pycore.pyutils.common.ffmpeg.ffmpeg_runtime import ffmpeg_runtime
from pycore.pyutils.common.ffmpeg.ffmpeg_subtitle import ass_subtitle_writer


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
        probe_rate = OPUS_PROBE_SAMPLE_RATE if encoder == "libopus" else output_rate
        codec_name = AUDIO_ENCODER_CODECS.get(encoder, encoder)
        validator = ffmpeg_output_validator.audio(codec_name, probe_rate, 1 if mono else 2)
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
        codec_name = VIDEO_ENCODER_CODECS.get(encoder, encoder)
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

    def compose_subtitle_video(
        self,
        audio_source: str | Path,
        subtitle_source: str | Path,
        output: str | Path,
        resolution: Tuple[int, int] = DEFAULT_MOBILE_VIDEO_RESOLUTION,
        subtitle_stream_index: int = 0,
        subtitle_style: Optional[TimedTextStyle] = TimedTextStyle(),
        fonts_directory: Optional[str | Path] = None,
        frame_rate: int = DEFAULT_VIDEO_FRAME_RATE,
        background_color: str = DEFAULT_VIDEO_BACKGROUND_COLOR,
        encoder: str = "libx264",
        preset: str = "veryfast",
        quality: int = 23,
        audio_bitrate: str = "128k",
    ) -> FFmpegCommandResult:
        subtitle_path = Path(subtitle_source).expanduser().resolve()
        if not subtitle_path.is_file():
            return FFmpegCommandResult(
                output_path=Path(output).expanduser().resolve(),
                error_code=ERROR_SUBTITLE_INPUT_INVALID,
            )
        render_source = SubtitleRenderSource(
            path=subtitle_path,
            stream_index=subtitle_stream_index,
            force_style=subtitle_style,
        )
        return self._compose_audio_canvas(
            audio_source=audio_source,
            output=output,
            resolution=resolution,
            subtitle_sources=(render_source,),
            fonts_directory=fonts_directory,
            show_progress=False,
            frame_rate=frame_rate,
            background_color=background_color,
            encoder=encoder,
            preset=preset,
            quality=quality,
            audio_bitrate=audio_bitrate,
        )

    def compose_progress_text_video(
        self,
        audio_source: str | Path,
        output: str | Path,
        timed_text: Iterable[TimedTextCue] = (),
        subtitle_source: Optional[str | Path] = None,
        resolution: Tuple[int, int] = DEFAULT_MOBILE_VIDEO_RESOLUTION,
        subtitle_stream_index: int = 0,
        subtitle_style: Optional[TimedTextStyle] = TimedTextStyle(),
        fonts_directory: Optional[str | Path] = None,
        frame_rate: int = DEFAULT_VIDEO_FRAME_RATE,
        background_color: str = DEFAULT_VIDEO_BACKGROUND_COLOR,
        progress_track_color: str = DEFAULT_PROGRESS_TRACK_COLOR,
        progress_fill_color: str = DEFAULT_PROGRESS_FILL_COLOR,
        progress_bar_height: int = DEFAULT_PROGRESS_BAR_HEIGHT,
        encoder: str = "libx264",
        preset: str = "veryfast",
        quality: int = 23,
        audio_bitrate: str = "128k",
    ) -> FFmpegCommandResult:
        output_path = Path(output).expanduser().resolve()
        subtitle_sources = []
        if subtitle_source is not None:
            subtitle_path = Path(subtitle_source).expanduser().resolve()
            if not subtitle_path.is_file():
                return FFmpegCommandResult(
                    output_path=output_path,
                    error_code=ERROR_SUBTITLE_INPUT_INVALID,
                )
            subtitle_sources.append(SubtitleRenderSource(
                path=subtitle_path,
                stream_index=subtitle_stream_index,
                force_style=subtitle_style,
            ))
        timeline_path = output_path.parent / ".ffmpeg_inputs" / f"{output_path.name}.timeline.ass"
        generated_subtitle = ass_subtitle_writer.materialize(
            timed_text,
            timeline_path,
            resolution,
        )
        if generated_subtitle is not None:
            subtitle_sources.append(SubtitleRenderSource(path=generated_subtitle))
        return self._compose_audio_canvas(
            audio_source=audio_source,
            output=output_path,
            resolution=resolution,
            subtitle_sources=tuple(subtitle_sources),
            fonts_directory=fonts_directory,
            show_progress=True,
            frame_rate=frame_rate,
            background_color=background_color,
            progress_track_color=progress_track_color,
            progress_fill_color=progress_fill_color,
            progress_bar_height=progress_bar_height,
            encoder=encoder,
            preset=preset,
            quality=quality,
            audio_bitrate=audio_bitrate,
        )

    def _compose_audio_canvas(
        self,
        audio_source: str | Path,
        output: str | Path,
        resolution: Tuple[int, int],
        subtitle_sources: Tuple[SubtitleRenderSource, ...],
        fonts_directory: Optional[str | Path],
        show_progress: bool,
        frame_rate: int,
        background_color: str,
        encoder: str,
        preset: str,
        quality: int,
        audio_bitrate: str,
        progress_track_color: str = DEFAULT_PROGRESS_TRACK_COLOR,
        progress_fill_color: str = DEFAULT_PROGRESS_FILL_COLOR,
        progress_bar_height: int = DEFAULT_PROGRESS_BAR_HEIGHT,
    ) -> FFmpegCommandResult:
        audio_probe = self.probe(audio_source)
        if not audio_probe.success or not audio_probe.has_stream("audio") or audio_probe.duration <= 0:
            return FFmpegCommandResult(
                output_path=Path(output).expanduser().resolve(),
                error_code=ERROR_AUDIO_INPUT_INVALID,
            )
        arguments = ffmpeg_command_builder.compose_audio_canvas(
            audio_source=audio_source,
            duration=audio_probe.duration,
            resolution=resolution,
            subtitle_sources=subtitle_sources,
            fonts_directory=fonts_directory,
            show_progress=show_progress,
            frame_rate=frame_rate,
            background_color=background_color,
            progress_track_color=progress_track_color,
            progress_fill_color=progress_fill_color,
            progress_bar_height=progress_bar_height,
            encoder=encoder,
            preset=preset,
            quality=quality,
            audio_bitrate=audio_bitrate,
        )
        dependencies = [source.path for source in subtitle_sources]
        if fonts_directory is not None:
            dependencies.append(Path(fonts_directory).expanduser())
        codec_name = VIDEO_ENCODER_CODECS.get(encoder, encoder)
        return ffmpeg_runtime.execute_output_step(
            arguments,
            output,
            dependencies=dependencies,
            expected_streams=("video", "audio"),
            output_validator=ffmpeg_output_validator.audio_video(
                codec_name,
                resolution,
                audio_probe.duration,
            ),
        )


media_processor = MediaProcessor()
