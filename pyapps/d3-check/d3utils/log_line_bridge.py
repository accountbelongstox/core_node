# -*- coding: utf-8 -*-
"""
Log line bridge: LOG_LINE events (from log_monitor observer thread) are queued here;
task thread drains the queue and calls log_analyzer.analyze_log_line.
So log_monitor does not reference log_analyzer; communication is via event center / THREAD_BUS.
"""
import queue
from typing import List

from pycore.pyfoundations.thread_bus import THREAD_BUS
from providor.constants.common import LOG_LINE

# Cap lines drained per tick to avoid one tick blocking too long (see LOG_MONITOR_EVENT_BUS_SHORTCOMINGS.md)
DRAIN_MAX_PER_TICK = 200
# Bounded queue: max 10000 lines. If full, drop oldest (get one, then put new) to keep recent lines.
QUEUE_MAXSIZE = 10000

_log_line_queue: queue.Queue = queue.Queue(maxsize=QUEUE_MAXSIZE)
_drop_count: int = 0


def _on_log_line(event_data) -> None:
    """Handler for LOG_LINE: runs in observer thread; put line into queue for task thread. Drop oldest if full."""
    if event_data is None or not isinstance(event_data, str) or not event_data.strip():
        return
    try:
        _log_line_queue.put_nowait(event_data)
    except queue.Full:
        # Queue full: drop oldest (get one) then put new to keep recent lines
        global _drop_count
        try:
            _log_line_queue.get_nowait()
            _log_line_queue.put_nowait(event_data)
            _drop_count += 1
        except queue.Empty:
            pass


def register() -> None:
    """Register LOG_LINE handler with THREAD_BUS. Call once at startup (e.g. system_initializer)."""
    THREAD_BUS.register_event_handler(LOG_LINE, _on_log_line, priority=80)


def drain() -> List[str]:
    """Drain up to DRAIN_MAX_PER_TICK lines from the queue. Call from task thread (e.g. process_rosbot_task). Returns list of lines."""
    lines: List[str] = []
    for _ in range(DRAIN_MAX_PER_TICK):
        try:
            lines.append(_log_line_queue.get_nowait())
        except queue.Empty:
            break
    return lines


def get_queue_size() -> int:
    """Get current queue size (for monitoring/debugging)."""
    return _log_line_queue.qsize()


def get_drop_count() -> int:
    """Get total count of lines dropped due to queue full (for monitoring/debugging)."""
    return _drop_count


def reset_drop_count() -> None:
    """Reset drop count (for testing/debugging)."""
    global _drop_count
    _drop_count = 0


def clear_queue() -> None:
    """Clear all pending lines (e.g. on task start if queue is too large)."""
    while True:
        try:
            _log_line_queue.get_nowait()
        except queue.Empty:
            break
