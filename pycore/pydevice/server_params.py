"""
scrcpy Server Parameters

Defines all configuration parameters for scrcpy-server.
"""

from dataclasses import dataclass, field
from typing import Optional
from pycore.pydevice.device_info import VideoCodec


@dataclass
class ServerParams:
    """
    scrcpy-server configuration parameters

    These parameters control the video streaming and device control behavior.
    """

    # Video parameters
    max_size: int = 720  # Maximum video dimension (0 = unlimited)
    bit_rate: int = 8000000  # Bitrate in bits per second (8 Mbps default)
    max_fps: int = 60  # Maximum frames per second (0 = unlimited)
    codec: VideoCodec = VideoCodec.H264  # Video codec

    # Control parameters
    control: bool = True  # Enable device control
    show_touches: bool = False  # Show touch indicators on screen
    stay_awake: bool = True  # Keep screen on during streaming

    # Connection parameters
    tunnel_forward: bool = True  # Use forward tunneling (vs reverse)
    local_port: int = 0  # Local port (0 = auto-assign)

    # Experimental
    power_off_on_close: bool = False  # Power off screen when disconnecting
    display_id: int = 0  # Display ID for multi-display devices

    # Encoding
    encoder_name: Optional[str] = None  # Specific encoder (None = auto)
    video_source: str = "display"  # "display" or "camera"

    # Audio (future support)
    audio: bool = False  # Enable audio streaming (not yet implemented)
    audio_codec: str = "opus"  # Audio codec
    audio_bit_rate: int = 128000  # Audio bitrate

    def to_scrcpy_args(self) -> list[str]:
        """
        Convert parameters to scrcpy-server command-line arguments

        Returns:
            List of command-line arguments for scrcpy-server
        """
        args = []

        # Video quality
        if self.max_size > 0:
            args.extend(["-m", str(self.max_size)])

        if self.bit_rate > 0:
            args.extend(["-b", str(self.bit_rate)])

        if self.max_fps > 0:
            args.extend(["-r", str(self.max_fps)])

        # Codec
        if self.codec != VideoCodec.H264:
            args.extend(["--video-codec", self.codec.value])

        # Control
        if not self.control:
            args.append("--no-control")

        # Display settings
        if self.show_touches:
            args.append("--show-touches")

        if self.stay_awake:
            args.append("--stay-awake")

        if self.power_off_on_close:
            args.append("--power-off-on-close")

        # Advanced
        if self.display_id > 0:
            args.extend(["--display", str(self.display_id)])

        if self.encoder_name:
            args.extend(["--encoder", self.encoder_name])

        # Tunneling mode
        if not self.tunnel_forward:
            args.append("--tunnel-reverse")

        return args

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization"""
        return {
            "max_size": self.max_size,
            "bit_rate": self.bit_rate,
            "max_fps": self.max_fps,
            "codec": self.codec.value,
            "control": self.control,
            "show_touches": self.show_touches,
            "stay_awake": self.stay_awake,
            "tunnel_forward": self.tunnel_forward,
            "local_port": self.local_port,
            "power_off_on_close": self.power_off_on_close,
            "display_id": self.display_id,
            "encoder_name": self.encoder_name,
            "video_source": self.video_source,
            "audio": self.audio,
            "audio_codec": self.audio_codec,
            "audio_bit_rate": self.audio_bit_rate
        }

    @staticmethod
    def from_dict(data: dict) -> 'ServerParams':
        """Create ServerParams from dictionary"""
        codec_str = data.get("codec", "h264")
        try:
            codec = VideoCodec(codec_str)
        except ValueError:
            codec = VideoCodec.H264

        return ServerParams(
            max_size=data.get("max_size", 720),
            bit_rate=data.get("bit_rate", 8000000),
            max_fps=data.get("max_fps", 60),
            codec=codec,
            control=data.get("control", True),
            show_touches=data.get("show_touches", False),
            stay_awake=data.get("stay_awake", True),
            tunnel_forward=data.get("tunnel_forward", True),
            local_port=data.get("local_port", 0),
            power_off_on_close=data.get("power_off_on_close", False),
            display_id=data.get("display_id", 0),
            encoder_name=data.get("encoder_name"),
            video_source=data.get("video_source", "display"),
            audio=data.get("audio", False),
            audio_codec=data.get("audio_codec", "opus"),
            audio_bit_rate=data.get("audio_bit_rate", 128000)
        )


@dataclass
class QualityPreset:
    """Predefined quality presets for easy configuration"""

    name: str
    max_size: int
    bit_rate: int
    max_fps: int

    @staticmethod
    def high() -> 'QualityPreset':
        """High quality (1080p, 8 Mbps, 60 FPS)"""
        return QualityPreset(
            name="high",
            max_size=1080,
            bit_rate=8000000,
            max_fps=60
        )

    @staticmethod
    def medium() -> 'QualityPreset':
        """Medium quality (720p, 4 Mbps, 30 FPS)"""
        return QualityPreset(
            name="medium",
            max_size=720,
            bit_rate=4000000,
            max_fps=30
        )

    @staticmethod
    def low() -> 'QualityPreset':
        """Low quality (480p, 2 Mbps, 15 FPS)"""
        return QualityPreset(
            name="low",
            max_size=480,
            bit_rate=2000000,
            max_fps=15
        )

    def to_server_params(self) -> ServerParams:
        """Convert preset to ServerParams"""
        return ServerParams(
            max_size=self.max_size,
            bit_rate=self.bit_rate,
            max_fps=self.max_fps
        )
