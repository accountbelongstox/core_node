import json
import re
from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyutils.common.ffmpeg.ffmpeg_constants import (
    ERROR_INPUT_NOT_FOUND,
    ERROR_PROBE_FAILED,
)
from pycore.pyutils.common.ffmpeg.ffmpeg_models import (
    MediaProbeResult,
    MediaStreamInfo,
    ProbeValidator,
)
from pycore.pyutils.common.ffmpeg.ffmpeg_runner import ffmpeg_runner


_NUMBER_PATTERN = re.compile(r"^-?\d+(?:\.\d+)?$")
_FRACTION_PATTERN = re.compile(r"^-?\d+(?:\.\d+)?/-?\d+(?:\.\d+)?$")


class FFprobeClient:
    def probe(self, media_path: str | Path) -> MediaProbeResult:
        path = Path(media_path).expanduser().resolve()
        if not path.is_file():
            return MediaProbeResult(path=path, error_code=ERROR_INPUT_NOT_FOUND)

        process = ffmpeg_runner.run_ffprobe((
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(path),
        ))
        if not process.success or not process.stdout.strip():
            return MediaProbeResult(
                path=path,
                error_code=ERROR_PROBE_FAILED,
                stderr=process.stderr,
            )

        raw = json.loads(process.stdout)
        format_data = raw.get("format") or {}
        streams = tuple(self._stream_info(stream) for stream in (raw.get("streams") or []))
        return MediaProbeResult(
            success=bool(streams or format_data),
            path=path,
            duration=self._float_value(format_data.get("duration")),
            size=self._int_value(format_data.get("size")),
            bit_rate=self._int_value(format_data.get("bit_rate")),
            format_name=str(format_data.get("format_name") or ""),
            streams=streams,
            raw=raw,
        )

    def is_valid(self, media_path: str | Path, expected_streams: tuple[str, ...] = ()) -> bool:
        result = self.probe(media_path)
        return result.success and all(result.has_stream(stream_type) for stream_type in expected_streams)

    def _stream_info(self, stream: Dict[str, Any]) -> MediaStreamInfo:
        return MediaStreamInfo(
            index=self._int_value(stream.get("index"), default=-1),
            codec_type=str(stream.get("codec_type") or ""),
            codec_name=str(stream.get("codec_name") or ""),
            width=self._int_value(stream.get("width")),
            height=self._int_value(stream.get("height")),
            channels=self._int_value(stream.get("channels")),
            sample_rate=self._int_value(stream.get("sample_rate")),
            duration=self._float_value(stream.get("duration")),
            bit_rate=self._int_value(stream.get("bit_rate")),
            frame_rate=self._fraction_value(stream.get("avg_frame_rate") or stream.get("r_frame_rate")),
            tags=dict(stream.get("tags") or {}),
        )

    @staticmethod
    def _int_value(value: Any, default: int = 0) -> int:
        text = str(value or "").strip()
        return int(float(text)) if _NUMBER_PATTERN.fullmatch(text) else default

    @staticmethod
    def _float_value(value: Any) -> float:
        text = str(value or "").strip()
        return float(text) if _NUMBER_PATTERN.fullmatch(text) else 0.0

    @staticmethod
    def _fraction_value(value: Optional[str]) -> float:
        text = str(value or "").strip()
        if _NUMBER_PATTERN.fullmatch(text):
            return float(text)
        if not _FRACTION_PATTERN.fullmatch(text):
            return 0.0
        numerator, denominator = text.split("/", 1)
        denominator_value = float(denominator)
        return float(numerator) / denominator_value if denominator_value else 0.0


class FFmpegOutputValidator:
    @staticmethod
    def audio(codec_name: str, sample_rate: int, channels: int) -> ProbeValidator:
        def validate(probe: MediaProbeResult) -> bool:
            stream = probe.first_stream("audio")
            return (
                stream is not None
                and stream.codec_name == codec_name
                and stream.sample_rate == sample_rate
                and stream.channels == channels
            )

        return validate

    @staticmethod
    def tiny_video(sample_rate: int, channels: int) -> ProbeValidator:
        def validate(probe: MediaProbeResult) -> bool:
            video = probe.first_stream("video")
            audio = probe.first_stream("audio")
            return (
                video is not None
                and audio is not None
                and video.codec_name == "h264"
                and video.width <= 4
                and video.height <= 4
                and audio.codec_name == "aac"
                and audio.sample_rate == sample_rate
                and audio.channels == channels
            )

        return validate

    @staticmethod
    def video(
        codec_name: str,
        resolution: Optional[tuple[int, int]] = None,
        maximum_height: int = 0,
    ) -> ProbeValidator:
        def validate(probe: MediaProbeResult) -> bool:
            stream = probe.first_stream("video")
            if stream is None or stream.codec_name != codec_name:
                return False
            if resolution is not None and (stream.width, stream.height) != resolution:
                return False
            return not maximum_height or stream.height <= maximum_height

        return validate

    @staticmethod
    def duration(duration: float) -> ProbeValidator:
        def validate(probe: MediaProbeResult) -> bool:
            tolerance = max(1.0, duration * 0.02)
            return abs(probe.duration - duration) <= tolerance

        return validate

    @staticmethod
    def audio_video(
        codec_name: str,
        resolution: tuple[int, int],
        duration: float,
    ) -> ProbeValidator:
        def validate(probe: MediaProbeResult) -> bool:
            video = probe.first_stream("video")
            tolerance = max(1.0, duration * 0.02)
            return (
                video is not None
                and probe.has_stream("audio")
                and video.codec_name == codec_name
                and (video.width, video.height) == resolution
                and abs(probe.duration - duration) <= tolerance
            )

        return validate


ffprobe_client = FFprobeClient()
ffmpeg_output_validator = FFmpegOutputValidator()
