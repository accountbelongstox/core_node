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


def find_cached_many(words, language: str) -> dict:
    """Batch cache lookup: ONE directory scan per language instead of one glob
    per word. Returns {word(lower, stripped): Path} for every requested word
    that has any provider's audio cached (newest file wins)."""
    safe_lang = "".join(c if c.isalnum() else "_" for c in language)
    directory = Path(_get_cache_dir()) / safe_lang
    wanted = {}
    for word in words:
        key = str(word or "").strip().lower()
        if key and key not in wanted:
            wanted[key] = "".join(c if c.isalnum() else "_" for c in key)
    if not wanted or not directory.is_dir():
        return {}
    # Index every cached file under ALL its word-prefixes (a sanitized word may
    # itself contain "_", so the provider suffix split is ambiguous — match by
    # prefix instead). Newest file first so the first prefix claim wins.
    def _mtime(path: Path) -> int:
        try:
            return path.stat().st_mtime_ns
        except OSError:
            return 0

    files = sorted(
        (path for path in directory.glob("*.mp3") if path.is_file() and path.stat().st_size > 0),
        key=_mtime,
        reverse=True,
    )
    prefix_map = {}
    for path in files:
        parts = path.stem.split("_")
        for count in range(1, len(parts)):
            prefix = "_".join(parts[:count])
            if prefix not in prefix_map:
                prefix_map[prefix] = path
    result = {}
    for key, safe in wanted.items():
        path = prefix_map.get(safe)
        if path is not None:
            result[key] = path.resolve()
    return result


def store_bytes(word: str, language: str, provider: str, content: bytes) -> Path:
    output = Path(get_cache_path(word, language, provider)).resolve()
    temporary = output.with_name(f"{output.name}.partial.{uuid.uuid4().hex}")
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary.write_bytes(content)
    os.replace(temporary, output)
    return output
