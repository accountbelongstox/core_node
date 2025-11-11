#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Diagnose terminal color support"""

import sys
import os
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

print("=" * 70)
print("Terminal Color Support Diagnostics")
print("=" * 70)
print()

# 1. Check platform
print(f"Platform: {sys.platform}")
print(f"Python version: {sys.version}")
print()

# 2. Check environment variables
print("Environment Variables:")
print(f"  TERM: {os.environ.get('TERM', 'not set')}")
print(f"  PYTHONUNBUFFERED: {os.environ.get('PYTHONUNBUFFERED', 'not set')}")
print(f"  FORCE_COLOR: {os.environ.get('FORCE_COLOR', 'not set')}")
print(f"  NO_COLOR: {os.environ.get('NO_COLOR', 'not set')}")
print()

# 3. Check stdout/stderr
print("Standard streams:")
print(f"  stdout: {sys.stdout}")
print(f"  stdout.isatty(): {sys.stdout.isatty()}")
print(f"  stderr: {sys.stderr}")
print(f"  stderr.isatty(): {sys.stderr.isatty()}")
print()

# 4. Test ANSI colors directly
print("Direct ANSI color test:")
print(f"  \033[94mBlue text\033[0m")
print(f"  \033[92mGreen text\033[0m")
print(f"  \033[93mYellow text\033[0m")
print(f"  \033[91mRed text\033[0m")
print(f"  \033[97mWhite text\033[0m")
print(f"  \033[90mGray text\033[0m")
print()

# 5. Test ColorPrint
from pycore import ColorPrint

print("ColorPrint test:")
ColorPrint.blue("  This is blue")
ColorPrint.green("  This is green")
ColorPrint.yellow("  This is yellow")
ColorPrint.red("  This is red")
ColorPrint.white("  This is white")
ColorPrint.gray("  This is gray")
print()

# 6. Check Windows console mode (Windows only)
if sys.platform == 'win32':
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32

        # Get console mode
        handle = kernel32.GetStdHandle(-11)  # STD_OUTPUT_HANDLE
        mode = ctypes.c_uint32()
        kernel32.GetConsoleMode(handle, ctypes.byref(mode))

        print(f"Windows Console Mode: 0x{mode.value:X}")

        # Check ENABLE_VIRTUAL_TERMINAL_PROCESSING (0x0004)
        vt_enabled = bool(mode.value & 0x0004)
        print(f"  Virtual Terminal Processing: {'✓ Enabled' if vt_enabled else '✗ Disabled'}")

        if not vt_enabled:
            print("\n⚠️  Windows Virtual Terminal is DISABLED")
            print("   This is why you might not see colors!")
            print("\n   To enable, run in PowerShell:")
            print("   Set-ItemProperty HKCU:\\Console VirtualTerminalLevel -Type DWORD 1")
            print("\n   Or set in your Python code:")
            print("   import os; os.system('')  # Enable VT processing")
    except Exception as e:
        print(f"Could not check Windows console mode: {e}")
    print()

# 7. Recommendations
print("=" * 70)
print("Recommendations:")
print("=" * 70)

if sys.platform == 'win32':
    print("For Windows:")
    print("  1. Use Windows Terminal (recommended)")
    print("  2. Or enable VT processing in PowerShell:")
    print("     Set-ItemProperty HKCU:\\Console VirtualTerminalLevel -Type DWORD 1")
    print("  3. Run with: python pymain.py app=matrix")
elif sys.platform == 'darwin':
    print("For macOS:")
    print("  Terminal.app and iTerm2 both support ANSI colors")
else:
    print("For Linux:")
    print("  Most terminals support ANSI colors by default")

print()
print("To disable buffering:")
print("  python -u pymain.py app=matrix")
print("  OR: set PYTHONUNBUFFERED=1")

print()
print("=" * 70)
