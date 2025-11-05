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

        # Check if another process already scanned
        cache = self._get_cache_snapshot(silent=True)
        scan_info = cache.get('scan_info', {})

        if scan_info.get('completed') and scan_info.get('total_files', 0) > 0:
            print(f"{Colors.CYAN}Scan already completed by another process{Colors.RESET}")
            print(f"  Completed at: {scan_info.get('completed_at', 'unknown')}")
            print(f"  Total files: {scan_info['total_files']}")
            print(f"  Skipping scan, using cached data...\n")
            files = None  # Signal to use cache only
        else:
            print(f"{Colors.CYAN}Scanning directories...{Colors.RESET}")
            files = self.scan_files()
            self._mark_scan_completed(files)

        self._process_collected_files(files)

    def scan_and_compress_one_by_one(self) -> None:
        """Sequential compression helper explicitly requested by the menu."""

        print(f"\n{'='*60}")
        print("Sequential Compression Mode")
        print(f"{'='*60}\n")

        files = self.scan_files()
        self._process_collected_files(files)

    def _mark_scan_completed(self, files: Dict[str, List[Path]]) -> None:
        """Mark scan as completed and add all scanned files to cache as pending."""
        total_scanned = sum(len(batch) for batch in files.values())

        print(f"  Writing {total_scanned} files to cache...", flush=True)

        def mark_scan_and_add_files(cache):
            # Mark scan as completed
            cache['scan_info'] = {
                'completed': True,
                'completed_at': datetime.now().isoformat(),
                'completed_by': self.client_id,
                'total_files': total_scanned,
            }

            # Add all scanned files to cache as 'pending' (if not already present)
            files_added = 0
            files_skipped = 0

            for group, paths in files.items():
                # Extract media type from group name (e.g., 'videos' -> 'video')
                media_type = group[:-1] if group.endswith('s') else group

                for filepath in paths:
                    rel_path = str(self._get_relative_path(filepath))

                    # Skip if already in cache (don't overwrite existing status)
                    if rel_path in cache['files']:
                        files_skipped += 1
                        continue

                    # Add as pending
                    cache['files'][rel_path] = {
                        'status': 'pending',
                        'type': media_type,
                        'source': str(filepath),
                        'scanned_at': datetime.now().isoformat(),
                    }
                    files_added += 1

            print(f"    Added {files_added} new files, skipped {files_skipped} existing", flush=True)

        self._update_cache_file(mark_scan_and_add_files)
        print(f"  Scan marked as completed ({total_scanned} files)\n")

    def _process_collected_files(self, files: Dict[str, List[Path]] = None) -> None:
        """Process the scanned files dictionary or use cache if files=None."""

        if files is None:
            # Use cache only, no new scan
            print(f"\n{Colors.CYAN}Loading task list from cache...{Colors.RESET}", flush=True)
            snapshot = self._get_cache_snapshot(silent=False)
            cache_files = snapshot.get("files", {})

            # Count by status
            total_scanned = len(cache_files)
            already_compressed = sum(1 for e in cache_files.values() if e.get('status') == 'compressed')
            in_progress = sum(1 for e in cache_files.values() if e.get('status') == 'processing')

            print(f"\n{Colors.CYAN}Cache Summary:{Colors.RESET}")
            print(f"  Total files in cache: {total_scanned}")
            print(f"  Already compressed: {Colors.GREEN}{already_compressed}{Colors.RESET}")
            print(f"  In progress: {Colors.YELLOW}{in_progress}{Colors.RESET}")
            print(f"  To process: {Colors.YELLOW}{total_scanned - already_compressed - in_progress}{Colors.RESET}\n")

            # Process from cache
            self._process_from_cache_only()
            return

        total_scanned = sum(len(batch) for batch in files.values())
        if total_scanned == 0:
            print("No files to process.")
            return

        print(f"\n{Colors.CYAN}Analyzing files... (reading cache){Colors.RESET}", flush=True)

        snapshot = self._get_cache_snapshot()
        cache_files = snapshot.get("files", {})

        print(f"{Colors.CYAN}Filtering files...{Colors.RESET}", flush=True)

        files_to_process = []
        already_compressed = 0
        files_checked = 0

        for group, paths in files.items():
            media_type = group[:-1]
            for filepath in paths:
                files_checked += 1
                if files_checked % 1000 == 0:
                    print(f"  Checked {files_checked}/{total_scanned} files...", flush=True)

                rel_path = str(self._get_relative_path(filepath))
                entry = cache_files.get(rel_path)

                if entry and entry.get("status") == "compressed":
                    already_compressed += 1
                else:
                    files_to_process.append((filepath, media_type))

        total_to_process = len(files_to_process)

        print(f"\n{Colors.CYAN}Scan Summary:{Colors.RESET}")
        print(f"  Total files scanned: {total_scanned}")
        print(f"  Already compressed: {Colors.GREEN}{already_compressed}{Colors.RESET}")
        print(f"  To process: {Colors.YELLOW}{total_to_process}{Colors.RESET}\n")

        if total_to_process == 0:
            print(f"{Colors.GREEN}All files already processed!{Colors.RESET}\n")
            return

        processed = 0
        skipped_by_other_clients = 0
        cache_refresh_interval = 50  # Refresh cache snapshot every N files

        # Get initial cache snapshot
        print(f"{Colors.CYAN}Loading cache for concurrent processing...{Colors.RESET}", flush=True)
        cache_snapshot = self._get_cache_snapshot(silent=False)
        snapshot_age = 0

        for filepath, media_type in files_to_process:
            rel_path = self._get_relative_path(filepath)
            file_key = str(rel_path)
            filepath = self._rename_file_spaces(filepath)

            # Refresh cache snapshot periodically to see other clients' progress
            snapshot_age += 1
            if snapshot_age >= cache_refresh_interval:
                cache_snapshot = self._get_cache_snapshot(silent=True)  # Silent refresh
                snapshot_age = 0

            # Quick check: skip if already completed (no lock needed)
            entry = cache_snapshot.get('files', {}).get(file_key)
            if entry and entry.get('status') in ['compressed', 'failed']:
                skipped_by_other_clients += 1
                continue

            # Check if being processed by another client
            if entry and entry.get('processing_by'):
                if entry['processing_by'] != self.client_id:
                    if not self._is_lock_expired(entry):
                        skipped_by_other_clients += 1
                        continue

            # Try to acquire lock (pass snapshot to avoid re-reading)
            if not self.try_acquire_lock(file_key, cache_snapshot):
                skipped_by_other_clients += 1
                continue

            # Successfully acquired lock, now process
            processed += 1
            print(f"\n[{processed}] Processing: {rel_path}", flush=True)
            self._process_single_file_locked(filepath, media_type, file_key)

        print(f"\n{'='*60}")
        print("Compression complete")
        print(f"  New files processed: {self.total_files_processed}")
        print(f"  Already compressed (skipped): {already_compressed}")
        if skipped_by_other_clients > 0:
            print(f"  Skipped by other clients: {skipped_by_other_clients}")
        print(f"  Total: {total_scanned}")
        if self.total_compressed_size:
            print(f"  Total compressed size: {self._format_size(self.total_compressed_size)}")
        print(f"{'='*60}\n")

    def _process_from_cache_only(self) -> None:
        """Process files from cache only (no filesystem scan)."""

        print(f"{Colors.CYAN}Processing from cache...{Colors.RESET}\n")

        cache_refresh_interval = 50
        cache_snapshot = self._get_cache_snapshot(silent=True)
        snapshot_age = 0

        processed = 0
        skipped_by_other_clients = 0
        already_compressed = 0

        for file_key, entry in cache_snapshot.get('files', {}).items():
            # Refresh snapshot periodically
            snapshot_age += 1
            if snapshot_age >= cache_refresh_interval:
                cache_snapshot = self._get_cache_snapshot(silent=True)
                snapshot_age = 0
                entry = cache_snapshot.get('files', {}).get(file_key, entry)

            # Skip compressed
            if entry.get('status') == 'compressed':
                already_compressed += 1
                continue

            # Skip if being processed by another client (and not expired)
            if entry.get('processing_by'):
                if entry['processing_by'] != self.client_id:
                    if not self._is_lock_expired(entry):
                        skipped_by_other_clients += 1
                        continue

            # Try to acquire lock
            if not self.try_acquire_lock(file_key, cache_snapshot):
                skipped_by_other_clients += 1
                continue

            # Get file info from cache
            source_path_str = entry.get('source')
            media_type = entry.get('type')

            if not source_path_str or not media_type:
                # Incomplete entry, skip
                self.release_lock(file_key, 'failed', error='Incomplete cache entry')
                continue

            filepath = Path(source_path_str)
            if not filepath.exists():
                # File no longer exists
                self.release_lock(file_key, 'failed', error='Source file not found')
                continue

            # Process this file
            processed += 1
            print(f"\n[{processed}] Processing: {file_key}", flush=True)
            self._process_single_file_locked(filepath, media_type, file_key)

        print(f"\n{'='*60}")
        print("Compression complete (cache mode)")
        print(f"  New files processed: {self.total_files_processed}")
        print(f"  Already compressed (skipped): {already_compressed}")
        if skipped_by_other_clients > 0:
            print(f"  Skipped by other clients: {skipped_by_other_clients}")
        if self.total_compressed_size:
            print(f"  Total compressed size: {self._format_size(self.total_compressed_size)}")
        print(f"{'='*60}\n")

    def _process_single_file_locked(self, filepath: Path, media_type: str, file_key: str) -> None:
        """Process a single file (lock must be already acquired by caller)."""

        rel_path = Path(file_key)  # file_key is the string representation of rel_path
        status = "skipped"
        extra = {"type": media_type, "source": str(filepath)}

        try:
            # Double-check status (in case another client finished between snapshot and lock)
            snapshot = self._get_cache_snapshot(silent=True)
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
            # Remove 'status' from extra to avoid conflict with positional argument
            extra_without_status = {k: v for k, v in extra.items() if k != 'status'}
            self.release_lock(file_key, status, **extra_without_status)

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
