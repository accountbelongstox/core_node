#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Example: How to integrate ensure_library into Matrix application

This shows the correct way to use ensure_ffmpeg and ensure_pyside6_codecs
in your application.
"""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.ensure_library.ffmpeg_installer import ensure_ffmpeg
from pycore.pyutils.ensure_library.pyside6_checker import ensure_pyside6_codecs


def check_multimedia_environment():
    """
    Check and ensure multimedia environment is properly configured

    This function:
    1. Checks if FFmpeg is available (auto-installs if needed)
    2. Checks PySide6 codec support (diagnostic only)
    3. Provides recommendations based on results

    Returns:
        dict: {
            'ffmpeg_path': str or None,
            'ffmpeg_available': bool,
            'pyside6_codecs': dict,
            'h264_support': bool
        }
    """
    ColorPrint.blue("=" * 80)
    ColorPrint.blue("[Matrix] Checking multimedia environment...")
    ColorPrint.blue("=" * 80)

    result = {
        'ffmpeg_path': None,
        'ffmpeg_available': False,
        'pyside6_codecs': None,
        'h264_support': False
    }

    # 1. Check FFmpeg (auto-install if needed)
    ColorPrint.blue("\n[Matrix] Step 1: Checking FFmpeg...")
    ColorPrint.blue("-" * 80)

    ffmpeg_path = ensure_ffmpeg(auto_install=True)

    if ffmpeg_path:
        result['ffmpeg_path'] = ffmpeg_path
        result['ffmpeg_available'] = True

        ColorPrint.green("=" * 80)
        ColorPrint.green(f"[Matrix] ✓ FFmpeg is available")
        ColorPrint.green(f"[Matrix] ✓ FFmpeg path: {ffmpeg_path}")
        ColorPrint.green("=" * 80)

        # Optional: Get detailed FFmpeg info
        from pycore.pyutils.ensure_library.ffmpeg_installer import get_ffmpeg_info

        info = get_ffmpeg_info(ffmpeg_path)
        if info and info.get('version'):
            ColorPrint.blue(f"[Matrix] FFmpeg version: {info['version']}")

    else:
        ColorPrint.yellow("=" * 80)
        ColorPrint.yellow("[Matrix] ⚠ FFmpeg not available")
        ColorPrint.yellow("[Matrix] ⚠ Video streaming features may be limited")
        ColorPrint.yellow("=" * 80)
        ColorPrint.yellow("[Matrix] Manual installation options:")
        ColorPrint.yellow("[Matrix]   Windows: winget install Gyan.FFmpeg")
        ColorPrint.yellow("[Matrix]   Linux:   sudo apt-get install ffmpeg")
        ColorPrint.yellow("[Matrix]   macOS:   brew install ffmpeg")

    # 2. Check PySide6 codec support (diagnostic only)
    ColorPrint.blue("\n[Matrix] Step 2: Checking PySide6 codec support...")
    ColorPrint.blue("-" * 80)

    pyside6_info = ensure_pyside6_codecs()
    result['pyside6_codecs'] = pyside6_info
    result['h264_support'] = pyside6_info.get('h264_support', False)

    # 3. Provide recommendations
    ColorPrint.blue("\n[Matrix] Step 3: Multimedia Environment Assessment")
    ColorPrint.blue("=" * 80)

    if result['ffmpeg_available']:
        ColorPrint.green("✓ Backend video processing: AVAILABLE (FFmpeg)")

        if result['h264_support']:
            ColorPrint.green("✓ QtWebEngine H.264: AVAILABLE")
            ColorPrint.blue("\n[Matrix] OPTIMAL CONFIGURATION DETECTED!")
            ColorPrint.green("  You have BOTH backend and frontend H.264 support:")
            ColorPrint.blue("  1. Backend: FFmpeg for video processing")
            ColorPrint.blue("  2. Frontend: QtWebEngine native H.264 playback")
            ColorPrint.blue("\n  Recommended approaches:")
            ColorPrint.blue("  - For live streaming: Use H.264 WebSocket → HTML5 Video")
            ColorPrint.blue("  - For compatibility: Use YUV420P + WebGL")
            ColorPrint.blue("  - For recording: Use FFmpeg backend encoding")
        else:
            ColorPrint.yellow("✗ QtWebEngine H.264: NOT AVAILABLE")
            ColorPrint.blue("\n[Matrix] RECOMMENDED SOLUTION:")
            ColorPrint.green("  Use backend decoding with FFmpeg:")
            ColorPrint.blue("  1. Decode H.264 with FFmpeg in backend")
            ColorPrint.blue("  2. Send RGB/RGBA frames via WebSocket")
            ColorPrint.blue("  3. Render with HTML Canvas")
            ColorPrint.blue("  OR")
            ColorPrint.blue("  Use YUV420P endpoint: ws://localhost:48000/video/yuv/{device_id}")

    else:
        ColorPrint.red("✗ Backend video processing: NOT AVAILABLE")
        ColorPrint.yellow("  Video features will not work without FFmpeg")
        ColorPrint.yellow("  Please install FFmpeg manually")

    ColorPrint.blue("=" * 80)

    return result


# Example integration in matrix_main.py:
def example_start():
    """
    Example of integrating multimedia check into Matrix start() function

    Add this at the beginning of start() function in matrix_main.py
    """
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" MATRIX APPLICATION - RPC v2 WebSocket Edition")
    ColorPrint.blue("=" * 70)

    # Check multimedia environment FIRST (before any UI setup)
    # This ensures FFmpeg is available for video streaming
    multimedia_env = check_multimedia_environment()

    # Continue with normal Matrix startup...
    # ... rest of the start() function code ...


if __name__ == "__main__":
    # Test the multimedia environment checker
    check_multimedia_environment()
