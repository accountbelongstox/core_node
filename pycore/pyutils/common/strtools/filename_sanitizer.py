# -*- coding: utf-8 -*-
"""
Shared filename sanitizer for pyutils file-processing domains.

Canonical source for the name-sanitization backends used by document and media
processing.

Pure business logic with no sibling-domain imports.
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

_INVALID_BASENAME_RE = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


# --------------------------------------------------------------------------- #
# Name sanitization backends (translate -> unidecode -> pypinyin -> stdlib)    #
# --------------------------------------------------------------------------- #
def _load_backends(want_translate: bool) -> Dict[str, Any]:
    del want_translate
    backends = {"translate": None, "unidecode": None, "pypinyin": None}
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


def sanitize_basename(name: str, fallback: str = "file") -> str:
    basename = os.path.basename((name or "").replace("\\", "/"))
    basename = _INVALID_BASENAME_RE.sub("_", basename).strip().strip(".")
    return basename or fallback


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
