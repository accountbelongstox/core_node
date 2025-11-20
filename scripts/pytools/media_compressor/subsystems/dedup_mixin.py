"""Directory deduplication helpers."""

from __future__ import annotations

import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

try:
    from ..colors import Colors
except ImportError:
    from colors import Colors


class DedupMixin:
    """Implements progressive duplicate replacement across directories."""

    SOURCE_DIR: Path
    VIDEO_EXTENSIONS: set[str]
    AUDIO_EXTENSIONS: set[str]
    IMAGE_EXTENSIONS: set[str]

    def scan_and_deduplicate_progressive(self) -> None:
        """Compare first-level folders progressively and replace later duplicates."""

        print(f"\n{'='*60}")
        print("Progressive Directory Deduplication")
        print(f"{'='*60}")
        print(f"Source directory: {self.SOURCE_DIR}")
        print(f"{'='*60}\n")

        first_level_dirs = [
            entry
            for entry in sorted(self.SOURCE_DIR.iterdir(), key=lambda p: p.name.lower())
            if entry.is_dir() and not entry.name.startswith(("_", "."))
        ]

        if len(first_level_dirs) < 2:
            print("Need at least two directories to perform deduplication.")
            return

        print("Detected directories:")
        for idx, directory in enumerate(first_level_dirs, 1):
            print(f"  {idx}. {directory.name}")

        priority_dir_path = None
        priority_input = input(
            "\nEnter priority directory name (press Enter to skip): "
        ).strip()

        if priority_input:
            for directory in first_level_dirs:
                if directory.name.lower() == priority_input.lower():
                    priority_dir_path = directory
                    break

            if priority_dir_path:
                first_level_dirs.remove(priority_dir_path)
                first_level_dirs.insert(0, priority_dir_path)
                print(
                    f"\n{Colors.GREEN}✓ Priority directory set: {priority_dir_path.name}{Colors.RESET}"
                )
            else:
                print(
                    f"\n{Colors.RED}✗ Directory '{priority_input}' not found, using alphabetical order{Colors.RESET}"
                )

        print("\nProcessing order:")
        for idx, directory in enumerate(first_level_dirs, 1):
            marker = (
                f" {Colors.YELLOW}← PRIORITY{Colors.RESET}" if idx == 1 and priority_dir_path else ""
            )
            print(f"  {idx}. {directory.name}{marker}")

        confirm = input("\nStart progressive deduplication? (yes/no, default: yes): ").strip().lower()
        if confirm in {"no", "n"}:
            print("Operation cancelled.")
            return

        total_replaced = 0
        total_failed = 0
        total_saved = 0

        for idx, reference_dir in enumerate(first_level_dirs):
            remaining = first_level_dirs[idx + 1 :]
            if not remaining:
                break

            print(f"\n{'-'*60}")
            print(f"Reference directory: {reference_dir.name}")
            print(f"Comparing with {len(remaining)} sibling directories...")

            replaced, failed, saved = self._deduplicate_against_targets(
                reference_dir, remaining, placeholder_suffix="duplicate_priority.txt"
            )

            total_replaced += replaced
            total_failed += failed
            total_saved += saved

        print(f"\n{'='*60}")
        print("Deduplication summary")
        print(f"  Replaced files: {total_replaced}")
        print(f"  Failed replacements: {total_failed}")
        print(f"  Space saved: {self._format_size(total_saved)}")
        print(f"{'='*60}\n")

    def _deduplicate_against_targets(
        self,
        reference_dir: Path,
        target_dirs: Iterable[Path],
        *,
        placeholder_suffix: str,
    ) -> Tuple[int, int, int]:
        """Replace duplicates in target directories relative to a reference directory."""

        index = self._build_media_index(reference_dir)
        if not index:
            print("  No media files found in reference directory.")
            return (0, 0, 0)

        replaced_total = 0
        failed_total = 0
        saved_total = 0

        for target_dir in target_dirs:
            replaced, failed, saved = self._replace_duplicates(
                reference_dir, index, target_dir, placeholder_suffix=placeholder_suffix
            )
            replaced_total += replaced
            failed_total += failed
            saved_total += saved

        return replaced_total, failed_total, saved_total

    def _build_media_index(self, root: Path) -> Dict[str, Tuple[Path, str]]:
        """Return a mapping of filename -> (path, type) for media files in a directory."""

        index: Dict[str, Tuple[Path, str]] = {}
        for current_root, _dirs, files in os.walk(root):
            for filename in files:
                path = Path(current_root) / filename
                ext = path.suffix.lower()
                media_type = None
                if ext in self.VIDEO_EXTENSIONS:
                    media_type = "video"
                elif ext in self.AUDIO_EXTENSIONS:
                    media_type = "audio"
                elif ext in self.IMAGE_EXTENSIONS:
                    media_type = "image"

                if media_type and filename not in index:
                    index[filename] = (path, media_type)

        return index

    def _replace_duplicates(
        self,
        reference_dir: Path,
        index: Dict[str, Tuple[Path, str]],
        target_dir: Path,
        *,
        placeholder_suffix: str,
    ) -> Tuple[int, int, int]:
        """Replace duplicate filenames within ``target_dir`` using ``index``."""

        replaced = 0
        failed = 0
        saved_total = 0

        for current_root, _dirs, files in os.walk(target_dir):
            for filename in files:
                if filename not in index:
                    continue

                target_path = Path(current_root) / filename
                if not target_path.exists():
                    continue

                reference_path, media_type = index[filename]
                reference_rel = reference_path.relative_to(self.SOURCE_DIR)
                target_rel = target_path.relative_to(self.SOURCE_DIR)

                try:
                    original_size = target_path.stat().st_size
                    backup_path = target_path.with_suffix(target_path.suffix + ".bak")
                    shutil.move(target_path, backup_path)

                    placeholder_content = self._render_placeholder(
                        filename=filename,
                        media_type=media_type,
                        reference_rel=reference_rel,
                        target_rel=target_rel,
                    )

                    placeholder_path = target_path.with_suffix(f".{placeholder_suffix}")
                    placeholder_path.write_text(placeholder_content, encoding="utf-8")

                    backup_path.unlink(missing_ok=True)
                    replaced += 1
                    saved_total += original_size
                except Exception as exc:  # pragma: no cover - filesystem defensive
                    print(f"    {Colors.RED}✗ Failed: {target_rel} - {exc}{Colors.RESET}")
                    failed += 1

        if replaced:
            print(
                f"  {Colors.GREEN}✓ Replaced {replaced} files in {target_dir.name} "
                f"(saved {self._format_size(saved_total)}){Colors.RESET}"
            )
        else:
            print(f"  No duplicates found in {target_dir.name}.")

        return replaced, failed, saved_total

    def _render_placeholder(
        self, *, filename: str, media_type: str, reference_rel: Path, target_rel: Path
    ) -> str:
        """Generate text for placeholder files."""

        media_label = {"video": "video", "audio": "audio", "image": "image"}.get(
            media_type, "media file"
        )

        return f"""# Duplicate Placeholder (Automated Deduplication)
# This {media_label} shares a filename with a file in another directory.
# Priority file location: {reference_rel}
#
# Original file: {filename}
# Media type: {media_type}
# This location: {target_rel}
# Reference location: {reference_rel}
# Replaced at: {datetime.now().isoformat()}
#
# To restore: copy the original file from {reference_rel}.
"""

    def _deduplicate_directory(self, root_dir: Path) -> Dict[str, int]:
        """Deduplicate duplicates within ``root_dir`` itself."""

        print(f"Deduplicating directory: {root_dir}")
        entries = self._build_media_index(root_dir)
        if not entries:
            print("  No media files detected.")
            return {"replaced": 0, "failed": 0, "saved": 0}

        replaced = 0
        failed = 0
        saved_total = 0
        seen: Dict[str, Path] = {}

        for current_root, _dirs, files in os.walk(root_dir):
            for filename in files:
                filepath = Path(current_root) / filename
                ext = filepath.suffix.lower()
                if ext not in (
                    self.VIDEO_EXTENSIONS | self.AUDIO_EXTENSIONS | self.IMAGE_EXTENSIONS
                ):
                    continue

                if filename not in seen:
                    seen[filename] = filepath
                    continue

                reference_path = seen[filename]
                reference_rel = reference_path.relative_to(root_dir)
                target_rel = filepath.relative_to(root_dir)

                try:
                    size = filepath.stat().st_size
                    backup_path = filepath.with_suffix(filepath.suffix + ".bak")
                    shutil.move(filepath, backup_path)

                    placeholder_content = self._render_placeholder(
                        filename=filename,
                        media_type="media file",
                        reference_rel=reference_rel,
                        target_rel=target_rel,
                    )
                    placeholder_path = filepath.with_suffix(".duplicate_external.txt")
                    placeholder_path.write_text(placeholder_content, encoding="utf-8")
                    backup_path.unlink(missing_ok=True)

                    replaced += 1
                    saved_total += size
                except Exception as exc:  # pragma: no cover - filesystem defensive
                    print(f"  {Colors.RED}✗ Failed: {target_rel} - {exc}{Colors.RESET}")
                    failed += 1

        print(
            f"Deduplication result: replaced {replaced}, failed {failed}, "
            f"saved {self._format_size(saved_total)}"
        )

        return {"replaced": replaced, "failed": failed, "saved": saved_total}
