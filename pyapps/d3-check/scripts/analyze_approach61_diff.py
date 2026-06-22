#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Analyze approach61 comparison log, summarize differences with approximate values"""
import os
import sys
import re
from pathlib import Path

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add project paths
_script_dir = os.path.dirname(os.path.abspath(__file__))
_root = os.path.normpath(os.path.dirname(_script_dir))
_repo_root = os.path.normpath(os.path.dirname(os.path.dirname(_root)))
sys.path.insert(0, _repo_root)
if _root not in sys.path:
    sys.path.insert(0, _root)

from d3utils.history_info_organizer_6 import get_stats_lines_in_time_window_approach6

def analyze_diff():
    """Compare approach61 output with approximate values (aggregate stats, not last-block delta)."""
    history_path = r"C:\Users\accou\Documents\RoS-BoT\Logs\history.txt"
    
    # Get actual output (aggregate stats, same format as approximate)
    mtime = os.path.getmtime(history_path)
    start_epoch = mtime - 4295  # 01:11:35 = 4295 seconds
    actual_lines = get_stats_lines_in_time_window_approach6(
        history_path, start_epoch, boting_seconds=4295
    )
    
    # Approximate values (from test script)
    approximate = {
        "Avg.Keys/Rift": "- 38r 0gr",
        "Botting duration": "00.01:11:35 day(s)",
        "Distance": "89827y (42.88mi/h)",
        "Earned Xp": "309.874 B (260.348 B/h)",
        "Failed runs - Deaths": "0 - 0",
        "Game #": "38",
        "Keys Total/Looted": "341/163 136.95/h",
        "Legendaries Kept/Looted": "1/333",
        "Performance": "174/570",
        "Run - Step": "01:12 - 00:02",
        "Run Xp": "5.543 B (306.764 B/h)",
        "Run time (per h)": "00:01:12 (31.01/h)",
        "Shards earned": "8438",
        "Xp Pools": "17 (14/h)",
    }
    
    # Parse actual output
    actual_dict = {}
    for line in actual_lines:
        if ": " in line:
            parts = line.split(": ", 1)
            if len(parts) == 2:
                key, value = parts[0].strip(), parts[1].strip()
                actual_dict[key] = value
    
    print("=" * 80)
    print("Approach61 Comparison Analysis: Actual Output vs Approximate Values")
    print("=" * 80)
    print(f"\nTime window: history mtime - 01:11:35 (start_epoch = {start_epoch:.0f})")
    print(f"\nActual output keys: {len(actual_dict)}")
    print(f"Approximate keys: {len(approximate)}")
    
    # Categorize differences
    print("\n" + "=" * 80)
    print("1. Keys in approximate but NOT in actual (different data sources)")
    print("=" * 80)
    missing_in_actual = []
    for key in approximate:
        if key not in actual_dict:
            missing_in_actual.append((key, approximate[key]))
            print(f"  - {key}: approximate = '{approximate[key]}'")
    
    print("\n" + "=" * 80)
    print("2. Keys in actual but NOT in approximate (history.txt specific Earned data)")
    print("=" * 80)
    missing_in_approx = []
    for key in sorted(actual_dict.keys()):
        if key not in approximate:
            missing_in_approx.append((key, actual_dict[key]))
            print(f"  - {key}: actual = '{actual_dict[key]}'")
    
    print("\n" + "=" * 80)
    print("3. Keys in both (different format or values)")
    print("=" * 80)
    common_keys = []
    for key in approximate:
        if key in actual_dict:
            common_keys.append((key, approximate[key], actual_dict[key]))
            if approximate[key] != actual_dict[key]:
                print(f"  - {key}:")
                print(f"      approximate = '{approximate[key]}'")
                print(f"      actual      = '{actual_dict[key]}'")
    
    # Summary
    print("\n" + "=" * 80)
    print("Summary of Differences")
    print("=" * 80)
    print(f"""
1. Both data sources are from history.txt (NOT logs.txt):
   - Approximate: fixed snapshot from history.txt at a specific time window
   - Actual: dynamically computed from history.txt in current time window [start_epoch, ...]
   
2. Same key name formats:
   - Both use same 14-line format: "Botting duration", "Game #", "Shards earned", etc.
   - Both are aggregated statistics from history.txt Earned data
   
3. Different time windows or data ranges:
   - Approximate: snapshot from a specific time point in history.txt
   - Actual: current time window [start_epoch = history mtime - 01:11:35, ...]
   
4. Time window:
   - Only compares last block in time window (window_start = history mtime - 01:11:35)
   - Log file changes over time, so fixed time window aligns approximate with actual

5. Difference statistics:
   - Keys only in approximate: {len(missing_in_actual)}
   - Keys only in actual: {len(missing_in_approx)}
   - Common keys with different values: {len([k for k in common_keys if k[1] != k[2]])}
   - Total differences: {len(missing_in_actual) + len(missing_in_approx) + len([k for k in common_keys if k[1] != k[2]])}
""")
    
    # Full actual output list
    print("\n" + "=" * 80)
    print("Complete Actual Output List (Approach61 aggregated stats from history.txt)")
    print("=" * 80)
    for key in sorted(actual_dict.keys()):
        print(f"  {key}: {actual_dict[key]}")

if __name__ == "__main__":
    analyze_diff()
