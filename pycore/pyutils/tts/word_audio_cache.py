# -*- coding: utf-8 -*-
"""
Word audio persistent cache.
"""
import os
import shutil
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


def store_bytes(word: str, language: str, provider: str, content: bytes) -> Path:
    output = Path(get_cache_path(word, language, provider)).resolve()
    temporary = output.with_name(f"{output.name}.partial")
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary.write_bytes(content)
    os.replace(temporary, output)
    return output
