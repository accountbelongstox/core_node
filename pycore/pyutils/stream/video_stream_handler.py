"""
Video Stream Handler

This module handles video streaming from Android devices:
- Reads H.264 NAL units from ScrcpyDevice
- Parses SPS/PPS configuration
- Converts H.264 to fMP4 using FMP4EncoderComplete
- Provides async interface for streaming

Apps can use this or extend it for custom streaming logic.
"""

import asyncio
import struct
from typing import Optional, Callable, AsyncGenerator
from dataclasses import dataclass

from ...pyfoundations.device import ScrcpyDevice


@dataclass
class H264Config:
    """H.264 configuration extracted from stream"""
    sps: bytes
    pps: bytes
    width: int
    height: int


class VideoStreamHandler:
    """
    Handles video streaming from ScrcpyDevice to fMP4

    This class:
    - Reads H.264 NAL units from device
    - Parses configuration (SPS/PPS)
    - Converts to fMP4 format
    - Provides async streaming interface

    Usage:
        device = ScrcpyDevice(serial, params, adb_path)
        device.start_server()

        handler = VideoStreamHandler(device)
        await handler.start()

        async for fmp4_chunk in handler.stream_fmp4():
            # Send fmp4_chunk to WebSocket or file
            pass

        await handler.stop()
    """

    def __init__(self, device: ScrcpyDevice):
        """
        Initialize video stream handler

        Args:
            device: Connected ScrcpyDevice instance
        """
        self.device = device
        self.config: Optional[H264Config] = None
        self.encoder: Optional['FMP4EncoderComplete'] = None

        # Streaming control
        self._running = False
        self._stream_task: Optional[asyncio.Task] = None

        # Callbacks
        self._on_frame: Optional[Callable[[bytes], None]] = None
        self._on_error: Optional[Callable[[Exception], None]] = None

        # Frame counter
        self._frame_count = 0
        self._timestamp = 0

    async def start(self):
        """
        Start video stream processing

        This will parse the initial configuration (SPS/PPS)
        and initialize the fMP4 encoder.
        """
        if self._running:
            return

        # Parse H.264 configuration from first frames
        self.config = await self._parse_h264_config()

        # Initialize fMP4 encoder
        try:
            from .fmp4_encoder_complete import FMP4Encoder as FMP4EncoderComplete

            self.encoder = FMP4EncoderComplete(
                width=self.config.width,
                height=self.config.height,
                fps=60  # Default FPS, apps can change this
            )

            print(f"[VideoStreamHandler] Encoder initialized: {self.config.width}x{self.config.height}")

        except ImportError:
            print("[VideoStreamHandler] Warning: FMP4EncoderComplete not available")
            print("  Install required packages: pip install av numpy")
            self.encoder = None

        self._running = True
        print("[VideoStreamHandler] Started")

    async def stop(self):
        """Stop video stream processing"""
        self._running = False

        if self._stream_task:
            self._stream_task.cancel()
            try:
                await self._stream_task
            except asyncio.CancelledError:
                pass

        print("[VideoStreamHandler] Stopped")

    def get_init_segment(self) -> Optional[bytes]:
        """
        Get fMP4 initialization segment

        This should be sent once to the client before media segments.

        Returns:
            fMP4 init segment or None if encoder not ready
        """
        if not self.encoder or not self.config:
            return None

        return self.encoder.generate_init_segment(
            self.config.sps,
            self.config.pps
        )

    async def stream_fmp4(self) -> AsyncGenerator[bytes, None]:
        """
        Stream fMP4 media segments

        Yields:
            fMP4 media segment bytes

        Usage:
            async for chunk in handler.stream_fmp4():
                await websocket.send_bytes(chunk)
        """
        if not self._running:
            raise RuntimeError("Stream not started. Call start() first.")

        if not self.encoder:
            raise RuntimeError("fMP4 encoder not available")

        while self._running:
            try:
                # Read H.264 frame from device
                frame_data = await asyncio.to_thread(self.device.read_video_frame)

                if not frame_data:
                    # Connection closed
                    break

                # Parse NAL unit type
                nal_type = self._get_nal_type(frame_data)
                is_keyframe = (nal_type == 5)  # IDR frame

                # Generate fMP4 media segment
                media_segment = self.encoder.generate_media_segment(
                    frame_data,
                    self._timestamp,
                    is_keyframe
                )

                # Update timestamp (assume 60 FPS = 16.67ms per frame)
                self._timestamp += int(1000 / 60)
                self._frame_count += 1

                # Callback
                if self._on_frame:
                    self._on_frame(frame_data)

                yield media_segment

            except Exception as e:
                print(f"[VideoStreamHandler] Error streaming: {e}")
                if self._on_error:
                    self._on_error(e)
                break

    async def stream_raw_h264(self) -> AsyncGenerator[bytes, None]:
        """
        Stream raw H.264 frames (without fMP4 conversion)

        Yields:
            Raw H.264 frame bytes

        Usage:
            async for frame in handler.stream_raw_h264():
                # Process raw H.264 frame
                pass
        """
        if not self._running:
            raise RuntimeError("Stream not started. Call start() first.")

        while self._running:
            try:
                # Read H.264 frame from device
                frame_data = await asyncio.to_thread(self.device.read_video_frame)

                if not frame_data:
                    # Connection closed
                    break

                self._frame_count += 1

                # Callback
                if self._on_frame:
                    self._on_frame(frame_data)

                yield frame_data

            except Exception as e:
                print(f"[VideoStreamHandler] Error streaming: {e}")
                if self._on_error:
                    self._on_error(e)
                break

    def on_frame(self, callback: Callable[[bytes], None]):
        """
        Register callback for each frame

        Args:
            callback: Function called with frame data
        """
        self._on_frame = callback

    def on_error(self, callback: Callable[[Exception], None]):
        """
        Register callback for errors

        Args:
            callback: Function called with exception
        """
        self._on_error = callback

    # ========================================================================
    # Private Methods
    # ========================================================================

    async def _parse_h264_config(self) -> H264Config:
        """
        Parse H.264 configuration (SPS/PPS) from stream

        Returns:
            H264Config with SPS, PPS, width, height
        """
        sps = None
        pps = None

        # Read frames until we find SPS and PPS
        max_attempts = 50
        attempts = 0

        while (not sps or not pps) and attempts < max_attempts:
            frame_data = await asyncio.to_thread(self.device.read_video_frame)
            if not frame_data:
                raise RuntimeError("Failed to read configuration from stream")

            nal_type = self._get_nal_type(frame_data)

            if nal_type == 7:  # SPS
                sps = frame_data
                print(f"[VideoStreamHandler] Found SPS ({len(sps)} bytes)")
            elif nal_type == 8:  # PPS
                pps = frame_data
                print(f"[VideoStreamHandler] Found PPS ({len(pps)} bytes)")

            attempts += 1

        if not sps or not pps:
            raise RuntimeError("Failed to parse H.264 configuration")

        # Parse resolution from SPS (simplified)
        # Real implementation would fully parse SPS structure
        width = self.device.info.resolution.width if self.device.info else 1080
        height = self.device.info.resolution.height if self.device.info else 1920

        return H264Config(
            sps=sps,
            pps=pps,
            width=width,
            height=height
        )

    def _get_nal_type(self, nal_unit: bytes) -> int:
        """
        Extract NAL unit type from NAL unit

        Args:
            nal_unit: NAL unit bytes

        Returns:
            NAL type (0-31)
        """
        if len(nal_unit) == 0:
            return 0

        # NAL type is in the lower 5 bits of first byte
        return nal_unit[0] & 0x1F

    @property
    def frame_count(self) -> int:
        """Get total frames processed"""
        return self._frame_count

    @property
    def is_running(self) -> bool:
        """Check if stream is running"""
        return self._running
