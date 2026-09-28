# -*- coding: utf-8 -*-
"""Ledger of every local word/sentence clip pycore holds.

The word cache (``word_audio_cache``: ``{safe_word}_{provider}.mp3``) and the
sentence cache (``sentence_audio_cache``: content-addressed by synthesis
inputs) cannot give back the text a clip was made from. Every producer that
knows it (word cache stores, audio lane staging, orchestration manifests)
records the clip here, so the local audio cache has one inventory:
``(kind, resource_key)`` -> newest file + text, language, variant, provider.

``resource_key`` is the Laravel clip key: ``<lang>:<md5>`` for words (the md5
Laravel sends with the word, queue_center_contract ``word_identity``) and
``<lang>:<media_content_id(text)>`` for sentences, ``:<variant>`` appended
for a non-primary variant; ``<lang>`` comes from the central
``text_parsing.normalize_language_code`` (codes, regional codes and names).
A word with no Laravel md5 (X4: orchestration-tokenized words, word-cache
bootstrap, local Part1 tasks) keys as ``<lang>:text:<cleaned_word>`` instead;
pycore never recomputes a stand-in md5 from the text.
"""

import time
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

from pycore.database.repositories.audio_resource_repository import AudioResourceRepository
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.system_paths import APP_CONFIG_DIR
from pycore.pyfoundations.text_parsing import normalize_language_code
from pycore.pyutils.common.queue_center_contract import word_identity_content
from pycore.pyutils.common.strtools.normalization import media_content_id


AUDIO_RESOURCE_LEDGER_FILE = APP_CONFIG_DIR / "audio_resources.sqlite3"
CLIP_KINDS = ("word", "sentence")
LEDGER_PAGE = 1000


def resource_key(kind: str, language: Optional[str], text: str, variant: str = "", md5: str = "") -> str:
    if kind == "sentence":
        content = media_content_id(text)
    else:
        content = word_identity_content(md5, text)
    key = f"{normalize_language_code(language)}:{content}"
    variant = str(variant or "").strip()
    return f"{key}:{variant}" if variant else key


def word_md5(key: str) -> str:
    """The md5 segment of a word resource key ``<lang>:<md5>[:<variant>]``, or
    "" when the key carries no Laravel md5 (``<lang>:text:<cleaned_word>``)."""
    parts = str(key or "").split(":")
    if len(parts) < 2 or parts[1] == "text":
        return ""
    return parts[1].strip()


class AudioResourceLedger:
    """Serialized owner of the clip ledger (lazy database open)."""

    def __init__(self) -> None:
        self._repo: Optional[AudioResourceRepository] = None
        init_serialized_owner(self, "tts.audio_resource_ledger", "AudioResourceLedgerState")

    def _repository(self) -> AudioResourceRepository:
        if self._repo is None:
            self._repo = AudioResourceRepository(AUDIO_RESOURCE_LEDGER_FILE)
        return self._repo

    @staticmethod
    def entry(
        kind: str, language: Optional[str], text: str, path: str, provider: str = "", variant: str = "",
        md5: str = "",
    ) -> Optional[Dict[str, Any]]:
        """Ledger row of one clip, or None when it is not a usable clip;
        ``md5`` is the Laravel word identity when the producer has it."""
        text = str(text or "").strip()
        if kind not in CLIP_KINDS or not text or not path:
            return None
        return {
            "kind": kind,
            "resource_key": resource_key(kind, language, text, variant, md5),
            "language": normalize_language_code(language),
            "variant": str(variant or "").strip(),
            "text": text,
            "path": str(Path(path).resolve()),
            "provider": str(provider or ""),
            "recorded_at": time.time(),
        }

    def record(
        self, kind: str, language: Optional[str], text: str, path: str, provider: str = "", variant: str = "",
        md5: str = "",
    ) -> Optional[Dict[str, Any]]:
        row = self.entry(kind, language, text, path, provider, variant, md5)
        if row is not None:
            self.record_many([row])
        return row

    @serialized_method
    def record_many(self, rows: List[Dict[str, Any]]) -> None:
        if rows:
            self._repository().upsert_many(rows)

    @serialized_method
    def _page(self, after_kind: str, after_key: str) -> List[Dict[str, Any]]:
        return self._repository().page(after_kind, after_key, LEDGER_PAGE)

    def entries(self) -> Iterator[Dict[str, Any]]:
        """Every ledger row whose file still exists, paged by primary key."""
        after = ("", "")
        while True:
            page = self._page(*after)
            if not page:
                return
            for row in page:
                if Path(row["path"]).is_file():
                    yield row
            after = (page[-1]["kind"], page[-1]["resource_key"])

    @serialized_method
    def count(self) -> int:
        return self._repository().count()


audio_resource_ledger = AudioResourceLedger()


__all__ = ["CLIP_KINDS", "audio_resource_ledger", "resource_key", "word_md5"]
