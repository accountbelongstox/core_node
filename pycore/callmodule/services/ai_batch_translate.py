# -*- coding: utf-8 -*-
"""
AI batch translation helper (pycore reuse target for the ``ai_translate`` capability).

The TranslationWorkerService drives the shared fast lane: when a ``word_translation``
task carries ``capability == 'ai_translate'`` it calls ``translate_lines`` here instead
of the GoogleTranslator path, so the words are translated by the unified pyctl AI
gateway (cross-provider, quota-aware) rather than Google.

Public surface used by the worker:
    translate_lines(words, src, dest, domain='text', source='ai_translate_worker')
        -> List[{"word": str, "translation": str}]
    translate_chunk(lines, src, dest, ...) -> (List[str], meta_out)

Both surface the AI provenance via ``meta_out`` (the gateway result's provider/model)
so the worker can report which AI actually handled the batch — folded into the
Laravel result's ``provider`` field. Provider selection / fallback is the gateway's
job (pycore.pyctl.ai.generate_text); this module only shapes the prompt + parses the
answer.

Logging uses ColorPrint exclusively (pycore rule). No third-party imports here — the
gateway owns the HTTP/AI plumbing.
"""

import json
import re
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common import result_cache
from pycore.pyctl.ai import generate_text


# Max words folded into a single AI request. Larger batches are split so a single
# prompt never grows unbounded (and a partial failure re-pends fewer words).
_CHUNK_SIZE = 40

_JSON_ARRAY_RE = re.compile(r"\[.*\]", re.DOTALL)


def _build_prompt(lines: List[str], src: str, dest: str) -> str:
    """Build a deterministic translate-this-list prompt that asks for STRICT JSON.

    The model is told to return a JSON array of ``{"word","translation"}`` objects in
    the SAME order/length as the input, so the parser can zip them back even when the
    surface forms collide.
    """
    src_label = "the source language (auto-detect)" if (src or "auto") in ("", "auto") else src
    numbered = "\n".join(f"{i + 1}. {w}" for i, w in enumerate(lines))
    return (
        f"Translate each of the following {len(lines)} item(s) from {src_label} "
        f"into {dest}. Return ONLY a JSON array of objects, one per input item, in the "
        f"SAME order, each shaped exactly {{\"word\": <original>, \"translation\": <translated>}}. "
        f"Do not add commentary, markdown, or code fences.\n\n{numbered}"
    )


def _parse_answer(text: str, lines: List[str]) -> List[str]:
    """Parse the model answer into a per-line translation list (len == len(lines)).

    Tolerant: extracts the first JSON array, accepts either a list of objects with a
    ``translation`` field or a bare list of strings; falls back to '' for any line the
    model dropped so the output length always matches the input.
    """
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


def translate_chunk(
    lines: List[str],
    src: str,
    dest: str,
    domain: str = "text",
    source: str = "ai_translate_worker",
    meta_out: Optional[Dict[str, Any]] = None,
) -> Tuple[List[str], Dict[str, Any]]:
    """Translate a single chunk of ``lines`` via the AI gateway.

    Returns ``(translations, meta)`` where ``translations`` is a same-length list of
    strings and ``meta`` surfaces the gateway result's ``provider`` / ``model`` (and
    ``success``). When ``meta_out`` is passed it is updated in place AND returned, so a
    caller looping over chunks can keep the LAST provider that actually answered.
    """
    meta: Dict[str, Any] = meta_out if isinstance(meta_out, dict) else {}
    if not lines:
        return [], meta
    prompt = _build_prompt(lines, src, dest)

    # CACHE: an identical AI-translate request (same lines + src + dest) reuses the
    # prior answer instead of re-paying a (rate-limited / quota'd) AI provider —
    # the "same task -> use cache" goal. Keyed by the full prompt, so any change to
    # the lines or prompt shape is a fresh key.
    cached = result_cache.get_json("ai_translate", src or "", dest or "", prompt)
    if isinstance(cached, list) and len(cached) == len(lines):
        meta["provider"] = meta.get("provider") or "cache"
        meta["model"] = meta.get("model") or "cache"
        meta["success"] = True
        meta["cached"] = True
        return [str(x) for x in cached], meta

    res = generate_text(prompt=prompt, source=source) or {}
    # Surface provenance regardless of success so the worker can label the result.
    meta["provider"] = res.get("provider") or meta.get("provider")
    meta["model"] = res.get("model") or meta.get("model")
    meta["success"] = bool(res.get("success"))
    if not res.get("success"):
        ColorPrint.yellow(
            f"[ai_batch_translate] AI translate failed "
            f"(provider={meta.get('provider')!r}, error={res.get('error')!r})"
        )
        return [""] * len(lines), meta
    translations = _parse_answer(res.get("text") or "", lines)
    # Store only a well-formed, full-length answer (never cache a partial/empty one).
    if len(translations) == len(lines) and any(t.strip() for t in translations):
        result_cache.set_json("ai_translate", translations, src or "", dest or "", prompt)
    return translations, meta


def translate_lines(
    words: List[str],
    src: str,
    dest: str,
    domain: str = "text",
    source: str = "ai_translate_worker",
    meta_out: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, str]]:
    """Translate ``words`` -> ``dest`` via the AI gateway, in chunks.

    Returns the worker contract's list: ``[{"word","translation"}, ...]`` (only the
    successfully-translated, non-empty entries — words the model dropped are omitted so
    the worker never posts a blank-overwrite). When ``meta_out`` is provided, the LAST
    answering provider/model is written into it for provenance.
    """
    clean = [w.strip() for w in (words or []) if isinstance(w, str) and w.strip()]
    if not clean:
        return []
    meta: Dict[str, Any] = meta_out if isinstance(meta_out, dict) else {}
    pairs: List[Dict[str, str]] = []
    for start in range(0, len(clean), _CHUNK_SIZE):
        chunk = clean[start : start + _CHUNK_SIZE]
        translations, _ = translate_chunk(
            chunk, src, dest, domain=domain, source=source, meta_out=meta
        )
        for word, translated in zip(chunk, translations):
            if translated:
                pairs.append({"word": word, "translation": translated})
    return pairs
