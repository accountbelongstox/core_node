# -*- coding: utf-8 -*-
"""Batched AI sentence translation for CoreBook language enrichment."""

import json
import re
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
import pycore.pyutils.common.result_cache as result_cache
from pycore.pyctl.ai.ai_gateway import generate_text

_JSON_ARRAY_RE = re.compile(r"\[.*\]", re.DOTALL)
_DEFAULT_CHUNK = 120


def _build_sentence_prompt(lines: List[str], src: str, dest: str) -> str:
    src_label = "the source language (auto-detect)" if (src or "auto") in ("", "auto") else src
    numbered = "\n".join(f"{i + 1}. {w}" for i, w in enumerate(lines))
    return (
        f"Translate each of the following {len(lines)} sentence(s) from {src_label} "
        f"into {dest}. Preserve meaning; do not summarize. Return ONLY a JSON array of "
        f"objects in the SAME order, each {{\"original\": <source>, \"translation\": <translated>}}. "
        f"No commentary or markdown.\n\n{numbered}"
    )


def _parse_sentence_answer(text: str, lines: List[str]) -> List[str]:
    out = [""] * len(lines)
    if not text:
        return out
    match = _JSON_ARRAY_RE.search(text)
    blob = match.group(0) if match else text
    try:
        data = json.loads(blob)
    except (ValueError, TypeError):
        return out
    if not isinstance(data, list):
        return out
    for i, entry in enumerate(data[: len(lines)]):
        if isinstance(entry, dict):
            val = entry.get("translation") or entry.get("translated") or entry.get("text")
            out[i] = str(val).strip() if val is not None else ""
        elif isinstance(entry, str):
            out[i] = entry.strip()
    return out


def translate_sentences(
    sentences: List[str],
    src: str,
    dest: str,
    chunk_size: int = _DEFAULT_CHUNK,
    source: str = "corebook_translate",
    on_progress: Optional[Callable[[int, int], None]] = None,
) -> Tuple[List[str], Dict[str, Any]]:
    """Translate ``sentences`` into ``dest``; returns (translations, meta)."""
    clean = [s.strip() for s in (sentences or []) if isinstance(s, str) and s.strip()]
    meta: Dict[str, Any] = {"provider": None, "model": None, "success": False}
    if not clean:
        return [], meta
    if src == dest:
        return list(clean), {**meta, "success": True, "provider": "identity"}

    out: List[str] = []
    chunks = max(1, (len(clean) + chunk_size - 1) // chunk_size)
    for ci in range(chunks):
        chunk = clean[ci * chunk_size:(ci + 1) * chunk_size]
        prompt = _build_sentence_prompt(chunk, src, dest)
        cached = result_cache.get_json("corebook_translate", src or "", dest or "", prompt)
        if isinstance(cached, list) and len(cached) == len(chunk):
            out.extend(str(x) for x in cached)
            meta["provider"] = meta.get("provider") or "cache"
            meta["success"] = True
        else:
            res = generate_text(prompt=prompt, source=source) or {}
            meta["provider"] = res.get("provider") or meta.get("provider")
            meta["model"] = res.get("model") or meta.get("model")
            if not res.get("success"):
                ColorPrint.yellow(
                    f"[CoreBook] translate chunk failed provider={meta.get('provider')!r}")
                out.extend([""] * len(chunk))
            else:
                trans = _parse_sentence_answer(res.get("text") or "", chunk)
                out.extend(trans)
                if any(t.strip() for t in trans):
                    meta["success"] = True
                    result_cache.set_json("corebook_translate", trans, src or "", dest or "", prompt)
        if on_progress:
            on_progress(ci + 1, chunks)
    return out, meta
