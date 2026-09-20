#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Window activation tick.

Every TICK_INTERVAL_SECONDS, randomly picks one configured target, clicks a
fixed point or a random point inside a rectangle, presses space 1-3 times, and
may press Enter. Every RESUME_INTERVAL_SECONDS, clicks once then types
RESUME_TEXT and presses Enter as one step. Keeps looping to help keep a window
active.

Target format (each entry in TARGETS):
  [[x, y], []]              -> click exactly at (x, y)
  [[x1, y1], [x2, y2]]      -> click a random point inside the rectangle

PyAutoGUI fail-safe: when FAILSAFE is True, any call aborts if the cursor is in
a screen corner. Restoring the mouse to a corner triggers FailSafeException, so
this script skips unsafe restore targets (see PyAutoGUI docs / FAILSAFE_POINTS).

Requires pyautogui, pyperclip, and appropriate OS accessibility permissions.
"""

from __future__ import annotations

import random
import sys
import time
from typing import Sequence

import pyautogui
import pyperclip

TICK_INTERVAL_SECONDS = 5
MOVE_DURATION_SECONDS = 0.1
RESUME_INTERVAL_SECONDS = 30 * 60
RESUME_TEXT = "继续，如果已经完成则忽略该条信息。"
FAILSAFE_MARGIN = 5

# [[point_or_top_left], [bottom_right_or_empty]]
TARGETS: list[list[list[int]]] = [
    [[2007, 1141], [2460, 1379]],
]

SPACE_PRESS_MIN = 1
SPACE_PRESS_MAX = 3
ENTER_CHANCE = 0.5


def _warmup_pyautogui() -> None:
    pyautogui.size()


def _is_failsafe_point(x: int, y: int) -> bool:
    if (x, y) in pyautogui.FAILSAFE_POINTS:
        return True
    screen_width, screen_height = pyautogui.size()
    if x <= FAILSAFE_MARGIN or y <= FAILSAFE_MARGIN:
        return True
    if x >= screen_width - 1 - FAILSAFE_MARGIN:
        return True
    if y >= screen_height - 1 - FAILSAFE_MARGIN:
        return True
    return False


def safe_move_to(x: int, y: int, duration: float = MOVE_DURATION_SECONDS) -> bool:
    if _is_failsafe_point(x, y):
        print(f"[WARN] Skip moveTo ({x},{y}): PyAutoGUI fail-safe corner/margin")
        return False
    try:
        pyautogui.moveTo(x, y, duration=duration)
        return True
    except pyautogui.FailSafeException:
        print(f"[WARN] FailSafeException while moving to ({x},{y}); move skipped")
        return False


def restore_mouse_position(x: int, y: int) -> None:
    if not safe_move_to(x, y, duration=MOVE_DURATION_SECONDS):
        print(f"[WARN] Mouse left at current position; restore to ({x},{y}) skipped")


def _is_point_target(target: Sequence[Sequence[int]]) -> bool:
    if len(target) < 2:
        return True
    end = target[1]
    if not end or len(end) < 2:
        return True
    start = target[0]
    return start[0] == end[0] and start[1] == end[1]


def resolve_click_point(target: Sequence[Sequence[int]]) -> tuple[int, int, str]:
    start_x, start_y = target[0][0], target[0][1]
    if _is_point_target(target):
        return start_x, start_y, "point"

    end_x, end_y = target[1][0], target[1][1]
    left = min(start_x, end_x)
    right = max(start_x, end_x)
    top = min(start_y, end_y)
    bottom = max(start_y, end_y)
    click_x = random.randint(left, right)
    click_y = random.randint(top, bottom)
    return click_x, click_y, "rect"


def _format_target_location(
    target_kind: str,
    click_x: int,
    click_y: int,
    target: Sequence[Sequence[int]],
) -> str:
    if target_kind == "point":
        return f"({click_x},{click_y})"
    return f"({click_x},{click_y}) in [{target[0]}..{target[1]}]"


def click_at(click_x: int, click_y: int) -> bool:
    if not safe_move_to(click_x, click_y):
        return False
    pyautogui.click()
    return True


def perform_tick(target_index: int, target: Sequence[Sequence[int]]) -> None:
    click_x, click_y, target_kind = resolve_click_point(target)
    space_count = random.randint(SPACE_PRESS_MIN, SPACE_PRESS_MAX)
    press_enter = random.random() < ENTER_CHANCE
    location_text = _format_target_location(target_kind, click_x, click_y, target)

    original_position = pyautogui.position()
    if not click_at(click_x, click_y):
        print(f"[TICK] target#{target_index} {target_kind} {location_text} click skipped")
        return

    for _ in range(space_count):
        pyautogui.press("space")

    if press_enter:
        pyautogui.press("enter")

    restore_mouse_position(original_position.x, original_position.y)

    enter_text = "enter" if press_enter else "no-enter"
    print(
        f"[TICK] target#{target_index} {target_kind} {location_text} "
        f"click | space x{space_count} | {enter_text}"
    )


def perform_resume_step(target_index: int, target: Sequence[Sequence[int]]) -> None:
    click_x, click_y, target_kind = resolve_click_point(target)
    location_text = _format_target_location(target_kind, click_x, click_y, target)
    original_position = pyautogui.position()

    if not click_at(click_x, click_y):
        print(
            f"[RESUME] target#{target_index} {target_kind} {location_text} "
            f"click skipped; text step aborted"
        )
        return

    pyperclip.copy(RESUME_TEXT)
    pyautogui.hotkey("ctrl", "v")
    pyautogui.press("enter")

    restore_mouse_position(original_position.x, original_position.y)
    print(
        f"[RESUME] target#{target_index} {target_kind} {location_text} "
        f"click | paste {RESUME_TEXT!r} | enter"
    )


def main() -> int:
    if not TARGETS:
        print("TARGETS is empty; configure at least one [[x,y],[]] entry.", file=sys.stderr)
        return 1

    _warmup_pyautogui()

    print(
        f"Window activate tick started: {len(TARGETS)} target(s), "
        f"tick={TICK_INTERVAL_SECONDS}s, resume={RESUME_INTERVAL_SECONDS}s "
        f"(Ctrl+C to stop)"
    )

    next_resume_at = time.monotonic() + RESUME_INTERVAL_SECONDS

    try:
        while True:
            now = time.monotonic()
            target_index = random.randrange(len(TARGETS))
            target = TARGETS[target_index]

            if now >= next_resume_at:
                perform_resume_step(target_index, target)
                next_resume_at = now + RESUME_INTERVAL_SECONDS
            else:
                perform_tick(target_index, target)

            time.sleep(TICK_INTERVAL_SECONDS)
    except KeyboardInterrupt:
        print("\nWindow activate tick stopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
