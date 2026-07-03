# -*- coding: utf-8 -*-
"""
External web-service API clients for pycore (pyutils layer).

These modules wrap third-party HTTP APIs that pycore queries directly (movie
poster databases, etc.). They follow the pycore rules: networking only through
the lazily-imported ``requests`` accessor, secrets only through the secret
manager, and logging only via ColorPrint. Each client degrades gracefully
(returns None / empty on any failure) so callers can treat them as best-effort.
"""

from pycore.pyutils.external_apis.movie_poster_client import (
    parse_title_year,
    find_poster,
    save_poster_file,
)
from pycore.pyutils.external_apis.word_audio_client import (
    find_pronunciation,
)

__all__ = [
    "parse_title_year",
    "find_poster",
    "save_poster_file",
    "find_pronunciation",
]
