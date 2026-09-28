#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
kimi_active: SSH / Kimiyolo bootstrap plus window activation.

Optional scheduled start: set SCHEDULED_START_TIME = "02:47" or pass HH:MM as the
first CLI argument. The script waits until that local time, then runs.

Startup sequence (once):
  1. Click terminal target, type SSH_COMMAND, press Enter repeatedly; repeat
     SSH_CONNECT_ATTEMPTS times with SSH_ATTEMPT_INTERVAL_SECONDS between tries.
  2. Click target, type KIMIYOLO_COMMAND, press Enter repeatedly within
     KIMIYOLO_ENTER_WINDOW_SECONDS to enter the Kimiyolo environment.
  3. Click target, paste PROMPT_TEXT, press Enter.

Main loop:
  Random click + space 1-3 times + optional Enter; every RESUME_INTERVAL_SECONDS
  paste RESUME_TEXT and press Enter.

Requires pyautogui, pyperclip, and appropriate OS accessibility permissions.
"""

from __future__ import annotations

import random
import sys
import time
from datetime import datetime, timedelta
from typing import Sequence

import pyautogui
import pyperclip

SCHEDULED_START_TIME = "03:59"
SCHEDULE_POLL_SECONDS = 30.0

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

PROMPT_TEXT = "切换工作目录到 /www/programing/core_node/ ，阅讲：docs_fix/origin/kimi1.txt，然后从'新任务：'开始完成之前的开发任务(注意之前的文字只是任务指引，作为参数具体要看实际代码)。注意不要使用多agents，只使用一个agent."

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


def parse_schedule_time(schedule_text: str) -> tuple[int, int]:
    text = schedule_text.strip()
    parts = text.split(":")
    if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
        raise ValueError(f"Invalid schedule time {schedule_text!r}; use HH:MM such as 02:47")

    hour = int(parts[0])
    minute = int(parts[1])
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise ValueError(f"Invalid schedule time {schedule_text!r}; hour must be 0-23, minute 0-59")
    return hour, minute


def format_remaining_hms(total_seconds: float) -> str:
    seconds = max(0, int(total_seconds))
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def resolve_target_datetime(schedule_text: str, now: datetime | None = None) -> datetime:
    current = now or datetime.now()
    hour, minute = parse_schedule_time(schedule_text)
    target = current.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if target <= current:
        target += timedelta(days=1)
    return target


def resolve_scheduled_start_time() -> str | None:
    if len(sys.argv) >= 2:
        cli_value = sys.argv[1].strip()
        if cli_value.lower() in ("", "now", "immediate"):
            return None
        return cli_value

    constant_value = SCHEDULED_START_TIME.strip()
    if constant_value:
        return constant_value
    return None


def wait_until_scheduled_time(schedule_text: str) -> None:
    target = resolve_target_datetime(schedule_text)
    print(
        f"[SCHEDULE] Waiting until {target.strftime('%Y-%m-%d %H:%M:%S')} "
        f"(input {schedule_text!r}, Ctrl+C to cancel)"
    )

    while True:
        remaining_seconds = (target - datetime.now()).total_seconds()
        if remaining_seconds <= 0:
            break
        print(f"[SCHEDULE] Remaining {format_remaining_hms(remaining_seconds)}")
        time.sleep(min(remaining_seconds, SCHEDULE_POLL_SECONDS))

    print("[SCHEDULE] Start time reached; running kimi_active")


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

    schedule_text = resolve_scheduled_start_time()
    if schedule_text:
        try:
            wait_until_scheduled_time(schedule_text)
        except ValueError as exc:
            print(exc, file=sys.stderr)
            return 1
        except KeyboardInterrupt:
            print("\n[SCHEDULE] Cancelled before start.")
            return 0

    _warmup_pyautogui()

    print(
        f"kimi_active started: {len(TARGETS)} target(s), "
        f"tick={TICK_INTERVAL_SECONDS}s, resume={RESUME_INTERVAL_SECONDS}s "
        f"(Ctrl+C to stop)"
    )

    try:
        run_bootstrap()
        run_activation_loop()
    except KeyboardInterrupt:
        print("\nkimi_active stopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
