from pathlib import Path
from typing import Optional, Tuple

from pycore.pyutils.common.ffmpeg.ffmpeg_constants import (
    DEFAULT_PROGRESS_BAR_HEIGHT,
    DEFAULT_PROGRESS_FILL_COLOR,
    DEFAULT_PROGRESS_TRACK_COLOR,
    DEFAULT_VIDEO_BACKGROUND_COLOR,
    DEFAULT_VIDEO_FRAME_RATE,
    OPUS_SAMPLE_RATES,
)
from pycore.pyutils.common.ffmpeg.ffmpeg_models import SubtitleRenderSource
from pycore.pyutils.common.ffmpeg.ffmpeg_subtitle import ass_subtitle_writer


class FFmpegCommandBuilder:
    def extract_audio(
        self,
        source: str | Path,
        encoder: str,
        bitrate: str,
        sample_rate: int,
        mono: bool,
    ) -> Tuple[str, ...]:
        output_rate = min(OPUS_SAMPLE_RATES, key=lambda rate: abs(rate - sample_rate)) if encoder == "libopus" else sample_rate
        return (
            "-y", "-i", str(source), "-vn", "-map", "0:a:0?",
            "-ac", "1" if mono else "2", "-ar", str(output_rate),
            "-c:a", encoder, "-b:a", bitrate,
        )

    @staticmethod
    def convert_pcm(
        source: str | Path,
        sample_rate: int,
        channels: int,
        start: float = 0.0,
    ) -> Tuple[str, ...]:
        arguments = ["-y"]
        if start > 0:
            arguments.extend(("-ss", f"{start:.3f}"))
        arguments.extend((
            "-i", str(source), "-vn", "-map", "0:a:0?",
            "-ar", str(sample_rate), "-ac", str(channels), "-c:a", "pcm_s16le",
        ))
        return tuple(arguments)

    @staticmethod
    def make_tiny_video(
        source: str | Path,
        bitrate: str,
        sample_rate: int,
        mono: bool,
    ) -> Tuple[str, ...]:
        return (
            "-y", "-i", str(source), "-f", "lavfi", "-i", "color=c=black:s=2x2:r=1",
            "-map", "1:v:0", "-map", "0:a:0", "-c:v", "libx264",
            "-preset", "veryfast", "-tune", "stillimage", "-crf", "51",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", bitrate,
            "-ac", "1" if mono else "2", "-ar", str(sample_rate),
            "-shortest", "-movflags", "+faststart",
        )

    @staticmethod
    def compress_video(
        source: str | Path,
        encoder: str = "libx264",
        preset: str = "veryfast",
        quality: int = 28,
        resolution: Optional[Tuple[int, int]] = None,
        audio_codec: str = "aac",
        audio_bitrate: str = "96k",
    ) -> Tuple[str, ...]:
        arguments = ["-y", "-i", str(source), "-map", "0:v:0", "-map", "0:a:0?"]
        if resolution is not None:
            width, height = resolution
            arguments.extend(("-vf", f"scale={width}:{height}"))
        arguments.extend(("-c:v", encoder, "-preset", preset))
        if "nvenc" in encoder:
            arguments.extend(("-cq", str(quality), "-b:v", "0"))
        else:
            arguments.extend(("-crf", str(quality)))
        arguments.extend((
            "-pix_fmt", "yuv420p", "-c:a", audio_codec, "-b:a", audio_bitrate,
            "-movflags", "+faststart",
        ))
        return tuple(arguments)

    @staticmethod
    def compress_full_video(source: str | Path) -> Tuple[str, ...]:
        return (
            "-y", "-i", str(source), "-map", "0:v:0", "-map", "0:a:0?",
            "-vf", "scale=-2:min(720\\,ih)", "-c:v", "libx264", "-preset", "veryfast",
            "-crf", "28", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k",
            "-movflags", "+faststart",
        )

    def compose_audio_canvas(
        self,
        audio_source: str | Path,
        duration: float,
        resolution: Tuple[int, int],
        subtitle_sources: Tuple[SubtitleRenderSource, ...] = (),
        fonts_directory: Optional[str | Path] = None,
        show_progress: bool = False,
        frame_rate: int = DEFAULT_VIDEO_FRAME_RATE,
        background_color: str = DEFAULT_VIDEO_BACKGROUND_COLOR,
        progress_track_color: str = DEFAULT_PROGRESS_TRACK_COLOR,
        progress_fill_color: str = DEFAULT_PROGRESS_FILL_COLOR,
        progress_bar_height: int = DEFAULT_PROGRESS_BAR_HEIGHT,
        encoder: str = "libx264",
        preset: str = "veryfast",
        quality: int = 23,
        audio_bitrate: str = "128k",
    ) -> Tuple[str, ...]:
        width, height = resolution
        safe_duration = max(0.001, duration)
        safe_frame_rate = max(1, frame_rate)
        safe_bar_height = min(height, max(1, progress_bar_height))
        filter_steps = []
        if show_progress:
            filter_steps.extend((
                f"[0:v]drawbox=x=0:y=ih-{safe_bar_height}:w=iw:h={safe_bar_height}:color={self._video_color(progress_track_color)}:t=fill[canvas]",
                f"color=c={self._video_color(progress_fill_color)}:s={width}x{safe_bar_height}:r={safe_frame_rate}:d={safe_duration:.6f}[progress_bar]",
                f"[canvas][progress_bar]overlay=x='-overlay_w+overlay_w*min(t/{safe_duration:.6f},1)':y=main_h-overlay_h:shortest=1[progress]",
            ))
            current_label = "progress"
        else:
            filter_steps.append("[0:v]null[canvas]")
            current_label = "canvas"
        for index, subtitle_source in enumerate(subtitle_sources):
            output_label = f"subtitle_{index}"
            subtitle_filter = self._subtitle_filter(subtitle_source, fonts_directory)
            filter_steps.append(f"[{current_label}]{subtitle_filter}[{output_label}]")
            current_label = output_label
        filter_steps.append(f"[{current_label}]format=yuv420p[video]")
        arguments = [
            "-y",
            "-f", "lavfi",
            "-i", (
                f"color=c={self._video_color(background_color)}:"
                f"s={width}x{height}:r={safe_frame_rate}:d={safe_duration:.6f}"
            ),
            "-i", str(audio_source),
            "-filter_complex", ";".join(filter_steps),
            "-map", "[video]",
            "-map", "1:a:0",
            "-c:v", encoder,
            "-preset", preset,
        ]
        if "nvenc" in encoder:
            arguments.extend(("-cq", str(quality), "-b:v", "0"))
        else:
            arguments.extend(("-crf", str(quality)))
        arguments.extend((
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", audio_bitrate,
            "-t", f"{safe_duration:.6f}",
            "-shortest",
            "-movflags", "+faststart",
        ))
        return tuple(arguments)

    @staticmethod
    def cut_video(
        source: str | Path,
        start: float,
        duration: float,
        quality: int,
        audio_bitrate: str,
        include_audio: bool,
    ) -> Tuple[str, ...]:
        arguments = [
            "-y", "-ss", f"{start:.3f}", "-i", str(source), "-t", f"{duration:.3f}",
            "-map", "0:v:0",
        ]
        if include_audio:
            arguments.extend(("-map", "0:a:0?", "-c:a", "aac", "-b:a", audio_bitrate, "-ac", "2"))
        else:
            arguments.append("-an")
        arguments.extend((
            "-c:v", "libx264", "-preset", "veryfast", "-crf", str(quality),
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        ))
        return tuple(arguments)

    @staticmethod
    def cut_audio(
        source: str | Path,
        start: float,
        duration: float,
        copy_stream: bool,
    ) -> Tuple[str, ...]:
        arguments = [
            "-y", "-ss", f"{start:.3f}", "-i", str(source), "-t", f"{duration:.3f}",
        ]
        if copy_stream:
            arguments.extend(("-c", "copy"))
        else:
            arguments.extend(("-c:a", "libmp3lame", "-b:a", "32k"))
        return tuple(arguments)

    @staticmethod
    def _subtitle_filter(
        subtitle_source: SubtitleRenderSource,
        fonts_directory: Optional[str | Path],
    ) -> str:
        options = [
            f"filename='{FFmpegCommandBuilder._filter_path(subtitle_source.path)}'",
            f"si={max(0, subtitle_source.stream_index)}",
        ]
        if fonts_directory is not None:
            options.append(
                f"fontsdir='{FFmpegCommandBuilder._filter_path(fonts_directory)}'")
        if subtitle_source.force_style is not None:
            force_style = ass_subtitle_writer.force_style(subtitle_source.force_style)
            options.append(
                f"force_style='{FFmpegCommandBuilder._filter_quote(force_style)}'")
        return f"subtitles={':'.join(options)}"

    @staticmethod
    def _filter_path(path_value: str | Path) -> str:
        path = Path(path_value).expanduser().resolve().as_posix()
        return path.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")

    @staticmethod
    def _filter_quote(value: str) -> str:
        return value.replace("\\", "\\\\").replace("'", "\\'")

    @staticmethod
    def _video_color(value: str) -> str:
        color = value.strip()
        return f"0x{color[1:]}" if color.startswith("#") else color


ffmpeg_command_builder = FFmpegCommandBuilder()
