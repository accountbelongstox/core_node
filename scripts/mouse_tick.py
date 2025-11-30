#!/usr/bin/env python3
"""
Automated mouse tick script.

Every minute, the script performs the following sequence:
1. Move to (1419, 560) and right-click.
2. Move to (1494, 627) and left-click.
3. Return to (1419, 560), left-click, and press Enter.
4. Restore the mouse to its original position.

Requires the `pyautogui` package and appropriate accessibility permissions.
"""

from __future__ import annotations

import time

import pyautogui


BASE_X, BASE_Y = 1419, 560
OFFSET_X, OFFSET_Y = 75, 67
TICK_INTERVAL_SECONDS = 60


def perform_tick() -> None:
    original_position = pyautogui.position()

    pyautogui.moveTo(BASE_X, BASE_Y, duration=0.1)
    pyautogui.click(button="right")

    pyautogui.moveTo(BASE_X + OFFSET_X, BASE_Y + OFFSET_Y, duration=0.1)
    pyautogui.click()

    pyautogui.moveTo(BASE_X, BASE_Y, duration=0.1)
    pyautogui.click()
    pyautogui.press("enter")

    pyautogui.moveTo(original_position.x, original_position.y, duration=0.1)


def main() -> None:
    try:
        while True:
            perform_tick()
            time.sleep(TICK_INTERVAL_SECONDS)
    except KeyboardInterrupt:
        print("Mouse tick automation stopped.")


if __name__ == "__main__":
    main()
