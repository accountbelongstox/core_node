import hashlib
import re
from typing import Any

from pycore.pyfoundations.punctuation_markers import strip_punctuation


WHITESPACE_RE = re.compile(r"\s+")
_WHITESPACE_RE = WHITESPACE_RE
HORIZONTAL_WHITESPACE_RE = re.compile(r"[ \t]+")
_HORIZONTAL_WHITESPACE_RE = HORIZONTAL_WHITESPACE_RE


def collapse_whitespace(value: str, strip: bool = True) -> str:
    text = _WHITESPACE_RE.sub(" ", value or "")
    return text.strip() if strip else text


def media_content_id(text: str) -> str:
    return hashlib.md5(collapse_whitespace(strip_punctuation(text).lower()).encode("utf-8")).hexdigest()


def collapse_horizontal_whitespace(value: str, strip: bool = True) -> str:
    text = _HORIZONTAL_WHITESPACE_RE.sub(" ", value or "")
    return text.strip() if strip else text


def to_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return default
