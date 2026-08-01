# -*- coding: utf-8 -*-
"""
Shared local MP3 validation for the TTS audio workers.

Moved verbatim from the retired pyctl/tts/word_queue_poller_service.py so both
Laravel-pulled audio workers (pyctl/tts/laravel_audio_worker.py) and any future
pyutils TTS consumer share ONE implementation. It mirrors the server-side
checks (AppQyV1DictionaryTTSCoordinator::reportWordResult): the Laravel report
endpoints 422-reject anything below 100 bytes or without an MP3 signature, so
bad output must be reported as a FAILURE, never uploaded.
"""

import os
from typing import Tuple

# Server-mirrored validation floor: the Laravel report endpoints 422-reject
# anything below 100 bytes or without an MP3 signature.
MIN_MP3_BYTES = 100


def validate_mp3(path: str) -> Tuple[bool, str]:
    """Local mirror of the server's MP3 validation. Returns ``(ok, error)``.

    Checks: file exists, >= 100 bytes, and starts with b'ID3' (ID3v2 tag) or an
    MPEG frame-sync (first byte 0xFF, second byte's top 3 bits set: 0xEx). Bad
    output must be reported as a FAILURE with this error, never uploaded.
    """
    if not (path and os.path.isfile(path)):
        return False, "no audio file produced"
    try:
        size = os.path.getsize(path)
        if size < MIN_MP3_BYTES:
            return False, f"audio too small ({size} bytes < {MIN_MP3_BYTES})"
        with open(path, "rb") as fh:
            head = fh.read(3)
    except OSError as e:
        return False, f"audio unreadable ({e})"
    if len(head) < 2:
        return False, "audio truncated (no header)"
    if head[:3] == b"ID3":
        return True, ""
    if head[0] == 0xFF and (head[1] & 0xE0) == 0xE0:
        return True, ""
    return False, f"not MP3 (header {head[:3].hex()})"
