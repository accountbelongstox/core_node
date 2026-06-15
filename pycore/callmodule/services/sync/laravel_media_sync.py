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
# Book text extraction (book_processor only imports video_extract_processor —
# no cycle back into services.sync).
from pycore.callmodule.services.processors.book_processor import extract_text
# v2 structured representation (stripped sentences + md5 content_ids +
# reconstruction sequence + per-language words). See pycore/docs/pipelines/MEDIA_SYNC_PIPELINE.md §8.
from pycore.callmodule.services.processors.book_structure import build_book_structure


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
) -> Dict[str, Any]:
    """Idempotently sync a scanned source's outputs to laravel_main.

    Resolves the output dir for ``source_path`` (reusing the processor), walks it
    for every ``<stem>_segments/mapping.json`` (with the sibling ``<stem>.srt`` in
    the seg_dir's PARENT), and per video:
      1. POST /media/ingest (subtitles + sentences[BOTH grains] + segment mapping),
      2. upload each existing clip in the seg_dir via /media/ingest-clip.

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

        payload = build_payload(mapping, srt_text, src_abs, language=language)
        source_key = payload["source"]["source_key"]
        # carry the per-file output dir to the contract (omit if empty)
        if per_file_dir:
            payload["source"]["output_dir"] = per_file_dir

        ok, detail = _post_ingest(base, payload)
        if ok:
            summary["sources"] += 1
            cue_n = sum(1 for s in payload["sentences"] if s.get("grain") == "cue")
            mer_n = sum(1 for s in payload["sentences"] if s.get("grain") == "sentence")
            summary["sentences_cue"] += cue_n
            summary["sentences_merged"] += mer_n
            summary["segments"] += len(payload["segments"])
            _progress("ingest", si, total_sources,
                      f"{stem}: {cue_n} cues / {mer_n} sentences / {len(payload['segments'])} segs")
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
            res = sync_source(p, language=language, base_url=base, progress=progress)
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


def sync_book_source(
    path: str,
    language: str = "en",
    base_url: Optional[str] = None,
    progress: Optional[Callable[[str, int, int, str], None]] = None,
    on_text: Optional[Callable[[str], None]] = None,
) -> Dict[str, Any]:
    """Idempotently ingest ONE book into the shared sentence library.

    Reads the book's full text (via book_processor.extract_text), builds the
    ``source_type:'book'`` payload (cue + merged sentence rows, full_content
    backup) and POSTs it to ``/media/ingest``. The server computes a stable
    sentence_id and fill-missing dedups, so re-runs are safe.

    Fires the SAME ``video_extract_sync`` THREAD_BUS progress event per stage
    (scan/ingest/done/error) as the subtitle sync, and streams via ColorPrint.
    Returns {success, source_key, sentences, errors:[]}.

    ``on_text`` (optional): receives the extracted full text once, so a caller
    (e.g. the Books submit) can reuse it to precompute the local drill-down cache
    WITHOUT re-extracting the file. It is NOT put on ``result`` to keep the WS
    progress payload small.
    """
    base = resolve_laravel_base_url(base_url)
    errors: List[str] = []
    result = {"success": False, "base_url": base, "source_key": None,
              "sentences": 0, "words": 0, "errors": errors}

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
    # 1) Extract text (PDFs/EPUBs can be slow — its own stage so the UI shows it).
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

    # 2) Build the v2 structure (strip + tokenize + content_ids + sequence).
    _progress("build", 0, 1, f"structuring {len(full_content):,} chars: {name}")
    payload = build_book_payload_v2(abs_path, full_content, language=language)
    result["source_key"] = payload["source"]["source_key"]
    result["sentences"] = len(payload["sentences"])
    result["words"] = sum(len(v) for v in (payload.get("words") or {}).values())

    # 3) Ingest in small idempotent chunks (per-chunk progress; big books OK).
    ok, errs = _ingest_book_chunked(base, payload, _progress)
    if not ok:
        errors.extend(errs)
        _progress("error", 1, 1, f"ingest had {len(errs)} failed chunk(s): {errs[0] if errs else ''}")
        return result

    result["success"] = True
    _progress("done", 1, 1,
              f"{name}: {result['sentences']} sentence(s) / {result['words']} word(s) ingested")
    return result
