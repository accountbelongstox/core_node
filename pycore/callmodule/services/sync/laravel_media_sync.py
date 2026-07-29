# -*- coding: utf-8 -*-
"""
Laravel Media Sync - push a scanned Video Extract source to laravel_main (:9000).

After a source is scanned/processed by VideoExtractProcessor, the UI (over WS,
route ``video_extract.sync_source``) triggers an IDEMPOTENT sync of that source's
subtitles + sentences + segment mapping + clips to Laravel's app_qy_v1 media
ingestion API. This module is the client.

Laravel ingestion CONTRACT (target it exactly):
  POST {base}/api/app_qy_v1/media/ingest        (json) - source + segments + sentences
  POST {base}/api/app_qy_v1/media/ingest-clip   (multipart) - source_key, name, file
Both endpoints are idempotent server-side (fill-missing, never clobber; clip skip
if already present). The client just submits COMPLETE content and never sends
empty strings for fields it doesn't have (those are omitted).

Module shape (split in-place from the original 2228-line monolith):
  * ``_media_sync_helpers``  - constants + pure helpers + poster + base-URL resolve.
  * ``subtitle_payload``     - subtitle ingest payload builders (v1/v3) + slot logic.
  * ``book_payload``         - book/document ingest payload builders (v1/v2/v3).
  * ``media_sync_http``      - HTTP submit + local-output discovery helpers.
  * THIS file (orchestrator + facade) - the chunked-ingest helpers + the public
    sync orchestrators (``sync_source`` / ``backend_status`` / ``sync_all`` /
    ``sync_book_source``) + a FACADE re-export of every name the 4 importers pin
    (config.py, video_extract_controller.py, books_controller.py, __init__.py),
    so ``from ...laravel_media_sync import X`` keeps working unchanged.

Architecture / layering (pycore rules):
  * App layer (callmodule.services.sync). Pure-ish business logic; no FastAPI dep.
  * Logging only via ColorPrint (``from pycore import ColorPrint``) - it already
    streams every line to the desktop UI over the WS. Structured progress is also
    fired as a ``video_extract_sync`` THREAD_BUS event per stage so the UI can
    render progress.
  * Networking is delegated to ``media_sync_http`` (lazily-imported ``requests``
    via pycore.pyfoundations.third_party.get_third_package_requests).
  * Laravel base-URL resolution REUSES the translation worker's candidate-URL
    discovery (LARAVEL_WORKER_API_URL + local/LAN fallbacks) rather than
    hardcoding, so this client always agrees with the worker on the host.

DEFERRED to a later reuse batch (not this split): dedup of the 3 chunked-ingest
helpers below (``_ingest_book_chunked`` / ``_ingest_book_chunked_v3`` /
``_ingest_subtitle_chunked_v3``) onto a single chunked POST helper.
"""

import json
import os
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.database.repositories.user_data_store import get_user_data_store

# Book text EXTRACTION (slow PDF/EPUB read) - used by sync_book_source only.
# book_processor imports nothing from services.sync, so this stays cycle-free.
from pycore.callmodule.services.processors.book_processor import extract_text

# Shared constants + pure helpers (cycle-free bottom seam).
from pycore.callmodule.services.sync._media_sync_helpers import (
    SYNC_EVENT,
    _BOOK_CHUNK,
    _as_int,
    _history_paths,
    _read_text,
    resolve_laravel_base_url,
    source_key_for,
)
# Subtitle ingest payload builders. ``build_payload`` / ``build_payload_v3`` are
# used by sync_source; ``derive_sentences`` / ``build_subtitle_segment_view`` are
# re-exported below (facade API) - kept import-bound so external importers see them.
from pycore.callmodule.services.sync.subtitle_payload import (
    build_payload,
    build_payload_v3,
    build_subtitle_segment_view,  # noqa: F401  (facade re-export)
    derive_sentences,  # noqa: F401  (facade re-export)
)
# Book ingest payload builders (used by sync_book_source).
from pycore.callmodule.services.sync.book_payload import (
    build_book_payload_v2,
    build_book_payload_v3,
)
# HTTP submit + local-output discovery helpers (used by the orchestrators below).
from pycore.callmodule.services.sync.media_sync_http import (
    _discover_mappings,
    _fetch_backend_subtitles,
    _list_clip_names,
    _mapping_src_abs,
    _post_clip,
    _post_ingest,
    _resolve_output_dir,
)

# ``_read_text`` is also part of the facade API (video_extract_controller imports
# it as ``_read_srt_text``); it is already imported above and used by sync_source,
# so it is bound in this module's namespace without an extra re-export line.


# --------------------------------------------------------------------------- #
# Chunked ingest helpers (DEFERRED dedup - 3 near-identical loops)             #
# --------------------------------------------------------------------------- #
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
            # Chapters are sent once (first chunk only) - they are tiny + stable.
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


# --------------------------------------------------------------------------- #
# 4. sync_source - walk a scanned source's outputs and ingest them             #
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
        line = f"[MediaSync] {stage} {done}/{total}" + (f" - {detail}" if detail else "")
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
        # No segmented sources - nothing to sync but not an error.
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
        # derivation with backend_status - see _mapping_src_abs).
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
            # Still attempt clips? No - without a source row the server has nothing
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
# 5. backend_status - local extract outputs vs what Laravel actually holds     #
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
      * local   - {segments, cues, clips, srt} counted from disk,
      * backend - the matching Laravel subtitle row's
                  {segments, cues, sentences, synced_at}, or None,
      * state   - "synced" / "partial" (backend counts < local) / "missing"
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
                continue  # unreadable mapping - nothing trustworthy to report

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
# 6. sync_all - one-click idempotent submit of EVERY known source              #
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
    dir equals - or sits inside - an already-kept one would re-discover the
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
        line = f"[MediaSyncAll] {stage} {done}/{total}" + (f" - {detail}" if detail else "")
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
    # dir is the same as - or nested under - an already-kept one is skipped
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
        # Nothing known to sync - not an error.
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
# 7. sync_book_source - ingest ONE book/document to the shared sentence library #
# --------------------------------------------------------------------------- #
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
    (potentially very slow) PDF/EPUB extraction is SKIPPED entirely - the Books
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
        line = f"[BookSync] {stage} {done}/{total}" + (f" - {detail}" if detail else "")
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
