"""scrcpy-server startup parameters configuration"""

from dataclasses import dataclass
from enum import Enum


class VideoCodec(Enum):
    """Video codec format"""
    H264 = "h264"
    H265 = "h265"
    AV1 = "av1"


@dataclass
class ServerParams:
    """
    scrcpy-server startup parameters

    Reference: https://github.com/Genymobile/scrcpy/blob/master/SERVER.md
    """
    max_size: int = 720                      # Maximum resolution (short side)
    bit_rate: int = 8000000                  # Bit rate (8Mbps)
    max_fps: int = 60                        # Maximum frame rate
    codec: VideoCodec = VideoCodec.H264      # Video codec
    control: bool = True                     # Enable control
    locked_video_orientation: int = -1       # Lock orientation (-1=auto)
    codec_options: str = "profile=baseline,level=3.1"  # Codec-specific options (default: H.264 baseline)

    def to_scrcpy_args(self) -> str:
        """
        Convert to scrcpy-server command line arguments

        Returns:
            Argument string, e.g.:
            "log_level=info max_size=720 bit_rate=8000000 ..."
        """
        args = [
            "log_level=info",
            f"max_size={self.max_size}",
            f"bit_rate={self.bit_rate}",
            f"max_fps={self.max_fps}",
            f"codec={self.codec.value}",
            f"control={str(self.control).lower()}",
            f"locked_video_orientation={self.locked_video_orientation}"
        ]

        # Add codec options if specified
        if self.codec_options:
            args.append(f"codec_options={self.codec_options}")

        return " ".join(args)

    @staticmethod
    def create_multi_device_optimized() -> 'ServerParams':
        """
        Create optimized parameters for multi-device scenarios

        Optimizations:
        - Lower resolution (480p) for faster encoding
        - H.264 baseline profile for better compatibility
        - Lower bitrate to reduce bandwidth
        - 30fps to reduce encoding load

        Returns:
            Optimized ServerParams for multi-device scenarios
        """
        return ServerParams(
            max_size=480,                                          # Lower resolution
            bit_rate=4000000,                                      # 4Mbps (reduced bandwidth)
            max_fps=30,                                            # 30fps (reduced load)
            codec=VideoCodec.H264,
            control=True,
            locked_video_orientation=-1,
            codec_options="profile=baseline,level=3.1"             # Baseline for compatibility
        )

    @staticmethod
    def create_default() -> 'ServerParams':
        """
        Create default parameters (high quality)

        Returns:
            Default ServerParams
        """
        return ServerParams(
            max_size=720,
            bit_rate=8000000,
            max_fps=60,
            codec=VideoCodec.H264,
            control=True,
            locked_video_orientation=-1,
            codec_options="profile=baseline,level=3.1"
        )
