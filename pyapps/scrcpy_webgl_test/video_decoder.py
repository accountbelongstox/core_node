"""
Video Decoder for Scrcpy WebGL Test

Independent H.264 -> YUV420P decoder using PyAV.
This is a standalone implementation for the WebGL test app.
"""

import av
import threading
from typing import Dict, Optional


class VideoDecoder:
    """H.264 to YUV420P decoder using PyAV"""

    def __init__(self):
        self.decoders = {}  # serial -> av.CodecContext
        self.locks = {}     # serial -> threading.Lock
        self.first_frame_decoded = {}  # serial -> bool

    def create_decoder(self, serial: str, hwaccel: Optional[str] = None):
        """Create H.264 decoder for device"""
        try:
            print(f"[VideoDecoder] Creating H.264 decoder for {serial}...")

            # Create codec context
            codec = av.CodecContext.create('h264', 'r')
            codec.thread_type = 'AUTO'
            codec.thread_count = 0  # Auto detect

            print(f"[VideoDecoder] [OK] Codec context created")
            print(f"[VideoDecoder] [OK] Multi-threading enabled (AUTO)")

            # Hardware acceleration
            if hwaccel:
                try:
                    codec.options = {'hwaccel': hwaccel}
                    print(f"[VideoDecoder] [OK] Hardware acceleration: {hwaccel}")
                except Exception as e:
                    print(f"[VideoDecoder] [X] Hardware acceleration failed: {e}")
                    print("[VideoDecoder] Falling back to software decoding")

            self.decoders[serial] = codec
            self.locks[serial] = threading.Lock()
            self.first_frame_decoded[serial] = False

            print(f"[VideoDecoder] [OK] Decoder created for {serial}")
            return codec

        except Exception as e:
            print(f"[VideoDecoder] [X] Failed to create decoder: {e}")
            import traceback
            traceback.print_exc()
            raise

    def decode_frame(self, serial: str, h264_data: bytes) -> Optional[Dict]:
        """
        Decode H.264 frame to YUV420P

        Returns:
            {
                'width': int,
                'height': int,
                'y_plane': bytes,
                'u_plane': bytes,
                'v_plane': bytes,
                'y_linesize': int,
                'u_linesize': int,
                'v_linesize': int,
                'pts': int,
                'format': 'yuv420p'
            }
            or None if decode failed
        """
        if serial not in self.decoders:
            self.create_decoder(serial)

        codec = self.decoders[serial]
        lock = self.locks[serial]
        is_first = not self.first_frame_decoded.get(serial, False)

        # Debug: Show first few bytes
        if len(h264_data) >= 8:
            header_hex = ' '.join(f'{b:02x}' for b in h264_data[:8])
            print(f"[VideoDecoder] Frame {len(h264_data)} bytes, header: {header_hex}")

        if is_first:
            self.first_frame_decoded[serial] = True
            print(f"[VideoDecoder] Decoding first frame ({len(h264_data)} bytes)...")

        try:
            with lock:
                # Parse raw H.264 data into packets first
                packets = codec.parse(h264_data)

                if not packets:
                    # Parser may buffer data
                    return None

                # Decode all packets from this chunk
                all_frames = []
                for packet in packets:
                    frames = codec.decode(packet)
                    all_frames.extend(frames)

                if not all_frames:
                    # Decoder may buffer frames
                    return None

                # Use first decoded frame
                frame = all_frames[0]

                if len(all_frames) > 1:
                    print(f"[VideoDecoder] Got {len(all_frames)} frames from {len(packets)} packets")

                print(f"[VideoDecoder] Frame: {frame.width}x{frame.height}, format: {frame.format.name}")

                if is_first:
                    print(f"[VideoDecoder] [OK] First frame decoded:")
                    print(f"  - Size: {frame.width}x{frame.height}")
                    print(f"  - Format: {frame.format.name}")
                    print(f"  - Planes: {len(frame.planes)}")

                # Convert to yuv420p if needed
                if frame.format.name != 'yuv420p':
                    if is_first:
                        print(f"[VideoDecoder] Converting {frame.format.name} -> yuv420p")
                    frame = frame.reformat(format='yuv420p')

                # Extract YUV planes - strip linesize padding for WebGL
                # WebGL doesn't support UNPACK_ROW_LENGTH, so we need tightly packed data
                width = frame.width
                height = frame.height

                y_linesize = frame.planes[0].line_size
                u_linesize = frame.planes[1].line_size
                v_linesize = frame.planes[2].line_size

                # Get raw plane data with padding
                y_plane_raw = bytes(frame.planes[0])
                u_plane_raw = bytes(frame.planes[1])
                v_plane_raw = bytes(frame.planes[2])

                if is_first:
                    print(f"[VideoDecoder] [OK] YUV planes extracted (with padding):")
                    print(f"  - Y: {len(y_plane_raw)} bytes (width={width}, linesize={y_linesize})")
                    print(f"  - U: {len(u_plane_raw)} bytes (width={width//2}, linesize={u_linesize})")
                    print(f"  - V: {len(v_plane_raw)} bytes (width={width//2}, linesize={v_linesize})")

                # Strip padding if linesize != width
                if y_linesize == width:
                    y_plane = y_plane_raw[:width * height]
                else:
                    # Extract row by row, skipping padding
                    y_plane = bytearray()
                    for row in range(height):
                        start = row * y_linesize
                        y_plane.extend(y_plane_raw[start:start + width])
                    y_plane = bytes(y_plane)

                if u_linesize == width // 2:
                    u_plane = u_plane_raw[:(width // 2) * (height // 2)]
                else:
                    u_plane = bytearray()
                    for row in range(height // 2):
                        start = row * u_linesize
                        u_plane.extend(u_plane_raw[start:start + (width // 2)])
                    u_plane = bytes(u_plane)

                if v_linesize == width // 2:
                    v_plane = v_plane_raw[:(width // 2) * (height // 2)]
                else:
                    v_plane = bytearray()
                    for row in range(height // 2):
                        start = row * v_linesize
                        v_plane.extend(v_plane_raw[start:start + (width // 2)])
                    v_plane = bytes(v_plane)

                if is_first:
                    print(f"[VideoDecoder] [OK] Padding stripped:")
                    print(f"  - Y: {len(y_plane)} bytes (expected: {width * height})")
                    print(f"  - U: {len(u_plane)} bytes (expected: {(width//2) * (height//2)})")
                    print(f"  - V: {len(v_plane)} bytes (expected: {(width//2) * (height//2)})")

                return {
                    'width': width,
                    'height': height,
                    'y_plane': y_plane,
                    'u_plane': u_plane,
                    'v_plane': v_plane,
                    'y_linesize': width,  # Now tightly packed
                    'u_linesize': width // 2,
                    'v_linesize': width // 2,
                    'pts': frame.pts or 0,
                    'format': 'yuv420p'
                }

        except Exception as e:
            print(f"[VideoDecoder] [X] Decode error for {serial}: {e}")
            if is_first:
                import traceback
                traceback.print_exc()
            return None

    def close_decoder(self, serial: str):
        """Close decoder for device"""
        if serial in self.decoders:
            try:
                codec = self.decoders[serial]
                list(codec.decode(None))  # Flush
            except Exception:
                pass

            del self.decoders[serial]
            if serial in self.locks:
                del self.locks[serial]
            if serial in self.first_frame_decoded:
                del self.first_frame_decoded[serial]

            print(f"[VideoDecoder] Decoder closed for {serial}")

    def close_all(self):
        """Close all decoders"""
        for serial in list(self.decoders.keys()):
            self.close_decoder(serial)
