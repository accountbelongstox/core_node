# -*- coding: utf-8 -*-
"""Process-wide console log journal.

Every ColorPrint line (structured) and every raw stdout/stderr line (print,
logging, uvicorn, warnings, tracebacks) is sequenced here once, kept in a
bounded ring plus a rotating JSONL file, and fanned out to sinks. Live
delivery and cursor replay share the same sequence, so a UI that misses live
lines (relay batching, reconnects, service start before any UI) restores them
through `history()` instead of losing them.
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
from typing import Any, Callable, Deque, Dict, Optional, TextIO, Tuple

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
CONSOLE_LOG_FILE_MAX_BYTES = 20 * 1024 * 1024
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
            self.console_passthrough.write(value)
        if value:
            self._journal.capture_raw(self._source, value)
        return len(value)

    def flush(self) -> None:
        if self.console_passthrough is not None:
            self.console_passthrough.flush()

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
        self._file_path = get_app_logs_dir() / CONSOLE_LOG_FILE_NAME
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
    def history(self, since_seq: int = 0, limit: int = CONSOLE_LOG_PAGE_MAX) -> Dict[str, Any]:
        """Cursor page after `since_seq`; `since_seq=0` returns the newest tail."""
        cursor = max(0, int(since_seq or 0))
        page_size = max(1, min(int(limit or CONSOLE_LOG_PAGE_MAX), CONSOLE_LOG_PAGE_MAX))
        earliest_seq = self._entries[0]["seq"] if self._entries else self._seq + 1
        pending = [entry for entry in self._entries if entry["seq"] > cursor]
        selected = pending[-page_size:] if cursor == 0 else pending[:page_size]
        return {
            "success": True,
            "instance_id": self.instance_id,
            "seq": self._seq,
            "earliest_seq": earliest_seq,
            "replay_lost": 0 < cursor < earliest_seq - 1,
            "cursor_ahead": cursor > self._seq,
            "has_more": cursor > 0 and len(pending) > page_size,
            "entries": [dict(entry) for entry in selected],
        }

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
        self._write_file(entry)
        for sink in self._sinks:
            sink(dict(entry))

    def _write_file(self, entry: Dict[str, Any]) -> None:
        if self._file is None:
            self._file = open(self._file_path, "a", encoding="utf-8", buffering=1)
        if self._file.tell() >= CONSOLE_LOG_FILE_MAX_BYTES:
            self._file.close()
            os.replace(
                self._file_path,
                self._file_path.with_name(CONSOLE_LOG_FILE_NAME + CONSOLE_LOG_FILE_BACKUP_SUFFIX),
            )
            self._file = open(self._file_path, "a", encoding="utf-8", buffering=1)
        self._file.write(json.dumps(entry, ensure_ascii=False) + "\n")


console_log_journal = ConsoleLogJournal()


__all__ = ["console_log_journal"]
