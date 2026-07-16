# -*- coding: utf-8 -*-
"""
Media-sync shared helpers + constants.

The pure, dependency-light layer of ``laravel_media_sync``: every module-level
CONSTANT (paths / timeouts / user-data sections / the THREAD_BUS event / the
terminal-punctuation + subtitle-track regexes / the ingest chunk size) and the
small PURE helpers reused across the subtitle, book and HTTP seams
(``source_key_for``, ``_read_text``, ``_nonempty``, ``_put_if``, ``_as_int``,
``_history_paths``, ``_seg_index_for``), plus the best-effort movie/TV poster
attach (``_attach_poster`` / ``_poster_enabled``) and Laravel base-URL
resolution (``resolve_laravel_base_url`` - delegates to
``laravel_endpoint_manager``).

``_seg_index_for`` attributes a cue to the segment whose [start,end] window
covers (or is nearest to) the cue's start - shared by ``derive_sentences``
(in subtitle_payload) and the v3 correspondence-slot builders (in
subtitle_slots).

Nothing here imports the sibling seam modules (subtitle_payload / book_payload /
media_sync_http / laravel_media_sync), so it sits at the bottom of the seam
dependency graph (cycle-free).
"""

import hashlib
import os
import re
from typing import Any, Dict, List, Optional

from pycore import ColorPrint, get_user_data_store

# Stored-first multi-endpoint manager (probe + persist + cache) - the single
# source of the Laravel base URL for every media-sync HTTP call.
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    resolve_laravel_base_url as _resolve_managed_endpoint,
)
# Movie/TV poster fetch backend (best-effort; only ``find_poster`` is needed
# here - the payload builders call ``parse_title_year`` themselves).
from pycore.pyutils.external_apis.movie_poster_client import find_poster


# --------------------------------------------------------------------------- #
# Constants                                                                    #
# --------------------------------------------------------------------------- #
INGEST_PATH = "/api/app_qy_v1/media/ingest"
INGEST_CLIP_PATH = "/api/app_qy_v1/media/ingest-clip"
SUBTITLES_PATH = "/api/app_qy_v1/media/subtitles"

# THREAD_BUS event the FE subscribes to for structured per-stage progress.
SYNC_EVENT = "video_extract_sync"

# Sentence-terminal punctuation (Latin + CJK) used to re-split merged cue text
# into real sentences. Includes the ellipsis and the (full-width) semicolons.
_TERMINAL_PUNCT = ".!?。！？…；"
_TERMINAL_RE = re.compile(r".*[" + re.escape(_TERMINAL_PUNCT) + r"]\s*$")

# HTTP timeouts (seconds). The JSON ingest of a feature-length movie carries
# thousands of sentence rows - Laravel commits it in one transaction (seconds),
# but a cold/busy single-worker backend can still queue requests, so the ingest
# timeout must cover worst-case waiting, not just processing. Clip uploads move
# real video bytes and keep their own longer budget.
_INGEST_TIMEOUT = 180
_CLIP_TIMEOUT = 300
# backend_status only PROBES Laravel (paginated subtitle list); keep it snappy so
# an unreachable backend degrades to reachable=False fast instead of hanging.
_STATUS_TIMEOUT = 5
# Pagination caps for the backend subtitle list probe (per_page x pages rows max).
_STATUS_PER_PAGE = 200
_STATUS_MAX_PAGES = 5

# The user-data store section the Video Extract page persists its state in
# (same section the /api/local/video-extract/history endpoint serves).
_USER_DATA_SECTION = "video_extract"

# Poster fetch toggle. Default ON; a user-data setting can disable it without a
# code change (media_sync.fetch_poster = false). Best-effort: a poster failure
# NEVER breaks ingest (see _attach_poster).
_POSTER_USER_DATA_SECTION = "media_sync"
_POSTER_SETTING_KEY = "fetch_poster"

# Sibling per-language track pattern: ``<stem>.<lang>.srt`` / ``<stem>.<lang>.vtt``.
# The lang token is matched against the canonical supported set, so only real
# language tracks are picked up (not e.g. ``movie.forced.srt``).
_TRACK_RE = re.compile(r"^(?P<stem>.+)\.(?P<lang>[A-Za-z]{2,3})\.(?:srt|vtt)$",
                       re.IGNORECASE)

# Chunk size for book/subtitle ingest: keeps each POST a SMALL, fast DB
# transaction so a huge book (e.g. a Bible ~39k sentences / ~15k words) or a
# feature-length subtitle set never exceeds the ingest timeout. The book row
# (full_content + sentence_seq + word_ids) / subtitle source row is sent only on
# the FIRST chunk; later chunks carry a minimal source {source_key}.
_BOOK_CHUNK = 1500


def _poster_enabled() -> bool:
    """True when poster fetch is enabled (default ON; user-data may disable)."""
    try:
        section = get_user_data_store().get_section(_POSTER_USER_DATA_SECTION) or {}
        if _POSTER_SETTING_KEY in section:
            return bool(section.get(_POSTER_SETTING_KEY))
    except Exception:
        pass
    return True


def _attach_poster(
    source: Dict[str, Any],
    title: str,
    year: Optional[int] = None,
    kind: str = "movie",
) -> None:
    """Best-effort poster attach at ingest — DISABLED in pycore.

    Poster search is delegated to apps/mcp-chrome (Google Images via task center).
    """
    return

    # --- Legacy TMDB/OMDB ingest fetch (disabled) ---
    # if not (title and title.strip()) or not _poster_enabled():
    #     return
    # try:
    #     poster = find_poster(title.strip(), year=year, kind=kind)
    #     if poster:
    #         source["poster"] = poster
    # except Exception as exc:
    #     ColorPrint.yellow(f"[MediaSync] poster fetch skipped for '{title}' ({exc})")


# --------------------------------------------------------------------------- #
# Laravel base-URL resolution (reuse the translation worker's discovery)       #
# --------------------------------------------------------------------------- #
def resolve_laravel_base_url(base_url: Optional[str] = None) -> str:
    """Return a usable Laravel base URL (no trailing slash).

    An explicit ``base_url`` still wins (caller override). Otherwise the
    LaravelEndpointManager resolves it STORED-FIRST: probe the persisted
    choice only, sweep all candidates in parallel if it fails, persist the
    winner, and cache the result in-process (invalidated by the
    ``laravel_api.*`` select/add/remove RPCs). The manager's candidate set is
    seeded from the same defaults this function used to derive inline
    (LARAVEL_WORKER_API_URL + the translation worker's local/LAN fallbacks).
    """
    if base_url and base_url.strip():
        return base_url.strip().rstrip("/")
    return _resolve_managed_endpoint()


# --------------------------------------------------------------------------- #
# Pure helpers                                                                 #
# --------------------------------------------------------------------------- #
def source_key_for(abs_path: str) -> str:
    """SHA1 hex of the normalized absolute source path (stable per-source id)."""
    norm = os.path.normcase(os.path.abspath(abs_path or ""))
    return hashlib.sha1(norm.encode("utf-8")).hexdigest()


def _read_text(path: str) -> str:
    """Read a UTF-8 text file (errors replaced); '' if missing/unreadable."""
    if not (path and os.path.isfile(path)):
        return ""
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except OSError:
        return ""


def _nonempty(value: Any) -> bool:
    """True for values worth sending (never send empty strings / None)."""
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ""
    return True


def _put_if(d: Dict[str, Any], key: str, value: Any) -> None:
    """Set ``d[key]=value`` only when value is non-empty (omit otherwise)."""
    if _nonempty(value):
        d[key] = value


def _as_int(value: Any) -> int:
    """Best-effort int coercion (None/'' / garbage -> 0) for count comparisons."""
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _history_paths() -> List[str]:
    """All Video Extract history entry paths from the unified user-data store.

    These are the same entries the /api/local/video-extract/history endpoint
    serves ({base_dir, entries:[{path,mode,added_at}], last_options}). Returns
    [] when the store/section is empty or unreadable (never raises).
    """
    try:
        section = get_user_data_store().get_section(_USER_DATA_SECTION) or {}
        return [str(e.get("path")) for e in (section.get("entries") or [])
                if e and e.get("path")]
    except Exception:
        return []


def _seg_index_for(start: float, end: float,
                   seg_lookup: List[Dict[str, Any]]) -> Optional[int]:
    """Index of the segment whose [start,end] window covers a cue.

    ``seg_lookup`` is a list of {"index","start","end"}. A cue belongs to the
    first segment whose [start,end] contains the cue's start; falls back to the
    segment whose window the cue's start lands nearest within. Returns None if
    there are no segments. Shared by ``derive_sentences`` (subtitle_payload) and
    the v3 correspondence-slot builders (subtitle_slots).
    """
    if not seg_lookup:
        return None
    for seg in seg_lookup:
        s = float(seg.get("start", 0.0))
        e = float(seg.get("end", 0.0))
        if s <= start <= e:
            return seg.get("index")
    # Cue start fell in a gap - pick the segment whose window it's closest to.
    best = None
    best_dist = None
    for seg in seg_lookup:
        s = float(seg.get("start", 0.0))
        e = float(seg.get("end", 0.0))
        if start < s:
            dist = s - start
        elif start > e:
            dist = start - e
        else:
            dist = 0.0
        if best_dist is None or dist < best_dist:
            best_dist = dist
            best = seg.get("index")
    return best
