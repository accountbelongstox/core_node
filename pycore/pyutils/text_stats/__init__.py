# -*- coding: utf-8 -*-
"""
text_stats — multi-language text statistics base library (pyutils).

Public API:
  compute_text_stats(text, language=None, top_words=20) -> dict
      Word / unique-word / sentence / unique-sentence / character counts +
      per-language breakdown + top words for text in any language.
  merge_stats([stats, ...]) -> dict
      Aggregate several per-file stats into one folder-level summary.

Built on the stdlib-only primitives in pycore.pyfoundations.text_parsing.
"""

from pycore.pyutils.text_stats.text_statistics import (
    compute_text_stats,
    merge_stats,
)

__all__ = ["compute_text_stats", "merge_stats"]
