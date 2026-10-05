# -*- coding: utf-8 -*-
"""The one JSON codec of pycore hot paths: compact UTF-8 bytes in and out.

orjson is used when installed (a missing or broken install degrades to the
standard library with the same output shape: compact separators, non-ASCII
kept, non-string keys stringified).
"""

from __future__ import annotations

import json
from typing import Any, Callable, Optional, Union

from pycore.pyfoundations.third_party.api import get_third_package_orjson

orjson = get_third_package_orjson()

_COMPACT_SEPARATORS = (",", ":")


class JsonCodec:
    """Encode to compact UTF-8 bytes and decode bytes or text."""

    engine = "orjson" if orjson is not None else "json"
    DecodeError = (orjson.JSONDecodeError,) if orjson is not None else (json.JSONDecodeError, UnicodeDecodeError)
    EncodeError = (TypeError, ValueError)

    def encode(self, value: Any, default: Optional[Callable[[Any], Any]] = None) -> bytes:
        """``default`` converts a value the codec cannot encode itself."""
        if orjson is not None:
            return orjson.dumps(value, default=default, option=orjson.OPT_NON_STR_KEYS)
        return json.dumps(
            value,
            ensure_ascii=False,
            separators=_COMPACT_SEPARATORS,
            default=default,
        ).encode("utf-8")

    def decode(self, data: Union[bytes, bytearray, memoryview, str]) -> Any:
        if orjson is not None:
            return orjson.loads(data)
        if isinstance(data, str):
            return json.loads(data)
        return json.loads(bytes(data).decode("utf-8"))


json_codec = JsonCodec()


__all__ = ["JsonCodec", "json_codec"]
