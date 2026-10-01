# -*- coding: utf-8 -*-
from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, Optional, Tuple

from pycore.pyfoundations.atomic_json_store import atomic_write_text


TEXT_FILE_SUFFIX = ".txt"
SAFE_TEXT_KEY_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")


class FlatTextStore:
    def __init__(
        self,
        directory: Path,
        file_suffix: str = TEXT_FILE_SUFFIX,
    ) -> None:
        self._directory = Path(directory)
        self._file_suffix = file_suffix

    @property
    def directory(self) -> Path:
        return self._directory

    def scan(
        self,
        size_only_key_suffixes: Tuple[str, ...] = (),
    ) -> Dict[str, str]:
        self._directory.mkdir(parents=True, exist_ok=True)
        values: Dict[str, str] = {}
        for path in self._directory.glob(f"*{self._file_suffix}"):
            if not path.is_file():
                continue
            key = path.stem
            values[key] = (
                str(path.stat().st_size)
                if key.endswith(size_only_key_suffixes)
                else path.read_text(encoding="utf-8", errors="replace")
            )
        return values

    def read(self, key: str) -> Optional[str]:
        path = self._path_for_key(key)
        if not path.is_file():
            return None
        return path.read_text(encoding="utf-8", errors="replace")

    def delete(self, key: str) -> None:
        path = self._path_for_key(key)
        if path.is_file():
            path.unlink()

    def write(
        self,
        key: str,
        value: str,
        known_values: Optional[Dict[str, str]] = None,
    ) -> None:
        if known_values is not None and known_values.get(key) == value:
            return
        atomic_write_text(self._path_for_key(key), value, newline="")
        if known_values is not None:
            known_values[key] = value

    def _path_for_key(self, key: str) -> Path:
        if SAFE_TEXT_KEY_PATTERN.fullmatch(key) is None:
            raise ValueError(f"Invalid flat text store key: {key}")
        return self._directory / f"{key}{self._file_suffix}"


__all__ = [
    "FlatTextStore",
    "SAFE_TEXT_KEY_PATTERN",
    "TEXT_FILE_SUFFIX",
]
