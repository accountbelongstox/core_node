# -*- coding: utf-8 -*-
"""Process-wide console log journal.

Every ColorPrint line (structured) and every raw stdout/stderr line (print,
logging, uvicorn, warnings, tracebacks) is sequenced here once, kept in a
bounded ring plus a size-capped two-segment JSONL file, and fanned out to
sinks. One writer thread owns the sequence: producers post a message and never
wait, and the writer appends, writes the file and dispatches sinks once per
burst. Readers (`history()`) take a copy of the ring and read file pages
through the file's sparse index, on their own thread, so a page request never
queues behind log writes. Live delivery never depends on the file: ring and
sinks are fed even when the file cannot be written. Live delivery and cursor
replay share the same sequence, so a UI that misses live lines (relay
batching, reconnects, service start before any UI) restores them through
`history()` (forward from a cursor or backward with `before_seq`, ring first,
then the file) instead of losing them.
"""

from __future__ import annotations

import io
import os
import re
import sys
import threading
import time
import traceback
import uuid
from collections import deque
from typing import Any, Callable, Deque, Dict, List, Optional, TextIO, Tuple

from pycore.pyfoundations.batch_owner_thread import BatchOwnerThread
from pycore.pyfoundations.console_log_file import ConsoleLogFile
from pycore.pyfoundations.json_codec import json_codec
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


CONSOLE_LOG_RING_MAX = 5000
CONSOLE_LOG_PAGE_MAX = 1000
CONSOLE_LOG_MESSAGE_MAX_CHARS = 4000
CONSOLE_LOG_PARTIAL_MAX_CHARS = 16000
CONSOLE_LOG_BATCH_MAX = 512
CONSOLE_LOG_FAILURE_REPORT_SECONDS = 60.0
CONSOLE_LOG_FAILURE_KEY_SINK = "sink"
CONSOLE_LOG_FAILURE_KEY_WRITER = "writer"
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

_MESSAGE_COLOR_PRINT = "color_print"
_MESSAGE_RAW = "raw"
_MESSAGE_SINK_ADD = "sink_add"
_MESSAGE_SINK_REMOVE = "sink_remove"

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
        self._file = ConsoleLogFile(
            ('{"instance_id":"' + self.instance_id + '","seq":').encode("utf-8"),
            self._report_failure,
        )
        self._failure_reported: Dict[Tuple[str, int], float] = {}
        self._installed = False
        self._writer = BatchOwnerThread(
            f"{CONSOLE_LOG_STATE_QUEUE}.{self.instance_id}",
            CONSOLE_LOG_STATE_THREAD,
            self._apply,
            self._report_writer_failure,
            CONSOLE_LOG_BATCH_MAX,
        )
        self._writer.start()

    def record_color_print(
        self,
        message: Any,
        color_type: str = "white",
        log_level: Optional[str] = None,
    ) -> None:
        """ColorPrint observer: structured lines keep their color and level."""
        self._writer.post((
            _MESSAGE_COLOR_PRINT,
            CONSOLE_LOG_SOURCE_COLOR_PRINT,
            str(message),
            str(log_level or "INFO"),
            str(color_type or "white"),
            threading.current_thread().name,
            time.time(),
        ))

    def capture_raw(self, source: str, text: str) -> None:
        self._writer.post((_MESSAGE_RAW, source, text, threading.current_thread().name, time.time()))

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

    def add_sink(self, sink: ConsoleLogSink) -> None:
        self._writer.post((_MESSAGE_SINK_ADD, sink))

    def remove_sink(self, sink: ConsoleLogSink) -> None:
        self._writer.post((_MESSAGE_SINK_REMOVE, sink))

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
        ring = list(self._entries)
        seq = ring[-1]["seq"] if ring else 0
        ring_first = ring[0]["seq"] if ring else seq + 1
        earliest_seq = self._file.earliest_available(ring_first)
        replay_lost = False
        has_more = False
        if before > 0:
            selected, has_older = self._read_older(ring, ring_first, min(before, seq + 1), page_size)
        else:
            if cursor == 0:
                selected = [dict(entry) for entry in ring[-page_size:]]
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
                    selected = selected + [dict(entry) for entry in ring if entry["seq"] > reached][:room]
                has_more = bool(selected) and selected[-1]["seq"] < seq
            has_older = bool(selected) and selected[0]["seq"] > earliest_seq
        return {
            "success": True,
            "instance_id": self.instance_id,
            "seq": seq,
            "earliest_seq": earliest_seq,
            "replay_lost": replay_lost,
            "cursor_ahead": cursor > seq,
            "has_more": has_more,
            "has_older": has_older,
            "entries": selected,
        }

    def _read_older(
        self,
        ring: List[Dict[str, Any]],
        ring_first: int,
        before: int,
        count: int,
    ) -> Tuple[List[Dict[str, Any]], bool]:
        """The `count` entries ending at `before - 1` (one more is fetched to know whether older ones exist)."""
        high = before - 1
        low = max(1, high - count)
        collected: List[Dict[str, Any]] = []
        if high >= ring_first and ring:
            ring_low = max(low, ring_first)
            collected = [dict(entry) for entry in ring[ring_low - ring_first:high - ring_first + 1]]
            high = ring_low - 1
        if high >= low:
            from_file = self._decode_lines(self._file.read_range(low, high))
            if from_file and from_file[-1]["seq"] == high:
                collected = self._contiguous_suffix(from_file) + collected
        has_older = len(collected) > count
        return collected[-count:], has_older

    @staticmethod
    def _contiguous_suffix(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        start = len(entries) - 1
        while start > 0 and entries[start - 1]["seq"] == entries[start]["seq"] - 1:
            start -= 1
        return entries[max(start, 0):]

    def _read_file_forward(self, cursor: int, count: int, last_allowed: int) -> Optional[List[Dict[str, Any]]]:
        """Entries `cursor + 1 ...` from the file (at most `count`, up to `last_allowed`); None when the file lacks `cursor + 1`."""
        lines = self._file.read_range(cursor + 1, min(cursor + count, last_allowed))
        if not lines or lines[0][0] != cursor + 1:
            return None
        entries = self._decode_lines(lines)
        expected = cursor + 1
        for index, entry in enumerate(entries):
            if entry["seq"] != expected:
                return entries[:index]
            expected += 1
        return entries

    def _decode_lines(self, lines: List[Tuple[int, bytes]]) -> List[Dict[str, Any]]:
        entries: List[Dict[str, Any]] = []
        for _seq, line in lines:
            try:
                decoded = json_codec.decode(line)
            except json_codec.DecodeError:
                break
            if not isinstance(decoded, dict):
                break
            entries.append(decoded)
        return entries

    @staticmethod
    def _passthrough(stream: Any) -> Optional[TextIO]:
        if isinstance(stream, ConsoleStreamTee):
            return stream.console_passthrough
        return stream

    def _apply(self, batch: List[Any]) -> None:
        entries: List[Dict[str, Any]] = []
        for message in batch:
            kind = message[0]
            if kind == _MESSAGE_COLOR_PRINT:
                entries.append(self._append(*message[1:]))
            elif kind == _MESSAGE_RAW:
                entries.extend(self._absorb_raw(*message[1:]))
            elif kind == _MESSAGE_SINK_ADD:
                if message[1] not in self._sinks:
                    self._sinks = self._sinks + (message[1],)
            elif kind == _MESSAGE_SINK_REMOVE:
                self._sinks = tuple(item for item in self._sinks if item != message[1])
        if not entries:
            return
        self._file.write([(entry["seq"], self._encode_line(entry)) for entry in entries])
        for entry in entries:
            for sink in self._sinks:
                try:
                    sink(dict(entry))
                except Exception as exc:
                    self._report_failure(CONSOLE_LOG_FAILURE_KEY_SINK, id(sink), "sink failed: %r" % (exc,))

    def _absorb_raw(self, source: str, text: str, thread_name: str, created_at: float) -> List[Dict[str, Any]]:
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
        entries: List[Dict[str, Any]] = []
        for raw_line in lines:
            line = ANSI_ESCAPE_PATTERN.sub("", raw_line.rsplit("\r", 1)[-1]).rstrip()
            if not line.strip():
                continue
            level, color = default_level, default_color
            for marker, marker_level, marker_color in CONSOLE_LOG_RAW_LEVEL_MARKERS:
                if marker in line:
                    level, color = marker_level, marker_color
                    break
            entries.append(self._append(source, line, level, color, thread_name, created_at))
        return entries

    def _append(
        self,
        source: str,
        message: str,
        level: str,
        color: str,
        thread_name: str,
        created_at: float,
    ) -> Dict[str, Any]:
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
        return entry

    @staticmethod
    def _encode_line(entry: Dict[str, Any]) -> bytes:
        try:
            return json_codec.encode(entry) + b"\n"
        except json_codec.EncodeError:
            entry["message"] = str(entry["message"]).encode("utf-8", errors="replace").decode("utf-8")
            return json_codec.encode(entry) + b"\n"

    def _report_writer_failure(self, exc: BaseException) -> None:
        trace = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)).rstrip()
        self._report_failure(CONSOLE_LOG_FAILURE_KEY_WRITER, 0, "writer batch failed: %r\n%s" % (exc, trace))

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
