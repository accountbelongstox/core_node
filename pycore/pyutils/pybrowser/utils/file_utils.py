"""Filesystem helpers used by browser automation."""

from pathlib import Path
from typing import Union


PathLike = Union[str, Path]


class FileUtils:
    @staticmethod
    def ensure_directory(directory: PathLike, log: bool = False) -> Path:
        path = Path(directory)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @staticmethod
    def ensure_file_directory(filepath: PathLike, log: bool = False) -> Path:
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        return path.parent

    @staticmethod
    def get_next_filename(
        directory: PathLike,
        prefix: str = "file",
        extension: str = "",
        start: int = 1,
        padding: int = 4,
    ) -> str:
        base_dir = FileUtils.ensure_directory(directory)
        normalized_extension = extension.lstrip(".")
        index = max(start, 0)
        while True:
            suffix = f".{normalized_extension}" if normalized_extension else ""
            candidate = base_dir / f"{prefix}_{index:0{padding}d}{suffix}"
            if not candidate.exists():
                return str(candidate)
            index += 1


__all__ = ["FileUtils"]
