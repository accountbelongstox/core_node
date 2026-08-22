from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Tuple


ProgressCallback = Callable[["FFmpegProgress"], None]
StopCallback = Callable[[], bool]
ProbeValidator = Callable[["MediaProbeResult"], bool]


@dataclass(frozen=True)
class FFmpegBinaries:
    ffmpeg: Optional[Path] = None
    ffprobe: Optional[Path] = None

    @property
    def available(self) -> bool:
        return self.ffmpeg is not None and self.ffprobe is not None


@dataclass(frozen=True)
class FFmpegProgress:
    frame: int = 0
    fps: float = 0.0
    speed: float = 0.0
    out_time_seconds: float = 0.0
    total_size: int = 0
    state: str = "continue"
    values: Dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class FFmpegProcessResult:
    success: bool = False
    command: Tuple[str, ...] = ()
    return_code: Optional[int] = None
    stdout: str = ""
    stderr: str = ""
    error_code: Optional[str] = None
    stopped: bool = False
    progress: Optional[FFmpegProgress] = None


@dataclass(frozen=True)
class FFmpegCommandResult:
    success: bool = False
    output_path: Optional[Path] = None
    skipped: bool = False
    recovered: bool = False
    error_code: Optional[str] = None
    process: Optional[FFmpegProcessResult] = None


@dataclass(frozen=True)
class MediaStreamInfo:
    index: int = -1
    codec_type: str = ""
    codec_name: str = ""
    width: int = 0
    height: int = 0
    channels: int = 0
    sample_rate: int = 0
    duration: float = 0.0
    bit_rate: int = 0
    frame_rate: float = 0.0
    tags: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class MediaProbeResult:
    success: bool = False
    path: Optional[Path] = None
    duration: float = 0.0
    size: int = 0
    bit_rate: int = 0
    format_name: str = ""
    streams: Tuple[MediaStreamInfo, ...] = ()
    raw: Dict[str, Any] = field(default_factory=dict)
    error_code: Optional[str] = None
    stderr: str = ""

    def has_stream(self, codec_type: str) -> bool:
        return any(stream.codec_type == codec_type for stream in self.streams)

    def first_stream(self, codec_type: str) -> Optional[MediaStreamInfo]:
        return next((stream for stream in self.streams if stream.codec_type == codec_type), None)
