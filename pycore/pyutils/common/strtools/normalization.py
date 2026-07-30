import re
from typing import Any


_WHITESPACE_RE = re.compile(r"\s+")
_HORIZONTAL_WHITESPACE_RE = re.compile(r"[ \t]+")


def collapse_whitespace(value: str, strip: bool = True) -> str:
    text = _WHITESPACE_RE.sub(" ", value or "")
    return text.strip() if strip else text


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
