# -*- coding: utf-8 -*-
"""CoreBook per-language text/audio completeness (drives UI bars + assist gaps)."""

from typing import Any, Dict, List


def compute_completeness(bundle: Dict[str, Any]) -> Dict[str, Any]:
    """Return ``{languages: {code: {text, audio}}, missing: [...]}`` for one bundle."""
    selected: List[str] = list(bundle.get("source", {}).get("selected_languages") or [])
    if not selected:
        selected = [bundle.get("source", {}).get("language") or "en"]
    langs_stats: Dict[str, Dict[str, int]] = {
        code: {"text": 0, "audio": 0} for code in selected}
    missing: List[Dict[str, Any]] = []
    slots = bundle.get("slots") or []
    sentence_slots = [s for s in slots if (s.get("grain") or "sentence") == "sentence"]
    total = max(1, len(sentence_slots))

    for code in selected:
        text_n = 0
        audio_n = 0
        for slot in sentence_slots:
            langs = slot.get("langs") or {}
            txt = langs.get(code)
            if txt and str(txt).strip():
                text_n += 1
            audio_map = slot.get("audio") or {}
            ap = audio_map.get(code)
            if ap and str(ap).strip():
                audio_n += 1
        langs_stats[code] = {"text": text_n, "audio": audio_n}
        gap_text = total - text_n
        gap_audio = text_n - audio_n
        if gap_text > 0:
            missing.append({"kind": "language", "language": code, "count": gap_text})
        elif gap_audio > 0:
            missing.append({"kind": "audio", "language": code, "count": gap_audio})

    return {"languages": langs_stats, "missing": missing}


def bundle_summary(bundle: Dict[str, Any]) -> Dict[str, Any]:
    """Compact CoreBookSummary dict for list/get responses."""
    source = bundle.get("source") or {}
    sk = source.get("source_key") or ""
    slots = bundle.get("slots") or []
    chapters = bundle.get("chapters") or []
    return {
        "source_key": sk,
        "source_type": bundle.get("source_type") or "book",
        "title": source.get("title") or sk,
        "language": source.get("language") or "en",
        "selected_languages": list(source.get("selected_languages") or []),
        "chapter_count": len(chapters),
        "slot_count": len(slots),
        "completeness": compute_completeness(bundle),
        "updated_at": bundle.get("updated_at"),
    }
