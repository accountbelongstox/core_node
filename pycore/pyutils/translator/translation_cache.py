# -*- coding: utf-8 -*-
"""File cache of translation results, one directory per language pair."""

import hashlib
import json
from pathlib import Path
from typing import Optional

from pycore.pyfoundations.atomic_json_store import atomic_write_json
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import map_web_path

TRANSLATOR_CACHE_DIRNAME = "translator_cache"


class TranslationCache:
    """Translation results keyed by (text, src, dest) under pycore_db."""

    @property
    def root(self) -> Path:
        return map_web_path("pycore_db") / TRANSLATOR_CACHE_DIRNAME

    @staticmethod
    def key(text: str, src: str, dest: str) -> str:
        return hashlib.md5(f"{text}:{src}:{dest}".encode("utf-8")).hexdigest()

    def _pair_dir(self, src: str, dest: str) -> Path:
        return self.root / f"{src}_to_{dest}"

    def get(self, text: str, src: str, dest: str) -> Optional[dict]:
        cache_file = self._pair_dir(src, dest) / f"{self.key(text, src, dest)}.json"
        if not cache_file.is_file():
            return None
        try:
            return json.loads(cache_file.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            ColorPrint.yellow(f"[TranslationCache] read failed file={cache_file}: {exc}")
            return None

    def set(self, text: str, src: str, dest: str, data: dict) -> None:
        cache_file = self._pair_dir(src, dest) / f"{self.key(text, src, dest)}.json"
        try:
            atomic_write_json(cache_file, data)
        except OSError as exc:
            ColorPrint.yellow(f"[TranslationCache] write failed file={cache_file}: {exc}")

    def _entries(self, src: Optional[str] = None, dest: Optional[str] = None):
        if src and dest:
            base = self._pair_dir(src, dest)
            return list(base.glob("*.json")) if base.is_dir() else []
        if not self.root.is_dir():
            return []
        return [path for path in self.root.glob("*/*.json") if path.is_file()]

    def count(self) -> int:
        return len(self._entries())

    def clear(self, src: Optional[str] = None, dest: Optional[str] = None) -> int:
        removed = 0
        for cache_file in self._entries(src, dest):
            try:
                cache_file.unlink()
                removed += 1
            except OSError as exc:
                ColorPrint.yellow(f"[TranslationCache] delete failed file={cache_file}: {exc}")
        return removed


translation_cache = TranslationCache()
