from pathlib import Path
from typing import Optional, Tuple

from pycore.pyutils.common.ffmpeg.ffmpeg_constants import OPUS_SAMPLE_RATES


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


ffmpeg_command_builder = FFmpegCommandBuilder()
