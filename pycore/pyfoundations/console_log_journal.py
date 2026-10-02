# -*- coding: utf-8 -*-
"""Process-wide console log journal.

Every ColorPrint line (structured) and every raw stdout/stderr line (print,
logging, uvicorn, warnings, tracebacks) is sequenced here once, kept in a
bounded ring plus a size-capped two-segment JSONL file, and fanned out to
sinks. Live delivery never depends on the file: ring and sinks are fed even
when the file cannot be written. Live delivery and cursor replay share the
same sequence, so a UI that misses live lines (relay batching, reconnects,
service start before any UI) restores them through `history()` (forward from
a cursor or backward with `before_seq`, ring first, then the file) instead of
losing them.
"""

from __future__ import annotations

import io
import json
import os
import re
import sys
import threading
import time
import uuid
from collections import deque
from pathlib import Path
from typing import Any, Callable, Deque, Dict, Iterator, List, Optional, TextIO, Tuple

from pycore.pyfoundations.data_owner import open_owned
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.system_paths import get_app_logs_dir
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS


CONSOLE_LOG_RING_MAX = 5000
CONSOLE_LOG_PAGE_MAX = 1000
CONSOLE_LOG_MESSAGE_MAX_CHARS = 4000
CONSOLE_LOG_PARTIAL_MAX_CHARS = 16000
CONSOLE_LOG_FILE_NAME = "pycore_console.jsonl"
CONSOLE_LOG_FILE_BACKUP_SUFFIX = ".1"
CONSOLE_LOG_FILE_TOTAL_MAX_BYTES = 100 * 1024 * 1024
CONSOLE_LOG_FILE_SEGMENT_COUNT = 2
CONSOLE_LOG_FILE_SEGMENT_MAX_BYTES = CONSOLE_LOG_FILE_TOTAL_MAX_BYTES // CONSOLE_LOG_FILE_SEGMENT_COUNT
CONSOLE_LOG_FILE_WRITE_ATTEMPTS = 2
CONSOLE_LOG_FILE_RETRY_SECONDS = 5.0
CONSOLE_LOG_FILE_REVERSE_BLOCK_BYTES = 256 * 1024
CONSOLE_LOG_FAILURE_REPORT_SECONDS = 60.0
CONSOLE_LOG_FAILURE_KEY_FILE = "file"
CONSOLE_LOG_FAILURE_KEY_ROTATE = "rotate"
CONSOLE_LOG_FAILURE_KEY_SINK = "sink"
CONSOLE_LOG_STATE_QUEUE = "pyfoundations.console_log.state"
CONSOLE_LOG_STATE_THREAD = "ConsoleLogJournalThread"
CONSOLE_LOG_SOURCE_COLOR_PRINT = "color_print"
CONSOLE_LOG_SOURCE_STDOUT = "stdout"
CONSOLE_LOG_SOURCE_STDERR = "stderr"
CONSOLE_LOG_RAW_DEFAULTS = {
    CONSOLE_LOG_SOURCE_STDOUT: ("INFO", "white"),
    CONSOLE_LOG_SOURCE_STDERR: ("INFO", "gray"),
}
CONSOLE_LOG_RAW_LEVEL_MARKERS = (
    ("Traceback", "ERROR", "red"),
    ("Exception", "ERROR", "red"),
    ("ERROR", "ERROR", "red"),
    ("Error", "ERROR", "red"),
    ("WARNING", "WARNING", "yellow"),
    ("Warning", "WARNING", "yellow"),
)
ANSI_ESCAPE_PATTERN = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]")

ConsoleLogSink = Callable[[Dict[str, Any]], None]


class ConsoleStreamTee(io.TextIOBase):
    """sys.stdout / sys.stderr replacement: pass through, then journal."""

    def __init__(
        self,
        passthrough: Optional[TextIO],
        source: str,
        journal: "ConsoleLogJournal",
    ) -> None:
        super().__init__()
        self.console_passthrough = passthrough
        self._source = source
        self._journal = journal

    @property
    def encoding(self) -> str:
        return str(getattr(self.console_passthrough, "encoding", None) or "utf-8")

    @property
    def errors(self) -> Optional[str]:
        return getattr(self.console_passthrough, "errors", None)

    def writable(self) -> bool:
        return True

    def write(self, text: str) -> int:
        value = str(text)
        if self.console_passthrough is not None:
            try:
                self.console_passthrough.write(value)
            except (OSError, ValueError):
                pass
        if value:
            self._journal.capture_raw(self._source, value)
        return len(value)

    def flush(self) -> None:
        if self.console_passthrough is not None:
            try:
                self.console_passthrough.flush()
            except (OSError, ValueError):
                pass

    def isatty(self) -> bool:
        return bool(self.console_passthrough is not None and self.console_passthrough.isatty())

    def fileno(self) -> int:
        if self.console_passthrough is None:
            raise io.UnsupportedOperation("fileno")
        return self.console_passthrough.fileno()

    def __getattr__(self, name: str) -> Any:
        passthrough = self.__dict__.get("console_passthrough")
        if passthrough is None:
            raise AttributeError(name)
        return getattr(passthrough, name)


class ConsoleLogJournal:
    """Single owner of the console log sequence, ring, file and sinks."""

    def __init__(self) -> None:
        self.instance_id = uuid.uuid4().hex
        self._seq = 0
        self._entries: Deque[Dict[str, Any]] = deque(maxlen=CONSOLE_LOG_RING_MAX)
        self._partials: Dict[str, str] = {}
        self._sinks: Tuple[ConsoleLogSink, ...] = ()
        self._file: Optional[TextIO] = None
        self._file_size = 0
        self._file_path = get_app_logs_dir() / CONSOLE_LOG_FILE_NAME
        self._backup_path = self._file_path.with_name(CONSOLE_LOG_FILE_NAME + CONSOLE_LOG_FILE_BACKUP_SUFFIX)
        self._line_prefix = ('{"instance_id": ' + json.dumps(self.instance_id) + ', "seq": ').encode("utf-8")
        self._file_broken = True
        self._file_floor = 0
        self._file_last_seq = 0
        self._segment_firsts: List[Optional[int]] = [None, None]
        self._file_retry_at = 0.0
        self._rotate_retry_at = 0.0
        self._failure_reported: Dict[Tuple[str, int], float] = {}
        self._installed = False
        init_serialized_owner(self, CONSOLE_LOG_STATE_QUEUE, CONSOLE_LOG_STATE_THREAD)

    def record_color_print(
        self,
        message: Any,
        color_type: str = "white",
        log_level: Optional[str] = None,
    ) -> None:
        """ColorPrint observer: structured lines keep their color and level."""
        self._post(
            self._append,
            CONSOLE_LOG_SOURCE_COLOR_PRINT,
            str(message),
            str(log_level or "INFO"),
            str(color_type or "white"),
            threading.current_thread().name,
            time.time(),
        )

    def capture_raw(self, source: str, text: str) -> None:
        self._post(
            self._absorb_raw,
            source,
            text,
            threading.current_thread().name,
            time.time(),
        )

    @serialized_method
    def install(self) -> bool:
        """Route ColorPrint and the process stdout/stderr into the journal."""
        if self._installed:
            return False
        self._installed = True
        ColorPrint.register_callback(self.record_color_print)
        if ColorPrint.is_mcp_mode():
            return True
        stdout_passthrough = self._passthrough(sys.stdout)
        stderr_passthrough = self._passthrough(sys.stderr)
        # ColorPrint writes to the real console (never through the tee) so
        # its lines are journaled once, structured, via the callback above.
        ColorPrint.set_output_stream(
            stderr_passthrough
            if stderr_passthrough is not None
            else open(os.devnull, "w", encoding="utf-8")
        )
        sys.stdout = ConsoleStreamTee(stdout_passthrough, CONSOLE_LOG_SOURCE_STDOUT, self)
        sys.stderr = ConsoleStreamTee(stderr_passthrough, CONSOLE_LOG_SOURCE_STDERR, self)
        return True

    @serialized_method
    def add_sink(self, sink: ConsoleLogSink) -> None:
        if sink not in self._sinks:
            self._sinks = self._sinks + (sink,)

    @serialized_method
    def remove_sink(self, sink: ConsoleLogSink) -> None:
        self._sinks = tuple(item for item in self._sinks if item != sink)

    @serialized_method
    def history(
        self,
        since_seq: int = 0,
        limit: int = CONSOLE_LOG_PAGE_MAX,
        before_seq: int = 0,
    ) -> Dict[str, Any]:
        """Page of the current instance: newest tail, forward from `since_seq`, or backward before `before_seq`."""
        cursor = max(0, int(since_seq or 0))
        before = max(0, int(before_seq or 0))
        page_size = max(1, min(int(limit or CONSOLE_LOG_PAGE_MAX), CONSOLE_LOG_PAGE_MAX))
        ring_first = self._entries[0]["seq"] if self._entries else self._seq + 1
        earliest_seq = self._earliest_available(ring_first)
        replay_lost = False
        has_more = False
        if before > 0:
            selected, has_older = self._read_older(min(before, self._seq + 1), page_size)
        else:
            if cursor == 0:
                selected = [dict(entry) for entry in list(self._entries)[-page_size:]]
            else:
                effective = cursor
                if cursor + 1 < earliest_seq:
                    replay_lost = True
                    effective = earliest_seq - 1
                selected = []
                if effective + 1 < ring_first:
                    selected = self._read_file_forward(effective, page_size, ring_first - 1)
                    if selected is None:
                        replay_lost = True
                        effective = ring_first - 1
                        earliest_seq = ring_first
                        selected = []
                reached = selected[-1]["seq"] if selected else effective
                if reached + 1 >= ring_first and len(selected) < page_size:
                    room = page_size - len(selected)
                    selected = selected + [
                        dict(entry) for entry in self._entries if entry["seq"] > reached
                    ][:room]
                has_more = bool(selected) and selected[-1]["seq"] < self._seq
            has_older = bool(selected) and selected[0]["seq"] > earliest_seq
        return {
            "success": True,
            "instance_id": self.instance_id,
            "seq": self._seq,
            "earliest_seq": earliest_seq,
            "replay_lost": replay_lost,
            "cursor_ahead": cursor > self._seq,
            "has_more": has_more,
            "has_older": has_older,
            "entries": selected,
        }

    def _earliest_available(self, ring_first: int) -> int:
        """Oldest seq a reader can still get: the ring, or the file chain that joins the ring."""
        firsts = [value for value in self._segment_firsts if value is not None]
        if not firsts or self._file_last_seq < ring_first - 1:
            return ring_first
        return min(ring_first, max(self._file_floor, min(firsts)))

    def _read_older(self, before: int, count: int) -> Tuple[List[Dict[str, Any]], bool]:
        collected: List[Dict[str, Any]] = []
        chain = self._iter_older(before - 1)
        try:
            for entry in chain:
                collected.append(entry)
                if len(collected) > count:
                    break
        finally:
            chain.close()
        has_older = len(collected) > count
        collected = collected[:count]
        collected.reverse()
        return collected, has_older

    def _iter_older(self, expected: int) -> Iterator[Dict[str, Any]]:
        """Entries `expected`, `expected - 1`, ... from the ring, then the file, stopping at the first gap."""
        for entry in reversed(self._entries):
            if entry["seq"] > expected:
                continue
            if entry["seq"] != expected:
                return
            yield dict(entry)
            expected -= 1
        if expected < 1:
            return
        for seq, line in self._iter_file_lines(expected):
            if seq != expected:
                return
            decoded = self._decode_line(line)
            if decoded is None:
                return
            yield decoded
            expected -= 1
            if expected < 1:
                return

    def _read_file_forward(self, cursor: int, count: int, last_allowed: int) -> Optional[List[Dict[str, Any]]]:
        """Entries `cursor + 1 ...` from the file (at most `count`, up to `last_allowed`); None when the file lacks `cursor + 1`."""
        found: List[Tuple[int, bytes]] = []
        chain = self._iter_file_lines(min(cursor + count, last_allowed))
        try:
            for seq, line in chain:
                if seq <= cursor:
                    break
                found.append((seq, line))
        finally:
            chain.close()
        if not found or found[-1][0] != cursor + 1:
            return None
        found.reverse()
        entries: List[Dict[str, Any]] = []
        for _seq, line in found:
            decoded = self._decode_line(line)
            if decoded is None:
                break
            entries.append(decoded)
        return entries

    def _iter_file_lines(self, ceiling: int) -> Iterator[Tuple[int, bytes]]:
        """Current-instance lines newest first (active, then backup) with seq <= ceiling, consecutive after the first."""
        previous: Optional[int] = None
        for path in (self._file_path, self._backup_path):
            for line in self._iter_lines_reverse(path):
                seq = self._line_seq(line)
                if seq is None:
                    return
                if seq > ceiling:
                    continue
                if previous is not None and seq != previous - 1:
                    return
                previous = seq
                yield seq, line

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

    @staticmethod
    def _decode_line(line: bytes) -> Optional[Dict[str, Any]]:
        try:
            decoded = json.loads(line)
        except ValueError:
            return None
        return decoded if isinstance(decoded, dict) else None

    @staticmethod
    def _iter_lines_reverse(path: Path) -> Iterator[bytes]:
        try:
            handle = open(path, "rb")
        except OSError:
            return
        with handle:
            handle.seek(0, os.SEEK_END)
            position = handle.tell()
            tail = b""
            while position > 0:
                step = min(CONSOLE_LOG_FILE_REVERSE_BLOCK_BYTES, position)
                position -= step
                handle.seek(position)
                pieces = (handle.read(step) + tail).split(b"\n")
                tail = pieces[0]
                for piece in reversed(pieces[1:]):
                    if piece:
                        yield piece
            if tail:
                yield tail

    @staticmethod
    def _passthrough(stream: Any) -> Optional[TextIO]:
        if isinstance(stream, ConsoleStreamTee):
            return stream.console_passthrough
        return stream

    def _post(self, callback: Callable[..., None], *args: Any) -> None:
        THREAD_BUS.send_message(
            self._serialized_queue_name,
            {"callback": callback, "args": args, "queued_at": time.monotonic()},
        )

    def _absorb_raw(self, source: str, text: str, thread_name: str, created_at: float) -> None:
        buffered = self._partials.get(source, "") + text
        lines = buffered.split("\n")
        remainder = lines.pop()
        if len(remainder) > CONSOLE_LOG_PARTIAL_MAX_CHARS:
            lines.append(remainder)
            remainder = ""
        self._partials[source] = remainder
        default_level, default_color = CONSOLE_LOG_RAW_DEFAULTS.get(
            source,
            CONSOLE_LOG_RAW_DEFAULTS[CONSOLE_LOG_SOURCE_STDOUT],
        )
        for raw_line in lines:
            line = ANSI_ESCAPE_PATTERN.sub("", raw_line.rsplit("\r", 1)[-1]).rstrip()
            if not line.strip():
                continue
            level, color = default_level, default_color
            for marker, marker_level, marker_color in CONSOLE_LOG_RAW_LEVEL_MARKERS:
                if marker in line:
                    level, color = marker_level, marker_color
                    break
            self._append(source, line, level, color, thread_name, created_at)

    def _append(
        self,
        source: str,
        message: str,
        level: str,
        color: str,
        thread_name: str,
        created_at: float,
    ) -> None:
        self._seq += 1
        entry = {
            "instance_id": self.instance_id,
            "seq": self._seq,
            "ts": int(created_at * 1000),
            "source": source,
            "level": level,
            "color": color,
            "thread": thread_name,
            "message": message[:CONSOLE_LOG_MESSAGE_MAX_CHARS],
        }
        self._entries.append(entry)
        try:
            self._write_file(entry)
        except Exception as exc:
            self._report_failure(CONSOLE_LOG_FAILURE_KEY_FILE, 0, "log file write failed: %r" % (exc,))
        for sink in self._sinks:
            try:
                sink(dict(entry))
            except Exception as exc:
                self._report_failure(CONSOLE_LOG_FAILURE_KEY_SINK, id(sink), "sink failed: %r" % (exc,))

    def _write_file(self, entry: Dict[str, Any]) -> None:
        if time.monotonic() < self._file_retry_at:
            self._file_broken = True
            return
        line = json.dumps(entry, ensure_ascii=False) + "\n"
        size = len(line.encode("utf-8", errors="replace"))
        failure: Optional[BaseException] = None
        for _attempt in range(CONSOLE_LOG_FILE_WRITE_ATTEMPTS):
            try:
                if self._file is None:
                    self._open_file()
                if (
                    self._file_size > 0
                    and self._file_size + size > CONSOLE_LOG_FILE_SEGMENT_MAX_BYTES
                    and time.monotonic() >= self._rotate_retry_at
                ):
                    self._rotate_file()
                self._file.write(line)
                self._file_size += size
                self._note_written(entry["seq"])
                return
            except (OSError, ValueError) as exc:
                failure = exc
                self._close_file()
        self._file_broken = True
        self._file_retry_at = time.monotonic() + CONSOLE_LOG_FILE_RETRY_SECONDS
        self._report_failure(CONSOLE_LOG_FAILURE_KEY_FILE, 0, "log file write failed: %r" % (failure,))

    def _open_file(self) -> None:
        self._file = open_owned(
            self._file_path,
            "a",
            encoding="utf-8",
            errors="replace",
            newline="\n",
            buffering=1,
        )
        try:
            self._file_size = os.path.getsize(self._file_path)
        except OSError:
            self._file_size = 0

    def _close_file(self) -> None:
        handle, self._file = self._file, None
        if handle is None:
            return
        try:
            handle.close()
        except (OSError, ValueError):
            pass

    def _rotate_file(self) -> None:
        self._close_file()
        try:
            os.replace(self._file_path, self._backup_path)
        except OSError as exc:
            self._rotate_retry_at = time.monotonic() + CONSOLE_LOG_FILE_RETRY_SECONDS
            self._report_failure(CONSOLE_LOG_FAILURE_KEY_ROTATE, 0, "log file rotation failed: %r" % (exc,))
        else:
            self._segment_firsts = [self._segment_firsts[1], None]
        self._open_file()

    def _note_written(self, seq: int) -> None:
        if self._file_broken:
            self._file_floor = seq
            self._file_broken = False
        if self._segment_firsts[1] is None:
            self._segment_firsts[1] = seq
        self._file_last_seq = seq

    def _report_failure(self, kind: str, owner: int, detail: str) -> None:
        now = time.monotonic()
        key = (kind, owner)
        if now - self._failure_reported.get(key, -CONSOLE_LOG_FAILURE_REPORT_SECONDS) < CONSOLE_LOG_FAILURE_REPORT_SECONDS:
            return
        self._failure_reported[key] = now
        stream = sys.__stderr__
        if stream is None:
            return
        try:
            stream.write("[ConsoleLogJournal] " + detail + "\n")
            stream.flush()
        except Exception:
            pass


console_log_journal = ConsoleLogJournal()


__all__ = ["console_log_journal"]
