#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""分析思路61对比日志，总结与近似值的差异"""
import os
import sys
import re
from pathlib import Path

# 添加路径
_script_dir = os.path.dirname(os.path.abspath(__file__))
_root = os.path.normpath(os.path.dirname(_script_dir))
_repo_root = os.path.normpath(os.path.dirname(os.path.dirname(_root)))
sys.path.insert(0, _repo_root)
if _root not in sys.path:
    sys.path.insert(0, _root)

from d3utils.history_info_organizer_6 import get_history_info_organizer_6

def analyze_diff():
    """分析思路61与近似值的差异"""
    history_path = r"C:\Users\accou\Documents\RoS-BoT\Logs\history.txt"
    
    # 获取实际输出
    org = get_history_info_organizer_6(history_path)
    mtime = os.path.getmtime(history_path)
    start_epoch = mtime - 4295  # 01:11:35 = 4295 seconds
    actual_lines = org.get_latest_stats_as_lines(min_entry_ts=start_epoch)
    
    # 近似值（从测试脚本中提取）
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
    
    # 解析实际输出
    actual_dict = {}
    for line in actual_lines:
        if ": " in line:
            parts = line.split(": ", 1)
            if len(parts) == 2:
                key, value = parts[0].strip(), parts[1].strip()
                actual_dict[key] = value
    
    print("=" * 80)
    print("思路61对比分析：实际输出 vs 近似值")
    print("=" * 80)
    print(f"\n时间窗口: history mtime - 01:11:35 (start_epoch = {start_epoch:.0f})")
    print(f"\n实际输出键数: {len(actual_dict)}")
    print(f"近似值键数: {len(approximate)}")
    
    # 分类差异
    print("\n" + "=" * 80)
    print("1. 近似值有但实际输出没有的键（数据来源不同）")
    print("=" * 80)
    missing_in_actual = []
    for key in approximate:
        if key not in actual_dict:
            missing_in_actual.append((key, approximate[key]))
            print(f"  - {key}: approximate = '{approximate[key]}'")
    
    print("\n" + "=" * 80)
    print("2. 实际输出有但近似值没有的键（history.txt 特有的 Earned 数据）")
    print("=" * 80)
    missing_in_approx = []
    for key in sorted(actual_dict.keys()):
        if key not in approximate:
            missing_in_approx.append((key, actual_dict[key]))
            print(f"  - {key}: actual = '{actual_dict[key]}'")
    
    print("\n" + "=" * 80)
    print("3. 两者都有的键（格式或值不同）")
    print("=" * 80)
    common_keys = []
    for key in approximate:
        if key in actual_dict:
            common_keys.append((key, approximate[key], actual_dict[key]))
            if approximate[key] != actual_dict[key]:
                print(f"  - {key}:")
                print(f"      approximate = '{approximate[key]}'")
                print(f"      actual      = '{actual_dict[key]}'")
    
    # 总结
    print("\n" + "=" * 80)
    print("差异总结")
    print("=" * 80)
    print(f"""
1. 数据来源不同：
   - 近似值来自 logs.txt（Botting duration, Game #, Shards earned, Performance 等）
   - 实际输出来自 history.txt（Gold Earned, Shards Earned, Rift keys Earned 等）
   
2. 键名格式不同：
   - 近似值使用 "Shards earned"（小写 "earned"）、"Gold"（无 " Earned"）
   - 实际输出使用 "Shards Earned"（大写 "Earned"）、"Gold Earned"（有 " Earned"）
   
3. 数据含义不同：
   - 近似值：累计统计（如 "Shards earned: 8438" 是整个运行期间的累计）
   - 实际输出：最后一块的增量（如 "Shards Earned: 338" 是最后一个 Rift/Step 块的增量）
   
4. 时间窗口：
   - 只比较时间窗口内的最后一块（window_start = history mtime - 01:11:35）
   - 日志文件是变化的，所以使用固定时间窗口来对齐近似值

5. 差异统计：
   - 近似值独有的键: {len(missing_in_actual)} 个
   - 实际输出独有的键: {len(missing_in_approx)} 个
   - 共同键但值不同: {len([k for k in common_keys if k[1] != k[2]])} 个
   - 总差异数: {len(missing_in_actual) + len(missing_in_approx) + len([k for k in common_keys if k[1] != k[2]])} 个
""")
    
    # 实际输出的完整列表
    print("\n" + "=" * 80)
    print("实际输出完整列表（思路61解析的最后一块 Earned）")
    print("=" * 80)
    for key in sorted(actual_dict.keys()):
        print(f"  {key}: {actual_dict[key]}")

if __name__ == "__main__":
    analyze_diff()
