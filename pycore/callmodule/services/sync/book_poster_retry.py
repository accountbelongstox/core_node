# -*- coding: utf-8 -*-
"""
Delayed book-poster retry — fetch via SerpApi (first image) and push to Laravel.

When a book is uploaded or submitted without a poster (SerpApi key missing,
transient network error, or the Laravel row not yet created), a background
daemon thread retries with increasing delays until a poster is stored or the
attempt budget is exhausted.

Push path: minimal /media/ingest payload carrying only source_key + poster
(fill-missing on the Laravel side — never clobbers an existing ready poster).
"""

import threading
import time
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.external_apis.movie_poster_client import find_poster, parse_title_year
from pycore.callmodule.services.sync._media_sync_helpers import (
    _poster_enabled,
    resolve_laravel_base_url,
    source_key_for,
)
from pycore.callmodule.services.sync.media_sync_http import _post_ingest

_RETRY_DELAYS_SEC: Tuple[int, ...] = (5, 15, 45, 120)
_lock = threading.Lock()
_scheduled: set = set()


def push_book_poster(
    source_key: str,
    poster: Dict[str, Any],
    source_type: str = "book",
    base_url: Optional[str] = None,
) -> Tuple[bool, str]:
    """POST a minimal ingest body that applies ``poster`` to an existing book row."""
    if not (source_key and poster and poster.get("image_base64")):
        return False, "missing source_key or poster bytes"
    st = source_type if source_type in ("book", "document") else "book"
    payload: Dict[str, Any] = {
        "source_type": st,
        "model_version": 3,
        "source": {
            "source_key": source_key,
            "poster": poster,
        },
        "chapters": [],
        "slots": [],
    }
    base = resolve_laravel_base_url(base_url)
    ok, detail = _post_ingest(base, payload)
    return ok, detail


def _retry_worker(
    path: str,
    title: str,
    year: Optional[int],
    source_type: str,
    delays: Tuple[int, ...],
) -> None:
    abs_path = path
    source_key = source_key_for(abs_path)
    name = abs_path.rsplit("\\", 1)[-1].rsplit("/", 1)[-1]
    for attempt, delay in enumerate(delays, 1):
        time.sleep(max(0, int(delay)))
        if not _poster_enabled():
            ColorPrint.blue(f"[BookPosterRetry] disabled; stop ({name})")
            return
        try:
            poster = find_poster(title, year=year, kind="book")
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(
                f"[BookPosterRetry] attempt {attempt}/{len(delays)} fetch failed "
                f"for '{title}' ({exc})")
            continue
        if not poster or not poster.get("image_base64"):
            ColorPrint.blue(
                f"[BookPosterRetry] attempt {attempt}/{len(delays)} no poster for '{title}'")
            continue
        ok, detail = push_book_poster(source_key, poster, source_type=source_type)
        if ok:
            ColorPrint.green(
                f"[BookPosterRetry] poster stored for '{title}' "
                f"({poster.get('provider')}, attempt {attempt})")
            return
        ColorPrint.yellow(
            f"[BookPosterRetry] attempt {attempt}/{len(delays)} ingest failed "
            f"for '{title}': {detail}")
    ColorPrint.yellow(f"[BookPosterRetry] gave up after {len(delays)} attempt(s) for '{title}'")


def schedule_book_poster_retry(
    path: str,
    title: Optional[str] = None,
    year: Optional[int] = None,
    source_type: str = "book",
    delays: Optional[List[int]] = None,
) -> None:
    """Schedule a background delayed retry — DISABLED; delegated to apps/mcp-chrome."""
    ColorPrint.blue("[BookPosterRetry] disabled — poster delegated to apps/mcp-chrome")
    return
    abs_path = path
    key = source_key_for(abs_path)
    with _lock:
        if key in _scheduled:
            return
        _scheduled.add(key)

    parsed_title, parsed_year = parse_title_year(title or abs_path)
    use_title = parsed_title or (title or "").strip()
    use_year = year if year is not None else parsed_year
    if not use_title:
        with _lock:
            _scheduled.discard(key)
        return

    delay_tuple = tuple(delays) if delays else _RETRY_DELAYS_SEC

    def _run():
        try:
            _retry_worker(abs_path, use_title, use_year, source_type, delay_tuple)
        finally:
            with _lock:
                _scheduled.discard(key)

    threading.Thread(
        target=_run,
        name=f"book-poster-retry-{key[:8]}",
        daemon=True,
    ).start()
    ColorPrint.blue(
        f"[BookPosterRetry] scheduled {len(delay_tuple)} attempt(s) for '{use_title}'")
