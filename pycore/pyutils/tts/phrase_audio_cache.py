# -*- coding: utf-8 -*-
"""
Phrase audio permanent cache (R13: a generated clip is never deleted).

Files: ``<app_cache>/tts_phrase_cache/<lang>/{content_id}@{provider}.mp3`` with
``content_id = media_content_id(text)`` (the identity Laravel and the clients
use for sentences and phrases), so one phrase has one clip however its text is
spelled, and any provider's file counts as a hit (newest wins).
``phrase_audio_cache_index`` loads the whole cache into memory once at pycore
boot (background; the first lookup starts it when boot did not) and is kept
current by every store, so batch lookups are dictionary hits instead of a
directory scan per call. Every store is also recorded in
``audio_resource_ledger`` (the exact phrase text is not recoverable from the
file name).
"""
import os
import shutil
import uuid
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
from pycore.pyfoundations.system_paths import get_app_cache_dir
from pycore.pyfoundations.text_parsing import normalize_language_code
from pycore.pyutils.common.strtools.normalization import media_content_id
from pycore.pyutils.tts.audio_resource_ledger import audio_resource_ledger


PHRASE_CACHE_DIR_NAME = "tts_phrase_cache"
PROVIDER_SEPARATOR = "@"
AUDIO_SUFFIX = ".mp3"


def cache_root() -> Path:
    """Root of the phrase cache (one sub-directory per language code)."""
    return get_app_cache_dir() / PHRASE_CACHE_DIR_NAME


def _safe(value: str) -> str:
    return "".join(char if char.isalnum() else "_" for char in str(value or ""))


def phrase_content_id(text: str) -> str:
    """The phrase identity, or "" when the text has nothing to speak."""
    text = str(text or "").strip()
    return media_content_id(text) if any(char.isalnum() for char in text) else ""


def _file_name(content_id: str, provider: str) -> str:
    return f"{content_id}{PROVIDER_SEPARATOR}{_safe(provider)}{AUDIO_SUFFIX}"


def _language_dir(language: str) -> Path:
    return cache_root() / _safe(normalize_language_code(language))


def get_cache_path(text: str, language: str, provider: str) -> str:
    return str(_language_dir(language) / _file_name(phrase_content_id(text), provider))


def _name_content_id(name: str) -> str:
    """``{content_id}`` of a ``{content_id}@{provider}.mp3`` name ('' for any
    other name)."""
    if not name.endswith(AUDIO_SUFFIX):
        return ""
    content_id, separator, _provider = name[:-len(AUDIO_SUFFIX)].rpartition(PROVIDER_SEPARATOR)
    return content_id if separator else ""


def _scan_directory(directory: Path, wanted: Optional[set] = None) -> Dict[str, Tuple[int, str]]:
    """{content_id: (mtime_ns, path)} of one language directory, newest file
    per id, empty files skipped; ``wanted`` limits it to those ids."""
    newest: Dict[str, Tuple[int, str]] = {}
    if not directory.is_dir():
        return newest
    with os.scandir(directory) as entries:
        for entry in entries:
            key = _name_content_id(entry.name)
            if not key or (wanted is not None and key not in wanted) or not entry.is_file():
                continue
            try:
                metadata = entry.stat()
            except OSError:
                continue
            if metadata.st_size <= 0:
                continue
            previous = newest.get(key)
            if previous is None or metadata.st_mtime_ns > previous[0]:
                newest[key] = (metadata.st_mtime_ns, entry.path)
    return newest


def _merge_newest(target: Dict[str, Tuple[int, str]], source: Dict[str, Tuple[int, str]]) -> None:
    for key, value in source.items():
        if key not in target or value[0] > target[key][0]:
            target[key] = value


class PhraseAudioCacheIndex:
    """In-memory index {language: {content_id: (mtime_ns, path)}} of the cache.

    Same match semantics as the directory scan (the id before the ``@``
    separator, newest file wins). Until the boot load has finished, lookups
    answer None (the caller scans the directory) and stores queue in
    ``_pending``; ``_install`` merges them into the loaded index.
    """

    def __init__(self) -> None:
        self._index: Dict[str, Dict[str, Tuple[int, str]]] = {}
        self._pending: Dict[str, Dict[str, Tuple[int, str]]] = {}
        self._load_started = False
        self._loaded = False
        init_serialized_owner(self, "tts.phrase_audio_cache_index", "PhraseAudioCacheIndexState")

    @serialized_method
    def _begin_load(self) -> bool:
        if self._load_started:
            return False
        self._load_started = True
        return True

    @serialized_method
    def _install(self, loaded: Dict[str, Dict[str, Tuple[int, str]]]) -> None:
        for language, mapping in self._pending.items():
            _merge_newest(loaded.setdefault(language, {}), mapping)
        self._pending.clear()
        self._index = loaded
        self._loaded = True

    def load_all(self) -> None:
        """Full load of every language directory (background thread)."""
        root = cache_root()
        loaded: Dict[str, Dict[str, Tuple[int, str]]] = {}
        if root.is_dir():
            with os.scandir(root) as entries:
                for entry in sorted(entries, key=lambda item: item.name):
                    if entry.is_dir():
                        loaded[entry.name] = _scan_directory(Path(entry.path))
        total = sum(len(mapping) for mapping in loaded.values())
        self._install(loaded)
        ColorPrint.green(f"[PhraseAudioCache] index loaded: languages={len(loaded)} keys={total}")

    def start_background_load(self) -> None:
        if self._begin_load():
            start_bus_task(self.load_all, thread_name="PhraseAudioCacheIndexLoad")

    @serialized_method
    def _lookup(self, language_dir: str, content_ids: List[str]) -> Optional[Dict[str, str]]:
        if not self._loaded:
            return None
        mapping = self._index.get(language_dir, {})
        return {key: mapping[key][1] for key in content_ids if key in mapping}

    @serialized_method
    def note_stored(self, path: str) -> None:
        """Keep the index current after a store."""
        target = Path(path)
        key = _name_content_id(target.name)
        if not key:
            return
        stamp = target.stat().st_mtime_ns if target.is_file() else 0
        languages = self._index if self._loaded else self._pending
        _merge_newest(languages.setdefault(target.parent.name, {}), {key: (stamp, str(target))})

    def lookup_many(self, content_ids: Iterable[str], language: str) -> Optional[Dict[str, Path]]:
        """{content_id: path} from the index; None while it is not loaded."""
        self.start_background_load()
        hits = self._lookup(_safe(normalize_language_code(language)), list(content_ids))
        return None if hits is None else {key: Path(path) for key, path in hits.items()}


phrase_audio_cache_index = PhraseAudioCacheIndex()


def lookup_many(content_ids: Iterable[str], language: str) -> Dict[str, Path]:
    """{content_id: existing clip path} for the ids the cache holds: the
    in-memory index, or one directory scan while it is still loading."""
    wanted = [key for key in dict.fromkeys(str(item or "").strip() for item in content_ids) if key]
    if not wanted:
        return {}
    hits = phrase_audio_cache_index.lookup_many(wanted, language)
    if hits is None:
        hits = {key: Path(path) for key, (_stamp, path) in _scan_directory(_language_dir(language), set(wanted)).items()}
    return {key: path for key, path in hits.items() if path.is_file()}


def find_cached_many(texts: Iterable[str], language: str) -> Dict[str, Path]:
    """{text: existing clip path} for the phrase texts the cache holds (keys
    are the texts as given; the cache itself is addressed by content id)."""
    identities: Dict[str, List[str]] = {}
    for text in texts:
        content_id = phrase_content_id(str(text or ""))
        if content_id:
            identities.setdefault(content_id, []).append(text)
    return {
        text: path
        for content_id, path in lookup_many(list(identities), language).items()
        for text in identities[content_id]
    }


def find_cached(text: str, language: str) -> Optional[Path]:
    hits = find_cached_many([text], language)
    path = hits.get(text)
    return path.resolve() if path is not None else None


def store(text: str, language: str, provider: str, source_path: str) -> Optional[Path]:
    """Copy a validated clip into the cache (atomic, never overwritten by a
    failed copy), index it and record it in the ledger; None when the copy
    failed (the source file stays where it is)."""
    content_id = phrase_content_id(text)
    if not content_id:
        return None
    output = _language_dir(language) / _file_name(content_id, provider)
    temporary = output.with_name(f"{output.name}.partial.{uuid.uuid4().hex}")
    try:
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source_path, temporary)
        os.replace(temporary, output)
    except OSError as exc:
        ColorPrint.yellow(f"[PhraseAudioCache] store {source_path} -> {output} failed: {exc}")
        return None
    return _note_stored(text, language, provider, output)


def store_bytes(text: str, language: str, provider: str, content: bytes) -> Optional[Path]:
    content_id = phrase_content_id(text)
    if not content_id:
        return None
    output = _language_dir(language) / _file_name(content_id, provider)
    temporary = output.with_name(f"{output.name}.partial.{uuid.uuid4().hex}")
    try:
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary.write_bytes(content)
        os.replace(temporary, output)
    except OSError as exc:
        ColorPrint.yellow(f"[PhraseAudioCache] store {output} failed: {exc}")
        return None
    return _note_stored(text, language, provider, output)


def _note_stored(text: str, language: str, provider: str, output: Path) -> Path:
    phrase_audio_cache_index.note_stored(str(output))
    audio_resource_ledger.record("phrase", language, text, str(output), provider)
    return output


__all__ = [
    "cache_root",
    "find_cached",
    "find_cached_many",
    "get_cache_path",
    "lookup_many",
    "phrase_audio_cache_index",
    "phrase_content_id",
    "store",
    "store_bytes",
]
