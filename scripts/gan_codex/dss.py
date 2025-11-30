from __future__ import annotations

import time
from datetime import datetime

try:
    import pyautogui
except Exception as exc:
    raise SystemExit(
        "pyautogui is required for mouse and keyboard automation. "
        "Install it via `pip install pyautogui`."
    ) from exc

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.05

PRIMARY_TARGET = (1419, 560)
SECONDARY_TARGET = (PRIMARY_TARGET[0] + 75, PRIMARY_TARGET[1] + 67)
PRE_MOVE_DELAY_SECONDS = 5.0
TICK_INTERVAL_SECONDS = 60.0
MOVE_DURATION_SECONDS = 0.2
ACTION_GAP_SECONDS = 0.15


def _wait(seconds: float) -> None:
    if seconds > 0:
        time.sleep(seconds)


def _log(message: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")


def _move_and_click(target: tuple[int, int], button: str) -> None:
    pyautogui.moveTo(target[0], target[1], duration=MOVE_DURATION_SECONDS)
    pyautogui.click(button=button)


def _return_to_original(original_pos: "pyautogui.Point") -> None:
    pyautogui.moveTo(original_pos.x, original_pos.y, duration=MOVE_DURATION_SECONDS)


def run_tick() -> float:
    start = time.monotonic()
    _log("Starting tick")
    _wait(PRE_MOVE_DELAY_SECONDS)

    original_pos = pyautogui.position()
    _log(f"Captured original position at ({original_pos.x}, {original_pos.y})")

    _move_and_click(PRIMARY_TARGET, button="right")
    _log(f"Right-clicked at primary target {PRIMARY_TARGET}")
    _wait(ACTION_GAP_SECONDS)

    _move_and_click(SECONDARY_TARGET, button="left")
    _log(f"Left-clicked at secondary target {SECONDARY_TARGET}")
    _wait(ACTION_GAP_SECONDS)

    _return_to_original(original_pos)
    _log(
        f"Returned to original position at ({original_pos.x}, {original_pos.y}) after menu click"
    )

    _move_and_click(PRIMARY_TARGET, button="left")
    _log("Left-clicked primary target before pressing Enter")
    pyautogui.press("enter")
    _log("Pressed Enter")

    return time.monotonic() - start


def main() -> int:
    _log(
        "Tick automation ready. Press Ctrl+C to stop. "
        f"Primary target {PRIMARY_TARGET}, secondary target {SECONDARY_TARGET}."
    )
    try:
        while True:
            elapsed = run_tick()
            sleep_for = max(TICK_INTERVAL_SECONDS - elapsed, 0.0)
            _log(
                f"Tick finished in {elapsed:.2f}s. Waiting {sleep_for:.2f}s for the next tick."
            )
            _wait(sleep_for)
    except KeyboardInterrupt:
        _log("Stopped tick automation.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
