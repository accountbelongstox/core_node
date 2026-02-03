#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Debug script to diagnose 70px window offset issue
Run this to check actual window dimensions and calculate the correct border width
"""

import sys
from pathlib import Path

# Add project paths
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

from share.game_interface_data import get_d4_interface_data
from pycore.pyfoundations.color_print import ColorPrint

def diagnose_window_offset():
    """Diagnose window offset issue"""

    print("\n" + "="*80)
    print("WINDOW OFFSET DIAGNOSTIC TOOL")
    print("="*80 + "\n")

    # Get D4 interface data
    d4_data = get_d4_interface_data()

    # Display current sizes
    print("📊 CURRENT SIZES:")
    print(f"  fullscreen_size: {d4_data.fullscreen_size}")
    print(f"  game_window_size: {d4_data.game_window_size}")
    print(f"  window_offset: {d4_data.window_offset}")

    if d4_data.fullscreen_size and d4_data.game_window_size:
        fullscreen_w, fullscreen_h = d4_data.fullscreen_size
        window_w, window_h = d4_data.game_window_size

        width_diff = fullscreen_w - window_w
        height_diff = fullscreen_h - window_h

        print(f"\n📐 SIZE DIFFERENCES:")
        print(f"  Width difference: {width_diff}px")
        print(f"  Height difference: {height_diff}px")

        print(f"\n🔍 WINDOW MODE DETECTION:")
        is_windowed = d4_data.is_windowed_mode()
        print(f"  is_windowed_mode(): {is_windowed}")

        if is_windowed:
            print(f"\n💡 CALCULATED BORDER VALUES (based on differences):")
            print(f"  If left_border = right_border:")
            left_right_border = width_diff / 2
            print(f"    Each side border: {left_right_border}px")

            print(f"\n  If title_bar + bottom_border = {height_diff}:")
            print(f"    Assuming bottom_border = {left_right_border}px (same as sides)")
            title_bar = height_diff - left_right_border
            print(f"    Title bar height: {title_bar}px")

            print(f"\n⚠️  CURRENT CONSTANTS:")
            print(f"    TITLE_BAR_HEIGHT = 31px")
            print(f"    WINDOW_BORDER_WIDTH = 8px")
            print(f"    Expected width diff = 8 + 8 = 16px")
            print(f"    Expected height diff = 31 + 8 = 39px")

            print(f"\n🔧 RECOMMENDED VALUES (if 70px offset is real):")
            if abs(width_diff - 70) < 5:  # Close to 70
                print(f"    WINDOW_BORDER_WIDTH should be: {width_diff / 2}px (currently 8px)")
                print(f"    This is a difference of {width_diff / 2 - 8}px per side")
            elif abs(left_right_border - 35) < 5:  # Each side ~35px
                print(f"    WINDOW_BORDER_WIDTH should be: 35px (currently 8px)")
                print(f"    TITLE_BAR_HEIGHT should be: {height_diff - 35}px (currently 31px)")
        else:
            print(f"  ℹ️  Game is in FULLSCREEN mode - no border offsets needed")
    else:
        ColorPrint.yellow("⚠️  No size data available - please run the game and capture a screenshot first")

    print("\n" + "="*80)
    print("END OF DIAGNOSTIC")
    print("="*80 + "\n")

if __name__ == "__main__":
    diagnose_window_offset()
