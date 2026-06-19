# -*- coding: utf-8 -*-
"""
text_parsing — multi-language text primitives (pyfoundations leaf, stdlib only).

Low-level, dependency-free building blocks for analyzing text in any language:
encoding detection, punctuation normalization, Unicode-script detection,
multi-language word tokenization and sentence splitting. These are the reusable
primitives the higher-level ``pyutils.text_stats`` engine builds statistics on
(word / unique-word / sentence / unique-sentence counts + per-language breakdown)
and that the Books ingest pipeline can share.

Design / layering (pycore rules, PYTHON_PYCORE.md §2.2):
  * pyfoundations leaf — imports ONLY Python stdlib (re / unicodedata / codecs).
    NO third-party (chardet/bs4/...) and NO pyutils/pyctl imports, so it stays a
    safe dependency for any layer above.
  * The English word tokenizer is a multi-language generalization of the
    reference word-statistics code (dict-server-client all_text_trans.parse_text):
    Latin contractions/quotes are normalized, while CJK / Kana / Hangul are
    counted per the conventions below (no whitespace word boundaries exist there).

Nothing here raises on bad input: callers get '' / [] / {} on empty or unusable
text rather than exceptions.
"""

import re
import unicodedata
from typing import Dict, List, Optional

# --------------------------------------------------------------------------- #
# Unicode script ranges                                                        #
# --------------------------------------------------------------------------- #
# Each entry: script key -> list of (lo, hi) inclusive codepoint ranges. Only
# the ranges that matter for language detection + tokenization are listed; every
# other letter falls back to the generic "latin"/"other" buckets via isalpha().
_SCRIPT_RANGES = {
    # Han ideographs (Chinese, Japanese kanji, Korean hanja) — counted per char.
    "han": [
        (0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xF900, 0xFAFF),
        (0x20000, 0x2A6DF), (0x2A700, 0x2EBEF),
    ],
    "hiragana": [(0x3040, 0x309F)],
    "katakana": [(0x30A0, 0x30FF), (0x31F0, 0x31FF)],
    "hangul": [(0xAC00, 0xD7A3), (0x1100, 0x11FF), (0x3130, 0x318F)],
    "cyrillic": [(0x0400, 0x04FF), (0x0500, 0x052F)],
    "greek": [(0x0370, 0x03FF), (0x1F00, 0x1FFF)],
    "arabic": [(0x0600, 0x06FF), (0x0750, 0x077F)],
    "hebrew": [(0x0590, 0x05FF)],
    "thai": [(0x0E00, 0x0E7F)],
    "devanagari": [(0x0900, 0x097F)],
    "latin": [(0x0041, 0x005A), (0x0061, 0x007A), (0x00C0, 0x024F)],
}

# Scripts whose characters are token units on their own (no whitespace word
# boundaries) — counted per character / per contiguous run.
_PER_CHAR_SCRIPTS = ("han",)
_PER_RUN_CJK_SCRIPTS = ("hiragana", "katakana", "hangul")

# Canonical supported language CODES — the pycore mirror of laravel_main's
# AppQyV1TableMaps::getSupportedLanguages() (= keys of
# config('edge_tts.lang_code_mapping')). Books' multi-language correspondence
# (BOOKS_FEATURE_SPECIFICATION.md §2) validates the UI-checked set against THIS
# set; keep it in sync with config/edge_tts.php when the laravel map changes.
SUPPORTED_LANGUAGE_CODES = (
    "af", "am", "ar", "as", "az", "bg", "bn", "bs", "ca", "cs",
    "cy", "da", "de", "el", "en", "es", "et", "eu", "fa", "fi",
    "fil", "fr", "ga", "gl", "gu", "he", "hi", "hr", "hu", "hy",
    "id", "is", "it", "ja", "jv", "ka", "kk", "km", "kn", "ko",
    "lo", "lt", "lv", "mk", "ml", "mn", "mr", "ms", "mt", "my",
    "nb", "ne", "nl", "or", "pa", "pl", "ps", "pt", "ro", "ru",
    "si", "sk", "sl", "so", "sq", "sr", "su", "sv", "sw", "ta",
    "te", "th", "tr", "uk", "ur", "uz", "vi", "wuu", "yue", "zh",
    "zu",
)
_SUPPORTED_LANGUAGE_SET = frozenset(SUPPORTED_LANGUAGE_CODES)


def normalize_language_codes(codes, primary: Optional[str] = None) -> List[str]:
    """Filter+dedupe a caller's language codes to the canonical supported set.

    Lower-cases and trims each code, keeps only codes in
    ``SUPPORTED_LANGUAGE_CODES`` (preserving first-seen order), and — when a
    ``primary`` is given and supported — guarantees it is present and FIRST (the
    detected primary is auto-checked and cannot be unchecked, §5). Returns ``[]``
    for no usable codes (callers enforce the ">=1" rule and may fall back to the
    primary). Never raises.
    """
    out: List[str] = []
    seen: set = set()
    primary = (primary or "").strip().lower()
    if primary and primary in _SUPPORTED_LANGUAGE_SET:
        out.append(primary)
        seen.add(primary)
    for code in (codes or []):
        c = (str(code) if code is not None else "").strip().lower()
        if c and c in _SUPPORTED_LANGUAGE_SET and c not in seen:
            out.append(c)
            seen.add(c)
    return out


# Dominant-script -> ISO-ish language code (heuristic; "primary_language").
_SCRIPT_TO_LANG = {
    "han": "zh",
    "hiragana": "ja",
    "katakana": "ja",
    "hangul": "ko",
    "cyrillic": "ru",
    "greek": "el",
    "arabic": "ar",
    "hebrew": "he",
    "thai": "th",
    "devanagari": "hi",
    "latin": "en",
}

# --------------------------------------------------------------------------- #
# Punctuation normalization                                                    #
# --------------------------------------------------------------------------- #
# Full-width / CJK punctuation -> ASCII equivalents (superset of the reference
# dict-server-client SentenceHelper.PUNCTUATION_MAP), so a single ASCII-based
# sentence splitter works for mixed CJK + Latin text.
CJK_PUNCT_MAP = {
    "。": ".", "，": ",", "！": "!", "？": "?", "；": ";", "：": ":",
    "（": "(", "）": ")", "【": "[", "】": "]", "《": "<", "》": ">",
    "、": ",", "…": "...", "—": "-", "～": "~", "·": ".",
    "「": '"', "」": '"', "『": "'", "』": "'", "〈": "<", "〉": ">",
    "［": "[", "］": "]", "｛": "{", "｝": "}",
    "．": ".", "｡": ".", "､": ",",
}
_CJK_PUNCT_RE = re.compile("|".join(map(re.escape, CJK_PUNCT_MAP.keys())))

# Curly quotes -> straight quotes (mirrors all_text_trans normalization).
_QUOTE_MAP = {"‘": "'", "’": "'", "“": '"', "”": '"'}
_QUOTE_RE = re.compile("|".join(map(re.escape, _QUOTE_MAP.keys())))

# Sentence-terminal punctuation AFTER CJK->ASCII normalization.
_TERMINAL_CHARS = ".!?"
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s*")

# Encodings tried in order when no BOM pins the answer (stdlib-only detection).
_ENCODING_CANDIDATES = ("utf-8", "gb18030", "big5", "shift_jis", "euc-kr", "latin-1")


# --------------------------------------------------------------------------- #
# Encoding detection (stdlib only — no chardet)                                #
# --------------------------------------------------------------------------- #
def decode_bytes(raw: bytes) -> str:
    """Best-effort decode of ``raw`` bytes to text, stdlib only.

    Honors a leading BOM (UTF-8 / UTF-16 / UTF-32), then tries a small ordered
    set of common encodings, finally falling back to UTF-8 with replacement so a
    result is ALWAYS returned (never raises). For chardet-grade detection use the
    app layer; this keeps pyfoundations dependency-free.
    """
    if not raw:
        return ""
    # BOM sniffing.
    if raw[:3] == b"\xef\xbb\xbf":
        return raw[3:].decode("utf-8", errors="replace")
    if raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
        return raw.decode("utf-16", errors="replace")
    if raw[:4] in (b"\xff\xfe\x00\x00", b"\x00\x00\xfe\xff"):
        return raw.decode("utf-32", errors="replace")
    for enc in _ENCODING_CANDIDATES:
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("utf-8", errors="replace")


# --------------------------------------------------------------------------- #
# Normalization                                                                #
# --------------------------------------------------------------------------- #
def normalize_quotes(text: str) -> str:
    """Replace curly single/double quotes with straight ASCII quotes."""
    if not text:
        return ""
    return _QUOTE_RE.sub(lambda m: _QUOTE_MAP[m.group()], text)


def normalize_punctuation(text: str) -> str:
    """Map CJK/full-width punctuation to ASCII and straighten quotes.

    The result lets one ASCII-based splitter handle mixed CJK + Latin text.
    """
    if not text:
        return ""
    text = normalize_quotes(text)
    return _CJK_PUNCT_RE.sub(lambda m: CJK_PUNCT_MAP[m.group()], text)


# --------------------------------------------------------------------------- #
# Script / language detection                                                  #
# --------------------------------------------------------------------------- #
def _script_of(cp: int) -> Optional[str]:
    """Return the script key for a codepoint, or None (digits/punct/space)."""
    for script, ranges in _SCRIPT_RANGES.items():
        for lo, hi in ranges:
            if lo <= cp <= hi:
                return script
    return None


def detect_scripts(text: str) -> Dict[str, int]:
    """Count letters by Unicode script.

    Returns a ``{script: char_count}`` dict over the recognized scripts plus an
    ``"other"`` bucket for letters not in the listed ranges (e.g. accented Latin
    beyond the base block is already covered, but exotic scripts land in other).
    Non-letters (digits / punctuation / whitespace) are ignored. Empty for
    empty/blank text.
    """
    counts: Dict[str, int] = {}
    if not text:
        return counts
    for ch in text:
        cp = ord(ch)
        script = _script_of(cp)
        if script is None:
            if ch.isalpha():
                script = "other"
            else:
                continue
        counts[script] = counts.get(script, 0) + 1
    return counts


def language_breakdown(text: str) -> List[Dict[str, object]]:
    """Per-language breakdown sorted by descending letter share.

    Each row: ``{script, code, chars, ratio}`` where ``code`` is a heuristic
    language code (zh/ja/ko/ru/en/...), ``chars`` the letter count for that
    script and ``ratio`` its share of all counted letters (0..1, rounded).
    """
    counts = detect_scripts(text)
    total = sum(counts.values())
    if not total:
        return []
    rows: List[Dict[str, object]] = []
    for script, n in counts.items():
        rows.append({
            "script": script,
            "code": _SCRIPT_TO_LANG.get(script, script),
            "chars": n,
            "ratio": round(n / total, 4),
        })
    rows.sort(key=lambda r: r["chars"], reverse=True)
    return rows


def guess_language(text: str) -> str:
    """Heuristic primary language code from the dominant Unicode script.

    Han is reported as ``zh``; if Hiragana/Katakana are present alongside Han,
    the text is treated as Japanese (``ja``). Returns ``und`` (undetermined) when
    there are no letters at all.
    """
    counts = detect_scripts(text)
    if not counts:
        return "und"
    # Kana presence is the strongest signal for Japanese even when kanji dominate.
    if counts.get("hiragana", 0) + counts.get("katakana", 0) > 0 and counts.get("han", 0) > 0:
        return "ja"
    dominant = max(counts.items(), key=lambda kv: kv[1])[0]
    return _SCRIPT_TO_LANG.get(dominant, dominant)


# --------------------------------------------------------------------------- #
# Tokenization (multi-language)                                                #
# --------------------------------------------------------------------------- #
def _is_per_char_cjk(cp: int) -> bool:
    """True for Han ideographs (each is its own word token)."""
    for lo, hi in _SCRIPT_RANGES["han"]:
        if lo <= cp <= hi:
            return True
    return False


def _is_run_cjk(cp: int) -> bool:
    """True for Hiragana/Katakana/Hangul (tokenized as contiguous runs)."""
    for script in _PER_RUN_CJK_SCRIPTS:
        for lo, hi in _SCRIPT_RANGES[script]:
            if lo <= cp <= hi:
                return True
    return False


def tokenize_words(text: str) -> List[str]:
    """Split text into word tokens across languages.

    Rules:
      * Han ideographs       — one token PER character (no word spacing exists).
      * Hiragana/Katakana/Hangul — one token per contiguous run.
      * Latin/Cyrillic/Greek/etc. — alphabetic runs, keeping word-internal
        apostrophes and hyphens (so ``don't`` / ``well-known`` stay whole), with
        leading/trailing ``'`` and ``-`` stripped. Curly quotes are straightened
        first (reference parity with all_text_trans).
      * Digits and punctuation are token separators, never tokens.

    Returns ``[]`` for empty/blank text. Tokens preserve their original case;
    case-folding for "unique" counts is the caller's job.
    """
    if not text:
        return []
    text = normalize_quotes(text)
    tokens: List[str] = []
    buf: List[str] = []          # in-progress alphabetic word
    run: List[str] = []          # in-progress kana/hangul run

    def flush_word():
        if buf:
            w = "".join(buf).strip("'-")
            if w and any(c.isalpha() for c in w):
                tokens.append(w)
            buf.clear()

    def flush_run():
        if run:
            tokens.append("".join(run))
            run.clear()

    for ch in text:
        cp = ord(ch)
        if _is_per_char_cjk(cp):
            flush_word()
            flush_run()
            tokens.append(ch)
        elif _is_run_cjk(cp):
            flush_word()
            run.append(ch)
        elif ch.isalpha():
            flush_run()
            buf.append(ch)
        elif ch in "'-" and buf:
            # word-internal apostrophe / hyphen only (leading ones are dropped)
            buf.append(ch)
        else:
            flush_word()
            flush_run()
    flush_word()
    flush_run()
    return tokens


# --------------------------------------------------------------------------- #
# Sentence splitting (multi-language)                                          #
# --------------------------------------------------------------------------- #
def split_sentences(text: str) -> List[str]:
    """Split text into sentences for any language.

    Normalizes CJK/full-width punctuation to ASCII, collapses whitespace, then
    splits AFTER terminal punctuation ``. ! ?`` (CJK 。！？ are mapped in, and
    ``…`` becomes ``...``). Unlike the reference splitter this does not require a
    trailing space, so space-less CJK text splits correctly. Returns the trimmed,
    non-empty sentences (``[]`` for empty/blank text).
    """
    if not text:
        return []
    text = normalize_punctuation(text)
    text = re.sub(r"\s+", " ", text.replace("\n", " ")).strip()
    if not text:
        return []
    parts = _SENTENCE_SPLIT_RE.split(text)
    return [p.strip() for p in parts if p and p.strip()]


def normalize_sentence_key(sentence: str) -> str:
    """Dedupe key for a sentence: trimmed, whitespace-collapsed, lowercased.

    Mirrors the Laravel sentence-library normalize (mb_strtolower(trim) + single
    spaces) so "unique sentence" counts here agree with server-side dedup. Uses
    ``str.lower()`` (NOT ``casefold``) to match mb_strtolower for non-ASCII
    (sharp-s, final sigma, Turkish dotted-I) — casefold diverges from the key.
    """
    if not sentence:
        return ""
    return re.sub(r"\s+", " ", sentence.strip()).lower()
