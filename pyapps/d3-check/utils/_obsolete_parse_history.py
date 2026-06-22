#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
History.txt Parser for D3Check
"""

import pprint
import re
from datetime import datetime, timedelta
from typing import List

# Configuration
try:
    from providor.providor_second import HISTORY_FILE_PATH
except ImportError:
    HISTORY_FILE_PATH = "history.txt"

# Global constant for number of lines to read after timestamp
LINES_TO_READ = 19  # GameData field count + 4

# Global list to store extracted blocks
EXTRACTED_BLOCKS = []

# Global list to store GameData dictionaries
GAME_DATA_LIST = []


def create_game_data() -> dict:
    """Create a GameData dictionary template"""
    return {
        "timestamp": "",
        "success": "",
        "duration": "",
        "activity": "",
        "gold_earned": 0,
        "dropped_items_earned": 0,
        "kept_items_earned": 0,
        "shards_earned": 0,
        "xp_earned": 0,
        "run_xp_earned": 0,
        "sequence_xp_earned": 0,
        "caldeum_nightshade_earned": 0,
        "arreat_war_tapestry_earned": 0,
        "corrupted_angel_flesh_earned": 0,
        "khanduran_rune_earned": 0,
        "westmarch_holy_water_earned": 0,
        "rift_keys_earned": 0,
        "distance_earned": 0,
        "xp_pools_earned": 0
    }


def read_file_lines() -> List[str]:
    """Method 1: Read HISTORY_FILE_PATH as lines"""
    with open(HISTORY_FILE_PATH, 'r', encoding='utf-8') as f:
        return f.readlines()


def is_timestamp_line(line: str) -> bool:
    """Method 2: Check if line is timestamp identifier"""
    return bool(line.strip() and not line.startswith(' ') and 'INFO' in line)


def find_timestamp_lines(lines: List[str]) -> None:
    """Find timestamp lines and extract blocks"""
    global EXTRACTED_BLOCKS
    for i in range(len(lines) - 1, -1, -1):
        if is_timestamp_line(lines[i]):
            # Extract block starting from timestamp line
            block = []
            for j in range(i, min(i + LINES_TO_READ, len(lines))):
                block.append(lines[j].strip())
            EXTRACTED_BLOCKS.append(block)


def convert_blocks_to_gamedata():
    """Convert extracted blocks to GameData dictionaries"""
    global GAME_DATA_LIST
    for block in EXTRACTED_BLOCKS:
        data = create_game_data()
        for i, line in enumerate(block):
            if i == 0:  # timestamp line
                timestamp_match = re.search(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})', line)
                if timestamp_match:
                    data["timestamp"] = datetime.strptime(timestamp_match.group(1), '%Y-%m-%d %H:%M:%S')
            elif 'Success:' in line and 'Duration:' in line:
                success_match = re.search(r'Success: (True|False)', line)
                duration_match = re.search(r'Duration: ([\d:\.]+)', line)
                if success_match:
                    data["success"] = success_match.group(1) == "True"
                if duration_match:
                    duration_str = duration_match.group(1)
                    time_parts = duration_str.split(':')
                    hours = int(time_parts[0])
                    minutes = int(time_parts[1])
                    seconds = float(time_parts[2])
                    data["duration"] = timedelta(hours=hours, minutes=minutes, seconds=seconds)
            elif line in ['Rift', 'Open Rift Invalid', 'Do Rift Invalid', 'Kill Boss Invalid', 'RiftItem Invalid', 'Talk to Orek Invalid']:
                data["activity"] = line
            elif 'Earned:' in line:
                parts = line.split('Earned:')
                if len(parts) == 2:
                    field_name = parts[0].strip()
                    value = int(parts[1].strip())
                    
                    # Map field names correctly
                    if field_name == 'Gold':
                        data["gold_earned"] = value
                    elif field_name == 'DroppedItems':
                        data["dropped_items_earned"] = value
                    elif field_name == 'KeptItems':
                        data["kept_items_earned"] = value
                    elif field_name == 'Shards':
                        data["shards_earned"] = value
                    elif field_name == 'XP':
                        data["xp_earned"] = value
                    elif field_name == 'RunXP':
                        data["run_xp_earned"] = value
                    elif field_name == 'SequenceXP':
                        data["sequence_xp_earned"] = value
                    elif field_name == 'Caldeum nightshade':
                        data["caldeum_nightshade_earned"] = value
                    elif field_name == 'Arreat war tapestry':
                        data["arreat_war_tapestry_earned"] = value
                    elif field_name == 'Corrupted angel flesh':
                        data["corrupted_angel_flesh_earned"] = value
                    elif field_name == 'Khanduran rune':
                        data["khanduran_rune_earned"] = value
                    elif field_name == 'Westmarch holy water':
                        data["westmarch_holy_water_earned"] = value
                    elif field_name == 'Rift keys':
                        data["rift_keys_earned"] = value
                    elif field_name == 'Distance':
                        data["distance_earned"] = value
                    elif field_name == 'Xp Pools':
                        data["xp_pools_earned"] = value
        GAME_DATA_LIST.append(data)


def calculate_tph():
    """Calculate T/h (trillion per hour)"""
    if not GAME_DATA_LIST:
        return 0
    
    # Sort by timestamp (earliest first)
    sorted_data = sorted(GAME_DATA_LIST, key=lambda x: x["timestamp"])
    
    # Calculate total RunXP
    total_run_xp = sum(data["run_xp_earned"] for data in sorted_data)
    
    # Calculate time span
    start_time = sorted_data[0]["timestamp"]
    end_time = sorted_data[-1]["timestamp"]
    time_span = end_time - start_time
    hours = time_span.total_seconds() / 3600
    
    # Calculate T/h
    trillion_per_hour = (total_run_xp / 1e12) / hours if hours > 0 else 0
    return trillion_per_hour


def main(hours_back: int = 3):
    lines = read_file_lines()
    find_timestamp_lines(lines)
    convert_blocks_to_gamedata()
    
    # Filter by time range
    if GAME_DATA_LIST:
        latest_time = GAME_DATA_LIST[0]["timestamp"]  # First one is latest (reversed order)
        cutoff_time = latest_time - timedelta(hours=hours_back)
        
        filtered_data = []
        for data in GAME_DATA_LIST:
            if data["timestamp"] >= cutoff_time:
                filtered_data.append(data)
        
        GAME_DATA_LIST.clear()
        GAME_DATA_LIST.extend(filtered_data)
    
    
    for game_data in GAME_DATA_LIST:
        print(game_data)

    # Calculate and print T/h
    tph = calculate_tph()
    print(f"T/h: {tph:.2f} T")

    pprint.pprint(EXTRACTED_BLOCKS)

if __name__ == "__main__":
    main()
