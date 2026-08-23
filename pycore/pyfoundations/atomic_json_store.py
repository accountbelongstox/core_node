# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Callable, Dict, Optional


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
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self.path.with_suffix(self.path.suffix + f".tmp{os.getpid()}")
        temp_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        if os.name != "nt" and self.file_mode is not None:
            os.chmod(temp_path, self.file_mode)
        os.replace(str(temp_path), str(self.path))
        if os.name != "nt" and self.file_mode is not None:
            os.chmod(self.path, self.file_mode)


__all__ = ["AtomicJsonStore"]

