# -*- coding: utf-8 -*-
"""Caller-side input sanitization for the sherpa-onnx TTS frontends.

Official-source rationale (k2-fsa/sherpa-onnx):

  * ``lexicon.cc:ConvertTokensToIds`` logs ``Unknown token: X`` and, in the
    VITS frontend, drops the WHOLE word/unit when one character is missing
    from tokens.txt (the classic missing-character report, issue #418). In
    the Kokoro multi-lang frontend unknown characters are skipped silently.
    Either way, emoji/pictographs (e.g. ❓ U+2753) contribute nothing but
    noise or data loss, and upstream's FAQ answer is "extend the lexicon" —
    for symbols there is deliberately no mapping, so the caller must strip
    them.
  * NFC-normalizing keeps accented letters in the single-codepoint form the
    espeak/piper phonemizer and the lexicons were built against.

Only characters that can NEVER be pronounced are removed (emoji, pictographs,
variation selectors, joiners, control/format chars); letters, CJK and the
punctuation the frontends map are left untouched so prosody is unchanged.
"""

import re
import unicodedata

from pycore.pyutils.common.strtools.normalization import WHITESPACE_RE

# Emoji & pictograph blocks (planes 0/1), regional indicators, variation
# selectors and the zero-width joiner that glues emoji sequences.
_STRIP_RE = re.compile(
    "["
    "\U0001F000-\U0001FAFF"      # emoji & pictographs, transport, emoticons ...
    "\U00002600-\U000027BF"      # misc symbols + dingbats (includes ❓ U+2753)
    "\U0001F1E6-\U0001F1FF"      # regional indicator symbols (flags)
    "\uFE0E\uFE0F"       # variation selectors
    "\u200D"             # zero-width joiner
    "]"
)
_WS_RE = WHITESPACE_RE


def _unpronounceable(char: str) -> bool:
    """C0/C1 controls and Unicode format chars (Cf: ZWSP, BOM, soft hyphen)."""
    return unicodedata.category(char) in ("Cc", "Cf")


def sanitize_tts_text(text: str) -> str:
    """NFC-normalize and strip unpronounceable characters from `text`."""
    value = unicodedata.normalize("NFC", text or "")
    value = _STRIP_RE.sub(" ", value)
    value = "".join(" " if _unpronounceable(char) else char for char in value)
    return _WS_RE.sub(" ", value).strip()


__all__ = ["sanitize_tts_text"]
