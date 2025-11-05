"""High-level processing flows for the media compressor."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

try:
    from ..colors import Colors
except ImportError:
    from colors import Colors


class ProcessingMixin:
    """Provides orchestration routines for scanning and compression."""

    TMP_DIR: Path
    COMPRESS_DIR: Path
    PRIORITY_DIR: Path
    total_source_size: int
    total_compressed_size: int
    total_files_processed: int

    def scan_and_compress_batch(self) -> None:
        """Scan directories and compress all media, preferring GPU batch mode when available."""

        print(f"\n{'='*60}")
        print(f"Scan and Compress: {self.SOURCE_DIR}")
        print(f"{'='*60}\n")

        if self.unified_compressor:
            try:
                status = self.unified_compressor.get_status_info()
                workers = status.get("max_workers", 1)
                print(f"Unified compressor status: workers={workers}")
            except Exception:  # pragma: no cover - diagnostics only
                pass
        else:
            print("Unified compressor unavailable, falling back to sequential processing.")

        files = self.scan_files()
        self._process_collected_files(files)

    def scan_and_compress_one_by_one(self) -> None:
        """Sequential compression helper explicitly requested by the menu."""

        print(f"\n{'='*60}")
        print("Sequential Compression Mode")
        print(f"{'='*60}\n")

        files = self.scan_files()
        self._process_collected_files(files)

    def _process_collected_files(self, files: Dict[str, List[Path]]) -> None:
        """Process the scanned files dictionary produced by :meth:`scan_files`."""

        total = sum(len(batch) for batch in files.values())
        if total == 0:
            print("No files to process.")
            return

        processed = 0
        for group, paths in files.items():
            media_type = group[:-1]  # images -> image
            for filepath in paths:
                processed += 1
                rel_path = self._get_relative_path(filepath)
                print(self._format_processing_msg(rel_path, processed, total))
                filepath = self._rename_file_spaces(filepath)
                self._process_single_file(filepath, media_type)

        print(f"\n{'='*60}")
        print("Compression complete")
        print(f"  Processed files: {self.total_files_processed}")
        if self.total_compressed_size:
            print(f"  Total compressed size: {self._format_size(self.total_compressed_size)}")
        print(f"{'='*60}\n")

    def _process_single_file(self, filepath: Path, media_type: str) -> None:
        """Process a single file with lock coordination and cache updates."""

        rel_path = self._get_relative_path(filepath)
        file_key = str(rel_path)

        if not self.try_acquire_lock(file_key):
            return

        status = "skipped"
        extra = {"type": media_type, "source": str(filepath)}

        try:
            snapshot = self._get_cache_snapshot()
            entry = snapshot["files"].get(file_key)
            if entry and entry.get("status") == "compressed":
                print(f"  Already compressed: {rel_path}")
                self._increment_stats(skipped=1)
                status = "compressed"
                extra.update(entry)
                return

            is_dup, original_key = self._is_duplicate_media(filepath, media_type)
            if is_dup:
                print(f"  Duplicate detected, skipping: {rel_path}")
                self._increment_stats(skipped=1)
                status = "duplicate"
                extra.update({"duplicate_of": original_key})
                return

            if media_type in {"video", "audio"}:
                check = self._verify_file(filepath)
                if check is False:
                    print(f"  {Colors.RED}✗ Corrupted file detected, skipping{Colors.RESET}")
                    self._increment_stats(skipped=1)
                    status = "failed"
                    extra.update({"error": "Integrity check failed"})
                    return

            target_path = self.COMPRESS_DIR / rel_path

            if media_type == "image":
                success = self._compress_image(filepath, target_path)
                final_path = (
                    target_path.with_suffix(".jpg")
                    if target_path.with_suffix(".jpg").exists()
                    else target_path
                )
            elif media_type == "video":
                final_path = target_path.with_suffix(".mp4")
                success = self._compress_video(filepath, final_path)
            elif media_type == "audio":
                final_path = target_path.with_suffix(".m4a")
                success = self._compress_audio(filepath, final_path)
            else:
                print(f"  Unsupported media type: {media_type}")
                self._increment_stats(skipped=1)
                extra.update({"error": "Unsupported media type"})
                return

            if success:
                try:
                    compressed_size = final_path.stat().st_size
                except FileNotFoundError:
                    compressed_size = 0

                original_size = filepath.stat().st_size
                saved = max(0, original_size - compressed_size)
                file_hash = self._get_file_hash(filepath)

                self.total_files_processed += 1
                self.total_compressed_size += compressed_size
                self._increment_stats(compressed=1)

                extra.update(
                    {
                        "compressed_path": str(final_path),
                        "original_size": original_size,
                        "compressed_size": compressed_size,
                        "saved_bytes": saved,
                        "hash": file_hash,
                        "original_filename": filepath.name,
                        "processed_at": datetime.now().isoformat(),
                    }
                )
                status = "compressed"

                print(
                    f"  {Colors.GREEN}✓ Compressed{Colors.RESET} "
                    f"(saved {self._format_size(saved)})"
                )
            else:
                self._increment_stats(failed=1)
                extra.update({"error": "Compression failed"})
                status = "failed"
                print(f"  {Colors.RED}✗ Compression failed{Colors.RESET}")

        finally:
            self.release_lock(file_key, status, **extra)

    def retry_failed_files(self) -> None:
        """Reset failed records to `pending` for re-processing."""

        print(f"\n{'='*60}")
        print("Retry Failed Files")
        print(f"{'='*60}")

        cache = self._get_cache_snapshot()
        failed_items = [
            (key, info)
            for key, info in cache["files"].items()
            if info.get("status") == "failed"
        ]

        if not failed_items:
            print("No failed files to retry")
            return

        print(f"Found {len(failed_items)} failed files\n")
        for idx, (key, info) in enumerate(failed_items[:10], 1):
            print(f"  {idx}. {key} -> {info.get('error', 'unknown error')}")

        if len(failed_items) > 10:
            print(f"  ... and {len(failed_items) - 10} more")

        confirm = input("Retry all failed files? (yes/no, default: yes): ").strip().lower()
        if confirm in {"no", "n"}:
            print("Operation cancelled")
            return

        failed_keys = [key for key, _ in failed_items]

        def mark_pending(cache_dict: Dict) -> None:
            for key in failed_keys:
                entry = cache_dict["files"].get(key)
                if not entry:
                    continue
                entry["status"] = "pending"
                entry.pop("error", None)

        self._update_cache_file(mark_pending)
        print(f"\n✓ Cleared {len(failed_items)} failed statuses. Run option 1 to retry.")
