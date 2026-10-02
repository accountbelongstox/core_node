"""Sentence segmentation shared by every end (pycore, Laravel, UI).

The rules, the abbreviation list, the speakable thresholds, the timing constants
and the test vectors live ONCE in ``config/sentence_segmentation_contract.json``;
this module, ``App\\Support\\SentenceSegmenter`` (Laravel) and
``core/contracts/SentenceSegmenter.ts`` (UI) are thin adapters of the same
character scanner, and each must pass every vector of the contract.

Nothing here rewrites text: a sentence is a slice of the input with runs of
whitespace collapsed (``clean`` is the separate, explicit markdown clean-up for
text that will be spoken).
"""

import json
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

CONTRACT_FILE = "sentence_segmentation_contract.json"
_REPO_CONTRACT = Path(__file__).resolve().parents[2] / "config" / CONTRACT_FILE
# A copy of this module staged next to a standalone server carries the contract
# beside it; a checkout reads the one in config/.
CONTRACT_PATH = Path(__file__).with_name(CONTRACT_FILE) if Path(__file__).with_name(CONTRACT_FILE).is_file() else _REPO_CONTRACT
HEADING_MAX_LEVEL = 6


class SentenceSegmenter:
    def __init__(self, contract: Dict[str, Any]) -> None:
        self._terminals = set(contract["terminals"]) | set(contract["ellipsis"])
        self._period_like = set(contract["period_like"])
        self._native_terminals = set(contract["native_terminals"])
        self._closers = set(contract["closers"])
        self._openers = "".join(contract["openers"])
        self._cjk = [(int(low, 16), int(high, 16)) for low, high in contract["cjk_ranges"]]
        self._abbreviations = set(contract["abbreviations"])
        markers = contract["block_markers"]
        self._list_prefixes = tuple(markers["list_prefixes"])
        self._numbered_max_digits = int(markers["numbered_max_digits"])
        self._numbered_suffixes = tuple(markers["numbered_suffixes"])
        self._heading_marker = str(markers["heading_marker"])
        self._quote_marker = str(markers["quote_marker"])
        self._clause_breaks = set(contract["long_sentence"]["clause_breaks"])
        speakable = contract["speakable"]
        self._min_letters = int(speakable["min_letters"])
        self._code_symbols = set(speakable["code_symbols"])
        self._max_symbol_ratio = float(speakable["max_code_symbol_ratio"])
        self._emphasis = list(speakable["emphasis_markers"])
        timing = contract["timing"]
        self._en_words_per_second = float(timing["en_words_per_second"])
        self._zh_chars_per_second = float(timing["zh_chars_per_second"])
        self.sentence_gap_seconds = float(timing["sentence_gap_seconds"])
        self._chars_languages = tuple(timing["chars_language_prefixes"])
        verses = contract["verses"]
        self._verse_max_digits = int(verses["max_digits"])
        self._single_letter_words = set(verses["single_letter_words"])

    # ------------------------------------------------------------------ #
    # public API                                                          #
    # ------------------------------------------------------------------ #
    def split(
        self,
        text: str,
        speakable: bool = False,
        min_chars: int = 0,
        max_chars: int = 0,
        max_sentences: int = 0,
    ) -> List[str]:
        """Sentences of ``text``. ``speakable`` cleans markdown and drops what
        would be read as noise; ``max_chars`` cuts a longer sentence at clause
        breaks, then spaces; ``min_chars`` / ``max_sentences`` bound the result."""
        sentences: List[str] = []
        for block in self._blocks(text or ""):
            sentences.extend(self._scan(block))
        if speakable:
            sentences = self._speakable_only(sentences)
        if max_chars > 0:
            sentences = [piece for sentence in sentences for piece in self._cut_long(sentence, max_chars)]
        if min_chars > 0:
            sentences = [sentence for sentence in sentences if len(sentence) >= min_chars]
        if max_sentences > 0:
            sentences = sentences[:max_sentences]
        return sentences

    def split_verses(self, text: str) -> List[Dict[str, Any]]:
        """Sentences of verse-numbered text (the verses option): ``[{text,
        chapter, verse}]``. Verse markers glued to the text are hard boundaries
        and become structure; a number-only block sets the chapter."""
        rows: List[Dict[str, Any]] = []
        chapter: Optional[int] = None
        verse: Optional[int] = None
        for block in self._blocks(text or ""):
            if block.isdigit() and len(block) <= self._verse_max_digits:
                chapter, verse = int(block), None
                continue
            start = 0
            pieces: List[Tuple[Optional[int], str]] = []
            for position, digits in self._verse_markers(block):
                pieces.append((verse, block[start:position]))
                verse = int(digits)
                start = position + len(digits)
            pieces.append((verse, block[start:]))
            for piece_verse, piece in pieces:
                for sentence in self._scan(piece):
                    rows.append({"text": sentence, "chapter": chapter, "verse": piece_verse})
        return rows

    def gate_violation(self, text: str) -> Optional[str]:
        """The import gate (contract verses.gate): "glued_number",
        "verse_reference" or None when the sentence may be stored."""
        text = text or ""
        length = len(text)
        index = 0
        while index < length:
            if not ("0" <= text[index] <= "9"):
                index += 1
                continue
            before = text[index - 1] if index > 0 else ""
            end = index
            while end < length and "0" <= text[end] <= "9":
                end += 1
            after = text[end] if end < length else ""
            if after.isalpha() and (not before or (not before.isalpha() and not ("0" <= before <= "9"))):
                return "glued_number"
            if after == ":" and before != ":" and end - index <= 3:
                tail = end + 1
                while tail < length and "0" <= text[tail] <= "9":
                    tail += 1
                following = text[tail] if tail < length else ""
                if 1 <= tail - end - 1 <= 3 and following != ":" and not ("0" <= following <= "9"):
                    return "verse_reference"
            index = end
        return None

    def has_verse_marker(self, text: str) -> bool:
        """True when ``text`` holds a glued verse marker (see split_verses)."""
        return any(True for block in self._blocks(text or "") for _ in self._verse_markers(block))

    def clean(self, text: str) -> str:
        """One list / heading / quote marker and the emphasis marks removed."""
        text = str(text or "").strip()
        text = text[self._marker_length(text):]
        for marker in self._emphasis:
            text = text.replace(marker, "")
        return " ".join(text.split())

    def is_speakable(self, text: str) -> bool:
        """False for a fragment (too few letters) or mostly code symbols."""
        letters = sum(1 for char in text if unicodedata.category(char)[0] == "L")
        if letters < self._min_letters:
            return False
        symbols = sum(1 for char in text if char in self._code_symbols)
        return symbols / max(1, len(text)) < self._max_symbol_ratio

    def estimate_seconds(self, text: str, language: str = "en") -> float:
        """Rough spoken duration of ``text`` (without the gap between clips)."""
        text = str(text or "")
        if not text.strip():
            return 0.0
        if str(language or "").lower().startswith(self._chars_languages):
            return len(text) / self._zh_chars_per_second
        return max(1, len(text.split())) / self._en_words_per_second

    def is_cjk(self, char: str) -> bool:
        code = ord(char)
        return any(low <= code <= high for low, high in self._cjk)

    # ------------------------------------------------------------------ #
    # blocks                                                              #
    # ------------------------------------------------------------------ #
    def _marker_length(self, line: str) -> int:
        """Length of a list / numbered / heading / quote marker (with its
        trailing space) at the start of ``line``, else 0."""
        for prefix in self._list_prefixes:
            if line.startswith(prefix + " "):
                return len(prefix) + 1
        digits = 0
        while digits < len(line) and "0" <= line[digits] <= "9":
            digits += 1
        if 0 < digits <= self._numbered_max_digits:
            for suffix in self._numbered_suffixes:
                if line[digits:digits + len(suffix) + 1] == suffix + " ":
                    return digits + len(suffix) + 1
        if line.startswith(self._quote_marker):
            length = 0
            while length < len(line) and line[length] == self._quote_marker:
                length += 1
            return length + 1 if line[length:length + 1] == " " else 0
        if self._is_heading(line):
            return line.index(" ") + 1
        return 0

    def _is_heading(self, line: str) -> bool:
        hashes = 0
        while hashes < len(line) and line[hashes] == self._heading_marker:
            hashes += 1
        return 0 < hashes <= HEADING_MAX_LEVEL and line[hashes:hashes + 1] == " "

    def _blocks(self, text: str) -> List[str]:
        """Blank lines and marker lines are hard breaks; other line breaks are
        soft and join with a space."""
        blocks: List[List[str]] = []
        current: List[str] = []
        for raw in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
            line = raw.strip()
            if not line:
                if current:
                    blocks.append(current)
                current = []
                continue
            if self._marker_length(line) and current:
                blocks.append(current)
                current = []
            current.append(line)
            if self._is_heading(line):
                blocks.append(current)
                current = []
        if current:
            blocks.append(current)
        return [" ".join(block) for block in blocks]

    # ------------------------------------------------------------------ #
    # scanner                                                             #
    # ------------------------------------------------------------------ #
    def _scan(self, block: str) -> List[str]:
        sentences: List[str] = []
        start = 0
        index = 0
        length = len(block)
        while index < length:
            if block[index] not in self._terminals:
                index += 1
                continue
            run_end = index
            while run_end < length and block[run_end] in self._terminals:
                run_end += 1
            end = run_end
            while end < length and block[end] in self._closers:
                end += 1
            if self._ends_sentence(block, start, index, run_end, end):
                sentences.append(" ".join(block[start:end].split()))
                start = end
            index = end
        rest = " ".join(block[start:].split())
        if rest:
            sentences.append(rest)
        return [sentence for sentence in sentences if sentence]

    def _ends_sentence(self, block: str, start: int, run_start: int, run_end: int, end: int) -> bool:
        run = block[run_start:run_end]
        if any(char in self._native_terminals for char in run):
            return True
        following = block[end] if end < len(block) else ""
        if following and not following.isspace() and not self.is_cjk(following):
            return False
        if run[0] not in self._period_like or not following:
            return True
        tail = block[end:].lstrip()
        if tail[:1].lower() == tail[:1] and tail[:1].upper() != tail[:1]:
            return False
        if run != ".":
            return True
        head = block[start:run_start]
        token = head.rsplit(" ", 1)[-1].lstrip(self._openers)
        if token.lower() in self._abbreviations:
            return False
        if len(token) == 1 and token.isalpha() and token.isupper():
            return False
        parts = token.split(".")
        if len(parts) >= 2 and all(len(part) == 1 and part.isalpha() for part in parts):
            return False
        if len(token) <= 2 and token != "" and all("0" <= char <= "9" for char in token) and head.strip() == token:
            return False
        return True

    def _verse_markers(self, block: str) -> List[Tuple[int, str]]:
        markers: List[Tuple[int, str]] = []
        index = 0
        length = len(block)
        while index < length:
            if not ("0" <= block[index] <= "9") or (index > 0 and not self._may_precede_verse(block[index - 1])):
                index += 1
                continue
            end = index
            while end < length and "0" <= block[end] <= "9":
                end += 1
            if end - index <= self._verse_max_digits and self._starts_verse_text(block, end):
                markers.append((index, block[index:end]))
            index = end
        return markers

    def _may_precede_verse(self, char: str) -> bool:
        return char.isspace() or char in self._terminals or char in self._closers

    def _starts_verse_text(self, block: str, at: int) -> bool:
        first = block[at] if at < len(block) else ""
        second = block[at + 1] if at + 1 < len(block) else ""
        if not first:
            return False
        if self.is_cjk(first):
            return True
        if first in self._openers:
            return second.isalpha() and second.isupper()
        if not (first.isalpha() and first.isupper()):
            return False
        if second.isalpha() and second.islower():
            return True
        return first in self._single_letter_words and not second.isalpha()

    # ------------------------------------------------------------------ #
    # speech and length                                                   #    # ------------------------------------------------------------------ #
    # speech and length                                                   #
    # ------------------------------------------------------------------ #
    def _speakable_only(self, sentences: List[str]) -> List[str]:
        kept = []
        for sentence in sentences:
            if not self.is_speakable(sentence):
                continue
            cleaned = self.clean(sentence)
            if self.is_speakable(cleaned):
                kept.append(cleaned)
        return kept

    def _cut_long(self, sentence: str, max_chars: int) -> List[str]:
        pieces: List[str] = []
        rest = sentence
        while len(rest) > max_chars:
            cut = self._cut_position(rest, max_chars)
            pieces.append(rest[:cut].strip())
            rest = rest[cut:].strip()
        if rest:
            pieces.append(rest)
        return [piece for piece in pieces if piece]

    def _cut_position(self, text: str, max_chars: int) -> int:
        clause = max(
            (
                position + 1
                for position in range(min(len(text), max_chars))
                if text[position] in self._clause_breaks and (position + 1 == len(text) or text[position + 1] == " ")
            ),
            default=0,
        )
        if clause:
            return clause
        space = text.rfind(" ", 1, max_chars + 1)
        return space if space > 0 else max_chars


def _load_contract() -> Dict[str, Any]:
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


sentence_segmenter = SentenceSegmenter(_load_contract())

__all__ = ["CONTRACT_PATH", "SentenceSegmenter", "sentence_segmenter"]
