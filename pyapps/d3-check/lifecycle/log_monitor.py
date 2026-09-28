# -*- coding: utf-8 -*-
"""
Log monitor: single place for LogMonitorThread access. Lifecycle only (thread refs allowed).
"""

from pycore.pyfoundations.third_party.api import get_third_package_watchdog

from .thread_registry import get_thread_registry


class _NoopMonitor:
    log_file_path = None
    initialized = False
    last_modified = 0.0

    def set_log_file(self, _path: str) -> None:
        pass

    def stop_watching(self) -> None:
        pass

    def set_rosbot_running(self, _running: bool) -> None:
        pass


_noop = _NoopMonitor()


def get_log_monitor():
    """Return LogMonitorThread from registry, or no-op if not started."""
    t = get_thread_registry().get_log_monitor_thread()
    return t if t is not None else _noop


def set_log_file(file_path: str) -> None:
    get_log_monitor().set_log_file(file_path)


def get_last_log_modified_time() -> float:
    m = get_log_monitor()
    if not m.initialized or not m.log_file_path:
        return 0.0
    return m.last_modified


def stop_log_watching() -> None:
    get_thread_registry().stop_log_monitor()


def set_rosbot_running(running: bool) -> None:
    get_log_monitor().set_rosbot_running(running)


def is_file_watcher_available() -> bool:
    return get_third_package_watchdog() is not None


def check_logs() -> bool:
    return False


def get_default_interceptor():
    return lambda: True
