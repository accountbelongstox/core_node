# -*- coding: utf-8 -*-
"""
Message Compressor
Provides message compression/decompression functionality
"""

import zlib
import json
import base64
from typing import Dict, Any, Optional
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pygvar import WS_RPC_CONSTANTS

DEFAULTS = WS_RPC_CONSTANTS.DEFAULTS


class MessageCompressor:
    """Handles message compression and decompression"""

    def __init__(self, options: Optional[Dict] = None):
        """
        Initialize message compressor

        Args:
            options: Configuration options
        """
        options = options or {}
        self.enabled = options.get('enabled', False)
        self.threshold = options.get('threshold', DEFAULTS['COMPRESSION_THRESHOLD'])
        self.algorithm = options.get('algorithm', 'gzip')
        self.level = options.get('level', zlib.Z_DEFAULT_COMPRESSION)

        self.stats = {
            'compressed': 0,
            'decompressed': 0,
            'original_size': 0,
            'compressed_size': 0,
            'saved_bytes': 0
        }

    def compress(self, data: Any) -> Dict:
        """
        Compress data if it exceeds threshold

        Args:
            data: Data to compress

        Returns:
            Dictionary with compressed data or original data
        """
        if not self.enabled:
            return {'data': data, 'compressed': False}

        try:
            # Convert to JSON string
            data_str = json.dumps(data) if not isinstance(data, str) else data
            original_size = len(data_str.encode('utf-8'))

            # Check threshold
            if original_size < self.threshold:
                return {'data': data, 'compressed': False}

            # Compress
            if self.algorithm == 'gzip':
                compressed = zlib.compress(data_str.encode('utf-8'), self.level)
            elif self.algorithm == 'deflate':
                compressed = zlib.compress(data_str.encode('utf-8'), self.level)
            else:
                ColorPrint.red(f"Unknown compression algorithm: {self.algorithm}")
                return {'data': data, 'compressed': False}

            compressed_size = len(compressed)
            saved_bytes = original_size - compressed_size

            # Update statistics
            self.stats['compressed'] += 1
            self.stats['original_size'] += original_size
            self.stats['compressed_size'] += compressed_size
            self.stats['saved_bytes'] += saved_bytes

            compression_ratio = (saved_bytes / original_size) * 100 if original_size > 0 else 0
            ColorPrint.debug(
                f"Compressed message: {original_size} -> {compressed_size} bytes "
                f"({compression_ratio:.2f}% saved)"
            )

            return {
                'data': base64.b64encode(compressed).decode('utf-8'),
                'compressed': True,
                'algorithm': self.algorithm,
                'original_size': original_size,
                'compressed_size': compressed_size
            }

        except Exception as error:
            ColorPrint.red(f"Compression error: {error}")
            return {'data': data, 'compressed': False}

    def decompress(self, data: Dict, algorithm: Optional[str] = None) -> Any:
        """
        Decompress data if compressed

        Args:
            data: Data dictionary with compressed flag
            algorithm: Optional algorithm override

        Returns:
            Decompressed data
        """
        if not data.get('compressed'):
            return data.get('data')

        try:
            compressed_bytes = base64.b64decode(data['data'])
            algo = algorithm or data.get('algorithm', self.algorithm)

            # Decompress
            if algo in ('gzip', 'deflate'):
                decompressed = zlib.decompress(compressed_bytes)
            else:
                ColorPrint.red(f"Unknown decompression algorithm: {algo}")
                return data.get('data')

            self.stats['decompressed'] += 1

            result = decompressed.decode('utf-8')
            ColorPrint.debug(f"Decompressed message: {len(compressed_bytes)} -> {len(result)} bytes")

            # Try to parse as JSON
            try:
                return json.loads(result)
            except json.JSONDecodeError:
                return result

        except Exception as error:
            ColorPrint.red(f"Decompression error: {error}")
            return data.get('data')

    def get_stats(self) -> Dict:
        """
        Get compression statistics

        Returns:
            Dictionary with statistics
        """
        avg_compression_ratio = 0
        if self.stats['original_size'] > 0:
            avg_compression_ratio = (self.stats['saved_bytes'] / self.stats['original_size']) * 100

        return {
            **self.stats,
            'avg_compression_ratio': round(avg_compression_ratio, 2)
        }

    def reset_stats(self):
        """Reset statistics"""
        self.stats = {
            'compressed': 0,
            'decompressed': 0,
            'original_size': 0,
            'compressed_size': 0,
            'saved_bytes': 0
        }
        ColorPrint.debug("Compression stats reset")
