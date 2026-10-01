# -*- coding: utf-8 -*-
"""Text EOL normalization: CRLF -> LF for text content, binary untouched (git eol=lf rule)."""

import hashlib

_BINARY_SNIFF = 8192


def is_binary(sample: bytes) -> bool:
    """A NUL byte in the head means binary."""
    return b"\x00" in sample[:_BINARY_SNIFF]


def normalize_eol(raw: bytes) -> bytes:
    """CRLF -> LF for text content; binary content is returned unchanged."""
    if not raw or is_binary(raw):
        return raw
    return raw.replace(b"\r\n", b"\n")


def normalized_md5(raw: bytes) -> str:
    """md5 of the canonical (LF) form."""
    return hashlib.md5(normalize_eol(raw)).hexdigest()


__all__ = ["is_binary", "normalize_eol", "normalized_md5"]
