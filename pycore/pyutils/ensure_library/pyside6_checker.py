#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PySide6 Checker - Check PySide6 installation and codec support

Diagnoses PySide6 QtWebEngine codec support and provides solutions.

Author: Pycore Team
"""

import os
import glob
from pathlib import Path

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon import Commander

from pycore.pyfoundations.third_party import get_third_package_pyside6



def check_pyside6_installed():
    """
    Check if PySide6 is installed

    Returns:
        tuple: (installed: bool, version: str or None, path: str or None)
    """
    ColorPrint.blue("[PySide6Checker] Checking PySide6 installation...")

    # Import PySide6 using lazy loader

    PySide6 = get_third_package_pyside6()

    if not PySide6:
        ColorPrint.red("[PySide6Checker] ✗ PySide6 not installed")
        return (False, None, None)

    # Get installation path
    pyside6_path = Path(PySide6.__file__).parent
    ColorPrint.green(f"[PySide6Checker] ✓ PySide6 installed at: {pyside6_path}")

    # Get version
    version = getattr(PySide6, '__version__', 'unknown')
    ColorPrint.blue(f"[PySide6Checker] Version: {version}")

    return (True, version, str(pyside6_path))


def check_codec_libraries(pyside6_path):
    """
    Check for codec libraries in PySide6 directory

    Args:
        pyside6_path: Path to PySide6 installation

    Returns:
        dict: {
            'search_paths': list,
            'codec_dlls_found': list,
            'has_h264': bool,
            'has_proprietary': bool
        }
    """
    ColorPrint.blue("[PySide6Checker] Checking codec libraries...")

    pyside6_root = Path(pyside6_path)

    # Check multiple possible locations for codec DLLs
    search_paths = [
        pyside6_root,              # Root directory (PySide6 6.10+ places them here)
        pyside6_root / "bin",      # Bin subdirectory (older versions)
        pyside6_root / "Qt" / "bin", # Qt subdirectory
    ]

    # Codec DLL patterns to check
    codec_patterns = [
        "avcodec*.dll",      # FFmpeg video codec library (critical for H.264)
        "avformat*.dll",     # FFmpeg format library
        "avutil*.dll",       # FFmpeg utility library
        "swscale*.dll",      # FFmpeg scaling library
        "swresample*.dll",   # FFmpeg resampling library
    ]

    codec_dlls_found = []
    found_in_paths = []

    for search_path in search_paths:
        if not search_path.exists():
            continue

        ColorPrint.blue(f"[PySide6Checker] Searching in: {search_path}")

        for pattern in codec_patterns:
            matches = glob.glob(str(search_path / pattern))
            if matches:
                for match in matches:
                    dll_name = Path(match).name
                    if dll_name not in codec_dlls_found:
                        codec_dlls_found.append(dll_name)
                        found_in_paths.append(str(search_path))

    # Check for proprietary codec indicators
    has_proprietary = any('avcodec' in dll.lower() for dll in codec_dlls_found)
    has_h264 = has_proprietary  # If avcodec is present, H.264 is likely supported

    result = {
        'search_paths': [str(p) for p in search_paths],
        'codec_dlls_found': codec_dlls_found,
        'has_h264': has_h264,
        'has_proprietary': has_proprietary
    }

    if codec_dlls_found:
        ColorPrint.green(f"[PySide6Checker] ✓ Found {len(codec_dlls_found)} codec libraries:")
        for dll in codec_dlls_found:
            ColorPrint.blue(f"  - {dll}")
    else:
        ColorPrint.yellow("[PySide6Checker] ✗ No codec libraries found in any search path")

    return result


def check_qtwebengine_features():
    """
    Check QtWebEngine features and configuration

    Returns:
        dict: QtWebEngine feature information
    """
    ColorPrint.blue("[PySide6Checker] Checking QtWebEngine features...")

    features = {
        'webengine_available': False,
        'chromium_version': None,
        'features_enabled': []
    }

    # Try to import QtWebEngine
    PySide6 = get_third_package_pyside6()

    if not PySide6:
        return features

    # Check if QtWebEngineCore is available
    try:
        features['webengine_available'] = True
        ColorPrint.green("[PySide6Checker] ✓ QtWebEngine available")

        # Get Chromium version
        chromium_version = QtWebEngineCore.qWebEngineChromiumVersion()
        features['chromium_version'] = chromium_version
        ColorPrint.blue(f"[PySide6Checker] Chromium version: {chromium_version}")

    except ImportError as e:
        ColorPrint.yellow(f"[PySide6Checker] ✗ QtWebEngine not available: {e}")

    return features


def get_pyside6_codec_support():
    """
    Get comprehensive PySide6 codec support information

    Returns:
        dict: Complete codec support information
    """
    ColorPrint.blue("=" * 80)
    ColorPrint.blue("[PySide6Checker] Comprehensive Codec Support Check")
    ColorPrint.blue("=" * 80)

    # Check installation
    installed, version, pyside6_path = check_pyside6_installed()

    if not installed:
        return {
            'installed': False,
            'version': None,
            'path': None,
            'codecs': None,
            'features': None,
            'h264_support': False
        }

    # Check codec libraries
    codec_info = check_codec_libraries(pyside6_path)

    # Check QtWebEngine features
    features = check_qtwebengine_features()

    # Compile result
    result = {
        'installed': True,
        'version': version,
        'path': pyside6_path,
        'codecs': codec_info,
        'features': features,
        'h264_support': codec_info['has_h264']
    }

    # Print summary
    ColorPrint.blue("=" * 80)
    ColorPrint.blue("[PySide6Checker] Summary")
    ColorPrint.blue("=" * 80)

    if result['h264_support']:
        ColorPrint.green("✓ H.264 codec support: AVAILABLE")
        ColorPrint.green("✓ Your PySide6 installation includes FFmpeg codec libraries")
        ColorPrint.blue(f"✓ Found {len(result['codecs']['codec_dlls_found'])} codec DLLs:")
        for dll in result['codecs']['codec_dlls_found']:
            ColorPrint.blue(f"  - {dll}")
        ColorPrint.blue("\n[PySide6Checker] You can use QtWebEngine for H.264 video playback")
        ColorPrint.blue("[PySide6Checker] WebCodecs API and HTML5 video tags should work")
    else:
        ColorPrint.yellow("✗ H.264 codec support: NOT AVAILABLE")
        print_codec_solutions()

    return result


def print_codec_solutions():
    """
    Print solutions for codec support issues
    """
    ColorPrint.blue("=" * 80)
    ColorPrint.blue("[PySide6Checker] SOLUTIONS FOR H.264 SUPPORT")
    ColorPrint.blue("=" * 80)

    ColorPrint.yellow("\nOption 1: Use Software Decoder in Backend (Recommended)")
    ColorPrint.blue("  - Use FFmpeg/PyAV to decode H.264 on backend")
    ColorPrint.blue("  - Send RGB/RGBA frames via WebSocket")
    ColorPrint.blue("  - Render on HTML canvas")
    ColorPrint.blue("  - No QtWebEngine codec needed")

    ColorPrint.yellow("\nOption 2: Use YUV420P + Canvas Rendering")
    ColorPrint.blue("  - Send YUV420P frames from backend")
    ColorPrint.blue("  - Use WebGL shader for YUV-to-RGB conversion")
    ColorPrint.blue("  - Already implemented in your Matrix app")
    ColorPrint.blue("  - Endpoint: ws://localhost:48000/video/yuv/{device_id}")

    ColorPrint.yellow("\nOption 3: Install PySide6 with Codec Support (Advanced)")
    ColorPrint.blue("  - Some third-party PySide6 builds include codecs")
    ColorPrint.blue("  - Warning: May have licensing implications")
    ColorPrint.blue("  - Not officially supported by Qt")

    ColorPrint.yellow("\nOption 4: Rebuild Qt from Source (Expert Only)")
    ColorPrint.blue("  - Build Qt WebEngine with -webengine-proprietary-codecs")
    ColorPrint.blue("  - Requires Qt source, build tools, several hours")
    ColorPrint.blue("  - Warning: H.264 licensing obligations apply")

    ColorPrint.blue("=" * 80)
    ColorPrint.green("RECOMMENDATION: Use Option 1 or 2 (backend decoding)")
    ColorPrint.blue("=" * 80)


def ensure_pyside6_codecs():
    """
    Ensure PySide6 codecs are available (diagnostic only)

    Unlike FFmpeg, we cannot automatically install codec support for PySide6
    as it requires Qt to be rebuilt from source with proprietary codec flags.

    This function only diagnoses the current state and provides guidance.

    Returns:
        dict: Codec support information
    """
    ColorPrint.blue("=" * 80)
    ColorPrint.blue("[PySide6Checker] Ensure PySide6 Codecs")
    ColorPrint.blue("=" * 80)

    result = get_pyside6_codec_support()

    ColorPrint.blue("=" * 80)
    ColorPrint.blue("[PySide6Checker] Note")
    ColorPrint.blue("=" * 80)
    ColorPrint.yellow("PySide6 codec support cannot be automatically installed.")
    ColorPrint.yellow("It requires Qt to be rebuilt with proprietary codec support.")
    ColorPrint.yellow("For video streaming, use backend decoding (FFmpeg) instead.")

    return result


__all__ = [
    'check_pyside6_installed',
    'check_codec_libraries',
    'check_qtwebengine_features',
    'get_pyside6_codec_support',
    'ensure_pyside6_codecs',
]
