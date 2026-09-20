from functools import wraps
from pathlib import Path
from typing import Any, Callable, Dict

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method


class SerializedFile:
    def __init__(self) -> None:
        init_serialized_owner(self, "serialized_file", "SerializedFileThread")

    @serialized_method
    def execute(self, callback: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        return callback(*args, **kwargs)


class SerializedFiles:
    def __init__(self) -> None:
        self._files: Dict[str, SerializedFile] = {}
        init_serialized_owner(self, "serialized_files.registry", "SerializedFilesRegistryThread")

    @serialized_method
    def owner(self, path: Path) -> SerializedFile:
        key = str(Path(path).resolve())
        if key not in self._files:
            self._files[key] = SerializedFile()
        return self._files[key]


serialized_files = SerializedFiles()


def serialized_file(callback: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(callback)
    def invoke(path: Path, *args: Any, **kwargs: Any) -> Any:
        return serialized_files.owner(path).execute(callback, path, *args, **kwargs)
    return invoke
