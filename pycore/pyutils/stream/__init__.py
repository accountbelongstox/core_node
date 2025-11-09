"""
pyutils.stream - Video stream processing module

Features:
- H.264 decoding (PyAV)
- fMP4 encoding (browser MSE compatible)
- Video frame processing

Dependencies:
- Standard library: abc, typing
- Third-party: av (PyAV), numpy

Example:
    from pycore.pyutils.stream import H264Decoder, FMP4Encoder, VideoFrame

    # Create decoder
    decoder = H264Decoder()

    # Feed H.264 data
    decoder.feed(h264_data)

    # Decode frames
    for frame in decoder.decode():
        print(f"Frame: {frame.width}x{frame.height}")

    # Create encoder
    encoder = FMP4Encoder(width=720, height=1280, fps=30)

    # Get init segment (send once to browser)
    init_segment = encoder.get_init_segment()

    # Encode frame
    fmp4_chunk = encoder.encode(frame)
"""

from pycore.pyutils.stream.video_decoder import VideoDecoder
from pycore.pyutils.stream.h264_decoder import H264Decoder
from pycore.pyutils.stream.fmp4_encoder import FMP4Encoder
from pycore.pyutils.stream.stream_types import VideoFrame, VideoFormat
from pycore.pyutils.stream.video_stream_handler import VideoStreamHandler, H264Config

# Import complete FMP4 encoder
try:
    from pycore.pyutils.stream.fmp4_encoder_complete import FMP4Encoder as FMP4EncoderComplete, H264Frame
    __all__ = [
        'VideoDecoder',
        'H264Decoder',
        'FMP4Encoder',
        'FMP4EncoderComplete',
        'H264Frame',
        'VideoFrame',
        'VideoFormat',
        'VideoStreamHandler',
        'H264Config',
    ]
except ImportError:
    __all__ = [
        'VideoDecoder',
        'H264Decoder',
        'FMP4Encoder',
        'VideoFrame',
        'VideoFormat',
        'VideoStreamHandler',
        'H264Config',
    ]

__version__ = '1.0.0'
