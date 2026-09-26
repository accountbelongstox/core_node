# -*- coding: utf-8 -*-
"""
Word audio persistent cache.

Files: ``<app_cache>/word_audio/<lang>/{word}_{provider}.mp3`` — any
provider's file counts as a hit (newest wins). ``word_audio_cache_index``
loads the whole cache into memory once at pycore boot (background) and is
kept current by every store, so batch lookups (audio orchestration manifests)
are dictionary hits instead of a directory scan per task.
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


def _get_cache_dir() -> str:
    return str(get_app_cache_dir() / "word_audio")


def _safe(value: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in value)


def get_cache_path(word: str, language: str, provider: str) -> str:
    return os.path.join(_get_cache_dir(), _safe(language), f"{_safe(word)}_{_safe(provider)}.mp3")


def _stem_prefixes(stem: str) -> List[str]:
    """Every ``{safe_word}`` a ``{safe_word}_{provider}`` stem may belong to."""
    return [stem[:index] for index, char in enumerate(stem) if char == "_" and index > 0]


class WordAudioCacheIndex:
    """In-memory index {safe_lang: {safe_word: (mtime_ns, path)}} of the cache.

    Same match semantics as the directory scan (a stem prefix before any
    ``_`` is a candidate word, newest file wins). A language not loaded yet
    falls back to the directory scan.
    """

    def __init__(self) -> None:
        self._index: Dict[str, Dict[str, Tuple[int, str]]] = {}
        self._loading = False
        init_serialized_owner(self, "tts.word_audio_cache_index", "WordAudioCacheIndexState")

    @staticmethod
    def _scan_language(safe_lang: str) -> Dict[str, Tuple[int, str]]:
        """Directory scan of one language (runs off the owner thread)."""
        directory = Path(_get_cache_dir()) / safe_lang
        newest: Dict[str, Tuple[int, str]] = {}
        if not directory.is_dir():
            return newest
        with os.scandir(directory) as entries:
            for entry in entries:
                if not entry.name.endswith(".mp3") or not entry.is_file():
                    continue
                try:
                    metadata = entry.stat()
                except OSError:
                    continue
                if metadata.st_size <= 0:
                    continue
                for prefix in _stem_prefixes(entry.name[:-4]):
                    previous = newest.get(prefix)
                    if previous is None or metadata.st_mtime_ns > previous[0]:
                        newest[prefix] = (metadata.st_mtime_ns, entry.path)
        return newest

    @serialized_method
    def _begin_load(self) -> bool:
        if self._loading:
            return False
        self._loading = True
        return True

    @serialized_method
    def _install(self, safe_lang: str, mapping: Dict[str, Tuple[int, str]]) -> None:
        current = self._index.get(safe_lang) or {}
        # Stores that landed during the scan are newer than the scan result.
        for key, value in current.items():
            if key not in mapping or value[0] > mapping[key][0]:
                mapping[key] = value
        self._index[safe_lang] = mapping

    @serialized_method
    def _finish_load(self) -> None:
        self._loading = False

    def load_all(self) -> None:
        """Full boot load of every language directory (background thread)."""
        if not self._begin_load():
            return
        root = Path(_get_cache_dir())
        languages: List[str] = []
        if root.is_dir():
            with os.scandir(root) as entries:
                languages = sorted(entry.name for entry in entries if entry.is_dir())
        total = 0
        for safe_lang in languages:
            mapping = self._scan_language(safe_lang)
            total += len(mapping)
            self._install(safe_lang, mapping)
        self._finish_load()
        ColorPrint.green(f"[WordAudioCache] index loaded: languages={len(languages)} keys={total}")

    def start_background_load(self) -> None:
        start_bus_task(self.load_all, thread_name="WordAudioCacheIndexLoad")

    @serialized_method
    def _lookup(self, safe_lang: str, safe_words: List[str]) -> Optional[Dict[str, str]]:
        mapping = self._index.get(safe_lang)
        if mapping is None:
            return None
        return {word: mapping[word][1] for word in safe_words if word in mapping}

    @serialized_method
    def note_stored(self, path: str) -> None:
        """Keep a loaded language current after a store."""
        target = Path(path)
        safe_lang = target.parent.name
        mapping = self._index.get(safe_lang)
        if mapping is None or not target.name.endswith(".mp3"):
            return
        stamp = target.stat().st_mtime_ns if target.is_file() else 0
        for prefix in _stem_prefixes(target.name[:-4]):
            previous = mapping.get(prefix)
            if previous is None or stamp >= previous[0]:
                mapping[prefix] = (stamp, str(target))

    def lookup_many(self, words: Iterable[str], language: str) -> Optional[Dict[str, Path]]:
        """{lowercased word: path} from the index; None when not loaded."""
        wanted: Dict[str, List[str]] = {}
        for word in words:
            key = str(word or "").strip().lower()
            if key:
                wanted.setdefault(_safe(key), []).append(key)
        hits = self._lookup(_safe(language), list(wanted))
        if hits is None:
            return None
        return {key: Path(path) for safe, path in hits.items() for key in wanted[safe]}


word_audio_cache_index = WordAudioCacheIndex()


def save_to_cache(word: str, language: str, provider: str, tmp_path: str) -> None:
    cache_path = get_cache_path(word, language, provider)
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    try:
        shutil.copy2(tmp_path, cache_path)
    except Exception:
        return
    word_audio_cache_index.note_stored(cache_path)


def find_cached(word: str, language: str) -> Path | None:
    hits = find_cached_many([word], language)
    path = hits.get(str(word or "").strip().lower())
    return path.resolve() if path is not None and path.is_file() else None


def find_cached_many(words, language: str, scan_callback=None, cancel_requested=None) -> dict:
    words = list(words)
    indexed = word_audio_cache_index.lookup_many(words, language)
    if indexed is not None:
        if scan_callback is not None:
            scan_callback(len(indexed))
        return indexed
    safe_lang = _safe(language)
    directory = Path(_get_cache_dir()) / safe_lang
    wanted = {}
    newest = {}
    scanned = 0
    for word in words:
        key = str(word or "").strip().lower()
        if key:
            wanted.setdefault(_safe(key), []).append(key)
    if not wanted or not directory.is_dir():
        return {}
    with os.scandir(directory) as entries:
        for entry in entries:
            scanned += 1
            if scanned % 512 == 0:
                if cancel_requested is not None and cancel_requested():
                    break
                if scan_callback is not None:
                    scan_callback(scanned)
            if not entry.name.endswith(".mp3") or not entry.is_file():
                continue
            prefixes = [prefix for prefix in _stem_prefixes(entry.name[:-4]) if prefix in wanted]
            if not prefixes:
                continue
            try:
                metadata = entry.stat()
            except OSError:
                continue
            if metadata.st_size <= 0:
                continue
            for prefix in prefixes:
                previous = newest.get(prefix)
                if previous is None or metadata.st_mtime_ns > previous[0]:
                    newest[prefix] = (metadata.st_mtime_ns, Path(entry.path))
    if scan_callback is not None:
        scan_callback(scanned)
    return {
        key: newest[safe][1]
        for safe, keys in wanted.items() if safe in newest
        for key in keys
    }


def store_bytes(word: str, language: str, provider: str, content: bytes) -> Path:
    output = Path(get_cache_path(word, language, provider)).resolve()
    temporary = output.with_name(f"{output.name}.partial.{uuid.uuid4().hex}")
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary.write_bytes(content)
    os.replace(temporary, output)
    word_audio_cache_index.note_stored(str(output))
    return output
