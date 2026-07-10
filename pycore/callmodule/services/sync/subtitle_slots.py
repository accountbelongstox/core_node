# -*- coding: utf-8 -*-
"""
Subtitle v3 correspondence-slot builders (spec §12) for ``laravel_media_sync``.

Extracted from ``subtitle_payload`` so each module stays under the 800-line cap.
Owns the multi-language correspondence ``slots[]`` assembly for BOTH v3 input
forms:
  * SINGLE-FILE BILINGUAL - ``build_subtitle_slots_bilingual`` splits each cue's
    lines by detected language into one multi-language slot per cue.
  * MULTI-TRACK - ``build_subtitle_slots_multitrack`` defines canonical slots
    from the primary track and attaches each secondary track by largest
    time-overlap.

The pure slot helpers (``_slot_corr_id`` / ``split_cue_by_language`` /
``_overlap`` / ``_best_overlap_index`` / ``_empty_langs`` / ``_cue_slot`` /
``_sentence_slots_from_cue_slots``) live here. The shared cue->segment
attribution helper ``_seg_index_for`` lives in ``_media_sync_helpers`` (also
used by ``derive_sentences``) and is imported from there.

``subtitle_payload`` re-exports ``build_subtitle_slots_bilingual`` /
``build_subtitle_slots_multitrack`` so any existing importer of
``subtitle_payload.build_subtitle_slots_*`` keeps working unchanged.
"""

import hashlib
import re
from typing import Any, Callable, Dict, List, Optional, Tuple

# Per-line language detection (for bilingual subtitle cue splitting +
# detected-language discovery).
from pycore.pyfoundations.text_parsing import guess_language

# Shared constants + pure helpers (cycle-free bottom seam). ``_TERMINAL_RE``
# drives the same terminal-punctuation sentence-flush rule derive_sentences uses;
# ``_seg_index_for`` attributes a cue to its covering segment.
from pycore.callmodule.services.sync._media_sync_helpers import (
    _TERMINAL_RE,
    _seg_index_for,
)


# --------------------------------------------------------------------------- #
# Pure slot helpers                                                            #
# --------------------------------------------------------------------------- #
def _slot_corr_id(source_key: str, grain: str, seq: int) -> str:
    """Stable per-slot correspondence id = sha1(source_key|grain|seq) (§5/§12)."""
    return hashlib.sha1(f"{source_key}|{grain}|{seq}".encode("utf-8")).hexdigest()


def split_cue_by_language(lines: List[str], selected: List[str],
                          primary: str) -> Dict[str, str]:
    """Split a bilingual cue's lines by detected language -> ``{lang: text}`` (§12.1a).

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
    window. ``seq`` is the sentence order (0-based). Timing spans first->last cue;
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


# --------------------------------------------------------------------------- #
# v3 correspondence-slot builders (both input forms)                            #
# --------------------------------------------------------------------------- #
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
