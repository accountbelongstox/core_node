#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Quick test: Verify ensure_library module is working

Usage:
    python quick_test_ffmpeg.py
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint

def test_import():
    """Test if module can be imported"""
    ColorPrint.blue("=" * 80)
    ColorPrint.blue("TEST 1: Module Import")
    ColorPrint.blue("=" * 80)

    from pycore.pyutils.ensure_library import ensure_ffmpeg
    ColorPrint.green("✓ Module imported successfully")


def test_ffmpeg_check():
    """Test FFmpeg detection (without auto-install)"""
    ColorPrint.blue("=" * 80)
    ColorPrint.blue("TEST 2: FFmpeg Detection (no auto-install)")
    ColorPrint.blue("=" * 80)

    from pycore.pyutils.ensure_library import ensure_ffmpeg

    ffmpeg_path = ensure_ffmpeg(auto_install=False)

    if ffmpeg_path:
        ColorPrint.green(f"✓ FFmpeg found: {ffmpeg_path}")
        return True
    else:
        ColorPrint.yellow("✗ FFmpeg not found (will need auto-install)")
        return False


def test_path_mapping():
    """Test path mapping"""
    ColorPrint.blue("=" * 80)
    ColorPrint.blue("TEST 3: Path Mapping")
    ColorPrint.blue("=" * 80)

    from pycore.pyfoundations.system_paths import map_web_path

    compile_dir = map_web_path("compile_dir", "ffmpeg")
    ColorPrint.green(f"✓ FFmpeg install dir: {compile_dir}")

    www_dir = map_web_path("www")
    ColorPrint.green(f"✓ WWW dir: {www_dir}")


def main():
    """Run all quick tests"""
    ColorPrint.blue("=" * 80)
    ColorPrint.blue("ENSURE_LIBRARY MODULE - QUICK TEST")
    ColorPrint.blue("=" * 80)

    tests_passed = 0
    tests_total = 3

    # Test 1: Import
    test_import()
    tests_passed += 1

    # Test 2: FFmpeg check
    if test_ffmpeg_check():
        tests_passed += 1
    else:
        ColorPrint.yellow("\nTo enable auto-install, run:")
        ColorPrint.yellow("  from pycore.pyutils.ensure_library import ensure_ffmpeg")
        ColorPrint.yellow("  ensure_ffmpeg(auto_install=True)")

    # Test 3: Path mapping
    test_path_mapping()
    tests_passed += 1

    # Summary
    ColorPrint.blue("=" * 80)
    ColorPrint.blue("TEST SUMMARY")
    ColorPrint.blue("=" * 80)

    if tests_passed == tests_total:
        ColorPrint.green(f"✓ All tests passed ({tests_passed}/{tests_total})")
    else:
        ColorPrint.yellow(f"⚠ Some tests need attention ({tests_passed}/{tests_total} passed)")

    ColorPrint.blue("=" * 80)


if __name__ == "__main__":
    main()
