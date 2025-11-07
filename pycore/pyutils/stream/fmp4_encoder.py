"""fMP4 encoder for browser MSE compatibility"""

import av
import numpy as np
from typing import Optional
from io import BytesIO

from .stream_types import VideoFrame, VideoFormat


class FMP4Encoder:
    """
    fMP4 (Fragmented MP4) encoder

    Purpose:
    - Encode YUV frames to fMP4 format
    - Compatible with browser MSE (Media Source Extensions)
    - Support streaming transmission

    MSE playback workflow:
    1. Send init segment (once)
    2. Continuously send media segments

    Reference:
    - https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API
    """

    def __init__(
        self,
        width: int,
        height: int,
        fps: int = 30,
        bitrate: int = 2000000
    ):
        """
        Initialize encoder

        Args:
            width: Video width
            height: Video height
            fps: Frame rate
            bitrate: Bit rate (bps)
        """
        self.width = width
        self.height = height
        self.fps = fps
        self.bitrate = bitrate

        self.codec: Optional[av.CodecContext] = None
        self.init_segment: Optional[bytes] = None
        self._frame_count = 0

        self._init_encoder()

    def _init_encoder(self):
        """Initialize H.264 encoder"""
        self.codec = av.CodecContext.create("libx264", "w")
        self.codec.width = self.width
        self.codec.height = self.height
        self.codec.pix_fmt = "yuv420p"
        self.codec.time_base = av.Fraction(1, self.fps)
        self.codec.framerate = self.fps
        self.codec.bit_rate = self.bitrate

        # H.264 configuration (low latency)
        self.codec.options = {
            "preset": "ultrafast",      # Fast encoding
            "tune": "zerolatency",      # Zero latency optimization
            "profile": "baseline",       # Baseline profile (best compatibility)
        }

        self.codec.open()

    def get_init_segment(self) -> bytes:
        """
        Get fMP4 initialization segment

        This segment only needs to be sent once, contains:
        - ftyp box (file type)
        - moov box (media metadata)

        Returns:
            Initialization segment (bytes)
        """
        if self.init_segment:
            return self.init_segment

        # Create temporary container to generate init segment
        buffer = BytesIO()
        container = av.open(buffer, mode="w", format="mp4")

        stream = container.add_stream("h264", rate=self.fps)
        stream.width = self.width
        stream.height = self.height
        stream.pix_fmt = "yuv420p"

        # Write header (generates ftyp + moov)
        container.close()

        self.init_segment = buffer.getvalue()
        return self.init_segment

    def encode(self, video_frame: VideoFrame) -> Optional[bytes]:
        """
        Encode single video frame

        Args:
            video_frame: YUV420P format video frame

        Returns:
            fMP4 media segment (bytes), or None if frame is buffered
        """
        if video_frame.format != VideoFormat.YUV420P:
            raise ValueError("Only YUV420P format is supported")

        # Create AVFrame
        frame = av.VideoFrame.from_ndarray(
            video_frame.data,
            format='yuv420p'
        )
        frame.pts = self._frame_count
        self._frame_count += 1

        # Encode
        packets = self.codec.encode(frame)

        if not packets:
            return None

        # Package as fMP4 segment (moof + mdat)
        buffer = BytesIO()
        container = av.open(buffer, mode="w", format="mp4")
        stream = container.add_stream(template=self.codec)

        for packet in packets:
            container.mux(packet)

        container.close()

        return buffer.getvalue()

    def flush(self) -> bytes:
        """Flush encoder, return remaining data"""
        packets = self.codec.encode(None)

        if not packets:
            return b""

        buffer = BytesIO()
        container = av.open(buffer, mode="w", format="mp4")
        stream = container.add_stream(template=self.codec)

        for packet in packets:
            container.mux(packet)

        container.close()

        return buffer.getvalue()

    def close(self):
        """Close encoder"""
        if self.codec:
            self.codec.close()
