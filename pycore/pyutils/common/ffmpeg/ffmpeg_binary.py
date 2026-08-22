import os
import shutil
from pathlib import Path
from typing import Iterable, Optional

from pycore.pyutils.common.ffmpeg.ffmpeg_constants import (
    LINUX_BINARY_DIRECTORIES,
    WINDOWS_INSTALL_ROOTS,
    WINDOWS_SEARCH_DEPTH,
)
from pycore.pyutils.common.ffmpeg.ffmpeg_models import FFmpegBinaries


class FFmpegBinaryResolver:
    def resolve(
        self,
        explicit_ffmpeg: Optional[str] = None,
        explicit_ffprobe: Optional[str] = None,
    ) -> FFmpegBinaries:
        ffmpeg_path = self._resolve_binary("ffmpeg", explicit_ffmpeg)
        ffprobe_path = self._resolve_sibling(ffmpeg_path, "ffprobe")
        if ffprobe_path is None:
            ffprobe_path = self._resolve_binary("ffprobe", explicit_ffprobe)
        return FFmpegBinaries(ffmpeg=ffmpeg_path, ffprobe=ffprobe_path)

    def _resolve_binary(self, name: str, explicit: Optional[str]) -> Optional[Path]:
        executable_name = self._executable_name(name)
        if explicit:
            explicit_path = Path(explicit).expanduser().resolve()
            if explicit_path.is_file():
                return explicit_path

        path_match = shutil.which(executable_name)
        if path_match:
            return Path(path_match).resolve()

        candidates = self._windows_candidates(executable_name) if os.name == "nt" else self._linux_candidates(executable_name)
        return next((candidate.resolve() for candidate in candidates if candidate.is_file()), None)

    def _resolve_sibling(self, binary: Optional[Path], name: str) -> Optional[Path]:
        if binary is None:
            return None
        sibling = binary.parent / self._executable_name(name)
        return sibling.resolve() if sibling.is_file() else None

    def _linux_candidates(self, executable_name: str) -> Iterable[Path]:
        return tuple(directory / executable_name for directory in LINUX_BINARY_DIRECTORIES)

    def _windows_candidates(self, executable_name: str) -> Iterable[Path]:
        candidates = []
        for root in WINDOWS_INSTALL_ROOTS:
            if not root.is_dir():
                continue
            direct_candidates = (root / executable_name, root / "bin" / executable_name)
            candidates.extend(direct_candidates)
            root_depth = len(root.parts)
            for current_root, directories, files in os.walk(root):
                current_path = Path(current_root)
                depth = len(current_path.parts) - root_depth
                if depth >= WINDOWS_SEARCH_DEPTH:
                    directories.clear()
                if executable_name in files:
                    candidates.append(current_path / executable_name)
        return tuple(candidates)

    @staticmethod
    def _executable_name(name: str) -> str:
        return f"{name}.exe" if os.name == "nt" else name


ffmpeg_binary_resolver = FFmpegBinaryResolver()

