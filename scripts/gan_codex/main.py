"""CLI entry-point for the terminal auto finder."""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Iterable

from .config import FinderSettings, MonitoringPreferences
from .config.outputs import OutputPreferences
from .finder import TerminalFinder
from .finder.window_controller import TerminalWindowController
from .monitor import (
    DiscoveryScheduler,
    GlobalInputMonitor,
    IdleState,
    IdleStateMonitor,
    TerminalDiscovery,
    TerminalInstance,
    TerminalRegistry,
)

LOGGER = logging.getLogger("gan_codex")


def _parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Automatically discover installed terminal applications.",
    )
    parser.add_argument(
        "--extra-path",
        action="append",
        default=[],
        metavar="PATH",
        help="Additional directories to scan for terminal executables",
    )
    parser.add_argument(
        "--hide-missing",
        action="store_true",
        help="Suppress the missing terminals list",
    )
    parser.add_argument(
        "--compact",
        action="store_true",
        help="Render a single line per terminal without descriptions",
    )
    parser.add_argument(
        "--monitor",
        action="store_true",
        help="Run the core monitoring subsystem in addition to static discovery.",
    )
    return parser.parse_args(argv)


class MonitoringApp:
    """Glue code for the monitoring subsystem."""

    def __init__(self, preferences: MonitoringPreferences) -> None:
        self.preferences = preferences
        self.registry = TerminalRegistry()
        self.discovery = TerminalDiscovery()
        self.scheduler = DiscoveryScheduler(
            interval_seconds=preferences.rescan_interval_seconds,
            task=self._refresh_terminals,
        )
        self.input_monitor = GlobalInputMonitor(enable_keyboard=preferences.enable_keyboard_activity)
        self.idle_monitor = IdleStateMonitor(timeout_seconds=preferences.idle_timeout_seconds)
        self._health = {"last_refresh": None, "idle_state": IdleState.ACTIVE}

    def start(self) -> None:
        LOGGER.info("Starting monitoring subsystem.")
        self.input_monitor.add_listener(self._handle_activity_event)
        self.input_monitor.start()
        self.idle_monitor.add_listener(self._handle_idle_change)
        self.idle_monitor.start()
        self.scheduler.start()
        self._refresh_terminals()

    def stop(self) -> None:
        LOGGER.info("Stopping monitoring subsystem.")
        self.scheduler.stop()
        self.idle_monitor.stop()
        self.input_monitor.stop()

    def _handle_activity_event(self, event) -> None:
        self.idle_monitor.notify_activity(event)

    def _handle_idle_change(self, state: IdleState) -> None:
        LOGGER.info("Idle state changed to %s", state.name)
        self._health["idle_state"] = state

    def _refresh_terminals(self) -> None:
        LOGGER.debug("Refreshing terminal inventory.")
        terminals = self.discovery.discover()
        self.registry.update(terminals)
        self._health["last_refresh"] = terminals

    def health_report(self) -> dict:
        return {
            "idle_state": self._health["idle_state"].name if self._health["idle_state"] else "UNKNOWN",
            "terminal_count": len(self.registry.list_instances()),
        }


def run(argv: Iterable[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    args = _parse_args(argv)
    settings = FinderSettings.from_paths(args.extra_path)
    preferences = OutputPreferences(show_missing=not args.hide_missing, compact=args.compact)

    monitoring_app = None
    if args.monitor:
        monitoring_app = MonitoringApp(MonitoringPreferences())
        monitoring_app.start()

    finder = TerminalFinder(settings=settings, output_preferences=preferences)
    available, missing, summary = finder.run()
    print(summary)

    controller = TerminalWindowController()
    if controller.is_supported:
        if available:
            clicked = controller.click_first_available(available)
            if not clicked:
                print("[WindowController] No matching terminal window found to click.")
        else:
            print("[WindowController] No available terminals to interact with.")
    else:
        print("[WindowController] Window automation libraries are unavailable on this platform.")

    if monitoring_app:
        LOGGER.info("Monitoring health: %s", monitoring_app.health_report())
        monitoring_app.stop()
    return 0 if available else 1


if __name__ == "__main__":
    sys.exit(run())
