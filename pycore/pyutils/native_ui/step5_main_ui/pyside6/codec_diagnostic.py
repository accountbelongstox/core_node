#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Qt WebEngine Codec Diagnostic Tool

Checks if Qt WebEngine was built with proprietary codec support (H.264, AAC, etc.)
"""

import platform
from pathlib import Path

from PySide6.QtCore import QLibraryInfo, qVersion

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint



def check_proprietary_codec_support() -> bool:
    """
    Check if Qt WebEngine includes proprietary codec support.

    Returns:
        True if proprietary codecs are available, False otherwise
    """
    try:

        ColorPrint.blue("=" * 80)
        ColorPrint.blue("[CodecDiagnostic] Qt WebEngine Codec Support Check")
        ColorPrint.blue("=" * 80)

        # Get Qt installation path
        qt_path = QLibraryInfo.path(QLibraryInfo.LibraryPath.PrefixPath)
        ColorPrint.blue(f"[CodecDiagnostic] Qt installation: {qt_path}")

        # Check Qt version
        qt_version = qVersion()
        ColorPrint.blue(f"[CodecDiagnostic] Qt version: {qt_version}")

        # Check multiple possible locations for codec libraries
        qt_root = Path(qt_path)
        search_paths = [
            qt_root,                # Root directory (PySide6 6.10+ places them here)
            qt_root / "bin",        # Bin subdirectory (older versions)
            qt_root / "Qt" / "bin", # Qt subdirectory
        ]

        # Windows: look for avcodec DLL
        windows_codecs = [
            "avcodec-*.dll",
            "avformat-*.dll",
            "avutil-*.dll",
            "swscale-*.dll",
            "swresample-*.dll",
            "ffmpeg.dll",
        ]

        # Linux: look for .so files
        linux_codecs = [
            "libavcodec.so*",
            "libavformat.so*",
            "libavutil.so*",
            "libswscale.so*",
            "libswresample.so*",
            "libffmpeg.so*",
        ]

        if platform.system() == "Windows":
            codec_files = windows_codecs
        else:
            codec_files = linux_codecs

        found_codecs = []
        found_in_path = None

        # Search in all possible locations
        for search_path in search_paths:
            if not search_path.exists():
                continue

            ColorPrint.blue(f"[CodecDiagnostic] Searching in: {search_path}")

            for pattern in codec_files:
                matches = list(search_path.glob(pattern))
                if matches:
                    found_codecs.extend(matches)
                    if not found_in_path:
                        found_in_path = search_path

            # If we found codecs in this path, no need to check others
            if found_codecs:
                break

        if found_codecs:
            ColorPrint.green(f"[CodecDiagnostic] ✓ Found {len(found_codecs)} codec libraries in: {found_in_path}")
            for codec in found_codecs:
                ColorPrint.green(f"  - {codec.name}")
            ColorPrint.green("[CodecDiagnostic] ✓ Qt WebEngine has proprietary codec support")
            ColorPrint.green("[CodecDiagnostic] ✓ H.264, AAC, and other proprietary codecs are available")
            ColorPrint.blue("=" * 80)
            return True
        else:
            ColorPrint.yellow(f"[CodecDiagnostic] ✗ No codec libraries found in any search path")
            ColorPrint.yellow("[CodecDiagnostic] Searched paths:")
            for path in search_paths:
                if path.exists():
                    ColorPrint.yellow(f"  - {path}")
            ColorPrint.yellow("[CodecDiagnostic] This Qt WebEngine build likely does NOT support H.264")
            ColorPrint.yellow("[CodecDiagnostic] Proprietary codecs require Qt to be built with:")
            ColorPrint.yellow("[CodecDiagnostic]   -webengine-proprietary-codecs flag")
            ColorPrint.blue("=" * 80)
            return False

    except Exception as e:
        ColorPrint.red(f"[CodecDiagnostic] Error checking codec support: {e}")
        ColorPrint.blue("=" * 80)
        return False


def print_codec_solutions():
    """Print solutions if proprietary codecs are not available."""
    ColorPrint.yellow("=" * 80)
    ColorPrint.yellow("[CodecDiagnostic] SOLUTIONS FOR H.264 SUPPORT")
    ColorPrint.yellow("=" * 80)
    ColorPrint.yellow("")
    ColorPrint.yellow("Option 1: Use Software H.264 Decoder (Recommended)")
    ColorPrint.yellow("  - Decode H.264 with PyAV/OpenCV on backend")
    ColorPrint.yellow("  - Send RGB/RGBA frames via WebSocket as base64 images")
    ColorPrint.yellow("  - Render on HTML canvas element")
    ColorPrint.yellow("  - No WebCodecs API needed")
    ColorPrint.yellow("")
    ColorPrint.yellow("Option 2: Use YUV420P + Canvas2D Rendering")
    ColorPrint.yellow("  - Already implemented in your codebase")
    ColorPrint.yellow("  - Uses ws://localhost:48000/video/yuv/{device_id}")
    ColorPrint.yellow("  - No codec dependencies")
    ColorPrint.yellow("")
    ColorPrint.yellow("Option 3: Rebuild Qt WebEngine with Proprietary Codecs (Advanced)")
    ColorPrint.yellow("  - Build Qt from source with -webengine-proprietary-codecs")
    ColorPrint.yellow("  - Requires: Qt source, build tools, several hours")
    ColorPrint.yellow("  - Warning: H.264 licensing obligations apply")
    ColorPrint.yellow("")
    ColorPrint.yellow("Option 4: Use Official Qt Commercial Build")
    ColorPrint.yellow("  - Commercial Qt builds may include proprietary codecs")
    ColorPrint.yellow("  - Requires Qt commercial license")
    ColorPrint.yellow("")
    ColorPrint.yellow("=" * 80)


if __name__ == '__main__':
    has_codecs = check_proprietary_codec_support()

    if not has_codecs:
        print_codec_solutions()
    else:
        ColorPrint.green("[CodecDiagnostic] ✓ Qt WebEngine has proprietary codec support")
        ColorPrint.green("[CodecDiagnostic] H.264 should work with WebCodecs API")
