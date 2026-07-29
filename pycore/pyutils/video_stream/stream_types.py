"""Video stream type definitions"""

from dataclasses import dataclass
from enum import Enum

from pycore.pyfoundations.third_party.api import get_third_package_numpy

# Get numpy via third_party manager
np = get_third_package_numpy()


class VideoFormat(Enum):
    """Video pixel format"""
    YUV420P = "yuv420p"
    RGB24 = "rgb24"
    BGR24 = "bgr24"


@dataclass
class VideoFrame:
    """Video frame data container"""
    data: np.ndarray        # Frame data (NumPy array)
    width: int              # Frame width
    height: int             # Frame height
    format: VideoFormat     # Pixel format
    pts: int                # Presentation timestamp
    key_frame: bool = False # Whether this is a key frame

    @property
    def shape(self) -> tuple:
        """Get frame shape"""
        return self.data.shape

    @property
    def size(self) -> int:
        """Get data size in bytes"""
        return self.data.nbytes

    def __repr__(self) -> str:
        return (
            f"VideoFrame(width={self.width}, height={self.height}, "
            f"format={self.format.value}, pts={self.pts}, key_frame={self.key_frame})"
        )
