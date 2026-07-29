"""FFmpeg-based H.264 decoder for YUV streaming"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from typing import Optional, Dict
import threading

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_av

# Lazy-load av to follow third_party conventions
av = get_third_package_av()


class VideoDecoderService:
    """
    H.264 → YUV420P 解码服务

    使用 PyAV (FFmpeg Python bindings) 解码 H.264 帧到 YUV420P
    提供高效的视频解码，用于 WebGL YUV 渲染

    流程:
        H.264 NAL Units → FFmpeg Decoder → YUV420P (3 planes: Y, U, V)
    """

    _instance: Optional['VideoDecoderService'] = None

    def __init__(self):
        self.decoders: Dict[str, av.CodecContext] = {}
        self.decode_locks: Dict[str, threading.Lock] = {}
        # Track decoder state to suppress repeated errors and wait for keyframes
        self.decoder_states: Dict[str, Dict] = {}
        # TEMPORARY: Disable keyframe waiting if it causes issues
        # Set to True to enable keyframe synchronization (more reliable but slower startup)
        # Set to False for immediate decode (faster but may have initial errors)
        self.enable_keyframe_sync = False  # Disabled by default until keyframe detection is fixed

    @classmethod
    def instance(cls) -> 'VideoDecoderService':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def create_decoder(
        self,
        serial: str,
        hwaccel: Optional[str] = None
    ) -> av.CodecContext:
        """
        创建 H.264 解码器

        Args:
            serial: 设备序列号
            hwaccel: 硬件加速类型
                - None: 软件解码
                - 'cuda': NVIDIA GPU
                - 'qsv': Intel Quick Sync Video
                - 'dxva2': DirectX Video Acceleration (Windows)
                - 'vaapi': Video Acceleration API (Linux)
                - 'videotoolbox': Apple VideoToolbox (macOS)

        Returns:
            av.CodecContext
        """
        if serial in self.decoders:
            ColorPrint.blue(f"[VideoDecoder] Reusing existing decoder for {serial}")
            return self.decoders[serial]

        try:
            ColorPrint.blue(f"[VideoDecoder] Creating H.264 decoder for {serial}...")
            codec = av.CodecContext.create('h264', 'r')
            ColorPrint.green(f"[VideoDecoder] ✓ Codec context created")

            # 多线程解码
            codec.thread_type = 'AUTO'
            codec.thread_count = 0  # 自动选择线程数
            ColorPrint.green(f"[VideoDecoder] ✓ Multi-threading enabled (AUTO)")

            # 硬件加速
            if hwaccel:
                try:
                    codec.options = {'hwaccel': hwaccel}
                    ColorPrint.green(f"[VideoDecoder] ✓ Hardware acceleration enabled: {hwaccel}")
                except Exception as e:
                    ColorPrint.yellow(f"[VideoDecoder] ✗ Hardware acceleration {hwaccel} failed: {e}")
                    ColorPrint.yellow("[VideoDecoder] ⚠ Falling back to software decoding")

            self.decoders[serial] = codec
            self.decode_locks[serial] = threading.Lock()

            ColorPrint.green(f"[VideoDecoder] ✓ Decoder created successfully for {serial}")
            return codec

        except Exception as e:
            ColorPrint.red(f"[VideoDecoder] ✗ Failed to create decoder: {e}")
            import traceback
            traceback.print_exc()
            raise

    def decode_frame(
        self,
        serial: str,
        h264_data: bytes,
        create_if_not_exists: bool = True
    ) -> Optional[Dict]:
        """
        解码 H.264 帧到 YUV420P

        Args:
            serial: 设备序列号
            h264_data: H.264 NAL Units
            create_if_not_exists: 如果解码器不存在，是否自动创建

        Returns:
            {
                'width': int,
                'height': int,
                'y_plane': bytes,       # Y 平面数据
                'u_plane': bytes,       # U 平面数据
                'v_plane': bytes,       # V 平面数据
                'y_linesize': int,      # Y 平面每行字节数
                'u_linesize': int,      # U 平面每行字节数
                'v_linesize': int,      # V 平面每行字节数
                'pts': int,             # 显示时间戳
                'format': str           # 'yuv420p'
            }
            or None if decode failed
        """
        if serial not in self.decoders:
            if create_if_not_exists:
                self.create_decoder(serial)
            else:
                return None

        codec = self.decoders[serial]
        lock = self.decode_locks[serial]

        # Initialize decoder state tracking for this device
        if serial not in self.decoder_states:
            import time
            self.decoder_states[serial] = {
                'error_count': 0,
                'last_error_time': 0,
                'waiting_for_keyframe': self.enable_keyframe_sync,  # Only wait if sync is enabled
                'successful_decodes': 0,
                'first_frame_decoded': False,
                'keyframe_wait_start': time.time()  # Track when we started waiting
            }

        state = self.decoder_states[serial]

        # Track first frame decode
        is_first_frame = not state['first_frame_decoded']
        if is_first_frame:
            state['first_frame_decoded'] = True
            ColorPrint.blue(f"[VideoDecoder] Decoding first frame ({len(h264_data)} bytes)...")

        try:
            with lock:
                # Use parse method to convert raw H.264 data into correct packets
                # parse() handles NAL units and returns complete packets
                packets = codec.parse(h264_data)

                if not packets:
                    # Parser may buffer data, waiting for more data
                    return None

                # Decode all packets
                all_frames = []
                import time
                current_time = time.time()

                # Check if we've been waiting for keyframe too long (5 second timeout)
                # Or if keyframe sync is disabled, skip waiting immediately
                if state['waiting_for_keyframe']:
                    if not self.enable_keyframe_sync:
                        # Keyframe sync disabled, force decode start immediately
                        state['waiting_for_keyframe'] = False
                        ColorPrint.blue(f"[VideoDecoder] Keyframe sync disabled, starting decode immediately for {serial}")
                    else:
                        wait_duration = current_time - state.get('keyframe_wait_start', current_time)
                        if wait_duration > 5.0:
                            ColorPrint.yellow(f"[VideoDecoder] ⚠ Keyframe wait timeout ({wait_duration:.1f}s), forcing decode start for {serial}")
                            state['waiting_for_keyframe'] = False

                for packet in packets:
                    # Try multiple ways to detect keyframe
                    # PyAV may use different attribute names
                    is_keyframe = False
                    if hasattr(packet, 'is_keyframe'):
                        is_keyframe = packet.is_keyframe
                    elif hasattr(packet, 'is_key'):
                        is_keyframe = packet.is_key
                    elif hasattr(packet, 'key_frame'):
                        is_keyframe = packet.key_frame

                    # If decoder is waiting for keyframe and this is not one, skip it
                    # (Only if keyframe sync is enabled)
                    if self.enable_keyframe_sync and state['waiting_for_keyframe'] and not is_keyframe:
                        # Suppress frequent warning logging
                        if current_time - state['last_error_time'] > 2.0:  # Log once every 2 seconds
                            ColorPrint.yellow(f"[VideoDecoder] ⚠ Waiting for key frame for {serial}, skipping non-keyframe...")
                            state['last_error_time'] = current_time
                        continue

                    # Try to decode
                    try:
                        frames = codec.decode(packet)
                        all_frames.extend(frames)

                        # If we successfully decoded from this packet, mark as synchronized
                        if frames:
                            if state['waiting_for_keyframe']:
                                ColorPrint.green(f"[VideoDecoder] ✓ Key frame received and decoded for {serial}, decoder synchronized")
                            state['waiting_for_keyframe'] = False
                            state['error_count'] = 0
                            state['consecutive_decode_failures'] = 0
                    except Exception as decode_err:
                        # Track consecutive failures
                        if 'consecutive_decode_failures' not in state:
                            state['consecutive_decode_failures'] = 0
                        state['consecutive_decode_failures'] += 1

                        # If decode fails, only enable keyframe waiting if sync is enabled
                        if self.enable_keyframe_sync and not state['waiting_for_keyframe']:
                            ColorPrint.yellow(f"[VideoDecoder] Decode failed, will wait for next keyframe: {decode_err}")
                            state['waiting_for_keyframe'] = True
                            state['keyframe_wait_start'] = time.time()
                        elif not self.enable_keyframe_sync:
                            # Keyframe sync disabled, just continue trying
                            # After many consecutive failures, just log once
                            if state['consecutive_decode_failures'] <= 5 or state['consecutive_decode_failures'] % 20 == 0:
                                ColorPrint.yellow(f"[VideoDecoder] Decode failed (#{state['consecutive_decode_failures']} consecutive), will keep trying: {decode_err}")
                        continue

                if not all_frames:
                    # Decoder may buffer frames, waiting for subsequent data
                    if is_first_frame:
                        ColorPrint.yellow(f"[VideoDecoder] ⚠ First frame decode returned no frames")
                    return None

                # Use the first decoded frame
                frame = all_frames[0]

                if len(all_frames) > 1:
                    ColorPrint.blue(f"[VideoDecoder] Got {len(all_frames)} frames from {len(packets)} packets")

                if is_first_frame:
                    ColorPrint.green(f"[VideoDecoder] ✓ First frame decoded:")
                    ColorPrint.green(f"  - Size: {frame.width}x{frame.height}")
                    ColorPrint.green(f"  - Format: {frame.format.name}")
                    ColorPrint.green(f"  - Planes: {len(frame.planes)}")

                # Ensure format is yuv420p
                if frame.format.name != 'yuv420p':
                    if is_first_frame:
                        ColorPrint.blue(f"[VideoDecoder] Converting {frame.format.name} → yuv420p")
                    frame = frame.reformat(format='yuv420p')

                # Extract YUV plane data (strip linesize padding)
                # WebGL 1.0 doesn't support UNPACK_ROW_LENGTH, must use tightly-packed data
                width = frame.width
                height = frame.height

                y_linesize = frame.planes[0].line_size
                u_linesize = frame.planes[1].line_size
                v_linesize = frame.planes[2].line_size

                # Get raw plane data (with padding)
                y_plane_raw = bytes(frame.planes[0])
                u_plane_raw = bytes(frame.planes[1])
                v_plane_raw = bytes(frame.planes[2])

                if is_first_frame:
                    ColorPrint.green(f"[VideoDecoder] [OK] YUV planes extracted (with padding):")
                    ColorPrint.green(f"  - Y: {len(y_plane_raw)} bytes (width={width}, linesize={y_linesize})")
                    ColorPrint.green(f"  - U: {len(u_plane_raw)} bytes (width={width//2}, linesize={u_linesize})")
                    ColorPrint.green(f"  - V: {len(v_plane_raw)} bytes (width={width//2}, linesize={v_linesize})")

                # Strip Y plane padding
                if y_linesize == width:
                    y_plane = y_plane_raw[:width * height]
                else:
                    # Extract row by row, skipping padding
                    y_plane = bytearray()
                    for row in range(height):
                        start = row * y_linesize
                        y_plane.extend(y_plane_raw[start:start + width])
                    y_plane = bytes(y_plane)

                # Strip U plane padding
                if u_linesize == width // 2:
                    u_plane = u_plane_raw[:(width // 2) * (height // 2)]
                else:
                    u_plane = bytearray()
                    for row in range(height // 2):
                        start = row * u_linesize
                        u_plane.extend(u_plane_raw[start:start + (width // 2)])
                    u_plane = bytes(u_plane)

                # Strip V plane padding
                if v_linesize == width // 2:
                    v_plane = v_plane_raw[:(width // 2) * (height // 2)]
                else:
                    v_plane = bytearray()
                    for row in range(height // 2):
                        start = row * v_linesize
                        v_plane.extend(v_plane_raw[start:start + (width // 2)])
                    v_plane = bytes(v_plane)

                if is_first_frame:
                    ColorPrint.green(f"[VideoDecoder] [OK] Padding stripped:")
                    ColorPrint.green(f"  - Y: {len(y_plane)} bytes (expected: {width * height})")
                    ColorPrint.green(f"  - U: {len(u_plane)} bytes (expected: {(width//2) * (height//2)})")
                    ColorPrint.green(f"  - V: {len(v_plane)} bytes (expected: {(width//2) * (height//2)})")

                # Update successful decode counter
                state['successful_decodes'] += 1

                return {
                    'width': width,
                    'height': height,
                    'y_plane': y_plane,
                    'u_plane': u_plane,
                    'v_plane': v_plane,
                    'y_linesize': width,        # Return packed linesize (equals width)
                    'u_linesize': width // 2,   # Return packed linesize (equals u_width)
                    'v_linesize': width // 2,   # Return packed linesize (equals v_width)
                    'pts': frame.pts or 0,
                    'format': 'yuv420p'
                }

        except Exception as e:
            state['error_count'] += 1

            # Improved error logging - only log first error, every 5th/50th error
            # This prevents log spam while still providing visibility
            should_log = (
                state['error_count'] == 1 or
                (state['error_count'] <= 30 and state['error_count'] % 5 == 0) or
                (state['error_count'] > 30 and state['error_count'] % 50 == 0)
            )

            if should_log:
                # Check if enough time has passed since last error log (rate limiting)
                import time
                current_time = time.time()
                if current_time - state['last_error_time'] > 1.0:  # Max 1 log per second
                    ColorPrint.red(f"[VideoDecoder] ✗ Decode error for {serial} (#{state['error_count']}, success: {state['successful_decodes']}): {e}")
                    state['last_error_time'] = current_time

                    # Only print stack trace for first error
                    if state['error_count'] == 1:
                        import traceback
                        traceback.print_exc()

            # Mark decoder as waiting for keyframe after errors (only if sync enabled)
            if self.enable_keyframe_sync:
                state['waiting_for_keyframe'] = True

            return None

    def flush_decoder(self, serial: str):
        """Flush decoder to reset internal state"""
        if serial in self.decoders:
            try:
                codec = self.decoders[serial]
                # Flush decoder by sending None
                list(codec.decode(None))
                # Re-open to reset state
                codec.close()
                codec.open()
                ColorPrint.green(f"[VideoDecoder] Decoder flushed and reset for {serial}")

                # Reset decoder state tracking
                if serial in self.decoder_states:
                    import time
                    self.decoder_states[serial] = {
                        'error_count': 0,
                        'last_error_time': 0,
                        'waiting_for_keyframe': self.enable_keyframe_sync,  # Only wait if sync is enabled
                        'successful_decodes': 0,
                        'first_frame_decoded': False,
                        'keyframe_wait_start': time.time()
                    }
                    if self.enable_keyframe_sync:
                        ColorPrint.blue(f"[VideoDecoder] Decoder state reset for {serial}, waiting for keyframe")
                    else:
                        ColorPrint.blue(f"[VideoDecoder] Decoder state reset for {serial}, keyframe sync disabled")

            except Exception as e:
                ColorPrint.yellow(f"[VideoDecoder] Error flushing decoder for {serial}: {e}")

    def close_decoder(self, serial: str):
        """Close decoder"""
        if serial in self.decoders:
            try:
                codec = self.decoders[serial]
                # Flush decoder
                list(codec.decode(None))
            except Exception:
                pass

            del self.decoders[serial]

            if serial in self.decode_locks:
                del self.decode_locks[serial]

            # Clean up decoder state tracking
            if serial in self.decoder_states:
                del self.decoder_states[serial]

            ColorPrint.blue(f"[VideoDecoder] Decoder closed for {serial}")

    def close_all(self):
        """Close all decoders"""
        for serial in list(self.decoders.keys()):
            self.close_decoder(serial)
