"""Video decoder abstract base class"""

from abc import ABC, abstractmethod
from typing import Generator, Optional
from pycore.pyutils.video_stream.stream_types import VideoFrame


class VideoDecoder(ABC):
    """
    Video decoder abstract base class

    Design principles:
    1. Use generator pattern (avoid memory accumulation)
    2. Support streaming decode (decode as data arrives)
    3. Zero-copy preferred
    """

    @abstractmethod
    def feed(self, data: bytes):
        """
        Feed encoded data to decoder

        Args:
            data: H.264 or other codec encoded data
        """
        pass

    @abstractmethod
    def decode(self) -> Generator[VideoFrame, None, None]:
        """
        Decode video frames

        Yields:
            VideoFrame: Decoded video frames
        """
        pass

    @abstractmethod
    def flush(self) -> Generator[VideoFrame, None, None]:
        """
        Flush decoder buffer

        Yields:
            VideoFrame: Remaining frames in buffer
        """
        pass

    @abstractmethod
    def close(self):
        """Close decoder and release resources"""
        pass
