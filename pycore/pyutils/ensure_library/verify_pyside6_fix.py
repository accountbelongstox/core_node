#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Quick verification: Test PySide6 codec detection fix

This script verifies that PySide6 codec libraries are correctly detected.

Usage:
    python verify_pyside6_fix.py
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint

def main():
    """Run quick verification"""
    ColorPrint.blue("=" * 80)
    ColorPrint.blue("PYSIDE6 CODEC DETECTION - VERIFICATION TEST")
    ColorPrint.blue("=" * 80)

    # Test the fixed codec checker
    from pycore.pyutils.ensure_library import ensure_pyside6_codecs

    ColorPrint.blue("\nRunning PySide6 codec check...\n")

    result = ensure_pyside6_codecs()

    # Verify results
    ColorPrint.blue("\n" + "=" * 80)
    ColorPrint.blue("VERIFICATION RESULTS")
    ColorPrint.blue("=" * 80)

    if result['installed']:
        ColorPrint.green(f"✓ PySide6 installed: {result['version']}")
    else:
        ColorPrint.red("✗ PySide6 not installed")
        return

    if result['h264_support']:
        ColorPrint.green("✓ H.264 CODEC SUPPORT: DETECTED!")
        ColorPrint.green(f"✓ Found {len(result['codecs']['codec_dlls_found'])} codec libraries")
        ColorPrint.blue("\n  This means:")
        ColorPrint.blue("  - QtWebEngine can play H.264 videos natively")
        ColorPrint.blue("  - WebCodecs API should work")
        ColorPrint.blue("  - HTML5 video tags with H.264 should work")
        ColorPrint.blue("  - You have the OPTIMAL configuration!")
    else:
        ColorPrint.yellow("✗ H.264 codec support not detected")
        ColorPrint.yellow("  Fallback to backend decoding recommended")

    ColorPrint.blue("\n" + "=" * 80)

    if result['h264_support']:
        ColorPrint.green("✓ VERIFICATION PASSED - Codec detection is working correctly!")
    else:
        ColorPrint.yellow("⚠ VERIFICATION INCOMPLETE - Check if codec DLLs exist")

    ColorPrint.blue("=" * 80)


if __name__ == "__main__":
    main()
