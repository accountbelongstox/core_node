"""Process and window discovery helpers."""

from __future__ import annotations

import logging
import platform
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Tuple

import psutil

try:
    import pygetwindow
except Exception:  # pragma: no cover - optional dependency
    pygetwindow = None

LOGGER = logging.getLogger(__name__)


@dataclass
class TerminalInstance:
    process_id: int
    name: str
    executable: str
    window_title: Optional[str] = None
    window_bounds: Optional[Tuple[int, int, int, int]] = None  # left, top, width, height
    is_focused: bool = False


class TerminalRegistry:
    """Store and manage terminal instances."""

    def __init__(self) -> None:
        self._instances: Dict[int, TerminalInstance] = {}

    def update(self, instances: Iterable[TerminalInstance]) -> None:
        latest = {instance.process_id: instance for instance in instances}
        self._instances = latest

    def list_instances(self) -> List[TerminalInstance]:
        return list(self._instances.values())

    def get(self, pid: int) -> Optional[TerminalInstance]:
        return self._instances.get(pid)


class TerminalDiscovery:
    """Discover terminal processes and their windows."""

    TERMINAL_PROCESS_NAMES = {
        "wt.exe",
        "powershell.exe",
        "pwsh.exe",
        "cmd.exe",
        "gnome-terminal-server",
        "konsole",
        "xterm",
        "alacritty",
        "iTerm2",
        "Terminal.app",
    }

    def __init__(self) -> None:
        self._is_windows = platform.system() == "Windows"

    def discover(self) -> List[TerminalInstance]:
        processes = []
        for proc in psutil.process_iter(["pid", "name", "exe"]):
            try:
                name = (proc.info.get("name") or "").lower()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
            if name in self.TERMINAL_PROCESS_NAMES:
                instance = TerminalInstance(
                    process_id=proc.pid,
                    name=proc.info.get("name") or name,
                    executable=proc.info.get("exe") or "",
                )
                processes.append(instance)

        if not processes:
            return processes

        if pygetwindow:
            self._enrich_with_windows(processes)
        return processes

    def _enrich_with_windows(self, processes: List[TerminalInstance]) -> None:
        try:
            windows = pygetwindow.getAllWindows()
        except Exception:  # pragma: no cover - optional dependency
            LOGGER.exception("Failed to enumerate windows via pygetwindow.")
            return

        pid_map: Dict[int, TerminalInstance] = {instance.process_id: instance for instance in processes}
        for window in windows:
            try:
                pid = window._hWnd if self._is_windows else window._hWnd  # pygetwindow attribute compatibility
            except Exception:
                continue

            instance = pid_map.get(getattr(window, "processId", None))
            if not instance:
                continue

            instance.window_title = window.title
            instance.window_bounds = (int(window.left), int(window.top), int(window.width), int(window.height))
            try:
                instance.is_focused = window.isActive
            except Exception:
                continue
