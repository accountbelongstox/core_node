"""Directory scanning helpers for the media compressor."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Dict, List, Tuple

try:
    from ..colors import Colors
except ImportError:
    from colors import Colors


class ScannerMixin:
    """Provides directory scanning and duplicate detection utilities."""

    SOURCE_DIR: Path
    TMP_DIR: Path
    IMAGE_EXTENSIONS: set[str]
    VIDEO_EXTENSIONS: set[str]
    AUDIO_EXTENSIONS: set[str]

    def _get_file_hash(self, filepath: Path) -> str:
        """Calculate an MD5 hash for the given file."""

        import hashlib

        md5 = hashlib.md5()
        try:
            with open(filepath, "rb") as handle:
                for chunk in iter(lambda: handle.read(8192), b""):
                    md5.update(chunk)
            return md5.hexdigest()
        except Exception as exc:  # pragma: no cover - filesystem defensive
            print(f"Failed to calculate hash {filepath}: {exc}")
            return ""

    def _calculate_directory_size(self, directory: Path) -> int:
        """Return total size (in bytes) of all files in a directory tree."""

        total_size = 0
        if not directory.exists():
            return 0

        for root, _dirs, files in os.walk(directory):
            for filename in files:
                filepath = Path(root) / filename
                try:
                    total_size += filepath.stat().st_size
                except (OSError, PermissionError):
                    continue
        return total_size

    def _get_relative_path(self, filepath: Path) -> Path:
        """Return the path relative to the configured source directory."""

        try:
            return filepath.relative_to(self.SOURCE_DIR)
        except ValueError:
            return Path(filepath.name)

    def _is_zl_file(self, filepath: Path) -> bool:
        """Return True if any path segment starts with '资料整理'."""

        return any(part.startswith("资料整理") for part in filepath.parts)

    def _format_processing_msg(self, rel_path: Path, processed: int, total: int) -> str:
        """Render a formatted progress message for the current file."""

        if self._is_zl_file(rel_path):
            msg = (
                f"{Colors.BOLD}{Colors.MAGENTA}[{processed}/{total}] Processing: {rel_path}{Colors.RESET}"
            )
            msg += (
                f"\n{Colors.YELLOW}  ⚠ WARNING: This is a '资料整理' file - "
                f"Please check if this should be processed!{Colors.RESET}"
            )
            return msg

        return f"[{processed}/{total}] Processing: {rel_path}"

    def _rename_file_spaces(self, filepath: Path) -> Path:
        """Rename files that contain consecutive spaces to underscores."""

        if " " not in filepath.name:
            return filepath

        try:
            new_name = re.sub(r"\s+", "_", filepath.name)
            new_path = filepath.parent / new_name

            if new_name == filepath.name:
                return filepath

            if new_path.exists():
                print(f"  ⚠ Cannot rename (target exists): {new_name}")
                return filepath

            filepath.rename(new_path)
            print(f"  → Renamed: {filepath.name}")
            print(f"           → {new_name}")
            return new_path

        except Exception as exc:  # pragma: no cover - filesystem defensive
            print(f"  ⚠ Failed to rename file: {exc}")
            return filepath

    def scan_files(self) -> Dict[str, List[Path]]:
        """Scan the source directory and categorise media files by type."""

        print(f"\n{'='*60}")
        print(f"Scanning directory: {self.SOURCE_DIR}")
        print(f"{'='*60}")

        files: Dict[str, List[Path]] = {"images": [], "videos": [], "audios": []}

        print("Calculating source directory size...")
        self.total_source_size = self._calculate_directory_size(self.SOURCE_DIR)
        print(f"Source directory total size: {self._format_size(self.total_source_size)}")

        print("\nScanning media files...")
        file_count = 0
        for root, dirs, filenames in os.walk(self.SOURCE_DIR):
            if "_tmp" in root or "_compress" in root:
                continue

            for filename in filenames:
                filepath = Path(root) / filename
                ext = filepath.suffix.lower()

                if ext in self.IMAGE_EXTENSIONS:
                    files["images"].append(filepath)
                    file_count += 1
                elif ext in self.VIDEO_EXTENSIONS:
                    files["videos"].append(filepath)
                    file_count += 1
                elif ext in self.AUDIO_EXTENSIONS:
                    files["audios"].append(filepath)
                    file_count += 1

                if file_count and file_count % 100 == 0:
                    print(f"  Found {file_count} media files...")

        if self.COMPRESS_DIR.exists():
            compressed_size = self._calculate_directory_size(self.COMPRESS_DIR)
            print(f"\nCompressed directory size: {self._format_size(compressed_size)}")
            if compressed_size > 0 and self.total_source_size > 0:
                saved = self.total_source_size - compressed_size
                ratio = saved / self.total_source_size * 100
                print(
                    f"Space saved: {self._format_size(saved)} ({ratio:.1f}%)"
                )

        print(f"\n{'='*60}")
        print("Scan completed:")
        print(f"  - Images: {len(files['images'])}")
        print(f"  - Videos: {len(files['videos'])}")
        print(f"  - Audios: {len(files['audios'])}")
        print(f"  - Total: {file_count}")
        print(f"{'='*60}")

        return files

    def _is_duplicate_media(self, filepath: Path, file_type: str) -> Tuple[bool, str]:
        """Return whether a candidate is a duplicate of an already processed file."""

        if file_type not in {"video", "audio", "image"}:
            return False, ""

        cache = self._get_cache_snapshot()
        filename = filepath.name
        rel_path = self._get_relative_path(filepath)

        for key, info in cache["files"].items():
            if info.get("type") == file_type and info.get("status") == "compressed":
                cached_path = Path(key)
                if cached_path.name == filename and cached_path != rel_path:
                    print(f"Found duplicate file (same filename): {filename}")
                    print(f"  Original: {key}")
                    return True, key

        return False, ""
