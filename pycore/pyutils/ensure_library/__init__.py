#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ensure Library - Third-party Binary/Library Installation Manager

This module ensures system libraries (FFmpeg, etc.) are properly installed.
Follows pycore standards: no try-except blocks, uses Commander and ColorPrint.

Usage:
    from pycore.pyutils.ensure_library import ensure_ffmpeg, ensure_pyside6_codecs

    # Ensure FFmpeg is installed
    ffmpeg_path = ensure_ffmpeg()
    if ffmpeg_path:
        print(f"FFmpeg available at: {ffmpeg_path}")

    # Check PySide6 codec support (diagnostic only)
    codec_info = ensure_pyside6_codecs()
"""

from pycore.pyutils.ensure_library.ffmpeg_installer import ensure_ffmpeg
from pycore.pyutils.ensure_library.pyside6_checker import ensure_pyside6_codecs

__all__ = [
    'ensure_ffmpeg',
    'ensure_pyside6_codecs',
]
