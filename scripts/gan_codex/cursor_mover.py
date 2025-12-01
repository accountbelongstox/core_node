"""Move the mouse cursor to a fixed position every few seconds."""

from __future__ import annotations

import shutil
import subprocess
import sys
import time

try:  # pragma: no cover - optional dependency
    import pyautogui
except Exception:  # noqa: BLE001 - best effort import
    pyautogui = None

# Hard-coded runtime settings
TARGET_X = 800
TARGET_Y = 600
INTERVAL_SECONDS = 5.0
MOVE_DURATION_SECONDS = 0.2
BACKEND = "auto"  # Options: "auto", "pyautogui", "xdotool"


def _pick_backend(requested: str) -> "BaseMover":
    if requested in ("auto", "pyautogui"):
        if pyautogui is None:
            if requested == "pyautogui":
                raise SystemExit(
                    "pyautogui backend selected but package is missing. "
                    "Install it via `pip install pyautogui`."
                )
        else:
            return PyAutoGuiMover()

    if requested in ("auto", "xdotool"):
        if sys.platform.startswith("linux") and shutil.which("xdotool"):
            return XDoToolMover()
        if requested == "xdotool":
            raise SystemExit(
                "xdotool backend selected but `xdotool` command not found in PATH."
            )

    if pyautogui is not None:
        return PyAutoGuiMover()

    raise SystemExit(
        "No supported cursor mover backend found. Install `pyautogui` or `xdotool`."
    )


class BaseMover:
    def move(self, x: int, y: int, duration: float) -> None:
        raise NotImplementedError


class PyAutoGuiMover(BaseMover):
    def __init__(self) -> None:
        if pyautogui is None:  # pragma: no cover - guard for mypy
            raise RuntimeError("pyautogui not available")
        pyautogui.FAILSAFE = True

    def move(self, x: int, y: int, duration: float) -> None:
        pyautogui.moveTo(x, y, duration=max(duration, 0.0))


class XDoToolMover(BaseMover):
    def move(self, x: int, y: int, duration: float) -> None:  # noqa: ARG002 - keep API
        subprocess.run(
            ["xdotool", "mousemove", str(x), str(y)],
            check=False,
        )


def main() -> int:
    interval = max(INTERVAL_SECONDS, 0.1)
    mover = _pick_backend(BACKEND)
    print(
        f"Moving cursor to ({TARGET_X}, {TARGET_Y}) every {interval} seconds. "
        f"Backend: {mover.__class__.__name__}. Press Ctrl+C to stop."
    )
    try:
        while True:
            mover.move(TARGET_X, TARGET_Y, duration=MOVE_DURATION_SECONDS)
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\nStopped cursor mover.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
