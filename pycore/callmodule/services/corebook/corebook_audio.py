# -*- coding: utf-8 -*-
"""Local TTS fill for CoreBook per-sentence audio files."""

import os
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
import pycore.pyutils.tts.tts_orchestrator as tts_orchestrator
from pycore.callmodule.services.corebook.corebook_store import (
    absolute_audio_path,
    audio_root,
    relative_audio_path,
)


def synthesize_slot_audio(
    source_key: str,
    lang: str,
    grain: str,
    seq: int,
    text: str,
    rate: str = "+0%",
) -> Tuple[Optional[str], Optional[str]]:
    """Synthesize one sentence to the bundle audio dir; returns (rel_path, error)."""
    rel = relative_audio_path(source_key, lang, grain, seq)
    dest = absolute_audio_path(source_key, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if os.path.isfile(dest) and os.path.getsize(dest) >= 100:
        return rel, None
    try:
        res = tts_orchestrator.synthesize(text=text, lang=lang, rate=rate, dest_path=dest)
    except Exception as exc:
        return None, str(exc)
    if not res or not res.get("success"):
        return None, (res or {}).get("error") or "TTS failed"
    if not os.path.isfile(dest):
        return None, "TTS produced no file"
    return rel, None


def fill_audio_for_slots(
    source_key: str,
    slots: List[Dict[str, Any]],
    languages: List[str],
    grain: str = "sentence",
    rate: str = "+0%",
    on_progress: Optional[Callable[[int, int, str], None]] = None,
) -> Dict[str, Any]:
    """Fill missing audio for ``languages`` on matching ``grain`` slots."""
    targets = [s for s in slots if (s.get("grain") or "sentence") == grain]
    total = len(targets)
    filled = 0
    skipped = 0
    errors: List[str] = []
    audio_root(source_key)

    for idx, slot in enumerate(targets):
        langs = slot.get("langs") or {}
        audio_map = slot.setdefault("audio", {})
        g = slot.get("grain") or grain
        seq = int(slot.get("seq", 0) or 0)
        for code in languages:
            txt = langs.get(code)
            if not (txt and str(txt).strip()):
                continue
            if audio_map.get(code):
                skipped += 1
                continue
            rel, err = synthesize_slot_audio(source_key, code, g, seq, str(txt), rate=rate)
            if rel:
                audio_map[code] = rel
                filled += 1
            elif err:
                errors.append(f"{code} seq {seq}: {err}")
        if on_progress:
            on_progress(idx + 1, total, f"{g} #{seq}")

    return {"filled": filled, "skipped": skipped, "total": total, "errors": errors}
