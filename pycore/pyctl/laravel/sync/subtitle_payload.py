# -*- coding: utf-8 -*-
"""
Subtitle ingest payload builders for ``laravel_media_sync``.

Owns the /media/ingest body assembly for ONE subtitle source, for BOTH model
versions:
  * v1 ``build_payload``            - single-language ``sentences[]`` (cue + merged).
  * v3 ``build_payload_v3``         - multi-language correspondence ``slots[]``
    (single-file bilingual cue split OR multi-track time-overlap merge), plus
    the read-only ``build_subtitle_segment_view`` the FE segments endpoint serves.

Includes the SRT-text parsers (``_parse_srt_text`` / ``_parse_srt_text_lines``),
the cue->sentence derivation (``derive_sentences``) and the sibling-track
discovery (``discover_subtitle_tracks``). The v3 correspondence-slot builders
(``build_subtitle_slots_bilingual`` / ``build_subtitle_slots_multitrack``) and
their pure helpers were extracted into ``subtitle_slots`` (to keep this file
under the 800-line cap) and are imported + re-exported here, so any importer of
``subtitle_payload.build_subtitle_slots_*`` keeps working unchanged. The shared
cue->segment attribution helper ``_seg_index_for`` now lives in
``_media_sync_helpers`` (used by both ``derive_sentences`` and the slot builders).

NOTE: this is the 3rd in-tree copy of the SRT block grammar (the others live in
video_extract_processor.srt_utils and book_processor). Consolidating them onto
srt_utils._parse_srt_segments is deferred to a later reuse batch (TODO) - the
in-memory TEXT variant here stays distinct for now since srt_utils parses a PATH.
"""

import hashlib
import os
import re
from typing import Any, Callable, Dict, List, Optional, Tuple

# Reuse the processor's SRT time parser (no duplication). video_extract_processor
# imports nothing from this package, so this stays cycle-free.
from pycore.pyutils.media_processing.video_extract_processor import (
    _srt_time_to_sec,
)
# Canonical supported language set + the checked-set normalizer (mirror of
# laravel AppQyV1TableMaps::getSupportedLanguages()) + per-line language detection
# (for bilingual subtitle cue splitting + detected-language discovery).
from pycore.pyfoundations.text_parsing import (
    normalize_language_codes,
    guess_language,
)
from pycore.pyutils.common.strtools.normalization import collapse_whitespace

# Shared constants + pure helpers (cycle-free bottom seam). ``_seg_index_for``
# is shared with subtitle_slots (moved here so both derive_sentences and the slot
# builders use ONE attribution helper).
from pycore.pyctl.laravel.sync._media_sync_helpers import (
    _TERMINAL_RE,
    _TRACK_RE,
    source_key_for,
    _read_text,
    _put_if,
    _seg_index_for,
)
# v3 correspondence-slot builders (extracted to keep this file under the 800-line
# cap). Re-exported below so ``subtitle_payload.build_subtitle_slots_*`` importers
# keep working; ``build_payload_v3`` also calls them directly.
from pycore.pyctl.laravel.sync.subtitle_slots import (
    build_subtitle_slots_bilingual,
    build_subtitle_slots_multitrack,
)


# --------------------------------------------------------------------------- #
# 1. derive_sentences - BOTH grains (cue + merged sentence)                    #
# --------------------------------------------------------------------------- #
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

    cue_rows - one per srt cue:
        {grain:'cue', seq, text, language, sub_idx:cue.idx,
         seg_index:(segment covering this cue), start_sec, end_sec}

    sentence_rows - consecutive cues' text merged and re-split on terminal
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
        text = collapse_whitespace(text, strip=False)
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
# 3. build_payload - assemble the /media/ingest body for ONE video             #
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
# v3 correspondence-slot builders - moved to subtitle_slots (spec §12)           #
# --------------------------------------------------------------------------- #
# ``_slot_corr_id`` / ``split_cue_by_language`` / ``_overlap`` /
# ``_best_overlap_index`` / ``_empty_langs`` / ``_cue_slot`` /
# ``_sentence_slots_from_cue_slots`` / ``build_subtitle_slots_bilingual`` /
# ``build_subtitle_slots_multitrack`` now live in ``subtitle_slots`` (extracted
# to keep this file under the 800-line cap) and are imported + re-exported via
# the import block above. ``build_payload_v3`` below calls them directly.


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
      * MULTI-TRACK - when sibling per-language tracks are found (discovered from
        ``primary_srt_path`` or given as ``track_paths``), the primary track defines
        canonical slots and each other track is attached by largest time overlap.
      * SINGLE-FILE BILINGUAL - otherwise the single ``srt_text`` cue lines are
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
    Never raises - an unbuildable mapping yields empty lists.
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
