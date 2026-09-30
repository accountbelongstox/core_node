# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from pycore.pyfoundations.data_owner import adopt_path, ensure_owned_dir


def atomic_write_text(path: Path, text: str, file_mode: Optional[int] = None) -> Path:
    """tmp + fsync + os.replace; the tmp is adopted (owner, optional mode)
    before the replace so the published file never appears root-owned."""
    target = Path(path)
    ensure_owned_dir(target.parent)
    temp_path = target.parent / f".{target.name}.tmp.{os.getpid()}.{time.time_ns()}"
    with temp_path.open("w", encoding="utf-8") as handle:
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())
    if os.name != "nt" and file_mode is not None:
        os.chmod(temp_path, file_mode)
    adopt_path(temp_path)
    os.replace(str(temp_path), str(target))
    return target


def atomic_write_json(
    path: Path,
    data: Any,
    indent: Optional[int] = 2,
    file_mode: Optional[int] = None,
) -> Path:
    return atomic_write_text(path, json.dumps(data, ensure_ascii=False, indent=indent), file_mode)


class AtomicJsonStore:
    """Small JSON document store with atomic whole-file replacement."""

    def __init__(
        self,
        path: Path,
        default_factory: Callable[[], Dict[str, Any]],
        file_mode: Optional[int] = None,
    ) -> None:
        self.path = path.resolve()
        self.default_factory = default_factory
        self.file_mode = file_mode

    def exists(self) -> bool:
        return self.path.is_file()

    def read(self) -> Dict[str, Any]:
        if not self.path.is_file():
            return self.default_factory()
        data = json.loads(self.path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError(f"JSON state root must be an object: {self.path}")
        return data

    def write(self, data: Dict[str, Any]) -> None:
        atomic_write_json(self.path, data, file_mode=self.file_mode)


__all__ = ["AtomicJsonStore", "atomic_write_json", "atomic_write_text"]
