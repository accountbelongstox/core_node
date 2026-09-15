#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI window activation tick with SSH / Kimiyolo bootstrap.

Startup sequence (once):
  1. Click terminal target, type SSH_COMMAND, press Enter repeatedly; repeat
     SSH_CONNECT_ATTEMPTS times with SSH_ATTEMPT_INTERVAL_SECONDS between tries.
  2. Click target, type KIMIYOLO_COMMAND, press Enter repeatedly within
     KIMIYOLO_ENTER_WINDOW_SECONDS to enter the Kimiyolo environment.
  3. Click target, paste PROMPT_TEXT, press Enter.

Main loop (same as scripts/utilities/window_activate_tick.py):
  Random click + space 1-3 times + optional Enter; every RESUME_INTERVAL_SECONDS
  paste RESUME_TEXT and press Enter.

Requires pyautogui, pyperclip, and appropriate OS accessibility permissions.
"""

from __future__ import annotations

import random
import sys
import time
from typing import Sequence

import pyautogui
import pyperclip

SSH_COMMAND = "ssh1"
SSH_CONNECT_ATTEMPTS = 10
SSH_ENTER_PRESS_MIN = 2
SSH_ENTER_PRESS_MAX = 4
SSH_ATTEMPT_INTERVAL_SECONDS = 3.0
SSH_TYPE_INTERVAL_SECONDS = 0.05

KIMIYOLO_COMMAND = "kimiyolo"
KIMIYOLO_ENTER_WINDOW_SECONDS = 30.0
KIMIYOLO_ENTER_PRESS_COUNT = 10
KIMIYOLO_TYPE_INTERVAL_SECONDS = 0.05

PROMPT_TEXT = "请继续完成之前的开发任务。"

TICK_INTERVAL_SECONDS = 5.0
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


def pick_random_target() -> tuple[int, Sequence[Sequence[int]]]:
    target_index = random.randrange(len(TARGETS))
    return target_index, TARGETS[target_index]


def click_at(click_x: int, click_y: int) -> bool:
    if not safe_move_to(click_x, click_y):
        return False
    pyautogui.click()
    return True


def click_random_target() -> tuple[int, int, str, int, Sequence[Sequence[int]]] | None:
    target_index, target = pick_random_target()
    click_x, click_y, target_kind = resolve_click_point(target)
    location_text = _format_target_location(target_kind, click_x, click_y, target)
    if not click_at(click_x, click_y):
        print(f"[CLICK] target#{target_index} {target_kind} {location_text} skipped")
        return None
    return click_x, click_y, target_kind, target_index, target


def type_ascii_command(text: str, interval: float) -> None:
    pyautogui.write(text, interval=interval)


def paste_text(text: str) -> None:
    pyperclip.copy(text)
    pyautogui.hotkey("ctrl", "v")


def press_enter(count: int) -> None:
    for _ in range(count):
        pyautogui.press("enter")


def run_with_mouse_restore(action) -> None:
    original_position = pyautogui.position()
    action()
    restore_mouse_position(original_position.x, original_position.y)


def run_ssh_bootstrap() -> None:
    print(
        f"[BOOT] SSH phase: command={SSH_COMMAND!r}, attempts={SSH_CONNECT_ATTEMPTS}, "
        f"interval={SSH_ATTEMPT_INTERVAL_SECONDS}s"
    )
    for attempt in range(1, SSH_CONNECT_ATTEMPTS + 1):
        enter_count = random.randint(SSH_ENTER_PRESS_MIN, SSH_ENTER_PRESS_MAX)
        original_position = pyautogui.position()

        clicked = click_random_target()
        if clicked is None:
            print(f"[BOOT][SSH] attempt {attempt}/{SSH_CONNECT_ATTEMPTS} click failed")
        else:
            _, _, target_kind, target_index, target = clicked
            location_text = _format_target_location(target_kind, clicked[0], clicked[1], target)
            type_ascii_command(SSH_COMMAND, SSH_TYPE_INTERVAL_SECONDS)
            press_enter(enter_count)
            print(
                f"[BOOT][SSH] attempt {attempt}/{SSH_CONNECT_ATTEMPTS} "
                f"target#{target_index} {target_kind} {location_text} "
                f"type {SSH_COMMAND!r} | enter x{enter_count}"
            )

        restore_mouse_position(original_position.x, original_position.y)
        if attempt < SSH_CONNECT_ATTEMPTS:
            time.sleep(SSH_ATTEMPT_INTERVAL_SECONDS)


def run_kimiyolo_bootstrap() -> None:
    enter_interval = KIMIYOLO_ENTER_WINDOW_SECONDS / max(KIMIYOLO_ENTER_PRESS_COUNT, 1)
    print(
        f"[BOOT] Kimiyolo phase: command={KIMIYOLO_COMMAND!r}, "
        f"enter x{KIMIYOLO_ENTER_PRESS_COUNT} within {KIMIYOLO_ENTER_WINDOW_SECONDS}s"
    )

    def kimiyolo_action() -> None:
        clicked = click_random_target()
        if clicked is None:
            print("[BOOT][KIMIYOLO] click failed; phase aborted")
            return
        _, _, target_kind, target_index, target = clicked
        location_text = _format_target_location(target_kind, clicked[0], clicked[1], target)
        type_ascii_command(KIMIYOLO_COMMAND, KIMIYOLO_TYPE_INTERVAL_SECONDS)
        press_enter(1)
        print(
            f"[BOOT][KIMIYOLO] target#{target_index} {target_kind} {location_text} "
            f"type {KIMIYOLO_COMMAND!r} | enter x1"
        )
        for press_index in range(2, KIMIYOLO_ENTER_PRESS_COUNT + 1):
            time.sleep(enter_interval)
            pyautogui.press("enter")
            print(f"[BOOT][KIMIYOLO] follow-up enter {press_index}/{KIMIYOLO_ENTER_PRESS_COUNT}")

    run_with_mouse_restore(kimiyolo_action)


def run_prompt_bootstrap() -> None:
    print(f"[BOOT] Prompt phase: text={PROMPT_TEXT!r}")

    def prompt_action() -> None:
        clicked = click_random_target()
        if clicked is None:
            print("[BOOT][PROMPT] click failed; phase aborted")
            return
        _, _, target_kind, target_index, target = clicked
        location_text = _format_target_location(target_kind, clicked[0], clicked[1], target)
        paste_text(PROMPT_TEXT)
        press_enter(1)
        print(
            f"[BOOT][PROMPT] target#{target_index} {target_kind} {location_text} "
            f"paste {PROMPT_TEXT!r} | enter"
        )

    run_with_mouse_restore(prompt_action)


def run_bootstrap() -> None:
    run_ssh_bootstrap()
    run_kimiyolo_bootstrap()
    run_prompt_bootstrap()
    print("[BOOT] Bootstrap finished; entering activation loop")


def perform_tick(target_index: int, target: Sequence[Sequence[int]]) -> None:
    click_x, click_y, target_kind = resolve_click_point(target)
    space_count = random.randint(SPACE_PRESS_MIN, SPACE_PRESS_MAX)
    press_enter_once = random.random() < ENTER_CHANCE
    location_text = _format_target_location(target_kind, click_x, click_y, target)

    original_position = pyautogui.position()
    if not click_at(click_x, click_y):
        print(f"[TICK] target#{target_index} {target_kind} {location_text} click skipped")
        return

    for _ in range(space_count):
        pyautogui.press("space")

    if press_enter_once:
        pyautogui.press("enter")

    restore_mouse_position(original_position.x, original_position.y)

    enter_text = "enter" if press_enter_once else "no-enter"
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

    paste_text(RESUME_TEXT)
    pyautogui.press("enter")

    restore_mouse_position(original_position.x, original_position.y)
    print(
        f"[RESUME] target#{target_index} {target_kind} {location_text} "
        f"click | paste {RESUME_TEXT!r} | enter"
    )


def run_activation_loop() -> None:
    next_resume_at = time.monotonic() + RESUME_INTERVAL_SECONDS

    while True:
        now = time.monotonic()
        target_index, target = pick_random_target()

        if now >= next_resume_at:
            perform_resume_step(target_index, target)
            next_resume_at = now + RESUME_INTERVAL_SECONDS
        else:
            perform_tick(target_index, target)

        time.sleep(TICK_INTERVAL_SECONDS)


def main() -> int:
    if not TARGETS:
        print("TARGETS is empty; configure at least one [[x,y],[]] entry.", file=sys.stderr)
        return 1

    _warmup_pyautogui()

    print(
        f"AI window activate tick started: {len(TARGETS)} target(s), "
        f"tick={TICK_INTERVAL_SECONDS}s, resume={RESUME_INTERVAL_SECONDS}s "
        f"(Ctrl+C to stop)"
    )

    try:
        run_bootstrap()
        run_activation_loop()
    except KeyboardInterrupt:
        print("\nAI window activate tick stopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
