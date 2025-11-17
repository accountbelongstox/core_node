"""Utilities for normalizing standard IO stream behavior.

Some host environments (for example, certain IDE bridges or CLI harnesses)
replace ``sys.stdout``/``sys.stderr`` with binary ``BufferedWriter`` objects
that do not expose a ``buffer`` attribute. Libraries such as ``fastmcp`` expect
``sys.stdout.buffer`` to exist so they can create a ``TextIOWrapper`` around the
underlying binary stream. Without that attribute, the server crashes before it
even starts.  This module provides a thin compatibility shim that restores the
expected ``buffer`` handles without altering the actual stream semantics.
"""

from __future__ import annotations

import sys
from typing import Iterable, List


class _StreamBufferProxy:
    """Proxy object that forwards to the original stream and exposes ``buffer``."""

    __slots__ = ("_stream", "buffer", "encoding")

    def __init__(self, stream, *, encoding: str = "utf-8") -> None:
        self._stream = stream
        # ``fastmcp`` only needs this attribute to find the binary writer.
        self.buffer = stream
        # Preserve encoding when available so other code can read it.
        self.encoding = getattr(stream, "encoding", encoding)

    def __getattr__(self, attr):  # pragma: no cover - trivial forwarding
        return getattr(self._stream, attr)


def ensure_stdio_has_buffer_attributes(
    stream_names: Iterable[str] = ("stdin", "stdout", "stderr", "__stdin__", "__stdout__", "__stderr__"),
    *,
    encoding: str = "utf-8",
) -> List[str]:
    """Ensure the configured ``sys`` streams expose a ``buffer`` attribute.

    Returns the list of stream names that were patched so callers can log or
    diagnose when a host required the compatibility shim.
    """

    patched: List[str] = []
    for name in stream_names:
        stream = getattr(sys, name, None)
        if stream is None or hasattr(stream, "buffer"):
            continue
        proxy = _StreamBufferProxy(stream, encoding=encoding)
        setattr(sys, name, proxy)
        patched.append(name)
    return patched


__all__ = ["ensure_stdio_has_buffer_attributes"]
