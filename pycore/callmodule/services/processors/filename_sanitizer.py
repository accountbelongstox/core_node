# -*- coding: utf-8 -*-
"""
Filename sanitizer - ASCII filename transcoding for the Video Extract feature.

Canonical source for the name-sanitization backends (translate -> unidecode ->
pypinyin -> stdlib). Imported by book_processor.py and laravel_media_sync.py
(via the video_extract_processor facade re-export), so the public names below
MUST stay stable.

Pure business logic: no HTTP/FastAPI, no import back into the processors
package (only stdlib + optional third-party transcription backends, loaded
lazily inside _load_backends).
"""

import hashlib
import os
import re
import unicodedata
from typing import Any, Dict, Optional


_ALLOWED = set(
    "abcdefghijklmnopqrstuvwxyz"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "0123456789._-"
)


# --------------------------------------------------------------------------- #
# Name sanitization backends (translate -> unidecode -> pypinyin -> stdlib)    #
# --------------------------------------------------------------------------- #
def _load_backends(want_translate: bool) -> Dict[str, Any]:
    backends = {"translate": None, "unidecode": None, "pypinyin": None}

    if want_translate:
        try:
            from deep_translator import GoogleTranslator
            translator = GoogleTranslator(source="auto", target="en")

            def _translate(text):
                return translator.translate(text)

            backends["translate"] = _translate
        except Exception:
            backends["translate"] = None

    try:
        from unidecode import unidecode as _unidecode
        backends["unidecode"] = _unidecode
    except Exception:
        backends["unidecode"] = None

    try:
        from pypinyin import lazy_pinyin as _lazy_pinyin

        def _pinyin(text):
            return " ".join(_lazy_pinyin(text))

        backends["pypinyin"] = _pinyin
    except Exception:
        backends["pypinyin"] = None

    return backends


def _builtin_fallback(text: str) -> str:
    norm = unicodedata.normalize("NFKD", text)
    ascii_only = norm.encode("ascii", "ignore").decode("ascii")
    if not re.search(r"[A-Za-z0-9]", ascii_only):
        return "u_" + hashlib.sha1(text.encode("utf-8")).hexdigest()[:8]
    return ascii_only


def _clean_token(text: str) -> str:
    text = re.sub(r"\s+", "", text)
    text = "".join(ch if ch in _ALLOWED else "_" for ch in text)
    text = re.sub(r"_{2,}", "_", text).strip("_.")
    return text


def to_english_ascii(text: Optional[str], backends: Dict[str, Any]) -> str:
    if text is None:
        return ""
    if all(ord(ch) < 128 for ch in text):
        converted = text
    else:
        converted = None
        if backends.get("translate"):
            try:
                result = backends["translate"](text)
                if result and result.strip():
                    converted = result
            except Exception:
                converted = None
        if converted is None and backends.get("unidecode"):
            try:
                converted = backends["unidecode"](text)
            except Exception:
                converted = None
        if converted is None and backends.get("pypinyin"):
            try:
                converted = backends["pypinyin"](text)
            except Exception:
                converted = None
        if converted is None or not converted.strip():
            converted = _builtin_fallback(text)
    return _clean_token(converted)


def sanitize_relpath(rel_path: str, backends: Dict[str, Any]):
    parts = [p for p in re.split(r"[\\/]+", rel_path) if p not in ("", ".", "..")]
    *dir_parts, file_name = parts
    stem, ext = os.path.splitext(file_name)
    clean_dirs = []
    for d in dir_parts:
        cd = to_english_ascii(d, backends)
        clean_dirs.append(cd or ("dir_" + hashlib.sha1(d.encode("utf-8")).hexdigest()[:8]))
    clean_stem = to_english_ascii(stem, backends)
    if not clean_stem:
        clean_stem = "file_" + hashlib.sha1(stem.encode("utf-8")).hexdigest()[:8]
    clean_ext = "." + re.sub(r"[^A-Za-z0-9]", "", ext.lstrip(".")).lower() if ext else ""
    return clean_dirs, clean_stem, clean_ext
