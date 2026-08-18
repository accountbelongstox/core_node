# -*- coding: utf-8 -*-
"""
Cross-platform text normalization for Code Sync (stdlib only).

Code Sync transfers files BYTE-FOR-BYTE, so without this a Windows dev pushing
CRLF line endings would:
  * break shell scripts on a Linux client ("/bin/bash^M: bad interpreter"), and
  * leave the client's working tree differing from git's LF-normalized blobs,
    which makes a later `git pull` conflict — the codesync crash-loop root cause.

So we canonicalize TEXT files to LF on the wire and on disk (exactly what git's
`* text=auto eol=lf` does); BINARY files (images, archives, ...) are passed
through untouched. The change-detector (watcher hash), the sender, and the
receiver compare all use the SAME canonical form, so the skip/idempotency logic
still holds and there is NO re-sync loop (a local CRLF file hashes equal to the
canonical LF form, so it is treated as up-to-date rather than rewritten forever).

Stdlib only; imports nothing internal (safe to import from any codesync module).
"""

import hashlib

# Inspect only the head: a NUL byte in the first chunk means binary (git's rule).
_BINARY_SNIFF = 8192


def is_binary(sample: bytes) -> bool:
    """Heuristic binary detection: a NUL byte in the head => binary."""
    return b"\x00" in sample[:_BINARY_SNIFF]


def normalize_eol(raw: bytes) -> bytes:
    """CRLF -> LF for text content; binary content is returned unchanged.

    Conservative (CRLF only, like git's autocrlf) so a lone CR inside binary-ish
    text is never touched; binary is gated out entirely by is_binary()."""
    if not raw or is_binary(raw):
        return raw
    return raw.replace(b"\r\n", b"\n")


def normalized_md5(raw: bytes) -> str:
    """md5 of the canonical (LF) form — the hash used everywhere for compare."""
    return hashlib.md5(normalize_eol(raw)).hexdigest()
