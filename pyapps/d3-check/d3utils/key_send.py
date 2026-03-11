#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
System key send (e.g. F7). Used by SmartEcho and ROSBOT debug/test.
"""

import time

from pycore.pyfoundations.third_party import get_third_package_win32api

win32api = get_third_package_win32api()
VK_F7 = 0x76


def send_f7_to_system() -> bool:
    """Send F7 key to system (global key press). Returns True if sent."""
    if win32api is None:
        return False
    win32api.keybd_event(VK_F7, 0, 0, 0)
    time.sleep(0.05)
    win32api.keybd_event(VK_F7, 0, 1, 0)  # 1 = KEYEVENTF_KEYUP
    return True
