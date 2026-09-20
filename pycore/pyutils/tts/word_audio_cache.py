# -*- coding: utf-8 -*-
"""
Word audio persistent cache.
"""
import os
import shutil
import uuid
from pathlib import Path

from pycore.pyfoundations.system_paths import get_app_cache_dir

def _get_cache_dir() -> str:
    return str(get_app_cache_dir() / "word_audio")

def get_cache_path(word: str, language: str, provider: str) -> str:
    safe_word = "".join(c if c.isalnum() else "_" for c in word)
    safe_lang = "".join(c if c.isalnum() else "_" for c in language)
    safe_prov = "".join(c if c.isalnum() else "_" for c in provider)
    return os.path.join(_get_cache_dir(), safe_lang, f"{safe_word}_{safe_prov}.mp3")

def save_to_cache(word: str, language: str, provider: str, tmp_path: str) -> None:
    cache_path = get_cache_path(word, language, provider)
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    try:
        shutil.copy2(tmp_path, cache_path)
    except Exception:
        pass


def find_cached(word: str, language: str) -> Path | None:
    safe_word = "".join(c if c.isalnum() else "_" for c in word)
    safe_lang = "".join(c if c.isalnum() else "_" for c in language)
    directory = Path(_get_cache_dir()) / safe_lang
    candidates = sorted(
        (path for path in directory.glob(f"{safe_word}_*.mp3") if path.is_file() and path.stat().st_size > 0),
        key=lambda path: path.stat().st_mtime_ns,
        reverse=True,
    ) if directory.is_dir() else []
    return candidates[0].resolve() if candidates else None


def find_cached_many(words, language: str, scan_callback=None, cancel_requested=None) -> dict:
    safe_lang = "".join(c if c.isalnum() else "_" for c in language)
    directory = Path(_get_cache_dir()) / safe_lang
    wanted = {}
    newest = {}
    scanned = 0
    for word in words:
        key = str(word or "").strip().lower()
        if key:
            safe_word = "".join(c if c.isalnum() else "_" for c in key)
            wanted.setdefault(safe_word, []).append(key)
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
            stem = entry.name[:-4]
            prefixes = []
            for index, char in enumerate(stem):
                if char == "_" and stem[:index] in wanted:
                    prefixes.append(stem[:index])
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
    return output
