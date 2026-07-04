# -*- coding: utf-8 -*-
"""
Laravel Media Sync — push a scanned Video Extract source to laravel_main (:9000).

After a source is scanned/processed by VideoExtractProcessor, the UI (over WS,
route ``video_extract.sync_source``) triggers an IDEMPOTENT sync of that source's
subtitles + sentences + segment mapping + clips to Laravel's app_qy_v1 media
ingestion API. This module is the client.

Laravel ingestion CONTRACT (target it exactly):
  POST {base}/api/app_qy_v1/media/ingest        (json) — source + segments + sentences
  POST {base}/api/app_qy_v1/media/ingest-clip   (multipart) — source_key, name, file
Both endpoints are idempotent server-side (fill-missing, never clobber; clip skip
if already present). The client just submits COMPLETE content and never sends
empty strings for fields it doesn't have (those are omitted).

Architecture / layering (pycore rules):
  * App layer (callmodule.services.sync). Pure-ish business logic; no FastAPI dep.
  * Logging only via ColorPrint (``from pycore import ColorPrint``) — it already
    streams every line to the desktop UI over the WS. Structured progress is also
    fired as a ``video_extract_sync`` THREAD_BUS event per stage so the UI can
    render progress.
  * Networking uses the lazily-imported third-party ``requests`` via
    pycore.pyfoundations.third_party.get_third_package_requests (never a bare
    import) — same rule the translation worker follows.
  * Laravel base-URL resolution REUSES the translation worker's candidate-URL
    discovery (LARAVEL_WORKER_API_URL + local/LAN fallbacks) rather than
    hardcoding, so this client always agrees with the worker on the host.
"""

import hashlib
import json
import os
import re
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore import ColorPrint, THREAD_BUS, get_user_data_store
from pycore.pyfoundations.third_party import get_third_package_requests

# Stored-first multi-endpoint manager (probe + persist + cache) — the single
# source of the Laravel base URL for every media-sync HTTP call.
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    get_laravel_endpoint_manager,
)

# Reuse the processor's output-dir resolution + SRT helpers (no duplication),
# plus its ASCII-transcoding backends for book titles. video_extract_processor
# imports nothing from this package, so this stays cycle-free.
from pycore.callmodule.services.processors.video_extract_processor import (
    VideoExtractProcessor,
    _parse_srt_segments,
    _srt_time_to_sec,
    _load_backends,
    to_english_ascii,
)
# Book text extraction + chapter segmentation (book_processor only imports
# video_extract_processor — no cycle back into services.sync).
from pycore.callmodule.services.processors.book_processor import (
    extract_text,
    segment_chapters,
)
# v2 structured representation (stripped sentences + md5 content_ids +
# reconstruction sequence + per-language words) + the v3 chapter->slot builder.
# See pycore/docs/pipelines/MEDIA_SYNC_PIPELINE.md §8 and
# poly_apps/pycore_laravel_wordflow_ui/apps/wordnew/docs/BOOKS_FEATURE_SPECIFICATION.md §5/§7.
from pycore.callmodule.services.processors.book_structure import (
    build_book_structure,
    build_book_chapters_v3,
)
# Canonical supported language set + the checked-set normalizer (mirror of
# laravel AppQyV1TableMaps::getSupportedLanguages()) + per-line language detection
# (for bilingual subtitle cue splitting + detected-language discovery).
from pycore.pyfoundations.text_parsing import (
    normalize_language_codes,
    guess_language,
)
# Multi-language statistics engine (primary-language detection + meta for the v3
# source block).
from pycore.pyutils.text_stats import compute_text_stats
# Movie/TV poster fetch (TMDB -> OMDB, CJK title translated first). Best-effort:
# attaches an OPTIONAL source.poster object to book/subtitle ingest payloads.
# Canonical: poly_apps/laravel_main/docs/MOVIE_POSTER_PIPELINE.md.
from pycore.pyutils.external_apis.movie_poster_client import (
    find_poster,
    parse_title_year,
)


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
# thousands of sentence rows — Laravel commits it in one transaction (seconds),
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


def _poster_enabled() -> bool:
    """True when poster fetch is enabled (default ON; user-data may disable)."""
    try:
        section = get_user_data_store().get_section(_POSTER_USER_DATA_SECTION) or {}
        if _POSTER_SETTING_KEY in section:
            return bool(section.get(_POSTER_SETTING_KEY))
    except Exception:
        pass
    return True


def _attach_poster(source: Dict[str, Any], title: str, year: Optional[int] = None) -> None:
    """Best-effort: fetch a movie/TV poster for ``title`` and attach it to
    ``source['poster']`` (the §4 ingest payload addition). Omits the key entirely
    when no poster is found or fetch is disabled. NEVER raises — a poster failure
    must not break ingest.
    """
    if not (title and title.strip()) or not _poster_enabled():
        return
    try:
        poster = find_poster(title.strip(), year=year)
        if poster:
            source["poster"] = poster
    except Exception as exc:  # noqa: BLE001 - best-effort, never break ingest
        ColorPrint.yellow(f"[MediaSync] poster fetch skipped for '{title}' ({exc})")


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
    return get_laravel_endpoint_manager().resolve()


# --------------------------------------------------------------------------- #
# 1. derive_sentences — BOTH grains (cue + merged sentence)                    #
# --------------------------------------------------------------------------- #
def _seg_index_for(start: float, end: float, seg_lookup: List[Dict[str, Any]]) -> Optional[int]:
    """Index of the segment whose [start,end] window covers a cue.

    ``seg_lookup`` is a list of {"index","start","end"}. A cue belongs to the
    first segment whose [start,end] contains the cue's start; falls back to the
    segment whose window the cue's start lands nearest within. Returns None if
    there are no segments.
    """
    if not seg_lookup:
        return None
    for seg in seg_lookup:
        s = float(seg.get("start", 0.0))
        e = float(seg.get("end", 0.0))
        if s <= start <= e:
            return seg.get("index")
    # Cue start fell in a gap — pick the segment whose window it's closest to.
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


def derive_sentences(
    srt_subs: List[Dict[str, Any]],
    seg_lookup: List[Dict[str, Any]],
    language: str = "en",
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Derive BOTH grains from parsed SRT cues. Returns ``(cue_rows, sentence_rows)``.

    ``srt_subs``: parsed cues [{"idx","start","end","text"}, ...] (from
        _parse_srt_segments).
    ``seg_lookup``: [{"index","start","end"}, ...] (from mapping.segments) used to
        attribute each cue to a segment.

    cue_rows — one per srt cue:
        {grain:'cue', seq, text, language, sub_idx:cue.idx,
         seg_index:(segment covering this cue), start_sec, end_sec}

    sentence_rows — consecutive cues' text merged and re-split on terminal
    punctuation into real sentences:
        {grain:'sentence', seq, text, language, seg_index:(of the first cue),
         sub_idx:None, start_sec:(first cue start), end_sec:(last contributing cue end)}

    Deterministic & simple: accumulate cue text; flush a sentence whenever the
    accumulated text ends with terminal punctuation; flush any trailing remainder.
    """
    cue_rows: List[Dict[str, Any]] = []
    sentence_rows: List[Dict[str, Any]] = []

    # accumulator for the in-progress sentence
    acc_parts: List[str] = []
    acc_first_start: Optional[float] = None
    acc_first_seg: Optional[int] = None
    acc_last_end: float = 0.0
    sent_seq = 0

    def _flush_sentence():
        nonlocal sent_seq, acc_parts, acc_first_start, acc_first_seg, acc_last_end
        text = " ".join(p for p in acc_parts if p).strip()
        text = re.sub(r"\s+", " ", text)
        if text:
            sent_seq += 1
            sentence_rows.append({
                "grain": "sentence",
                "seq": sent_seq,
                "text": text,
                "language": language,
                "seg_index": acc_first_seg,
                "sub_idx": None,
                "start_sec": float(acc_first_start or 0.0),
                "end_sec": float(acc_last_end),
            })
        acc_parts = []
        acc_first_start = None
        acc_first_seg = None
        acc_last_end = 0.0

    for cue_seq, cue in enumerate(srt_subs, 1):
        text = (cue.get("text") or "").strip()
        start = float(cue.get("start", 0.0))
        end = float(cue.get("end", 0.0))
        seg_index = _seg_index_for(start, end, seg_lookup)

        cue_rows.append({
            "grain": "cue",
            "seq": cue_seq,
            "text": text,
            "language": language,
            "sub_idx": cue.get("idx"),
            "seg_index": seg_index,
            "start_sec": start,
            "end_sec": end,
        })

        if not text:
            continue
        if acc_first_start is None:
            acc_first_start = start
            acc_first_seg = seg_index
        acc_parts.append(text)
        acc_last_end = end
        # Flush a complete sentence when the accumulated text ends terminally.
        if _TERMINAL_RE.match(" ".join(acc_parts)):
            _flush_sentence()

    # trailing remainder that never hit terminal punctuation
    _flush_sentence()

    return cue_rows, sentence_rows


# --------------------------------------------------------------------------- #
# 2. source_key_for — stable id from the normalized absolute source path       #
# --------------------------------------------------------------------------- #
def source_key_for(abs_path: str) -> str:
    """SHA1 hex of the normalized absolute source path (stable per-source id)."""
    norm = os.path.normcase(os.path.abspath(abs_path or ""))
    return hashlib.sha1(norm.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------- #
# helpers                                                                      #
# --------------------------------------------------------------------------- #
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


# --------------------------------------------------------------------------- #
# 3. build_payload — assemble the /media/ingest body for ONE video             #
# --------------------------------------------------------------------------- #
def build_payload(
    mapping: Dict[str, Any],
    srt_text: str,
    src_abs: str,
    language: str = "en",
) -> Dict[str, Any]:
    """Build the /media/ingest request body from a video's mapping.json + .srt.

    ``mapping`` is the parsed mapping.json (top-level video/stem/filename/files/
    duration/segment_count/segments[]). ``srt_text`` is the full .srt content.
    ``src_abs`` is the absolute source video path (for the stable source_key).
    Empty fields are omitted (never sent as "") per the contract.
    """
    mapping = mapping or {}
    filename = mapping.get("filename") or {}
    files = mapping.get("files") or {}
    audio = files.get("audio") or {}
    raw_segments = mapping.get("segments") or []

    # seg_lookup for cue->segment attribution.
    seg_lookup = [
        {"index": s.get("index"), "start": float(s.get("start", 0.0)),
         "end": float(s.get("end", 0.0))}
        for s in raw_segments
    ]

    # Cues: prefer parsing the full .srt (authoritative); fall back to the
    # flattened mapping subtitles if no .srt text was provided.
    srt_subs: List[Dict[str, Any]] = []
    if srt_text:
        # _parse_srt_segments reads a file path; we have text, so parse inline by
        # mirroring its block grammar via a temp-free reuse: write nothing, just
        # walk lines here (kept minimal & deterministic).
        srt_subs = _parse_srt_text(srt_text)
    if not srt_subs:
        for seg in raw_segments:
            for s in (seg.get("subtitles") or []):
                srt_subs.append({
                    "idx": s.get("idx"),
                    "start": float(s.get("start", 0.0)),
                    "end": float(s.get("end", 0.0)),
                    "text": s.get("text") or "",
                })
        srt_subs.sort(key=lambda c: (float(c.get("start", 0.0)), c.get("idx") or 0))

    cue_rows, sentence_rows = derive_sentences(srt_subs, seg_lookup, language=language)

    # ---- source block -----------------------------------------------------
    source: Dict[str, Any] = {"source_key": source_key_for(src_abs)}
    # title: prefer the original filename, else the stem.
    _put_if(source, "title", filename.get("original") or mapping.get("stem"))
    _put_if(source, "language", language)
    _put_if(source, "duration_sec", mapping.get("duration"))
    _put_if(source, "rel_path", mapping.get("video"))
    # output_dir is the per-file OUTPUT dir (where files.* live). build_payload only
    # knows src_abs, so sync_source sets it afterward from the seg_dir's parent.
    _put_if(source, "original_name", filename.get("original"))
    _put_if(source, "ascii_name", filename.get("ascii") or mapping.get("stem"))
    _put_if(source, "full_content", srt_text)

    files_block: Dict[str, Any] = {}
    _put_if(files_block, "full_mp4", files.get("full_mp4"))
    _put_if(files_block, "tiny_mp4", files.get("tiny_mp4"))
    _put_if(files_block, "mp3", audio.get("mp3"))
    _put_if(files_block, "srt", files.get("srt"))
    if files_block:
        source["files"] = files_block

    _put_if(source, "subtitle_count", len(srt_subs) or None)
    _put_if(source, "segment_count", mapping.get("segment_count") or (len(raw_segments) or None))
    _put_if(source, "sentence_count", len(sentence_rows) or None)

    # Best-effort movie/TV poster (§4 ingest addition). Parse a clean title+year
    # from the HUMAN filename (original basename, else stem) — not the ascii stem.
    poster_basename = filename.get("original") or mapping.get("stem") or ""
    poster_title, poster_year = parse_title_year(poster_basename)
    _attach_poster(source, poster_title, poster_year)

    # ---- segments block ---------------------------------------------------
    segments: List[Dict[str, Any]] = []
    for seg in raw_segments:
        subs = seg.get("subtitles") or []
        sub_idxs = [s.get("idx") for s in subs if s.get("idx") is not None]
        row: Dict[str, Any] = {
            "seg_index": seg.get("index"),
            "start_sec": float(seg.get("start", 0.0)),
            "end_sec": float(seg.get("end", 0.0)),
            "subtitle_count": seg.get("subtitle_count", len(subs)),
        }
        _put_if(row, "full_mp4", seg.get("full_mp4"))
        _put_if(row, "mp4", seg.get("mp4"))
        _put_if(row, "mp3", seg.get("mp3"))
        if sub_idxs:
            row["sub_idx_start"] = min(sub_idxs)
            row["sub_idx_end"] = max(sub_idxs)
        segments.append(row)

    # ---- sentences block (BOTH grains) ------------------------------------
    sentences: List[Dict[str, Any]] = []
    for row in cue_rows:
        out: Dict[str, Any] = {
            "grain": "cue",
            "seq": row["seq"],
            "text": row["text"],
            "language": row["language"],
            "start_sec": row["start_sec"],
            "end_sec": row["end_sec"],
        }
        _put_if(out, "seg_index", row.get("seg_index"))
        _put_if(out, "sub_idx", row.get("sub_idx"))
        sentences.append(out)
    for row in sentence_rows:
        out = {
            "grain": "sentence",
            "seq": row["seq"],
            "text": row["text"],
            "language": row["language"],
            "start_sec": row["start_sec"],
            "end_sec": row["end_sec"],
            "sub_idx": None,
        }
        _put_if(out, "seg_index", row.get("seg_index"))
        sentences.append(out)

    return {
        "source_type": "subtitle",
        "source": source,
        "segments": segments,
        "sentences": sentences,
    }


def _parse_srt_text(srt_text: str) -> List[Dict[str, Any]]:
    """Parse raw .srt TEXT into [{"idx","start","end","text"}, ...].

    Mirrors the processor's _parse_srt_segments block grammar but works on an
    in-memory string (we hold the .srt content, not a path).
    """
    subs: List[Dict[str, Any]] = []
    cur_idx = 0
    cur_start = 0.0
    cur_end = 0.0
    text_lines: List[str] = []
    have_time = False

    def _flush():
        nonlocal cur_idx
        if have_time:
            subs.append({
                "idx": cur_idx if cur_idx > 0 else len(subs) + 1,
                "start": cur_start, "end": cur_end,
                "text": " ".join(text_lines).strip(),
            })

    for raw in srt_text.splitlines():
        line = raw.strip()
        if "-->" in line:
            halves = line.split("-->")
            if len(halves) == 2:
                cur_start = _srt_time_to_sec(halves[0])
                cur_end = _srt_time_to_sec(halves[1])
                have_time = True
                text_lines = []
        elif line == "":
            _flush()
            cur_idx, cur_start, cur_end, text_lines, have_time = 0, 0.0, 0.0, [], False
        elif line.isdigit() and not have_time and not text_lines:
            cur_idx = int(line)
        else:
            text_lines.append(line)
    _flush()
    return subs


def _parse_srt_text_lines(srt_text: str) -> List[Dict[str, Any]]:
    """Parse raw .srt TEXT into cues KEEPING the per-line list.

    Same block grammar as ``_parse_srt_text`` but each cue carries
    ``lines: [<raw line>, ...]`` (un-joined) so a bilingual cue can be split by
    detected language per line, plus a space-joined ``text`` for convenience.
    Returns [{"idx","start","end","lines","text"}, ...].
    """
    subs: List[Dict[str, Any]] = []
    cur_idx = 0
    cur_start = 0.0
    cur_end = 0.0
    text_lines: List[str] = []
    have_time = False

    def _flush():
        nonlocal cur_idx
        if have_time:
            lines = [ln for ln in text_lines if ln.strip()]
            subs.append({
                "idx": cur_idx if cur_idx > 0 else len(subs) + 1,
                "start": cur_start, "end": cur_end,
                "lines": lines,
                "text": " ".join(lines).strip(),
            })

    for raw in srt_text.splitlines():
        line = raw.strip()
        if "-->" in line:
            halves = line.split("-->")
            if len(halves) == 2:
                cur_start = _srt_time_to_sec(halves[0])
                cur_end = _srt_time_to_sec(halves[1])
                have_time = True
                text_lines = []
        elif line == "":
            _flush()
            cur_idx, cur_start, cur_end, text_lines, have_time = 0, 0.0, 0.0, [], False
        elif line.isdigit() and not have_time and not text_lines:
            cur_idx = int(line)
        else:
            text_lines.append(line)
    _flush()
    return subs


# --------------------------------------------------------------------------- #
# Subtitle v3 — multi-language correspondence slots (spec §12)                  #
# --------------------------------------------------------------------------- #
def _slot_corr_id(source_key: str, grain: str, seq: int) -> str:
    """Stable per-slot correspondence id = sha1(source_key|grain|seq) (§5/§12)."""
    return hashlib.sha1(f"{source_key}|{grain}|{seq}".encode("utf-8")).hexdigest()


def split_cue_by_language(lines: List[str], selected: List[str],
                          primary: str) -> Dict[str, str]:
    """Split a bilingual cue's lines by detected language → ``{lang: text}`` (§12.1a).

    Each line is language-detected via ``guess_language`` (returns a CODE). Lines
    of the same detected language are joined with a space. A line whose language is
    not in ``selected`` (or undetermined) is attributed to the ``primary`` language
    so no text is dropped. Returns a map containing only the languages that got
    text (callers fill the remaining selected langs with ``None``).
    """
    buckets: Dict[str, List[str]] = {}
    for raw in lines:
        line = re.sub(r"\s+", " ", raw or "").strip()
        if not line:
            continue
        lang = guess_language(line)
        if lang not in selected:
            lang = primary
        buckets.setdefault(lang, []).append(line)
    return {lang: " ".join(parts).strip() for lang, parts in buckets.items() if parts}


def _overlap(a_start: float, a_end: float, b_start: float, b_end: float) -> float:
    """Seconds of temporal overlap between [a_start,a_end] and [b_start,b_end]."""
    lo = max(a_start, b_start)
    hi = min(a_end, b_end)
    return max(0.0, hi - lo)


def _best_overlap_index(start: float, end: float,
                        windows: List[Tuple[float, float]]) -> Optional[int]:
    """Index of the window with the LARGEST overlap with [start,end], or None.

    None when no window overlaps at all (secondary cue maps to nothing). On ties
    the earliest window wins (deterministic).
    """
    best_idx: Optional[int] = None
    best_ov = 0.0
    for i, (ws, we) in enumerate(windows):
        ov = _overlap(start, end, ws, we)
        if ov > best_ov:
            best_ov = ov
            best_idx = i
    return best_idx


def _empty_langs(selected: List[str]) -> Dict[str, Optional[str]]:
    """A fresh per-language map with every selected language set to None (empty)."""
    return {lang: None for lang in selected}


def _cue_slot(source_key: str, seq: int, primary: str,
              langs: Dict[str, Optional[str]], start: float, end: float,
              seg_index: Optional[int], sub_idx: Optional[int]) -> Dict[str, Any]:
    """Build one cue-grain correspondence slot (timing carried)."""
    return {
        "chapter_index": 0,
        "grain": "cue",
        "seq": seq,
        "corr_id": _slot_corr_id(source_key, "cue", seq),
        "primary_language": primary,
        "langs": langs,
        "seg_index": seg_index,
        "sub_idx": sub_idx,
        "start_sec": float(start),
        "end_sec": float(end),
    }


def _sentence_slots_from_cue_slots(
    cue_slots: List[Dict[str, Any]],
    source_key: str,
    selected: List[str],
    primary: str,
) -> List[Dict[str, Any]]:
    """Merge cue-grain slots into sentence-grain slots (both forms share this).

    Cues are accumulated per language; a sentence flushes whenever the PRIMARY
    language's accumulated text ends with terminal punctuation (the same rule
    derive_sentences uses), carrying each language's merged text over the same cue
    window. ``seq`` is the sentence order (0-based). Timing spans first→last cue;
    ``seg_index`` is the first cue's. A language with no text in the window stays
    ``None``. The trailing remainder is flushed too.
    """
    sentence_slots: List[Dict[str, Any]] = []
    acc: Dict[str, List[str]] = {lang: [] for lang in selected}
    acc_start: Optional[float] = None
    acc_end: float = 0.0
    acc_seg: Optional[int] = None
    sent_seq = 0

    def _reset():
        nonlocal acc, acc_start, acc_end, acc_seg
        acc = {lang: [] for lang in selected}
        acc_start = None
        acc_end = 0.0
        acc_seg = None

    def _flush():
        nonlocal sent_seq, acc_start, acc_end, acc_seg
        langs: Dict[str, Optional[str]] = {}
        any_text = False
        for lang in selected:
            merged = re.sub(r"\s+", " ", " ".join(p for p in acc[lang] if p)).strip()
            if merged:
                any_text = True
            langs[lang] = merged or None
        if any_text:
            sentence_slots.append({
                "chapter_index": 0,
                "grain": "sentence",
                "seq": sent_seq,
                "corr_id": _slot_corr_id(source_key, "sentence", sent_seq),
                "primary_language": primary,
                "langs": langs,
                "seg_index": acc_seg,
                "sub_idx": None,
                "start_sec": float(acc_start or 0.0),
                "end_sec": float(acc_end),
            })
            sent_seq += 1
        _reset()

    for slot in cue_slots:
        slot_langs = slot.get("langs") or {}
        has_any = any((slot_langs.get(lang) or "").strip() for lang in selected)
        if has_any and acc_start is None:
            acc_start = float(slot.get("start_sec") or 0.0)
            acc_seg = slot.get("seg_index")
        for lang in selected:
            txt = (slot_langs.get(lang) or "").strip()
            if txt:
                acc[lang].append(txt)
        if has_any:
            acc_end = float(slot.get("end_sec") or 0.0)
        # Flush on the PRIMARY language hitting terminal punctuation.
        primary_acc = " ".join(p for p in acc[primary] if p)
        if primary_acc and _TERMINAL_RE.match(primary_acc):
            _flush()
    _flush()  # trailing remainder
    return sentence_slots


def build_subtitle_slots_bilingual(
    cues: List[Dict[str, Any]],
    source_key: str,
    selected: List[str],
    primary: str,
    seg_lookup: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Single-file bilingual form (§12.1a): split each cue's lines by language.

    ``cues`` are line-preserving cues (from ``_parse_srt_text_lines``). One cue ->
    ONE cue-grain slot whose ``langs`` map spans the detected languages; alignment
    is cue order -> ``seq``. Sentence-grain slots are merged from the cue slots.
    Returns ``{cue_slots, sentence_slots}``.
    """
    cue_slots: List[Dict[str, Any]] = []
    for seq, cue in enumerate(cues):
        start = float(cue.get("start", 0.0))
        end = float(cue.get("end", 0.0))
        lines = cue.get("lines") or ([cue.get("text")] if cue.get("text") else [])
        per_lang = split_cue_by_language(lines, selected, primary)
        langs = _empty_langs(selected)
        for lang, txt in per_lang.items():
            langs[lang] = txt or None
        if not any((langs.get(lang) or "").strip() for lang in selected):
            continue
        cue_slots.append(_cue_slot(
            source_key, seq, primary, langs, start, end,
            _seg_index_for(start, end, seg_lookup), cue.get("idx")))
    sentence_slots = _sentence_slots_from_cue_slots(cue_slots, source_key, selected, primary)
    return {"cue_slots": cue_slots, "sentence_slots": sentence_slots}


def build_subtitle_slots_multitrack(
    primary_cues: List[Dict[str, Any]],
    secondary_tracks: List[Tuple[str, List[Dict[str, Any]]]],
    source_key: str,
    selected: List[str],
    primary: str,
    seg_lookup: List[Dict[str, Any]],
    log: Optional[Callable[[str], None]] = None,
) -> Dict[str, Any]:
    """Multi-track form (§12.1b): primary track defines canonical slots.

    ``primary_cues`` are the PRIMARY language's cues (define grain/seq/time/corr_id).
    ``secondary_tracks`` is ``[(lang, cues), ...]`` for the OTHER languages; each
    secondary cue attaches to the primary slot with the LARGEST time overlap and
    fills ``langs[lang]``. A secondary cue overlapping NO primary slot is appended
    as an extra cue slot (best-effort) and the appended/dropped count is logged
    (no silent loss). The secondary track's own seq is NOT used. Returns
    ``{cue_slots, sentence_slots}``.
    """
    # Canonical cue slots from the primary track.
    cue_slots: List[Dict[str, Any]] = []
    windows: List[Tuple[float, float]] = []
    for seq, cue in enumerate(primary_cues):
        start = float(cue.get("start", 0.0))
        end = float(cue.get("end", 0.0))
        text = re.sub(r"\s+", " ", (cue.get("text") or "")).strip()
        langs = _empty_langs(selected)
        if text:
            langs[primary] = text
        cue_slots.append(_cue_slot(
            source_key, seq, primary, langs, start, end,
            _seg_index_for(start, end, seg_lookup), cue.get("idx")))
        windows.append((start, end))

    # Attach each secondary track by largest-overlap; append non-overlapping cues.
    appended = 0
    for lang, cues in secondary_tracks:
        if lang not in selected or lang == primary:
            continue
        for cue in cues:
            start = float(cue.get("start", 0.0))
            end = float(cue.get("end", 0.0))
            text = re.sub(r"\s+", " ", (cue.get("text") or "")).strip()
            if not text:
                continue
            idx = _best_overlap_index(start, end, windows)
            if idx is not None:
                existing = cue_slots[idx]["langs"].get(lang)
                # Multiple secondary cues hitting one primary slot accumulate.
                cue_slots[idx]["langs"][lang] = (
                    (existing + " " + text).strip() if existing else text)
            else:
                # Overlaps nothing -> append as an extra slot (best-effort).
                seq = len(cue_slots)
                langs = _empty_langs(selected)
                langs[lang] = text
                cue_slots.append(_cue_slot(
                    source_key, seq, primary, langs, start, end,
                    _seg_index_for(start, end, seg_lookup), cue.get("idx")))
                windows.append((start, end))
                appended += 1

    if appended and log:
        log(f"multi-track: appended {appended} non-overlapping secondary cue(s) "
            f"as extra slots (no silent loss)")

    sentence_slots = _sentence_slots_from_cue_slots(cue_slots, source_key, selected, primary)
    return {"cue_slots": cue_slots, "sentence_slots": sentence_slots}


# Sibling per-language track pattern: ``<stem>.<lang>.srt`` / ``<stem>.<lang>.vtt``.
# The lang token is matched against the canonical supported set, so only real
# language tracks are picked up (not e.g. ``movie.forced.srt``).
_TRACK_RE = re.compile(r"^(?P<stem>.+)\.(?P<lang>[A-Za-z]{2,3})\.(?:srt|vtt)$",
                       re.IGNORECASE)


def discover_subtitle_tracks(primary_srt_path: str) -> List[Tuple[str, str]]:
    """Discover sibling per-language subtitle tracks for the SAME video (§12.1b).

    Given the primary ``.srt`` path, scans its directory for siblings named
    ``<stem>.<lang>.srt`` sharing the SAME base stem, returning
    ``[(lang_code, abs_path), ...]`` for every track whose ``<lang>`` is a
    supported code. The primary file itself is excluded. The base stem is derived
    by stripping a trailing ``.<lang>`` from the primary file when present (so
    ``movie.en.srt`` and ``movie.zh.srt`` group under ``movie``). Returns [] when
    the dir is unreadable or no sibling tracks exist (never raises).
    """
    if not (primary_srt_path and os.path.isfile(primary_srt_path)):
        return []
    directory = os.path.dirname(primary_srt_path)
    base = os.path.basename(primary_srt_path)
    name = os.path.splitext(base)[0]  # drop .srt
    # If the primary file already has a .<lang> suffix, the group stem is name's stem.
    m = re.match(r"^(?P<stem>.+)\.(?P<lang>[A-Za-z]{2,3})$", name)
    group_stem = m.group("stem") if (m and m.group("lang").lower()
                                     in normalize_language_codes([m.group("lang")])) else name
    out: List[Tuple[str, str]] = []
    try:
        entries = sorted(os.listdir(directory))
    except OSError:
        return []
    for entry in entries:
        full = os.path.join(directory, entry)
        if not os.path.isfile(full) or os.path.normcase(full) == os.path.normcase(primary_srt_path):
            continue
        tm = _TRACK_RE.match(entry)
        if not tm:
            continue
        if tm.group("stem") != group_stem:
            continue
        lang = normalize_language_codes([tm.group("lang")])
        if not lang:
            continue
        out.append((lang[0], full))
    return out


def build_payload_v3(
    mapping: Dict[str, Any],
    srt_text: str,
    src_abs: str,
    language: str = "en",
    languages: Optional[List[str]] = None,
    primary_srt_path: Optional[str] = None,
    track_paths: Optional[List[str]] = None,
    log: Optional[Callable[[str], None]] = None,
) -> Dict[str, Any]:
    """Build the v3 multi-language /media/ingest body for ONE subtitle source (§12).

    Handles BOTH input forms:
      * MULTI-TRACK — when sibling per-language tracks are found (discovered from
        ``primary_srt_path`` or given as ``track_paths``), the primary track defines
        canonical slots and each other track is attached by largest time overlap.
      * SINGLE-FILE BILINGUAL — otherwise the single ``srt_text`` cue lines are
        split by detected language into one multi-language slot per cue.

    Emits ``model_version:3``, ``source_type:'subtitle'`` with:
      * ``source`` (language=primary CODE, selected_languages=union of the UI set +
        every detected language, timing/file/poster meta),
      * a single default chapter ``{chapter_index:0}``,
      * ``segments`` (clip mapping, unchanged),
      * ``slots`` (BOTH grains; multi ``langs`` + timing).
    All language values are CODES. Empty source fields are omitted via ``_put_if``.
    """
    mapping = mapping or {}
    filename = mapping.get("filename") or {}
    files = mapping.get("files") or {}
    audio = files.get("audio") or {}
    raw_segments = mapping.get("segments") or []
    seg_lookup = [
        {"index": s.get("index"), "start": float(s.get("start", 0.0)),
         "end": float(s.get("end", 0.0))}
        for s in raw_segments
    ]

    # Primary line-preserving cues (authoritative .srt, else flattened mapping).
    primary_cues = _parse_srt_text_lines(srt_text) if srt_text else []
    if not primary_cues:
        for seg in raw_segments:
            for s in (seg.get("subtitles") or []):
                txt = s.get("text") or ""
                primary_cues.append({
                    "idx": s.get("idx"),
                    "start": float(s.get("start", 0.0)),
                    "end": float(s.get("end", 0.0)),
                    "lines": [ln for ln in txt.splitlines() if ln.strip()] or ([txt] if txt else []),
                    "text": txt,
                })
        primary_cues.sort(key=lambda c: (float(c.get("start", 0.0)), c.get("idx") or 0))

    primary_text = "\n".join(c.get("text") or "" for c in primary_cues)

    # Resolve sibling per-language tracks (explicit list wins; else auto-discover).
    track_pairs: List[Tuple[str, str]] = []
    if track_paths:
        for tp in track_paths:
            tm = _TRACK_RE.match(os.path.basename(tp or ""))
            lang = normalize_language_codes([tm.group("lang")]) if tm else []
            if lang and tp and os.path.isfile(tp):
                track_pairs.append((lang[0], tp))
    elif primary_srt_path:
        track_pairs = discover_subtitle_tracks(primary_srt_path)

    # Detected primary language CODE (from the primary text); fall back to declared.
    detected_primary = guess_language(primary_text)
    primary = detected_primary if detected_primary not in ("und", "", None) else (language or "en")
    primary = (primary or "en").strip().lower() or "en"

    # Parse secondary tracks + collect every detected language for the union set.
    secondary_tracks: List[Tuple[str, List[Dict[str, Any]]]] = []
    detected_langs: List[str] = [primary]
    for lang, tp in track_pairs:
        if lang == primary:
            continue
        text = _read_text(tp)
        cues = _parse_srt_text(text) if text else []
        if not cues:
            continue
        secondary_tracks.append((lang, cues))
        detected_langs.append(lang)

    # For the single-file bilingual form, detect languages from the cue lines too.
    if not secondary_tracks:
        for cue in primary_cues:
            for raw in (cue.get("lines") or []):
                lg = guess_language(raw)
                if lg not in ("und", "", None) and lg not in detected_langs:
                    detected_langs.append(lg)

    # Selected = UI checked set UNION every detected language; primary forced first.
    selected = normalize_language_codes(list(languages or []) + detected_langs, primary)
    if not selected:
        selected = [primary]

    # Build the merged slots via the chosen form.
    if secondary_tracks:
        built = build_subtitle_slots_multitrack(
            primary_cues, secondary_tracks, source_key_for(src_abs),
            selected, primary, seg_lookup, log=log)
    else:
        built = build_subtitle_slots_bilingual(
            primary_cues, source_key_for(src_abs), selected, primary, seg_lookup)
    cue_slots = built["cue_slots"]
    sentence_slots = built["sentence_slots"]
    slots = cue_slots + sentence_slots

    # ---- source block -----------------------------------------------------
    source: Dict[str, Any] = {"source_key": source_key_for(src_abs)}
    _put_if(source, "title", filename.get("original") or mapping.get("stem"))
    _put_if(source, "language", primary)
    source["selected_languages"] = selected
    _put_if(source, "duration_sec", mapping.get("duration"))
    _put_if(source, "rel_path", mapping.get("video"))
    _put_if(source, "original_name", filename.get("original"))
    _put_if(source, "ascii_name", filename.get("ascii") or mapping.get("stem"))
    _put_if(source, "full_content", srt_text)

    files_block: Dict[str, Any] = {}
    _put_if(files_block, "full_mp4", files.get("full_mp4"))
    _put_if(files_block, "tiny_mp4", files.get("tiny_mp4"))
    _put_if(files_block, "mp3", audio.get("mp3"))
    _put_if(files_block, "srt", files.get("srt"))
    if files_block:
        source["files"] = files_block

    _put_if(source, "subtitle_count", len(primary_cues) or None)
    _put_if(source, "segment_count", mapping.get("segment_count") or (len(raw_segments) or None))
    _put_if(source, "sentence_count", len(sentence_slots) or None)

    poster_basename = filename.get("original") or mapping.get("stem") or ""
    poster_title, poster_year = parse_title_year(poster_basename)
    _attach_poster(source, poster_title, poster_year)

    # ---- segments block (clip mapping unchanged) --------------------------
    segments: List[Dict[str, Any]] = []
    for seg in raw_segments:
        subs = seg.get("subtitles") or []
        sub_idxs = [s.get("idx") for s in subs if s.get("idx") is not None]
        row: Dict[str, Any] = {
            "seg_index": seg.get("index"),
            "start_sec": float(seg.get("start", 0.0)),
            "end_sec": float(seg.get("end", 0.0)),
            "subtitle_count": seg.get("subtitle_count", len(subs)),
        }
        _put_if(row, "full_mp4", seg.get("full_mp4"))
        _put_if(row, "mp4", seg.get("mp4"))
        _put_if(row, "mp3", seg.get("mp3"))
        if sub_idxs:
            row["sub_idx_start"] = min(sub_idxs)
            row["sub_idx_end"] = max(sub_idxs)
        segments.append(row)

    return {
        "source_type": "subtitle",
        "model_version": 3,
        "source": source,
        "chapters": [{
            "chapter_index": 0,
            "corr_id": hashlib.sha1(
                f"{source_key_for(src_abs)}|chapter|0".encode("utf-8")).hexdigest(),
            "sentence_count": len(sentence_slots),
            "titles": {lang: ("Subtitles" if lang == primary else None) for lang in selected},
        }],
        "segments": segments,
        "slots": slots,
    }


def build_subtitle_segment_view(
    mapping: Dict[str, Any],
    srt_text: str,
    src_abs: str,
    languages: Optional[List[str]] = None,
    language: str = "en",
    primary_srt_path: Optional[str] = None,
    log: Optional[Callable[[str], None]] = None,
) -> Dict[str, Any]:
    """Build the v3 per-cue correspondence VIEW for the segments endpoint (§12).

    Reuses ``build_payload_v3`` (same bilingual-split / multi-track time-overlap
    alignment used for ingest) and returns the read-only view the FE
    ``getVideoExtractSegments(path, languages?)`` consumes:

        {
          "selected_languages": [<code>, ...],
          "primary_language": "<code>",
          "cue_slots":      [BookSlot, ...],   # grain='cue', one per canonical cue
          "sentence_slots": [BookSlot, ...],   # grain='sentence' (merged)
          "slots":          cue_slots + sentence_slots,
        }

    Each BookSlot = ``{corr_id, grain, seq, chapter_index, primary_language,
    langs:{code:text|null}, seg_index, sub_idx, start_sec, end_sec}``. ``langs``
    includes every selected language (primary + detected filled, the rest null).
    Never raises — an unbuildable mapping yields empty lists.
    """
    payload = build_payload_v3(
        mapping, srt_text, src_abs, language=language, languages=languages,
        primary_srt_path=primary_srt_path, log=log)
    slots = payload.get("slots") or []
    cue_slots = [s for s in slots if s.get("grain") == "cue"]
    sentence_slots = [s for s in slots if s.get("grain") == "sentence"]
    return {
        "selected_languages": payload["source"].get("selected_languages") or [],
        "primary_language": payload["source"].get("language") or language,
        "cue_slots": cue_slots,
        "sentence_slots": sentence_slots,
        "slots": slots,
    }


# --------------------------------------------------------------------------- #
# HTTP submit helpers                                                          #
# --------------------------------------------------------------------------- #
def _post_ingest(base_url: str, payload: Dict[str, Any]) -> Tuple[bool, str]:
    """POST the JSON ingest body. Returns (ok, detail)."""
    requests = get_third_package_requests()
    try:
        resp = requests.post(base_url + INGEST_PATH, json=payload, timeout=_INGEST_TIMEOUT)
        if resp.status_code in (200, 201):
            return True, f"HTTP {resp.status_code}"
        return False, f"HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        return False, str(e).splitlines()[0][:200]


def _post_clip(base_url: str, source_key: str, name: str, file_path: str) -> Tuple[bool, str]:
    """Upload one clip (multipart). Returns (ok, detail)."""
    requests = get_third_package_requests()
    try:
        with open(file_path, "rb") as fh:
            resp = requests.post(
                base_url + INGEST_CLIP_PATH,
                data={"source_key": source_key, "name": name},
                files={"file": (name, fh)},
                timeout=_CLIP_TIMEOUT,
            )
        if resp.status_code in (200, 201):
            return True, f"HTTP {resp.status_code}"
        return False, f"HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        return False, str(e).splitlines()[0][:200]


def _resolve_output_dir(source_path: str) -> Optional[str]:
    """Resolve the OUTPUT dir for ``source_path`` by reusing the processor.

    For a FILE, output defaults to its parent dir; for a FOLDER it's
    ``<root>/_compressed_result``. We let VideoExtractProcessor._resolve_io do the
    exact same resolution the run used (so seg dirs line up).
    """
    proc = VideoExtractProcessor()
    cfg = {"path": source_path}
    try:
        _root, output_dir, _videos, _mode = proc._resolve_io(cfg)
        return output_dir
    except ValueError:
        # If resolution fails but the path is a dir, fall back to it directly.
        if source_path and os.path.isdir(source_path):
            return os.path.abspath(source_path)
        return None


def _discover_mappings(output_dir: str) -> List[str]:
    """Every ``mapping.json`` under ``output_dir`` (sorted absolute paths).

    Normally each lives in a ``<stem>_segments`` dir, but a mapping.json found
    elsewhere is tolerated too (defensive). Shared by sync_source and
    backend_status so both always see the SAME set of local sources.
    """
    mapping_files: List[str] = []
    for dirpath, _dirnames, filenames in os.walk(output_dir):
        if "mapping.json" in filenames:
            mapping_files.append(os.path.join(dirpath, "mapping.json"))
    mapping_files.sort()
    return mapping_files


def _list_clip_names(seg_dir: str) -> List[str]:
    """Names of the ``seg_*`` clip files (.mp4/.mp3) in a segments dir (sorted)."""
    names: List[str] = []
    try:
        entries = sorted(os.listdir(seg_dir))
    except OSError:
        return names
    for entry in entries:
        full = os.path.join(seg_dir, entry)
        if not os.path.isfile(full):
            continue
        low = entry.lower()
        if low == "mapping.json":
            continue
        if low.endswith((".mp4", ".mp3")) and entry.startswith("seg_"):
            names.append(entry)
    return names


def _mapping_src_abs(mapping: Dict[str, Any], output_dir: str, seg_dir: str) -> str:
    """Reconstruct the ABSOLUTE source path for a mapping (stable source_key input).

    mapping.video is relative to the scan ROOT; the processor's output dir is
    either the root itself (file mode) or ``<root>/_compressed_result`` (folder
    mode). Shared by sync_source and backend_status so both derive the EXACT
    same source_key (via source_key_for) for a given mapping.json.
    """
    stem = mapping.get("stem") or os.path.basename(seg_dir).replace("_segments", "")
    rel_video = mapping.get("video") or (stem + ".mp4")
    scan_root = (os.path.dirname(output_dir)
                 if os.path.basename(output_dir) == "_compressed_result"
                 else output_dir)
    return os.path.normpath(os.path.join(scan_root, rel_video))


def _fetch_backend_subtitles(base_url: str) -> Tuple[bool, Dict[str, Dict[str, Any]], Optional[int]]:
    """Fetch Laravel's subtitle-source list keyed by source_key.

    Paginates GET {base}/api/app_qy_v1/media/subtitles (per_page=200) until
    last_page, capped at a few pages, with a SHORT timeout. Returns
    ``(reachable, rows_by_source_key, total)``; any failure degrades to
    ``(False, {}, None)`` — never raises.
    """
    requests = get_third_package_requests()
    rows: Dict[str, Dict[str, Any]] = {}
    total: Optional[int] = None
    try:
        page = 1
        while page <= _STATUS_MAX_PAGES:
            resp = requests.get(
                base_url + SUBTITLES_PATH,
                params={"per_page": _STATUS_PER_PAGE, "page": page},
                timeout=_STATUS_TIMEOUT,
            )
            if resp.status_code != 200:
                return False, {}, None
            body = resp.json() or {}
            if not body.get("success", True):
                return False, {}, None
            data = body.get("data") or {}
            for item in data.get("items") or []:
                key = item.get("source_key")
                if key:
                    rows[key] = item
            if data.get("total") is not None:
                total = _as_int(data.get("total"))
            if page >= _as_int(data.get("last_page") or 1):
                break
            page += 1
        return True, rows, (total if total is not None else len(rows))
    except Exception:
        return False, {}, None


# --------------------------------------------------------------------------- #
# 4. sync_source — walk a scanned source's outputs and ingest them             #
# --------------------------------------------------------------------------- #
def sync_source(
    source_path: str,
    language: str = "en",
    base_url: Optional[str] = None,
    progress: Optional[Callable[[str, int, int, str], None]] = None,
    languages: Optional[List[str]] = None,
    model_version: int = 3,
) -> Dict[str, Any]:
    """Idempotently sync a scanned source's outputs to laravel_main.

    Resolves the output dir for ``source_path`` (reusing the processor), walks it
    for every ``<stem>_segments/mapping.json`` (with the sibling ``<stem>.srt`` in
    the seg_dir's PARENT), and per video:
      1. POST /media/ingest (multi-language subtitle slots[BOTH grains] + segment
         mapping),
      2. upload each existing clip in the seg_dir via /media/ingest-clip.

    By default this emits the v3 multi-language subtitle model (§12): single-file
    bilingual cues are split by detected language, and sibling per-language tracks
    (``<stem>.<lang>.srt``) are time-overlap merged into one slot set. ``languages``
    is the UI-checked set (Lsel, >=1) which is UNIONed with every detected language
    and normalized to CODES (primary forced first). Pass ``model_version=1`` to fall
    back to the legacy single-language ``sentences[]`` payload for older callers.

    Idempotent / safe to re-run: relies on the server's fill-missing + clip-skip,
    and additionally skips re-uploading a clip already uploaded THIS run.

    ``progress(stage, done, total, detail)`` is called throughout; the same info
    is streamed via ColorPrint AND fired as a ``video_extract_sync`` THREAD_BUS
    event per stage so the UI can render structured progress.

    Returns {success, sources, sentences_cue, sentences_merged, segments,
             clips_uploaded, clips_skipped, errors:[]}.
    """
    base = resolve_laravel_base_url(base_url)
    errors: List[str] = []
    summary = {
        "success": False,
        "base_url": base,
        "sources": 0,
        "sentences_cue": 0,
        "sentences_merged": 0,
        "segments": 0,
        "clips_uploaded": 0,
        "clips_skipped": 0,
        "errors": errors,
    }
    uploaded_keys: set = set()  # (source_key, name) already uploaded this run

    def _progress(stage: str, done: int, total: int, detail: str = ""):
        line = f"[MediaSync] {stage} {done}/{total}" + (f" — {detail}" if detail else "")
        ColorPrint.blue(line)
        try:
            THREAD_BUS.trigger_event(SYNC_EVENT, {
                "stage": stage, "done": done, "total": total, "detail": detail,
                "base_url": base, "summary": {k: v for k, v in summary.items() if k != "errors"},
                "errors": list(errors),
            })
        except Exception:
            pass
        if progress:
            try:
                progress(stage, done, total, detail)
            except Exception:
                pass

    if not (source_path and source_path.strip()):
        errors.append("source_path is required")
        _progress("error", 0, 0, "source_path is required")
        return summary

    output_dir = _resolve_output_dir(source_path)
    if not (output_dir and os.path.isdir(output_dir)):
        errors.append(f"output dir not found for source: {source_path}")
        _progress("error", 0, 0, "output dir not found")
        return summary

    # Discover every mapping.json under the output dir (shared with backend_status).
    mapping_files = _discover_mappings(output_dir)

    total_sources = len(mapping_files)
    _progress("scan", 0, total_sources, f"found {total_sources} source(s) under {output_dir}")
    if total_sources == 0:
        # No segmented sources — nothing to sync but not an error.
        summary["success"] = True
        return summary

    for si, mapping_path in enumerate(mapping_files, 1):
        seg_dir = os.path.dirname(mapping_path)
        per_file_dir = os.path.dirname(seg_dir)  # where files.* (incl. .srt) live
        try:
            with open(mapping_path, "r", encoding="utf-8", errors="replace") as fh:
                mapping = json.load(fh)
        except (OSError, ValueError) as e:
            errors.append(f"{mapping_path}: could not read mapping.json ({e})")
            _progress("source", si, total_sources, f"read error: {e}")
            continue

        stem = mapping.get("stem") or os.path.basename(seg_dir).replace("_segments", "")
        srt_name = (mapping.get("files") or {}).get("srt") or (stem + ".srt")
        srt_path = os.path.join(per_file_dir, srt_name)
        srt_text = _read_text(srt_path)

        # Reconstruct the ABSOLUTE source path for a stable source_key (shared
        # derivation with backend_status — see _mapping_src_abs).
        src_abs = _mapping_src_abs(mapping, output_dir, seg_dir)

        if model_version == 1:
            # Legacy single-language v1 payload (sentences[]) for older callers.
            payload = build_payload(mapping, srt_text, src_abs, language=language)
            source_key = payload["source"]["source_key"]
            if per_file_dir:
                payload["source"]["output_dir"] = per_file_dir
            ok, detail = _post_ingest(base, payload)
            cue_n = sum(1 for s in payload["sentences"] if s.get("grain") == "cue")
            mer_n = sum(1 for s in payload["sentences"] if s.get("grain") == "sentence")
            seg_n = len(payload["segments"])
        else:
            # v3 multi-language (default). Splits a bilingual cue OR time-overlap
            # merges sibling per-language tracks (auto-discovered from srt_path).
            payload = build_payload_v3(
                mapping, srt_text, src_abs, language=language, languages=languages,
                primary_srt_path=srt_path,
                log=lambda m, _s=stem: _progress("align", si, total_sources, f"{_s}: {m}"))
            source_key = payload["source"]["source_key"]
            if per_file_dir:
                payload["source"]["output_dir"] = per_file_dir
            ok, errs = _ingest_subtitle_chunked_v3(base, payload, _progress)
            detail = errs[0] if errs else ""
            cue_n = sum(1 for s in payload["slots"] if s.get("grain") == "cue")
            mer_n = sum(1 for s in payload["slots"] if s.get("grain") == "sentence")
            seg_n = len(payload["segments"])

        if ok:
            summary["sources"] += 1
            summary["sentences_cue"] += cue_n
            summary["sentences_merged"] += mer_n
            summary["segments"] += seg_n
            sel = payload["source"].get("selected_languages") or [language]
            _progress("ingest", si, total_sources,
                      f"{stem}: {cue_n} cues / {mer_n} sentences / {seg_n} segs "
                      f"[{','.join(sel)}]")
            # Cross-feature content-ingest history (capped ring; best-effort).
            try:
                chapters_n = len(payload.get("chapters") or []) or 1
                slots_n = len(payload.get("slots") or []) or (cue_n + mer_n)
                get_user_data_store().record_content_history({
                    "type": "subtitle",
                    "source_key": source_key,
                    "path": src_abs,
                    "title": payload["source"].get("title") or stem,
                    "languages": sel,
                    "counts": {"chapters": chapters_n, "slots": slots_n,
                               "sentences": mer_n},
                    "status": "ok",
                    # ts omitted -> the store stamps the current time.
                })
            except Exception as e:
                ColorPrint.yellow(f"[MediaSync] content history record failed: {e}")
        else:
            errors.append(f"{stem}: ingest failed ({detail})")
            _progress("ingest", si, total_sources, f"{stem}: FAILED {detail}")
            # Still attempt clips? No — without a source row the server has nothing
            # to attach clips to. Skip this source's clips.
            continue

        # ---- upload clips in the seg_dir -----------------------------------
        clip_names = _list_clip_names(seg_dir)
        total_clips = len(clip_names)
        for ci, name in enumerate(clip_names, 1):
            key = (source_key, name)
            if key in uploaded_keys:
                summary["clips_skipped"] += 1
                continue
            full = os.path.join(seg_dir, name)
            if not (os.path.isfile(full) and os.path.getsize(full) > 0):
                summary["clips_skipped"] += 1
                continue
            ok, detail = _post_clip(base, source_key, name, full)
            if ok:
                uploaded_keys.add(key)
                summary["clips_uploaded"] += 1
            else:
                errors.append(f"{stem}/{name}: clip upload failed ({detail})")
            _progress("clips", ci, total_clips, f"{stem}: {name} ({'ok' if ok else 'fail'})")

    summary["success"] = len(errors) == 0 or summary["sources"] > 0
    _progress("done", total_sources, total_sources,
              f"{summary['sources']} source(s), {summary['clips_uploaded']} clip(s) uploaded"
              + (f", {len(errors)} error(s)" if errors else ""))
    return summary


# --------------------------------------------------------------------------- #
# 5. backend_status — local extract outputs vs what Laravel actually holds     #
# --------------------------------------------------------------------------- #
def backend_status(
    paths: Optional[List[str]] = None,
    base_url: Optional[str] = None,
) -> Dict[str, Any]:
    """ONE consistent view comparing local extract outputs vs Laravel's holdings.

    Uses THE SAME base-url resolution (resolve_laravel_base_url) AND the same
    mapping discovery / source_key derivation as sync_source, so the status the
    UI shows always refers to the host the sync actually targets.

    ``paths`` defaults to ALL Video Extract history entry paths from the
    user-data store. Per discovered mapping the row carries:
      * local   — {segments, cues, clips, srt} counted from disk,
      * backend — the matching Laravel subtitle row's
                  {segments, cues, sentences, synced_at}, or None,
      * state   — "synced" / "partial" (backend counts < local) / "missing"
                  (reachable but no backend row) / "unknown" (backend down).

    Mappings reachable via several overlapping history paths are deduped by
    their reconstructed absolute source path. Never raises: an unreachable /
    erroring backend degrades to ``reachable: False`` with local-only rows.

    Returns {success: True, base_url, reachable, total_backend_subtitles,
             sources: [...sorted by stem...]}.
    """
    base = resolve_laravel_base_url(base_url)
    targets = [str(p) for p in (paths or _history_paths()) if p and str(p).strip()]
    reachable, backend_rows, total_backend = _fetch_backend_subtitles(base)

    sources: List[Dict[str, Any]] = []
    seen_src: set = set()  # normcased src_abs already reported (dedupe overlaps)
    for source_path in targets:
        try:
            output_dir = _resolve_output_dir(source_path)
        except Exception:
            output_dir = None
        if not (output_dir and os.path.isdir(output_dir)):
            continue
        for mapping_path in _discover_mappings(output_dir):
            seg_dir = os.path.dirname(mapping_path)
            per_file_dir = os.path.dirname(seg_dir)  # where files.* (incl. .srt) live
            try:
                with open(mapping_path, "r", encoding="utf-8", errors="replace") as fh:
                    mapping = json.load(fh)
            except (OSError, ValueError):
                continue  # unreadable mapping — nothing trustworthy to report

            stem = mapping.get("stem") or os.path.basename(seg_dir).replace("_segments", "")
            src_abs = _mapping_src_abs(mapping, output_dir, seg_dir)
            dedupe_key = os.path.normcase(src_abs)
            if dedupe_key in seen_src:
                continue
            seen_src.add(dedupe_key)

            # ---- local truth (counted from disk) ----------------------------
            raw_segments = mapping.get("segments") or []
            srt_name = (mapping.get("files") or {}).get("srt") or (stem + ".srt")
            local = {
                "segments": len(raw_segments),
                "cues": sum(_as_int(s.get("subtitle_count")) for s in raw_segments),
                "clips": len(_list_clip_names(seg_dir)),
                "srt": os.path.isfile(os.path.join(per_file_dir, srt_name)),
            }

            # ---- backend row + state ----------------------------------------
            source_key = source_key_for(src_abs)
            row = backend_rows.get(source_key) if reachable else None
            backend = None
            if row is not None:
                backend = {
                    "segments": row.get("segment_count"),
                    "cues": row.get("subtitle_count"),
                    "sentences": row.get("sentence_count"),
                    "synced_at": row.get("synced_at"),
                }
            if not reachable:
                state = "unknown"
            elif backend is None:
                state = "missing"
            elif (_as_int(backend.get("segments")) < local["segments"]
                  or _as_int(backend.get("cues")) < local["cues"]):
                state = "partial"
            else:
                state = "synced"

            sources.append({
                "stem": stem,
                "source_path": source_path,
                "src_abs": src_abs,
                "source_key": source_key,
                "local": local,
                "backend": backend,
                "state": state,
            })

    sources.sort(key=lambda s: (s.get("stem") or "").lower())
    return {
        "success": True,
        "base_url": base,
        "reachable": reachable,
        "total_backend_subtitles": total_backend,
        "sources": sources,
    }


# --------------------------------------------------------------------------- #
# 6. sync_all — one-click idempotent submit of EVERY known source              #
# --------------------------------------------------------------------------- #
def sync_all(
    paths: Optional[List[str]] = None,
    language: Optional[str] = None,
    base_url: Optional[str] = None,
    progress: Optional[Callable[[str, int, int, str], None]] = None,
    languages: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Idempotently sync EVERY known source (history or given paths) to Laravel.

    ``paths`` defaults to ALL Video Extract history entry paths. Overlapping
    entries are deduped at the OUTPUT-DIR level (an entry whose resolved output
    dir equals — or sits inside — an already-kept one would re-discover the
    same mapping.json files), then the existing sync_source runs per remaining
    path SEQUENTIALLY against the same resolved base URL.

    sync_source already streams per-stage ``video_extract_sync`` events; this
    adds an OUTER event per path (stage="source", detail="(i/N) path") plus
    scan/done bookends. Re-running is safe (server-side fill-missing).

    Returns the aggregate summary shaped like sync_source's:
    {success, base_url, paths, sources, sentences_cue, sentences_merged,
     segments, clips_uploaded, clips_skipped, errors:[]}.
    """
    base = resolve_laravel_base_url(base_url)
    language = (language or "en").strip() or "en"
    errors: List[str] = []
    summary = {
        "success": False,
        "base_url": base,
        "paths": 0,
        "sources": 0,
        "sentences_cue": 0,
        "sentences_merged": 0,
        "segments": 0,
        "clips_uploaded": 0,
        "clips_skipped": 0,
        "errors": errors,
    }

    def _progress(stage: str, done: int, total: int, detail: str = ""):
        line = f"[MediaSyncAll] {stage} {done}/{total}" + (f" — {detail}" if detail else "")
        ColorPrint.blue(line)
        try:
            THREAD_BUS.trigger_event(SYNC_EVENT, {
                "stage": stage, "done": done, "total": total, "detail": detail,
                "base_url": base, "summary": {k: v for k, v in summary.items() if k != "errors"},
                "errors": list(errors),
            })
        except Exception:
            pass
        if progress:
            try:
                progress(stage, done, total, detail)
            except Exception:
                pass

    targets = [str(p) for p in (paths or _history_paths()) if p and str(p).strip()]

    # Dedupe at output-dir level: keep parents first so an entry whose output
    # dir is the same as — or nested under — an already-kept one is skipped
    # (e.g. D:\.tmp and D:\.tmp\Downloads must not double-sync a mapping).
    resolved: List[Tuple[str, Optional[str]]] = []
    for p in targets:
        try:
            out = _resolve_output_dir(p)
        except Exception:
            out = None
        resolved.append((p, os.path.normcase(out) if out else None))
    kept: List[str] = []
    covered: List[str] = []  # normcased output dirs already scheduled
    for p, out in sorted(resolved, key=lambda t: len(t[1] or "")):
        if out:
            if any(out == c or out.startswith(c + os.sep) for c in covered):
                continue
            covered.append(out)
        kept.append(p)

    total = len(kept)
    summary["paths"] = total
    skipped = len(targets) - total
    _progress("scan", 0, total,
              f"{total} path(s) to sync" + (f" ({skipped} overlapping skipped)" if skipped else ""))
    if total == 0:
        # Nothing known to sync — not an error.
        summary["success"] = True
        _progress("done", 0, 0, "nothing to sync")
        return summary

    for i, p in enumerate(kept, 1):
        _progress("source", i, total, f"({i}/{total}) {p}")
        try:
            res = sync_source(p, language=language, base_url=base, progress=progress,
                              languages=languages)
        except Exception as e:
            errors.append(f"{p}: sync failed ({e})")
            continue
        for key in ("sources", "sentences_cue", "sentences_merged", "segments",
                    "clips_uploaded", "clips_skipped"):
            summary[key] += _as_int(res.get(key))
        errors.extend(res.get("errors") or [])

    summary["success"] = len(errors) == 0 or summary["sources"] > 0
    _progress("done", total, total,
              f"{summary['sources']} source(s) across {total} path(s), "
              f"{summary['clips_uploaded']} clip(s) uploaded"
              + (f", {len(errors)} error(s)" if errors else ""))
    return summary


# --------------------------------------------------------------------------- #
# 7. BOOK path — text-only ingestion to the shared sentence library            #
# --------------------------------------------------------------------------- #
def _book_sentences(text: str, language: str) -> List[Dict[str, Any]]:
    """Sentence rows (BOTH grains) for a book — no timing, no segments.

    cue grain  — one row per non-empty line/paragraph.
    sentence grain — line text merged and re-split on terminal punctuation
        (same rule derive_sentences uses for cues). Mirrors derive_sentences but
        for plain text. Each row: {grain, seq, text, language}.
    """
    rows: List[Dict[str, Any]] = []
    if not (text and text.strip()):
        return rows
    language = (language or "en").strip() or "en"

    cue_seq = 0
    for raw_line in text.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue
        cue_seq += 1
        rows.append({"grain": "cue", "seq": cue_seq, "text": line, "language": language})

    acc_parts: List[str] = []
    sent_seq = 0

    def _flush():
        nonlocal sent_seq, acc_parts
        merged = re.sub(r"\s+", " ", " ".join(p for p in acc_parts if p).strip())
        if merged:
            sent_seq += 1
            rows.append({"grain": "sentence", "seq": sent_seq,
                         "text": merged, "language": language})
        acc_parts = []

    for raw_line in text.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue
        acc_parts.append(line)
        if _TERMINAL_RE.match(" ".join(acc_parts)):
            _flush()
    _flush()
    return rows


def build_book_payload(path: str, full_content: str, language: str = "en") -> Dict[str, Any]:
    """Build the /media/ingest body for ONE book (``source_type:'book'``).

    Books map ONLY to the shared sentence library: no segments, no clips. The
    payload's ``source`` carries a stable source_key (sha1 of the normalized abs
    path), title/original_name/ascii_name, a default non-empty ``language`` (so
    server-side dedup is consistent), the full book text as ``full_content`` for
    backup, and ``sentence_count``. Empty fields are omitted (``_put_if``).

    ``sentences`` contains BOTH grains (cue + merged sentence); books carry no
    timing or segment indices, so start_sec/end_sec/seg_index/sub_idx are absent.
    """
    language = (language or "en").strip() or "en"
    src_abs = os.path.abspath(path or "")
    original_name = os.path.basename(src_abs) if src_abs else ""
    stem = os.path.splitext(original_name)[0] if original_name else ""

    # ASCII title (reuse the video processor's transcoding backends).
    ascii_name = stem
    try:
        backends = _load_backends(False)
        ascii_name = to_english_ascii(stem, backends) or stem
    except Exception:
        ascii_name = stem

    rows = _book_sentences(full_content or "", language)

    source: Dict[str, Any] = {"source_key": source_key_for(src_abs)}
    _put_if(source, "title", stem)
    _put_if(source, "original_name", original_name)
    _put_if(source, "ascii_name", ascii_name)
    _put_if(source, "language", language)
    _put_if(source, "full_content", full_content)
    _put_if(source, "sentence_count", len(rows) or None)
    source["metadata"] = {}

    sentences: List[Dict[str, Any]] = []
    for row in rows:
        out: Dict[str, Any] = {
            "grain": row["grain"],
            "seq": row["seq"],
            "text": row["text"],
            "language": row["language"],
            "start_sec": None,
            "end_sec": None,
            "seg_index": None,
            "sub_idx": None,
        }
        sentences.append(out)

    return {
        "source_type": "book",
        "source": source,
        "sentences": sentences,
    }


def build_book_payload_v2(path: str, full_content: str, language: str = "en") -> Dict[str, Any]:
    """Build the v2 /media/ingest body for ONE book (see pycore/docs/pipelines/MEDIA_SYNC_PIPELINE.md §8).

    Sentences are punctuation-STRIPPED + md5-keyed (``content_id``); the book
    carries an ordered ``sentence_seq`` (sentence + punctuation-marker tokens,
    repeats allowed) plus per-language distinct ``words`` (md5-keyed) and a book
    ``content_id``. ``full_content`` keeps the exact original for byte-faithful
    backup. Empty fields are omitted via ``_put_if``.
    """
    language = (language or "en").strip() or "en"
    src_abs = os.path.abspath(path or "")
    original_name = os.path.basename(src_abs) if src_abs else ""
    stem = os.path.splitext(original_name)[0] if original_name else ""
    ascii_name = stem
    try:
        backends = _load_backends(False)
        ascii_name = to_english_ascii(stem, backends) or stem
    except Exception:
        ascii_name = stem

    structure = build_book_structure(full_content or "", language)
    stats = structure.get("stats") or {}

    source: Dict[str, Any] = {"source_key": source_key_for(src_abs)}
    _put_if(source, "title", stem)
    _put_if(source, "original_name", original_name)
    _put_if(source, "ascii_name", ascii_name)
    _put_if(source, "language", language)
    _put_if(source, "content_id", structure.get("content_id"))
    _put_if(source, "full_content", full_content)
    source["sentence_seq"] = structure.get("sentence_seq") or []
    source["word_ids"] = {
        lang: [w["content_id"] for w in rows]
        for lang, rows in (structure.get("words") or {}).items()
    }
    _put_if(source, "sentence_count", structure.get("sentence_count") or None)

    # Best-effort movie/TV poster (§4 ingest addition) using the HUMAN book title
    # (the stem, not the ascii name). Movie DBs miss for most real documents — the
    # poster key is then omitted and laravel leaves poster_status='pending'.
    poster_title, poster_year = parse_title_year(stem)
    _attach_poster(source, poster_title, poster_year)

    source["metadata"] = {
        "primary_language": stats.get("primary_language"),
        "languages": stats.get("languages"),
        "word_count": stats.get("word_count"),
        "unique_word_count": stats.get("unique_word_count"),
        "sentence_count": stats.get("sentence_count"),
        "unique_sentence_count": stats.get("unique_sentence_count"),
        "char_count": stats.get("char_count"),
    }

    # Distinct, punctuation-stripped sentence rows (audio left empty — pycore
    # fills it later; the server stores NULL for now).
    sentences: List[Dict[str, Any]] = []
    for row in structure.get("sentences") or []:
        sentences.append({
            "content_id": row["content_id"],
            "text": row["text"],
            "language": row.get("language") or language,
            "seq": row.get("seq", 0),
            "audio": None,
        })

    return {
        "source_type": "book",
        "model_version": 2,
        "source": source,
        "sentences": sentences,
        "words": structure.get("words") or {},
    }


def build_book_payload_v3(
    path: str,
    full_content: str,
    languages: List[str],
    language: str = "en",
    source_type: str = "book",
) -> Dict[str, Any]:
    """Build the v3 /media/ingest body for ONE book/document (BOOKS_FEATURE_SPECIFICATION.md §7).

    ``source_type`` is ``"book"`` (default) or ``"document"`` — the Add Document
    sub-tab reuses this exact chapter->slot model and only changes the emitted
    ``source_type`` so the rows land in the document bucket. Everything else
    (per-language slots, single-default chapter, content_id) is identical.

    The v3 model is chapter-aware and multi-language-correspondence-aware:
      * ``source`` carries the stable source_key, title/names, the detected primary
        ``language`` (L0), the UI-checked ``selected_languages`` (Lsel, >=1,
        includes L0), the full text backup, an optional poster and TextStats meta.
      * ``chapters`` = ``[{chapter_index, title, sentence_count}]`` (>=1 — a book
        with no detectable headings is a single default "Chapter 1").
      * ``slots`` = ordered correspondence slots, each with ``chapter_index``,
        ``grain`` (cue|sentence), global per-grain ``seq``, ``corr_id`` =
        sha1(source_key|grain|seq), ``primary_language`` and ``langs`` (per
        selected-language text; the primary filled, the others ``null`` = empty).

    The server computes each slot/lang content_id (md5 of lowercase(collapse(strip)))
    from the non-null text; pycore sends the normalized sentence text + nulls.
    ``languages`` is filtered to the canonical supported set and the detected
    primary is forced first (auto-checked, §5). Empty fields are omitted via
    ``_put_if``. NEVER raises on bad input (empty text -> a single empty chapter).
    """
    language = (language or "en").strip() or "en"
    # Only 'book' / 'document' are valid here; anything else falls back to 'book'.
    source_type = source_type if source_type in ("book", "document") else "book"
    src_abs = os.path.abspath(path or "")
    original_name = os.path.basename(src_abs) if src_abs else ""
    stem = os.path.splitext(original_name)[0] if original_name else ""
    ext = os.path.splitext(original_name)[1].lower() if original_name else ""
    ascii_name = stem
    try:
        backends = _load_backends(False)
        ascii_name = to_english_ascii(stem, backends) or stem
    except Exception:
        ascii_name = stem

    # Detect the primary language from the actual text (language=None so the
    # dominant Unicode script wins) and fall back to the caller's declared
    # ``language`` only when detection is undetermined.
    stats = compute_text_stats(full_content or "", language=None)
    primary_language = stats.get("primary_language") or language
    if primary_language in ("und", "", None):
        primary_language = language

    # Normalize the UI-checked set to the canonical supported codes, primary first.
    selected = normalize_language_codes(languages, primary_language)
    if not selected:
        selected = [primary_language]

    source_key = source_key_for(src_abs)

    # Chapter split. html/htm need the RAW html (tags) to find <h1>/<h2>; for those
    # we re-read the source bytes so the heading split works, then segment_chapters
    # produces tag-stripped chapter bodies. Other formats split over plain text.
    chapter_input = full_content or ""
    if ext in (".html", ".htm") and src_abs and os.path.isfile(src_abs):
        raw_html = _read_text(src_abs)
        if raw_html and raw_html.strip():
            chapter_input = raw_html
    chapters = segment_chapters(chapter_input, ext, primary_language, path=src_abs)

    tree = build_book_chapters_v3(chapters, source_key, selected, primary_language)

    source: Dict[str, Any] = {"source_key": source_key}
    _put_if(source, "title", stem)
    _put_if(source, "original_name", original_name)
    _put_if(source, "ascii_name", ascii_name)
    # Emit CODES only (§7): use the builder's normalized primary (== selected[0],
    # filtered to SUPPORTED_LANGUAGE_CODES), never a raw/declared name.
    _put_if(source, "language", tree.get("primary_language") or primary_language)
    source["selected_languages"] = tree.get("selected_languages") or selected
    _put_if(source, "full_content", full_content)
    _put_if(source, "sentence_count", tree.get("sentence_count") or None)

    # Best-effort movie/TV poster (using the HUMAN book title; usually omitted).
    poster_title, poster_year = parse_title_year(stem)
    _attach_poster(source, poster_title, poster_year)

    source["metadata"] = {
        "primary_language": stats.get("primary_language"),
        "languages": stats.get("languages"),
        "word_count": stats.get("word_count"),
        "unique_word_count": stats.get("unique_word_count"),
        "sentence_count": stats.get("sentence_count"),
        "unique_sentence_count": stats.get("unique_sentence_count"),
        "char_count": stats.get("char_count"),
        "chapter_count": len(tree.get("chapters") or []),
    }

    return {
        "source_type": source_type,
        "model_version": 3,
        "source": source,
        "chapters": tree.get("chapters") or [],
        "slots": tree.get("slots") or [],
    }


# Chunk size for book ingest: keeps each POST a SMALL, fast DB transaction so a
# huge book (e.g. a Bible ~39k sentences / ~15k words) never exceeds the ingest
# timeout. The book row (full_content + sentence_seq + word_ids) is sent only on
# the FIRST chunk; later chunks carry a minimal source {source_key}.
_BOOK_CHUNK = 1500


def _ingest_book_chunked(
    base_url: str,
    payload: Dict[str, Any],
    progress: Callable[[str, int, int, str], None],
) -> Tuple[bool, List[str]]:
    """POST a book payload to /media/ingest in small idempotent chunks.

    Each chunk is its own server-side transaction; the fill-missing contract makes
    partial/repeated chunks safe. Returns ``(ok, errors)``.
    """
    source = payload.get("source") or {}
    sentences = payload.get("sentences") or []
    words_by_lang = payload.get("words") or {}
    # Flatten words to (lang, item) for stable slicing across chunks.
    word_items = [(lang, w) for lang, ws in words_by_lang.items() for w in ws]

    n_sent = len(sentences)
    n_word = len(word_items)
    chunks = max(1, (n_sent + _BOOK_CHUNK - 1) // _BOOK_CHUNK,
                 (n_word + _BOOK_CHUNK - 1) // _BOOK_CHUNK)
    errors: List[str] = []

    for i in range(chunks):
        s_slice = sentences[i * _BOOK_CHUNK:(i + 1) * _BOOK_CHUNK]
        w_slice = word_items[i * _BOOK_CHUNK:(i + 1) * _BOOK_CHUNK]
        w_dict: Dict[str, List[Dict[str, Any]]] = {}
        for lang, w in w_slice:
            w_dict.setdefault(lang, []).append(w)
        # First chunk carries the full book row (meta + sentence_seq + word_ids +
        # full_content); later chunks only need source_key to attach rows.
        chunk_source = source if i == 0 else {"source_key": source.get("source_key")}
        body = {
            "source_type": "book",
            "model_version": 2,
            "source": chunk_source,
            "sentences": s_slice,
            "words": w_dict,
        }
        ok, detail = _post_ingest(base_url, body)
        if not ok:
            errors.append(f"chunk {i + 1}/{chunks}: {detail}")
        progress("ingest", i + 1, chunks,
                 f"chunk {i + 1}/{chunks} ({len(s_slice)} sentence(s), {len(w_slice)} word(s))")
    return (len(errors) == 0), errors


def _ingest_book_chunked_v3(
    base_url: str,
    payload: Dict[str, Any],
    progress: Callable[[str, int, int, str], None],
) -> Tuple[bool, List[str]]:
    """POST a v3 book payload to /media/ingest in small idempotent chunks (§7).

    The FIRST chunk carries the full ``source`` row + the complete ``chapters``
    list + the first slice of ``slots``; LATER chunks carry only a minimal
    ``source`` ``{source_key}`` + more ``slots`` (chapters are sent once). Each
    chunk is its own server-side transaction; the fill-missing contract makes
    partial/repeated chunks safe. Returns ``(ok, errors)``.
    """
    source = payload.get("source") or {}
    chapters = payload.get("chapters") or []
    slots = payload.get("slots") or []
    source_key = source.get("source_key")
    # Preserve the payload's source_type so 'document' rows are not posted as 'book'.
    source_type = payload.get("source_type") or "book"

    n_slot = len(slots)
    chunks = max(1, (n_slot + _BOOK_CHUNK - 1) // _BOOK_CHUNK)
    errors: List[str] = []

    for i in range(chunks):
        slot_slice = slots[i * _BOOK_CHUNK:(i + 1) * _BOOK_CHUNK]
        chunk_source = source if i == 0 else {"source_key": source_key}
        body = {
            "source_type": source_type,
            "model_version": 3,
            "source": chunk_source,
            # Chapters are sent once (first chunk only) — they are tiny + stable.
            "chapters": chapters if i == 0 else [],
            "slots": slot_slice,
        }
        ok, detail = _post_ingest(base_url, body)
        if not ok:
            errors.append(f"chunk {i + 1}/{chunks}: {detail}")
        progress("ingest", i + 1, chunks,
                 f"chunk {i + 1}/{chunks} ({len(slot_slice)} slot(s))")
    return (len(errors) == 0), errors


def _ingest_subtitle_chunked_v3(
    base_url: str,
    payload: Dict[str, Any],
    progress: Callable[[str, int, int, str], None],
) -> Tuple[bool, List[str]]:
    """POST a v3 SUBTITLE payload to /media/ingest in small idempotent chunks (§12).

    The FIRST chunk carries the full ``source`` row + the single default
    ``chapters`` + the ``segments`` (clip mapping) + the first slice of ``slots``;
    LATER chunks carry only a minimal ``source`` ``{source_key}`` + more ``slots``.
    Each chunk is its own server-side transaction (fill-missing). Returns
    ``(ok, errors)``.
    """
    source = payload.get("source") or {}
    chapters = payload.get("chapters") or []
    segments = payload.get("segments") or []
    slots = payload.get("slots") or []
    source_key = source.get("source_key")

    n_slot = len(slots)
    chunks = max(1, (n_slot + _BOOK_CHUNK - 1) // _BOOK_CHUNK)
    errors: List[str] = []

    for i in range(chunks):
        slot_slice = slots[i * _BOOK_CHUNK:(i + 1) * _BOOK_CHUNK]
        chunk_source = source if i == 0 else {"source_key": source_key}
        body = {
            "source_type": "subtitle",
            "model_version": 3,
            "source": chunk_source,
            # Chapters + segments are sent once (first chunk only).
            "chapters": chapters if i == 0 else [],
            "segments": segments if i == 0 else [],
            "slots": slot_slice,
        }
        ok, detail = _post_ingest(base_url, body)
        if not ok:
            errors.append(f"chunk {i + 1}/{chunks}: {detail}")
        progress("ingest", i + 1, chunks,
                 f"chunk {i + 1}/{chunks} ({len(slot_slice)} slot(s))")
    return (len(errors) == 0), errors


def sync_book_source(
    path: str,
    language: str = "en",
    base_url: Optional[str] = None,
    progress: Optional[Callable[[str, int, int, str], None]] = None,
    on_text: Optional[Callable[[str], None]] = None,
    text: Optional[str] = None,
    languages: Optional[List[str]] = None,
    model_version: int = 3,
    source_type: str = "book",
) -> Dict[str, Any]:
    """Idempotently ingest ONE book/document into the shared sentence library.

    ``source_type`` is ``"book"`` (default) or ``"document"`` (the Add Document
    sub-tab). It only changes the emitted top-level ``source_type`` so the rows
    land in the document bucket; the chapter->slot model is identical.

    Reads the book's full text (via book_processor.extract_text), builds the
    book ingest payload and POSTs it to ``/media/ingest`` in idempotent chunks.
    The server computes content_ids + fill-missing dedups, so re-runs are safe.

    By default this emits the v3 model (BOOKS_FEATURE_SPECIFICATION.md §7):
    chapter-aware + multi-language correspondence slots. ``languages`` is the
    UI-checked set (Lsel, >=1, includes the detected primary which is auto-added
    and forced first); when omitted it defaults to ``[language]``. Pass
    ``model_version=2`` to fall back to the legacy v2 (sentence/word) payload for
    older callers.

    Fires the SAME ``video_extract_sync`` THREAD_BUS progress event per stage
    (scan/extract/build/ingest/done/error) and streams via ColorPrint.
    Returns {success, source_key, sentences, words, chapters, slots, errors:[]}.

    ``text`` (optional): the already-extracted full text. When provided, the
    (potentially very slow) PDF/EPUB extraction is SKIPPED entirely — the Books
    submit passes the text analyze already extracted so a large book (e.g. a
    Bible) is never read off disk twice.

    ``on_text`` (optional): receives the full text once, so a caller can reuse it
    to precompute the local drill-down cache. It is NOT put on ``result`` to keep
    the WS progress payload small.
    """
    base = resolve_laravel_base_url(base_url)
    errors: List[str] = []
    result = {"success": False, "base_url": base, "source_key": None,
              "sentences": 0, "words": 0, "chapters": 0, "slots": 0,
              "model_version": model_version, "errors": errors}

    def _progress(stage: str, done: int, total: int, detail: str = ""):
        line = f"[BookSync] {stage} {done}/{total}" + (f" — {detail}" if detail else "")
        ColorPrint.blue(line)
        try:
            THREAD_BUS.trigger_event(SYNC_EVENT, {
                "stage": stage, "done": done, "total": total, "detail": detail,
                "base_url": base, "kind": "book",
                "summary": {k: v for k, v in result.items() if k != "errors"},
                "errors": list(errors),
            })
        except Exception:
            pass
        if progress:
            try:
                progress(stage, done, total, detail)
            except Exception:
                pass

    if not (path and path.strip()):
        errors.append("path is required")
        _progress("error", 0, 0, "path is required")
        return result

    abs_path = os.path.abspath(path)
    if not os.path.isfile(abs_path):
        errors.append(f"book not found: {abs_path}")
        _progress("error", 0, 0, "book not found")
        return result

    name = os.path.basename(abs_path)
    _progress("scan", 0, 1, name)
    # 1) Obtain the full text. Reuse caller-supplied text when present (analyze
    #    already extracted it) so a big PDF/EPUB is never read twice; otherwise
    #    extract now (its own stage, since extraction can be slow).
    if text and text.strip():
        full_content = text
        _progress("extract", 1, 1, f"reused extracted text ({len(full_content):,} chars): {name}")
    else:
        _progress("extract", 0, 1, f"extracting text: {name}")
        try:
            full_content = extract_text(abs_path)
        except Exception as e:
            errors.append(f"extract failed: {e}")
            _progress("error", 0, 1, f"extract failed: {e}")
            return result
        if not (full_content and full_content.strip()):
            errors.append("no extractable text")
            _progress("error", 0, 1, "no extractable text")
            return result

    # Hand the extracted text to an optional sink so the caller can precompute the
    # local drill-down cache from it (no second extraction of a big PDF/EPUB).
    if on_text is not None:
        try:
            on_text(full_content)
        except Exception:
            pass

    # 2) Build the ingest payload.
    _progress("build", 0, 1, f"structuring {len(full_content):,} chars: {name}")
    if model_version == 2:
        # Legacy v2 (sentence/word) path for older callers.
        payload = build_book_payload_v2(abs_path, full_content, language=language)
        result["source_key"] = payload["source"]["source_key"]
        result["sentences"] = len(payload["sentences"])
        result["words"] = sum(len(v) for v in (payload.get("words") or {}).values())
        ok, errs = _ingest_book_chunked(base, payload, _progress)
        if not ok:
            errors.extend(errs)
            _progress("error", 1, 1,
                      f"ingest had {len(errs)} failed chunk(s): {errs[0] if errs else ''}")
            return result
        result["success"] = True
        _progress("done", 1, 1,
                  f"{name}: {result['sentences']} sentence(s) / {result['words']} word(s) ingested")
        return result

    # v3 (default): chapter-aware + multi-language correspondence slots (§7). The
    # checked language set defaults to the declared single language; the builder
    # forces the detected primary first and fills only it (others left empty).
    sel = languages if languages else [language]
    payload = build_book_payload_v3(abs_path, full_content, sel, language=language,
                                    source_type=source_type)
    result["source_key"] = payload["source"]["source_key"]
    result["chapters"] = len(payload.get("chapters") or [])
    result["slots"] = len(payload.get("slots") or [])
    result["sentences"] = sum(1 for s in (payload.get("slots") or [])
                              if s.get("grain") == "sentence")
    result["selected_languages"] = payload["source"].get("selected_languages") or []

    # 3) Ingest in small idempotent chunks (per-chunk progress; big books OK).
    ok, errs = _ingest_book_chunked_v3(base, payload, _progress)
    if not ok:
        errors.extend(errs)
        _progress("error", 1, 1, f"ingest had {len(errs)} failed chunk(s): {errs[0] if errs else ''}")
        return result

    result["success"] = True
    _progress("done", 1, 1,
              f"{name}: {result['chapters']} chapter(s) / {result['slots']} slot(s) "
              f"({result['sentences']} sentence(s)) ingested")
    return result
