import zlib
from functools import wraps
from pathlib import Path
from typing import Any, Callable, Tuple

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method

# Fixed owner pool: one path always maps to the same owner (per-path order is
# kept) while the thread count stays bounded however many paths are touched.
SERIALIZED_FILE_OWNER_COUNT = 8


class SerializedFile:
    def __init__(self) -> None:
        init_serialized_owner(self, "serialized_file", "SerializedFileThread")

    @serialized_method
    def execute(self, callback: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        return callback(*args, **kwargs)


class SerializedFiles:
    def __init__(self) -> None:
        self._owners: Tuple[SerializedFile, ...] = tuple(
            SerializedFile() for _index in range(SERIALIZED_FILE_OWNER_COUNT)
        )

    def owner(self, path: Path) -> SerializedFile:
        key = str(Path(path).resolve()).encode("utf-8")
        return self._owners[zlib.crc32(key) % len(self._owners)]


serialized_files = SerializedFiles()


def serialized_file(callback: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(callback)
    def invoke(path: Path, *args: Any, **kwargs: Any) -> Any:
        return serialized_files.owner(path).execute(callback, path, *args, **kwargs)
    return invoke
