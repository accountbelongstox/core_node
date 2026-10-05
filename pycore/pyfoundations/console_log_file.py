# -*- coding: utf-8 -*-
"""Size-capped two-segment JSONL file of the console log journal.

One writer appends whole batches; any thread reads sequence ranges through a
sparse seq-to-offset index (one point per ``CONSOLE_LOG_FILE_INDEX_STRIDE``
lines), so a page of any age is read in time proportional to the page, never
to the file. A reader only sees what the writer has already flushed.
"""

from __future__ import annotations

import bisect
import os
import sys
import time
from pathlib import Path
from typing import Any, Callable, List, NamedTuple, Optional, Tuple

from pycore.pyfoundations.data_owner import open_owned
from pycore.pyfoundations.system_paths import get_app_logs_dir

CONSOLE_LOG_FILE_NAME = "pycore_console.jsonl"
CONSOLE_LOG_FILE_BACKUP_SUFFIX = ".1"
CONSOLE_LOG_FILE_TOTAL_MAX_BYTES = 100 * 1024 * 1024
CONSOLE_LOG_FILE_SEGMENT_COUNT = 2
CONSOLE_LOG_FILE_SEGMENT_MAX_BYTES = CONSOLE_LOG_FILE_TOTAL_MAX_BYTES // CONSOLE_LOG_FILE_SEGMENT_COUNT
CONSOLE_LOG_FILE_WRITE_ATTEMPTS = 2
CONSOLE_LOG_FILE_RETRY_SECONDS = 5.0
CONSOLE_LOG_FILE_INDEX_STRIDE = 128
CONSOLE_LOG_FAILURE_KEY_FILE = "file"
CONSOLE_LOG_FAILURE_KEY_ROTATE = "rotate"

FailureReporter = Callable[[str, int, str], None]


class FileSegment:
    """Index of one file: first and last sequence, flushed size, sparse points."""

    __slots__ = ("first_seq", "last_seq", "size", "lines", "points")

    def __init__(self) -> None:
        self.first_seq: Optional[int] = None
        self.last_seq = 0
        self.size = 0
        self.lines = 0
        self.points: List[Tuple[int, int]] = []


class FileState(NamedTuple):
    floor: int
    last_seq: int
    backup: Optional[FileSegment]
    active: FileSegment


class ConsoleLogFile:
    """Writer-owned file plus the reader API over its flushed content."""

    def __init__(self, line_prefix: bytes, report_failure: FailureReporter) -> None:
        self._path = get_app_logs_dir() / CONSOLE_LOG_FILE_NAME
        self._backup_path = self._path.with_name(CONSOLE_LOG_FILE_NAME + CONSOLE_LOG_FILE_BACKUP_SUFFIX)
        self._line_prefix = line_prefix
        self._report_failure = report_failure
        self._handle: Any = None
        self._size = 0
        self._broken = True
        self._floor = 0
        self._last_seq = 0
        self._retry_at = 0.0
        self._rotate_retry_at = 0.0
        self._backup: Optional[FileSegment] = None
        self._active = FileSegment()
        self.state = FileState(0, 0, None, self._active)

    def write(self, lines: List[Tuple[int, bytes]]) -> None:
        """Append one batch with a single write and flush; a failed batch is dropped."""
        if not lines:
            return
        if time.monotonic() < self._retry_at:
            self._broken = True
            return
        group = b"".join(line for _seq, line in lines)
        failure: Optional[BaseException] = None
        for _attempt in range(CONSOLE_LOG_FILE_WRITE_ATTEMPTS):
            try:
                if self._handle is None:
                    self._open()
                base = self._size
                self._handle.write(group)
                self._handle.flush()
            except (OSError, ValueError) as exc:
                failure = exc
                self._close()
                continue
            self._commit(lines, base)
            if self._size >= CONSOLE_LOG_FILE_SEGMENT_MAX_BYTES and time.monotonic() >= self._rotate_retry_at:
                self._rotate()
            self.state = FileState(self._floor, self._last_seq, self._backup, self._active)
            return
        self._broken = True
        self._retry_at = time.monotonic() + CONSOLE_LOG_FILE_RETRY_SECONDS
        self._report_failure(CONSOLE_LOG_FAILURE_KEY_FILE, 0, "log file write failed: %r" % (failure,))

    def earliest_available(self, ring_first: int) -> int:
        """Oldest seq a reader can still get: the ring, or the file chain that joins the ring."""
        state = self.state
        firsts = [
            segment.first_seq
            for segment in (state.backup, state.active)
            if segment is not None and segment.first_seq is not None
        ]
        if not firsts or state.last_seq < ring_first - 1:
            return ring_first
        return min(ring_first, max(state.floor, min(firsts)))

    def read_range(self, low: int, high: int) -> List[Tuple[int, bytes]]:
        """Lines with ``low <= seq <= high`` of the current instance, oldest first."""
        state = self.state
        found: List[Tuple[int, bytes]] = []
        for segment, path in ((state.backup, self._backup_path), (state.active, self._path)):
            if segment is None or segment.first_seq is None or segment.last_seq < low or segment.first_seq > high:
                continue
            found.extend(self._read_segment(path, segment, low, high))
        return found

    def _read_segment(self, path: Path, segment: FileSegment, low: int, high: int) -> List[Tuple[int, bytes]]:
        points = segment.points
        index = max(0, bisect.bisect_right(points, (low, sys.maxsize)) - 1)
        offset = points[index][1]
        limit = segment.size
        found: List[Tuple[int, bytes]] = []
        try:
            handle = open(path, "rb")
        except OSError:
            return found
        with handle:
            handle.seek(offset)
            position = offset
            for raw in handle:
                position += len(raw)
                seq = self._line_seq(raw)
                if seq is None or seq > high or not raw.endswith(b"\n"):
                    break
                if seq >= low:
                    found.append((seq, raw[:-1]))
                if position >= limit:
                    break
        return found

    def _line_seq(self, line: bytes) -> Optional[int]:
        prefix = self._line_prefix
        if not line.startswith(prefix):
            return None
        end = line.find(b",", len(prefix))
        if end < 0:
            return None
        try:
            return int(line[len(prefix):end])
        except ValueError:
            return None

    def _commit(self, lines: List[Tuple[int, bytes]], base: int) -> None:
        offset = base
        segment = self._active
        for seq, line in lines:
            if self._broken:
                self._floor = seq
                self._broken = False
            if segment.first_seq is None:
                segment.first_seq = seq
            if segment.lines % CONSOLE_LOG_FILE_INDEX_STRIDE == 0:
                segment.points.append((seq, offset))
            segment.lines += 1
            segment.last_seq = seq
            offset += len(line)
        self._size = offset
        segment.size = offset
        self._last_seq = lines[-1][0]

    def _open(self) -> None:
        self._handle = open_owned(self._path, "ab")
        try:
            self._size = os.path.getsize(self._path)
        except OSError:
            self._size = 0

    def _close(self) -> None:
        handle, self._handle = self._handle, None
        if handle is None:
            return
        try:
            handle.close()
        except (OSError, ValueError):
            pass

    def _rotate(self) -> None:
        self._close()
        try:
            os.replace(self._path, self._backup_path)
        except OSError as exc:
            self._rotate_retry_at = time.monotonic() + CONSOLE_LOG_FILE_RETRY_SECONDS
            self._report_failure(CONSOLE_LOG_FAILURE_KEY_ROTATE, 0, "log file rotation failed: %r" % (exc,))
            return
        self._backup = self._active
        self._active = FileSegment()
        self._size = 0


__all__ = [
    "CONSOLE_LOG_FILE_BACKUP_SUFFIX",
    "CONSOLE_LOG_FILE_NAME",
    "ConsoleLogFile",
    "FileState",
]
