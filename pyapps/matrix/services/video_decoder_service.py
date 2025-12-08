"""FFmpeg-based H.264 decoder for YUV streaming"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from typing import Optional, Dict
import threading

from pycore.pyfoundations.third_party import get_third_package_av

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
            print(f"[VideoDecoder] Reusing existing decoder for {serial}")
            return self.decoders[serial]

        try:
            print(f"[VideoDecoder] Creating H.264 decoder for {serial}...")
            codec = av.CodecContext.create('h264', 'r')
            print(f"[VideoDecoder] ✓ Codec context created")

            # 多线程解码
            codec.thread_type = 'AUTO'
            codec.thread_count = 0  # 自动选择线程数
            print(f"[VideoDecoder] ✓ Multi-threading enabled (AUTO)")

            # 硬件加速
            if hwaccel:
                try:
                    codec.options = {'hwaccel': hwaccel}
                    print(f"[VideoDecoder] ✓ Hardware acceleration enabled: {hwaccel}")
                except Exception as e:
                    print(f"[VideoDecoder] ✗ Hardware acceleration {hwaccel} failed: {e}")
                    print("[VideoDecoder] ⚠ Falling back to software decoding")

            self.decoders[serial] = codec
            self.decode_locks[serial] = threading.Lock()

            print(f"[VideoDecoder] ✓ Decoder created successfully for {serial}")
            return codec

        except Exception as e:
            print(f"[VideoDecoder] ✗ Failed to create decoder: {e}")
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

        # Track first frame decode
        is_first_frame = not hasattr(self, '_first_frame_decoded')
        if is_first_frame:
            self._first_frame_decoded = True
            print(f"[VideoDecoder] Decoding first frame ({len(h264_data)} bytes)...")

        try:
            with lock:
                # 创建 AVPacket
                packet = av.Packet(h264_data)

                # 发送到解码器
                codec.decode(packet)

                # 接收解码后的帧
                frames = list(codec.decode(packet))
                if not frames:
                    if is_first_frame:
                        print(f"[VideoDecoder] ⚠ First frame decode returned no frames")
                    return None

                frame = frames[0]

                if is_first_frame:
                    print(f"[VideoDecoder] ✓ First frame decoded:")
                    print(f"  - Size: {frame.width}x{frame.height}")
                    print(f"  - Format: {frame.format.name}")
                    print(f"  - Planes: {len(frame.planes)}")

                # 确保格式为 yuv420p
                if frame.format.name != 'yuv420p':
                    if is_first_frame:
                        print(f"[VideoDecoder] Converting {frame.format.name} → yuv420p")
                    frame = frame.reformat(format='yuv420p')

                # 提取 YUV 平面数据
                y_plane = bytes(frame.planes[0])
                u_plane = bytes(frame.planes[1])
                v_plane = bytes(frame.planes[2])

                if is_first_frame:
                    print(f"[VideoDecoder] ✓ YUV planes extracted:")
                    print(f"  - Y: {len(y_plane)} bytes (linesize: {frame.planes[0].line_size})")
                    print(f"  - U: {len(u_plane)} bytes (linesize: {frame.planes[1].line_size})")
                    print(f"  - V: {len(v_plane)} bytes (linesize: {frame.planes[2].line_size})")

                return {
                    'width': frame.width,
                    'height': frame.height,
                    'y_plane': y_plane,
                    'u_plane': u_plane,
                    'v_plane': v_plane,
                    'y_linesize': frame.planes[0].line_size,
                    'u_linesize': frame.planes[1].line_size,
                    'v_linesize': frame.planes[2].line_size,
                    'pts': frame.pts or 0,
                    'format': 'yuv420p'
                }

        except Exception as e:
            print(f"[VideoDecoder] ✗ Decode error for {serial}: {e}")
            if is_first_frame:
                import traceback
                traceback.print_exc()
            return None

    def close_decoder(self, serial: str):
        """关闭解码器"""
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

            print(f"[VideoDecoder] Decoder closed for {serial}")

    def close_all(self):
        """关闭所有解码器"""
        for serial in list(self.decoders.keys()):
            self.close_decoder(serial)
