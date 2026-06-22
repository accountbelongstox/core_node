#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import time

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from providor.providor_second import CONFIG, GAME_STATE


def check_map_status(line: str):
    """Check log line for map status changes and update global state"""
    current_time = time.time()
    
    # Update activity time for every line processed
    GAME_STATE.update_activity_time(current_time)
    
    rift_start_triggers = CONFIG.get('map_status', {}).get('rift_start_triggers', [])
    rift_end_triggers = CONFIG.get('map_status', {}).get('rift_end_triggers', [])
    start_picking_items = CONFIG.get('map_status', {}).get('start_picking_items', '')
    rift_normal_pickup_items = CONFIG.get('map_status', {}).get('rift_normal_pickup_items', '')
    inventory_full = CONFIG.get('map_status', {}).get('inventory_full', '')
    
    # Get log detection triggers from config
    start_loop = CONFIG.get('log_detection', {}).get('start_loop', '')
    login_try = CONFIG.get('log_detection', {}).get('login_try', '')
    
    # Check for start loop (pause state)
    if start_loop and start_loop in line:
        GAME_STATE.pause(current_time)
        GAME_STATE.activate_loop_state(current_time)
        print(f"[MAP STATUS] PAUSED and LOOP activated for {GAME_STATE.pause_duration}s - trigger: {start_loop}")
        return
    
    # Check for login try (login state)
    if login_try and login_try in line:
        GAME_STATE.mapstatus = "loging"
        GAME_STATE.deactivate_loop_state()  # Deactivate loop state
        print(f"[MAP STATUS] Changed to LOGIN mode - trigger: {login_try}")
        return
    
    # Check for inventory full (pause state)
    if inventory_full and inventory_full in line:
        GAME_STATE.pause(current_time)
        GAME_STATE.deactivate_loop_state()  # Deactivate loop state
        print(f"[MAP STATUS] PAUSED for {GAME_STATE.pause_duration}s - trigger: {inventory_full}")

    if rift_normal_pickup_items in line:
        GAME_STATE.mapstatus = "normal"
        GAME_STATE.deactivate_loop_state()  # Deactivate loop state
        print(f"[MAP STATUS] Changed to NORMAL mode(not greater rift) - trigger: {rift_normal_pickup_items}")
        return
    
    # Check for gem upgrade state
    if start_picking_items in line:
        GAME_STATE.mapstatus = "gem_upgrade"
        GAME_STATE.reset_gem_upgrade()
        GAME_STATE.deactivate_loop_state()  # Deactivate loop state
        print(f"[MAP STATUS] Changed to GEM UPGRADE mode - trigger: {start_picking_items}")
        return
    
    for trigger in rift_start_triggers:
        if trigger in line:
            GAME_STATE.mapstatus = "rift"
            GAME_STATE.deactivate_loop_state()  # Deactivate loop state
            print(f"[MAP STATUS] Changed to RIFT mode - trigger: {trigger}")
            return
    
    for trigger in rift_end_triggers:
        if trigger in line:
            GAME_STATE.mapstatus = "normal"
            GAME_STATE.deactivate_loop_state()  # Deactivate loop state
            print(f"[MAP STATUS] Changed to NORMAL mode - trigger: {trigger}")
            return
    


def analyze_log_line(log_line: str):
    """Analyze log line for map status changes"""
    check_map_status(log_line)
