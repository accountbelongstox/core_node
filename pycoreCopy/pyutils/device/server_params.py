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
        return " ".join(args)
