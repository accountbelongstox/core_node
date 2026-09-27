# -*- coding: utf-8 -*-
"""
Word audio persistent cache.

Files: ``<app_cache>/word_audio/<lang>/{word}@{provider}.mp3`` with the word
lower-cased and both parts sanitized to letters, digits and ``_``, so the
``@`` separator splits a name exactly: a lookup matches the whole word only,
and any provider's file counts as a hit (newest wins). Legacy
``{word}_{provider}.mp3`` names are renamed once at boot (from the ledger or
an unambiguous name). ``word_audio_cache_index`` loads the whole cache into
memory once at pycore boot (background) and is kept current by every store,
so batch lookups (audio orchestration manifests) are dictionary hits instead
of a directory scan per task. Every store is also recorded in
``audio_resource_ledger`` (the exact word text is not recoverable from the
sanitized file name).
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
from pycore.pyutils.tts.audio_resource_ledger import audio_resource_ledger


WORD_PROVIDER_SEPARATOR = "@"
LEGACY_SEPARATOR = "_"
AUDIO_SUFFIX = ".mp3"


def _get_cache_dir() -> str:
    return str(get_app_cache_dir() / "word_audio")


def cache_root() -> Path:
    """Root of the word cache (one sub-directory per sanitized language)."""
    return Path(_get_cache_dir())


def _safe(value: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in value)


def _word_key(word: str) -> str:
    return _safe(str(word or "").strip().lower())


def _file_name(word: str, provider: str) -> str:
    return f"{_word_key(word)}{WORD_PROVIDER_SEPARATOR}{_safe(provider)}{AUDIO_SUFFIX}"


def get_cache_path(word: str, language: str, provider: str) -> str:
    return os.path.join(_get_cache_dir(), _safe(language), _file_name(word, provider))


def _name_word_key(name: str) -> str:
    """Exact ``{safe_word}`` of a ``{safe_word}@{provider}.mp3`` name ('' for
    any other name, including legacy ones)."""
    if not name.endswith(AUDIO_SUFFIX):
        return ""
    word, separator, _provider = name[:-len(AUDIO_SUFFIX)].rpartition(WORD_PROVIDER_SEPARATOR)
    return word if separator else ""


def _legacy_word_provider(stem: str, ledger_word: str) -> Tuple[str, str]:
    """(word, provider) of a legacy ``{safe_word}_{provider}`` stem: from the
    ledger text when it prefixes the stem, else from an unambiguous name (one
    separator, letters/digits only); ('', '') when it cannot be recovered."""
    safe_word = _safe(ledger_word)
    if ledger_word and stem.startswith(safe_word + LEGACY_SEPARATOR):
        return ledger_word, stem[len(safe_word) + 1:]
    word, _separator, provider = stem.partition(LEGACY_SEPARATOR)
    if stem.count(LEGACY_SEPARATOR) == 1 and word.isalnum() and provider.isalnum():
        return word, provider
    return "", ""


def migrate_legacy_names() -> int:
    """Rename legacy ``{word}_{provider}.mp3`` files to the exact
    ``{word}@{provider}.mp3`` form once (lower-cased word); returns the count."""
    root = Path(_get_cache_dir())
    if not root.is_dir():
        return 0
    ledger_words = {
        str(Path(row["path"])): str(row.get("text") or "")
        for row in audio_resource_ledger.entries()
        if row.get("kind") == "word"
    }
    moved = 0
    for directory in sorted(entry for entry in root.iterdir() if entry.is_dir()):
        for path in sorted(directory.glob("*" + AUDIO_SUFFIX)):
            if WORD_PROVIDER_SEPARATOR in path.stem or path.stat().st_size <= 0:
                continue
            word, provider = _legacy_word_provider(path.stem, ledger_words.get(str(path.resolve()), ""))
            if not word:
                continue
            target = directory / _file_name(word, provider)
            if target.is_file() and target.stat().st_mtime_ns >= path.stat().st_mtime_ns:
                continue
            os.replace(path, target)
            audio_resource_ledger.record("word", directory.name, word, str(target), provider)
            moved += 1
    return moved


class WordAudioCacheIndex:
    """In-memory index {safe_lang: {safe_word: (mtime_ns, path)}} of the cache.

    Same match semantics as the directory scan (the exact word before the
    ``@`` separator, newest file wins). A language not loaded yet falls back
    to the directory scan.
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
                key = _name_word_key(entry.name)
                if not key or not entry.is_file():
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
        migrated = migrate_legacy_names()
        if migrated:
            ColorPrint.cyan(f"[WordAudioCache] renamed {migrated} legacy cache file(s) to exact word names")
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
        """Keep the index current after a store. Creates the language's
        mapping lazily (never bails out on a missing one) so this covers a
        language directory created after boot (its first store starts the
        entry) and a store that lands while ``load_all`` is still scanning
        that language: the in-progress mapping this writes into survives
        ``_install``'s newest-wins merge with the scan result."""
        target = Path(path)
        safe_lang = target.parent.name
        key = _name_word_key(target.name)
        if not key:
            return
        mapping = self._index.setdefault(safe_lang, {})
        stamp = target.stat().st_mtime_ns if target.is_file() else 0
        previous = mapping.get(key)
        if previous is None or stamp >= previous[0]:
            mapping[key] = (stamp, str(target))

    def lookup_many(self, words: Iterable[str], language: str) -> Optional[Dict[str, Path]]:
        """{lowercased word: path} from the index; None when not loaded."""
        wanted: Dict[str, List[str]] = {}
        for word in words:
            key = str(word or "").strip().lower()
            if key:
                wanted.setdefault(_word_key(key), []).append(key)
        hits = self._lookup(_safe(language), list(wanted))
        if hits is None:
            return None
        return {key: Path(path) for safe, path in hits.items() for key in wanted[safe]}


word_audio_cache_index = WordAudioCacheIndex()


def save_to_cache(word: str, language: str, provider: str, tmp_path: str, md5: str = "") -> None:
    cache_path = get_cache_path(word, language, provider)
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    try:
        shutil.copy2(tmp_path, cache_path)
    except Exception:
        return
    word_audio_cache_index.note_stored(cache_path)
    audio_resource_ledger.record("word", language, word, cache_path, provider, md5=md5)


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
            wanted.setdefault(_word_key(key), []).append(key)
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
            key = _name_word_key(entry.name)
            if key not in wanted or not entry.is_file():
                continue
            try:
                metadata = entry.stat()
            except OSError:
                continue
            if metadata.st_size <= 0:
                continue
            previous = newest.get(key)
            if previous is None or metadata.st_mtime_ns > previous[0]:
                newest[key] = (metadata.st_mtime_ns, Path(entry.path))
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
    audio_resource_ledger.record("word", language, word, str(output), provider)
    return output
